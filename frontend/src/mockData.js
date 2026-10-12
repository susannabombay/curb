// All fake/demo data for the prototype lives here. Nothing in this file
// talks to a backend -- swap it out once the real DataMall-backed API
// (see ../backend) is wired back up.

// Curb's Phase 1 malls, with real coordinates (for the map) and a made-up
// current lot count (for the availability UI). lotBreakdown covers the
// special-purpose pools real carparks segment out -- "Standard" isn't
// listed here since that's just availableNow itself.
export const MALLS = [
  { id: "vivocity", name: "VivoCity", area: "HarbourFront", lat: 1.2645, lng: 103.8222, capacity: 250, availableNow: 214, lotBreakdown: { ev: 12, accessible: 8, family: 20, motorcycle: 40 },
    rates: { firstHourCents: 160, blockCents: 110, blockMin: 60, dailyCapCents: 1500, motorcycleEntryCents: 130 },
    dropoff: { point: "Level 1 taxi stand, beside the main atrium entrance", graceMin: 10 } },
  { id: "ion", name: "ION Orchard", area: "Orchard", lat: 1.3039, lng: 103.8318, capacity: 180, availableNow: 38, lotBreakdown: { ev: 4, accessible: 3, family: 6, motorcycle: 15 },
    rates: { firstHourCents: 428, blockCents: 214, blockMin: 30, dailyCapCents: null, motorcycleEntryCents: 130 },
    dropoff: { point: "Orchard Turn driveway, Level 1 lobby", graceMin: 10 } },
  { id: "marina", name: "Marina Square", area: "Marina", lat: 1.2926, lng: 103.8573, capacity: 300, availableNow: 156, lotBreakdown: { ev: 10, accessible: 6, family: 14, motorcycle: 25 },
    rates: { firstHourCents: 270, blockCents: 110, blockMin: 30, dailyCapCents: 2000, motorcycleEntryCents: 130 },
    dropoff: { point: "Raffles Boulevard entrance, beside the hotel lobby", graceMin: 15 } },
  { id: "jem", name: "Jem", area: "Jurong Lake District", lat: 1.3331, lng: 103.7436, capacity: 220, availableNow: 5, lotBreakdown: { ev: 1, accessible: 1, family: 0, motorcycle: 10 },
    rates: { firstHourCents: 150, blockCents: 80, blockMin: 30, dailyCapCents: 1200, motorcycleEntryCents: 130 },
    dropoff: { point: "Gateway Drive taxi stand, Level 1", graceMin: 10 } },
  { id: "westgate", name: "Westgate", area: "Jurong Lake District", lat: 1.3345, lng: 103.743, capacity: 200, availableNow: 0, lotBreakdown: { ev: 0, accessible: 0, family: 0, motorcycle: 5 },
    rates: { firstHourCents: 150, blockCents: 80, blockMin: 30, dailyCapCents: 1200, motorcycleEntryCents: 130 },
    dropoff: { point: "Gateway Drive pick-up point, Level 1", graceMin: 10 } },
];

// rates are the mall's own parking charges (paid at the gantry, separate
// from Curb's hold fee; motorcycles pay a flat per-entry charge instead) and dropoff is its pick-up/drop-off point. Both are
// made-up demo values -- swap in each mall's published rates before launch.

// Lot-type options a driver can request at booking time, beyond a plain
// Standard car lot. Keyed to match each mall's lotBreakdown above.
export const LOT_TYPES = [
  { id: "standard", label: "Standard" },
  { id: "ev", label: "EV charging" },
  { id: "accessible", label: "Accessible" },
  { id: "family", label: "Family / parent-child" },
  { id: "motorcycle", label: "Motorcycle" },
];

// How many of a given lot type are free right now at a mall. "standard"
// isn't a separate pool in this mock -- it's just the mall's normal count.
export function lotTypeCount(mall, lotTypeId) {
  if (lotTypeId === "standard") return mall.availableNow;
  return mall.lotBreakdown?.[lotTypeId] ?? 0;
}

// Fictional demo entity -- no real business, no real payment rail. Used
// only to render a PayNow-style QR code that looks authentic without ever
// touching a real UEN or moving real money.
export const PAYNOW_ENTITY_NAME = "Curb Demo Pte Ltd";
export const PAYNOW_UEN = "201999999D";

// What we charge (in cents) to hold a lot, and what an extend costs.
// Both are purely cosmetic in this mock -- no real payment is processed.
// The hold fee itself now depends on the driver's reliability tier (see
// rewards.js); BOOKING_FEE_CENTS is the standard (Starter) price.
export const BOOKING_FEE_CENTS = 200;
export const EXTEND_FEE_CENTS = 150;

