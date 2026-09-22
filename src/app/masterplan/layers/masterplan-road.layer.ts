import { MASTERPLAN_ROAD_STYLES } from '../config/masterplan.config';

/**
 * MapLibre layer definitions for rendering the Road Master Plan
 * with professional real-estate aesthetics (dark asphalt surface, subtle curb edges, clean typography).
 */
export const ROAD_SOURCE_ID = 'masterplan-road-source';
export const ROAD_LABELS_SOURCE_ID = 'masterplan-road-labels-source';

export const ROAD_LAYERS = {
  // 1. Filled Road Corridor Surface (Dark Asphalt/Slate)
  // Excludes unwanted central block structures (16060, 16062, 160A1, 160A9)
  surfaceLayer: {
    id: 'masterplan-road-surface',
    type: 'fill' as const,
    source: ROAD_SOURCE_ID,
    filter: [
      'all',
      ['==', ['geometry-type'], 'Polygon'],
      ['!in', ['get', 'sourceEntityHandle'], ['literal', ['16060', '16062', '160A1', '160A9']]]
    ],
    layout: {
      visibility: 'none' as const
    },
    paint: {
      'fill-color': MASTERPLAN_ROAD_STYLES.asphaltSurfaceColor,
      'fill-opacity': MASTERPLAN_ROAD_STYLES.asphaltOpacity
    }
  },

  // 2. Road Curb / Border Edges (Subtle lighter border)
  curbLayer: {
    id: 'masterplan-road-curb',
    type: 'line' as const,
    source: ROAD_SOURCE_ID,
    filter: ['!in', ['get', 'sourceEntityHandle'], ['literal', ['16060', '16062', '160A1', '160A9']]],
    layout: {
      visibility: 'none' as const,
      'line-cap': 'round' as const,
      'line-join': 'round' as const
    },
    paint: {
      'line-color': MASTERPLAN_ROAD_STYLES.curbBorderColor,
      'line-width': [
        'interpolate', ['linear'], ['zoom'],
        12, 2.0,
        15, 3.5,
        18, 6.0,
        20, 9.0
      ],
      'line-opacity': MASTERPLAN_ROAD_STYLES.curbBorderOpacity
    }
  },

  // 3. Open Centerline & Auxiliary Linework
  centerlineLayer: {
    id: 'masterplan-road-centerline',
    type: 'line' as const,
    source: ROAD_SOURCE_ID,
    filter: ['==', ['geometry-type'], 'LineString'],
    layout: {
      visibility: 'none' as const,
      'line-cap': 'round' as const,
      'line-join': 'round' as const
    },
    paint: {
      'line-color': MASTERPLAN_ROAD_STYLES.centerlineColor,
      'line-width': [
        'interpolate', ['linear'], ['zoom'],
        12, 1.5,
        15, 2.5,
        18, 4.0,
        20, 6.0
      ],
      'line-opacity': MASTERPLAN_ROAD_STYLES.centerlineOpacity
    }
  },

  // 4. Road Width Text Callouts (9M ROAD, 12M ROAD, GOWLI HATTI ROAD)
  labelsLayer: {
    id: 'masterplan-road-labels',
    type: 'symbol' as const,
    source: ROAD_LABELS_SOURCE_ID,
    minzoom: 15,
    layout: {
      visibility: 'none' as const,
      'text-field': ['get', 'text'],
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        15, 10,
        17, 12,
        19, 14,
        21, 16
      ],
      'text-anchor': 'center' as const,
      'text-allow-overlap': false,
      'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold']
    },
    paint: {
      'text-color': MASTERPLAN_ROAD_STYLES.labelColor,
      'text-halo-color': MASTERPLAN_ROAD_STYLES.labelHaloColor,
      'text-halo-width': MASTERPLAN_ROAD_STYLES.labelHaloWidth
    }
  }
};
