/**
 * Armas, armaduras, ferramentas e itens do SRD 5.2.1 usados no equipamento inicial.
 * Pesos em libras, como no SRD; a criação converte para a unidade da ficha.
 */
import type { ArmorDefinition, DamageType, ItemDefinition, WeaponDefinition, WeaponMastery, WeaponProperty } from './types';

export const damageTypeLabels: Record<DamageType, string> = {
  acid: 'Ácido',
  bludgeoning: 'Concussão',
  cold: 'Frio',
  fire: 'Fogo',
  force: 'Energia',
  lightning: 'Elétrico',
  necrotic: 'Necrótico',
  piercing: 'Perfurante',
  poison: 'Veneno',
  psychic: 'Psíquico',
  radiant: 'Radiante',
  slashing: 'Cortante',
  thunder: 'Trovejante',
};

export const weaponPropertyLabels: Record<WeaponProperty, string> = {
  ammunition: 'Munição',
  finesse: 'Acuidade',
  heavy: 'Pesada',
  light: 'Leve',
  loading: 'Recarga',
  reach: 'Alcance',
  thrown: 'Arremesso',
  two_handed: 'Duas mãos',
  versatile: 'Versátil',
};

export const weaponMasteryLabels: Record<WeaponMastery, { name: string; description: string }> = {
  cleave: { name: 'Trespassar', description: 'Ao acertar, faz um ataque extra contra outra criatura a até 1,5 m do alvo (uma vez por turno), sem somar o modificador ao dano.' },
  graze: { name: 'Raspão', description: 'Ao errar, o alvo sofre dano igual ao modificador de atributo usado no ataque.' },
  nick: { name: 'Corte Rápido', description: 'O ataque extra da propriedade Leve pode ser feito como parte da ação de Ataque, uma vez por turno.' },
  push: { name: 'Empurrão', description: 'Ao acertar, empurra a criatura (Grande ou menor) até 3 m para longe.' },
  sap: { name: 'Enfraquecer', description: 'Ao acertar, o alvo tem Desvantagem na próxima jogada de ataque antes do seu próximo turno.' },
  slow: { name: 'Lentidão', description: 'Ao acertar e causar dano, reduz o Deslocamento do alvo em 3 m até o início do seu próximo turno.' },
  topple: { name: 'Derrubar', description: 'Ao acertar, o alvo faz um teste de resistência de Constituição ou fica Caído.' },
  vex: { name: 'Irritar', description: 'Ao acertar e causar dano, você tem Vantagem no próximo ataque contra essa criatura antes do fim do seu próximo turno.' },
};

function weapon(definition: WeaponDefinition): WeaponDefinition {
  return definition;
}

