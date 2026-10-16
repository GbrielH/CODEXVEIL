import { KeyRound } from 'lucide-react';
import type { Metadata } from 'next';
import { Card, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { InviteCodeForm } from './code-form';

export const metadata: Metadata = { title: 'Entrar com código' };

export default function InviteCodePage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Convites"
        title="Entrar numa campanha"
        description="Digite o código que o mestre compartilhou com você. Hífens e espaços são opcionais."
      />
      <Card ornate className="max-w-lg">
        <CardHeader icon={<KeyRound className="h-5 w-5" aria-hidden="true" />} title="Código de convite" />
        <InviteCodeForm />
      </Card>
    </div>
  );
}
