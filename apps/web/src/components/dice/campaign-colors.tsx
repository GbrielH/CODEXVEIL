'use client';

import { getCampaignDicePalette, setMyDiceColor, type DicePalette } from '@codexveil/database';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useToast } from '@/components/ui/toast';
import { cx } from '@/lib/cx';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useRealtimeRefresh } from '@/lib/use-realtime';

export const DICE_COLORS = [
  '#7a1f2b',
  '#b23a48',
  '#d98e04',
  '#2f7d4a',
  '#1f6f8b',
  '#3b4cb8',
  '#6b3fa0',
  '#c2c2c8',
  '#222226',
  '#c46a2a',
  '#d4568c',
  '#5a8f29',
];

interface CampaignColorsValue {
  campaignId: string;
  userId: string | null;
  /** Cor dos dados de quem está usando (null = ainda não escolheu; não pode rolar). */
  myColor: string | null;
  /** O mestre já escolheu a cor (os jogadores só escolhem depois). */
  gmReady: boolean;
  isGm: boolean;
  colorOfUser: (userId: string | null | undefined) => string | null;
  colorOfCharacter: (characterId: string | null | undefined) => string | null;
  /** Cores já usadas por outras pessoas da mesa. */
  taken: Set<string>;
  choose: (color: string) => Promise<boolean>;
}

const CampaignColorsContext = createContext<CampaignColorsValue | null>(null);

/** Cores dos dados de cada participante da campanha, em tempo real. */
export function CampaignColorsProvider({
  campaignId,
  children,
}: {
  campaignId: string;
  children: ReactNode;
}) {
  const { toast } = useToast();
  const [palette, setPalette] = useState<DicePalette>({ members: [], characterOwners: {} });
  const [userId, setUserId] = useState<string | null>(null);

  const reload = useCallback(() => {
    getCampaignDicePalette(getSupabaseBrowserClient(), campaignId)
      .then(setPalette)
      .catch(() => undefined);
  }, [campaignId]);

  useEffect(() => {
    let active = true;
    const client = getSupabaseBrowserClient();
    void client.auth.getUser().then(({ data }) => {
      if (active) setUserId(data.user?.id ?? null);
    });
    getCampaignDicePalette(client, campaignId)
      .then((next) => {
        if (active) setPalette(next);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [campaignId]);

  useRealtimeRefresh(
    `cores-dados:${campaignId}`,
    [{ table: 'campaign_members', filter: `campaign_id=eq.${campaignId}` }],
    reload,
  );

  const value = useMemo<CampaignColorsValue>(() => {
    const byUser = new Map(palette.members.map((member) => [member.userId, member]));
    const me = userId ? byUser.get(userId) : undefined;
    const colorOfUser = (id: string | null | undefined) =>
      id ? (byUser.get(id)?.color ?? null) : null;
    return {
      campaignId,
      userId,
      myColor: me?.color ?? null,
      isGm: me?.role === 'gm',
      gmReady: palette.members.some((member) => member.role === 'gm' && member.color),
      colorOfUser,
      colorOfCharacter: (id) => (id ? colorOfUser(palette.characterOwners[id]) : null),
      taken: new Set(
        palette.members
          .filter((member) => member.userId !== userId && member.color)
          .map((member) => member.color!.toLowerCase()),
      ),
      choose: async (color) => {
        try {
          await setMyDiceColor(getSupabaseBrowserClient(), campaignId, color);
          setPalette((current) => ({
            ...current,
            members: current.members.map((member) =>
              member.userId === userId ? { ...member, color } : member,
            ),
          }));
          return true;
        } catch (error) {
          toast({
            tone: 'danger',
            title: 'A cor não foi salva',
            description: failureMessage(error, 'Tente novamente.'),
          });
          reload();
          return false;
        }
      },
    };
  }, [palette, userId, campaignId, toast, reload]);

  return <CampaignColorsContext.Provider value={value}>{children}</CampaignColorsContext.Provider>;
}

export function useCampaignColors(): CampaignColorsValue | null {
  return useContext(CampaignColorsContext);
}

/** Paleta de cores: as já usadas por outras pessoas ficam indisponíveis. */
export function DiceColorPalette({ onPicked }: { onPicked?: () => void }) {
  const colors = useCampaignColors();
  if (!colors) return null;
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Cor dos seus dados">
      {DICE_COLORS.map((color) => {
        const taken = colors.taken.has(color.toLowerCase());
        const current = color === colors.myColor;
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={current}
            aria-label={taken ? `Cor ${color} (já escolhida por outra pessoa)` : `Cor ${color}`}
            disabled={taken}
            onClick={() => void colors.choose(color).then((ok) => ok && onPicked?.())}
            className={cx(
              'h-7 w-7 rounded-full border',
              current ? 'border-parchment-200 ring-2 ring-parchment-300' : 'border-line-strong',
              taken && 'cursor-not-allowed opacity-25',
            )}
            style={{ backgroundColor: color }}
          />
        );
      })}
    </div>
  );
}

/** Faixa obrigatória enquanto a pessoa não escolheu a cor (sem cor não se rola dado). */
export function DiceColorRequired() {
  const colors = useCampaignColors();
  if (!colors || !colors.userId || colors.myColor) return null;
  const waiting = !colors.isGm && !colors.gmReady;
  return (
    <section
      className="flex flex-col gap-2 rounded-md border border-parchment-400/50 bg-raised p-4"
      aria-labelledby="cor-dados-obrigatoria"
    >
      <h2 id="cor-dados-obrigatoria" className="text-base font-medium text-fg">
        {waiting ? 'Aguardando o mestre escolher a cor dos dados' : 'Escolha a cor dos seus dados'}
      </h2>
      <p className="text-sm text-fg-secondary">
        {waiting
          ? 'O mestre escolhe primeiro; depois você escolhe a sua. Sem cor não é possível rolar dados.'
          : 'Obrigatório para rolar. A cor aparece nos seus dados e no nome do seu personagem para toda a mesa.'}
      </p>
      {waiting ? null : <DiceColorPalette />}
    </section>
  );
}

/** Nome do personagem com a cor dos dados do dono (bolinha + sublinhado). */
export function ColoredName({
  characterId,
  userId,
  children,
  className,
}: {
  characterId?: string | null;
  userId?: string | null;
  children: ReactNode;
  className?: string;
}) {
  const colors = useCampaignColors();
  const color = colors
    ? (colors.colorOfCharacter(characterId) ?? colors.colorOfUser(userId))
    : null;
  if (!color) return <span className={className}>{children}</span>;
  return (
    <span className={cx('inline-flex min-w-0 items-center gap-1.5', className)}>
      <span
        aria-hidden="true"
        className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/30"
        style={{ backgroundColor: color }}
      />
      <span
        className="truncate underline decoration-2 underline-offset-4"
        style={{ textDecorationColor: color }}
      >
        {children}
      </span>
    </span>
  );
}
