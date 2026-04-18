'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { format, startOfWeek, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { BookOpen, Plus, Trash2, ToggleLeft, ToggleRight, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface CatalogItem {
  id: string;
  name: string;
  price_cents: number;
  max_qty: number;
}

interface CatalogClientProps {
  readOnly: boolean;
}

export function CatalogClient({ readOnly }: CatalogClientProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [maxOrders, setMaxOrders] = useState(50);
  const [deadline, setDeadline] = useState('2025-04-17T20:00');

  const weekStart = useMemo(() => {
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
    return format(monday, "d MMMM yyyy", { locale: fr });
  }, []);

  const deliveryDate = useMemo(() => {
    const saturday = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 5);
    return format(saturday, "EEEE d MMMM yyyy", { locale: fr });
  }, []);
  const [items, setItems] = useState<CatalogItem[]>([
    { id: '1', name: 'Petit panier', price_cents: 1500, max_qty: 20 },
    { id: '2', name: 'Panier moyen', price_cents: 2500, max_qty: 20 },
    { id: '3', name: 'Grand panier', price_cents: 3500, max_qty: 10 },
    { id: '4', name: 'Option fruits', price_cents: 800, max_qty: 30 },
  ]);
  const [saved, setSaved] = useState(false);

  function removeItem(id: string) {
    if (readOnly) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function addItem() {
    if (readOnly) return;
    setItems((prev) => [
      ...prev,
      { id: Date.now().toString(), name: 'Nouveau produit', price_cents: 0, max_qty: 10 },
    ]);
  }

  function updateItem(id: string, field: keyof CatalogItem, value: string | number) {
    if (readOnly) return;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  }

  function handleSave() {
    if (readOnly) return;
    // TODO: UPSERT weekly_catalog + items to Supabase
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const disabledClass = readOnly ? 'opacity-60 cursor-not-allowed' : '';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <BookOpen className="w-5 h-5 text-muted-foreground mt-1 flex-shrink-0" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Catalogue de la semaine</h1>
            <p className="text-sm text-muted-foreground">Ouverture des commandes pour la semaine du {weekStart}</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">Livraison prévue le {deliveryDate}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <Link
            href="/producer/products"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground border border-border hover:bg-white/5 hover:text-foreground transition-colors"
          >
            <Package className="w-3.5 h-3.5" />
            Modifier mes produits permanents →
          </Link>
          <Badge variant={isOpen ? 'success' : 'default'}>{isOpen ? 'Ouvert' : 'Fermé'}</Badge>
        </div>
      </div>

      {/* Paramètres */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Paramètres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="deadline">Date limite de commande</Label>
              <input
                id="deadline"
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                disabled={readOnly}
                className={`w-full px-3 py-2.5 bg-white/5 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 ${disabledClass}`}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="max_orders">Maximum de commandes</Label>
              <Input
                id="max_orders"
                type="number"
                value={maxOrders}
                onChange={(e) => setMaxOrders(Number(e.target.value))}
                disabled={readOnly}
                min={1}
                className={readOnly ? 'opacity-60 cursor-not-allowed' : ''}
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <div>
              <p className="text-sm font-medium text-foreground/80">Commandes ouvertes</p>
              <p className="text-xs text-muted-foreground/60">Les clients peuvent commander</p>
            </div>
            <button
              type="button"
              onClick={() => { if (!readOnly) setIsOpen(!isOpen); }}
              disabled={readOnly}
              className={`p-1 text-muted-foreground hover:text-foreground transition-colors ${disabledClass}`}
              aria-label={isOpen ? 'Fermer les commandes' : 'Ouvrir les commandes'}
            >
              {isOpen ? (
                <ToggleRight className="w-8 h-8 text-green-400" />
              ) : (
                <ToggleLeft className="w-8 h-8" />
              )}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Articles */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Articles proposés</CardTitle>
            {!readOnly && (
              <Button type="button" size="sm" variant="secondary" onClick={addItem} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Ajouter
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Input
                    value={item.name}
                    onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                    placeholder="Nom du produit"
                    disabled={readOnly}
                    className={readOnly ? 'opacity-60 cursor-not-allowed' : ''}
                  />
                  <Input
                    type="number"
                    value={item.price_cents / 100}
                    onChange={(e) => updateItem(item.id, 'price_cents', Math.round(Number(e.target.value) * 100))}
                    placeholder="Prix €"
                    step={0.5}
                    min={0}
                    disabled={readOnly}
                    className={readOnly ? 'opacity-60 cursor-not-allowed' : ''}
                  />
                  <Input
                    type="number"
                    value={item.max_qty}
                    onChange={(e) => updateItem(item.id, 'max_qty', Number(e.target.value))}
                    placeholder="Max qté"
                    min={0}
                    disabled={readOnly}
                    className={readOnly ? 'opacity-60 cursor-not-allowed' : ''}
                  />
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="p-2 text-muted-foreground/60 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {!readOnly && (
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} type="button" size="lg">
            {saved ? 'Enregistré !' : 'Enregistrer le catalogue'}
          </Button>
          {saved && <p className="text-sm text-green-400">Catalogue mis à jour</p>}
        </div>
      )}
    </div>
  );
}
