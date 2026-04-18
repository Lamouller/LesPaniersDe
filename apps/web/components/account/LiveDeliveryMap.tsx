'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Loader2, MapPin } from 'lucide-react';

interface LiveDeliveryMapProps {
  deliveryId: string;
  producerName: string;
  entityLat: number | null;
  entityLng: number | null;
}

interface TrackingPoint {
  lat: number;
  lng: number;
  bearing?: number | null;
}

// Haversine distance in km
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ETA estimate: assume 40 km/h average in urban/mixed context
function etaMinutes(distKm: number): number {
  return Math.round((distKm / 40) * 60);
}

export function LiveDeliveryMap({
  deliveryId,
  producerName,
  entityLat,
  entityLng,
}: LiveDeliveryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('maplibre-gl').Map | null>(null);
  const markerRef = useRef<import('maplibre-gl').Marker | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const initializedRef = useRef(false);

  const [latestPos, setLatestPos] = useState<TrackingPoint | null>(null);
  const [etaMin, setEtaMin] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize MapLibre
  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return;
    initializedRef.current = true;

    const defaultCenter: [number, number] = entityLng && entityLat
      ? [entityLng, entityLat]
      : [1.4442, 43.6047];

    void import('maplibre-gl').then((ml) => {
      if (!containerRef.current) return;

      const map = new ml.Map({
        container: containerRef.current,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: defaultCenter,
        zoom: 12,
        pitch: 0,
        maxZoom: 18,
        preserveDrawingBuffer: false,
      });
      mapRef.current = map;

      map.on('load', () => {
        // Entity marker (destination)
        if (entityLat && entityLng) {
          const destEl = document.createElement('div');
          destEl.style.cssText = `
            width: 24px; height: 24px; border-radius: 50%;
            background: #16A34A; border: 3px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          `;
          new ml.Marker({ element: destEl })
            .setLngLat([entityLng, entityLat])
            .setPopup(new ml.Popup({ offset: 16 }).setHTML('<strong>Votre entité</strong>'))
            .addTo(map);
        }

        // Producer position marker (pulsing blue)
        const posEl = createProducerMarkerEl();
        posEl.style.display = 'none';
        markerRef.current = new ml.Marker({ element: posEl, rotationAlignment: 'map' })
          .setLngLat(defaultCenter)
          .addTo(map);

        setLoading(false);
      });
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        initializedRef.current = false;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Supabase Realtime subscription
  useEffect(() => {
    const supabase = createClient();

    // Fetch last known position on mount
    void supabase
      .from('delivery_tracking_points')
      .select('lat, lng, bearing, recorded_at')
      .eq('delivery_id', deliveryId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const pt = data[0] as TrackingPoint & { recorded_at: string };
          updatePosition(pt);
        }
      });

    // Subscribe to new tracking points
    const channel = supabase
      .channel(`tracking-${deliveryId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'delivery_tracking_points',
          filter: `delivery_id=eq.${deliveryId}`,
        },
        (payload) => {
          const row = payload.new as { lat: number; lng: number; bearing?: number | null };
          updatePosition(row);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [deliveryId]); // eslint-disable-line react-hooks/exhaustive-deps

  function updatePosition(pt: TrackingPoint) {
    setLatestPos(pt);

    // Update ETA
    if (entityLat && entityLng) {
      const dist = haversineKm(pt.lat, pt.lng, entityLat, entityLng);
      setEtaMin(etaMinutes(dist));
    }

    // Update map marker
    void import('maplibre-gl').then(() => {
      if (!mapRef.current || !markerRef.current) return;
      const lnglat: [number, number] = [pt.lng, pt.lat];
      markerRef.current.setLngLat(lnglat);
      markerRef.current.getElement().style.display = 'block';
      if (pt.bearing !== null && pt.bearing !== undefined) {
        markerRef.current.setRotation(pt.bearing);
      }
      mapRef.current.easeTo({ center: lnglat, duration: 600 });
    });
  }

  const hasPosition = latestPos !== null;

  return (
    <div className="mt-4 space-y-3">
      {/* ETA banner */}
      {hasPosition && etaMin !== null && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-xl text-sm text-green-400">
          <MapPin className="w-4 h-4 shrink-0" />
          <span>
            <strong>{producerName}</strong> est à environ{' '}
            <strong>{etaMin} min</strong> de ton entité
          </span>
        </div>
      )}
      {!hasPosition && !loading && (
        <p className="text-xs text-muted-foreground px-1">
          En attente de la position GPS du producteur…
        </p>
      )}

      {/* Map */}
      <div className="relative rounded-xl overflow-hidden border border-white/10 h-52">
        {loading && (
          <div className="absolute inset-0 bg-muted/20 flex items-center justify-center z-10">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <style>{`
          @import 'maplibre-gl/dist/maplibre-gl.css';
          .producer-pulse {
            width: 20px; height: 20px; position: relative;
          }
          .producer-pulse .dot {
            width: 14px; height: 14px;
            background: #2563eb; border: 2px solid white;
            border-radius: 50%; position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            z-index: 2;
          }
          .producer-pulse .ring {
            width: 32px; height: 32px;
            background: rgba(37,99,235,0.15);
            border-radius: 50%; position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            animation: lpd-pulse 2s ease-in-out infinite;
            z-index: 1;
          }
          @keyframes lpd-pulse {
            0%, 100% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.6; }
            50%       { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
          }
        `}</style>
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  );
}

function createProducerMarkerEl(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'producer-pulse';
  const dot = document.createElement('div');
  dot.className = 'dot';
  const ring = document.createElement('div');
  ring.className = 'ring';
  el.appendChild(ring);
  el.appendChild(dot);
  return el;
}
