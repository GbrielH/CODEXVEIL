import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types.gen';

/**
 * Cliente Supabase tipado com o esquema do Codexveil. Cada app cria a instância do seu
 * jeito (cookies no Next.js, armazenamento local no Expo) e repassa para as funções de
 * acesso a dados deste pacote, que são as mesmas na web e no mobile.
 */
export type CodexveilClient = SupabaseClient<Database>;
