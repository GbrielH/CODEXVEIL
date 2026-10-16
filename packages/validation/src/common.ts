import { z } from 'zod';

/** Configura mensagens padrão do zod em português. Chame uma vez na inicialização de cada app. */
export function configureValidationLocale(): void {
  z.config(z.locales.pt());
}

export const uuidSchema = z.uuid({ error: 'Identificador inválido.' });

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Informe um e-mail válido.' }).max(254, 'E-mail longo demais.'));

/** Texto curto obrigatório, sem espaços nas pontas. */
export function requiredText(label: string, min: number, max: number) {
  return z
    .string({ error: `Informe ${label}.` })
    .trim()
    .min(min, min <= 1 ? `Informe ${label}.` : `Use pelo menos ${min} caracteres.`)
    .max(max, `Use no máximo ${max} caracteres.`);
}

/** Texto opcional: vazio vira string vazia. */
export function optionalText(max: number) {
  return z.string().trim().max(max, `Use no máximo ${max} caracteres.`).default('');
}

export type FieldErrors = Partial<Record<string, string>>;

/** Primeira mensagem de erro de cada campo, no formato usado pelos formulários. */
export function fieldErrorsFrom(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_form';
    result[key] ??= issue.message;
  }
  return result;
}
