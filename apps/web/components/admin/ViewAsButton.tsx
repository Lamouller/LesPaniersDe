'use client';

import React, { useState } from 'react';
import { Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ViewAsButtonProps {
  producerId: string;
}

export function ViewAsButton({ producerId }: ViewAsButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/view-as', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ producer_id: producerId }),
      });
      if (res.ok) {
        window.location.href = '/producer';
      } else {
        console.error('view-as failed', res.status);
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      onClick={() => { void handleClick(); }}
      disabled={loading}
      className="gap-1.5"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Eye className="w-3.5 h-3.5" />
      )}
      Voir comme
    </Button>
  );
}
