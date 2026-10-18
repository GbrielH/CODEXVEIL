/**
 * Livros oficiais de D&D 5e que o mestre pode liberar na campanha, por categoria. O Codexveil só
 * reproduz o SRD 5.2.1 (CC-BY-4.0); estes livros têm direitos autorais da Wizards of the Coast, então
 * a escolha diz à mesa o que vale, e o conteúdo deles entra à mão nas fichas e na biblioteca.
 * Lista conferida com o catálogo do D&D Beyond (https://www.dndbeyond.com/sources) até 2025.
 */

export const SOURCEBOOK_CATEGORIES = ['core', 'player', 'monsters', 'gm', 'setting', 'adventure'] as const;
export type SourcebookCategory = (typeof SOURCEBOOK_CATEGORIES)[number];

export const sourcebookCategoryLabels: Record<SourcebookCategory, { name: string; description: string }> = {
  core: { name: 'Livros básicos', description: 'Regras completas além do SRD: todas as classes, subclasses, espécies e magias.' },
  player: { name: 'Opções para personagens', description: 'Subclasses, espécies, talentos, magias e itens extras.' },
  monsters: { name: 'Monstros', description: 'Criaturas e fichas para o mestre.' },
  gm: { name: 'Mestre, itens e regras', description: 'Ferramentas do mestre, itens mágicos e regras opcionais.' },
  setting: { name: 'Cenários de campanha', description: 'Mundos com espécies, subclasses e regras próprias.' },
  adventure: { name: 'Aventuras e campanhas', description: 'Histórias prontas para mestrar.' },
};

export interface Sourcebook {
  id: string;
  name: string;
  category: SourcebookCategory;
  year: number;
  edition: '2024' | '2014';
}

export const DND5E_SOURCEBOOKS: readonly Sourcebook[] = [
  // Básicos
  { id: 'phb-2024', name: 'Livro do Jogador (2024)', category: 'core', year: 2024, edition: '2024' },
  { id: 'dmg-2024', name: 'Guia do Mestre (2024)', category: 'core', year: 2024, edition: '2024' },
  { id: 'mm-2025', name: 'Manual dos Monstros (2025)', category: 'core', year: 2025, edition: '2024' },
  { id: 'phb-2014', name: 'Livro do Jogador (2014)', category: 'core', year: 2014, edition: '2014' },
  { id: 'dmg-2014', name: 'Guia do Mestre (2014)', category: 'core', year: 2014, edition: '2014' },
  { id: 'mm-2014', name: 'Manual dos Monstros (2014)', category: 'core', year: 2014, edition: '2014' },
  // Opções para personagens
  { id: 'xgte', name: "Xanathar's Guide to Everything", category: 'player', year: 2017, edition: '2014' },
  { id: 'tcoe', name: "Tasha's Cauldron of Everything", category: 'player', year: 2020, edition: '2014' },
  { id: 'scag', name: "Sword Coast Adventurer's Guide", category: 'player', year: 2015, edition: '2014' },
  { id: 'ftod', name: "Fizban's Treasury of Dragons", category: 'player', year: 2021, edition: '2014' },
  { id: 'bomt', name: 'The Book of Many Things', category: 'player', year: 2023, edition: '2014' },
  { id: 'hof', name: 'Forgotten Realms: Heroes of Faerûn', category: 'player', year: 2025, edition: '2024' },
  { id: 'efa', name: 'Eberron: Forge of the Artificer', category: 'player', year: 2025, edition: '2024' },
  // Monstros
  { id: 'vgm', name: "Volo's Guide to Monsters", category: 'monsters', year: 2016, edition: '2014' },
  { id: 'mtof', name: "Mordenkainen's Tome of Foes", category: 'monsters', year: 2018, edition: '2014' },
  { id: 'mpmm', name: 'Mordenkainen Presents: Monsters of the Multiverse', category: 'monsters', year: 2022, edition: '2014' },
  { id: 'bgg', name: 'Bigby Presents: Glory of the Giants', category: 'monsters', year: 2023, edition: '2014' },
  // Mestre, itens e regras
  { id: 'aif', name: 'Forgotten Realms: Adventures in Faerûn', category: 'gm', year: 2025, edition: '2024' },
  { id: 'kftgv', name: 'Keys from the Golden Vault', category: 'gm', year: 2023, edition: '2014' },
  // Cenários
  { id: 'erlw', name: 'Eberron: Rising from the Last War', category: 'setting', year: 2019, edition: '2014' },
  { id: 'ggr', name: "Guildmasters' Guide to Ravnica", category: 'setting', year: 2018, edition: '2014' },
  { id: 'mot', name: 'Mythic Odysseys of Theros', category: 'setting', year: 2020, edition: '2014' },
  { id: 'vrgr', name: "Van Richten's Guide to Ravenloft", category: 'setting', year: 2021, edition: '2014' },
  { id: 'scc', name: 'Strixhaven: A Curriculum of Chaos', category: 'setting', year: 2021, edition: '2014' },
  { id: 'sais', name: 'Spelljammer: Adventures in Space', category: 'setting', year: 2022, edition: '2014' },
  { id: 'pamv', name: 'Planescape: Adventures in the Multiverse', category: 'setting', year: 2023, edition: '2014' },
  { id: 'egw', name: "Explorer's Guide to Wildemount", category: 'setting', year: 2020, edition: '2014' },
  { id: 'tdcsr', name: "Tal'Dorei Campaign Setting Reborn", category: 'setting', year: 2022, edition: '2014' },
  { id: 'ai', name: 'Acquisitions Incorporated', category: 'setting', year: 2019, edition: '2014' },
  // Aventuras
  { id: 'lmop', name: 'Lost Mine of Phandelver (Starter Set)', category: 'adventure', year: 2014, edition: '2014' },
  { id: 'hotdq', name: 'Hoard of the Dragon Queen', category: 'adventure', year: 2014, edition: '2014' },
  { id: 'rot', name: 'The Rise of Tiamat', category: 'adventure', year: 2014, edition: '2014' },
  { id: 'pota', name: 'Princes of the Apocalypse', category: 'adventure', year: 2015, edition: '2014' },
  { id: 'oota', name: 'Out of the Abyss', category: 'adventure', year: 2015, edition: '2014' },
  { id: 'cos', name: 'Curse of Strahd', category: 'adventure', year: 2016, edition: '2014' },
  { id: 'skt', name: "Storm King's Thunder", category: 'adventure', year: 2016, edition: '2014' },
  { id: 'toa', name: 'Tomb of Annihilation', category: 'adventure', year: 2017, edition: '2014' },
  { id: 'wdh', name: 'Waterdeep: Dragon Heist', category: 'adventure', year: 2018, edition: '2014' },
  { id: 'wdmm', name: 'Waterdeep: Dungeon of the Mad Mage', category: 'adventure', year: 2018, edition: '2014' },
  { id: 'gos', name: 'Ghosts of Saltmarsh', category: 'adventure', year: 2019, edition: '2014' },
  { id: 'bgdia', name: "Baldur's Gate: Descent into Avernus", category: 'adventure', year: 2019, edition: '2014' },
  { id: 'idrotf', name: 'Icewind Dale: Rime of the Frostmaiden', category: 'adventure', year: 2020, edition: '2014' },
  { id: 'cm', name: 'Candlekeep Mysteries', category: 'adventure', year: 2021, edition: '2014' },
  { id: 'wbtw', name: 'The Wild Beyond the Witchlight', category: 'adventure', year: 2021, edition: '2014' },
  { id: 'cotn', name: 'Call of the Netherdeep', category: 'adventure', year: 2022, edition: '2014' },
  { id: 'jttrc', name: 'Journeys through the Radiant Citadel', category: 'adventure', year: 2022, edition: '2014' },
  { id: 'dsotdq', name: 'Dragonlance: Shadow of the Dragon Queen', category: 'adventure', year: 2022, edition: '2014' },
  { id: 'pabtso', name: 'Phandelver and Below: The Shattered Obelisk', category: 'adventure', year: 2023, edition: '2014' },
  { id: 'veor', name: 'Vecna: Eve of Ruin', category: 'adventure', year: 2024, edition: '2014' },
  { id: 'qftis', name: 'Quests from the Infinite Staircase', category: 'adventure', year: 2024, edition: '2024' },
];

