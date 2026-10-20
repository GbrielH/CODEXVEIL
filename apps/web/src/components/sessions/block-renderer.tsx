import type { BlockReferences, StoredSessionBlock } from '@codexveil/database';
import type { CalloutTone } from '@codexveil/domain';
import {
  BookMarked,
  CircleAlert,
  Eye,
  Info,
  Lock,
  ScrollText,
  Skull,
  TriangleAlert,
  UserRound,
} from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { campaignPath, characterPath, sessionPath } from '@/lib/routes';

const calloutStyles: Record<CalloutTone, { box: string; icon: ReactNode; label: string }> = {
  lore: {
    box: 'parchment border-0',
    icon: <ScrollText className="h-5 w-5 text-wine-700" aria-hidden="true" />,
    label: 'Texto para ler em voz alta',
  },
  info: {
    box: 'border-arcane-400/40 bg-info-bg',
    icon: <Info className="h-5 w-5 text-arcane-300" aria-hidden="true" />,
    label: 'Informação',
  },
  warning: {
    box: 'border-amber-400/40 bg-warning-bg',
    icon: <TriangleAlert className="h-5 w-5 text-amber-300" aria-hidden="true" />,
    label: 'Atenção',
  },
  danger: {
    box: 'border-ember-400/45 bg-danger-bg',
    icon: <CircleAlert className="h-5 w-5 text-ember-300" aria-hidden="true" />,
    label: 'Perigo',
  },
};

export const calloutToneLabels: Record<CalloutTone, string> = {
  lore: 'Narração (pergaminho)',
  info: 'Informação',
  warning: 'Atenção',
  danger: 'Perigo',
};

interface BlockRendererProps {
  block: StoredSessionBlock;
  campaignId: string;
  references: BlockReferences;
  imageUrls: Record<string, string>;
  /** Mostra o selo "privado" (somente o mestre recebe blocos privados). */
  showVisibility: boolean;
}

function UnavailableReference({ label }: { label: string }) {
  return <span className="text-sm italic text-fg-muted">{label} indisponível</span>;
}

