// Persists the logged-in session (JWT + email) so a real account survives
// a page reload -- including the case that actually prompted this: tapping
// "Navigate there" hands off to the Google Maps app, and on some
// browsers/OSes that can evict or reload the tab, which would otherwise
// wipe all in-memory state. Guest mode intentionally has none of this --
// there's no account to remember.
const KEY = "curb-auth";

export function getStoredAuth() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null; // { token, email }
  } catch {
    return null;
  }
}

export function setStoredAuth(auth) {
  try {
    if (auth) localStorage.setItem(KEY, JSON.stringify(auth));
    else localStorage.removeItem(KEY);
  } catch {
    // ignore -- storage can be unavailable
  }
}
