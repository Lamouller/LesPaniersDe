import React from 'react';
import Link from 'next/link';
import { LayoutDashboard, CreditCard, Users, Building2, Tractor } from 'lucide-react';

const adminNav = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/sales', label: 'Paiements', icon: CreditCard },
  { href: '/admin/users', label: 'Utilisateurs', icon: Users },
  { href: '/admin/entities', label: 'Entités', icon: Building2 },
  { href: '/admin/producers', label: 'Producteurs', icon: Tractor },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-950 flex">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 m-3 w-56 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl flex flex-col z-40 hidden md:flex" style={{ height: 'calc(100vh - 1.5rem)' }}>
        <div className="px-4 py-4 border-b border-white/10">
          <Link href="/" className="flex items-center gap-2 font-bold text-neutral-50">
            <span className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-bold text-xs">LP</span>
            <span className="text-sm">Admin</span>
          </Link>
        </div>
        <nav className="flex-1 py-3 overflow-y-auto">
          {adminNav.map((item) => (
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
          <p className="text-[10px] text-neutral-600 uppercase tracking-widest">Administration</p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 md:ml-64 min-h-screen">
        {children}
      </main>
    </div>
  );
}
