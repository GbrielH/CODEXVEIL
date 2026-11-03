import { z } from 'zod';

export const TRIANGLE_AGENCY_SHEET_VERSION = 1;

export const TRIANGLE_QUALITIES = [
  'atencao',
  'empatia',
  'presenca',
  'duplicidade',
  'iniciativa',
  'profissionalismo',
  'dinamismo',
  'persistencia',
  'sutileza',
] as const;
export type TriangleQuality = (typeof TRIANGLE_QUALITIES)[number];

export const triangleQualityLabels: Record<TriangleQuality, string> = {
  atencao: 'Atenção',
  empatia: 'Empatia',
  presenca: 'Presença',
  duplicidade: 'Duplicidade',
  iniciativa: 'Iniciativa',
  profissionalismo: 'Profissionalismo',
  dinamismo: 'Dinamismo',
  persistencia: 'Persistência',
  sutileza: 'Sutileza',
};

export const TRIANGLE_ANOMALIES = [
  'Sussurro',
  'Catálogo',
  'Drenagem',
  'Cronometria',
  'Crescimento',
  'Arma',
  'Sonho',
  'Emaranhado',
  'Ausência',
] as const;

export const TRIANGLE_REALITIES = [
  'Cuidador',
  'Sobrecarregado',
  'Perseguido',
  'Astro',
  'Endividado',
  'Recém-Nascido',
  'Romântico',
  'Mandachuva',
  'Criatura',
] as const;

export const TRIANGLE_COMPETENCIES = [
  'RP',
  'P&D',
  'Barista',
  'CEO',
  'Estagiário',
  'Coveiro',
  'Recepção',
  'Atendimento',
  'Palhaço',
] as const;

const text = (max: number) => z.string().trim().max(max).default('');
const qualityValues = (initial: number) =>
  z
    .object(
      Object.fromEntries(
        TRIANGLE_QUALITIES.map((quality) => [
          quality,
          z.number().int().min(0).max(9).default(initial),
        ]),
      ) as Record<TriangleQuality, z.ZodDefault<z.ZodNumber>>,
    )
    .prefault({} as never);

export const triangleAgencySheetSchema = z.object({
  schemaVersion: z.literal(TRIANGLE_AGENCY_SHEET_VERSION).default(TRIANGLE_AGENCY_SHEET_VERSION),
  identity: z
    .object({
      pronouns: text(80),
      appearance: text(4000),
      anomalyContact: text(4000),
      agencyContact: text(4000),
      annualSalary: text(120),
      notes: text(12000),
    })
    .prefault({}),
  arc: z
    .object({
      anomaly: text(120),
      reality: text(120),
      competency: text(120),
      competencyTitle: text(120),
    })
    .prefault({}),
  anomalousAbilities: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(160),
        quality: z.enum(TRIANGLE_QUALITIES),
        notes: text(6000),
      }),
    )
    .max(12)
    .default([]),
  reality: z
    .object({
      trigger: text(4000),
      burnoutRelief: text(4000),
    })
    .prefault({}),
  competency: z
    .object({
      primaryDirective: text(4000),
      sanctionedBehaviors: z.array(z.string().trim().min(1).max(1000)).max(20).default([]),
      initialRequisition: text(2000),
    })
    .prefault({}),
  qualityAssurances: z
    .object({ current: qualityValues(0), maximum: qualityValues(0) })
    .prefault({}),
  additionalBurnout: qualityValues(0),
  merits: z.number().int().min(-9999).max(99999).default(0),
  looseEnds: z.number().int().min(0).max(9999).default(0),
  deaths: z.number().int().min(0).max(999).default(0),
  relationships: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(160),
        description: text(4000),
        connection: z.number().int().min(0).max(9).default(0),
        bonus: text(2000),
      }),
    )
    .max(12)
    .default([]),
  time: z
    .object({
      anomaly: z.number().int().min(0).max(30).default(0),
      reality: z.number().int().min(0).max(30).default(0),
      competency: z.number().int().min(0).max(30).default(0),
      unavailableAnomaly: z.number().int().min(0).max(30).default(0),
      unavailableReality: z.number().int().min(0).max(30).default(0),
      unavailableCompetency: z.number().int().min(0).max(30).default(0),
    })
    .prefault({}),
  requisitions: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        cost: z.number().int().min(0).max(9999).default(0),
        permanent: z.boolean().default(false),
        notes: text(4000),
      }),
    )
    .max(100)
    .default([]),
  unlockedDocuments: z.array(z.string().trim().min(1).max(40)).max(200).default([]),
  mission: z
    .object({
      codename: text(160),
      anomalyStatus: z
        .enum(['capturada', 'neutralizada', 'perdida', 'outro'])
        .nullable()
        .default(null),
      anomalyBehavior: text(6000),
      anomalyFocus: text(2000),
      anomalyDomain: text(2000),
      notes: text(8000),
    })
    .prefault({}),
});

export type TriangleAgencySheet = z.output<typeof triangleAgencySheetSchema>;

export function createDefaultTriangleAgencySheet(): TriangleAgencySheet {
  return triangleAgencySheetSchema.parse({});
}

export function parseTriangleAgencySheet(data: unknown): TriangleAgencySheet {
  return triangleAgencySheetSchema.parse(data ?? {});
}
