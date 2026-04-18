import React from 'react';
import Link from 'next/link';
import { ArrowRight, Github, Package, MapPin, CreditCard, Users, Building2, Tractor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Footer } from '@/components/layout/footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      {/* Nav simple */}
      <header className="fixed top-0 inset-x-0 z-40 flex items-center justify-between px-6 h-14 bg-neutral-950/80 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <span className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-bold text-xs">LP</span>
          <span>LesPaniersDe</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm">Connexion</Button>
          </Link>
          <Link href="/register">
            <Button size="sm">S&apos;inscrire</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center min-h-screen px-4 text-center overflow-hidden">
        {/* Glow background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/[0.02] blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-white/[0.04] blur-2xl" />
        </div>

        <div className="relative max-w-3xl mx-auto animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs text-neutral-400 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            Open source · Licence AGPL-3.0
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-neutral-50 leading-tight mb-6">
            LesPaniersDe
            <br />
            <span className="text-neutral-400">La plateforme qui connecte</span>
            <br />
            <span>producteurs et communautés</span>
          </h1>

          <p className="text-lg text-neutral-400 max-w-xl mx-auto mb-10 leading-relaxed">
            Commandez vos paniers de producteurs locaux et retirez-les directement dans votre
            open space, entreprise ou espace de coworking. Paiement en direct, zéro intermédiaire.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="gap-2.5">
                Commander mon panier
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/register?role=producer">
              <Button variant="secondary" size="lg">
                Je suis producteur
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">Simple</p>
            <h2 className="text-3xl font-bold tracking-tight text-neutral-50">Comment ça marche</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                icon: <Package className="w-6 h-6" />,
                title: 'Choisissez votre panier',
                desc: 'Chaque semaine, parcourez le catalogue du producteur et sélectionnez votre panier (petit, moyen, grand) et vos options.',
              },
              {
                step: '02',
                icon: <MapPin className="w-6 h-6" />,
                title: 'Retrait chez vous',
                desc: "Le producteur livre directement dans votre entreprise ou open space. Vous recevez une notification quand il arrive.",
              },
              {
                step: '03',
                icon: <CreditCard className="w-6 h-6" />,
                title: 'Payez en direct',
                desc: "Cash, CB, virement ou chèque — vous réglez directement le producteur. Aucun paiement en ligne, zéro commission.",
              },
            ].map((item) => (
              <Card key={item.step} className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-neutral-300">
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-600 mb-1">{item.step}</p>
                    <h3 className="text-base font-semibold text-neutral-50 mb-2">{item.title}</h3>
                    <p className="text-sm text-neutral-400 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pour qui */}
      <section className="py-24 px-4 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">Écosystème</p>
            <h2 className="text-3xl font-bold tracking-tight text-neutral-50">Pour qui ?</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: <Users className="w-6 h-6" />,
                title: 'Consommateurs',
                desc: 'Accédez à des produits locaux frais sans vous déplacer chez le producteur. Votre panier vous attend sur votre lieu de travail.',
                cta: 'Commander',
                href: '/register',
              },
              {
                icon: <Tractor className="w-6 h-6" />,
                title: 'Producteurs',
                desc: "Gérez votre tournée, votre catalogue hebdomadaire et vos clients. Notifications WhatsApp, suivi GPS live, facturation simplifiée.",
                cta: 'Rejoindre',
                href: '/register?role=producer',
              },
              {
                icon: <Building2 className="w-6 h-6" />,
                title: 'Entités',
                desc: "Open spaces, entreprises, coworking : devenez un point de retrait et offrez un service premium à vos collaborateurs.",
                cta: 'Devenir point relais',
                href: '/register?role=entity',
              },
            ].map((card) => (
              <div
                key={card.title}
                className="group cursor-pointer bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl p-6 transition-all duration-300 hover:bg-white/[0.07] hover:border-white/15 hover:shadow-2xl hover:-translate-y-0.5 active:scale-[0.99]"
              >
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-neutral-300 mb-4">
                  {card.icon}
                </div>
                <h3 className="text-lg font-semibold text-neutral-50 mb-2 group-hover:text-white transition-colors">
                  {card.title}
                </h3>
                <p className="text-sm text-neutral-400 leading-relaxed mb-6">{card.desc}</p>
                <Link href={card.href}>
                  <Button variant="secondary" size="sm" className="w-full">
                    {card.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open source */}
      <section className="py-24 px-4 border-t border-white/5">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-white/5 border border-white/10 items-center justify-center mb-6">
            <Github className="w-8 h-8 text-neutral-300" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-neutral-50 mb-4">
            100% open source
          </h2>
          <p className="text-neutral-400 leading-relaxed mb-8 max-w-xl mx-auto">
            LesPaniersDe est publié sous licence AGPL-3.0. Le code est ouvert, auditable et
            contributif. Hébergez votre propre instance ou contribuez à la plateforme commune.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://github.com/antislash-studio/lespaniersde"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="secondary" size="lg" className="gap-2">
                <Github className="w-4 h-4" />
                Voir sur GitHub
              </Button>
            </a>
            <a href="https://github.com/antislash-studio/lespaniersde/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="lg">Contribuer</Button>
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
