'use client';

import React from 'react';
import Link from 'next/link';
import { LayoutDashboard, BookOpen, MapPin, MessageSquare, TrendingUp } from 'lucide-react';
import { UserMenu } from '@/components/layout/UserMenu';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

const producerNav = [
  { href: '/producer', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/producer/catalog', label: 'Catalogue', icon: BookOpen },
  { href: '/producer/route', label: 'Tournée', icon: MapPin },
  { href: '/producer/messages', label: 'Messages', icon: MessageSquare },
  { href: '/producer/forecast', label: 'Prévisionnel', icon: TrendingUp },
];

interface ProducerLayoutInnerProps {
  children: React.ReactNode;
  email: string;
  role: string;
}

export default function ProducerLayoutInner({ children, email, role }: ProducerLayoutInnerProps) {
  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside
        className="fixed inset-y-0 left-0 m-3 w-56 bg-background/80 dark:bg-muted/20 backdrop-blur-xl border border-border rounded-2xl shadow-sm flex-col z-40 hidden md:flex"
        style={{ height: 'calc(100vh - 1.5rem)' }}
      >
        <div className="px-4 py-4 border-b border-border flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-foreground">
            <span className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
              LP
            </span>
            <span className="text-sm">Producteur</span>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <UserMenu email={email} role={role} />
          </div>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {producerNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 w-full px-3 py-2.5 mx-2 rounded-xl text-sm font-medium transition-all duration-200 text-muted-foreground hover:bg-muted hover:text-foreground"
              style={{ width: 'calc(100% - 1rem)' }}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-border">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
            Espace producteur
          </p>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 flex items-center justify-around px-4 py-2 bg-background/90 backdrop-blur-xl border-t border-border">
        {producerNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-1 px-2 py-2 rounded-xl text-muted-foreground hover:text-primary transition-all duration-200"
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[9px] font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-40 md:hidden px-4 py-3 bg-background/90 backdrop-blur-xl border-b border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
            LP
          </span>
          <span className="text-sm font-semibold text-foreground">Producteur</span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <UserMenu email={email} role={role} />
        </div>
      </div>

      {/* Main */}
      <main className="flex-1 md:ml-64 pb-20 md:pb-0 pt-14 md:pt-0 min-h-screen">
        {children}
      </main>
    </div>
  );
}
