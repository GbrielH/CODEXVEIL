'use client';

import { DICE_AURAS, diceAuraLabels, type AvatarIcon, type DiceAura } from '@codexveil/validation';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useOptimistic, useState, useTransition } from 'react';
import { Alert } from '@/components/ui/alert';
import { AuraIcon } from '@/components/dice/aura-icons';
import { Avatar } from '@/components/ui/avatar';
import { cx } from '@/lib/cx';
import { setAuraGrantAction } from './actions';

interface FriendGrants {
  userId: string;
  displayName: string;
  avatarIcon: AvatarIcon | null;
  auras: DiceAura[];
}

/**
 * Conta de criador: para cada amigo, quais auras ele pode usar. Clique no amigo para abrir a
 * lista de efeitos e marque os que quer liberar (a mudança vale na hora).
 */
export function AuraGrants({ friends }: { friends: FriendGrants[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [grants, applyGrant] = useOptimistic(
    Object.fromEntries(friends.map((friend) => [friend.userId, friend.auras])) as Record<
      string,
      DiceAura[]
    >,
    (current, change: { userId: string; aura: DiceAura; allowed: boolean }) => {
      const list = current[change.userId] ?? [];
      return {
        ...current,
        [change.userId]: change.allowed
          ? [...list, change.aura]
          : list.filter((aura) => aura !== change.aura),
      };
    },
  );

  const toggle = (userId: string, aura: DiceAura, allowed: boolean) =>
    startTransition(async () => {
      setError(null);
      applyGrant({ userId, aura, allowed });
      const result = await setAuraGrantAction(userId, aura, allowed);
      if (!result.ok) setError(result.message);
    });

  if (friends.length === 0) {
    return (
      <p className="text-sm text-fg-muted">
        Você ainda não tem amigos no Codexveil. Adicione amigos na aba Amigos para liberar auras
        para eles.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {friends.map((friend) => {
          const mine = grants[friend.userId] ?? [];
          const expanded = open === friend.userId;
          return (
            <li
              key={friend.userId}
              className={cx(
                'rounded-lg border transition-colors',
                expanded
                  ? 'border-fg-brand bg-hover/40 md:col-span-2 xl:col-span-3'
                  : 'border-line',
              )}
            >
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : friend.userId)}
                className="flex w-full items-center gap-3 p-3 text-left"
              >
                <Avatar name={friend.displayName} icon={friend.avatarIcon} size="sm" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-fg">{friend.displayName}</span>
                  <span className="flex items-center gap-1 text-xs text-fg-muted">
                    {mine.length === 0
                      ? 'Nenhuma aura liberada'
                      : `${mine.length} de ${DICE_AURAS.length} auras`}
                    {mine.map((aura) => (
                      <AuraIcon key={aura} aura={aura} className="h-3 w-3" />
                    ))}
                  </span>
                </span>
                {expanded ? (
                  <ChevronUp className="h-4 w-4 text-fg-muted" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-fg-muted" aria-hidden="true" />
                )}
              </button>
              {expanded ? (
                <div className="flex flex-col gap-2 border-t border-line p-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                    {DICE_AURAS.map((aura) => {
                      const allowed = mine.includes(aura);
                      return (
                        <button
                          key={aura}
                          type="button"
                          role="checkbox"
                          aria-checked={allowed}
                          onClick={() => toggle(friend.userId, aura, !allowed)}
                          className={cx(
                            'flex h-9 min-w-0 items-center gap-2 rounded-md border px-2 text-sm transition-colors',
                            allowed
                              ? 'border-fg-brand bg-hover text-fg'
                              : 'border-line text-fg-secondary hover:bg-hover',
                          )}
                        >
                          <span
                            className={cx(
                              'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                              allowed ? 'border-fg-brand bg-fg-brand text-white' : 'border-line',
                            )}
                          >
                            {allowed ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
                          </span>
                          <AuraIcon aura={aura} />
                          <span className="truncate">{diceAuraLabels[aura].name}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-3 text-xs">
                    <button
                      type="button"
                      className="text-fg-brand hover:underline"
                      onClick={() =>
                        DICE_AURAS.filter((aura) => !mine.includes(aura)).forEach((aura) =>
                          toggle(friend.userId, aura, true),
                        )
                      }
                    >
                      Liberar todas
                    </button>
                    <button
                      type="button"
                      className="text-fg-secondary hover:underline"
                      onClick={() => mine.forEach((aura) => toggle(friend.userId, aura, false))}
                    >
                      Retirar todas
                    </button>
                  </div>
                  <p className="text-xs text-fg-muted">
                    Ao retirar uma aura, ela sai dos dados de {friend.displayName}.
                  </p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
