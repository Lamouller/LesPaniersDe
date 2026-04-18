'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { LogOut, Settings } from 'lucide-react';

interface UserMenuProps {
  email: string;
  role: string;
}

function getInitials(email: string): string {
  const local = email.split('@')[0] ?? '';
  const parts = local.split(/[._-]/);
  if (parts.length >= 2) {
    return (parts[0]![0] ?? '') + (parts[1]![0] ?? '');
  }
  return local.slice(0, 2).toUpperCase();
}

function roleBadge(role: string): string {
  const map: Record<string, string> = {
    admin: 'Administrateur',
    producer: 'Producteur',
    client: 'Client',
  };
  return map[role] ?? role;
}

async function handleLogout() {
  await fetch('/api/auth/logout', {
    method: 'POST',
    headers: { accept: 'application/json' },
  });
  window.location.href = '/';
}

export function UserMenu({ email, role }: UserMenuProps) {
  const initials = getInitials(email).toUpperCase();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Menu utilisateur"
          className="w-8 h-8 rounded-full bg-white dark:bg-white text-black flex items-center justify-center text-xs font-bold flex-shrink-0 hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          {initials}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="bottom"
          align="end"
          sideOffset={8}
          className="z-50 min-w-[200px] rounded-xl bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 shadow-2xl backdrop-blur-xl p-1 animate-scaleIn"
        >
          {/* User info — non-cliquable */}
          <div className="px-3 py-2.5">
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50 truncate">{email}</p>
            <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-widest bg-neutral-100 dark:bg-white/10 text-neutral-600 dark:text-neutral-400">
              {roleBadge(role)}
            </span>
          </div>

          <DropdownMenu.Separator className="my-1 h-px bg-black/8 dark:bg-white/10" />

          {role === 'client' && (
            <DropdownMenu.Item asChild>
              <a
                href="/account/preferences"
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-neutral-700 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/5 hover:text-neutral-900 dark:hover:text-neutral-50 outline-none cursor-pointer transition-colors"
              >
                <Settings className="w-4 h-4" />
                Mes préférences
              </a>
            </DropdownMenu.Item>
          )}

          <DropdownMenu.Item
            onSelect={() => { handleLogout(); }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 outline-none cursor-pointer transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Se déconnecter
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
