/**
 * Gera todos os ícones do Codexveil a partir do emblema vetorial em packages/ui/src/brand.ts.
 * Nenhuma imagem externa é usada. Rode após alterar o emblema: `pnpm brand:assets`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { emblemSvg } from '../packages/ui/src/brand.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const charcoal = '#171719';

interface Target {
  file: string;
  size: number;
  svg: string;
}

const targets: Target[] = [
  // Web (Next.js App Router: app/icon.svg e app/apple-icon.png viram metadados automaticamente)
  { file: 'apps/web/src/app/apple-icon.png', size: 180, svg: emblemSvg({ background: charcoal, scale: 0.78 }) },
  { file: 'apps/web/public/icons/icon-192.png', size: 192, svg: emblemSvg({ background: charcoal, scale: 0.8 }) },
  { file: 'apps/web/public/icons/icon-512.png', size: 512, svg: emblemSvg({ background: charcoal, scale: 0.8 }) },
  // Ícone "maskable": o conteúdo precisa caber no círculo seguro de 80%.
  { file: 'apps/web/public/icons/maskable-512.png', size: 512, svg: emblemSvg({ background: charcoal, scale: 0.6 }) },
  // Mobile (Expo)
  { file: 'apps/mobile/assets/images/icon.png', size: 1024, svg: emblemSvg({ background: charcoal, scale: 0.72 }) },
  { file: 'apps/mobile/assets/images/adaptive-icon-foreground.png', size: 1024, svg: emblemSvg({ scale: 0.56 }) },
  {
    file: 'apps/mobile/assets/images/adaptive-icon-monochrome.png',
    size: 1024,
    svg: emblemSvg({ scale: 0.56, monochrome: '#FFFFFF' }),
  },
  { file: 'apps/mobile/assets/images/splash-icon.png', size: 1024, svg: emblemSvg({ scale: 0.9 }) },
  // Ícone das notificações no Android: silhueta branca com fundo transparente.
  {
    file: 'apps/mobile/assets/images/notification-icon.png',
    size: 96,
    svg: emblemSvg({ scale: 0.86, monochrome: '#FFFFFF' }),
  },
];

for (const target of targets) {
  const output = join(root, target.file);
  mkdirSync(dirname(output), { recursive: true });
  await sharp(Buffer.from(target.svg), { density: 72 * (target.size / 64) })
    .resize(target.size, target.size)
    .png({ compressionLevel: 9 })
    .toFile(output);
  console.warn(`✓ ${target.file}`);
}

// Favicon vetorial (escala bem em qualquer densidade de tela).
const faviconPath = join(root, 'apps/web/src/app/icon.svg');
mkdirSync(dirname(faviconPath), { recursive: true });
writeFileSync(faviconPath, emblemSvg({ size: 64 }) + '\n', 'utf8');
console.warn('✓ apps/web/src/app/icon.svg');
