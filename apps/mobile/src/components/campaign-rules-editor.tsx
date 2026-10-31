import {
  ABILITY_SCORE_METHODS,
  abilityScoreMethodLabels,
  dnd5eOfficialLinks,
  findSourcebook,
  type Dnd5eCampaignRules,
} from '@codexveil/rpg-systems/dnd5e';
import { listMyBookPacks, type BookPackSummary } from '@codexveil/database';
import { useEffect, useState } from 'react';
import { CheckRow, Chip, ChipRow } from '@/components/ui/controls';
import { Segmented } from '@/components/ui/segmented';
import { ExternalLink, Minus, Plus } from 'lucide-react-native';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { IconButton } from '@/components/ui/button';
import { AppText } from '@/components/ui/primitives';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { colors, fonts, radii, spacing } from '@/lib/theme';

interface Props {
  value: Dnd5eCampaignRules;
  onChange: (value: Dnd5eCampaignRules) => void;
  error?: string | undefined;
}

/** Regras de criação de personagens de D&D 5e definidas pelo mestre. */
export function Dnd5eRulesEditor({ value, onChange, error }: Props) {
  const setLevel = (level: number) =>
    onChange({ ...value, startingLevel: Math.min(20, Math.max(1, level)) });
  const toggleMethod = (method: (typeof ABILITY_SCORE_METHODS)[number]) => {
    const has = value.abilityScoreMethods.includes(method);
    onChange({
      ...value,
      abilityScoreMethods: has
        ? value.abilityScoreMethods.filter((entry) => entry !== method)
        : ABILITY_SCORE_METHODS.filter(
            (entry) => entry === method || value.abilityScoreMethods.includes(entry),
          ),
    });
  };
  return (
    <View style={styles.box}>
      <AppText variant="eyebrow">Criação de personagens</AppText>
      <AppText variant="muted">
        Os jogadores criam os personagens num passo a passo com as regras do SRD 5.2 e as escolhas
        abaixo.
      </AppText>
      <View style={styles.levelRow}>
        <AppText style={{ flex: 1 }}>Nível inicial</AppText>
        <IconButton
          icon={<Minus size={18} color={colors.fg} />}
          onPress={() => setLevel(value.startingLevel - 1)}
          accessibilityLabel="Diminuir nível inicial"
          disabled={value.startingLevel <= 1}
        />
        <AppText variant="number" accessibilityLabel={`Nível inicial ${value.startingLevel}`}>
          {value.startingLevel}º
        </AppText>
        <IconButton
          icon={<Plus size={18} color={colors.fg} />}
          onPress={() => setLevel(value.startingLevel + 1)}
          accessibilityLabel="Aumentar nível inicial"
          disabled={value.startingLevel >= 20}
        />
      </View>
      <AppText variant="small">
        O SRD recomenda o 1º nível, ou o 3º para grupos experientes.
      </AppText>
      <AppText style={{ fontFamily: fonts.sansMedium }}>Métodos de atributos permitidos</AppText>
      {ABILITY_SCORE_METHODS.map((method) => {
        const selected = value.abilityScoreMethods.includes(method);
        return (
          <Pressable
            key={method}
            onPress={() => toggleMethod(method)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            style={[styles.option, selected && styles.optionSelected]}
          >
            <AppText
              style={{
                fontFamily: fonts.sansMedium,
                color: selected ? colors.fgAccent : colors.fg,
              }}
            >
              {abilityScoreMethodLabels[method].name}
            </AppText>
            <AppText variant="small">{abilityScoreMethodLabels[method].description}</AppText>
          </Pressable>
        );
      })}
      {error ? <AppText style={{ color: '#EC9384' }}>{error}</AppText> : null}
      <Pressable
        onPress={() => onChange({ ...value, allowEvilAlignments: !value.allowEvilAlignments })}
        accessibilityRole="switch"
        accessibilityState={{ checked: value.allowEvilAlignments }}
        style={[styles.option, value.allowEvilAlignments && styles.optionSelected]}
      >
        <AppText style={{ fontFamily: fonts.sansMedium }}>
          {value.allowEvilAlignments
            ? 'Alinhamentos malignos liberados'
            : 'Sem alinhamentos malignos'}
        </AppText>
        <AppText variant="small">
          O SRD pressupõe personagens que não são malignos. Toque para alternar.
        </AppText>
      </Pressable>
      <SourcebookChips
        audience="campaign"
        selected={value.sourcebooks}
        onChange={(sourcebooks) => onChange({ ...value, sourcebooks })}
      />
    </View>
  );
}

/**
 * Sistema base (só o SRD) ou com os livros importados em "Meus livros", numa lista só: cada livro
 * traz junto tudo o que tem (espécies, classes, magias, monstros, itens). Mesa ou ficha pessoal.
 */
export function SourcebookChips({
  selected,
  onChange,
  audience,
}: {
  selected: readonly string[];
  onChange: (ids: string[]) => void;
  audience: 'campaign' | 'character';
}) {
  const [expanded, setExpanded] = useState(selected.length > 0);
  const [linksOpen, setLinksOpen] = useState(false);
  const userId = useUserId();
  const [books, setBooks] = useState<BookPackSummary[] | null>(null);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    listMyBookPacks(getSupabase(), userId)
      .then((packs) => {
        if (active) setBooks(packs.filter((pack) => pack.isReady && pack.systemId === 'dnd5e'));
      })
      .catch(() => {
        if (active) setBooks([]);
      });
    return () => {
      active = false;
    };
  }, [userId]);
  const imported = new Set((books ?? []).map((book) => book.bookKey));
  // Livros marcados antes desta tela mostrar só os importados: desmarcáveis, para nada ficar escondido.
  const legacy = books ? selected.filter((id) => !imported.has(id)) : [];
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((entry) => entry !== id) : [...selected, id]);
  const ids = (books ?? []).map((book) => book.bookKey);
  const all = ids.length > 0 && ids.every((id) => selected.includes(id));
  return (
    <View style={styles.books}>
      <AppText style={{ fontFamily: fonts.sansMedium }}>Conteúdo do sistema</AppText>
      <Segmented<'base' | 'books'>
        value={expanded ? 'books' : 'base'}
        accessibilityLabel="Conteúdo do sistema"
        options={[
          { value: 'base', label: 'Só o SRD' },
          { value: 'books', label: 'SRD + meus livros' },
        ]}
        onChange={(value) => {
          setExpanded(value === 'books');
          if (value === 'base') onChange([]);
        }}
      />
      {expanded ? (
        books === null ? (
          <AppText variant="small">Carregando seus livros…</AppText>
        ) : books.length === 0 ? (
          <AppText variant="small">
            Nenhum livro importado ainda. Importe o conteúdo dos seus livros em “Meus livros”, no
            site.
          </AppText>
        ) : (
          <View style={{ gap: 2 }}>
            <AppText variant="small">
              {`Marque os livros que ${audience === 'campaign' ? 'a mesa usa' : 'este personagem usa'} (${selected.filter((id) => ids.includes(id)).length} de ${books.length}).`}
            </AppText>
            {books.length > 1 ? (
              <CheckRow
                label="Todos os livros"
                checked={all}
                onChange={() =>
                  onChange(
                    all
                      ? selected.filter((id) => !ids.includes(id))
                      : [...new Set([...selected, ...ids])],
                  )
                }
              />
            ) : null}
            {books.map((book) => (
              <CheckRow
                key={book.bookKey}
                label={book.name}
                checked={selected.includes(book.bookKey)}
                onChange={() => toggle(book.bookKey)}
              />
            ))}
          </View>
        )
      ) : (
        <AppText variant="small">Só o SRD 5.2.1, gratuito e já pronto. Nada para escolher.</AppText>
      )}
      <Pressable
        onPress={() => setLinksOpen((open) => !open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: linksOpen }}
      >
        <AppText variant="small" style={{ color: colors.fgAccent }}>
          {linksOpen ? 'Esconder as regras gratuitas' : 'Ver as regras gratuitas (sites oficiais)'}
        </AppText>
      </Pressable>
      {linksOpen
        ? dnd5eOfficialLinks
            .filter((link) => link.access === 'free')
            .map((link) => <OfficialLink key={link.url} label={link.label} url={link.url} />)
        : null}
      {expanded && legacy.length > 0 ? (
        <View style={{ gap: 6 }}>
          <AppText variant="small">
            Marcados antes, sem conteúdo no Codexveil (toque para tirar):
          </AppText>
          <ChipRow>
            {legacy.map((id) => (
              <Chip
                key={id}
                label={findSourcebook(id)?.name ?? id}
                selected
                onPress={() => toggle(id)}
              />
            ))}
          </ChipRow>
        </View>
      ) : null}
    </View>
  );
}
/** Link que abre a página oficial no navegador. */
function OfficialLink({ label, url }: { label: string; url: string }) {
  return (
    <Pressable
      onPress={() => void Linking.openURL(url)}
      accessibilityRole="link"
      accessibilityHint="Abre o site oficial no navegador"
      style={styles.link}
    >
      <AppText style={{ color: colors.fgAccent, flexShrink: 1 }}>{label}</AppText>
      <ExternalLink size={14} color={colors.fgMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: spacing[2],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing[3],
  },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  option: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing[3],
    gap: 2,
  },
  optionSelected: {
    borderColor: 'rgba(206, 191, 157, 0.7)',
    backgroundColor: 'rgba(245, 237, 231, 0.08)',
  },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36 },
  books: {
    gap: spacing[2],
    marginTop: spacing[2],
    padding: spacing[3],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
});
