'use server';

import { authErrorMessage, getProfile, updateProfile } from '@codexveil/database';
import {
  fieldErrorsFrom,
  googlePhotoFrom,
  isAvatarPhoto,
  diceLookSchema,
  profileUpdateSchema,
} from '@codexveil/validation';
import { revalidatePath } from 'next/cache';
import { failureMessage, readText, type ActionResult, type FormState } from '@/lib/actions';
import { requireSessionUser } from '@/lib/auth';
import { siteUrl } from '@/lib/env';
import { routes } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function updateProfileAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireSessionUser(routes.profile);
  const raw = {
    displayName: readText(formData, 'displayName'),
    bio: readText(formData, 'bio'),
    preferences: {
      density: readText(formData, 'density') || undefined,
      motion: readText(formData, 'motion') || undefined,
      avatar: readText(formData, 'avatar') || null,
    },
  };
  const parsed = profileUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: 'error',
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: { displayName: raw.displayName, bio: raw.bio },
    };
  }
  // Foto: só a da própria conta Google.
  if (
    isAvatarPhoto(parsed.data.preferences.avatar) &&
    parsed.data.preferences.avatar !== googlePhotoFrom(user.user_metadata)
  ) {
    return { status: 'error', message: 'Essa foto não é a da sua conta Google.' };
  }
  try {
    const supabase = await createSupabaseServerClient();
    // O formulário não tem os dados 3D (aba Meus dados): mantém a escolha que já estava salva.
    const current = await getProfile(supabase, user.id);
    const preferences = {
      ...parsed.data.preferences,
      dice: current?.preferences.dice ?? parsed.data.preferences.dice,
    };
    await updateProfile(supabase, user.id, { ...parsed.data, preferences });
  } catch (error) {
    return { status: 'error', message: failureMessage(error) };
  }
  revalidatePath('/', 'layout');
  return { status: 'success', message: 'Perfil atualizado.' };
}

/** Troca de senha por link enviado ao e-mail da conta (fluxo seguro também com sessão ativa). */
export async function sendPasswordResetAction(): Promise<ActionResult> {
  const user = await requireSessionUser(routes.profile);
  if (!user.email) return { ok: false, message: 'Sua conta não tem e-mail cadastrado.' };
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${siteUrl()}${routes.authConfirm}?next=${routes.resetPassword}`,
    });
    if (error) return { ok: false, message: authErrorMessage(error) };
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }
  return { ok: true, message: `Enviamos um link para ${user.email}. Ele vale por uma hora.` };
}

/** "Meus dados": face desenhada, cor e fonte dos números dos próprios dados 3D (o resto do perfil não muda). */
export async function updateDiceLookAction(input: {
  image: string | null;
  numberColor: string | null;
  font: string | null;
  color: string | null;
}): Promise<ActionResult> {
  const user = await requireSessionUser(routes.myDice);
  const look = diceLookSchema.parse(input);
  // Só aceita imagem da própria pasta (as políticas do Storage também barram as alheias).
  if (look.image && !look.image.startsWith(`users/${user.id}/dice/`)) look.image = null;
  try {
    const supabase = await createSupabaseServerClient();
    const profile = await getProfile(supabase, user.id);
    if (!profile) return { ok: false, message: 'Perfil não encontrado.' };
    await updateProfile(supabase, user.id, {
      displayName: profile.displayName,
      bio: profile.bio,
      preferences: { ...profile.preferences, dice: look },
    });
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Seus dados foram salvos.' };
}
