/**
 * Master Plan Road Data Models & Schema Definitions
 */

export type RoadType = 'ROAD_9MAB' | 'ROAD_9MBL' | 'PROP_ROAD';

export type RoadWidthCategory = '9M' | '12M' | '18M' | '24M' | '7.5M' | '6M' | 'UNKNOWN';

export interface RoadFeatureMetadata {
  layer: string;
  sourceEntityHandle: string;
  roadType: RoadType;
  width: RoadWidthCategory;
  label: string;
  geometrySource: 'DXF_EXTRACTION';
  entityType: 'LWPOLYLINE' | 'ARC';
  closed: boolean;
  hasBulges: boolean;
}

export interface MasterPlanRoadGeoJsonFeature {
  type: 'Feature';
  id: string;
  geometry: {
    type: 'Polygon' | 'LineString';
    coordinates: Array<[number, number]> | Array<Array<[number, number]>>;
  };
  properties: RoadFeatureMetadata;
}

export interface MasterPlanRoadGeoJsonCollection {
  type: 'FeatureCollection';
  name: string;
  crs?: {
    type: string;
    properties: { name: string };
  };
  features: MasterPlanRoadGeoJsonFeature[];
}

export interface MasterPlanRoadLabelFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    handle: string;
    text: string;
    originalText: string;
    layer: string;
    rotationDeg: number;
  };
}

export interface MasterPlanRoadLabelCollection {
  type: 'FeatureCollection';
  features: MasterPlanRoadLabelFeature[];
}

export type MasterPlanViewMode = 'SATELLITE_OVERLAY' | 'MASTER_PLAN_ONLY';
