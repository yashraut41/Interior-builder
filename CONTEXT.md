# Project context

Read this first. It carries the decisions made before this repo existed, so a
fresh session doesn't re-litigate them.

## What this is

A 3D virtual walkthrough of **one specific flat** — the owner's own, already
purchased. Floor plan "OPTION 1", 940 sq.ft carpet area, Pune.

This is **not** a generic floor-plan-to-3D app. Nobody else's plan needs to
work. Don't build import pipelines, plan parsers, or per-user abstractions.

## Why it exists

The owner wants to make interior decisions himself before engaging an interior
designer — see wall colours, check whether furniture fits, understand light at
different times of day.

Confidence bar for furniture fit is roughly "this IKEA piece is 2.1m, the wall
is 2.4m, it'll probably work" — visualisation, not construction drawings.
Accuracy matters, but nobody is ordering joinery off this.

## Decisions already made

- **Shell in code, furniture in Blender.** Walls/floors/ceilings are generated
  from numbers in `roomData.js`. Change a dimension, everything updates.
  Do NOT bake the shell into a mesh file. Furniture will come later as glTF/GLB
  imports (downloaded models or modelled in Blender).
- **Vanilla JS + Three.js + Vite.** Hobby project. Flat file structure, no
  framework, no state library, no nested architecture. Keep it that way.
