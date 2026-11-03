import { BookText } from './book-text';

/** Conteúdo privado extraído do exemplar do usuário; o código não embute o texto do livro. */
export function TriangleEntryView({ data }: { kind: string; data: unknown }) {
  const entry = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const body = typeof entry.body === 'string' ? entry.body : '';
  const page = typeof entry.page === 'number' ? entry.page : null;
  const details = [
    typeof entry.trigger === 'string' && entry.trigger
      ? ['Gatilho de Realidade', entry.trigger]
      : null,
    typeof entry.burnoutRelief === 'string' && entry.burnoutRelief
      ? ['Alívio de Burnout', entry.burnoutRelief]
      : null,
    typeof entry.primaryDirective === 'string' && entry.primaryDirective
      ? ['Diretriz Primária', entry.primaryDirective]
      : null,
    typeof entry.initialRequisition === 'string' && entry.initialRequisition
      ? ['Requisição Inicial', entry.initialRequisition]
      : null,
  ].filter((item): item is [string, string] => Boolean(item));
  return (
    <div className="flex flex-col gap-5">
      {page !== null ? <p className="text-xs text-fg-muted">Página {page}</p> : null}
      {details.map(([label, value]) => (
        <section key={label} className="rounded-md border border-line bg-sunken p-4">
          <h3 className="font-display text-lg">{label}</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-fg-secondary">{value}</p>
        </section>
      ))}
      {body ? (
        <BookText body={body} />
      ) : (
        <p className="text-sm text-fg-muted">Sem texto nesta entrada.</p>
      )}
    </div>
  );
}
