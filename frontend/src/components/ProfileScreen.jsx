import React, { useEffect, useState } from "react";
import { formatCountdown } from "../time";
import { getStoredTheme, setTheme } from "../theme";
import { getSavedDriver, saveDriver } from "../profile";
import { isSuspended } from "../reliability";

// Three-way appearance switch: "system" (default, follows the OS/browser),
// or an explicit "light"/"dark" override persisted in localStorage. Kept
// local to this screen since it's the only place it's surfaced.
function ThemeSwitch() {
  const [choice, setChoice] = useState(() => getStoredTheme() || "system");

  useEffect(() => {
    setTheme(choice === "system" ? null : choice);
  }, [choice]);

  return (
    <div className="theme-switch">
      {["system", "light", "dark"].map((opt) => (
        <button
          key={opt}
          className={`theme-switch-btn ${choice === opt ? "active" : ""}`}
          onClick={() => setChoice(opt)}
        >
          {opt[0].toUpperCase() + opt.slice(1)}
        </button>
      ))}
    </div>
  );
}

// Editable name/plate, saved to localStorage so BookingForm can pre-fill
// them on the next booking instead of the driver retyping every time.
function DriverDetails() {
  const saved = getSavedDriver();
  const [name, setName] = useState(saved?.name || "");
  const [plate, setPlate] = useState(saved?.plate || "");
  const [savedAt, setSavedAt] = useState(null);

  return (
    <div className="driver-details">
      <input
        className="driver-input"
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className="driver-input"
        placeholder="Car plate"
        value={plate}
        onChange={(e) => setPlate(e.target.value)}
      />
      <button
        className="secondary"
        onClick={() => {
          saveDriver({ name: name.trim(), plate: plate.trim().toUpperCase() });
          setSavedAt(Date.now());
        }}
      >
        {savedAt ? "Saved" : "Save details"}
      </button>
    </div>
  );
}

function ReliabilityStatus({ reliability }) {
  if (!reliability || reliability.noShowCount === 0) {
    return <div className="urgency-banner ok">No no-shows on record.</div>;
  }
  if (isSuspended(reliability)) {
    const until = new Date(reliability.suspendedUntil).toLocaleString([], {
      hour: "numeric",
      minute: "2-digit",
      month: "short",
      day: "numeric",
    });
    return (
      <div className="urgency-banner full">
        Booking suspended until {until} after {reliability.noShowCount} no-shows.
      </div>
    );
  }
  return (
    <div className="urgency-banner low">
      {reliability.noShowCount} no-show{reliability.noShowCount === 1 ? "" : "s"} on record -- one more
      will temporarily suspend booking.
    </div>
  );
}

function statusLabel(status) {
  return { arrived: "Arrived", cancelled: "Cancelled", expired: "No-show" }[status] || status;
}

// Account + "your active reservation" screen, reachable at any time via
// the bottom tab bar -- so a driver who wandered back to the map to check
// another mall can still see/manage their existing hold.
export default function ProfileScreen({ user, reservation, history, reliability, onTrack, onLogout }) {
  const hasActive = reservation && ["active", "extended"].includes(reservation.effectiveStatus);

  return (
    <div className="screen profile-screen">
      <h2>Profile</h2>
      <div className="muted">{user?.guest ? "Continue as guest" : `Signed in as ${user?.email}`}</div>

      <div className="field-label section-label">Your details</div>
      <DriverDetails />

      <div className="field-label section-label">Appearance</div>
      <ThemeSwitch />

      <div className="field-label section-label">Reliability</div>
      <ReliabilityStatus reliability={reliability} />

      <div className="field-label section-label">Active reservation</div>
      {hasActive ? (
        <div className="summary-card">
          <div className="summary-row">
            <span>{reservation.carpark_name}</span>
            <span className={`status-pill ${reservation.effectiveStatus}`}>
              {reservation.effectiveStatus === "extended" ? "Extended" : "Reserved"}
            </span>
          </div>
          <div className="summary-row">
            <span>Time left</span>
            <span>{formatCountdown(reservation.secondsRemaining)}</span>
          </div>
          <button className="primary summary-card-btn" onClick={onTrack}>
            View reservation
          </button>
        </div>
      ) : (
        <p className="muted">No active reservation - search a mall on the map to book a spot.</p>
      )}

      <div className="field-label section-label">Booking history</div>
      {history && history.length > 0 ? (
        <div className="history-list">
          {history.map((h, i) => (
            <div className="history-row" key={i}>
              <div>
                <div className="history-mall">{h.carpark_name}</div>
                <div className="muted">
                  {new Date(h.finishedAt).toLocaleDateString([], { month: "short", day: "numeric" })} ·{" "}
                  {h.arriveTime}
                </div>
              </div>
              <div className="history-right">
                <span className={`status-pill ${h.finalStatus}`}>{statusLabel(h.finalStatus)}</span>
                <span className="muted">${(h.fee_cents / 100).toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">No past bookings yet.</p>
      )}

      <button className="ghost logout-btn" onClick={onLogout}>
        Log out
      </button>
    </div>
  );
}
