import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TestDatabase, admin, listMigrationFiles } from './support/pglite';

let db: TestDatabase;

beforeAll(async () => {
  db = await TestDatabase.create();
});

afterAll(async () => {
  await db.close();
});

describe('migrações', () => {
  it('seguem a convenção de nomes com carimbo de data', () => {
    for (const file of listMigrationFiles()) {
      expect(file).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/);
    }
  });

  it('habilitam RLS em todas as tabelas do esquema public', async () => {
    const tables = await db.as(admin, (s) =>
      s.query<{ relname: string; relrowsecurity: boolean }>(
        `select c.relname, c.relrowsecurity
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = 'r'`,
      ),
    );
    expect(tables.length).toBeGreaterThan(15);
    for (const table of tables) {
      expect(table.relrowsecurity, `RLS desabilitado em ${table.relname}`).toBe(true);
    }
  });

  it('não concedem nenhum privilégio de tabela ao papel anon, exceto dados de referência', async () => {
    const grants = await db.as(admin, (s) =>
      s.query<{ table_name: string; privilege_type: string }>(
        `select table_name, privilege_type
         from information_schema.role_table_grants
         where grantee = 'anon' and table_schema = 'public'`,
      ),
    );
    expect(grants).toEqual([{ table_name: 'rpg_systems', privilege_type: 'SELECT' }]);
  });

  it('funções SECURITY DEFINER fixam o search_path', async () => {
    const unsafe = await db.as(admin, (s) =>
      s.query<{ proname: string }>(
        `select p.proname
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname in ('public', 'private')
           and p.prosecdef
           and not exists (
             select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%'
           )`,
      ),
    );
    expect(unsafe).toEqual([]);
  });

  it('nenhuma função pública é executável por anon', async () => {
    const executable = await db.as(admin, (s) =>
      s.query<{ proname: string }>(
        `select p.proname
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')`,
      ),
    );
    expect(executable).toEqual([]);
  });

  it('publicam no Realtime apenas as tabelas de estado de jogo', async () => {
    const published = await db.as(admin, (s) =>
      s.query<{ tablename: string }>(
        `select tablename from pg_publication_tables
         where pubname = 'supabase_realtime' order by tablename`,
      ),
    );
    expect(published.map((row) => row.tablename)).toEqual([
      'campaign_members',
      'campaign_turns',
      'card_decks',
      'character_conditions',
      'character_resources',
      'characters',
      'conflict_objectives',
      'dice_rolls',
      'encounter_combatants',
      'encounters',
      'map_tokens',
      'session_blocks',
      'session_entities',
      'session_maps',
      'sessions',
      'tavern_messages',
      'turn_actions',
    ]);
  });
});
