/* ============================================================
 * SKINNY BAKER — 3D CAKE STUDIO
 * Pure-frontend Three.js cake configurator with PNG download.
 * ============================================================ */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ────────────────── State ──────────────────
const state = {
  tiers: 2,
  shape: 'round',
  color: '#f5e6d3',
  scene: 'dark',
  deco: {
    pearls: true,
    candle: true,
    goldLeaf: false,
    drip: false,
    flowers: false,
    sparkles: false,
  },
};

// Scene presets — control background, fog, and ground reflection tint
const SCENE_PRESETS = {
  dark:  { bg: 0x0a0604, fogStart: 4.5, fogEnd: 9, groundColor: 0x1a0e07, groundReflect: 0.08 },
  light: { bg: 0xefe3d0, fogStart: 5,   fogEnd: 12, groundColor: 0xc9b89e, groundReflect: 0.05 },
  gold:  { bg: 0x2a1810, fogStart: 4.5, fogEnd: 9, groundColor: 0x3a2418, groundReflect: 0.12 },
};

// ────────────────── DOM ──────────────────
const canvas = document.getElementById('cakeCanvas');
const canvasWrap = document.getElementById('cakeCanvasWrap');
const loadingEl = document.getElementById('cakeLoading');
const hintEl = document.getElementById('cakeHint');
const downloadBtn = document.getElementById('btnDownload');

if (!canvas) {
  console.warn('[cake-studio] Canvas not found, aborting init.');
} else {
  init();
}

