import React from 'react';
import { cn } from '@/lib/utils';

export interface LeaderboardRow {
  user_id: string;
  public_display_name: string;
  total_baskets: number;
  total_spent_cents: number;
  rank: number;
}

interface LeaderboardTableProps {
  rows: LeaderboardRow[];
  currentUserId?: string;
}

export function LeaderboardTable({ rows, currentUserId }: LeaderboardTableProps) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-neutral-500 text-center py-6">
        Aucun membre n&apos;a encore activé sa participation au classement.
      </p>
    );
  }

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10">
            <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider w-12">
              Rang
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">
              Pseudo
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-400 uppercase tracking-wider">
              Paniers
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((row) => {
            const isCurrentUser = row.user_id === currentUserId;
            return (
              <tr
                key={row.user_id}
                className={cn(
                  'transition-colors',
                  isCurrentUser
                    ? 'bg-white/[0.06] border border-white/20'
                    : 'hover:bg-white/[0.03]'
                )}
              >
                <td className="px-4 py-3 text-sm font-bold text-neutral-300">
                  {row.rank === 1 && <span className="text-amber-400">1</span>}
                  {row.rank === 2 && <span className="text-neutral-300">2</span>}
                  {row.rank === 3 && <span className="text-orange-500">3</span>}
                  {row.rank > 3 && <span className="text-neutral-500">{row.rank}</span>}
                </td>
                <td className="px-4 py-3 text-sm text-neutral-200">
                  {row.public_display_name}
                  {isCurrentUser && (
                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-neutral-400">
                      vous
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-neutral-200 text-right">
                  {row.total_baskets}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
