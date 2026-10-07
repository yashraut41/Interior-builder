import * as THREE from "three";
import { rooms, WALL_HEIGHT, DOOR_HEIGHT } from "./roomData.js";
import { wallRects, openingRects, openings, roomBounds, isWalled } from "./walls.js";
import { buildKitchen } from "./kitchen.js";
import { buildYashLayouts } from "./yashRoom.js";

const FLOOR_COLOR = 0xcdc2ad;
const OPEN_FLOOR_COLOR = 0xbdb199;
const OUTDOOR_FLOOR_COLOR = 0xa8a294;
const WALL_COLOR = 0xeae5d9;
const CEILING_COLOR = 0xf2efe8;

const PAINT_OFFSET = 0.002; // finish sits just proud of the wall face
const SKIRTING_HEIGHT = 0.1; // ~4"
const SKIRTING_DEPTH = 0.012;

/** Rotation (about Y) that turns a default +Z-facing plane into the room. */
const FACE_ROTATION = { north: 0, south: Math.PI, west: Math.PI / 2, east: -Math.PI / 2 };

function wallBox(material, r, y0, y1, name) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(r.x1 - r.x0, y1 - y0, r.z1 - r.z0),
    material
  );
  mesh.position.set((r.x0 + r.x1) / 2, (y0 + y1) / 2, (r.z0 + r.z1) / 2);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Aluminium glazing profiles
const FRAME = 0.05; // outer frame / transom / mullion face width
const FRAME_DEPTH = 0.07;
const SASH = 0.04; // sliding sash stile / rail face width
const SASH_DEPTH = 0.025;
const SASH_OVERLAP = 0.05; // interlock where the two sashes meet
const GLASS = 0.006;

/**
 * Floor-to-ceiling aluminium window in an opening with a `frame`: outer
 * frame + transom; two fixed panes (split by a mullion) below the transom,
 * two sliding sashes on separate tracks above it.
 */
function buildGlazing(o, frameMat, glassMat) {
  const group = new THREE.Group();
  group.name = `glazing_${o.room.id}_${o.side}`;
  const [s, e] = o.along;
  const mid = (o.across[0] + o.across[1]) / 2; // centred in the wall
  const top = o.height;
  const split = o.frame.transom;
  const um = (s + e) / 2;

  // u = along the wall, y = up, w = through the wall
  const box = (u0, u1, y0, y1, w0, w1, mat, name) => {
    const [du, dy, dw] = [u1 - u0, y1 - y0, w1 - w0];
    const mesh = new THREE.Mesh(
      o.horizontal ? new THREE.BoxGeometry(du, dy, dw) : new THREE.BoxGeometry(dw, dy, du),
      mat
    );
    const [u, y, w] = [(u0 + u1) / 2, (y0 + y1) / 2, (w0 + w1) / 2];
    if (o.horizontal) mesh.position.set(u, y, w);
    else mesh.position.set(w, y, u);
    mesh.name = name;
    mesh.castShadow = mat === frameMat;
    group.add(mesh);
  };

  // Outer frame + transom
  const [d0, d1] = [mid - FRAME_DEPTH / 2, mid + FRAME_DEPTH / 2];
  box(s, e, 0, FRAME, d0, d1, frameMat, "sill");
  box(s, e, top - FRAME, top, d0, d1, frameMat, "head");
  box(s, s + FRAME, FRAME, top - FRAME, d0, d1, frameMat, "jamb");
  box(e - FRAME, e, FRAME, top - FRAME, d0, d1, frameMat, "jamb");
  box(s + FRAME, e - FRAME, split - FRAME / 2, split + FRAME / 2, d0, d1, frameMat, "transom");

  // Lower: fixed glass, split by a mullion
  box(um - FRAME / 2, um + FRAME / 2, FRAME, split - FRAME / 2, d0, d1, frameMat, "mullion");
  box(s + FRAME, e - FRAME, FRAME, split - FRAME / 2, mid - GLASS / 2, mid + GLASS / 2, glassMat, "fixed_glass");

  // Upper: two sliding sashes, one per track, overlapping at the centre
  const [y0, y1] = [split + FRAME / 2, top - FRAME];
  const sashes = [
    [s + FRAME, um + SASH_OVERLAP / 2, mid - FRAME_DEPTH / 4],
    [um - SASH_OVERLAP / 2, e - FRAME, mid + FRAME_DEPTH / 4],
  ];
  for (const [u0, u1, w] of sashes) {
    const [w0, w1] = [w - SASH_DEPTH / 2, w + SASH_DEPTH / 2];
    box(u0, u1, y0, y0 + SASH, w0, w1, frameMat, "sash_rail");
    box(u0, u1, y1 - SASH, y1, w0, w1, frameMat, "sash_rail");
    box(u0, u0 + SASH, y0 + SASH, y1 - SASH, w0, w1, frameMat, "sash_stile");
    box(u1 - SASH, u1, y0 + SASH, y1 - SASH, w0, w1, frameMat, "sash_stile");
    box(u0 + SASH, u1 - SASH, y0 + SASH, y1 - SASH, w - GLASS / 2, w + GLASS / 2, glassMat, "sash_glass");
  }
  return group;
}

