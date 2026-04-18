import React from 'react';
import Link from 'next/link';
import { ArrowRight, Github, Package, MapPin, CreditCard, Users, Building2, Tractor, Leaf } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Footer } from '@/components/layout/footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav simple */}
      <header className="fixed top-0 inset-x-0 z-40 flex items-center justify-between px-6 h-14 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <span className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">LP</span>
          <span className="text-foreground">LesPaniersDe</span>
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
        {/* Dégradé fond organique */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.06] blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-accent/[0.08] blur-2xl" />
          {/* Feuillage SVG décoratif */}
          <svg
            className="absolute top-16 right-8 opacity-[0.07] text-primary w-48 h-48"
            viewBox="0 0 200 200"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M100 10 C60 10, 10 60, 10 100 C10 160, 60 190, 100 190 C140 190, 190 160, 190 100 C190 60, 140 10, 100 10Z M100 30 C130 30, 170 60, 170 100 C170 150, 130 170, 100 170 C70 170, 30 150, 30 100 C30 60, 70 30, 100 30Z" />
            <path d="M60 60 Q100 20 140 60 Q180 100 140 140 Q100 180 60 140 Q20 100 60 60Z" />
            <path d="M95 40 L95 160 M70 70 L95 95 M120 70 L95 95 M70 130 L95 110 M120 130 L95 110" stroke="currentColor" strokeWidth="3" fill="none" />
          </svg>
          <svg
            className="absolute bottom-24 left-6 opacity-[0.05] text-accent w-32 h-32"
            viewBox="0 0 100 100"
            fill="currentColor"
            aria-hidden="true"
          >
            <circle cx="50" cy="30" r="20" />
            <circle cx="30" cy="60" r="15" />
            <circle cx="70" cy="60" r="15" />
            <circle cx="50" cy="80" r="18" />
          </svg>
        </div>

        <div className="relative max-w-3xl mx-auto animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-accent/10 border border-accent/20 rounded-full text-xs text-accent-foreground mb-8">
            <Leaf className="w-3 h-3 text-primary" />
            <span className="text-primary font-medium">Open source · Licence AGPL-3.0</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground leading-tight mb-6">
            LesPaniersDe
            <br />
            <span className="text-muted-foreground">La plateforme qui connecte</span>
            <br />
            <span className="text-primary">producteurs et communautés</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed">
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
      <section className="py-24 px-4 bg-muted/40">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Simple</p>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Comment ça marche</h2>
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
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">{item.step}</p>
                    <h3 className="text-base font-semibold text-foreground mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pour qui */}
      <section className="py-24 px-4 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Écosystème</p>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Pour qui ?</h2>
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
                className="group cursor-pointer bg-background/50 backdrop-blur-xl border border-border rounded-2xl shadow-sm p-6 transition-all duration-300 hover:bg-muted/60 hover:border-primary/20 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4">
                  {card.icon}
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                  {card.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">{card.desc}</p>
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
      <section className="py-24 px-4 border-t border-border bg-muted/30">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 items-center justify-center mb-6">
            <Github className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground mb-4">
            100% open source
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-8 max-w-xl mx-auto">
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
