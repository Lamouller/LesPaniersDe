'use client';

import React, { useState } from 'react';
import { Eye, ArrowLeft, Loader2 } from 'lucide-react';

interface ViewAsBannerProps {
  producerName: string | null;
}

export function ViewAsBanner({ producerName }: ViewAsBannerProps) {
  const [loading, setLoading] = useState(false);

  async function handleReturn() {
    setLoading(true);
    try {
      await fetch('/api/admin/view-as', { method: 'DELETE' });
    } finally {
      window.location.href = '/admin';
    }
  }

  return (
    <div className="sticky top-0 z-50 w-full px-4 py-2.5 flex items-center justify-between gap-3 bg-amber-500/10 border-b border-amber-500/30 backdrop-blur-md">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-6 h-6 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
          <Eye className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <span className="text-xs font-semibold text-amber-300 whitespace-nowrap">
            Mode observation
          </span>
          {producerName && (
            <>
              <span className="text-xs text-amber-500/70">·</span>
              <span className="text-xs font-medium text-amber-200 truncate">{producerName}</span>
            </>
          )}
          <span className="text-xs text-amber-500/70">·</span>
          <span className="text-xs text-amber-400/80 whitespace-nowrap">Lecture seule</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => { void handleReturn(); }}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-300 border border-amber-500/30 hover:bg-amber-500/10 hover:border-amber-500/50 transition-all duration-150 flex-shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <ArrowLeft className="w-3 h-3" />
        )}
        Revenir admin
      </button>
    </div>
  );
}
