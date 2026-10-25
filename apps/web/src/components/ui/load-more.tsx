import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import type { Route } from 'next';

/**
 * Paginação pelas páginas do servidor: `?pagina=N` carrega N páginas de uma vez. Assim o
 * `router.refresh()` das telas (salvar, excluir, tempo real) continua com tudo o que já foi
 * carregado. Busca uma linha a mais para saber se ainda há mais.
 */
export function pageWindow(value: string | string[] | undefined, pageSize: number) {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  const page = Number.isInteger(parsed) && parsed > 1 ? Math.min(parsed, 50) : 1;
  return { page, limit: page * pageSize + 1, size: page * pageSize };
}

/** Separa a linha extra: `items` para mostrar e `hasMore` para o botão. */
export function takePage<T>(rows: T[], size: number): { items: T[]; hasMore: boolean } {
  return { items: rows.slice(0, size), hasMore: rows.length > size };
}

/** Link "Carregar mais" para a próxima página (sem rolar para o topo). */
export function LoadMoreLink({
  href,
  page,
  label = 'Carregar mais',
}: {
  href: string;
  page: number;
  label?: string;
}) {
  const separator = href.includes('?') ? '&' : '?';
  return (
    <div className="flex justify-center pt-2">
      <Link
        href={`${href}${separator}pagina=${page + 1}` as Route}
        scroll={false}
        className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm text-fg-secondary hover:bg-hover hover:text-fg"
      >
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
        {label}
      </Link>
    </div>
  );
}
