// ---------------------------------------------------------------------------
// Yash Room furniture layouts — true-size, switchable live. Wardrobe, bed
// and desk are planning blocks; the desk kit (monitor, PC, MacBook, keyboard,
// mouse) and the chair are real models from models/, scaled to true size.
//
// Room-local inches: x east from the glass (west) wall, z south from the
// north wall. The room is 133" x 120" (11'-1" x 10'-0"). Keep clear: the
// north-east corner (passage door swing, x > 97, z < 40) and the toilet door
// on the north wall (x 77-107).
// ---------------------------------------------------------------------------

import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { rooms, WALL_HEIGHT } from "./roomData.js";
import { roomBounds } from "./walls.js";

RectAreaLightUniformsLib.init(); // the LED strips are RectAreaLights

const IN = 0.0254;
const CEIL = WALL_HEIGHT / IN;

/**
 * wardrobe: x, z, w (along its wall), d (depth), wall it backs onto
 * bed:      x, z, w (east-west extent), l (north-south extent), head side, size label
 * desk:     list of tops { x, z, w, l } + the wall the monitors back onto;
 *           monitors = how many 27" screens, centred on `centre` (x; default
 *           the middle of the first top), on their stands or, with `arm`, on
 *           a monitor arm; finish 'walnut' = walnut top on black legs + desk
 *           mat; pc { x, z } = tower on the desk (its west / north corner);
 *           laptop { x, z, facing } = open MacBook, centred there, `facing`
 *           being the way you look when using it
 * chair:    x, z, facing ('north' | 'south' | ...)
 * deskWall: true = the north wall behind the desk gets the DESK_WALLS looks
 * rug:      x, z, w, l
 */
export const LAYOUTS = [
  {
    id: "balanced",
    name: "1 · Balanced",
    note: "L-desk 6' + 3' return NW (face north), 6' wardrobe south wall, 4'6\" bed headboard-south",
    // Coder first's L-desk in the same north-west spot, so you work facing
    // north; the 6' wardrobe swaps to the south wall beside the headboard.
    wardrobe: { x: 0, z: 96, w: 72, d: 24, wall: "south" },
    bed: { x: 75, z: 41, w: 58, l: 79, head: "south", pillows: 2 },
    // Owner's kit (2026-10-10): one monitor on an arm, a tower PC, and a
    // MacBook used on its own — so it gets the return, facing the glass.
    desk: {
      tops: [{ x: 0, z: 0, w: 72, l: 30 }, { x: 0, z: 30, w: 30, l: 36 }],
      wall: "north",
      monitors: 1,
      centre: 44, // in line with the chair
      arm: true,
      finish: "walnut",
      pc: { x: 62.6, z: 5 },
      laptop: { x: 13, z: 47, facing: "west" },
    },
    chair: { x: 44, z: 46, facing: "north" },
    deskWall: true,
    rug: { x: 8, z: 26, w: 64, l: 66 },
    // Shown as an on-screen overlay while this layout is selected.
    vastu: [
      ["Bed", "head to the south, Vastu's recommended sleeping direction"],
      ["Desk", "you face north while working, the direction for focus and career"],
      ["Wardrobe", "heavy storage on the south wall, where Vastu wants the weight"],
    ],
  },
  {
    id: "designer",
    name: "1b · Designer's",
    note: "6' wardrobe, 4'6\" bed along the south wall, 4' desk",
    wardrobe: { x: 0, z: 0, w: 72, d: 24, wall: "north" },
    bed: { x: 54, z: 62, w: 79, l: 58, head: "east", pillows: 2 },
    desk: { tops: [{ x: 0, z: 90, w: 48, l: 30 }], wall: "south", monitors: 1 },
    chair: { x: 24, z: 72, facing: "south" },
  },
  {
    id: "coder",
    name: "2 · Coder first",
    note: "L-desk 6' + 3' return, 3'6\" bed along the south wall, 4' wardrobe + loft",
    wardrobe: { x: 0, z: 96, w: 50, d: 24, wall: "south" },
    bed: { x: 54, z: 74, w: 79, l: 46, head: "east", pillows: 1 },
    desk: { tops: [{ x: 0, z: 0, w: 72, l: 30 }, { x: 0, z: 30, w: 30, l: 36 }], wall: "north", monitors: 2 },
    chair: { x: 44, z: 46, facing: "north" },
  },
];
export const DEFAULT_LAYOUT = "balanced";

