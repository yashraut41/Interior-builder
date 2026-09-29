// Architectural floor plan, generated from roomData.js via walls.js.
// Run:  node plan.js   ->  floor-plan.svg  (view / print)
//                          floor-plan.dxf  (AutoCAD / any CAD, inches)
//
// Drawn to standard plan conventions:
//  - walls: cut outline (heavy) with solid poché
//  - doors: leaf shown open 90° with swing arc
//  - windows: frame lines at both faces, double glass line on the centreline
//  - sliding glass: panels on offset tracks within the wall thickness
//  - bare openings: dashed head lines (lintel above the cut plane)
//  - exterior chain + overall dimension strings, architectural ticks
//  - door / window marks keyed to a schedule; north arrow, graphic scale,
//    notes, area statement, title block
// Layers follow AIA CAD layer names. SVG and DXF are written from the same
// primitive list, so they cannot disagree.

import { writeFileSync } from "node:fs";
import { WALL_THICKNESS, WALL_HEIGHT, DOOR_HEIGHT, NORTH_DIRECTION } from "./roomData.js";
import { zones, isWalled, openings, wallRects, openingRects, wallOutline, wallBounds } from "./walls.js";

const M_TO_FT = 1 / 0.3048;
const EPS = 1e-6;

/** metres -> 11'-3" */
function ftIn(m) {
  const t = Math.round(m * M_TO_FT * 12);
  return `${Math.floor(t / 12)}'-${t % 12}"`;
}

// ---------------------------------------------------------------------------
// Layers — AIA names. `pen` is the plotted line weight in mm.
// ---------------------------------------------------------------------------

const LAYERS = {
  "A-WALL": { color: 7, pen: 0.5 },
  "A-WALL-PATT": { color: 8, pen: 0 },
  "A-WALL-HEAD": { color: 8, pen: 0.18, dashed: true },
  "A-DOOR": { color: 2, pen: 0.25 },
  "A-GLAZ": { color: 4, pen: 0.18 },
  "A-FLOR-OTLN": { color: 8, pen: 0.18, dashed: true },
  "A-AREA-IDEN": { color: 7, pen: 0.25 },
  "A-ANNO-DIMS": { color: 1, pen: 0.13 },
  "A-ANNO-SYMB": { color: 7, pen: 0.25 },
  "A-ANNO-TEXT": { color: 7, pen: 0.18 },
  "A-ANNO-TTLB": { color: 7, pen: 0.35 },
};

// ---------------------------------------------------------------------------
// Primitive list (world metres; x east, z south)
// ---------------------------------------------------------------------------

const P = [];
const line = (layer, a, b) => P.push({ t: "line", layer, a, b });
const poly = (layer, pts, closed = true) => P.push({ t: "poly", layer, pts, closed });
const rect = (layer, x0, z0, x1, z1) => poly(layer, [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]);
/** Solid fill: an axis-aligned rect { x0, x1, z0, z1 }, or a triangle `pts`. */
const fill = (layer, r, pts) => P.push({ t: "fill", layer, r, pts });
const arc = (layer, c, r, t0, t1) => P.push({ t: "arc", layer, c, r, t0, t1 });
const circle = (layer, c, r) => P.push({ t: "circle", layer, c, r });
/** h = cap height (m). rot = degrees counter-clockwise as seen on the sheet. */
const text = (layer, p, s, h, anchor = "middle", rot = 0) =>
  P.push({ t: "text", layer, p, s, h, anchor, rot });

const CHAR_W = 0.85; // average CAPS glyph width / cap height, for layout only

// ---------------------------------------------------------------------------
// Walls
// ---------------------------------------------------------------------------

for (const r of wallRects) fill("A-WALL-PATT", r);
for (const [a, b] of wallOutline) line("A-WALL", a, b);

// ---------------------------------------------------------------------------
// Openings
// ---------------------------------------------------------------------------

