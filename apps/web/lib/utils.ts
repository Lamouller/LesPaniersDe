import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatCents(cents: number, locale: string = 'fr-FR'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

/** "2.50" ou "2,50" → 250 */
export function euroToCents(euro: string | number): number {
  const normalized = String(euro).replace(',', '.').trim();
  const parsed = parseFloat(normalized);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

/** 250 → "2,50" */
export function centsToEuro(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

export function formatDate(date: Date | string, locale: string = 'fr-FR'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

export function formatDateShort(date: Date | string, locale: string = 'fr-FR'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}
