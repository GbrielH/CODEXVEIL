/**
 * Itens da origem do Tormenta20 como itens de verdade: o texto do livro ("Estojo de disfarces ou
 * gazua", "uma arma marcial", "um item que você possa fabricar de até T$ 50"…) vira uma lista de
 * vagas. Itens fixos entram direto (com os dados do catálogo, quando há); o resto vira escolha no
 * passo da origem da criação.
 */
import { plainT20, type T20Content, type T20Item } from './content';

type Equipment = T20Item<'equipment'>;

export interface T20OriginSlotOption {
  /** Id do equipamento do catálogo ou `texto:<nome>` para itens sem ficha no livro. */
  id: string;
  name: string;
}

export type T20OriginItemSlot =
  | {
      key: string;
      kind: 'fixed';
      name: string;
      quantity: number;
      note: string;
      equipment: Equipment | null;
    }
  | {
      key: string;
      kind: 'choice';
      label: string;
      options: T20OriginSlotOption[];
      /** Também aceita um item descrito à mão (ex.: "de até T$ 100"). */
      allowFree: boolean;
    }
  | {
      key: string;
      kind: 'free';
      label: string;
      /** Nome do item com `{}` no lugar do que o jogador escrever (ex.: "Instrumentos de ofício ({})"). */
      template: string;
      /** Sem resposta, o item fica de fora (ex.: itens "aprovados pelo mestre"). */
      optional: boolean;
    };

