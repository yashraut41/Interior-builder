// Draws a 2D floor plan straight from roomData.js, so the plan can never
// drift from the 3D shell. Run:  node plan.js   ->  writes floor-plan.svg
//
// Rectangles are the room footprints as authored (clear inner dimensions).
// Overlapping footprints are hatched red — those are tracing errors.

import { writeFileSync } from "node:fs";
import { rooms, WALL_THICKNESS, NORTH_DIRECTION } from "./roomData.js";

const M_TO_FT = 1 / 0.3048;
const PX_PER_FT = 20;
const PAD = 70;
const px = (m) => m * M_TO_FT * PX_PER_FT;

/** metres -> 11'-3" */
function ftIn(m) {
  const totalIn = Math.round(m * M_TO_FT * 12);
  return `${Math.floor(totalIn / 12)}'-${totalIn % 12}"`;
}

const FILL = { room: "#f4efe6", open: "#e8eef2", outdoor: "#e3efdf" };

const rects = rooms.map((r) => ({
  ...r,
  x0: r.x - r.width / 2,
  z0: r.z - r.depth / 2,
  x1: r.x + r.width / 2,
  z1: r.z + r.depth / 2,
}));

const minX = Math.min(...rects.map((r) => r.x0));
const minZ = Math.min(...rects.map((r) => r.z0));
const maxX = Math.max(...rects.map((r) => r.x1));
const maxZ = Math.max(...rects.map((r) => r.z1));

const sx = (m) => PAD + px(m - minX);
const sz = (m) => PAD + px(m - minZ);
const W = px(maxX - minX) + PAD * 2 + 200;
const H = px(maxZ - minZ) + PAD * 2 + 40;

// Footprint overlaps (ignoring touching edges)
const EPS = 0.01;
const overlaps = [];
for (let i = 0; i < rects.length; i++) {
  for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], b = rects[j];
    const x0 = Math.max(a.x0, b.x0), x1 = Math.min(a.x1, b.x1);
    const z0 = Math.max(a.z0, b.z0), z1 = Math.min(a.z1, b.z1);
    if (x1 - x0 > EPS && z1 - z0 > EPS) overlaps.push({ a, b, x0, x1, z0, z1 });
  }
}

const out = [];
out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, Arial, sans-serif">`);
out.push(`<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#d33" stroke-width="2"/></pattern></defs>`);
out.push(`<rect width="100%" height="100%" fill="#fff"/>`);

// 1-foot grid, heavier every 5'
const gx0 = Math.floor(minX * M_TO_FT), gx1 = Math.ceil(maxX * M_TO_FT);
const gz0 = Math.floor(minZ * M_TO_FT), gz1 = Math.ceil(maxZ * M_TO_FT);
for (let f = gx0; f <= gx1; f++) {
  const X = sx(f / M_TO_FT);
  out.push(`<line x1="${X}" y1="${sz(gz0 / M_TO_FT)}" x2="${X}" y2="${sz(gz1 / M_TO_FT)}" stroke="${f % 5 ? "#f0f0f0" : "#dcdcdc"}"/>`);
  if (f % 5 === 0) out.push(`<text x="${X}" y="${PAD - 8}" font-size="10" fill="#999" text-anchor="middle">${f}'</text>`);
}
for (let f = gz0; f <= gz1; f++) {
  const Y = sz(f / M_TO_FT);
  out.push(`<line x1="${sx(gx0 / M_TO_FT)}" y1="${Y}" x2="${sx(gx1 / M_TO_FT)}" y2="${Y}" stroke="${f % 5 ? "#f0f0f0" : "#dcdcdc"}"/>`);
  if (f % 5 === 0) out.push(`<text x="${PAD - 10}" y="${Y + 3}" font-size="10" fill="#999" text-anchor="end">${f}'</text>`);
}

// Rooms: wall thickness drawn as a stroke centred outside the clear footprint
const wt = px(WALL_THICKNESS);
for (const r of rects) {
  const X = sx(r.x0), Y = sz(r.z0), w = px(r.width), h = px(r.depth);
  const dashed = r.kind === "open" ? ` stroke-dasharray="6 4"` : "";
  if (r.kind !== "open") {
    out.push(`<rect x="${X - wt / 2}" y="${Y - wt / 2}" width="${w + wt}" height="${h + wt}" fill="none" stroke="#555" stroke-width="${wt}" stroke-opacity="0.55"/>`);
  }
  out.push(`<rect x="${X}" y="${Y}" width="${w}" height="${h}" fill="${FILL[r.kind]}" stroke="#333" stroke-width="1"${dashed}/>`);

  const cx = X + w / 2, cy = Y + h / 2;
  const fs = Math.min(13, Math.max(8, w / 9));
  out.push(`<text x="${cx}" y="${cy - 2}" font-size="${fs}" font-weight="600" fill="#222" text-anchor="middle">${r.name.replace(/&/g, "&amp;")}</text>`);
  out.push(`<text x="${cx}" y="${cy + fs}" font-size="${fs - 1}" fill="#555" text-anchor="middle">${ftIn(r.width)} × ${ftIn(r.depth)}</text>`);
}

