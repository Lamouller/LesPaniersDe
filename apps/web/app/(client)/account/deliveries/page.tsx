'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Truck, MapPin, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

// LiveDeliveryMap — MapLibre GL, no SSR
const LiveDeliveryMap = dynamic(
  () => import('@/components/account/LiveDeliveryMap').then((m) => m.LiveDeliveryMap),
  {
    ssr: false,
    loading: () => (
      <div className="mt-4 rounded-xl border border-border bg-white/[0.02] h-52 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

interface DeliveryRow {
  id: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'canceled';
  started_at: string | null;
  completed_at: string | null;
  weekly_catalog_id: string;
}

interface CatalogInfo {
  id: string;
  week_start: string;
  producer_name: string | null;
  producer_id: string | null;
}

interface DeliveryItem {
  delivery_id: string;
  status: 'scheduled' | 'in_progress' | 'completed';
  week_start: string;
  producer_name: string;
  entity_lat: number | null;
  entity_lng: number | null;
}

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([]);
  const [entityLat, setEntityLat] = useState<number | null>(null);
  const [entityLng, setEntityLng] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Get user's profile (entity_id)
      const { data: profile } = await supabase
        .from('profiles')
        .select('entity_id')
        .eq('id', user.id)
        .single();

      const entityId = profile?.entity_id as string | null;

      // Get entity coordinates
      if (entityId) {
        const { data: entity } = await supabase
          .from('entities')
          .select('pickup_lat, pickup_lng')
          .eq('id', entityId)
          .single();
        setEntityLat((entity as { pickup_lat: number | null } | null)?.pickup_lat ?? null);
        setEntityLng((entity as { pickup_lng: number | null } | null)?.pickup_lng ?? null);
      }

      // Get orders for this user
      const { data: orders } = await supabase
        .from('orders')
        .select('weekly_catalog_id, producer_id')
        .eq('client_id', user.id)
        .neq('status', 'canceled')
        .order('placed_at', { ascending: false });

      if (!orders || orders.length === 0) { setLoading(false); return; }

      const catalogIds = [...new Set((orders as { weekly_catalog_id: string }[]).map((o) => o.weekly_catalog_id))];

      // Get weekly catalogs info
      const { data: catalogs } = await supabase
        .from('weekly_catalogs')
        .select('id, week_start, producer_id')
        .in('id', catalogIds)
        .order('week_start', { ascending: false })
        .limit(10);

      if (!catalogs || catalogs.length === 0) { setLoading(false); return; }

      // Get producer names
      const producerIds = [...new Set((catalogs as { producer_id: string }[]).map((c) => c.producer_id))];
      const { data: producers } = await supabase
        .from('producers')
        .select('id, name')
        .in('id', producerIds);

      const producerMap = new Map<string, string>(
        (producers ?? []).map((p: { id: string; name: string }) => [p.id, p.name])
      );

      // Get deliveries for these catalogs
      const { data: deliveryRows } = await supabase
        .from('deliveries')
        .select('id, status, started_at, completed_at, weekly_catalog_id')
        .in('weekly_catalog_id', catalogIds)
        .neq('status', 'canceled');

      const deliveryByCatalog = new Map<string, DeliveryRow>(
        (deliveryRows ?? []).map((d: DeliveryRow) => [d.weekly_catalog_id, d])
      );

      const items: DeliveryItem[] = (catalogs as CatalogInfo[]).map((cat) => {
        const delivery = deliveryByCatalog.get(cat.id);
        return {
          delivery_id: delivery?.id ?? '',
          status: (delivery?.status ?? 'scheduled') as DeliveryItem['status'],
          week_start: cat.week_start,
          producer_name: producerMap.get(cat.producer_id ?? '') ?? 'Producteur',
          entity_lat: entityLat,
          entity_lng: entityLng,
        };
      });

      setDeliveries(items);
      setLoading(false);
    }

    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update entity coords in items once loaded
  const itemsWithCoords = deliveries.map((d) => ({
    ...d,
    entity_lat: entityLat,
    entity_lng: entityLng,
  }));

  const inProgress = itemsWithCoords.find((d) => d.status === 'in_progress');
  const upcoming = itemsWithCoords.filter((d) => d.status === 'scheduled');
  const completed = itemsWithCoords.filter((d) => d.status === 'completed');

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 flex items-center justify-center min-h-48">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Retraits</p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Mes livraisons</h1>
      </div>

      {/* En cours */}
      {inProgress && (
        <Card className="border-green-500/20 bg-green-500/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-green-300">
                <Truck className="w-4 h-4 animate-pulse" />
                Livraison en cours
              </CardTitle>
              <Badge variant="success">En route</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground/70 mb-1">{inProgress.producer_name}</p>
            <p className="text-xs text-muted-foreground">
              Semaine du {formatDate(inProgress.week_start)}
            </p>

            {inProgress.delivery_id ? (
              <LiveDeliveryMap
                deliveryId={inProgress.delivery_id}
                producerName={inProgress.producer_name}
                entityLat={inProgress.entity_lat}
                entityLng={inProgress.entity_lng}
              />
            ) : (
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-4 h-4" />
                Position GPS non encore disponible
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* A venir */}
      {upcoming.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">À venir</h2>
          <div className="space-y-3">
            {upcoming.map((d, idx) => (
              <Card key={d.delivery_id || idx}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground/80">{d.producer_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Semaine du {formatDate(d.week_start)}
                      </p>
                    </div>
                    <Badge variant="default">Planifié</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Terminés */}
      {completed.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">Historique</h2>
          <div className="space-y-3">
            {completed.map((d, idx) => (
              <Card key={d.delivery_id || idx} className="opacity-70">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground/70">{d.producer_name}</p>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">
                        Semaine du {formatDate(d.week_start)}
                      </p>
                    </div>
                    <Badge variant="success">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Livré
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Vide */}
      {!loading && deliveries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <MapPin className="w-10 h-10 opacity-30" />
          <p className="text-sm">Aucune livraison à afficher.</p>
          <p className="text-xs text-center max-w-xs opacity-70">
            Vos livraisons apparaîtront ici une fois que vous aurez passé une commande.
          </p>
        </div>
      )}
    </div>
  );
}