// Marks: D1.. doors, W1.. windows, SD1.. sliding glass, OP1.. bare openings (widest first)
const PREFIX = { door: "D", window: "W", glass: "SD", opening: "OP" };
const DESC = {
  door: "FLUSH DOOR, HINGED",
  window: "WINDOW, FLOOR TO CEILING",
  glass: "SLIDING GLASS DOOR, FLOOR TO CEILING",
  opening: "OPENING, NO SHUTTER",
};
const schedule = [];
for (const type of ["door", "window", "glass", "opening"]) {
  const list = openings.filter((o) => o.type === type);
  const widths = [...new Set(list.map((o) => Math.round(o.width * M_TO_FT * 12)))].sort((a, b) => b - a);
  widths.forEach((inches, i) => {
    const same = list.filter((o) => Math.round(o.width * M_TO_FT * 12) === inches);
    const mark = `${PREFIX[type]}${i + 1}`;
    same.forEach((o) => (o.mark = mark));
    schedule.push({ mark, type, width: same[0].width, height: same[0].height, count: same.length });
  });
}

for (const o of openings) {
  if (o.orphan) continue;
  const [s, e] = o.along;
  const [a0, a1] = o.across;
  const w = e - s;
  const at = (al, ac) => (o.horizontal ? [al, ac] : [ac, al]);

  if (o.type === "door") {
    const side = o.swing === "out" ? 1 - o.roomSide : o.roomSide; // index into across
    const face = side === 1 ? a1 : a0;
    const out = side === 1 ? 1 : -1; // leaf swings this way across the wall
    const hinge = o.hinge === "end" ? e : s;
    const toward = o.hinge === "end" ? -1 : 1; // hinge -> latch jamb
    const LEAF = 0.035;

    poly("A-DOOR", [
      at(hinge, face),
      at(hinge + toward * LEAF, face),
      at(hinge + toward * LEAF, face + out * w),
      at(hinge, face + out * w),
    ]);

    // Swing arc: quarter circle from open leaf tip to the latch jamb
    const c = at(hinge, face);
    const ang = (p) => Math.atan2(p[1] - c[1], p[0] - c[0]);
    let t0 = ang(at(hinge, face + out * w));
    let t1 = ang(at(hinge + toward * w, face));
    const ccw = (((t1 - t0) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    if (ccw > Math.PI) [t0, t1] = [t1, t0];
    if (t1 < t0) t1 += 2 * Math.PI;
    arc("A-DOOR", c, w, t0, t1);
  }

  if (o.type === "window") {
    // Frame lines on both wall faces, double glass line on the centreline
    const mid = (a0 + a1) / 2;
    const GL = 0.02;
    for (const ac of [a0, a1, mid - GL, mid + GL]) line("A-GLAZ", at(s, ac), at(e, ac));
  }

  if (o.type === "glass") {
    const n = w <= 2.05 ? 2 : w <= 3.2 ? 3 : 4;
    const OV = 0.05; // panel overlap
    const PT = 0.03; // panel thickness
    for (let k = 0; k < n; k++) {
      const track = a0 + (a1 - a0) * (k % 2 ? 0.66 : 0.34);
      const p0 = s + (k * w) / n - (k > 0 ? OV : 0);
      const p1 = s + ((k + 1) * w) / n + (k < n - 1 ? OV : 0);
      poly("A-GLAZ", [at(p0, track - PT / 2), at(p1, track - PT / 2), at(p1, track + PT / 2), at(p0, track + PT / 2)]);
    }
  }

  if (o.type === "opening") {
    line("A-WALL-HEAD", at(s, a0), at(e, a0));
    line("A-WALL-HEAD", at(s, a1), at(e, a1));
  }

  // Mark, just outside the face away from the door swing / from the room
  const tagSide = o.type === "door" ? (o.swing === "out" ? o.roomSide : 1 - o.roomSide) : 1 - o.roomSide;
  const tagAcross = tagSide === 1 ? a1 + 0.24 : a0 - 0.24;
  const tp = at((s + e) / 2, tagAcross);
  circle("A-ANNO-SYMB", tp, 0.15);
  text("A-ANNO-SYMB", tp, o.mark, 0.075);
}

// ---------------------------------------------------------------------------
// Zones: names, clear sizes, outlines of wall-less zones
// ---------------------------------------------------------------------------

for (const z of zones) {
  const r = z.room;
  const w = z.x1 - z.x0;
  const d = z.z1 - z.z0;
  const cx = (z.x0 + z.x1) / 2;
  const cz = (z.z0 + z.z1) / 2;

  if (!isWalled(r) && r.id !== "passage") rect("A-FLOR-OTLN", z.x0, z.z0, z.x1, z.z1);

  const name = r.name.toUpperCase();
  const size = `${ftIn(w)} X ${ftIn(d)}`;
  const longest = Math.max(name.length, size.length * 0.8);
  let h = 0.13;
  const vertical = longest * CHAR_W * h > w * 0.9 && d > 1.6 * w; // long thin zones only
  h = Math.min(h, ((vertical ? d : w) * 0.9) / (longest * CHAR_W));
  const sh = h * 0.8;
  const gap = (h + sh) * 0.6;
  if (vertical) {
    text("A-AREA-IDEN", [cx - gap / 2, cz], name, h, "middle", 90);
    text("A-AREA-IDEN", [cx + gap / 2, cz], size, sh, "middle", 90);
  } else {
    text("A-AREA-IDEN", [cx, cz - gap / 2], name, h);
    text("A-AREA-IDEN", [cx, cz + gap / 2], size, sh);
  }
}

// ---------------------------------------------------------------------------
// Dimensions — exterior chain (faces of exterior rooms) + overall, each side
// ---------------------------------------------------------------------------

const B = wallBounds;
const solidRects = [...wallRects, ...openingRects];
const DIM_TXT = 0.09;
const TICK = 0.045;

/** Outermost wall face on `side` at position p along that side. */
function objEdge(side, p) {
  const hz = side === "north" || side === "south";
  const hits = solidRects.filter((r) =>
    hz ? r.x0 - 1e-4 <= p && p <= r.x1 + 1e-4 : r.z0 - 1e-4 <= p && p <= r.z1 + 1e-4
  );
  if (!hits.length) return { north: B.minZ, south: B.maxZ, west: B.minX, east: B.maxX }[side];
  if (side === "north") return Math.min(...hits.map((r) => r.z0));
  if (side === "south") return Math.max(...hits.map((r) => r.z1));
  if (side === "west") return Math.min(...hits.map((r) => r.x0));
  return Math.max(...hits.map((r) => r.x1));
}

function dimString(side, points, offset) {
  const hz = side === "north" || side === "south";
  const sign = side === "north" || side === "west" ? -1 : 1;
  const base = { north: B.minZ, south: B.maxZ, west: B.minX, east: B.maxX }[side];
  const L = base + sign * offset;
  const at = (p, q) => (hz ? [p, q] : [q, p]);

  line("A-ANNO-DIMS", at(points[0], L), at(points[points.length - 1], L));
  for (const p of points) {
    line("A-ANNO-DIMS", at(p, objEdge(side, p) + sign * 0.06), at(p, L + sign * 0.08));
    line("A-ANNO-DIMS", at(p - TICK, L + TICK), at(p + TICK, L - TICK));
  }
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i], b = points[i + 1];
    const label = ftIn(b - a);
    const fits = label.length * CHAR_W * DIM_TXT < (b - a) * 0.95;
    const lift = fits ? 0.07 : 0.2; // text sits above the line; tiny spans lifted clear
    if (hz) text("A-ANNO-DIMS", [(a + b) / 2, L - lift], label, DIM_TXT);
    else text("A-ANNO-DIMS", [L - lift, (a + b) / 2], label, DIM_TXT, "middle", 90);
  }
}

