import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { rooms, hotspotRooms, EYE_HEIGHT } from "./roomData.js";
import { buildAllRooms, getFlatBounds } from "./rooms.js";

// ---------------------------------------------------------------------------
// Scene setup
// ---------------------------------------------------------------------------

const appEl = document.getElementById("app");
const backBtn = document.getElementById("back-btn");
const roomLabelEl = document.getElementById("room-label");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdcd8ce);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.05,
  300
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
appEl.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.75));
const sun = new THREE.DirectionalLight(0xffffff, 0.75);
sun.position.set(12, 24, 12);
sun.castShadow = true;
scene.add(sun);

// Geometry, generated entirely from roomData.js
const { ceilingGroup } = buildAllRooms(scene);
const bounds = getFlatBounds();

// Ceilings are hidden in the dollhouse view, shown once inside a room.
ceilingGroup.visible = false;

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
