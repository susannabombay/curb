// Small helpers that connect the UI to the real wall clock, instead of
// counting down a plain number. Everything here works with actual Date
// objects so timers stay correct even if the tab is backgrounded and a
// setInterval tick gets delayed or skipped.

function pad(n) {
  return String(n).padStart(2, "0");
}

// Turns a Date into an "HH:MM" string for <input type="time"> fields.
export function timeLabel(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// "HH:MM" string for N minutes from right now -- used to default the
// arrival-time pickers to something sensible ("15 minutes from now").
export function defaultTimeLabel(minutesFromNow) {
  return timeLabel(new Date(Date.now() + minutesFromNow * 60000));
}

// Same as above, but offset from an existing "HH:MM" label rather than now
// (e.g. "leaving 2 hours after I arrive").
export function addMinutesToTimeLabel(hhmm, minutes) {
  const d = timeStringToDate(hhmm);
  d.setMinutes(d.getMinutes() + minutes);
  return timeLabel(d);
}

// Converts an "HH:MM" string picked from a time input into a real Date.
// Time inputs don't carry a date, so we assume "today" -- unless that time
// has already passed, in which case we assume the driver means tomorrow.
export function timeStringToDate(hhmm) {
  const [hours, minutes] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  if (d.getTime() <= Date.now()) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

// Whole minutes from now until a given Date (never negative).
export function minutesUntil(date) {
  return Math.max(0, Math.round((date.getTime() - Date.now()) / 60000));
}

// "MM:SS" countdown display for a number of seconds.
export function formatCountdown(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const r = Math.floor(s % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${r}`;
}
