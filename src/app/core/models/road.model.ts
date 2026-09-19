/**
 * DXF Extracted Road Data Models & Strongly-Typed Schema Definitions
 * Step 1 — Internal Road Data Model (Local CAD Coordinates)
 */

export interface DxfVertex {
  x: number;
  y: number;
  bulge: number;
}

export interface DxfEntity {
  handle: string;
  layer: 'Road_9MAB' | 'Road_9MBL' | 'PROP_ROAD' | string;
  entityType: 'LWPOLYLINE' | 'ARC';
  closed?: boolean;
  vertices?: DxfVertex[];
  bbox: [number, number, number, number];
  center?: [number, number];
  radius?: number;
  startAngleDeg?: number;
  endAngleDeg?: number;
  sampledPoints?: Array<[number, number]>;
  geometryNote?: string;
}

export interface DxfLabel {
  handle: string;
  layer: 'RoadTxt_9MAB' | 'RoadTxt_9MBL' | 'PROP_ROAD_WIDTH' | string;
  text: string;
  position: [number, number];
  rotationDeg: number;
}

export interface DxfRoadExtractionJson {
  schemaVersion: string;
  sourceFile: string;
  source: string;
  coordinateSystem: {
    type: string;
    dxfHeaderINSUNITS: number;
    warning: string;
  };
  roadGeometryExtent: [number, number, number, number];
  summary: Record<string, any>;
  entities: DxfEntity[];
  labels: DxfLabel[];
}

export type RoadWidthCategory = '9M' | '12M' | '18M' | '24M' | '7.5M' | '6M' | 'UNKNOWN';

export type ClassificationConfidence = 'HIGH_LAYER_SPEC' | 'HIGH_PROXIMITY' | 'MEDIUM_LAYER_NAME' | 'UNCLASSIFIED';

export interface RoadSegment {
  id: string; // Handle from DXF entity
  sourceLayer: string; // Layer name (e.g. Road_9MAB, Road_9MBL, PROP_ROAD)
  entityType: 'LWPOLYLINE' | 'ARC';
  width: RoadWidthCategory;
  classificationConfidence: ClassificationConfidence;
  closed: boolean;
  hasBulges: boolean;
  vertices: DxfVertex[];
  sampledPoints?: Array<[number, number]>;
  bbox: [number, number, number, number]; // [minX, minY, maxX, maxY]
  associatedLabelText?: string;
  associatedLabelDistance?: number; // Distance in local CAD units
  sourceMetadata: {
    handle: string;
    layer: string;
    entityType: string;
    geometryNote?: string;
  };
}

export interface RoadDatasetSummary {
  totalEntities: number;
  totalPolylines: number;
  totalArcs: number;
  closedPolylines: number;
  openPolylines: number;
  entitiesWithBulges: number;
  layerCounts: Record<string, number>;
  widthCounts: Record<string, number>;
  labelCounts: Record<string, number>;
  unclassifiedCount: number;
}