/**
 * Looks for the monitor wall — the north wall from the glass to the toilet
 * door — switchable live in any layout with `deskWall`. All three chase the
 * owner's reference photos (dark wall, walnut, warm glow; 2026-10-10) at a
 * different balance, checked against 2026 home-office round-ups: one dark
 * wall behind the desk with the rest light, one main slat wall, or deep
 * colour on every wall; warm-white rather than amber behind a screen you
 * work at all day.
 *   wall    - paint for the room's walls (set through the wall colour picks)
 *   board   - colour of the wall behind the desk; null = the room's paint
 *   slat, shelf - wood colours
 *   panels  - slat panels { x, w, top } on black felt, from above the skirting
 *   shelves - { x, w, y, lamp: x of a globe lamp }
 *   led, power - strip colour and brightness (1 = the reference's glow).
 *             Strips run under every shelf and behind the desk, plus
 *             `corner` (up the corner by the glass) / `cove` (along the ceiling)
 */
export const DESK_WALLS = [
  {
    id: "charcoal",
    name: "A · Charcoal & amber",
    note: "Closest to your photos. Black wall, two walnut slat panels, staggered shelves, amber LEDs. Other walls warm oat.",
    wall: 0xd8d1c6,
    board: 0x1d1e21,
    slat: 0x8a5630,
    shelf: 0x9a6a3c,
    panels: [{ x: 4, w: 24, top: 84 }, { x: 34, w: 40, top: 62 }],
    shelves: [{ x: 0, w: 32, y: 86 }, { x: 31, w: 45, y: 64, lamp: 66 }],
    led: 0xff9040,
    power: 1,
    corner: true,
  },
  {
    id: "slat",
    name: "B · Walnut slat wall",
    note: "Warmest. Walnut slats wall to wall, floor to ceiling, one long black shelf, warm-white light from a ceiling cove. Other walls warm oat.",
    wall: 0xd8d1c6,
    board: 0x0d0d0e,
    slat: 0x8a5630,
    shelf: 0x1b1c1e,
    panels: [{ x: 0.5, w: 76, top: 117 }],
    shelves: [{ x: 6, w: 66, y: 66, lamp: 62 }],
    led: 0xffb070,
    power: 0.8,
    cove: true,
  },
  {
    id: "teal",
    name: "C · Teal study",
    note: "Calmest, least to build. Your deep teal on every wall, one slat panel behind the monitors, two walnut shelves, soft warm-white LEDs.",
    wall: 0x22596d,
    board: null,
    slat: 0x8a5630,
    shelf: 0x9a6a3c,
    panels: [{ x: 10, w: 52, top: 60 }],
    shelves: [{ x: 4, w: 68, y: 62, lamp: 64 }, { x: 40, w: 32, y: 86 }],
    led: 0xffb070,
    power: 0.7,
  },
];
export const DEFAULT_DESK_WALL = "charcoal";
const DESK_WALL_SPAN = [0, 77]; // x, width — stops at the toilet door

const WARDROBE_H = 84; // 7'-0", loft above to the ceiling
const DESK_H = 29;
const RUG_H = 0.5;
const FACING = { north: 0, south: Math.PI, east: -Math.PI / 2, west: Math.PI / 2 }; // yaw from facing north
const LAMP_COLOR = 0xffc98a;

