/**
 * Behind the Magic (BTM), "Manual de Runas" de Will Nascimento (uso autorizado pelo autor).
 * Regras transcritas do manual (OCR das páginas, conferido à mão nas que saíram ilegíveis).
 * O que o manual ainda não define está em `docs/BTM.md` ("Perguntas para o criador"); aqui fica
 * só o que está escrito, sem inventar números.
 */

export const BTM_ATTRIBUTES = ['for', 'des', 'con', 'int', 'sab', 'car'] as const;
export type BtmAttribute = (typeof BTM_ATTRIBUTES)[number];

export const btmAttributeLabels: Record<BtmAttribute, string> = {
  for: 'Força',
  des: 'Destreza',
  con: 'Constituição',
  int: 'Inteligência',
  sab: 'Sabedoria',
  car: 'Carisma',
};

/** Criação (p. 10): todos começam em 1, 8 pontos para distribuir, máximo 5 no início. */
export const BTM_ATTRIBUTE_START = 1;
export const BTM_ATTRIBUTE_POINTS = 8;
export const BTM_ATTRIBUTE_MAX_AT_CREATION = 5;

/**
 * Pontos gastos numa distribuição (antes dos bônus de raça). Baixar um atributo para 0 devolve
 * 1 ponto. Atributo 0 faz o teste com 2d20, ficando com o pior.
 */
export function btmPointsSpent(values: Record<BtmAttribute, number>): number {
  return BTM_ATTRIBUTES.reduce((sum, key) => sum + (values[key] - BTM_ATTRIBUTE_START), 0);
}

export function btmAttributeIssues(values: Record<BtmAttribute, number>): string[] {
  const issues: string[] = [];
  for (const key of BTM_ATTRIBUTES) {
    if (values[key] < 0) issues.push(`${btmAttributeLabels[key]} não pode ser negativa.`);
    if (values[key] > BTM_ATTRIBUTE_MAX_AT_CREATION) issues.push(`${btmAttributeLabels[key]} passa do máximo inicial (${BTM_ATTRIBUTE_MAX_AT_CREATION}).`);
  }
  const spent = btmPointsSpent(values);
  if (spent > BTM_ATTRIBUTE_POINTS) issues.push(`Foram usados ${spent} pontos; o limite é ${BTM_ATTRIBUTE_POINTS}.`);
  return issues;
}

/** Expressão do teste de atributo: d20 + valor; com 0, 2d20 ficando com o pior (p. 10). */
export function btmCheckExpression(value: number, bonus = 0): { expression: string; mode: 'normal' | 'disadvantage' } {
  const total = value + bonus;
  const sign = total >= 0 ? `+${total}` : String(total);
  return { expression: `1d20${total ? sign : ''}`, mode: value === 0 ? 'disadvantage' : 'normal' };
}

// --------------------------------------------------------------------------- Perícias (p. 49–58)

export type BtmTraining = 'destreinado' | 'treinado' | 'veterano' | 'expert';
/** Bônus de perícia por grau (p. 50). */
export const btmTrainingBonus: Record<BtmTraining, number> = { destreinado: 0, treinado: 3, veterano: 5, expert: 7 };
/** Na criação o personagem escolhe três perícias treinadas (p. 49). */
export const BTM_TRAINED_SKILLS_AT_CREATION = 3;

export interface BtmSkill {
  id: string;
  name: string;
  attribute: BtmAttribute;
  /** "sim" = só treinado usa; "ferramentas" = exige kit (sem ele, −5). */
  trainedOnly: 'nao' | 'sim' | 'ferramentas';
  armorPenalty: boolean;
  description: string;
}

const skill = (id: string, name: string, attribute: BtmAttribute, trainedOnly: BtmSkill['trainedOnly'], armorPenalty: boolean, description: string): BtmSkill => ({
  id,
  name,
  attribute,
  trainedOnly,
  armorPenalty,
  description,
});

