import { Injectable, signal, WritableSignal } from '@angular/core';
import { MASTERPLAN_ANCHOR, MASTERPLAN_PLOT_ANCHOR, MasterPlanProjectAnchor } from '../config/masterplan.config';

@Injectable({
  providedIn: 'root'
})
export class MasterPlanTransformService {
  // Master plan unified anchor parameters for roads
  public readonly anchor: WritableSignal<MasterPlanProjectAnchor> = signal({ ...MASTERPLAN_ANCHOR });

  // Master plan anchor parameters for 318 plots
  public readonly plotAnchor: WritableSignal<MasterPlanProjectAnchor> = signal({ ...MASTERPLAN_PLOT_ANCHOR });

  /**
   * Transforms a 2D Local CAD coordinate (cadX, cadY) into WGS84 Geographic [longitude, latitude]
   * using the unified Master Plan similarity transformation.
   */
  public cadToWgs84(cadX: number, cadY: number): [number, number] {
    const config = this.anchor();
    const dx = cadX - config.cadOriginX;
    const dy = cadY - config.cadOriginY;

    const s = config.scaleMetersPerCad;
    const rotRad = (config.rotationDegrees * Math.PI) / 180;

    // 2D Similarity Transformation in local meters relative to anchor
    const eastMeters = s * (dx * Math.cos(rotRad) - dy * Math.sin(rotRad));
    const northMeters = s * (dx * Math.sin(rotRad) + dy * Math.cos(rotRad));

    // Convert local displacement meters to WGS84 geographic degrees
    const baseLatRad = (config.latitude * Math.PI) / 180;
    const metersPerDegLat = 110600.0;
    const metersPerDegLng = 111320.0 * Math.cos(baseLatRad);

    const lng = config.longitude + (eastMeters / metersPerDegLng);
    const lat = config.latitude + (northMeters / metersPerDegLat);

    return [Number(lng.toFixed(7)), Number(lat.toFixed(7))];
  }

  /**
   * Transforms a 2D Local CAD coordinate (cadX, cadY) from the Master Plan Plot CAD system
   * into WGS84 Geographic [longitude, latitude].
   */
  public cadPlotToWgs84(cadX: number, cadY: number): [number, number] {
    const config = this.plotAnchor();
    const dx = cadX - config.cadOriginX;
    const dy = cadY - config.cadOriginY;

    const s = config.scaleMetersPerCad;
    const rotRad = (config.rotationDegrees * Math.PI) / 180;

    const eastMeters = s * (dx * Math.cos(rotRad) - dy * Math.sin(rotRad));
    const northMeters = s * (dx * Math.sin(rotRad) + dy * Math.cos(rotRad));

    const baseLatRad = (config.latitude * Math.PI) / 180;
    const metersPerDegLat = 110600.0;
    const metersPerDegLng = 111320.0 * Math.cos(baseLatRad);

    const lng = config.longitude + (eastMeters / metersPerDegLng);
    const lat = config.latitude + (northMeters / metersPerDegLat);

    return [Number(lng.toFixed(7)), Number(lat.toFixed(7))];
  }

  /**
   * Sets internal calibration parameters (developer configuration, not shown in user UI)
   */
  public setParameters(params: Partial<MasterPlanProjectAnchor>): void {
    this.anchor.update(current => ({ ...current, ...params }));
  }

  /**
   * Resets calibration to the authoritative baseline
   */
  public resetToBaseline(): void {
    this.anchor.set({ ...MASTERPLAN_ANCHOR });
  }
}
