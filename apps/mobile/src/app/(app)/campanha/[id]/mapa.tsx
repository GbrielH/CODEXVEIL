import { getActiveMap, getCampaign, listCampaignCharacters, listMapTokens, moveMyToken, signedMediaUrls, tokenImagePaths, type MapToken } from '@codexveil/database';
import { formatMeters, gridDistance, tokenSizeSquares } from '@codexveil/domain';
import { characterSpeedMeters } from '@codexveil/rpg-systems';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ZoomIn, ZoomOut } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { useDicePalette } from '@/components/dice/dice-color';
import { MapBoard } from '@/components/map/map-board';
import { IconButton } from '@/components/ui/button';
import { AppText } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { useAsyncData, useRealtimeRefresh } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type MapLayer = { path: string; x: number; y: number; width: number; url: string; aspect: number };

/** Mapa ativo da sessão no app (só jogar): ver a grade e mover o próprio token. */
export default function CampaignMapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const toast = useToast();
  const palette = useDicePalette(id);
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState(false);
  const { data, error, loading, refreshing, reload, mutate } = useAsyncData(async () => {
    const client = getSupabase();
    const campaign = await getCampaign(client, id, userId);
    if (!campaign) return null;
    const [map, party] = await Promise.all([getActiveMap(client, campaign.id), listCampaignCharacters(client, campaign.id)]);
    const own = party.find((character) => character.ownerId === userId) ?? null;
    if (!map) return { campaign, map: null, tokens: [] as MapToken[], imageUrl: null as string | null, tokenImages: {}, layers: [] as MapLayer[], own };
    const tokens = await listMapTokens(client, map.id);
    const paths = await tokenImagePaths(client, tokens).catch((): Record<string, string> => ({}));
    const urls = await signedMediaUrls(client, [map.imagePath, ...map.images.map((layer) => layer.path), ...Object.values(paths)]);
    // Imagens (camadas) com a proporção de cada uma, para desenhar na largura escolhida pelo mestre.
    const layers = await Promise.all(
      map.images.flatMap((layer) => {
        const url = urls[layer.path];
        if (!url) return [];
        return [
          new Promise<MapLayer>((resolve) =>
            Image.getSize(
              url,
              (width, height) => resolve({ ...layer, url, aspect: width ? height / width : 1 }),
              () => resolve({ ...layer, url, aspect: 1 }),
            ),
          ),
        ];
      }),
    );
    const tokenImages = Object.fromEntries(Object.entries(paths).flatMap(([tokenId, path]) => (urls[path] ? [[tokenId, urls[path]]] : [])));
    return { campaign, map, tokens, imageUrl: map.imagePath ? (urls[map.imagePath] ?? null) : null, tokenImages, layers, own };
  }, `${id}:${userId}`);

  useRealtimeRefresh(
    `grade-app:${id}`,
    [
      { table: 'session_maps', filter: `campaign_id=eq.${id}` },
      { table: 'map_tokens', filter: `campaign_id=eq.${id}` },
    ],
    reload,
  );
  // Quando o mestre esconde o mapa o tempo real não avisa (RLS); confere de tempos em tempos.
  useEffect(() => {
    const timer = setInterval(reload, 20000);
    return () => clearInterval(timer);
  }, [reload]);

  if (loading) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) {
    return (
      <Screen>
        <EmptyState title="Campanha não encontrada" description="Ela não existe ou você não participa dela." />
      </Screen>
    );
  }

  const { map, tokens, imageUrl, tokenImages, layers, own } = data;
  const myToken = tokens.find((token) => token.characterId !== null && token.characterId === own?.id) ?? null;

  const tap = (x: number, y: number) => {
    if (!map || !myToken) return;
    const side = tokenSizeSquares[myToken.size];
    const onMine = x >= myToken.x && x < myToken.x + side && y >= myToken.y && y < myToken.y + side;
    if (onMine) {
      setSelected((current) => !current);
      return;
    }
    if (!selected) return;
    const nx = Math.max(0, Math.min(map.cols - side, x));
    const ny = Math.max(0, Math.min(map.rows - side, y));
    setSelected(false);
    const walked = gridDistance(myToken, { x: nx, y: ny }, data.campaign.systemId);
    const limit = own ? characterSpeedMeters(data.campaign.systemId, own.sheet) : null;
    const over = limit !== null && walked.meters > limit;
    toast({
      tone: over ? 'danger' : 'info',
      title: `Você andou ${formatMeters(walked.meters)}${limit !== null ? ` de ${formatMeters(limit)}` : ''}`,
      description: over ? 'Passou do seu deslocamento (o movimento foi feito; combine com o mestre).' : `${walked.squares} ${walked.squares === 1 ? 'quadrado' : 'quadrados'} de 1,5 m.`,
    });
    mutate((current) => (current ? { ...current, tokens: current.tokens.map((token) => (token.id === myToken.id ? { ...token, x: nx, y: ny } : token)) } : current));
    moveMyToken(getSupabase(), myToken.id, nx, ny).catch((cause: unknown) => {
      toast({ tone: 'danger', title: 'O token não foi movido', description: failureMessage(cause) });
      reload();
    });
  };

  return (
    <Screen eyebrow={data.campaign.name} title={map?.name ?? 'Mapa'} refreshing={refreshing} onRefresh={reload}>
      <Stack.Screen options={{ title: 'Mapa' }} />
      {!map ? (
        <EmptyState title="Nenhum mapa ativo" description="Quando o mestre mostrar um mapa da sessão, ele aparece aqui na hora." />
      ) : (
        <>
          <AppText variant="small">
            {myToken
              ? selected
                ? 'Agora toque no quadrado para onde quer ir.'
                : 'Toque no seu token (borda branca) e depois no quadrado de destino. Cada quadrado = 1,5 m.'
              : 'Cada quadrado = 1,5 m. O mestre ainda não colocou o seu personagem no mapa.'}
          </AppText>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 6 }}>
            <IconButton icon={<ZoomOut size={18} color={colors.fg} />} accessibilityLabel="Diminuir o zoom" onPress={() => setZoom((value) => Math.max(0.5, value - 0.25))} />
            <IconButton icon={<ZoomIn size={18} color={colors.fg} />} accessibilityLabel="Aumentar o zoom" onPress={() => setZoom((value) => Math.min(3, value + 0.25))} />
          </View>
          <MapBoard
            map={map}
            tokens={tokens}
            imageUrl={imageUrl}
            tokenImages={tokenImages}
            layers={layers}
            systemId={data.campaign.systemId}
            myCharacterId={own?.id ?? null}
            zoom={zoom}
            selected={selected}
            colorOfCharacter={(characterId) => palette.colorOfCharacter(characterId)}
            onTapCell={tap}
          />
        </>
      )}
    </Screen>
  );
}
