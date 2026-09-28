// ---------------------------------------------------------------------------
// Floor plan data model — "OPTION 1", 940 sq.ft carpet area.
//
// This is the ONLY place room geometry is described. Everything else
// (elevations, dollhouse view, hotspots) is generated from this file.
//
// Units: meters internally. Dimensions below are converted from the
// feet/inches printed on the floor plan via ft().
//
// ACCURACY NOTE
// Room WIDTHS and DEPTHS are read directly off the printed dimensions and
// should be trusted. Room POSITIONS (x, z) were derived by tracing the
// plan drawing, so they are good to within a few inches but are not
// surveyed. Wall thickness is assumed uniform.
//
// There are deliberately NO window or door openings yet. Every room is a
// sealed box. Openings get cut in after the shell is marked up.
// ---------------------------------------------------------------------------

const FT_TO_M = 0.3048;

/** feet + inches -> meters */
function ft(feet, inches = 0) {
  return (feet + inches / 12) * FT_TO_M;
}

/** Ceiling height. Standard Pune flat slab-to-slab, no double-height areas. */
export const WALL_HEIGHT = ft(10);

/** Internal wall thickness, assumed uniform. */
export const WALL_THICKNESS = ft(0, 5);

/** Eye height used for the locked pano viewpoint. */
export const EYE_HEIGHT = ft(5, 6);

/**
 * Plan orientation: the plan's north arrow points up the sheet, which maps
 * to -Z in this scene. So -Z is north, +Z south, +X east, -X west.
 * TO CONFIRM against the actual building orientation before the sun /
 * day-night feature is built — sunlight is only meaningful if this is right.
 */
export const NORTH_DIRECTION = { x: 0, z: -1 };

/**
 * Each zone is an axis-aligned rectangle defined by its footprint
 * (width along X, depth along Z) and the position of its CENTER.
 *
 * kind:
 *   'room'     - enclosed, gets walls + ceiling, gets a hotspot
 *   'open'     - floor only, no walls/ceiling (passage, service platform)
 *   'outdoor'  - walls but no ceiling (balconies)
 *
 * `openings` is intentionally empty everywhere for now.
 */
export const rooms = [
  // --- Centre spine -------------------------------------------------------
  {
    id: "living_dining",
    name: "Living & Dining",
    kind: "room",
    width: ft(11, 3),
    depth: ft(17, 0),
    x: ft(17, 1),
    z: ft(8, 6),
    openings: [],
  },
  {
    id: "passage",
    name: "Passage",
    kind: "open",
    width: ft(3, 3),
    depth: ft(9, 11),
    x: ft(13, 1),
    z: ft(22, 4),
    openings: [],
  },

  // --- Left column --------------------------------------------------------
  {
    id: "parents_room",
    name: "Parents Room",
    kind: "room",
    width: ft(11, 1),
    depth: ft(9, 5),
    x: ft(5, 6),
    z: ft(12, 1),
    openings: [],
  },
  {
    id: "toilet_parents",
    name: "Toilet (Parents)",
    kind: "room",
    width: ft(7, 10),
    depth: ft(4, 6),
    x: ft(7, 2),
    z: ft(19, 6),
    openings: [],
  },
  {
    id: "yash_room",
    name: "Yash Room",
    kind: "room",
    width: ft(11, 1),
    depth: ft(10, 0),
    x: ft(5, 6),
    z: ft(27, 1),
    openings: [],
  },

  // --- Right column -------------------------------------------------------
  {
    id: "ent_lobby",
    name: "Entrance Lobby",
    kind: "room",
    width: ft(4, 0),
    depth: ft(5, 1),
    x: ft(25, 2),
    z: ft(2, 7),
    openings: [],
  },
  {
    id: "kitchen",
    name: "Kitchen",
    kind: "room",
    width: ft(7, 10),
    depth: ft(11, 7),
    x: ft(27, 1),
    z: ft(11, 3),
    openings: [],
  },
  {
    id: "dry_balcony",
    name: "Dry Balcony",
    kind: "outdoor",
    width: ft(7, 6),
    depth: ft(3, 11),
    x: ft(26, 11),
    z: ft(19, 5),
    openings: [],
  },
  {
    id: "service_platform",
    name: "Service Platform",
    kind: "open",
    // Not dimensioned on the plan — traced, approximate.
    width: ft(3, 0),
    depth: ft(7, 6),
    x: ft(24, 8),
    z: ft(25, 7),
    openings: [],
  },

  // --- Centre / lower -----------------------------------------------------
  {
    id: "com_toilet",
    name: "Common Toilet",
    kind: "room",
    width: ft(8, 0),
    depth: ft(4, 6),
    x: ft(18, 9),
    z: ft(19, 8),
    openings: [],
  },
  {
    id: "toilet_bhagyesh",
    name: "Toilet (Bhagyesh)",
    kind: "room",
    width: ft(8, 0),
    depth: ft(4, 7),
    x: ft(18, 9),
    z: ft(24, 7),
    openings: [],
  },
  {
    id: "bhagyesh_room",
    name: "Bhagyesh Room",
    kind: "room",
    width: ft(11, 6),
    depth: ft(10, 11),
    x: ft(17, 3),
    z: ft(32, 9),
    openings: [],
  },

  // --- Balconies ----------------------------------------------------------
  {
    id: "balcony_living",
    name: "Balcony (Living)",
    kind: "outdoor",
    width: ft(6, 6),
    depth: ft(6, 7),
    x: ft(7, 10),
    z: ft(3, 4),
    openings: [],
  },
  {
    id: "balcony_bhagyesh",
    name: "Balcony (Bhagyesh)",
    kind: "outdoor",
    width: ft(6, 0),
    depth: ft(4, 11),
    x: ft(8, 1),
    z: ft(35, 0),
    openings: [],
  },
];

/** Zones that get a hotspot — skip the tiny service platform. */
export const hotspotRooms = rooms.filter((r) => r.id !== "service_platform");
