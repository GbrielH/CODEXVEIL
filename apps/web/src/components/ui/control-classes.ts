import { cx } from '@/lib/cx';

const controlBase =
  'rounded-md border bg-sunken px-3 text-fg placeholder:text-fg-subtle ' +
  'transition-[border-color,box-shadow] duration-150 ease-codex ' +
  'hover:border-silver-400/50 focus-visible:border-parchment-300 focus-visible:outline-none ' +
  'focus-visible:shadow-[0_0_0_3px_rgb(228_216_189/0.18)] disabled:cursor-not-allowed disabled:opacity-60';

/**
 * Sem classe de largura em `classes`, o controle ocupa a largura toda. Duas larguras na mesma
 * lista não se resolvem pela ordem das classes (vale a ordem do CSS, em que `w-full` vence),
 * então a largura padrão só entra quando ninguém pediu outra.
 */
export function defaultWidth(classes?: string): string | null {
  return classes && /(^|\s)w-/.test(classes) ? null : 'w-full';
}

/** Aparência comum dos controles de formulário (campo, área de texto e seletor). */
export function controlClasses(invalid: boolean, extra?: string) {
  return cx(
    controlBase,
    defaultWidth(extra),
    invalid ? 'border-ember-400/80' : 'border-line-strong',
    extra,
  );
}
