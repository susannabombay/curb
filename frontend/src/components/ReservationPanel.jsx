import React, { useState } from "react";
import { formatCountdown, timeLabel } from "../time";
import { getCurrentPosition } from "../location";
import {
  CHECKIN_OPENS_BEFORE_MIN,
  estimateParkingFee,
  findMall,
  formatCents,
  formatDuration,
  stayMinutes,
} from "../mockData";
import { PARKING_LEVELS, PARKING_ZONES } from "../parkedCar";
import ParkedCarCard from "./ParkedCarCard.jsx";
import { NavIcon, PinIcon } from "./icons.jsx";

// "I've arrived" with both checks a driver can see: it stays greyed out
// until check-in opens (shortly before the arrival time), then confirms the
// device is actually at the carpark before the hold is marked arrived.
function CheckInButton({ reservation, onArrive }) {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(null);

  async function checkIn(getPosition) {
    setError(null);
    setChecking(true);
    try {
      await onArrive(await getPosition());
    } catch (err) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  }

  if (!reservation.canCheckIn) {
    const minsLeft = Math.max(1, Math.ceil((reservation.checkInOpensAt.getTime() - Date.now()) / 60000));
    return (
      <div className="checkin">
        <button className="primary checkin-btn" disabled>
          I've arrived
        </button>
        <div className="checkin-hint">
          Check-in opens at {timeLabel(reservation.checkInOpensAt)} ({minsLeft} min),{" "}
          {CHECKIN_OPENS_BEFORE_MIN} minutes before you arrive.
        </div>
      </div>
    );
  }

  return (
    <div className="checkin">
      <button className="primary checkin-btn" disabled={checking} onClick={() => checkIn(getCurrentPosition)}>
        <PinIcon />
        {checking ? "Checking your location..." : "I've arrived"}
      </button>
      {error ? (
        <div className="checkin-error">{error}</div>
      ) : (
        <div className="checkin-hint">We'll use your location to confirm you're at the carpark.</div>
      )}
      {/* Local testing only -- lets you check in without physically being
          in Singapore. Stripped from production builds. */}
      {import.meta.env.DEV && reservation.lat != null && (
        <button
          className="link-btn checkin-dev"
          disabled={checking}
          onClick={() => checkIn(async () => ({ lat: reservation.lat, lon: reservation.lon, accuracy: 10 }))}
        >
          Dev only: simulate being at the carpark
        </button>
      )}
    </div>
  );
}

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

