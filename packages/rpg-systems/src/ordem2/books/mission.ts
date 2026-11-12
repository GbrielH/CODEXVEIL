/**
 * Converte uma missão pronta do pacote do livro em blocos de roteiro de sessão. Todos os blocos
 * ficam com o mestre (`gm`): a narração vira caixa "Leia em voz alta", os pontos de interesse
 * viram a lista de perícias e DTs com a descrição contextual em nota privada.
 */
import type { SessionBlockContent, SharedVisibility } from '@codexveil/domain';
import type { Ordem2BookEntry } from './pack';

export interface Ordem2MissionBlock {
  visibility: SharedVisibility;
  content: SessionBlockContent;
}

const TEXT_MAX = 19_000;
const ITEM_MAX = 1_900;
const TITLE_MAX = 200;

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** Divide um texto longo em pedaços que cabem num bloco, sem cortar parágrafos quando possível. */
function chunks(text: string): string[] {
  const out: string[] = [];
  let current = '';
  for (const paragraph of text.split(/\n{2,}/)) {
    if (current && current.length + paragraph.length + 2 > TEXT_MAX) {
      out.push(current);
      current = '';
    }
    current = current ? `${current}\n\n${paragraph}` : paragraph;
    while (current.length > TEXT_MAX) {
      out.push(current.slice(0, TEXT_MAX));
      current = current.slice(TEXT_MAX);
    }
  }
  if (current.trim()) out.push(current);
  return out;
}

const gm = (content: SessionBlockContent): Ordem2MissionBlock => ({ visibility: 'gm', content });

/** Texto em Markdown simples (títulos `#`, citações `>`) em blocos de roteiro. */
export function ordem2MarkdownBlocks(markdown: string): Ordem2MissionBlock[] {
  const blocks: Ordem2MissionBlock[] = [];
  let paragraphs: string[] = [];
  const flush = () => {
    if (!paragraphs.length) return;
    for (const text of chunks(paragraphs.join('\n\n')))
      blocks.push(gm({ type: 'paragraph', data: { text } }));
    paragraphs = [];
  };
  for (const raw of markdown.split(/\n{2,}/)) {
    const part = raw.trim();
    if (!part) continue;
    const heading = /^#{1,4}\s+(.*)$/s.exec(part);
    if (heading) {
      flush();
      blocks.push(
        gm({
          type: 'subheading',
          data: { text: clip(heading[1]!.replace(/\s+/g, ' '), TITLE_MAX) },
        }),
      );
      continue;
    }
    if (part.startsWith('>')) {
      flush();
      const text = part.replace(/^>\s?/gm, '');
      for (const piece of chunks(text))
        blocks.push(
          gm({ type: 'callout', data: { tone: 'lore', title: 'Leia em voz alta', text: piece } }),
        );
      continue;
    }
    paragraphs.push(part);
  }
  flush();
  return blocks;
}

/** Um ponto de interesse: título, descrição para narrar, quadro de perícias e o contexto do mestre. */
export function ordem2PoiBlocks(entry: Ordem2BookEntry<'point_of_interest'>): Ordem2MissionBlock[] {
  const data = entry.data;
  const label = data.mapLabel ? ` (${data.mapLabel})` : '';
  const blocks: Ordem2MissionBlock[] = [
    gm({
      type: 'subheading',
      data: {
        text: clip(
          `Ponto de interesse${label}: ${entry.name}${data.keyEvidence ? ' · evidência-chave' : ''}`,
          TITLE_MAX,
        ),
      },
    }),
  ];
  if (data.description)
    blocks.push(
      gm({
        type: 'callout',
        data: { tone: 'info', title: 'Descrição básica', text: clip(data.description, TEXT_MAX) },
      }),
    );
  if (data.rows.length)
    blocks.push(
      gm({
        type: 'list',
        data: {
          style: 'bulleted',
          items: data.rows.map((row) =>
            clip(
              `${row.skill} · DT ${row.dc}: ${row.text}${row.requirement ? ` (${row.requirement})` : ''}`,
              ITEM_MAX,
            ),
          ),
        },
      }),
    );
  for (const text of chunks(data.context)) blocks.push(gm({ type: 'gm_note', data: { text } }));
  return blocks;
}

export interface Ordem2MissionInput {
  mission: Ordem2BookEntry<'mission'>;
  entries: readonly Ordem2BookEntry[];
  /** Criaturas já copiadas para a biblioteca: chave do livro → id da criatura. */
  creatureIds: Readonly<Record<string, string>>;
  /** Imagens já copiadas para a campanha: chave do mapa → caminho no `campaign-media`. */
  mapImages: Readonly<Record<string, string>>;
}

/** Roteiro completo da missão: resumo, cada cena (narração, criaturas, mapas, pontos de interesse) e o fim. */
export function ordem2MissionBlocks(input: Ordem2MissionInput): Ordem2MissionBlock[] {
  const find = <K extends Ordem2BookEntry['kind']>(kind: K, key: string) =>
    input.entries.find((entry) => entry.kind === kind && entry.key === key) as
      Ordem2BookEntry<K> | undefined;
  const blocks: Ordem2MissionBlock[] = [];
  if (input.mission.data.summary) {
    blocks.push(gm({ type: 'heading', data: { text: 'Preparação e resumo' } }));
    blocks.push(...ordem2MarkdownBlocks(input.mission.data.summary));
  }
  for (const sceneKey of input.mission.data.scenes) {
    const scene = find('scene', sceneKey);
    if (!scene) continue;
    blocks.push(gm({ type: 'divider', data: {} }));
    blocks.push(gm({ type: 'heading', data: { text: clip(scene.name, TITLE_MAX) } }));
    for (const mapKey of scene.data.maps) {
      const path = input.mapImages[mapKey];
      const map = find('map', mapKey);
      if (path)
        blocks.push(
          gm({
            type: 'image',
            data: { path, alt: map?.name ?? 'Mapa', caption: map ? clip(map.name, 500) : null },
          }),
        );
    }
    for (const creatureKey of scene.data.creatures) {
      const creatureId = input.creatureIds[creatureKey];
      if (creatureId) blocks.push(gm({ type: 'monster_ref', data: { creatureId, note: null } }));
    }
    blocks.push(...ordem2MarkdownBlocks(scene.data.body));
    for (const poiKey of scene.data.pointsOfInterest) {
      const poi = find('point_of_interest', poiKey);
      if (poi) blocks.push(...ordem2PoiBlocks(poi));
    }
  }
  if (input.mission.data.body) {
    blocks.push(gm({ type: 'divider', data: {} }));
    blocks.push(gm({ type: 'heading', data: { text: 'Encerramento e bastidores' } }));
    blocks.push(...ordem2MarkdownBlocks(input.mission.data.body));
  }
  return blocks;
}
