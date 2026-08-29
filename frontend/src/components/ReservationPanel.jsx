import React from "react";
import { formatCountdown } from "../time";

function statusLabel(status) {
  return (
    {
      active: "Reserved",
      extended: "Extended",
      arrived: "Arrived",
      expired: "Expired - lot released",
      cancelled: "Cancelled",
    }[status] || status
  );
}

// Live view of a single reservation: countdown, plate/time summary, and
// the manual navigate/arrive/cancel actions. `reservation` here is the
// *derived* view from App's deriveReservationView -- effectiveStatus and
// secondsRemaining are always computed fresh from the real clock, so this
// component never has to do its own timer math.
export default function ReservationPanel({ reservation, onExtend, onCancel, onArrive, onDone }) {
  // Destination is the mall's name, not raw lat/lon -- reverse-geocoding a
  // bare coordinate can snap to whatever unrelated business is registered
  // at that exact point (and in whatever language that listing happens to
  // be in), instead of the mall itself. hl=en also pins the Maps UI chrome
  // to English regardless of the driver's device locale.
  const navUrl = reservation.lat
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        `${reservation.carpark_name}, Singapore`
      )}&hl=en`
    : null;

  const isTerminal = ["expired", "cancelled", "arrived"].includes(reservation.effectiveStatus);

  return (
    <div className="screen reservation-screen">
      <h2>{reservation.carpark_name}</h2>
      <div className={`status-pill ${reservation.effectiveStatus}`}>
        {statusLabel(reservation.effectiveStatus)}
      </div>

      {reservation.plate && (
        <div className="booking-summary">
          <span>{reservation.plate}</span>
          {reservation.arriveTime && <span>Arriving {reservation.arriveTime}</span>}
          {reservation.leaveTime && <span>Leaving {reservation.leaveTime}</span>}
          {typeof reservation.fee_cents === "number" && (
            <span>${(reservation.fee_cents / 100).toFixed(2)} hold fee</span>
          )}
        </div>
      )}

      {!isTerminal && (
        <div className="countdown">
          <div className={`countdown-time ${reservation.isUrgent ? "urgent" : ""}`}>
            {formatCountdown(reservation.secondsRemaining)}
          </div>
          <div className="countdown-label">until your hold expires</div>
        </div>
      )}

      {/* The main 5-min prompt is a modal (see ExtendModal). If the driver
          dismissed it, this stays as a quiet fallback so extending is still
          one tap away instead of gone for good. */}
      {!isTerminal && reservation.isUrgent && reservation.canExtend && (
        <button className="ghost extend-reminder" onClick={onExtend}>
          Extend hold +10 min
        </button>
      )}

      {!isTerminal && (
        <div className="reservation-actions">
          {navUrl && (
            <a className="nav-btn" href={navUrl} target="_blank" rel="noreferrer">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 11 22 2 13 21 11 13 3 11" />
              </svg>
              Navigate there
            </a>
          )}
          <button className="ghost" onClick={onArrive}>
            I've arrived
          </button>
          <button className="ghost danger" onClick={onCancel}>
            Cancel reservation
          </button>
        </div>
      )}

      {isTerminal && (
        <button className="primary done-btn" onClick={onDone}>
          Done
        </button>
      )}
    </div>
  );
}
