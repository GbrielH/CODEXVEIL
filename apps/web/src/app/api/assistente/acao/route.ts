import { z } from 'zod';
import { sessionFrom } from '@/lib/api-session';
import { executeTomoAction } from '@/lib/tomo-run';

/**
 * Confirmação das ações do Tomo vindas do app (o site usa a ação de servidor `runTomoAction`).
 * Aceita o token do app (`Authorization: Bearer`) e executa com o cliente da própria pessoa.
 */
const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type',
};

const bodySchema = z.object({
  scope: z
    .object({ campaignId: z.string().nullish(), characterId: z.string().nullish() })
    .default({}),
  action: z.unknown(),
});

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request): Promise<Response> {
  const session = await sessionFrom(request);
  if (!session)
    return Response.json(
      { ok: false, message: 'Entre na sua conta.' },
      { status: 401, headers: corsHeaders },
    );
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      { ok: false, message: 'Pedido inválido.' },
      { status: 400, headers: corsHeaders },
    );
  const result = await executeTomoAction(
    session.supabase,
    { id: session.userId },
    parsed.data.scope,
    parsed.data.action,
  );
  return Response.json(result, { headers: corsHeaders });
}
