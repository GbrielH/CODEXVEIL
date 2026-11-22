import {
  getProfile,
  listAuraGrantsGiven,
  listFriends,
  listMyAuraGrants,
  listMyDice,
  signedMediaUrls,
  type Friend,
} from '@codexveil/database';
import { ACTIVE_DICE_AURAS, type DiceAura } from '@codexveil/validation';
import { Dices, Plus, Sparkles, Users } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { DiceSwatch } from '@/components/dice/character-dice-card';
import { SkinPrompt } from '@/components/dice/skin-prompt';
import { Card, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/states';
import { requireSessionUser } from '@/lib/auth';
import { cx } from '@/lib/cx';
import { routes } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AuraArtCard } from './aura-art-card';
import { AuraGrants } from './aura-grants';
import { DeleteDiceButton } from './delete-dice-button';
import { DiceEditor } from './dice-editor';

export const metadata: Metadata = { title: 'Meus dados' };

const EMPTY_LOOK = { image: null, numberColor: null, font: null, color: null, aura: null };

/**
 * "Meus dados": o dado padrão (usado em todas as rolagens) e a coleção de dados salvos, que podem
 * ser vinculados a personagens. `?dado=<id>` edita um da coleção; `?dado=novo` cria outro.
 */
export default async function MyDicePage({ searchParams }: PageProps<'/meus-dados'>) {
  const user = await requireSessionUser(routes.myDice);
  const query = await searchParams;
  const selected = typeof query.dado === 'string' ? query.dado : null;
  const supabase = await createSupabaseServerClient();
  const [profile, saved] = await Promise.all([
    getProfile(supabase, user.id),
    listMyDice(supabase, user.id),
  ]);
  if (!profile) {
    return <ErrorState description="Não encontramos o seu perfil. Saia e entre novamente." />;
  }
  // Auras: o criador usa todas e libera para amigos; os demais usam as liberadas.
  const creator = profile.creatorFeatures;
  const empty: Record<string, DiceAura[]> = {};
  const [auras, friends, given]: [DiceAura[], Friend[], Record<string, DiceAura[]>] = creator
    ? await Promise.all([
        Promise.resolve([...ACTIVE_DICE_AURAS]),
        listFriends(supabase, user.id),
        listAuraGrantsGiven(supabase, user.id),
      ])
    : [await listMyAuraGrants(supabase, user.id), [], empty];
  const defaultLook = profile.preferences.dice;
  const urls = await signedMediaUrls(supabase, [
    defaultLook.image,
    ...saved.map((entry) => entry.look.image),
  ]);
  // Imagens próprias do crítico (conta de criador), com link assinado para a prévia.
  const artPaths = Object.entries(profile.preferences.auraArt) as [DiceAura, string][];
  const artUrls = creator
    ? await signedMediaUrls(
        supabase,
        artPaths.map(([, path]) => path),
      )
    : {};
  const auraArt = Object.fromEntries(
    artPaths.map(([key, path]) => [key, { path, url: artUrls[path] ?? null }]),
  ) as Partial<Record<DiceAura, { path: string; url: string | null }>>;
  const soundPaths = Object.entries(profile.preferences.auraSound) as [DiceAura, string][];
  const soundUrls = creator
    ? await signedMediaUrls(
        supabase,
        soundPaths.map(([, path]) => path),
      )
    : {};
  const auraSound = Object.fromEntries(
    soundPaths.map(([key, path]) => [key, { path, url: soundUrls[path] ?? null }]),
  ) as Partial<Record<DiceAura, { path: string; url: string | null }>>;
  const editing =
    selected && selected !== 'novo' ? saved.find((entry) => entry.id === selected) : null;
  const look = selected === 'novo' ? EMPTY_LOOK : (editing?.look ?? defaultLook);
  const target =
    selected === 'novo'
      ? { id: null, name: '' }
      : editing
        ? { id: editing.id, name: editing.name }
        : undefined;
  const tile = (active: boolean) =>
    cx(
      'flex items-center gap-2 rounded-lg border p-2 pr-3 text-sm transition-colors',
      active ? 'border-fg-brand bg-hover text-fg' : 'border-line text-fg-secondary hover:bg-hover',
    );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Conta"
        title="Meus dados"
        description="Como os seus dados 3D aparecem na mesa, para você e para o grupo."
      />
      <Card>
        <CardHeader
          icon={<Dices className="h-5 w-5" aria-hidden="true" />}
          title="Seus dados"
          description="O padrão vale em todas as rolagens. Os da coleção podem ser vinculados a personagens (na aba Personagem de cada ficha)."
        />
        <ul className="flex flex-wrap gap-2">
          <li>
            <Link href={routes.myDice} className={tile(!target)}>
              <DiceSwatch
                color={defaultLook.color}
                imageUrl={defaultLook.image ? (urls[defaultLook.image] ?? null) : null}
              />
              Dado padrão
            </Link>
          </li>
          {saved.map((entry) => (
            <li key={entry.id} className="flex items-center gap-1">
              <Link
                href={`${routes.myDice}?dado=${entry.id}` as Route}
                className={tile(editing?.id === entry.id)}
              >
                <DiceSwatch
                  color={entry.look.color}
                  imageUrl={entry.look.image ? (urls[entry.look.image] ?? null) : null}
                />
                {entry.name}
              </Link>
              <DeleteDiceButton id={entry.id} name={entry.name} image={entry.look.image} />
            </li>
          ))}
          {saved.length < 12 ? (
            <li>
              <Link
                href={`${routes.myDice}?dado=novo` as Route}
                className={tile(selected === 'novo')}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-line">
                  <Plus className="h-5 w-5" aria-hidden="true" />
                </span>
                Novo dado
              </Link>
            </li>
          ) : null}
        </ul>
      </Card>
      <Card ornate>
        <CardHeader
          icon={<Dices className="h-5 w-5" aria-hidden="true" />}
          title={
            target
              ? target.id
                ? `Editando: ${target.name}`
                : 'Novo dado da coleção'
              : 'Dado padrão'
          }
          description="Desenhe, pinte ou use uma imagem de fundo; escolha a cor do dado e a cor e a fonte dos números."
        />
        <DiceEditor
          key={selected ?? 'padrao'}
          userId={user.id}
          initial={look}
          initialImageUrl={look.image ? (urls[look.image] ?? null) : null}
          target={target}
          auras={auras}
          creator={creator}
        />
      </Card>
      {creator ? (
        <Card>
          <CardHeader
            icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
            title="Imagem e som do crítico"
            description="Uma imagem e um som seus para o crítico de uma aura. Ficam guardados na sua conta, fora do código; quem divide campanha com você vê e ouve no crítico."
          />
          <AuraArtCard userId={user.id} auras={auras} art={auraArt} sounds={auraSound} />
        </Card>
      ) : null}
      {creator ? (
        <Card>
          <CardHeader
            icon={<Users className="h-5 w-5" aria-hidden="true" />}
            title="Auras dos amigos"
            description="Clique num amigo e marque as auras que ele pode usar nos dados dele."
          />
          <AuraGrants
            friends={friends
              .filter((friend) => friend.status === 'accepted')
              .map((friend) => ({
                userId: friend.userId,
                displayName: friend.displayName,
                avatarIcon: friend.avatarIcon,
                auras: given[friend.userId] ?? [],
              }))}
          />
        </Card>
      ) : null}
      <Card>
        <CardHeader
          icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
          title="Gerar a skin com IA"
          description="Um prompt pronto para criar a textura do dado numa IA de imagens."
        />
        <SkinPrompt />
      </Card>
    </div>
  );
}
