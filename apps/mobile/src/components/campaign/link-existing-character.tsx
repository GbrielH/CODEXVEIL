import {
  listMyCharacters,
  setCharacterCampaign,
  setCharacterCampaignWithAnswers,
  type CharacterListItem,
} from '@codexveil/database';
import { dnd5eCampaignIssues, parseDnd5eCampaignRules, parseDnd5eSheet } from '@codexveil/rpg-systems/dnd5e';
import { parseT20CampaignRules, parseT20Sheet, t20CampaignIssues } from '@codexveil/rpg-systems/tormenta20';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { CreationAnswersCard, answersComplete, answersFor } from '@/components/characters/creation-answers';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow } from '@/components/ui/controls';
import { useConfirm } from '@/components/ui/dialog';
import { AppText, Card, CardTitle } from '@/components/ui/primitives';
import { Notice } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

/** O que impede a ficha de entrar na campanha, pelas regras do sistema (as mesmas do site). */
export function campaignRuleIssues(systemId: string, name: string, sheet: unknown, rules: unknown): string[] {
  try {
    if (systemId === 'dnd5e') return dnd5eCampaignIssues({ name, sheet: parseDnd5eSheet(sheet) }, parseDnd5eCampaignRules(rules));
    if (systemId === 'tormenta20') return t20CampaignIssues({ name, sheet: parseT20Sheet(sheet) }, parseT20CampaignRules(rules));
  } catch {
    return ['A ficha não pôde ser lida.'];
  }
  return [];
}

/**
 * Trazer um personagem que já existe para a campanha (D&D e Tormenta20): só fichas do mesmo
 * sistema; as regras do mestre e as perguntas dele precisam estar resolvidas antes de vincular.
 */
export function LinkExistingCharacter({
  userId,
  campaign,
  onLinked,
}: {
  userId: string;
  campaign: { id: string; systemId: string; characterRules: unknown; creationQuestions: string[] };
  onLinked: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [characters, setCharacters] = useState<CharacterListItem[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listMyCharacters(getSupabase(), userId)
      .then((list) => setCharacters(list.filter((character) => character.systemId === campaign.systemId && character.campaignId !== campaign.id)))
      .catch(() => setCharacters([]));
  }, [userId, campaign.id, campaign.systemId]);

  if (!characters?.length) return null;
  const chosen = characters.find((character) => character.id === selected) ?? null;
  const issues = chosen ? campaignRuleIssues(campaign.systemId, chosen.name, chosen.sheet, campaign.characterRules) : [];
  const questions = campaign.creationQuestions;
  const ready = chosen !== null && issues.length === 0 && answersComplete(questions, answers);

  const link = async () => {
    if (!chosen) return;
    if (chosen.campaignId) {
      const ok = await confirm({
        title: `Trazer ${chosen.name}?`,
        message: `Ele sai de "${chosen.campaignName ?? 'outra campanha'}" (e de combates em andamento) e entra nesta.`,
        confirmLabel: 'Trazer',
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      if (questions.length) await setCharacterCampaignWithAnswers(getSupabase(), chosen.id, campaign.id, answersFor(questions, answers));
      else await setCharacterCampaign(getSupabase(), chosen.id, campaign.id);
      toast({ tone: 'success', title: `${chosen.name} entrou na campanha.` });
      onLinked();
    } catch (error) {
      toast({ tone: 'danger', title: failureMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardTitle title="Trazer personagem existente" description="Fichas suas do mesmo sistema. O mestre passa a ver e poder editar a ficha." />
      <ChipRow>
        {characters.map((character) => (
          <Chip
            key={character.id}
            label={character.campaignName ? `${character.name} (em ${character.campaignName})` : character.name}
            selected={selected === character.id}
            role="radio"
            onPress={() => {
              setSelected(character.id);
              setAnswers({});
            }}
          />
        ))}
      </ChipRow>
      {chosen && issues.length ? (
        <View style={{ gap: 4 }}>
          <AppText style={{ color: colors.fgAccent }}>Antes de entrar, ajuste:</AppText>
          {issues.map((issue) => (
            <AppText key={issue} variant="small">
              • {issue}
            </AppText>
          ))}
        </View>
      ) : null}
      {chosen && !issues.length && questions.length ? <CreationAnswersCard questions={questions} values={answers} onChange={setAnswers} /> : null}
      {chosen && chosen.campaignId ? <Notice message={`Ele está em "${chosen.campaignName ?? 'outra campanha'}" e sairá de lá.`} /> : null}
      <Button label="Trazer para a campanha" loading={busy} disabled={!ready} onPress={() => void link()} />
    </Card>
  );
}
