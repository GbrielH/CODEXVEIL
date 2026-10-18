import { Puzzle } from 'lucide-react';
import type { Metadata } from 'next';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { requireSessionUser } from '@/lib/auth';
import { routes } from '@/lib/routes';

export const metadata: Metadata = { title: 'Sistemas da comunidade' };

/** Espaço para sistemas de RPG criados pela comunidade (ainda em preparação). */
export default async function CommunitySystemsPage() {
  await requireSessionUser(routes.community);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Comunidade"
        title="Sistemas da comunidade"
        description="Sistemas de RPG desenvolvidos pela comunidade, prontos para usar nas suas campanhas."
      />
      <Card ornate className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-parchment-400/40 bg-wine-950 text-fg-accent">
          <Puzzle className="h-7 w-7" aria-hidden="true" />
        </span>
        <h2 className="text-2xl">Em breve</h2>
        <p className="max-w-md text-sm text-fg-secondary">
          Aqui vão aparecer sistemas criados pela comunidade: fichas, regras e conteúdos para jogar além do D&amp;D 5e.
        </p>
      </Card>
    </div>
  );
}
