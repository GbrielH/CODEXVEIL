/**
 * Banco de testes: PGlite (Postgres 17 em WASM) com um shim mínimo do Supabase e as
 * migrações reais de `supabase/migrations`. Cada chamada a `as(...)` roda numa transação
 * com o papel e as claims do JWT do ator — o mesmo mecanismo que o PostgREST usa —,
 * de modo que as policies RLS são exercitadas de verdade.
 *
 * Também é usado por `scripts/generate-types.ts` (executado diretamente pelo Node).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

export const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));
export const migrationsDirectory = join(repositoryRoot, 'supabase', 'migrations');

export interface TestUser {
  kind: 'user';
  id: string;
  email: string;
  name: string;
}

export type Actor = TestUser | { kind: 'anon' } | { kind: 'service' } | { kind: 'admin' };

export const anon: Actor = { kind: 'anon' };
export const service: Actor = { kind: 'service' };
export const admin: Actor = { kind: 'admin' };

export interface Session {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  one<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T>;
  exec(sql: string): Promise<void>;
}

function wrap(tx: Transaction): Session {
  return {
    async query<T>(sql: string, params: unknown[] = []) {
      const result = await tx.query<T>(sql, params);
      return result.rows;
    },
    async one<T>(sql: string, params: unknown[] = []) {
      const result = await tx.query<T>(sql, params);
      if (result.rows.length !== 1) {
        throw new Error(`Esperava 1 linha, recebi ${result.rows.length}: ${sql}`);
      }
      return result.rows[0] as T;
    },
    async exec(sql: string) {
      await tx.exec(sql);
    },
  };
}

export function listMigrationFiles(): string[] {
  return readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith('.sql'))
    .sort();
}

export class TestDatabase {
  readonly pg: PGlite;

  private constructor(pg: PGlite) {
    this.pg = pg;
  }

  static async create(options: { seed?: boolean } = {}): Promise<TestDatabase> {
    const pg = await PGlite.create({ extensions: { pgcrypto } });
    await pg.exec(readFileSync(new URL('./supabase-shim.sql', import.meta.url), 'utf8'));

    for (const file of listMigrationFiles()) {
      try {
        await pg.exec(readFileSync(join(migrationsDirectory, file), 'utf8'));
      } catch (error) {
        throw new Error(`Falha ao aplicar a migração ${file}: ${(error as Error).message}`, {
          cause: error,
        });
      }
    }

    if (options.seed) {
      await pg.exec(readFileSync(join(repositoryRoot, 'supabase', 'seed.sql'), 'utf8'));
    }
    return new TestDatabase(pg);
  }

  /** Executa `fn` numa transação com o papel e o JWT do ator. Erros desfazem tudo. */
  async as<T>(actor: Actor, fn: (session: Session) => Promise<T>): Promise<T> {
    return this.pg.transaction(async (tx) => {
      if (actor.kind !== 'admin') {
        const claims =
          actor.kind === 'user'
            ? { sub: actor.id, email: actor.email, role: 'authenticated', aud: 'authenticated' }
            : { role: actor.kind === 'anon' ? 'anon' : 'service_role' };
        await tx.query(`select set_config('request.jwt.claims', $1, true)`, [
          JSON.stringify(claims),
        ]);
        const role =
          actor.kind === 'user' ? 'authenticated' : actor.kind === 'anon' ? 'anon' : 'service_role';
        await tx.exec(`set local role ${role}`);
      }
      return fn(wrap(tx));
    });
  }

  /** Cria uma conta (como o Supabase Auth faria); o gatilho cria o perfil. */
  async createUser(
    name: string,
    options: { emailConfirmed?: boolean; email?: string } = {},
  ): Promise<TestUser> {
    const id = randomUUID();
    const email = options.email ?? `${name.toLowerCase().replace(/\W+/g, '.')}.${id.slice(0, 8)}@teste.dev`;
    await this.pg.query(
      `insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
       values ($1, $2, $3, $4)`,
      [
        id,
        email,
        options.emailConfirmed === false ? null : new Date().toISOString(),
        JSON.stringify({ display_name: name }),
      ],
    );
    return { kind: 'user', id, email, name };
  }

  async close(): Promise<void> {
    await this.pg.close();
  }
}

/** Código SQLSTATE de um erro do Postgres, quando houver. */
export function sqlState(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return typeof error.code === 'string' ? error.code : undefined;
  }
  return undefined;
}

/** Aguarda uma falha com o SQLSTATE informado e devolve a mensagem. */
export async function expectSqlError(promise: Promise<unknown>, code: string): Promise<string> {
  try {
    await promise;
  } catch (error) {
    const actual = sqlState(error);
    if (actual !== code) {
      throw new Error(
        `Esperava SQLSTATE ${code}, recebi ${actual ?? 'nenhum'}: ${(error as Error).message}`,
        { cause: error },
      );
    }
    return (error as Error).message;
  }
  throw new Error(`Esperava falha com SQLSTATE ${code}, mas a operação foi concluída.`);
}
