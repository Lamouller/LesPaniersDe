import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Users, ShoppingBasket, Calendar } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { ChallengeProgress } from '@/components/account/ChallengeProgress';
import { LeaderboardTable, type LeaderboardRow } from '@/components/account/LeaderboardTable';
import { StatCard } from '@/components/account/StatCard';

type ChallengeRow = {
  id: string;
  entity_id: string | null;
  title: string;
  description: string | null;
  metric: string;
  target_value: number;
  start_date: string;
  end_date: string;
  reward: string | null;
};

type CommunityProgressRow = {
  entity_id: string;
  current_week_orders: number;
  current_month_orders: number;
  total_all_time_orders: number;
  total_active_clients: number;
};

type LeaderboardDbRow = {
  entity_id: string;
  user_id: string;
  public_display_name: string;
  total_baskets: number;
  total_spent_cents: number;
  rank: number;
};

type ProfileRow = {
  entity_id: string;
  leaderboard_opt_in: boolean;
  entities: { name: string } | null;
};

export default async function CommunityPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Fetch profile with entity
  const { data: profileData } = await supabase
    .from('profiles')
    .select('entity_id, leaderboard_opt_in, entities(name)')
    .eq('id', user.id)
    .single();

  const profile = profileData as ProfileRow | null;
  if (!profile?.entity_id) redirect('/onboarding/entity');

  const entityId = profile.entity_id;
  const entityName = profile.entities?.name ?? 'votre espace';
  const isOptIn = profile.leaderboard_opt_in;
  const today = new Date().toISOString().slice(0, 10);

  // Parallel fetches
  const [
    { data: challengeRows },
    { data: progressRows },
    { data: leaderboardRows },
  ] = await Promise.all([
    supabase
      .from('community_challenges')
      .select('*')
      .or(`entity_id.eq.${entityId},entity_id.is.null`)
      .lte('start_date', today)
      .gte('end_date', today)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('v_entity_community_progress')
      .select('*')
      .eq('entity_id', entityId)
      .limit(1),
    supabase
      .from('v_entity_leaderboard')
      .select('*')
      .eq('entity_id', entityId)
      .order('rank', { ascending: true })
      .limit(10),
  ]);

  const challenge = (challengeRows?.[0] ?? null) as ChallengeRow | null;
  const progress = (progressRows?.[0] ?? null) as CommunityProgressRow | null;
  const leaderboard = (leaderboardRows ?? []) as LeaderboardDbRow[];

  // For challenge metric: compute current value from progress
  let challengeCurrentValue = 0;
  if (challenge && progress) {
    if (challenge.metric === 'total_baskets') {
      challengeCurrentValue = progress.total_all_time_orders;
    } else if (challenge.metric === 'total_clients') {
      challengeCurrentValue = progress.total_active_clients;
    }
  }

  // Check if current user is in leaderboard top 10
  const userInTop = leaderboard.some((r) => r.user_id === user.id);
  // Fetch user's own rank if opt-in and not in top 10
  let userOwnRow: LeaderboardDbRow | null = null;
  if (isOptIn && !userInTop) {
    const { data: ownRow } = await supabase
      .from('v_entity_leaderboard')
      .select('*')
      .eq('entity_id', entityId)
      .eq('user_id', user.id)
      .limit(1);
    userOwnRow = (ownRow?.[0] ?? null) as LeaderboardDbRow | null;
  }

  const leaderboardRows_typed: LeaderboardRow[] = leaderboard.map((r) => ({
    user_id: r.user_id,
    public_display_name: r.public_display_name,
    total_baskets: r.total_baskets,
    total_spent_cents: r.total_spent_cents,
    rank: r.rank,
  }));

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
          Communauté
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{entityName}</h1>
      </div>

      {/* Challenge actif */}
      {challenge && (
        <ChallengeProgress
          title={challenge.title}
          description={challenge.description}
          currentValue={challengeCurrentValue}
          targetValue={challenge.target_value}
          reward={challenge.reward}
          endDate={challenge.end_date}
        />
      )}

      {/* Progression collective */}
      {progress && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground/70">Progression collective</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatCard
              label="Cette semaine"
              value={String(progress.current_week_orders)}
              sublabel="paniers retirés"
              icon={<ShoppingBasket className="w-4 h-4 text-muted-foreground" />}
            />
            <StatCard
              label="Ce mois"
              value={String(progress.current_month_orders)}
              sublabel="paniers retirés"
              icon={<Calendar className="w-4 h-4 text-muted-foreground" />}
            />
            <StatCard
              label="Tout temps"
              value={String(progress.total_all_time_orders)}
              sublabel="paniers au total"
              icon={<Users className="w-4 h-4 text-muted-foreground" />}
              className="col-span-2 sm:col-span-1"
            />
          </div>
        </section>
      )}

      {/* Leaderboard */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground/70">Classement</h2>

        {!isOptIn && (
          <div className="flex items-start gap-3 px-4 py-3.5 bg-white/[0.03] border border-border rounded-xl">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Tu n&apos;apparais pas dans le classement.
              </p>
            </div>
            <Link
              href="/account/preferences"
              className="inline-flex items-center px-3 py-1.5 bg-white text-black text-xs font-medium rounded-lg shadow-lg shadow-white/10 hover:bg-neutral-200 active:scale-[0.98] transition-all duration-200 flex-shrink-0"
            >
              Activer ma participation
            </Link>
          </div>
        )}

        <LeaderboardTable rows={leaderboardRows_typed} currentUserId={user.id} />

        {/* Own rank if opt-in and outside top 10 */}
        {isOptIn && !userInTop && userOwnRow && (
          <div className="mt-2">
            <p className="text-xs text-muted-foreground mb-2 text-center">Votre position</p>
            <LeaderboardTable
              rows={[{
                user_id: userOwnRow.user_id,
                public_display_name: userOwnRow.public_display_name,
                total_baskets: userOwnRow.total_baskets,
                total_spent_cents: userOwnRow.total_spent_cents,
                rank: userOwnRow.rank,
              }]}
              currentUserId={user.id}
            />
          </div>
        )}
      </section>
    </div>
  );
}