/** Break points for a side: outer wall faces + clear faces of rooms exposed on that side. */
function exteriorPoints(side) {
  const hz = side === "north" || side === "south";
  const pts = hz ? [B.minX, B.maxX] : [B.minZ, B.maxZ];
  for (const z of zones) {
    if (!isWalled(z.room)) continue;
    const blocked = zones.some((o) => {
      if (o === z) return false;
      const ov = hz ? Math.min(z.x1, o.x1) - Math.max(z.x0, o.x0) : Math.min(z.z1, o.z1) - Math.max(z.z0, o.z0);
      if (ov <= EPS) return false;
      if (side === "north") return o.z1 <= z.z0 + EPS;
      if (side === "south") return o.z0 >= z.z1 - EPS;
      if (side === "west") return o.x1 <= z.x0 + EPS;
      return o.x0 >= z.x1 - EPS;
    });
    if (!blocked) pts.push(...(hz ? [z.x0, z.x1] : [z.z0, z.z1]));
  }
  pts.sort((a, b) => a - b);
  return pts.filter((p, i) => i === 0 || p - pts[i - 1] > 0.02);
}

for (const side of ["north", "south", "west", "east"]) {
  const hz = side === "north" || side === "south";
  dimString(side, exteriorPoints(side), 0.8);
  dimString(side, hz ? [B.minX, B.maxX] : [B.minZ, B.maxZ], 1.3);
}

