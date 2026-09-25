/**
 * Map Configuration & Project Location Constants
 * Phase 1B — Real Satellite 3D Map Foundation
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

export const PROJECT_LOCATION: Coordinates = {
  lat: 15.1268953,
  lng: 76.9007270
};

export const INITIAL_MAP_CONFIG = {
  // MapLibre GL format: [longitude, latitude]
  center: [PROJECT_LOCATION.lng, PROJECT_LOCATION.lat] as [number, number],
  zoom: 18.8,
  minZoom: 0,
  maxZoom: 22,
  pitch: 50,
  bearing: -15,
  maxPitch: 75
};

export const CAMERA_PRESETS = {
  view2D: {
    pitch: 0,
    bearing: 0,
    zoom: 18.8
  },
  view3D: {
    pitch: 50,
    bearing: -15,
    zoom: 18.8
  }
};

/**
 * Satellite Basemap Style Specification
 * Primary: Esri World Imagery (No API key required, public satellite tile service)
 * Labels: Esri Boundaries & Places + CARTO Voyager Labels
 */
export const BASEMAP_STYLES = {
  satelliteStyle: {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      'google-hybrid-satellite': {
        type: 'raster',
        tiles: [
          'https://mt0.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
          'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
          'https://mt2.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
          'https://mt3.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
        ],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 20,
        attribution: 'Map & Imagery &copy; Google'
      }
    },
    layers: [
      {
        id: 'masterplan-background',
        type: 'background',
        paint: {
          'background-color': '#0f172a'
        }
      },
      {
        id: 'google-hybrid-satellite-layer',
        type: 'raster',
        source: 'google-hybrid-satellite',
        minzoom: 0,
        maxzoom: 24,
        paint: {
          'raster-fade-duration': 0,
          'raster-resampling': 'linear'
        }
      }
    ]
  },
  osmStyle: {
    version: 8,
    sources: {
      'osm-tiles': {
        type: 'raster',
        tiles: [
          'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
        ],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }
    },
    layers: [
      {
        id: 'osm-tiles-layer',
        type: 'raster',
        source: 'osm-tiles',
        minzoom: 0,
        maxzoom: 24
      }
    ]
  }
};


