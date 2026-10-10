import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { rooms, hotspotRooms, EYE_HEIGHT, WALL_HEIGHT, PLAN_UP_BEARING } from "./roomData.js";
import { buildAllRooms, getFlatBounds } from "./rooms.js";
import { zones, wallRects, openingRects, wallBounds } from "./walls.js";
import { sunPosition, sunDirection } from "./sun.js";
import { THEMES, DEFAULT_THEME, applyKitchenTheme } from "./kitchen.js";
import { LAYOUTS, DEFAULT_LAYOUT, DESK_WALLS, DEFAULT_DESK_WALL, showDeskWall } from "./yashRoom.js";
import { buildReference, feetInches } from "./reference.js";

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
const hotspotTipEl = document.getElementById("hotspot-tip");
const splashEl = document.getElementById("splash");
const splashStartBtn = document.getElementById("splash-start");
const helpEl = document.getElementById("controls-help");
const helpToggleBtn = document.getElementById("help-toggle");

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
const { ceilingGroup, paints, sliders, kitchenMaterials, yashLayouts } = buildAllRooms(scene);
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
roofSlab.raycast = () => {}; // invisible: must not swallow hotspot clicks
roofSlab.visible = false;
scene.add(roofSlab);

const SUN_STORE = "sunSettings";
const sunState = { on: false, date: new Date().toLocaleDateString("en-CA"), minutes: 16 * 60, planUp: PLAN_UP_BEARING };
try {
  Object.assign(sunState, JSON.parse(localStorage.getItem(SUN_STORE)));
} catch {}

// Evening mood: inside Yash Room the neutral light dims right down, so the
// desk wall's LED strips (yashRoom.js) are what light the room.
const MOOD_STORE = "yashMood";
const MOOD_DIM = 0.3;
let moodOn = true;
try {
  moodOn = localStorage.getItem(MOOD_STORE) !== "0";
} catch {}
let moodActive = false; // on, and standing in Yash Room

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
    const dim = moodActive ? MOOD_DIM : 1;
    ambient.color.set(moodActive ? 0xffe6cc : 0xffffff);
    ambient.intensity = Math.PI * AMBIENT_SHARE * dim;
    scene.environmentIntensity = 0.3 * dim;
    scene.background.copy(NEUTRAL_BACKGROUND).multiplyScalar(dim);
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
  reference.setBearing(sunState.planUp);
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
// Utility sliding door — an Open / Close button while you're in the kitchen
// or the utility. The panel glides across; walking through needs it open.
// ---------------------------------------------------------------------------

const doorPanelEl = document.getElementById("door-panel");
const doorBtn = document.getElementById("door-btn");
const KITCHEN_ROOMS = new Set(["kitchen", "dry_balcony"]);
const DOOR_TIME = 0.9; // seconds to slide fully
const DOORS = [
  { id: "utility_door", label: "utility door", rooms: ["kitchen", "dry_balcony"] },
  { id: "living_balcony_door", label: "balcony door", rooms: ["living_dining", "balcony_living"] },
  { id: "bhagyesh_balcony_door", label: "balcony door", rooms: ["bhagyesh_room", "balcony_bhagyesh"] },
]
  .filter((d) => sliders[d.id])
  .map((d) => ({ ...d, slider: sliders[d.id], t: 0, open: false }));
let door = null; // the one beside the room you're in

/**
 * Room-specific panels: door button inside the kitchen / utility; theme
 * picker there and in the dollhouse; Yash Room layouts there and in the
 * dollhouse. `room` is null in the dollhouse.
 */
function showRoomPanels(room) {
  const inKitchen = room && KITCHEN_ROOMS.has(room.id);
  door = (room && DOORS.find((d) => d.rooms.includes(room.id))) || null;
  doorPanelEl.classList.toggle("hidden", !door);
  showDoorButton();
  themePanelEl.classList.toggle("hidden", !!room && !inKitchen);
  layoutPanelEl.classList.toggle("hidden", !!room && room.id !== "yash_room");
  showVastu();
  moodActive = moodOn && room?.id === "yash_room";
  applyLighting();
}

