"""Import an Awesome Town scene into Blender.

Usage
-----
Blender 3.x / 4.x. Open the Scripting workspace, load this file, set
SCENE_JSON below to the exported .json (the .bin must sit beside it), and Run.
Or from a terminal:

    blender --python tools/blender_import.py -- /path/to/awesome-town.json

What it does
------------
Builds one mesh object per building, so the outliner reads the way a lighter
thinks rather than exposing thousands of loose modules. Geometry arrives
baked, so this script never needs to know what any of the shapes are.

Materials are rebuilt from the collage images referenced in the json. Each
distinct image becomes one material, shared across every face that uses it,
and faces are assigned to slots per triangle. Lit modules get an emission
mix, glass and mirror become their own reflective materials.

Set the sun to match the scene it was exported from, with a matching strength
and colour, so a lighting pass starts where the browser left off.
"""

import bpy
import bmesh
import json
import os
import sys
import struct
from mathutils import Vector

# Point this at the exported json if you are running from the text editor.
SCENE_JSON = ""

# Blender is Z up, three.js is Y up.
def to_blender(x, y, z):
    return (x, -z, y)


def read_arg_path():
    argv = sys.argv
    if "--" in argv:
        rest = argv[argv.index("--") + 1:]
        if rest:
            return rest[0]
    return ""


def load_scene(json_path):
    with open(json_path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    bin_path = os.path.join(os.path.dirname(json_path), data["buffer"]["file"])
    with open(bin_path, "rb") as fh:
        raw = fh.read()
    return data, raw


def section(raw, layout, key):
    """Return one buffer section as a flat tuple of numbers."""
    info = layout[key]
    fmt = "f" if info["type"] == "f32" else "i"
    size = 4 * info["count"]
    return struct.unpack_from("<%d%s" % (info["count"], fmt), raw, info["offset"])


def find_asset_root(json_path, data):
    """Locate the folder the collage paths are relative to.

    The export records paths like collage/images/foo.png relative to the tool,
    so look upward from the json for the first folder that actually contains
    them rather than making the user configure it.
    """
    candidates = [os.path.dirname(json_path)]
    here = os.path.dirname(json_path)
    for _ in range(4):
        here = os.path.dirname(here)
        if here:
            candidates.append(here)
    sample = None
    for img in data.get("images", []):
        sample = img.get("path")
        break
    if not sample:
        return candidates[0]
    for root in candidates:
        if os.path.exists(os.path.join(root, sample)):
            return root
    return candidates[0]


def make_image_material(name, image_path, emissive=False):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    out.location = (500, 0)
    bsdf.location = (200, 0)

    if image_path and os.path.exists(image_path):
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.location = (-150, 0)
        try:
            tex.image = bpy.data.images.load(image_path, check_existing=True)
        except RuntimeError:
            tex.image = None
        if tex.image:
            nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
            # Cutouts carry real alpha and should punch through.
            mat.blend_method = "CLIP"
            nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
            if emissive:
                nt.links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"]
                             if "Emission Color" in bsdf.inputs else bsdf.inputs["Emission"])
                bsdf.inputs["Emission Strength"].default_value = 2.0
    set_input(bsdf, "Roughness", 0.85)
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def set_input(node, name, value):
    if name in node.inputs:
        node.inputs[name].default_value = value


