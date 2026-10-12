import React from "react";
import { EXTEND_FEE_CENTS, findMall, formatCents } from "../mockData";
import { receiptNumber } from "../receipts";
import { LogoGlyph } from "./icons.jsx";

const STATUS = { arrived: "Completed", cancelled: "Cancelled", expired: "No-show" };

// One booking's receipt. "Save as PDF" uses the browser's print dialog
// (every browser can print to PDF) with print styles that hide everything
// but the receipt.
export default function ReceiptModal({ entry, onClose }) {
  const mall = findMall(entry.carpark_id);
  const date = new Date(entry.finishedAt);

  return (
    <div className="modal-scrim receipt-scrim" onClick={onClose}>
      <div className="modal-card receipt-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-grabber no-print" />
        <div className="receipt" id="receipt">
          <div className="receipt-head">
            <div className="mini-logo">
              <LogoGlyph size={20} />
            </div>
            <div>
              <div className="receipt-title">Curb receipt</div>
              <div className="muted">{receiptNumber(entry)}</div>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-row">
              <span>Date</span>
              <span>{date.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}</span>
            </div>
            <div className="summary-row">
              <span>Carpark</span>
              <span>{entry.carpark_name}</span>
            </div>
            {mall && (
              <div className="summary-row">
                <span>Area</span>
                <span>{mall.area}</span>
              </div>
            )}
            <div className="summary-row">
              <span>Car plate</span>
              <span>{entry.plate || "--"}</span>
            </div>
            <div className="summary-row">
              <span>Booked arrival</span>
              <span>
                {entry.arriveTime || "--"}
                {entry.leaveTime ? ` - ${entry.leaveTime}` : ""}
              </span>
            </div>
            <div className="summary-row">
              <span>Outcome</span>
              <span>{STATUS[entry.finalStatus] || entry.finalStatus}</span>
            </div>
            {entry.extendCount > 0 && (
              <div className="summary-row">
                <span>Extensions</span>
                <span>{entry.extendCount}</span>
              </div>
            )}
            <div className="summary-row receipt-total">
              <span>Total paid to Curb</span>
              <span>{formatCents(entry.fee_cents || 0)}</span>
            </div>
          </div>
          <p className="muted receipt-foot">
            Reservation hold fee{entry.extendCount > 0 ? ` incl. extensions (${formatCents(EXTEND_FEE_CENTS)} each unless free with your tier)` : ""}.
            Mall parking charges are paid separately at the carpark. Demo receipt - no real payment was taken.
          </p>
        </div>
        <div className="extend-actions no-print">
          <button className="secondary" onClick={onClose}>
            Close
          </button>
          <button className="primary" onClick={() => window.print()}>
            Save as PDF
          </button>
        </div>
      </div>
    </div>
  );
}