export const SRD_WEAPONS: Record<string, WeaponDefinition> = Object.fromEntries(
  [
    // Armas simples corpo a corpo
    weapon({ id: 'club', name: 'Clava', category: 'simple', kind: 'melee', damage: '1d4', damageType: 'bludgeoning', properties: ['light'], mastery: 'slow', weightLb: 2 }),
    weapon({ id: 'dagger', name: 'Adaga', category: 'simple', kind: 'melee', damage: '1d4', damageType: 'piercing', properties: ['finesse', 'light', 'thrown'], range: [20, 60], mastery: 'nick', weightLb: 1 }),
    weapon({ id: 'greatclub', name: 'Clava grande', category: 'simple', kind: 'melee', damage: '1d8', damageType: 'bludgeoning', properties: ['two_handed'], mastery: 'push', weightLb: 10 }),
    weapon({ id: 'handaxe', name: 'Machadinha', category: 'simple', kind: 'melee', damage: '1d6', damageType: 'slashing', properties: ['light', 'thrown'], range: [20, 60], mastery: 'vex', weightLb: 2 }),
    weapon({ id: 'javelin', name: 'Azagaia', category: 'simple', kind: 'melee', damage: '1d6', damageType: 'piercing', properties: ['thrown'], range: [30, 120], mastery: 'slow', weightLb: 2 }),
    weapon({ id: 'light_hammer', name: 'Martelo leve', category: 'simple', kind: 'melee', damage: '1d4', damageType: 'bludgeoning', properties: ['light', 'thrown'], range: [20, 60], mastery: 'nick', weightLb: 2 }),
    weapon({ id: 'mace', name: 'Maça', category: 'simple', kind: 'melee', damage: '1d6', damageType: 'bludgeoning', properties: [], mastery: 'sap', weightLb: 4 }),
    weapon({ id: 'quarterstaff', name: 'Bordão', category: 'simple', kind: 'melee', damage: '1d6', damageType: 'bludgeoning', properties: ['versatile'], versatileDamage: '1d8', mastery: 'topple', weightLb: 4 }),
    weapon({ id: 'sickle', name: 'Foice curta', category: 'simple', kind: 'melee', damage: '1d4', damageType: 'slashing', properties: ['light'], mastery: 'nick', weightLb: 2 }),
    weapon({ id: 'spear', name: 'Lança', category: 'simple', kind: 'melee', damage: '1d6', damageType: 'piercing', properties: ['thrown', 'versatile'], versatileDamage: '1d8', range: [20, 60], mastery: 'sap', weightLb: 3 }),
    // Armas simples à distância
    weapon({ id: 'dart', name: 'Dardo', category: 'simple', kind: 'ranged', damage: '1d4', damageType: 'piercing', properties: ['finesse', 'thrown'], range: [20, 60], mastery: 'vex', weightLb: 0.25 }),
    weapon({ id: 'light_crossbow', name: 'Besta leve', category: 'simple', kind: 'ranged', damage: '1d8', damageType: 'piercing', properties: ['ammunition', 'loading', 'two_handed'], range: [80, 320], mastery: 'slow', weightLb: 5 }),
    weapon({ id: 'shortbow', name: 'Arco curto', category: 'simple', kind: 'ranged', damage: '1d6', damageType: 'piercing', properties: ['ammunition', 'two_handed'], range: [80, 320], mastery: 'vex', weightLb: 2 }),
    weapon({ id: 'sling', name: 'Funda', category: 'simple', kind: 'ranged', damage: '1d4', damageType: 'bludgeoning', properties: ['ammunition'], range: [30, 120], mastery: 'slow', weightLb: 0 }),
    // Armas marciais corpo a corpo
    weapon({ id: 'battleaxe', name: 'Machado de batalha', category: 'martial', kind: 'melee', damage: '1d8', damageType: 'slashing', properties: ['versatile'], versatileDamage: '1d10', mastery: 'topple', weightLb: 4 }),
    weapon({ id: 'flail', name: 'Mangual', category: 'martial', kind: 'melee', damage: '1d8', damageType: 'bludgeoning', properties: [], mastery: 'sap', weightLb: 2 }),
    weapon({ id: 'glaive', name: 'Glaive', category: 'martial', kind: 'melee', damage: '1d10', damageType: 'slashing', properties: ['heavy', 'reach', 'two_handed'], mastery: 'graze', weightLb: 6 }),
    weapon({ id: 'greataxe', name: 'Machado grande', category: 'martial', kind: 'melee', damage: '1d12', damageType: 'slashing', properties: ['heavy', 'two_handed'], mastery: 'cleave', weightLb: 7 }),
    weapon({ id: 'greatsword', name: 'Espada grande', category: 'martial', kind: 'melee', damage: '2d6', damageType: 'slashing', properties: ['heavy', 'two_handed'], mastery: 'graze', weightLb: 6 }),
    weapon({ id: 'halberd', name: 'Alabarda', category: 'martial', kind: 'melee', damage: '1d10', damageType: 'slashing', properties: ['heavy', 'reach', 'two_handed'], mastery: 'cleave', weightLb: 6 }),
    weapon({ id: 'lance', name: 'Lança de montaria', category: 'martial', kind: 'melee', damage: '1d10', damageType: 'piercing', properties: ['heavy', 'reach', 'two_handed'], mastery: 'topple', weightLb: 6 }),
    weapon({ id: 'longsword', name: 'Espada longa', category: 'martial', kind: 'melee', damage: '1d8', damageType: 'slashing', properties: ['versatile'], versatileDamage: '1d10', mastery: 'sap', weightLb: 3 }),
    weapon({ id: 'maul', name: 'Malho', category: 'martial', kind: 'melee', damage: '2d6', damageType: 'bludgeoning', properties: ['heavy', 'two_handed'], mastery: 'topple', weightLb: 10 }),
    weapon({ id: 'morningstar', name: 'Maça-estrela', category: 'martial', kind: 'melee', damage: '1d8', damageType: 'piercing', properties: [], mastery: 'sap', weightLb: 4 }),
    weapon({ id: 'pike', name: 'Pique', category: 'martial', kind: 'melee', damage: '1d10', damageType: 'piercing', properties: ['heavy', 'reach', 'two_handed'], mastery: 'push', weightLb: 18 }),
    weapon({ id: 'rapier', name: 'Rapieira', category: 'martial', kind: 'melee', damage: '1d8', damageType: 'piercing', properties: ['finesse'], mastery: 'vex', weightLb: 2 }),
    weapon({ id: 'scimitar', name: 'Cimitarra', category: 'martial', kind: 'melee', damage: '1d6', damageType: 'slashing', properties: ['finesse', 'light'], mastery: 'nick', weightLb: 3 }),
    weapon({ id: 'shortsword', name: 'Espada curta', category: 'martial', kind: 'melee', damage: '1d6', damageType: 'piercing', properties: ['finesse', 'light'], mastery: 'vex', weightLb: 2 }),
    weapon({ id: 'trident', name: 'Tridente', category: 'martial', kind: 'melee', damage: '1d8', damageType: 'piercing', properties: ['thrown', 'versatile'], versatileDamage: '1d10', range: [20, 60], mastery: 'topple', weightLb: 4 }),
    weapon({ id: 'warhammer', name: 'Martelo de guerra', category: 'martial', kind: 'melee', damage: '1d8', damageType: 'bludgeoning', properties: ['versatile'], versatileDamage: '1d10', mastery: 'push', weightLb: 5 }),
    weapon({ id: 'war_pick', name: 'Picareta de guerra', category: 'martial', kind: 'melee', damage: '1d8', damageType: 'piercing', properties: ['versatile'], versatileDamage: '1d10', mastery: 'sap', weightLb: 2 }),
    weapon({ id: 'whip', name: 'Chicote', category: 'martial', kind: 'melee', damage: '1d4', damageType: 'slashing', properties: ['finesse', 'reach'], mastery: 'slow', weightLb: 3 }),
    // Armas marciais à distância
    weapon({ id: 'blowgun', name: 'Zarabatana', category: 'martial', kind: 'ranged', damage: '1', damageType: 'piercing', properties: ['ammunition', 'loading'], range: [25, 100], mastery: 'vex', weightLb: 1 }),
    weapon({ id: 'hand_crossbow', name: 'Besta de mão', category: 'martial', kind: 'ranged', damage: '1d6', damageType: 'piercing', properties: ['ammunition', 'light', 'loading'], range: [30, 120], mastery: 'vex', weightLb: 3 }),
    weapon({ id: 'heavy_crossbow', name: 'Besta pesada', category: 'martial', kind: 'ranged', damage: '1d10', damageType: 'piercing', properties: ['ammunition', 'heavy', 'loading', 'two_handed'], range: [100, 400], mastery: 'push', weightLb: 18 }),
    weapon({ id: 'longbow', name: 'Arco longo', category: 'martial', kind: 'ranged', damage: '1d8', damageType: 'piercing', properties: ['ammunition', 'heavy', 'two_handed'], range: [150, 600], mastery: 'slow', weightLb: 2 }),
    weapon({ id: 'musket', name: 'Mosquete', category: 'martial', kind: 'ranged', damage: '1d12', damageType: 'piercing', properties: ['ammunition', 'loading', 'two_handed'], range: [40, 120], mastery: 'slow', weightLb: 10 }),
    weapon({ id: 'pistol', name: 'Pistola', category: 'martial', kind: 'ranged', damage: '1d10', damageType: 'piercing', properties: ['ammunition', 'loading'], range: [30, 90], mastery: 'vex', weightLb: 3 }),
  ].map((definition) => [definition.id, definition]),
);

