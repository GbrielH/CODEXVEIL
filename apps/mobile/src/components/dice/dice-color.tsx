import { getCampaignDicePalette, getSessionState } from '@codexveil/database';
import { diceTextColor } from '@codexveil/domain';
import Svg, { Path, Polygon, Text as SvgText } from 'react-native-svg';
import { useAsyncData, useRealtimeRefresh } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';

/**
 * Cores dos dados da mesa (em tempo real), a cor de cada personagem (pelo dono) e se há sessão
 * em andamento com dados virtuais (só nela a cor é escolhida; vale até o fim da sessão).
 */
export function useDicePalette(campaignId: string) {
  const userId = useUserId();
  const { data, reload, mutate } = useAsyncData(async () => {
    const client = getSupabase();
    const [palette, session] = await Promise.all([
      getCampaignDicePalette(client, campaignId),
      getSessionState(client, campaignId),
    ]);
    return { ...palette, needsDice: session.playing && !session.physicalDice };
  }, `paleta:${campaignId}`);
  useRealtimeRefresh(
    `cores-dados:${campaignId}`,
    [
      { table: 'campaign_members', filter: `campaign_id=eq.${campaignId}` },
      { table: 'sessions', filter: `campaign_id=eq.${campaignId}` },
    ],
    reload,
  );
  const members = data?.members ?? [];
  const me = members.find((member) => member.userId === userId);
  // A cor do dado vem de "Meus dados" (o perfil), não mais da sessão.
  const colorOfUser = (id: string | null | undefined) =>
    id ? (data?.looks[id]?.color ?? null) : null;
  return {
    loaded: data !== null,
    needsDice: data?.needsDice ?? false,
    myColor: colorOfUser(userId),
    isGm: me?.role === 'gm',
    gmReady: members.some((member) => member.role === 'gm' && member.color),
    taken: new Set(
      members
        .filter((member) => member.userId !== userId && member.color)
        .map((member) => member.color!.toLowerCase()),
    ),
    colorOfCharacter: (id: string | null | undefined) =>
      id && data ? colorOfUser(data.characterOwners[id]) : null,
    setLocal: (color: string) =>
      mutate((current) => ({
        ...current,
        members: current.members.map((member) =>
          member.userId === userId ? { ...member, color } : member,
        ),
      })),
    reload,
  };
}

/** Dado d20 desenhado na cor escolhida. */
export function DieIcon({ color, size = 32 }: { color: string; size?: number }) {
  const ink = diceTextColor(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Polygon
        points="12,1.5 21.5,6.8 21.5,17.2 12,22.5 2.5,17.2 2.5,6.8"
        fill={color}
        stroke="rgba(0,0,0,0.45)"
        strokeWidth={1}
        strokeLinejoin="round"
      />
      <Polygon
        points="12,6.2 17.6,15.6 6.4,15.6"
        fill="rgba(255,255,255,0.16)"
        stroke={ink}
        strokeOpacity={0.45}
        strokeWidth={0.8}
        strokeLinejoin="round"
      />
      <Path
        d="M12 1.5 L12 6.2 M21.5 6.8 L17.6 15.6 M2.5 6.8 L6.4 15.6 M21.5 17.2 L17.6 15.6 M2.5 17.2 L6.4 15.6 M12 22.5 L17.6 15.6 M12 22.5 L6.4 15.6 M2.5 6.8 L12 6.2 L21.5 6.8"
        fill="none"
        stroke={ink}
        strokeOpacity={0.3}
        strokeWidth={0.7}
      />
      <SvgText x="12" y="13.6" textAnchor="middle" fontSize="4.6" fontWeight="700" fill={ink}>
        20
      </SvgText>
    </Svg>
  );
}

/** Dado na cor do dono do personagem (ao lado do nome). */
export function ColorDot({ color }: { color: string | null }) {
  if (!color) return null;
  return <DieIcon color={color} size={14} />;
}
