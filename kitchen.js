// ---------------------------------------------------------------------------
// Kitchen + utility joinery, from the designer's elevation sheet
// (KITCHEN-Model.pdf: plan + elevations AA-DD). The sheet carries no
// dimension strings; every number below was read off its vector geometry,
// scaled so the kitchen's drawn length is its 11'-7". Inches throughout.
//
// A run is one wall's worth of joinery:
//   s - along the wall, from the room's north face (the lobby end in the
//       kitchen, the partition in the utility)
//   d - out from the wall face
//   y - up from the floor
//
// "To ceiling" items (lofts, tall units) run up to the model's WALL_HEIGHT.
// The designer drew the ceiling at ~8'-7 1/2"; the model has 10'. To confirm.
// ---------------------------------------------------------------------------

import * as THREE from "three";
import { rooms, WALL_HEIGHT } from "./roomData.js";
import { roomBounds } from "./walls.js";

const IN = 0.0254;
const CEIL = WALL_HEIGHT / IN;

const COUNTER = { top: 32.5, thick: 2.1, depth: 24.4 }; // 2'-8 1/2" platform
const PLINTH = 2; // shutters stop 2" off the floor
const FRONT = 0.75; // shutter thickness
const GAP = 0.08; // half the gap between shutters (~1/8" reveal)

/**
 * The tower beside the fridge has a fluted shutter over the microwave and
 * mixer: 'closed' (DD lower) or 'open' (DD upper, shutter slid away).
 */
export const APPLIANCE_TOWER = "closed";

/**
 * Colour themes — each sets the whole kitchen + utility at once: base
 * shutters, uppers / lofts / tall units, worktop, backsplash, metal accents
 * (glass-profile frames) and wall paint. Drawn from 2026 trend round-ups:
 * two-tone (light uppers over deeper lowers), warm neutrals, woods, and the
 * top Indian modular combinations (white + wood, navy + white, olive + beige).
 */
export const THEMES = [
  { id: "graphite_oak", name: "Graphite & Oak", note: "Matte graphite base, light-oak uppers, white quartz",
    base: 0x4b4d50, upper: 0xc9a47c, counter: 0xe6e3dd, backsplash: 0xd8d2c7, frame: 0x2c2d2f, wall: 0xeae5d9 },
  { id: "white_wood", name: "White & Wood", note: "India's top modular pick: wood-grain base, matte white uppers, black granite",
    base: 0xa87a52, upper: 0xf2efe9, counter: 0x2b2b2d, backsplash: 0xeeebe5, frame: 0x2c2d2f, wall: 0xf3efe7 },
  { id: "navy_white", name: "Navy & White", note: "Deep navy base, crisp white uppers, brass accents",
    base: 0x22314f, upper: 0xf3f2ee, counter: 0xeceae5, backsplash: 0xe4e2dc, frame: 0xb08d4f, wall: 0xf2f0eb },
  { id: "sage_oak", name: "Sage & Oak", note: "Muted sage base, honey-oak uppers, cream splash",
    base: 0x93a184, upper: 0xd3b089, counter: 0xebe6dc, backsplash: 0xe7dfcf, frame: 0x3b3b37, wall: 0xf1ece2 },
  { id: "olive_beige", name: "Olive & Beige", note: "Olive base, warm beige uppers, beige quartz, bronze",
    base: 0x66683a, upper: 0xe2d5bd, counter: 0xdcd2c0, backsplash: 0xd0c4ae, frame: 0x6a5638, wall: 0xefe7d8 },
  { id: "cream_charcoal", name: "Cream & Charcoal", note: "Charcoal base, soft cream uppers, warm white quartz",
    base: 0x3a3b3d, upper: 0xeee5d1, counter: 0xe9e4da, backsplash: 0xe0d9cb, frame: 0x1f1f20, wall: 0xf2ecdf },
  { id: "black_walnut", name: "Black & Walnut", note: "Matte black base, walnut uppers, grey quartz, grey splash",
    base: 0x1f1f21, upper: 0x6f4b33, counter: 0xd6d3cd, backsplash: 0x8e8a84, frame: 0x121212, wall: 0xe8e5df },
  { id: "mushroom", name: "Mushroom & Warm White", note: "Greige-mushroom base, warm white uppers, bronze",
    base: 0xa09284, upper: 0xebe5da, counter: 0xf1ede6, backsplash: 0xd8cec0, frame: 0x6b6055, wall: 0xf0eae0 },
  { id: "forest_brass", name: "Forest Green & Brass", note: "Deep green base, off-white uppers, brass accents",
    base: 0x2f4a3d, upper: 0xf0ebe0, counter: 0xeeeae2, backsplash: 0xe0d9cc, frame: 0xb38b4d, wall: 0xf1ece3 },
];
export const DEFAULT_THEME = THEMES[0].id;
const THEMED = ["base", "upper", "counter", "backsplash", "frame"];