// ---------------------------------------------------------------------------
// Sheet: north arrow, scale, schedule, area statement, notes, title block
// ---------------------------------------------------------------------------

const PX = B.maxX + 2.1; // panel left edge
const PW = 4.6; // panel width
let y = B.minZ - 1.3;

function heading(s) {
  text("A-ANNO-TEXT", [PX, y], s, 0.12, "start");
  line("A-ANNO-TEXT", [PX, y + 0.12], [PX + PW, y + 0.12]);
  y += 0.35;
}

// Drawing title + north arrow
{
  const c = [PX + PW - 0.5, y + 0.3];
  const ang = Math.atan2(NORTH_DIRECTION.x, -NORTH_DIRECTION.z);
  const rot = ([u, v]) => [c[0] + u * Math.cos(ang) - v * Math.sin(ang), c[1] + u * Math.sin(ang) + v * Math.cos(ang)];
  circle("A-ANNO-SYMB", c, 0.32);
  poly("A-ANNO-SYMB", [rot([0, -0.4]), rot([0.14, 0.22]), rot([0, 0.1]), rot([-0.14, 0.22])]);
  fill("A-ANNO-SYMB", null, [rot([0, -0.4]), rot([0, 0.1]), rot([-0.14, 0.22])]);
  text("A-ANNO-SYMB", rot([0, -0.56]), "N", 0.14);

  text("A-ANNO-TEXT", [PX, y + 0.1], "FLOOR PLAN", 0.24, "start");
  text("A-ANNO-TEXT", [PX, y + 0.5], "FLAT - PLAN OPTION 1", 0.12, "start");
  y += 1.1;
}

// Graphic scale: 0-15 ft — five 1 ft blocks, then two 5 ft blocks
{
  const f = 0.3048;
  const hgt = 0.08;
  const blocks = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 10], [10, 15]];
  blocks.forEach(([a, b], i) => {
    const r = { x0: PX + a * f, x1: PX + b * f, z0: y, z1: y + hgt };
    if (i % 2 === 0) fill("A-ANNO-SYMB", r);
    rect("A-ANNO-SYMB", r.x0, r.z0, r.x1, r.z1);
  });
  for (const v of [0, 5, 10, 15]) text("A-ANNO-SYMB", [PX + v * f, y + 0.22], `${v}`, 0.07);
  text("A-ANNO-SYMB", [PX + 15 * f + 0.12, y + 0.04], "FT", 0.07, "start");
  y += 0.7;
}

// Door & window schedule
heading("DOOR & WINDOW SCHEDULE");
const cols = [0, 0.55, 3.2, 4.3];
["MARK", "DESCRIPTION", "W X H", "NOS"].forEach((h, i) => text("A-ANNO-TEXT", [PX + cols[i], y], h, 0.075, "start"));
y += 0.22;
for (const row of schedule) {
  const cells = [row.mark, DESC[row.type], `${ftIn(row.width)} X ${ftIn(row.height)}`, `${row.count}`];
  cells.forEach((c, i) => text("A-ANNO-TEXT", [PX + cols[i], y], c, 0.07, "start"));
  y += 0.18;
}
y += 0.3;

// Area statement — clear floor areas
heading("AREA STATEMENT (CLEAR FLOOR AREA)");
let total = 0;
for (const z of zones) {
  const a = (z.x1 - z.x0) * (z.z1 - z.z0) * M_TO_FT * M_TO_FT;
  total += a;
  text("A-ANNO-TEXT", [PX, y], z.room.name.toUpperCase(), 0.07, "start");
  text("A-ANNO-TEXT", [PX + PW, y], `${a.toFixed(1)} SQ.FT`, 0.07, "end");
  y += 0.17;
}
line("A-ANNO-TEXT", [PX + PW - 1.2, y - 0.08], [PX + PW, y - 0.08]);
text("A-ANNO-TEXT", [PX, y + 0.02], "TOTAL OF ZONES ABOVE", 0.075, "start");
text("A-ANNO-TEXT", [PX + PW, y + 0.02], `${total.toFixed(1)} SQ.FT`, 0.075, "end");
y += 0.5;

