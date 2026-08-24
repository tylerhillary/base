export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance in kilometres. */
export const distanceKm = (from: LatLng, to: LatLng): number => {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
};

export const formatDistance = (km: number): string =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;

/**
 * 0,0 is a real place in the Atlantic, so it is how we record "no spot pinned"
 * rather than a location anybody meant.
 */
export const hasCoordinates = (point: Partial<LatLng> | null | undefined): point is LatLng =>
  typeof point?.lat === "number" &&
  typeof point?.lng === "number" &&
  (point.lat !== 0 || point.lng !== 0);

/**
 * Universal maps link — the OS decides which app opens it.
 *
 * Falls back to searching the written address when no coordinates were pinned,
 * which is still a useful link, just less precise.
 */
export const mapsLink = (
  point: Partial<LatLng> | null | undefined,
  label?: string,
  address?: string
): string => {
  const query = hasCoordinates(point)
    ? label
      ? `${label}@${point.lat},${point.lng}`
      : `${point.lat},${point.lng}`
    : [label, address].filter(Boolean).join(" ");

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};

export const readBrowserPosition = (): Promise<LatLng> =>
  new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Location is not available in this browser"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      (error) =>
        reject(
          new Error(
            error.code === error.PERMISSION_DENIED
              ? "Location permission was denied"
              : "Could not determine your location"
          )
        ),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }
    );
  });
