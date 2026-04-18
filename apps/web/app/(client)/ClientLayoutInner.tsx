'use client';

import React from 'react';
import Link from 'next/link';
import { ShoppingBasket, User, Truck, Settings, BarChart2, Users } from 'lucide-react';
import { UserMenu } from '@/components/layout/UserMenu';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

const clientNav = [
  { href: '/shop', label: 'Boutique', icon: ShoppingBasket },
  { href: '/account', label: 'Mon compte', icon: User },
  { href: '/account/deliveries', label: 'Mes retraits', icon: Truck },
  { href: '/account/stats', label: 'Stats', icon: BarChart2 },
  { href: '/account/community', label: 'Communauté', icon: Users },
  { href: '/account/preferences', label: 'Préférences', icon: Settings },
];

interface ClientLayoutInnerProps {
  children: React.ReactNode;
  email: string;
  role: string;
}

export default function ClientLayoutInner({ children, email, role }: ClientLayoutInnerProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 md:px-6 h-14 bg-background/80 backdrop-blur-xl border-b border-border">
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-foreground"
        >
          <span className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
            LP
          </span>
          <span className="hidden sm:inline text-sm">LesPaniersDe</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {clientNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200"
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <UserMenu email={email} role={role} />
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 flex items-center justify-around px-4 py-2 bg-background/90 backdrop-blur-xl border-t border-border">
        {clientNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-muted-foreground hover:text-primary transition-all duration-200"
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Main content */}
      <main className="pt-14 pb-20 md:pb-0 min-h-screen">{children}</main>
    </div>
  );
}