function materials() {
  const std = (color, roughness, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  return {
    white: std(0xf1efea, 0.45), // wardrobe shutters, desk
    gap: std(0x2a2a2a, 0.9), // shutter joints
    walnut: std(0x6b4a33, 0.6), // bed frame + headboard
    linen: std(0xf4f3ef, 0.9), // mattress / duvet
    pillow: std(0x9c9aa3, 0.9),
    black: std(0x1b1c1e, 0.5),
    screen: new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.15, emissive: 0x1c0f08 }), // on, dimly
    steel: std(0x9a9da1, 0.35, 0.6),
    arm: std(0x2a2b2e, 0.4, 0.6), // monitor arm
    // Walnut desk + desk wall
    walnutTop: std(0x7a4a2b, 0.5),
    felt: std(0x0d0d0e, 1.0), // backing the slats sit on
    rug: std(0x25262a, 1.0),
    lamp: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: LAMP_COLOR, emissiveIntensity: 1.5 }),
  };
}

/** Builds every layout into its own group; show one at a time. */
export function buildYashLayouts() {
  const room = rooms.find((r) => r.id === "yash_room");
  const b = roomBounds(room);
  const m = materials();
  const groups = {};

  for (const layout of LAYOUTS) {
    const g = new THREE.Group();
    g.name = `yash_layout_${layout.id}`;
    // Axis-aligned box from room-local inch ranges
    const boxInto = (parent) => (x0, x1, y0, y1, z0, z1, mat, name) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry((x1 - x0) * IN, (y1 - y0) * IN, (z1 - z0) * IN), mat);
      mesh.position.set(b.x0 + ((x0 + x1) / 2) * IN, ((y0 + y1) / 2) * IN, b.z0 + ((z0 + z1) / 2) * IN);
      mesh.name = name;
      mesh.castShadow = mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const box = boxInto(g);
    wardrobe(box, m, layout.wardrobe);
    bed(box, m, layout.bed);
    desk(g, b, box, m, layout.desk);
    chair(g, b, m, layout.chair, layout.rug ? RUG_H : 0);
    for (const look of layout.deskWall ? DESK_WALLS : []) {
      const lg = new THREE.Group();
      lg.name = `desk_wall_${look.id}`;
      lg.userData.deskWall = look.id;
      lg.visible = look.id === DEFAULT_DESK_WALL;
      deskWall(lg, b, boxInto(lg), m, look);
      g.add(lg);
    }
    if (layout.rug) {
      const r = layout.rug;
      box(r.x, r.x + r.w, 0, RUG_H, r.z, r.z + r.l, m.rug, "rug").castShadow = false;
    }
    g.visible = false;
    groups[layout.id] = g;
  }
  return groups;
}

// --- Pieces -------------------------------------------------------------------

/** Sliding wardrobe to 7', loft above to the ceiling, shutter joints showing. */
function wardrobe(box, m, { x, z, w, d, wall }) {
  const front = wall === "north" ? z + d : z; // face pointing into the room
  const dir = wall === "north" ? 1 : -1;
  box(x, x + w, 0, CEIL, z, z + d, m.white, "wardrobe");
  const joint = (y0, y1, x0, x1) => box(x0, x1, y0, y1, Math.min(front, front + dir * 0.1), Math.max(front, front + dir * 0.1), m.gap, "wardrobe_joint");
  const panels = Math.max(2, Math.round(w / 24));
  for (let i = 1; i < panels; i++) {
    const at = x + (w * i) / panels;
    joint(1, WARDROBE_H, at - 0.1, at + 0.1);
    joint(WARDROBE_H + 1, CEIL - 1, at - 0.1, at + 0.1);
  }
  joint(WARDROBE_H - 0.1, WARDROBE_H + 0.1, x + 0.5, x + w - 0.5); // loft line
  // Recessed pull on each sliding shutter
  for (let i = 0; i < panels; i++) {
    const at = x + (w * (i + 0.5)) / panels;
    joint(36, 48, at - 0.4, at + 0.4);
  }
}

