import { useEffect, useRef } from 'react';
import L from 'leaflet';

export interface MarkerLocation {
  id: string;
  title: string;
  subtitle?: string;
  lat: number;
  lng: number;
  type: 'driver' | 'station' | 'user';
  status?: string;
}

interface LiveMapProps {
  markers?: MarkerLocation[];
  center?: [number, number];
  zoom?: number;
  interactive?: boolean;
  onLocationSelect?: (lat: number, lng: number) => void;
  className?: string;
}

// Karawang coordinates default center
const DEFAULT_CENTER: [number, number] = [-6.3039, 107.3009];

export function LiveMap({
  markers = [],
  center = DEFAULT_CENTER,
  zoom = 13,
  interactive = true,
  onLocationSelect,
  className = 'h-72 w-full rounded-2xl overflow-hidden border border-surface-200 dark:border-surface-800 shadow-sm',
}: LiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize Leaflet map if not created yet
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center,
        zoom,
        zoomControl: interactive,
        dragging: interactive,
        scrollWheelZoom: interactive,
      });

      // Free OpenStreetMap Tile Layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      markerGroupRef.current = L.layerGroup().addTo(map);

      if (interactive && onLocationSelect) {
        map.on('click', (e: L.LeafletMouseEvent) => {
          onLocationSelect(e.latlng.lat, e.latlng.lng);
        });
      }

      mapInstanceRef.current = map;
    } else {
      mapInstanceRef.current.setView(center, zoom);
    }

    return () => {
      // Keep map reference clean
    };
  }, [center, zoom, interactive, onLocationSelect]);

  // Sync Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markerGroupRef.current) return;

    markerGroupRef.current.clearLayers();

    markers.forEach((m) => {
      let iconHtml = '';
      if (m.type === 'driver') {
        iconHtml = `
          <div class="relative flex items-center justify-center">
            <div class="absolute -inset-1 rounded-full bg-emerald-500/40 animate-ping"></div>
            <div class="w-10 h-10 rounded-full bg-emerald-600 border-2 border-white shadow-lg flex items-center justify-center text-white text-lg font-bold">
              🚌
            </div>
          </div>
        `;
      } else if (m.type === 'station') {
        iconHtml = `
          <div class="w-8 h-8 rounded-full bg-primary-600 border-2 border-white shadow-md flex items-center justify-center text-white text-xs font-bold">
            📍
          </div>
        `;
      } else {
        iconHtml = `
          <div class="w-8 h-8 rounded-full bg-amber-500 border-2 border-white shadow-md flex items-center justify-center text-white text-xs font-bold">
            👤
          </div>
        `;
      }

      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: iconHtml,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const leafletMarker = L.marker([m.lat, m.lng], { icon: customIcon });

      const popupContent = `
        <div style="font-family: sans-serif; padding: 4px;">
          <div style="font-weight: 700; font-size: 13px; color: #1e293b;">${m.title}</div>
          ${m.subtitle ? `<div style="font-size: 11px; color: #64748b;">${m.subtitle}</div>` : ''}
          ${m.status ? `<div style="display:inline-block; margin-top:4px; padding: 2px 6px; font-size: 10px; font-weight: 600; border-radius: 4px; background: #10b981; color: white;">${m.status}</div>` : ''}
        </div>
      `;

      leafletMarker.bindPopup(popupContent);
      markerGroupRef.current?.addLayer(leafletMarker);
    });
  }, [markers]);

  return <div ref={mapContainerRef} className={className} />;
}