// Sends the passenger link via the phone's share sheet where there is one,
// otherwise copies it to the clipboard.
function ShareButton({ onShare }) {
  const [state, setState] = useState(null); // null | "working" | "copied" | "shared" | Error message

  async function share() {
    setState("working");
    try {
      const url = await onShare();
      if (navigator.share) {
        try {
          await navigator.share({ title: "Follow my parking booking", url });
          setState("shared");
          return;
        } catch (err) {
          if (err?.name === "AbortError") return setState(null);
        }
      }
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch (err) {
      setState(err.message || "Couldn't create a share link.");
    }
  }

  const done = state === "copied" || state === "shared";
  return (
    <div className="share-block">
      <button className="secondary share-btn" onClick={share} disabled={state === "working"}>
        {state === "working" ? "Creating link..." : state === "copied" ? "Link copied" : state === "shared" ? "Shared" : "Share with a passenger"}
      </button>
      {done && <div className="checkin-hint">They'll see the destination and live countdown - not your plate or payment.</div>}
      {state && !done && state !== "working" && <div className="checkin-error">{state}</div>}
    </div>
  );
}

// After check-in: "where did you park?" so Find my car can bring the
// driver back to the right level and zone hours later.
function ParkSpotForm({ onSave }) {
  const [level, setLevel] = useState(null);
  const [zone, setZone] = useState(null);
  const [note, setNote] = useState("");

  return (
    <div className="card spot-form">
      <div className="form-card-title">Where did you park?</div>
      <div className="muted">We'll remember it so you can find your car later.</div>
      <label className="field-label">Level</label>
      <div className="chip-row">
        {PARKING_LEVELS.map((l) => (
          <button key={l} type="button" className={`chip ${level === l ? "active" : ""}`} onClick={() => setLevel(l)}>
            {l}
          </button>
        ))}
      </div>
      <label className="field-label">Zone / pillar colour</label>
      <div className="chip-row">
        {PARKING_ZONES.map((z) => (
          <button key={z} type="button" className={`chip ${zone === z ? "active" : ""}`} onClick={() => setZone(z)}>
            {z}
          </button>
        ))}
      </div>
      <label className="field-label">Note (optional)</label>
      <input className="input" placeholder="e.g. near lift lobby C" value={note} onChange={(e) => setNote(e.target.value)} />
      <button
        className="primary spot-save"
        disabled={!level || !zone}
        onClick={() => onSave({ level, zone, note: note.trim() })}
      >
        Save my spot
      </button>
    </div>
  );
}

// Live view of a single reservation: countdown, plate/time summary, and
// the manual navigate/arrive/cancel actions. `reservation` here is the
// *derived* view from App's deriveReservationView -- effectiveStatus and
// secondsRemaining are always computed fresh from the real clock, so this
// component never has to do its own timer math.
export default function ReservationPanel({
  reservation,
  onExtend,
  onCancel,
  onArrive,
  onShare,
  parkedCar,
  onSaveParkedCar,
  onDone,
}) {
  const mall = findMall(reservation.carpark_id);
  const parkingEstimate = estimateParkingFee(mall, reservation.arriveTime, reservation.leaveTime);

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
      <div className="topbar">
        <span className="topbar-spacer" />
        <span className="topbar-title">Your reservation</span>
        <span className="topbar-spacer" />
      </div>

      <div className="card ticket">
        <div className="ticket-top">
          <span className={`status-pill ${reservation.effectiveStatus}`}>
            {statusLabel(reservation.effectiveStatus)}
          </span>
          <div className="ticket-mall">{reservation.carpark_name}</div>
          <div className="ticket-sub">Singapore</div>
        </div>

        {!isTerminal && (
          <div className="countdown">
            <div className={`countdown-time ${reservation.isUrgent ? "urgent" : ""}`}>
              {formatCountdown(reservation.secondsRemaining)}
            </div>
            <div className="countdown-label">until your hold expires</div>
          </div>
        )}

        {reservation.plate && (
          <div className="ticket-grid">
            <div>
              <div className="stat-label">Car plate</div>
              <b>{reservation.plate}</b>
            </div>
            {typeof reservation.fee_cents === "number" && (
              <div>
                <div className="stat-label">Paid to Curb</div>
                <b>{formatCents(reservation.fee_cents)}</b>
              </div>
            )}
            {reservation.arriveTime && (
              <div>
                <div className="stat-label">Arriving</div>
                <b>{reservation.arriveTime}</b>
              </div>
            )}
            {reservation.leaveTime && (
              <div>
                <div className="stat-label">Leaving by</div>
                <b>{reservation.leaveTime}</b>
              </div>
            )}
          </div>
        )}
        {parkingEstimate != null && (
          <div className="estimate-row">
            <span>
              Est. parking at {reservation.carpark_name}
              <small>
                {formatDuration(stayMinutes(reservation.arriveTime, reservation.leaveTime))} · paid at the gantry
              </small>
            </span>
            <b>~{formatCents(parkingEstimate)}</b>
          </div>
        )}
      </div>

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
              <NavIcon />
              Navigate there
            </a>
          )}
          <CheckInButton reservation={reservation} onArrive={onArrive} />
          <ShareButton onShare={onShare} />
          <button className="ghost danger" onClick={onCancel}>
            Cancel reservation
          </button>
        </div>
      )}

      {reservation.effectiveStatus === "arrived" &&
        (parkedCar && parkedCar.carpark_name === reservation.carpark_name ? (
          <div className="spot-saved">
            <ParkedCarCard car={parkedCar} compact onClear={() => onSaveParkedCar(null)} />
          </div>
        ) : (
          <ParkSpotForm onSave={onSaveParkedCar} />
        ))}

      {isTerminal && (
        <button className="primary done-btn" onClick={onDone}>
          Done
        </button>
      )}
    </div>
  );
}