export const BTM_SKILLS: readonly BtmSkill[] = [
  skill('acrobacia', 'Acrobacia', 'des', 'nao', true, 'Movimentos acrobáticos, como cambalhotas.'),
  skill('antropologia', 'Antropologia', 'int', 'sim', false, 'Estudo sobre as raças, culturas etc.'),
  skill('adestramento', 'Adestramento', 'car', 'sim', false, 'Capacidade de adestrar animais.'),
  skill('atletismo', 'Atletismo', 'con', 'nao', true, 'Corrida e condicionamento físico.'),
  skill('atuacao', 'Atuação', 'car', 'nao', false, 'Capacidade de enganar e manipular alguém.'),
  skill('artes', 'Artes', 'int', 'ferramentas', false, 'Coisas artísticas, como desenhos.'),
  skill('charme', 'Charme', 'car', 'nao', false, 'Causar uma boa impressão ou chamar a atenção.'),
  skill('ciencias', 'Ciências', 'int', 'nao', false, 'Conhecimentos gerais.'),
  skill('conhecimento', 'Conhecimento', 'sab', 'nao', false, 'Lembrar de algo.'),
  skill('conserto', 'Conserto', 'des', 'nao', false, 'Consertar algo.'),
  skill('comandar', 'Comandar', 'car', 'sim', false, 'Mandar em alguém.'),
  skill('cura', 'Cura', 'sab', 'ferramentas', false, 'Curar alguém.'),
  skill('diplomacia', 'Diplomacia', 'car', 'nao', false, 'Acalmar ou melhorar o estado mental de alguém.'),
  skill('escalar', 'Escalar', 'for', 'nao', true, 'Escalar algo.'),
  skill('escutar', 'Escutar', 'sab', 'nao', false, 'Escutar algo.'),
  skill('furtividade', 'Furtividade', 'des', 'nao', true, 'Fazer algo discreto ou despercebido.'),
  skill('fortitude', 'Fortitude', 'con', 'nao', false, 'Resistência física, como prender a respiração.'),
  skill('identificar-magia', 'Identificar Magia', 'int', 'sim', false, 'Decifrar e compreender uma magia.'),
  skill('iniciativa', 'Iniciativa', 'des', 'nao', false, 'Saber quem age primeiro.'),
  skill('intimidar', 'Intimidar', 'car', 'nao', false, 'Intimidar alguém.'),
  skill('investigacao', 'Investigação', 'sab', 'nao', false, 'Averiguar um local.'),
  skill('ladinagem', 'Ladinagem', 'des', 'sim', true, 'Fazer roubos.'),
  skill('linguagem', 'Linguagem', 'int', 'sim', false, 'Idiomas.'),
  skill('lutar', 'Lutar', 'for', 'nao', false, 'Lutar corpo a corpo.'),
  skill('natacao', 'Natação', 'des', 'sim', true, 'Nadar.'),
  skill('percepcao', 'Percepção', 'sab', 'nao', false, 'Olhar ao redor.'),
  skill('pontaria', 'Pontaria', 'des', 'nao', false, 'Mirar.'),
  skill('primeiros-socorros', 'Primeiros Socorros', 'sab', 'nao', false, 'Ajudar alguém à beira da morte.'),
  skill('rastejar', 'Rastejar', 'des', 'nao', true, 'Rastejar por baixo de algo.'),
  skill('reflexo', 'Reflexo', 'des', 'nao', false, 'Velocidade de reação.'),
  skill('religiao', 'Religião', 'sab', 'sim', false, 'Conhecimentos religiosos.'),
  skill('saltar', 'Saltar', 'for', 'nao', true, 'Saltar sobre algo.'),
  skill('sobrevivencia', 'Sobrevivência', 'sab', 'nao', false, 'Conhecimentos de sobrevivência.'),
  skill('vontade', 'Vontade', 'con', 'nao', false, 'Resistência mental.'),
];

/** Penalidade nos testes das perícias marcadas (p. 51) e kit de ferramentas ausente (−5). */
export const btmArmorSkillPenalty = { leve: -2, media: -3, pesada: -5, escudo: -2 } as const;
export const BTM_MISSING_TOOLS_PENALTY = -5;

