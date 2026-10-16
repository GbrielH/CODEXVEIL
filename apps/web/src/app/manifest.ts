import type { MetadataRoute } from 'next';

/** Manifesto PWA: permite instalar o site como aplicativo em navegadores compatíveis. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Codexveil',
    short_name: 'Codexveil',
    description: 'Campanhas, fichas, sessões e segredos do mestre num só grimório.',
    lang: 'pt-BR',
    start_url: '/painel',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#171719',
    theme_color: '#171719',
    categories: ['games', 'entertainment', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