// Openings — drawn across the wall band(s) on the opening's line
const OPENING_STYLE = {
  glass: `fill="#8cc4ee" stroke="#1f6fb2"`,
  door: `fill="#c9955f" stroke="#6b4420"`,
  opening: `fill="#fff" stroke="#1f6fb2" stroke-dasharray="3 2"`,
};
for (const r of rects) {
  for (const o of r.openings) {
    const horizontal = o.side === "north" || o.side === "south";
    const line = { north: r.z0, south: r.z1, west: r.x0, east: r.x1 }[o.side];
    const a = (horizontal ? r.x0 : r.z0) + o.offset;
    const band = wt * 2.2;
    const [X, Y, w, h] = horizontal
      ? [sx(a), sz(line) - band / 2, px(o.width), band]
      : [sx(line) - band / 2, sz(a), band, px(o.width)];
    out.push(`<rect x="${X}" y="${Y}" width="${w}" height="${h}" ${OPENING_STYLE[o.type]} stroke-width="1.2"/>`);
  }
}

for (const o of overlaps) {
  out.push(`<rect x="${sx(o.x0)}" y="${sz(o.z0)}" width="${px(o.x1 - o.x0)}" height="${px(o.z1 - o.z0)}" fill="url(#hatch)" stroke="#d33"/>`);
}

// North arrow (NORTH_DIRECTION is in plan X/Z; SVG y grows with +Z)
const nx = W - 70, ny = PAD + 40;
const ang = (Math.atan2(NORTH_DIRECTION.x, -NORTH_DIRECTION.z) * 180) / Math.PI;
out.push(`<g transform="translate(${nx} ${ny}) rotate(${ang})"><path d="M0,-28 L10,12 L0,4 L-10,12 Z" fill="#222"/><text y="-34" font-size="14" font-weight="700" text-anchor="middle">N</text></g>`);

// Legend
let ly = ny + 60;
for (const [kind, label] of [["room", "Room (walls + ceiling)"], ["outdoor", "Outdoor (no ceiling)"], ["open", "Open (floor only)"]]) {
  out.push(`<rect x="${nx - 55}" y="${ly}" width="14" height="14" fill="${FILL[kind]}" stroke="#333"/><text x="${nx - 36}" y="${ly + 11}" font-size="10">${label}</text>`);
  ly += 20;
}
for (const [type, label] of [["glass", "Sliding glass (full height)"], ["door", "Door"], ["opening", "Opening, no door"]]) {
  out.push(`<rect x="${nx - 55}" y="${ly + 3}" width="14" height="8" ${OPENING_STYLE[type]}/><text x="${nx - 36}" y="${ly + 11}" font-size="10">${label}</text>`);
  ly += 20;
}
if (overlaps.length) {
  out.push(`<rect x="${nx - 55}" y="${ly}" width="14" height="14" fill="url(#hatch)" stroke="#d33"/><text x="${nx - 36}" y="${ly + 11}" font-size="10" fill="#d33">Overlap</text>`);
  ly += 20;
}

const area = rects.reduce((s, r) => s + r.width * r.depth, 0) * M_TO_FT * M_TO_FT;
out.push(`<text x="${PAD}" y="${H - 14}" font-size="11" fill="#555">OPTION 1 · generated from roomData.js · footprint total ${area.toFixed(0)} sq.ft · grid 1'</text>`);
out.push(`</svg>`);

writeFileSync(new URL("./floor-plan.svg", import.meta.url), out.join("\n"));

console.log(`floor-plan.svg written — ${rects.length} zones, ${area.toFixed(0)} sq.ft total footprint`);
for (const o of overlaps) {
  console.log(`OVERLAP  ${o.a.name} × ${o.b.name}: ${ftIn(o.x1 - o.x0)} × ${ftIn(o.z1 - o.z0)}`);
}
