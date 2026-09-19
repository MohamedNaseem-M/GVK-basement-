import { Injectable, inject, signal, WritableSignal } from '@angular/core';
import { DxfEntity, DxfVertex, RoadSegment } from '../core/models/road.model';
import { RoadDataService } from './road-data.service';

export interface CalibrationParams {
  anchorCadX: number;
  anchorCadY: number;
  anchorLng: number;
  anchorLat: number;
  scale: number;
  rotationDeg: number;
}

@Injectable({
  providedIn: 'root'
})
export class CoordinateTransformService {
  private readonly roadDataService = inject(RoadDataService);

  // Initial Temporary Calibration Baseline Values (CAD Center -> Project Anchor)
  public readonly anchorCadX: WritableSignal<number> = signal(27109.35);
  public readonly anchorCadY: WritableSignal<number> = signal(1721.155);
  public readonly anchorLng: WritableSignal<number> = signal(76.901774);
  public readonly anchorLat: WritableSignal<number> = signal(15.1267357);
  public readonly scale: WritableSignal<number> = signal(1.0); // 1.0 meter / CAD unit
  public readonly rotationDeg: WritableSignal<number> = signal(0.0); // 0 degrees
  public readonly isOverlayEnabled: WritableSignal<boolean> = signal(true);

  /**
   * Transforms a 2D Local CAD coordinate (X, Y) into WGS84 Geographic [longitude, latitude]
   */
  public cadToWgs84(cadX: number, cadY: number): [number, number] {
    const dx = cadX - this.anchorCadX();
    const dy = cadY - this.anchorCadY();

    const scaleVal = this.scale();
    const rotRad = (this.rotationDeg() * Math.PI) / 180;

    // Apply 2D Similarity Transformation in local meters relative to anchor
    const eastMeters = scaleVal * (dx * Math.cos(rotRad) - dy * Math.sin(rotRad));
    const northMeters = scaleVal * (dx * Math.sin(rotRad) + dy * Math.cos(rotRad));

    // Convert local displacement meters to WGS84 geographic degrees
    const baseLatRad = (this.anchorLat() * Math.PI) / 180;
    const metersPerDegLat = 110600.0;
    const metersPerDegLng = 111320.0 * Math.cos(baseLatRad);

    const lng = this.anchorLng() + (eastMeters / metersPerDegLng);
    const lat = this.anchorLat() + (northMeters / metersPerDegLat);

    return [lng, lat];
  }

