/**
 * Gerador do tipo `Database` (formato do supabase-js) por introspecção do catálogo do
 * Postgres após aplicar as migrações. Usado por `scripts/generate-types.ts` e pelo teste
 * que garante que `src/types.gen.ts` está sincronizado com `supabase/migrations`.
 */
import { admin, type Session, type TestDatabase } from './pglite.ts';

const POSTGREST_VERSION = '13';

interface ColumnInfo {
  table_name: string;
  column_name: string;
  type_name: string;
  type_type: string;
  element_type_name: string | null;
  element_type_type: string | null;
  is_nullable: boolean;
  has_default: boolean;
  is_identity: boolean;
  is_generated: boolean;
}

interface ForeignKeyInfo {
  constraint_name: string;
  table_name: string;
  referenced_table: string;
  columns: string[];
  referenced_columns: string[];
}

interface UniqueInfo {
  table_name: string;
  columns: string[];
}

interface FunctionInfo {
  name: string;
  arg_names: string[] | null;
  arg_types: string[];
  arg_type_types: string[];
  arg_element_types: (string | null)[];
  default_count: number;
  return_type: string;
  return_type_type: string;
  return_relation: string | null;
  returns_set: boolean;
}

const stringTypes = new Set([
  'uuid',
  'text',
  'varchar',
  'bpchar',
  'citext',
  'date',
  'time',
  'timetz',
  'timestamp',
  'timestamptz',
  'interval',
  'bytea',
  'inet',
  'name',
]);
const numberTypes = new Set(['int2', 'int4', 'int8', 'float4', 'float8', 'numeric', 'oid']);

function scalarType(typeName: string, typeType: string): string {
  if (typeType === 'e') return `Database['public']['Enums']['${typeName}']`;
  if (stringTypes.has(typeName)) return 'string';
  if (numberTypes.has(typeName)) return 'number';
  if (typeName === 'bool') return 'boolean';
  if (typeName === 'json' || typeName === 'jsonb') return 'Json';
  if (typeName === 'void') return 'undefined';
  return 'unknown';
}

function columnType(column: ColumnInfo): string {
  if (column.element_type_name) {
    return `${scalarType(column.element_type_name, column.element_type_type ?? 'b')}[]`;
  }
  return scalarType(column.type_name, column.type_type);
}

function quote(value: string): string {
  return `'${value}'`;
}

function indent(lines: string[], depth: number): string[] {
  const pad = '  '.repeat(depth);
  return lines.map((line) => (line.length > 0 ? pad + line : line));
}

