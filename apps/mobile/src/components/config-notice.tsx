import { supabaseConfig } from '@/lib/supabase';
import { Notice } from './ui/states';

/** Explica, sem fingir que funciona, que o backend ainda não foi configurado neste build. */
export function ConfigNotice() {
  if (supabaseConfig.ok) return null;
  return (
    <Notice
      tone="warning"
      title="Configuração pendente"
      message={`O backend (Supabase) não foi configurado neste build. Defina as variáveis em apps/mobile/.env.local conforme o README. ${supabaseConfig.problems.join(' ')}`}
    />
  );
}
