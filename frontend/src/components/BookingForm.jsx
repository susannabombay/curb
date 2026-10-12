import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  BOOKING_FEE_CENTS,
  LOT_TYPES,
  lotTypeCount,
  PAYNOW_ENTITY_NAME,
  PAYNOW_UEN,
  estimateParkingFee,
  formatCents,
  formatDuration,
  stayMinutes,
} from "../mockData";
import { addMinutesToTimeLabel } from "../time";
import { getSavedDriver, saveDriver } from "../profile";
import { BackIcon, PinIcon } from "./icons.jsx";

// Checkout step: collects the details needed to actually hold a lot.
// Payment is mocked either way (card or PayNow) -- this is a UI prototype,
// so nothing here is stored or sent anywhere real, and the PayNow QR
// encodes a fictional demo entity, never a real UEN.
export default function BookingForm({ mall, arriveTime, tier, onBack, onConfirm }) {
  const savedDriver = getSavedDriver();
  const [name, setName] = useState(savedDriver?.name || "");
  const [plate, setPlate] = useState(savedDriver?.plate || "");
  const [rememberMe, setRememberMe] = useState(true);
  const [arrive, setArrive] = useState(arriveTime);
  // Default "leaving" time is a rough 2-hour shopping trip -- just a
  // starting point, the driver can change it.
  const [leave, setLeave] = useState(() => addMinutesToTimeLabel(arriveTime, 120));
  const [lotType, setLotType] = useState("standard");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [qrDataUrl, setQrDataUrl] = useState(null);

  // Hold fee depends on the driver's reliability tier (rewards.js).
  const feeCents = tier.holdFeeCents;
  const feeLabel = formatCents(feeCents);
  const discounted = feeCents < BOOKING_FEE_CENTS;
  const parkingEstimate = estimateParkingFee(mall, arrive, leave);

  // Generated once, lazily, the first time the driver actually picks
  // PayNow -- no point building it up front for the common (card) path.
  useEffect(() => {
    if (paymentMethod !== "paynow" || qrDataUrl) return;
    const payload = [
      "PAYNOW-DEMO",
      `ENTITY:${PAYNOW_ENTITY_NAME}`,
      `UEN:${PAYNOW_UEN}`,
      `AMOUNT:${feeLabel}`,
      `REF:CURB-${mall.id.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
    ].join("|");
    QRCode.toDataURL(payload, { margin: 1, width: 176 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [paymentMethod, qrDataUrl, feeLabel, mall.id]);

  return (
    <div className="screen checkout-screen">
      <div className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <BackIcon />
        </button>
        <span className="topbar-title">Confirm booking</span>
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

      <form
        className="login-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (rememberMe) saveDriver({ name: name.trim(), plate: plate.trim().toUpperCase() });
          onConfirm({
            name: name.trim(),
            plate: plate.trim().toUpperCase(),
            arriveTime: arrive,
            leaveTime: leave,
            lotType,
            paymentMethod,
          });
        }}
      >
        <div className="card form-card">
          <div className="form-card-title">Driver</div>
          <label className="field-label">Name</label>
          <input
            autoFocus
            placeholder="e.g. Jane Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <label className="field-label">Car plate</label>
          <input
            placeholder="e.g. SGX1234A"
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            required
          />

          <label className="checkbox-row">
            <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
            Remember my details for next time
          </label>
        </div>

        <div className="card form-card">
          <div className="form-card-title">Timing</div>
          <div className="time-pair">
            <div>
              <label className="field-label">Arriving at</label>
              <input type="time" value={arrive} onChange={(e) => setArrive(e.target.value)} required />
            </div>
            <div>
              <label className="field-label">Leaving by</label>
              <input type="time" value={leave} onChange={(e) => setLeave(e.target.value)} required />
            </div>
          </div>
        </div>

        <div className="card form-card">
          <div className="form-card-title">Lot type</div>
          <div className="chip-row" style={{ marginTop: 10 }}>
            {LOT_TYPES.map((t) => {
              const count = lotTypeCount(mall, t.id);
              // Lot types with nothing free stay visible but greyed out, so
              // the driver can see they exist here -- just not right now.
              const unavailable = t.id !== "standard" && count === 0;
              return (
                <button
                  type="button"
                  key={t.id}
                  disabled={unavailable}
                  className={`chip ${lotType === t.id ? "active" : ""} ${unavailable ? "disabled" : ""}`}
                  onClick={() => setLotType(t.id)}
                >
                  {t.label}
                  {t.id !== "standard" && <span className="chip-count">{count}</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="card form-card">
          <div className="form-card-title">Payment</div>
          <div className="segmented" style={{ marginTop: 10 }}>
            <button
              type="button"
              className={paymentMethod === "card" ? "active" : ""}
              onClick={() => setPaymentMethod("card")}
            >
              Demo card
            </button>
            <button
              type="button"
              className={paymentMethod === "paynow" ? "active" : ""}
              onClick={() => setPaymentMethod("paynow")}
            >
              PayNow (demo)
            </button>
          </div>

          {paymentMethod === "card" ? (
            <div className="mock-card">
              <div className="mock-card-row">
                <span className="mock-card-brand">VISA</span>
                <span className="muted">Demo · not charged</span>
              </div>
              <div className="mock-card-number">•••• •••• •••• 4242</div>
            </div>
          ) : (
            <div className="paynow-card">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Demo PayNow QR code" width={132} height={132} />
              ) : (
                <div className="paynow-qr-placeholder muted">Generating QR...</div>
              )}
              <div>
                <div className="paynow-entity">{PAYNOW_ENTITY_NAME}</div>
                <div className="muted">UEN {PAYNOW_UEN} (demo -- not a real payee, not charged)</div>
              </div>
            </div>
          )}
        </div>

        <div className="cost-summary">
          <div className="cost-row">
            <span>Reservation hold fee</span>
            <span>
              {discounted && <s className="cost-was">{formatCents(BOOKING_FEE_CENTS)}</s>}
              {feeLabel}
            </span>
          </div>
          {discounted && <div className="cost-perk">{tier.label} reward - thanks for always showing up</div>}
          {parkingEstimate != null && (
            <div className="cost-row cost-estimate">
              <span>
                Est. parking at {mall.name}
                <small>
                  {formatDuration(stayMinutes(arrive, leave))} at the mall's rates · paid at the gantry
                </small>
              </span>
              <span>~{formatCents(parkingEstimate)}</span>
            </div>
          )}
        </div>

        <button type="submit" className="primary login-btn">
          Confirm &amp; pay {feeLabel}
        </button>
      </form>
    </div>
  );
}
