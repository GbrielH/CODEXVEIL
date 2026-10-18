import type { NextConfig } from 'next';

/** Pacotes do monorepo exportam TypeScript diretamente e são transpilados pelo Next. */
const workspacePackages = [
  '@codexveil/database',
  '@codexveil/domain',
  '@codexveil/rpg-systems',
  '@codexveil/ui',
  '@codexveil/validation',
];

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  transpilePackages: workspacePackages,
  // A capa da campanha vai junto com o formulário de criação (já reduzida no navegador, até 2 MB).
  experimental: {
    serverActions: { bodySizeLimit: '3mb' },
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  headers() {
    return Promise.resolve([{ source: '/:path*', headers: securityHeaders }]);
  },
};

export default nextConfig;
