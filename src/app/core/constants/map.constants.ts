/**
 * Map Configuration & Project Location Constants
 * Phase 1B — Real Satellite 3D Map Foundation
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

export const PROJECT_LOCATION: Coordinates = {
  lat: 15.1267357,
  lng: 76.901774
};

export const INITIAL_MAP_CONFIG = {
  // MapLibre GL format: [longitude, latitude]
  center: [PROJECT_LOCATION.lng, PROJECT_LOCATION.lat] as [number, number],
  zoom: 16.5,
  minZoom: 3,
  maxZoom: 20,
  pitch: 55,
  bearing: -15,
  maxPitch: 75
};

export const CAMERA_PRESETS = {
  view2D: {
    pitch: 0,
    bearing: 0,
    zoom: 16.5
  },
  view3D: {
    pitch: 55,
    bearing: -20,
    zoom: 16.5
  }
};


/**
 * Satellite Basemap Style Specification
 * Primary: Esri World Imagery (No API key required, public satellite tile service)
 */
export const BASEMAP_STYLES = {
  satelliteStyle: {
    version: 8,
    sources: {
      'esri-satellite': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
      },
      'esri-boundaries': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: 'Labels &copy; Esri'
      },
      'carto-labels': {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}.png',
          'https://b.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}.png',
          'https://c.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}.png'
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: '&copy; CARTO &copy; OpenStreetMap'
      },
      'esri-transportation': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}'
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: 'Roads &copy; Esri'
      }
    },
    layers: [
      {
        id: 'esri-satellite-layer',
        type: 'raster',
        source: 'esri-satellite',
        minzoom: 0,
        maxzoom: 19
      },
      {
        id: 'esri-transportation-layer',
        type: 'raster',
        source: 'esri-transportation',
        minzoom: 0,
        maxzoom: 19
      },
      {
        id: 'esri-boundaries-layer',
        type: 'raster',
        source: 'esri-boundaries',
        minzoom: 0,
        maxzoom: 19
      },
      {
        id: 'carto-labels-layer',
        type: 'raster',
        source: 'carto-labels',
        minzoom: 0,
        maxzoom: 19
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
        attribution: '&copy; OpenStreetMap contributors'
      }
    },
    layers: [
      {
        id: 'osm-tiles-layer',
        type: 'raster',
        source: 'osm-tiles',
        minzoom: 0,
        maxzoom: 19
      }
    ]
  }
};