  /**
   * Generates a fully transformed WGS84 GeoJSON FeatureCollection of all extracted DXF roads
   */
  public generateTransformedRoadsGeoJson(): any {
    const segments = this.roadDataService.roadSegments();
    const rawEntities = this.roadDataService.rawJsonData.entities || [];

    const features: any[] = [];

    rawEntities.forEach(ent => {
      const segment = segments.find(s => s.id === ent.handle);
      const layerName = ent.layer || 'PROP_ROAD';
      const widthCat = segment ? segment.width : 'UNKNOWN';

      let cadPoints: Array<[number, number]> = [];

      if (ent.entityType === 'LWPOLYLINE' && ent.vertices && ent.vertices.length > 0) {
        cadPoints = this.expandPolylineBulges(ent.vertices, !!ent.closed);
      } else if (ent.entityType === 'ARC' && ent.sampledPoints && ent.sampledPoints.length > 0) {
        cadPoints = ent.sampledPoints as Array<[number, number]>;
      } else if (ent.entityType === 'ARC' && ent.center && ent.radius) {
        cadPoints = this.generateArcPoints(ent.center, ent.radius, ent.startAngleDeg || 0, ent.endAngleDeg || 360);
      }

      if (cadPoints.length < 2) return;

      // Transform all intermediate CAD points to WGS84 [lng, lat]
      const geoCoords: Array<[number, number]> = cadPoints.map(([cx, cy]) => this.cadToWgs84(cx, cy));

      const isClosedPolygon = !!ent.closed && ent.entityType === 'LWPOLYLINE';

      if (isClosedPolygon && geoCoords.length >= 4) {
        // Closed polyline road block / polygon feature
        features.push({
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [geoCoords]
          },
          properties: {
            id: ent.handle,
            layer: layerName,
            width: widthCat,
            entityType: ent.entityType,
            closed: true,
            hasBulges: segment ? segment.hasBulges : false
          }
        });
      } else {
        // Open line / arc feature
        features.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: geoCoords
          },
          properties: {
            id: ent.handle,
            layer: layerName,
            width: widthCat,
            entityType: ent.entityType,
            closed: false,
            hasBulges: segment ? segment.hasBulges : false
          }
        });
      }
    });

    return {
      type: 'FeatureCollection',
      features
    };
  }

  /**
   * Mathematically expands LWPOLYLINE vertices containing bulge arc parameters into continuous 2D CAD points
   */
  private expandPolylineBulges(vertices: DxfVertex[], closed: boolean): Array<[number, number]> {
    const points: Array<[number, number]> = [];
    const n = vertices.length;
    if (n === 0) return points;

    for (let i = 0; i < n; i++) {
      const v1 = vertices[i];
      const isLast = i === n - 1;
      if (isLast && !closed) {
        points.push([v1.x, v1.y]);
        break;
      }
      const v2 = isLast ? vertices[0] : vertices[i + 1];
      points.push([v1.x, v1.y]);

      const bulge = v1.bulge || 0;
      if (bulge !== 0) {
        const dx = v2.x - v1.x;
        const dy = v2.y - v1.y;
        const chord = Math.hypot(dx, dy);

        if (chord > 1e-6) {
          const theta = 4 * Math.atan(Math.abs(bulge));
          const radius = (chord * (1 + bulge * bulge)) / (4 * Math.abs(bulge));
          const sign = bulge > 0 ? 1 : -1;
          const midX = (v1.x + v2.x) / 2;
          const midY = (v1.y + v2.y) / 2;
          const sagitta = Math.abs(bulge) * (chord / 2);
          const distToCenter = radius - sagitta;

          const nx = -dy / chord;
          const ny = dx / chord;
          const centerX = midX + sign * distToCenter * nx;
          const centerY = midY + sign * distToCenter * ny;

          const startAngle = Math.atan2(v1.y - centerY, v1.x - centerX);
          let endAngle = Math.atan2(v2.y - centerY, v2.x - centerX);

          if (sign > 0 && endAngle < startAngle) endAngle += 2 * Math.PI;
          if (sign < 0 && endAngle > startAngle) endAngle -= 2 * Math.PI;

          const steps = Math.max(6, Math.ceil(Math.abs(endAngle - startAngle) / (Math.PI / 12)));
          for (let s = 1; s < steps; s++) {
            const t = s / steps;
            const angle = startAngle + t * (endAngle - startAngle);
            points.push([centerX + radius * Math.cos(angle), centerY + radius * Math.sin(angle)]);
          }
        }
      }
    }

    if (closed && points.length > 0) {
      points.push([points[0][0], points[0][1]]);
    }

    return points;
  }

  /**
   * Generates interpolated points along a 2D ARC entity
   */
  private generateArcPoints(center: [number, number], radius: number, startAngleDeg: number, endAngleDeg: number): Array<[number, number]> {
    const points: Array<[number, number]> = [];
    const [cx, cy] = center;

    let startRad = (startAngleDeg * Math.PI) / 180;
    let endRad = (endAngleDeg * Math.PI) / 180;

    if (endRad < startRad) endRad += 2 * Math.PI;

    const steps = Math.max(12, Math.ceil(Math.abs(endRad - startRad) / (Math.PI / 16)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = startRad + t * (endRad - startRad);
      points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
    }

    return points;
  }

  public setScale(newScale: number): void {
    this.scale.set(Math.max(0.1, Math.min(10.0, newScale)));
  }

  public setRotation(newRotationDeg: number): void {
    this.rotationDeg.set(newRotationDeg);
  }

  public resetCalibration(): void {
    this.anchorCadX.set(27109.35);
    this.anchorCadY.set(1721.155);
    this.anchorLng.set(76.901774);
    this.anchorLat.set(15.1267357);
    this.scale.set(1.0);
    this.rotationDeg.set(0.0);
  }
}
