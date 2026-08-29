// All fake/demo data for the prototype lives here. Nothing in this file
// talks to a backend -- swap it out once the real DataMall-backed API
// (see ../backend) is wired back up.

// Curb's Phase 1 malls, with real coordinates (for the map) and a made-up
// current lot count (for the availability UI). lotBreakdown covers the
// special-purpose pools real carparks segment out -- "Standard" isn't
// listed here since that's just availableNow itself.
export const MALLS = [
  { id: "vivocity", name: "VivoCity", area: "HarbourFront", lat: 1.2645, lng: 103.8222, capacity: 250, availableNow: 214, lotBreakdown: { ev: 12, accessible: 8, family: 20, motorcycle: 40 } },
  { id: "ion", name: "ION Orchard", area: "Orchard", lat: 1.3039, lng: 103.8318, capacity: 180, availableNow: 38, lotBreakdown: { ev: 4, accessible: 3, family: 6, motorcycle: 15 } },
  { id: "marina", name: "Marina Square", area: "Marina", lat: 1.2926, lng: 103.8573, capacity: 300, availableNow: 156, lotBreakdown: { ev: 10, accessible: 6, family: 14, motorcycle: 25 } },
  { id: "jem", name: "Jem", area: "Jurong Lake District", lat: 1.3331, lng: 103.7436, capacity: 220, availableNow: 5, lotBreakdown: { ev: 1, accessible: 1, family: 0, motorcycle: 10 } },
  { id: "westgate", name: "Westgate", area: "Jurong Lake District", lat: 1.3345, lng: 103.743, capacity: 200, availableNow: 0, lotBreakdown: { ev: 0, accessible: 0, family: 0, motorcycle: 5 } },
];

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
