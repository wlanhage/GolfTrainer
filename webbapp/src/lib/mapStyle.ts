// Delade MapLibre-stilar. Använder gratis tile-källor utan API-nyckel.
//
// SATELLITE: Esri World Imagery — gratis, ingen API-nyckel, hög upplösning,
// perfekt för att se faktiska golfbanor med fairway/bunker/trees synliga
// utan att rita dem manuellt.
//
// OSM: OpenStreetMap raster fallback om man föredrar karta över satellit.

import type { StyleSpecification } from 'maplibre-gl';

export const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    satellite: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Tiles © Esri'
    }
  },
  layers: [{ id: 'satellite-base', type: 'raster', source: 'satellite' }]
};

export const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors'
    }
  },
  layers: [{ id: 'osm-base', type: 'raster', source: 'osm' }]
};

// Default — byt här för att växla globalt
export const DEFAULT_MAP_STYLE = SATELLITE_STYLE;
