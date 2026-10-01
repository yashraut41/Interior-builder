import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { rooms, hotspotRooms, EYE_HEIGHT, WALL_HEIGHT, PLAN_UP_BEARING } from "./roomData.js";
import { buildAllRooms, getFlatBounds } from "./rooms.js";
import { wallBounds } from "./walls.js";
import { sunPosition, sunDirection } from "./sun.js";

// ---------------------------------------------------------------------------
// Scene setup
// ---------------------------------------------------------------------------

const appEl = document.getElementById("app");
const backBtn = document.getElementById("back-btn");
const roomLabelEl = document.getElementById("room-label");
const exportBtn = document.getElementById("export-btn");
const paintRoomEl = document.getElementById("paint-room");
const paintColorEl = document.getElementById("paint-color");
const paintHexEl = document.getElementById("paint-hex");
const paintResetBtn = document.getElementById("paint-reset");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb9b4a9); // a shade darker than the walls so they separate

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.05,
  300
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
appEl.appendChild(renderer.domElement);

// Neutral viewing light, for judging colour. No point lights, no shadow maps.
// Mostly even ambient light — intensity PI makes a matte surface render at
// exactly its albedo, so AMBIENT_SHARE of that means a wall shows ~its paint
// colour — plus a little studio environment light so corners and edges still
// read. "Khronos PBR Neutral" tone mapping keeps hue and saturation true.
// Real sun + shadows belong to the later day/night feature.
const AMBIENT_SHARE = 0.8;
const NEUTRAL_BACKGROUND = scene.background.clone();
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
const ambient = new THREE.AmbientLight(0xffffff, Math.PI * AMBIENT_SHARE);
scene.add(ambient);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.3;
pmrem.dispose();

// Geometry, generated entirely from roomData.js
const { ceilingGroup, paints } = buildAllRooms(scene);
const bounds = getFlatBounds();

// ---------------------------------------------------------------------------
// Sun — the day/night mode, off by default so the neutral light above stays
// the colour-judging view. One shadowed directional sun on the real sun path
// for the date and time, plus a sky fill. Daylight only gets in through the
// openings: a shadow-only slab over the whole flat stands in for the floor
// above (ceilings are hidden in dollhouse view, and the passage has none).
// ---------------------------------------------------------------------------

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const flatCentre = new THREE.Vector3(bounds.centerX, WALL_HEIGHT / 2, bounds.centerZ);
const shadowReach = Math.hypot(bounds.width, bounds.depth, WALL_HEIGHT) / 2 + 1;

const sun = new THREE.DirectionalLight(0xffffff, 0);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
Object.assign(sun.shadow.camera, {
  left: -shadowReach,
  right: shadowReach,
  top: shadowReach,
  bottom: -shadowReach,
  near: 0.1,
  far: shadowReach * 4,
});
sun.target.position.copy(flatCentre);
sun.visible = false;
scene.add(sun, sun.target);

const sky = new THREE.HemisphereLight(0xbfd6ee, 0x8a8170, 0);
sky.visible = false;
scene.add(sky);

const roofSlab = new THREE.Mesh(
  new THREE.BoxGeometry(wallBounds.maxX - wallBounds.minX + 2, 0.15, wallBounds.maxZ - wallBounds.minZ + 2),
  new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }) // never seen, only casts
);
roofSlab.position.set((wallBounds.minX + wallBounds.maxX) / 2, WALL_HEIGHT + 0.075, (wallBounds.minZ + wallBounds.maxZ) / 2);
roofSlab.castShadow = true;
roofSlab.visible = false;
scene.add(roofSlab);

const SUN_STORE = "sunSettings";
const sunState = { on: false, date: new Date().toLocaleDateString("en-CA"), minutes: 16 * 60, planUp: PLAN_UP_BEARING };
try {
  Object.assign(sunState, JSON.parse(localStorage.getItem(SUN_STORE)));
} catch {}

function saveSunState() {
  try {
    localStorage.setItem(SUN_STORE, JSON.stringify(sunState));
  } catch {}
}

const smooth = (e0, e1, x) => THREE.MathUtils.smoothstep(x, e0, e1);
const SKY_NIGHT = new THREE.Color(0x0b1020);
const SKY_DUSK = new THREE.Color(0xe39a6a);
const SKY_DAY = new THREE.Color(0x9cc3e6);
const SUN_LOW = new THREE.Color(0xffa860);
const SUN_HIGH = new THREE.Color(0xfff3e2);

