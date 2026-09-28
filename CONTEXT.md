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
  from numbers in `src/roomData.js`. Change a dimension, everything updates.
  Do NOT bake the shell into a mesh file. Furniture will come later as glTF/GLB
  imports (downloaded models or modelled in Blender).
- **Vanilla JS + Three.js + Vite.** Hobby project. Flat file structure, no
  framework, no state library, no nested architecture. Keep it that way.
- **No door or window meshes.** An opening is a missing wall segment, nothing
  more. No swinging doors.
- **Ceiling visible in pano mode, hidden in dollhouse view.**
- **Hotspots at room centres.** Clicking one locks the camera to that spot —
  look around freely, cannot move. Free roaming is deliberately deferred; the
  lock prevents the user clipping outside the model.
- **Ceiling height 10'.** Standard local slab height, no double-height areas.
- **Garden area excluded** — it appeared on an early crop by mistake.

## Current state

Shell only. Every room is a sealed box at its plan dimensions. No openings
anywhere yet — that is intentional and is the next step.

## Accuracy status

- Room **widths and depths** — read off the printed plan dimensions. Trust them.
- Room **positions** — traced from the plan drawing. Good to a few inches,
  not surveyed.
- Traced indoor area sums to ~806 sq.ft against the plan's stated 940 carpet
  area. The gap is wall thickness, the untraced niches (mandir, storage, shoe
  rack, wardrobe recesses) and small column gaps. Expected, not a bug.
- **Orientation**: the plan's north arrow points up the sheet, mapped to -Z.
  Confirm against the real building before building the sun / day-night
  feature — sunlight is only meaningful if north is real.

## Immediate next step

The owner marks up a screenshot of the shell showing where windows, doors and
openings actually go, which walls are full glass, and where the balconies and
dry balcony open. Then openings get cut into `roomData.js`. Wait for that
markup — don't guess openings.

## Planned after that

1. Wall colour controls (per-room, live)
2. Day/night lighting with correct sun path for the flat's orientation
3. Furniture import and placement
4. Realistic / PBR rendering pass — last, explicitly

Functionality first, realism last. That order was chosen deliberately.

## Working notes

- `src/roomData.js` is the single source of truth. If the layout is wrong,
  that's the only file to fix.
- Dimensions are authored in feet/inches via `ft()` and stored in metres.
- The owner knows 3D well (3ds Max background), so explanations can assume
  familiarity with meshes, planes, transforms and lighting.