/** Divide no separador fora de parênteses. */
function splitTop(text: string, separator: RegExp): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (char === '(') depth += 1;
    else if (char === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0) {
      const match = separator.exec(text.slice(index));
      if (match && match.index === 0) {
        parts.push(text.slice(start, index));
        index += match[0].length - 1;
        start = index + 1;
      }
    }
  }
  parts.push(text.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const withoutArticle = (text: string) => text.replace(/^(?:um|uma|o|a)\s+/i, '').trim();
/** "Bálsamo restaurador x2" → 2; "20 flechas" → 20; "Três bolas…" → 3. */
const WORD_NUMBERS: Record<string, number> = { dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5 };
function quantityOf(text: string): { name: string; quantity: number } {
  const times = /^(.*?)\s*x(\d+)$/i.exec(text);
  if (times?.[1] && times[2]) return { name: times[1], quantity: Number(times[2]) };
  const leading = /^(\d+)\s+(.+)$/.exec(text);
  if (leading?.[1] && leading[2]) return { name: leading[2], quantity: Number(leading[1]) };
  const word = /^(\S+)\s+(.+)$/.exec(text);
  const count = word?.[1] ? WORD_NUMBERS[plainT20(word[1])] : undefined;
  if (count && word?.[2]) return { name: word[2], quantity: count };
  return { name: text, quantity: 1 };
}

/** Preço do catálogo em tibares ("T$ 1.000", "T$ 0,5"); sem preço = 0. */
export function t20PriceValue(price: string): number {
  const match = /([\d.]+(?:,\d+)?)/.exec(price.replace(/\s/g, ''));
  return match?.[1] ? Number(match[1].replace(/\./g, '').replace(',', '.')) : 0;
}

const isAmmo = (item: Equipment) => /\(\d+\)/.test(item.name);

export function createOriginItemFinder(content: T20Content) {
  const byName = new Map(content.equipment.map((item) => [plainT20(item.name), item]));
  /** Item do catálogo pelo nome (sem quantidade nem observação entre parênteses). */
  const find = (name: string): Equipment | null => {
    const key = plainT20(withoutArticle(name.replace(/\s*\(.*\)\s*$/, '')));
    return (
      byName.get(key) ??
      (key.startsWith('instrumentos de')
        ? (byName.get(plainT20('Instrumentos de <ofício>')) ?? null)
        : null)
    );
  };
  /** "uma arma simples ou marcial de ataque à distância" → as armas do catálogo. */
  const weapons = (text: string): Equipment[] | null => {
    const match =
      /^(?:uma\s+)?arma\s+(simples|marcial|ex[oó]tica)(?:\s+ou\s+(marcial|ex[oó]tica))?(?:\s+(de ataque [àa] dist[âa]ncia|corpo a corpo))?$/i.exec(
        text.trim(),
      );
    if (!match) return null;
    const categories: string[] = [match[1], match[2]].filter(Boolean).map((word) => {
      const plain = plainT20(word!);
      return plain === 'simples' ? 'simples' : plain === 'marcial' ? 'marciais' : 'exoticas';
    });
    const attack = match[3] ? (/dist/i.test(match[3]) ? 'distancia' : 'corpo') : null;
    return content.equipment.filter(
      (item) =>
        item.group === 'arma' &&
        categories.includes(plainT20(item.category)) &&
        !isAmmo(item) &&
        (!attack ||
          item.attack === attack ||
          (!item.attack && (attack === 'corpo') === (!item.range || item.range === '—'))),
    );
  };
  const option = (name: string): T20OriginSlotOption => {
    const item = find(name);
    return item && !item.name.includes('<')
      ? { id: item.id, name: item.name }
      : { id: `texto:${capitalize(withoutArticle(name))}`, name: capitalize(withoutArticle(name)) };
  };
  return { find, weapons, option };
}

/** Vagas de itens de uma origem, na ordem do livro. */
export function t20OriginItemSlots(
  content: T20Content,
  origin: { items?: string | null } | null | undefined,
): T20OriginItemSlot[] {
  // Só a primeira frase lista itens (o resto é regra: "Enquanto estiver com esse item…").
  const text = splitTop((origin?.items ?? '').trim(), /\.\s+/)[0]?.replace(/\.$/, '') ?? '';
  if (!text) return [];
  const { find, weapons, option } = createOriginItemFinder(content);
  const slots: T20OriginItemSlot[] = [];
  const key = () => `item${slots.length + 1}`;
  const outsideParens = (value: string) => value.replace(/\([^)]*\)/g, '');

  // Itens "aprovados pelo mestre" (Amnésico): o jogador descreve, se quiser.
  if (/aprovad[oa]s? pelo mestre/i.test(outsideParens(text))) {
    return [
      { key: 'item1', kind: 'free', label: capitalize(text), template: '{}', optional: true },
    ];
  }
  // "A, B, C ou D (escolha um)": a lista inteira é uma escolha só.
  const segments = /\(escolha um\)$/i.test(text)
    ? [text]
    : splitTop(text, /,\s*/)
        // "uma caneca e um pano sujo" são dois itens.
        .flatMap((segment) => splitTop(segment, /\s+e\s+(?=(?:um|uma)\s)/i))
        // "como um anel de sinete…" é exemplo do item anterior, não outro item.
        .reduce<string[]>((list, segment) => {
          if (/^como\s/i.test(segment) && list.length) list[list.length - 1] += ` (${segment})`;
          else list.push(segment);
          return list;
        }, []);
  for (const raw of segments) {
    // "…de estimação como um pássaro ou esquilo": o "como…" vira observação do item.
    const example = /^(.+?)\s+(como\s.+)$/i.exec(raw.replace(/\s*\(escolha um\)$/i, '').trim());
    const segment =
      example?.[1] && !/\(/.test(example[1])
        ? `${example[1]} (${example[2]})`
        : raw.replace(/\s*\(escolha um\)$/i, '').trim();
    const label = capitalize(segment);
    const upTo = /de at[ée] T\$\s*([\d.]+)/i.exec(segment);
    if (upTo?.[1]) {
      const limit = Number(upTo[1].replace(/\./g, ''));
      const options = content.equipment
        .filter(
          (item) =>
            item.group !== 'melhoria' &&
            !item.name.includes('<') &&
            t20PriceValue(item.price) > 0 &&
            t20PriceValue(item.price) <= limit,
        )
        .map((item) => ({ id: item.id, name: `${item.name} (${item.price})` }));
      slots.push({ key: key(), kind: 'choice', label, options, allowFree: true });
      continue;
    }
    const weaponList = weapons(segment);
    if (weaponList?.length) {
      slots.push({
        key: key(),
        kind: 'choice',
        label,
        options: weaponList.map((item) => ({ id: item.id, name: item.name })),
        allowFree: false,
      });
      continue;
    }
    // "Instrumentos de ofício (qualquer)": o jogador diz qual ofício.
    if (
      /^instrumentos de of[ií]cio\s*\(qualquer\)$/i.test(segment) ||
      /^instrumentos de of[ií]cio$/i.test(segment)
    ) {
      slots.push({
        key: key(),
        kind: 'free',
        label: `${label}: qual ofício?`,
        template: 'Instrumentos de ofício ({})',
        optional: false,
      });
      continue;
    }
    // "X ou Y" (fora de parênteses), "… a sua escolha".
    const alternatives = splitTop(
      segment.replace(/\s*,?\s*[àa] sua escolha$/i, ''),
      /,\s*|\s+ou\s+/,
    );
    // "Tatuagem ou outro adereço…": não é escolha, é um item só (com a alternativa de sabor).
    if (
      alternatives.length > 1 &&
      !alternatives.slice(1).some((alternative) => /^outr[oa]s?\s/i.test(alternative))
    ) {
      const options = alternatives.flatMap((alternative) => {
        const list = weapons(alternative);
        return list?.length
          ? list.map((item) => ({ id: item.id, name: item.name }))
          : [option(alternative)];
      });
      slots.push({ key: key(), kind: 'choice', label, options, allowFree: false });
      continue;
    }
    if (/[àa] sua escolha$/i.test(segment)) {
      slots.push({ key: key(), kind: 'free', label, template: '{}', optional: false });
      continue;
    }
    const note = /\(([^)]*)\)\s*$/.exec(segment)?.[1] ?? '';
    const { name, quantity } = quantityOf(withoutArticle(segment.replace(/\s*\([^)]*\)\s*$/, '')));
    slots.push({
      key: key(),
      kind: 'fixed',
      name: capitalize(name),
      quantity,
      note,
      equipment: find(name),
    });
  }
  return slots;
}

/** Vagas da origem ainda sem escolha (as obrigatórias). */
export function t20MissingOriginItems(
  slots: readonly T20OriginItemSlot[],
  picks: Readonly<Record<string, string>>,
): string[] {
  return slots
    .filter(
      (slot) =>
        (slot.kind === 'choice' || (slot.kind === 'free' && !slot.optional)) &&
        !(picks[slot.key] ?? '').trim(),
    )
    .map((slot) => (slot.kind === 'fixed' ? slot.name : slot.label));
}
