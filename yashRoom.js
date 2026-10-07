// ---------------------------------------------------------------------------
// Yash Room furniture layouts — true-size blocks, switchable live. Planning
// aids, not models: wardrobe, bed, desk (+ monitors), chair.
//
// Room-local inches: x east from the glass (west) wall, z south from the
// north wall. The room is 133" x 120" (11'-1" x 10'-0"). Keep clear: the
// north-east corner (passage door swing, x > 97, z < 40) and the toilet door
// on the north wall (x 77-107).
// ---------------------------------------------------------------------------

import * as THREE from "three";
import { rooms, WALL_HEIGHT } from "./roomData.js";
import { roomBounds } from "./walls.js";

const IN = 0.0254;
const CEIL = WALL_HEIGHT / IN;

/**
 * wardrobe: x, z, w (along its wall), d (depth), wall it backs onto
 * bed:      x, z, w (east-west extent), l (north-south extent), head side, size label
 * desk:     list of tops { x, z, w, l } + the wall the monitors back onto
 * chair:    x, z, facing ('north' | 'south' | ...)
 */
export const LAYOUTS = [
  {
    id: "balanced",
    name: "1 · Balanced",
    note: "6' desk on the south wall, 4'6\" bed headboard-south",
    wardrobe: { x: 0, z: 0, w: 72, d: 24, wall: "north" },
    bed: { x: 75, z: 41, w: 58, l: 79, head: "south", pillows: 2 },
    desk: { tops: [{ x: 0, z: 90, w: 72, l: 30 }], wall: "south", monitors: 2 },
    chair: { x: 36, z: 72, facing: "south" },
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
export const DEFAULT_LAYOUT = "coder";

const WARDROBE_H = 84; // 7'-0", loft above to the ceiling
const DESK_H = 29;

function materials() {
  const std = (color, roughness, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  return {
    white: std(0xf1efea, 0.45), // wardrobe shutters, desk
    gap: std(0x2a2a2a, 0.9), // shutter joints
    walnut: std(0x6b4a33, 0.6), // bed frame + headboard
    linen: std(0xf4f3ef, 0.9), // mattress / duvet
    pillow: std(0x9c9aa3, 0.9),
    black: std(0x1b1c1e, 0.5),
    screen: std(0x0b0c0e, 0.15),
    steel: std(0x9a9da1, 0.35, 0.6),
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
    const box = (x0, x1, y0, y1, z0, z1, mat, name) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry((x1 - x0) * IN, (y1 - y0) * IN, (z1 - z0) * IN), mat);
      mesh.position.set(b.x0 + ((x0 + x1) / 2) * IN, ((y0 + y1) / 2) * IN, b.z0 + ((z0 + z1) / 2) * IN);
      mesh.name = name;
      mesh.castShadow = mesh.receiveShadow = true;
      g.add(mesh);
      return mesh;
    };
    wardrobe(box, m, layout.wardrobe);
    bed(box, m, layout.bed);
    desk(box, m, layout.desk);
    chair(g, b, m, layout.chair);
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

/** White desk top(s) on slim legs, monitors on stands at the wall, keyboard. */
function desk(box, m, { tops, wall, monitors }) {
  for (const t of tops) {
    box(t.x, t.x + t.w, DESK_H - 1, DESK_H, t.z, t.z + t.l, m.white, "desk_top");
    const inset = 2;
    for (const [lx, lz] of [[t.x + inset, t.z + inset], [t.x + t.w - inset, t.z + inset], [t.x + inset, t.z + t.l - inset], [t.x + t.w - inset, t.z + t.l - inset]]) {
      box(lx - 0.75, lx + 0.75, 0, DESK_H - 1, lz - 0.75, lz + 0.75, m.white, "desk_leg");
    }
  }
  // Monitors (27", 16:9 = 23.5" x 13.2") on the first top, at the wall
  const t = tops[0];
  const back = wall === "north" ? t.z + 4 : t.z + t.l - 4; // panel plane, 4" off the wall
  const toward = wall === "north" ? 1 : -1; // into the room
  const width = 23.5, gap = 0.5;
  const total = monitors * width + (monitors - 1) * gap;
  const start = t.x + Math.min(t.w, 72) / 2 - total / 2;
  for (let i = 0; i < monitors; i++) {
    const x0 = start + i * (width + gap);
    const cx = x0 + width / 2;
    box(x0, x0 + width, DESK_H + 5, DESK_H + 18.2, Math.min(back, back + toward), Math.max(back, back + toward), m.black, "monitor");
    const face = back + toward * 1.05;
    box(x0 + 0.4, x0 + width - 0.4, DESK_H + 5.4, DESK_H + 17.8, Math.min(face, face + toward * 0.05), Math.max(face, face + toward * 0.05), m.screen, "monitor_screen");
    box(cx - 1, cx + 1, DESK_H, DESK_H + 8, Math.min(back - toward * 2, back), Math.max(back - toward * 2, back), m.steel, "monitor_stand");
    box(cx - 4, cx + 4, DESK_H, DESK_H + 0.4, Math.min(back - toward * 3, back + toward * 3), Math.max(back - toward * 3, back + toward * 3), m.steel, "monitor_foot");
  }
  // Keyboard + mouse in front
  const kz = back + toward * 12;
  const kx = start + total / 2;
  box(kx - 8.5, kx + 8.5, DESK_H, DESK_H + 0.8, Math.min(kz, kz + toward * 5), Math.max(kz, kz + toward * 5), m.black, "keyboard");
  box(kx + 11, kx + 13.5, DESK_H, DESK_H + 1.2, Math.min(kz + toward, kz + toward * 5), Math.max(kz + toward, kz + toward * 5), m.black, "mouse");
}

/** Office chair: five-star base, gas column, seat, backrest away from the desk. */
function chair(g, b, m, { x, z, facing }) {
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
  c.rotation.y = { north: 0, south: Math.PI, east: -Math.PI / 2, west: Math.PI / 2 }[facing];
  c.position.set(b.x0 + x * IN, 0, b.z0 + z * IN);
  g.add(c);
}
