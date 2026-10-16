import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TestDatabase } from './support/pglite';
import { generateTypesSource } from './support/types-generator';

let db: TestDatabase;

beforeAll(async () => {
  db = await TestDatabase.create();
});

afterAll(async () => {
  await db.close();
});

describe('tipos do banco', () => {
  it('src/types.gen.ts está sincronizado com as migrações (rode `pnpm db:types`)', async () => {
    const expected = await generateTypesSource(db);
    const current = readFileSync(new URL('../src/types.gen.ts', import.meta.url), 'utf8');
    expect(current.replace(/\r\n/g, '\n')).toBe(expected);
  });
});
