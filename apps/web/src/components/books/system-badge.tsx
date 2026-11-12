import { Badge } from '@/components/ui/badge';

/** Selo do sistema do livro (D&D 5e, Tormenta20, Assimilação RPG, Triangle Agency ou Ordem Paranormal 2), com a edição das regras. */
export function SystemBadge({ systemId, edition }: { systemId: string | null; edition: string }) {
  if (systemId === 'assimilacao') return <Badge tone="danger">Assimilação RPG</Badge>;
  if (systemId === 'triangle-agency') return <Badge tone="info">Triangle Agency</Badge>;
  if (systemId === 'ordem2') return <Badge tone="neutral">Ordem Paranormal 2 · playtest</Badge>;
  if (systemId === 'tormenta20')
    return <Badge tone="warning">Tormenta20{edition ? ` · ${edition}` : ''}</Badge>;
  return (
    <Badge tone="brand">
      D&amp;D 5e · {edition === '2024' ? 'regras de 2024' : 'regras de 2014'}
    </Badge>
  );
}
