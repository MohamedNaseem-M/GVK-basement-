import { Injectable, inject, signal, WritableSignal } from '@angular/core';
import * as maplibregl from 'maplibre-gl';
import {
  BASEMAP_STYLES,
  CAMERA_PRESETS,
  INITIAL_MAP_CONFIG,
  PROJECT_LOCATION
} from '../core/constants/map.constants';
import { CoordinateTransformService } from './coordinate-transform.service';
import { MasterPlanDataService } from './masterplan-data.service';
import { MasterPlanRoadService } from '../masterplan/services/masterplan-road.service';
import { MasterPlanPlotService } from '../masterplan/services/masterplan-plot.service';

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private readonly transformService = inject(CoordinateTransformService);
  private readonly masterPlanService = inject(MasterPlanDataService);
  public readonly masterPlanRoadService = inject(MasterPlanRoadService);
  public readonly masterPlanPlotService = inject(MasterPlanPlotService);
  private map: maplibregl.Map | null = null;
  private projectMarker: maplibregl.Marker | null = null;

  // Reactive state signals for public consumption
  public readonly isMapLoaded: WritableSignal<boolean> = signal(false);
  public readonly isMapReady: WritableSignal<boolean> = signal(false);
  public readonly isOverlayVisible: WritableSignal<boolean> = signal(true);
  public readonly hasMapError: WritableSignal<boolean> = signal(false);
  public readonly loadingMessage: WritableSignal<string> = signal('Initializing Satellite Engine...');
  public readonly loadingProgress: WritableSignal<number> = signal(20);
  public readonly currentZoom: WritableSignal<number> = signal(INITIAL_MAP_CONFIG.zoom);
  public readonly currentCenter: WritableSignal<{ lat: number; lng: number }> = signal(PROJECT_LOCATION);
  public readonly is3DMode: WritableSignal<boolean> = signal(true);
  public readonly currentPitch: WritableSignal<number> = signal(INITIAL_MAP_CONFIG.pitch);
  public readonly currentBearing: WritableSignal<number> = signal(INITIAL_MAP_CONFIG.bearing);

  private poiPopup: maplibregl.Popup | null = null;
  private poiFetchTimeout: any = null;
  private safetyTimeout: any = null;

  /**
   * Initializes MapLibre GL map instance inside target DOM element with 3D satellite basemap
   */
  public initializeMap(container: HTMLElement): maplibregl.Map {
    if (this.safetyTimeout) {
      clearTimeout(this.safetyTimeout);
      this.safetyTimeout = null;
    }

    if (this.map) {
      this.map.remove();
      this.map = null;
    }

    // Reset loading state for fresh page load / retry
    this.isMapLoaded.set(false);
    this.isMapReady.set(false);
    this.isOverlayVisible.set(true);
    this.hasMapError.set(false);
    this.loadingMessage.set('Initializing Satellite Engine...');
    this.loadingProgress.set(25);

    try {
      if ((maplibregl as any).config) {
        (maplibregl as any).config.WORKER_URL = 'https://unpkg.com/maplibre-gl@6.10.0/dist/maplibre-gl-worker.mjs';
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
        fadeDuration: 0,
        maxTileCacheSize: 2000,
        maxTileCacheZoomLevels: 10,
        cancelPendingTileRequestsWhileZooming: false
      } as any);

      this.map = mapInstance;
      (window as any)._map = mapInstance;
      (window as any)._mapService = this;

      // Track catastrophic map initialization errors
      mapInstance.on('error', (e: any) => {
        // Only trigger error fallback if style/tile loading completely failed before map load
        if (!this.isMapLoaded() && e?.error?.message && !e.error.message.includes('404')) {
          this.hasMapError.set(true);
        }
      });

      // Enable native MapLibre rotation & pitch controls
      mapInstance.dragRotate.enable();
      mapInstance.touchZoomRotate.enable();
      mapInstance.touchZoomRotate.enableRotation();
      mapInstance.touchPitch.enable();

      // Setup custom 3D drag-to-bearing pointer interaction (3D mode only)
      this.setup3DRotationDragHandlers(mapInstance);

      // Add standard touch-friendly navigation controls (bottom-right compass/pitch)
      mapInstance.addControl(
        new maplibregl.NavigationControl({
          showCompass: true,
          showZoom: false, // Custom touch controls provided in component UI
          visualizePitch: true
        }),
        'bottom-right'
      );

      let isReadyTriggered = false;
      const markMapAsReady = () => {
        if (isReadyTriggered) return;
        isReadyTriggered = true;

        if (this.safetyTimeout) {
          clearTimeout(this.safetyTimeout);
          this.safetyTimeout = null;
        }

        this.loadingMessage.set('Satellite Map Ready');
        this.loadingProgress.set(100);

        // Signal map ready for smooth CSS fade-out transition
        this.isMapReady.set(true);

        // Hide overlay DOM container after 650ms fade-out completes
        setTimeout(() => {
          this.isOverlayVisible.set(false);
        }, 650);
      };

      // Safety timeout guard: Ensures overlay never hangs forever if 1 low-priority background tile stalls
      this.safetyTimeout = setTimeout(() => {
        if (this.isMapLoaded()) {
          markMapAsReady();
        }
      }, 7000);

      // Listen for actual map idle & source load events
      mapInstance.once('idle', () => {
        markMapAsReady();
      });

      mapInstance.on('sourcedata', (e: any) => {
        if (e.sourceId === 'google-hybrid-satellite' && e.isSourceLoaded && this.isMapLoaded()) {
          markMapAsReady();
        }
      });

      // Track map load event and add project marker & POI layer
      mapInstance.on('load', () => {
        this.isMapLoaded.set(true);
        this.loadingMessage.set('Loading Viewport Tiles & Road Overlays...');
        this.loadingProgress.set(70);

        // Deep tile pyramid retention tuning for continuous raster coverage
        const style = (mapInstance as any).style;
        if (style && style.sourceCaches && style.sourceCaches['google-hybrid-satellite']) {
          const sc = style.sourceCaches['google-hybrid-satellite'];
          if (sc) {
            sc._maxFadingAncestorLevels = 10;
          }
        }

        this.registerPoiIcons(mapInstance);
        this.addProjectMarker();
        this.masterPlanRoadService.attachRoadLayersToMap(mapInstance);
        this.masterPlanPlotService.attachPlotLayersToMap(mapInstance);
        this.initDynamicPoiLayer();
        this.fetchDynamicPOIs();

        // Automatically frame the master plan 318-plot layout over real project site
        this.fitMasterPlanPlots();

        // If map tiles are already rendered at load time, mark ready
        if (mapInstance.areTilesLoaded()) {
          markMapAsReady();
        }
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
    } catch (err) {
      console.error('CRITICAL MAP INIT ERROR:', err);
      this.hasMapError.set(true);
      this.loadingMessage.set('Failed to initialize satellite map engine.');
      return null as any;
    }
  }

  /**
   * Generates and registers sharp vector SVG category badge icons into MapLibre GL
   */
  private registerPoiIcons(mapInstance: maplibregl.Map): void {
    const categories = [
      { name: 'hospital', color: '#ef4444', icon: 'M19 10.5h-5.5V5c0-.8-.7-1.5-1.5-1.5s-1.5.7-1.5 1.5v5.5H5c-.8 0-1.5.7-1.5 1.5s.7 1.5 1.5 1.5h5.5V19c0 .8.7 1.5 1.5 1.5s1.5-.7 1.5-1.5v-5.5H19c.8 0 1.5-.7 1.5-1.5s-.7-1.5-1.5-1.5z' },
      { name: 'hotel', color: '#8b5cf6', icon: 'M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z' },
      { name: 'fuel', color: '#f59e0b', icon: 'M19.77 7.23l.01-.01-3.72-3.72L15 4.56l2.11 2.11c-.94.36-1.61 1.26-1.61 2.33 0 1.38 1.12 2.5 2.5 2.5.36 0 .69-.08 1-.21v7.21c0 .55-.45 1-1 1s-1-.45-1-1V14c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v16h10v-7.5h1.5v5.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V9c0-.69-.28-1.32-.73-1.77z' },
      { name: 'restaurant', color: '#f97316', icon: 'M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v6h2.5v10H21V2c-2.76 0-5 2.24-5 4z' },
      { name: 'bank', color: '#10b981', icon: 'M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm14-12v7h3v-7h-3zm-4.5-9L2 6v2h19V6l-9.5-5z' },
      { name: 'shop', color: '#06b6d4', icon: 'M19 6h-2c0-2.21-1.79-4-4-4S9 3.79 9 6H7c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2zm0 10c-2.21 0-4-1.79-4-4h2c0 1.1.9 2 2 2s2-.9 2-2h2c0 2.21-1.79 4-4 4z' },
      { name: 'school', color: '#6366f1', icon: 'M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z' },
      { name: 'place_of_worship', color: '#a855f7', icon: 'M12 2L9 6h2v3H8v2h3v11h2V11h3V9h-3V6h2L12 2z' },
      { name: 'park', color: '#22c55e', icon: 'M14 6l-3.8-5L6.4 6H8l-4 6h3.6L4 18h16l-3.6-6H20l-4-6h1.6L14 6zM12 18v4h-2v-4h2z' },
      { name: 'landmark', color: '#64748b', icon: 'M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z' }
    ];

    categories.forEach(cat => {
      const size = 48;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Drop shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 3;

      // Background circle badge
      ctx.fillStyle = cat.color;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, 18, 0, Math.PI * 2);
      ctx.fill();

      // Reset shadow for stroke outline
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Draw vector SVG icon in center
      const p = new Path2D(cat.icon);
      ctx.save();
      ctx.translate(12, 12);
      ctx.fillStyle = '#ffffff';
      ctx.fill(p);
      ctx.restore();

      const imageData = ctx.getImageData(0, 0, size, size);
      if (!mapInstance.hasImage(`poi-${cat.name}`)) {
        mapInstance.addImage(`poi-${cat.name}`, {
          width: size,
          height: size,
          data: imageData.data
        }, { pixelRatio: 2 });
      }
    });
  }

  /**
   * Sets up smooth 360-degree pointer drag rotation handlers (active ONLY in 3D mode)
   */
  private setup3DRotationDragHandlers(mapInstance: maplibregl.Map): void {
    const canvas = mapInstance.getCanvas();
    const activePointers = new Map<number, { x: number; y: number }>();
    let isDragging3D = false;
    let startX = 0;
    let startY = 0;
    let startBearing = 0;
    let startPitch = 0;

    const stop3DDrag = (e: Event) => {
      const pe = e as PointerEvent;
      if (pe.pointerId !== undefined) {
        activePointers.delete(pe.pointerId);
      } else {
        activePointers.clear();
      }

      if (activePointers.size !== 1) {
        isDragging3D = false;
        try {
          if (pe.pointerId !== undefined && canvas.hasPointerCapture && canvas.hasPointerCapture(pe.pointerId)) {
            canvas.releasePointerCapture(pe.pointerId);
          }
        } catch (err) {}
        mapInstance.dragPan.enable();
      }
    };

    canvas.addEventListener('pointerdown', (e: PointerEvent) => {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // If multi-touch (2+ fingers), hand over to native MapLibre pinch-zoom & touchZoomRotate!
      if (activePointers.size > 1) {
        isDragging3D = false;
        mapInstance.dragPan.enable();
        try {
          if (canvas.hasPointerCapture && canvas.hasPointerCapture(e.pointerId)) {
            canvas.releasePointerCapture(e.pointerId);
          }
        } catch (err) {}
        return;
      }

      // Only capture single-pointer 3D drag rotation when in 3D mode (pitch > 15)
      if (!this.is3DMode() || (e.button !== 0 && e.pointerType === 'mouse')) {
        return;
      }

      // Do not hijack clicks on popup buttons or controls
      const target = e.target as HTMLElement;
      if (target && target.closest && target.closest('.maplibregl-popup, .touch-btn, .marker-container')) {
        return;
      }

      isDragging3D = true;
      startX = e.clientX;
      startY = e.clientY;
      startBearing = mapInstance.getBearing();
      startPitch = mapInstance.getPitch();

      // Disable dragPan ONLY during single-finger 3D rotation drag
      mapInstance.dragPan.disable();
    });

    canvas.addEventListener('pointermove', (e: PointerEvent) => {
      if (activePointers.has(e.pointerId)) {
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      // If more than 1 finger is active on screen, abort custom 3D rotation to allow native 2-finger pinch zoom
      if (!isDragging3D || !this.is3DMode() || activePointers.size > 1) {
        return;
      }

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      // Rotation sensitivity: degrees per pixel drag
      const bearingSensitivity = 0.45;
      const pitchSensitivity = 0.25;

      const newBearing = startBearing + (deltaX * bearingSensitivity);
      const newPitch = Math.max(15, Math.min(75, startPitch - (deltaY * pitchSensitivity)));

      mapInstance.jumpTo({
        bearing: newBearing,
        pitch: newPitch
      });
    });

    canvas.addEventListener('pointerup', stop3DDrag);
    canvas.addEventListener('pointercancel', stop3DDrag);
    canvas.addEventListener('mouseleave', stop3DDrag);
  }

  /**
   * Initializes dynamic vector POI source and custom SVG icon symbol layers in MapLibre GL
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

    // Layer 1: Colored Circle Badge Layer for POIs (visible zoom >= 8)
    if (!this.map.getLayer('osm-pois-circles')) {
      this.map.addLayer({
        id: 'osm-pois-circles',
        type: 'circle',
        source: 'osm-pois-source',
        minzoom: 8,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 4, 12, 7, 16, 12, 19, 15],
          'circle-color': [
            'match',
            ['get', 'category'],
            'hospital', '#ef4444',
            'hotel', '#8b5cf6',
            'fuel', '#f59e0b',
            'restaurant', '#f97316',
            'bank', '#10b981',
            'shop', '#06b6d4',
            'school', '#6366f1',
            'place_of_worship', '#a855f7',
            'park', '#22c55e',
            '#64748b'
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.95
        }
      });
    }

    // Layer 2: Vector Icon & Text Label Symbol Layer for real-world POIs (visible zoom >= 8)
    if (!this.map.getLayer('osm-pois-icons')) {
      this.map.addLayer({
        id: 'osm-pois-icons',
        type: 'symbol',
        source: 'osm-pois-source',
        minzoom: 8,
        layout: {
          'icon-image': [
            'match',
            ['get', 'category'],
            'hospital', 'poi-hospital',
            'hotel', 'poi-hotel',
            'fuel', 'poi-fuel',
            'restaurant', 'poi-restaurant',
            'bank', 'poi-bank',
            'shop', 'poi-shop',
            'school', 'poi-school',
            'place_of_worship', 'poi-place_of_worship',
            'park', 'poi-park',
            'poi-landmark'
          ],
          'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.45, 12, 0.65, 16, 0.95, 19, 1.1],
          'icon-allow-overlap': false,
          'icon-ignore-placement': false,
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 10, 10, 14, 11, 16, 13],
          'text-offset': [0, 1.4],
          'text-anchor': 'top',
          'text-optional': true,
          'text-max-width': 10
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#0f172a',
          'text-halo-width': 2.5
        }
      });
    }

    // Cursor pointer on hover over POIs
    const setPointer = () => { if (this.map) this.map.getCanvas().style.cursor = 'pointer'; };
    const resetPointer = () => { if (this.map) this.map.getCanvas().style.cursor = ''; };

    this.map.on('mouseenter', 'osm-pois-circles', setPointer);
    this.map.on('mouseleave', 'osm-pois-circles', resetPointer);
    this.map.on('mouseenter', 'osm-pois-icons', setPointer);
    this.map.on('mouseleave', 'osm-pois-icons', resetPointer);

    // Interactive popup on POI click/tap
    const onPoiClick = (e: any) => {
      if (!this.map || !e.features || !e.features[0]) return;

      const feature = e.features[0];
      const coords = feature.geometry.coordinates.slice() as [number, number];
      const props = feature.properties;

      if (this.poiPopup) {
        this.poiPopup.remove();
      }

      const categoryTitle = (props.category || 'POI').replace('_', ' ').toUpperCase();
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
    };

    this.map.on('click', 'osm-pois-circles', onPoiClick);
    this.map.on('click', 'osm-pois-icons', onPoiClick);
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

    if (zoom < 8) return;

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
      node["leisure"="park"](${south},${west},${north},${east});
      node["historic"](${south},${west},${north},${east});
    );out body 100;`;

    const endpoints = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://overpass.private.coffee/api/interpreter'
    ];

    for (const url of endpoints) {
      try {
        const response = await fetch(url + '?data=' + encodeURIComponent(query));

        if (!response.ok) continue;

        const data = await response.json();
        if (!data || !data.elements) continue;

        const dynamicFeatures = data.elements
          .filter((e: any) => e.tags && (e.tags.name || e.tags['name:en']))
          .map((e: any) => {
            const name = e.tags.name || e.tags['name:en'];
            const amenity = e.tags.amenity;
            const tourism = e.tags.tourism;
            const shop = e.tags.shop;
            const highway = e.tags.highway;
            const place = e.tags.place;
            const leisure = e.tags.leisure;

            let category = 'landmark';
            if (highway === 'fuel' || amenity === 'fuel') category = 'fuel';
            else if (tourism === 'hotel' || amenity === 'hotel' || tourism === 'resort' || tourism === 'guest_house') category = 'hotel';
            else if (amenity === 'hospital' || amenity === 'clinic' || amenity === 'doctors') category = 'hospital';
            else if (amenity === 'bank' || amenity === 'atm') category = 'bank';
            else if (amenity === 'restaurant' || amenity === 'cafe' || amenity === 'fast_food' || amenity === 'food_court') category = 'restaurant';
            else if (amenity === 'school' || amenity === 'college' || amenity === 'university' || amenity === 'kindergarten') category = 'school';
            else if (amenity === 'place_of_worship' || e.tags.religion) category = 'place_of_worship';
            else if (leisure === 'park' || leisure === 'garden') category = 'park';
            else if (shop) category = 'shop';

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
                type: amenity || tourism || shop || place || leisure || 'poi'
              }
            };
          });

        const geojson = {
          type: 'FeatureCollection',
          features: dynamicFeatures
        };

        const source = this.map.getSource('osm-pois-source') as maplibregl.GeoJSONSource;
        if (source) {
          source.setData(geojson as any);
        }

        break;
      } catch (err) {
        // Try next mirror
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
    this.map.dragPan.enable();
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
      center: [76.9008446, 15.1266426],
      pitch: CAMERA_PRESETS.view3D.pitch,
      bearing: CAMERA_PRESETS.view3D.bearing,
      zoom: CAMERA_PRESETS.view3D.zoom,
      duration: 1200
    });
  }

  /**
   * Smoothly flies camera back to exact master plan layout location
   */
  public flyToProjectLocation(): void {
    if (!this.map) return;
    const targetPitch = this.is3DMode() ? CAMERA_PRESETS.view3D.pitch : 0;
    const targetBearing = this.is3DMode() ? CAMERA_PRESETS.view3D.bearing : 0;
    const targetZoom = this.is3DMode() ? CAMERA_PRESETS.view3D.zoom : CAMERA_PRESETS.view2D.zoom;

    this.map.flyTo({
      center: [76.9008446, 15.1266426],
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

  /**
   * Fits map camera tightly to the Master Plan road network extent
   */
  public fitMasterPlanRoads(): void {
    if (!this.map || !this.isMapLoaded()) return;
    const [minLng, minLat, maxLng, maxLat] = this.masterPlanRoadService.getWgs84Bbox();

    this.map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat]
      ],
      {
        padding: 90,
        maxZoom: 19.5,
        duration: 1400,
        essential: true
      }
    );
  }

  /**
   * Alias for backward compatibility if invoked from external caller
   */
  public fitCadRoads(): void {
    this.fitMasterPlanRoads();
  }

  public fitMasterPlanPlots(): void {
    if (!this.map || !this.isMapLoaded()) return;
    const [minLng, minLat, maxLng, maxLat] = this.masterPlanPlotService.getWgs84Bbox();
    this.map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat]
      ],
      {
        padding: 80,
        maxZoom: 19.5,
        duration: 1400,
        essential: true
      }
    );
  }

  /**
   * Toggles between Google Satellite overlay and Master Plan Only neutral studio canvas
   */
  public toggleMasterPlanViewMode(): void {
    if (!this.map || !this.isMapLoaded()) return;
    const newMode = this.masterPlanRoadService.toggleViewMode();
    const isStudio = newMode === 'MASTER_PLAN_ONLY';

    if (this.map.getLayer('google-hybrid-satellite-layer')) {
      this.map.setLayoutProperty(
        'google-hybrid-satellite-layer',
        'visibility',
        isStudio ? 'none' : 'visible'
      );
    }

    // Toggle real-world POIs visibility so Studio Mode is dedicated master-plan geometry only
    if (this.map.getLayer('osm-pois-circles')) {
      this.map.setLayoutProperty('osm-pois-circles', 'visibility', isStudio ? 'none' : 'visible');
    }
    if (this.map.getLayer('osm-pois-icons')) {
      this.map.setLayoutProperty('osm-pois-icons', 'visibility', isStudio ? 'none' : 'visible');
    }

    // Toggle CAD road layers: visible in Studio mode, hidden in Satellite Overlay mode
    const roadLayerIds = [
      'masterplan-road-surface',
      'masterplan-road-curb',
      'masterplan-road-centerline',
      'masterplan-road-labels'
    ];
    roadLayerIds.forEach(id => {
      if (this.map?.getLayer(id)) {
        this.map.setLayoutProperty(id, 'visibility', isStudio ? 'visible' : 'none');
      }
    });

    // In Studio Canvas mode, hide the project marker pin so it does not block the road master plan
    if (this.projectMarker) {
      const markerEl = this.projectMarker.getElement();
      if (markerEl) {
        markerEl.style.display = isStudio ? 'none' : 'block';
      }
    }

    // Smoothly focus camera on the master plan layout
    this.fitMasterPlanPlots();
  }

  /**
   * Refreshes road layer rendering
   */
  public refreshMasterPlanRoads(): void {
    if (!this.map || !this.isMapLoaded()) return;
    this.masterPlanRoadService.refreshRoadLayers(this.map);
    this.masterPlanPlotService.refreshPlotLayers(this.map);
  }


  public destroyMap(): void {
    if (this.safetyTimeout) {
      clearTimeout(this.safetyTimeout);
      this.safetyTimeout = null;
    }
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
