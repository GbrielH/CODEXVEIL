import { getActiveMap, getCampaign, getCampaignTurn, listCampaignCharacters, listMapTokens, moveMyToken, signedMediaUrls, updateMapToken, tokenImagePaths, type MapToken } from '@codexveil/database';
import { activeTurnTokenId, formatMeters, gridDistance, movementCrossesWall, tokenSizeSquares } from '@codexveil/domain';
import { characterSpeedMeters } from '@codexveil/rpg-systems';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Maximize2, X, ZoomIn, ZoomOut } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Image, Modal, StatusBar, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

type MapLayer = { path: string; x: number; y: number; width: number; rotation?: number; url: string; aspect: number };

/** Mapa ativo da sessão no app (só jogar): ver a grade e mover o próprio token. */
export default function CampaignMapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const toast = useToast();
  const palette = useDicePalette(id);
  const [zoom, setZoom] = useState(1);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [named, setNamed] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Tela cheia gira para a horizontal; ao sair, volta a seguir o aparelho.
  useEffect(() => {
    if (!fullscreen) return;
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => undefined);
    return () => {
      void ScreenOrientation.unlockAsync().catch(() => undefined);
    };
  }, [fullscreen]);
  useEffect(() => {
    if (!named) return;
    const timer = setTimeout(() => setNamed(null), 4000);
    return () => clearTimeout(timer);
  }, [named]);
  const { data, error, loading, refreshing, reload, mutate } = useAsyncData(async () => {
    const client = getSupabase();
    const campaign = await getCampaign(client, id, userId);
    if (!campaign) return null;
    const [map, party, turn] = await Promise.all([getActiveMap(client, campaign.id), listCampaignCharacters(client, campaign.id), getCampaignTurn(client, campaign.id).catch(() => null)]);
    // Só em combate valem o limite de deslocamento e os metros; fora dele, movimentação livre.
    const inCombat = turn?.mode === 'combat' && turn.status === 'active';
    const own = party.find((character) => character.ownerId === userId) ?? null;
    if (!map) return { campaign, map: null, tokens: [] as MapToken[], imageUrl: null as string | null, tokenImages: {}, layers: [] as MapLayer[], own, inCombat, turn };
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
    return { campaign, map, tokens, imageUrl: map.imagePath ? (urls[map.imagePath] ?? null) : null, tokenImages, layers, own, inCombat, turn };
  }, `${id}:${userId}`);

  useRealtimeRefresh(
    `grade-app:${id}`,
    [
      { table: 'session_maps', filter: `campaign_id=eq.${id}` },
      { table: 'map_tokens', filter: `campaign_id=eq.${id}` },
      { table: 'campaign_turns', filter: `campaign_id=eq.${id}` },
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

  const { map, tokens, imageUrl, tokenImages, layers, own, inCombat, turn } = data;
  const myToken = tokens.find((token) => token.characterId !== null && token.characterId === own?.id) ?? null;
  const activeTokenId = activeTurnTokenId(tokens, turn);
  const myTurn = turn?.status === 'active' && turn.mode === 'combat' && turn.activeCharacterId === own?.id;

  // Mestre (no app também): move qualquer token, como no site; o jogador move só o próprio.
  const isGm = data.campaign.role === 'gm';
  const movingToken = movingId ? (tokens.find((token) => token.id === movingId) ?? null) : null;

  const tap = (x: number, y: number) => {
    if (!map) return;
    const touched = tokens.find((token) => {
      const tokenSide = tokenSizeSquares[token.size];
      return x >= token.x && x < token.x + tokenSide && y >= token.y && y < token.y + tokenSide;
    });
    if (!movingToken) {
      if (touched && (isGm || touched.id === myToken?.id)) setMovingId(touched.id);
      else if (touched) setNamed(touched.id);
      return;
    }
    // Tocar de novo no token escolhido cancela; em outro (mestre), troca a escolha.
    if (touched?.id === movingToken.id) {
      setMovingId(null);
      return;
    }
    if (touched && isGm) {
      setMovingId(touched.id);
      return;
    }
    const side = tokenSizeSquares[movingToken.size];
    const nx = Math.max(0, Math.min(map.cols - side, x));
    const ny = Math.max(0, Math.min(map.rows - side, y));
    setMovingId(null);
    // Mesmas regras do site: outro token no destino impede; paredes só barram os jogadores.
    const occupied = tokens.some((other) => {
      if (other.id === movingToken.id) return false;
      const otherSide = tokenSizeSquares[other.size];
      return nx < other.x + otherSide && other.x < nx + side && ny < other.y + otherSide && other.y < ny + side;
    });
    const walled = !isGm && movementCrossesWall(map.walls, { x: movingToken.x + side / 2, y: movingToken.y + side / 2 }, { x: nx + side / 2, y: ny + side / 2 });
    if (occupied || walled) {
      toast({ tone: 'warning', title: occupied ? 'Quadrado ocupado' : 'Parede no caminho', description: occupied ? 'Já há outro token ali.' : 'Contorne a parede, em mais de um movimento.' });
      return;
    }
    const mineMoving = movingToken.id === myToken?.id;
    if (inCombat && mineMoving) {
      const walked = gridDistance(movingToken, { x: nx, y: ny }, data.campaign.systemId);
      const limit = own ? characterSpeedMeters(data.campaign.systemId, own.sheet) : null;
      const over = limit !== null && walked.meters > limit;
      toast({
        tone: over ? 'danger' : 'info',
        title: `Você andou ${formatMeters(walked.meters)}${limit !== null ? ` de ${formatMeters(limit)}` : ''}`,
        description: over ? 'Passou do seu deslocamento (o movimento foi feito; combine com o mestre).' : `${walked.squares} ${walked.squares === 1 ? 'quadrado' : 'quadrados'} de 1,5 m.`,
      });
    }
    mutate((current) => (current ? { ...current, tokens: current.tokens.map((token) => (token.id === movingToken.id ? { ...token, x: nx, y: ny } : token)) } : current));
    const client = getSupabase();
    (isGm && !mineMoving ? updateMapToken(client, movingToken.id, { x: nx, y: ny }) : moveMyToken(client, movingToken.id, nx, ny)).catch((cause: unknown) => {
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
          {inCombat ? (
            <View style={{ borderWidth: 1, borderColor: myTurn ? '#f6c453' : colors.line, borderRadius: 8, padding: 10, backgroundColor: myTurn ? 'rgba(246,196,83,0.12)' : colors.sunken }}>
              <AppText variant="small">Vez: {turn?.activeName ?? 'combatente oculto'} · rodada {turn?.round ?? 0}</AppText>
              {myTurn ? <AppText variant="heading">Sua vez</AppText> : null}
            </View>
          ) : null}
          <AppText variant="small">
            {movingToken
              ? `Agora toque no quadrado para onde ${movingToken.id === myToken?.id ? 'quer ir' : `levar ${movingToken.label || 'o token'}`}.`
              : isGm
                ? 'Mestre: toque em qualquer token e depois no quadrado de destino. Cada quadrado = 1,5 m.'
                : myToken
                  ? 'Toque no seu token (borda branca) e depois no quadrado de destino. Toque em outro token para ver o nome. Cada quadrado = 1,5 m.'
                  : 'Cada quadrado = 1,5 m. O mestre ainda não colocou o seu personagem no mapa.'}
          </AppText>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 6 }}>
            <IconButton icon={<Maximize2 size={18} color={colors.fg} />} accessibilityLabel="Mapa em tela cheia" onPress={() => setFullscreen(true)} />
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
            selected={movingToken !== null && movingToken.id === myToken?.id}
            movingTokenId={movingId}
            namedTokenId={named}
            activeTokenId={activeTokenId}
            freeMovement={!inCombat}
            colorOfCharacter={(characterId) => palette.colorOfCharacter(characterId)}
            onTapCell={tap}
          />
          <Modal visible={fullscreen} animationType="fade" supportedOrientations={['landscape', 'portrait']} onRequestClose={() => setFullscreen(false)}>
            <StatusBar hidden />
            <View style={{ flex: 1, backgroundColor: '#0b0b0f', paddingLeft: insets.left, paddingRight: insets.right }}>
          <MapBoard
              map={map}
              tokens={tokens}
              imageUrl={imageUrl}
              tokenImages={tokenImages}
              layers={layers}
              systemId={data.campaign.systemId}
              myCharacterId={own?.id ?? null}
              zoom={zoom}
              selected={movingToken !== null && movingToken.id === myToken?.id}
              movingTokenId={movingId}
              namedTokenId={named}
              activeTokenId={activeTokenId}
              freeMovement={!inCombat}
              colorOfCharacter={(characterId) => palette.colorOfCharacter(characterId)}
              onTapCell={tap}
              maxHeight={window.height}
            />
              <View style={{ position: 'absolute', top: 12, right: 12 + insets.right, flexDirection: 'row', gap: 6 }}>
                <IconButton icon={<ZoomOut size={18} color={colors.fg} />} accessibilityLabel="Diminuir o zoom" onPress={() => setZoom((value) => Math.max(0.5, value - 0.25))} />
                <IconButton icon={<ZoomIn size={18} color={colors.fg} />} accessibilityLabel="Aumentar o zoom" onPress={() => setZoom((value) => Math.min(3, value + 0.25))} />
                <IconButton icon={<X size={18} color={colors.fg} />} accessibilityLabel="Sair da tela cheia" onPress={() => setFullscreen(false)} />
              </View>
            </View>
          </Modal>
        </>
      )}
    </Screen>
  );
}
