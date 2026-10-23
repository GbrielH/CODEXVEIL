'use client';

import { listBookEntries } from '@codexveil/database';
import { itemCategoryLabels, type ItemCategory } from '@codexveil/domain';
import { ARMOR_COST_GP, SRD_ITEMS, WEAPON_COST_GP, loadSrdMagicItems, srdMagicItemToCampaignItem, weightForUnit } from '@codexveil/rpg-systems/dnd5e';
import { BookOpen, Plus, Search } from 'lucide-react';
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
  quantity: number;
}

interface CatalogEntry extends Omit<CatalogPick, 'quantity'> {
  /** Preço unitário na moeda base (PO no D&D, T$ no Tormenta20); `null` = sem preço no livro. */
  price: number | null;
  key: string;
  /** "SRD 5.2.1", nome do livro… */
  source: string;
  /** Rótulo do tipo na lista ("Item mágico", "Arma"…). */
  kind: string;
  magic: boolean;
}


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

/** "T$ 1.500" → 1500; "—" ou vazio → sem preço. */
function t20Price(text: string): number | null {
  const match = /([\d.]+(?:,\d+)?)/.exec(text);
  if (!match?.[1]) return null;
  const value = Number(match[1].replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(value) ? value : null;
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
        price: (item.weapon ? WEAPON_COST_GP[item.weapon] : item.armor ? ARMOR_COST_GP[item.armor] : undefined) ?? null,
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
        price: null,
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
        price: null,
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
          price: t20Price(text('price')),
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
          price: t20Price(text('price')),
        });
      }
    }
  }
  return out.map((entry) => ({ ...entry, name: entry.name.slice(0, 120), description: entry.description.slice(0, 2000) }));
}

const money = (value: number, currency: string) =>
  `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${currency}`;

/**
 * "Escolher do livro": catálogo de itens como numa loja (SRD no D&D e livros ativos da ficha).
 * Filtra por tipo e por "cabe no bolso" (disponíveis: preço até o dinheiro do personagem), mostra
 * valor, quantidade e total; escolher preenche o formulário, que ainda pode ser ajustado.
 */
export function ItemCatalogPicker({
  onPick,
  metric = false,
  wallet = null,
}: {
  onPick: (item: CatalogPick) => void;
  metric?: boolean;
  /** Dinheiro do personagem na moeda base (PO ou T$), para separar disponíveis e indisponíveis. */
  wallet?: number | null;
}) {
  const books = useContext(CatalogContext);
  const currency = books.systemId === 'dnd5e' ? 'PO' : 'T$';
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<CatalogEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [showAvailable, setShowAvailable] = useState(true);
  const [showUnavailable, setShowUnavailable] = useState(true);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

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

  const kinds = useMemo(() => [...new Set((catalog ?? []).map((entry) => entry.kind))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [catalog]);
  const quantityOf = (key: string) => quantities[key] ?? 1;
  const affordable = (entry: CatalogEntry, quantity = 1) => wallet === null || entry.price === null || entry.price * quantity <= wallet;

  const shown = useMemo(() => {
    const words = plain(query).split(/\s+/).filter(Boolean);
    return (catalog ?? [])
      .filter((entry) => kind === 'all' || entry.kind === kind)
      .filter((entry) => (affordable(entry) ? showAvailable : showUnavailable))
      .filter((entry) => words.every((word) => plain(`${entry.name} ${entry.kind}`).includes(word)))
      .slice(0, 120);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `affordable` só depende de `wallet`.
  }, [catalog, query, kind, showAvailable, showUnavailable, wallet]);

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
          value={kind}
          onChange={(event) => setKind(event.target.value)}
          aria-label="Categoria do item"
          className="max-w-[14rem] rounded-md border border-line bg-canvas px-2 py-2 text-sm text-fg"
        >
          <option value="all">Todas as categorias</option>
          {kinds.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm text-fg">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={showAvailable} onChange={(event) => setShowAvailable(event.target.checked)} className="h-4 w-4 accent-wine-500" />
          Itens disponíveis
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={showUnavailable} onChange={(event) => setShowUnavailable(event.target.checked)} className="h-4 w-4 accent-wine-500" />
          Itens indisponíveis
        </label>
        <span className="text-xs text-fg-muted">
          {wallet === null ? 'Sem dinheiro registrado na ficha.' : `Seu dinheiro: ${money(wallet, currency)}`}
        </span>
      </div>
      {failed ? (
        <p className="text-sm text-danger">Não foi possível carregar o catálogo. Tente de novo.</p>
      ) : !catalog ? (
        <p className="text-sm text-fg-muted">Carregando itens…</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-fg-muted">Nenhum item encontrado.</p>
      ) : (
        <div className="max-h-80 overflow-auto rounded-md border border-line">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-raised text-[11px] tracking-wider text-fg-muted uppercase">
              <tr>
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-2 py-2 text-right font-medium">Valor</th>
                <th className="px-2 py-2 text-center font-medium">Qtd.</th>
                <th className="px-2 py-2 text-right font-medium">Total</th>
                <th className="px-2 py-2" aria-label="Escolher" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((entry) => {
                const quantity = quantityOf(entry.key);
                const total = entry.price === null ? null : entry.price * quantity;
                const fits = affordable(entry, quantity);
                return (
                  <tr key={entry.key} className={fits ? '' : 'opacity-60'}>
                    <td className="px-3 py-2">
                      <span className="block text-fg">{entry.name}</span>
                      <span className="block text-xs text-fg-muted">
                        {join(entry.kind, entry.source, entry.weight !== null && `${entry.weight.toLocaleString('pt-BR')} ${books.systemId === 'dnd5e' ? (metric ? 'kg' : 'lb') : 'espaço(s)'}`)}
                      </span>
                    </td>
                    <td className="tabular px-2 py-2 text-right whitespace-nowrap">{entry.price === null ? '—' : money(entry.price, currency)}</td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={quantity}
                        onChange={(event) => setQuantities((current) => ({ ...current, [entry.key]: Math.max(1, Math.min(999, Math.floor(Number(event.target.value) || 1))) }))}
                        aria-label={`Quantidade de ${entry.name}`}
                        className="tabular w-14 rounded border border-line bg-canvas px-1 py-1 text-center text-sm text-fg"
                      />
                    </td>
                    <td className={`tabular px-2 py-2 text-right whitespace-nowrap ${fits ? 'text-fg' : 'text-danger'}`}>{total === null ? '—' : money(total, currency)}</td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => {
                          onPick({ name: entry.name, category: entry.category, weight: entry.weight, description: entry.description, quantity });
                          setOpen(false);
                        }}
                        aria-label={`Escolher ${entry.name}`}
                        title="Escolher"
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-fg-brand hover:bg-hover"
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <button type="button" onClick={() => setOpen(false)} className="self-end text-xs text-fg-muted hover:text-fg">
        Fechar catálogo
      </button>
    </div>
  );
}
