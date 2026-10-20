import { useState } from 'react';
import { Share, View } from 'react-native';
import { Chip } from '@/components/ui/controls';
import { AppText, Card } from '@/components/ui/primitives';
import { spacing } from '@/lib/theme';

/**
 * Prompt opcional para gerar a imagem do personagem numa IA. "Copiar" abre o menu de
 * compartilhar do sistema (que tem "Copiar"); o texto também pode ser selecionado. Sem
 * dependência nativa nova.
 */
export function ImagePromptCard({ prompt }: { prompt: string }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <Card>
      <AppText variant="heading">Prompt para a imagem (opcional)</AppText>
      <AppText variant="small">
        Cole numa IA de imagens e depois envie a imagem como retrato na ficha.
      </AppText>
      <AppText variant="small" selectable style={{ marginTop: spacing[2] }}>
        {prompt}
      </AppText>
      <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[2] }}>
        <Chip
          role="button"
          label="Copiar / compartilhar"
          selected={false}
          onPress={() => void Share.share({ message: prompt })}
        />
        <Chip role="button" label="Ignorar" selected={false} onPress={() => setHidden(true)} />
      </View>
    </Card>
  );
}