/** Walnut frame + headboard, linen mattress, pillows at the head. */
function bed(box, m, { x, z, w, l, head, pillows }) {
  const [x1, z1] = [x + w, z + l];
  box(x, x1, 0, 11, z, z1, m.walnut, "bed_frame");
  box(x + 1, x1 - 1, 11, 19, z + 1, z1 - 1, m.linen, "mattress");
  // Headboard, 3" thick, to 3'-6"
  if (head === "east") box(x1 - 3, x1, 0, 42, z, z1, m.walnut, "headboard");
  if (head === "south") box(x, x1, 0, 42, z1 - 3, z1, m.walnut, "headboard");
  // Pillows, 26" x 16" x 5"
  const across = head === "east" ? [z, z1] : [x, x1];
  const span = across[1] - across[0];
  for (let i = 0; i < pillows; i++) {
    const c = across[0] + (span * (i + 0.5)) / pillows;
    if (head === "east") box(x1 - 21, x1 - 5, 19, 24, c - 13, c + 13, m.pillow, "pillow");
    else box(c - 13, c + 13, 19, 24, z1 - 21, z1 - 5, m.pillow, "pillow");
  }
}

// ---------------------------------------------------------------------------
// Real models (models/*.glb; sources and credits in models/CREDITS.md). Each
// is loaded once, scaled to its true size and dropped where its planning
// block stands; the block shows until the model arrives, and stays if the
// file can't be loaded.
//   fit   - [axis, inches]: one of the model's own axes and its real size on it
//   yaw   - turns the model to how someone facing north uses it
//   tweak - per-model fixes, run once on the loaded scene
// ---------------------------------------------------------------------------

const PC = { w: 8.35, d: 15.55, h: 17.3 }; // Fractal Meshify C: 212 x 395 x 440 mm
const MACBOOK = { w: 14.0, d: 9.8 }; // MacBook Pro 16"
const MONITOR_ARM = { lift: 6, out: 4.2 }; // screen bottom above the desk; panel centre in front of the block plane

const GRAPHITE = 0x222326;
const MODELS = {
  monitor: { file: "monitor.glb", fit: ["x", 24.1], yaw: 0, tweak: monitorScreen }, // 27"
  monitor_arm: { file: "monitor.glb", fit: ["x", 24.1], yaw: 0, tweak: (s) => (stripMonitorStand(s), monitorScreen(s)) },
  pc: { file: "pc.glb", fit: ["y", PC.h], yaw: -Math.PI / 2 }, // Fractal Meshify C, glass side to your left
  chair: { file: "chair.glb", fit: ["y", 42], yaw: Math.PI / 2, tweak: (s) => darken(s, GRAPHITE) },
  keyboard: { file: "keyboard.glb", fit: ["x", 17.5], yaw: 0 },
  mouse: { file: "mouse.glb", fit: ["z", 4.9], yaw: 0, tweak: (s) => darken(s, GRAPHITE) },
  macbook: { file: "macbook.glb", fit: ["x", MACBOOK.w], yaw: 0, tweak: macbookScreen }, // Pro 16"
};

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const sources = new Map(); // model key -> Promise of its tweaked scene

function source(key) {
  if (!sources.has(key)) {
    const { file, tweak } = MODELS[key];
    const url = new URL(`./models/${file}`, import.meta.url).href;
    sources.set(key, loader.loadAsync(url).then(({ scene }) => (tweak?.(scene), scene)));
  }
  return sources.get(key);
}

/**
 * Puts model `key` into `parent`, centred on (x, z) with its underside at y
 * (room-local inches), turned `yaw` from north-facing use. `blocks` — the
 * planning blocks standing in for it — are hidden once it is in.
 */
function place(parent, b, key, { x, y, z, yaw = 0 }, blocks = []) {
  const def = MODELS[key];
  source(key)
    .then((src) => {
      const model = src.clone(true);
      model.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = o.receiveShadow = true;
        o.raycast = () => {}; // dense meshes: keep them out of hotspot picking
      });
      const [axis, inches] = def.fit;
      const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
      const holder = new THREE.Group();
      holder.name = key;
      holder.add(model);
      holder.scale.setScalar((inches * IN) / size[axis]);
      holder.rotation.y = def.yaw + yaw;
      const box = new THREE.Box3().setFromObject(holder);
      const c = box.getCenter(new THREE.Vector3());
      holder.position.set(b.x0 + x * IN - c.x, y * IN - box.min.y, b.z0 + z * IN - c.z);
      parent.add(holder);
      for (const block of blocks) block.visible = false;
    })
    .catch((e) => console.warn(`models/${def.file} did not load — keeping the block`, e));
}