// How long, in minutes, a driver has to check in after their stated
// arrival time before the hold is released back to the public pool. Kept
// short-ish on purpose -- every minute here is a lot sitting reserved but
// physically empty, which is exactly the capacity a mall with tight
// availability can't spare.
export const RESERVATION_WINDOW_MIN = 15;
// How many extra minutes an "extend" grants.
export const EXTEND_MIN = 10;
// How many times a driver can extend a single hold. Capped rather than
// unlimited -- otherwise a driver could keep tapping "extend" forever and
// squat on a lot indefinitely, which is exactly the wasted capacity a short
// RESERVATION_WINDOW_MIN is meant to prevent in the first place.
export const MAX_EXTENDS = 1;

// Colour bucket for a lot count -- drives the green/amber/red badge styles.
export function availabilityClass(lots) {
  if (lots === 0) return "full";
  if (lots <= 10) return "low";
  return "ok";
}

// Fake forecast model: a mild downward drift the further out you look,
// plus a per-mall wave so different malls don't all move identically.
// This stands in for a real prediction service -- swap the body of this
// function out once there's live/historical data to model against.
export function predictAvailability(mall, etaMinutes) {
  const seed = mall.name.length;
  const drift = -0.22 * etaMinutes;
  const wave = 6 * Math.sin(etaMinutes / 6 + seed);
  const predicted = Math.round(mall.availableNow + drift + wave);
  return Math.max(0, Math.min(mall.capacity, predicted));
}

// "How busy is it" as a 0-100 percentage of the carpark that's occupied --
// the busy meter's headline instead of a raw lot count, since "nearly full"
// reads faster at a glance than "38 of 180".
export function busyPercent(mall, freeLots) {
  if (!mall.capacity) return 100;
  return Math.round(100 * (1 - freeLots / mall.capacity));
}

// Named bucket + colour key for a busy percentage. A completely full
// carpark is always "packed", whatever the percentage rounds to.
export const BUSY_LEVELS = [
  { id: "quiet", label: "Quiet", max: 40, color: "var(--good)" },
  { id: "moderate", label: "Moderate", max: 70, color: "var(--warn)" },
  { id: "busy", label: "Busy", max: 90, color: "var(--serious)" },
  { id: "packed", label: "Packed", max: 100, color: "var(--bad)" },
];

export function busyLevel(pct, freeLots) {
  if (freeLots === 0) return BUSY_LEVELS[3];
  return BUSY_LEVELS.find((l) => pct < l.max) || BUSY_LEVELS[3];
}

// Check-in ("I've arrived") rules -- mirrored server-side in main.py.
// The button stays greyed out until this many minutes before the driver's
// arrival time, and only works within ARRIVE_RADIUS_M of the carpark.
export const CHECKIN_OPENS_BEFORE_MIN = 10;
export const ARRIVE_RADIUS_M = 300;
export const MAX_ACCURACY_ALLOWANCE_M = 150;

export function findMall(id) {
  return MALLS.find((m) => m.id === id) || null;
}

// Minutes between two "HH:MM" labels, assuming leaving after midnight if
// the leave time is earlier in the day than the arrival time.
export function stayMinutes(arriveTime, leaveTime) {
  if (!arriveTime || !leaveTime) return 0;
  const [ah, am] = arriveTime.split(":").map(Number);
  const [lh, lm] = leaveTime.split(":").map(Number);
  let mins = lh * 60 + lm - (ah * 60 + am);
  if (mins <= 0) mins += 24 * 60;
  return mins;
}

// Estimated parking charge (cents) at the mall's own rates for a stay:
// first hour flat, then per block (rounded up), capped per day if the mall
// has a cap. Motorcycles pay the mall's flat per-entry charge. An estimate only -- the gantry charges the real amount.
export function estimateParkingFee(mall, arriveTime, leaveTime, lotType) {
  if (!mall?.rates) return null;
  const { firstHourCents, blockCents, blockMin, dailyCapCents, motorcycleEntryCents } = mall.rates;
  const mins = stayMinutes(arriveTime, leaveTime);
  if (mins === 0) return 0;
  if (lotType === "motorcycle") return motorcycleEntryCents;
  const extraBlocks = Math.max(0, Math.ceil((mins - 60) / blockMin));
  const total = firstHourCents + extraBlocks * blockCents;
  return dailyCapCents ? Math.min(total, dailyCapCents) : total;
}

export function formatDuration(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}

export function formatCents(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

// Wording that follows the booked lot type -- a motorcycle lot is booked
// with a motorcycle's plate, not a car's.
export function vehicleNoun(lotType) {
  return lotType === "motorcycle" ? "motorcycle" : "car";
}

export function plateLabel(lotType) {
  return lotType === "motorcycle" ? "Motorcycle plate" : "Car plate";
}

export function estimateNote(lotType, mins) {
  return lotType === "motorcycle" ? "flat per-entry rate" : `${formatDuration(mins)} at the mall's rates`;
}