/**
 * All walls of the flat, from walls.js. Walls are shared between rooms, so
 * they are built once for the whole flat rather than per room. No door or
 * window mesh is ever created — an opening is missing wall, with a lintel
 * above if it stops short of the ceiling, and floor across the threshold.
 */
function buildWalls() {
  const group = new THREE.Group();
  group.name = "walls";
  const wallMaterial = new THREE.MeshStandardMaterial({ color: WALL_COLOR, roughness: 0.95 });
  const thresholdMaterial = new THREE.MeshStandardMaterial({ color: FLOOR_COLOR, roughness: 0.9 });

  wallMaterial.name = "wall";
  thresholdMaterial.name = "threshold";
  wallRects.forEach((r, i) => group.add(wallBox(wallMaterial, r, 0, WALL_HEIGHT, `wall_${i}`)));

  openingRects.forEach((r, i) => {
    const tag = `${r.opening.room.id}_${r.opening.side}_${r.opening.type}`;
    if (r.opening.height < WALL_HEIGHT - 0.001) {
      group.add(wallBox(wallMaterial, r, r.opening.height, WALL_HEIGHT, `lintel_${tag}_${i}`));
    }
    if (r.opening.sill > 0) {
      group.add(wallBox(wallMaterial, r, 0, r.opening.sill, `parapet_${tag}_${i}`));
      return; // half wall, not a way through: no threshold
    }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0), thresholdMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2);
    floor.name = `threshold_${tag}_${i}`;
    floor.receiveShadow = true;
    group.add(floor);
  });

  const frameMat = new THREE.MeshStandardMaterial({ color: 0xc3c6c9, metalness: 0.25, roughness: 0.35 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xd6e8ea,
    transparent: true,
    opacity: 0.18,
    roughness: 0.05,
    depthWrite: false,
  });
  frameMat.name = "aluminium";
  glassMat.name = "glass";
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x2a2b2d, metalness: 0.6, roughness: 0.4 });
  metalMat.name = "metal";
  const sliders = {};
  for (const o of openings) {
    if (o.orphan) continue;
    if (o.frame) group.add(buildGlazing(o, frameMat, glassMat));
    if (o.type === "railing") group.add(buildRailing(o, metalMat));
    if (o.slide) {
      const door = buildSlidingDoor(o);
      group.add(door.group);
      sliders[o.slide] = door;
    }
  }

  return { group, sliders };
}

// Railing on a half wall: a slim rod "floating" above it on vertical rods
const RAIL_RISE = 0.25; // rod sits ~10" above the half wall
const RAIL_R = 0.019;
const POST_R = 0.008;
const POST_PITCH = 0.6; // ~2' between supports

function buildRailing(o, metalMat) {
  const group = new THREE.Group();
  group.name = `railing_${o.room.id}_${o.side}`;
  const [s, e] = o.along;
  const mid = (o.across[0] + o.across[1]) / 2;
  const at = (u, y, mesh) => {
    if (o.horizontal) mesh.position.set(u, y, mid);
    else mesh.position.set(mid, y, u);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };
  const top = o.sill + RAIL_RISE;
  const rod = at((s + e) / 2, top, new THREE.Mesh(new THREE.CylinderGeometry(RAIL_R, RAIL_R, e - s, 16), metalMat));
  if (o.horizontal) rod.rotation.z = Math.PI / 2;
  else rod.rotation.x = Math.PI / 2;
  rod.name = "rail";
  const n = Math.max(2, Math.round((e - s) / POST_PITCH) + 1);
  for (let k = 0; k < n; k++) {
    const u = s + 0.05 + ((e - s - 0.1) * k) / (n - 1);
    at(u, o.sill + RAIL_RISE / 2, new THREE.Mesh(new THREE.CylinderGeometry(POST_R, POST_R, RAIL_RISE, 10), metalMat)).name = "rail_post";
  }
  return group;
}

