// ---------------------------------------------------------------------------
// Wall model — derived from roomData.js, shared by the 3D shell (rooms.js)
// and the drawing (plan.js). No Three.js here so it runs in Node too.
//
// Rules:
//  - A zone's footprint is its CLEAR internal size. Walls sit OUTSIDE it,
//    so the printed room dimensions are exactly what you get inside.
//  - Walls never enter a walled zone's clear footprint. Two rooms sharing a
//    partition therefore produce ONE wall, not two overlapping ones.
//  - Faces closer than JOIN_GAP are two sides of one wall; any gap wider
//    than WALL_THICKNESS between them is filled solid.
//  - 'open' zones (passage, service platform) have no walls of their own and
//    are not protected — neighbouring walls take their thickness from them.
//
// Everything is axis-aligned, so the solid is resolved on a grid built from
// every rectangle edge (coordinate compression) — exact, no tolerancing.
// ---------------------------------------------------------------------------

import { rooms, WALL_THICKNESS, WALL_HEIGHT, OPENING_TYPES } from "./roomData.js";

const T = WALL_THICKNESS;

/** Parallel faces closer than this (~14") are the two sides of one wall. */
export const JOIN_GAP = 0.35;

const EPS = 1e-6;

export const isWalled = (room) => room.kind === "room" || room.kind === "outdoor";

/** Clear footprint of a zone: { x0, x1, z0, z1 } in metres. */
export function roomBounds(room) {
  return {
    x0: room.x - room.width / 2,
    x1: room.x + room.width / 2,
    z0: room.z - room.depth / 2,
    z1: room.z + room.depth / 2,
  };
}

const overlap = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);
const contains = (r, x, z) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;

const zones = rooms.map((room) => ({ room, ...roomBounds(room) }));
const walled = zones.filter((z) => isWalled(z.room));

// --- 1. Wall material: a T-thick band outside every walled zone ------------

const solid = [];
for (const z of walled) {
  solid.push(
    { x0: z.x0 - T, x1: z.x1 + T, z0: z.z0 - T, z1: z.z0 }, // north
    { x0: z.x0 - T, x1: z.x1 + T, z0: z.z1, z1: z.z1 + T }, // south
    { x0: z.x0 - T, x1: z.x0, z0: z.z0, z1: z.z1 }, // west
    { x0: z.x1, x1: z.x1 + T, z0: z.z0, z1: z.z1 } // east
  );
}

// Gaps between facing walled zones wider than T but still one wall: fill.
for (const a of walled) {
  for (const b of walled) {
    if (a === b) continue;
    const gx = b.x0 - a.x1; // a west of b
    const oz = overlap(a.z0, a.z1, b.z0, b.z1);
    if (gx > T && gx <= JOIN_GAP && oz > EPS) {
      solid.push({ x0: a.x1, x1: b.x0, z0: Math.max(a.z0, b.z0), z1: Math.min(a.z1, b.z1) });
    }
    const gz = b.z0 - a.z1; // a north of b
    const ox = overlap(a.x0, a.x1, b.x0, b.x1);
    if (gz > T && gz <= JOIN_GAP && ox > EPS) {
      solid.push({ x0: Math.max(a.x0, b.x0), x1: Math.min(a.x1, b.x1), z0: a.z1, z1: b.z0 });
    }
  }
}

// --- 2. Openings as world-space cut rectangles -----------------------------

/** Distance from a zone's face to the nearest zone facing it across [s, e]. */
function facingGap(zone, side, s, e) {
  let best = Infinity;
  for (const o of zones) {
    if (o === zone) continue;
    let g, ov;
    if (side === "north") (g = zone.z0 - o.z1), (ov = overlap(s, e, o.x0, o.x1));
    if (side === "south") (g = o.z0 - zone.z1), (ov = overlap(s, e, o.x0, o.x1));
    if (side === "west") (g = zone.x0 - o.x1), (ov = overlap(s, e, o.z0, o.z1));
    if (side === "east") (g = o.x0 - zone.x1), (ov = overlap(s, e, o.z0, o.z1));
    if (g >= -EPS && g <= JOIN_GAP && ov > EPS) best = Math.min(best, g);
  }
  return best;
}

/**
 * Every opening with its resolved geometry:
 *   horizontal - wall runs along X (north/south side)
 *   along      - [start, end] along the wall
 *   across     - [a0, a1] through the wall's actual thickness
 *   roomSide   - which end of `across` faces the zone that lists it (0 | 1)
 *   height     - top of the gap; wall continues above as a lintel
 */
export const openings = [];
for (const zone of zones) {
  for (const o of zone.room.openings || []) {
    const horizontal = o.side === "north" || o.side === "south";
    const s = (horizontal ? zone.x0 : zone.z0) + o.offset;
    const e = s + o.width;
    const face = { north: zone.z0, south: zone.z1, west: zone.x0, east: zone.x1 }[o.side];
    const dir = o.side === "north" || o.side === "west" ? -1 : 1; // outward
    const gap = facingGap(zone, o.side, s, e);
    const depth = Math.max(T, Number.isFinite(gap) ? gap : 0);
    const a0 = dir < 0 ? face - depth : face;
    const a1 = dir < 0 ? face : face + depth;
    openings.push({
      ...o,
      room: zone.room,
      horizontal,
      along: [s, e],
      across: [a0, a1],
      roomSide: dir < 0 ? 1 : 0,
      height: OPENING_TYPES[o.type].height,
      cut: horizontal ? { x0: s, x1: e, z0: a0, z1: a1 } : { x0: a0, x1: a1, z0: s, z1: e },
    });
  }
}

