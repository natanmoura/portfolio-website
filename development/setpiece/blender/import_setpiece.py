"""Import a setpiece scene.json into Blender.

Run from Blender's text editor, or headless:

    blender --python import_setpiece.py -- path/to/scene.json

This is the high-fidelity route out of the browser tool. glTF loses projected
materials because glTF has no projector concept; here we rebuild them properly
as a real camera plus a UV Project modifier, so the drawing lands on the
blockout exactly the way it did in the viewer and stays editable afterwards.

Coordinate systems differ: the tool is Y-up (three.js), Blender is Z-up. One
conversion matrix at the top handles it, applied to every transform.
"""

import base64
import json
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

# three.js world (X right, Y up, -Z forward) -> Blender world (X right, Y
# forward, Z up). Camera local axes already agree, so no second fix is needed.
YUP_TO_ZUP = Matrix.Rotation(math.radians(90.0), 4, "X")

# Blender's default sensor width. Focal length in the scene file is in image
# pixels, which converts to millimetres against whatever sensor we declare.
SENSOR_WIDTH_MM = 36.0


# --------------------------------------------------------------------- assets


def resolve_image(src, asset_dir, index):
    """Return a bpy image for a scene source, which may be a data URL.

    Data URLs are how the browser tool keeps a scene self-contained. Blender
    cannot load one, so we write it out beside the json once and reuse it.
    """
    if not src:
        return None

    if src.startswith("data:"):
        header, _, payload = src.partition(",")
        ext = ".png"
        if "jpeg" in header or "jpg" in header:
            ext = ".jpg"
        elif "webp" in header:
            ext = ".webp"

        os.makedirs(asset_dir, exist_ok=True)
        path = os.path.join(asset_dir, "setpiece_%03d%s" % (index, ext))
        if not os.path.exists(path):
            with open(path, "wb") as fh:
                fh.write(base64.b64decode(payload))
    else:
        path = src if os.path.isabs(src) else os.path.join(asset_dir, src)

    if not os.path.exists(path):
        print("setpiece: missing image %s" % path)
        return None

    return bpy.data.images.load(path, check_existing=True)


# -------------------------------------------------------------------- cameras


def build_station(station, asset_dir, index):
    """Create the camera an image was solved from. Also the projector."""
    cam_data = bpy.data.cameras.new("cam_" + station["name"])
    cam_data.sensor_fit = "HORIZONTAL"
    cam_data.sensor_width = SENSOR_WIDTH_MM
    cam_data.lens = station["focal"] * SENSOR_WIDTH_MM / station["width"]

    cam_obj = bpy.data.objects.new("station_" + station["name"], cam_data)
    bpy.context.collection.objects.link(cam_obj)

    rot = Matrix([station["rotation"][i::4] for i in range(4)]).transposed()
    rot.translation = Vector(station["position"])
    cam_obj.matrix_world = YUP_TO_ZUP @ rot

    # Hang the source image on the camera as a background plate so the match
    # can be eyeballed from the solved angle, which is the only check that
    # actually tells you whether the solve was right.
    image = resolve_image(station["src"], asset_dir, index)
    if image:
        cam_data.show_background_images = True
        bg = cam_data.background_images.new()
        bg.image = image
        bg.alpha = 0.6

    return cam_obj, image


# ------------------------------------------------------------------ materials


def make_projected_material(name, image, camera_obj, station):
    """Flat, unlit projection of the source image, driven by a UV map that a
    UV Project modifier keeps aligned to the station camera."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new("ShaderNodeOutputMaterial")
    # Emission rather than Principled: the drawing already contains its own
    # light. Relighting it is the fastest way to lose the look.
    emit = nodes.new("ShaderNodeEmission")
    tex = nodes.new("ShaderNodeTexImage")
    uv = nodes.new("ShaderNodeUVMap")

    tex.image = image
    tex.extension = "CLIP"
    uv.uv_map = "setpiece_proj"

    links.new(uv.outputs["UV"], tex.inputs["Vector"])
    links.new(tex.outputs["Color"], emit.inputs["Color"])
    links.new(emit.outputs["Emission"], out.inputs["Surface"])

    for node, x in ((uv, -700), (tex, -450), (emit, -150), (out, 40)):
        node.location = (x, 0)

    mat["setpiece_projector"] = camera_obj.name
    mat["setpiece_aspect"] = [station["width"], station["height"]]
    return mat


def make_cutout_material(name, image, opacity=1.0, color=None):
    """Unlit alpha cutout for collage cards."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new("ShaderNodeOutputMaterial")
    mix = nodes.new("ShaderNodeMixShader")
    emit = nodes.new("ShaderNodeEmission")
    trans = nodes.new("ShaderNodeBsdfTransparent")

    if image:
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = image
        tex.extension = "CLIP"
        links.new(tex.outputs["Color"], emit.inputs["Color"])
        links.new(tex.outputs["Alpha"], mix.inputs["Fac"])
        tex.location = (-400, 0)
    else:
        emit.inputs["Color"].default_value = hex_to_rgba(color or "#8a8a92")
        mix.inputs["Fac"].default_value = opacity

    links.new(trans.outputs["BSDF"], mix.inputs[1])
    links.new(emit.outputs["Emission"], mix.inputs[2])
    links.new(mix.outputs["Shader"], out.inputs["Surface"])

    for node, x in ((trans, -180), (emit, -180), (mix, 20), (out, 220)):
        node.location = (x, 0)

    # Property name moved in Blender 4.2. Try the new one, fall back quietly.
    try:
        mat.surface_render_method = "BLENDED"
    except (AttributeError, TypeError):
        mat.blend_method = "BLEND"
        mat.shadow_method = "CLIP"

    return mat


