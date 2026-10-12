import React from "react";
import { timeLabel } from "../time";
import { CarIcon } from "./icons.jsx";

// "Find my car" reminder -- shown on the map and Profile until the driver
// says they've left. `compact` is the just-saved confirmation on the
// reservation screen, where the only useful action is fixing a mis-tap.
export default function ParkedCarCard({ car, onClear, compact }) {
  const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    `${car.carpark_name}, Singapore`
  )}&travelmode=walking&hl=en`;
  const since = timeLabel(new Date(car.savedAt));

  return (
    <div className={`card parked-card ${compact ? "compact" : ""}`}>
      <div className="parked-top">
        <div className="parked-icon">
          <CarIcon />
        </div>
        <div className="parked-info">
          <div className="parked-label">Your car · since {since}</div>
          <div className="parked-spot">
            Level {car.level} · Zone {car.zone}
          </div>
          <div className="muted">
            {car.carpark_name}
            {car.plate ? ` · ${car.plate}` : ""}
          </div>
        </div>
      </div>
      {car.note && <div className="parked-note">"{car.note}"</div>}
      <div className="parked-actions">
        {!compact && (
          <a className="secondary parked-btn" href={navUrl} target="_blank" rel="noreferrer">
            Walk back
          </a>
        )}
        <button className="ghost parked-btn" onClick={onClear}>
          {compact ? "Change spot" : "I've left"}
        </button>
      </div>
    </div>
  );
}