// Sliding door: two frosted panels on two tracks below a fixed frosted
// transom at door height. The panel at the `e` end slides over the other.
const SD_FRAME = 0.04;
const SD_DEPTH = 0.07;
const SD_STILE = 0.05;
const SD_OVERLAP = 0.05;

function buildSlidingDoor(o) {
  const group = new THREE.Group();
  group.name = `sliding_door_${o.slide}`;
  const frame = new THREE.MeshStandardMaterial({ color: 0x2c2d2f, metalness: 0.4, roughness: 0.4 });
  const frosted = new THREE.MeshStandardMaterial({
    color: 0xf2f5f5,
    transparent: true,
    opacity: 0.6,
    roughness: 0.7,
    depthWrite: false,
  });
  frame.name = "door_frame";
  frosted.name = "frosted_glass";
  const [s, e] = o.along;
  const mid = (o.across[0] + o.across[1]) / 2;

  // u = along the wall, w = through it
  const box = (parent, u0, u1, y0, y1, w0, w1, mat, name) => {
    const [du, dy, dw] = [u1 - u0, y1 - y0, w1 - w0];
    const mesh = new THREE.Mesh(o.horizontal ? new THREE.BoxGeometry(du, dy, dw) : new THREE.BoxGeometry(dw, dy, du), mat);
    const [u, y, w] = [(u0 + u1) / 2, (y0 + y1) / 2, (w0 + w1) / 2];
    if (o.horizontal) mesh.position.set(u, y, w);
    else mesh.position.set(w, y, u);
    mesh.name = name;
    mesh.castShadow = mat === frame;
    parent.add(mesh);
  };

  // Outer frame, transom bar, floor track, fixed transom glass
  const [d0, d1] = [mid - SD_DEPTH / 2, mid + SD_DEPTH / 2];
  box(group, s, s + SD_FRAME, 0, WALL_HEIGHT, d0, d1, frame, "jamb");
  box(group, e - SD_FRAME, e, 0, WALL_HEIGHT, d0, d1, frame, "jamb");
  box(group, s, e, WALL_HEIGHT - SD_FRAME, WALL_HEIGHT, d0, d1, frame, "head");
  box(group, s, e, DOOR_HEIGHT - SD_FRAME / 2, DOOR_HEIGHT + SD_FRAME / 2, d0, d1, frame, "transom");
  box(group, s, e, 0, 0.012, d0, d1, frame, "track");
  box(group, s + SD_FRAME, e - SD_FRAME, DOOR_HEIGHT + SD_FRAME / 2, WALL_HEIGHT - SD_FRAME, mid - 0.003, mid + 0.003, frosted, "transom_glass");

  // Panels
  const inner = e - s - 2 * SD_FRAME;
  const pw = inner / 2 + SD_OVERLAP / 2;
  const [y0, y1] = [0.012, DOOR_HEIGHT - SD_FRAME / 2];
  const panel = (u0, w, name) => {
    const g = new THREE.Group();
    g.name = name;
    const [p0, p1] = [w - 0.012, w + 0.012];
    box(g, u0, u0 + pw, y0, y0 + SD_STILE, p0, p1, frame, "rail");
    box(g, u0, u0 + pw, y1 - SD_STILE, y1, p0, p1, frame, "rail");
    box(g, u0, u0 + SD_STILE, y0 + SD_STILE, y1 - SD_STILE, p0, p1, frame, "stile");
    box(g, u0 + pw - SD_STILE, u0 + pw, y0 + SD_STILE, y1 - SD_STILE, p0, p1, frame, "stile");
    box(g, u0 + SD_STILE, u0 + pw - SD_STILE, y0 + SD_STILE, y1 - SD_STILE, w - 0.003, w + 0.003, frosted, "glass");
    group.add(g);
    return g;
  };
  panel(s + SD_FRAME, mid - 0.018, "fixed_panel");
  const moving = panel(e - SD_FRAME - pw, mid + 0.018, "sliding_panel");
  // Pull handle on the leading edge, both faces
  const hu = e - SD_FRAME - pw + SD_STILE / 2;
  box(moving, hu - 0.012, hu + 0.012, 0.9, 1.2, mid + 0.018 - 0.04, mid + 0.018 + 0.04, frame, "handle");

  const travel = -(pw - SD_OVERLAP); // slides toward `s`, over the fixed panel
  const offset = o.horizontal ? new THREE.Vector3(travel, 0, 0) : new THREE.Vector3(0, 0, travel);
  /** 0 = shut, 1 = open */
  const set = (t) => moving.position.copy(offset).multiplyScalar(t);
  return { group, set, opening: o };
}

