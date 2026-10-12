// "Find my car": where the driver left the car after checking in -- level,
// zone and an optional note. Kept until they tap "I've left", so it's there
// hours later when they've forgotten. Local to this device (it's only
// useful on the phone that's in the driver's pocket anyway).
const KEY = "curb-parked-car";

export const PARKING_LEVELS = ["B1", "B2", "B3", "B4", "B5"];
export const PARKING_ZONES = ["A", "B", "C", "D", "E", "F"];

export function getParkedCar() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// car: { carpark_name, lat, lon, plate, level, zone, note, savedAt }
export function saveParkedCar(car) {
  try {
    localStorage.setItem(KEY, JSON.stringify(car));
  } catch {
    // ignore -- storage can be unavailable
  }
  return car;
}

export function clearParkedCar() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  return null;
}
