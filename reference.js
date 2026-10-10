// ---------------------------------------------------------------------------
// Reference markers for the dollhouse view: N / E / S / W just outside the
// flat at wall-top height (with a ground arrow at north) and a level staff at
// the north-east corner marking floor, eye, lintel and ceiling heights. Unlit, never
// clickable, not part of the export.
// ---------------------------------------------------------------------------

import * as THREE from "three";
import { WALL_HEIGHT, DOOR_HEIGHT, EYE_HEIGHT, PLAN_UP_BEARING } from "./roomData.js";
import { wallBounds } from "./walls.js";

const ACCENT = 0xff5533; // same as the hotspots
const LABEL_HEIGHT = 0.42;
const MARGIN = 0.9; // markers sit this far outside the outer walls
const FOOT = 0.3048;

const LEVELS = [
  ["Floor", 0],
  ["Eye", EYE_HEIGHT],
  ["Lintel", DOOR_HEIGHT],
  ["Ceiling", WALL_HEIGHT],
];

/** metres -> 5'-6" */
export function feetInches(m) {
  const inches = Math.round(m / 0.0254);
  return `${Math.floor(inches / 12)}'-${inches % 12}"`;
}

/** Camera-facing text on a pill, `height` metres tall. */
function label(text, height, { accent = false } = {}) {
  const size = 64;
  const pad = 20;
  const font = `600 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.font = font;
  canvas.width = Math.ceil(ctx.measureText(text).width) + pad * 2;
  canvas.height = size + pad * 2;
  ctx.font = font; // resizing the canvas resets it
  ctx.fillStyle = accent ? "#ff5533" : "rgba(20, 20, 20, 0.8)";
  ctx.beginPath();
  ctx.roundRect(0, 0, canvas.width, canvas.height, 18);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 3);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, toneMapped: false }));
  sprite.scale.set((height * canvas.width) / canvas.height, height, 1);
  return sprite;
}

/** Pole with a collar every foot, a wider one and a label at each named level. */
function buildLevelStaff(mat) {
  const staff = new THREE.Group();
  staff.name = "level_staff";

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, WALL_HEIGHT, 12), mat);
  pole.position.y = WALL_HEIGHT / 2;
  staff.add(pole);

  const collar = (y, r) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.012, 24), mat);
    m.position.y = y;
    staff.add(m);
  };
  for (let y = FOOT; y < WALL_HEIGHT - 0.01; y += FOOT) collar(y, 0.05);
  for (const [name, y] of LEVELS) {
    collar(y, 0.12);
    const l = label(`${name} ${feetInches(y)}`, LABEL_HEIGHT * 0.9);
    l.center.set(-0.08, 0.5); // hangs off the pole, away from the flat as first seen
    l.position.y = y;
    staff.add(l);
  }

  staff.position.set(wallBounds.maxX + MARGIN / 2, 0, wallBounds.minZ - MARGIN / 2);
  return staff;
}

/** North arrow lying on the ground, pointing -Z until rotated. */
function buildNorthArrow(mat) {
  const s = new THREE.Shape();
  s.moveTo(0, 1.1);
  s.lineTo(0.28, 0.45);
  s.lineTo(0.08, 0.45);
  s.lineTo(0.08, 0);
  s.lineTo(-0.08, 0);
  s.lineTo(-0.08, 0.45);
  s.lineTo(-0.28, 0.45);
  s.closePath();
  const arrow = new THREE.Mesh(new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2), mat);
  arrow.name = "north_arrow";
  return arrow;
}

/**
 * Adds the markers to `scene`. Returns the group (show it in the dollhouse
 * only) and `setBearing(planUp)`, which moves the compass points to match a
 * plan-up bearing being tried in the Sun panel.
 */
export function buildReference(scene) {
  const group = new THREE.Group();
  group.name = "reference";
  const mat = new THREE.MeshBasicMaterial({ color: ACCENT, toneMapped: false });

  group.add(buildLevelStaff(mat));

  const arrow = buildNorthArrow(mat);
  const points = ["N", "E", "S", "W"].map((p) => label(p, LABEL_HEIGHT, { accent: p === "N" }));
  group.add(arrow, ...points);

  const cx = (wallBounds.minX + wallBounds.maxX) / 2;
  const cz = (wallBounds.minZ + wallBounds.maxZ) / 2;
  const hx = (wallBounds.maxX - wallBounds.minX) / 2 + MARGIN;
  const hz = (wallBounds.maxZ - wallBounds.minZ) / 2 + MARGIN;

  function setBearing(planUp) {
    points.forEach((sprite, i) => {
      const a = ((i * 90 - planUp) * Math.PI) / 180; // clockwise from plan-up (-Z)
      const dx = Math.sin(a);
      const dz = -Math.cos(a);
      // Out from the centre to just beyond the outer walls
      const t = Math.min(hx / Math.abs(dx || 1e-9), hz / Math.abs(dz || 1e-9));
      sprite.position.set(cx + dx * t, WALL_HEIGHT + LABEL_HEIGHT, cz + dz * t); // clear of the walls from any side
      if (i === 0) {
        arrow.position.set(cx + dx * t, 0.02, cz + dz * t);
        arrow.rotation.y = -a;
      }
    });
  }
  setBearing(PLAN_UP_BEARING);

  group.traverse((o) => (o.raycast = () => {})); // must not swallow hotspot clicks
  scene.add(group);
  return { group, setBearing };
}
