'use client';

import React, { useState, useEffect } from 'react';
import { Bell, MessageCircle, Mail, Smartphone, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';

export default function PreferencesPage() {
  const [allergies, setAllergies] = useState('');
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifWhatsapp, setNotifWhatsapp] = useState(false);
  const [notifPush, setNotifPush] = useState(false);

  // Community
  const [leaderboardOptIn, setLeaderboardOptIn] = useState(false);
  const [publicDisplayName, setPublicDisplayName] = useState('');

  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load current profile values on mount
  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('dietary_preferences, notification_channels, leaderboard_opt_in, public_display_name')
        .eq('id', user.id)
        .single();

      if (data) {
        const diet = data.dietary_preferences as Record<string, unknown>;
        if (typeof diet?.allergies === 'string') setAllergies(diet.allergies as string);
        const notif = data.notification_channels as Record<string, boolean> | null;
        if (notif) {
          setNotifEmail(notif.email ?? true);
          setNotifWhatsapp(notif.whatsapp ?? false);
          setNotifPush(notif.push ?? false);
        }
        setLeaderboardOptIn(data.leaderboard_opt_in ?? false);
        setPublicDisplayName(data.public_display_name ?? '');
      }
    }
    loadProfile();
  }, []);

  async function handleSave() {
    setLoading(true);
    try {
      const res = await fetch('/api/profile/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dietary_preferences: { allergies },
          notification_channels: { email: notifEmail, whatsapp: notifWhatsapp, push: notifPush },
          leaderboard_opt_in: leaderboardOptIn,
          public_display_name: leaderboardOptIn ? publicDisplayName || null : null,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Compte</p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Préférences</h1>
      </div>

      {/* Allergies */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Allergies alimentaires</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="allergies" className="block mb-2">
            Indiquez vos allergies (optionnel)
          </Label>
          <textarea
            id="allergies"
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
            placeholder="Ex: gluten, lactose, arachides..."
            className="w-full px-3 py-2.5 bg-white/5 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground transition-all duration-200 focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 hover:border-white/20 resize-none min-h-[80px]"
          />
          <p className="text-xs text-muted-foreground/60 mt-1.5">
            Ces informations sont partagées avec le producteur pour adapter votre commande.
          </p>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="w-4 h-4 text-muted-foreground" />
            Canaux de notification
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { id: 'email', label: 'E-mail', sublabel: 'Confirmation de commande, rappels', icon: Mail, value: notifEmail, setter: setNotifEmail },
              { id: 'whatsapp', label: 'WhatsApp', sublabel: 'Notification de livraison imminente (si actif)', icon: MessageCircle, value: notifWhatsapp, setter: setNotifWhatsapp },
              { id: 'push', label: 'Notifications push', sublabel: 'Alertes navigateur sur cet appareil', icon: Smartphone, value: notifPush, setter: setNotifPush },
            ].map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-border flex items-center justify-center">
                    <item.icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground/80">{item.label}</p>
                    <p className="text-xs text-muted-foreground/60">{item.sublabel}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => item.setter(!item.value)}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white/20 ${
                    item.value ? 'bg-white' : 'bg-white/10'
                  }`}
                  aria-checked={item.value}
                  role="switch"
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform duration-200 ${
                      item.value ? 'bg-black translate-x-5' : 'bg-neutral-400 translate-x-0'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Communauté / Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4 text-muted-foreground" />
            Communauté
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Toggle opt-in */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground/80">Participer au classement</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5 leading-relaxed">
                Votre pseudo sera visible dans le classement de votre espace. Vous pouvez vous
                désinscrire à tout moment (consentement RGPD).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLeaderboardOptIn(!leaderboardOptIn)}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white/20 flex-shrink-0 ${
                leaderboardOptIn ? 'bg-white' : 'bg-white/10'
              }`}
              aria-checked={leaderboardOptIn}
              role="switch"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform duration-200 ${
                  leaderboardOptIn ? 'bg-black translate-x-5' : 'bg-neutral-400 translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Public display name (visible only when opt-in) */}
          {leaderboardOptIn && (
            <div className="space-y-1.5">
              <label htmlFor="public_display_name" className="text-sm font-medium text-foreground/70 block">
                Pseudo public
              </label>
              <input
                id="public_display_name"
                type="text"
                value={publicDisplayName}
                onChange={(e) => setPublicDisplayName(e.target.value)}
                placeholder="Ex: Alice veggie"
                maxLength={40}
                className="w-full px-3 py-2.5 bg-white/5 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground transition-all duration-200 focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 hover:border-white/20"
              />
              <p className="text-xs text-muted-foreground">
                Ce pseudo remplace votre nom dans le classement.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button onClick={handleSave} type="button" disabled={loading}>
          {loading ? 'Enregistrement...' : saved ? 'Enregistré !' : 'Enregistrer'}
        </Button>
        {saved && <p className="text-sm text-green-400">Préférences mises à jour</p>}
      </div>
    </div>
  );
}
