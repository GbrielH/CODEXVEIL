'use server';

import { createCharacter, getCampaign } from '@codexveil/database';
import { findSystem } from '@codexveil/rpg-systems';
import { buildDnd5eCharacter, dnd5eCreationSchema } from '@codexveil/rpg-systems/dnd5e';
import { characterCreateSchema, fieldErrorsFrom } from '@codexveil/validation';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { failureMessage, readText, type FormState } from '@/lib/actions';
import { requireSessionUser } from '@/lib/auth';
import { characterPath, routes } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Número informado no formulário; vazio vira `undefined` (usa o padrão) ou `null`. */
function numberField(formData: FormData, key: string, empty: undefined | null = undefined) {
  const text = readText(formData, key).trim();
  if (text === '') return empty;
  const value = Number(text.replace(',', '.'));
  return Number.isNaN(value) ? text : value;
}

const DND5E_FIELDS = [
  'species',
  'background',
  'className',
  'level',
  'hitDie',
  'hitPointMax',
  'abilities.str',
  'abilities.dex',
  'abilities.con',
  'abilities.int',
  'abilities.wis',
  'abilities.cha',
] as const;

export async function createCharacterAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireSessionUser(routes.newCharacter);
  const values = Object.fromEntries(
    ['name', 'campaignId', 'systemId', ...DND5E_FIELDS].map((key) => [key, readText(formData, key)]),
  );

  const campaignId = values.campaignId ? values.campaignId : null;
  let systemId = values.systemId ?? '';

  let supabase;
  try {
    supabase = await createSupabaseServerClient();
    // Com campanha, o sistema é sempre o da campanha (o banco também exige isso).
    if (campaignId) {
      const campaign = await getCampaign(supabase, campaignId, user.id);
      if (!campaign || campaign.status !== 'active') {
        return {
          status: 'error',
          fieldErrors: { campaignId: 'Escolha uma campanha ativa da qual você participa.' },
          values,
        };
      }
      systemId = campaign.systemId;
    }
  } catch (error) {
    return { status: 'error', message: failureMessage(error), values };
  }

  const base = characterCreateSchema.safeParse({ name: values.name, systemId, campaignId });
  const system = findSystem(systemId);
  if (!base.success || !system) {
    return {
      status: 'error',
      fieldErrors: base.success ? { systemId: 'Sistema não suportado.' } : fieldErrorsFrom(base.error),
      values,
    };
  }

  let built: { sheet: unknown; resources: ReturnType<typeof system.defaultResources> };
  switch (base.data.systemId) {
    case 'dnd5e': {
      const creation = dnd5eCreationSchema.safeParse({
        species: values.species,
        background: values.background,
        className: values.className,
        level: numberField(formData, 'level'),
        hitDie: values.hitDie || undefined,
        hitPointMax: numberField(formData, 'hitPointMax', null),
        abilities: Object.fromEntries(
          (['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((ability) => [
            ability,
            numberField(formData, `abilities.${ability}`),
          ]),
        ),
      });
      if (!creation.success) {
        return { status: 'error', fieldErrors: fieldErrorsFrom(creation.error), values };
      }
      built = buildDnd5eCharacter(creation.data);
      break;
    }
  }

  let characterId: string;
  try {
    characterId = await createCharacter(supabase, {
      name: base.data.name,
      systemId: base.data.systemId,
      campaignId: base.data.campaignId,
      sheet: built.sheet,
      resources: built.resources,
    });
  } catch (error) {
    return { status: 'error', message: failureMessage(error), values };
  }

  revalidatePath(routes.characters);
  if (campaignId) revalidatePath(`/campanhas/${campaignId}`, 'layout');
  redirect(`${characterPath(characterId)}?aviso=personagem-criado` as Route);
}