/** Repaints a model's light, untextured parts. */
function darken(scene, color) {
  scene.traverse((o) => {
    if (o.isMesh && !o.material.map && o.material.color.r > 0.5) o.material.color.set(color);
  });
}

// monitor.glb is Z-up, screen facing -Y, in cm at ~21" (scaled up by `fit`).
// Its panel starts at z 10.15; base and neck sit below and behind it.

/** A lit wallpaper on the monitor's screen recess. */
function monitorScreen(scene) {
  const canvas = document.createElement("canvas");
  [canvas.width, canvas.height] = [512, 288];
  const ctx = canvas.getContext("2d");
  const sky = ctx.createLinearGradient(0, 0, 0, 288);
  sky.addColorStop(0, "#141a33");
  sky.addColorStop(0.45, "#7a3b2e");
  sky.addColorStop(0.7, "#f08a3c");
  sky.addColorStop(1, "#f6b25e");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 512, 288);
  for (const [color, y0, c1, c2, y1] of [["#3a2230", 200, 150, 170, 215], ["#17131c", 250, 160, 240, 190]]) {
    ctx.fillStyle = color; // dunes
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.bezierCurveTo(170, c1, 340, c2, 512, y1);
    ctx.lineTo(512, 288);
    ctx.lineTo(0, 288);
    ctx.fill();
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(45.9, 24.9),
    new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.25, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.85 })
  );
  screen.name = "screen";
  screen.rotation.x = Math.PI / 2; // faces -Y
  screen.position.set(-0.15, -5.74, 24.05);
  scene.getObjectByProperty("isMesh", true).parent.add(screen);
}

/** Cuts the base and neck off, leaving the panel for a monitor arm. */
function stripMonitorStand(scene) {
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const p = o.geometry.attributes.position;
    const stand = (i) => p.getZ(i) < 9.9 || (Math.abs(p.getX(i)) < 3.6 && p.getZ(i) < 23 && p.getY(i) > -4.7);
    const index = o.geometry.index;
    const keep = [];
    for (let t = 0; t < index.count; t += 3) {
      const tri = [index.getX(t), index.getX(t + 1), index.getX(t + 2)];
      if (!tri.every(stand)) keep.push(...tri);
    }
    o.geometry.setIndex(keep);
    o.geometry = o.geometry.toNonIndexed(); // drops the stand's vertices too, so bounds are the panel's
  });
}

/** MacBook: screen lit, and plain glass instead of a transmission pass. */
function macbookScreen(scene) {
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const mat = o.material;
    if (mat.transmission) Object.assign(mat, { transmission: 0, transparent: true, opacity: 0.06 });
    if (mat.name === "Steel_-_Satin") Object.assign(mat, { emissiveMap: mat.map, emissiveIntensity: 0.8 }).emissive.set(0xffffff);
  });
}

/**
 * Desk top(s) on slim legs; monitors at the wall (on stands or an arm),
 * keyboard and mouse in front; optionally a tower PC and an open MacBook.
 */
