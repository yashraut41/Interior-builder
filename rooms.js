import * as THREE from "three";
import { rooms, WALL_HEIGHT } from "./roomData.js";
import { wallRects, openingRects } from "./walls.js";

const FLOOR_COLOR = 0xcdc2ad;
const OPEN_FLOOR_COLOR = 0xbdb199;
const OUTDOOR_FLOOR_COLOR = 0xa8a294;
const WALL_COLOR = 0xeae5d9;
const CEILING_COLOR = 0xf2efe8;

function wallBox(material, r, y0, y1) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(r.x1 - r.x0, y1 - y0, r.z1 - r.z0),
    material
  );
  mesh.position.set((r.x0 + r.x1) / 2, (y0 + y1) / 2, (r.z0 + r.z1) / 2);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
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

  for (const r of wallRects) group.add(wallBox(wallMaterial, r, 0, WALL_HEIGHT));

  for (const r of openingRects) {
    if (r.opening.height < WALL_HEIGHT - 0.001) {
      group.add(wallBox(wallMaterial, r, r.opening.height, WALL_HEIGHT));
    }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0), thresholdMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2);
    floor.receiveShadow = true;
    group.add(floor);
  }

  return group;
}

function floorColorFor(kind) {
  if (kind === "open") return OPEN_FLOOR_COLOR;
  if (kind === "outdoor") return OUTDOOR_FLOOR_COLOR;
  return FLOOR_COLOR;
}

/**
 * Builds one zone's floor and ceiling. Returns { group, ceiling } — the ceiling is kept separate
 * so it can be hidden in dollhouse view and shown in pano view.
 */
export function buildRoomGroup(room) {
  const group = new THREE.Group();
  group.name = room.id;

  // Floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(room.width, room.depth),
    new THREE.MeshStandardMaterial({ color: floorColorFor(room.kind), roughness: 0.9 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(room.x, 0, room.z);
  floor.receiveShadow = true;
  group.add(floor);

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

  scene.add(buildWalls());
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
