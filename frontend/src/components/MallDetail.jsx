import React, { useState } from "react";
import { availabilityClass, predictAvailability, LOT_TYPES, lotTypeCount } from "../mockData";
import { defaultTimeLabel, minutesUntil, timeStringToDate } from "../time";

// Shows a forecast for whatever time the driver says they'll park -- driven
// by an actual clock-time picker (not a vague "X minutes from now" slider),
// since that's what a driver planning ahead actually wants to enter. The
// predicted count at that time is the headline number: it's what tells the
// driver whether they'll actually have a spot when they get there, which
// matters far more than how many lots happen to be free right this second.
export default function MallDetail({ mall, onBack, onBook, activeReservation, onViewReservation, suspendedUntil }) {
  // "HH:MM" the driver plans to arrive. Defaults to 15 minutes from now.
  const [arriveTime, setArriveTime] = useState(() => defaultTimeLabel(15));

  // Re-derive "how many minutes from now is that" every render so the
  // forecast always reflects the real current time, not a stale snapshot.
  const etaMinutes = minutesUntil(timeStringToDate(arriveTime));
  const predicted = predictAvailability(mall, etaMinutes);
  const cls = availabilityClass(predicted);

  return (
    <div className="screen detail-screen">
      <button className="back" onClick={onBack}>
        ← Back
      </button>
      <h2>{mall.name}</h2>
      <div className="carpark-area">{mall.area}</div>
      <div className="muted current-availability">
        {mall.availableNow === 0 ? "Full right now" : `${mall.availableNow} lots available right now`}
      </div>
      <div className="chip-row lot-type-summary">
        {LOT_TYPES.filter((t) => t.id !== "standard").map((t) => (
          <span key={t.id} className="chip static">
            {t.label}
            <span className="chip-count">{lotTypeCount(mall, t.id)}</span>
          </span>
        ))}
      </div>

      <div className="eta-slider">
        <label className="field-label">What time do you want to park?</label>
        <input type="time" value={arriveTime} onChange={(e) => setArriveTime(e.target.value)} />
        <div className="eta-value">{arriveTime}</div>
        <div className="muted">about {etaMinutes} min from now</div>
      </div>

      <div className="availability-block">
        <div className={`lots-badge large ${cls}`}>
          {predicted === 0 ? "Full" : `${predicted} lots`}
        </div>
        <div className="muted">predicted at {arriveTime}</div>
      </div>

      {cls !== "ok" && (
        <div className={`urgency-banner ${cls}`}>
          {predicted === 0
            ? "No spots predicted by the time you arrive - book now to lock one in before they're gone."
            : `Only ${predicted} spot${predicted === 1 ? "" : "s"} predicted - book now before they're gone.`}
        </div>
      )}

      {suspendedUntil ? (
        <div className="urgency-banner full">
          Booking is temporarily suspended until{" "}
          {new Date(suspendedUntil).toLocaleString([], { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" })}{" "}
          after repeated no-shows. See Profile for details.
        </div>
      ) : activeReservation ? (
        // A driver can only hold one lot at a time -- booking here would
        // silently overwrite (and lose) the reservation they already have.
        <>
          <div className="urgency-banner low">
            You already have an active hold at {activeReservation.carpark_name}. Finish or cancel it
            before booking another spot.
          </div>
          <button className="primary book-btn" onClick={onViewReservation}>
            View your reservation
          </button>
        </>
      ) : (
        <button
          className="primary book-btn"
          onClick={() => onBook(mall, predicted === 0 ? defaultTimeLabel(5) : arriveTime)}
        >
          {predicted === 0 ? "Book your spot now!" : "Book this spot"}
        </button>
      )}
    </div>
  );
}
