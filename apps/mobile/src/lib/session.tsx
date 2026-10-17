/**
 * Estado de autenticação do app. A sessão vem do Supabase Auth (nunca de um sistema
 * próprio de senhas). Quando a sessão expira sem o usuário ter saído, o app volta ao
 * login explicando o motivo.
 */
import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { unregisterFromPush } from './notifications';
import { bindAuthRefreshToAppState, getSupabase, supabaseConfig } from './supabase';

interface SessionState {
  status: 'loading' | 'signed-in' | 'signed-out';
  userId: string | null;
  email: string | null;
  /** A sessão terminou sem o usuário pedir (token expirado ou revogado). */
  expired: boolean;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

function fromSession(session: Session | null) {
  return { userId: session?.user.id ?? null, email: session?.user.email ?? null };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<SessionState, 'signOut'>>({
    status: supabaseConfig.ok ? 'loading' : 'signed-out',
    userId: null,
    email: null,
    expired: false,
  });
  const signingOut = useRef(false);

  useEffect(() => {
    if (!supabaseConfig.ok) return;
    const supabase = getSupabase();
    const unbind = bindAuthRefreshToAppState();

    supabase.auth
      .getSession()
      .then(({ data }) => {
        setState({ status: data.session ? 'signed-in' : 'signed-out', ...fromSession(data.session), expired: false });
      })
      .catch(() => setState({ status: 'signed-out', userId: null, email: null, expired: false }));

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setState((previous) => ({
        status: session ? 'signed-in' : 'signed-out',
        ...fromSession(session),
        expired: event === 'SIGNED_OUT' && previous.status === 'signed-in' && !signingOut.current,
      }));
      if (event === 'SIGNED_OUT') signingOut.current = false;
    });

    return () => {
      data.subscription.unsubscribe();
      unbind();
    };
  }, []);

  const signOut = async () => {
    if (!supabaseConfig.ok) return;
    signingOut.current = true;
    // O aparelho deixa de receber avisos desta conta (precisa da sessão ainda válida).
    await unregisterFromPush();
    await getSupabase().auth.signOut();
  };

  return <SessionContext.Provider value={{ ...state, signOut }}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession precisa estar dentro de <SessionProvider>.');
  return context;
}

/** Id do usuário autenticado (as telas privadas só renderizam com sessão). */
export function useUserId(): string {
  const { userId } = useSession();
  if (!userId) throw new Error('Tela privada renderizada sem sessão.');
  return userId;
}
