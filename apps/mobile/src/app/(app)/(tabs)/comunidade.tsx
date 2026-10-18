import { Puzzle } from 'lucide-react-native';
import { HeroCard, IconBubble } from '@/components/ui/layout';
import { AppText } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { colors } from '@/lib/theme';

/** Espaço para sistemas de RPG criados pela comunidade (ainda em preparação). */
export default function CommunityScreen() {
  return (
    <Screen eyebrow="Comunidade" title="Sistemas da comunidade" subtitle="Sistemas de RPG desenvolvidos pela comunidade.">
      <HeroCard>
        <IconBubble tone="brand" size={52}>
          <Puzzle size={26} color={colors.fgAccent} />
        </IconBubble>
        <AppText variant="title">Em breve</AppText>
        <AppText variant="muted">Aqui vão aparecer sistemas criados pela comunidade: fichas, regras e conteúdos para jogar além do D&D 5e.</AppText>
      </HeroCard>
    </Screen>
  );
}
