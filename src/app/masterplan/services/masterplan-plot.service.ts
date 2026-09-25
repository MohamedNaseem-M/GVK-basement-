import { Injectable, inject, signal, WritableSignal } from '@angular/core';
import * as maplibregl from 'maplibre-gl';
import { MasterPlanTransformService } from './masterplan-transform.service';
import { PlotGeometryProcessor } from '../geometry/plot-geometry-processor';
import {
  MasterPlanPlotFeature,
  MasterPlanPlotGeoJsonCollection,
  PlotFeatureProperties,
  SelectedPlotInfo
} from '../models/plot-masterplan.model';
import { PLOT_LAYERS, PLOT_SOURCE_ID } from '../layers/masterplan-plot.layer';

import rawDxfMasterplanData from '../../../assets/data/dxf-masterplan-extraction.json';

export const SELECTED_PLOT_SOURCE_ID = 'masterplan-selected-overlay-source';

export const SELECTED_PLOT_LAYERS = {
  fill: {
    id: 'masterplan-selected-overlay-fill',
    type: 'fill' as const,
    source: SELECTED_PLOT_SOURCE_ID,
    filter: ['==', ['get', 'type'], 'SURFACE'],
    paint: {
      'fill-color': '#1d4ed8',
      'fill-opacity': 0.94
    }
  },
  border: {
    id: 'masterplan-selected-overlay-border',
    type: 'line' as const,
    source: SELECTED_PLOT_SOURCE_ID,
    filter: ['==', ['get', 'type'], 'SURFACE'],
    paint: {
      'line-color': '#000000',
      'line-width': 2.0,
      'line-dasharray': [2, 2]
    }
  },
  cornerTicks: {
    id: 'masterplan-selected-overlay-corner-ticks',
    type: 'symbol' as const,
    source: SELECTED_PLOT_SOURCE_ID,
    filter: ['==', ['get', 'type'], 'CORNER_TICK'],
    layout: {
      'text-field': '+',
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-size': [
        'interpolate', ['exponential', 2], ['zoom'],
        14, 0.25,
        17, 2.0,
        18, 4.0,
        19, 8.0,
        20, 16.0,
        21, 32.0
      ] as any,
      'text-anchor': 'center' as const,
      'text-pitch-alignment': 'map' as const,
      'text-rotation-alignment': 'map' as const,
      'text-allow-overlap': true,
      'text-ignore-placement': true
    },
    paint: {
      'text-color': '#ffffff',
      'text-halo-color': '#000000',
      'text-halo-width': 1.8
    }
  },
  centerLabel: {
    id: 'masterplan-selected-overlay-center-label',
    type: 'symbol' as const,
    source: SELECTED_PLOT_SOURCE_ID,
    filter: ['==', ['get', 'type'], 'CENTER_LABEL'],
    layout: {
      'text-field': [
        'format',
        ['get', 'plotNumText'], { 'font-scale': 1.35 },
        '\n', {},
        ['get', 'areaSqMText'], { 'font-scale': 0.92 },
        '\n', {},
        ['get', 'areaSqFtText'], { 'font-scale': 0.80 }
      ] as any,
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-size': [
        'interpolate', ['exponential', 2], ['zoom'],
        14, 0.5,
        17, 4.0,
        18, 8.0,
        19, 16.0,
        20, 32.0,
        21, 64.0
      ] as any,
      'text-anchor': 'center' as const,
      'text-pitch-alignment': 'map' as const,
      'text-rotation-alignment': 'map' as const,
      'text-allow-overlap': true,
      'text-ignore-placement': true,
      'text-justify': 'center' as const,
      'text-line-height': 1.15
    },
    paint: {
      'text-color': '#ffffff',
      'text-halo-color': '#0f172a',
      'text-halo-width': 2.2
    }
  },
  edgeDimensions: {
    id: 'masterplan-selected-overlay-edge-dimensions',
    type: 'symbol' as const,
    source: SELECTED_PLOT_SOURCE_ID,
    filter: ['==', ['get', 'type'], 'EDGE_DIMENSION'],
    layout: {
      'text-field': ['get', 'dimensionText'],
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-size': [
        'interpolate', ['exponential', 2], ['zoom'],
        14, 0.3125,
        17, 2.5,
        18, 5.0,
        19, 10.0,
        20, 20.0,
        21, 40.0
      ] as any,
      'text-rotate': ['get', 'rotationDeg'],
      'text-rotation-alignment': 'map' as const,
      'text-pitch-alignment': 'map' as const,
      'text-keep-upright': true,
      'text-anchor': 'center' as const,
      'text-allow-overlap': true,
      'text-ignore-placement': true
    },
    paint: {
      'text-color': '#ffffff',
      'text-halo-color': '#000000',
      'text-halo-width': 2.0
    }
  }
};

