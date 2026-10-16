/**
 * Validação dos fluxos de autenticação. As mesmas regras de senha estão configuradas no
 * Supabase Auth (supabase/config.toml: minimum_password_length e password_requirements),
 * que é quem efetivamente as aplica.
 */
import { z } from 'zod';
import { emailSchema, requiredText } from './common';

export const PASSWORD_MIN_LENGTH = 8;
/** O Supabase Auth (bcrypt) não aceita senhas acima de 72 caracteres. */
export const PASSWORD_MAX_LENGTH = 72;

export const passwordSchema = z
  .string({ error: 'Informe uma senha.' })
  .min(PASSWORD_MIN_LENGTH, `A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`)
  .max(PASSWORD_MAX_LENGTH, `A senha pode ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`)
  .regex(/[A-Za-z]/, 'A senha precisa ter pelo menos uma letra.')
  .regex(/[0-9]/, 'A senha precisa ter pelo menos um número.');

export const displayNameSchema = requiredText('um nome de exibição', 2, 40);

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Informe sua senha.'),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const signUpSchema = z
  .object({
    displayName: displayNameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não coincidem.',
  });
export type SignUpInput = z.infer<typeof signUpSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não coincidem.',
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/**
 * Caminho interno seguro para redirecionar após login/confirmação. Aceita apenas caminhos
 * relativos do próprio site, evitando redirecionamento aberto (`//evil.com`, `https://...`).
 */
export function safeRedirectPath(value: string | null | undefined, fallback = '/painel'): string {
  if (!value) return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  const hasControlCharacter = Array.from(value).some((char) => char.charCodeAt(0) < 0x20);
  if (hasControlCharacter) return fallback;
  return value;
}
