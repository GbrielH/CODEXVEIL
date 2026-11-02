/**
 * Gerador rápido de NPC para o mestre: nome, aparência, jeito de falar, motivação e um segredo,
 * sorteados de listas em português. A mesma semente gera sempre o mesmo NPC.
 */

export interface QuickNpc {
  name: string;
  appearance: string;
  voice: string;
  motivation: string;
  secret: string;
}

const FIRST_NAMES = [
  'Aldric',
  'Brina',
  'Cassiano',
  'Dália',
  'Edmundo',
  'Fiora',
  'Gaspar',
  'Helena',
  'Ivo',
  'Jacinta',
  'Leopoldo',
  'Marta',
  'Nestor',
  'Odete',
  'Policarpo',
  'Quitéria',
  'Rodrigo',
  'Serafina',
  'Tobias',
  'Úrsula',
  'Valdemar',
  'Yara',
  'Zacarias',
  'Amélia',
  'Bartolomeu',
  'Celeste',
  'Doroteu',
  'Esmeralda',
  'Florêncio',
  'Guiomar',
  'Heitor',
  'Isolda',
  'Jerônimo',
  'Lavínia',
  'Matias',
  'Noêmia',
  'Otávio',
  'Petra',
  'Rufino',
  'Sabina',
];

const SURNAMES = [
  'Pedraferro',
  'Valverde',
  'Cinzaforte',
  'Arruda',
  'Montebravo',
  'Corvalho',
  'Ventoleste',
  'Fontenegra',
  'Roçabranca',
  'Torrealta',
  'Lumebrasa',
  'Brejoseco',
  'Carvalhal',
  'Murodouro',
  'Penhasco',
  'Salgueiro',
  'Trovão',
  'Vinhedo',
  'Ourofino',
  'Espinheira',
];

const OCCUPATIONS = [
  'taverneira',
  'ferreiro',
  'guarda da muralha',
  'mercadora de especiarias',
  'sacerdote itinerante',
  'caçadora',
  'escriba',
  'contrabandista',
  'barqueiro',
  'curandeira',
  'mendigo',
  'nobre arruinado',
  'aprendiz de mago',
  'menestrel',
  'coveiro',
  'cartógrafa',
  'estalajadeiro',
  'mineira',
  'alquimista',
  'cavaleiro aposentado',
];

const APPEARANCES = [
  'cicatriz atravessando a sobrancelha',
  'olhos de cores diferentes',
  'cabelo grisalho trançado',
  'dentes de ouro',
  'tatuagens de runas nos braços',
  'manca de uma perna',
  'roupas finas mas puídas',
  'mãos sempre sujas de tinta',
  'nariz quebrado mais de uma vez',
  'sardas e sorriso fácil',
  'capuz que nunca tira',
  'cheira a fumaça e ervas',
  'muito alto e curvado',
  'baixinho e robusto',
  'brincos de osso',
  'luvas de couro gastas',
  'um olho coberto por tapa-olho',
  'careca reluzente',
  'barba ruiva enorme',
  'voz e roupas sempre impecáveis',
];

const VOICES = [
  'fala baixo e devagar, medindo cada palavra',
  'ri alto de tudo, até do que não tem graça',
  'responde perguntas com outras perguntas',
  'gagueja quando está nervoso',
  'usa provérbios antigos',
  'fala rápido e muda de assunto toda hora',
  'trata todos como "meu caro"',
  'sussurra como quem conta segredo',
  'é seco e direto, sem gentilezas',
  'exagera em tudo que conta',
  'corrige a gramática dos outros',
  'canta sem perceber',
  'reclama do tempo o tempo todo',
  'fala de si mesmo na terceira pessoa',
  'desconfia de tudo e de todos',
  'elogia demais para pedir favores',
];

const MOTIVATIONS = [
  'pagar uma dívida antes que cobrem com sangue',
  'encontrar o irmão desaparecido',
  'subir na vida a qualquer custo',
  'proteger a família de uma ameaça antiga',
  'vingar-se de quem arruinou seu negócio',
  'provar seu valor ao mestre da guilda',
  'fugir da cidade sem ser notado',
  'recuperar uma relíquia roubada',
  'ser lembrado como herói',
  'manter a paz no bairro',
  'descobrir a verdade sobre o próprio passado',
  'juntar ouro para se aposentar',
  'cumprir uma promessa feita a um moribundo',
  'conquistar o amor de alguém inalcançável',
];

const SECRETS = [
  'é informante da guarda',
  'deve dinheiro a um culto',
  'já foi um bandido procurado',
  'esconde um item mágico amaldiçoado',
  'é filho bastardo de um nobre',
  'viu o crime e se calou',
  'trabalha para o vilão sem saber',
  'está sendo chantageado',
  'tem um pacto com uma entidade',
  'roubou a identidade de outra pessoa',
  'sabe onde fica uma passagem secreta',
  'envenena clientes que odeia',
  'é de outra raça disfarçado por magia',
  'guarda um mapa de tesouro incompleto',
];

