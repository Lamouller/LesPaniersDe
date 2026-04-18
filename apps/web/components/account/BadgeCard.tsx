import React from 'react';
import { Award, Star, Trophy, Flame, Users, Sparkles, ShoppingBasket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';

export type BadgeCode =
  | 'first_basket'
  | 'ten_baskets'
  | 'fifty_baskets'
  | 'regular_3_months'
  | 'regular_6_months'
  | 'entity_founder'
  | 'multi_producer'
  | 'early_adopter';

export const BADGE_META: Record<
  BadgeCode,
  { title: string; description: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  first_basket: {
    title: 'Premier panier',
    description: '1re commande retirée',
    icon: ShoppingBasket,
    color: 'text-green-400',
  },
  ten_baskets: {
    title: 'Habitué',
    description: '10 commandes retirées',
    icon: Star,
    color: 'text-blue-400',
  },
  fifty_baskets: {
    title: 'Fidèle parmi les fidèles',
    description: '50 commandes retirées',
    icon: Trophy,
    color: 'text-amber-400',
  },
  regular_3_months: {
    title: 'Série de 3 mois',
    description: '12 semaines consécutives avec au moins 1 commande',
    icon: Flame,
    color: 'text-orange-400',
  },
  regular_6_months: {
    title: 'Série de 6 mois',
    description: '26 semaines consécutives — incroyable !',
    icon: Flame,
    color: 'text-red-400',
  },
  entity_founder: {
    title: 'Fondateur',
    description: 'Premier client à commander dans votre espace',
    icon: Award,
    color: 'text-purple-400',
  },
  multi_producer: {
    title: 'Multi-producteur',
    description: 'Commandé chez au moins 2 producteurs différents',
    icon: Users,
    color: 'text-cyan-400',
  },
  early_adopter: {
    title: 'Pionnier',
    description: 'Membre dans le premier mois de la plateforme',
    icon: Sparkles,
    color: 'text-pink-400',
  },
};

interface BadgeCardProps {
  code: BadgeCode;
  awardedAt?: string;
  unlocked: boolean;
}

export function BadgeCard({ code, awardedAt, unlocked }: BadgeCardProps) {
  const meta = BADGE_META[code];
  const Icon = meta.icon;

  if (!unlocked) {
    return (
      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex items-start gap-3 opacity-40">
        <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/[0.07] flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-neutral-600" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-neutral-500">{meta.title}</p>
          <p className="text-xs text-neutral-600 mt-0.5">{meta.description}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/[0.03] backdrop-blur-lg border border-white/[0.07] rounded-xl p-4 flex items-start gap-3 shadow-lg">
      <div className={cn('w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0')}>
        <Icon className={cn('w-4 h-4', meta.color)} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-neutral-100">{meta.title}</p>
        <p className="text-xs text-neutral-400 mt-0.5">{meta.description}</p>
        {awardedAt && (
          <p className="text-[10px] text-neutral-600 mt-1">Obtenu le {formatDate(awardedAt)}</p>
        )}
      </div>
    </div>
  );
}