// Notes
heading("NOTES");
const notes = [
  "1. ALL DIMENSIONS IN FEET-INCHES. DO NOT SCALE DRAWING.",
  "2. ROOM SIZES ARE CLEAR INTERNAL DIMENSIONS.",
  `3. WALLS ${ftIn(WALL_THICKNESS)} THK. UNLESS DIMENSIONED OTHERWISE.`,
  `4. FLOOR TO CEILING ${ftIn(WALL_HEIGHT)}. DOOR / OPENING HEAD ${ftIn(DOOR_HEIGHT)}.`,
  "5. ROOM SIZES FROM DEVELOPER PLAN 'OPTION 1'. ROOM POSITIONS",
  "   TRACED FROM THAT PLAN - VERIFY ON SITE BEFORE FABRICATION.",
  "6. DOOR AND GLAZING SIZES / POSITIONS NOMINAL, NOT MEASURED.",
  "7. NORTH AS PER DEVELOPER PLAN - TO BE CONFIRMED ON SITE.",
];
for (const n of notes) {
  text("A-ANNO-TEXT", [PX, y], n, 0.07, "start");
  y += 0.17;
}
y += 0.4;

// Title block
{
  const rows = [
    ["PROJECT", "RESIDENTIAL FLAT - PUNE"],
    ["DRAWING", "FLOOR PLAN - OPTION 1"],
    ["CARPET AREA", "940 SQ.FT (AS PER DEVELOPER PLAN)"],
    ["SCALE", "GRAPHIC - SEE SCALE BAR"],
    ["UNITS", "FEET-INCHES (DXF: INCHES)"],
    ["DATE", new Date().toISOString().slice(0, 10)],
    ["SOURCE", "GENERATED FROM roomData.js"],
  ];
  const RH = 0.26;
  rect("A-ANNO-TTLB", PX, y, PX + PW, y + RH * rows.length);
  line("A-ANNO-TTLB", [PX + 1.15, y], [PX + 1.15, y + RH * rows.length]);
  rows.forEach(([k, v], i) => {
    const ry = y + i * RH;
    if (i) line("A-ANNO-TTLB", [PX, ry], [PX + PW, ry]);
    text("A-ANNO-TEXT", [PX + 0.08, ry + RH / 2], k, 0.065, "start");
    text("A-ANNO-TEXT", [PX + 1.25, ry + RH / 2], v, 0.08, "start");
  });
}

// Sheet border around everything
const ext = (() => {
  const xs = [], zs = [];
  for (const p of P) {
    const pts =
      p.t === "line" ? [p.a, p.b]
      : p.t === "poly" ? p.pts
      : p.t === "fill" ? (p.r ? [[p.r.x0, p.r.z0], [p.r.x1, p.r.z1]] : p.pts)
      : p.t === "text" ? [p.p]
      : [[p.c[0] - p.r, p.c[1] - p.r], [p.c[0] + p.r, p.c[1] + p.r]];
    for (const [x, z] of pts) xs.push(x), zs.push(z);
  }
  const m = 0.45;
  return { x0: Math.min(...xs) - m, x1: Math.max(...xs) + m, z0: Math.min(...zs) - m, z1: Math.max(...zs) + m };
})();
rect("A-ANNO-TTLB", ext.x0, ext.z0, ext.x1, ext.z1);

// ---------------------------------------------------------------------------
// Writers
// ---------------------------------------------------------------------------

