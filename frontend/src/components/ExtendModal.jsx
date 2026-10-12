import React from "react";
import { formatCents } from "../mockData";
import { ClockIcon } from "./icons.jsx";

// The "key mechanic" pop-up: interrupts the screen once the hold is close
// to expiring and the driver hasn't checked in yet. App only renders this
// when reservation.showExtendPrompt is true, which is derived every tick
// from the real clock (see deriveReservationView in App.jsx) -- not from a
// counter that could drift.
export default function ExtendModal({ mall, canExtend, extendFeeCents, onExtend, onCancel, onDismiss }) {
  // Free for Silver/Gold reward tiers (see rewards.js).
  const feeLabel = extendFeeCents ? formatCents(extendFeeCents) : "free";

  return (
    <div className="modal-scrim">
      <div className="modal-card">
        <div className="modal-grabber" />
        <div className="modal-icon">
          <ClockIcon />
        </div>
        <h3>5 minutes left</h3>
        <p className="muted">
          {canExtend
            ? `You haven't checked in at ${mall} yet. Extend your hold or release the lot for someone else.`
            : `You haven't checked in at ${mall} yet, and you've used all your extensions. Check in now or release the lot for someone else.`}
        </p>
        <div className="extend-actions">
          <button className="secondary" onClick={onCancel}>
            Release lot
          </button>
          {canExtend && (
            <button className="primary" onClick={onExtend}>
              Extend +10 min ({feeLabel})
            </button>
          )}
        </div>
        <button className="ghost modal-dismiss" onClick={onDismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}