function applyLighting() {
  const on = sunState.on;
  sun.visible = sky.visible = roofSlab.visible = on;
  if (!on) {
    ambient.color.set(0xffffff);
    ambient.intensity = Math.PI * AMBIENT_SHARE;
    scene.environmentIntensity = 0.3;
    scene.background.copy(NEUTRAL_BACKGROUND);
    return;
  }

  const pos = sunPosition(sunState.date, sunState.minutes);
  const d = sunDirection(pos, sunState.planUp);
  const alt = pos.altitude;
  const day = smooth(-6, 8, alt); // 0 after civil dusk, 1 once properly up
  const high = smooth(0, 35, alt); // how far past the warm low-sun light

  sun.position.set(flatCentre.x + d.x * shadowReach * 2, flatCentre.y + d.y * shadowReach * 2, flatCentre.z + d.z * shadowReach * 2);
  sun.intensity = 6 * smooth(-1, 6, alt);
  sun.color.copy(SUN_LOW).lerp(SUN_HIGH, high);

  sky.intensity = 0.1 + 0.7 * day;
  sky.color.copy(SKY_DUSK).lerp(SKY_DAY, high);
  ambient.color.set(0xb8c4dc);
  ambient.intensity = Math.PI * (0.05 + 0.15 * day);
  scene.environmentIntensity = 0.05 + 0.2 * day;

  scene.background.copy(SKY_NIGHT).lerp(SKY_DUSK, smooth(-8, 0, alt)).lerp(SKY_DAY, high);
}

const sunOnEl = document.getElementById("sun-on");
const sunControlsEl = document.getElementById("sun-controls");
const sunDateEl = document.getElementById("sun-date");
const sunTimeEl = document.getElementById("sun-time");
const sunPlayBtn = document.getElementById("sun-play");
const sunReadoutEl = document.getElementById("sun-readout");
const sunNorthEl = document.getElementById("sun-north");

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const clock = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.floor(m % 60)).padStart(2, "0")}`;

function showSun() {
  sunOnEl.checked = sunState.on;
  sunControlsEl.classList.toggle("hidden", !sunState.on);
  sunDateEl.value = sunState.date;
  sunTimeEl.value = sunState.minutes;
  sunNorthEl.value = sunState.planUp;
  const { azimuth, altitude } = sunPosition(sunState.date, sunState.minutes);
  const dir = COMPASS[Math.round(azimuth / 45) % 8];
  sunReadoutEl.textContent =
    altitude > 0
      ? `${clock(sunState.minutes)} · sun ${dir} ${azimuth.toFixed(0)}°, ${altitude.toFixed(0)}° up`
      : `${clock(sunState.minutes)} · sun down`;
  applyLighting();
}
showSun();

let sunPlaying = false;
const PLAY_RATE = 60 / 1000; // one hour of daylight per second

sunOnEl.addEventListener("change", () => {
  sunState.on = sunOnEl.checked;
  saveSunState();
  showSun();
});
sunDateEl.addEventListener("change", () => {
  if (!sunDateEl.value) return;
  sunState.date = sunDateEl.value;
  saveSunState();
  showSun();
});
sunTimeEl.addEventListener("input", () => {
  sunState.minutes = Number(sunTimeEl.value);
  showSun();
});
sunTimeEl.addEventListener("change", saveSunState);
sunNorthEl.addEventListener("input", () => {
  if (sunNorthEl.value === "") return;
  sunState.planUp = Number(sunNorthEl.value);
  saveSunState();
  showSun();
});
sunPlayBtn.addEventListener("click", () => {
  sunPlaying = !sunPlaying;
  sunPlayBtn.innerHTML = sunPlaying ? "&#10074;&#10074;" : "&#9654;";
  if (!sunPlaying) saveSunState();
});

function advanceSun(dt) {
  if (!sunPlaying) return;
  sunState.minutes = (sunState.minutes + dt * PLAY_RATE) % 1440;
  showSun();
}

// Ceilings are hidden in the dollhouse view, shown once inside a room.
ceilingGroup.visible = false;

// ---------------------------------------------------------------------------
// Live wall colour — recolours a room's paint material in place, so both
// views pick it up the next frame. Picks are remembered in this browser only;
// roomData.js stays the source of truth (Reset goes back to it).
// ---------------------------------------------------------------------------

const PAINT_STORE = "wallColours";
const defaultPaint = Object.fromEntries(
  Object.entries(paints).map(([id, m]) => [id, `#${m.color.getHexString()}`])
);
let paintPicks = {};
try {
  paintPicks = JSON.parse(localStorage.getItem(PAINT_STORE)) ?? {};
} catch {}

function savePaintPicks() {
  try {
    localStorage.setItem(PAINT_STORE, JSON.stringify(paintPicks));
  } catch {}
}