def hex_to_rgba(value):
    value = value.lstrip("#")
    rgb = [int(value[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    # Approximate sRGB -> linear so colours picked in the browser survive.
    rgb = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    return (rgb[0], rgb[1], rgb[2], 1.0)


# ---------------------------------------------------------------------- nodes


def build_node(node, scene_data, materials, cameras):
    size = node.get("size", [1, 1, 1])
    w, h, d = (list(size) + [0, 0, 0])[:3]
    kind = node.get("type", "card")

    if kind == "box":
        bpy.ops.mesh.primitive_cube_add(size=1)
        obj = bpy.context.active_object
        local = Matrix.Diagonal((w, h, d, 1.0))
        # Cube is centred; nodes are authored base-centred.
        local = Matrix.Translation((0, h / 2.0, 0)) @ local
    elif kind == "cylinder":
        bpy.ops.mesh.primitive_cylinder_add(radius=0.5, depth=1, vertices=24)
        obj = bpy.context.active_object
        # Blender cylinders stand along local Z, the tool's along Y.
        local = (
            Matrix.Translation((0, h / 2.0, 0))
            @ Matrix.Rotation(math.radians(90), 4, "X")
            @ Matrix.Diagonal((w, w, h, 1.0))
        )
    elif kind == "ground":
        bpy.ops.mesh.primitive_plane_add(size=1)
        obj = bpy.context.active_object
        local = Matrix.Rotation(math.radians(-90), 4, "X") @ Matrix.Diagonal((w, d or w, 1.0, 1.0))
    else:  # card
        bpy.ops.mesh.primitive_plane_add(size=1)
        obj = bpy.context.active_object
        local = (
            Matrix.Translation((0, h / 2.0, 0))
            @ Matrix.Rotation(math.radians(90), 4, "X")
            @ Matrix.Diagonal((w, h, 1.0, 1.0))
        )

    obj.name = node.get("name") or node["id"]

    pos = node.get("position", [0, 0, 0])
    world = (
        Matrix.Translation(Vector(pos))
        @ Matrix.Rotation(node.get("rotationY", 0.0), 4, "Y")
        @ local
    )
    obj.matrix_world = YUP_TO_ZUP @ world

    mat_key, mat = materials(node)
    if mat:
        obj.data.materials.append(mat)

    if mat and "setpiece_projector" in mat:
        cam = cameras.get(mat["setpiece_projector"])
        if cam:
            obj.data.uv_layers.new(name="setpiece_proj")
            mod = obj.modifiers.new("setpiece_proj", "UV_PROJECT")
            mod.uv_layer = "setpiece_proj"
            aspect = mat["setpiece_aspect"]
            mod.aspect_x = aspect[0]
            mod.aspect_y = aspect[1]
            mod.projector_count = 1
            mod.projectors[0].object = cam

    if node.get("billboard"):
        # Billboarding is a viewer behaviour, not geometry. Record it so a
        # Blender-side constraint or driver can pick it up rather than baking
        # in a rotation that will be wrong on the first camera move.
        obj["setpiece_billboard"] = node["billboard"]

    return obj


# ----------------------------------------------------------------------- main


def import_setpiece(path):
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)

    asset_dir = os.path.join(os.path.dirname(os.path.abspath(path)), "setpiece_assets")

    collection = bpy.data.collections.new("setpiece")
    bpy.context.scene.collection.children.link(collection)
    layer = bpy.context.view_layer.layer_collection.children[collection.name]
    bpy.context.view_layer.active_layer_collection = layer

    cameras = {}
    station_images = {}
    station_by_id = {}
    for i, station in enumerate(data.get("stations", [])):
        cam_obj, image = build_station(station, asset_dir, i)
        cameras[cam_obj.name] = cam_obj
        station_images[station["id"]] = (cam_obj, image)
        station_by_id[station["id"]] = station

    cache = {}
    counter = {"n": len(data.get("stations", []))}

    def material_for(node):
        spec = node.get("material") or {}
        mode = spec.get("mode", "flat")

        if mode == "projected":
            sid = spec.get("station") or (data["stations"][0]["id"] if data.get("stations") else None)
            if sid in station_images:
                cam_obj, image = station_images[sid]
                if image:
                    key = ("proj", sid)
                    if key not in cache:
                        cache[key] = make_projected_material(
                            "setpiece_proj_%s" % sid, image, cam_obj, station_by_id[sid]
                        )
                    return key, cache[key]

        if mode == "texture" and spec.get("src"):
            key = ("tex", spec["src"], round(spec.get("opacity", 1.0), 3), spec.get("color"))
            if key not in cache:
                counter["n"] += 1
                image = resolve_image(spec["src"], asset_dir, counter["n"])
                cache[key] = make_cutout_material(
                    "setpiece_cutout_%d" % counter["n"], image,
                    spec.get("opacity", 1.0), spec.get("color"),
                )
            return key, cache[key]

        key = ("flat", spec.get("color", "#8a8a92"), round(spec.get("opacity", 1.0), 3))
        if key not in cache:
            counter["n"] += 1
            cache[key] = make_cutout_material(
                "setpiece_flat_%d" % counter["n"], None,
                spec.get("opacity", 1.0), spec.get("color"),
            )
        return key, cache[key]

    for node in data.get("nodes", []):
        build_node(node, data, material_for, cameras)

    print("setpiece: imported %d nodes, %d stations"
          % (len(data.get("nodes", [])), len(data.get("stations", []))))


if __name__ == "__main__":
    argv = sys.argv
    args = argv[argv.index("--") + 1:] if "--" in argv else []
    if not args:
        raise SystemExit("usage: blender --python import_setpiece.py -- scene.json")
    import_setpiece(args[0])