async function introspect(s: Session) {
  const enums = await s.query<{ name: string; labels: string[] }>(
    `select t.typname as name, array_agg(e.enumlabel order by e.enumsortorder) as labels
     from pg_type t
     join pg_enum e on e.enumtypid = t.oid
     join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = 'public'
     group by t.typname
     order by t.typname`,
  );

  const columns = await s.query<ColumnInfo>(
    `select c.relname as table_name,
            a.attname as column_name,
            t.typname as type_name,
            t.typtype::text as type_type,
            et.typname as element_type_name,
            et.typtype::text as element_type_type,
            not a.attnotnull as is_nullable,
            ad.adbin is not null as has_default,
            a.attidentity <> '' as is_identity,
            a.attgenerated <> '' as is_generated
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
     join pg_type t on t.oid = a.atttypid
     left join pg_type et on et.oid = t.typelem and t.typcategory = 'A'
     left join pg_attrdef ad on ad.adrelid = c.oid and ad.adnum = a.attnum
     where n.nspname = 'public' and c.relkind = 'r'
     order by c.relname, a.attname`,
  );

  const foreignKeys = await s.query<ForeignKeyInfo>(
    `select con.conname as constraint_name,
            c.relname as table_name,
            rc.relname as referenced_table,
            array(
              select a.attname from unnest(con.conkey) with ordinality as k(attnum, ord)
              join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum
              order by k.ord
            ) as columns,
            array(
              select a.attname from unnest(con.confkey) with ordinality as k(attnum, ord)
              join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.attnum
              order by k.ord
            ) as referenced_columns
     from pg_constraint con
     join pg_class c on c.oid = con.conrelid
     join pg_namespace n on n.oid = c.relnamespace
     join pg_class rc on rc.oid = con.confrelid
     join pg_namespace rn on rn.oid = rc.relnamespace
     where con.contype = 'f' and n.nspname = 'public' and rn.nspname = 'public'
     order by c.relname, con.conname`,
  );

  const uniques = await s.query<UniqueInfo>(
    `select c.relname as table_name,
            array(
              select a.attname from unnest(i.indkey) as k(attnum)
              join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
            ) as columns
     from pg_index i
     join pg_class c on c.oid = i.indrelid
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and i.indisunique and i.indpred is null`,
  );

  const functions = await s.query<FunctionInfo>(
    `select p.proname as name,
            p.proargnames as arg_names,
            array(select format_type(t, null) from unnest(p.proargtypes) as t) as arg_types,
            array(
              select ty.typtype::text from unnest(p.proargtypes) with ordinality as a(t, ord)
              join pg_type ty on ty.oid = a.t order by a.ord
            ) as arg_type_types,
            array(
              select et.typname from unnest(p.proargtypes) with ordinality as a(t, ord)
              join pg_type ty on ty.oid = a.t
              left join pg_type et on et.oid = ty.typelem and ty.typcategory = 'A'
              order by a.ord
            ) as arg_element_types,
            p.pronargdefaults as default_count,
            rt.typname as return_type,
            rt.typtype::text as return_type_type,
            rel.relname as return_relation,
            p.proretset as returns_set
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     join pg_type rt on rt.oid = p.prorettype
     left join pg_class rel on rel.oid = rt.typrelid
     where n.nspname = 'public' and p.prokind = 'f'
     order by p.proname`,
  );

  return { enums, columns, foreignKeys, uniques, functions };
}

function argumentType(info: FunctionInfo, index: number): string {
  const element = info.arg_element_types[index];
  const formatted = info.arg_types[index] ?? 'unknown';
  if (element) return `${scalarType(element, 'b')}[]`;
  const typeName = formatted.replace(/^public\./, '');
  const map: Record<string, string> = {
    uuid: 'uuid',
    text: 'text',
    integer: 'int4',
    bigint: 'int8',
    boolean: 'bool',
    jsonb: 'jsonb',
    json: 'json',
    'timestamp with time zone': 'timestamptz',
  };
  return scalarType(map[typeName] ?? typeName, info.arg_type_types[index] ?? 'b');
}

