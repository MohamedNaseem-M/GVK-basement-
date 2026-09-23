/**
 * Master Plan Road Data Models & Schema Definitions
 */

export type RoadType = 'ROAD_9MAB' | 'ROAD_9MBL' | 'PROP_ROAD' | 'PARK' | 'CA_SITE' | 'ENTRY' | string;

export type RoadWidthCategory = '9M' | '12M' | '18M' | '24M' | '7.5M' | '6M' | 'N/A' | 'PARK' | 'CA_SITE' | 'ENTRY' | 'UNKNOWN' | string;

export interface RoadFeatureMetadata {
  layer?: string;
  sourceEntityHandle?: string;
  handle?: string;
  roadType: RoadType;
  width: RoadWidthCategory;
  label: string;
  geometrySource?: 'DXF_EXTRACTION' | string;
  entityType?: 'LWPOLYLINE' | 'ARC' | string;
  closed?: boolean;
  hasBulges?: boolean;
  isCorridor?: boolean;
  isAmenity?: boolean;
  amenityType?: string;
  isDxfEntity?: boolean;
  [key: string]: any;
}

export interface MasterPlanRoadGeoJsonFeature {
  type: 'Feature';
  id: string;
  geometry: {
    type: 'Polygon' | 'LineString';
    coordinates: any;
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
    originalText?: string;
    layer?: string;
    width?: string;
    rotationDeg?: number;
    isAmenityLabel?: boolean;
    [key: string]: any;
  };
}

export interface MasterPlanRoadLabelCollection {
  type: 'FeatureCollection';
  features: MasterPlanRoadLabelFeature[];
}

export type MasterPlanViewMode = 'SATELLITE_OVERLAY' | 'MASTER_PLAN_ONLY';
