import { saveCharacterSheet } from '@codexveil/database';
import {
  TRIANGLE_QUALITIES,
  qualityBurnout,
  rechargeQualityAssurances,
  resolveTriangleRoll,
  rollTriangleDice,
  spendQualityAssurances,
  triangleQualityLabels,
  type TriangleAgencySheet,
  type TriangleQuality,
  type TriangleRoll,
} from '@codexveil/rpg-systems/triangle-agency';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/controls';
import { Field } from '@/components/ui/field';
import { AppText, Card } from '@/components/ui/primitives';
import { Segmented } from '@/components/ui/segmented';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import { colors, spacing } from '@/lib/theme';

type Tab = 'agencia' | 'arc' | 'vida' | 'missao';
export function TriangleAgencyMobileSheet({
  character,
  sheet: initial,
  canEditSheet,
  canEditPlay,
}: {
  character: { id: string; name: string; version: number };
  sheet: TriangleAgencySheet;
  canEditSheet: boolean;
  canEditPlay: boolean;
}) {
  const toast = useToast();
  const [sheet, setSheet] = useState(initial);
  const [version, setVersion] = useState(character.version);
  const [tab, setTab] = useState<Tab>('agencia');
  const [quality, setQuality] = useState<TriangleQuality>('atencao');
  const [spend, setSpend] = useState(0);
  const [last, setLast] = useState<TriangleRoll | null>(null);
  const save = async (next: TriangleAgencySheet) => {
    const previous = sheet;
    setSheet(next);
    try {
      const saved = await saveCharacterSheet(getSupabase(), character.id, version, { sheet: next });
      setVersion(saved.version);
    } catch (error) {
      setSheet(previous);
      toast({ tone: 'danger', title: 'A ficha não foi salva', description: failureMessage(error) });
    }
  };
  const roll = async () => {
    const dice = rollTriangleDice();
    const burned = qualityBurnout(sheet, quality);
    const spent = spendQualityAssurances(sheet, quality, spend);
    setLast(resolveTriangleRoll(dice, spent.spent, burned));
    setSpend(0);
    if (spent.spent) await save(spent.sheet);
  };
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={{ padding: spacing[4], gap: spacing[4] }}
    >
      <Card ornate>
        <AppText variant="title">{character.name}</AppText>
        <AppText variant="muted">
          {[sheet.arc.anomaly, sheet.arc.reality, sheet.arc.competency].filter(Boolean).join(' · ')}
        </AppText>
        <AppText>
          Méritos {sheet.merits} · Pontas Soltas {sheet.looseEnds} · Ressurreições {sheet.deaths}
        </AppText>
      </Card>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'agencia', label: 'Agência' },
          { value: 'arc', label: 'ARC' },
          { value: 'vida', label: 'Vida' },
          { value: 'missao', label: 'Missão' },
        ]}
        accessibilityLabel="Seções da ficha"
      />
      {tab === 'agencia' ? (
        <>
          <Card>
            <AppText variant="heading">Jogar 6d4</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {TRIANGLE_QUALITIES.map((key) => (
                <Chip
                  key={key}
                  label={`${triangleQualityLabels[key]} ${sheet.qualityAssurances.current[key]}/${sheet.qualityAssurances.maximum[key]}`}
                  selected={quality === key}
                  onPress={() => {
                    setQuality(key);
                    setSpend(0);
                  }}
                />
              ))}
            </View>
            <AppText variant="small">GQs a gastar</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {Array.from({ length: sheet.qualityAssurances.current[quality] + 1 }, (_, value) => (
                <Chip
                  key={value}
                  label={String(value)}
                  selected={spend === value}
                  onPress={() => setSpend(value)}
                />
              ))}
            </View>
            {qualityBurnout(sheet, quality) ? (
              <AppText style={{ color: colors.danger }}>
                Burnout: {qualityBurnout(sheet, quality)}
              </AppText>
            ) : null}
            <Button label="Jogar 6d4" disabled={!canEditPlay} onPress={() => void roll()} />
            {last ? (
              <AppText variant="heading">
                {last.success ? 'Sucesso' : 'Falha'} · {last.chaos} Caos
                {last.transcendence ? ' · Triscendência' : last.stability ? ' · Estabilidade' : ''}
              </AppText>
            ) : null}
            <Button
              label="Intermissão: recarregar GQs"
              variant="ghost"
              disabled={!canEditPlay}
              onPress={() => void save(rechargeQualityAssurances(sheet))}
            />
          </Card>
        </>
      ) : null}
      {tab === 'arc' ? (
        <>
          <Card>
            <AppText variant="heading">Anomalia · {sheet.arc.anomaly}</AppText>
            {sheet.anomalousAbilities.map((ability, index) => (
              <View key={index}>
                <AppText>
                  {ability.name} · {triangleQualityLabels[ability.quality]}
                </AppText>
                <Field
                  label="Anotações"
                  multiline
                  editable={canEditSheet}
                  value={ability.notes}
                  onChangeText={(notes) =>
                    setSheet({
                      ...sheet,
                      anomalousAbilities: sheet.anomalousAbilities.map((item, position) =>
                        position === index ? { ...item, notes } : item,
                      ),
                    })
                  }
                  onBlur={() => void save(sheet)}
                />
              </View>
            ))}
          </Card>
          <Card>
            <AppText variant="heading">Realidade · {sheet.arc.reality}</AppText>
            <Field
              label="Gatilho de Realidade"
              multiline
              editable={canEditSheet}
              value={sheet.reality.trigger}
              onChangeText={(trigger) =>
                setSheet({ ...sheet, reality: { ...sheet.reality, trigger } })
              }
              onBlur={() => void save(sheet)}
            />
            <Field
              label="Alívio de Burnout"
              multiline
              editable={canEditSheet}
              value={sheet.reality.burnoutRelief}
              onChangeText={(burnoutRelief) =>
                setSheet({ ...sheet, reality: { ...sheet.reality, burnoutRelief } })
              }
              onBlur={() => void save(sheet)}
            />
          </Card>
          <Card>
            <AppText variant="heading">Competência · {sheet.arc.competency}</AppText>
            <Field
              label="Diretriz Primária"
              multiline
              editable={canEditSheet}
              value={sheet.competency.primaryDirective}
              onChangeText={(primaryDirective) =>
                setSheet({ ...sheet, competency: { ...sheet.competency, primaryDirective } })
              }
              onBlur={() => void save(sheet)}
            />
          </Card>
        </>
      ) : null}
      {tab === 'vida' ? (
        <>
          <Card>
            <AppText variant="heading">Relacionamentos</AppText>
            {sheet.relationships.map((relationship) => (
              <AppText key={relationship.name}>
                {relationship.name} · Conexão {relationship.connection}
              </AppText>
            ))}
          </Card>
          <Card>
            <AppText variant="heading">Tempo</AppText>
            <AppText>
              Anomalia {sheet.time.anomaly} · Realidade {sheet.time.reality} · Competência{' '}
              {sheet.time.competency}
            </AppText>
          </Card>
        </>
      ) : null}
      {tab === 'missao' ? (
        <Card>
          <AppText variant="heading">Relatório de Missão</AppText>
          <Field
            label="Codinome"
            value={sheet.mission.codename}
            onChangeText={(codename) =>
              setSheet({ ...sheet, mission: { ...sheet.mission, codename } })
            }
            onBlur={() => void save(sheet)}
          />
          <Field
            label="Comportamento"
            multiline
            value={sheet.mission.anomalyBehavior}
            onChangeText={(anomalyBehavior) =>
              setSheet({ ...sheet, mission: { ...sheet.mission, anomalyBehavior } })
            }
            onBlur={() => void save(sheet)}
          />
          <Field
            label="Foco"
            value={sheet.mission.anomalyFocus}
            onChangeText={(anomalyFocus) =>
              setSheet({ ...sheet, mission: { ...sheet.mission, anomalyFocus } })
            }
            onBlur={() => void save(sheet)}
          />
          <Field
            label="Domínio"
            value={sheet.mission.anomalyDomain}
            onChangeText={(anomalyDomain) =>
              setSheet({ ...sheet, mission: { ...sheet.mission, anomalyDomain } })
            }
            onBlur={() => void save(sheet)}
          />
        </Card>
      ) : null}
    </ScrollView>
  );
}