function render(data: Awaited<ReturnType<typeof introspect>>): string {
  const tables = new Map<string, ColumnInfo[]>();
  for (const column of data.columns) {
    const list = tables.get(column.table_name) ?? [];
    list.push(column);
    tables.set(column.table_name, list);
  }

  const uniqueSets = new Map<string, string[]>();
  for (const unique of data.uniques) {
    const list = uniqueSets.get(unique.table_name) ?? [];
    list.push([...unique.columns].sort().join(','));
    uniqueSets.set(unique.table_name, list);
  }

  const tableLines: string[] = [];
  for (const [table, columns] of [...tables.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const row = columns.map(
      (c) => `${c.column_name}: ${columnType(c)}${c.is_nullable ? ' | null' : ''};`,
    );
    const insert = columns
      .filter((c) => !c.is_generated)
      .map((c) => {
        const optional = c.is_nullable || c.has_default || c.is_identity;
        return `${c.column_name}${optional ? '?' : ''}: ${columnType(c)}${c.is_nullable ? ' | null' : ''};`;
      });
    const update = columns
      .filter((c) => !c.is_generated)
      .map((c) => `${c.column_name}?: ${columnType(c)}${c.is_nullable ? ' | null' : ''};`);

    const relationships = data.foreignKeys
      .filter((fk) => fk.table_name === table)
      .map((fk) => {
        const isOneToOne = (uniqueSets.get(table) ?? []).includes([...fk.columns].sort().join(','));
        return [
          '{',
          `  foreignKeyName: ${quote(fk.constraint_name)};`,
          `  columns: [${fk.columns.map(quote).join(', ')}];`,
          `  isOneToOne: ${isOneToOne};`,
          `  referencedRelation: ${quote(fk.referenced_table)};`,
          `  referencedColumns: [${fk.referenced_columns.map(quote).join(', ')}];`,
          '},',
        ];
      });

    tableLines.push(
      `${table}: {`,
      '  Row: {',
      ...indent(row, 2),
      '  };',
      '  Insert: {',
      ...indent(insert, 2),
      '  };',
      '  Update: {',
      ...indent(update, 2),
      '  };',
      relationships.length === 0 ? '  Relationships: [];' : '  Relationships: [',
      ...(relationships.length === 0 ? [] : indent(relationships.flat(), 2)),
      ...(relationships.length === 0 ? [] : ['  ];']),
      '};',
    );
  }

  const functionLines: string[] = [];
  for (const fn of data.functions) {
    const names = fn.arg_names ?? [];
    const total = fn.arg_types.length;
    const firstDefault = total - fn.default_count;
    const args = fn.arg_types.map((_, index) => {
      const name = names[index] ?? `arg${index}`;
      return `${name}${index >= firstDefault ? '?' : ''}: ${argumentType(fn, index)};`;
    });

    let returns: string;
    let setof: string[] = [];
    if (fn.return_relation) {
      const rowType = `Database['public']['Tables']['${fn.return_relation}']['Row']`;
      returns = fn.returns_set ? `${rowType}[]` : rowType;
      setof = [
        `SetofOptions: {`,
        `  from: '*';`,
        `  to: ${quote(fn.return_relation)};`,
        `  isOneToOne: ${!fn.returns_set};`,
        `  isSetofReturn: ${fn.returns_set};`,
        `};`,
      ];
    } else {
      const scalar = scalarType(fn.return_type, fn.return_type_type);
      returns = fn.returns_set ? `${scalar}[]` : scalar;
    }

    functionLines.push(
      `${fn.name}: {`,
      args.length === 0 ? '  Args: never;' : '  Args: {',
      ...(args.length === 0 ? [] : indent(args, 2)),
      ...(args.length === 0 ? [] : ['  };']),
      `  Returns: ${returns};`,
      ...indent(setof, 1),
      '};',
    );
  }

  const enumLines = data.enums.map((e) => `${e.name}: ${e.labels.map(quote).join(' | ')};`);
  const constantLines = data.enums.map((e) => `${e.name}: [${e.labels.map(quote).join(', ')}],`);

  return [
    '// Arquivo gerado por packages/database/scripts/generate-types.ts — não edite manualmente.',
    '// Fonte da verdade: supabase/migrations. Regenerar com `pnpm db:types`.',
    '',
    'export type Json =',
    '  | string',
    '  | number',
    '  | boolean',
    '  | null',
    '  | { [key: string]: Json | undefined }',
    '  | Json[];',
    '',
    'export type Database = {',
    `  __InternalSupabase: {`,
    `    PostgrestVersion: '${POSTGREST_VERSION}';`,
    '  };',
    '  public: {',
    '    Tables: {',
    ...indent(tableLines, 3),
    '    };',
    '    Views: {',
    '      [_ in never]: never;',
    '    };',
    '    Functions: {',
    ...indent(functionLines, 3),
    '    };',
    '    Enums: {',
    ...indent(enumLines, 3),
    '    };',
    '    CompositeTypes: {',
    '      [_ in never]: never;',
    '    };',
    '  };',
    '};',
    '',
    "type PublicSchema = Database['public'];",
    '',
    "export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];",
    "export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert'];",
    "export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update'];",
    "export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T];",
    "export type FunctionArgs<T extends keyof PublicSchema['Functions']> = PublicSchema['Functions'][T]['Args'];",
    "export type FunctionReturns<T extends keyof PublicSchema['Functions']> = PublicSchema['Functions'][T]['Returns'];",
    '',
    'export const Constants = {',
    '  public: {',
    '    Enums: {',
    ...indent(constantLines, 3),
    '    },',
    '  },',
    '} as const;',
    '',
  ].join('\n');
}

/** Fonte completa de `src/types.gen.ts` para o banco informado. */
export async function generateTypesSource(db: TestDatabase): Promise<string> {
  const data = await db.as(admin, introspect);
  return render(data);
}
