import React, { useEffect, useState } from "react";
import { fetchSharedReservation } from "../api";
import { formatCountdown } from "../time";
import { LogoGlyph, NavIcon, PinIcon } from "./icons.jsx";

// ?share=<server token> (real accounts, live) or ?snap=<encoded booking>
// (guests, a one-off snapshot). Read once at startup.
export function getShareParams() {
  const q = new URLSearchParams(window.location.search);
  if (q.get("share")) return { token: q.get("share") };
  if (q.get("snap")) return { snap: q.get("snap") };
  return null;
}

function decodeSnapshot(snap) {
  const b64 = snap.replace(/-/g, "+").replace(/_/g, "/");
  const s = JSON.parse(decodeURIComponent(escape(atob(b64))));
  return {
    carpark_name: s.n,
    lat: s.la,
    lon: s.lo,
    arriveTime: s.a,
    leaveTime: s.l,
    holdExpiresAt: new Date(s.e),
    status: s.s,
  };
}

function fromApi(r) {
  return {
    carpark_name: r.carpark_name,
    lat: r.lat,
    lon: r.lon,
    arriveTime: r.arrive_time,
    leaveTime: r.leave_time,
    holdExpiresAt: new Date(r.window_end.endsWith("Z") ? r.window_end : `${r.window_end}Z`),
    status: r.status,
  };
}

const STATUS_TEXT = {
  active: "On the way",
  extended: "On the way (hold extended)",
  arrived: "Arrived and parked",
  cancelled: "Booking cancelled",
  expired: "Hold expired",
};

// What a passenger sees from a share link: destination, live countdown and
// status -- no plate, name or payment details. Live links re-check the
// server every 20s so an extend/arrive/cancel by the driver shows up.
export default function SharedBooking({ params }) {
  const [booking, setBooking] = useState(() => {
    if (!params.snap) return null;
    try {
      return decodeSnapshot(params.snap);
    } catch {
      return null;
    }
  });
  const [error, setError] = useState(params.snap && !booking ? "This share link is broken." : null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!params.token) return;
    let cancelled = false;
    const load = () =>
      fetchSharedReservation(params.token)
        .then((r) => !cancelled && (setBooking(fromApi(r)), setError(null)))
        .catch((err) => !cancelled && setError(err.message));
    load();
    const id = setInterval(load, 20000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [params.token]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const secondsLeft = booking ? Math.max(0, Math.round((booking.holdExpiresAt.getTime() - now) / 1000)) : 0;
  const status = booking && ["active", "extended"].includes(booking.status) && secondsLeft === 0 ? "expired" : booking?.status;
  const live = ["active", "extended"].includes(status);
  const navUrl = booking
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${booking.carpark_name}, Singapore`)}&hl=en`
    : null;

  return (
    <div className="app">
      <div className="screen shared-screen">
        <div className="shared-brand">
          <div className="mini-logo">
            <LogoGlyph size={20} />
          </div>
          <span>Curb · shared booking</span>
        </div>

        {error && <div className="form-error">{error}</div>}
        {!booking && !error && <p className="muted">Loading booking...</p>}

        {booking && (
          <>
            <div className="card ticket">
              <div className="ticket-top">
                <span className={`status-pill ${status}`}>{STATUS_TEXT[status] || status}</span>
                <div className="ticket-mall">{booking.carpark_name}</div>
                <div className="ticket-sub">Your driver is parking here</div>
              </div>
              {live && (
                <div className="countdown">
                  <div className="countdown-time">{formatCountdown(secondsLeft)}</div>
                  <div className="countdown-label">until the parking hold expires</div>
                </div>
              )}
              <div className="ticket-grid">
                <div>
                  <div className="stat-label">Arriving</div>
                  <b>{booking.arriveTime || "--"}</b>
                </div>
                <div>
                  <div className="stat-label">Leaving by</div>
                  <b>{booking.leaveTime || "--"}</b>
                </div>
              </div>
            </div>

            <div className="reservation-actions">
              <a className="nav-btn" href={navUrl} target="_blank" rel="noreferrer">
                <NavIcon />
                Directions to {booking.carpark_name}
              </a>
            </div>
            <p className="muted shared-note">
              <PinIcon />
              {params.snap
                ? "This is a snapshot from when it was shared - it won't update if the driver extends or cancels."
                : "Updates live as the driver extends, arrives or cancels."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