/** Fixed colours, the same in every theme. */
const PALETTE = {
  white: 0xf3f1ec, // lacquer white, mandir
  appliance: 0xdcdddf, // washing machine body
  reveal: 0x222222, // shadow gaps between shutters, plinth
  steel: 0xb8bcc0,
  black: 0x17181a,
  stone: 0xbab2a5, // mandir backdrop
  gold: 0xc9a25e,
};

/** Recolour the kitchen's themed materials in place (walls are the caller's). */
export function applyKitchenTheme(m, id) {
  const theme = THEMES.find((t) => t.id === id) ?? THEMES[0];
  for (const k of THEMED) m[k].color.set(theme[k]);
  return theme;
}

function materials() {
  const std = (color, roughness, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const m = {
    base: std(0xffffff, 0.7),
    upper: std(0xffffff, 0.55),
    white: std(PALETTE.white, 0.4),
    appliance: std(PALETTE.appliance, 0.35),
    reveal: std(PALETTE.reveal, 0.9),
    counter: std(0xffffff, 0.25),
    backsplash: std(0xffffff, 0.3),
    steel: std(PALETTE.steel, 0.3, 0.6),
    black: std(PALETTE.black, 0.2),
    frame: std(0xffffff, 0.4, 0.4),
    stone: std(PALETTE.stone, 0.8),
    gold: std(PALETTE.gold, 0.35, 0.6),
    glass: new THREE.MeshStandardMaterial({ color: 0x9fb2b5, transparent: true, opacity: 0.35, roughness: 0.1, depthWrite: false }),
    fluted: new THREE.MeshStandardMaterial({
      color: 0xe4eae9,
      map: flutedTexture(),
      transparent: true,
      opacity: 0.85,
      roughness: 0.3,
      depthWrite: false,
    }),
    led: new THREE.MeshBasicMaterial({ color: 0xffd9a3 }),
  };
  for (const [k, v] of Object.entries(m)) v.name = `kitchen_${k}`;
  applyKitchenTheme(m, DEFAULT_THEME);
  return m;
}

/** Vertical ribs for fluted glass: light/dark bands, tiled ~3/8" apart. */
function flutedTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 4;
  const ctx = canvas.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 32, 0);
  g.addColorStop(0, "#9aa3a3");
  g.addColorStop(0.5, "#ffffff");
  g.addColorStop(1, "#9aa3a3");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 4);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * A wall run: boxes placed by (s, d, y) ranges in inches against one face of
 * a room. Only east and west runs exist in this kitchen.
 */
