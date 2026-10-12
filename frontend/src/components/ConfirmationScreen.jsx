import React from "react";
import { LOT_TYPES, estimateParkingFee, findMall, formatCents, plateLabel } from "../mockData";
import { CheckIcon } from "./icons.jsx";

const PAYMENT_LABELS = { card: "Demo card", paynow: "PayNow (demo)" };

// A dedicated "you're booked" moment, separate from the live countdown
// screen (ReservationPanel) -- lets the driver see a clean summary before
// switching into tracking mode.
export default function ConfirmationScreen({ reservation, onTrack }) {
  const feeLabel = `$${(reservation.fee_cents / 100).toFixed(2)}`;
  const parkingEstimate = estimateParkingFee(
    findMall(reservation.carpark_id),
    reservation.arriveTime,
    reservation.leaveTime,
    reservation.lotType
  );
  const lotTypeLabel = LOT_TYPES.find((t) => t.id === reservation.lotType)?.label || "Standard";

  return (
    <div className="screen confirmation-screen">
      <div className="confirm-hero">
        <div className="confirm-check">
          <CheckIcon />
        </div>
        <h2>You're booked!</h2>
        <div className="muted">Your lot at {reservation.carpark_name} is on hold.</div>
      </div>

      <div className="card summary-card">
        <div className="summary-row">
          <span>Carpark</span>
          <span>{reservation.carpark_name}</span>
        </div>
        <div className="summary-row">
          <span>Name</span>
          <span>{reservation.name || "--"}</span>
        </div>
        <div className="summary-row">
          <span>{plateLabel(reservation.lotType)}</span>
          <span>{reservation.plate}</span>
        </div>
        <div className="summary-row">
          <span>Arriving</span>
          <span>{reservation.arriveTime}</span>
        </div>
        <div className="summary-row">
          <span>Leaving by</span>
          <span>{reservation.leaveTime}</span>
        </div>
        <div className="summary-row">
          <span>Lot type</span>
          <span>{lotTypeLabel}</span>
        </div>
        <div className="summary-row">
          <span>Hold fee paid</span>
          <span>
            {feeLabel} · {PAYMENT_LABELS[reservation.paymentMethod] || "Demo card"}
          </span>
        </div>
        {parkingEstimate != null && (
          <div className="summary-row">
            <span>Est. parking (at the gantry)</span>
            <span>~{formatCents(parkingEstimate)}</span>
          </div>
        )}
      </div>

      <p className="muted">
        Your lot is held until {reservation.holdExpiresAt.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
        . We'll prompt you to extend or cancel if you haven't checked in by then.
      </p>

      <button className="primary full-btn" onClick={onTrack}>
        Track my reservation
      </button>
    </div>
  );
}
