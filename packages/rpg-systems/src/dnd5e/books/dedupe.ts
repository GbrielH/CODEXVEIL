/** Mesmos nomes com tradução diferente entre o SRD 5.2 (2024) e os livros de 2014. */
const NAME_ALIASES: Record<string, string> = {
  halfling: 'pequenino',
  tiefling: 'tiferino',
  goliath: 'golias',
  // Subclasses do SRD com outro nome na tradução do Livro do Jogador 2014.
  'caminho do furioso': 'caminho do berserker',
  'caminho da mao aberta': 'guerreiro da mao aberta',
  'conclave do cacador': 'cacador',
  'linhagem draconica': 'feiticaria draconica',
  'o corruptor': 'patrono infero',
  'escola de evocacao': 'evocador',
};

/** Nome comparável: sem acento, minúsculo, sem o "(2014)" etc., com os sinônimos de tradução. */
export function comparableName(name: string): string {
  const plain = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return NAME_ALIASES[plain] ?? plain;
}

/**
 * Junta o SRD com os livros liberados sem repetir nomes: a versão do livro (escolhida pelo mestre)
 * substitui a do SRD de mesmo nome, e entre livros vale a do primeiro. `group` separa listas em que
 * o mesmo nome pode existir em grupos diferentes (subclasses de classes diferentes).
 */
export function mergeWithoutRepeats<T extends { name: string }>(
  srd: readonly T[],
  books: readonly T[],
  group: (item: T) => string = () => '',
): T[] {
  const seen = new Set<string>();
  const fromBooks = books.filter((item) => {
    const key = `${group(item)}|${comparableName(item.name)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [
    ...srd.filter((item) => !seen.has(`${group(item)}|${comparableName(item.name)}`)),
    ...fromBooks,
  ];
}