function makeRun(group, room, face) {
  const b = roomBounds(room);
  const length = (b.z1 - b.z0) / IN;
  const toX = (d) => (face === "east" ? b.x1 - d * IN : b.x0 + d * IN);
  const toZ = (s) => b.z0 + s * IN;

  function box(s0, s1, d0, d1, y0, y1, mat, name) {
    const [xa, xb] = [toX(d0), toX(d1)].sort((p, q) => p - q);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(xb - xa, (y1 - y0) * IN, (s1 - s0) * IN), mat);
    mesh.position.set((xa + xb) / 2, ((y0 + y1) / 2) * IN, (toZ(s0) + toZ(s1)) / 2);
    mesh.name = `${room.id}_${name}`;
    mesh.castShadow = mesh.receiveShadow = !mat.transparent;
    group.add(mesh);
    return mesh;
  }

  /** Any mesh, positioned at (s, d, y) and turned to face into the room. */
  function place(mesh, s, d, y, name) {
    mesh.position.set(toX(d), y * IN, toZ(s));
    mesh.rotation.y = face === "east" ? -Math.PI / 2 : Math.PI / 2; // +Z -> into the room
    mesh.name = `${room.id}_${name}`;
    group.add(mesh);
    return mesh;
  }

  return { box, place, length, face };
}

// --- Building blocks --------------------------------------------------------

/**
 * Carcass with shutters. `fronts` are [s0, s1, y0, y1] panels; the gaps
 * between them show a dark reveal, so drawers and doors read as separate.
 */
function cabinet(run, m, s0, s1, y0, y1, depth, frontMat, name, fronts = [[s0, s1, y0, y1]]) {
  run.box(s0, s1, 0, depth - FRONT, y0, y1, frontMat, name);
  run.box(s0 + 0.2, s1 - 0.2, depth - FRONT, depth - FRONT + 0.05, y0 + 0.2, y1 - 0.2, m.reveal, `${name}_reveal`);
  for (const [a, b, c, e] of fronts) {
    run.box(a + GAP, b - GAP, depth - FRONT, depth, c + GAP, e - GAP, frontMat, `${name}_front`);
  }
}

/** Base cabinets: recessed plinth, carcass, shutters, worktop above. */
function baseRun(run, m, s0, s1, depth, fronts, name, { counter = true, top = COUNTER.top - COUNTER.thick } = {}) {
  run.box(s0, s1, 0, depth - 2, 0, PLINTH, m.reveal, `${name}_plinth`);
  cabinet(run, m, s0, s1, PLINTH, top, depth, m.base, name, fronts);
  if (counter) run.box(s0, s1, 0, COUNTER.depth, COUNTER.top - COUNTER.thick, COUNTER.top, m.counter, `${name}_counter`);
}

/** Equal columns x rows of shutters over [s0, s1] x [y0, y1]. */
function grid(s0, s1, cols, rows) {
  const out = [];
  for (let i = 0; i < cols.length - 1; i++) {
    for (let j = 0; j < rows.length - 1; j++) out.push([cols[i], cols[i + 1], rows[j], rows[j + 1]]);
  }
  return out;
}

/** Aluminium-profile glass shutter. `glass` is m.glass or m.fluted. */
function glassDoor(run, m, s0, s1, y0, y1, depth, glass, name) {
  const f = 0.8; // profile face
  const [d0, d1] = [depth - FRONT, depth];
  run.box(s0 + GAP, s1 - GAP, d0, d1, y0 + GAP, y0 + f, m.frame, `${name}_frame`);
  run.box(s0 + GAP, s1 - GAP, d0, d1, y1 - f, y1 - GAP, m.frame, `${name}_frame`);
  run.box(s0 + GAP, s0 + f, d0, d1, y0 + f, y1 - f, m.frame, `${name}_frame`);
  run.box(s1 - f, s1 - GAP, d0, d1, y0 + f, y1 - f, m.frame, `${name}_frame`);
  const pane = run.box(s0 + f, s1 - f, d0 + 0.3, d0 + 0.45, y0 + f, y1 - f, glass, `${name}_glass`);
  if (glass.map) {
    // Ribs ~3/8" apart, whatever the door size (geometry UVs span 0..1)
    const uv = pane.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * ((s1 - s0) / 0.375));
  }
}

