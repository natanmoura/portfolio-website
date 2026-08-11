import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { moodOf, type MoodId } from './moods'

/* ------------------------------------------------------------------ */
/* a single set of colours the whole scene lerps toward                */

class MoodRig {
  skyTop = new THREE.Color()
  skyBottom = new THREE.Color()
  horizon = new THREE.Color()
  fog = new THREE.Color()
  mote = new THREE.Color()
  shaft = new THREE.Color()
  fogDensity = 0.08
  shaftStrength = 0.5
  moteSpeed = 0.1
  moteSize = 9

  target = { ...moodOf('dusk') }

  constructor(id: MoodId) {
    this.set(id, true)
  }

  set(id: MoodId, instant = false) {
    const m = moodOf(id)
    this.target = { ...m }
    if (instant) {
      this.skyTop.set(m.skyTop)
      this.skyBottom.set(m.skyBottom)
      this.horizon.set(m.horizon)
      this.fog.set(m.fog)
      this.mote.set(m.moteColor)
      this.shaft.set(m.shaft)
      this.fogDensity = m.fogDensity
      this.shaftStrength = m.shaftStrength
      this.moteSpeed = m.moteSpeed
      this.moteSize = m.moteSize
    }
  }

  step(dt: number) {
    const k = 1 - Math.pow(0.0015, dt) // ~1.2s to settle
    const t = this.target
    this.skyTop.lerp(_c.set(t.skyTop), k)
    this.skyBottom.lerp(_c.set(t.skyBottom), k)
    this.horizon.lerp(_c.set(t.horizon), k)
    this.fog.lerp(_c.set(t.fog), k)
    this.mote.lerp(_c.set(t.moteColor), k)
    this.shaft.lerp(_c.set(t.shaft), k)
    this.fogDensity += (t.fogDensity - this.fogDensity) * k
    this.shaftStrength += (t.shaftStrength - this.shaftStrength) * k
    this.moteSpeed += (t.moteSpeed - this.moteSpeed) * k
    this.moteSize += (t.moteSize - this.moteSize) * k
  }
}
const _c = new THREE.Color()

/* ------------------------------------------------------------------ */
/* sky: an inverted sphere with a three stop vertical gradient and a
   slow band of noise so it never looks like a CSS gradient            */

const skyVert = /* glsl */ `
  varying vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const skyFrag = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uBottom;
  uniform vec3 uHorizon;
  uniform float uTime;
  varying vec3 vPos;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), u.x),
               mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
  }
  float fbm(vec2 p){
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  void main() {
    float h = normalize(vPos).y;
    float t = smoothstep(-0.35, 0.85, h);
    vec3 col = mix(uBottom, uTop, t);

    // horizon bloom, sits just under the eyeline
    float band = exp(-pow((h + 0.06) * 4.2, 2.0));
    col = mix(col, uHorizon, band * 0.55);

    // slow cloud / haze breakup
    vec2 uv = vec2(atan(vPos.z, vPos.x) * 0.6, h * 1.6);
    float n = fbm(uv * 2.2 + vec2(uTime * 0.012, uTime * 0.004));
    col += (n - 0.5) * 0.055;

    // dither out the banding
    float d = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    col += (d - 0.5) / 255.0;

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`

