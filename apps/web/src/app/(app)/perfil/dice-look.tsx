'use client';

import { DICE_TEXTURES, diceTextureLabels, type DiceLook } from '@codexveil/validation';
import { useState, useTransition } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cx } from '@/lib/cx';
import { updateDiceLookAction } from './actions';

/**
 * "Meus dados": a textura e a cor dos números dos seus dados 3D. Valem em todas as campanhas e
 * aparecem para a mesa toda; a cor de fundo continua sendo a escolhida em cada sessão.
 */
export function DiceLookForm({ initial }: { initial: DiceLook }) {
  const [texture, setTexture] = useState(initial.texture);
  const [numberColor, setNumberColor] = useState(initial.numberColor);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const tile = (key: string | null, label: string, file: string | null) => {
    const selected = texture === key;
    return (
      <button
        key={key ?? 'lisa'}
        type="button"
        aria-pressed={selected}
        onClick={() => setTexture(key as DiceLook['texture'])}
        className={cx(
          'flex flex-col items-center gap-1 rounded-md border p-2 text-xs transition-colors',
          selected
            ? 'border-fg-brand bg-hover text-fg'
            : 'border-line text-fg-secondary hover:bg-hover',
        )}
      >
        <span
          aria-hidden="true"
          className="h-12 w-12 rounded-md border border-line bg-wine-700 bg-cover bg-center"
          style={file ? { backgroundImage: `url(/dice/textures/${file})` } : undefined}
        />
        {label}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {result ? <Alert tone={result.ok ? 'success' : 'danger'}>{result.message}</Alert> : null}
      <div>
        <p className="mb-2 text-sm font-medium text-fg">Textura</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {tile(null, 'Lisa', null)}
          {DICE_TEXTURES.map((key) =>
            tile(key, diceTextureLabels[key].name, diceTextureLabels[key].file),
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-fg">
          Cor dos números
          <input
            type="color"
            value={numberColor ?? '#ffffff'}
            onChange={(event) => setNumberColor(event.target.value)}
            className="h-9 w-12 cursor-pointer rounded border border-line bg-transparent"
          />
        </label>
        <Button
          size="sm"
          variant="ghost"
          disabled={numberColor === null}
          onClick={() => setNumberColor(null)}
        >
          Automática
        </Button>
        <span className="text-xs text-fg-muted">
          {numberColor === null
            ? 'Automática: branca ou preta, conforme a cor do dado.'
            : numberColor}
        </span>
      </div>
      <p className="text-xs text-fg-muted">
        A cor de fundo dos dados continua sendo a que você escolhe em cada sessão da campanha.
      </p>
      <div>
        <Button
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const response = await updateDiceLookAction({ texture, numberColor });
              setResult({ ok: response.ok, message: response.message ?? '' });
            })
          }
        >
          Salvar meus dados
        </Button>
      </div>
    </div>
  );
}