function armor(definition: ArmorDefinition): ArmorDefinition {
  return definition;
}

export const SRD_ARMOR: Record<string, ArmorDefinition> = Object.fromEntries(
  [
    armor({ id: 'padded', name: 'Armadura acolchoada', category: 'light', armorClass: 11, dexterity: 'full', stealthDisadvantage: true, weightLb: 8 }),
    armor({ id: 'leather', name: 'Armadura de couro', category: 'light', armorClass: 11, dexterity: 'full', stealthDisadvantage: false, weightLb: 10 }),
    armor({ id: 'studded_leather', name: 'Armadura de couro batido', category: 'light', armorClass: 12, dexterity: 'full', stealthDisadvantage: false, weightLb: 13 }),
    armor({ id: 'hide', name: 'Gibão de peles', category: 'medium', armorClass: 12, dexterity: 'max2', stealthDisadvantage: false, weightLb: 12 }),
    armor({ id: 'chain_shirt', name: 'Camisão de malha', category: 'medium', armorClass: 13, dexterity: 'max2', stealthDisadvantage: false, weightLb: 20 }),
    armor({ id: 'scale_mail', name: 'Brunea', category: 'medium', armorClass: 14, dexterity: 'max2', stealthDisadvantage: true, weightLb: 45 }),
    armor({ id: 'breastplate', name: 'Peitoral', category: 'medium', armorClass: 14, dexterity: 'max2', stealthDisadvantage: false, weightLb: 20 }),
    armor({ id: 'half_plate', name: 'Meia-armadura', category: 'medium', armorClass: 15, dexterity: 'max2', stealthDisadvantage: true, weightLb: 40 }),
    armor({ id: 'ring_mail', name: 'Cota de anéis', category: 'heavy', armorClass: 14, dexterity: 'none', stealthDisadvantage: true, weightLb: 40 }),
    armor({ id: 'chain_mail', name: 'Cota de malha', category: 'heavy', armorClass: 16, dexterity: 'none', strength: 13, stealthDisadvantage: true, weightLb: 55 }),
    armor({ id: 'splint', name: 'Cota de talas', category: 'heavy', armorClass: 17, dexterity: 'none', strength: 15, stealthDisadvantage: true, weightLb: 60 }),
    armor({ id: 'plate', name: 'Armadura de placas', category: 'heavy', armorClass: 18, dexterity: 'none', strength: 15, stealthDisadvantage: true, weightLb: 65 }),
    armor({ id: 'shield', name: 'Escudo', category: 'shield', armorClass: 2, dexterity: 'none', stealthDisadvantage: false, weightLb: 6 }),
  ].map((definition) => [definition.id, definition]),
);

