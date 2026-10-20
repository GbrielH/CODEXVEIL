import type { T20Attribute } from './attributes';

export interface T20SkillDefinition {
  label: string;
  attribute: T20Attribute;
  /** Só pode ser usada por quem é treinado. */
  trainedOnly: boolean;
  /** Sofre penalidade de armadura. */
  armorPenalty: boolean;
}

/** As 29 perícias do Tormenta20, com o atributo-chave. */
export const T20_SKILLS = {
  acrobacia: { label: 'Acrobacia', attribute: 'des', trainedOnly: false, armorPenalty: true },
  adestramento: { label: 'Adestramento', attribute: 'car', trainedOnly: true, armorPenalty: false },
  atletismo: { label: 'Atletismo', attribute: 'for', trainedOnly: false, armorPenalty: false },
  atuacao: { label: 'Atuação', attribute: 'car', trainedOnly: true, armorPenalty: false },
  cavalgar: { label: 'Cavalgar', attribute: 'des', trainedOnly: false, armorPenalty: false },
  conhecimento: { label: 'Conhecimento', attribute: 'int', trainedOnly: true, armorPenalty: false },
  cura: { label: 'Cura', attribute: 'sab', trainedOnly: false, armorPenalty: false },
  diplomacia: { label: 'Diplomacia', attribute: 'car', trainedOnly: false, armorPenalty: false },
  enganacao: { label: 'Enganação', attribute: 'car', trainedOnly: false, armorPenalty: false },
  fortitude: { label: 'Fortitude', attribute: 'con', trainedOnly: false, armorPenalty: false },
  furtividade: { label: 'Furtividade', attribute: 'des', trainedOnly: false, armorPenalty: true },
  guerra: { label: 'Guerra', attribute: 'int', trainedOnly: true, armorPenalty: false },
  iniciativa: { label: 'Iniciativa', attribute: 'des', trainedOnly: false, armorPenalty: false },
  intimidacao: { label: 'Intimidação', attribute: 'car', trainedOnly: false, armorPenalty: false },
  intuicao: { label: 'Intuição', attribute: 'sab', trainedOnly: false, armorPenalty: false },
  investigacao: { label: 'Investigação', attribute: 'int', trainedOnly: false, armorPenalty: false },
  jogatina: { label: 'Jogatina', attribute: 'car', trainedOnly: true, armorPenalty: false },
  ladinagem: { label: 'Ladinagem', attribute: 'des', trainedOnly: true, armorPenalty: true },
  luta: { label: 'Luta', attribute: 'for', trainedOnly: false, armorPenalty: false },
  misticismo: { label: 'Misticismo', attribute: 'int', trainedOnly: true, armorPenalty: false },
  nobreza: { label: 'Nobreza', attribute: 'int', trainedOnly: true, armorPenalty: false },
  oficio: { label: 'Ofício', attribute: 'int', trainedOnly: true, armorPenalty: false },
  percepcao: { label: 'Percepção', attribute: 'sab', trainedOnly: false, armorPenalty: false },
  pilotagem: { label: 'Pilotagem', attribute: 'des', trainedOnly: true, armorPenalty: false },
  pontaria: { label: 'Pontaria', attribute: 'des', trainedOnly: false, armorPenalty: false },
  reflexos: { label: 'Reflexos', attribute: 'des', trainedOnly: false, armorPenalty: false },
  religiao: { label: 'Religião', attribute: 'sab', trainedOnly: true, armorPenalty: false },
  sobrevivencia: { label: 'Sobrevivência', attribute: 'sab', trainedOnly: false, armorPenalty: false },
  vontade: { label: 'Vontade', attribute: 'sab', trainedOnly: false, armorPenalty: false },
} as const satisfies Record<string, T20SkillDefinition>;

export type T20Skill = keyof typeof T20_SKILLS;
export const T20_SKILL_IDS = Object.keys(T20_SKILLS) as T20Skill[];

/** Testes de resistência são estas três perícias. */
export const T20_SAVES = ['fortitude', 'reflexos', 'vontade'] as const satisfies readonly T20Skill[];

function plain(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Perícia pelo nome em português ("Ofício (alquimista)" → `oficio`); `undefined` se não for uma perícia. */
export function t20SkillFromName(name: string): T20Skill | undefined {
  const key = plain(name.replace(/\s*\(.*$/, ''));
  return T20_SKILL_IDS.find((id) => plain(T20_SKILLS[id].label) === key);
}

/** Bônus de treinamento: +2 do 1º ao 6º nível, +4 do 7º ao 14º, +6 do 15º em diante. */
export function t20TrainingBonus(level: number): number {
  if (level >= 15) return 6;
  if (level >= 7) return 4;
  return 2;
}

/** Para que serve cada perícia (resumo curto escrito pelo Codexveil, não o texto do livro). */
export const t20SkillSummaries: Record<T20Skill, string> = {
  acrobacia: 'Equilíbrio, saltos e manobras ágeis; escapar de agarrões.',
  adestramento: 'Lidar com animais: acalmar, treinar e conduzir montarias.',
  atletismo: 'Correr, escalar, nadar, saltar e outras proezas de força.',
  atuacao: 'Cantar, tocar, dançar e entreter uma plateia.',
  cavalgar: 'Montar e conduzir montarias, inclusive em combate.',
  conhecimento: 'Saber sobre história, geografia, ciências e lendas.',
  cura: 'Primeiros socorros, tratar doenças, venenos e ferimentos.',
  diplomacia: 'Convencer e negociar com boas maneiras.',
  enganacao: 'Mentir, disfarçar-se e blefar.',
  fortitude: 'Resistir a venenos, doenças e esforço físico.',
  furtividade: 'Esconder-se e mover-se sem ser notado.',
  guerra: 'Táticas, estratégia e conhecimento militar.',
  iniciativa: 'Agir rápido quando o combate começa.',
  intimidacao: 'Assustar e coagir com ameaças.',
  intuicao: 'Perceber mentiras e intenções ocultas.',
  investigacao: 'Procurar pistas, examinar e deduzir.',
  jogatina: 'Jogos de azar e apostas.',
  ladinagem: 'Abrir fechaduras, desarmar armadilhas e furtar.',
  luta: 'Ataques corpo a corpo.',
  misticismo: 'Magia, itens mágicos e o sobrenatural.',
  nobreza: 'Etiqueta, heráldica, leis e a nobreza.',
  oficio: 'Uma profissão ou arte (ferreiro, alquimista, cozinheiro…).',
  percepcao: 'Notar coisas pela visão, audição e outros sentidos.',
  pilotagem: 'Conduzir veículos e embarcações.',
  pontaria: 'Ataques à distância.',
  reflexos: 'Esquivar de áreas de efeito e armadilhas.',
  religiao: 'Deuses, igrejas, rituais e criaturas divinas.',
  sobrevivencia: 'Rastrear, orientar-se e sobreviver na natureza.',
  vontade: 'Resistir a efeitos mentais e de medo.',
};