function showDoorButton() {
  if (door) doorBtn.textContent = `${door.open ? "Close" : "Open"} ${door.label}`;
}

doorBtn.addEventListener("click", () => {
  if (!door) return;
  door.open = !door.open;
  showDoorButton();
});

function updateDoor(dt) {
  for (const d of DOORS) {
    const target = d.open ? 1 : 0;
    if (d.t === target) continue;
    d.t = THREE.MathUtils.clamp(d.t + (Math.sign(target - d.t) * dt) / DOOR_TIME, 0, 1);
    d.slider.set(d.t * d.t * (3 - 2 * d.t)); // ease in and out
  }
}

// ---------------------------------------------------------------------------
// Kitchen theme — one click recolours cabinets, worktop, backsplash, metal
// accents (kitchen.js THEMES) and the kitchen + utility walls. Walls go
// through the wall colour picks, so the Wall colour panel follows and can
// still fine-tune them.
// ---------------------------------------------------------------------------

const THEME_STORE = "kitchenTheme";
const THEME_WALLS = ["kitchen", "dry_balcony"];
const themePanelEl = document.getElementById("theme-panel");
const themeSwatchesEl = document.getElementById("theme-swatches");
const themeNameEl = document.getElementById("theme-name");
const hex = (n) => `#${n.toString(16).padStart(6, "0")}`;

let kitchenTheme = DEFAULT_THEME;
try {
  kitchenTheme = localStorage.getItem(THEME_STORE) ?? DEFAULT_THEME;
} catch {}

const swatches = THEMES.map((t) => {
  const b = document.createElement("button");
  b.className = "theme-swatch";
  b.setAttribute("role", "radio");
  b.title = t.name;
  b.setAttribute("aria-label", t.name);
  for (const part of ["upper", "counter", "base"]) {
    const span = document.createElement("span");
    span.className = part;
    span.style.background = hex(t[part]);
    b.append(span);
  }
  b.addEventListener("click", () => setKitchenTheme(t.id));
  themeSwatchesEl.append(b);
  return b;
});

/** `walls: false` on load, so saved wall colour picks aren't overwritten. */
function setKitchenTheme(id, { walls = true } = {}) {
  const theme = applyKitchenTheme(kitchenMaterials, id);
  kitchenTheme = theme.id;
  if (walls) {
    for (const roomId of THEME_WALLS) {
      paints[roomId].color.set(theme.wall);
      paintPicks[roomId] = hex(theme.wall);
    }
    savePaintPicks();
    showPaint();
  }
  THEMES.forEach((t, i) => swatches[i].setAttribute("aria-checked", String(t.id === theme.id)));
  themeNameEl.replaceChildren(theme.name, Object.assign(document.createElement("small"), { textContent: theme.note }));
  try {
    localStorage.setItem(THEME_STORE, theme.id);
  } catch {}
}
setKitchenTheme(kitchenTheme, { walls: false });

// ---------------------------------------------------------------------------
// Yash Room layout — switch between furniture layouts (yashRoom.js) live.
// ---------------------------------------------------------------------------

const LAYOUT_STORE = "yashLayout";
const layoutPanelEl = document.getElementById("layout-panel");
const layoutOptionsEl = document.getElementById("layout-options");
const layoutNoteEl = document.getElementById("layout-note");
const vastuCardEl = document.getElementById("vastu-card");
const vastuListEl = document.getElementById("vastu-list");

let yashLayout = DEFAULT_LAYOUT;
try {
  yashLayout = localStorage.getItem(LAYOUT_STORE) ?? DEFAULT_LAYOUT;
} catch {}

const layoutButtons = LAYOUTS.map((l) => {
  const b = document.createElement("button");
  b.className = "layout-option";
  b.setAttribute("role", "radio");
  b.textContent = l.name;
  b.addEventListener("click", () => setYashLayout(l.id));
  layoutOptionsEl.append(b);
  return b;
});

