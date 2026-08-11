// Material cache. Hundreds of modules share a few dozen materials, keyed by
// what they actually look like. Textures are shared too — the per-face
// cropping lives in the geometry, not the texture.

import * as THREE from 'three';

// Shared uniforms, so the duotone sliders retune every material at once
// without rebuilding the city.
export const duotone = {
  amount: { value: 0 },
  ink: { value: new THREE.Color('#16140f') },
  paper: { value: new THREE.Color('#f7f2e6') },
};

const DUO_PARS = `
  uniform float uDuoAmount;
  uniform vec3 uDuoInk;
  uniform vec3 uDuoPaper;
  vec3 collageDuotone(vec3 c) {
    float lum = pow(clamp(dot(c, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0), 0.4545);
    vec3 duo = mix(uDuoInk, uDuoPaper, smoothstep(0.02, 0.98, lum));
    return mix(c, duo, uDuoAmount);
  }
`;

function patchDuotone(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uDuoAmount = duotone.amount;
    shader.uniforms.uDuoInk = duotone.ink;
    shader.uniforms.uDuoPaper = duotone.paper;
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `${DUO_PARS}\nvoid main() {`)
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        #ifdef USE_MAP
          diffuseColor.rgb = collageDuotone(diffuseColor.rgb);
        #endif`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        #ifdef USE_EMISSIVEMAP
          totalEmissiveRadiance = collageDuotone(totalEmissiveRadiance);
        #endif`
      );
  };
  material.customProgramCacheKey = () => 'collage-duotone';
}

export class MaterialCache {
  constructor(pool) {
    this.pool = pool;
    this.map = new Map();
    this.night = 0;
  }

  clear() {
    this.map.forEach((m) => m.dispose());
    this.map.clear();
  }

  // spec: { image: index|null, color, glow, glowColor, glowStrength, doubleSided }
  get(spec) {
    const key = [
      spec.image ?? 'x',
      spec.color || '#ffffff',
      spec.glow ? 1 : 0,
      spec.glowColor || '',
      (spec.glowStrength ?? 1).toFixed(2),
      spec.doubleSided ? 'd' : 's',
    ].join('|');

    let material = this.map.get(key);
    if (material) return material;

    const item = spec.image == null ? null : this.pool.get(spec.image);
    material = new THREE.MeshStandardMaterial({
      map: item ? item.texture : null,
      color: new THREE.Color(item ? '#ffffff' : spec.color || '#cccccc'),
      roughness: 0.86,
      metalness: 0.0,
      side: spec.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    });

    if (spec.glow) {
      material.emissive = new THREE.Color(spec.glowColor || '#ffcc66');
      if (item) material.emissiveMap = item.texture;
      material.userData.glowStrength = spec.glowStrength ?? 1;
    } else {
      material.userData.glowStrength = 0;
    }
    material.emissiveIntensity = this.emissiveFor(material);

    patchDuotone(material);
    this.map.set(key, material);
    return material;
  }

  emissiveFor(material) {
    const strength = material.userData.glowStrength || 0;
    if (!strength) return 0;
    // Windows are barely there at noon and full at midnight. Kept under 1 so a
    // lit face reads as lit rather than as a blown-out light source.
    return strength * (0.04 + 0.85 * this.night * this.night);
  }

  setNight(night) {
    this.night = night;
    this.map.forEach((m) => {
      if (m.userData.glowStrength) m.emissiveIntensity = this.emissiveFor(m);
    });
  }

  setDuotone(amount, ink, paper) {
    duotone.amount.value = amount;
    duotone.ink.value.set(ink);
    duotone.paper.value.set(paper);
  }
}
