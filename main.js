import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { rooms, hotspotRooms, EYE_HEIGHT } from "./roomData.js";
import { buildAllRooms, getFlatBounds } from "./rooms.js";

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
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
scene.add(new THREE.AmbientLight(0xffffff, Math.PI * AMBIENT_SHARE));
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.3;
pmrem.dispose();

// Geometry, generated entirely from roomData.js
const { ceilingGroup, paints } = buildAllRooms(scene);
const bounds = getFlatBounds();

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

function animate(now) {
  requestAnimationFrame(animate);

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
