// Thin client for the real backend (see ../backend) -- used only for
// signed-up/logged-in accounts. Guest mode never touches this; it keeps
// using the local mock reservation logic in App.jsx.
const BASE = "/api";

async function request(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.detail) message = data.detail;
    } catch {
      // ignore -- non-JSON error body
    }
    throw new Error(message);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const signup = (email, password) =>
  request("/auth/signup", { method: "POST", body: { email, password } });
export const login = (email, password) =>
  request("/auth/login", { method: "POST", body: { email, password } });
export const fetchMe = (token) => request("/auth/me", { token });

export const createReservation = (token, payload) =>
  request("/reservations", { method: "POST", token, body: payload });
export const fetchActiveReservation = (token) => request("/reservations/active", { token });
export const fetchHistory = (token) => request("/reservations/history", { token });
export const extendReservation = (token, id) => request(`/reservations/${id}/extend`, { method: "POST", token });
export const dismissPromptApi = (token, id) =>
  request(`/reservations/${id}/dismiss-prompt`, { method: "POST", token });
export const cancelReservationApi = (token, id) =>
  request(`/reservations/${id}/cancel`, { method: "POST", token });
export const fetchReliability = (token) => request("/me/reliability", { token });
export const shareReservationApi = (token, id) => request(`/reservations/${id}/share`, { method: "POST", token });
// Public -- a passenger opening a share link has no account/token.
export const fetchSharedReservation = (shareToken) => request(`/shared/${encodeURIComponent(shareToken)}`);

export const arriveReservationApi = (token, id, position) =>
  request(`/reservations/${id}/arrive`, {
    method: "POST",
    token,
    body: { lat: position.lat, lon: position.lon, accuracy_m: position.accuracy },
  });

// Backend datetimes are naive UTC (no "Z"/offset -- SQLite drops tzinfo),
// so the browser's Date parser must be told explicitly that it's UTC or it
// will interpret it as local time and the countdown will be off by however
// many hours this timezone is from UTC.
function parseUtc(iso) {
  return iso ? new Date(iso.endsWith("Z") ? iso : `${iso}Z`) : null;
}

// Translates a backend reservation record into the exact shape App.jsx's
// local/guest reservations already use, so deriveReservationView and every
// component that reads `reservation`/`view` don't need to know whether the
// data came from the backend or the local mock.
export function mapReservationFromApi(r) {
  if (!r) return null;
  return {
    id: r.id,
    carpark_id: r.carpark_id,
    carpark_name: r.carpark_name,
    lat: r.lat,
    lon: r.lon,
    name: r.name,
    plate: r.plate,
    arriveTime: r.arrive_time,
    leaveTime: r.leave_time,
    lotType: r.lot_type,
    paymentMethod: r.payment_method,
    fee_cents: r.fee_cents,
    status: r.status,
    // Arrival time = when the booking was made + the ETA given at the time.
    arriveAt: new Date(parseUtc(r.window_start).getTime() + r.eta_minutes * 60000),
    holdExpiresAt: parseUtc(r.window_end),
    extendDismissed: r.extend_dismissed,
    extendCount: r.extended_count,
  };
}

// Terminal (history) entries render as a static row, not a live countdown,
// so they use ProfileScreen's simpler history-row shape instead.
export function mapHistoryEntryFromApi(r) {
  return {
    id: r.id,
    carpark_id: r.carpark_id,
    carpark_name: r.carpark_name,
    finishedAt: parseUtc(r.updated_at).toISOString(),
    finalStatus: r.status,
    fee_cents: r.fee_cents,
    arriveTime: r.arrive_time,
    leaveTime: r.leave_time,
    plate: r.plate,
    extendCount: r.extended_count,
  };
}

// Server reliability ({ streak, arrived_count, no_show_count, tier }) in the
// same shape as the local guest record from reliability.js. Booking
// suspension still lives locally, so it's deliberately not included here.
export function mapReliabilityFromApi(r) {
  return {
    streak: r.streak,
    arrivedCount: r.arrived_count,
    noShowCount: r.no_show_count,
    tierId: r.tier,
  };
}
