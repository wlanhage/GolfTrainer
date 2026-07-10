// Pure geo helpers. Points are {lat, lng}, matching the backend schema.
const R = 6371000;
const toRad = (deg) => (deg * Math.PI) / 180;

export function haversineMeters(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// The app stores open rings: the backend averages every vertex for the green
// center, so OSM's duplicated closing vertex must be dropped.
export function normalizeRing(points) {
  if (points.length > 1) {
    const first = points[0];
    const last = points[points.length - 1];
    if (first.lat === last.lat && first.lng === last.lng) return points.slice(0, -1);
  }
  return points;
}

export function centroid(points) {
  const sum = points.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
    { lat: 0, lng: 0 }
  );
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

// Shoelace on an equirectangular projection centred on the polygon.
// Error is negligible at green scale (< 100 m across).
export function polygonAreaM2(points) {
  const ring = normalizeRing(points);
  if (ring.length < 3) return 0;
  const lat0 = toRad(centroid(ring).lat);
  const pts = ring.map((p) => ({ x: toRad(p.lng) * R * Math.cos(lat0), y: toRad(p.lat) * R }));
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

// Web Mercator world pixel at zoom z (256 px tiles).
export function lngLatToWorldPixel({ lat, lng }, z) {
  const size = 256 * 2 ** z;
  const x = ((lng + 180) / 360) * size;
  const latR = toRad(lat);
  const y = ((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * size;
  return { x, y };
}

export function worldPixelToLngLat({ x, y }, z) {
  const size = 256 * 2 ** z;
  const lng = (x / size) * 360 - 180;
  const n = Math.PI * (1 - 2 * (y / size));
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { lat, lng };
}
