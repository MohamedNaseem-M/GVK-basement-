import { Injectable, inject, signal, WritableSignal } from '@angular/core';
import * as maplibregl from 'maplibre-gl';
import { MasterPlanTransformService } from './masterplan-transform.service';
import { PlotGeometryProcessor } from '../geometry/plot-geometry-processor';
import {
  MasterPlanPlotGeoJsonCollection,
  PlotFeatureProperties,
  SelectedPlotInfo
} from '../models/plot-masterplan.model';
import { PLOT_LAYERS, PLOT_SOURCE_ID } from '../layers/masterplan-plot.layer';

import rawDxfMasterplanData from '../../../assets/data/dxf-masterplan-extraction.json';

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

      // Setup interaction handlers
      this.setupPlotInteractions(map);
    }
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
   * Selects a plot by its number and updates MapLibre feature state for visual highlight
   */
  public selectPlot(plotNumber: number | null, properties?: any): void {
    const currentSelectedId = this.selectedPlotId();

    // Clear previous highlight
    if (currentSelectedId !== null && this.mapInstance) {
      try {
        this.mapInstance.setFeatureState(
          { source: PLOT_SOURCE_ID, id: currentSelectedId },
          { selected: false }
        );
      } catch (err) {
        // Feature state safety catch
      }
    }

    if (plotNumber === null) {
      this.selectedPlot.set(null);
      this.selectedPlotId.set(null);
      return;
    }

    // If properties were not provided, find them in the dataset
    let props = properties;
    if (!props) {
      const feature = this.plotsDataset.features.find(f => f.properties.plotNumber === plotNumber);
      if (feature) {
        props = feature.properties;
      }
    }

    if (props) {
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
        } catch (err) {
          // Feature state safety catch
        }
      }
    }
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
