import React from 'react';
import Link from 'next/link';
import { LayoutDashboard, BookOpen, MapPin, MessageSquare, TrendingUp } from 'lucide-react';

const producerNav = [
  { href: '/producer', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/producer/catalog', label: 'Catalogue', icon: BookOpen },
  { href: '/producer/route', label: 'Tournée', icon: MapPin },
  { href: '/producer/messages', label: 'Messages', icon: MessageSquare },
  { href: '/producer/forecast', label: 'Prévisionnel', icon: TrendingUp },
];

export default function ProducerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-950 flex">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 m-3 w-56 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl flex-col z-40 hidden md:flex" style={{ height: 'calc(100vh - 1.5rem)' }}>
        <div className="px-4 py-4 border-b border-white/10">
          <Link href="/" className="flex items-center gap-2 font-bold text-neutral-50">
            <span className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-bold text-xs">LP</span>
            <span className="text-sm">Producteur</span>
          </Link>
        </div>
        <nav className="flex-1 py-3 overflow-y-auto">
          {producerNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 w-full px-3 py-2.5 mx-2 rounded-xl text-sm font-medium transition-all duration-200 text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
              style={{ width: 'calc(100% - 1rem)' }}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-white/10">
          <p className="text-[10px] text-neutral-600 uppercase tracking-widest">Espace producteur</p>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 flex items-center justify-around px-4 py-2 bg-neutral-950/90 backdrop-blur-xl border-t border-white/10">
        {producerNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-1 px-2 py-2 rounded-xl text-neutral-500 hover:text-neutral-200 transition-all duration-200"
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[9px] font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Main */}
      <main className="flex-1 md:ml-64 pb-20 md:pb-0 min-h-screen">
        {children}
      </main>
    </div>
  );
}
