'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Menu, X, ShoppingBasket, User, Shield, Truck, Sun, Moon, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';

type UserRole = 'client' | 'producer' | 'admin' | null;

interface NavProps {
  role?: UserRole;
  locale?: string; // reserved for future use
  theme?: 'dark' | 'light';
  onThemeToggle?: () => void;
  onLocaleToggle?: () => void;
}

const roleLinks: Record<Exclude<UserRole, null>, Array<{ href: string; label: string; icon: React.ReactNode }>> = {
  client: [
    { href: '/shop', label: 'Boutique', icon: <ShoppingBasket className="w-4 h-4" /> },
    { href: '/account', label: 'Mon compte', icon: <User className="w-4 h-4" /> },
    { href: '/account/deliveries', label: 'Mes retraits', icon: <Truck className="w-4 h-4" /> },
  ],
  producer: [
    { href: '/producer', label: 'Tableau de bord', icon: <Truck className="w-4 h-4" /> },
    { href: '/producer/catalog', label: 'Catalogue', icon: <ShoppingBasket className="w-4 h-4" /> },
    { href: '/producer/route', label: 'Tournée', icon: <Truck className="w-4 h-4" /> },
  ],
  admin: [
    { href: '/admin', label: 'Dashboard', icon: <Shield className="w-4 h-4" /> },
    { href: '/admin/sales', label: 'Paiements', icon: <Shield className="w-4 h-4" /> },
    { href: '/admin/users', label: 'Utilisateurs', icon: <User className="w-4 h-4" /> },
  ],
};

export function Nav({ role, locale: _locale = 'fr', theme = 'dark', onThemeToggle, onLocaleToggle }: NavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const links = role ? roleLinks[role] : [];

  return (
    <header className="fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 md:px-6 h-14 bg-neutral-950/80 backdrop-blur-xl border-b border-white/10">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 text-neutral-50 font-bold text-lg tracking-tight">
        <span className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-bold text-xs">LP</span>
        <span className="hidden sm:inline">LesPaniersDe</span>
      </Link>

      {/* Desktop nav */}
      <nav className="hidden md:flex items-center gap-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-neutral-400 hover:bg-white/5 hover:text-neutral-200 transition-all duration-200"
          >
            {link.icon}
            {link.label}
          </Link>
        ))}
      </nav>

      {/* Controls */}
      <div className="flex items-center gap-2">
        {/* Locale toggle */}
        <button
          type="button"
          onClick={onLocaleToggle}
          className="p-2 rounded-xl text-neutral-400 hover:bg-white/5 hover:text-neutral-200 transition-all duration-200"
          aria-label="Changer de langue"
        >
          <Globe className="w-4 h-4" />
        </button>

        {/* Theme toggle */}
        <button
          type="button"
          onClick={onThemeToggle}
          className="p-2 rounded-xl text-neutral-400 hover:bg-white/5 hover:text-neutral-200 transition-all duration-200"
          aria-label="Changer de thème"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {!role && (
          <Link href="/login">
            <Button size="sm">Connexion</Button>
          </Link>
        )}

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 rounded-xl text-neutral-400 hover:bg-white/5 hover:text-neutral-200 transition-all duration-200"
          aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="absolute top-14 inset-x-0 bg-neutral-950/95 backdrop-blur-xl border-b border-white/10 p-4 flex flex-col gap-1 md:hidden animate-slide-up">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-neutral-400 hover:bg-white/5 hover:text-neutral-200 transition-all duration-200"
            >
              {link.icon}
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
