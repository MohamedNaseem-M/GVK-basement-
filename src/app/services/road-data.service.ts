import { Injectable, signal, WritableSignal } from '@angular/core';
import {
  ClassificationConfidence,
  DxfEntity,
  DxfLabel,
  DxfRoadExtractionJson,
  RoadDatasetSummary,
  RoadSegment,
  RoadWidthCategory
} from '../core/models/road.model';

import rawDxfData from '../../assets/data/dxf-road-extraction.json';

@Injectable({
  providedIn: 'root'
})
export class RoadDataService {
  public readonly rawJsonData: DxfRoadExtractionJson = (rawDxfData as unknown) as DxfRoadExtractionJson;

  public readonly roadSegments: WritableSignal<RoadSegment[]> = signal([]);
  public readonly roadLabels: WritableSignal<DxfLabel[]> = signal([]);
  public readonly datasetSummary: WritableSignal<RoadDatasetSummary | null> = signal(null);
  public readonly isRoadDataLoaded: WritableSignal<boolean> = signal(false);

  constructor() {
    this.parseAndValidateRoadDataset();
  }

  /**
   * Parses raw extracted DXF JSON, applies spatial label proximity matching,
   * and populates the structured internal road data signals.
   */
  private parseAndValidateRoadDataset(): void {
    const rawEntities = this.rawJsonData.entities || [];
    const rawLabels = this.rawJsonData.labels || [];

    const segments: RoadSegment[] = [];
    const PROXIMITY_THRESHOLD_CAD_UNITS = 5.0; // Threshold in local CAD metres

    let totalPolylines = 0;
    let totalArcs = 0;
    let closedPolylines = 0;
    let openPolylines = 0;
    let entitiesWithBulges = 0;
    let unclassifiedCount = 0;

    const layerCounts: Record<string, number> = {};
    const widthCounts: Record<string, number> = {};
    const labelCounts: Record<string, number> = {};

    // Process raw labels
    rawLabels.forEach(lbl => {
      labelCounts[lbl.text] = (labelCounts[lbl.text] || 0) + 1;
    });
    this.roadLabels.set(rawLabels);

    // Process entities
    rawEntities.forEach(ent => {
      layerCounts[ent.layer] = (layerCounts[ent.layer] || 0) + 1;

      if (ent.entityType === 'LWPOLYLINE') {
        totalPolylines++;
        if (ent.closed) closedPolylines++;
        else openPolylines++;
      } else if (ent.entityType === 'ARC') {
        totalArcs++;
      }

      const hasBulges = !!(ent.vertices && ent.vertices.some(v => v.bulge && v.bulge !== 0));
      if (hasBulges) entitiesWithBulges++;

      // Spatial label association logic
      let assignedWidth: RoadWidthCategory = 'UNKNOWN';
      let confidence: ClassificationConfidence = 'UNCLASSIFIED';
      let nearestLabelText: string | undefined = undefined;
      let minDistance = Infinity;

      if (ent.layer === 'Road_9MAB') {
        assignedWidth = '9M';
        confidence = 'HIGH_LAYER_SPEC';
      } else if (ent.layer === 'Road_9MBL') {
        // Find nearest label from RoadTxt_9MBL
        const mblLabels = rawLabels.filter(l => l.layer === 'RoadTxt_9MBL');
        mblLabels.forEach(lbl => {
          const d = this.calculateMinDistanceToEntity(lbl.position, ent);
          if (d < minDistance) {
            minDistance = d;
            nearestLabelText = lbl.text;
          }
        });

        if (minDistance <= PROXIMITY_THRESHOLD_CAD_UNITS && nearestLabelText) {
          assignedWidth = this.normalizeWidthCategory(nearestLabelText);
          confidence = 'HIGH_PROXIMITY';
        } else {
          assignedWidth = '9M'; // Standard default for 9MBL layer
          confidence = 'MEDIUM_LAYER_NAME';
        }
      } else if (ent.layer === 'PROP_ROAD') {
        // Find nearest label from PROP_ROAD_WIDTH
        const propLabels = rawLabels.filter(l => l.layer === 'PROP_ROAD_WIDTH');
        propLabels.forEach(lbl => {
          const d = this.calculateMinDistanceToEntity(lbl.position, ent);
          if (d < minDistance) {
            minDistance = d;
            nearestLabelText = lbl.text;
          }
        });

        if (minDistance <= PROXIMITY_THRESHOLD_CAD_UNITS && nearestLabelText) {
          assignedWidth = this.normalizeWidthCategory(nearestLabelText);
          confidence = 'HIGH_PROXIMITY';
        } else {
          // Do not guess if distance exceeds threshold! Mark as UNKNOWN.
          assignedWidth = 'UNKNOWN';
          confidence = 'UNCLASSIFIED';
          unclassifiedCount++;
        }
      }

      widthCounts[assignedWidth] = (widthCounts[assignedWidth] || 0) + 1;

      const segment: RoadSegment = {
        id: ent.handle,
        sourceLayer: ent.layer,
        entityType: ent.entityType,
        width: assignedWidth,
        classificationConfidence: confidence,
        closed: !!ent.closed,
        hasBulges,
        vertices: ent.vertices || [],
        sampledPoints: ent.sampledPoints,
        bbox: ent.bbox,
        associatedLabelText: nearestLabelText,
        associatedLabelDistance: isFinite(minDistance) ? Number(minDistance.toFixed(2)) : undefined,
        sourceMetadata: {
          handle: ent.handle,
          layer: ent.layer,
          entityType: ent.entityType,
          geometryNote: ent.geometryNote
        }
      };

      segments.push(segment);
    });

    const summary: RoadDatasetSummary = {
      totalEntities: rawEntities.length,
      totalPolylines,
      totalArcs,
      closedPolylines,
      openPolylines,
      entitiesWithBulges,
      layerCounts,
      widthCounts,
      labelCounts,
      unclassifiedCount
    };

    this.roadSegments.set(segments);
    this.datasetSummary.set(summary);
    this.isRoadDataLoaded.set(true);
  }

