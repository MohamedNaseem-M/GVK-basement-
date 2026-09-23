import { expandPolylineBulges, generateArcPoints } from './bulge-expansion';
import {
  MasterPlanRoadGeoJsonCollection,
  MasterPlanRoadGeoJsonFeature,
  MasterPlanRoadLabelCollection,
  MasterPlanRoadLabelFeature,
  RoadFeatureMetadata,
  RoadType,
  RoadWidthCategory
} from '../models/road-masterplan.model';

export interface RawDxfEntity {
  handle: string;
  layer: string;
  entityType: 'LWPOLYLINE' | 'ARC';
  closed?: boolean;
  vertices?: Array<{ x: number; y: number; bulge?: number }>;
  bbox: [number, number, number, number];
  center?: [number, number];
  radius?: number;
  startAngleDeg?: number;
  endAngleDeg?: number;
  sampledPoints?: Array<[number, number]>;
}

export interface RawDxfLabel {
  handle: string;
  layer: string;
  text: string;
  position: [number, number];
  rotationDeg: number;
}

export interface MasterPlanRoadCorridorDef {
  id: string;
  name: string;
  width: RoadWidthCategory;
  cadPolygon: Array<[number, number]>;
  label: string;
  labelPos: [number, number];
  labelRotationDeg: number;
}

/**
 * Authoritative processor that converts raw DXF extracted road entities, labels,
 * and master plan road corridors into structured GeoJSON FeatureCollections,
 * preserving exact CAD geometry and adhering to authoritative widths (9M, 12M).
 */
export class RoadGeometryProcessor {
  /**
   * Generates a road surface FeatureCollection from raw DXF entities.
   * If transformFn is provided, coordinates are projected (e.g. CAD -> WGS84).
   */
  public static processRoadFeatures(
    entities: RawDxfEntity[],
    labels: RawDxfLabel[],
    transformFn?: (cadX: number, cadY: number) => [number, number]
  ): MasterPlanRoadGeoJsonCollection {
    const features: MasterPlanRoadGeoJsonFeature[] = [];

    entities.forEach(ent => {
      let cadPoints: Array<[number, number]> = [];
      let isClosed = !!ent.closed;

      if (ent.entityType === 'LWPOLYLINE' && ent.vertices && ent.vertices.length > 0) {
        cadPoints = expandPolylineBulges(ent.vertices, isClosed);
        if (cadPoints.length >= 4) {
          const p1 = cadPoints[0];
          const p2 = cadPoints[cadPoints.length - 1];
          if (Math.hypot(p1[0] - p2[0], p1[1] - p2[1]) < 0.05) {
            isClosed = true;
          }
        }
      } else if (ent.entityType === 'ARC' && ent.sampledPoints && ent.sampledPoints.length > 0) {
        cadPoints = ent.sampledPoints;
      } else if (ent.entityType === 'ARC' && ent.center && ent.radius) {
        cadPoints = generateArcPoints(ent.center, ent.radius, ent.startAngleDeg || 0, ent.endAngleDeg || 360);
      }

      if (cadPoints.length < 2) return;

      const outputCoords: Array<[number, number]> = transformFn
        ? cadPoints.map(([x, y]) => transformFn(x, y))
        : cadPoints;

      let roadType: RoadType = 'ROAD_9MAB';
      if (ent.layer === 'Road_9MBL') roadType = 'ROAD_9MBL';
      else if (ent.layer === 'PROP_ROAD') roadType = 'PROP_ROAD';

      let width: RoadWidthCategory = 'UNKNOWN';
      if (ent.layer === 'Road_9MAB' || ent.layer === 'Road_9MBL') {
        width = '9M';
      }

      const entCenterX = ent.bbox ? (ent.bbox[0] + ent.bbox[2]) / 2 : cadPoints[0][0];
      const entCenterY = ent.bbox ? (ent.bbox[1] + ent.bbox[3]) / 2 : cadPoints[0][1];

      let nearestLabel: string | null = null;
      let minDistance = 6.0;
      labels.forEach(lbl => {
        const d = Math.hypot(lbl.position[0] - entCenterX, lbl.position[1] - entCenterY);
        if (d < minDistance) {
          minDistance = d;
          nearestLabel = lbl.text.trim();
        }
      });

      if (nearestLabel) {
        if (/7\.5M/i.test(nearestLabel)) width = '7.5M';
        else if (/9M/i.test(nearestLabel)) width = '9M';
        else if (/12M/i.test(nearestLabel)) width = '12M';
        else if (/18M/i.test(nearestLabel)) width = '18M';
        else if (/24M/i.test(nearestLabel)) width = '24M';
        else if (/6M/i.test(nearestLabel)) width = '6M';
      }

      const labelText = width !== 'UNKNOWN' ? `${width} ROAD` : (nearestLabel || ent.layer);

      const metadata: RoadFeatureMetadata = {
        layer: ent.layer,
        sourceEntityHandle: ent.handle,
        handle: ent.handle,
        roadType,
        width,
        label: labelText,
        geometrySource: 'DXF_EXTRACTION',
        entityType: ent.entityType,
        closed: isClosed,
        hasBulges: ent.vertices ? ent.vertices.some(v => v.bulge && v.bulge !== 0) : false,
        isDxfEntity: true
      };

      if (isClosed && outputCoords.length >= 4) {
        features.push({
          type: 'Feature',
          id: ent.handle,
          geometry: {
            type: 'Polygon',
            coordinates: [outputCoords]
          },
          properties: metadata
        });
      } else {
        features.push({
          type: 'Feature',
          id: ent.handle,
          geometry: {
            type: 'LineString',
            coordinates: outputCoords
          },
          properties: metadata
        });
      }
    });

    return {
      type: 'FeatureCollection',
      name: 'GVK_Enclave_Roads',
      features
    };
  }

  /**
   * Generates a road label Point FeatureCollection from raw DXF labels.
   */
  public static processRoadLabels(
    labels: RawDxfLabel[],
    transformFn?: (cadX: number, cadY: number) => [number, number]
  ): MasterPlanRoadLabelCollection {
    const features: MasterPlanRoadLabelFeature[] = [];

    labels.forEach(lbl => {
      if (!lbl.position) return;
      const coords: [number, number] = transformFn
        ? transformFn(lbl.position[0], lbl.position[1])
        : [lbl.position[0], lbl.position[1]];

      let text = lbl.text.trim();
      if (/^\d+(\.\d+)?M$/i.test(text)) {
        text = `${text.toUpperCase()} ROAD`;
      }

      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: coords
        },
        properties: {
          handle: lbl.handle,
          text,
          originalText: lbl.text,
          layer: lbl.layer,
          rotationDeg: lbl.rotationDeg || 0
        }
      });
    });

    return {
      type: 'FeatureCollection',
      features
    };
  }
}
