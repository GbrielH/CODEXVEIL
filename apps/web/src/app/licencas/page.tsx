import { listSystems } from '@codexveil/rpg-systems';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Wordmark } from '@/components/brand/emblem';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { routes } from '@/lib/routes';

export const metadata: Metadata = { title: 'Licenças e atribuições' };

const thirdParty = [
  { name: 'Cinzel, Inter e Alegreya (fontes)', license: 'SIL Open Font License 1.1' },
  { name: 'Lucide (ícones de interface)', license: 'ISC' },
  { name: 'Next.js, React, Expo e React Native', license: 'MIT' },
  { name: 'Supabase JS', license: 'MIT' },
];

export default function LicensesPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <Link href={routes.home} className="inline-flex">
        <Wordmark size="sm" />
      </Link>
      <main id="conteudo" className="mt-10 flex flex-col gap-8">
        <PageHeader
          eyebrow="Transparência"
          title="Licenças e atribuições"
          description="O Codexveil usa apenas conteúdo cuja reprodução é permitida. Nenhum texto de livros comerciais é copiado."
        />
        {listSystems().map((system) => (
          <Card key={system.id} ornate>
            <h2 className="text-lg">{system.name}</h2>
            <p className="mt-2 text-sm text-fg-muted">
              Regras de referência: {system.license.work}, licenciado sob {system.license.licenseName}.
              Usamos apenas mecânicas (atributos, perícias, tabelas e nomes de condições); os resumos
              exibidos foram escritos para o Codexveil.
            </p>
            <blockquote lang="en" className="mt-4 border-l-2 border-parchment-400/50 pl-4 font-serif text-sm italic text-fg-secondary">
              {system.license.attribution}
            </blockquote>
            <p className="mt-4 text-sm">
              <a href={system.license.licenseUrl} className="underline underline-offset-4" rel="noreferrer">
                Texto da licença
              </a>
              {' · '}
              <a href={system.license.sourceUrl} className="underline underline-offset-4" rel="noreferrer">
                Fonte original
              </a>
            </p>
          </Card>
        ))}
        <Card>
          <h2 className="text-lg">Software e fontes de terceiros</h2>
          <ul className="mt-3 divide-y divide-line text-sm">
            {thirdParty.map((item) => (
              <li key={item.name} className="flex justify-between gap-4 py-2">
                <span>{item.name}</span>
                <span className="text-fg-muted">{item.license}</span>
              </li>
            ))}
          </ul>
        </Card>
      </main>
    </div>
  );
}