function desk(g, b, box, m, { tops, wall, monitors, centre, arm, finish, pc, laptop }) {
  const walnut = finish === "walnut";
  const [topMat, legMat] = walnut ? [m.walnutTop, m.black] : [m.white, m.white];
  for (const t of tops) {
    box(t.x, t.x + t.w, DESK_H - 1, DESK_H, t.z, t.z + t.l, topMat, "desk_top");
    const inset = 2;
    for (const [lx, lz] of [[t.x + inset, t.z + inset], [t.x + t.w - inset, t.z + inset], [t.x + inset, t.z + t.l - inset], [t.x + t.w - inset, t.z + t.l - inset]]) {
      box(lx - 0.75, lx + 0.75, 0, DESK_H - 1, lz - 0.75, lz + 0.75, legMat, "desk_leg");
    }
  }
  // Monitors (27", 16:9 = 23.5" x 13.2") on the first top, at the wall
  const t = tops[0];
  const back = wall === "north" ? t.z + 4 : t.z + t.l - 4; // block's panel plane, 4" off the wall
  const toward = wall === "north" ? 1 : -1; // into the room
  const yaw = wall === "north" ? 0 : Math.PI; // you face the wall
  const width = 23.5, gap = 0.5;
  const total = monitors * width + (monitors - 1) * gap;
  const mid = centre ?? t.x + Math.min(t.w, 72) / 2;
  const start = mid - total / 2;
  // z range from the monitor plane: `a` inches behind it to `c` in front
  const depth = (a, c) => [Math.min(back - toward * a, back + toward * c), Math.max(back - toward * a, back + toward * c)];
  const lift = arm ? MONITOR_ARM.lift : 5; // desk to the bottom of the screen
  for (let i = 0; i < monitors; i++) {
    const x0 = start + i * (width + gap);
    const cx = x0 + width / 2;
    const blocks = [
      box(x0, x0 + width, DESK_H + lift, DESK_H + lift + 13.2, ...depth(0, 1), m.black, "monitor"),
      box(x0 + 0.4, x0 + width - 0.4, DESK_H + lift + 0.4, DESK_H + lift + 12.8, ...depth(-1.05, 1.1), m.screen, "monitor_screen"),
    ];
    if (arm) {
      monitorArm(g, b, m, cx, back + toward * MONITOR_ARM.out, toward);
      place(g, b, "monitor_arm", { x: cx, y: DESK_H + lift, z: back + toward * MONITOR_ARM.out, yaw }, blocks);
    } else {
      blocks.push(
        box(cx - 1, cx + 1, DESK_H, DESK_H + 8, ...depth(2, 0), m.steel, "monitor_stand"),
        box(cx - 4, cx + 4, DESK_H, DESK_H + 0.4, ...depth(2, 3), m.steel, "monitor_foot")
      );
      place(g, b, "monitor", { x: cx, y: DESK_H, z: back + toward * 3, yaw }, blocks);
    }
  }
  // Keyboard + mouse in front, on a desk mat if the desk is walnut
  const kz = back + toward * 12;
  const mat = walnut ? 0.12 : 0;
  if (walnut) box(mid - 18, mid + 18, DESK_H, DESK_H + mat, ...depth(-8, 24), m.black, "desk_mat");
  const keyboard = box(mid - 8.5, mid + 8.5, DESK_H, DESK_H + 0.8, Math.min(kz, kz + toward * 5), Math.max(kz, kz + toward * 5), m.black, "keyboard");
  const mx = mid + toward * 12.25; // on your right
  const mouse = box(mx - 1.25, mx + 1.25, DESK_H, DESK_H + 1.2, Math.min(kz + toward, kz + toward * 5), Math.max(kz + toward, kz + toward * 5), m.black, "mouse");
  place(g, b, "keyboard", { x: mid, y: DESK_H + mat, z: kz + toward * 2.5, yaw }, [keyboard]);
  place(g, b, "mouse", { x: mx, y: DESK_H + mat, z: kz + toward * 3, yaw }, [mouse]);

  if (pc) {
    const block = box(pc.x, pc.x + PC.w, DESK_H, DESK_H + PC.h, pc.z, pc.z + PC.d, m.black, "pc");
    place(g, b, "pc", { x: pc.x + PC.w / 2, y: DESK_H, z: pc.z + PC.d / 2, yaw }, [block]);
  }
  if (laptop) {
    const { x, z, facing } = laptop;
    const ew = facing === "east" || facing === "west"; // which way its width runs
    const [hx, hz] = ew ? [MACBOOK.d / 2, MACBOOK.w / 2] : [MACBOOK.w / 2, MACBOOK.d / 2];
    const block = box(x - hx, x + hx, DESK_H, DESK_H + 0.7, z - hz, z + hz, m.steel, "macbook");
    place(g, b, "macbook", { x, y: DESK_H, z, yaw: FACING[facing] }, [block]);
  }
}

/**
 * Single monitor arm behind the screen: grommet base on the desk, pole, two
 * links and a VESA plate. `z` is the panel's mid-depth, `toward` +1 if the
 * room is to the south of the desk's wall.
 */
