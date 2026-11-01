import { z } from 'zod';

/** Limite de momentos por geração (controle de uso do plano gratuito da IA). */
const MAX_HIGHLIGHT_MOMENTS = 8;

/** Resposta da IA (JSON validado): de 3 a 8 momentos da sessão. */
export const highlightsResponseSchema = z.object({
  moments: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(120),
        summary: z.string().trim().max(4000).default(''),
        segmentIds: z.array(z.string()).max(20).default([]),
        characters: z.array(z.string().trim().max(80)).max(12).default([]),
        location: z.string().trim().max(200).default(''),
        mood: z.string().trim().max(120).default(''),
        imagePrompt: z.string().trim().max(4000).default(''),
      }),
    )
    .min(1)
    .max(MAX_HIGHLIGHT_MOMENTS),
});
export type HighlightsResponse = z.output<typeof highlightsResponseSchema>;
