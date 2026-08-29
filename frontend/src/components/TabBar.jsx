import React from "react";

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
    </svg>
  );
}

// Persistent bottom nav, shown on every screen except login. Switching
// tabs jumps straight to that top-level screen -- if the driver is
// mid-checkout and taps "Map", that in-progress form is abandoned, same
// as tapping away from an in-progress flow in most tabbed apps.
export default function TabBar({ active, onChange }) {
  return (
    <div className="tab-bar">
      <button className={`tab-btn ${active === "map" ? "active" : ""}`} onClick={() => onChange("map")}>
        <MapIcon />
        Map
      </button>
      <button
        className={`tab-btn ${active === "profile" ? "active" : ""}`}
        onClick={() => onChange("profile")}
      >
        <ProfileIcon />
        Profile
      </button>
    </div>
  );
}