function Sky({ rig }: { rig: MoodRig }) {
  const mat = useRef<THREE.ShaderMaterial>(null!)
  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color('#1a1226') },
      uBottom: { value: new THREE.Color('#4c2b3a') },
      uHorizon: { value: new THREE.Color('#a8502f') },
      uTime: { value: 0 },
    }),
    [],
  )

  useFrame((_, dt) => {
    uniforms.uTime.value += dt
    uniforms.uTop.value.copy(rig.skyTop)
    uniforms.uBottom.value.copy(rig.skyBottom)
    uniforms.uHorizon.value.copy(rig.horizon)
  })

  return (
    <mesh scale={[-1, 1, 1]} renderOrder={-10}>
      <sphereGeometry args={[60, 48, 32]} />
      <shaderMaterial
        ref={mat}
        vertexShader={skyVert}
        fragmentShader={skyFrag}
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/* motes: additive points, soft round, each with its own drift and a
   twinkle that is slow enough to read as glimmer rather than noise    */

const MAX_MOTES = 1000

const moteVert = /* glsl */ `
  attribute float aSeed;
  attribute float aScale;
  attribute float aIndex;
  uniform float uTime;
  uniform float uSize;
  uniform float uSpeed;
  uniform float uCount;
  uniform vec2 uPointer;
  varying float vTwinkle;
  varying float vDepth;
  varying float vWarm;

  void main() {
    vec3 p = position;

    // lazy vertical rise plus a lateral sway, everything on its own clock
    float t = uTime * uSpeed;
    p.y = mod(p.y + t * (0.4 + aSeed * 0.9) + 14.0, 28.0) - 14.0;
    p.x += sin(t * (0.5 + aSeed) + aSeed * 34.0) * (0.5 + aSeed);
    p.z += cos(t * (0.35 + aSeed * 0.7) + aSeed * 17.0) * (0.4 + aSeed * 0.8);

    // the whole field leans a little toward the cursor
    p.x += uPointer.x * (1.2 + aSeed * 1.8);
    p.y += uPointer.y * (0.8 + aSeed * 1.2);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vDepth = clamp(1.0 - (-mv.z - 4.0) / 24.0, 0.0, 1.0);

    // fade out anything beyond the requested count so density can animate
    float alive = step(aIndex, uCount);

    // slow, uneven breathing rather than a strobe. two detuned sines so the
    // field never pulses in unison.
    float t1 = sin(uTime * (0.18 + aSeed * 0.35) + aSeed * 20.0);
    float t2 = sin(uTime * (0.11 + aSeed * 0.21) + aSeed * 51.0);
    vTwinkle = alive * (0.30 + 0.70 * pow(abs(t1 * 0.6 + t2 * 0.4), 1.6));

    // the small ones burn hottest, which is how embers actually behave
    vWarm = 1.0 - clamp(aScale * 0.42, 0.0, 0.75);

    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * aScale * vDepth * (300.0 / -mv.z);
  }
`

const moteFrag = /* glsl */ `
  uniform vec3 uColor;
  varying float vTwinkle;
  varying float vDepth;
  varying float vWarm;

  void main() {
    // r normalised so the sprite reaches exactly zero at the quad edge. any
    // residual alpha at r = 0.5 is what reads as a drawn circle, so the whole
    // job here is making sure there is none.
    float r = length(gl_PointCoord - 0.5) * 2.0;
    if (r >= 1.0) discard;

    // a tight hot centre inside a wide soft bloom, both gaussian
    float core  = exp(-r * r * 22.0);
    float bloom = exp(-r * r * 3.4);

    // hard-zero the tail so there is no edge to see
    float cut = 1.0 - r * r;
    cut *= cut;

    float a = (core * 0.9 + bloom * 0.32) * cut * vTwinkle * vDepth;

    // the centre blows out toward white, which is what makes it read as a light
    // source rather than a coloured dot
    vec3 col = mix(uColor, vec3(1.0), core * 0.72 * vWarm);

    gl_FragColor = vec4(col * a, a);
    #include <colorspace_fragment>
  }
`

function Motes({ rig, pointer }: { rig: MoodRig; pointer: React.MutableRefObject<[number, number]> }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(MAX_MOTES * 3)
    const seed = new Float32Array(MAX_MOTES)
    const scale = new Float32Array(MAX_MOTES)
    const index = new Float32Array(MAX_MOTES)
    for (let i = 0; i < MAX_MOTES; i++) {
      index[i] = i
      pos[i * 3] = (Math.random() - 0.5) * 26
      pos[i * 3 + 1] = (Math.random() - 0.5) * 28
      pos[i * 3 + 2] = -Math.random() * 20 - 1
      seed[i] = Math.random()
      scale[i] = 0.35 + Math.random() * Math.random() * 1.9
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    g.setAttribute('aScale', new THREE.BufferAttribute(scale, 1))
    g.setAttribute('aIndex', new THREE.BufferAttribute(index, 1))
    return g
  }, [])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: 9 },
      uSpeed: { value: 0.1 },
      uCount: { value: 500 },
      uColor: { value: new THREE.Color('#f2c98a') },
      uPointer: { value: new THREE.Vector2() },
    }),
    [],
  )

  useFrame((_, dt) => {
    uniforms.uTime.value += dt
    uniforms.uSize.value = rig.moteSize
    uniforms.uSpeed.value = rig.moteSpeed
    uniforms.uColor.value.copy(rig.mote)
    uniforms.uCount.value += (rig.target.moteCount - uniforms.uCount.value) * Math.min(1, dt * 1.4)
    uniforms.uPointer.value.lerp(
      _v2.set(pointer.current[0], pointer.current[1]),
      Math.min(1, dt * 1.6),
    )
  })

  return (
    <points geometry={geo} renderOrder={5}>
      <shaderMaterial
        vertexShader={moteVert}
        fragmentShader={moteFrag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
const _v2 = new THREE.Vector2()

/* ------------------------------------------------------------------ */
/* shafts: two enormous soft quads of additive light, drifting slightly.
   cheaper than volumetrics and reads the same at this scale           */

const shaftFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  uniform float uTime;
  uniform float uPhase;
  varying vec2 vUv;
  void main() {
    // a soft wedge, brightest at the top, feathered on both edges
    float x = abs(vUv.x - 0.5) * 2.0;
    float edge = pow(1.0 - x, 2.4);
    float fall = pow(1.0 - vUv.y, 1.7);
    float breathe = 0.72 + 0.28 * sin(uTime * 0.18 + uPhase);
    float a = edge * fall * uStrength * breathe * 0.5;
    gl_FragColor = vec4(uColor, a);
    #include <colorspace_fragment>
  }
`
const shaftVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

function Shaft({ rig, x, rot, phase, w }: { rig: MoodRig; x: number; rot: number; phase: number; w: number }) {
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color('#e08a4a') },
      uStrength: { value: 0.5 },
      uTime: { value: 0 },
      uPhase: { value: phase },
    }),
    [phase],
  )
  useFrame((_, dt) => {
    uniforms.uTime.value += dt
    uniforms.uColor.value.copy(rig.shaft)
    uniforms.uStrength.value = rig.shaftStrength
  })
  return (
    <mesh position={[x, 2, -9]} rotation={[0, 0, rot]} renderOrder={2}>
      <planeGeometry args={[w, 30]} />
      <shaderMaterial
        vertexShader={shaftVert}
        fragmentShader={shaftFrag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */

function Rig({ mood, pointer }: { mood: MoodId; pointer: React.MutableRefObject<[number, number]> }) {
  const rig = useMemo(() => new MoodRig(mood), [])
  const { scene, camera } = useThree()

  useEffect(() => {
    rig.set(mood)
  }, [mood, rig])

  useEffect(() => {
    scene.fog = new THREE.FogExp2(0x0d1420, 0.08)
  }, [scene])

  useFrame((_, dt) => {
    rig.step(Math.min(dt, 0.05))
    const f = scene.fog as THREE.FogExp2
    if (f) {
      f.color.copy(rig.fog)
      f.density = rig.fogDensity
    }
    // the whole scene breathes toward the cursor, very slightly
    camera.position.x += (pointer.current[0] * 0.5 - camera.position.x) * Math.min(1, dt * 1.2)
    camera.position.y += (pointer.current[1] * 0.35 - camera.position.y) * Math.min(1, dt * 1.2)
    camera.lookAt(0, 0, -8)

    // hand the key colour to CSS so the chrome tints with the hour
    const root = document.documentElement
    root.style.setProperty('--amb-key', '#' + rig.shaft.getHexString())
    root.style.setProperty('--amb-fill', '#' + rig.fog.getHexString())
  })

  return (
    <>
      <Sky rig={rig} />
      <Shaft rig={rig} x={-3.6} rot={0.16} phase={0} w={5.5} />
      <Shaft rig={rig} x={2.8} rot={-0.1} phase={2.1} w={7} />
      <Motes rig={rig} pointer={pointer} />
    </>
  )
}

export function Atmosphere({ mood }: { mood: MoodId }) {
  const pointer = useRef<[number, number]>([0, 0])
  const m = moodOf(mood)

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current = [
        (e.clientX / window.innerWidth - 0.5) * 2,
        -(e.clientY / window.innerHeight - 0.5) * 2,
      ]
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  return (
    <div className="atmosphere" aria-hidden>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ fov: 55, position: [0, 0, 6], near: 0.1, far: 120 }}
        gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
      >
        <Rig mood={mood} pointer={pointer} />
      </Canvas>
      <div
        className="atmosphere-grade"
        style={
          {
            '--v': m.vignette,
            '--g': m.grain,
          } as React.CSSProperties
        }
      />
    </div>
  )
}