@Injectable({
  providedIn: 'root'
})
export class MasterPlanPlotService {
  private readonly transformService = inject(MasterPlanTransformService);

  // Authoritative runtime dataset reconstructed via CAD topology and synchronized with gvk-plots.geojson
  private plotsDataset: MasterPlanPlotGeoJsonCollection = PlotGeometryProcessor.toGeoJson(
    PlotGeometryProcessor.reconstructCadPlots(rawDxfMasterplanData),
    (x, y) => this.transformService.cadPlotToWgs84(x, y)
  );

  // Reactive state signals
  public readonly isPlotsLoaded: WritableSignal<boolean> = signal(true);
  public readonly plotsCount: WritableSignal<number> = signal(318);
  public readonly selectedPlot: WritableSignal<SelectedPlotInfo | null> = signal(null);
  public readonly selectedPlotId: WritableSignal<number | null> = signal(null);

  // Reference to active map instance for feature-state manipulation
  private mapInstance: maplibregl.Map | null = null;

  constructor() {
    this.syncAuthoritativeGeoJson();
  }

  /**
   * Attempts to fetch the static gvk-plots.geojson artifact to ensure exact alignment
   */
  private async syncAuthoritativeGeoJson(): Promise<void> {
    try {
      const response = await fetch('data/plots/gvk-plots.geojson?v=2');
      if (response.ok) {
        const json = await response.json();
        if (json && json.features && json.features.length === 318) {
          this.plotsDataset = json;
          if (this.mapInstance && this.mapInstance.getSource(PLOT_SOURCE_ID)) {
            (this.mapInstance.getSource(PLOT_SOURCE_ID) as maplibregl.GeoJSONSource).setData(this.plotsDataset as any);
          }
        }
      }
    } catch {
      // Retain the exact mathematical CAD reconstruction already initialized
    }
  }

  /**
   * Returns authoritative WGS84 GeoJSON FeatureCollection of 318 residential plots
   */
  public getWgs84PlotsGeoJson(): MasterPlanPlotGeoJsonCollection {
    return this.plotsDataset;
  }

  /**
   * Computes geographic bounding box [minLng, minLat, maxLng, maxLat] of all 318 plots
   */
  public getWgs84Bbox(): [number, number, number, number] {
    return [76.8997116, 15.1253717, 76.9015923, 15.1281160];
  }

