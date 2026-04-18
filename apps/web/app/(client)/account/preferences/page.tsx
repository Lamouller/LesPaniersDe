'use client';

import React, { useState } from 'react';
import { Bell, MessageCircle, Mail, Smartphone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export default function PreferencesPage() {
  const [allergies, setAllergies] = useState('');
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifWhatsapp, setNotifWhatsapp] = useState(false);
  const [notifPush, setNotifPush] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    // TODO: save to Supabase profiles table
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-1">Compte</p>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-50">Préférences</h1>
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
            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-neutral-50 placeholder:text-neutral-600 transition-all duration-200 focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 hover:border-white/20 resize-none min-h-[80px]"
          />
          <p className="text-xs text-neutral-600 mt-1.5">
            Ces informations sont partagées avec le producteur pour adapter votre commande.
          </p>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="w-4 h-4 text-neutral-400" />
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
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                    <item.icon className="w-4 h-4 text-neutral-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-200">{item.label}</p>
                    <p className="text-xs text-neutral-600">{item.sublabel}</p>
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

      <div className="flex items-center justify-between">
        <Button onClick={handleSave} type="button">
          {saved ? 'Enregistré !' : 'Enregistrer'}
        </Button>
        {saved && <p className="text-sm text-green-400">Préférences mises à jour</p>}
      </div>
    </div>
  );
}
