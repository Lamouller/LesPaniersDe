import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { ThemeProvider } from '@/components/layout/ThemeProvider';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'LesPaniersDe — Circuits courts, retrait en entreprise',
  description:
    'La plateforme open source qui connecte producteurs locaux et communautés. Commandez vos paniers, retirez-les dans votre entreprise ou espace de coworking.',
  manifest: '/manifest.json',
  applicationName: 'LesPaniersDe',
  keywords: ['circuit court', 'panier', 'producteur local', 'AMAP', 'open source'],
  authors: [{ name: 'LesPaniersDe contributors' }],
  robots: 'index, follow',
  openGraph: {
    title: 'LesPaniersDe',
    description: 'Circuits courts, retrait en entreprise',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className="dark" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={`${inter.variable} antialiased`}>
        <ThemeProvider>
          <NextIntlClientProvider messages={messages}>
            {children}
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