/** Bônus total de uma perícia: atributo + treino − penalidades (armadura e kit). */
export function btmSkillBonus(
  skillDef: BtmSkill,
  attributes: Record<BtmAttribute, number>,
  training: BtmTraining,
  options: { armor?: keyof typeof btmArmorSkillPenalty | null; shield?: boolean; hasTools?: boolean } = {},
): number {
  let total = attributes[skillDef.attribute] + btmTrainingBonus[training];
  if (skillDef.armorPenalty) {
    if (options.armor && options.armor !== 'escudo') total += btmArmorSkillPenalty[options.armor];
    if (options.shield) total += btmArmorSkillPenalty.escudo;
  }
  if (skillDef.trainedOnly === 'ferramentas' && options.hasTools === false) total += BTM_MISSING_TOOLS_PENALTY;
  return total;
}

/** Só treinado usa (p. 50): destreinado não pode fazer o teste. */
export function btmCanUseSkill(skillDef: BtmSkill, training: BtmTraining): boolean {
  return skillDef.trainedOnly !== 'sim' || training !== 'destreinado';
}

// --------------------------------------------------------------------------- Raças (p. 14–33)

export interface BtmSubrace {
  name: string;
  bonuses: Partial<Record<BtmAttribute, number>>;
  features: string[];
}

export interface BtmRace {
  id: string;
  name: string;
  description: string;
  bonuses: Partial<Record<BtmAttribute, number>>;
  /** Pontos extras para distribuir (Meio-elfo: +2 em qualquer atributo). */
  freeBonus?: number;
  features: string[];
  subraces: BtmSubrace[];
}

