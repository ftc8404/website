// Prism hero: scroll-driven orbit around a glass prism. White beam in,
// dispersed fan out, blue beam isolates and yields to the DOM fox logo.
const stage = document.getElementById("prismStage");
const mount = document.getElementById("gl");
const fallback = document.getElementById("heroFallback");
// Perf counters and the ?beat= scroll preview stay off unless ?debug is set.
const debug = new URLSearchParams(location.search).has("debug");
function setHeroLive(live) {
  window.dispatchEvent(new CustomEvent("hero-live", { detail: { live: !!live } }));
}
function showFallback(reason) {
  if (fallback) fallback.classList.add("show");
  document.body.classList.add("intro-done");
  // Diagnosable degrade: the exact reason is one console / DOM lookup away.
  document.body.dataset.heroFallback = reason;
  window.__heroFallbackReason = reason;
  if (window.console && window.console.warn) window.console.warn("hero fallback: " + reason);
  // The WebGL canvas is not covering the page; the 2D backdrop should run.
  setHeroLive(false);
}
// The intro always plays: managed lab machines report reduced-motion by
// fleet default, which stranded the whole team on the static mark.
// Genuine WebGL failures still fall back (with the reason recorded).
document.body.classList.add("in-intro");
start().catch((e) => {
  document.body.classList.remove("in-intro");
  showFallback("start-failed: " + ((e && e.message) || e));
});

