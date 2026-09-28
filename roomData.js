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
// Openings come from the owner's colour-coded markup of floor-plan.svg.
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

/** Door head height — walls continue above doors and plain openings. */
export const DOOR_HEIGHT = ft(7);

/**
 * Opening types. None of them gets a mesh — each is simply missing wall
 * from the floor up to `height`; above that the wall carries on as a lintel.
 *   glass   - floor-to-ceiling sliding glass panes
 *   door    - ordinary wooden door
 *   opening - bare opening, no door at all
 */
export const OPENING_TYPES = {
  glass: { height: WALL_HEIGHT },
  door: { height: DOOR_HEIGHT },
  opening: { height: DOOR_HEIGHT },
};

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
 * openings: [{ side, offset, width, type }]
 *   side   - 'north' | 'south' | 'east' | 'west' wall of this zone
 *   offset - distance along that wall from its north end (east/west walls)
 *            or its west end (north/south walls)
 *   type   - key of OPENING_TYPES
 * Each opening is listed ONCE, on either room. It cuts every wall lying on
 * that line — so a door between two rooms goes through both rooms' walls.
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
    openings: [
      { side: "south", offset: ft(0, 0), width: ft(3, 3), type: "opening" }, // to passage
    ],
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
    openings: [
      { side: "west", offset: ft(0, 0), width: ft(9, 5), type: "glass" }, // full wall
      { side: "east", offset: ft(6, 1), width: ft(3, 0), type: "door" }, // from living
    ],
  },
  {
    id: "toilet_yash",
    name: "Toilet (Yash)",
    kind: "room",
    width: ft(7, 10),
    depth: ft(4, 6),
    x: ft(7, 2),
    z: ft(19, 6),
    openings: [
      { side: "south", offset: ft(3, 2), width: ft(2, 6), type: "door" }, // from Yash Room
    ],
  },
  {
    id: "yash_room",
    name: "Yash Room",
    kind: "room",
    width: ft(11, 1),
    depth: ft(10, 0),
    x: ft(5, 6),
    z: ft(27, 1),
    openings: [
      { side: "west", offset: ft(0, 0), width: ft(10, 0), type: "glass" }, // full wall
      { side: "east", offset: ft(0, 4), width: ft(3, 0), type: "door" }, // from passage
    ],
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
    openings: [
      { side: "west", offset: ft(0, 4), width: ft(4, 4), type: "opening" }, // to living
      { side: "east", offset: ft(1, 3), width: ft(3, 6), type: "door" }, // main door
      { side: "south", offset: ft(0, 0), width: ft(4, 0), type: "glass" }, // to kitchen
    ],
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
    openings: [
      { side: "north", offset: ft(0, 0), width: ft(7, 6), type: "glass" }, // to kitchen
    ],
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
    openings: [
      { side: "west", offset: ft(1, 0), width: ft(2, 6), type: "door" }, // from passage
    ],
  },
  {
    id: "toilet_bhagyesh",
    name: "Toilet (Bhagyesh)",
    kind: "room",
    width: ft(8, 0),
    depth: ft(4, 7),
    x: ft(18, 9),
    z: ft(24, 7),
    openings: [
      { side: "south", offset: ft(2, 9), width: ft(2, 6), type: "door" }, // from Bhagyesh Room
    ],
  },
  {
    id: "bhagyesh_room",
    name: "Bhagyesh Room",
    kind: "room",
    width: ft(11, 6),
    depth: ft(10, 11),
    x: ft(17, 3),
    z: ft(32, 9),
    openings: [
      { side: "north", offset: ft(0, 1), width: ft(3, 0), type: "door" }, // end of passage
    ],
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
    openings: [
      { side: "east", offset: ft(0, 0), width: ft(6, 7), type: "glass" }, // to living
    ],
  },
  {
    id: "balcony_bhagyesh",
    name: "Balcony (Bhagyesh)",
    kind: "outdoor",
    width: ft(6, 0),
    depth: ft(4, 11),
    x: ft(8, 1),
    z: ft(35, 0),
    openings: [
      { side: "east", offset: ft(0, 0), width: ft(4, 11), type: "glass" }, // to Bhagyesh Room
    ],
  },
];

/** Zones that get a hotspot — skip the tiny service platform. */
export const hotspotRooms = rooms.filter((r) => r.id !== "service_platform");
