import type { CallParticipant } from '@codexveil/database';
import {
  AudioSession,
  LiveKitRoom,
  VideoTrack,
  isTrackReference,
  useIsSpeaking,
  useLocalParticipant,
  useRoomContext,
  useTracks,
  type TrackReferenceOrPlaceholder,
} from '@livekit/react-native';
import { Track } from 'livekit-client';
import { Mic, MicOff, PhoneOff, SwitchCamera, Video, VideoOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/primitives';
import { colors, fonts, radii, spacing } from '@/lib/theme';

/** Nome mostrado no quadro: o personagem (ou "Mestre"); senão o nome da conta. */
function labelFor(identity: string, name: string | undefined, people: CallParticipant[]): string {
  const person = people.find((entry) => entry.userId === identity);
  if (person?.role === 'master') return `Mestre · ${person.displayName}`;
  if (person?.characterName) return `${person.characterName} · ${person.displayName}`;
  return name || 'Jogador';
}

function Tile({
  track,
  people,
}: {
  track: TrackReferenceOrPlaceholder;
  people: CallParticipant[];
}) {
  const speaking = useIsSpeaking(track.participant);
  const label = labelFor(track.participant.identity, track.participant.name, people);
  return (
    <View style={[styles.tile, speaking && styles.speaking]}>
      {isTrackReference(track) && !track.publication.isMuted ? (
        <VideoTrack trackRef={track} style={StyleSheet.absoluteFill} objectFit="cover" />
      ) : (
        <View style={styles.placeholder}>
          <AppText style={styles.initial}>{label.trim().charAt(0).toUpperCase()}</AppText>
        </View>
      )}
      <View style={styles.nameTag}>
        <AppText variant="small" numberOfLines={1} style={{ color: colors.fg }}>
          {label}
        </AppText>
      </View>
    </View>
  );
}

function Controls({ onLeave }: { onLeave: () => void }) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const room = useRoomContext();
  const [front, setFront] = useState(true);
  const button = (active: boolean) => [
    styles.control,
    active ? styles.controlOn : styles.controlOff,
  ];
  return (
    <View style={styles.controls}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isMicrophoneEnabled ? 'Desligar o microfone' : 'Ligar o microfone'}
        style={button(isMicrophoneEnabled)}
        onPress={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
      >
        {isMicrophoneEnabled ? (
          <Mic size={22} color={colors.fg} />
        ) : (
          <MicOff size={22} color={colors.fg} />
        )}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isCameraEnabled ? 'Desligar a câmera' : 'Ligar a câmera'}
        style={button(isCameraEnabled)}
        onPress={() => void localParticipant.setCameraEnabled(!isCameraEnabled)}
      >
        {isCameraEnabled ? (
          <Video size={22} color={colors.fg} />
        ) : (
          <VideoOff size={22} color={colors.fg} />
        )}
      </Pressable>
      {isCameraEnabled ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Trocar a câmera (frontal/traseira)"
          style={button(true)}
          onPress={() => {
            const next = !front;
            setFront(next);
            void room.switchActiveDevice('videoinput', next ? 'front' : 'back');
            const track = localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack as
              { restartTrack?: (options: { facingMode: string }) => Promise<void> } | undefined;
            void track?.restartTrack?.({ facingMode: next ? 'user' : 'environment' });
          }}
        >
          <SwitchCamera size={22} color={colors.fg} />
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sair da call"
        style={[styles.control, { backgroundColor: '#b03a48' }]}
        onPress={onLeave}
      >
        <PhoneOff size={22} color="#fff" />
      </Pressable>
    </View>
  );
}

function Stage({ people, onLeave }: { people: CallParticipant[]; onLeave: () => void }) {
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }], {
    onlySubscribed: false,
  });
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <FlatList
        data={tracks}
        numColumns={tracks.length > 1 ? 2 : 1}
        key={tracks.length > 1 ? 'duas' : 'uma'}
        keyExtractor={(track) => `${track.participant.identity}-${track.source}`}
        contentContainerStyle={{ padding: spacing[2], gap: spacing[2] }}
        columnWrapperStyle={tracks.length > 1 ? { gap: spacing[2] } : undefined}
        renderItem={({ item }) => <Tile track={item} people={people} />}
      />
      <Controls onLeave={onLeave} />
    </View>
  );
}

/**
 * A chamada em si (LiveKit): áudio com cancelamento de eco, supressão de ruído e controle de
 * ganho; vídeo adaptado à conexão; quadro de quem fala aceso; nome do personagem em cada quadro.
 */
export function CallStage({
  token,
  url,
  participants,
  onLeave,
  onError,
}: {
  token: string;
  url: string;
  participants: CallParticipant[];
  onLeave: () => void;
  onError: (message: string) => void;
}) {
  useEffect(() => {
    void AudioSession.startAudioSession();
    return () => {
      void AudioSession.stopAudioSession();
    };
  }, []);
  return (
    <LiveKitRoom
      serverUrl={url}
      token={token}
      connect
      audio
      video={false}
      onDisconnected={onLeave}
      onError={(error) => onError(error.message)}
      onMediaDeviceFailure={() =>
        onError('Microfone ou câmera bloqueados. Libere nas configurações do aparelho.')
      }
      options={{
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        publishDefaults: { simulcast: true, red: true, dtx: true },
      }}
    >
      <Stage people={participants} onLeave={onLeave} />
    </LiveKitRoom>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    aspectRatio: 3 / 4,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: '#151518',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  speaking: { borderColor: '#3fa3a0' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fonts.displayBold, fontSize: 40, color: colors.fgAccent },
  nameTag: {
    position: 'absolute',
    left: 6,
    right: 6,
    bottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.md,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    backgroundColor: colors.raised,
    borderTopWidth: 1,
    borderColor: colors.line,
  },
  control: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlOn: { backgroundColor: colors.hover },
  controlOff: { backgroundColor: '#3a2228' },
});
