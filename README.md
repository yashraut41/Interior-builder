# Flat Walkthrough

3D walkthrough of the "OPTION 1" flat — 940 sq.ft carpet, 3 bedrooms.

Read `CONTEXT.md` before changing anything; it carries the project decisions.

## Run it

```bash
npm install
npm run dev
```

Drag to orbit the dollhouse view. Click a hotspot (red disc) to drop into that
room at eye height — from there you can only look around, not move. That's
deliberate. "← Dollhouse view" takes you back out.

Tick **Sun** (top right) for daylight on the real sun path: pick a date, drag
the time slider or press ▶. Untick it for the neutral colour-judging light.

## Current state: shell only

Every room is a **sealed box** — no windows, no doors, no openings anywhere.
That's the intended state. Next step is marking up where openings actually go.

`layout-check.svg` is a top-down diagram of the traced layout. Compare it
against the original plan to sanity-check room positions.

## Zones

| Zone | Size | Kind |
|---|---|---|
| Living & Dining | 11'3" x 17'0" | room |
| Parents Room | 11'1" x 9'5" | room |
| Yash Room | 11'1" x 10'0" | room |
| Bhagyesh Room | 11'6" x 10'11" | room |
| Kitchen | 7'10" x 11'7" | room |
| Entrance Lobby | 4'0" x 5'1" | room |
| Toilet (Yash) | 7'10" x 4'6" | room |
| Common Toilet | 8'0" x 4'6" | room |
| Toilet (Bhagyesh) | 8'0" x 4'7" | room |
| Balcony (Living) | 6'6" x 6'7" | outdoor — walls, no ceiling |
| Balcony (Bhagyesh) | 6'0" x 4'11" | outdoor — walls, no ceiling |
| Dry Balcony | 7'6" x 3'11" | outdoor — walls, no ceiling |
| Passage | ~3'3" x 9'11" | open — floor only |
| Service Platform | ~3' x 7'6" | open — floor only, not dimensioned on plan |

Ceilings exist only on `room` zones, and are hidden in dollhouse view.

## Files

```
CONTEXT.md           — project decisions, read first
index.html           — page shell + UI overlay
layout-check.svg     — top-down layout verification diagram (old)
style.css            — all styling
roomData.js          — floor plan data model (single source of truth)
walls.js             — resolves shared walls + openings from roomData.js
rooms.js             — turns roomData.js + walls.js into Three.js geometry
main.js              — scene, lighting, dollhouse controls, hotspots, pano mode
sun.js               — sun position for a date + time (NOAA equations)
plan.js              — `node plan.js` -> floor-plan.svg + floor-plan.dxf
```

## Moving to Claude Code

```bash
git init && git add -A && git commit -m "Shell from OPTION 1 floor plan"
npm install -g @anthropic-ai/claude-code
claude
```

Run it inside this folder. It reads `CONTEXT.md` and picks up where the chat
left off.
