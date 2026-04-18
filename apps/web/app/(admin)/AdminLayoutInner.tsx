'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CreditCard, Users, Building2, Tractor, TrendingUp } from 'lucide-react';
import { UserMenu } from '@/components/layout/UserMenu';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

const adminNav = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/sales', label: 'Ventes & Pointage', icon: CreditCard },
  { href: '/admin/users', label: 'Clients', icon: Users },
  { href: '/admin/entities', label: 'Entités', icon: Building2 },
  { href: '/admin/producers', label: 'Producteurs', icon: Tractor },
  { href: '/admin/forecast', label: 'Prévisionnel', icon: TrendingUp, exact: false },
];

const APP_VERSION = '0.1.0';

interface AdminLayoutInnerProps {
  children: React.ReactNode;
  email: string;
  role: string;
}

export default function AdminLayoutInner({ children, email, role }: AdminLayoutInnerProps) {
  const pathname = usePathname();

  function isActive(item: (typeof adminNav)[0]) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside
        className="fixed inset-y-0 left-0 m-3 w-56 bg-background/80 dark:bg-muted/20 backdrop-blur-xl border border-border rounded-2xl shadow-sm flex flex-col z-40 hidden md:flex"
        style={{ height: 'calc(100vh - 1.5rem)' }}
      >
        <div className="px-4 py-4 border-b border-border flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs flex-shrink-0">
              LP
            </span>
            <span className="text-sm font-bold text-foreground">Admin</span>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <UserMenu email={email} role={role} />
          </div>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {adminNav.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 mx-2 mb-0.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                style={{ width: 'calc(100% - 1rem)' }}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-3 border-t border-border">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
            Administration
          </p>
          <p className="text-[10px] text-muted-foreground/50 mt-1">v{APP_VERSION}</p>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-40 md:hidden px-4 py-3 bg-background/90 backdrop-blur-xl border-b border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
            LP
          </span>
          <span className="text-sm font-semibold text-foreground">Admin</span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <UserMenu email={email} role={role} />
        </div>
      </div>

      {/* Main */}
      <main className="flex-1 md:ml-[15rem] min-h-screen pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
