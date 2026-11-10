// ── Projects drum: WebGL picture with lens depth of field ──
// js/drum.js still builds and turns the drum out of ordinary HTML, which
// keeps clicks, hover, videos and screen readers working. This draws the
// same scene again in WebGL on a canvas laid over it.
//
// How the blur works. Every card (clip plus tape label) is flat, so it is
// blurred as a picture rather than on screen. Each card is drawn once into
// its own image with a clear margin round it, then that image is blurred
// at a ladder of lens radii, each a proper circular lens blur worked out in
// linear light from a dense, fixed set of samples (no noise). When the
// drum is drawn, every pixel works out its own distance from the focal
// plane, which gives the size of its blur disc, and reads the card at that
// blur, mixing the two nearest rungs of the ladder. The clear margin lets a
// card's edges spread outward the way an out-of-focus object's do.
// Pictures that don't change (images, paused clips) are blurred once.
//
// Returns null when WebGL2 is missing, and drum.js falls back to its CSS
// blur.
window.createDrumGL = function (gallery) {
  // Blur radii of the ladder, in the card's own CSS px. The last is the
  // most any pixel gets.
  const LEVELS = [1, 2, 3.5, 5.5, 8, 11, 15, 20, 26, 32];
  const NL = LEVELS.length;
  const PAD = LEVELS[NL - 1] + 2;
  const LEVEL_SCALE = 0.75;     // texels per CSS px in the blurred rungs
  // Cards fade out between these facings (1 = facing the camera, 0 = edge
  // on), measured along the line of sight so perspective counts: fully
  // there to about 72° from the camera, gone by about 89°, so the outer
  // rows show thin and soften away as they go over.
  const FADE = [0.02, 0.3];

  const canvas = document.createElement('canvas');
  canvas.className = 'drum-gl';
  canvas.setAttribute('aria-hidden', 'true');
  let gl;
  try { gl = canvas.getContext('webgl2', { alpha: false, antialias: false, premultipliedAlpha: true }); } catch (e) {}
  if (!gl) return null;

  // ── Shaders ──
  // Drawing a card onto the drum.
  const DRAW_VS = `#version 300 es
  in vec3 aPos; in vec2 aUv;
  uniform vec2 uView, uOrigin; uniform float uP;
  out vec2 vUv; out float vZ; out vec3 vPos;
  void main() {
    float w = (uP - aPos.z) / uP;
    vec2 c = (uOrigin / uView * 2.0 - 1.0) * w + aPos.xy / uView * 2.0;
    gl_Position = vec4(c.x, -c.y, 0.0, w);
    vUv = aUv; vZ = aPos.z; vPos = aPos;
  }`;
  const DRAW_FS = `#version 300 es
  precision highp float;
  precision highp sampler2DArray;
  in vec2 vUv; in float vZ; in vec3 vPos;
  uniform vec3 uN;      // the side's facing direction
  uniform vec2 uFade;   // facing at which a card is gone, and fully there
  uniform sampler2D uSharp;
  uniform sampler2DArray uLevels;
  uniform float uR[${NL}];
  uniform float uAp, uP, uAlpha, uDpr, uMaxR;
  uniform vec2 uBoxSize;
  out vec4 o;
  vec2 gx, gy;
  // The card blurred into a disc of radius r card px, from the ladder.
  vec4 ladder(vec2 uv, float r) {
    if (r <= uR[0])
      return mix(textureGrad(uSharp, uv, gx, gy), textureGrad(uLevels, vec3(uv, 0.0), gx, gy), r / uR[0]);
    int i = 0;
    for (int j = 1; j < ${NL}; j++) if (r >= uR[j]) i = j;
    int k = min(i + 1, ${NL - 1});
    float t = k == i ? 0.0 : (r - uR[i]) / (uR[k] - uR[i]);
    return mix(textureGrad(uLevels, vec3(uv, float(i)), gx, gy),
               textureGrad(uLevels, vec3(uv, float(k)), gx, gy), t);
  }
  void main() {
    // How squarely this point faces the camera: 1 head on, 0 edge on,
    // below 0 its back. Cards fade out as they roll over the edge of the
    // drum, and their backs are never drawn.
    float facing = dot(uN, normalize(vec3(0.0, 0.0, uP) - vPos));
    if (facing <= uFade.x) discard;
    float fade = smoothstep(uFade.x, uFade.y, facing);
    gx = dFdx(vUv); gy = dFdy(vUv);
    // Thin-lens circle of confusion on screen, in device px, for a point
    // this far in front of or behind the focal plane.
    float rs = uAp * abs(vZ) / (uP - vZ) * uDpr;
    // That circle seen on the card: an ellipse, longer along the
    // direction the card is tipped away. Card px per device px, both ways.
    vec2 jx = gx * uBoxSize, jy = gy * uBoxSize;
    float lx = length(jx), ly = length(jy);
    float minor = min(lx, ly) * rs, major = max(lx, ly) * rs;
    vec2 dir = (lx > ly ? jx / max(lx, 1e-6) : jy / max(ly, 1e-6)) / uBoxSize;
    float r = min(minor, uMaxR);
    float ext = min(major - minor, uMaxR * 3.0);
    vec4 c;
    if (ext < 0.75) {
      c = ladder(vUv, r);
    } else {
      // Sweep the round blur along the long axis to make the ellipse.
      // Taps closer together than the blur itself, so no steps show.
      c = vec4(0.0);
      for (int s = 0; s < 9; s++) c += ladder(vUv + dir * ext * (float(s) / 4.0 - 1.0), r);
      c /= 9.0;
    }
    o = c * uAlpha * fade;
  }`;
  // Laying out a card's own image: clip and label, flat.
  const BAKE_VS = `#version 300 es
  in vec2 aPos; in vec2 aUv;
  uniform vec4 uBox;   // x, y, w, h of the card image in card px
  out vec2 vUv;
  void main() {
    vec2 n = (aPos - uBox.xy) / uBox.zw * 2.0 - 1.0;
    gl_Position = vec4(n, 0.0, 1.0);
    vUv = aUv;
  }`;
  const BAKE_FS = `#version 300 es
  precision highp float;
  in vec2 vUv;
  uniform sampler2D uTex; uniform vec4 uUvRect;
  out vec4 o;
  void main() {
    vec4 c = texture(uTex, mix(uUvRect.xy, uUvRect.zw, vUv));
    vec2 e = min(vUv, 1.0 - vUv) / max(fwidth(vUv), vec2(1e-6));
    o = c * clamp(min(e.x, e.y) + 0.5, 0.0, 1.0);
  }`;
  // One rung of the ladder: a circular lens blur of the sharp card image.
  // A fixed grid of up to 15 x 15 samples inside the disc, each read from
  // the mip level matching the grid spacing so every sample already
  // averages its own patch. Dense and deterministic, so no grain.
  const QUAD_VS = `#version 300 es
  in vec2 aPos; out vec2 vUv;
  void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;
  const LENS_FS = `#version 300 es
  precision highp float;
  in vec2 vUv;
  uniform sampler2D uSrc; uniform vec2 uSrcSize;
  uniform float uR; uniform int uK; uniform float uLod;
  out vec4 o;
  vec4 toLin(vec4 s) { return s.a > 0.0 ? vec4(pow(s.rgb / s.a, vec3(2.2)) * s.a, s.a) : vec4(0.0); }
  void main() {
    float sp = uR / float(uK);
    vec4 acc = vec4(0.0); float wsum = 0.0;
    for (int y = -7; y <= 7; y++) {
      for (int x = -7; x <= 7; x++) {
        if (abs(x) > uK || abs(y) > uK) continue;
        vec2 off = vec2(float(x), float(y)) * sp;
        // Soft-edged disc, so the aperture's rim is round, not stepped.
        float w = clamp((uR + 0.5 * sp - length(off)) / sp, 0.0, 1.0);
        if (w <= 0.0) continue;
        acc += toLin(textureLod(uSrc, vUv + off / uSrcSize, uLod)) * w;
        wsum += w;
      }
    }
    acc /= wsum;
    o = acc.a > 0.0 ? vec4(pow(acc.rgb / acc.a, vec3(1.0 / 2.2)) * acc.a, acc.a) : vec4(0.0);
  }`;

  function program(vs, fs) {
    const p = gl.createProgram();
    [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]].forEach(([type, src]) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    });
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
    return { p, u };
  }

  let draw, bake, lens;
  try {
    draw = program(DRAW_VS, DRAW_FS);
    bake = program(BAKE_VS, BAKE_FS);
    lens = program(QUAD_VS, LENS_FS);
  } catch (e) {
    console.warn('drum-gl:', e);
    return null;
  }

  // ── Buffers ──
  const full = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, full);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const fullVao = gl.createVertexArray();
  gl.bindVertexArray(fullVao);
  gl.enableVertexAttribArray(gl.getAttribLocation(lens.p, 'aPos'));
  gl.vertexAttribPointer(gl.getAttribLocation(lens.p, 'aPos'), 2, gl.FLOAT, false, 0, 0);

  const vbuf = gl.createBuffer();
  const drawVao = gl.createVertexArray();
  gl.bindVertexArray(drawVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
  gl.enableVertexAttribArray(gl.getAttribLocation(draw.p, 'aPos'));
  gl.vertexAttribPointer(gl.getAttribLocation(draw.p, 'aPos'), 3, gl.FLOAT, false, 20, 0);
  gl.enableVertexAttribArray(gl.getAttribLocation(draw.p, 'aUv'));
  gl.vertexAttribPointer(gl.getAttribLocation(draw.p, 'aUv'), 2, gl.FLOAT, false, 20, 12);

  const bbuf = gl.createBuffer();
  const bakeVao = gl.createVertexArray();
  gl.bindVertexArray(bakeVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, bbuf);
  gl.enableVertexAttribArray(gl.getAttribLocation(bake.p, 'aPos'));
  gl.vertexAttribPointer(gl.getAttribLocation(bake.p, 'aPos'), 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(gl.getAttribLocation(bake.p, 'aUv'));
  gl.vertexAttribPointer(gl.getAttribLocation(bake.p, 'aUv'), 2, gl.FLOAT, false, 16, 8);
  gl.bindVertexArray(null);

  const v20 = new Float32Array(20), v16 = new Float32Array(16);
  const fbo = gl.createFramebuffer();

  function texParams(target, mip) {
    gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  function makeTex() {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    texParams(gl.TEXTURE_2D, false);
    return t;
  }

  function upload(tex, src) {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); }
    catch (e) { return false; }
    gl.generateMipmap(gl.TEXTURE_2D);
    texParams(gl.TEXTURE_2D, true);
    return true;
  }

  const greyTex = makeTex();
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([232, 232, 232, 255]));

  // ── Card sources ──
  const parseM = s => {
    if (!s || s === 'none') return [1, 0, 0, 1, 0, 0];
    const n = s.slice(s.indexOf('(') + 1, -1).split(',').map(parseFloat);
    return n.length === 6 ? n : [n[0], n[1], n[4], n[5], n[12], n[13]];
  };

  let dpr = 1;
  const cards = new Map();

  function newCard() {
    return { tex: makeTex(), kind: '', t: -1, sw: 1, sh: 1, labelTex: null, labelKey: '',
      sharp: null, levels: null, box: null, bakeKey: '', ver: 0, lvl: new Array(NL).fill(-1) };
  }

  function card(item) {
    let c = cards.get(item);
    if (c) return c;
    c = newCard();
    c.video = item.querySelector('video');
    c.img = item.querySelector('.gallery-item-thumb img');
    c.label = item.querySelector('.gallery-item-label');
    if (c.label) c.labelTex = makeTex();
    if (c.video && c.video.poster) { c.poster = new Image(); c.poster.src = c.video.poster; }
    cards.set(item, c);
    return c;
  }

  function refreshThumb(c) {
    const v = c.video;
    if (v && v.getAttribute('src') && v.readyState >= 2 && v.videoWidth) {
      if (c.kind === 'video' && v.currentTime === c.t) return false;
      if (!upload(c.tex, v)) return false;
      c.kind = 'video'; c.t = v.currentTime; c.sw = v.videoWidth; c.sh = v.videoHeight;
      return true;
    }
    if (c.kind) return false;
    const im = c.img || c.poster;
    if (im && im.complete && im.naturalWidth && upload(c.tex, im)) {
      c.kind = 'image'; c.sw = im.naturalWidth; c.sh = im.naturalHeight;
      return true;
    }
    return false;
  }

  function wrap(ctx, text, maxW) {
    const words = text.split(/\s+/), lines = [];
    let line = '';
    words.forEach(w => {
      const t = line ? line + ' ' + w : w;
      if (line && ctx.measureText(t).width > maxW) { lines.push(line); line = w; } else line = t;
    });
    if (line) lines.push(line);
    return lines;
  }

  // The strip of tape, drawn the way style.css draws it.
  function refreshLabel(c) {
    const l = c.label;
    if (!l) return false;
    const w = l.offsetWidth, h = l.offsetHeight;
    const cs = getComputedStyle(l);
    const key = w + 'x' + h + ' ' + cs.font + ' ' + dpr;
    if (key === c.labelKey || !w) return false;
    c.labelKey = key;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(w * dpr); cv.height = Math.ceil(h * dpr);
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.fillStyle = cs.backgroundColor;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = cs.color;
    ctx.font = cs.font;
    ctx.textBaseline = 'middle';
    const pl = parseFloat(cs.paddingLeft), pr = parseFloat(cs.paddingRight), pt = parseFloat(cs.paddingTop);
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
    wrap(ctx, l.textContent.trim(), w - pl - pr + 1).forEach((line, i) => ctx.fillText(line, pl, pt + lh * (i + 0.5)));
    upload(c.labelTex, cv);
    return true;
  }

  // The intro line is a card too: its whole side, as one picture.
  const introCard = newCard();
  let introKey = '';
  function refreshIntro(f, animate) {
    const p = f.querySelector('.page-intro');
    if (!p) return false;
    const hint = p.querySelector('.scroll-hint');
    const hy = hint && animate ? parseM(getComputedStyle(hint).transform)[5] : 0;
    const w = f.offsetWidth, h = f.offsetHeight;
    const key = w + 'x' + h + ' ' + dpr + ' ' + hy.toFixed(2);
    if (key === introKey || !w) return false;
    introKey = key;
    const cs = getComputedStyle(p);
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(w * dpr); cv.height = Math.ceil(h * dpr);
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.font = cs.font;
    ctx.fillStyle = cs.color;
    ctx.textBaseline = 'middle';
    const fs = parseFloat(cs.fontSize), lh = parseFloat(cs.lineHeight) || fs * 1.75;
    const tokens = [];
    p.childNodes.forEach(function walk(n) {
      if (n.nodeType === 3) n.nodeValue.split(/(\s+)/).forEach(t => t && tokens.push({ t }));
      else if (n.nodeName === 'IMG') tokens.push({ img: n, hint: !!n.closest('.scroll-hint') });
      else n.childNodes.forEach(walk);
    });
    const tw = tok => tok.img ? fs : ctx.measureText(tok.t).width;
    const lines = [[]];
    let x = 0;
    tokens.forEach(tok => {
      const space = !tok.img && /^\s+$/.test(tok.t);
      if (!space && x + tw(tok) > w && lines[lines.length - 1].length) { lines.push([]); x = 0; }
      if (space && !lines[lines.length - 1].length) return;
      lines[lines.length - 1].push(tok);
      x += tw(tok);
    });
    const top = (h - lines.length * lh) / 2;
    lines.forEach((line, i) => {
      while (line.length && !line[line.length - 1].img && /^\s+$/.test(line[line.length - 1].t)) line.pop();
      const lw = line.reduce((s, tok) => s + tw(tok), 0);
      let cx = (w - lw) / 2;
      const cy = top + lh * (i + 0.5);
      line.forEach(tok => {
        if (tok.img) {
          if (tok.img.complete) ctx.drawImage(tok.img, cx, cy - fs * 0.45 + (tok.hint ? hy : 0), fs, fs);
        } else ctx.fillText(tok.t, cx, cy);
        cx += tw(tok);
      });
    });
    upload(introCard.tex, cv);
    introCard.kind = 'image'; introCard.sw = cv.width; introCard.sh = cv.height;
    return true;
  }

  // ── Baking a card's own image ──
  // Parts are [texture, uvRect, corners in card px (TL, TR, BL, BR)].
  function bakeCard(c, parts, bx, by, bw, bh) {
    const tw = Math.max(1, Math.ceil(bw * dpr)), th = Math.max(1, Math.ceil(bh * dpr));
    if (!c.sharp || c.sharpW !== tw || c.sharpH !== th) {
      if (c.sharp) gl.deleteTexture(c.sharp);
      c.sharp = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, c.sharp);
      gl.texStorage2D(gl.TEXTURE_2D, Math.floor(Math.log2(Math.max(tw, th))) + 1, gl.RGBA8, tw, th);
      texParams(gl.TEXTURE_2D, true);
      c.sharpW = tw; c.sharpH = th;
      const lw = Math.max(1, Math.ceil(bw * LEVEL_SCALE)), lh = Math.max(1, Math.ceil(bh * LEVEL_SCALE));
      if (c.levels) gl.deleteTexture(c.levels);
      c.levels = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, c.levels);
      gl.texStorage3D(gl.TEXTURE_2D_ARRAY, Math.floor(Math.log2(Math.max(lw, lh))) + 1, gl.RGBA8, lw, lh, NL);
      texParams(gl.TEXTURE_2D_ARRAY, true);
      c.levelW = lw; c.levelH = lh;
    }
    c.box = [bx, by, bw, bh];
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, c.sharp, 0);
    gl.viewport(0, 0, tw, th);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(bake.p);
    gl.bindVertexArray(bakeVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, bbuf);
    gl.uniform4f(bake.u.uBox, bx, by, bw, bh);
    gl.uniform1i(bake.u.uTex, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    parts.forEach(([tex, uv, pts]) => {
      const uvs = [[0, 0], [1, 0], [0, 1], [1, 1]];
      pts.forEach((p, i) => v16.set([p[0], p[1], uvs[i][0], uvs[i][1]], i * 4));
      gl.bufferData(gl.ARRAY_BUFFER, v16, gl.DYNAMIC_DRAW);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform4fv(bake.u.uUvRect, uv);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    });
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, c.sharp);
    gl.generateMipmap(gl.TEXTURE_2D);
    c.ver++;
  }

  // Blur the rungs this card needs right now that are out of date.
  function ensureLevels(c, rMax) {
    let need = 0;
    while (need < NL - 1 && LEVELS[need] < rMax) need++;
    let did = false;
    for (let i = 0; i <= need; i++) {
      if (c.lvl[i] === c.ver) continue;
      if (!did) {
        gl.useProgram(lens.p);
        gl.bindVertexArray(fullVao);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, c.sharp);
        gl.uniform1i(lens.u.uSrc, 0);
        gl.uniform2f(lens.u.uSrcSize, c.sharpW, c.sharpH);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.viewport(0, 0, c.levelW, c.levelH);
        did = true;
      }
      const rTex = LEVELS[i] * dpr;
      const k = Math.max(1, Math.min(7, Math.ceil(rTex)));
      gl.uniform1f(lens.u.uR, rTex);
      gl.uniform1i(lens.u.uK, k);
      gl.uniform1f(lens.u.uLod, Math.max(0, Math.log2(rTex / k)));
      gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, c.levels, 0, i);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      c.lvl[i] = c.ver;
    }
    if (did) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, c.levels);
      gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    }
  }

  // Cover-fit the clip into the 16:9 thumbnail, with its zoom.
  function coverUv(c, box, scale) {
    let u = 1, v = 1;
    const sa = c.sw / c.sh;
    if (sa > box) u = box / sa; else v = sa / box;
    u /= scale; v /= scale;
    return [0.5 - u / 2, 0.5 - v / 2, 0.5 + u / 2, 0.5 + v / 2];
  }

  // Bring a card's own image up to date. Returns the card, or null if it
  // has nothing to show yet.
  function prepCard(item) {
    const c = card(item);
    const fresh = refreshThumb(c) | refreshLabel(c);
    // The card size comes from the drum, not the element, so cards on
    // sides out of view (not laid out) can be prepared ahead of time.
    const iw = geo.cardW, ih = geo.cardH;
    if (!iw) return null;
    const media = c.video || c.img;
    const scale = parseFloat(media && media.style.getPropertyValue('--thumb-scale')) || 1;
    let lab = null, lkey = '';
    if (c.label && c.labelKey) {
      const l = c.label, lw = l.offsetWidth, lh = l.offsetHeight;
      const m = parseM(getComputedStyle(l).transform);
      const cx = l.offsetLeft + lw / 2, cy = l.offsetTop + lh / 2;
      const at = (x, y) => [cx + m[0] * x + m[2] * y + m[4], cy + m[1] * x + m[3] * y + m[5]];
      lab = [at(-lw / 2, -lh / 2), at(lw / 2, -lh / 2), at(-lw / 2, lh / 2), at(lw / 2, lh / 2)];
      lkey = lab.join();
    }
    const key = iw + 'x' + ih + ' ' + scale + ' ' + dpr;
    if (fresh || key !== c.bakeKey) {
      c.bakeKey = key;
      bakeCard(c, [[c.kind ? c.tex : greyTex, c.kind ? coverUv(c, iw / ih, scale) : [0, 0, 1, 1],
        [[0, 0], [iw, 0], [0, ih], [iw, ih]]]], -PAD, -PAD, iw + 2 * PAD, ih + 2 * PAD);
    }
    // The tape label is its own layer, so it can come and go with focus.
    if (lab) {
      if (!c.tape) c.tape = newCard();
      const lk = lkey + ' ' + c.labelKey;
      if (lk !== c.tape.bakeKey) {
        c.tape.bakeKey = lk;
        const xs = lab.map(p => p[0]), ys = lab.map(p => p[1]);
        const bx = Math.min(...xs) - PAD, by = Math.min(...ys) - PAD;
        bakeCard(c.tape, [[c.labelTex, [0, 0, 1, 1], lab]], bx, by,
          Math.max(...xs) + PAD - bx, Math.max(...ys) + PAD - by);
      }
    }
    return c;
  }

  // ── Drawing the drum ──
  let geo = null;      // { p, cy, apothem, aperture }
  let W = 0, H = 0;
  let bg = [0.973, 0.973, 0.973];

  function onDrum(phi, x, y) {
    const a = geo.apothem, cos = Math.cos(phi), sin = Math.sin(phi);
    return [x, y * cos - a * sin, y * sin + a * cos - a];
  }

  // Draw a card's image lying on a side of the drum. `place` maps card px
  // to the side's own coordinates (centred).
  function drawCard(c, phi, alpha, place) {
    const [bx, by, bw, bh] = c.box;
    // Drawn larger than the card's image. On a side tipped well away the
    // blur is stretched along the tilt (to stay round on screen) further
    // than the image's clear margin, and the rectangle's own edge would
    // cut it off in a hard line. Outside the image the texture reads as
    // its clear border, so the extra area only carries the spreading blur.
    const mx = 6, my = 3 * Math.min(geo.maxBlur || LEVELS[NL - 1], LEVELS[NL - 1]) + 6;
    const uvx = x => (x - bx) / bw, uvy = y => (y - by) / bh;
    const x0 = bx - mx, x1 = bx + bw + mx, y0 = by - my, y1 = by + bh + my;
    const corners = [[x0, y0, uvx(x0), uvy(y0)], [x1, y0, uvx(x1), uvy(y0)],
      [x0, y1, uvx(x0), uvy(y1)], [x1, y1, uvx(x1), uvy(y1)]];
    let rMax = 0;
    const pts = corners.map(([x, y, u, v]) => {
      const [fx, fy] = place(x, y);
      const p = onDrum(phi, fx, fy);
      // Screen blur radius, in card px (perspective shrinks the card).
      rMax = Math.max(rMax, geo.aperture * Math.abs(p[2]) / geo.p);
      return [p, u, v];
    });
    ensureLevels(c, rMax);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(draw.p);
    gl.bindVertexArray(drawVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
    gl.uniform2f(draw.u.uView, W, H);
    gl.uniform2f(draw.u.uOrigin, W / 2, geo.cy);
    gl.uniform1f(draw.u.uP, geo.p);
    gl.uniform1f(draw.u.uAp, geo.aperture);
    gl.uniform1fv(draw.u['uR[0]'], LEVELS);
    gl.uniform1i(draw.u.uSharp, 0);
    gl.uniform1i(draw.u.uLevels, 1);
    gl.uniform1f(draw.u.uAlpha, alpha);
    gl.uniform1f(draw.u.uDpr, dpr);
    gl.uniform3f(draw.u.uN, 0, -Math.sin(phi), Math.cos(phi));
    gl.uniform2f(draw.u.uFade, FADE[0], FADE[1]);
    gl.uniform1f(draw.u.uMaxR, Math.min(geo.maxBlur || LEVELS[NL - 1], LEVELS[NL - 1]));
    gl.uniform2f(draw.u.uBoxSize, bw, bh);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, c.sharp);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, c.levels);
    pts.forEach(([p, u, v], i) => v20.set([p[0], p[1], p[2], u, v], i * 5));
    gl.bufferData(gl.ARRAY_BUFFER, v20, gl.DYNAMIC_DRAW);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.BLEND);
  }

  function frame(list, centerK, atRest) {
    if (!geo || !W) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(bg[0], bg[1], bg[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    list.forEach(({ f, k, phi, alpha, focus }) => {
      const fw = f.offsetWidth, fh = f.offsetHeight;
      if (f.classList.contains('drum-facet--intro')) {
        const fresh = refreshIntro(f, atRest && k === centerK);
        if (!introCard.kind) return;
        const key = fw + 'x' + fh + ' ' + dpr;
        if (fresh || key !== introCard.bakeKey) {
          introCard.bakeKey = key;
          bakeCard(introCard, [[introCard.tex, [0, 0, 1, 1], [[0, 0], [fw, 0], [0, fh], [fw, fh]]]],
            -PAD, -PAD, fw + 2 * PAD, fh + 2 * PAD);
        }
        drawCard(introCard, phi, alpha, (x, y) => [x - fw / 2, y - fh / 2]);
        return;
      }
      // The hovered card sits on top, as it does in the page.
      const items = [...f.children].sort((a, b) => (a.matches(':hover') ? 1 : 0) - (b.matches(':hover') ? 1 : 0));
      items.forEach(item => {
        const c = prepCard(item);
        if (!c) return;
        const cs = getComputedStyle(item);
        const op = parseFloat(cs.opacity) * alpha;
        if (op <= 0.001) return;
        const m = parseM(cs.transform);
        const iw = geo.cardW, ih = geo.cardH;
        const cx = item.offsetLeft + iw / 2 - fw / 2, cy = item.offsetTop + ih / 2 - fh / 2;
        const place = (x, y) => {
          const qx = x - iw / 2, qy = y - ih / 2;
          return [cx + m[0] * qx + m[2] * qy + m[4], cy + m[1] * qx + m[3] * qy + m[5]];
        };
        drawCard(c, phi, op, place);
        // Titles show only on the row in focus.
        if (c.tape && c.tape.box && focus > 0.001) drawCard(c.tape, phi, op * focus, place);
      });
    });

    // Getting ahead: while the drum is still, prepare one more card per
    // frame, picture and every rung of its blur, so nothing has to be
    // made on the fly when the drum spins. (The opening spin passes every
    // card in under two seconds; made on the fly they came up blank.)
    if (atRest && warmList.length) {
      const item = warmList.shift();
      const c = prepCard(item);
      if (c && c.kind) ensureLevels(c, LEVELS[NL - 1]);
      else warmList.push(item);   // picture not loaded yet, try again later
    }
  }

  let warmList = [], lastSig = '';
  function warm(items) {
    items.forEach(it => card(it));   // starts every poster loading now
    // Only the ones not already prepared at the current size.
    warmList = items.filter(it => { const c = cards.get(it); return !c.bakeKey || c.lvl[NL - 1] !== c.ver; });
  }

  gallery.appendChild(canvas);

  function invalidate() {
    introKey = '';
    introCard.bakeKey = '';
    // Card pictures rebuild themselves when their size changes. Labels
    // also depend on the font, so they're redrawn.
    cards.forEach(c => { c.labelKey = ''; if (c.tape) c.tape.bakeKey = ''; });
  }

  return {
    canvas,
    resize(g) {
      // Prepared cards stay good unless the screen or card size changed.
      const sig = [innerWidth, innerHeight, devicePixelRatio, g.cardW, g.cardH].join();
      const same = sig === lastSig;
      lastSig = sig;
      geo = g;
      if (same) return;
      W = innerWidth; H = innerHeight;
      dpr = Math.min(2, devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      const m = getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g);
      if (m) bg = [m[0] / 255, m[1] / 255, m[2] / 255];
      invalidate();
    },
    frame,
    invalidate,
    warm,
  };
};
