import React, { useState } from "react";
import { formatCountdown } from "../time";
import { getSavedDriver, saveDriver } from "../profile";
import { isSuspended } from "../reliability";
import { PERKS, TIERS, nextTier } from "../rewards";
import { formatCents } from "../mockData";
import { monthlySummaries, downloadMonthCsv } from "../receipts";
import ParkedCarCard from "./ParkedCarCard.jsx";
import ReceiptModal from "./ReceiptModal.jsx";

// Editable name/plate, saved to localStorage so BookingForm can pre-fill
// them on the next booking instead of the driver retyping every time.
function DriverDetails() {
  const saved = getSavedDriver();
  const [name, setName] = useState(saved?.name || "");
  const [plate, setPlate] = useState(saved?.plate || "");
  const [savedAt, setSavedAt] = useState(null);

  return (
    <div className="driver-details">
      <input
        className="driver-input"
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className="driver-input"
        placeholder="Car plate"
        value={plate}
        onChange={(e) => setPlate(e.target.value)}
      />
      <button
        className="secondary"
        onClick={() => {
          saveDriver({ name: name.trim(), plate: plate.trim().toUpperCase() });
          setSavedAt(Date.now());
        }}
      >
        {savedAt ? "Saved" : "Save details"}
      </button>
    </div>
  );
}

function ReliabilityStatus({ reliability }) {
  if (!reliability || reliability.noShowCount === 0) {
    return <div className="urgency-banner ok">No no-shows on record.</div>;
  }
  if (isSuspended(reliability)) {
    const until = new Date(reliability.suspendedUntil).toLocaleString([], {
      hour: "numeric",
      minute: "2-digit",
      month: "short",
      day: "numeric",
    });
    return (
      <div className="urgency-banner full">
        Booking suspended until {until} after {reliability.noShowCount} no-shows.
      </div>
    );
  }
  return (
    <div className="urgency-banner low">
      {reliability.noShowCount} no-show{reliability.noShowCount === 1 ? "" : "s"} on record -- one more
      will temporarily suspend booking.
    </div>
  );
}

// Tier, progress to the next one, and every perk -- unlocked ones in full
// colour, the rest greyed out with the tier that unlocks them.
function RewardsCard({ tier, reliability }) {
  const streak = reliability?.streak || 0;
  const next = nextTier(tier);
  const progress = next ? Math.min(1, (streak - tier.minStreak) / (next.minStreak - tier.minStreak)) : 1;
  const tierRank = (id) => TIERS.findIndex((t) => t.id === id);

  return (
    <div className={`card rewards-card tier-${tier.id}`}>
      <div className="rewards-head">
        <div>
          <div className="rewards-tier">{tier.label}</div>
          <div className="muted">
            {streak} on-time arrival{streak === 1 ? "" : "s"} in a row
          </div>
        </div>
        <div className="rewards-medal" title="Current streak">{streak}</div>
      </div>
      <div className="rewards-progress">
        <div className="rewards-progress-fill" style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="rewards-next">
        {next
          ? `${next.minStreak - streak} more on-time arrival${next.minStreak - streak === 1 ? "" : "s"} to ${next.label}`
          : "Top tier - keep your streak going"}
      </div>
      <div className="perk-list">
        {PERKS.map((p) => {
          const unlocked = tierRank(tier.id) >= tierRank(p.tier);
          return (
            <div key={p.id} className={`perk ${unlocked ? "unlocked" : "locked"}`}>
              <span className="perk-dot" />
              <span>{p.label}</span>
              <span className="perk-tier">{unlocked ? "Unlocked" : TIERS[tierRank(p.tier)].label}</span>
            </div>
          );
        })}
      </div>
      <div className="muted rewards-foot">A no-show resets your streak.</div>
    </div>
  );
}