/** Open box: two sides, back, bottom, top — for niches and open shelves. */
function openBox(run, m, s0, s1, y0, y1, depth, mat, name) {
  const t = 0.75;
  run.box(s0, s0 + t, 0, depth, y0, y1, mat, `${name}_side`);
  run.box(s1 - t, s1, 0, depth, y0, y1, mat, `${name}_side`);
  run.box(s0, s1, 0, 0.5, y0, y1, mat, `${name}_back`);
  run.box(s0, s1, 0, depth, y0, y0 + t, mat, `${name}_bottom`);
  run.box(s0, s1, 0, depth, y1 - t, y1, mat, `${name}_top`);
}

/** Flush stainless sink with a basin inset and a pillar tap at the back. */
function sink(run, m, s0, s1, d0, d1, name) {
  const y = COUNTER.top;
  run.box(s0, s1, d0, d1, y - 0.05, y + 0.06, m.steel, `${name}_rim`);
  run.box(s0 + 1.5, s1 - 1.5, d0 + 1.5, d1 - 1.5, y - 0.05, y + 0.08, m.reveal, `${name}_basin`);
  const sMid = (s0 + s1) / 2;
  run.box(sMid - 0.6, sMid + 0.6, d0 - 1.6, d0 - 0.4, y, y + 12, m.steel, `${name}_tap`);
  run.box(sMid - 0.5, sMid + 0.5, d0 - 1.6, d0 + 7, y + 11, y + 12, m.steel, `${name}_spout`);
}

// --- Kitchen ----------------------------------------------------------------

/** Elevation BB — east wall: hob, chimney, sink, glass-profile wall units. */
function kitchenEast(run, m) {
  const R = "east";
  baseRun(run, m, 0, 139, 23.4, [
    ...grid(0, 28.3, [0, 28.3], [PLINTH, 16.5, 30.1]),
    ...grid(28.3, 95.2, [28.3, 61.8, 95.2], [PLINTH, 16.5, 24.8, 30.1]), // drawers under the hob
    [95.2, 105.3, PLINTH, 30.1], // pull-out
    [105.3, 122.1, PLINTH, 30.1], // sink doors
    [122.1, 139, PLINTH, 30.1],
  ], `${R}_base`);
  run.box(0, 139, 0, 0.3, COUNTER.top, 62.9, m.backsplash, `${R}_backsplash`);

  // Hob: black glass, four burners
  run.box(50.4, 73.2, 2.4, 21.4, COUNTER.top, COUNTER.top + 0.35, m.black, "hob");
  for (const s of [56, 67.6]) {
    for (const d of [7, 16.8]) {
      const burner = new THREE.Mesh(new THREE.CylinderGeometry(1.8 * IN, 2 * IN, 0.5 * IN, 24), m.reveal);
      run.place(burner, s, d, COUNTER.top + 0.6, "hob_burner");
    }
  }
  sink(run, m, 105.3, 131.6, 2.0, 22.3, "sink");

  // Wall units, 13.2" deep: plain, glass-profile pair flanking the chimney, plain
  const W = 13.2;
  cabinet(run, m, 0, 17.7, 62.9, 86.8, W, m.upper, `${R}_wall`);
  for (const [s0, s1] of [[17.7, 37.5], [86.2, 106.9]]) {
    run.box(s0, s1, 0, W - FRONT, 56.5, 72, m.upper, `${R}_glass_unit`);
    glassDoor(run, m, s0, s1, 56.5, 72, W, m.glass, `${R}_glass_profile`);
    cabinet(run, m, s0, s1, 72, 86.8, W, m.upper, `${R}_wall`);
  }
  cabinet(run, m, 106.9, 139, 62.9, 86.8, W, m.upper, `${R}_wall`, grid(106.9, 139, [106.9, 122.9, 139], [62.9, 86.8]));

  // Chimney hood + duct
  run.box(46.6, 77.1, 0, 19.7, 63.6, 65.7, m.black, "chimney_hood");
  run.box(55.7, 67.9, 0, 9.5, 65.7, 86.8, m.steel, "chimney_duct");

  // Loft, wall cabinets to ceiling (elevation AA)
  cabinet(run, m, 0, 139, 86.8, CEIL, W, m.upper, `${R}_loft`, grid(0, 139, [0, 34.75, 69.5, 104.25, 139], [86.8, CEIL]));
}

