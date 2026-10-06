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

import { GVK_PLOTS_GEOJSON } from '../data/plots/gvk-plots.data';

export const SELECTED_PLOT_SOURCE_ID = 'masterplan-selected-overlay-source';

export const SELECTED_PLOT_LAYERS = {
  glow: {
    id: 'masterplan-selected-overlay-glow',
    type: 'line' as const,
    source: SELECTED_PLOT_SOURCE_ID,
    filter: ['==', ['get', 'type'], 'SURFACE'],
    layout: {
      'line-cap': 'round' as const,
      'line-join': 'round' as const
    },
    paint: {
      'line-color': '#f59e0b',
      'line-width': 6.0,
      'line-blur': 4.0,
      'line-opacity': 0.60
    }
  },
  fill: {
    id: 'masterplan-selected-overlay-fill',
    type: 'fill' as const,
    source: SELECTED_PLOT_SOURCE_ID,
    filter: ['==', ['get', 'type'], 'SURFACE'],
    paint: {
      'fill-color': '#f59e0b',
      'fill-opacity': 0.22
    }
  },
  border: {
    id: 'masterplan-selected-overlay-border',
    type: 'line' as const,
    source: SELECTED_PLOT_SOURCE_ID,
    filter: ['==', ['get', 'type'], 'SURFACE'],
    layout: {
      'line-cap': 'round' as const,
      'line-join': 'round' as const
    },
    paint: {
      'line-color': '#d97706',
      'line-width': 3.2,
      'line-opacity': 0.98
    }
  },
  dimensionLine: {
    id: 'masterplan-selected-overlay-dimension-line',
    type: 'line' as const,
    source: SELECTED_PLOT_SOURCE_ID,
    filter: ['==', ['get', 'type'], 'DIMENSION_LINE'],
    layout: {
      'line-cap': 'round' as const,
      'line-join': 'round' as const
    },
    paint: {
      'line-color': '#ffffff',
      'line-width': [
        'interpolate', ['exponential', 2], ['zoom'],
        14, 0.4,
        17, 1.2,
        18, 1.8,
        19, 2.5,
        20, 3.5
      ] as any,
      'line-dasharray': [3, 2],
      'line-opacity': 0.85
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
        ['get', 'areaSqFtText'], { 'font-scale': 0.80 },
        '\n', {},
        ['get', 'cornerText'], { 'font-scale': 0.75 }
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

  // Authoritative runtime dataset statically bundled for instant 0ms rendering
  private plotsDataset: MasterPlanPlotGeoJsonCollection = GVK_PLOTS_GEOJSON;

  // Reactive state signals
  public readonly isPlotsLoaded: WritableSignal<boolean> = signal(true);
  public readonly plotsCount: WritableSignal<number> = signal(318);
  public readonly selectedPlot: WritableSignal<SelectedPlotInfo | null> = signal(null);
  public readonly selectedPlotId: WritableSignal<number | null> = signal(null);

  // Reference to active map instance for feature-state manipulation
  private mapInstance: maplibregl.Map | null = null;

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

      if (!map.getLayer(SELECTED_PLOT_LAYERS.glow.id)) {
        map.addLayer(SELECTED_PLOT_LAYERS.glow as any);
      }
      if (!map.getLayer(SELECTED_PLOT_LAYERS.fill.id)) {
        map.addLayer(SELECTED_PLOT_LAYERS.fill as any);
      }
      if (!map.getLayer(SELECTED_PLOT_LAYERS.border.id)) {
        map.addLayer(SELECTED_PLOT_LAYERS.border as any);
      }
      if (!map.getLayer(SELECTED_PLOT_LAYERS.dimensionLine.id)) {
        map.addLayer(SELECTED_PLOT_LAYERS.dimensionLine as any);
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

  private animationFrameId: number | null = null;

  /**
   * Starts a smooth, lightweight requestAnimationFrame pulse animation loop on the glowing golden outline
   */
  private startPulseAnimation(): void {
    this.stopPulseAnimation();

    const animate = (time: number) => {
      if (!this.mapInstance || this.selectedPlotId() === null) {
        return;
      }

      // Smooth ~1.8s sine wave pulse cycle
      const cycleMs = 1800;
      const t = (time % cycleMs) / cycleMs * 2 * Math.PI;
      const pulseFactor = (Math.sin(t) + 1) / 2; // 0 to 1

      const glowOpacity = 0.35 + 0.35 * pulseFactor; // 0.35 to 0.70
      const glowWidth = 4.5 + 2.5 * pulseFactor; // 4.5px to 7.0px

      try {
        if (this.mapInstance.getLayer(SELECTED_PLOT_LAYERS.glow.id)) {
          this.mapInstance.setPaintProperty(SELECTED_PLOT_LAYERS.glow.id, 'line-opacity', glowOpacity);
          this.mapInstance.setPaintProperty(SELECTED_PLOT_LAYERS.glow.id, 'line-width', glowWidth);
        }
      } catch (err) {}

      this.animationFrameId = requestAnimationFrame(animate);
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  /**
   * Stops the pulse animation loop
   */
  private stopPulseAnimation(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Updates the selected plot GeoJSON overlay source
   */
  private updateSelectionOverlay(feature: MasterPlanPlotFeature | null): void {
    if (!this.mapInstance) return;
    const source = this.mapInstance.getSource(SELECTED_PLOT_SOURCE_ID) as maplibregl.GeoJSONSource;
    if (!source) return;

    if (!feature) {
      this.stopPulseAnimation();
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const geojson = this.generateSelectedPlotOverlayGeoJson(feature);
    source.setData(geojson as any);
    this.startPulseAnimation();
  }

  /**
   * Intelligently segments a polygon ring into Key Corner vertices and Logical Edges
   * (combining micro-segments of curved arcs into single continuous arc edges).
   */
  private segmentPolygonRing(ring: Array<[number, number]>): {
    keyCorners: Array<[number, number]>;
    logicalEdges: Array<{
      subSegments: Array<{ p1: [number, number]; p2: [number, number]; lengthM: number; angleDeg: number }>;
      totalLengthM: number;
      midpoint: [number, number];
      midTangentAngleDeg: number;
      isArc: boolean;
    }>;
    isCornerPlot: boolean;
  } {
    const pts = ring.slice();
    if (
      pts.length > 1 &&
      pts[0][0] === pts[pts.length - 1][0] &&
      pts[0][1] === pts[pts.length - 1][1]
    ) {
      pts.pop();
    }

    const n = pts.length;
    if (n < 3) {
      return { keyCorners: ring, logicalEdges: [], isCornerPlot: false };
    }

    const R = 6371000;
    const segments: Array<{ p1: [number, number]; p2: [number, number]; lengthM: number; angleDeg: number }> = [];

    for (let i = 0; i < n; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];

      const dLat = (p2[1] - p1[1]) * Math.PI / 180;
      const dLng = (p2[0] - p1[0]) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(p1[1] * Math.PI / 180) * Math.cos(p2[1] * Math.PI / 180) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const lengthM = R * c;

      const dy = p2[1] - p1[1];
      const dx = (p2[0] - p1[0]) * Math.cos(p1[1] * Math.PI / 180);
      const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;

      segments.push({ p1, p2, lengthM, angleDeg });
    }

    const isKeyCorner: boolean[] = new Array(n).fill(false);
    let hasArcSubSegments = false;

    for (let i = 0; i < n; i++) {
      const prevIdx = (i - 1 + n) % n;
      const sPrev = segments[prevIdx];
      const sCurr = segments[i];

      let turn = sCurr.angleDeg - sPrev.angleDeg;
      while (turn > 180) turn -= 360;
      while (turn <= -180) turn += 360;
      const absTurn = Math.abs(turn);

      if (sCurr.lengthM < 2.5) {
        hasArcSubSegments = true;
      }

      const isSharpTurn = absTurn >= 25;
      const isTransition =
        (sPrev.lengthM >= 2.5 && sCurr.lengthM < 2.5) ||
        (sPrev.lengthM < 2.5 && sCurr.lengthM >= 2.5);

      if (isSharpTurn || isTransition) {
        isKeyCorner[i] = true;
      }
    }

    let cornerIndices: number[] = [];
    for (let i = 0; i < n; i++) {
      if (isKeyCorner[i]) {
        cornerIndices.push(i);
      }
    }

    if (cornerIndices.length < 3) {
      const turns = segments.map((s, i) => {
        const prevIdx = (i - 1 + n) % n;
        let diff = s.angleDeg - segments[prevIdx].angleDeg;
        while (diff > 180) diff -= 360;
        while (diff <= -180) diff += 360;
        return { index: i, turn: Math.abs(diff) };
      });
      turns.sort((a, b) => b.turn - a.turn);
      cornerIndices = turns.slice(0, Math.min(4, n)).map(t => t.index).sort((a, b) => a - b);
    }

    const keyCorners = cornerIndices.map(idx => pts[idx]);

    const logicalEdges = [];
    const k = cornerIndices.length;

    for (let m = 0; m < k; m++) {
      const startIdx = cornerIndices[m];
      const endIdx = cornerIndices[(m + 1) % k];

      const edgeSubSegments = [];
      let curr = startIdx;
      while (curr !== endIdx) {
        edgeSubSegments.push(segments[curr]);
        curr = (curr + 1) % n;
      }

      if (edgeSubSegments.length === 0) continue;

      let totalLengthM = 0;
      for (const seg of edgeSubSegments) {
        totalLengthM += seg.lengthM;
      }

      const isArc = edgeSubSegments.length > 1 || edgeSubSegments[0].lengthM < 2.5;

      const halfLen = totalLengthM / 2;
      let accumulated = 0;
      let midpoint: [number, number] = edgeSubSegments[0].p1;
      let midTangentAngleDeg = edgeSubSegments[0].angleDeg;

      for (const seg of edgeSubSegments) {
        if (accumulated + seg.lengthM >= halfLen) {
          const rem = halfLen - accumulated;
          const frac = seg.lengthM > 0 ? rem / seg.lengthM : 0;
          midpoint = [
            seg.p1[0] + frac * (seg.p2[0] - seg.p1[0]),
            seg.p1[1] + frac * (seg.p2[1] - seg.p1[1])
          ];
          midTangentAngleDeg = seg.angleDeg;
          break;
        }
        accumulated += seg.lengthM;
      }

      logicalEdges.push({
        subSegments: edgeSubSegments,
        totalLengthM,
        midpoint,
        midTangentAngleDeg,
        isArc
      });
    }

    const isCornerPlot = hasArcSubSegments || logicalEdges.length > 4;

    return {
      keyCorners,
      logicalEdges,
      isCornerPlot
    };
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

    // 2. Dashed Dimension Line feature along perimeter
    const dimensionLineFeature = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: ring
      },
      properties: { type: 'DIMENSION_LINE' }
    };

    // Segment polyline ring into Key Corners and Logical Edges
    const segmentation = this.segmentPolygonRing(ring);

    // 3. Centroid Center Multi-line Label Feature
    let sumLng = 0, sumLat = 0;
    const n = ring.length - 1;
    for (let i = 0; i < n; i++) {
      sumLng += ring[i][0];
      sumLat += ring[i][1];
    }
    const centroidLng = sumLng / n;
    const centroidLat = sumLat / n;

    const plotNumText = `${plotNumber}`;
    const areaSqMText = `${areaSqM} m²`;
    const areaSqFtText = `${areaSqFtFormatted} ft²`;
    const cornerText = segmentation.isCornerPlot ? '\nCorner plot' : '';

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
        areaSqFtText,
        cornerText
      }
    };

    // 4. Corner Ticks ONLY at key corner junction vertices
    const cornerFeatures = segmentation.keyCorners.map((pt: [number, number]) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: pt
      },
      properties: { type: 'CORNER_TICK' }
    }));

    // 5. Edge Dimension Badges (One per logical edge / curve arc)
    const edgeFeatures = segmentation.logicalEdges.map(edge => {
      const distM = edge.totalLengthM;
      let dimensionText = '';
      if (Math.abs(distM - Math.round(distM)) < 0.08) {
        dimensionText = `${Math.round(distM)} m`;
      } else {
        dimensionText = `${distM.toFixed(2)} m`;
      }

      let angle = edge.midTangentAngleDeg;
      if (angle > 90 || angle < -90) {
        angle += 180;
      }
      const rotationDeg = -angle;

      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: edge.midpoint
        },
        properties: {
          type: 'EDGE_DIMENSION',
          dimensionText,
          rotationDeg
        }
      };
    });

    return {
      type: 'FeatureCollection',
      features: [
        surfaceFeature,
        dimensionLineFeature,
        centerLabelFeature,
        ...cornerFeatures,
        ...edgeFeatures
      ]
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
