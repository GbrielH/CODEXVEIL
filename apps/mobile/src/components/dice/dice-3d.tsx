import { signedMediaUrls } from '@codexveil/database';
import { diceLookSchema, preferencesSchema, type DiceLook } from '@codexveil/validation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { AppText } from '@/components/ui/primitives';
import { getSupabase } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';
import type { ShownRoll } from './dice';

/** Dados que a biblioteca 3D desenha (o resto entra só no total). */
const SUPPORTED_SIDES = new Set([4, 6, 8, 10, 12, 20, 100]);
const MAX_DICE = 8;
/** Sem resposta da cena (sem internet, aparelho lento): fecha e fica só o aviso com o total. */
const GIVE_UP_MS = 9000;
const DEFAULT_COLOR = '#6b1d2a';

/** Aparência pronta para a cena: a imagem já como endereço assinado. */
export type DiceAppearance = DiceLook & { imageUrl: string | null };

const FONT_FAMILIES: Record<string, string> = {
  classic: '"Times New Roman", serif',
  modern: 'Arial, sans-serif',
  machine: '"Courier New", monospace',
  display: 'Georgia, serif',
};

/** Notação da biblioteca com os valores já sorteados ("2d6+1d20@3,5,17"), como no site. */
export function diceNotation(roll: ShownRoll): string | null {
  const groups: string[] = [];
  const values: number[] = [];
  let used = 0;
  for (const group of roll.dice) {
    if (!SUPPORTED_SIDES.has(group.sides)) continue;
    if (group.sides === 100) {
      const take = group.values.slice(0, Math.max(0, Math.floor((MAX_DICE - used) / 2)));
      if (!take.length) continue;
      used += take.length * 2;
      groups.push(`${take.length}d100`, `${take.length}d10`);
      values.push(...take.map((v) => Math.floor((v % 100) / 10)), ...take.map((v) => v % 10));
      continue;
    }
    const take = group.values.slice(0, Math.max(0, MAX_DICE - used));
    if (!take.length) continue;
    used += take.length;
    groups.push(`${take.length}d${group.sides}`);
    values.push(...take);
  }
  return groups.length ? `${groups.join('+')}@${values.join(',')}` : null;
}

/**
 * Aparência dos dados de quem rola: o dado vinculado ao personagem ou o padrão de "Meus dados".
 */
export async function loadDiceAppearance(characterId: string | null): Promise<DiceAppearance | null> {
  const client = getSupabase();
  let look: DiceLook | null = null;
  if (characterId) {
    const { data: character } = await client
      .from('characters')
      .select('dice_id')
      .eq('id', characterId)
      .maybeSingle();
    if (character?.dice_id) {
      const { data: row } = await client
        .from('user_dice')
        .select('image_path, number_color, font, color')
        .eq('id', character.dice_id)
        .maybeSingle();
      if (row)
        look = diceLookSchema.parse({
          image: row.image_path,
          numberColor: row.number_color,
          font: row.font,
          color: row.color,
        });
    }
  }
  if (!look) {
    const { data: auth } = await client.auth.getUser();
    if (!auth.user) return null;
    const { data } = await client
      .from('profiles')
      .select('preferences')
      .eq('id', auth.user.id)
      .maybeSingle();
    look = preferencesSchema.safeParse(data?.preferences).data?.dice ?? null;
  }
  if (!look) return null;
  const urls = look.image ? await signedMediaUrls(client, [look.image]) : {};
  return { ...look, imageUrl: look.image ? (urls[look.image] ?? null) : null };
}