export const BTM_RACES: readonly BtmRace[] = [
  {
    id: 'draconato',
    name: 'Draconato',
    description: 'Compartilham uma linhagem com os dragões, aos quais eram obrigados a prestar serviços. Não costumam ter empatia uns com os outros.',
    bonuses: { for: 2, car: 1 },
    features: ['Sopro: exala uma energia destrutiva; o tipo de dano e a área dependem da linhagem dracônica (a sub-raça).'],
    subraces: [
      { name: 'Latão (fogo)', bonuses: {}, features: ['Elemento fogo. Habilidade: Sono.'] },
      { name: 'Ouro (fogo)', bonuses: {}, features: ['Elemento fogo. Habilidade: Esconder.'] },
      { name: 'Vermelho (fogo)', bonuses: {}, features: ['Elemento fogo. Habilidade: Mãos Ardentes.'] },
      { name: 'Prata (gelo)', bonuses: {}, features: ['Elemento gelo. Habilidade: Espinhos de Prata.'] },
      { name: 'Branco (gelo)', bonuses: {}, features: ['Elemento gelo. Habilidade: Armadura de Gelo.'] },
      { name: 'Azul (raio)', bonuses: {}, features: ['Elemento raio. Habilidade: Chuva.'] },
      { name: 'Bronze (raio)', bonuses: {}, features: ['Elemento raio. Habilidade: Névoa.'] },
      { name: 'Preto (ácido)', bonuses: {}, features: ['Elemento ácido. Habilidade: Óleo.'] },
      { name: 'Cobre (ácido)', bonuses: {}, features: ['Elemento ácido. Habilidade: Condução.'] },
      { name: 'Verde (veneno)', bonuses: {}, features: ['Elemento veneno. Habilidade: Doença.'] },
    ],
  },
  {
    id: 'anao',
    name: 'Anão',
    description: 'Turbulentos e gananciosos, superprotetores das suas tradições; não mantêm boa relação com goblins e orcs.',
    bonuses: { con: 2 },
    features: ['Armamento Anão: proficiência com machados e martelos de guerra.', 'Resiliência Anã: vantagem em testes de resistência a venenos e resistência a dano de veneno.'],
    subraces: [
      { name: 'Anão Dourado', bonuses: { sab: 1 }, features: ['Resistência: +1 PV por nível.'] },
      { name: 'Anão do Escudo', bonuses: { for: 2 }, features: ['Proficiência em armaduras leves e médias.'] },
    ],
  },
  {
    id: 'elfo',
    name: 'Elfo',
    description: 'Podem viver por milhares de anos; interessados por magia e pela natureza.',
    bonuses: { des: 2 },
    features: ['Sentido: vantagem em testes de Percepção.', 'Ancestralidade: magia não pode fazer você dormir.', 'Armamento Élfico: proficiência com espadas e arco.', 'Visão Noturna: enxerga silhuetas no escuro.'],
    subraces: [
      { name: 'Elfo da Floresta', bonuses: { sab: 1 }, features: ['Ligeiro: aumenta a velocidade de movimento.', 'Camuflagem: proficiência em Furtividade.'] },
      { name: 'Elfo Altaneiro', bonuses: { int: 1 }, features: ['Um truque à sua escolha.'] },
    ],
  },
  {
    id: 'githyanki',
    name: 'Githyanki',
    description: 'Orgulhosos, mas viveram um passado terrível, escravizados pelos Tieflings.',
    bonuses: { int: 1, for: 2 },
    features: ['Maestria: aprende um idioma novo e é proficiente em um conjunto de ferramentas.', 'Prodígio Marcial: proficiência em armaduras leves e médias e espadas menores e longas.'],
    subraces: [],
  },
  {
    id: 'gnomo',
    name: 'Gnomo',
    description: 'Curiosos, inventivos e com grande conhecimento mágico.',
    bonuses: { int: 2 },
    features: ['Astúcia: vantagem em todos os testes de resistência a magia baseados em Inteligência, Sabedoria e Carisma.'],
    subraces: [
      { name: 'Gnomo da Natureza', bonuses: { des: 1 }, features: ['Falar com animais.', 'Visão Noturna: enxerga silhuetas no escuro.'] },
      { name: 'Gnomo das Rochas', bonuses: { con: 1 }, features: ['Visão Noturna: enxerga silhuetas no escuro.', 'Camuflagem.'] },
    ],
  },
  {
    id: 'meio-elfo',
    name: 'Meio-elfo',
    description: 'Ambiciosos; a linhagem dividida cria tensão entre humanos e elfos, que os afasta de ambos.',
    bonuses: { car: 2 },
    freeBonus: 2,
    features: ['Ancestralidade: magia não pode fazer você dormir.', 'Visão Noturna: enxerga silhuetas no escuro.'],
    subraces: [
      { name: 'Meio-elfo Altaneiro', bonuses: {}, features: ['Um truque à sua escolha.'] },
      { name: 'Meio-elfo Drow', bonuses: {}, features: ['Luzes Bruxuleantes: faz luz; no nível 3 desbloqueia uma magia de fogo; no nível 5, uma magia de escuridão.'] },
    ],
  },
  {
    id: 'drow',
    name: 'Drow',
    description: 'Raça desprezada que vive nos subsolos; alguns sobem à superfície mesmo odiados por todos.',
    bonuses: { car: 1, des: 2 },
    features: ['Visão Superior: enxerga perfeitamente no escuro.', 'Armamento Drow: proficiência em espadas curtas e bestas.', 'Ancestralidade: magia não pode fazer você dormir.'],
    subraces: [
      { name: 'Drow Jurado', bonuses: {}, features: ['Luzes Bruxuleantes: faz luz; nível 3, uma magia de fogo; nível 5, uma magia de escuridão.'] },
      { name: 'Drow Soldado', bonuses: {}, features: ['Luzes Bruxuleantes: faz luz; nível 3, uma magia de gelo; nível 5, uma magia de escuridão.'] },
    ],
  },
  {
    id: 'halfling',
    name: 'Halfling',
    description: 'Gostam de bebida e companhia; ágeis, surpreendem quando enfrentados numa luta.',
    bonuses: { des: 2 },
    features: ['Sorte: ao rolar 1 no d20 em ataque, defesa ou resistência, pode rolar de novo.'],
    subraces: [
      { name: 'Halfling Ligeiro', bonuses: { car: 1 }, features: ['Naturalmente Furtivo: proficiência em Furtividade.'] },
      { name: 'Halfling Imbatível', bonuses: { con: 1 }, features: ['Imunidade: vantagem em testes de resistência a venenos e resistência a dano de veneno.'] },
    ],
  },
  {
    id: 'meio-orc',
    name: 'Meio-orc',
    description: 'Raça bruta, que costuma agir sem pensar; criaturas de emoções intensas.',
    bonuses: { for: 2, con: 1 },
    features: ['Ataque Selvagem: no acerto crítico, rola um dado extra de dano da arma e soma.', 'Dead Hard: uma vez por dia, ao cair a 0 PV, volta para 1 PV.'],
    subraces: [],
  },
  {
    id: 'humano',
    name: 'Humano',
    description: 'A raça mais comum da Ilha de Éden, conhecida pela inteligência e adaptabilidade.',
    bonuses: { for: 1, des: 1, con: 1, int: 1, sab: 1, car: 1 },
    features: ['Sem vantagens raciais.'],
    subraces: [],
  },
  {
    id: 'tiefling',
    name: 'Tiefling',
    description: 'Vítimas de preconceito pela pele avermelhada e pelos chifres, resultado de um antigo pacto.',
    bonuses: { car: 2 },
    features: ['Visão Noturna: enxerga silhuetas no escuro.', 'Resistência Infernal: resistência a dano de fogo.'],
    subraces: [
      { name: 'Tiefling Mefistófeles', bonuses: { int: 1 }, features: ['Mão Mágica: ações com a força da mente; nível 3, uma magia de fogo; nível 5, outra magia de fogo.'] },
      { name: 'Tiefling Zariel', bonuses: { for: 1 }, features: ['Taumaturgia: impressiona com milagres; nível 3, uma magia de destruição; nível 5, uma magia de marca.'] },
    ],
  },
];