/** Renderiza um bloco de roteiro como texto puro — nunca como HTML vindo do banco. */
export function BlockRenderer({
  block,
  campaignId,
  references,
  imageUrls,
  showVisibility,
}: BlockRendererProps) {
  const isPrivate = block.visibility === 'gm';
  const content = block.content;

  let body: ReactNode;
  if (!content) {
    body = (
      <p className="text-sm italic text-fg-muted">
        Este bloco está num formato que esta versão não reconhece.
      </p>
    );
  } else {
    switch (content.type) {
      case 'heading':
        body = <h2 className="text-2xl leading-tight">{content.data.text || 'Título'}</h2>;
        break;
      case 'subheading':
        body = <h3 className="text-lg text-fg-accent">{content.data.text || 'Subtítulo'}</h3>;
        break;
      case 'paragraph':
        body = (
          <p className="whitespace-pre-line font-serif text-lg leading-relaxed text-fg">
            {content.data.text}
          </p>
        );
        break;
      case 'gm_note':
        body = (
          <div className="rounded-md border border-dashed border-wine-400/60 bg-wine-950/70 px-4 py-3">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-wine-300">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Nota privada do mestre
            </p>
            <p className="whitespace-pre-line font-serif leading-relaxed text-fg">
              {content.data.text}
            </p>
          </div>
        );
        break;
      case 'callout': {
        const style = calloutStyles[content.data.tone];
        body = (
          <aside
            className={cx('rounded-md border px-4 py-3', style.box)}
            aria-label={content.data.title ?? style.label}
          >
            <div className="flex gap-3">
              <span className="mt-0.5 shrink-0">{style.icon}</span>
              <div className="min-w-0">
                {content.data.title ? (
                  <p
                    className={cx(
                      'font-display font-semibold',
                      content.data.tone === 'lore' ? 'text-ink' : 'text-fg-accent',
                    )}
                  >
                    {content.data.title}
                  </p>
                ) : null}
                <p
                  className={cx(
                    'whitespace-pre-line font-serif leading-relaxed',
                    content.data.tone === 'lore' ? 'text-ink' : 'text-fg',
                  )}
                >
                  {content.data.text}
                </p>
              </div>
            </div>
          </aside>
        );
        break;
      }
      case 'image': {
        const url = content.data.path ? imageUrls[content.data.path] : undefined;
        body = url ? (
          <figure className="flex flex-col gap-2">
            {/* URL assinada de curta duração (bucket privado). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={content.data.alt}
              className="max-h-[32rem] w-full rounded-md border border-line object-contain"
              loading="lazy"
            />
            {content.data.caption ? (
              <figcaption className="text-center text-sm italic text-fg-muted">
                {content.data.caption}
              </figcaption>
            ) : null}
          </figure>
        ) : (
          <p className="text-sm italic text-fg-muted">Imagem indisponível.</p>
        );
        break;
      }
      case 'divider':
        body = (
          <div className="flex items-center gap-3 py-2 text-parchment-400/70" role="separator">
            <span className="h-px flex-1 bg-linear-to-r from-transparent to-parchment-400/40" />
            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden="true">
              <path d="M6 0L12 6L6 12L0 6Z" fill="currentColor" />
            </svg>
            <span className="h-px flex-1 bg-linear-to-l from-transparent to-parchment-400/40" />
          </div>
        );
        break;
      case 'list': {
        const items = content.data.items.filter((item) => item.trim().length > 0);
        body =
          content.data.style === 'numbered' ? (
            <ol className="list-decimal space-y-1 pl-6 font-serif text-lg leading-relaxed">
              {items.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ol>
          ) : (
            <ul className="list-disc space-y-1 pl-6 font-serif text-lg leading-relaxed">
              {items.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          );
        break;
      }
      case 'checklist':
        body = (
          <ul className="flex flex-col gap-1.5">
            {content.data.items.map((item) => (
              <li key={item.id} className="flex items-start gap-2">
                <span
                  className={cx(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border',
                    item.checked ? 'border-success bg-success text-sunken' : 'border-line-strong',
                  )}
                  aria-hidden="true"
                >
                  {item.checked ? '✓' : ''}
                </span>
                <span className={cx('text-sm', item.checked && 'text-fg-muted line-through')}>
                  <span className="sr-only">{item.checked ? 'Concluído: ' : 'Pendente: '}</span>
                  {item.text}
                </span>
              </li>
            ))}
          </ul>
        );
        break;
      case 'npc_ref':
      case 'monster_ref': {
        const target = content.data.creatureId
          ? references.creatures[content.data.creatureId]
          : undefined;
        body = (
          <div className="flex items-start gap-3 rounded-md border border-line bg-raised px-4 py-3">
            {content.type === 'npc_ref' ? (
              <UserRound className="mt-0.5 h-5 w-5 text-fg-brand" aria-hidden="true" />
            ) : (
              <Skull className="mt-0.5 h-5 w-5 text-fg-brand" aria-hidden="true" />
            )}
            <div className="min-w-0">
              {target ? (
                <Link
                  href={campaignPath(campaignId, `/biblioteca/${content.data.creatureId}`) as Route}
                  className="font-display text-fg-accent underline-offset-4 hover:underline"
                >
                  {target.name}
                </Link>
              ) : (
                <UnavailableReference label={content.type === 'npc_ref' ? 'NPC' : 'Criatura'} />
              )}
              {target?.subtitle ? <p className="text-xs text-fg-muted">{target.subtitle}</p> : null}
              {content.data.note ? (
                <p className="mt-1 text-sm text-fg-secondary">{content.data.note}</p>
              ) : null}
            </div>
          </div>
        );
        break;
      }
      case 'character_ref': {
        const target = content.data.characterId
          ? references.characters[content.data.characterId]
          : undefined;
        body = (
          <div className="flex items-start gap-3 rounded-md border border-line bg-raised px-4 py-3">
            <UserRound className="mt-0.5 h-5 w-5 text-fg-brand" aria-hidden="true" />
            <div className="min-w-0">
              {target ? (
                <Link
                  href={characterPath(content.data.characterId) as Route}
                  className="font-display text-fg-accent underline-offset-4 hover:underline"
                >
                  {target.name}
                </Link>
              ) : (
                <UnavailableReference label="Personagem" />
              )}
              {content.data.note ? (
                <p className="mt-1 text-sm text-fg-secondary">{content.data.note}</p>
              ) : null}
            </div>
          </div>
        );
        break;
      }
      case 'content_ref': {
        const isSession = content.data.kind === 'session';
        const session =
          isSession && content.data.targetId
            ? references.sessions[content.data.targetId]
            : undefined;
        const note =
          !isSession && content.data.targetId ? references.notes[content.data.targetId] : undefined;
        body = (
          <div className="flex items-start gap-3 rounded-md border border-line bg-raised px-4 py-3">
            <BookMarked className="mt-0.5 h-5 w-5 text-fg-brand" aria-hidden="true" />
            <div className="min-w-0">
              {session ? (
                <Link
                  href={sessionPath(campaignId, content.data.targetId) as Route}
                  className="font-display text-fg-accent underline-offset-4 hover:underline"
                >
                  Sessão {session.number}: {session.title}
                </Link>
              ) : note ? (
                <Link
                  href={
                    campaignPath(campaignId, `/anotacoes#nota-${content.data.targetId}`) as Route
                  }
                  className="font-display text-fg-accent underline-offset-4 hover:underline"
                >
                  {note.title}
                </Link>
              ) : (
                <UnavailableReference label="Conteúdo" />
              )}
              {content.data.note ? (
                <p className="mt-1 text-sm text-fg-secondary">{content.data.note}</p>
              ) : null}
            </div>
          </div>
        );
        break;
      }
    }
  }

  if (!showVisibility || !isPrivate || content?.type === 'gm_note') {
    return (
      <div id={`bloco-${block.id}`} className="scroll-mt-20">
        {body}
      </div>
    );
  }
  return (
    <div
      id={`bloco-${block.id}`}
      className="relative scroll-mt-20 rounded-md border-l-2 border-wine-400/70 pl-3"
    >
      <p className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-wine-300">
        <Eye className="h-3 w-3" aria-hidden="true" /> Somente mestres
      </p>
      {body}
    </div>
  );
}
