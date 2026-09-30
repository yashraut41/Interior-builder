import * as THREE from "three";
import { rooms, WALL_HEIGHT } from "./roomData.js";
import { wallRects, openingRects, openings, roomBounds, isWalled } from "./walls.js";

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
  for (const o of openings) {
    if (o.frame && !o.orphan) group.add(buildGlazing(o, frameMat, glassMat));
  }

  return group;
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

/** Gaps [start, end, top] in one inner face, from any opening on that line. */
function holesOnFace(b, side) {
  const horizontal = side === "north" || side === "south";
  const face = { north: b.z0, south: b.z1, west: b.x0, east: b.x1 }[side];
  const [lo, hi] = horizontal ? [b.x0, b.x1] : [b.z0, b.z1];
  return openings
    .filter((o) => !o.orphan && o.horizontal === horizontal)
    .filter((o) => o.across[0] <= face + 1e-4 && o.across[1] >= face - 1e-4)
    .map((o) => [Math.max(lo, o.along[0]), Math.min(hi, o.along[1]), o.height])
    .filter(([s, e]) => e - s > 1e-4)
    .sort((p, q) => p[0] - q[0]);
}

/** Pieces of solid face [start, end, y0, y1] left around the holes. */
function faceSpans(lo, hi, holes) {
  const spans = [];
  let cur = lo;
  for (const [s, e, top] of holes) {
    if (s > cur) spans.push([cur, s, 0, WALL_HEIGHT]);
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

  // Ceiling — only enclosed rooms. Balconies and the passage stay open to sky.
  const ceiling = room.kind === "room" ? buildCeiling(room) : null;

  return { group, ceiling, paint };
}

/**
 * Builds every zone. Ceilings go into their own group so the dollhouse view
 * can hide them wholesale. `paints` maps room id -> wall paint material, for
 * recolouring live.
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

  scene.add(buildWalls());
  scene.add(ceilingGroup);
  return { groups, ceilingGroup, paints };
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
