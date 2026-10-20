'use client';

import { Heart, HeartCrack } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';

interface HpQuickAdjustProps {
  label: string;
  disabled?: boolean;
  onApply: (operation: 'damage' | 'heal', amount: number) => void;
}

/** Campo compacto para aplicar dano ou cura sem sair da mesa. Enter aplica dano. */
export function HpQuickAdjust({ label, disabled = false, onApply }: HpQuickAdjustProps) {
  const id = useId();
  const [text, setText] = useState('');
  const [invalid, setInvalid] = useState(false);

  const apply = (operation: 'damage' | 'heal') => {
    const amount = Number(text.trim());
    if (!text.trim() || !Number.isInteger(amount) || amount < 0 || amount > 1_000_000) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onApply(operation, amount);
    setText('');
  };

  return (
    <div className="flex items-center gap-1">
      <label htmlFor={id} className="sr-only">
        Quantidade para {label}
      </label>
      <input
        id={id}
        inputMode="numeric"
        value={text}
        disabled={disabled}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            apply('damage');
          }
        }}
        aria-invalid={invalid || undefined}
        placeholder="0"
        className="tabular h-9 w-14 rounded-md border border-line-strong bg-sunken text-center text-sm text-fg aria-invalid:border-ember-400"
      />
      <Button
        size="sm"
        variant="danger"
        disabled={disabled}
        onClick={() => apply('damage')}
        aria-label={`Dano em ${label}`}
        className="px-2"
      >
        <HeartCrack className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={disabled}
        onClick={() => apply('heal')}
        aria-label={`Cura em ${label}`}
        className="px-2"
      >
        <Heart className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