/** Preço das armaduras e do escudo em PO (SRD 5.2.1), para a compra com o ouro inicial. */
export const ARMOR_COST_GP: Record<string, number> = {
  padded: 5,
  leather: 10,
  studded_leather: 45,
  hide: 10,
  chain_shirt: 50,
  scale_mail: 50,
  breastplate: 400,
  half_plate: 750,
  ring_mail: 30,
  chain_mail: 75,
  splint: 200,
  plate: 1500,
  shield: 10,
};

/** Ferramentas de artesão (cada uma exige uma proficiência própria). */
export const ARTISAN_TOOLS = [
  { id: 'alchemists_supplies', name: 'Suprimentos de alquimista', weightLb: 8 },
  { id: 'brewers_supplies', name: 'Suprimentos de cervejeiro', weightLb: 9 },
  { id: 'calligraphers_supplies', name: 'Suprimentos de calígrafo', weightLb: 5 },
  { id: 'carpenters_tools', name: 'Ferramentas de carpinteiro', weightLb: 6 },
  { id: 'cartographers_tools', name: 'Ferramentas de cartógrafo', weightLb: 6 },
  { id: 'cobblers_tools', name: 'Ferramentas de sapateiro', weightLb: 5 },
  { id: 'cooks_utensils', name: 'Utensílios de cozinheiro', weightLb: 8 },
  { id: 'glassblowers_tools', name: 'Ferramentas de vidreiro', weightLb: 5 },
  { id: 'jewelers_tools', name: 'Ferramentas de joalheiro', weightLb: 2 },
  { id: 'leatherworkers_tools', name: 'Ferramentas de coureiro', weightLb: 5 },
  { id: 'masons_tools', name: 'Ferramentas de pedreiro', weightLb: 8 },
  { id: 'painters_supplies', name: 'Suprimentos de pintor', weightLb: 5 },
  { id: 'potters_tools', name: 'Ferramentas de oleiro', weightLb: 3 },
  { id: 'smiths_tools', name: 'Ferramentas de ferreiro', weightLb: 8 },
  { id: 'tinkers_tools', name: 'Ferramentas de funileiro', weightLb: 10 },
  { id: 'weavers_tools', name: 'Ferramentas de tecelão', weightLb: 5 },
  { id: 'woodcarvers_tools', name: 'Ferramentas de entalhador', weightLb: 5 },
] as const;

