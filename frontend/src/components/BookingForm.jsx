import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { BOOKING_FEE_CENTS, LOT_TYPES, lotTypeCount, PAYNOW_ENTITY_NAME, PAYNOW_UEN } from "../mockData";
import { addMinutesToTimeLabel } from "../time";
import { getSavedDriver, saveDriver } from "../profile";

// Checkout step: collects the details needed to actually hold a lot.
// Payment is mocked either way (card or PayNow) -- this is a UI prototype,
// so nothing here is stored or sent anywhere real, and the PayNow QR
// encodes a fictional demo entity, never a real UEN.
export default function BookingForm({ mall, arriveTime, onBack, onConfirm }) {
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

  const feeLabel = `$${(BOOKING_FEE_CENTS / 100).toFixed(2)}`;
  const availableLotTypes = LOT_TYPES.filter(
    (t) => t.id === "standard" || lotTypeCount(mall, t.id) > 0
  );

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
      <button className="back" onClick={onBack}>
        ← Back
      </button>
      <h2>Confirm booking</h2>
      <div className="carpark-area">{mall.name}</div>

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

        <label className="field-label">Arriving at</label>
        <input type="time" value={arrive} onChange={(e) => setArrive(e.target.value)} required />

        <label className="field-label">Leaving by</label>
        <input type="time" value={leave} onChange={(e) => setLeave(e.target.value)} required />

        <label className="field-label">Lot type</label>
        <div className="chip-row">
          {availableLotTypes.map((t) => (
            <button
              type="button"
              key={t.id}
              className={`chip ${lotType === t.id ? "active" : ""}`}
              onClick={() => setLotType(t.id)}
            >
              {t.label}
              {t.id !== "standard" && <span className="chip-count">{lotTypeCount(mall, t.id)}</span>}
            </button>
          ))}
        </div>

        <label className="field-label">Payment method</label>
        <div className="chip-row">
          <button
            type="button"
            className={`chip ${paymentMethod === "card" ? "active" : ""}`}
            onClick={() => setPaymentMethod("card")}
          >
            Demo card
          </button>
          <button
            type="button"
            className={`chip ${paymentMethod === "paynow" ? "active" : ""}`}
            onClick={() => setPaymentMethod("paynow")}
          >
            PayNow (demo)
          </button>
        </div>

        {paymentMethod === "card" ? (
          <div className="mock-card">
            <span>Visa •••• 4242</span>
            <span className="muted">(demo card -- not charged)</span>
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

        <div className="cost-summary">
          <div className="cost-row">
            <span>Reservation hold fee</span>
            <span>{feeLabel}</span>
          </div>
          <div className="muted">Standard parking rates apply on top once you arrive.</div>
        </div>

        <button type="submit" className="primary login-btn">
          Confirm &amp; book -- {feeLabel}
        </button>
      </form>
    </div>
  );
}
