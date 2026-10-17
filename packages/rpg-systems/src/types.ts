/**
 * Contrato que todo sistema de RPG precisa cumprir para ser usado no Codexveil.
 *
 * A camada central (campanhas, participantes, sessões, armazenamento) não conhece regras
 * de nenhum sistema. Ela guarda a ficha como JSON e delega a este módulo a validação,
 * os cálculos derivados, o resumo exibido em listas e os recursos iniciais.
 *
 * Para adicionar um sistema: crie `src/<id>/`, implemente `RpgSystem`, registre-o em
 * `registry.ts` e adicione a linha correspondente na tabela `rpg_systems` via migração.
 */
import type { ItemCategory, ResourceRecovery } from '@codexveil/domain';
import type { z } from 'zod';

export interface ContentLicense {
  /** Nome da obra de referência (ex.: "System Reference Document 5.2"). */
  work: string;
  licenseName: string;
  licenseUrl: string;
  sourceUrl: string;
  /** Texto de atribuição exigido pela licença, exibido na interface. */
  attribution: string;
}

export interface ConditionDefinition {
  key: string;
  label: string;
  /** Resumo curto, escrito pelo Codexveil, para consulta rápida durante a sessão. */
  summary: string;
  /** Condições graduais (ex.: Exaustão 1–6). */
  maxLevel?: number;
}

/** Como a interface deve apresentar uma trilha de recurso. */
export type ResourceDisplay = 'health' | 'pool' | 'checkboxes';

export interface ResourceTemplate {
  key: string;
  label: string;
  current: number;
  max: number | null;
  recovery: ResourceRecovery;
  display: ResourceDisplay;
  sortOrder: number;
}

/** Tipos de entrada de `character_abilities` (mesmos valores do enum do banco). */
export type AbilityEntryKind =
  | 'class_feature'
  | 'species_trait'
  | 'feat'
  | 'background_feature'
  | 'spell'
  | 'attack'
  | 'other';

/** Habilidade, magia ou ataque criado junto com um novo personagem. */
export interface AbilityEntryTemplate {
  kind: AbilityEntryKind;
  name: string;
  source: string;
  description: string;
  /** Dados específicos do sistema (ex.: círculo da magia, bônus do ataque). */
  data: Record<string, unknown>;
  /** Liga a entrada a uma trilha criada junto (pela chave da trilha). */
  resourceKey?: string;
  sortOrder: number;
}

/** Item do inventário inicial de um novo personagem. */
export interface ItemTemplate {
  name: string;
  category: ItemCategory;
  quantity: number;
  /** Peso unitário na unidade da ficha. */
  weight: number | null;
  description: string;
  notes: string;
  isEquipped: boolean;
  sortOrder: number;
}

export interface CharacterSummary {
  /** Linha descritiva curta, ex.: "Elfo · Mago 5". */
  subtitle: string;
  level: number | null;
}

export interface RpgSystem<TSheet = unknown, TDerived = unknown, TStatBlock = unknown, TRules = unknown> {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
  readonly rulesReference: string;
  readonly sheetSchemaVersion: number;
  readonly license: ContentLicense;
  readonly conditions: readonly ConditionDefinition[];
  readonly sheetSchema: z.ZodType<TSheet>;
  readonly statBlockSchema: z.ZodType<TStatBlock>;
  /**
   * Regras de criação de personagens que o mestre define na campanha (ex.: nível inicial).
   * Ficam em `campaigns.character_rules`; a camada central não interpreta o conteúdo.
   */
  readonly campaignRulesSchema: z.ZodType<TRules>;
  defaultCampaignRules(): TRules;
  /** Lê as regras gravadas; dados ausentes ou inválidos voltam ao padrão, sem lançar. */
  parseCampaignRules(data: unknown): TRules;
  /** Frases curtas para mostrar as regras aos participantes. */
  describeCampaignRules(rules: TRules): string[];

  createDefaultSheet(): TSheet;
  /** Valida e atualiza para a versão atual uma ficha lida do banco. */
  parseSheet(data: unknown): TSheet;
  computeDerived(sheet: TSheet): TDerived;
  summarize(sheet: TSheet): CharacterSummary;
  /** Trilhas criadas junto com um novo personagem (vida, dados de vida etc.). */
  defaultResources(sheet: TSheet): ResourceTemplate[];

  createDefaultStatBlock(): TStatBlock;
  parseStatBlock(data: unknown): TStatBlock;

  /** Valores iniciais de uma instância colocada na cena, a partir das estatísticas. */
  combatDefaults(statBlock: TStatBlock): CombatDefaults;
  /** Bônus de iniciativa do personagem (usado também como critério de desempate). */
  initiativeBonus(sheet: TSheet): number;
}

export interface CombatDefaults {
  hitPoints: number | null;
  armorClass: number | null;
  initiativeBonus: number;
}
