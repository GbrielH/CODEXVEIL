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
import type { ResourceRecovery } from '@codexveil/domain';
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

export interface CharacterSummary {
  /** Linha descritiva curta, ex.: "Elfo · Mago 5". */
  subtitle: string;
  level: number | null;
}

export interface RpgSystem<TSheet = unknown, TDerived = unknown, TStatBlock = unknown> {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
  readonly rulesReference: string;
  readonly sheetSchemaVersion: number;
  readonly license: ContentLicense;
  readonly conditions: readonly ConditionDefinition[];
  readonly sheetSchema: z.ZodType<TSheet>;
  readonly statBlockSchema: z.ZodType<TStatBlock>;

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
