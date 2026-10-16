import { brandColors, colors, palette } from '@codexveil/ui/tokens';
import { Flame, Inbox } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Emblem, Wordmark } from '@/components/brand/emblem';
import { Alert } from '@/components/ui/alert';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Divider } from '@/components/ui/divider';
import { CheckboxField, SelectField, TextareaField, TextField } from '@/components/ui/field';
import { Glyph } from '@/components/ui/glyph';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, ErrorState, ForbiddenState, LoadingState, Skeleton } from '@/components/ui/states';
import { InteractiveDemo } from './interactive-demo';

export const metadata: Metadata = { title: 'Design system (desenvolvimento)', robots: { index: false } };

function Swatch({ name, value }: { name: string; value: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="h-10 w-10 shrink-0 rounded-md border border-line-strong" style={{ background: value }} />
      <span className="min-w-0 text-xs">
        <span className="block font-medium text-fg">{name}</span>
        <span className="block font-mono text-fg-muted">{value}</span>
      </span>
    </li>
  );
}

/** Vitrine do design system. Disponível apenas em desenvolvimento (404 em produção). */
export default function DesignSystemPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <main id="conteudo" className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6">
      <Alert tone="warning" title="Ambiente de desenvolvimento">
        Esta página mostra componentes com textos de exemplo e não existe em produção.
      </Alert>

      <PageHeader
        eyebrow="Codexveil"
        title="Design system"
        description="Dark Fantasy Premium + Grimório Vivo. Tokens em packages/ui/src/tokens.ts."
      />

      <section className="flex flex-col gap-4">
        <h2 className="text-xl">Identidade</h2>
        <div className="flex flex-wrap items-center gap-8">
          <Emblem className="emblem-glow h-24 w-24" title="Emblema do Codexveil" />
          <Wordmark size="lg" />
          <span className="flex items-center gap-2 text-fg-secondary">
            <Glyph name="d20" className="h-8 w-8" title="Dado de 20 faces" /> Glifo próprio (d20)
          </span>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl">Cores oficiais e semânticas</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(brandColors).map(([name, value]) => (
            <Swatch key={name} name={name} value={value} />
          ))}
        </ul>
        <ul className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {(['canvas', 'card', 'fg', 'fgSecondary', 'fgMuted', 'fgAccent', 'fgBrand', 'primary', 'success', 'warning', 'danger', 'info', 'hpTemp'] as const).map(
            (name) => (
              <Swatch key={name} name={name} value={colors[name]} />
            ),
          )}
        </ul>
        <ul className="grid gap-4 sm:grid-cols-5">
          {Object.entries(palette.wine).map(([step, value]) => (
            <Swatch key={step} name={`wine-${step}`} value={value} />
          ))}
        </ul>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-xl">Tipografia</h2>
          <p className="mt-4 font-display text-3xl text-fg-accent">Cinzel — títulos e capitulares</p>
          <p className="mt-3 text-base">Inter — interface, números e dados de ficha: 18 · +5 · CA 16</p>
          <p className="mt-3 font-serif text-lg leading-relaxed text-fg-secondary">
            Alegreya — leitura longa. A névoa cobria a estrada até a capela, e os sinos tocavam sozinhos.
          </p>
          <p className="eyebrow mt-4">Rótulo de seção</p>
        </Card>
        <div className="parchment rounded-lg p-6">
          <h2 className="font-display text-xl text-ink">Pergaminho</h2>
          <p className="mt-3 font-serif leading-relaxed">
            Superfície para notas, documentos e registros antigos. A interface principal continua escura;
            o pergaminho aparece apenas onde há conteúdo de leitura.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl">Botões</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primário</Button>
          <Button variant="secondary">Secundário</Button>
          <Button variant="ghost">Discreto</Button>
          <Button variant="danger">Destrutivo</Button>
          <Button loading>Salvando</Button>
          <Button disabled>Desabilitado</Button>
          <Button size="icon" variant="secondary" aria-label="Exemplo com ícone">
            <Flame className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
        <InteractiveDemo />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card ornate>
          <CardHeader title="Formulário" description="Rótulos, dicas e erros ligados por aria-describedby." />
          <div className="flex flex-col gap-4">
            <TextField id="demo-name" label="Nome do personagem" hint="Como o grupo vai chamá-lo." />
            <TextField id="demo-error" label="Nível" defaultValue="25" error="O nível vai de 1 a 20." />
            <SelectField id="demo-select" label="Classe">
              <option>Mago</option>
              <option>Guerreira</option>
            </SelectField>
            <TextareaField id="demo-notes" label="Anotações" rows={3} />
            <CheckboxField id="demo-check" label="Visível aos jogadores" description="Exemplo de caixa de seleção." />
          </div>
        </Card>
        <div className="flex flex-col gap-3">
          <Alert tone="info" title="Informação">Mensagem neutra.</Alert>
          <Alert tone="success" title="Sucesso">Alterações salvas no servidor.</Alert>
          <Alert tone="warning" title="Atenção">A campanha está arquivada.</Alert>
          <Alert tone="danger" title="Erro">A alteração não foi salva. Tente novamente.</Alert>
          <div className="flex flex-wrap gap-2">
            <Badge>Neutro</Badge>
            <Badge tone="brand">Mestre</Badge>
            <Badge tone="parchment">D&amp;D 5e</Badge>
            <Badge tone="success">Ativo</Badge>
            <Badge tone="warning">Arquivada</Badge>
            <Badge tone="danger">Revogado</Badge>
            <Badge tone="info">Temporário</Badge>
          </div>
          <div className="flex items-center gap-3">
            <Avatar name="Aria Vesper" />
            <Avatar name="Borin" size="lg" />
          </div>
        </div>
      </section>

      <Divider label="Estados" />

      <section className="grid gap-6 lg:grid-cols-2">
        <EmptyState
          icon={<Inbox className="h-8 w-8" aria-hidden="true" />}
          title="Nenhum registro"
          description="Explica por que está vazio e oferece o próximo passo."
          action={<Button size="sm">Criar o primeiro</Button>}
        />
        <ErrorState description="Falhas mostram a causa e uma forma de tentar de novo." />
        <ForbiddenState />
        <Card>
          <LoadingState label="Carregando fichas…" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </Card>
      </section>
    </main>
  );
}
