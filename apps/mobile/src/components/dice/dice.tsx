import { rollDice, type DiceRoll } from '@codexveil/database';
import { DragonFumble } from './dragon-fumble';
import {
  COMMON_DICE,
  DICE_ROLL_MODES,
  describeDiceRoll,
  diceRollModeLabels,
  naturalD20,
  parseDiceExpression,
  rollDiceLocally,
  type DiceRollMode,
  type DiceRollResult,
} from '@codexveil/domain';
import { Dices } from 'lucide-react-native';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { Button } from '@/components/ui/button';
import { CheckRow, Chip, ChipRow } from '@/components/ui/controls';
import { Field } from '@/components/ui/field';
import { AppText } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import { colors, radii, spacing } from '@/lib/theme';
import { DiceThrow } from './dice-throw';

export interface RollRequest {
  expression: string;
  label?: string;
  mode?: DiceRollMode;
  secret?: boolean;
}

export type ShownRoll = Pick<
  DiceRollResult,
  'expression' | 'mode' | 'dice' | 'modifier' | 'total'
> & { label: string; secret: boolean };

interface DiceContextValue {
  roll: (request: RollRequest) => Promise<ShownRoll | null>;
  campaignId: string | null;
}

const DiceContext = createContext<DiceContextValue | null>(null);

function fromServer(roll: DiceRoll): ShownRoll {
  return { ...roll, secret: roll.visibility === 'gm' };
}

/**
 * Rolagens do app. Em campanha, o dado é rolado no servidor e vai para o mural da mesa; sem
 * campanha, rola no aparelho. Desligado (`enabled = false`), os botões de rolar somem.
 */
export function DiceProvider({
  campaignId,
  characterId = null,
  enabled = true,
  children,
}: {
  campaignId: string | null;
  characterId?: string | null;
  enabled?: boolean;
  children: ReactNode;
}) {
  const toast = useToast();
  const [throwing, setThrowing] = useState<(ShownRoll & { key: number }) | null>(null);
  const clearThrow = useCallback(() => setThrowing(null), []);
  // Falha crítica: o dragão (depois que os dados param de rolar).
  const [fumble, setFumble] = useState<number | null>(null);
  const clearFumble = useCallback(() => setFumble(null), []);
  const roll = useCallback(
    async (request: RollRequest): Promise<ShownRoll | null> => {
      const mode = request.mode ?? 'normal';
      let shown: ShownRoll;
      try {
        if (campaignId) {
          shown = fromServer(
            await rollDice(getSupabase(), {
              campaignId,
              expression: request.expression,
              label: request.label ?? '',
              mode,
              visibility: request.secret ? 'gm' : 'members',
              characterId,
            }),
          );
        } else {
          const local = rollDiceLocally(request.expression, mode);
          if (!local) throw new Error('Expressão de dados inválida.');
          shown = { ...local, label: request.label ?? '', secret: false };
        }
      } catch (cause) {
        toast({
          tone: 'danger',
          title: 'Os dados não foram rolados',
          description: failureMessage(cause),
        });
        return null;
      }
      // Uma rolagem nova substitui a animação anterior (só uma por vez na tela).
      setThrowing({ ...shown, key: Date.now() });
      const natural = naturalD20(shown);
      if (natural === 1) setTimeout(() => setFumble(Date.now()), 1200);
      toast({
        tone: natural === 20 ? 'success' : natural === 1 ? 'danger' : 'info',
        title: `${shown.label ? `${shown.label}: ` : ''}${shown.total}${natural === 20 ? ' (20 natural!)' : natural === 1 ? ' (1 natural)' : ''}`,
        description: `${describeDiceRoll(shown)}${shown.mode !== 'normal' ? ` · ${diceRollModeLabels[shown.mode]}` : ''}${shown.secret ? ' · secreta' : ''}`,
      });
      return shown;
    },
    [campaignId, characterId, toast],
  );
  const value = useMemo(() => (enabled ? { roll, campaignId } : null), [enabled, roll, campaignId]);
  return (
    <DiceContext.Provider value={value}>
      {children}
      {throwing ? <DiceThrow key={throwing.key} roll={throwing} onDone={clearThrow} /> : null}
      {fumble ? <DragonFumble key={fumble} onDone={clearFumble} /> : null}
    </DiceContext.Provider>
  );
}

export function useDice(): DiceContextValue | null {
  return useContext(DiceContext);
}

