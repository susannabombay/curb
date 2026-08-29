// Tracks no-shows -- holds that ran out without the driver ever checking in
// or cancelling -- and applies a temporary booking suspension after too
// many, so the extend cap isn't the only thing standing between a driver
// and indefinitely tying up lots they never intend to use. Persisted to
// localStorage since there's no account backend.
const KEY = "curb-reliability";
export const NO_SHOW_LIMIT = 2;
export const SUSPENSION_HOURS = 24;

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : { noShowCount: 0, suspendedUntil: null };
  } catch {
    return { noShowCount: 0, suspendedUntil: null };
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
