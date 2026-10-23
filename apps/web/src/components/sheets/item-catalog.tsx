'use client';

import { listBookEntries } from '@codexveil/database';
import { itemCategoryLabels, ITEM_CATEGORIES, type ItemCategory } from '@codexveil/domain';
import { SRD_ITEMS, loadSrdMagicItems, srdMagicItemToCampaignItem, weightForUnit } from '@codexveil/rpg-systems/dnd5e';
import { BookOpen, Search } from 'lucide-react';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

/** Livros ativos da ficha (campanha ou, em fichas pessoais, os escolhidos na criação). */
interface CatalogBooks {
  systemId: string;
  packs: { id: string; name: string }[];
}

const CatalogContext = createContext<CatalogBooks>({ systemId: '', packs: [] });

export function ItemCatalogProvider({ value, children }: { value: CatalogBooks; children: ReactNode }) {
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

/** O que o seletor devolve para preencher o formulário de item. */
export interface CatalogPick {
  name: string;
  category: ItemCategory;
  weight: number | null;
  description: string;
}

interface CatalogEntry extends CatalogPick {
  key: string;
  /** "SRD 5.2.1", nome do livro… */
  source: string;
  /** Rótulo do tipo na lista ("Item mágico", "Arma"…). */
  kind: string;
  magic: boolean;
}

type Filter = ItemCategory | 'magic' | 'all';

const plain = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

const join = (...parts: (string | undefined | null | false)[]) => parts.filter(Boolean).join(' · ');

/** Equipamento do Tormenta20 (livro): grupo e categoria da tabela viram a categoria do inventário. */
function t20Category(group: string, category: string): ItemCategory {
  if (group === 'arma') return 'weapon';
  if (group === 'armadura') return 'armor';
  const name = plain(category);
  if (/alquim|pocao|alimenta|consum|municao/.test(name)) return 'consumable';
  if (/ferrament|kit|instrument/.test(name)) return 'tool';
  return 'gear';
}

async function loadCatalog(books: CatalogBooks, metric: boolean): Promise<CatalogEntry[]> {
  const out: CatalogEntry[] = [];
  const names = new Map(books.packs.map((pack) => [pack.id, pack.name]));
  const entries = await listBookEntries(
    getSupabaseBrowserClient(),
    books.packs.map((pack) => pack.id),
    ['equipment', 'magic_item'],
  );
  if (books.systemId === 'dnd5e') {
    for (const item of Object.values(SRD_ITEMS)) {
      out.push({
        key: `srd-${item.id}`,
        name: item.name,
        category: item.category,
        weight: weightForUnit(item.weightLb, metric ? 'm' : 'ft'),
        description: item.description ?? '',
        source: 'SRD 5.2.1',
        kind: itemCategoryLabels[item.category],
        magic: false,
      });
    }
    for (const item of await loadSrdMagicItems()) {
      const converted = srdMagicItemToCampaignItem(item);
      out.push({
        key: `srd-magic-${item.name}`,
        name: converted.name,
        category: converted.category,
        weight: null,
        description: join(converted.rarity, converted.requiresAttunement ? 'exige sintonia' : '') + (converted.description ? `\n\n${converted.description}` : ''),
        source: 'SRD 5.2.1',
        kind: 'Item mágico',
        magic: true,
      });
    }
    for (const entry of entries) {
      if (entry.kind !== 'magic_item') continue;
      const data = entry.data as { type?: string; rarity?: string; attunement?: string; description?: string[] };
      const type = data.type ?? '';
      out.push({
        key: entry.id,
        name: entry.name,
        category: /arma|weapon/i.test(type) ? 'weapon' : /armadura|escudo|armor|shield/i.test(type) ? 'armor' : /po[cç][aã]o|potion|pergaminho|scroll/i.test(type) ? 'consumable' : 'gear',
        weight: null,
        description: join(type, data.rarity, data.attunement) + (data.description?.length ? `\n\n${data.description.join('\n\n')}` : ''),
        source: names.get(entry.packId) ?? 'Livro',
        kind: 'Item mágico',
        magic: true,
      });
    }
  } else {
    for (const entry of entries) {
      const data = entry.data as Record<string, unknown>;
      const text = (key: string) => (typeof data[key] === 'string' ? (data[key]) : '');
      if (entry.kind === 'equipment') {
        if (text('group') === 'melhoria') continue; // melhorias são aplicadas a um item, não são itens
        const spaces = Number(text('spaces').replace(',', '.'));
        out.push({
          key: entry.id,
          name: entry.name,
          category: t20Category(text('group'), text('category')),
          weight: Number.isFinite(spaces) && text('spaces') ? spaces : null,
          description:
            join(
              text('damage') && `Dano ${text('damage')}`,
              text('critical') && `Crítico ${text('critical')}`,
              text('range') && `Alcance ${text('range')}`,
              text('damageType'),
              typeof data.defense === 'number' && `Defesa +${data.defense}`,
              typeof data.penalty === 'number' && data.penalty < 0 && `Penalidade ${data.penalty}`,
              text('price'),
            ) + (text('text') || text('effect') ? `\n\n${text('text') || text('effect')}` : ''),
          source: names.get(entry.packId) ?? 'Livro',
          kind: text('category') || itemCategoryLabels[t20Category(text('group'), text('category'))],
          magic: false,
        });
      } else {
        const kindName = text('kind');
        out.push({
          key: entry.id,
          name: entry.name,
          category: kindName === 'pocao' ? 'consumable' : kindName.includes('arma') && !kindName.includes('armadura') ? 'weapon' : kindName.includes('armadura') ? 'armor' : 'gear',
          weight: null,
          description: join(text('effect'), text('price')) + (text('text') ? `\n\n${text('text')}` : ''),
          source: names.get(entry.packId) ?? 'Livro',
          kind: 'Item mágico',
          magic: true,
        });
      }
    }
  }
  return out.map((entry) => ({ ...entry, name: entry.name.slice(0, 120), description: entry.description.slice(0, 2000) }));
}

/**
 * "Escolher do livro": catálogo de itens (SRD no D&D e livros ativos da ficha), com busca e filtro
 * por tipo. Escolher um item preenche o formulário; a pessoa ainda pode ajustar antes de salvar.
 */
export function ItemCatalogPicker({ onPick, metric = false }: { onPick: (item: CatalogPick) => void; metric?: boolean }) {
  const books = useContext(CatalogContext);
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<CatalogEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    if (!open || catalog) return;
    let alive = true;
    loadCatalog(books, metric)
      .then((entries) => alive && setCatalog(entries.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [open, catalog, books, metric]);

  const shown = useMemo(() => {
    const words = plain(query).split(/\s+/).filter(Boolean);
    return (catalog ?? [])
      .filter((entry) => (filter === 'all' ? true : filter === 'magic' ? entry.magic : entry.category === filter && !entry.magic))
      .filter((entry) => words.every((word) => plain(`${entry.name} ${entry.kind}`).includes(word)))
      .slice(0, 80);
  }, [catalog, query, filter]);

  const hasCatalog = books.systemId === 'dnd5e' || books.packs.length > 0;
  if (!hasCatalog) {
    return <p className="text-xs text-fg-muted">Para escolher itens de um livro, ative um livro na campanha (ou na criação da ficha).</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 self-start rounded-md border border-line bg-raised px-3 py-2 text-sm text-fg hover:border-line-strong hover:bg-hover"
      >
        <BookOpen className="h-4 w-4 text-fg-brand" aria-hidden="true" />
        Escolher do livro
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-raised p-3">
      <div className="flex flex-wrap gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-line bg-canvas px-2">
          <Search className="h-4 w-4 text-fg-muted" aria-hidden="true" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar item…"
            aria-label="Buscar item no livro"
            className="min-w-0 flex-1 bg-transparent py-2 text-sm text-fg outline-none"
          />
        </label>
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value as Filter)}
          aria-label="Tipo de item"
          className="rounded-md border border-line bg-canvas px-2 py-2 text-sm text-fg"
        >
          <option value="all">Todos os tipos</option>
          {ITEM_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {itemCategoryLabels[category]}
            </option>
          ))}
          <option value="magic">Itens mágicos</option>
        </select>
      </div>
      {failed ? (
        <p className="text-sm text-danger">Não foi possível carregar o catálogo. Tente de novo.</p>
      ) : !catalog ? (
        <p className="text-sm text-fg-muted">Carregando itens…</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-fg-muted">Nenhum item encontrado.</p>
      ) : (
        <ul className="flex max-h-64 flex-col divide-y divide-line overflow-y-auto rounded-md border border-line">
          {shown.map((entry) => (
            <li key={entry.key}>
              <button
                type="button"
                onClick={() => {
                  onPick(entry);
                  setOpen(false);
                }}
                className="flex w-full flex-col px-3 py-2 text-left hover:bg-hover"
              >
                <span className="text-sm text-fg">{entry.name}</span>
                <span className="text-xs text-fg-muted">
                  {join(entry.kind, entry.source, entry.weight !== null && `${entry.weight.toLocaleString('pt-BR')} ${books.systemId === 'dnd5e' ? (metric ? 'kg' : 'lb') : 'espaço(s)'}`)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={() => setOpen(false)} className="self-end text-xs text-fg-muted hover:text-fg">
        Fechar catálogo
      </button>
    </div>
  );
}
