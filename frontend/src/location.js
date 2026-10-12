// Device location for verifying "I've arrived". Wraps the callback-style
// Geolocation API in a promise and turns its error codes into messages a
// driver can act on.
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("This device can't share its location, so we can't confirm you've arrived."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error("Allow location access so we can confirm you're at the carpark."));
        } else if (err.code === err.TIMEOUT) {
          reject(new Error("Couldn't get your location in time. Try again near the carpark entrance."));
        } else {
          reject(new Error("Couldn't get your location. Try again near the carpark entrance."));
        }
      },
      // Fresh, precise fix -- a cached position from home would defeat the check.
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

// Great-circle (haversine) distance in metres.
export function distanceMeters(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

export function formatDistance(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}