const paintedRooms = rooms.filter((r) => paints[r.id]);
for (const room of paintedRooms) {
  paintRoomEl.add(new Option(room.name, room.id));
  if (paintPicks[room.id]) paints[room.id].color.set(paintPicks[room.id]);
}

function showPaint() {
  const hex = `#${paints[paintRoomEl.value].color.getHexString()}`;
  paintColorEl.value = hex;
  paintHexEl.textContent = `0x${hex.slice(1)}`;
}

paintRoomEl.value = "yash_room" in paints ? "yash_room" : paintedRooms[0].id;
showPaint();

paintRoomEl.addEventListener("change", showPaint);
paintColorEl.addEventListener("input", () => {
  const id = paintRoomEl.value;
  paints[id].color.set(paintColorEl.value);
  paintPicks[id] = paintColorEl.value;
  paintHexEl.textContent = `0x${paintColorEl.value.slice(1)}`;
});
paintColorEl.addEventListener("change", savePaintPicks);
paintResetBtn.addEventListener("click", () => {
  const id = paintRoomEl.value;
  paints[id].color.set(defaultPaint[id]);
  delete paintPicks[id];
  savePaintPicks();
  showPaint();
});

// ---------------------------------------------------------------------------
// Dollhouse (overview) controls
// ---------------------------------------------------------------------------

const dollhouseTarget = new THREE.Vector3(bounds.centerX, 0, bounds.centerZ);
const flatSpan = Math.max(bounds.width, bounds.depth);

const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.target.copy(dollhouseTarget);
orbitControls.maxPolarAngle = Math.PI / 2.15; // never drop under the floor
orbitControls.minDistance = flatSpan * 0.35;
orbitControls.maxDistance = flatSpan * 2.5;
orbitControls.enablePan = false;
orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.08;

const dollhouseCamPos = {
  x: bounds.centerX,
  y: flatSpan * 0.85,
  z: bounds.centerZ + flatSpan * 0.75,
};

function setDollhouseCameraStart() {
  camera.position.set(dollhouseCamPos.x, dollhouseCamPos.y, dollhouseCamPos.z);
  orbitControls.target.copy(dollhouseTarget);
  orbitControls.update();
}
setDollhouseCameraStart();

// ---------------------------------------------------------------------------
// Hotspots — one per zone, at the zone's floor centre
// ---------------------------------------------------------------------------

const hotspotGroup = new THREE.Group();
scene.add(hotspotGroup);
const hotspotMeshes = [];

for (const room of hotspotRooms) {
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.3, 32),
    new THREE.MeshBasicMaterial({ color: 0xff5533 })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(room.x, 0.03, room.z);
  disc.userData.roomId = room.id;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.36, 0.44, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(room.x, 0.031, room.z);

  hotspotGroup.add(disc, ring);
  hotspotMeshes.push(disc);
}

// ---------------------------------------------------------------------------
// Mode state: "dollhouse" (orbit overview) <-> "pano" (locked look-around)
// ---------------------------------------------------------------------------

let mode = "dollhouse";
let panoYaw = 0;
let panoPitch = 0;

function enterPanoMode(room) {
  mode = "pano";
  orbitControls.enabled = false;
  hotspotGroup.visible = false;
  ceilingGroup.visible = true; // ceiling only exists once you're inside
  backBtn.classList.remove("hidden");
  roomLabelEl.textContent = room.name;
  roomLabelEl.classList.remove("hidden");

  panoYaw = Math.atan2(bounds.centerX - room.x, bounds.centerZ - room.z);
  panoPitch = 0;

  // Colour controls follow you into the room you're standing in.
  if (paints[room.id]) {
    paintRoomEl.value = room.id;
    showPaint();
  }
}

function exitPanoMode() {
  mode = "transition-out";
  hotspotGroup.visible = true;
  ceilingGroup.visible = false;
  backBtn.classList.add("hidden");
  roomLabelEl.classList.add("hidden");
  animateCameraTo(dollhouseCamPos, dollhouseTarget, () => {
    mode = "dollhouse";
    orbitControls.enabled = true;
    orbitControls.target.copy(dollhouseTarget);
    orbitControls.update();
  });
}

backBtn.addEventListener("click", exitPanoMode);

// Deep link: /#yash_room opens straight into that room (handy when tuning finishes).
const linkedRoom = hotspotRooms.find((r) => r.id === location.hash.slice(1));
if (linkedRoom) {
  camera.position.set(linkedRoom.x, EYE_HEIGHT, linkedRoom.z);
  enterPanoMode(linkedRoom);
}

