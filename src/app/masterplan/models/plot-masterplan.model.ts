/**
 * GVK Enclave Plot Master Plan Data Models
 * Authoritative types for the 318 residential plots reconstructed from CAD geometry.
 */

export type PlotStatus = 'UNKNOWN' | 'AVAILABLE' | 'RESERVED' | 'SOLD';

export interface PlotFeatureProperties {
  plotNumber: number;
  block: string;
  areaSqM: number;
  areaSqFt: number;
  frontageM?: number;
  depthM?: number;
  dimensions?: string;
  centroidCad: [number, number];
  centroidWgs84: [number, number];
  sourceHandle: string;
  geometrySource: string;
  status: PlotStatus;
  isSelected?: boolean;
}

export interface MasterPlanPlotFeature {
  type: 'Feature';
  id: number;
  geometry: {
    type: 'Polygon';
    coordinates: Array<Array<[number, number]>>;
  };
  properties: PlotFeatureProperties;
}

export interface MasterPlanPlotGeoJsonCollection {
  type: 'FeatureCollection';
  name: string;
  crs?: {
    type: string;
    properties: {
      name: string;
    };
  };
  features: MasterPlanPlotFeature[];
}

export interface SelectedPlotInfo {
  plotNumber: number;
  block: string;
  areaSqM: number;
  areaSqFt: number;
  dimensions?: string;
  frontageM?: number;
  depthM?: number;
  status: PlotStatus;
}
