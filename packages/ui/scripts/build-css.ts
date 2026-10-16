import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTokensCss } from '../src/css.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'css', 'tokens.css');

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, buildTokensCss(), 'utf8');
console.warn(`Tokens CSS gerados em ${target}`);
