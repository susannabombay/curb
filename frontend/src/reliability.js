// Tracks no-shows -- holds that ran out without the driver ever checking in
// or cancelling -- and applies a temporary booking suspension after too
// many, so the extend cap isn't the only thing standing between a driver
// and indefinitely tying up lots they never intend to use. Also tracks the
// on-time check-in streak that drives reward tiers (rewards.js). Persisted
// to localStorage for guests; real accounts get their streak/tier from the
// server, which derives it from actual booking history.
const KEY = "curb-reliability";
export const NO_SHOW_LIMIT = 2;
export const SUSPENSION_HOURS = 24;

const EMPTY = { noShowCount: 0, suspendedUntil: null, streak: 0, arrivedCount: 0 };

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return { ...EMPTY, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { ...EMPTY };
  }
}

function write(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore -- storage can be unavailable
  }
}

export function getReliability() {
  return read();
}

// Call once per confirmed no-show. Crossing NO_SHOW_LIMIT (cumulative,
// doesn't reset on its own) starts/extends a SUSPENSION_HOURS booking
// suspension.
export function recordNoShow() {
  const state = read();
  const noShowCount = state.noShowCount + 1;
  const next = {
    ...state,
    streak: 0,
    noShowCount,
    suspendedUntil:
      noShowCount >= NO_SHOW_LIMIT ? Date.now() + SUSPENSION_HOURS * 60 * 60 * 1000 : state.suspendedUntil,
  };
  write(next);
  return next;
}

export function isSuspended(state) {
  return Boolean(state?.suspendedUntil && state.suspendedUntil > Date.now());
}

// Call once per completed (checked-in) booking.
export function recordArrival() {
  const state = read();
  const next = { ...state, streak: state.streak + 1, arrivedCount: state.arrivedCount + 1 };
  write(next);
  return next;
}