/** Toque no valor para rolar (ex.: bônus de ataque); fora de um DiceProvider, só mostra o valor. */
export function RollButton({
  expression,
  label,
  mode = 'normal',
  children,
  style,
}: {
  expression: string | null;
  label: string;
  mode?: DiceRollMode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const dice = useDice();
  const [busy, setBusy] = useState(false);
  if (!dice || !expression) return <View style={style}>{children}</View>;
  return (
    <Pressable
      disabled={busy}
      onPress={async () => {
        setBusy(true);
        await dice.roll({ expression, label, mode });
        setBusy(false);
      }}
      accessibilityRole="button"
      accessibilityLabel={`Rolar ${label} (${expression}${mode !== 'normal' ? `, ${diceRollModeLabels[mode].toLowerCase()}` : ''})`}
      hitSlop={6}
      style={({ pressed }) => [
        { borderRadius: radii.md },
        style,
        pressed && { backgroundColor: colors.hover },
        busy && { opacity: 0.6 },
      ]}
    >
      {children}
    </Pressable>
  );
}

/** Rolagem livre: perícias da ficha, dados rápidos, expressão, vantagem e rolagem secreta. */
export function DicePanel({
  isGm,
  characterName,
  skills = [],
}: {
  isGm: boolean;
  characterName?: string | null;
  /** Perícias com o bônus somado: tocar numa monta `1d20+bônus` sozinho. */
  skills?: { label: string; bonus: number }[];
}) {
  const dice = useDice();
  const [expression, setExpression] = useState('1d20');
  const [label, setLabel] = useState('');
  const [mode, setMode] = useState<DiceRollMode>('normal');
  const [secret, setSecret] = useState(false);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<ShownRoll | null>(null);
  const valid = parseDiceExpression(expression) !== null;
  const inCampaign = Boolean(dice?.campaignId);

  const go = async (text: string) => {
    if (!dice) return;
    setBusy(true);
    const shown = await dice.roll({ expression: text, label: label.trim(), mode, secret });
    if (shown) setLast(shown);
    setBusy(false);
  };
  const natural = last ? naturalD20(last) : null;

  return (
    <View style={{ gap: spacing[3] }}>
      <View style={styles.quick} accessibilityLabel="Dados rápidos">
        {COMMON_DICE.map((sides) => (
          <Button
            key={sides}
            label={`d${sides}`}
            compact
            variant="secondary"
            disabled={busy}
            onPress={() => void go(`1d${sides}`)}
            style={styles.die}
          />
        ))}
      </View>
      <Field
        label="Expressão"
        value={expression}
        onChangeText={setExpression}
        autoCapitalize="none"
        autoCorrect={false}
        error={valid ? undefined : 'Use dados como 1d20+5 (até 100 dados).'}
        hint="Ex.: 1d20+5, 2d6+1d4+3, d100."
      />
      {skills.length ? (
        <View style={{ gap: spacing[1] }}>
          <AppText variant="small">Perícia (toque para rolar com o bônus da ficha)</AppText>
          <ChipRow>
            {skills.map((skill) => (
              <Chip
                key={skill.label}
                label={`${skill.label} ${skill.bonus >= 0 ? '+' : ''}${skill.bonus}`}
                selected={label === skill.label}
                onPress={() => {
                  if (label === skill.label) {
                    setLabel('');
                    return;
                  }
                  setLabel(skill.label);
                  setExpression(`1d20${skill.bonus >= 0 ? '+' : ''}${skill.bonus}`);
                }}
              />
            ))}
          </ChipRow>
        </View>
      ) : null}
      <Field
        label="Para quê (opcional)"
        value={label}
        onChangeText={setLabel}
        maxLength={80}
        placeholder="Ex.: Percepção"
      />
      <ChipRow>
        {DICE_ROLL_MODES.map((option) => (
          <Chip
            key={option}
            label={diceRollModeLabels[option]}
            selected={mode === option}
            onPress={() => setMode(option)}
          />
        ))}
      </ChipRow>
      {inCampaign ? (
        <CheckRow
          label={isGm ? 'Rolagem secreta' : 'Só para o mestre'}
          description={
            isGm ? 'Só os mestres veem o resultado.' : 'Só você e o mestre veem o resultado.'
          }
          checked={secret}
          onChange={setSecret}
        />
      ) : null}
      <Button
        label={`Rolar${characterName ? ` como ${characterName}` : ''}`}
        icon={<Dices size={18} color={colors.primaryFg} />}
        loading={busy}
        disabled={!valid}
        onPress={() => void go(expression)}
      />
      {last ? (
        <View
          accessibilityLiveRegion="polite"
          style={[
            styles.result,
            natural === 20
              ? { borderColor: colors.success }
              : natural === 1
                ? { borderColor: colors.danger }
                : null,
          ]}
        >
          <Animated.View
            key={`${last.total}-${last.expression}-${last.dice.map((group) => group.values.join(',')).join('|')}`}
            entering={ZoomIn.springify().damping(12)}
          >
            <AppText variant="display">{last.total}</AppText>
          </Animated.View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText style={{ color: colors.fg }}>{last.label || last.expression}</AppText>
            <AppText variant="small">{describeDiceRoll(last)}</AppText>
            <AppText variant="small" style={{ color: colors.fgMuted }}>
              {last.mode !== 'normal' ? `${diceRollModeLabels[last.mode]} · ` : ''}
              {natural === 20 ? '20 natural · ' : natural === 1 ? '1 natural · ' : ''}
              {inCampaign
                ? last.secret
                  ? 'Rolagem secreta'
                  : 'Visível para a mesa'
                : 'Rolagem no aparelho'}
            </AppText>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  die: { minWidth: 56 },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.raised,
  },
});
