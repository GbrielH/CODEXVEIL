import { CAMPAIGN_MEDIA_BUCKET } from '@codexveil/database';
import type { ImagePreset } from '@codexveil/validation';
import { ImageUp, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { pickImage } from '@/lib/images';
import { failureMessage } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import { colors, spacing } from '@/lib/theme';
import { Button } from './button';
import { AppText } from './primitives';

function randomName(extension: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${random}.${extension}`;
}

/**
 * Envia (ou remove) uma imagem do aparelho para o armazenamento da campanha. O registro só
 * aponta para o arquivo novo depois do envio; se a gravação falhar, o arquivo enviado é
 * apagado, e o antigo só sai depois que o novo estiver salvo.
 */
export function ImageUploadButtons({
  preset,
  currentPath,
  pathFor,
  apply,
  onDone,
  label = 'Enviar imagem',
}: {
  preset: ImagePreset;
  currentPath: string | null;
  /** Caminho no bucket para um nome de arquivo novo. */
  pathFor: (fileName: string) => string;
  /** Grava o caminho (ou `null`) no registro. */
  apply: (path: string | null) => Promise<void>;
  onDone: () => void;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const upload = async () => {
    setMessage(null);
    const picked = await pickImage(preset);
    if (!picked) return;
    if (!picked.ok) {
      setMessage(picked.message);
      return;
    }
    setBusy(true);
    const bucket = getSupabase().storage.from(CAMPAIGN_MEDIA_BUCKET);
    const path = pathFor(randomName(picked.extension));
    try {
      const { error } = await bucket.upload(path, picked.bytes, {
        contentType: picked.mimeType,
        upsert: false,
      });
      if (error) throw error;
      try {
        await apply(path);
      } catch (cause) {
        await bucket.remove([path]);
        throw cause;
      }
      if (currentPath) await bucket.remove([currentPath]);
      onDone();
    } catch (cause) {
      setMessage(failureMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!currentPath) return;
    setBusy(true);
    try {
      await apply(null);
      await getSupabase().storage.from(CAMPAIGN_MEDIA_BUCKET).remove([currentPath]);
      onDone();
    } catch (cause) {
      setMessage(failureMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: spacing[2] }}>
      <View style={{ flexDirection: 'row', gap: spacing[2] }}>
        <Button
          label={currentPath ? 'Trocar imagem' : label}
          compact
          variant="secondary"
          loading={busy}
          icon={<ImageUp size={14} color={colors.fg} />}
          onPress={() => void upload()}
          style={{ flex: 1 }}
        />
        {currentPath ? (
          <Button
            label="Remover"
            compact
            variant="ghost"
            disabled={busy}
            icon={<Trash2 size={14} color={colors.fgSecondary} />}
            onPress={() => void remove()}
          />
        ) : null}
      </View>
      {message ? (
        <AppText variant="small" style={{ color: '#EC9384' }} accessibilityLiveRegion="polite">
          {message}
        </AppText>
      ) : null}
    </View>
  );
}
