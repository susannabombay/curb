import React, { useState } from "react";
import { busyLevel, busyPercent, predictAvailability, LOT_TYPES, lotTypeCount } from "../mockData";
import { defaultTimeLabel, minutesUntil, timeStringToDate } from "../time";
import BusyMeter from "./BusyMeter.jsx";
import { AlertIcon, BackIcon, ClockIcon, PinIcon } from "./icons.jsx";

// Shows how busy the carpark is likely to be at whatever time the driver
// says they'll park -- driven by an actual clock-time picker (not a vague
// "X minutes from now" slider), since that's what a driver planning ahead
// actually wants to enter. The busy meter is the headline: it tells the
// driver at a glance whether it'll be a struggle to find a spot, which
// matters far more than how many lots happen to be free right this second.
export default function MallDetail({ mall, onBack, onBook, activeReservation, onViewReservation, suspendedUntil }) {
  // "HH:MM" the driver plans to arrive. Defaults to 15 minutes from now.
  const [arriveTime, setArriveTime] = useState(() => defaultTimeLabel(15));

  // Re-derive "how many minutes from now is that" every render so the
  // forecast always reflects the real current time, not a stale snapshot.
  const etaMinutes = minutesUntil(timeStringToDate(arriveTime));
  const predicted = predictAvailability(mall, etaMinutes);
  const level = busyLevel(busyPercent(mall, predicted), predicted);
  const busyNow = busyPercent(mall, mall.availableNow);

  return (
    <div className="screen detail-screen">
      <div className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <BackIcon />
        </button>
        <span className="topbar-title">Carpark</span>
        <span className="topbar-spacer" />
      </div>

      <div className="detail-head">
        <div className="detail-icon">P</div>
        <div>
          <h2>{mall.name}</h2>
          <div className="carpark-area">
            <PinIcon />
            {mall.area}
          </div>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-tile">
          <div className="stat-value">{mall.availableNow}</div>
          <div className="stat-label">Free now</div>
        </div>
        <div className="stat-tile">
          <div className="stat-value">{mall.capacity}</div>
          <div className="stat-label">Total lots</div>
        </div>
        <div className="stat-tile">
          <div className="stat-value">{busyNow}%</div>
          <div className="stat-label">Busy now</div>
        </div>
      </div>

      <div className="section-title">Special lots</div>
      <div className="chip-row">
        {LOT_TYPES.filter((t) => t.id !== "standard").map((t) => {
          const count = lotTypeCount(mall, t.id);
          return (
            <span key={t.id} className={`chip static ${count === 0 ? "empty" : ""}`}>
              {t.label}
              <span className="chip-count">{count}</span>
            </span>
          );
        })}
      </div>

      <div className="section-title">When are you parking?</div>
      <div className="card time-card">
        <div className="time-card-left">
          <div className="time-icon">
            <ClockIcon />
          </div>
          <div>
            <div className="time-card-label">Arriving at</div>
            <div className="time-card-sub">in about {etaMinutes} min</div>
          </div>
        </div>
        <input
          className="time-input"
          type="time"
          value={arriveTime}
          onChange={(e) => e.target.value && setArriveTime(e.target.value)}
        />
      </div>

      <BusyMeter mall={mall} arriveTime={arriveTime} etaMinutes={etaMinutes} onPickTime={setArriveTime} />

      {(level.id === "busy" || level.id === "packed") && (
        <div className={`urgency-banner ${level.id === "packed" ? "full" : "low"}`}>
          <AlertIcon />
          <span>
            {predicted === 0
              ? "It's expected to be completely full by the time you arrive - book now to lock in a spot."
              : "It's filling up fast around then - book now before the spots are gone."}
          </span>
        </div>
      )}

      <div className="cta-bar">
        {suspendedUntil ? (
          <div className="urgency-banner full">
            <AlertIcon />
            <span>
              Booking is temporarily suspended until{" "}
              {new Date(suspendedUntil).toLocaleString([], { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" })}{" "}
              after repeated no-shows. See Profile for details.
            </span>
          </div>
        ) : activeReservation ? (
          // A driver can only hold one lot at a time -- booking here would
          // silently overwrite (and lose) the reservation they already have.
          <>
            <div className="urgency-banner low">
              <AlertIcon />
              <span>
                You already have an active hold at {activeReservation.carpark_name}. Finish or cancel it before
                booking another spot.
              </span>
            </div>
            <button className="dark-btn book-btn" onClick={onViewReservation}>
              View your reservation
            </button>
          </>
        ) : (
          <button
            className="primary book-btn"
            onClick={() => onBook(mall, predicted === 0 ? defaultTimeLabel(5) : arriveTime)}
          >
            {predicted === 0 ? "Book your spot now" : `Book for ${arriveTime}`}
          </button>
        )}
      </div>
    </div>
  );
}