async function start() {
  const THREE = await import("three");
  const isMobile = window.matchMedia("(max-width: 760px)").matches;
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
  renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  // One pixel-ratio cap for the whole intro. Initializing at 2x and only
  // dropping to 1.25/1.5 after the finale switch meant retina screens paid
  // 2x fill (4x the pixels) for every frame of the sequence.
  const fullPR = Math.min(window.devicePixelRatio || 1, isMobile ? 1 : 1.25);
  renderer.setPixelRatio(fullPR);
  renderer.setSize(mount.clientWidth, mount.clientHeight);
  mount.appendChild(renderer.domElement);
  document.body.classList.add("intro-done");
  // Opaque canvas now covers #bg-plexus. Tell it to stop immediately.
  setHeroLive(true);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.02);
  // Studio environment so transmissive glass has something to refract.
  try {
    const { RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js");
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
  } catch (e) { /* env-less fallback: lights only */ }
  const camera = new THREE.PerspectiveCamera(
    55, mount.clientWidth / mount.clientHeight, 0.1, 100
  );

  scene.add(new THREE.HemisphereLight(0xbcd8e8, 0x0a0e12, 0.55));
  scene.add(new THREE.AmbientLight(0x8fa8b8, 0.25));
  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(-6, 5, 7);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xcfe8ff, 0.7);
  fill.position.set(5, -1, 4);
  scene.add(fill);
  const rim = new THREE.PointLight(0x55c6f6, 35, 30, 2);
  rim.position.set(4, -1, -3);
  scene.add(rim);
  const entry = new THREE.PointLight(0xffffff, 4, 20, 2);
  entry.position.set(-4, 1.4, 2.5);
  scene.add(entry);

  // Prism: triangular bar lying along X — light enters the left end face,
  // spectrum fans out the right. Clear glass is the fresnel shell, a faint
  // body, and the studio env — not a transmission pass.
  const prismGeo = new THREE.CylinderGeometry(1.25, 1.25, 2.6, 3, 1);
  let prism;
  try {
    prism = new THREE.Mesh(
      prismGeo,
      new THREE.MeshPhysicalMaterial({
        color: 0xe7f2f6, metalness: 0, roughness: 0.12,
        emissive: 0x07141c, emissiveIntensity: 0.35,
        // Transmission re-renders the scene into an offscreen buffer every
        // frame. On a black field the refraction is almost invisible, and
        // that extra pass was the intro's dominant cost on desktop and
        // mobile. Clear glass here is alpha + the fresnel shell + core.
        transmission: 0, thickness: 0,
        ior: 1.52, envMapIntensity: 1.15,
        clearcoat: 0.65, clearcoatRoughness: 0.18,
        specularIntensity: 0.55,
        transparent: true, opacity: 0.16, depthWrite: false,
      })
    );
  } catch (e) {
    prism = new THREE.Mesh(
      prismGeo,
      new THREE.MeshStandardMaterial({
        color: 0xbfe4f4, transparent: true, opacity: 0.5,
        roughness: 0.15, metalness: 0.1, envMapIntensity: 1.4,
      })
    );
  }
  prism.rotation.set(0, Math.PI / 6, Math.PI / 2);
  prism.position.y = 0.45;
  scene.add(prism);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(prismGeo),
    new THREE.LineBasicMaterial({ color: 0x86b9cf, transparent: true, opacity: 0.22 })
  );
  prism.add(edges);
  // Fresnel shell: bright glass rims on every renderer, even where the
  // transmission pass is unsupported (falls back to dark body + glow).
  const shell = new THREE.Mesh(
    prismGeo,
    new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(0xcfe8f2) },
        opacity: { value: 0.45 },
      },
      vertexShader: `
        varying vec3 vN; varying vec3 vW;
        void main() {
          vN = normalize(mat3(modelMatrix) * normal);
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: `
        uniform vec3 color; uniform float opacity;
        varying vec3 vN; varying vec3 vW;
        void main() {
          vec3 V = normalize(cameraPosition - vW);
          float f = pow(1.0 - abs(dot(normalize(vN), V)), 2.5);
          gl_FragColor = vec4(color, f * opacity);
        }`,
      transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  shell.scale.setScalar(1.02);
  shell.renderOrder = 6;
  prism.add(shell);
  // Faint inner body: hints at glass density without tinting it blue.
  const core = new THREE.Mesh(
    prismGeo,
    new THREE.MeshBasicMaterial({
      color: 0xdfe9ee, transparent: true, opacity: 0.15,
    })
  );
  core.scale.setScalar(0.985);
  prism.add(core);

  // Beams: additive glow planes. White in, spectrum fan out, blue hero beam.
  function beam(color, width, len, opacity, sharedMat) {
    const mat = sharedMat || new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(color) },
        intensity: { value: opacity },
        head: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 color; uniform float time; uniform float intensity;
        uniform float head;
        varying vec2 vUv;
        void main() {
          float across = pow(max(0.0, 1.0 - abs(vUv.y - 0.5) * 2.0), 1.8);
          // Short soft ends; joints stay continuous via overlap, not cuts.
          float near = smoothstep(0.0, 0.15, vUv.x);
          float far = 1.0 - smoothstep(0.85, 1.0, vUv.x);
          float along = near * far;
          float tip = 1.0 - smoothstep(head - 0.1, head, vUv.x);
          float shimmer = 0.85 + 0.15 * sin(time * 3.0 + vUv.x * 12.0);
          gl_FragColor = vec4(color, across * along * tip * intensity * shimmer);
        }`,
      transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, width), mat);
    m.renderOrder = 5;
    return m;
  }
  // Volumetric shafts: ONE camera-facing billboard per beam, cylindrically
  // constrained to its axis. A single surface can never split into visible
  // segments, and it draws a third of the crossed-plane stack it replaces.
  const shafts = [];
  function beam3D(color, width, len, opacity) {
    const group = new THREE.Group();
    const m = beam(color, width, len, opacity, null);
    m.renderOrder = 5;
    group.add(m);
    scene.add(group);
    shafts.push(group);
    return { group, mat: m.material };
  }
  function driveBeam(b, time, head, intensity) {
    b.mat.uniforms.time.value = time;
    b.mat.uniforms.head.value = head;
    b.mat.uniforms.intensity.value = intensity;
  }
  const white = beam3D(0xffffff, 0.22, 7.0, 0.0);
  white.group.position.set(-4.45, 1.0, 0);
  white.group.rotation.z = -0.1;
  const fanColors = [0xff5d5d, 0xffc861, 0x6dff8a, 0x55c6f6, 0x8a7bff];
  const fan = fanColors.map((c, i) => {
    const b = beam3D(c, 0.16, 6, 0.0);
    // Anchor every fan shaft exactly on its exit-face point so the spectrum
    // visibly leaves the glass instead of floating near it.
    const a = -0.1 - i * 0.075, ey = 0.35 - i * 0.14;
    b.group.position.set(1.3 + Math.cos(a) * 2.5, ey + Math.sin(a) * 2.5, 0);
    b.group.rotation.z = a;
    return b;
  });
  // The blue shaft continues the fan's central cyan ray, rooted exactly
  // in the exit face so it visibly leaves the glass.
  const blueDir = -0.325, blueExit = { x: 1.3, y: -0.07 };
  const blue = beam3D(0x55c6f6, 0.3, 8, 0.0);
  blue.group.position.set(
    blueExit.x + Math.cos(blueDir) * 3.4, blueExit.y + Math.sin(blueDir) * 3.4, 0.05
  );
  blue.group.rotation.z = blueDir;
  // Heart of the beam, where the camera dives and the fox condenses.
  const logoHome = { x: 3.76, y: -0.9, z: 0.05 };

  // Interior light path: the beam's journey visible INSIDE the glass.
  // Drawn over the body (no depth test) so it reads on every renderer.
  function innerBeam(color, width) {
    const group = new THREE.Group();
    const m = beam(color, width, 1, 0, null);
    m.material.depthTest = false;
    m.renderOrder = 7;
    group.add(m);
    scene.add(group);
    shafts.push(group);
    return { group, mat: m.material };
  }
  function span(shaft, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    shaft.group.scale.x = Math.hypot(dx, dy);
    shaft.group.position.set((x1 + x2) / 2, (y1 + y2) / 2, 0.03);
    shaft.group.rotation.z = Math.atan2(dy, dx);
  }
  const innerWhite = innerBeam(0xffffff, 0.2);
  span(innerWhite, -1.25, 0.7, -0.2, 0.55);
  const innerFan = fanColors.map((c, i) => {
    const b = innerBeam(c, 0.15);
    span(b, -0.35, 0.55, 1.3, 0.35 - i * 0.14);
    return b;
  });
  // Plexus backdrop: very faint white nodes + hairline links on pure black.
  // The volume is oversized vs. the viewport so the pattern never visibly
  // ends as the camera orbits. Static — all motion comes from the camera.
  const plexus = new THREE.Group();
  const PN = isMobile ? 150 : 320;
  const pts = [];
  for (let i = 0; i < PN; i++) {
    pts.push(new THREE.Vector3(
      (Math.random() - 0.5) * 46,
      (Math.random() - 0.5) * 26,
      -22 + Math.random() * 30
    ));
  }
  // Nodes wander individually; links and tags follow every frame.
  const pArr = new Float32Array(PN * 3);
  const pVel = new Float32Array(PN * 3);
  for (let i = 0; i < PN; i++) {
    pArr[i * 3] = pts[i].x;
    pArr[i * 3 + 1] = pts[i].y;
    pArr[i * 3 + 2] = pts[i].z;
    pVel[i * 3] = (Math.random() - 0.5) * 0.0016;
    pVel[i * 3 + 1] = (Math.random() - 0.5) * 0.0016;
    pVel[i * 3 + 2] = (Math.random() - 0.5) * 0.0016;
  }
  const pFloat = new Float32Array(pArr);
  const pointAttr = new THREE.BufferAttribute(pArr, 3);
  pointAttr.setUsage(THREE.DynamicDrawUsage);
  const pointGeo = new THREE.BufferGeometry();
  pointGeo.setAttribute("position", pointAttr);
  // Soft round nodes that fade out a few units from the camera, so the
  // dive never flies through a giant white square.
  const pointMat = new THREE.ShaderMaterial({
    uniforms: {
      opacity: { value: 0.5 }, fadeN: { value: 1.2 }, fadeF: { value: 3.5 },
    },
    transparent: true, depthWrite: false,
    vertexShader: `
      varying float vD;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vD = -mv.z;
        gl_PointSize = 0.055 * (400.0 / max(0.1, -mv.z));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float opacity; uniform float fadeN; uniform float fadeF;
      varying float vD;
      void main() {
        vec2 c = gl_PointCoord - vec2(0.5);
        float m = smoothstep(0.5, 0.15, length(c));
        float a = smoothstep(fadeN, fadeF, vD);
        gl_FragColor = vec4(vec3(1.0), m * a * opacity);
      }`,
  });
  plexus.add(new THREE.Points(pointGeo, pointMat));
  const LINK = 3.4, LINK2 = LINK * LINK, maxLinks = isMobile ? 400 : 1600;
  // Declared up here: rebuildLinks() runs once at setup, before the
  // frame-loop declarations below execute.
  const vis = new Uint8Array(PN);
  const linkArr = new Float32Array(maxLinks * 6);
  const linkColArr = new Float32Array(maxLinks * 6);
  const linkGeo = new THREE.BufferGeometry();
  const linkAttr = new THREE.BufferAttribute(linkArr, 3);
  linkAttr.setUsage(THREE.DynamicDrawUsage);
  linkGeo.setAttribute("position", linkAttr);
  const linkColAttr = new THREE.BufferAttribute(linkColArr, 3);
  linkColAttr.setUsage(THREE.DynamicDrawUsage);
  linkGeo.setAttribute("color", linkColAttr);
  // Uniform grid so link rebuild is O(n) neighbor tests, not O(n^2).
  // Cell size equals the link distance, so a pair can only meet in
  // adjacent cells. Same pairs, same fade, far fewer iterations.
  const G0x = -24, G0y = -14, G0z = -23;
  const GX = 16, GY = 10, GZ = 12;
  const gHead = new Int32Array(GX * GY * GZ);
  const gNext = new Int32Array(PN);
  function gCell(x, y, z) {
    let ix = (x - G0x) / LINK | 0;
    let iy = (y - G0y) / LINK | 0;
    let iz = (z - G0z) / LINK | 0;
    if (ix < 0) ix = 0; else if (ix >= GX) ix = GX - 1;
    if (iy < 0) iy = 0; else if (iy >= GY) iy = GY - 1;
    if (iz < 0) iz = 0; else if (iz >= GZ) iz = GZ - 1;
    return (ix * GY + iy) * GZ + iz;
  }
  function rebuildLinks() {
    gHead.fill(-1);
    for (let i = 0; i < PN; i++) {
      if (!vis[i]) continue;
      const c = gCell(pArr[i * 3], pArr[i * 3 + 1], pArr[i * 3 + 2]);
      gNext[i] = gHead[c];
      gHead[c] = i;
    }
    let n = 0;
    for (let i = 0; i < PN && n < maxLinks; i++) {
      if (!vis[i]) continue;
      const ax = pArr[i * 3], ay = pArr[i * 3 + 1], az = pArr[i * 3 + 2];
      let ix = (ax - G0x) / LINK | 0;
      let iy = (ay - G0y) / LINK | 0;
      let iz = (az - G0z) / LINK | 0;
      if (ix < 0) ix = 0; else if (ix >= GX) ix = GX - 1;
      if (iy < 0) iy = 0; else if (iy >= GY) iy = GY - 1;
      if (iz < 0) iz = 0; else if (iz >= GZ) iz = GZ - 1;
      for (let ox = -1; ox <= 1; ox++) {
        const cx = ix + ox;
        if (cx < 0 || cx >= GX) continue;
        for (let oy = -1; oy <= 1; oy++) {
          const cy = iy + oy;
          if (cy < 0 || cy >= GY) continue;
          for (let oz = -1; oz <= 1; oz++) {
            const cz = iz + oz;
            if (cz < 0 || cz >= GZ) continue;
            let j = gHead[(cx * GY + cy) * GZ + cz];
            while (j >= 0 && n < maxLinks) {
              if (j > i && vis[j]) {
                const dx = ax - pArr[j * 3], dy = ay - pArr[j * 3 + 1], dz = az - pArr[j * 3 + 2];
                const d2 = dx * dx + dy * dy + dz * dz;
                if (d2 < LINK2) {
                  const o = n * 6;
                  linkArr[o] = ax; linkArr[o + 1] = ay; linkArr[o + 2] = az;
                  linkArr[o + 3] = pArr[j * 3]; linkArr[o + 4] = pArr[j * 3 + 1]; linkArr[o + 5] = pArr[j * 3 + 2];
                  // Per-link edge ramp: shade to black at the cutoff so pairs
                  // forming/breaking fade instead of popping (no flicker).
                  const sh = 1 - sstep(Math.sqrt(d2), LINK * 0.65, LINK);
                  linkColArr[o] = sh; linkColArr[o + 1] = sh; linkColArr[o + 2] = sh;
                  linkColArr[o + 3] = sh; linkColArr[o + 4] = sh; linkColArr[o + 5] = sh;
                  n++;
                }
              }
              j = gNext[j];
            }
          }
        }
      }
    }
    linkGeo.setDrawRange(0, n * 2);
    linkAttr.needsUpdate = true;
    linkColAttr.needsUpdate = true;
  }
  rebuildLinks();
  const plexusLinks = new THREE.LineSegments(linkGeo, new THREE.LineBasicMaterial({
    color: 0xffffff, vertexColors: true, transparent: true, opacity: 0.07, depthWrite: false,
  }));
  plexus.add(plexusLinks);
  // Coordinate tags: one instanced billboard, one draw call. A static glyph
  // atlas plus a tiny code texture replaces a canvas texture per node
  // (that was one draw call and a 320x64 canvas each, hundreds of them).
  const labelGroup = new THREE.Group();
  plexus.add(labelGroup);
  let labelCursor = 0;
  const tmpV = new THREE.Vector3();
  const frustum = new THREE.Frustum();
  const projMat = new THREE.Matrix4();
  const tmpAxis = new THREE.Vector3();
  const tmpCam = new THREE.Vector3();
  const tmpN = new THREE.Vector3();
  const tmpY = new THREE.Vector3();
  const tmpM = new THREE.Matrix4();
  let linkFrame = 0;
  let perfN = 0, perfT = 0, perfMs = 16;
  const GLYPHS = " 0123456789.,()-";
  const glyphIndex = new Uint8Array(128);
  for (let i = 0; i < GLYPHS.length; i++) glyphIndex[GLYPHS.charCodeAt(i)] = i;
  const cell = 64;
  const atlas = document.createElement("canvas");
  atlas.width = GLYPHS.length * cell;
  atlas.height = cell;
  const atlasCtx = atlas.getContext("2d");
  atlasCtx.font = "600 42px ui-monospace, Menlo, Consolas, monospace";
  atlasCtx.textAlign = "center";
  atlasCtx.textBaseline = "middle";
  atlasCtx.fillStyle = "rgba(255,255,255,0.92)";
  for (let i = 1; i < GLYPHS.length; i++) {
    atlasCtx.fillText(GLYPHS[i], i * cell + cell / 2, cell / 2 + 1);
  }
  const glyphTex = new THREE.CanvasTexture(atlas);
  glyphTex.generateMipmaps = false;
  glyphTex.minFilter = THREE.LinearFilter;
  glyphTex.magFilter = THREE.LinearFilter;
  glyphTex.wrapS = glyphTex.wrapT = THREE.ClampToEdgeWrapping;
  const MAXC = 24;
  const codeData = new Uint8Array(MAXC * PN * 4);
  const codeTex = new THREE.DataTexture(codeData, MAXC, PN, THREE.RGBAFormat);
  codeTex.colorSpace = THREE.NoColorSpace;
  codeTex.minFilter = codeTex.magFilter = THREE.NearestFilter;
  codeTex.wrapS = codeTex.wrapT = THREE.ClampToEdgeWrapping;
  codeTex.generateMipmaps = false;
  codeTex.flipY = false;
  const labelStr = new Array(PN);
  function writeLabel(i) {
    const s = `(${pArr[i * 3].toFixed(2)}, ${pArr[i * 3 + 1].toFixed(2)}, ${pArr[i * 3 + 2].toFixed(2)})`;
    if (labelStr[i] === s) return false;
    labelStr[i] = s;
    const base = i * MAXC * 4;
    for (let c = 0; c < MAXC; c++) {
      const gi = c < s.length ? (glyphIndex[s.charCodeAt(c)] || 0) : 0;
      codeData[base + c * 4] = gi;
      codeData[base + c * 4 + 3] = 255;
    }
    return true;
  }
  for (let i = 0; i < PN; i++) writeLabel(i);
  codeTex.needsUpdate = true;
  // The old sprite was 1.875×0.375 with the glyphs sitting in a short band
  // of a 320×64 canvas (about 5:1). Mapping square atlas cells onto that
  // full height stretched every character into a tall smear.
  const labelGeo = new THREE.PlaneGeometry(1.875, 0.16);
  const alphaArr = new Float32Array(PN);
  const alphaAttr = new THREE.InstancedBufferAttribute(alphaArr, 1);
  alphaAttr.setUsage(THREE.DynamicDrawUsage);
  labelGeo.setAttribute("aAlpha", alphaAttr);
  const indexArr = new Float32Array(PN);
  for (let i = 0; i < PN; i++) indexArr[i] = i;
  labelGeo.setAttribute("aIndex", new THREE.InstancedBufferAttribute(indexArr, 1));
  const labels = new THREE.InstancedMesh(labelGeo, new THREE.ShaderMaterial({
    uniforms: {
      glyphTex: { value: glyphTex },
      codeTex: { value: codeTex },
      maxC: { value: MAXC },
      pn: { value: PN },
      cols: { value: GLYPHS.length },
    },
    transparent: true, depthWrite: false, depthTest: true,
    vertexShader: `
      attribute float aAlpha;
      attribute float aIndex;
      varying vec2 vUv;
      varying float vAlpha;
      varying float vIndex;
      void main() {
        vUv = uv;
        vAlpha = aAlpha;
        vIndex = aIndex;
        vec3 center = instanceMatrix[3].xyz;
        vec4 mv = modelViewMatrix * vec4(center, 1.0);
        mv.xy += position.xy;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D glyphTex;
      uniform sampler2D codeTex;
      uniform float maxC;
      uniform float pn;
      uniform float cols;
      varying vec2 vUv;
      varying float vAlpha;
      varying float vIndex;
      void main() {
        if (vAlpha < 0.004) discard;
        float col = floor(vUv.x * maxC);
        float gi = floor(texture2D(codeTex, vec2((col + 0.5) / maxC, (vIndex + 0.5) / pn)).r * 255.0 + 0.5);
        if (gi < 0.5) discard;
        float fx = vUv.x * maxC - col;
        vec4 g = texture2D(glyphTex, vec2((gi + fx) / cols, vUv.y));
        if (g.a < 0.08) discard;
        gl_FragColor = vec4(g.rgb, g.a * vAlpha);
      }`,
  }), PN);
  labels.frustumCulled = false;
  labels.renderOrder = 2;
  labels.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const labelDummy = new THREE.Object3D();
  for (let i = 0; i < PN; i++) {
    labelDummy.position.set(pArr[i * 3] + 0.55, pArr[i * 3 + 1] + 0.32, pArr[i * 3 + 2]);
    labelDummy.updateMatrix();
    labels.setMatrixAt(i, labelDummy.matrix);
    alphaArr[i] = 0.55;
  }
  labels.instanceMatrix.needsUpdate = true;
  alphaAttr.needsUpdate = true;
  labelGroup.add(labels);
  scene.add(plexus);

  // Beam dust: faint motes hanging in the light's volume. One draw call,
  // slow drift, no labels — pure depth cue for the shafts.
  const moteN = isMobile ? 60 : 120;
  const moteArr = new Float32Array(moteN * 3);
  const moteVel = new Float32Array(moteN * 3);
  for (let i = 0; i < moteN; i++) {
    moteArr[i * 3] = -7 + Math.random() * 14;
    moteArr[i * 3 + 1] = -2 + Math.random() * 5.5;
    moteArr[i * 3 + 2] = -3 + Math.random() * 6;
    moteVel[i * 3] = (Math.random() - 0.5) * 0.01;
    moteVel[i * 3 + 1] = (Math.random() - 0.5) * 0.006;
    moteVel[i * 3 + 2] = (Math.random() - 0.5) * 0.01;
  }
  const moteAttr = new THREE.BufferAttribute(moteArr, 3);
  moteAttr.setUsage(THREE.DynamicDrawUsage);
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute("position", moteAttr);
  const motes = new THREE.Points(moteGeo, new THREE.ShaderMaterial({
    uniforms: {
      opacity: { value: 0.32 },
      fadeN: pointMat.uniforms.fadeN,
      fadeF: pointMat.uniforms.fadeF,
    },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      varying float vD;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vD = -mv.z;
        gl_PointSize = 0.045 * (400.0 / max(0.1, -mv.z));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float opacity; uniform float fadeN; uniform float fadeF;
      varying float vD;
      void main() {
        vec2 c = gl_PointCoord - vec2(0.5);
        float m = smoothstep(0.5, 0.1, length(c));
        float a = smoothstep(fadeN, fadeF, vD);
        gl_FragColor = vec4(vec3(0.81, 0.91, 1.0), m * a * opacity);
      }`,
  }));
  motes.renderOrder = 4;
  motes.frustumCulled = false;
  scene.add(motes);
  // Bloom on desktop only. The composer sizes itself from the renderer
  // (CSS pixels × fullPR) instead of a hand-built target that ignored the
  // pixel ratio. UnrealBloomPass already blurs at half that size.
  let composer = null, bloomPass = null;
  let renderBloom = false;
  if (!isMobile) {
    try {
      const { EffectComposer } = await import("three/addons/postprocessing/EffectComposer.js");
      const { RenderPass } = await import("three/addons/postprocessing/RenderPass.js");
      const { UnrealBloomPass } = await import("three/addons/postprocessing/UnrealBloomPass.js");
      const { OutputPass } = await import("three/addons/postprocessing/OutputPass.js");
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      // Single billboard planes can't stack knots anymore, so the gate
      // comes back down: cores breathe softly, nothing splats.
      bloomPass = new UnrealBloomPass(
        new THREE.Vector2(mount.clientWidth, mount.clientHeight), 0.5, 0.35, 1.0
      );
      composer.addPass(bloomPass);
      // Tone map + sRGB at the end of the chain. Without this the stacked
      // additive beams clip to hard white squares; with it they roll off.
      composer.addPass(new OutputPass());
      renderBloom = true;
    } catch (e) { composer = null; renderBloom = false; }
  }

  const clock = new THREE.Clock();
  // Scroll progress is measured on scroll/resize, not inside the frame.
  // Reading layout in the same turn that writes styles was a thrash, and
  // the intro does not need a fresh rect every animation frame.
  const frameRect = { top: 0, total: 1 };
  function measureScroll() {
    const r = stage.getBoundingClientRect();
    frameRect.total = Math.max(1, r.height - window.innerHeight);
    frameRect.top = r.top;
  }
  function progress() {
    return Math.min(1, Math.max(0, -frameRect.top / frameRect.total));
  }
  measureScroll();
  window.addEventListener("scroll", measureScroll, { passive: true });
  window.addEventListener("resize", measureScroll, { passive: true });
  // Fox reveal, purely in-scene: the beam's own energy condensed into the
  // team mark. Luminance-masked (not alpha-masked) so any dark pixels in
  // the source art vanish into the black background. No DOM overlay.
  const logoUniforms = {
    map: { value: null },
    time: { value: 0 },
    reveal: { value: 0 },
  };
  const logoMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 2.6),
    new THREE.ShaderMaterial({
      uniforms: logoUniforms,
      transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform sampler2D map;
        uniform float time;
        uniform float reveal;
        varying vec2 vUv;
        void main() {
          vec4 tex = texture2D(map, vUv);
          float lum = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
          float flow = 0.5 + 0.5 * sin((vUv.x + vUv.y) * 9.0 - time * 3.0);
          vec3 tint = vec3(0.45, 0.85, 1.0) * (0.75 + 0.45 * flow);
          gl_FragColor = vec4(tint, lum * reveal);
        }`,
    })
  );
  logoMesh.position.set(0.2, 0.45, 0);
  logoMesh.renderOrder = 8;
  scene.add(logoMesh);
  new THREE.TextureLoader().load("assets/logo.svg", (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    logoUniforms.map.value = tex;
  });
  // Preview hook: ?debug&beat=0..1 jumps the scroll timeline (screenshots).
  if (debug) {
    const b = new URLSearchParams(location.search).get("beat");
    if (b !== null) {
      const f = Math.min(1, Math.max(0, parseFloat(b) || 0));
      setTimeout(() => {
        const r = stage.getBoundingClientRect();
        window.scrollTo(0, (r.height - window.innerHeight) * f);
      }, 900);
    }
  }

  function sstep(x, a, b) {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }
  let loopOn = true;
  let budgetT = 0, budgetN = 0, slowStreak = 0, relief = 0;
  function relieve() {
    slowStreak = 0;
    if (relief === 0 && renderBloom) {
      renderBloom = false;
      relief = 1;
      return;
    }
    if (renderer.getPixelRatio() > 1.05) {
      renderer.setPixelRatio(1);
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      if (composer) {
        composer.setPixelRatio(1);
        composer.setSize(mount.clientWidth, mount.clientHeight);
      }
      relief = 2;
    }
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      loopOn = false;
      return;
    }
    if (!loopOn) {
      loopOn = true;
      measureScroll();
      requestAnimationFrame(frame);
    }
  });
  function frame() {
    // Tab hidden: do not keep a rAF alive (bloom included) for a page
    // nobody is looking at. visibilitychange starts it again.
    if (document.hidden) { loopOn = false; return; }
    requestAnimationFrame(frame);
    const t = clock.getElapsedTime();
    const p = progress();
    // Camera: slow 200deg orbit + push-in.
    // Scroll = orbit + push-in. Finale = dive into the blue beam itself.
    const az = -0.7 + p * 3.4 + Math.sin(t * 0.4) * 0.012;
    const dive = sstep(p, 0.8, 1.0);
    const radius = (7.6 - p * 2.2) * (1 - dive) + 4.2 * dive;
    const camY = (1.7 - p * 0.8) * (1 - dive) + -0.05 * dive + Math.sin(t * 0.53 + 1.7) * 0.05;
    camera.position.set(Math.sin(az) * radius, camY, Math.cos(az) * radius);
    camera.lookAt(
      0.2 * (1 - dive) + logoHome.x * dive,
      0.45 * (1 - dive) + logoHome.y * dive,
      logoHome.z * dive
    );
    // Over-scroll past the stage (0 at the finale, 1 a breath later).
    // Computed early: label/point near-fades below blend on it too.
    // Values come from the scroll handler, so this frame does not read layout.
    const total = frameRect.total;
    const overRaw = Math.min(1, Math.max(0, (-frameRect.top - total) / (total * 0.12 + 1)));
    const om = overRaw * overRaw * (3 - 2 * overRaw);
    // The plexus alone stays alive — a slow drift and faint breathing.
    plexus.rotation.y += 0.00022;
    plexusLinks.material.opacity =
      0.06 + Math.sin(t * 0.4) * 0.02 + sstep(p, 0.7, 1.0) * 0.1;
    // Plexus drift: every node wanders; links stretch and tags stay glued,
    // coordinates refreshed round-robin so tags never lie. Tags persist
    // past the intro — only near-camera ones fade so they never loom.
    for (let i = 0; i < PN; i++) {
      const k = i * 3;
      pFloat[k] += pVel[k];
      pFloat[k + 1] += pVel[k + 1];
      pFloat[k + 2] += pVel[k + 2];
      pArr[k] = Math.round(pFloat[k] * 100) / 100;
      pArr[k + 1] = Math.round(pFloat[k + 1] * 100) / 100;
      pArr[k + 2] = Math.round(pFloat[k + 2] * 100) / 100;
      if (pArr[k] < -23 || pArr[k] > 23) pVel[k] *= -1;
      if (pArr[k + 1] < -13 || pArr[k + 1] > 13) pVel[k + 1] *= -1;
      if (pArr[k + 2] < -22 || pArr[k + 2] > 8) pVel[k + 2] *= -1;
    }
    pointAttr.needsUpdate = true;
    for (let i = 0; i < moteN; i++) {
      const k = i * 3;
      moteArr[k] += moteVel[k];
      moteArr[k + 1] += moteVel[k + 1];
      moteArr[k + 2] += moteVel[k + 2];
      if (moteArr[k] < -7 || moteArr[k] > 7) moteVel[k] *= -1;
      if (moteArr[k + 1] < -2 || moteArr[k + 1] > 3.5) moteVel[k + 1] *= -1;
      if (moteArr[k + 2] < -3 || moteArr[k + 2] > 3) moteVel[k + 2] *= -1;
    }
    moteAttr.needsUpdate = true;
    // Lazy points: one frustum test each, then links/labels skip whatever
    // the camera can't see. 2-unit margin so links don't pop at the edge.
    plexus.updateWorldMatrix(true, false);
    const pmw = plexus.matrixWorld;
    frustum.setFromProjectionMatrix(projMat.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    for (let i = 0; i < PN; i++) {
      tmpV.set(pArr[i * 3], pArr[i * 3 + 1], pArr[i * 3 + 2]).applyMatrix4(pmw);
      let v = 1;
      for (let f = 0; f < 6; f++) {
        if (frustum.planes[f].distanceToPoint(tmpV) < -2) { v = 0; break; }
      }
      vis[i] = v;
    }
    if ((linkFrame++ & 1) === 0) rebuildLinks();
    // Labels ride the opposite phase from links: half the matrix churn
    // per frame, still every-frame fresh through the text refresh below.
    if ((linkFrame & 1) === 1) {
      for (let i = 0; i < PN; i++) {
        const x = pArr[i * 3], y = pArr[i * 3 + 1], z = pArr[i * 3 + 2];
        if (!vis[i]) { alphaArr[i] = 0; continue; }
        labelDummy.position.set(x + 0.55, y + 0.32, z);
        labelDummy.updateMatrix();
        labels.setMatrixAt(i, labelDummy.matrix);
        tmpV.set(x + 0.55, y + 0.32, z).applyMatrix4(pmw);
        const dd = tmpV.distanceTo(camera.position);
        // On content (om→1) cull harder: nothing looms in your face.
        const ln = 7 + 4 * om, ls = 5 + 3 * om;
        const a = dd < ln ? 0 : Math.min(1, (dd - ln) / ls);
        alphaArr[i] = 0.55 * a * a * (3 - 2 * a);
      }
      labels.instanceMatrix.needsUpdate = true;
      alphaAttr.needsUpdate = true;
    }
    let textChanged = false;
    const labelBudget = isMobile ? 1 : 3;
    for (let k = 0; k < labelBudget; k++) {
      labelCursor = (labelCursor + 1) % PN;
      if (writeLabel(labelCursor)) textChanged = true;
    }
    if (textChanged) codeTex.needsUpdate = true;
    // Reveal the site chrome once the sequence is finished. Latched with
    // hysteresis so boundary jitter can't flap it back and forth.
    if (p >= 0.999) {
      if (document.body.classList.contains("in-intro")) document.body.classList.remove("in-intro");
    } else if (p < 0.985) {
      if (!document.body.classList.contains("in-intro")) document.body.classList.add("in-intro");
    }
    // Scroll draws each shaft tip-forward: light travels as you scroll.
    // Chained handoffs — each span starts as the previous tip arrives:
    // white .04-.20, inner .16-.34, inner fan .32-.50, fan .46-.68+.05/i,
    // blue .50-.86. Nothing starts with anything else.
    const blueIn = Math.min(1, Math.max(0, (p - 0.48) / 0.25));
    // Finale crossfade: the prism yields to the fox logo.
    const endFade = 1 - Math.min(1, Math.max(0, (p - 0.78) / 0.16));
    prism.visible = endFade > 0.001;
    prism.scale.setScalar(0.35 + 0.65 * endFade);
    edges.material.opacity = 0.22 * endFade;
    shell.material.uniforms.opacity.value = 0.45 * endFade;
    core.material.opacity = 0.15 * endFade;
    if (prism.material.emissiveIntensity !== undefined) {
      prism.material.emissiveIntensity = 0.08 * endFade;
    }
    // Proximity yield: the camera flies into the entry knot — dim the
    // axis-aligned spans as it closes in. Reads as flying past the
    // light, not glare.
    const prox = 1 - sstep(p, 0.5, 0.75) * 0.7;
    driveBeam(white, t, sstep(p, 0.04, 0.2) * 1.2, 1.0 * endFade * prox);
    fan.forEach((b, i) => {
      driveBeam(b, t + i * 0.4, sstep(p, 0.46 + i * 0.05, 0.68 + i * 0.05) * 1.2, 1.2 * endFade);
    });
    driveBeam(blue, t, sstep(p, 0.5, 0.86) * 1.2, 0);
    blue.group.scale.y = (1 + blueIn * 1.2) * (1 + dive * 1.2);
    driveBeam(innerWhite, t, sstep(p, 0.16, 0.34) * 1.2, 0.95 * endFade * prox);
    innerFan.forEach((b, i) => {
      driveBeam(b, t + i * 0.4, sstep(p, 0.32 + i * 0.03, 0.5 + i * 0.03) * 1.2, 0.9 * endFade * prox);
    });
    // The camera dives into the blue; the shaft's energy condenses into
    // the fox, so the shaft itself yields some brightness as it appears.
    // Wide window: the reveal + grow play out slowly across the dive.
    const logoIn = sstep(p, 0.78, 1.0);
    blue.mat.uniforms.intensity.value = blueIn * (2.75 + p * 1.25) * (1 - logoIn * 0.6) * (1 - dive * 0.55);
    if (bloomPass) bloomPass.strength = 0.4 + blueIn * 0.35 + dive * 0.1;
    logoUniforms.time.value = t;
    logoUniforms.reveal.value = logoIn;
    logoMesh.position.set(
      0.2 * (1 - logoIn) + logoHome.x * logoIn,
      0.45 * (1 - logoIn) + logoHome.y * logoIn,
      logoHome.z * logoIn
    );
    logoMesh.quaternion.copy(camera.quaternion);
    const ls = 0.62 + 0.38 * logoIn; // geometry is already 2.6 units
    logoMesh.scale.set(ls, ls, 1);
    // Near-field hygiene follows the handoff: on content, points join the
    // labels in keeping their distance.
    pointMat.uniforms.fadeN.value = 1.2 + 3.8 * om;
    pointMat.uniforms.fadeF.value = 3.5 + 5.5 * om;
    // Cylindrical billboards: every shaft turns about its own axis to face
    // the camera. One surface per beam from all angles — never segments.
    for (const g of shafts) {
      if (!g.userData.baseQ) g.userData.baseQ = g.quaternion.clone();
      tmpAxis.set(1, 0, 0).applyQuaternion(g.userData.baseQ);
      tmpCam.copy(camera.position).sub(g.position);
      tmpN.copy(tmpCam).addScaledVector(tmpAxis, -tmpCam.dot(tmpAxis));
      if (tmpN.lengthSq() > 1e-4) {
        tmpN.normalize();
        tmpY.crossVectors(tmpN, tmpAxis).normalize();
        tmpM.makeBasis(tmpAxis, tmpY, tmpN);
        g.quaternion.setFromRotationMatrix(tmpM);
      }
    }
    // Past the stage, the SAME 3D plexus field continues as the page
    // backdrop: the canvas pins to the viewport, intro actors yield, and
    // the camera eases into a slow ambient drift. Driven by over-scroll
    // (0 at the finale, 1 a breath later), so scrolling back reverses it
    // smoothly — no latch, no pop, no flap.
    if (om > 0) {
      const azD = 2.7 + t * 0.03;
      const dx = Math.sin(azD) * 9, dy = 1.1 + Math.sin(t * 0.11) * 0.25,
        dz = Math.cos(azD) * 9;
      camera.position.set(
        camera.position.x + (dx - camera.position.x) * om,
        camera.position.y + (dy - camera.position.y) * om,
        camera.position.z + (dz - camera.position.z) * om
      );
      const tx = 0.2 * (1 - dive) + logoHome.x * dive,
        ty = 0.45 * (1 - dive) + logoHome.y * dive,
        tz = logoHome.z * dive;
      camera.lookAt(tx * (1 - om), ty * (1 - om) + 0.4 * om, tz * (1 - om));
      if (mount.style.position !== "fixed") {
        mount.style.position = "fixed";
        mount.style.inset = "0";
        mount.style.zIndex = "0";
        renderer.setSize(mount.clientWidth, mount.clientHeight);
        if (composer) composer.setSize(mount.clientWidth, mount.clientHeight);
      }
      blue.mat.uniforms.intensity.value *= (1 - om);
      logoUniforms.reveal.value = logoIn * (1 - om);
      logoMesh.visible = logoUniforms.reveal.value > 0.01;
    } else if (mount.style.position === "fixed") {
      mount.style.position = "";
      mount.style.inset = "";
      mount.style.zIndex = "";
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      if (composer) composer.setSize(mount.clientWidth, mount.clientHeight);
      logoMesh.visible = true;
    }
    // Past the intro the beams are gone, so the bloom chain is pure cost.
    // A machine that still misses ~30fps after shaders settle drops bloom
    // for the rest of the session and renders with the tone-mapped path.
    const pastIntro = om > 0.85;
    if (renderBloom && composer && !pastIntro) composer.render();
    else renderer.render(scene, camera);
    if (debug) {
      const now = performance.now();
      if (perfT > 0) perfMs += (now - perfT - perfMs) * 0.05;
      perfT = now;
      if (++perfN >= 20) {
        perfN = 0;
        window.__perf = {
          ms: +perfMs.toFixed(1),
          fps: Math.round(1000 / Math.max(1, perfMs)),
          calls: renderer.info.render.calls,
          tris: renderer.info.render.triangles,
        };
      }
    }
    if (relief < 2 && typeof performance !== "undefined") {
      const now = performance.now();
      if (budgetT && budgetN > 4) {
        const dt = now - budgetT;
        // Three slow frames in a row, after the first handful, means this
        // GPU cannot hold the current quality. Bloom goes first (45ms),
        // then the extra pixel ratio (24ms). A fast GPU never trips it.
        const limit = relief === 0 ? 45 : 24;
        slowStreak = dt > limit ? slowStreak + 1 : 0;
        if (slowStreak >= 3) relieve();
      }
      budgetT = now;
      budgetN++;
    }
  }
  window.addEventListener("resize", () => {
    camera.aspect = mount.clientWidth / mount.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    if (composer) composer.setSize(mount.clientWidth, mount.clientHeight);
  });
  frame();
}
