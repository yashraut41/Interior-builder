import * as THREE from "three";
import { rooms, WALL_HEIGHT, WALL_THICKNESS, OPENING_TYPES } from "./roomData.js";

const FLOOR_COLOR = 0xcdc2ad;
const OPEN_FLOOR_COLOR = 0xbdb199;
const OUTDOOR_FLOOR_COLOR = 0xa8a294;
const WALL_COLOR = 0xeae5d9;
const CEILING_COLOR = 0xf2efe8;

/**
 * How far a wall may sit from an opening's line and still be cut by it.
 * Two rooms sharing a partition each build their own wall, a wall-thickness
 * (or up to ~9" where tracing is loose) apart — both must get the gap.
 */
const OPENING_REACH = 0.3;

/** Wall pieces shorter than this (~3") are tracing slivers — dropped. */
const MIN_WALL_PIECE = 0.075;

function roomBounds(room) {
  return {
    x1: room.x - room.width / 2,
    x2: room.x + room.width / 2,
    z1: room.z - room.depth / 2,
    z2: room.z + room.depth / 2,
  };
}

/**
 * Every opening in the flat as a world-space cut: an interval along X
 * (horizontal walls) or Z (vertical walls) on a fixed line.
 */
function collectCuts() {
  const cuts = [];
  for (const room of rooms) {
    const { x1, x2, z1, z2 } = roomBounds(room);
    for (const o of room.openings || []) {
      const horizontal = o.side === "north" || o.side === "south";
      const line = { north: z1, south: z2, west: x1, east: x2 }[o.side];
      const start = (horizontal ? x1 : z1) + o.offset;
      cuts.push({
        horizontal,
        line,
        start,
        end: start + o.width,
        height: OPENING_TYPES[o.type].height,
      });
    }
  }
  return cuts;
}

const cuts = collectCuts();

function wallBox(material, length, height, isHorizontal) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(
      isHorizontal ? length : WALL_THICKNESS,
      height,
      isHorizontal ? WALL_THICKNESS : length
    ),
    material
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Build the wall along one side of a room's footprint, leaving gaps for any
 * opening that lies on this line. No door or window mesh is ever created —
 * an opening is simply missing wall, with a lintel above if it stops short
 * of the ceiling.
 */
function buildWallSide({ side, x1, x2, z1, z2, material }) {
  const meshes = [];
  const isHorizontal = side === "north" || side === "south"; // runs along X
  const origin = isHorizontal ? x1 : z1;
  const length = isHorizontal ? x2 - x1 : z2 - z1;
  const fixed = { north: z1, south: z2, west: x1, east: x2 }[side];

  // Gaps on this wall, in local coordinates, sorted along the wall
  const gaps = cuts
    .filter((c) => c.horizontal === isHorizontal && Math.abs(c.line - fixed) <= OPENING_REACH)
    .map((c) => ({
      start: THREE.MathUtils.clamp(c.start - origin, 0, length),
      end: THREE.MathUtils.clamp(c.end - origin, 0, length),
      height: c.height,
    }))
    .filter((g) => g.end - g.start > 0.001)
    .sort((a, b) => a.start - b.start);

  const place = (mesh, mid, y) => {
    if (isHorizontal) mesh.position.set(origin + mid, y, fixed);
    else mesh.position.set(fixed, y, origin + mid);
    meshes.push(mesh);
  };

  // Full-height pieces between gaps
  let cursor = 0;
  for (const g of [...gaps, { start: length, end: length }]) {
    const piece = g.start - cursor;
    if (piece >= MIN_WALL_PIECE) {
      place(wallBox(material, piece, WALL_HEIGHT, isHorizontal), cursor + piece / 2, WALL_HEIGHT / 2);
    }
    cursor = Math.max(cursor, g.end);
  }

  // Lintels above doors and plain openings
  for (const g of gaps) {
    const h = WALL_HEIGHT - g.height;
    if (h <= 0.001) continue;
    const w = g.end - g.start;
    place(wallBox(material, w, h, isHorizontal), g.start + w / 2, g.height + h / 2);
  }

  return meshes;
}

function floorColorFor(kind) {
  if (kind === "open") return OPEN_FLOOR_COLOR;
  if (kind === "outdoor") return OUTDOOR_FLOOR_COLOR;
  return FLOOR_COLOR;
}

/**
 * Builds one zone. Returns { group, ceiling } — the ceiling is kept separate
 * so it can be hidden in dollhouse view and shown in pano view.
 */
export function buildRoomGroup(room) {
  const group = new THREE.Group();
  group.name = room.id;

  const { x1, x2, z1, z2 } = roomBounds(room);

  // Floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(room.width, room.depth),
    new THREE.MeshStandardMaterial({ color: floorColorFor(room.kind), roughness: 0.9 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(room.x, 0, room.z);
  floor.receiveShadow = true;
  group.add(floor);

  // Walls — 'room' and 'outdoor' get them, 'open' does not
  if (room.kind === "room" || room.kind === "outdoor") {
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: WALL_COLOR,
      roughness: 0.95,
    });

    for (const side of ["north", "south", "east", "west"]) {
      buildWallSide({
        side,
        x1,
        x2,
        z1,
        z2,
        material: wallMaterial,
      }).forEach((m) => group.add(m));
    }
  }

  // Ceiling — only enclosed rooms. Balconies and the passage stay open to sky.
  let ceiling = null;
  if (room.kind === "room") {
    ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(room.width, room.depth),
      new THREE.MeshStandardMaterial({ color: CEILING_COLOR, roughness: 1.0 })
    );
    ceiling.rotation.x = Math.PI / 2; // faces down
    ceiling.position.set(room.x, WALL_HEIGHT, room.z);
    ceiling.name = `${room.id}_ceiling`;
  }

  return { group, ceiling };
}

/**
 * Builds every zone. Ceilings go into their own group so the dollhouse view
 * can hide them wholesale.
 */
export function buildAllRooms(scene) {
  const groups = {};
  const ceilingGroup = new THREE.Group();
  ceilingGroup.name = "ceilings";

  for (const room of rooms) {
    const { group, ceiling } = buildRoomGroup(room);
    scene.add(group);
    groups[room.id] = group;
    if (ceiling) ceilingGroup.add(ceiling);
  }

  scene.add(ceilingGroup);
  return { groups, ceilingGroup };
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
