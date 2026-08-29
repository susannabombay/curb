// Saved driver details (name + plate), so a returning driver doesn't retype
// them on every booking. Local to this browser -- there's no account
// backend, so this is keyed purely off localStorage like theme.js.
const KEY = "curb-driver";

export function getSavedDriver() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveDriver(driver) {
  try {
    localStorage.setItem(KEY, JSON.stringify(driver));
  } catch {
    // ignore -- storage can be unavailable (private mode, etc.)
  }
}