def make_solid_material(name, rgb, emissive=False, roughness=0.85, metallic=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        set_input(bsdf, "Base Color", (rgb[0], rgb[1], rgb[2], 1.0))
        set_input(bsdf, "Roughness", roughness)
        set_input(bsdf, "Metallic", metallic)
        if emissive:
            key = "Emission Color" if "Emission Color" in bsdf.inputs else "Emission"
            set_input(bsdf, key, (rgb[0], rgb[1], rgb[2], 1.0))
            set_input(bsdf, "Emission Strength", 2.0)
    return mat


def build_materials(data, asset_root):
    """One material per image, plus the shader-only ones and vertex colour."""
    mats = {}

    for img in data.get("images", []):
        path = os.path.join(asset_root, img["path"])
        mats[("image", img["index"])] = make_image_material(
            "AT_img_%03d_%s" % (img["index"], os.path.splitext(img["name"])[0]), path
        )

    for m in data.get("materials", []):
        path = os.path.join(asset_root, m["path"])
        mats[("texture", m["index"])] = make_image_material(
            "AT_mat_%02d_%s" % (m["index"], os.path.splitext(m["name"])[0]), path
        )

    mats[("glass", 0)] = make_solid_material(
        "AT_glass", (0.74, 0.84, 0.88), roughness=0.16, metallic=0.82
    )
    mats[("mirror", 0)] = make_solid_material(
        "AT_mirror", (0.95, 0.95, 0.95), roughness=0.03, metallic=1.0
    )

    # Flat painted faces read their colour from the mesh, so one material
    # serves every palette colour in the town.
    paint = bpy.data.materials.new(name="AT_paint")
    paint.use_nodes = True
    nt = paint.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    attr = nt.nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Col"
    attr.location = (-250, 0)
    if bsdf:
        nt.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
        set_input(bsdf, "Roughness", 0.85)
    mats[("paint", 0)] = paint

    return mats


def slot_for(tri_image, tri_mat, i):
    """Which material a triangle wants, as a stable key."""
    m = tri_mat[i]
    if m == -2:
        return ("glass", 0)
    if m == -3:
        return ("mirror", 0)
    if m >= 0:
        return ("texture", m)
    img = tri_image[i]
    if img >= 0:
        return ("image", img)
    return ("paint", 0)


def build_building(data, arrays, mats, rec, collection):
    pos, nor, uv, col, tri_image, tri_mat, tri_glow = arrays
    v0 = rec["vertexStart"]
    vn = rec["vertexCount"]
    t0 = v0 // 3
    tn = vn // 3

    mesh = bpy.data.meshes.new(rec["id"])
    verts = []
    for v in range(v0, v0 + vn):
        verts.append(to_blender(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]))
    faces = [(i * 3, i * 3 + 1, i * 3 + 2) for i in range(tn)]
    mesh.from_pydata(verts, [], faces)

    # Material slots, deduplicated per building so a slot list stays short.
    slot_index = {}
    for t in range(t0, t0 + tn):
        key = slot_for(tri_image, tri_mat, t)
        if key not in slot_index:
            slot_index[key] = len(slot_index)
            mesh.materials.append(mats.get(key, mats[("paint", 0)]))

    for i, poly in enumerate(mesh.polygons):
        poly.material_index = slot_index[slot_for(tri_image, tri_mat, t0 + i)]
        poly.use_smooth = False

    uv_layer = mesh.uv_layers.new(name="UVMap")
    color_layer = mesh.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="POINT")
    for loop in mesh.loops:
        v = v0 + loop.vertex_index
        uv_layer.data[loop.index].uv = (uv[v * 2], uv[v * 2 + 1])
    for i in range(vn):
        v = v0 + i
        color_layer.data[i].color = (col[v * 3], col[v * 3 + 1], col[v * 3 + 2], 1.0)

    mesh.validate()
    mesh.update()

    obj = bpy.data.objects.new(rec["id"], mesh)
    collection.objects.link(obj)
    # Kept for anything downstream that wants to query the town by hand.
    obj["at_family"] = rec.get("family", "")
    obj["at_height"] = rec.get("height", 0.0)
    obj["at_modules"] = rec.get("modules", 0)
    if rec.get("material"):
        obj["at_material"] = rec["material"].get("kind", "")
    return obj


def add_sun(data, collection):
    sun_info = data.get("sun")
    if not sun_info:
        return None
    light = bpy.data.lights.new(name="AT_sun", type="SUN")
    light.energy = max(0.1, float(sun_info.get("intensity", 3.0)))
    light.angle = 0.02
    c = sun_info.get("color", "#ffffff").lstrip("#")
    light.color = tuple(int(c[i:i + 2], 16) / 255.0 for i in (0, 2, 4))
    obj = bpy.data.objects.new("AT_sun", light)
    d = sun_info.get("direction", [0.5, 0.8, 0.3])
    direction = Vector(to_blender(d[0], d[1], d[2]))
    obj.location = direction * 200.0
    # Point it back at the origin the town is built around.
    obj.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler()
    collection.objects.link(obj)
    return obj


def import_scene(json_path):
    data, raw = load_scene(json_path)
    layout = data["buffer"]["layout"]
    arrays = (
        section(raw, layout, "position"),
        section(raw, layout, "normal"),
        section(raw, layout, "uv"),
        section(raw, layout, "color"),
        section(raw, layout, "triImage"),
        section(raw, layout, "triMaterial"),
        section(raw, layout, "triGlow"),
    )

    asset_root = find_asset_root(json_path, data)
    name = data.get("name", "awesome-town")

    root = bpy.data.collections.new("%s (%s)" % (name, data.get("mode", "full")))
    bpy.context.scene.collection.children.link(root)
    buildings_col = bpy.data.collections.new("buildings")
    root.children.link(buildings_col)

    mats = build_materials(data, asset_root)

    for rec in data["buildings"]:
        build_building(data, arrays, mats, rec, buildings_col)

    add_sun(data, root)

    counts = data.get("counts", {})
    print(
        "[awesome town] imported %s buildings, %s triangles from %s"
        % (counts.get("buildings", "?"), counts.get("triangles", "?"), os.path.basename(json_path))
    )
    return root


if __name__ == "__main__":
    path = SCENE_JSON or read_arg_path()
    if not path:
        print("[awesome town] set SCENE_JSON or pass the json path after --")
    else:
        import_scene(path)
