import { MASTERPLAN_ROAD_STYLES } from '../config/masterplan.config';

/**
 * MapLibre layer definitions for rendering the Road Master Plan
 * with professional real-estate aesthetics (dark asphalt surface, subtle curb edges, clean typography).
 */
export const ROAD_SOURCE_ID = 'masterplan-road-source';
export const ROAD_LABELS_SOURCE_ID = 'masterplan-road-labels-source';

export const ROAD_LAYERS = {
  // 1. Filled Road Corridor Surface (Dark Asphalt/Slate)
  surfaceLayer: {
    id: 'masterplan-road-surface',
    type: 'fill' as const,
    source: ROAD_SOURCE_ID,
    filter: ['==', ['get', 'isCorridor'], true],
    layout: {
      visibility: 'visible' as const
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
    filter: ['==', ['get', 'isCorridor'], true],
    layout: {
      visibility: 'visible' as const,
      'line-cap': 'round' as const,
      'line-join': 'round' as const
    },
    paint: {
      'line-color': MASTERPLAN_ROAD_STYLES.curbBorderColor,
      'line-width': [
        'interpolate', ['linear'], ['zoom'],
        12, 1.5,
        15, 2.5,
        18, 4.5,
        20, 7.0
      ],
      'line-opacity': MASTERPLAN_ROAD_STYLES.curbBorderOpacity
    }
  },

  // 3. Master Plan Amenities Surface (Parks, CA Site, ENTRY)
  amenitySurfaceLayer: {
    id: 'masterplan-amenity-surface',
    type: 'fill' as const,
    source: ROAD_SOURCE_ID,
    filter: ['==', ['get', 'isAmenity'], true],
    layout: {
      visibility: 'visible' as const
    },
    paint: {
      'fill-color': [
        'match',
        ['get', 'amenityType'],
        'PARK', '#4d7c0f',
        'CA_SITE', '#d6c7a1',
        'ENTRY', '#7dd3fc',
        '#334155'
      ],
      'fill-opacity': 0.92
    }
  },

  // 4. Master Plan Amenities Border Edges
  amenityBorderLayer: {
    id: 'masterplan-amenity-border',
    type: 'line' as const,
    source: ROAD_SOURCE_ID,
    filter: ['==', ['get', 'isAmenity'], true],
    layout: {
      visibility: 'visible' as const,
      'line-cap': 'round' as const,
      'line-join': 'round' as const
    },
    paint: {
      'line-color': [
        'match',
        ['get', 'amenityType'],
        'PARK', '#365314',
        'CA_SITE', '#475569',
        'ENTRY', '#0284c7',
        '#334155'
      ],
      'line-width': 1.5,
      'line-opacity': 0.95
    }
  },

  // 5. Road Width & Amenity Text Callouts (9 Meter Road, 12 Meter Road, Park, CA Site, ENTRY)
  labelsLayer: {
    id: 'masterplan-road-labels',
    type: 'symbol' as const,
    source: ROAD_LABELS_SOURCE_ID,
    minzoom: 14.5,
    layout: {
      visibility: 'visible' as const,
      'text-field': ['get', 'text'],
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        14, 9,
        16, 11,
        18, 13,
        20, 16
      ],
      'text-anchor': 'center' as const,
      'text-allow-overlap': false,
      'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold']
    },
    paint: {
      'text-color': [
        'case',
        ['==', ['get', 'isAmenityLabel'], true],
        [
          'match',
          ['get', 'width'],
          'CA_SITE', '#1e293b',
          'ENTRY', '#0369a1',
          '#ffffff'
        ],
        '#ffffff'
      ],
      'text-halo-color': [
        'case',
        ['==', ['get', 'isAmenityLabel'], true],
        [
          'match',
          ['get', 'width'],
          'CA_SITE', '#fef3c7',
          'ENTRY', '#e0f2fe',
          '#1e293b'
        ],
        '#0f172a'
      ],
      'text-halo-width': 2.5
    }
  }
};
