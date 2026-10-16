/**
 * Gera `src/types.gen.ts` a partir das migrações, sem Docker: aplica as migrações num
 * Postgres em WASM (PGlite) e introspecta o catálogo, emitindo o tipo `Database` no
 * formato consumido pelo supabase-js.
 *
 * Com um projeto Supabase configurado, o comando oficial também funciona:
 *   supabase gen types typescript --project-id <id> > packages/database/src/types.gen.ts
 *
 * Uso: pnpm db:types            (gera o arquivo)
 *      pnpm db:types --check    (falha se o arquivo estiver desatualizado)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TestDatabase } from '../test/support/pglite.ts';
import { generateTypesSource } from '../test/support/types-generator.ts';

const outputFile = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'types.gen.ts');

const db = await TestDatabase.create();
try {
  const source = await generateTypesSource(db);
  if (process.argv.includes('--check')) {
    const current = readFileSync(outputFile, 'utf8').replace(/\r\n/g, '\n');
    if (current !== source) {
      console.error('src/types.gen.ts está desatualizado. Rode `pnpm db:types`.');
      process.exitCode = 1;
    } else {
      console.warn('src/types.gen.ts está atualizado.');
    }
  } else {
    writeFileSync(outputFile, source, 'utf8');
    console.warn(`Tipos gerados em ${outputFile}`);
  }
} finally {
  await db.close();
}
