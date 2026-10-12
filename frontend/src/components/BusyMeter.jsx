import React from "react";
import { busyLevel, busyPercent, predictAvailability } from "../mockData";
import { timeLabel } from "../time";

// How many 30-minute steps the "next few hours" strip shows.
const STEPS = 8;
const STEP_MIN = 30;

// Half-circle gauge of how full the carpark is predicted to be at the
// driver's arrival time, plus a strip of the next few hours so they can
// spot a quieter slot. Tapping a bar moves the arrival time to that slot.
export default function BusyMeter({ mall, arriveTime, etaMinutes, onPickTime }) {
  const predicted = predictAvailability(mall, etaMinutes);
  const pct = busyPercent(mall, predicted);
  const level = busyLevel(pct, predicted);

  // Slots start at the next half-hour so labels read as clean clock times.
  const start = new Date();
  start.setMinutes(start.getMinutes() < 30 ? 30 : 60, 0, 0);
  const slots = Array.from({ length: STEPS }, (_, i) => {
    const at = new Date(start.getTime() + i * STEP_MIN * 60000);
    const eta = Math.max(0, Math.round((at.getTime() - Date.now()) / 60000));
    const free = predictAvailability(mall, eta);
    return { label: timeLabel(at), eta, pct: busyPercent(mall, free) };
  });
  // Highlight whichever slot is closest to the chosen arrival time.
  const selectedIdx = slots.reduce(
    (best, s, i) => (Math.abs(s.eta - etaMinutes) < Math.abs(slots[best].eta - etaMinutes) ? i : best),
    0
  );

  return (
    <div className="card busy-card">
      <div className="busy-head">
        <span className="busy-head-title">Busy meter</span>
        <span className="muted">at {arriveTime}</span>
      </div>

      <div className="busy-gauge" role="img" aria-label={`${pct}% full, ${level.label}`}>
        <svg viewBox="0 0 220 120">
          <path className="busy-gauge-track" d="M 20 110 A 90 90 0 0 1 200 110" fill="none" strokeWidth="18" strokeLinecap="round" />
          <path
            className="busy-gauge-fill"
            d="M 20 110 A 90 90 0 0 1 200 110"
            fill="none"
            stroke={level.color}
            strokeWidth="18"
            strokeLinecap="round"
            pathLength="100"
            strokeDasharray={`${Math.max(pct, 1)} 100`}
          />
        </svg>
        <div className="busy-gauge-center">
          <div className="busy-gauge-pct">
            {pct}
            <small>%</small>
          </div>
          <div className="busy-gauge-sub">full when you arrive</div>
        </div>
      </div>
      <div className="busy-scale">
        <span>Quiet</span>
        <span>Packed</span>
      </div>
      <div className="busy-level">
        <span className={`level-pill ${level.id}`}>{level.label}</span>
      </div>

      <div className="busy-hours">
        <div className="busy-hours-title">
          Next few hours <span>tap to change time</span>
        </div>
        <div className="busy-bars">
          {slots.map((s, i) => (
            <button
              key={s.label}
              type="button"
              className={`busy-bar ${i === selectedIdx ? "selected" : ""}`}
              onClick={() => onPickTime(s.label)}
              aria-label={`${s.label}: ${s.pct}% full`}
            >
              <span className="busy-bar-tip">
                {s.label} · {s.pct}%
              </span>
              <span className="busy-bar-fill" style={{ height: `${Math.max(s.pct, 6)}%` }} />
            </button>
          ))}
        </div>
        <div className="busy-bar-labels">
          {slots.map((s, i) => (
            <span key={s.label} className={i === selectedIdx ? "selected" : ""}>
              {i % 2 === 0 || i === selectedIdx ? s.label : ""}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
