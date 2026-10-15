// Privacy offset: move a real coordinate 1–3 km in a random direction so the
// dot is placed *near* the user, never at their exact location. A fresh random
// offset is generated each session (this runs once per join), so the same user
// lands somewhere different every time.

const EARTH_RADIUS_KM = 6371.0088;

export function applyPrivacyOffset(
  lat: number,
  lng: number,
): { lat: number; lng: number } {
  const distanceKm = 1 + Math.random() * 2; // 1–3 km
  const bearing = Math.random() * 2 * Math.PI; // random direction
  const angularDistance = distanceKm / EARTH_RADIUS_KM;
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  const offsetLat = Math.asin(
    Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const offsetLng =
    lngRad +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(offsetLat),
    );

  return {
    lat: (offsetLat * 180) / Math.PI,
    lng: wrapLng((offsetLng * 180) / Math.PI),
  };
}

function wrapLng(lng: number): number {
  // Keep longitude in [-180, 180].
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}
