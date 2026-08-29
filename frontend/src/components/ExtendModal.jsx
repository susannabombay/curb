import React from "react";
import { EXTEND_FEE_CENTS } from "../mockData";

// The "key mechanic" pop-up: interrupts the screen once the hold is close
// to expiring and the driver hasn't checked in yet. App only renders this
// when reservation.showExtendPrompt is true, which is derived every tick
// from the real clock (see deriveReservationView in App.jsx) -- not from a
// counter that could drift.
export default function ExtendModal({ mall, canExtend, onExtend, onCancel, onDismiss }) {
  const feeLabel = `$${(EXTEND_FEE_CENTS / 100).toFixed(2)}`;

  return (
    <div className="modal-scrim">
      <div className="modal-card">
        <h3>5 minutes left</h3>
        <p className="muted">
          {canExtend
            ? `You haven't checked in at ${mall} yet. Extend your hold or release the lot for someone else.`
            : `You haven't checked in at ${mall} yet, and you've already used your one extension. Check in now or release the lot for someone else.`}
        </p>
        <div className="extend-actions">
          <button className="secondary" onClick={onCancel}>
            Cancel reservation
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
