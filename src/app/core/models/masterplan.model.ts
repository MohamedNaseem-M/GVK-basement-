/**
 * Master Plan DXF Extraction Data Models & Strongly-Typed Schema
 * Step 3A — Master Plan Geometry & Test Plots Reconstruction
 */

export interface MasterPlanPlotLabel {
  plotNumber: number;
  position: [number, number];
  rotation: number;
  handle: string;
}

export interface MasterPlanLineEntity {
  entityType: 'LINE';
  handle: string;
  start: [number, number];
  end: [number, number];
}

export interface MasterPlanLwpolylineVertex {
  x: number;
  y: number;
  startWidth?: number;
  endWidth?: number;
  bulge?: number;
}

export interface MasterPlanLwpolylineEntity {
  entityType: 'LWPOLYLINE';
  handle: string;
  closed: boolean;
  vertices: MasterPlanLwpolylineVertex[];
}

export type MasterPlanGeometryEntity = MasterPlanLineEntity | MasterPlanLwpolylineEntity;

export interface MasterPlanSummary {
  plotLabelCount: number;
  plotLabelRange: [number, number];
  numberLayerLineCount: number;
  numberLayerPolylineCount: number;
  sitePolylineCount: number;
  plotLabelExtent: [number, number, number, number];
  numberLayerExtent: [number, number, number, number];
}

export interface DxfMasterPlanExtractionJson {
  schemaVersion: string;
  sourceFile: string;
  purpose: string;
  warning: string;
  plotLabels: MasterPlanPlotLabel[];
  numberLayer: {
    entityCount: number;
    entities: MasterPlanGeometryEntity[];
    extent: [number, number, number, number];
  };
  siteLayer: {
    entityCount: number;
    entities: MasterPlanLwpolylineEntity[];
  };
  summary: MasterPlanSummary;
  sourceLayerCounts: Record<string, number>;
}

export interface ReconstructedPlot {
  plotNumber: number;
  block: string;
  dimensions: string;
  areaSqM: number;
  areaSqFt: number;
  cadPolygon: Array<[number, number]>;
  cadCenter: [number, number];
  isTestSubset: boolean;
}

export interface MasterPlanRoadCorridor {
  name: string;
  widthMeters: number;
  cadPolygon: Array<[number, number]>;
  type: 'corridor' | 'divider';
}
