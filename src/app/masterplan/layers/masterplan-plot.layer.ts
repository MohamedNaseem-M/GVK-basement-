import { MASTERPLAN_PLOT_STYLES } from '../config/masterplan.config';

/**
 * MapLibre layer definitions for rendering the 318-plot Master Plan
 * with professional real-estate aesthetics (warm cream/beige fill, crisp thin dark boundaries,
 * clear centered plot number labels with white halo).
 */
export const PLOT_SOURCE_ID = 'masterplan-plots-source';

export const PLOT_LAYERS = {
  // 1. Plot Fill Surface (Warm cream/beige fill, reactive to selection)
  fillLayer: {
    id: 'masterplan-plots-fill',
    type: 'fill' as const,
    source: PLOT_SOURCE_ID,
    paint: {
      'fill-color': [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        MASTERPLAN_PLOT_STYLES.selectedFillColor,
        MASTERPLAN_PLOT_STYLES.fillColor
      ] as any,
      'fill-opacity': [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        MASTERPLAN_PLOT_STYLES.selectedFillOpacity,
        MASTERPLAN_PLOT_STYLES.fillOpacity
      ] as any
    }
  },

  // 2. Plot Boundary Edges (Crisp thin boundary, highlighted on selection)
  borderLayer: {
    id: 'masterplan-plots-border',
    type: 'line' as const,
    source: PLOT_SOURCE_ID,
    layout: {
      'line-cap': 'round' as const,
      'line-join': 'round' as const
    },
    paint: {
      'line-color': [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        MASTERPLAN_PLOT_STYLES.selectedBorderColor,
        MASTERPLAN_PLOT_STYLES.borderColor
      ] as any,
      'line-width': [
        'interpolate', ['linear'], ['zoom'],
        14, ['case', ['boolean', ['feature-state', 'selected'], false], 2.5, 0.8],
        16, ['case', ['boolean', ['feature-state', 'selected'], false], 2.8, 1.2],
        18, ['case', ['boolean', ['feature-state', 'selected'], false], 3.2, 1.8],
        20, ['case', ['boolean', ['feature-state', 'selected'], false], 3.8, 2.4]
      ] as any,
      'line-opacity': MASTERPLAN_PLOT_STYLES.borderOpacity
    }
  },

  // 3. Dark Bold Plot Numbers with White Contrast Halo matching Reference Photo (rendering 100% of plot labels)
  labelsLayer: {
    id: 'masterplan-plots-labels',
    type: 'symbol' as const,
    source: PLOT_SOURCE_ID,
    minzoom: 14.5,
    layout: {
      'text-field': [
        'case',
        ['<', ['get', 'plotNumber'], 10],
        ['concat', '0', ['to-string', ['get', 'plotNumber']]],
        ['case',
          ['<', ['get', 'plotNumber'], 100],
          ['concat', '0', ['to-string', ['get', 'plotNumber']]],
          ['to-string', ['get', 'plotNumber']]
        ]
      ] as any,
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        14.5, 7.5,
        16, 9.5,
        17, 11.5,
        18, 13.5,
        19, 16.5,
        20, 20.0,
        21, 25.0
      ] as any,
      'text-anchor': 'center' as const,
      'text-allow-overlap': true,
      'text-ignore-placement': true,
      'text-padding': 0
    },
    paint: {
      'text-color': MASTERPLAN_PLOT_STYLES.labelColor,
      'text-halo-color': MASTERPLAN_PLOT_STYLES.labelHaloColor,
      'text-halo-width': MASTERPLAN_PLOT_STYLES.labelHaloWidth
    }
  }
};
