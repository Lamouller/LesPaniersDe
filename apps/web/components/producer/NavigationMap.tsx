'use client';

import React, { useEffect, useRef } from 'react';
import type maplibregl from 'maplibre-gl';

export interface NavWaypoint {
  lat: number;
  lng: number;
  name: string;
  stop: number;
}

interface NavigationMapProps {
  polyline: [number, number][]; // [lat, lng] pairs (Leaflet convention → converted internally)
  waypoints: NavWaypoint[];
  currentPosition?: { lat: number; lng: number; bearing?: number };
  mode: 'preview' | 'navigation';
  onPositionUpdate?: (pos: GeolocationPosition) => void;
}

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

export function NavigationMap({
  polyline,
  waypoints,
  currentPosition,
  mode,
}: NavigationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const initializedRef = useRef(false);

  // Convert [lat, lng] → [lng, lat] for GeoJSON
  const toGeoCoords = (pairs: [number, number][]): [number, number][] =>
    pairs.map(([lat, lng]) => [lng, lat]);

  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return;
    initializedRef.current = true;

    let map: maplibregl.Map;

    void import('maplibre-gl').then((ml) => {
      if (!containerRef.current) return;

      const center: [number, number] =
        waypoints.length > 0
          ? [waypoints[0].lng, waypoints[0].lat]
          : [1.4442, 43.6047];

      map = new ml.Map({
        container: containerRef.current,
        style: MAP_STYLE,
        center,
        zoom: mode === 'navigation' ? 14 : 10,
        pitch: mode === 'navigation' ? 60 : 0,
        bearing: 0,
        maxZoom: 18,
        preserveDrawingBuffer: false,
      });

      mapRef.current = map;

      map.on('load', () => {
        // --- Route polyline layer ---
        if (polyline.length > 1) {
          map.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: toGeoCoords(polyline),
              },
              properties: {},
            },
          });

          map.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': '#16A34A',
              'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3, 16, 6],
              'line-opacity': 0.9,
            },
          });

          // Casing (border) for better visibility
          map.addLayer(
            {
              id: 'route-casing',
              type: 'line',
              source: 'route',
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: {
                'line-color': '#0f5123',
                'line-width': ['interpolate', ['linear'], ['zoom'], 10, 5, 16, 10],
                'line-opacity': 0.4,
              },
            },
            'route-line'
          );
        }

        // --- 3D Buildings ---
        const layers = map.getStyle().layers ?? [];
        let firstSymbolId: string | undefined;
        for (const layer of layers) {
          if (layer.type === 'symbol') {
            firstSymbolId = layer.id;
            break;
          }
        }

        if (map.getSource('openmaptiles') || map.getSource('composite')) {
          const buildingSource = map.getSource('openmaptiles') ? 'openmaptiles' : 'composite';
          try {
            map.addLayer(
              {
                id: '3d-buildings',
                source: buildingSource,
                'source-layer': 'building',
                filter: ['==', 'extrude', 'true'],
                type: 'fill-extrusion',
                minzoom: 13,
                paint: {
                  'fill-extrusion-color': '#aab3a0',
                  'fill-extrusion-height': ['get', 'height'],
                  'fill-extrusion-base': ['get', 'min_height'],
                  'fill-extrusion-opacity': 0.6,
                },
              },
              firstSymbolId
            );
          } catch {
            // buildings layer not available with this style — skip
          }
        }

        // --- Waypoint markers ---
        waypoints.forEach((wp) => {
          const el = document.createElement('div');
          el.className = 'nav-waypoint-marker';
          el.style.cssText = `
            width: 28px; height: 28px; border-radius: 50%;
            background: #16A34A; border: 2px solid white;
            display: flex; align-items: center; justify-content: center;
            color: white; font-size: 11px; font-weight: 700;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            cursor: default;
          `;
          el.textContent = String(wp.stop);

          new ml.Marker({ element: el })
            .setLngLat([wp.lng, wp.lat])
            .setPopup(new ml.Popup({ offset: 20 }).setHTML(`<strong>${wp.stop}. ${wp.name}</strong>`))
            .addTo(map);
        });

        // --- Current position marker (pulsing circle) ---
        const posEl = createPositionMarkerEl();
        markerRef.current = new ml.Marker({ element: posEl, rotationAlignment: 'map' })
          .setLngLat(center)
          .addTo(map);

        if (!currentPosition) {
          // Hide until we have a GPS fix
          posEl.style.display = 'none';
        }

        // Fit bounds to polyline
        if (polyline.length > 1 && mode === 'preview') {
          const coords = toGeoCoords(polyline);
          const bounds = coords.reduce(
            (b, c) => b.extend(c as [number, number]),
            new ml.LngLatBounds(coords[0], coords[0])
          );
          map.fitBounds(bounds, { padding: 60, duration: 500 });
        }
      });
    });

    return () => {
      if (map) {
        map.remove();
        mapRef.current = null;
        initializedRef.current = false;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update position marker and camera when currentPosition changes
  useEffect(() => {
    if (!mapRef.current || !currentPosition) return;

    void import('maplibre-gl').then(() => {
      if (!mapRef.current) return;
      const { lat, lng, bearing } = currentPosition;
      const lnglat: [number, number] = [lng, lat];

      if (markerRef.current) {
        const el = markerRef.current.getElement();
        el.style.display = 'block';
        markerRef.current.setLngLat(lnglat);
        if (bearing !== undefined) {
          markerRef.current.setRotation(bearing);
        }
      }

      if (mode === 'navigation') {
        mapRef.current.easeTo({
          center: lnglat,
          bearing: currentPosition.bearing ?? mapRef.current.getBearing(),
          pitch: 60,
          zoom: 15,
          duration: 800,
        });
      }
    });
  }, [currentPosition, mode]);

  return (
    <>
      <style>{`
        @import 'maplibre-gl/dist/maplibre-gl.css';
        .nav-position-marker {
          width: 20px;
          height: 20px;
          position: relative;
        }
        .nav-position-marker .dot {
          width: 16px;
          height: 16px;
          background: #2563eb;
          border: 3px solid white;
          border-radius: 50%;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          box-shadow: 0 0 0 2px rgba(37,99,235,0.4);
          z-index: 2;
        }
        .nav-position-marker .pulse {
          width: 36px;
          height: 36px;
          background: rgba(37,99,235,0.15);
          border-radius: 50%;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation: nav-pulse 2s ease-in-out infinite;
          z-index: 1;
        }
        @keyframes nav-pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.6; }
          50%       { transform: translate(-50%, -50%) scale(1.4); opacity: 0; }
        }
        .maplibregl-map {
          font-family: inherit;
        }
      `}</style>
      <div
        ref={containerRef}
        className="w-full h-full rounded-2xl overflow-hidden"
        style={{ minHeight: '300px' }}
      />
    </>
  );
}

function createPositionMarkerEl(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'nav-position-marker';

  const dot = document.createElement('div');
  dot.className = 'dot';

  const pulse = document.createElement('div');
  pulse.className = 'pulse';

  el.appendChild(pulse);
  el.appendChild(dot);
  return el;
}
