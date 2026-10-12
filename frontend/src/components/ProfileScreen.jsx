import React, { useState } from "react";
import { formatCountdown } from "../time";
import { getSavedDriver, saveDriver } from "../profile";
import { isSuspended } from "../reliability";

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

  const initial = user?.guest ? "G" : (user?.email || "?")[0].toUpperCase();

  return (
    <div className="screen profile-screen">
      <div className="profile-head">
        <div className="avatar">{initial}</div>
        <div>
          <h2>{user?.guest ? "Guest driver" : "Profile"}</h2>
          <div className="muted">{user?.guest ? "Not signed in" : user?.email}</div>
        </div>
      </div>

      <div className="section-title">Active reservation</div>
      {hasActive ? (
        <div className="card summary-card" style={{ margin: 0 }}>
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
        <p className="muted empty-note">No active reservation - pick a mall on the map to book a spot.</p>
      )}

      <div className="section-title">Your details</div>
      <div className="card">
        <DriverDetails />
      </div>

      <div className="section-title">Reliability</div>
      <ReliabilityStatus reliability={reliability} />

      <div className="section-title">Booking history</div>
      {history && history.length > 0 ? (
        <div className="history-list">
          {history.map((h, i) => (
            <div className="history-row" key={i}>
              <div className="history-left">
                <div className="history-icon">P</div>
                <div>
                  <div className="history-mall">{h.carpark_name}</div>
                  <div className="muted">
                    {new Date(h.finishedAt).toLocaleDateString([], { month: "short", day: "numeric" })} ·{" "}
                    {h.arriveTime}
                  </div>
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
        <p className="muted empty-note">No past bookings yet.</p>
      )}

      <button className="ghost logout-btn" onClick={onLogout}>
        Log out
      </button>
    </div>
  );
}
