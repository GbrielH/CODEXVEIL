'use client';

import {
  getCampaignDicePalette,
  getSessionState,
  setMyDiceColor,
  type DicePalette,
} from '@codexveil/database';
import { DICE_COLORS, diceColorName, diceTextColor } from '@codexveil/domain';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { type DiceAppearance } from './dice-look';
import { useToast } from '@/components/ui/toast';
import { cx } from '@/lib/cx';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useRealtimeRefresh } from '@/lib/use-realtime';

export { DICE_COLORS };

interface CampaignColorsValue {
  campaignId: string;
  userId: string | null;
  /** Cor dos dados de quem está usando (null = ainda não escolheu; não pode rolar). */
  myColor: string | null;
  /** O mestre já escolheu a cor (os jogadores só escolhem depois). */
  gmReady: boolean;
  isGm: boolean;
  /** Sessão em andamento com dados virtuais: só nela a cor é escolhida (vale até o fim da sessão). */
  needsDice: boolean;
  colorOfUser: (userId: string | null | undefined) => string | null;
  colorOfCharacter: (characterId: string | null | undefined) => string | null;
  /** Face desenhada, cor e fonte dos números dos dados de alguém ("Meus dados"). */
  lookOfUser: (userId: string | null | undefined) => DiceAppearance | null;
  /** Dado vinculado ao personagem (um dos dados salvos do dono), se houver. */
  lookOfCharacter: (characterId: string | null | undefined) => DiceAppearance | null;
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
  const [palette, setPalette] = useState<DicePalette>({
    members: [],
    characterOwners: {},
    looks: {},
    imageUrls: {},
    characterLooks: {},
    characterImageUrls: {},
  });
  const [userId, setUserId] = useState<string | null>(null);
  const [needsDice, setNeedsDice] = useState(false);

  const reloadSession = useCallback(() => {
    getSessionState(getSupabaseBrowserClient(), campaignId)
      .then((state) => setNeedsDice(state.playing && !state.physicalDice))
      .catch(() => undefined);
  }, [campaignId]);

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
    getSessionState(client, campaignId)
      .then((state) => {
        if (active) setNeedsDice(state.playing && !state.physicalDice);
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
  // Iniciar ou encerrar a sessão apaga as cores no servidor; recarrega as duas coisas.
  useRealtimeRefresh(
    `cores-sessao:${campaignId}`,
    [{ table: 'sessions', filter: `campaign_id=eq.${campaignId}` }],
    () => {
      reloadSession();
      reload();
    },
  );

  const value = useMemo<CampaignColorsValue>(() => {
    const byUser = new Map(palette.members.map((member) => [member.userId, member]));
    const me = userId ? byUser.get(userId) : undefined;
    // A cor do dado vem de "Meus dados" (vale em todas as campanhas; não se escolhe mais na sessão).
    const colorOfUser = (id: string | null | undefined) =>
      id ? (palette.looks[id]?.color ?? null) : null;
    return {
      campaignId,
      userId,
      myColor: userId ? (palette.looks[userId]?.color ?? null) : null,
      isGm: me?.role === 'gm',
      needsDice: false,
      gmReady: palette.members.some((member) => member.role === 'gm' && member.color),
      colorOfUser,
      colorOfCharacter: (id) => (id ? colorOfUser(palette.characterOwners[id]) : null),
      lookOfCharacter: (id) => {
        const look = id ? palette.characterLooks[id] : undefined;
        return look ? { ...look, imageUrl: palette.characterImageUrls[id!] ?? null } : null;
      },
      lookOfUser: (id) => {
        const look = id ? palette.looks[id] : undefined;
        return look ? { ...look, imageUrl: palette.imageUrls[id!] ?? null } : null;
      },
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
  }, [palette, userId, campaignId, toast, reload, needsDice]);

  return <CampaignColorsContext.Provider value={value}>{children}</CampaignColorsContext.Provider>;
}

export function useCampaignColors(): CampaignColorsValue | null {
  return useContext(CampaignColorsContext);
}

/** Dado d20 desenhado na cor escolhida (usado na paleta e ao lado do nome do personagem). */
export function DieIcon({ color, className }: { color: string; className?: string }) {
  const ink = diceTextColor(color);
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cx('shrink-0', className)}>
      <polygon
        points="12,1.5 21.5,6.8 21.5,17.2 12,22.5 2.5,17.2 2.5,6.8"
        fill={color}
        stroke="rgba(0,0,0,0.45)"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <polygon
        points="12,6.2 17.6,15.6 6.4,15.6"
        fill="rgba(255,255,255,0.16)"
        stroke={ink}
        strokeOpacity="0.45"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      <path
        d="M12 1.5 L12 6.2 M21.5 6.8 L17.6 15.6 M2.5 6.8 L6.4 15.6 M21.5 17.2 L17.6 15.6 M2.5 17.2 L6.4 15.6 M12 22.5 L17.6 15.6 M12 22.5 L6.4 15.6 M2.5 6.8 L12 6.2 L21.5 6.8"
        fill="none"
        stroke={ink}
        strokeOpacity="0.3"
        strokeWidth="0.7"
      />
      <text
        x="12"
        y="13.6"
        textAnchor="middle"
        fontSize="4.6"
        fontWeight="700"
        fill={ink}
        fontFamily="ui-sans-serif, system-ui"
      >
        20
      </text>
    </svg>
  );
}

/** Paleta: um dado de cada cor; as já usadas por outras pessoas ficam indisponíveis. */
export function DiceColorPalette({ onPicked }: { onPicked?: () => void }) {
  const colors = useCampaignColors();
  if (!colors) return null;
  return (
    <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Cor dos seus dados">
      {DICE_COLORS.map(({ hex, name }) => {
        const taken = colors.taken.has(hex.toLowerCase());
        const current = hex === colors.myColor;
        return (
          <button
            key={hex}
            type="button"
            role="radio"
            aria-checked={current}
            aria-label={taken ? `${name} (já escolhida por outra pessoa)` : name}
            title={taken ? `${name}: já escolhida` : name}
            disabled={taken}
            onClick={() => void colors.choose(hex).then((ok) => ok && onPicked?.())}
            className={cx(
              'rounded-md p-0.5 transition-transform',
              current ? 'bg-parchment-300/25 ring-2 ring-parchment-300' : 'hover:scale-110',
              taken && 'cursor-not-allowed opacity-20 hover:scale-100',
            )}
          >
            <DieIcon color={hex} className="h-8 w-8" />
          </button>
        );
      })}
    </div>
  );
}

/** Nome do personagem com o dado na cor do dono (e sublinhado na mesma cor). */
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
    <span
      className={cx('inline-flex min-w-0 items-center gap-1.5', className)}
      title={`Dados: ${diceColorName(color)}`}
    >
      <DieIcon color={color} className="h-4 w-4" />
      <span
        className="truncate underline decoration-2 underline-offset-4"
        style={{ textDecorationColor: color }}
      >
        {children}
      </span>
    </span>
  );
}
