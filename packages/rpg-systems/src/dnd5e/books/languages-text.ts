import { SRD_LANGUAGES } from '../srd/languages';

/** Idiomas que um livro concede: os citados pelo nome e quantos são à escolha do jogador. */
export interface BookLanguages {
  fixed: string[];
  choices: number;
}

const COUNT_WORDS: Record<string, number> = {
  um: 1,
  uma: 1,
  outro: 1,
  outra: 1,
  dois: 2,
  duas: 2,
  tres: 3,
};

/** Nomes em português de 2014 que diferem do SRD 5.2 (o Pequenino era "Halfling"). */
const NAME_ALIASES: Record<string, string> = {
  halfling: 'halfling',
  'dialeto subterraneo': 'deep_speech',
  'fala profunda': 'deep_speech',
};

function plain(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Lê o texto de idiomas do livro: "Dois à sua escolha" (antecedente) ou o traço "Idiomas. Você
 * pode falar, ler e escrever Comum e Anão…" (raça) e "um idioma adicional à sua escolha".
 */
export function languagesFromText(text: string): BookLanguages {
  const lower = plain(text);
  // Só a primeira frase traz a lista (o resto do traço descreve o idioma).
  const firstSentence = lower.split(/\.\s/)[0] ?? lower;
  const fixed = new Set<string>();
  for (const language of SRD_LANGUAGES) {
    if (language.id === 'common') continue;
    const name = plain(language.name);
    if (new RegExp(`\\b${name}\\b`).test(firstSentence)) fixed.add(language.id);
  }
  for (const [alias, id] of Object.entries(NAME_ALIASES)) {
    if (new RegExp(`\\b${alias}\\b`).test(firstSentence)) fixed.add(id);
  }
  let choices = 0;
  const choice =
    /\b(um|uma|outro|outra|dois|duas|tres|\d)\b[^.]{0,40}?(?:a|à) sua escolha|(?:um|uma) (?:idioma|outro idioma) (?:adicional|extra)/.exec(
      lower,
    );
  if (choice) choices = COUNT_WORDS[choice[1] ?? 'um'] ?? (Number(choice[1]) || 1);
  return { fixed: [...fixed], choices: Math.min(choices, 4) };
}
