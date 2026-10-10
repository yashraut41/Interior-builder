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
- **glass** — sliding glass door (red on the markup); floor-to-ceiling unless
  it carries a `height`
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

**Yash Room layouts** (2026-10-07): `yashRoom.js` — true-size planning
blocks for the owner's home-coding setup, switchable live from the "Yash Room
layout" panel (dollhouse + Yash Room; remembered per browser):
1 Balanced (6' + 3' L-desk NW corner facing north, 4'6" bed headboard-south, 6' wardrobe on the south wall),
1b Designer's (interior designer's suggestion: Balanced with the bed turned
east-west along the south wall, so the desk drops to 4'), 2 Coder first
(L-desk 6' + 3' return in the NW corner, 3'6" bed along the south wall,
4' wardrobe + loft SW). Desks sit on the north/south walls so the glass wall
gives side light, not screen glare.
**Owner's pick (2026-10-07): 1 Balanced**, now the default. Head must point
SOUTH while sleeping, and Balanced is the only layout with the bed north-south
(headboard on the south wall); 1b and 2 put the head east. It also keeps the
full 6' for both wardrobe and desk. Balanced now carries Coder first's
L-desk in the same NW corner (owner, 2026-10-07: wants to FACE NORTH while
working): 6' top on the north wall + 3' return (30" deep) south along the
glass wall; the 6' wardrobe moved to the south wall (x 0-72), beside the
headboard. 30" clear between the return and the wardrobe front, 45" between
the return and the bed.
A "Vastu-aligned layout" card (top-left) explains the placement whenever
Balanced is selected, in the dollhouse and Yash Room: bed head south, desk
facing north, heavy wardrobe on the south wall. Text lives in the layout's
`vastu` entry in `yashRoom.js`. Collision doesn't know
the furniture yet.

**Balconies + Parents Room glazing** (2026-10-10, owner's site photo): both
balconies are open on their west edge — a `grill` opening: 4" kerb, vertical
bars at ~4 1/2", flat handrail at 3'-6", open above; never walkable. Their
doors to the Living room / Bhagyesh Room are two-panel clear sliding doors in
a dark frame with wall above 7' (`height: DOOR_HEIGHT`, `clear: true`,
`slide: "living_balcony_door"` / `"bhagyesh_balcony_door"`). The Open / Close
door button now serves whichever sliding door is beside the room you're in
(`DOORS` in `main.js`). Parents Room's west wall has the same framed glazing
as Yash Room's. Sizes are from the photo by eye, not measured; the west edge
as the open side is read from the photo and the plan.

**Orientation + height references** (2026-10-10): a compass bottom-left turns
with the view in both modes and reads the bearing you face ("Facing NE 51°");
inside a room it also gives eye and ceiling height. Dollhouse only
(`reference.js`): N / E / S / W markers just outside the flat at wall-top
height, a ground arrow at north, and a level staff at the north-east corner —
a collar every foot, labels at floor, eye, lintel and ceiling. All follow the
Sun panel's "Plan up", so they are only as right as `PLAN_UP_BEARING`. Not
clickable, not in the export.

**Yash Room desk wall** (2026-10-10, owner's reference photos — black wall,
walnut slats, warm LED glow): the north wall behind the desk, glass to toilet
door, in layouts with `deskWall: true` (Balanced only). Three looks to choose
from, `DESK_WALLS` in `yashRoom.js`, switched from "Desk wall" in the layout
panel (remembered per browser); **owner has not picked yet**:
A Charcoal & amber (closest to the photos: black board, two slat panels,
staggered shelves, amber strips incl. the corner; other walls warm oat),
B Walnut slat wall (slats wall to wall and floor to ceiling, one long black
shelf, warm-white ceiling cove; other walls warm oat), C Teal study (the
earlier deep teal `0x22596d` on every wall, one slat panel behind the
monitors, two walnut shelves, softer warm-white strips). Like a kitchen theme,
picking a look also sets the room's wall paint through the wall colour picks.
`roomData.js` default paint is A's warm oat (`0xd8d1c6`; was teal). All looks
share the walnut desk on black legs with a desk mat, a globe lamp and a dark
rug (the monitor riser and speakers from the first pass are gone). Strips are `RectAreaLight`s + a `PointLight` in the
lamp — the one exception to "no point lights"; they sit in each look's group,
so only the visible look lights the room. "Evening mood" (layout panel, on by
default) dims the neutral light to 30% while you stand in Yash Room so the
LEDs carry the room; the dollhouse and other rooms stay neutral. Sizes and
LED intensities are by eye, tuned against screenshots.

**Desk kit as real models** (2026-10-10, owner: the blocks looked like
Roblox): `models/*.glb`, loaded in `yashRoom.js` (`MODELS`, `place()`), each
scaled to its true size and dropped where its planning block stands. The
block shows until the model arrives and stays if the file fails, and the
`flat.json` export still carries the blocks, not the models. Monitor (27"),
Fractal Meshify C tower, MacBook Pro 16", Logitech keyboard + mouse, mesh
office chair — all CC BY from Sketchfab via the Objaverse archive, credits in
`models/CREDITS.md`, 2.7 MB in total after `gltf-transform optimize`. In every
layout the monitors, keyboard, mouse and chair are models; wardrobe, bed and
desk stay blocks. Balanced carries the owner's actual kit: ONE monitor on a
monitor arm (arm built in code; the model's stand is cut off by coordinates,
which is why `monitor.glb` is not optimised), the tower on the desk's east
end, and the MacBook — used on its own — open on the L-return, facing the
glass. Monitor size (27") and the PC / MacBook models are stand-ins: the
owner hasn't said what he has. Model meshes are skipped by hotspot picking.

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
