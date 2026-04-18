import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ShoppingBasket, TrendingUp, Leaf, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatCents } from '@/lib/utils';
import { StatCard } from '@/components/account/StatCard';
import { BadgeCard, BADGE_META, type BadgeCode } from '@/components/account/BadgeCard';

type UserStatsRow = {
  user_id: string;
  total_baskets: number;
  total_spent_cents: number;
  estimated_savings_cents: number;
  first_order_at: string | null;
  last_order_at: string | null;
  favorite_producer_name: string | null;
  favorite_producer_order_count: number | null;
};

type UserBadgeRow = {
  badge_code: string;
  awarded_at: string;
};

export default async function StatsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: statsRows }, { data: badgeRows }] = await Promise.all([
    supabase
      .from('v_user_stats')
      .select('*')
      .eq('user_id', user.id)
      .limit(1),
    supabase
      .from('user_badges')
      .select('badge_code, awarded_at')
      .eq('user_id', user.id)
      .order('awarded_at', { ascending: true }),
  ]);

  const stats = (statsRows?.[0] ?? null) as UserStatsRow | null;
  const earnedBadges = (badgeRows ?? []) as UserBadgeRow[];
  const earnedCodes = new Set(earnedBadges.map((b) => b.badge_code));

  const allBadgeCodes = Object.keys(BADGE_META) as BadgeCode[];
  const unlockedBadges = allBadgeCodes.filter((c) => earnedCodes.has(c));
  const lockedBadges = allBadgeCodes.filter((c) => !earnedCodes.has(c));

  // Determine first order label
  const sinceLabel = stats?.first_order_at
    ? `depuis ${new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(stats.first_order_at))}`
    : null;

  const totalBaskets = stats?.total_baskets ?? 0;
  const totalSpent = stats?.total_spent_cents ?? 0;
  const savings = stats?.estimated_savings_cents ?? 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
          Mon compte
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Tes stats</h1>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="Paniers commandés"
          value={String(totalBaskets)}
          sublabel={sinceLabel ?? 'Aucune commande pour l\'instant'}
          icon={<ShoppingBasket className="w-4 h-4 text-muted-foreground" />}
          className="col-span-2 sm:col-span-1"
        />
        <StatCard
          label="Total dépensé"
          value={formatCents(totalSpent)}
          sublabel="En paniers retirés"
          icon={<TrendingUp className="w-4 h-4 text-muted-foreground" />}
        />
        <StatCard
          label="Économies estimées"
          value={formatCents(savings)}
          sublabel="vs supermarché (estimation ~15 %)"
          icon={<Leaf className="w-4 h-4 text-green-400" />}
          accent="green"
        />
        {stats?.favorite_producer_name && (
          <StatCard
            label="Producteur préféré"
            value={stats.favorite_producer_name}
            sublabel={`${stats.favorite_producer_order_count ?? 0} commande${(stats.favorite_producer_order_count ?? 0) > 1 ? 's' : ''}`}
            className="col-span-2"
          />
        )}
      </div>

      {/* Badges obtenus */}
      {unlockedBadges.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground/70">Mes badges</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {unlockedBadges.map((code) => {
              const badge = earnedBadges.find((b) => b.badge_code === code);
              return (
                <BadgeCard
                  key={code}
                  code={code}
                  awardedAt={badge?.awarded_at}
                  unlocked
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Badges à débloquer */}
      {lockedBadges.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-muted-foreground">À débloquer</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {lockedBadges.map((code) => (
              <BadgeCard key={code} code={code} unlocked={false} />
            ))}
          </div>
        </section>
      )}

      {/* Link to community */}
      <Link
        href="/account/community"
        className="flex items-center justify-between px-4 py-3.5 bg-white/[0.03] border border-border rounded-xl hover:bg-white/[0.06] hover:border-border/70 transition-all duration-200 group"
      >
        <span className="text-sm font-medium text-foreground/70 group-hover:text-foreground transition-colors">
          Voir la communauté
        </span>
        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground/70 transition-colors" />
      </Link>
    </div>
  );
}