- **No door or window meshes.** An opening is a missing wall segment, nothing
  more. No swinging doors. *Exception (owner's request, 2026-09-30):* a
  window with a `frame` gets an aluminium glazing mesh — Yash Room's west
  wall is a floor-to-ceiling partition, two fixed panes below a 3'-0"
  transom and two sliding sashes above.
- **Ceiling visible in pano mode, hidden in dollhouse view.**
- **Hotspots at room centres**, and (since 2026-10-01, owner's call) **WASD
  walking with collision**. The original reason for locking the camera —
  clipping outside the model — is handled by colliding against the wall model:
  doorways, openings and sliding glass doors are passable; walls, windows and
  the main door (leads outside) are not. Arrow keys turn / look up-down.
- **Ceiling height 10'.** Standard local slab height, no double-height areas.
- **Garden area excluded** — it appeared on an early crop by mistake.

## Current state

Shell with openings, from the owner's colour-coded markup of
`floor-plan.svg` (2026-09-28):

- **window** — floor-to-ceiling window: Parents Room and Yash Room west walls
- **glass** — floor-to-ceiling sliding glass door (red on the markup)
- **door** — ordinary wooden door, wall continues above 7' (green)
- **opening** — bare opening, no door, lintel at 7' (blue; also lobby -> kitchen)

Each opening is listed once in `roomData.js` and cuts every wall on its line,
so shared partitions get the gap on both rooms' walls. Sizes are standard
(3'-0" bedroom, 2'-6" toilet, 3'-6" main door) placed from the markup, not
measured.

The toilet between Parents Room and Yash Room belongs to **Yash Room**
(`toilet_yash`), entered from Yash Room, not the passage.

**Walls** (`walls.js`, shared by 3D and drawing): room footprints are CLEAR
internal sizes and walls sit outside them, so printed room sizes are true
inside. A shared partition is one wall. Walls take thickness from 'open'
zones (passage), never from rooms. Doors carry `hinge` / `swing`.

**Drawing**: `node plan.js` writes `floor-plan.svg` and `floor-plan.dxf`
(R12, inches, AIA layer names) from the same primitives. It must follow
standard architectural plan conventions — poché walls, door leaf + swing arc,
sliding panels on tracks, dashed heads over bare openings, chain + overall
dimension strings, door/window marks with a schedule, north arrow, graphic
scale, title block. Never the owner's colour-coded markup convention.

**Lighting** (2026-10-01): neutral viewing light for judging colour — a
`RoomEnvironment` image-based light + `NeutralToneMapping`, no point lights,
no shadow maps. The owner found the shadowed sun + point-light setup made
colours unreadable (jagged shadows, hot spots). This stays the default view.

**Sun** (2026-10-01): the "Sun" checkbox swaps the neutral light for daylight
on the real sun path — date, time slider (▶ runs the clock at 1 h/s), sun
compass direction and altitude shown. `sun.js` is NOAA's solar equations for
`SITE` (Pune, IST) in `roomData.js`; checked against solstice noon
altitudes. One shadowed `DirectionalLight` (4096 PCF soft map) + hemisphere
sky fill + a low ambient. A shadow-only slab (`colorWrite: false`) over the
whole flat stands in for the floor above, so sun only gets in through the
openings — in dollhouse view too. Fill light is uniform, so a windowless
room is as bright as a windowed one; real bounce light waits for the PBR pass.
Settings persist in localStorage. Night is just a dark sky — no interior
lights yet.

**Orientation** is `PLAN_UP_BEARING` in `roomData.js` (true bearing that
up-the-sheet faces; 0 = the plan's north arrow is right). `NORTH_DIRECTION`
and the drawing's north arrow derive from it. The Sun panel's "Plan up" box
tries values live; paste the confirmed one into `roomData.js`.

**Room-to-room travel** (2026-10-01): inside a room, the other rooms'
hotspots float at ~3'-6", face the camera and scale with distance. They are
depth-tested, so you only see (and can click) rooms visible through a doorway,
opening or glass; clicking glides there, turning to face the way you went.
Works alongside WASD walking (see Decisions).

**Controls help** (2026-10-01): first visit shows a welcome card with the
controls (remembered per browser); after that a "Controls" panel sits
bottom-right, toggled with H. Touch devices get touch instructions. The owner
will decide later whether to keep both.

**Export**: the "Export flat.json" button writes the architecture (floors,
walls, lintels, thresholds, ceilings — no hotspots) via `Object3D.toJSON()`.
Open in the three.js editor with File -> Import. Metres, Y up, -Z north.

**Finishes** (2026-09-30): a room's look — wall paint, skirting, ceiling,
floor (plain or procedural carpet), optional downlight — lives in its
`finish` entry in `roomData.js`. Paint and skirting are thin layers on that
room's inner faces only, so a shared partition can differ on each side; the
wall boxes themselves stay neutral. The downlight is a fixture only (no
light source). First room done: **Yash Room**, matched to the owner's
reference renders (deep teal walls, white skirting/ceiling, light grey
carpet). Furniture from those renders deliberately skipped for now.

**Wall colour controls** (2026-09-30): the top-right panel recolours any
walled room's paint live, in dollhouse and pano alike (entering a room selects
it). Every walled zone now has a paint layer; rooms without a `finish` get it
in the neutral wall colour and no skirting. Picks persist in the browser's
localStorage only — the panel shows the hex (`0x......`) to paste into that
room's `finish.wall` once decided; Reset goes back to `roomData.js`. Export
includes the current picks.

**TV wall** (2026-10-04): Living & Dining's `tvWall` in `roomData.js` — the
solid 6'-10" of west wall between the balcony slider (SD2) and the Parents
Room door (D2). Full-height fluted walnut panel, floating off-white console
(6'-0" x 14" deep, 8" off the floor), 65" TV centred at 42". Built in code
(`buildTvWall` in `rooms.js`), not a model: a TV is a box, and exact real
dimensions matter more than looks. Sized from a planned L-sofa against the
kitchen wall, ~9' away (RTINGS: 65" is the 30° minimum there, 75" the sweet
spot; owner chose 65"). Walking collision doesn't know about it yet.

**Kitchen + utility joinery** (2026-10-05): `kitchen.js`, from the
designer's elevation sheet `KITCHEN-Model.pdf` (plan + elevations AA-DD). The
sheet has no dimension strings; numbers were read from its vector geometry,
scaled so the kitchen's drawn length = 11'-7" (its plan proportions match ours
to <1%). Worktop 2'-8 1/2"; base 23.4" deep; wall units 13.2" deep, 5'-3" to
7'-3"; lofts to the ceiling. East wall (BB): drawers, hob + chimney between two
glass-profile units, sink. West wall (DD): mandir (north end), drawer bank with
open shelf / niche / fluted-glass units, appliance tower, fridge. Utility (the
Dry Balcony): sink run east, washing machine + tall storage west. The two DD
drawings are one tower **open vs closed** (fluted shutter over microwave +
mixer) — `APPLIANCE_TOWER` in `kitchen.js`. Finishes are placeholders
(graphite base, light oak uppers, white quartz) — owner has no picks yet.
Plan changes from the sheet: kitchen<->utility is a wall with sliding glass
(SD1) only from the west wall to where the worktop starts (5'-5 1/2"), per
owner; lobby->kitchen opening OP2 narrowed to 2'-8 1/4" — the west 15 3/4" is
a stub wall behind the mandir.
Open questions: the designer drew the ceiling at ~8'-7 1/2" (model: 10'),
so lofts here are taller than designed; the drawing aligns the utility's EAST
face with the kitchen's (model aligns the west — 4" difference); the fridge
stands in front of the west end of the SD1 glass, as drawn.

**Utility end + door** (2026-10-06, owner): the utility (Dry Balcony) faces
the building's inner shaft. Its south wall is a `railing` opening — 3'-0"
half wall, slim black rod ~10" above it on vertical rods ~2' apart, open
above. Openings now carry a `sill` (wall kept below it); railings are never
walkable. SD1 (kitchen <-> utility) has a frosted sliding door
(`slide: "utility_door"`): two panels on two tracks under a fixed frosted
transom at 7'; the east panel slides over the west one. "Open / Close utility
door" button shows while you're in the kitchen or utility; walking through
needs it open (hotspot travel ignores it).

**Kitchen themes** (2026-10-06): `THEMES` in `kitchen.js` — 9 complete
palettes from 2026 trend round-ups (two-tone light-over-dark, warm neutrals,
woods, top Indian modular combos). Each sets base shutters, uppers / lofts /
tall units, worktop, backsplash, metal accents (glass-profile frames) and the
kitchen + utility wall paint. The "Kitchen theme" swatch panel (dollhouse,
kitchen, utility) switches live; the pick is remembered per browser. Walls go
through the wall colour picks, so that panel can still fine-tune them.
Mandir, appliances, hob, steel stay fixed across themes.

`/#<room_id>` (e.g. `/#yash_room`) opens straight into that room.

## Accuracy status

- Room **widths and depths** — read off the printed plan dimensions. Trust them.
- Room **positions** — traced from the plan drawing. Good to a few inches,
  not surveyed.
- Traced indoor area sums to ~806 sq.ft against the plan's stated 940 carpet
  area. The gap is wall thickness, the untraced niches (mandir, storage, shoe
  rack, wardrobe recesses) and small column gaps. Expected, not a bug.
- **Orientation**: the plan's north arrow points up the sheet, mapped to -Z
  (`PLAN_UP_BEARING = 0`). STILL UNCONFIRMED against the real building — the
  sun is only as right as this number.

## Immediate next step

Confirm the flat's real orientation (compass / map) and set
`PLAN_UP_BEARING`. Room look & feel continues one room at a time (Yash Room
done).

## Planned after that

1. ~~Wall colour controls (per-room, live)~~ done
2. ~~Day/night lighting with correct sun path~~ done, pending orientation
3. Furniture import and placement
4. Realistic / PBR rendering pass — last, explicitly

Functionality first, realism last. That order was chosen deliberately.

## Working notes

- `roomData.js` is the single source of truth. If the layout is wrong,
  that's the only file to fix.
- Dimensions are authored in feet/inches via `ft()` and stored in metres.
- The owner knows 3D well (3ds Max background), so explanations can assume
  familiarity with meshes, planes, transforms and lighting.
