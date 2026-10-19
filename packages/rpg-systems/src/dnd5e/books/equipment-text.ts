import { ALL_TOOLS, SRD_ITEMS } from '../srd/equipment';
import type { EquipmentGrant } from '../srd/types';

const NUMBER_WORDS: Record<string, number> = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, dez: 10, vinte: 20 };

function plain(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Catálogo (itens do SRD e ferramentas) pelo nome comparável, do mais longo ao mais curto. */
let catalog: { key: string; id: string }[] | null = null;
function catalogEntries() {
  if (!catalog) {
    const entries = [
      ...Object.values(SRD_ITEMS).map((item) => ({ key: plain(item.name), id: item.id })),
      ...ALL_TOOLS.map((tool) => ({ key: plain(tool.name), id: tool.id })),
    ].filter((entry) => entry.key.length >= 3);
    catalog = entries.sort((a, b) => b.key.length - a.key.length);
  }
  return catalog;
}

function matchCatalog(piece: string): string | undefined {
  const text = ` ${plain(piece)} `;
  // Singular simples ("virotes" → "virote", "flechas" → "flecha").
  const singular = text.replace(/(\w{3,})s\b/g, '$1');
  return catalogEntries().find((entry) => text.includes(` ${entry.key} `) || singular.includes(` ${entry.key} `))?.id;
}

/**
 * Converte o equipamento descrito no livro ("Um pé de cabra, 15 metros de corda e uma algibeira
 * contendo 15 po") em itens: o que bate com o catálogo vira o item do SRD (com peso, dano e CA); o
 * resto entra com o nome do livro, como equipamento geral. As moedas viram o ouro da opção.
 */
export function equipmentFromText(text: string): { items: EquipmentGrant[]; gold: number } {
  const items: EquipmentGrant[] = [];
  let gold = 0;
  const pieces = text
    .replace(/\([^)]*\)/g, (inner) => inner.replace(/[,;]/g, ' '))
    .split(/[;,]|\s+e\s+(?=(?:um|uma|dois|duas|\d))/i)
    .map((piece) => piece.trim().replace(/\.$/, ''))
    .filter(Boolean);
  for (const raw of pieces) {
    const coins = /(\d+)\s*(po|pp|pc)\b/i.exec(raw);
    if (coins && /algibeira|bolsa|moedas|\bpo\b/i.test(raw)) {
      const value = Number(coins[1]);
      gold += coins[2]!.toLowerCase() === 'po' ? value : coins[2]!.toLowerCase() === 'pp' ? Math.floor(value / 10) : 0;
      if (/algibeira|bolsa/i.test(raw)) items.push({ item: 'pouch', name: 'Algibeira' });
      continue;
    }
    // "armadura de couro batido ou brunea": fica a primeira opção.
    const piece = raw.split(/\s+ou\s+/i)[0]!.trim();
    const words = plain(piece).split(' ');
    const first = words[0] ?? '';
    const quantity = NUMBER_WORDS[first] ?? (/^\d+$/.test(first) && !/metros?/.test(words[1] ?? '') ? Number(first) : 1);
    const name = piece.replace(/^(um|uma|dois|duas|\d+)\s+/i, '').replace(/^\w/, (letter) => letter.toUpperCase());
    if (!name) continue;
    const id = matchCatalog(piece);
    items.push({ item: id ?? 'livro', ...(id && plain(name) === plain(SRD_ITEMS[id]?.name ?? '') ? {} : { name: name.slice(0, 120) }), ...(quantity > 1 ? { quantity } : {}) });
  }
  return { items: items.slice(0, 30), gold };
}