  /**
   * Helper to normalize text string to RoadWidthCategory
   */
  private normalizeWidthCategory(text: string): RoadWidthCategory {
    const clean = text.trim().toUpperCase();
    if (clean === '9M') return '9M';
    if (clean === '12M') return '12M';
    if (clean === '18M') return '18M';
    if (clean === '24M') return '24M';
    if (clean === '7.5M') return '7.5M';
    if (clean === '6M') return '6M';
    return 'UNKNOWN';
  }

  /**
   * Calculates minimum Euclidean distance from a 2D point [px, py] to a DXF entity
   */
  private calculateMinDistanceToEntity(point: [number, number], entity: DxfEntity): number {
    const [px, py] = point;

    if (entity.entityType === 'LWPOLYLINE' && entity.vertices && entity.vertices.length > 0) {
      let minD = Infinity;
      const verts = entity.vertices;
      for (let i = 0; i < verts.length - 1; i++) {
        const d = this.pointToSegmentDistance(px, py, verts[i].x, verts[i].y, verts[i + 1].x, verts[i + 1].y);
        if (d < minD) minD = d;
      }
      if (entity.closed && verts.length > 1) {
        const d = this.pointToSegmentDistance(px, py, verts[verts.length - 1].x, verts[verts.length - 1].y, verts[0].x, verts[0].y);
        if (d < minD) minD = d;
      }
      return minD;
    } else if (entity.entityType === 'ARC' && entity.center && entity.radius !== undefined) {
      const distToCenter = Math.hypot(px - entity.center[0], py - entity.center[1]);
      return Math.abs(distToCenter - entity.radius);
    }
    return Infinity;
  }

  /**
   * Calculates distance from point (px, py) to line segment (x1, y1)-(x2, y2)
   */
  private pointToSegmentDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    if (dx === 0 && dy === 0) {
      return Math.hypot(px - x1, py - y1);
    }
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
  }
}