function setYashLayout(id) {
  const layout = LAYOUTS.find((l) => l.id === id) ?? LAYOUTS.find((l) => l.id === DEFAULT_LAYOUT);
  yashLayout = layout.id;
  for (const [lid, g] of Object.entries(yashLayouts)) g.visible = lid === layout.id;
  LAYOUTS.forEach((l, i) => layoutButtons[i].setAttribute("aria-checked", String(l.id === layout.id)));
  layoutNoteEl.textContent = layout.note;
  deskWallEl.classList.toggle("hidden", !layout.deskWall);
  vastuListEl.replaceChildren(
    ...(layout.vastu ?? []).map(([what, why]) => {
      const li = document.createElement("li");
      li.append(Object.assign(document.createElement("strong"), { textContent: what }), ` — ${why}`);
      return li;
    })
  );
  showVastu();
  try {
    localStorage.setItem(LAYOUT_STORE, layout.id);
  } catch {}
}
/** Vastu overlay: whenever the layout panel is up and the layout has notes. */
function showVastu() {
  const layout = LAYOUTS.find((l) => l.id === yashLayout);
  vastuCardEl.classList.toggle("hidden", layoutPanelEl.classList.contains("hidden") || !layout?.vastu);
}

// Desk wall — the look of the wall behind the monitors (yashRoom.js
// DESK_WALLS), for layouts that have one. Like a kitchen theme, a look also
// sets the room's wall paint, through the wall colour picks.
const DESK_WALL_STORE = "yashDeskWall";
const deskWallEl = document.getElementById("desk-wall");
const deskWallOptionsEl = document.getElementById("desk-wall-options");
const deskWallNoteEl = document.getElementById("desk-wall-note");

let deskWallLook = DEFAULT_DESK_WALL;
try {
  deskWallLook = localStorage.getItem(DESK_WALL_STORE) ?? DEFAULT_DESK_WALL;
} catch {}

const deskWallButtons = DESK_WALLS.map((look) => {
  const b = document.createElement("button");
  b.className = "layout-option";
  b.setAttribute("role", "radio");
  b.textContent = look.name;
  b.addEventListener("click", () => setDeskWall(look.id));
  deskWallOptionsEl.append(b);
  return b;
});

/** `walls: false` on load, so a saved wall colour pick isn't overwritten. */
function setDeskWall(id, { walls = true } = {}) {
  const look = DESK_WALLS.find((l) => l.id === id) ?? DESK_WALLS.find((l) => l.id === DEFAULT_DESK_WALL);
  deskWallLook = look.id;
  showDeskWall(yashLayouts, look.id);
  if (walls) {
    paints.yash_room.color.set(look.wall);
    paintPicks.yash_room = hex(look.wall);
    savePaintPicks();
    showPaint();
  }
  DESK_WALLS.forEach((l, i) => deskWallButtons[i].setAttribute("aria-checked", String(l.id === look.id)));
  deskWallNoteEl.textContent = look.note;
  try {
    localStorage.setItem(DESK_WALL_STORE, look.id);
  } catch {}
}
setDeskWall(deskWallLook, { walls: false });

setYashLayout(yashLayout);

