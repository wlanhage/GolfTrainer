// Georeferencing for satellite snapshots. A georef pins a rendered PNG to the
// Web Mercator world-pixel grid: zoom + world pixel of the PNG's top-left.
import { lngLatToWorldPixel, worldPixelToLngLat } from './geo.mjs';

const TILE = 256;

export function makeGeorefFromCenter({ lat, lng }, zoom, grid) {
  if (!Number.isInteger(grid) || grid < 2) throw new Error(`grid must be an integer >= 2, got ${grid}`);
  const c = lngLatToWorldPixel({ lat, lng }, zoom);
  const half = (grid * TILE) / 2;
  const originX = Math.floor((c.x - half) / TILE) * TILE;
  const originY = Math.floor((c.y - half) / TILE) * TILE;
  return { zoom, originX, originY, widthPx: grid * TILE, heightPx: grid * TILE };
}

// Highest zoom (19..12) whose bbox fits within maxSidePx, tile-aligned.
export function makeGeorefFromBounds({ minLat, minLng, maxLat, maxLng }, maxSidePx = 2560) {
  for (let zoom = 19; zoom >= 12; zoom--) {
    const nw = lngLatToWorldPixel({ lat: maxLat, lng: minLng }, zoom);
    const se = lngLatToWorldPixel({ lat: minLat, lng: maxLng }, zoom);
    if (Math.max(se.x - nw.x, se.y - nw.y) <= maxSidePx) {
      const originX = Math.floor(nw.x / TILE) * TILE;
      const originY = Math.floor(nw.y / TILE) * TILE;
      return {
        zoom,
        originX,
        originY,
        widthPx: Math.ceil((se.x - originX) / TILE) * TILE,
        heightPx: Math.ceil((se.y - originY) / TILE) * TILE
      };
    }
  }
  throw new Error('Bounds too large for a single snapshot even at zoom 12');
}

// "x,y x,y ..." (pixels in the snapshot frame) → [{lat, lng}, ...]
export function pixelsToPolygon(georef, pointsStr) {
  const pairs = String(pointsStr).trim().split(/\s+/).filter(Boolean);
  if (pairs.length < 3) throw new Error(`need at least 3 points, got ${pairs.length}`);
  return pairs.map((pair) => {
    const m = pair.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
    if (!m) throw new Error(`bad point "${pair}" — expected "x,y"`);
    return worldPixelToLngLat(
      { x: georef.originX + Number(m[1]), y: georef.originY + Number(m[2]) },
      georef.zoom
    );
  });
}

// "A:x,y B:x,y" → [{label, x, y}]
export function parseMarks(marksStr) {
  return String(marksStr)
    .trim()
    .split(/\s+/)
    .map((tok) => {
      const m = tok.match(/^([A-Za-z0-9]+):(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
      if (!m) throw new Error(`bad mark "${tok}" — expected "LABEL:x,y"`);
      return { label: m[1], x: Number(m[2]), y: Number(m[3]) };
    });
}
