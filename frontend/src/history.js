// Log of past (completed/cancelled/expired) reservations, so a returning
// driver can see what they've booked before -- not just the one live hold
// `reservation` in App tracks. Persisted to localStorage since there's no
// backend to keep it in.
const KEY = "curb-history";
const MAX_ENTRIES = 20;

export function getHistory() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// entry: { carpark_name, finishedAt (ISO string), finalStatus, fee_cents, arriveTime, plate }
export function addToHistory(entry) {
  const next = [entry, ...getHistory()].slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore -- storage can be unavailable
  }
  return next;
}