function seedNumber(seed: string): number {
  let value = 2166136261;
  for (const char of seed || 'codexveil') {
    value ^= char.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function randomFrom(seed: string): () => number {
  let state = seedNumber(seed);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Gera um NPC a partir da semente (vazia = "codexveil"). */
export function generateQuickNpc(seed: string): QuickNpc {
  const random = randomFrom(seed.trim());
  const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)]!;
  return {
    name: `${pick(FIRST_NAMES)} ${pick(SURNAMES)}`,
    appearance: `${pick(OCCUPATIONS)}; ${pick(APPEARANCES)}`,
    voice: pick(VOICES),
    motivation: pick(MOTIVATIONS),
    secret: pick(SECRETS),
  };
}

/** Texto para a descrição do registro na biblioteca (o segredo fica marcado). */
export function quickNpcDescription(npc: QuickNpc): string {
  return [
    `Aparência: ${npc.appearance}.`,
    `Jeito de falar: ${npc.voice}.`,
    `Quer: ${npc.motivation}.`,
    `Segredo (só o mestre): ${npc.secret}.`,
  ].join('\n');
}

export interface QuickMonster {
  name: string;
  size: 'small' | 'medium' | 'large' | 'huge';
  appearance: string;
  behavior: string;
  ability: string;
  weakness: string;
}

const MONSTER_BASES: { name: string; size: QuickMonster['size'] }[] = [
  { name: 'Rastejador', size: 'medium' },
  { name: 'Devorador', size: 'large' },
  { name: 'Espreitador', size: 'medium' },
  { name: 'Colosso', size: 'huge' },
  { name: 'Diabrete', size: 'small' },
  { name: 'Lobo', size: 'medium' },
  { name: 'Serpe', size: 'large' },
  { name: 'Aranha', size: 'large' },
  { name: 'Carniçal', size: 'medium' },
  { name: 'Golem', size: 'large' },
  { name: 'Morcego', size: 'small' },
  { name: 'Troll', size: 'large' },
  { name: 'Verme', size: 'huge' },
  { name: 'Espectro', size: 'medium' },
];

const MONSTER_EPITHETS = [
  'das Cinzas',
  'do Pântano',
  'de Ossos',
  'Sombrio',
  'das Profundezas',
  'de Cristal',
  'Pestilento',
  'de Ferrugem',
  'Uivante',
  'da Névoa',
  'Sanguinário',
  'de Musgo',
  'do Abismo',
  'Faminto',
  'de Gelo',
];

const MONSTER_LOOKS = [
  'couro rachado que solta brasas',
  'olhos demais espalhados pelo corpo',
  'carapaça coberta de runas',
  'corpo translúcido com órgãos à mostra',
  'pelagem emaranhada de raízes',
  'boca vertical cheia de dentes',
  'escamas que mudam de cor',
  'membros longos e articulados ao contrário',
  'cheiro de enxofre e carne podre',
  'chifres retorcidos cobertos de musgo',
  'pele de pedra com veios de magma',
  'asas membranosas rasgadas',
];

const MONSTER_BEHAVIORS = [
  'caça em bando e cerca a presa',
  'espera imóvel e ataca de emboscada',
  'foge quando ferido e volta à noite',
  'protege um ninho com ovos',
  'arrasta as vítimas para o covil',
  'imita vozes para atrair viajantes',
  'só ataca quem carrega luz',
  'é territorial e marca o caminho com ossos',
  'serve a um mestre que o controla',
  'devora metal e ignora quem não carrega nada',
];

const MONSTER_ABILITIES = [
  'cospe ácido em linha',
  'fica invisível na penumbra',
  'regenera feridas a cada turno',
  'grita e amedronta quem ouve',
  'agarra e contém com tentáculos',
  'atravessa paredes finas',
  'envenena com a mordida',
  'explode em esporos ao morrer',
  'escala tetos sem esforço',
  'drena calor e causa dano de frio',
  'salta grandes distâncias',
  'reflete magias fracas',
];

const MONSTER_WEAKNESSES = [
  'fogo',
  'luz do sol',
  'prata',
  'sal',
  'barulho alto',
  'água corrente',
  'ferro frio',
  'música',
  'o próprio reflexo',
  'fumaça de ervas',
  'magia sagrada',
  'ser chamado pelo nome verdadeiro',
];

/** Gera um monstro a partir da semente (vazia = "codexveil"). */
export function generateQuickMonster(seed: string): QuickMonster {
  const random = randomFrom(`monstro:${seed.trim()}`);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)]!;
  const base = pick(MONSTER_BASES);
  return {
    name: `${base.name} ${pick(MONSTER_EPITHETS)}`,
    size: base.size,
    appearance: pick(MONSTER_LOOKS),
    behavior: pick(MONSTER_BEHAVIORS),
    ability: pick(MONSTER_ABILITIES),
    weakness: pick(MONSTER_WEAKNESSES),
  };
}

/** Texto para a descrição do monstro na biblioteca. */
export function quickMonsterDescription(monster: QuickMonster): string {
  return [
    `Aparência: ${monster.appearance}.`,
    `Comportamento: ${monster.behavior}.`,
    `Habilidade: ${monster.ability}.`,
    `Fraqueza: ${monster.weakness}.`,
  ].join('\n');
}