// --------------------------------------------------------------------------- Classes (p. 34–48)

export interface BtmClass {
  id: string;
  name: string;
  description: string;
  subclasses: { name: string; description: string }[];
}

const cls = (id: string, name: string, description: string, subclasses: [string, string][]): BtmClass => ({
  id,
  name,
  description,
  subclasses: subclasses.map(([subName, subDescription]) => ({ name: subName, description: subDescription })),
});

export const BTM_CLASSES: readonly BtmClass[] = [
  cls('barbaro', 'Bárbaro', 'Focado em ataques corpo a corpo, com força bruta e sem muita preocupação com a própria vida.', [
    ['Berserker', 'Soma da fúria com o frenesi: ataca sem consideração pela própria vida.'],
    ['Fanático', 'Alimentado pelo poder de um deus, que intervém para mantê-lo vivo.'],
    ['Fera', 'Descendente de licantropos ou fadas, ou com criaturas dentro da alma.'],
  ]),
  cls('bardo', 'Bardo', 'Voltado ao combate à distância; usa o poder da música para canalizar magia.', [
    ['Intelectual', 'Magias de suporte em palavras, como cura em massa.'],
    ['Hunter', 'Maximiza o ataque de um aliado e recebe proficiência em armaduras, escudos e armas.'],
    ['Charm', 'Atua por um período, enfeitiçando vários inimigos.'],
  ]),
  cls('clerigo', 'Clérigo', 'Mantém os aliados vivos sem ficar de fora das batalhas, com magia e armas.', [
    ['Naturalista', 'Segue deuses que protegem a natureza, em troca de algo benéfico.'],
    ['Storm', 'Segue deuses dos raios; os marinheiros são os que mais os adoram.'],
    ['Guerreiro', 'Expõe-se mais em combate: um curandeiro guerreiro.'],
  ]),
  cls('druida', 'Druida', 'Contato direto com a natureza; assume formas de animais em combate.', [
    ['Faísca', 'Conexão com as Fazendas Angelicais, fora do espaço-tempo: teletransporte.'],
    ['Mestre', 'Invocador de animais, que o obedecem no campo de batalha.'],
    ['Natalista', 'Ganha o poder do reino, vilarejo ou cidade onde se tornou druida.'],
  ]),
  cls('lutador', 'Lutador', 'Usa vários tipos de combate e pode se especializar em um.', [
    ['Marcial', 'Abandona magias por habilidades físicas e aprende vários tipos de luta.'],
    ['Arqueador', 'Magia oculta antiga: flechas sobrecarregadas com efeitos.'],
    ['Cavaleiro', 'Com a montaria, marca oponentes (desvantagem neles) e faz vários ataques.'],
  ]),
  cls('monge', 'Monge', 'Usa artes marciais ou bastões; o corpo é uma verdadeira máquina.', [
    ['Luminoso', 'Segue o Deus do Sol e ganha poderes solares.'],
    ['Sensei', 'Treina com uma só arma corpo a corpo, excluindo as demais.'],
    ['Elementista', 'Extrai energia dos elementos: a Força Espectral ("Ki" ou "Chacra").'],
  ]),
  cls('paladino', 'Paladino', 'Movido por uma doutrina rígida, geralmente um juramento a um deus.', [
    ['Analista', 'Perito em destruir e banir criaturas de outros planos.'],
    ['Benevolente', 'Leal aos anjos celestiais e deuses bondosos; caça mortos-vivos e demônios.'],
    ['Manancial', 'Desde o início dos tempos ao lado do bem: a força suprema da luz.'],
  ]),
  cls('guardiao', 'Guardião', 'Sobrevivência e conexão com a natureza; armas de curto alcance e arco e flecha.', [
    ['Predador', 'Dedicou a vida a exterminar uma raça específica.'],
    ['Brutal', 'Enfrenta vários inimigos ao mesmo tempo; especialista em armas.'],
    ['Colmeia', 'Enxames e alcateias atendem ao seu chamado.'],
  ]),
  cls('vigarista', 'Vigarista', 'Extremamente furtivo: ataca e rouba itens mesmo em batalha.', [
    ['Psico', 'Poderes psíquicos; os ataques podem corromper mentes.'],
    ['Arcano', 'Combina magias aos ataques.'],
    ['Lapidado', 'Conexão com a morte: ataques cortantes à distância.'],
  ]),
  cls('feiticeiro', 'Feiticeiro', 'Poder no sangue; pode controlar o clima mesmo em batalha.', [
    ['Sombrio', 'Magia da ruindade interior; o uso excessivo pode amaldiçoá-lo ou dominá-lo.'],
    ['Purificado', 'Curandeiro invocador: poderes de cura.'],
    ['Assustador', 'Poder psiônico vindo de uma entidade ou objeto amaldiçoado; magias mentais.'],
  ]),
  cls('bruxo', 'Bruxo', 'Poder mágico vindo de um pacto com alguma entidade.', [
    ['Intangível', 'Pacto com a Senhora Morte para enganá-la várias vezes.'],
    ['Poseidon', 'Amigo do Deus do Mar, nas profundezas.'],
    ['Morto', 'Seres antigos que deveriam estar mortos, mas não estão.'],
  ]),
  cls('mago', 'Mago', 'Personagem à base de magia; os poderes vêm da subclasse.', [
    ['Ocultista', 'Altera a aparência dos objetos.'],
    ['Briguento', 'Briga mesmo sendo um invocador de magia.'],
    ['Defensivo', 'Feitiços de proteção, bloqueio e banimento.'],
  ]),
];

