import {
  listTranscript,
  saveTranscriptSegment,
  type TranscriptSegment,
} from '@codexveil/database';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/primitives';
import { createDeviceTranscription } from '@/lib/device-transcription';
import { useRealtimeRefresh } from '@/lib/hooks';
import { getSupabase } from '@/lib/supabase';
import { colors, radii, spacing } from '@/lib/theme';

/**
 * Transcrição na call do app: aviso de gravação, pausa da própria voz e as últimas falas (com o
 * personagem) por cima da chamada. O mestre liga e desliga a gravação somente pelo site.
 */
export function CallTranscript({ roomId }: { roomId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [paused, setPaused] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [lines, setLines] = useState<TranscriptSegment[]>([]);
  const [provider] = useState(() => createDeviceTranscription());

  const loadState = useCallback(() => {
    void getSupabase()
      .from('call_rooms')
      .select('transcription_enabled')
      .eq('id', roomId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setEnabled(data.transcription_enabled);
      });
  }, [roomId]);
  const loadLines = useCallback(() => {
    listTranscript(getSupabase(), roomId)
      .then((all) => setLines(all.slice(-3)))
      .catch(() => undefined);
  }, [roomId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadState();
      loadLines();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadState, loadLines]);
  useRealtimeRefresh(
    `transcricao-app:${roomId}`,
    [{ table: 'call_rooms', filter: `id=eq.${roomId}` }],
    loadState,
  );
  useRealtimeRefresh(
    `transcricao-falas-app:${roomId}`,
    [{ table: 'transcript_segments', filter: `room_id=eq.${roomId}` }],
    loadLines,
  );

  useEffect(() => {
    if (!enabled || paused || !provider.supported) return;
    provider.start(
      (speech) => {
        void saveTranscriptSegment(getSupabase(), roomId, speech).catch(() =>
          setProblem('Um trecho não foi salvo.'),
        );
      },
      (message) => setProblem(message),
    );
    return () => provider.stop();
  }, [enabled, paused, provider, roomId]);

  if (!enabled) return null;
  return (
    <View style={styles.box} pointerEvents="box-none">
      {enabled ? (
        <AppText variant="small" style={{ color: '#e8c872' }}>
          ● Esta call está sendo transcrita
          {provider.supported ? (paused ? ' · sua voz pausada' : '') : ' · este APK não transcreve'}
        </AppText>
      ) : null}
      {problem ? (
        <AppText variant="small" style={{ color: '#EC9384' }}>
          {problem}
        </AppText>
      ) : null}
      {lines.map((line) => (
        <AppText key={line.id} variant="small" numberOfLines={2} style={{ color: colors.fg }}>
          <AppText
            variant="small"
            style={{ color: line.speakerType === 'master' ? '#e8c872' : colors.fgAccent }}
          >
            {line.speakerLabel}:
          </AppText>{' '}
          {line.text}
        </AppText>
      ))}
      <View style={{ flexDirection: 'row', gap: spacing[2] }}>
        {enabled && provider.supported ? (
          <Pressable
            style={styles.chip}
            accessibilityRole="button"
            onPress={() => setPaused((value) => !value)}
          >
            <AppText variant="small">{paused ? 'Retomar minha voz' : 'Pausar minha voz'}</AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    left: spacing[2],
    right: spacing[2],
    bottom: 96,
    gap: 4,
    padding: spacing[2],
    borderRadius: radii.lg,
    backgroundColor: 'rgba(11, 11, 15, 0.82)',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.line,
  },
});
