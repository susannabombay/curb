import React from "react";
import { PinIcon as MapIcon, UserIcon as ProfileIcon } from "./icons.jsx";

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
