import { Alert } from '@/components/ui/alert';
import { supabaseConfig } from '@/lib/env';

/**
 * Exibido quando o backend (Supabase) não está configurado. Não finge que a funcionalidade
 * existe: explica o que falta e onde configurar.
 */
export function ConfigNotice() {
  if (supabaseConfig.ok) return null;
  return (
    <Alert tone="warning" title="Configuração pendente">
      <p>
        O backend (Supabase) ainda não foi conectado neste ambiente, então contas e campanhas
        não estão disponíveis. Defina as variáveis em <code>apps/web/.env.local</code> conforme o
        README.
      </p>
      <ul className="mt-2 list-disc pl-5">
        {supabaseConfig.problems.map((problem) => (
          <li key={problem}>{problem}</li>
        ))}
      </ul>
    </Alert>
  );
}