// --------------------------------------------------------------------------- Utensílios (p. 59–68)

export type BtmArmor = 'nenhuma' | 'leve' | 'media' | 'pesada';
/** Bônus na Defesa Corporal (p. 64). */
export const btmArmorDefense: Record<BtmArmor, number> = { nenhuma: 0, leve: 2, media: 3, pesada: 5 };
/** Penalidades de ataque (p. 62–63). */
export const btmAttackPenalties = {
  arremessarArmaNaoFeitaParaIsso: -4,
  armaImprovisada: -4,
  armaSemProficiencia: -4,
  armaDuplaNaoFeitaParaIsso: -10,
  distanciaComoCorpoACorpo: -4,
} as const;

export const BTM_ELEMENTS = ['Luz', 'Psíquico', 'Veneno', 'Neutro', 'Gelo', 'Terra', 'Plasma', 'Ar', 'Fogo', 'Eletricidade', 'Escuridão'] as const;

/** Mana remanescente (p. 72–73): cada tipo exige um preço para ser usado. */
export const BTM_MANA_TYPES = [
  { id: 'natural', name: 'Natural', cost: 'sacrifícios' },
  { id: 'mortal', name: 'Mortal', cost: 'ossos' },
  { id: 'magica', name: 'Mágica', cost: 'mox' },
  { id: 'infernal', name: 'Infernal', cost: 'pacto' },
] as const;