const IDS = new Set(DND5E_SOURCEBOOKS.map((book) => book.id));

export function isSourcebookId(id: string): boolean {
  return IDS.has(id);
}

export function findSourcebook(id: string): Sourcebook | undefined {
  return DND5E_SOURCEBOOKS.find((book) => book.id === id);
}

/** Endereço do livro no D&D Beyond quando difere do id (conferidos por HTTP em 2026-10-18). */
const DDB_SLUGS: Record<string, string | null> = {
  'mm-2025': 'mm-2024',
  bomt: 'tbomt',
  hof: 'frhof',
  efa: 'efota',
  vgm: 'vgtm',
  mpmm: 'motm',
  bgg: 'gotg',
  aif: 'fraif',
  erlw: 'erftlw',
  ggr: 'ggtr',
  mot: null,
  vrgr: 'vrgtr',
  scc: 'sacoc',
  pamv: 'paitm',
  egw: 'egtw',
  tdcsr: 'tcsr',
  wdmm: 'wdotmm',
  wbtw: 'twbtw',
  dsotdq: 'sotdq',
  pabtso: 'pbtso',
};

/** Página oficial do livro no D&D Beyond (ou o catálogo, quando o endereço não foi confirmado). */
export function sourcebookUrl(id: string): string {
  const slug = id in DDB_SLUGS ? DDB_SLUGS[id] : id;
  return slug ? `https://www.dndbeyond.com/sources/dnd/${slug}` : 'https://www.dndbeyond.com/sources';
}

/**
 * Links da campanha: as fontes gratuitas sempre, e os livros pagos só quando o mestre liberou
 * cada um (sistema base = sem livros pagos na lista).
 */
export function dnd5eCampaignLinks(
  freeLinks: readonly { label: string; description: string; url: string; access: 'free' | 'paid' }[],
  sourcebookIds: readonly string[],
): { label: string; description: string; url: string; access: 'free' | 'paid' }[] {
  const books = sourcebookIds
    .map((id) => findSourcebook(id))
    .filter((book): book is Sourcebook => Boolean(book))
    .map((book) => ({
      label: book.name,
      description: `${sourcebookCategoryLabels[book.category].name} · ${book.year}`,
      url: sourcebookUrl(book.id),
      access: 'paid' as const,
    }));
  return [...freeLinks.filter((link) => link.access === 'free'), ...books];
}