function toSVG() {
  const S = 90; // px per metre on screen
  const X = (x) => ((x - ext.x0 + 0.2) * S).toFixed(2);
  const Y = (z) => ((z - ext.z0 + 0.2) * S).toFixed(2);
  const W = ((ext.x1 - ext.x0 + 0.4) * S).toFixed(0);
  const H = ((ext.z1 - ext.z0 + 0.4) * S).toFixed(0);
  const stroke = (layer) => {
    const L = LAYERS[layer];
    const sw = Math.max(0.6, L.pen * 3.2).toFixed(2);
    return `stroke="#000" stroke-width="${sw}"${L.dashed ? ` stroke-dasharray="${S * 0.08} ${S * 0.05}"` : ""}`;
  };
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const byLayer = {};
  for (const p of P) (byLayer[p.layer] ||= []).push(p);

  const out = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Arial, Helvetica, sans-serif">`,
    `<rect width="100%" height="100%" fill="#fff"/>`,
  ];
  // Poché first so everything else draws over it
  const order = ["A-WALL-PATT", ...Object.keys(LAYERS).filter((l) => l !== "A-WALL-PATT")];
  for (const layer of order) {
    const items = byLayer[layer];
    if (!items) continue;
    out.push(`<g id="${layer}">`);
    for (const p of items) {
      if (p.t === "fill") {
        const d = p.r
          ? `M${X(p.r.x0)},${Y(p.r.z0)}H${X(p.r.x1)}V${Y(p.r.z1)}H${X(p.r.x0)}Z`
          : `M${p.pts.map(([x, z]) => `${X(x)},${Y(z)}`).join("L")}Z`;
        out.push(`<path d="${d}" fill="${layer === "A-WALL-PATT" ? "#3c3c3c" : "#000"}" shape-rendering="crispEdges"/>`);
      } else if (p.t === "line") {
        out.push(`<line x1="${X(p.a[0])}" y1="${Y(p.a[1])}" x2="${X(p.b[0])}" y2="${Y(p.b[1])}" ${stroke(layer)} stroke-linecap="square"/>`);
      } else if (p.t === "poly") {
        const pts = p.pts.map(([x, z]) => `${X(x)},${Y(z)}`).join(" ");
        out.push(`<${p.closed ? "polygon" : "polyline"} points="${pts}" fill="${layer === "A-DOOR" || layer === "A-GLAZ" ? "#fff" : "none"}" ${stroke(layer)}/>`);
      } else if (p.t === "arc") {
        const [cx, cz] = p.c;
        const a = [cx + p.r * Math.cos(p.t0), cz + p.r * Math.sin(p.t0)];
        const b = [cx + p.r * Math.cos(p.t1), cz + p.r * Math.sin(p.t1)];
        const large = p.t1 - p.t0 > Math.PI ? 1 : 0;
        const r = (p.r * S).toFixed(2);
        out.push(`<path d="M${X(a[0])},${Y(a[1])}A${r},${r} 0 ${large} 1 ${X(b[0])},${Y(b[1])}" fill="none" ${stroke(layer)}/>`);
      } else if (p.t === "circle") {
        out.push(`<circle cx="${X(p.c[0])}" cy="${Y(p.c[1])}" r="${(p.r * S).toFixed(2)}" fill="#fff" ${stroke(layer)}/>`);
      } else if (p.t === "text") {
        const fs = ((p.h / 0.72) * S).toFixed(2);
        const tr = p.rot ? ` transform="rotate(${-p.rot} ${X(p.p[0])} ${Y(p.p[1])})"` : "";
        out.push(`<text x="${X(p.p[0])}" y="${Y(p.p[1])}" font-size="${fs}" text-anchor="${p.anchor}" dominant-baseline="central"${tr}>${esc(p.s)}</text>`);
      }
    }
    out.push(`</g>`);
  }
  out.push(`</svg>`);
  return out.join("\n");
}