function MonthlySummary({ history }) {
  const months = monthlySummaries(history);
  if (months.length === 0) return null;
  return (
    <>
      <div className="section-title">Monthly summary</div>
      <div className="month-list">
        {months.map((m) => (
          <div className="card month-card" key={m.key}>
            <div className="month-head">
              <span className="month-label">{m.label}</span>
              <span className="month-total">{formatCents(m.totalCents)}</span>
            </div>
            <div className="month-counts">
              <span>{m.counts.arrived} completed</span>
              <span>{m.counts.cancelled} cancelled</span>
              <span>{m.counts.expired} no-show</span>
            </div>
            <button className="link-btn" onClick={() => downloadMonthCsv(m)}>
              Export CSV for expenses
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function statusLabel(status) {
  return { arrived: "Arrived", cancelled: "Cancelled", expired: "No-show" }[status] || status;
}

// Account + "your active reservation" screen, reachable at any time via
// the bottom tab bar -- so a driver who wandered back to the map to check
// another mall can still see/manage their existing hold.
export default function ProfileScreen({
  user,
  reservation,
  history,
  reliability,
  tier,
  parkedCar,
  onClearParkedCar,
  onTrack,
  onLogout,
}) {
  const [receiptEntry, setReceiptEntry] = useState(null);
  const hasActive = reservation && ["active", "extended"].includes(reservation.effectiveStatus);

  const initial = user?.guest ? "G" : (user?.email || "?")[0].toUpperCase();

  return (
    <div className="screen profile-screen">
      <div className="profile-head">
        <div className="avatar">{initial}</div>
        <div>
          <h2>{user?.guest ? "Guest driver" : "Profile"}</h2>
          <div className="muted">{user?.guest ? "Not signed in" : user?.email}</div>
        </div>
      </div>

      <div className="section-title">Active reservation</div>
      {hasActive ? (
        <div className="card summary-card" style={{ margin: 0 }}>
          <div className="summary-row">
            <span>{reservation.carpark_name}</span>
            <span className={`status-pill ${reservation.effectiveStatus}`}>
              {reservation.effectiveStatus === "extended" ? "Extended" : "Reserved"}
            </span>
          </div>
          <div className="summary-row">
            <span>Time left</span>
            <span>{formatCountdown(reservation.secondsRemaining)}</span>
          </div>
          <button className="primary summary-card-btn" onClick={onTrack}>
            View reservation
          </button>
        </div>
      ) : (
        <p className="muted empty-note">No active reservation - pick a mall on the map to book a spot.</p>
      )}

      <div className="section-title">Your details</div>
      <div className="card">
        <DriverDetails />
      </div>

      {parkedCar && (
        <>
          <div className="section-title">Find my car</div>
          <ParkedCarCard car={parkedCar} onClear={onClearParkedCar} />
        </>
      )}

      <div className="section-title">Rewards</div>
      <RewardsCard tier={tier} reliability={reliability} />
      {reliability?.noShowCount > 0 && <ReliabilityStatus reliability={reliability} />}

      <div className="section-title">Booking history</div>
      {history && history.length > 0 ? (
        <div className="history-list">
          {history.map((h, i) => (
            <button className="history-row" key={h.id || i} onClick={() => setReceiptEntry(h)}>
              <div className="history-left">
                <div className="history-icon">P</div>
                <div>
                  <div className="history-mall">{h.carpark_name}</div>
                  <div className="muted">
                    {new Date(h.finishedAt).toLocaleDateString([], { month: "short", day: "numeric" })} ·{" "}
                    {h.arriveTime}
                  </div>
                </div>
              </div>
              <div className="history-right">
                <span className={`status-pill ${h.finalStatus}`}>{statusLabel(h.finalStatus)}</span>
                <span className="muted">{formatCents(h.fee_cents || 0)} · Receipt</span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <p className="muted empty-note">No past bookings yet.</p>
      )}

      <MonthlySummary history={history} />

      {receiptEntry && <ReceiptModal entry={receiptEntry} onClose={() => setReceiptEntry(null)} />}

      <button className="ghost logout-btn" onClick={onLogout}>
        Log out
      </button>
    </div>
  );
}