/** Página da cena: a mesma biblioteca do site, em tela cheia e fundo transparente. */
function sceneHtml(notation: string, look: DiceAppearance | null): string {
  const color = look?.color ?? DEFAULT_COLOR;
  const config = {
    notation,
    color,
    numbers: look?.numberColor ?? null,
    font: look?.font ? (FONT_FAMILIES[look.font] ?? null) : null,
    image: look?.imageUrl ?? null,
  };
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:transparent;overflow:hidden}#mesa{position:fixed;inset:0}#mesa canvas{width:100%!important;height:100%!important}</style></head>
<body><div id="mesa"></div><script type="module">
const cfg = ${JSON.stringify(config)};
const post = (type) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(type);
const luma = (hex) => { const n = parseInt(hex.slice(1), 16); return (0.299*(n>>16&255)+0.587*(n>>8&255)+0.114*(n&255))/255; };
try {
  const { default: Box } = await import('https://cdn.jsdelivr.net/npm/@3d-dice/dice-box-threejs@0.0.12/dist/dice-box-threejs.es.js');
  const box = new Box('#mesa', { sounds: false, shadows: true, theme_material: 'plastic', gravity_multiplier: 400, baseScale: 100, strength: 1.3, light_intensity: 0.9 });
  await box.initialize();
  // Skin de "Meus dados": imagem por endereço e fonte dos números.
  const colorsApi = box.DiceColors;
  const getTexture = colorsApi.getTexture.bind(colorsApi);
  colorsApi.getTexture = (name) => typeof name === 'string' && name.startsWith('cv-face:')
    ? { name: 'cv-face', composite: 'source-over', source: name.slice(8), material: 'plastic' }
    : getTexture(name);
  const loadImage = colorsApi.loadImage.bind(colorsApi);
  colorsApi.loadImage = (src) => /^(https?:|data:)/.test(src)
    ? new Promise((ok) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = () => ok(undefined); i.src = src; })
    : loadImage(src);
  if (cfg.font) for (const t of ['d4','d6','d8','d10','d100','d12','d20']) box.DiceFactory.get(t).font = cfg.font;
  await box.updateConfig({ theme_customColorset: {
    name: 'cv-app', background: cfg.color, foreground: cfg.numbers || (luma(cfg.color) > 0.55 ? '#111111' : '#ffffff'),
    outline: '#000000', texture: cfg.image ? 'cv-face:' + cfg.image : 'none', material: 'plastic' } });
  post('pronto');
  await box.roll(cfg.notation);
  post('parou');
} catch (error) { post('falhou'); }
</script></body></html>`;
}

/**
 * Dados 3D caindo por cima de qualquer tela (sem mesa), com os valores já sorteados. O total
 * aparece quando param; tocar fecha. Sem a cena (sem internet), fecha sozinho.
 */
export function Dice3DThrow({
  roll,
  look,
  onDone,
}: {
  roll: ShownRoll & { key: number };
  look: DiceAppearance | null;
  onDone: () => void;
}) {
  const notation = useMemo(() => diceNotation(roll), [roll]);
  const html = useMemo(() => (notation ? sceneHtml(notation, look) : null), [notation, look]);
  const [stopped, setStopped] = useState(false);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!html) {
      done.current();
      return;
    }
    const giveUp = setTimeout(() => done.current(), GIVE_UP_MS);
    return () => clearTimeout(giveUp);
  }, [html]);
  useEffect(() => {
    if (!stopped) return;
    const close = setTimeout(() => done.current(), 2200);
    return () => clearTimeout(close);
  }, [stopped]);

  if (!html) return null;
  const onMessage = (event: WebViewMessageEvent) => {
    if (event.nativeEvent.data === 'parou') setStopped(true);
    if (event.nativeEvent.data === 'falhou') done.current();
  };
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onDone} statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={onDone} accessibilityLabel="Fechar os dados">
        <WebView
          source={{ html, baseUrl: 'https://codexveil.vercel.app' }}
          originWhitelist={['*']}
          onMessage={onMessage}
          style={{ flex: 1, backgroundColor: 'transparent' }}
          containerStyle={{ backgroundColor: 'transparent' }}
          pointerEvents="none"
          scrollEnabled={false}
          javaScriptEnabled
        />
        {stopped ? (
          <View style={styles.total} pointerEvents="none">
            <AppText style={styles.totalText}>{roll.total}</AppText>
            {roll.label ? <AppText variant="small">{roll.label}</AppText> : null}
          </View>
        ) : null}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  total: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(11, 11, 15, 0.85)',
    borderWidth: 1,
    borderColor: colors.line,
  },
  totalText: { fontFamily: fonts.displayBold, fontSize: 40, color: colors.fgAccent },
});
