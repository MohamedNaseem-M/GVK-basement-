import { Injectable, signal, WritableSignal } from '@angular/core';
import * as maplibregl from 'maplibre-gl';
import {
  BASEMAP_STYLES,
  CAMERA_PRESETS,
  INITIAL_MAP_CONFIG,
  PROJECT_LOCATION
} from '../core/constants/map.constants';

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private map: maplibregl.Map | null = null;
  private projectMarker: maplibregl.Marker | null = null;

  // Reactive state signals for public consumption
  public readonly isMapLoaded: WritableSignal<boolean> = signal(false);
  public readonly currentZoom: WritableSignal<number> = signal(INITIAL_MAP_CONFIG.zoom);
  public readonly currentCenter: WritableSignal<{ lat: number; lng: number }> = signal(PROJECT_LOCATION);
  public readonly is3DMode: WritableSignal<boolean> = signal(true);
  public readonly currentPitch: WritableSignal<number> = signal(INITIAL_MAP_CONFIG.pitch);
  public readonly currentBearing: WritableSignal<number> = signal(INITIAL_MAP_CONFIG.bearing);

  /**
   * Initializes MapLibre GL map instance inside target DOM element with 3D satellite basemap
   */
  public initializeMap(container: HTMLElement): maplibregl.Map {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }

    const mapInstance = new maplibregl.Map({
      container,
      style: BASEMAP_STYLES.satelliteStyle as maplibregl.StyleSpecification,
      center: INITIAL_MAP_CONFIG.center,
      zoom: INITIAL_MAP_CONFIG.zoom,
      minZoom: INITIAL_MAP_CONFIG.minZoom,
      maxZoom: INITIAL_MAP_CONFIG.maxZoom,
      pitch: INITIAL_MAP_CONFIG.pitch,
      bearing: INITIAL_MAP_CONFIG.bearing,
      maxPitch: INITIAL_MAP_CONFIG.maxPitch,
      fadeDuration: 100
    });

    this.map = mapInstance;

    // Add standard touch-friendly navigation controls (bottom-right compass/pitch)
    mapInstance.addControl(
      new maplibregl.NavigationControl({
        showCompass: true,
        showZoom: false, // Custom touch controls provided in component UI
        visualizePitch: true
      }),
      'bottom-right'
    );

    // Track map load event and add project marker
    mapInstance.on('load', () => {
      this.isMapLoaded.set(true);
      this.addProjectMarker();
    });

    // Track real-time map camera movements
    mapInstance.on('move', () => {
      const center = mapInstance.getCenter();
      const pitch = mapInstance.getPitch();
      const bearing = mapInstance.getBearing();

      this.currentCenter.set({ lat: center.lat, lng: center.lng });
      this.currentZoom.set(mapInstance.getZoom());
      this.currentPitch.set(pitch);
      this.currentBearing.set(bearing);
      this.is3DMode.set(pitch > 15);
    });

    return mapInstance;
  }


  /**
   * Places project location marker at exact coordinates: 15.1267357, 76.901774
   */
  public addProjectMarker(): void {
    if (!this.map) return;

    if (this.projectMarker) {
      this.projectMarker.remove();
    }

    // Custom mobile-friendly Marker HTML Element
    const el = document.createElement('div');
    el.className = 'custom-project-marker';
    el.setAttribute('aria-label', 'Project Location Pin');

    el.innerHTML = `
      <div class="marker-container">
        <div class="marker-pulse"></div>
        <div class="marker-pin">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
        </div>
      </div>
    `;

    // Create interactive popup with geographic info
    const popup = new maplibregl.Popup({ offset: 30, closeButton: true }).setHTML(`
      <div class="marker-popup-content">
        <span class="popup-tag">PROJECT LOCATION</span>
        <h4 class="popup-title">Plotted Development</h4>
        <p class="popup-coords">
          <span>Lat: <strong>15.1267357</strong></span><br/>
          <span>Lng: <strong>76.901774</strong></span>
        </p>
      </div>
    `);

    this.projectMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([PROJECT_LOCATION.lng, PROJECT_LOCATION.lat])
      .setPopup(popup)
      .addTo(this.map);
  }

  /**
   * Toggles smoothly between 2D mode (pitch 0) and 3D mode (pitch 55, bearing -20)
   */
  public toggle3DView(): void {
    if (this.is3DMode()) {
      this.set2DView();
    } else {
      this.set3DView();
    }
  }

  /**
   * Smoothly animates camera to 2D top-down view
   */
  public set2DView(): void {
    if (!this.map) return;
    this.map.easeTo({
      pitch: CAMERA_PRESETS.view2D.pitch,
      bearing: CAMERA_PRESETS.view2D.bearing,
      zoom: CAMERA_PRESETS.view2D.zoom,
      duration: 1200
    });
  }

  /**
   * Smoothly animates camera to 3D perspective view
   */
  public set3DView(): void {
    if (!this.map) return;
    this.map.easeTo({
      center: [PROJECT_LOCATION.lng, PROJECT_LOCATION.lat],
      pitch: CAMERA_PRESETS.view3D.pitch,
      bearing: CAMERA_PRESETS.view3D.bearing,
      zoom: CAMERA_PRESETS.view3D.zoom,
      duration: 1200
    });
  }

  /**
   * Smoothly flies camera back to exact project location
   */
  public flyToProjectLocation(): void {
    if (!this.map) return;
    const targetPitch = this.is3DMode() ? CAMERA_PRESETS.view3D.pitch : 0;
    const targetBearing = this.is3DMode() ? CAMERA_PRESETS.view3D.bearing : 0;
    const targetZoom = this.is3DMode() ? CAMERA_PRESETS.view3D.zoom : CAMERA_PRESETS.view2D.zoom;

    this.map.flyTo({
      center: [PROJECT_LOCATION.lng, PROJECT_LOCATION.lat],
      zoom: targetZoom,
      pitch: targetPitch,
      bearing: targetBearing,
      duration: 1500,
      essential: true
    });
  }

  public zoomIn(): void {
    if (this.map) {
      this.map.zoomIn({ duration: 300 });
    }
  }

  public zoomOut(): void {
    if (this.map) {
      this.map.zoomOut({ duration: 300 });
    }
  }

  /**
   * Extensible hook for future GeoJSON vector layers (Phase 2+)
   */
  public addGeoJsonSource(sourceId: string, data: any): void {
    if (!this.map || !this.isMapLoaded()) return;
    if (!this.map.getSource(sourceId)) {
      this.map.addSource(sourceId, {
        type: 'geojson',
        data
      });
    }
  }

  public destroyMap(): void {
    if (this.projectMarker) {
      this.projectMarker.remove();
      this.projectMarker = null;
    }
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this.isMapLoaded.set(false);
  }
}
