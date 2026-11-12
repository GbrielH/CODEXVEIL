import { bookAssetUrls } from '@codexveil/database';
import { type Ordem2PoiRow, type Ordem2StatBlock } from '@codexveil/rpg-systems/ordem2';
import type { Route } from 'next';
import Link from 'next/link';
import { BOOK_KIND_SLUGS } from '@/lib/books';
import { bookPath } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Ordem2CreatureView } from '@/components/library/ordem2-creature';
import { BookText } from './book-text';

type Data = Record<string, unknown>;

const text = (value: unknown) => (typeof value === 'string' ? value : '');
const list = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

/** Nome legível a partir da chave ("ato-1-porao-mesa-de-poker" → "mesa de poker"). */
function keyLabel(key: string): string {
  return key
    .replace(/^(ato-\d-[a-z]+(-secreta)?-|pantano-cena-\d-|caverna-cena-\d-|mapa-)/, '')
    .replace(/-/g, ' ');
}

/**
 * Entradas do Ordem Paranormal 2 (pacote privado do exemplar do usuário): regras, ferramentas,
 * missões, cenas com links para pontos de interesse, criaturas e mapas, e as imagens do livro
 * (bucket privado, por URL assinada).
 */
export async function Ordem2EntryView({
  kind,
  data,
  pack,
  campaignId,
}: {
  kind: string;
  data: unknown;
  pack: { id: string; bookKey: string };
  campaignId?: string | undefined;
}) {
  const entry: Data = data && typeof data === 'object' ? (data as Data) : {};
  const image = text(entry.image) || null;
  const urls = image
    ? await bookAssetUrls(await createSupabaseServerClient(), 'ordem2', pack.bookKey, [image])
    : {};
  const imageUrl = image ? urls[image] : undefined;
  const page = typeof entry.page === 'number' && entry.page > 0 ? entry.page : null;
  const link = (entryKind: string, key: string) =>
    bookPath(pack.id, `/${BOOK_KIND_SLUGS[entryKind]}/${key}`, campaignId) as Route;

  return (
    <div className="flex flex-col gap-5">
      {page !== null ? <p className="text-xs text-fg-muted">Página {page} do PDF</p> : null}
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL assinada e temporária do Storage.
        <img
          src={imageUrl}
          alt=""
          className="max-h-[70vh] w-full rounded-md border border-line object-contain"
        />
      ) : image ? (
        <p className="text-sm text-fg-muted">
          A imagem desta entrada não está disponível (só o dono do livro e os mestres a veem).
        </p>
      ) : null}

      {kind === 'point_of_interest' ? <PointOfInterest entry={entry} /> : null}
      {kind === 'creature' && entry.stats ? (
        <Ordem2CreatureView stats={entry.stats as Ordem2StatBlock} />
      ) : null}

      {kind === 'mission' && text(entry.summary) ? (
        <section className="flex flex-col gap-2">
          <h3 className="font-display text-xl">Preparação e resumo</h3>
          <BookText body={text(entry.summary)} />
        </section>
      ) : null}
      {kind === 'mission' && list(entry.scenes).length ? (
        <section className="rounded-md border border-line bg-sunken p-4">
          <h3 className="font-display text-lg">Cenas</h3>
          <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-sm">
            {list(entry.scenes).map((key) => (
              <li key={key}>
                <Link href={link('scene', key)} className="text-fg-brand hover:underline">
                  {key.replace(/-/g, ' ')}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {kind === 'scene' ? (
        <section className="flex flex-wrap gap-4 rounded-md border border-line bg-sunken p-4 text-sm">
          {(
            [
              ['pointsOfInterest', 'point_of_interest', 'Pontos de interesse'],
              ['creatures', 'creature', 'Criaturas'],
              ['maps', 'map', 'Mapas'],
            ] as const
          ).map(([field, entryKind, label]) =>
            list(entry[field]).length ? (
              <div key={field} className="min-w-48 flex-1">
                <h3 className="font-display text-base">{label}</h3>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {list(entry[field]).map((key) => (
                    <li key={key}>
                      <Link href={link(entryKind, key)} className="text-fg-brand hover:underline">
                        {keyLabel(key)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null,
          )}
        </section>
      ) : null}

      {text(entry.legend) ? <BookText body={text(entry.legend)} /> : null}
      {text(entry.caption) ? <BookText body={text(entry.caption)} /> : null}
      {text(entry.body) ? <BookText body={text(entry.body)} /> : null}
      {text(entry.mechanics) ? (
        <section className="rounded-md border border-line bg-sunken p-4">
          <h3 className="font-display text-lg">Mecânica</h3>
          <BookText body={text(entry.mechanics)} />
        </section>
      ) : null}
    </div>
  );
}

function PointOfInterest({ entry }: { entry: Data }) {
  const rows = (Array.isArray(entry.rows) ? entry.rows : []) as Ordem2PoiRow[];
  return (
    <>
      {text(entry.mapLabel) || entry.keyEvidence ? (
        <p className="text-xs text-fg-muted">
          {text(entry.mapLabel) ? `Ponto ${text(entry.mapLabel)} do mapa` : ''}
          {entry.keyEvidence ? ' · Evidência-chave' : ''}
        </p>
      ) : null}
      {text(entry.description) ? (
        <blockquote className="rounded-md border-l-4 border-parchment-300/60 bg-sunken px-4 py-3 italic text-fg">
          {text(entry.description)}
        </blockquote>
      ) : null}
      {rows.length ? <PoiTable rows={rows} /> : null}
      {text(entry.context) ? (
        <section className="flex flex-col gap-2">
          <h3 className="font-display text-lg">Descrição contextual (só o mestre)</h3>
          <BookText body={text(entry.context)} />
        </section>
      ) : null}
    </>
  );
}

export function PoiTable({ rows }: { rows: readonly Ordem2PoiRow[] }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr>
            <th className="border-b border-line-strong px-2 py-1.5 font-medium">Perícia</th>
            <th className="border-b border-line-strong px-2 py-1.5 font-medium">DT</th>
            <th className="border-b border-line-strong px-2 py-1.5 font-medium">Informação</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="odd:bg-sunken/60">
              <td className="border-b border-line px-2 py-1.5 align-top">{row.skill}</td>
              <td className="tabular border-b border-line px-2 py-1.5 align-top">{row.dc}</td>
              <td className="border-b border-line px-2 py-1.5 align-top">
                {row.text}
                {row.requirement ? (
                  <span className="mt-1 block text-xs text-fg-muted">{row.requirement}</span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