/** Elevation DD — west wall: mandir, drawers, open shelf + niche + fluted glass, appliance tower, fridge. */
function kitchenWest(run, m) {
  const R = "west";

  // Mandir (north end): drawer base, slab, carved arch backdrop, lotus, frame
  const M0 = 0, M1 = 39.1, MD = 15.8;
  baseRun(run, m, M0, M1, MD, [
    [M0, M1, PLINTH, 13.7],
    ...grid(M0, M1, [M0, 19.55, M1], [13.7, 22.9, 31.5]),
  ], "mandir_base", { counter: false, top: 31.5 });
  run.box(M0, M1, 0, MD + 1, 31.5, COUNTER.top, m.counter, "mandir_slab");
  run.box(M0, M0 + 1, 0, MD, COUNTER.top, 85.7, m.white, "mandir_post");
  run.box(M1 - 1, M1, 0, MD, COUNTER.top, 85.7, m.white, "mandir_post");
  run.box(M0, M1, 0, MD, 84.2, 86.6, m.white, "mandir_header");
  const arch = new THREE.Mesh(new THREE.ShapeGeometry(cuspedArch(33 * IN, 30 * IN, 15 * IN), 24), m.stone);
  run.place(arch, (M0 + M1) / 2, 0.6, 37.5, "mandir_arch");
  for (const [s, y, r] of [[19.55, 72, 3.6], [11.6, 62, 2.4], [27.5, 62, 2.4]]) {
    run.box(s - 0.25, s + 0.25, 0.7, 1.2, 40, y, m.gold, "mandir_lotus_stem");
    const lotus = new THREE.Mesh(new THREE.CircleGeometry(r * IN, 8), m.gold);
    run.place(lotus, s, 1.3, y, "mandir_lotus");
  }

  // Drawer bank + worktop
  baseRun(run, m, 39.1, 83.5, 23.8, grid(39.1, 83.5, [39.1, 61.3, 83.5], [PLINTH, 11.2, 20.6, 30.1]), `${R}_drawers`, { counter: false });
  // Appliance tower: baskets below the worktop
  baseRun(run, m, 83.5, 107.8, 23.8, grid(83.5, 107.8, [83.5, 107.8], [PLINTH, 11.4, 20.8, 30.1]), `${R}_baskets`, { counter: false });
  run.box(39.1, 107.8, 0, COUNTER.depth, COUNTER.top - COUNTER.thick, COUNTER.top, m.counter, `${R}_counter`);

  // Above the drawers: open backsplash with LED, niche, fluted-glass wall unit
  run.box(39.1, 83.5, 0, 0.3, COUNTER.top, 52.8, m.backsplash, `${R}_backsplash`);
  openBox(run, m, 39.1, 83.5, 52.8, 62.9, 13.2, m.upper, `${R}_niche`);
  run.box(39.6, 83, 11.5, 12.5, 52.5, 52.8, m.led, `${R}_led`);
  run.box(39.1, 83.5, 0, 13.2 - FRONT, 62.9, 86.6, m.upper, `${R}_fluted_unit`);
  glassDoor(run, m, 39.1, 61.3, 62.9, 85.7, 13.2, m.fluted, `${R}_fluted_glass`);
  glassDoor(run, m, 61.3, 83.5, 62.9, 85.7, 13.2, m.fluted, `${R}_fluted_glass`);

  // Appliance tower above the worktop
  const T0 = 83.5, T1 = 107.8, TD = 23.8, top = 86.6;
  run.box(T0, T0 + 0.75, 0, TD, COUNTER.top, top, m.upper, "tower_side");
  run.box(T1 - 0.75, T1, 0, TD, COUNTER.top, top, m.upper, "tower_side");
  run.box(T0, T1, 0, TD, top - 0.75, top, m.upper, "tower_top");
  run.box(T0, T1, 0, 0.5, COUNTER.top, top, m.upper, "tower_back");
  if (APPLIANCE_TOWER === "open") {
    run.box(T0, T1, 0, TD - 1, 48.7, 49.7, m.upper, "tower_shelf");
    run.box(T0, T1, 0, TD - 1, 66.5, 67.5, m.upper, "tower_shelf");
    run.box(98, 105.6, 4, 14, COUNTER.top, 45.7, m.black, "mixer");
    run.box(86.4, 105.6, 2, 17, 49.7, 61.9, m.black, "microwave");
    run.box(87.5, 100, 17, 17.2, 51, 60.5, m.reveal, "microwave_door");
    cabinet(run, m, T0, T1, 67.5, top - 0.75, TD, m.upper, "tower_cupboard");
  } else {
    // Fluted shutter: horizontal ribs, 1.54" pitch, over the whole opening
    run.box(T0 + GAP, T1 - GAP, TD - FRONT, TD - 0.3, 33.4, top - GAP, m.reveal, "tower_shutter");
    for (let y = 33.4 + 0.5; y < top - 1; y += 1.54) {
      run.box(T0 + 0.4, T1 - 0.4, TD - 0.3, TD, y, y + 0.9, m.upper, "tower_flute");
    }
  }

  // Fridge, against the utility partition
  run.box(109.5, 136.4, 0, 28, 0, 71, m.steel, "fridge");
  run.box(109.6, 136.3, 27.95, 28.05, 49.9, 50.2, m.reveal, "fridge_split");
  run.box(110.5, 111.5, 28, 29.5, 52, 64, m.steel, "fridge_handle");
  run.box(110.5, 111.5, 28, 29.5, 30, 46, m.steel, "fridge_handle");
}

