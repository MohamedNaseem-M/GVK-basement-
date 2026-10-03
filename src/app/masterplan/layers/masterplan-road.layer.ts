import { MASTERPLAN_ROAD_STYLES, MASTERPLAN_AMENITY_STYLES } from '../config/masterplan.config';

/**
 * MapLibre layer definitions for rendering the Road Master Plan & Amenities
 * with professional real-estate aesthetics (dark asphalt surface, subtle curb edges, clean typography,
 * vibrant green parks, sand CA Site, blue ENTRY gate).
 */
export const ROAD_SOURCE_ID = 'masterplan-road-source';
export const ROAD_LABELS_SOURCE_ID = 'masterplan-road-labels-source';

export const ROAD_LAYERS = {
  // 0. Landscape Verge Strip (Vibrant green planter strip along road edges matching reference design)
  landscapeVergeLayer: {
    id: 'masterplan-road-landscape-verge',
    type: 'line' as const,
    source: ROAD_SOURCE_ID,
    filter: ['==', ['get', 'isCorridor'], true],
    layout: {
      visibility: 'visible' as const,
      'line-cap': 'round' as const,
      'line-join': 'round' as const
    },
    paint: {
      'line-color': '#15803d', // Rich natural green planter verge
      'line-width': [
        'interpolate', ['linear'], ['zoom'],
        12, 3.5,
        15, 6.0,
        18, 11.0,
        20, 20.0
      ],
      'line-opacity': 0.95
    }
  },

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

  // 2. Road Curb / Border Edges (Subtle lighter silver/white border)
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
      'line-color': '#e2e8f0',
      'line-width': [
        'interpolate', ['linear'], ['zoom'],
        12, 1.2,
        15, 2.0,
        18, 3.8,
        20, 6.0
      ],
      'line-opacity': 0.98
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
        'PARK', MASTERPLAN_AMENITY_STYLES.parkFill,
        'CA_SITE', MASTERPLAN_AMENITY_STYLES.caSiteFill,
        'ENTRY', MASTERPLAN_AMENITY_STYLES.entryFill,
        '#334155'
      ],
      'fill-opacity': 0.98
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
        'PARK', MASTERPLAN_AMENITY_STYLES.parkBorder,
        'CA_SITE', MASTERPLAN_AMENITY_STYLES.caSiteBorder,
        'ENTRY', MASTERPLAN_AMENITY_STYLES.entryBorder,
        '#334155'
      ],
      'line-width': 2.2,
      'line-opacity': 0.98
    }
  },

  // 5. Road Width & Amenity Text Callouts (9 Meter Road, 12 Meter Road, PARK, CA Site, ENTRY)
  labelsLayer: {
    id: 'masterplan-road-labels',
    type: 'symbol' as const,
    source: ROAD_LABELS_SOURCE_ID,
    minzoom: 10,
    layout: {
      visibility: 'visible' as const,
      'text-field': ['get', 'text'],
      'text-size': [
        'interpolate', ['exponential', 2], ['zoom'],
        14, 0.9375,
        17, 7.5,
        18, 15.0,
        19, 30.0,
        20, 60.0,
        21, 120.0
      ] as any,
      'text-rotate': ['coalesce', ['get', 'rotationDeg'], 0],
      'text-rotation-alignment': 'map' as const,
      'text-pitch-alignment': 'map' as const,
      'text-keep-upright': true,
      'text-anchor': 'center' as const,
      'text-allow-overlap': true,
      'text-ignore-placement': true,
      'text-padding': 0,
      'symbol-sort-key': [
        'case',
        ['==', ['get', 'isAmenityLabel'], true], 1,
        2
      ],
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold']
    },
    paint: {
      'text-color': [
        'case',
        ['==', ['get', 'isAmenityLabel'], true],
        [
          'match',
          ['get', 'width'],
          'CA_SITE', '#1e293b',
          'ENTRY', '#ffffff',
          'PARK', '#ffffff',
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
          'ENTRY', '#0284c7',
          'PARK', '#14532d',
          '#0f172a'
        ],
        '#0f172a'
      ],
      'text-halo-width': [
        'interpolate', ['exponential', 2], ['zoom'],
        15, 0.5,
        17, 1.2,
        19, 2.8,
        21, 5.5
      ] as any
    }
  }
};
