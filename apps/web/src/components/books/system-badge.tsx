import { Badge } from '@/components/ui/badge';

/** Selo do sistema do livro (D&D 5e, Tormenta20 ou Assimilação RPG), com a edição das regras. */
export function SystemBadge({ systemId, edition }: { systemId: string | null; edition: string }) {
  if (systemId === 'assimilacao') return <Badge tone="danger">Assimilação RPG</Badge>;
  if (systemId === 'tormenta20')
    return <Badge tone="warning">Tormenta20{edition ? ` · ${edition}` : ''}</Badge>;
  return (
    <Badge tone="brand">
      D&amp;D 5e · {edition === '2024' ? 'regras de 2024' : 'regras de 2014'}
    </Badge>
  );
}