const moodOnEl = document.getElementById("mood-on");
moodOnEl.checked = moodOn;
moodOnEl.addEventListener("change", () => {
  moodOn = moodOnEl.checked;
  try {
    localStorage.setItem(MOOD_STORE, moodOn ? "1" : "0");
  } catch {}
  showRoomPanels(currentRoom);
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
// Orientation + height references. Dollhouse: N / E / S / W markers around
// the flat and a level staff (reference.js). Everywhere: a compass bottom-left
// that turns with the view, with the bearing you're facing; inside a room it
// also gives eye and ceiling height. All follow the Sun panel's "Plan up".
// ---------------------------------------------------------------------------

const reference = buildReference(scene);
reference.setBearing(sunState.planUp);

const compassRoseEl = document.getElementById("compass-rose");
const compassFacingEl = document.getElementById("compass-facing");
const compassLevelEl = document.getElementById("compass-level");
compassLevelEl.textContent = `Eye ${feetInches(EYE_HEIGHT)} · ceiling ${feetInches(WALL_HEIGHT)}`;

const viewDir = new THREE.Vector3();
let shownHeading = null;

function updateCompass() {
  camera.getWorldDirection(viewDir);
  // Looking straight down there is no forward — the top of the screen stands in
  if (Math.hypot(viewDir.x, viewDir.z) < 1e-3) viewDir.set(0, 1, 0).applyQuaternion(camera.quaternion);
  const planHeading = THREE.MathUtils.radToDeg(Math.atan2(viewDir.x, -viewDir.z)); // clockwise from plan-up
  const heading = Math.round(THREE.MathUtils.euclideanModulo(planHeading + sunState.planUp, 360)) % 360;
  if (heading === shownHeading) return;
  shownHeading = heading;
  compassRoseEl.style.setProperty("--turn", `${-heading}deg`);
  compassFacingEl.textContent = `Facing ${COMPASS[Math.round(heading / 45) % 8]} ${heading}°`;
}

// ---------------------------------------------------------------------------
// Hotspots — one per zone at the zone's centre. In the dollhouse they lie on
// the floor. Inside a room they float at HOTSPOT_RAISED_Y facing you, so you
// can see the rooms visible from where you stand (through doorways, openings,
// glass) and tap one to travel there. Walls hide them like any other object.
// ---------------------------------------------------------------------------

const HOTSPOT_FLOOR_Y = 0.03;
const HOTSPOT_RAISED_Y = 1.05; // ~3'-6", about hand height

const hotspotGroup = new THREE.Group();
scene.add(hotspotGroup);
const hotspots = []; // { room, disc, ring }
let hotspotsRaised = false;

for (const room of hotspotRooms) {
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.3, 32),
    new THREE.MeshBasicMaterial({ color: 0xff5533 })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(room.x, HOTSPOT_FLOOR_Y, room.z);
  disc.userData.roomId = room.id;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.36, 0.44, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(room.x, HOTSPOT_FLOOR_Y + 0.001, room.z);
  ring.userData.roomId = room.id;

  hotspotGroup.add(disc, ring);
  hotspots.push({ room, disc, ring });
}

/** Floor discs for the dollhouse (currentId null), or raised markers inside a room. */
function layoutHotspots(currentId) {
  hotspotsRaised = currentId != null;
  for (const { room, disc, ring } of hotspots) {
    disc.visible = ring.visible = room.id !== currentId;
    disc.position.y = hotspotsRaised ? HOTSPOT_RAISED_Y : HOTSPOT_FLOOR_Y;
    ring.position.y = hotspotsRaised ? HOTSPOT_RAISED_Y : HOTSPOT_FLOOR_Y + 0.001;
    if (!hotspotsRaised) {
      disc.rotation.set(-Math.PI / 2, 0, 0);
      ring.rotation.set(-Math.PI / 2, 0, 0);
      disc.scale.setScalar(1);
      ring.scale.setScalar(1);
    }
  }
}

/**
 * Raised markers always face the camera, and scale with distance so a nearby
 * one doesn't fill the screen while a far one stays tappable.
 */
function faceHotspotsToCamera() {
  if (!hotspotsRaised) return;
  for (const { disc, ring } of hotspots) {
    const s = THREE.MathUtils.clamp(disc.position.distanceTo(camera.position) / 6, 0.25, 1.2);
    for (const m of [disc, ring]) {
      m.quaternion.copy(camera.quaternion);
      m.scale.setScalar(s);
    }
  }
}

// ---------------------------------------------------------------------------
// Mode state: "dollhouse" (orbit overview) <-> "pano" (inside, eye height:
// look around, travel by hotspot, or walk with WASD)
// ---------------------------------------------------------------------------

let mode = "dollhouse";
let panoYaw = 0;
let panoPitch = 0;
let currentRoom = null;

/** Room label, hotspots and colour panel follow the room you're standing in. */
function setCurrentRoom(room) {
  currentRoom = room;
  roomLabelEl.textContent = room.name;
  layoutHotspots(room.id);
  showRoomPanels(room);
  if (paints[room.id]) {
    paintRoomEl.value = room.id;
    showPaint();
  }
}

/** `yaw` = direction to face on arrival; default looks toward the flat's centre. */
function enterPanoMode(room, yaw) {
  mode = "pano";
  orbitControls.enabled = false;
  ceilingGroup.visible = true; // ceiling only exists once you're inside
  reference.group.visible = false;
  compassLevelEl.classList.remove("hidden");
  backBtn.classList.remove("hidden");
  roomLabelEl.classList.remove("hidden");
  setCurrentRoom(room);

  panoYaw = yaw ?? Math.atan2(bounds.centerX - room.x, bounds.centerZ - room.z);
  panoPitch = 0;
}

function exitPanoMode() {
  mode = "transition-out";
  currentRoom = null;
  heldKeys.clear();
  layoutHotspots(null);
  showRoomPanels(null);
  hideHotspotTip();
  ceilingGroup.visible = false;
  reference.group.visible = true;
  compassLevelEl.classList.add("hidden");
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
  applyKitchenTheme(exported.kitchenMaterials, kitchenTheme);
  for (const [id, g] of Object.entries(exported.yashLayouts)) g.visible = id === yashLayout;
  showDeskWall(exported.yashLayouts, deskWallLook);

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

/**
 * Tween the camera to `toPos`. It either stares at `lookAt` the whole way, or,
 * given `turn: { yaw: [from, to], pitch: [from, to] }`, turns smoothly while
 * moving (room-to-room travel).
 */
function animateCameraTo(toPos, lookAt, onDone, { turn = null, duration = 900 } = {}) {
  transitionState = {
    from: camera.position.clone(),
    to: new THREE.Vector3(toPos.x, toPos.y, toPos.z),
    lookAt: lookAt?.clone(),
    turn,
    startTime: performance.now(),
    duration,
    onDone,
  };
}

function updateTransition(now) {
  if (!transitionState) return;
  const t = Math.min(1, (now - transitionState.startTime) / transitionState.duration);
  const eased = 1 - Math.pow(1 - t, 3);

  camera.position.lerpVectors(transitionState.from, transitionState.to, eased);
  const { turn } = transitionState;
  if (turn) {
    panoYaw = THREE.MathUtils.lerp(turn.yaw[0], turn.yaw[1], eased);
    panoPitch = THREE.MathUtils.lerp(turn.pitch[0], turn.pitch[1], eased);
    updatePanoLook();
  } else {
    camera.lookAt(transitionState.lookAt);
  }

  if (t >= 1) {
    const done = transitionState.onDone;
    transitionState = null;
    if (done) done();
  }
}

// ---------------------------------------------------------------------------
// Hotspot picking — dollhouse and pano alike
// ---------------------------------------------------------------------------

const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
let pointerDownPos = null;

function onPointerDown(e) {
  pointerDownPos = { x: e.clientX, y: e.clientY };
}

/** Visible on screen: the object and all its ancestors are visible. */
function isShown(o) {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

/**
 * The room whose hotspot is under the pointer, or null. A hotspot only counts
 * if nothing solid is in front of it — glass is see-through, walls are not.
 */
function hotspotRoomAt(clientX, clientY) {
  pointerNdc.x = (clientX / window.innerWidth) * 2 - 1;
  pointerNdc.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointerNdc, camera);
  for (const { object } of raycaster.intersectObjects(scene.children, true)) {
    if (!isShown(object)) continue;
    if (object.userData.roomId) return rooms.find((r) => r.id === object.userData.roomId) ?? null;
    if (object.material?.transparent) continue; // glass
    return null; // a wall, floor or ceiling is in the way
  }
  return null;
}

function onPointerUp(e) {
  if (!pointerDownPos) return;
  const moved = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
  pointerDownPos = null;
  if (moved > 6) return; // that was a drag (orbit / look around), not a click
  if (mode !== "dollhouse" && mode !== "pano") return;

  const room = hotspotRoomAt(e.clientX, e.clientY);
  if (!room) return;
  hideHotspotTip();

  if (mode === "pano") travelTo(room);
  else goInto(room);
}

/** Dollhouse -> inside a room: fly down to eye height at its centre. */
function goInto(room) {
  mode = "transition-in";
  orbitControls.enabled = false;
  animateCameraTo(
    { x: room.x, y: EYE_HEIGHT, z: room.z },
    new THREE.Vector3(bounds.centerX, EYE_HEIGHT, bounds.centerZ),
    () => enterPanoMode(room)
  );
}

/** Room to room: glide over while turning to face the way you're going. */
function travelTo(room) {
  const from = camera.position;
  const yaw = Math.atan2(room.x - from.x, room.z - from.z);
  // Shortest way round, so the turn is never more than 180 degrees
  const startYaw = yaw + THREE.MathUtils.euclideanModulo(panoYaw - yaw + Math.PI, 2 * Math.PI) - Math.PI;
  mode = "transition-in";
  animateCameraTo({ x: room.x, y: EYE_HEIGHT, z: room.z }, null, () => enterPanoMode(room, yaw), {
    turn: { yaw: [startYaw, yaw], pitch: [panoPitch, 0] },
    duration: 700,
  });
}

// Hover (mouse only): name the room a hotspot leads to, with a pointer cursor
function hideHotspotTip() {
  hotspotTipEl.classList.add("hidden");
  renderer.domElement.style.cursor = "";
}

function onHoverMove(e) {
  const room =
    e.pointerType === "mouse" && !lookDragging && (mode === "dollhouse" || mode === "pano")
      ? hotspotRoomAt(e.clientX, e.clientY)
      : null;
  if (!room) {
    hideHotspotTip();
    return;
  }
  hotspotTipEl.textContent = room.name;
  hotspotTipEl.style.left = `${e.clientX + 14}px`;
  hotspotTipEl.style.top = `${e.clientY + 14}px`;
  hotspotTipEl.classList.remove("hidden");
  renderer.domElement.style.cursor = "pointer";
}

// ---------------------------------------------------------------------------
// Look around: drag (mouse / touch) or arrow keys
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
renderer.domElement.addEventListener("pointermove", (e) => {
  onLookPointerMove(e);
  onHoverMove(e);
});
renderer.domElement.addEventListener("pointerleave", hideHotspotTip);
window.addEventListener("pointerup", (e) => {
  onPointerUp(e);
  lookDragging = false;
});

// ---------------------------------------------------------------------------
// Walk mode — WASD moves you at eye height, arrow keys turn and look up/down.
// Collision uses the same wall model as the plan (walls.js): doorways, bare
// openings and sliding glass doors are passable; walls, windows and any
// opening that leads out of the flat (the main door) are not.
// ---------------------------------------------------------------------------

const WALK_SPEED = 1.4; // m/s, an easy indoor pace
const RUN_FACTOR = 2; // with Shift
const TURN_SPEED = Math.PI / 2; // rad/s — a quarter turn per second
const PITCH_SPEED = Math.PI / 3;
const BODY_RADIUS = 0.2; // keeps the eye a little off the walls
const WALK_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD"]);
const LOOK_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);
const heldKeys = new Set();

const insideRect = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

/** An opening leads nowhere if the far side of it isn't any zone. */
function leadsOutside(o) {
  const far = o.roomSide === 1 ? o.across[0] - 0.05 : o.across[1] + 0.05;
  const mid = (o.along[0] + o.along[1]) / 2;
  const [x, z] = o.horizontal ? [mid, far] : [far, mid];
  return !zones.some((q) => insideRect(q, x, z));
}

const passableOpenings = openingRects.filter(
  (r) => r.opening.type !== "window" && !r.opening.sill && !leadsOutside(r.opening)
);
const blockers = [...wallRects, ...openingRects.filter((r) => !passableOpenings.includes(r))];

/** A sliding door's opening only lets you through once the door is open. */
const shut = (r) => {
  const d = DOORS.find((q) => q.id === r.opening.slide);
  return d && !(d.open && d.t > 0.9);
};

function canStand(x, z) {
  const onFloor =
    zones.some((q) => insideRect(q, x, z)) || passableOpenings.some((r) => !shut(r) && insideRect(r, x, z));
  if (!onFloor) return false;
  return ![...blockers, ...passableOpenings.filter(shut)].some((r) => {
    const dx = Math.max(r.x0 - x, 0, x - r.x1);
    const dz = Math.max(r.z0 - z, 0, z - r.z1);
    return dx * dx + dz * dz < BODY_RADIUS * BODY_RADIUS;
  });
}

/** Zone you're standing in (hotspot zones only); null in a doorway. */
function roomAt(x, z) {
  const zone = zones.find((q) => insideRect(q, x, z) && hotspotRooms.includes(q.room));
  return zone ? zone.room : null;
}

function updateWalk(dt) {
  const held = (code) => (heldKeys.has(code) ? 1 : 0);

  panoYaw += (held("ArrowLeft") - held("ArrowRight")) * TURN_SPEED * dt;
  panoPitch = THREE.MathUtils.clamp(
    panoPitch + (held("ArrowUp") - held("ArrowDown")) * PITCH_SPEED * dt,
    -MAX_PITCH,
    MAX_PITCH
  );

  const ahead = held("KeyW") - held("KeyS");
  const side = held("KeyD") - held("KeyA");
  if (!ahead && !side) return;

  // Forward is where you're facing, flattened; right is forward x up.
  const fx = Math.sin(panoYaw), fz = Math.cos(panoYaw);
  let mx = fx * ahead - fz * side;
  let mz = fz * ahead + fx * side;
  const len = Math.hypot(mx, mz);
  const step = (WALK_SPEED * (heldKeys.has("ShiftLeft") || heldKeys.has("ShiftRight") ? RUN_FACTOR : 1) * dt) / len;
  mx *= step;
  mz *= step;

  // One axis at a time, so you slide along a wall instead of sticking to it
  const p = camera.position;
  if (canStand(p.x + mx, p.z)) p.x += mx;
  if (canStand(p.x, p.z + mz)) p.z += mz;

  const room = roomAt(p.x, p.z);
  if (room && room !== currentRoom) setCurrentRoom(room);
}

// ---------------------------------------------------------------------------
// Keyboard
// ---------------------------------------------------------------------------

const isTyping = (e) => e.target instanceof Element && e.target.closest("input, select, textarea");

window.addEventListener("keydown", (e) => {
  if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;

  if (e.code === "KeyH" || e.key === "?") return toggleHelp();
  if (e.code === "Escape") {
    if (!splashEl.classList.contains("hidden")) return closeSplash();
    if (mode === "pano") return exitPanoMode();
    return;
  }
  if (!WALK_KEYS.has(e.code) && !LOOK_KEYS.has(e.code) && !e.code.startsWith("Shift")) return;

  e.preventDefault();
  if (!splashEl.classList.contains("hidden")) closeSplash();
  // From the dollhouse, W (or any walk key) takes you in through the front door
  if (mode === "dollhouse" && WALK_KEYS.has(e.code)) {
    goInto(rooms.find((r) => r.id === "ent_lobby"));
    return;
  }
  heldKeys.add(e.code);
});

window.addEventListener("keyup", (e) => heldKeys.delete(e.code));
window.addEventListener("blur", () => heldKeys.clear()); // no stuck keys after alt-tab

// ---------------------------------------------------------------------------
// Help: a welcome card on the first visit, then a Controls panel bottom-right
// (H to toggle). Touch devices get touch instructions instead of keys.
// ---------------------------------------------------------------------------

const TOUCH = window.matchMedia("(pointer: coarse)").matches;
const CONTROLS = TOUCH
  ? [
      ["Overview", [["Drag", "Orbit around the flat"], ["Pinch", "Zoom"], ["Tap a hotspot", "Go into that room"]]],
      ["Inside a room", [["Drag", "Look around"], ["Tap a hotspot", "Go to that room"], ["Dollhouse view", "Back to the overview"]]],
    ]
  : [
      ["Overview", [["Drag", "Orbit around the flat"], ["Scroll", "Zoom"], ["Click a hotspot", "Go into that room"], [["W"], "Walk in at the front door"]]],
      ["Inside a room", [
        [["W", "A", "S", "D"], "Walk"],
        [["Shift"], "Walk faster"],
        [["\u2190", "\u2192"], "Turn left / right"],
        [["\u2191", "\u2193"], "Look up / down"],
        ["Drag", "Look around"],
        ["Click a hotspot", "Go to that room"],
        [["Esc"], "Back to the overview"],
      ]],
      ["Any time", [[["H"], "Show or hide these controls"]]],
    ];

function renderControls(el) {
  el.replaceChildren(
    ...CONTROLS.map(([title, rows]) => {
      const section = document.createElement("section");
      const h = document.createElement("h3");
      h.textContent = title;
      const dl = document.createElement("dl");
      for (const [keys, action] of rows) {
        const dt = document.createElement("dt");
        // Keys are arrays (drawn as key caps); gestures are plain text
        for (const k of Array.isArray(keys) ? keys : [keys]) {
          const el = document.createElement(Array.isArray(keys) ? "kbd" : "span");
          el.textContent = k;
          dt.append(el);
        }
        const dd = document.createElement("dd");
        dd.textContent = action;
        dl.append(dt, dd);
      }
      section.append(h, dl);
      return section;
    })
  );
}
renderControls(document.getElementById("splash-controls"));
if (TOUCH) document.getElementById("hint").textContent = "Tap Controls for help";
renderControls(document.getElementById("help-body"));

const INTRO_SEEN = "introSeen";
const HELP_OPEN = "controlsOpen";
const store = {
  get: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};

function setHelpOpen(open) {
  helpEl.classList.toggle("open", open);
  helpToggleBtn.setAttribute("aria-expanded", String(open));
  store.set(HELP_OPEN, open ? "1" : "0");
}
function toggleHelp() {
  if (!splashEl.classList.contains("hidden")) return closeSplash();
  setHelpOpen(!helpEl.classList.contains("open"));
}
function closeSplash() {
  splashEl.classList.add("hidden");
  store.set(INTRO_SEEN, "1");
}

helpToggleBtn.addEventListener("click", toggleHelp);
splashStartBtn.addEventListener("click", closeSplash);
setHelpOpen(store.get(HELP_OPEN) === "1");
if (store.get(INTRO_SEEN) !== "1") {
  splashEl.classList.remove("hidden");
  splashStartBtn.focus();
}

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
  const dt = Math.min(0.05, (now - lastFrame) / 1000); // clamp after a stall
  advanceSun(dt * 1000);
  updateDoor(dt);
  lastFrame = now;

  if (mode === "dollhouse") {
    orbitControls.update();
  } else if (transitionState) {
    updateTransition(now);
  } else if (mode === "pano") {
    updateWalk(dt);
    updatePanoLook();
  }
  faceHotspotsToCamera();
  updateCompass();

  renderer.render(scene, camera);
}
requestAnimationFrame(animate);