// --- 3. Resolve on a compressed grid ---------------------------------------

function axis(rects, k0, k1) {
  const v = rects.flatMap((r) => [r[k0], r[k1]]).sort((a, b) => a - b);
  const out = [];
  for (const x of v) if (!out.length || x - out[out.length - 1] > 1e-5) out.push(x);
  return out;
}

const clear = walled;
const all = [...solid, ...clear, ...openings.map((o) => o.cut)];
const xs = axis(all, "x0", "x1");
const zs = axis(all, "z0", "z1");

// grid[j][i]: 0 empty, 1 wall, 2 + n = opening n
const grid = zs.slice(0, -1).map((_, j) =>
  xs.slice(0, -1).map((_, i) => {
    const cx = (xs[i] + xs[i + 1]) / 2;
    const cz = (zs[j] + zs[j + 1]) / 2;
    if (!solid.some((r) => contains(r, cx, cz))) return 0;
    if (clear.some((r) => contains(r, cx, cz))) return 0;
    const n = openings.findIndex((o) => contains(o.cut, cx, cz));
    return n < 0 ? 1 : 2 + n;
  })
);

const cellRect = (i, j) => ({ x0: xs[i], x1: xs[i + 1], z0: zs[j], z1: zs[j + 1] });

/** Merge same-valued cells into horizontal runs per grid row. */
function runs(test) {
  const out = [];
  grid.forEach((row, j) => {
    let i = 0;
    while (i < row.length) {
      if (!test(row[i])) {
        i++;
        continue;
      }
      const v = row[i];
      let k = i;
      while (k + 1 < row.length && row[k + 1] === v) k++;
      out.push({ ...cellRect(i, j), x1: xs[k + 1], value: v });
      i = k + 1;
    }
  });
  return out;
}

/** Solid wall, full height, as merged rectangles. */
export const wallRects = runs((v) => v === 1).map(({ value, ...r }) => r);

/** Wall footprint inside each opening — gets a floor, and a lintel if needed. */
export const openingRects = runs((v) => v >= 2).map(({ value, ...r }) => ({
  ...r,
  opening: openings[value - 2],
}));

// Actual extent of each opening's cut through wall (drawing symbols use it)
for (const o of openings) {
  const mine = openingRects.filter((r) => r.opening === o);
  if (!mine.length) {
    o.orphan = true; // lies on no wall — a data error
    continue;
  }
  o.across = o.horizontal
    ? [Math.min(...mine.map((r) => r.z0)), Math.max(...mine.map((r) => r.z1))]
    : [Math.min(...mine.map((r) => r.x0)), Math.max(...mine.map((r) => r.x1))];
}

/**
 * Wall outline: every edge between a wall cell and a non-wall cell, merged
 * into maximal straight segments. Includes jamb lines at openings.
 */
export const wallOutline = (() => {
  const isWall = (i, j) => grid[j]?.[i] === 1;
  const h = new Map(); // z -> [[x0, x1]]
  const v = new Map(); // x -> [[z0, z1]]
  const push = (m, k, seg) => (m.get(k) || m.set(k, []).get(k)).push(seg);
  grid.forEach((row, j) =>
    row.forEach((_, i) => {
      if (!isWall(i, j)) return;
      if (!isWall(i, j - 1)) push(h, zs[j], [xs[i], xs[i + 1]]);
      if (!isWall(i, j + 1)) push(h, zs[j + 1], [xs[i], xs[i + 1]]);
      if (!isWall(i - 1, j)) push(v, xs[i], [zs[j], zs[j + 1]]);
      if (!isWall(i + 1, j)) push(v, xs[i + 1], [zs[j], zs[j + 1]]);
    })
  );
  const merge = (segs) => {
    segs.sort((a, b) => a[0] - b[0]);
    const out = [];
    for (const s of segs) {
      const last = out[out.length - 1];
      if (last && s[0] - last[1] < 1e-5) last[1] = Math.max(last[1], s[1]);
      else out.push([...s]);
    }
    return out;
  };
  const lines = [];
  for (const [z, segs] of h) for (const [a, b] of merge(segs)) lines.push([[a, z], [b, z]]);
  for (const [x, segs] of v) for (const [a, b] of merge(segs)) lines.push([[x, a], [x, b]]);
  return lines;
})();

/** Extent of all wall material, openings included. */
export const wallBounds = (() => {
  const r = [...wallRects, ...openingRects];
  return {
    minX: Math.min(...r.map((q) => q.x0)),
    maxX: Math.max(...r.map((q) => q.x1)),
    minZ: Math.min(...r.map((q) => q.z0)),
    maxZ: Math.max(...r.map((q) => q.z1)),
  };
})();

export { zones, WALL_HEIGHT };