// ────────────────── Init ──────────────────
function init() {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true, // required for PNG export
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SCENE_PRESETS[state.scene].bg);

  // PMREM environment for reflections
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  // Camera
  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);
  camera.position.set(0, 1.6, 5);

  // Controls
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 2.5;
  controls.maxDistance = 7;
  controls.minPolarAngle = Math.PI / 5;
  controls.maxPolarAngle = Math.PI / 2.05;
  controls.target.set(0, 0.9, 0);
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.4;

  // Stop auto-rotate on first user interaction
  let userInteracted = false;
  controls.addEventListener('start', () => {
    if (!userInteracted) {
      userInteracted = true;
      controls.autoRotate = false;
      hintEl?.classList.add('is-faded');
    }
  });

  // ────── Lighting ──────
  const ambient = new THREE.AmbientLight(0xffffff, 0.18);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xfff1d8, 1.6);
  keyLight.position.set(3, 5, 3);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xc9a84c, 0.7);
  rimLight.position.set(-3, 2, -2);
  scene.add(rimLight);

  const fillLight = new THREE.DirectionalLight(0xffe0cc, 0.4);
  fillLight.position.set(-2, 1.5, 3);
  scene.add(fillLight);

  // Ground reflection plane
  const groundGeo = new THREE.CircleGeometry(8, 64);
  const groundMat = new THREE.MeshStandardMaterial({
    color: SCENE_PRESETS[state.scene].groundColor,
    roughness: 0.45,
    metalness: 0.2,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.001;
  scene.add(ground);

  // Cake group — everything we rebuild on state change
  const cakeGroup = new THREE.Group();
  scene.add(cakeGroup);

  // Sparkle particle system (toggle via state.deco.sparkles)
  const sparkleSystem = createSparkles();
  scene.add(sparkleSystem);

  // ────── Build / rebuild ──────
  function rebuildCake() {
    while (cakeGroup.children.length) {
      const child = cakeGroup.children[0];
      cakeGroup.remove(child);
      disposeMesh(child);
    }
    buildCake(cakeGroup, state);
  }

  function applyScene() {
    const preset = SCENE_PRESETS[state.scene];
    scene.background = new THREE.Color(preset.bg);
    groundMat.color.setHex(preset.groundColor);
    groundMat.metalness = 0.2 + preset.groundReflect;
    groundMat.needsUpdate = true;
  }

  rebuildCake();
  applyScene();

  // ────── Resize ──────
  function resize() {
    const rect = canvasWrap.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvasWrap);
  window.addEventListener('orientationchange', () => setTimeout(resize, 100));

  // ────── Render loop ──────
  const clock = new THREE.Clock();
  function tick() {
    const t = clock.getElapsedTime();
    controls.update();
    animateSparkles(sparkleSystem, t, state.deco.sparkles);
    animateFlame(cakeGroup, t);
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  tick();

  // Hide loading once first frame is drawn
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      loadingEl?.classList.add('is-hidden');
    });
  });

  // ────── Bind controls ──────
  bindSegment('tiers', (v) => { state.tiers = parseInt(v, 10); rebuildCake(); });
  bindSegment('shape', (v) => { state.shape = v; rebuildCake(); });
  bindSegment('scene', (v) => { state.scene = v; applyScene(); });
  bindSwatches((v) => { state.color = v; rebuildCake(); });
  bindToggles((key, on) => { state.deco[key] = on; rebuildCake(); });

  // Download
  downloadBtn?.addEventListener('click', () => {
    // Snapshot at high resolution
    const exportSize = 2048;
    const oldDpr = renderer.getPixelRatio();
    const oldSize = new THREE.Vector2();
    renderer.getSize(oldSize);

    // Pause auto-rotate so we capture exact pose
    const wasAutoRotating = controls.autoRotate;
    controls.autoRotate = false;

    renderer.setPixelRatio(1);
    renderer.setSize(exportSize, exportSize, false);
    camera.aspect = 1;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);

    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `skinny-baker-design-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      // Restore previous size
      renderer.setPixelRatio(oldDpr);
      renderer.setSize(oldSize.x, oldSize.y, false);
      controls.autoRotate = wasAutoRotating;
      resize();
    }, 'image/png', 0.95);
  });
}

// ────────────────── Cake construction ──────────────────
function buildCake(group, state) {
  const tierHeight = 0.42;
  const baseRadius = 0.95;
  const radiusStep = 0.22;

  // Pedestal
  const pedestal = makePedestal();
  group.add(pedestal);

  let yOffset = pedestal.userData.height;
  const tierRadii = [];

  for (let i = 0; i < state.tiers; i++) {
    const r = baseRadius - i * radiusStep;
    tierRadii.push(r);

    const tier = makeTier({ radius: r, height: tierHeight, shape: state.shape, color: state.color });
    tier.position.y = yOffset + tierHeight / 2;
    group.add(tier);

    if (state.deco.pearls) {
      const pearls = makePearlBorder({ radius: r, shape: state.shape, y: yOffset + 0.02 });
      group.add(pearls);
      const top = makePearlBorder({ radius: r, shape: state.shape, y: yOffset + tierHeight - 0.02 });
      group.add(top);
    }

    if (state.deco.goldLeaf) {
      const leaves = makeGoldLeafCluster({ radius: r, shape: state.shape, y: yOffset + tierHeight * 0.55, count: 10 - i * 2 });
      group.add(leaves);
    }

    if (state.deco.drip && i === 0) {
      const drip = makeDripGlaze({ radius: r, height: tierHeight, color: state.color });
      drip.position.y = yOffset;
      group.add(drip);
    }

    if (state.deco.flowers) {
      const flowers = makeFlowerCluster({ radius: r, y: yOffset + tierHeight - 0.05, isTop: i === state.tiers - 1 });
      group.add(flowers);
    }

    yOffset += tierHeight;
  }

  // Top: candle or topper
  if (state.deco.candle) {
    const candle = makeCandle();
    candle.position.y = yOffset;
    group.add(candle);
  }
}

function makePedestal() {
  const group = new THREE.Group();
  const height = 0.12;
  const baseGeo = new THREE.CylinderGeometry(1.25, 1.35, height, 64);
  const baseMat = new THREE.MeshPhysicalMaterial({
    color: 0xc9a84c,
    metalness: 1,
    roughness: 0.22,
    clearcoat: 0.8,
    clearcoatRoughness: 0.1,
  });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = height / 2;
  group.add(base);

  // Top plate
  const topGeo = new THREE.CylinderGeometry(1.1, 1.15, 0.04, 64);
  const top = new THREE.Mesh(topGeo, baseMat);
  top.position.y = height + 0.02;
  group.add(top);

  group.userData.height = height + 0.04;
  return group;
}

function makeTier({ radius, height, shape, color }) {
  let geo;
  if (shape === 'square') {
    const s = radius * 1.6;
    geo = new THREE.BoxGeometry(s, height, s);
  } else if (shape === 'hex') {
    geo = new THREE.CylinderGeometry(radius, radius, height, 6);
  } else {
    geo = new THREE.CylinderGeometry(radius, radius, height, 64);
  }

  const mat = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.55,
    sheen: 0.7,
    sheenRoughness: 0.4,
    sheenColor: new THREE.Color(0xffffff),
    clearcoat: 0.18,
    clearcoatRoughness: 0.45,
  });

  return new THREE.Mesh(geo, mat);
}

function makePearlBorder({ radius, shape, y }) {
  const group = new THREE.Group();
  const pearlGeo = new THREE.SphereGeometry(0.038, 18, 18);
  const pearlMat = new THREE.MeshPhysicalMaterial({
    color: 0xfffaf0,
    metalness: 0.4,
    roughness: 0.15,
    iridescence: 0.4,
    clearcoat: 0.3,
  });

  if (shape === 'square') {
    const half = radius * 0.8;
    const perSide = 10;
    for (let side = 0; side < 4; side++) {
      for (let i = 0; i < perSide; i++) {
        const t = i / (perSide - 1);
        const x = -half + 2 * half * t;
        const positions = [
          [x, half + 0.002], [half + 0.002, -x],
          [-x, -half - 0.002], [-half - 0.002, x]
        ];
        const [px, pz] = positions[side];
        const pearl = new THREE.Mesh(pearlGeo, pearlMat);
        pearl.position.set(px, y, pz);
        group.add(pearl);
      }
    }
  } else {
    const sides = shape === 'hex' ? 36 : 48;
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const r = radius + 0.01;
      const pearl = new THREE.Mesh(pearlGeo, pearlMat);
      pearl.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      group.add(pearl);
    }
  }
  return group;
}

function makeGoldLeafCluster({ radius, shape, y, count }) {
  const group = new THREE.Group();
  const leafMat = new THREE.MeshPhysicalMaterial({
    color: 0xc9a84c,
    metalness: 1,
    roughness: 0.18,
    clearcoat: 0.9,
    clearcoatRoughness: 0.05,
    side: THREE.DoubleSide,
  });

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const w = 0.08 + Math.random() * 0.05;
    const h = 0.12 + Math.random() * 0.06;
    const leafGeo = new THREE.PlaneGeometry(w, h);
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    const r = (shape === 'square' ? radius * 0.85 : radius) + 0.005;
    leaf.position.set(Math.cos(angle) * r, y + (Math.random() - 0.5) * 0.15, Math.sin(angle) * r);
    leaf.rotation.y = -angle + Math.PI / 2;
    leaf.rotation.z = (Math.random() - 0.5) * 0.6;
    group.add(leaf);
  }
  return group;
}

function makeDripGlaze({ radius, height, color }) {
  const group = new THREE.Group();
  // Slightly darker and shinier glaze
  const glazeColor = new THREE.Color(color).multiplyScalar(0.85);
  const dripMat = new THREE.MeshPhysicalMaterial({
    color: glazeColor,
    roughness: 0.22,
    clearcoat: 0.9,
    clearcoatRoughness: 0.1,
    transmission: 0.05,
  });

  // Drip strands using small cones / cylinders around the rim
  const drips = 24;
  for (let i = 0; i < drips; i++) {
    const angle = (i / drips) * Math.PI * 2;
    const len = 0.08 + Math.random() * 0.18;
    const drip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.04, len, 10),
      dripMat
    );
    drip.position.set(
      Math.cos(angle) * (radius + 0.005),
      height - len / 2 + 0.01,
      Math.sin(angle) * (radius + 0.005)
    );
    drip.lookAt(Math.cos(angle) * (radius + 0.5), drip.position.y, Math.sin(angle) * (radius + 0.5));
    drip.rotateX(Math.PI / 2);
    group.add(drip);

    // Bead at the bottom
    const bead = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 12, 12),
      dripMat
    );
    bead.position.set(
      Math.cos(angle) * (radius + 0.01),
      height - len + 0.005,
      Math.sin(angle) * (radius + 0.01)
    );
    group.add(bead);
  }

  // Top glaze cap
  const capGeo = new THREE.CylinderGeometry(radius + 0.01, radius + 0.01, 0.05, 64);
  const cap = new THREE.Mesh(capGeo, dripMat);
  cap.position.y = height + 0.02;
  group.add(cap);

  return group;
}

function makeFlowerCluster({ radius, y, isTop }) {
  const group = new THREE.Group();
  const colors = [0xf4c2c2, 0xfff0f0, 0xe8b4b8, 0xffd6d6];

  const count = isTop ? 6 : 5;
  for (let i = 0; i < count; i++) {
    const flower = makeFlower(colors[i % colors.length]);
    if (isTop) {
      // Cluster on top
      const a = (i / count) * Math.PI * 2;
      const r = 0.18 + Math.random() * 0.12;
      flower.position.set(Math.cos(a) * r, y + 0.06, Math.sin(a) * r);
      flower.rotation.x = -Math.PI / 6;
    } else {
      // Around the side
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      flower.position.set(Math.cos(a) * (radius + 0.04), y, Math.sin(a) * (radius + 0.04));
      flower.lookAt(Math.cos(a) * (radius + 1), y, Math.sin(a) * (radius + 1));
    }
    flower.scale.setScalar(0.6 + Math.random() * 0.3);
    group.add(flower);
  }
  return group;
}

function makeFlower(colorHex) {
  const flower = new THREE.Group();
  const petalMat = new THREE.MeshPhysicalMaterial({
    color: colorHex,
    roughness: 0.45,
    sheen: 1,
    sheenColor: 0xffffff,
  });
  const centerMat = new THREE.MeshStandardMaterial({ color: 0xc9a84c, metalness: 0.6, roughness: 0.3 });

  // Petals as small flat ellipses
  const petalGeo = new THREE.SphereGeometry(0.05, 12, 12);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const petal = new THREE.Mesh(petalGeo, petalMat);
    petal.position.set(Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05);
    petal.scale.set(1, 0.5, 1);
    flower.add(petal);
  }

  const center = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 12), centerMat);
  center.position.y = 0.02;
  flower.add(center);

  return flower;
}

function makeCandle() {
  const group = new THREE.Group();

  // Wax body
  const waxGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.32, 24);
  const waxMat = new THREE.MeshPhysicalMaterial({
    color: 0xfff5e1,
    roughness: 0.35,
    transmission: 0.15,
    thickness: 0.5,
    clearcoat: 0.3,
  });
  const wax = new THREE.Mesh(waxGeo, waxMat);
  wax.position.y = 0.16;
  group.add(wax);

  // Stripes
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xc9a84c, metalness: 0.7, roughness: 0.25 });
  for (let i = 0; i < 3; i++) {
    const stripe = new THREE.Mesh(
      new THREE.TorusGeometry(0.046, 0.01, 8, 24),
      stripeMat
    );
    stripe.rotation.x = Math.PI / 2;
    stripe.position.y = 0.06 + i * 0.1;
    group.add(stripe);
  }

  // Wick
  const wick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.004, 0.004, 0.04, 6),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 1 })
  );
  wick.position.y = 0.34;
  group.add(wick);

  // Flame (animated in render loop)
  const flameGeo = new THREE.SphereGeometry(0.05, 12, 12);
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0xffcc66,
    transparent: true,
    opacity: 0.95,
  });
  const flame = new THREE.Mesh(flameGeo, flameMat);
  flame.position.y = 0.40;
  flame.scale.set(0.8, 1.6, 0.8);
  flame.userData.isFlame = true;
  group.add(flame);

  // Inner hot core
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 10), coreMat);
  core.position.y = 0.39;
  core.scale.set(0.7, 1.2, 0.7);
  core.userData.isFlameCore = true;
  group.add(core);

  // Light from flame
  const flameLight = new THREE.PointLight(0xffaa44, 0.6, 1.5, 2);
  flameLight.position.y = 0.40;
  flameLight.userData.isFlameLight = true;
  group.add(flameLight);

  return group;
}

function animateFlame(group, t) {
  group.traverse((obj) => {
    if (obj.userData?.isFlame) {
      const f = 1 + Math.sin(t * 8) * 0.06 + Math.sin(t * 13) * 0.04;
      obj.scale.set(0.8 * f, 1.6 * (1 + Math.sin(t * 7) * 0.08), 0.8 * f);
    } else if (obj.userData?.isFlameCore) {
      const f = 1 + Math.sin(t * 11) * 0.1;
      obj.scale.set(0.7 * f, 1.2 * f, 0.7 * f);
    } else if (obj.userData?.isFlameLight) {
      obj.intensity = 0.55 + Math.sin(t * 9) * 0.15;
    }
  });
}

// ────────────────── Sparkles particle system ──────────────────
function createSparkles() {
  const count = 200;
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const r = 1.4 + Math.random() * 1.2;
    const theta = Math.random() * Math.PI * 2;
    const y = 0.4 + Math.random() * 1.6;
    positions[i * 3]     = Math.cos(theta) * r;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = Math.sin(theta) * r;
    phases[i] = Math.random() * Math.PI * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('phase', new THREE.BufferAttribute(phases, 1));

  const mat = new THREE.PointsMaterial({
    color: 0xffd97a,
    size: 0.03,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geo, mat);
  points.userData.basePositions = positions.slice();
  points.userData.phases = phases;
  return points;
}

function animateSparkles(points, t, visible) {
  const target = visible ? 0.85 : 0;
  points.material.opacity += (target - points.material.opacity) * 0.05;
  if (points.material.opacity < 0.01 && !visible) return;

  const positions = points.geometry.attributes.position.array;
  const base = points.userData.basePositions;
  const phases = points.userData.phases;
  for (let i = 0; i < phases.length; i++) {
    const p = phases[i];
    positions[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 1.5 + p) * 0.15;
  }
  points.geometry.attributes.position.needsUpdate = true;
}

// ────────────────── Control bindings ──────────────────
function bindSegment(controlName, onChange) {
  const group = document.querySelector(`[data-control="${controlName}"]`);
  if (!group) return;
  group.querySelectorAll('.cake-segment__btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      group.querySelectorAll('.cake-segment__btn').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      onChange(btn.dataset.value);
    });
  });
}

function bindSwatches(onChange) {
  const group = document.querySelector('[data-control="color"]');
  if (!group) return;
  group.querySelectorAll('.cake-swatch').forEach((btn) => {
    btn.addEventListener('click', () => {
      group.querySelectorAll('.cake-swatch').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      onChange(btn.dataset.value);
    });
  });
}

function bindToggles(onChange) {
  const group = document.querySelector('[data-control="deco"]');
  if (!group) return;
  group.querySelectorAll('.cake-toggle input[type="checkbox"]').forEach((input) => {
    input.addEventListener('change', () => {
      const label = input.closest('.cake-toggle');
      label?.classList.toggle('is-active', input.checked);
      onChange(input.dataset.deco, input.checked);
    });
  });
}

// ────────────────── Memory cleanup ──────────────────
function disposeMesh(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => m.dispose());
    }
  });
}