export const MUSICAL_INSTRUMENTS = [
  { id: 'bagpipes', name: 'Gaita de foles', weightLb: 6 },
  { id: 'drum', name: 'Tambor', weightLb: 3 },
  { id: 'dulcimer', name: 'Saltério', weightLb: 10 },
  { id: 'flute', name: 'Flauta', weightLb: 1 },
  { id: 'horn', name: 'Trompa', weightLb: 2 },
  { id: 'lute', name: 'Alaúde', weightLb: 2 },
  { id: 'lyre', name: 'Lira', weightLb: 2 },
  { id: 'pan_flute', name: 'Flauta de Pã', weightLb: 2 },
  { id: 'shawm', name: 'Charamela', weightLb: 1 },
  { id: 'viol', name: 'Viola de arco', weightLb: 1 },
] as const;

export const GAMING_SETS = [
  { id: 'dice', name: 'Dados', weightLb: null },
  { id: 'dragonchess', name: 'Xadrez dos dragões', weightLb: null },
  { id: 'playing_cards', name: 'Baralho', weightLb: null },
  { id: 'three_dragon_ante', name: 'Aposta dos Três Dragões', weightLb: null },
] as const;

/** Outras ferramentas com proficiência própria. */
export const OTHER_TOOLS = [
  { id: 'disguise_kit', name: 'Kit de disfarce', weightLb: 3 },
  { id: 'forgery_kit', name: 'Kit de falsificação', weightLb: 5 },
  { id: 'herbalism_kit', name: 'Kit de herbalismo', weightLb: 3 },
  { id: 'navigators_tools', name: 'Ferramentas de navegador', weightLb: 2 },
  { id: 'poisoners_kit', name: 'Kit de envenenador', weightLb: 2 },
  { id: 'thieves_tools', name: 'Ferramentas de ladrão', weightLb: 1 },
] as const;

export interface ToolOption {
  id: string;
  name: string;
  weightLb: number | null;
}

/** Todas as ferramentas que podem ser escolhidas como proficiência (ex.: talento Habilidoso). */
export const ALL_TOOLS: readonly ToolOption[] = [
  ...ARTISAN_TOOLS,
  ...OTHER_TOOLS,
  ...GAMING_SETS,
  ...MUSICAL_INSTRUMENTS,
];

export function findTool(id: string): ToolOption | undefined {
  return ALL_TOOLS.find((tool) => tool.id === id);
}

function item(definition: ItemDefinition): ItemDefinition {
  return definition;
}

