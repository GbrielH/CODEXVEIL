'use client';

import { TOKEN_SIZES, tokenSizeLabels, tokenSizeSquares, type TokenSize } from '@codexveil/domain';
import { ScrollText, Skull, UserRound } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { CheckboxField } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { idleFormState } from '@/lib/actions';
import { cx } from '@/lib/cx';
import { routes } from '@/lib/routes';
import { createCreatureAction } from './actions';

/**
 * Novo NPC ou monstro no visual da ficha do jogador: cabeçalho com o nome em destaque, o tipo em
 * botões e o tamanho em blocos. Estatísticas, imagem e segredos vêm na página do registro.
 */
export function NewCreatureForm({
  campaignId,
  systemId,
  defaultKind,
}: {
  campaignId: string;
  systemId: string;
  defaultKind: 'npc' | 'monster';
}) {
  const sizeLabels = tokenSizeLabels(systemId);
  const [state, action] = useActionState(
    createCreatureAction.bind(null, campaignId),
    idleFormState,
  );
  const [kind, setKind] = useState<'npc' | 'monster'>(
    (state.values?.kind as 'npc' | 'monster' | undefined) ?? defaultKind,
  );
  // NPC: ficha básica (registro da biblioteca) ou completa (assistente de personagem, sobe de nível).
  const [sheet, setSheet] = useState<'basic' | 'full'>('basic');
  const fullSheet = kind === 'npc' && sheet === 'full';
  const [size, setSize] = useState<TokenSize | ''>(
    (state.values?.size as TokenSize | undefined) ?? '',
  );

  return (
    <form
      action={action}
      noValidate
      className="flex flex-col gap-4 rounded-2xl border border-line bg-gradient-to-b from-wine-950/40 to-charcoal-900 p-4 shadow-[0_24px_60px_-36px_rgb(107_59_198/0.9)]"
    >
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="size" value={size} />

      {/* Tipo, como a escolha de classe na criação do personagem. */}
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo">
        {(
          [
            ['npc', 'NPC', UserRound],
            ['monster', 'Monstro', Skull],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={kind === key}
            onClick={() => setKind(key)}
            className={cx(
              'flex items-center justify-center gap-2 rounded-xl border px-3 py-3 font-display text-sm tracking-wide uppercase transition-colors',
              kind === key
                ? 'border-parchment-300 bg-wine-900/60 text-fg-accent'
                : 'border-line text-fg-secondary hover:bg-hover',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {kind === 'npc' ? (
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Ficha do NPC">
          {(
            [
              ['basic', 'Ficha básica', 'Estatísticas de ameaça'],
              ['full', 'Ficha completa', 'Estilo jogador, sobe de nível'],
            ] as const
          ).map(([key, label, hint]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={sheet === key}
              onClick={() => setSheet(key)}
              className={cx(
                'flex flex-col items-center gap-0.5 rounded-xl border px-2 py-2 text-center transition-colors',
                sheet === key
                  ? 'border-parchment-300 bg-wine-900/60 text-fg-accent'
                  : 'border-line text-fg-secondary hover:bg-hover',
              )}
            >
              <span className="text-sm font-medium">{label}</span>
              <span className="text-[0.65rem] text-fg-muted">{hint}</span>
            </button>
          ))}
        </div>
      ) : null}

      {fullSheet ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-fg-secondary">
            A ficha completa usa o mesmo passo a passo dos jogadores e sobe de nível como a deles, mas
            continua sendo um NPC: ao terminar, ela volta para esta biblioteca e não entra em “Meus
            personagens”. Só você vê.
          </p>
          <Link
            href={`${routes.newCharacter}?npc=${campaignId}` as Route}
            className="flex items-center justify-center gap-2 rounded-md bg-wine-700 px-4 py-2.5 text-sm font-medium text-parchment-50 transition-colors hover:bg-wine-600"
          >
            <ScrollText className="h-4 w-4" aria-hidden="true" />
            Criar ficha completa
          </Link>
        </div>
      ) : (
        <>
          {/* Nome em destaque, como no cabeçalho da ficha. */}
          <label className="flex flex-col gap-1">
            <span className="text-[0.65rem] font-semibold tracking-[0.2em] text-wine-300 uppercase">
              Nome *
            </span>
            <input
              name="name"
              required
              maxLength={80}
              defaultValue={state.values?.name}
              placeholder={kind === 'npc' ? 'Ex.: Velha Morgana' : 'Ex.: Ogro das Cavernas'}
              className="w-full rounded-md border border-transparent bg-transparent px-1 font-display text-xl leading-tight text-fg placeholder:text-fg-muted/50 hover:border-line focus-visible:border-parchment-300 focus-visible:outline-none"
            />
            {state.fieldErrors?.name ? (
              <span className="text-xs text-danger">{state.fieldErrors.name}</span>
            ) : null}
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[0.65rem] font-semibold tracking-[0.2em] text-fg-muted uppercase">
              Descrição curta
            </span>
            <input
              name="subtitle"
              maxLength={80}
              defaultValue={state.values?.subtitle}
              placeholder="Ex.: Taverneiro de Brumafria"
              className="w-full rounded-md border border-line bg-canvas/60 px-3 py-2 text-fg-secondary focus-visible:border-parchment-300 focus-visible:outline-none"
            />
          </label>

          {/* Tamanho em blocos (define o token na grade). */}
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-[0.65rem] font-semibold tracking-[0.2em] text-fg-muted uppercase">
              Tamanho *
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {TOKEN_SIZES.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={size === option}
                  onClick={() => setSize(option)}
                  className={cx(
                    'flex min-w-0 flex-col items-center gap-0.5 rounded-xl border px-1 py-2 text-center transition-colors',
                    size === option
                      ? 'border-parchment-300 bg-wine-900/60 text-fg-accent'
                      : 'border-parchment-400/30 bg-canvas/60 text-fg-secondary hover:bg-hover',
                  )}
                >
                  <span className="text-xs font-medium">{sizeLabels[option]}</span>
                  <span className="text-[0.65rem] text-fg-muted">
                    {tokenSizeSquares[option]}×{tokenSizeSquares[option]}
                  </span>
                </button>
              ))}
            </div>
            <span className="text-xs text-fg-muted">
              Define o token na grade da sessão (cada quadrado = 1,5 m).
            </span>
            {state.fieldErrors?.size ? (
              <span className="text-xs text-danger">{state.fieldErrors.size}</span>
            ) : null}
          </fieldset>

          <CheckboxField
            id="revealed"
            name="revealed"
            label="Revelar aos jogadores"
            description="Jogadores veem apenas nome, descrição e imagem. Estatísticas e segredos nunca são enviados a eles."
          />
          <div>
            <SubmitButton pendingLabel="Criando…">Criar e abrir a ficha</SubmitButton>
          </div>
        </>
      )}
    </form>
  );
}
