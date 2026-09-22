import { Injectable, inject, signal, WritableSignal } from '@angular/core';
import { DxfEntity, DxfVertex, RoadSegment } from '../core/models/road.model';
import { RoadDataService } from './road-data.service';
import { MasterPlanDataService } from './masterplan-data.service';

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
  private readonly masterPlanService = inject(MasterPlanDataService);

  // Initial Temporary Calibration Baseline Values (CAD Center -> Project Anchor)
  public readonly anchorCadX: WritableSignal<number> = signal(27109.35);
  public readonly anchorCadY: WritableSignal<number> = signal(1721.155);
  public readonly anchorLng: WritableSignal<number> = signal(76.901774);
  public readonly anchorLat: WritableSignal<number> = signal(15.1267357);
  public readonly scale: WritableSignal<number> = signal(1.0); // 1.0 meter / CAD unit
  public readonly rotationDeg: WritableSignal<number> = signal(0.0); // 0 degrees
  public readonly isOverlayEnabled: WritableSignal<boolean> = signal(true);

  // Master Plan CAD Anchor & Mode
  public readonly masterPlanCadAnchorX: WritableSignal<number> = signal(26747.985);
  public readonly masterPlanCadAnchorY: WritableSignal<number> = signal(1547.750);
  public readonly masterPlanAnchorMode: WritableSignal<'DIRECT_CENTER' | 'DXF_SHARED_FRAME'> = signal('DIRECT_CENTER');

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
   * Transforms Master Plan CAD coordinates to WGS84 based on the configured anchor mode
   */
  public cadMasterPlanToWgs84(cadX: number, cadY: number): [number, number] {
    let dx: number;
    let dy: number;

    if (this.masterPlanAnchorMode() === 'DIRECT_CENTER') {
      dx = cadX - this.masterPlanCadAnchorX();
      dy = cadY - this.masterPlanCadAnchorY();
    } else {
      // DXF_SHARED_FRAME: Preserves CAD spatial offset from the road dataset anchor
      dx = cadX - this.anchorCadX();
      dy = cadY - this.anchorCadY();
    }

    const scaleVal = this.scale();
    const rotRad = (this.rotationDeg() * Math.PI) / 180;

    const eastMeters = scaleVal * (dx * Math.cos(rotRad) - dy * Math.sin(rotRad));
    const northMeters = scaleVal * (dx * Math.sin(rotRad) + dy * Math.cos(rotRad));

    const baseLatRad = (this.anchorLat() * Math.PI) / 180;
    const metersPerDegLat = 110600.0;
    const metersPerDegLng = 111320.0 * Math.cos(baseLatRad);

    const lng = this.anchorLng() + (eastMeters / metersPerDegLng);
    const lat = this.anchorLat() + (northMeters / metersPerDegLat);

    return [lng, lat];
  }

  /**
   * Generates WGS84 GeoJSON FeatureCollection of reconstructed test plot polygons (Plots 1–20)
   */
  public generateTransformedPlotsGeoJson(): any {
    const plots = this.masterPlanService.testPlots();
    const selected = this.masterPlanService.selectedPlot();

    const features = plots.map(plot => {
      const geoCoords = plot.cadPolygon.map(([cx, cy]) => this.cadMasterPlanToWgs84(cx, cy));
      const [centerLng, centerLat] = this.cadMasterPlanToWgs84(plot.cadCenter[0], plot.cadCenter[1]);

      return {
        type: 'Feature',
        id: plot.plotNumber,
        geometry: {
          type: 'Polygon',
          coordinates: [geoCoords]
        },
        properties: {
          plotNumber: plot.plotNumber,
          plotLabel: `Plot ${plot.plotNumber}`,
          block: plot.block,
          dimensions: plot.dimensions,
          areaSqM: plot.areaSqM,
          areaSqFt: plot.areaSqFt,
          isTestSubset: true,
          isSelected: selected?.plotNumber === plot.plotNumber,
          centerLng,
          centerLat
        }
      };
    });

    return {
      type: 'FeatureCollection',
      features
    };
  }

  /**
   * Generates WGS84 GeoJSON Point FeatureCollection for plot number labels
   */
  public generateTransformedPlotLabelsGeoJson(): any {
    const plots = this.masterPlanService.testPlots();

    const features = plots.map(plot => {
      const [lng, lat] = this.cadMasterPlanToWgs84(plot.cadCenter[0], plot.cadCenter[1]);

      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lng, lat]
        },
        properties: {
          plotNumber: plot.plotNumber,
          plotNumberStr: `${plot.plotNumber}`,
          block: plot.block,
          dimensions: plot.dimensions,
          areaSqM: plot.areaSqM
        }
      };
    });

    return {
      type: 'FeatureCollection',
      features
    };
  }

  /**
   * Generates WGS84 GeoJSON FeatureCollection for Master Plan road corridors framing Block 1
   */
  public generateTransformedMasterPlanRoadsGeoJson(): any {
    const corridors = this.masterPlanService.roadCorridors();

    const features = corridors.map((corridor, idx) => {
      const geoCoords = corridor.cadPolygon.map(([cx, cy]) => this.cadMasterPlanToWgs84(cx, cy));

      return {
        type: 'Feature',
        id: `mp-road-${idx}`,
        geometry: {
          type: 'Polygon',
          coordinates: [geoCoords]
        },
        properties: {
          name: corridor.name,
          widthMeters: corridor.widthMeters,
          type: corridor.type
        }
      };
    });

    return {
      type: 'FeatureCollection',
      features
    };
  }

  /**
   * Computes geographic bounding box for Master Plan test subset [minLng, minLat, maxLng, maxLat]
   */
  public getMasterPlanBbox(): [number, number, number, number] {
    const geoJson = this.generateTransformedPlotsGeoJson();
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;

    geoJson.features.forEach((f: any) => {
      f.geometry.coordinates[0].forEach(([lng, lat]: [number, number]) => {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      });
    });

    if (!isFinite(minLng)) return [76.901, 15.126, 76.902, 15.127];
    return [minLng, minLat, maxLng, maxLat];
  }

  /**
   * Toggles master plan anchor mode between DIRECT_CENTER and DXF_SHARED_FRAME
   */
  public toggleMasterPlanAnchorMode(): void {
    const current = this.masterPlanAnchorMode();
    this.masterPlanAnchorMode.set(current === 'DIRECT_CENTER' ? 'DXF_SHARED_FRAME' : 'DIRECT_CENTER');
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
   * Generates WGS84 GeoJSON Point features for road width callout text labels
   */
  public generateTransformedLabelsGeoJson(): any {
    const rawLabels = this.roadDataService.roadLabels();
    const features: any[] = [];

    rawLabels.forEach(lbl => {
      if (!lbl.position) return;
      const [lng, lat] = this.cadToWgs84(lbl.position[0], lbl.position[1]);
      let formattedText = lbl.text.trim();

      if (/^\d+(\.\d+)?M$/i.test(formattedText)) {
        formattedText = `${formattedText.toUpperCase()} ROAD`;
      }

      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lng, lat]
        },
        properties: {
          text: formattedText,
          originalText: lbl.text,
          rotationDeg: lbl.rotationDeg || 0
        }
      });
    });

    return {
      type: 'FeatureCollection',
      features
    };
  }

  /**
   * Calculates current transformed geographic bounding box [minLng, minLat, maxLng, maxLat]
   */
  public getTransformedBbox(): [number, number, number, number] {
    const geoJson = this.generateTransformedRoadsGeoJson();
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;

    geoJson.features.forEach((f: any) => {
      const geomType = f.geometry.type;
      let coordsList: Array<[number, number]> = [];
      if (geomType === 'LineString') {
        coordsList = f.geometry.coordinates;
      } else if (geomType === 'Polygon') {
        coordsList = f.geometry.coordinates[0];
      }

      coordsList.forEach(([lng, lat]) => {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      });
    });

    if (!isFinite(minLng)) return [76.901, 15.126, 76.902, 15.127];
    return [minLng, minLat, maxLng, maxLat];
  }

  /**
   * Generates a GeoJSON feature for rendering the CAD Transformed Extent bounding box
   */
  public generateBboxGeoJson(): any {
    const [minLng, minLat, maxLng, maxLat] = this.getTransformedBbox();
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [minLng, minLat],
                [maxLng, minLat],
                [maxLng, maxLat],
                [minLng, maxLat],
                [minLng, minLat]
              ]
            ]
          },
          properties: {
            name: 'CAD TRANSFORMED EXTENT'
          }
        }
      ]
    };
  }

  /**
   * Comprehensive runtime diagnostic metrics for logging and UI inspection
   */
  public getDiagnostics(): any {
    const geoJson = this.generateTransformedRoadsGeoJson();
    let road9mab = 0, road9mbl = 0, propRoad = 0;
    let totalCoords = 0;
    let firstCoord: [number, number] | null = null;
    let lastCoord: [number, number] | null = null;
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;

    geoJson.features.forEach((f: any) => {
      const layerName = f.properties.layer;
      if (layerName === 'Road_9MAB') road9mab++;
      else if (layerName === 'Road_9MBL') road9mbl++;
      else if (layerName === 'PROP_ROAD') propRoad++;

      const coords: Array<[number, number]> = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates;
      coords.forEach(([lng, lat]) => {
        if (!firstCoord) firstCoord = [lng, lat];
        lastCoord = [lng, lat];
        totalCoords++;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      });
    });

    const centerLng = (minLng + maxLng) / 2;
    const centerLat = (minLat + maxLat) / 2;
    const anchorLng = this.anchorLng();
    const anchorLat = this.anchorLat();

    const baseLatRad = (anchorLat * Math.PI) / 180;
    const mPerDegLat = 110600.0;
    const mPerDegLng = 111320.0 * Math.cos(baseLatRad);

    const dEast = (centerLng - anchorLng) * mPerDegLng;
    const dNorth = (centerLat - anchorLat) * mPerDegLat;
    const distMeters = Math.hypot(dEast, dNorth);

    return {
      features: { Road_9MAB: road9mab, Road_9MBL: road9mbl, PROP_ROAD: propRoad },
      totalCoords,
      firstCoord,
      lastCoord,
      minLng,
      maxLng,
      minLat,
      maxLat,
      centerLng,
      centerLat,
      anchorLng,
      anchorLat,
      distMeters: Number(distMeters.toFixed(2))
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