function floorColorFor(kind) {
  if (kind === "open") return OPEN_FLOOR_COLOR;
  if (kind === "outdoor") return OUTDOOR_FLOOR_COLOR;
  return FLOOR_COLOR;
}

// ---------------------------------------------------------------------------
// Room finishes — paint, skirting, carpet. Applied to one room's inner faces
// only, so shared partitions keep their other side untouched.
// ---------------------------------------------------------------------------

/** Gaps [start, end, top, sill] in one inner face, from any opening on that line. */
function holesOnFace(b, side) {
  const horizontal = side === "north" || side === "south";
  const face = { north: b.z0, south: b.z1, west: b.x0, east: b.x1 }[side];
  const [lo, hi] = horizontal ? [b.x0, b.x1] : [b.z0, b.z1];
  return openings
    .filter((o) => !o.orphan && o.horizontal === horizontal)
    .filter((o) => o.across[0] <= face + 1e-4 && o.across[1] >= face - 1e-4)
    .map((o) => [Math.max(lo, o.along[0]), Math.min(hi, o.along[1]), o.height, o.sill])
    .filter(([s, e]) => e - s > 1e-4)
    .sort((p, q) => p[0] - q[0]);
}

/** Pieces of solid face [start, end, y0, y1] left around the holes. */
function faceSpans(lo, hi, holes) {
  const spans = [];
  let cur = lo;
  for (const [s, e, top, sill] of holes) {
    if (s > cur) spans.push([cur, s, 0, WALL_HEIGHT]);
    if (sill > 0) spans.push([s, e, 0, sill]); // half wall below a railing
    if (top < WALL_HEIGHT - 1e-4) spans.push([s, e, top, WALL_HEIGHT]);
    cur = Math.max(cur, e);
  }
  if (hi > cur) spans.push([cur, hi, 0, WALL_HEIGHT]);
  return spans;
}

/** Places a +Z-facing mesh on a room face, `inset` metres into the room. */
function placeOnFace(mesh, b, side, along, y, inset) {
  const horizontal = side === "north" || side === "south";
  const face = { north: b.z0 + inset, south: b.z1 - inset, west: b.x0 + inset, east: b.x1 - inset }[side];
  mesh.rotation.y = FACE_ROTATION[side];
  if (horizontal) mesh.position.set(along, y, face);
  else mesh.position.set(face, y, along);
  return mesh;
}

/** Procedural carpet: fine per-pixel noise, tiled. Doubles as its bump map. */
function carpetTexture(room, color) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(size, size);
  const base = new THREE.Color(color);
  const [r, g, b] = [base.r, base.g, base.b].map((c) => c * 255);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 46;
    img.data[i] = r + n;
    img.data[i + 1] = g + n;
    img.data[i + 2] = b + n;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(room.width / 0.5, room.depth / 0.5);
  tex.anisotropy = 8;
  return tex;
}

function floorMaterial(room) {
  const f = room.finish;
  if (f?.floor === "carpet") {
    const map = carpetTexture(room, f.floorColor);
    return new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 1.5, roughness: 1.0 });
  }
  return new THREE.MeshStandardMaterial({ color: f?.floorColor ?? floorColorFor(room.kind), roughness: 0.9 });
}

/**
 * Paint on every inner face of a walled zone, plus skirting if it has a
 * finish. Unfinished zones get paint in the neutral wall colour, so the live
 * wall colour controls have a material to recolour in every room.
 */
