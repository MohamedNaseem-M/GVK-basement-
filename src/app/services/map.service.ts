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

  private poiPopup: maplibregl.Popup | null = null;
  private poiFetchTimeout: any = null;

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

    // Enable native mouse drag & touch rotation for full 360-degree continuous rotation
    mapInstance.dragRotate.enable();
    mapInstance.touchZoomRotate.enable();
    mapInstance.touchZoomRotate.enableRotation();
    mapInstance.touchPitch.enable();

    // Add standard touch-friendly navigation controls (bottom-right compass/pitch)
    mapInstance.addControl(
      new maplibregl.NavigationControl({
        showCompass: true,
        showZoom: false, // Custom touch controls provided in component UI
        visualizePitch: true
      }),
      'bottom-right'
    );

    // Track map load event and add project marker & POI layer
    mapInstance.on('load', () => {
      this.isMapLoaded.set(true);
      this.addProjectMarker();
      this.initDynamicPoiLayer();
      this.fetchDynamicPOIs();
    });

    // Track real-time map camera movements & fetch POIs on viewport move
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

    mapInstance.on('moveend', () => {
      this.schedulePoiFetch();
    });

    return mapInstance;
  }

  /**
   * Initializes dynamic vector POI source and styling layers in MapLibre GL
   */
  private initDynamicPoiLayer(): void {
    if (!this.map) return;

    if (!this.map.getSource('osm-pois-source')) {
      this.map.addSource('osm-pois-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });
    }

    // Colored circle background markers for real-world POIs
    if (!this.map.getLayer('osm-pois-circles')) {
      this.map.addLayer({
        id: 'osm-pois-circles',
        type: 'circle',
        source: 'osm-pois-source',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 4, 16, 7, 19, 10],
          'circle-color': [
            'match',
            ['get', 'category'],
            'fuel', '#f59e0b',
            'hotel', '#3b82f6',
            'hospital', '#ef4444',
            'bank', '#10b981',
            'restaurant', '#ec4899',
            'school', '#8b5cf6',
            'place_of_worship', '#a855f7',
            '#06b6d4'
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.95
        }
      });
    }

    // Text labels for POI names
    if (!this.map.getLayer('osm-pois-labels')) {
      this.map.addLayer({
        id: 'osm-pois-labels',
        type: 'symbol',
        source: 'osm-pois-source',
        minzoom: 13,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 13, 10, 16, 12, 19, 14],
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-max-width': 10
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#0f172a',
          'text-halo-width': 2
        }
      });
    }

    // Cursor pointer on hover over POIs
    this.map.on('mouseenter', 'osm-pois-circles', () => {
      if (this.map) this.map.getCanvas().style.cursor = 'pointer';
    });

    this.map.on('mouseleave', 'osm-pois-circles', () => {
      if (this.map) this.map.getCanvas().style.cursor = '';
    });

    // Interactive popup on POI click/tap
    this.map.on('click', 'osm-pois-circles', (e: any) => {
      if (!this.map || !e.features || !e.features[0]) return;

      const feature = e.features[0];
      const coords = feature.geometry.coordinates.slice() as [number, number];
      const props = feature.properties;

      if (this.poiPopup) {
        this.poiPopup.remove();
      }

      const categoryTitle = (props.category || 'POI').toUpperCase();
      const popupHtml = `
        <div class="marker-popup-content">
          <span class="popup-tag">${categoryTitle}</span>
          <h4 class="popup-title">${props.name}</h4>
          <p class="popup-coords">
            <span>Lat: <strong>${coords[1].toFixed(7)}</strong></span><br/>
            <span>Lng: <strong>${coords[0].toFixed(7)}</strong></span>
          </p>
        </div>
      `;

      this.poiPopup = new maplibregl.Popup({ offset: 15, closeButton: true })
        .setLngLat(coords)
        .setHTML(popupHtml)
        .addTo(this.map);
    });
  }

  /**
   * Debounces fetching dynamic POIs when the map viewport moves
   */
  private schedulePoiFetch(): void {
    if (this.poiFetchTimeout) {
      clearTimeout(this.poiFetchTimeout);
    }
    this.poiFetchTimeout = setTimeout(() => {
      this.fetchDynamicPOIs();
    }, 600);
  }

  /**
   * Dynamically queries real-world OpenStreetMap POIs within active map bounding box
   */
  public async fetchDynamicPOIs(): Promise<void> {
    if (!this.map || !this.isMapLoaded()) return;

    const bounds = this.map.getBounds();
    const zoom = this.map.getZoom();

    // Limit query to zoom level >= 12 to avoid massive payload
    if (zoom < 12) return;

    const south = bounds.getSouth().toFixed(5);
    const west = bounds.getWest().toFixed(5);
    const north = bounds.getNorth().toFixed(5);
    const east = bounds.getEast().toFixed(5);

    const query = `[out:json][timeout:15];(
      node["amenity"](${south},${west},${north},${east});
      node["tourism"](${south},${west},${north},${east});
      node["shop"](${south},${west},${north},${east});
      node["highway"="fuel"](${south},${west},${north},${east});
      node["place"](${south},${west},${north},${east});
    );out body 80;`;

    const endpoints = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://overpass.private.coffee/api/interpreter'
    ];

    for (const url of endpoints) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'GVTBasementApp/1.0'
          },
          body: 'data=' + encodeURIComponent(query)
        });

        if (!response.ok) continue;

        const data = await response.json();
        if (!data || !data.elements) continue;

        const features = data.elements
          .filter((e: any) => e.tags && (e.tags.name || e.tags['name:en']))
          .map((e: any) => {
            const name = e.tags.name || e.tags['name:en'];
            const amenity = e.tags.amenity;
            const tourism = e.tags.tourism;
            const shop = e.tags.shop;
            const highway = e.tags.highway;
            const place = e.tags.place;

            let category = 'landmark';
            if (highway === 'fuel' || amenity === 'fuel') category = 'fuel';
            else if (tourism === 'hotel' || amenity === 'hotel') category = 'hotel';
            else if (amenity === 'hospital' || amenity === 'clinic') category = 'hospital';
            else if (amenity === 'bank' || amenity === 'atm') category = 'bank';
            else if (amenity === 'restaurant' || amenity === 'cafe' || amenity === 'fast_food') category = 'restaurant';
            else if (amenity === 'school' || amenity === 'college' || amenity === 'university') category = 'school';
            else if (amenity === 'place_of_worship' || e.tags.religion) category = 'place_of_worship';
            else if (shop) category = 'shop';
            else if (place) category = 'landmark';

            return {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [e.lon, e.lat]
              },
              properties: {
                id: e.id,
                name,
                category,
                type: amenity || tourism || shop || place || 'poi'
              }
            };
          });

        const geojson = {
          type: 'FeatureCollection',
          features
        };

        const source = this.map.getSource('osm-pois-source') as maplibregl.GeoJSONSource;
        if (source) {
          source.setData(geojson as any);
        }

        // Successfully loaded from endpoint, break loop
        break;
      } catch (err) {
        // Try next endpoint silently
      }
    }
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