/**
 * Cusped (jharokha-style) arch outline, origin at the bottom centre, in
 * metres: straight sides of height `rise`, then a semicircular head of
 * scallops, peaking at `rise + head`.
 */
function cuspedArch(width, rise, head) {
  const shape = new THREE.Shape();
  const w = width / 2;
  shape.moveTo(-w, 0);
  shape.lineTo(-w, rise);
  const lobes = 7;
  for (let i = 1; i <= lobes; i++) {
    const a = Math.PI - (i / lobes) * Math.PI;
    const p = [w * Math.cos(a), rise + head * Math.sin(a)];
    const am = Math.PI - ((i - 0.5) / lobes) * Math.PI;
    const bulge = 1.18; // scallops bow outward
    shape.quadraticCurveTo(w * bulge * Math.cos(am), rise + head * bulge * Math.sin(am), p[0], p[1]);
  }
  shape.lineTo(w, 0);
  shape.lineTo(-w, 0);
  return shape;
}

// --- Utility (dry balcony) -------------------------------------------------------

/** Elevation BB right bay — east wall: worktop, sink, wall units, loft. */
function utilityEast(run, m) {
  const L = run.length, split = 24.2;
  baseRun(run, m, 0, L, 23.4, [[0, split, PLINTH, 30.1], [split, L, PLINTH, 30.1]], "u_east_base");
  run.box(0, L, 0, 0.3, COUNTER.top, 62.9, m.backsplash, "u_backsplash");
  sink(run, m, 2.0, 28.5, 2.0, 20.3, "u_sink");
  cabinet(run, m, 0, L, 62.9, 86.8, 13.2, m.upper, "u_wall", grid(0, L, [0, split, L], [62.9, 86.8]));
  cabinet(run, m, 0, L, 86.8, CEIL, 13.2, m.upper, "u_loft", grid(0, L, [0, split, L], [86.8, CEIL]));
}

