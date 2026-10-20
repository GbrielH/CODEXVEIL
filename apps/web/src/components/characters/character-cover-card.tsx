import type { Route } from 'next';
import Link from 'next/link';
import { initialsOf } from '@/components/ui/avatar';
import { cx } from '@/lib/cx';
import { formatRelative } from '@/lib/format';
import { CharacterIcon } from './character-icon';

interface CharacterCoverCardProps {
  href: Route;
  name: string;
  subtitle: string;
  /** Retrato (URL assinada de curta duração) ou `null`. */
  portraitUrl: string | null;
  /** Classe principal do SRD, para o ícone quando não há retrato. */
  classId: string | null;
  meta?: string | null;
  updatedAt?: string;
}

/** Personagem com o retrato em destaque (ou o ícone da classe), no padrão dos cartões de campanha. */
export function CharacterCoverCard({
  href,
  name,
  subtitle,
  portraitUrl,
  classId,
  meta,
  updatedAt,
}: CharacterCoverCardProps) {
  return (
    <Link
      href={href}
      className={cx(
        'group ornate flex h-full flex-col overflow-hidden rounded-lg border border-line bg-card shadow-card transition-[transform,background-color,border-color,box-shadow] duration-200',
        'hover:-translate-y-0.5 hover:border-parchment-400/40 hover:bg-raised hover:shadow-glow',
      )}
    >
      <div className="relative">
        {portraitUrl ? (
          <span className="block aspect-[4/3] w-full overflow-hidden bg-wine-950">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={portraitUrl}
              alt=""
              className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
            />
          </span>
        ) : (
          <span
            className="flex aspect-[4/3] w-full items-center justify-center bg-[radial-gradient(circle_at_50%_35%,rgb(120_36_52/0.55),transparent_65%),linear-gradient(135deg,rgb(40_14_22),rgb(18_14_20))]"
            aria-hidden="true"
          >
            {classId ? (
              <CharacterIcon
                kind="class"
                id={classId}
                className="h-20 w-20 text-parchment-300/70"
              />
            ) : (
              <span className="font-display text-5xl font-semibold text-parchment-300/70">
                {initialsOf(name)}
              </span>
            )}
          </span>
        )}
        <span
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-card to-transparent"
          aria-hidden="true"
        />
      </div>
      <div className="flex flex-1 flex-col p-5 pt-3">
        <p className="truncate font-display text-lg leading-tight text-fg-accent group-hover:text-parchment-100">
          {name}
        </p>
        <p className="truncate text-sm text-fg-secondary">{subtitle}</p>
        <p className="mt-auto truncate pt-2 text-xs text-fg-muted">
          {meta}
          {meta && updatedAt ? ' · ' : null}
          {updatedAt ? `atualizado ${formatRelative(updatedAt)}` : null}
        </p>
      </div>
    </Link>
  );
}