function buildFinish(room) {
  const group = new THREE.Group();
  group.name = `${room.id}_finish`;
  const b = roomBounds(room);
  const paint = new THREE.MeshStandardMaterial({ color: room.finish?.wall ?? WALL_COLOR, roughness: 0.92 });
  const skirting = room.finish && new THREE.MeshStandardMaterial({ color: room.finish.skirting ?? 0xffffff, roughness: 0.5 });
  paint.name = `${room.id}_paint`;
  if (skirting) skirting.name = `${room.id}_skirting`;

  for (const side of ["north", "south", "west", "east"]) {
    const horizontal = side === "north" || side === "south";
    const [lo, hi] = horizontal ? [b.x0, b.x1] : [b.z0, b.z1];
    for (const [s, e, y0, y1] of faceSpans(lo, hi, holesOnFace(b, side))) {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(e - s, y1 - y0), paint);
      panel.name = `${room.id}_paint_${side}`;
      panel.receiveShadow = true;
      group.add(placeOnFace(panel, b, side, (s + e) / 2, (y0 + y1) / 2, PAINT_OFFSET));

      if (!skirting || y0 > 0) continue; // unfinished, or lintel over an opening
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(e - s, SKIRTING_HEIGHT, SKIRTING_DEPTH), skirting);
      skirt.name = `${room.id}_skirting_${side}`;
      group.add(placeOnFace(skirt, b, side, (s + e) / 2, SKIRTING_HEIGHT / 2, PAINT_OFFSET + SKIRTING_DEPTH / 2));
    }
  }
  return { group, paint };
}

// TV feature wall
const INCH = 0.0254;
const BACKING = 0.012; // board the flutes sit on
const SLAT = { width: 0.025, gap: 0.012, depth: 0.018 }; // ~1" flutes
const CONSOLE = { maxLength: 72 * INCH, depth: 14 * INCH, height: 14 * INCH, lift: 8 * INCH };
const TV_CENTRE = 42 * INCH; // seated eye height
const TV_DEPTH = 0.025;
const TV_MOUNT_GAP = 0.03;

/**
 * TV feature wall on one solid stretch: full-height fluted walnut panel,
 * floating console, wall-mounted 16:9 TV sized from its diagonal — all
 * centred on the stretch.
 */
function buildTvWall(room) {
  const t = room.tvWall;
  const b = roomBounds(room);
  const group = new THREE.Group();
  group.name = `${room.id}_tv_wall`;
  const horizontal = t.side === "north" || t.side === "south";
  const start = (horizontal ? b.x0 : b.z0) + t.offset;
  const mid = start + t.width / 2;

  const mat = (color, roughness, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const walnut = mat(0x7b5235, 0.55);
  const backing = mat(0x3a281b, 0.7);
  const lacquer = mat(0xece8e0, 0.4);
  const groove = mat(0x8f897f, 0.6);
  const tvBody = mat(0x161616, 0.4, 0.3);
  const screen = mat(0x07080a, 0.12);

  // A box `w` along the wall, `h` tall, `d` deep, its back `back` off the wall face
  const add = (w, h, d, along, y, back, material, name) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.name = `${room.id}_${name}`;
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(placeOnFace(mesh, b, t.side, along, y, back + d / 2));
  };

  // Fluted panel, floor to ceiling
  add(t.width, WALL_HEIGHT, BACKING, mid, WALL_HEIGHT / 2, PAINT_OFFSET, backing, "tv_panel");
  const pitch = SLAT.width + SLAT.gap;
  const count = Math.floor((t.width + SLAT.gap) / pitch);
  const first = mid - ((count - 1) * pitch) / 2;
  for (let i = 0; i < count; i++) {
    add(SLAT.width, WALL_HEIGHT, SLAT.depth, first + i * pitch, WALL_HEIGHT / 2, PAINT_OFFSET + BACKING, walnut, "tv_flute");
  }
  const panelFront = PAINT_OFFSET + BACKING + SLAT.depth;

  // Floating console, three shutters
  const length = Math.min(CONSOLE.maxLength, t.width - 8 * INCH);
  const cy = CONSOLE.lift + CONSOLE.height / 2;
  add(length, CONSOLE.height, CONSOLE.depth, mid, cy, panelFront, lacquer, "tv_console");
  for (const k of [-1, 1]) {
    add(0.004, CONSOLE.height - 0.02, 0.002, mid + (k * length) / 6, cy, panelFront + CONSOLE.depth, groove, "tv_console_groove");
  }

  // TV: 16:9 from the diagonal
  const diag = t.tv * INCH;
  const [w, h] = [(diag * 16) / Math.hypot(16, 9), (diag * 9) / Math.hypot(16, 9)];
  const tvBack = panelFront + TV_MOUNT_GAP;
  add(w, h, TV_DEPTH, mid, TV_CENTRE, tvBack, tvBody, "tv");
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.01, h - 0.01), screen);
  glass.name = `${room.id}_tv_screen`;
  group.add(placeOnFace(glass, b, t.side, mid, TV_CENTRE, tvBack + TV_DEPTH + 0.001));

  return group;
}