/** Elevation DD left bay / CC — west wall: washing machine bay, open shelf, niche, cupboards, tall unit. */
function utilityWest(run, m) {
  const L = run.length, D = 24, C = 34.5; // C: where the tall column starts
  // Washing machine bay under a shelf, then open shelf, niche, cupboards to ceiling
  run.box(0, 0.75, 0, D, 0, CEIL, m.upper, "u_side");
  run.box(C - 0.75, C, 0, D, 0, CEIL, m.upper, "u_side");
  run.box(0, C, 0, 0.5, 0, CEIL, m.white, "u_back"); // shows through the open shelf + niche
  run.box(0.75, C - 0.75, 0, D, 36.6, 38.5, m.upper, "u_shelf");
  run.box(0.75, C - 0.75, 0, D, 58.8, 59.8, m.upper, "u_shelf");
  run.box(0.75, C - 0.75, 0, D - FRONT, 68, 69, m.upper, "u_shelf");
  cabinet(run, m, 0.75, C - 0.75, 69, CEIL, D, m.upper, "u_cupboard", grid(0.75, C - 0.75, [0.75, 17.2, C - 0.75], [69, CEIL]));
  // Front-load washing machine
  run.box(5, 29, 0.5, 23, 0, 33, m.appliance, "washing_machine");
  const door = new THREE.Mesh(new THREE.CircleGeometry(6.5 * IN, 32), m.reveal);
  run.place(door, 17, 23.05, 17, "washing_machine_door");
  // Tall storage column, floor to ceiling
  cabinet(run, m, C, L, PLINTH, CEIL, D, m.upper, "u_tall");
  run.box(C, L, 0, D - 2, 0, PLINTH, m.reveal, "u_tall_plinth");
}

// --- Ceiling: lights + fan (plan) ------------------------------------------------

function ceilingFixtures(kitchen, utility) {
  const group = new THREE.Group();
  group.name = "kitchen_ceiling_fixtures";
  const lamp = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const fanMat = new THREE.MeshStandardMaterial({ color: 0xf2f0ec, roughness: 0.5 });
  const kb = roomBounds(kitchen), ub = roomBounds(utility);
  const disc = (x, z) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.06, 24), lamp);
    m.rotation.x = Math.PI / 2;
    m.position.set(x, WALL_HEIGHT - 0.003, z);
    m.name = "kitchen_downlight";
    group.add(m);
  };
  const kx = (kb.x0 + kb.x1) / 2;
  disc(kx, kb.z0 + 20.8 * IN);
  disc(kx, kb.z0 + 112.3 * IN);
  disc((ub.x0 + ub.x1) / 2, ub.z0 + 22.7 * IN);

  // Ceiling fan, ~28" sweep as drawn, on a 12" downrod
  const fz = kb.z0 + 69.4 * IN, hubY = WALL_HEIGHT - 12 * IN;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 12 * IN, 8), fanMat);
  rod.position.set(kx, WALL_HEIGHT - 6 * IN, fz);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.07, 24), fanMat);
  hub.position.set(kx, hubY, fz);
  group.add(rod, hub);
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(12 * IN, 0.006, 3.5 * IN), fanMat);
    const a = (i * 2 * Math.PI) / 3;
    blade.position.set(kx + Math.cos(a) * 8 * IN, hubY, fz + Math.sin(a) * 8 * IN);
    blade.rotation.y = -a;
    group.add(blade);
  }
  group.traverse((o) => o.name || (o.name = "kitchen_fan"));
  return group;
}

/**
 * All kitchen + utility joinery. Returns { group, ceiling, materials } —
 * ceiling fixtures go with the other ceilings (hidden in the dollhouse);
 * `materials` is what applyKitchenTheme() recolours.
 */
export function buildKitchen() {
  const kitchen = rooms.find((r) => r.id === "kitchen");
  const utility = rooms.find((r) => r.id === "dry_balcony");
  const group = new THREE.Group();
  group.name = "kitchen_joinery";
  const m = materials();

  kitchenEast(makeRun(group, kitchen, "east"), m);
  kitchenWest(makeRun(group, kitchen, "west"), m);
  utilityEast(makeRun(group, utility, "east"), m);
  utilityWest(makeRun(group, utility, "west"), m);

  return { group, ceiling: ceilingFixtures(kitchen, utility), materials: m };
}
