import type { Metadata, Viewport } from 'next';
import { Alegreya, Cinzel, Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { themeBootScript } from '@/components/layout/theme-toggle';
import { ToastProvider } from '@/components/ui/toast';
import { siteUrl } from '@/lib/env';
import './globals.css';

// As fontes são baixadas no build e servidas pelo próprio site (sem requisições ao Google).
const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-cinzel',
  display: 'swap',
});
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const alegreya = Alegreya({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  style: ['normal', 'italic'],
  variable: '--font-alegreya',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: 'Codexveil', template: '%s · Codexveil' },
  description:
    'Gerenciador de campanhas de RPG de mesa: campanhas, fichas, sessões e segredos do mestre num só grimório.',
  applicationName: 'Codexveil',
  appleWebApp: { capable: true, title: 'Codexveil', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#171719',
  colorScheme: 'dark light',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // `suppressHydrationWarning`: o script abaixo pode marcar o tema claro antes da hidratação.
    <html lang="pt-BR" className={`${cinzel.variable} ${inter.variable} ${alegreya.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <a
          href="#conteudo"
          className="sr-only z-50 rounded-md bg-raised px-4 py-2 text-fg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Pular para o conteúdo
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