function toDXF() {
  // AutoCAD R12 ASCII DXF. Drawing units = inches, Y up (north up).
  const IN = 1 / 0.0254;
  const X = (x) => (x * IN).toFixed(4);
  const Y = (z) => (-z * IN).toFixed(4);
  const o = [];
  const g = (code, v) => o.push(String(code), String(v));
  const deg = (t) => ((((-t * 180) / Math.PI) % 360) + 360) % 360; // Y flip

  g(0, "SECTION"); g(2, "HEADER");
  g(9, "$ACADVER"); g(1, "AC1009");
  g(9, "$INSUNITS"); g(70, 1);
  g(9, "$LUNITS"); g(70, 4);
  g(0, "ENDSEC");

  g(0, "SECTION"); g(2, "TABLES");
  g(0, "TABLE"); g(2, "LTYPE"); g(70, 2);
  g(0, "LTYPE"); g(2, "CONTINUOUS"); g(70, 0); g(3, "Solid line"); g(72, 65); g(73, 0); g(40, 0.0);
  g(0, "LTYPE"); g(2, "DASHED"); g(70, 0); g(3, "__ __ __"); g(72, 65); g(73, 2); g(40, 9.0); g(49, 6.0); g(49, -3.0);
  g(0, "ENDTAB");
  g(0, "TABLE"); g(2, "LAYER"); g(70, Object.keys(LAYERS).length);
  for (const [name, L] of Object.entries(LAYERS)) {
    g(0, "LAYER"); g(2, name); g(70, 0); g(62, L.color); g(6, L.dashed ? "DASHED" : "CONTINUOUS");
  }
  g(0, "ENDTAB");
  g(0, "ENDSEC");

  g(0, "SECTION"); g(2, "ENTITIES");
  for (const p of P) {
    if (p.t === "line") {
      g(0, "LINE"); g(8, p.layer);
      g(10, X(p.a[0])); g(20, Y(p.a[1])); g(30, 0);
      g(11, X(p.b[0])); g(21, Y(p.b[1])); g(31, 0);
    } else if (p.t === "poly") {
      g(0, "POLYLINE"); g(8, p.layer); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, p.closed ? 1 : 0);
      for (const [x, z] of p.pts) {
        g(0, "VERTEX"); g(8, p.layer); g(10, X(x)); g(20, Y(z)); g(30, 0);
      }
      g(0, "SEQEND"); g(8, p.layer);
    } else if (p.t === "fill") {
      // SOLID vertex order is 1-2-4-3 (Z-shaped)
      const q = p.r
        ? [[p.r.x0, p.r.z0], [p.r.x1, p.r.z0], [p.r.x0, p.r.z1], [p.r.x1, p.r.z1]]
        : [p.pts[0], p.pts[1], p.pts[2], p.pts[2]];
      g(0, "SOLID"); g(8, p.layer);
      q.forEach(([x, z], i) => {
        g(10 + i, X(x)); g(20 + i, Y(z)); g(30 + i, 0);
      });
    } else if (p.t === "arc") {
      g(0, "ARC"); g(8, p.layer);
      g(10, X(p.c[0])); g(20, Y(p.c[1])); g(30, 0); g(40, (p.r * IN).toFixed(4));
      g(50, deg(p.t1).toFixed(4)); g(51, deg(p.t0).toFixed(4));
    } else if (p.t === "circle") {
      g(0, "CIRCLE"); g(8, p.layer);
      g(10, X(p.c[0])); g(20, Y(p.c[1])); g(30, 0); g(40, (p.r * IN).toFixed(4));
    } else if (p.t === "text") {
      g(0, "TEXT"); g(8, p.layer);
      g(10, X(p.p[0])); g(20, Y(p.p[1])); g(30, 0);
      g(40, (p.h * IN).toFixed(4)); g(1, p.s);
      if (p.rot) g(50, p.rot);
      g(72, { start: 0, middle: 1, end: 2 }[p.anchor]);
      g(11, X(p.p[0])); g(21, Y(p.p[1])); g(31, 0);
      g(73, 2);
    }
  }
  g(0, "ENDSEC");
  g(0, "EOF");
  return o.join("\r\n") + "\r\n";
}

writeFileSync(new URL("./floor-plan.svg", import.meta.url), toSVG());
writeFileSync(new URL("./floor-plan.dxf", import.meta.url), toDXF());

console.log(`floor-plan.svg + floor-plan.dxf written — ${P.length} entities`);
for (const o of openings) if (o.orphan) console.log(`WARNING  ${o.room.name} ${o.side} ${o.type} lies on no wall`);
for (let i = 0; i < zones.length; i++) {
  for (let j = i + 1; j < zones.length; j++) {
    const a = zones[i], b = zones[j];
    if (Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0.01 && Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > 0.01) {
      console.log(`WARNING  ${a.room.name} overlaps ${b.room.name}`);
    }
  }
}