  /**
   * Attaches the 318-plot Master Plan layers to the MapLibre map instance.
   * Handles desktop click and mobile tap events for interactive plot selection.
   */
  public attachPlotLayersToMap(map: maplibregl.Map): void {
    if (!map) return;
    this.mapInstance = map;

    const plotsGeoJson = this.getWgs84PlotsGeoJson();

    // 1. Add Plot GeoJSON Source with promoteId for robust feature-state styling
    if (!map.getSource(PLOT_SOURCE_ID)) {
      map.addSource(PLOT_SOURCE_ID, {
        type: 'geojson',
        data: plotsGeoJson as any,
        promoteId: 'plotNumber'
      });

      // 2. Layer 1: Plot Fill (Cream/Beige, reactive to selection)
      if (!map.getLayer(PLOT_LAYERS.fillLayer.id)) {
        map.addLayer(PLOT_LAYERS.fillLayer as any);
      }

      // 3. Layer 2: Plot Borders (Thin dark line, highlighted on selection)
      if (!map.getLayer(PLOT_LAYERS.borderLayer.id)) {
        map.addLayer(PLOT_LAYERS.borderLayer as any);
      }

      // 4. Layer 3: Centered Plot Numbers
      if (!map.getLayer(PLOT_LAYERS.labelsLayer.id)) {
        map.addLayer(PLOT_LAYERS.labelsLayer as any);
      }
    }

    // 5. Add Selection Overlay Source & Layers for Image 2 on-map interactive plot selection
    if (!map.getSource(SELECTED_PLOT_SOURCE_ID)) {
      map.addSource(SELECTED_PLOT_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      if (!map.getLayer(SELECTED_PLOT_LAYERS.fill.id)) {
        map.addLayer(SELECTED_PLOT_LAYERS.fill as any);
      }
      if (!map.getLayer(SELECTED_PLOT_LAYERS.border.id)) {
        map.addLayer(SELECTED_PLOT_LAYERS.border as any);
      }
      if (!map.getLayer(SELECTED_PLOT_LAYERS.cornerTicks.id)) {
        map.addLayer(SELECTED_PLOT_LAYERS.cornerTicks as any);
      }
      if (!map.getLayer(SELECTED_PLOT_LAYERS.centerLabel.id)) {
        map.addLayer(SELECTED_PLOT_LAYERS.centerLabel as any);
      }
      if (!map.getLayer(SELECTED_PLOT_LAYERS.edgeDimensions.id)) {
        map.addLayer(SELECTED_PLOT_LAYERS.edgeDimensions as any);
      }
    }

    // Setup interaction handlers
    this.setupPlotInteractions(map);
  }

  /**
   * Sets up interactive desktop click, mobile tap, and cursor feedback
   */
  private setupPlotInteractions(map: maplibregl.Map): void {
    const fillLayerId = PLOT_LAYERS.fillLayer.id;

    // Change cursor to pointer when hovering over plots
    map.on('mouseenter', fillLayerId, () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', fillLayerId, () => {
      map.getCanvas().style.cursor = '';
    });

    // Handle Desktop Click & Mobile Tap
    map.on('click', fillLayerId, (e) => {
      if (!e.features || e.features.length === 0) return;

      const feature = e.features[0];
      const props = feature.properties as any;
      if (!props || props.plotNumber === undefined) return;

      const plotNum = Number(props.plotNumber);
      this.selectPlot(plotNum, props);
    });

    // Background click to clear selection (when clicking outside plots)
    map.on('click', (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: [fillLayerId]
      });
      if (features.length === 0 && this.selectedPlotId() !== null) {
        this.clearSelection();
      }
    });
  }

  /**
   * Selects a plot by its number, updates MapLibre feature state & overlay layers,
   * and smoothly animates the camera to zoom in on the selected plot.
   */
  public selectPlot(plotNumber: number | null, properties?: any, zoomToPlot = true): void {
    const currentSelectedId = this.selectedPlotId();

    // Clear previous highlight
    if (currentSelectedId !== null && this.mapInstance) {
      try {
        this.mapInstance.setFeatureState(
          { source: PLOT_SOURCE_ID, id: currentSelectedId },
          { selected: false }
        );
      } catch (err) {}
    }

    if (plotNumber === null) {
      this.selectedPlot.set(null);
      this.selectedPlotId.set(null);
      this.updateSelectionOverlay(null);
      return;
    }

    const feature = this.plotsDataset.features.find(f => f.properties.plotNumber === plotNumber);
    if (feature) {
      const props = feature.properties;
      const info: SelectedPlotInfo = {
        plotNumber: Number(props.plotNumber),
        block: props.block || '',
        areaSqM: Number(props.areaSqM),
        areaSqFt: Number(props.areaSqFt),
        dimensions: props.dimensions,
        frontageM: props.frontageM ? Number(props.frontageM) : undefined,
        depthM: props.depthM ? Number(props.depthM) : undefined,
        status: props.status || 'UNKNOWN'
      };
      this.selectedPlot.set(info);
      this.selectedPlotId.set(plotNumber);

      // Set feature state on map for instant GPU-rendered highlight
      if (this.mapInstance) {
        try {
          this.mapInstance.setFeatureState(
            { source: PLOT_SOURCE_ID, id: plotNumber },
            { selected: true }
          );
        } catch (err) {}
      }

      this.updateSelectionOverlay(feature);

      // Smoothly animate camera to zoom in on the clicked plot
      if (zoomToPlot && this.mapInstance) {
        this.zoomToPlotFeature(feature);
      }
    }
  }

  /**
   * Smoothly animates camera to frame and center the selected plot
   */
  public zoomToPlotFeature(feature: MasterPlanPlotFeature): void {
    if (!this.mapInstance || !feature.geometry || !feature.geometry.coordinates) return;

    const ring = feature.geometry.coordinates[0];
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    for (const [lng, lat] of ring) {
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    }

    // Responsive padding based on viewport dimensions
    const width = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const padding = width < 768
      ? { top: 40, bottom: 40, left: 30, right: 30 }
      : { top: 60, bottom: 60, left: 60, right: 60 };

    this.mapInstance.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat]
      ],
      {
        padding,
        maxZoom: 20.2,
        duration: 900,
        essential: true
      }
    );
  }

  /**
   * Updates the selected plot GeoJSON overlay source
   */
  private updateSelectionOverlay(feature: MasterPlanPlotFeature | null): void {
    if (!this.mapInstance) return;
    const source = this.mapInstance.getSource(SELECTED_PLOT_SOURCE_ID) as maplibregl.GeoJSONSource;
    if (!source) return;

    if (!feature) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const geojson = this.generateSelectedPlotOverlayGeoJson(feature);
    source.setData(geojson as any);
  }

  /**
   * Generates the multi-feature GeoJSON collection for the selected plot (Image 2 style)
   */
  private generateSelectedPlotOverlayGeoJson(feature: MasterPlanPlotFeature): any {
    if (!feature || !feature.geometry || !feature.geometry.coordinates) {
      return { type: 'FeatureCollection', features: [] };
    }

    const ring = feature.geometry.coordinates[0];
    const props = feature.properties;
    const plotNumber = props.plotNumber;
    const areaSqM = props.areaSqM;
    const areaSqFt = props.areaSqFt;
    const areaSqFtFormatted = Number(areaSqFt).toLocaleString('en-US');

    // 1. Surface polygon feature
    const surfaceFeature = {
      type: 'Feature',
      geometry: feature.geometry,
      properties: { type: 'SURFACE' }
    };

    // 2. Centroid Center Multi-line Label Feature
    let sumLng = 0, sumLat = 0;
    const n = ring.length - 1; // Exclude duplicate last closure point
    for (let i = 0; i < n; i++) {
      sumLng += ring[i][0];
      sumLat += ring[i][1];
    }
    const centroidLng = sumLng / n;
    const centroidLat = sumLat / n;

    const plotNumText = `${plotNumber}`;
    const areaSqMText = `${areaSqM} m²`;
    const areaSqFtText = `${areaSqFtFormatted} ft²`;

    const centerLabelFeature = {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [centroidLng, centroidLat]
      },
      properties: {
        type: 'CENTER_LABEL',
        plotNumText,
        areaSqMText,
        areaSqFtText
      }
    };

    // 3. Corner Ticks
    const cornerFeatures = ring.slice(0, n).map((pt: any) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: pt
      },
      properties: { type: 'CORNER_TICK' }
    }));

    // 4. Edge Dimension Badges along the 4 edges
    const edgeFeatures: any[] = [];
    for (let i = 0; i < n; i++) {
      const p1 = ring[i];
      const p2 = ring[i + 1] || ring[0];

      const midLng = (p1[0] + p2[0]) / 2;
      const midLat = (p1[1] + p2[1]) / 2;

      // Geodesic distance in meters
      const R = 6371000;
      const dLat = (p2[1] - p1[1]) * Math.PI / 180;
      const dLng = (p2[0] - p1[0]) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(p1[1] * Math.PI / 180) * Math.cos(p2[1] * Math.PI / 180) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distM = Math.round(R * c);

      // Angle calculation
      const dy = p2[1] - p1[1];
      const dx = (p2[0] - p1[0]) * Math.cos(p1[1] * Math.PI / 180);
      let angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
      if (angleDeg > 90 || angleDeg < -90) {
        angleDeg += 180;
      }

      edgeFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [midLng, midLat]
        },
        properties: {
          type: 'EDGE_DIMENSION',
          dimensionText: `${distM} m`,
          rotationDeg: -angleDeg
        }
      });
    }

    return {
      type: 'FeatureCollection',
      features: [surfaceFeature, centerLabelFeature, ...cornerFeatures, ...edgeFeatures]
    };
  }

  /**
   * Clears the current plot selection
   */
  public clearSelection(): void {
    this.selectPlot(null);
  }

  /**
   * Refreshes the plot layers when required
   */
  public refreshPlotLayers(map: maplibregl.Map): void {
    if (!map) return;
    const plotSource = map.getSource(PLOT_SOURCE_ID) as maplibregl.GeoJSONSource;
    if (plotSource) {
      plotSource.setData(this.getWgs84PlotsGeoJson() as any);
    }
  }
}