function monitorArm(g, b, m, x, z, toward) {
  const arm = new THREE.Group();
  arm.name = "monitor_arm";
  const at = (px, py, pz) => new THREE.Vector3(b.x0 + px * IN, py * IN, b.z0 + pz * IN);
  const add = (geo, pos) => {
    const mesh = new THREE.Mesh(geo, m.arm);
    mesh.position.copy(pos);
    mesh.castShadow = true;
    arm.add(mesh);
    return mesh;
  };
  const post = (px, py0, py1, pz, r) => add(new THREE.CylinderGeometry(r * IN, r * IN, (py1 - py0) * IN, 20), at(px, (py0 + py1) / 2, pz));
  const link = (from, to) => {
    const d = to.clone().sub(from);
    const mesh = add(new THREE.BoxGeometry(1.1 * IN, d.length(), 1.6 * IN), from.clone().add(to).multiplyScalar(0.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  };

  const px = x + 8; // pole: off to one side, near the back edge of the desk
  const pz = z - toward * 4.6;
  const vesa = [x, DESK_H + MONITOR_ARM.lift + 6.85, z - toward * 1.6]; // back of the panel, mid height
  const shoulder = [px, DESK_H + 9, pz];
  const elbow = [px + 5.5, DESK_H + 9.8, pz + toward * 1.4];
  const wrist = [x, vesa[1], vesa[2] - toward * 1.4];

  post(px, DESK_H, DESK_H + 0.5, pz, 2.3); // grommet base
  post(px, DESK_H, DESK_H + 10, pz, 0.75); // pole
  for (const [jx, jy, jz] of [shoulder, elbow]) post(jx, jy - 0.9, jy + 0.9, jz, 1.0);
  link(at(...shoulder), at(...elbow));
  link(at(...elbow), at(...wrist));
  link(at(...wrist), at(x, vesa[1], z)); // through the plate, into the back of the panel
  add(new THREE.BoxGeometry(4.6 * IN, 4.6 * IN, 0.4 * IN), at(...vesa)); // VESA plate
  g.add(arm);
}

const SLAT = { w: 1.0, gap: 0.6, d: 0.8 }; // inches
const WALL_BOARD = 0.6; // painted board, proud of the skirting
const SHELF = { d: 8, t: 1.2 };
const LED_TILT = 0.45; // strips aim ~25 degrees in towards the wall

/**
 * One monitor-wall look, on the north wall: the wall board, walnut slat
 * panels on black felt, floating shelves, and LED strips — under each shelf
 * and behind the desk, plus the corner / cove if the look asks. Each strip is
 * a glowing bar plus a RectAreaLight that actually washes the wall.
 */
function deskWall(g, b, box, m, look) {
  const [x, w] = DESK_WALL_SPAN;
  const std = (color, roughness) => new THREE.MeshStandardMaterial({ color, roughness });
  const slatMat = std(look.slat, 0.55);
  const shelfMat = std(look.shelf, 0.5);
  const ledMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: look.led, emissiveIntensity: 2.5 });

  const base = look.board == null ? 0 : WALL_BOARD; // what everything is fixed to
  if (base) box(x, x + w, 0, CEIL, 0, base, std(look.board, 0.9), "desk_wall");

  const front = base + 0.4; // face of the felt
  for (const p of look.panels) {
    box(p.x, p.x + p.w, 4, p.top, base, front, m.felt, "slat_backing");
    const n = Math.floor((p.w + SLAT.gap) / (SLAT.w + SLAT.gap));
    const first = p.x + (p.w - (n * SLAT.w + (n - 1) * SLAT.gap)) / 2;
    for (let i = 0; i < n; i++) {
      const x0 = first + i * (SLAT.w + SLAT.gap);
      box(x0, x0 + SLAT.w, 4, p.top, front, front + SLAT.d, slatMat, "slat");
    }
  }

  // Room-local inches in, a light aimed by `rot` out (default faces north)
  const strip = (width, height, lx, ly, lz, rot, intensity) => {
    const light = new THREE.RectAreaLight(look.led, intensity * look.power, width * IN, height * IN);
    light.position.set(b.x0 + lx * IN, ly * IN, b.z0 + lz * IN);
    light.rotation.set(rot.x ?? 0, rot.y ?? 0, 0);
    light.name = "led_strip";
    g.add(light);
  };
  // A strip along the wall at height `y`, `out` inches off it, shining down
  const down = (x0, x1, y, out, name) => {
    box(x0, x1, y - 0.3, y, out - 0.25, out + 0.25, ledMat, name);
    strip(x1 - x0, 3, (x0 + x1) / 2, y - 0.4, out, { x: -Math.PI / 2 + LED_TILT }, 11);
  };

  for (const s of look.shelves) {
    box(s.x, s.x + s.w, s.y, s.y + SHELF.t, base, base + SHELF.d, shelfMat, "shelf");
    down(s.x + 1, s.x + s.w - 1, s.y, base + SHELF.d - 0.75, "led"); // under the front edge
    if (s.lamp == null) continue;
    const globe = new THREE.Mesh(new THREE.SphereGeometry(4.5 * IN, 32, 16), m.lamp);
    globe.scale.y = 0.8;
    globe.position.set(b.x0 + s.lamp * IN, (s.y + SHELF.t + 3.6) * IN, b.z0 + (base + SHELF.d / 2) * IN);
    globe.name = "globe_lamp";
    const glow = new THREE.PointLight(LAMP_COLOR, 0.6, 3, 2);
    glow.position.copy(globe.position);
    g.add(globe, glow);
  }

  if (look.corner) {
    // Up the corner by the glass wall, floor to ceiling
    box(x + 0.3, x + 0.8, 0, CEIL, base, base + 0.5, ledMat, "led_corner");
    strip(3, CEIL, x + 1.5, CEIL / 2, base + 2.5, { y: -Math.PI / 2 + LED_TILT }, 6);
  }
  if (look.cove) down(x + 2, x + w - 2, CEIL - 0.5, base + 4, "led_cove"); // along the ceiling

  // Along the back of the desk, shining up behind the monitors
  box(x + 4, x + w - 4, DESK_H, DESK_H + 0.3, front + SLAT.d, front + SLAT.d + 0.5, ledMat, "led_desk");
  strip(w - 8, 3, x + w / 2, DESK_H + 0.5, 5, { x: Math.PI / 2 - LED_TILT }, 11);
}

