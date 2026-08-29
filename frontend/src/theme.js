// Theme preference: "light" | "dark" | null (null = follow system).
// Stored explicitly only when the driver picks one on the Profile screen;
// otherwise we defer to the OS/browser's prefers-color-scheme every time.
const STORAGE_KEY = "curb-theme";

export function getStoredTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "light" || theme === "dark") root.setAttribute("data-theme", theme);
  else root.removeAttribute("data-theme");
}

export function setTheme(theme) {
  try {
    if (theme) localStorage.setItem(STORAGE_KEY, theme);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore -- storage can be unavailable (private mode, etc.)
  }
  applyTheme(theme);
}

export function initTheme() {
  applyTheme(getStoredTheme());
}
