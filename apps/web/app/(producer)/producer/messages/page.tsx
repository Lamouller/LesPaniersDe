import React from 'react';
import { MessageSquare, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { redirect } from 'next/navigation';
import { getProducerContext } from '@/lib/auth/producer-context';
import { ViewAsBanner } from '@/components/admin/ViewAsBanner';

// Placeholder — Phase 2 : messagerie complète
const MESSAGES = [
  {
    id: '1',
    client: 'Marie Dupont',
    entity: 'Open Space du Centre',
    preview: 'Bonjour, est-ce que je peux changer mon panier cette semaine ?',
    time: 'Il y a 2h',
    unread: true,
  },
  {
    id: '2',
    client: 'Jean Martin',
    entity: 'Coworking Nord',
    preview: 'Merci pour le panier, les tomates étaient excellentes !',
    time: 'Hier',
    unread: false,
  },
];

export default async function ProducerMessagesPage() {
  const ctx = await getProducerContext();

  if (!ctx.producerId && ctx.role === 'admin') {
    redirect('/admin/producers');
  }
  if (!ctx.producerId) {
    redirect('/');
  }

  return (
    <>
      {ctx.isViewAs && <ViewAsBanner producerName={ctx.producerName} />}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <MessageSquare className="w-5 h-5 text-neutral-400" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-50">Messages</h1>
            <p className="text-sm text-neutral-500">{MESSAGES.filter((m) => m.unread).length} non lu(s)</p>
          </div>
        </div>

        <div className="space-y-3">
          {MESSAGES.map((msg) => (
            <Card
              key={msg.id}
              className={`cursor-pointer ${msg.unread ? 'border-white/20 bg-white/[0.07]' : ''}`}
            >
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold text-neutral-300 flex-shrink-0">
                      {msg.client[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-neutral-200">{msg.client}</p>
                        {msg.unread && (
                          <span className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </div>
                      <p className="text-xs text-neutral-600 mb-1">{msg.entity}</p>
                      <p className="text-sm text-neutral-400 truncate">{msg.preview}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 text-xs text-neutral-600">
                    <Clock className="w-3.5 h-3.5" />
                    {msg.time}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-neutral-600">Phase 2 — Interface de réponse complète à venir</p>
        </div>
      </div>
    </>
  );
}