/** Ceiling plane, plus a recessed downlight fixture if the finish asks for one. */
function buildCeiling(room) {
  const color = room.finish?.ceiling ?? CEILING_COLOR;
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(room.width, room.depth),
    new THREE.MeshStandardMaterial({ color, roughness: 1.0 })
  );
  plane.rotation.x = Math.PI / 2; // faces down
  plane.position.set(room.x, WALL_HEIGHT, room.z);
  plane.name = `${room.id}_ceiling`;
  if (!room.finish?.downlight) return plane;

  const ceiling = new THREE.Group();
  ceiling.name = `${room.id}_ceiling`;
  const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.08, 32), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  lamp.rotation.x = Math.PI / 2;
  lamp.position.set(room.x, WALL_HEIGHT - 0.003, room.z);
  lamp.name = `${room.id}_downlight`;
  // Fixture only — no light source. The scene's even environment light is
  // what lets wall colours read true; a point light here made hot spots.
  ceiling.add(plane, lamp);
  return ceiling;
}

/**
 * Builds one zone's floor, paint and ceiling. Returns { group, ceiling, paint } —
 * the ceiling is kept separate so it can be hidden in dollhouse view and shown
 * in pano view; `paint` is the wall paint material (null for open zones).
 */
export function buildRoomGroup(room) {
  const group = new THREE.Group();
  group.name = room.id;

  // Floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(room.width, room.depth), floorMaterial(room));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(room.x, 0, room.z);
  floor.name = `${room.id}_floor`;
  floor.receiveShadow = true;
  group.add(floor);

  let paint = null;
  if (isWalled(room)) {
    const finish = buildFinish(room);
    group.add(finish.group);
    paint = finish.paint;
  }
  if (room.tvWall) group.add(buildTvWall(room));

  // Ceiling — only enclosed rooms. Balconies and the passage stay open to sky.
  const ceiling = room.kind === "room" ? buildCeiling(room) : null;

  return { group, ceiling, paint };
}

/**
 * Builds every zone. Ceilings go into their own group so the dollhouse view
 * can hide them wholesale. `paints` maps room id -> wall paint material, for
 * recolouring live; `sliders` maps a sliding door's id -> { set(t) } (0 shut,
 * 1 open); `kitchenMaterials` is what applyKitchenTheme() recolours;
 * `yashLayouts` maps layout id -> group (all hidden; show one).
 */
export function buildAllRooms(scene) {
  const groups = {};
  const paints = {};
  const ceilingGroup = new THREE.Group();
  ceilingGroup.name = "ceilings";

  for (const room of rooms) {
    const { group, ceiling, paint } = buildRoomGroup(room);
    scene.add(group);
    groups[room.id] = group;
    if (paint) paints[room.id] = paint;
    if (ceiling) ceilingGroup.add(ceiling);
  }

  const kitchen = buildKitchen();
  scene.add(kitchen.group);
  const yashLayouts = buildYashLayouts();
  for (const g of Object.values(yashLayouts)) scene.add(g);
  ceilingGroup.add(kitchen.ceiling);

  const walls = buildWalls();
  scene.add(walls.group);
  scene.add(ceilingGroup);
  return { groups, ceilingGroup, paints, sliders: walls.sliders, kitchenMaterials: kitchen.materials, yashLayouts };
}

/** Bounding box of the whole flat, used to frame the dollhouse camera. */
export function getFlatBounds() {
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;

  for (const room of rooms) {
    minX = Math.min(minX, room.x - room.width / 2);
    maxX = Math.max(maxX, room.x + room.width / 2);
    minZ = Math.min(minZ, room.z - room.depth / 2);
    maxZ = Math.max(maxZ, room.z + room.depth / 2);
  }

  return {
    minX,
    maxX,
    minZ,
    maxZ,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
    width: maxX - minX,
    depth: maxZ - minZ,
  };
}
