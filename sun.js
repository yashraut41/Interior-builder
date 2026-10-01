// ---------------------------------------------------------------------------
// Sun position — NOAA's low-precision solar equations (good to ~0.5°, plenty
// for "where does the light fall at 4pm in December"). No Three.js here so it
// runs in Node too.
// ---------------------------------------------------------------------------

import { SITE, PLAN_UP_BEARING } from "./roomData.js";

const RAD = Math.PI / 180;

/**
 * Sun azimuth (degrees clockwise from true north) and altitude (degrees above
 * the horizon) at the site, for a local calendar date and local clock time.
 *   date    - "YYYY-MM-DD"
 *   minutes - local clock time, minutes after midnight
 */
export function sunPosition(date, minutes, site = SITE) {
  const [y, m, d] = date.split("-").map(Number);
  const dayOfYear = (Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000 + 1;
  const daysInYear = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
  const utcHours = minutes / 60 - site.utcOffset;

  // Fractional year, radians
  const g = ((2 * Math.PI) / daysInYear) * (dayOfYear - 1 + (utcHours - 12) / 24);

  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(g) -
      0.032077 * Math.sin(g) -
      0.014615 * Math.cos(2 * g) -
      0.040849 * Math.sin(2 * g));
  const decl =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);

  // True solar time -> hour angle (0 at solar noon, + in the afternoon)
  const solarMinutes = minutes + eqTime + 4 * site.lon - 60 * site.utcOffset;
  const hourAngle = (solarMinutes / 4 - 180) * RAD;
  const lat = site.lat * RAD;

  const sinAlt = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(hourAngle);
  const altitude = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const azimuth =
    Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat)) + Math.PI;

  return { azimuth: azimuth / RAD, altitude: altitude / RAD };
}

/**
 * Unit vector from the flat towards the sun, in scene axes (Y up, plan-up is
 * -Z, plan-right is +X). `planUpBearing` is the true bearing the plan's
 * up-the-sheet direction actually faces.
 */
export function sunDirection({ azimuth, altitude }, planUpBearing = PLAN_UP_BEARING) {
  const a = (azimuth - planUpBearing) * RAD; // clockwise from plan-up
  const h = altitude * RAD;
  return { x: Math.sin(a) * Math.cos(h), y: Math.sin(h), z: -Math.cos(a) * Math.cos(h) };
}
