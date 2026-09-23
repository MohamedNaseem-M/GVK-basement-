import { Injectable, inject, signal, WritableSignal } from '@angular/core';
import * as maplibregl from 'maplibre-gl';
import { MasterPlanTransformService } from './masterplan-transform.service';
import { RoadGeometryProcessor, RawDxfEntity, RawDxfLabel } from '../geometry/road-geometry-processor';
import {
  MasterPlanRoadGeoJsonCollection,
  MasterPlanRoadLabelCollection,
  MasterPlanViewMode
} from '../models/road-masterplan.model';
import { ROAD_LAYERS, ROAD_SOURCE_ID, ROAD_LABELS_SOURCE_ID } from '../layers/masterplan-road.layer';

import rawDxfRoadData from '../../../assets/data/dxf-road-extraction.json';

import { GVK_ROADS_GEOJSON } from '../data/roads/gvk-roads.data';
import { GVK_ROAD_LABELS_GEOJSON } from '../data/roads/gvk-road-labels.data';

@Injectable({
  providedIn: 'root'
})
export class MasterPlanRoadService {
  private readonly transformService = inject(MasterPlanTransformService);

  // Raw source data from DXF extraction
  private readonly rawEntities: RawDxfEntity[] = (rawDxfRoadData.entities as unknown) as RawDxfEntity[];
  private readonly rawLabels: RawDxfLabel[] = (rawDxfRoadData.labels as unknown) as RawDxfLabel[];

  // Active road dataset
  private roadsDataset: MasterPlanRoadGeoJsonCollection = GVK_ROADS_GEOJSON;
  private roadLabelsDataset: MasterPlanRoadLabelCollection = GVK_ROAD_LABELS_GEOJSON;

  // Reactive state signals
  public readonly isRoadLoaded: WritableSignal<boolean> = signal(true);
  public readonly roadFeaturesCount: WritableSignal<number> = signal(GVK_ROADS_GEOJSON.features.length);
  public readonly roadLabelsCount: WritableSignal<number> = signal(GVK_ROAD_LABELS_GEOJSON.features.length);
  public readonly viewMode: WritableSignal<MasterPlanViewMode> = signal('SATELLITE_OVERLAY');
  public readonly selectedRoadHandle: WritableSignal<string | null> = signal(null);

  private mapInstance: maplibregl.Map | null = null;

  constructor() {
    this.syncAuthoritativeGeoJson();
  }

  /**
   * Attempts to fetch the static gvk-roads.geojson artifact to ensure exact alignment
   */
  private async syncAuthoritativeGeoJson(): Promise<void> {
    try {
      const response = await fetch('data/roads/gvk-roads.geojson?v=2');
      if (response.ok) {
        const json = await response.json();
        if (json && json.features && json.features.length > 0) {
          this.roadsDataset = json;
          this.roadFeaturesCount.set(json.features.length);
          if (this.mapInstance && this.mapInstance.getSource(ROAD_SOURCE_ID)) {
            (this.mapInstance.getSource(ROAD_SOURCE_ID) as maplibregl.GeoJSONSource).setData(this.roadsDataset as any);
          }
        }
      }
    } catch {
      // Retain bundled dataset
    }
  }

  /**
   * Returns authoritative WGS84 GeoJSON FeatureCollection of road corridors and amenities
   */
  public getWgs84RoadsGeoJson(): MasterPlanRoadGeoJsonCollection {
    return this.roadsDataset;
  }

  /**
   * Returns authoritative WGS84 Point FeatureCollection for road width callout labels
   */
  public getWgs84RoadLabelsGeoJson(): MasterPlanRoadLabelCollection {
    return this.roadLabelsDataset;
  }

  /**
   * Generates local CAD coordinate FeatureCollection for independent master plan verification
   */
  public getCadRoadsGeoJson(): MasterPlanRoadGeoJsonCollection {
    return RoadGeometryProcessor.processRoadFeatures(
      this.rawEntities,
      this.rawLabels
    );
  }

  /**
   * Computes geographic bounding box [minLng, minLat, maxLng, maxLat] for camera fitting
   */
  public getWgs84Bbox(): [number, number, number, number] {
    return [76.8995853, 15.1252762, 76.9018687, 15.1285144];
  }

  /**
   * Attaches the Master Plan Road layers to the MapLibre map instance
   */
  public attachRoadLayersToMap(map: maplibregl.Map): void {
    if (!map) return;
    this.mapInstance = map;

    const roadsGeoJson = this.getWgs84RoadsGeoJson();
    const labelsGeoJson = this.getWgs84RoadLabelsGeoJson();

    // Add Road Surface Source
    if (!map.getSource(ROAD_SOURCE_ID)) {
      map.addSource(ROAD_SOURCE_ID, {
        type: 'geojson',
        data: roadsGeoJson as any
      });

      // Layer 1: Road Surface Fill (Dark Asphalt/Slate)
      if (!map.getLayer(ROAD_LAYERS.surfaceLayer.id)) {
        map.addLayer(ROAD_LAYERS.surfaceLayer as any);
      }

      // Layer 2: Road Curb Borders
      if (!map.getLayer(ROAD_LAYERS.curbLayer.id)) {
        map.addLayer(ROAD_LAYERS.curbLayer as any);
      }

      // Layer 3: Amenities Surface (Parks, CA Site, Entry)
      if (!map.getLayer(ROAD_LAYERS.amenitySurfaceLayer.id)) {
        map.addLayer(ROAD_LAYERS.amenitySurfaceLayer as any);
      }

      // Layer 4: Amenities Borders
      if (!map.getLayer(ROAD_LAYERS.amenityBorderLayer.id)) {
        map.addLayer(ROAD_LAYERS.amenityBorderLayer as any);
      }
    }

    // Add Road Labels Source & Layer
    if (!map.getSource(ROAD_LABELS_SOURCE_ID)) {
      map.addSource(ROAD_LABELS_SOURCE_ID, {
        type: 'geojson',
        data: labelsGeoJson as any
      });

      if (!map.getLayer(ROAD_LAYERS.labelsLayer.id)) {
        map.addLayer(ROAD_LAYERS.labelsLayer as any);
      }
    }
  }

  /**
   * Updates road layer GeoJSON sources when the coordinate transformation or view mode changes
   */
  public refreshRoadLayers(map: maplibregl.Map): void {
    if (!map) return;

    const roadSource = map.getSource(ROAD_SOURCE_ID) as maplibregl.GeoJSONSource;
    if (roadSource) {
      roadSource.setData(this.getWgs84RoadsGeoJson() as any);
    }

    const labelSource = map.getSource(ROAD_LABELS_SOURCE_ID) as maplibregl.GeoJSONSource;
    if (labelSource) {
      labelSource.setData(this.getWgs84RoadLabelsGeoJson() as any);
    }
  }

  /**
   * Toggles between Google Satellite overlay and Master Plan Only neutral studio canvas
   */
  public toggleViewMode(): MasterPlanViewMode {
    const newMode: MasterPlanViewMode = this.viewMode() === 'SATELLITE_OVERLAY'
      ? 'MASTER_PLAN_ONLY'
      : 'SATELLITE_OVERLAY';
    this.viewMode.set(newMode);
    return newMode;
  }
}
