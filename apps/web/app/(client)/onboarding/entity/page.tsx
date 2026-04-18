'use client';

import React, { useState, useEffect } from 'react';
import { Building2, Search, ArrowRight, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Entity } from '@/lib/types/database';

export default function OnboardingEntityPage() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Entity | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    supabase
      .from('entities')
      .select('id, name, address, city, postal_code')
      .order('name')
      .then(({ data }) => {
        if (data) setEntities(data as Entity[]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = entities.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.city.toLowerCase().includes(search.toLowerCase())
  );

  async function handleConfirm() {
    if (!selected) return;
    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError('Session expirée. Reconnectez-vous.');
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ entity_id: selected.id })
      .eq('id', user.id);

    setLoading(false);
    if (updateError) {
      setError(updateError.message);
    } else {
      window.location.href = '/shop';
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-white/5 border border-border items-center justify-center mb-4">
            <Building2 className="w-7 h-7 text-foreground/70" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
            Choisissez votre lieu de retrait
          </h1>
          <p className="text-sm text-muted-foreground">
            Sélectionnez l'entité où vous récupérez vos paniers chaque semaine.
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Rechercher par nom ou ville..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Entity list */}
        <div className="space-y-2 max-h-72 overflow-y-auto mb-6 pr-1">
          {filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground/60 py-8">Aucune entité trouvée</p>
          )}
          {filtered.map((entity) => (
            <button
              key={entity.id}
              type="button"
              onClick={() => setSelected(entity)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-200 ${
                selected?.id === entity.id
                  ? 'bg-white/10 border-white/30 text-foreground'
                  : 'bg-white/[0.03] border-border text-muted-foreground hover:bg-white/5 hover:text-foreground/80'
              }`}
            >
              <p className="text-sm font-medium">{entity.name}</p>
              <p className="text-xs mt-0.5 opacity-70">
                {entity.address} — {entity.postal_code} {entity.city}
              </p>
            </button>
          ))}
        </div>

        {error && (
          <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400 mb-4">
            {error}
          </div>
        )}

        <Button
          onClick={handleConfirm}
          disabled={!selected || loading}
          className="w-full gap-2"
          size="lg"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              Confirmer mon choix
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>

        {selected && (
          <p className="text-center text-xs text-muted-foreground/60 mt-3">
            Sélectionné : <span className="text-muted-foreground">{selected.name}</span>
          </p>
        )}
      </div>
    </div>
  );
}