/** Shows one desk-wall look (in every layout that has a desk wall). */
export function showDeskWall(groups, id) {
  for (const g of Object.values(groups)) {
    for (const c of g.children) if (c.userData.deskWall) c.visible = c.userData.deskWall === id;
  }
}

/** Office chair. The block: five-star base, gas column, seat, backrest away from the desk. */
function chair(g, b, m, { x, z, facing }, floor) {
  const c = new THREE.Group();
  c.name = "chair";
  const part = (geo, mat, px, py, pz) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(px * IN, py * IN, pz * IN);
    mesh.castShadow = true;
    c.add(mesh);
    return mesh;
  };
  for (let i = 0; i < 5; i++) {
    const leg = part(new THREE.BoxGeometry(12 * IN, 1.2 * IN, 1.5 * IN), m.black, 0, 2.5, 0);
    const a = (i * 2 * Math.PI) / 5;
    leg.rotation.y = a;
    leg.position.set(Math.cos(a) * 6 * IN, 2.5 * IN, -Math.sin(a) * 6 * IN);
  }
  part(new THREE.CylinderGeometry(1 * IN, 1 * IN, 14 * IN, 12), m.steel, 0, 10, 0);
  part(new THREE.BoxGeometry(19 * IN, 3 * IN, 19 * IN), m.black, 0, 18.5, 0);
  // Built facing -Z (north); backrest on the +Z side
  part(new THREE.BoxGeometry(18 * IN, 24 * IN, 2.5 * IN), m.black, 0, 33, 9);
  c.rotation.y = FACING[facing];
  c.position.set(b.x0 + x * IN, floor * IN, b.z0 + z * IN);
  g.add(c);
  place(g, b, "chair", { x, y: floor, z, yaw: FACING[facing] }, [c]);
}
