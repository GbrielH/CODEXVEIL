import { getProfile, signedMediaUrls } from '@codexveil/database';
import { Dices } from 'lucide-react';
import type { Metadata } from 'next';
import { Card, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/states';
import { requireSessionUser } from '@/lib/auth';
import { routes } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DiceEditor } from './dice-editor';

export const metadata: Metadata = { title: 'Meus dados' };

/** "Meus dados": aparência dos próprios dados 3D (face desenhada, cor e fonte dos números), em todas as campanhas. */
export default async function MyDicePage() {
  const user = await requireSessionUser(routes.myDice);
  const supabase = await createSupabaseServerClient();
  const profile = await getProfile(supabase, user.id);
  if (!profile) {
    return <ErrorState description="Não encontramos o seu perfil. Saia e entre novamente." />;
  }
  const image = profile.preferences.dice.image;
  const urls = image ? await signedMediaUrls(supabase, [image]) : {};
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Conta"
        title="Meus dados"
        description="Como os seus dados 3D aparecem na mesa, para você e para o grupo."
      />
      <Card ornate className="max-w-5xl">
        <CardHeader
          icon={<Dices className="h-5 w-5" aria-hidden="true" />}
          title="Aparência dos dados"
          description="Desenhe, pinte ou use uma imagem de fundo. Vale em todas as campanhas; a cor do dado é a que você escolhe em cada sessão."
        />
        <DiceEditor
          userId={user.id}
          initial={profile.preferences.dice}
          initialImageUrl={image ? (urls[image] ?? null) : null}
        />
      </Card>
    </div>
  );
}
