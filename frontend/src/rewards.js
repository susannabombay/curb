import { BOOKING_FEE_CENTS, EXTEND_FEE_CENTS, MAX_EXTENDS } from "./mockData";

// Reliability tiers, earned by a streak of on-time check-ins (any no-show
// resets it). Better tiers get a cheaper hold, free extends and an extra
// extend -- a reason to book and show up, not just a penalty for not.
// Mirrored server-side in backend/main.py (TIERS), which is what actually
// sets the fee and extend limit for logged-in accounts.
export const TIERS = [
  { id: "starter", label: "Starter", minStreak: 0, holdFeeCents: BOOKING_FEE_CENTS, freeExtend: false, maxExtends: MAX_EXTENDS },
  { id: "silver", label: "Silver", minStreak: 3, holdFeeCents: 150, freeExtend: true, maxExtends: MAX_EXTENDS },
  { id: "gold", label: "Gold", minStreak: 8, holdFeeCents: 100, freeExtend: true, maxExtends: MAX_EXTENDS + 1 },
];

export function tierForStreak(streak) {
  return [...TIERS].reverse().find((t) => streak >= t.minStreak);
}

export function tierById(id) {
  return TIERS.find((t) => t.id === id) || TIERS[0];
}

export function nextTier(tier) {
  return TIERS[TIERS.indexOf(tier) + 1] || null;
}

export function extendFeeCents(tier) {
  return tier.freeExtend ? 0 : EXTEND_FEE_CENTS;
}

// Perks shown on the Profile rewards card, with the tier that unlocks each.
export const PERKS = [
  { id: "fee-silver", tier: "silver", label: "Hold fee drops to $1.50" },
  { id: "free-extend", tier: "silver", label: "Free extensions" },
  { id: "fee-gold", tier: "gold", label: "Hold fee drops to $1.00" },
  { id: "extra-extend", tier: "gold", label: "One extra extension per hold" },
];
