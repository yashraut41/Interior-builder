import * as THREE from "three";
import { rooms, WALL_HEIGHT, WALL_THICKNESS } from "./roomData.js";

const FLOOR_COLOR = 0xcdc2ad;
const OPEN_FLOOR_COLOR = 0xbdb199;
const OUTDOOR_FLOOR_COLOR = 0xa8a294;
const WALL_COLOR = 0xeae5d9;
const CEILING_COLOR = 0xf2efe8;

/**
 * Build the wall segment(s) along one side of a room's footprint, leaving a
 * gap where `opening` says there should be one. No door or window mesh is
 * ever created — an opening is simply missing wall.
 */
function buildWallSide({ side, x1, x2, z1, z2, opening, material }) {
  const meshes = [];
  const isHorizontal = side === "north" || side === "south"; // runs along X
  const length = isHorizontal ? x2 - x1 : z2 - z1;
  const fixedZ = side === "north" ? z1 : side === "south" ? z2 : null;
  const fixedX = side === "west" ? x1 : side === "east" ? x2 : null;

  const segments = [];
  if (opening) {
    const gapStart = THREE.MathUtils.clamp(opening.offset, 0, length);
    const gapEnd = THREE.MathUtils.clamp(opening.offset + opening.width, 0, length);
    if (gapStart > 0.001) segments.push([0, gapStart]);
    if (gapEnd < length - 0.001) segments.push([gapEnd, length]);
  } else {
    segments.push([0, length]);
  }

  for (const [start, end] of segments) {
    const segLength = end - start;
    if (segLength <= 0.001) continue;

    const geometry = new THREE.BoxGeometry(
      isHorizontal ? segLength : WALL_THICKNESS,
      WALL_HEIGHT,
      isHorizontal ? WALL_THICKNESS : segLength
    );
    const mesh = new THREE.Mesh(geometry, material);
    const mid = start + segLength / 2;

    if (isHorizontal) {
      mesh.position.set(x1 + mid, WALL_HEIGHT / 2, fixedZ);
    } else {
      mesh.position.set(fixedX, WALL_HEIGHT / 2, z1 + mid);
    }

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    meshes.push(mesh);
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

  const x1 = room.x - room.width / 2;
  const x2 = room.x + room.width / 2;
  const z1 = room.z - room.depth / 2;
  const z2 = room.z + room.depth / 2;

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

    const openingsBySide = {};
    for (const o of room.openings || []) openingsBySide[o.side] = o;

    for (const side of ["north", "south", "east", "west"]) {
      buildWallSide({
        side,
        x1,
        x2,
        z1,
        z2,
        opening: openingsBySide[side] || null,
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