/** Runas de 1º mandamento dadas como exemplo (p. 75). */
export const BTM_STARTING_RUNES = [
  { name: 'Telecinese Inicial', commandment: 1, text: 'Abre e fecha um objeto de menor porte.' },
  { name: 'Luminescência', commandment: 1, text: 'Faz algum objeto brilhar igual a uma tocha.' },
  { name: 'Anti Morto-vivo', commandment: 1, text: 'Causa 1d6 de dano em um morto-vivo.' },
] as const;

// --------------------------------------------------------------------------- Testes de jogo (p. 77–98)

/** Resistir a magia (p. 89): 1d20 + Inteligência + metade do nível (para baixo). */
export function btmResistMagicExpression(intelligence: number, level: number): string {
  const bonus = intelligence + Math.floor(level / 2);
  return `1d20${bonus >= 0 ? '+' : ''}${bonus}`;
}

/** Contra-atacar (p. 90): 1d20 + Força. */
export function btmCounterAttackExpression(strength: number): string {
  return `1d20${strength >= 0 ? '+' : ''}${strength}`;
}

/** Esquivar (p. 91): Defesa Corporal + Destreza (sem rolagem). */
export function btmDodgeValue(bodyDefense: number, dexterity: number): number {
  return bodyDefense + dexterity;
}

/** Bloquear (p. 91): toma metade do dano, arredondando para baixo (p. 98). */
export function btmBlockedDamage(damage: number): number {
  return Math.floor(damage / 2);
}

/** Acerto crítico (p. 98): 20 natural; o dano é o máximo da fórmula (ex.: 2d8+3 = 19). */
export function btmCriticalDamage(formula: string): number {
  let total = 0;
  for (const match of formula.replace(/\s+/g, '').matchAll(/([+-]?)(\d*)d(\d+)|([+-]?)(\d+)/gi)) {
    if (match[3]) total += (match[1] === '-' ? -1 : 1) * (Number(match[2]) || 1) * Number(match[3]);
    else if (match[5]) total += (match[4] === '-' ? -1 : 1) * Number(match[5]);
  }
  return total;
}

/** Teste de resistência mental (p. 77): 1d100 igual ou menor que o NCM resiste. */
export function btmResistsSanity(roll: number, ncm: number): boolean {
  return roll <= ncm;
}

/** Morte (p. 78): 0 PV = inconsciente; morre ao chegar ao negativo de metade dos PV máximos. */
export function btmLifeState(current: number, max: number): 'ok' | 'inconsciente' | 'morto' {
  if (current <= -Math.floor(max / 2)) return 'morto';
  return current <= 0 ? 'inconsciente' : 'ok';
}

/** Prestar ajuda (p. 81): cada ajudante que passa na DT 12 dá +1 ao líder. */
export const BTM_HELP_DT = 12;
/** Condições favoráveis e desfavoráveis (p. 80). */
export const btmConditionModifiers = { favoravel: 3, desfavoravel: -3 } as const;
/** Movimento (p. 82–86) em metros por turno. */
export const btmMovement = { normal: 10, maximoMedio: 10, maximoPequeno: 8, rastejando: 5, esgueirando: 5, nadando: 5, escalando: 2.5 } as const;
/** Queda (p. 86): 1d8 a cada 10 m. */
export function btmFallDamage(heightMeters: number): string | null {
  const dice = Math.floor(heightMeters / 10);
  return dice > 0 ? `${dice}d8` : null;
}