// ---------------------------------------------------------------------------
// Export — the architecture only (no hotspots, ceilings shown) as three.js
// JSON. Open in the three.js editor with File -> Import. Units: metres, Y up.
// ---------------------------------------------------------------------------

exportBtn.addEventListener("click", () => {
  const flat = new THREE.Group();
  flat.name = "flat_option1";
  const exported = buildAllRooms(flat);
  for (const [id, m] of Object.entries(exported.paints)) m.color.copy(paints[id].color);

  const json = JSON.stringify(flat.toJSON());
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "flat.json";
  a.click();
  URL.revokeObjectURL(url);
});

// ---------------------------------------------------------------------------
// Camera transition tween
// ---------------------------------------------------------------------------

let transitionState = null;

function animateCameraTo(toPos, lookAt, onDone) {
  transitionState = {
    from: camera.position.clone(),
    to: new THREE.Vector3(toPos.x, toPos.y, toPos.z),
    lookAt: lookAt.clone(),
    startTime: performance.now(),
    duration: 900,
    onDone,
  };
}

function updateTransition(now) {
  if (!transitionState) return;
  const t = Math.min(1, (now - transitionState.startTime) / transitionState.duration);
  const eased = 1 - Math.pow(1 - t, 3);

  camera.position.lerpVectors(transitionState.from, transitionState.to, eased);
  camera.lookAt(transitionState.lookAt);

  if (t >= 1) {
    const done = transitionState.onDone;
    transitionState = null;
    if (done) done();
  }
}

// ---------------------------------------------------------------------------
// Hotspot click detection (dollhouse mode only)
// ---------------------------------------------------------------------------

const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
let pointerDownPos = null;

function onPointerDown(e) {
  pointerDownPos = { x: e.clientX, y: e.clientY };
}

function onPointerUp(e) {
  if (mode !== "dollhouse" || !pointerDownPos) return;

  const moved = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
  pointerDownPos = null;
  if (moved > 6) return; // that was an orbit drag, not a click

  pointerNdc.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointerNdc.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointerNdc, camera);

  const hits = raycaster.intersectObjects(hotspotMeshes, false);
  if (hits.length === 0) return;

  const room = rooms.find((r) => r.id === hits[0].object.userData.roomId);
  if (!room) return;

  mode = "transition-in";
  orbitControls.enabled = false;
  animateCameraTo(
    { x: room.x, y: EYE_HEIGHT, z: room.z },
    new THREE.Vector3(bounds.centerX, EYE_HEIGHT, bounds.centerZ),
    () => enterPanoMode(room)
  );
}

// ---------------------------------------------------------------------------
// Locked pano look-around: rotation only, no translation
// ---------------------------------------------------------------------------

let lookDragging = false;
let lastPointer = { x: 0, y: 0 };
const LOOK_SPEED = 0.0045;
const MAX_PITCH = Math.PI / 2 - 0.05;

function onLookPointerDown(e) {
  if (mode !== "pano") return;
  lookDragging = true;
  lastPointer = { x: e.clientX, y: e.clientY };
}

function onLookPointerMove(e) {
  if (mode !== "pano" || !lookDragging) return;
  panoYaw -= (e.clientX - lastPointer.x) * LOOK_SPEED;
  panoPitch = THREE.MathUtils.clamp(
    panoPitch - (e.clientY - lastPointer.y) * LOOK_SPEED,
    -MAX_PITCH,
    MAX_PITCH
  );
  lastPointer = { x: e.clientX, y: e.clientY };
}

function updatePanoLook() {
  const dir = new THREE.Vector3(
    Math.sin(panoYaw) * Math.cos(panoPitch),
    Math.sin(panoPitch),
    Math.cos(panoYaw) * Math.cos(panoPitch)
  );
  camera.lookAt(camera.position.clone().add(dir));
}

renderer.domElement.addEventListener("pointerdown", (e) => {
  onPointerDown(e);
  onLookPointerDown(e);
});
renderer.domElement.addEventListener("pointermove", onLookPointerMove);
window.addEventListener("pointerup", (e) => {
  onPointerUp(e);
  lookDragging = false;
});

// ---------------------------------------------------------------------------
// Resize + render loop
// ---------------------------------------------------------------------------

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let lastFrame = performance.now();

function animate(now) {
  requestAnimationFrame(animate);
  advanceSun(now - lastFrame);
  lastFrame = now;

  if (mode === "dollhouse") {
    orbitControls.update();
  } else if (transitionState) {
    updateTransition(now);
  } else if (mode === "pano") {
    updatePanoLook();
  }

  renderer.render(scene, camera);
}
requestAnimationFrame(animate);