/** Itens citados no equipamento inicial das classes e dos antecedentes. */
export const SRD_ITEMS: Record<string, ItemDefinition> = Object.fromEntries(
  [
    ...Object.values(SRD_WEAPONS).map((definition) =>
      item({ id: definition.id, name: definition.name, category: 'weapon', weightLb: definition.weightLb, weapon: definition.id }),
    ),
    ...Object.values(SRD_ARMOR).map((definition) =>
      item({ id: definition.id, name: definition.name, category: 'armor', weightLb: definition.weightLb, armor: definition.id }),
    ),
    ...ALL_TOOLS.map((tool) => item({ id: tool.id, name: tool.name, category: 'tool', weightLb: tool.weightLb })),
    item({ id: 'arrows', name: 'Flechas', category: 'gear', weightLb: 0.05, description: 'Munição para arcos (20 flechas pesam 0,5 kg).' }),
    item({ id: 'quiver', name: 'Aljava', category: 'gear', weightLb: 1, description: 'Comporta até 20 flechas.' }),
    item({ id: 'holy_symbol', name: 'Símbolo sagrado', category: 'gear', weightLb: 1, description: 'Foco de conjuração de clérigos e paladinos.' }),
    item({ id: 'druidic_focus', name: 'Foco druídico', category: 'gear', weightLb: null, description: 'Foco de conjuração de druidas e patrulheiros.' }),
    item({ id: 'arcane_focus_crystal', name: 'Foco arcano (cristal)', category: 'gear', weightLb: 1, description: 'Foco de conjuração de feiticeiros, bruxos e magos.' }),
    item({ id: 'arcane_focus_orb', name: 'Foco arcano (orbe)', category: 'gear', weightLb: 3, description: 'Foco de conjuração de feiticeiros, bruxos e magos.' }),
    item({ id: 'book', name: 'Livro', category: 'gear', weightLb: 5 }),
    item({ id: 'spellbook', name: 'Grimório', category: 'gear', weightLb: 3, description: 'Contém as magias de 1º círculo ou maior que o mago conhece.' }),
    item({ id: 'parchment', name: 'Pergaminho (folha)', category: 'gear', weightLb: null }),
    item({ id: 'robe', name: 'Manto', category: 'gear', weightLb: 4 }),
    item({ id: 'crowbar', name: 'Pé de cabra', category: 'gear', weightLb: 5, description: 'Dá Vantagem em testes de Força quando a alavanca ajuda.' }),
    item({ id: 'pouch', name: 'Bolsa', category: 'gear', weightLb: 1 }),
    item({ id: 'travelers_clothes', name: 'Roupas de viajante', category: 'gear', weightLb: 4 }),
    item({ id: 'healers_kit', name: 'Kit de primeiros socorros', category: 'consumable', weightLb: 3, description: '10 usos. Estabiliza uma criatura com 0 PV sem teste de Sabedoria (Medicina).' }),
    item({ id: 'explorers_pack', name: 'Pacote de explorador', category: 'gear', weightLb: 55, description: 'Mochila, saco de dormir, 2 frascos de óleo, rações para 10 dias, corda, estojo de pederneira, 10 tochas e odre.' }),
    item({ id: 'dungeoneers_pack', name: 'Pacote de aventureiro', category: 'gear', weightLb: 55, description: 'Mochila, estrepes, pé de cabra, 2 frascos de óleo, rações para 10 dias, corda, estojo de pederneira, 10 tochas e odre.' }),
    item({ id: 'entertainers_pack', name: 'Pacote de artista', category: 'gear', weightLb: 58.5, description: 'Mochila, saco de dormir, sino, lanterna focada, 3 fantasias, espelho, 8 frascos de óleo, rações para 9 dias, estojo de pederneira e odre.' }),
    item({ id: 'priests_pack', name: 'Pacote de sacerdote', category: 'gear', weightLb: 29, description: 'Mochila, cobertor, água benta, lamparina, rações para 7 dias, manto e estojo de pederneira.' }),
    item({ id: 'scholars_pack', name: 'Pacote de estudioso', category: 'gear', weightLb: 22, description: 'Mochila, livro, tinta, pena de escrever, lamparina, 10 frascos de óleo, 10 folhas de pergaminho e estojo de pederneira.' }),
    item({ id: 'burglars_pack', name: 'Pacote de assaltante', category: 'gear', weightLb: 42, description: 'Mochila, rolamentos, sino, 10 velas, pé de cabra, lanterna coberta, 7 frascos de óleo, rações para 5 dias, corda, estojo de pederneira e odre.' }),
  ].map((definition) => [definition.id, definition]),
);

/** Peso convertido para a unidade da ficha: 1 lb = 0,5 kg (mesma escala da capacidade de carga). */
export function weightForUnit(weightLb: number | null, unit: 'm' | 'ft'): number | null {
  if (weightLb === null) return null;
  const value = unit === 'm' ? weightLb / 2 : weightLb;
  return Math.round(value * 100) / 100;
}

/** Distância em pés convertida para a unidade da ficha: 5 pés = 1,5 m. */
export function distanceForUnit(feet: number, unit: 'm' | 'ft'): number {
  return unit === 'm' ? Math.round(feet * 0.3 * 10) / 10 : feet;
}

export function formatDistance(feet: number, unit: 'm' | 'ft'): string {
  const value = distanceForUnit(feet, unit);
  return `${String(value).replace('.', ',')} ${unit}`;
}
