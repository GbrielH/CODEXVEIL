import { Badge } from '@/components/ui/badge';

/** Selo do sistema do livro (D&D 5e ou Tormenta20), com a edição das regras. */
export function SystemBadge({ systemId, edition }: { systemId: string | null; edition: string }) {
  if (systemId === 'tormenta20') return <Badge tone="warning">Tormenta20{edition ? ` · ${edition}` : ''}</Badge>;
  return <Badge tone="brand">D&amp;D 5e · {edition === '2024' ? 'regras de 2024' : 'regras de 2014'}</Badge>;
}
