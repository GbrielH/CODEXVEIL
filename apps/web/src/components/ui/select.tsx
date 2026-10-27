'use client';

import { Check, ChevronDown, Search } from 'lucide-react';
import {
  Children,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/lib/cx';
import { controlClasses } from './control-classes';

interface SelectOption {
  value: string;
  label: string;
  disabled: boolean;
  group: string | null;
}

function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map((child: ReactNode) => textOf(child)).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return '';
}

/** Lê as opções declaradas como <option> (e <optgroup>), como num <select> comum. */
function collectOptions(
  children: ReactNode,
  group: string | null = null,
  out: SelectOption[] = [],
): SelectOption[] {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as {
      children?: ReactNode;
      value?: string | number;
      disabled?: boolean;
      label?: string;
    };
    if (child.type === Fragment) collectOptions(props.children, group, out);
    else if (child.type === 'optgroup') collectOptions(props.children, props.label ?? null, out);
    else if (child.type === 'option') {
      const label = textOf(props.children);
      out.push({
        value: props.value === undefined ? label : String(props.value),
        label,
        disabled: Boolean(props.disabled),
        group,
      });
    }
  });
  return out;
}

/** Comparação sem acentos e sem diferenciar maiúsculas. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

interface Placement {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
}

type NativeSelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'multiple' | 'size' | 'children' | 'className'
>;

export interface SelectProps extends NativeSelectProps {
  children: ReactNode;
  /** Classes extras do botão (largura, flex etc.). */
  className?: string;
  /** `md`: 44 px, para formulários; `sm`: 32 px, para painéis compactos. */
  size?: 'md' | 'sm';
  invalid?: boolean;
  /** Texto mostrado quando nenhuma opção corresponde ao valor. */
  placeholder?: string;
  /** A partir de quantas opções a lista ganha o campo de busca. */
  searchThreshold?: number;
}

/**
 * Seletor com a identidade visual do Codexveil e busca por digitação. Mantém um <select>
 * nativo oculto como fonte do valor: formulários (`name`, `required`) e o `onChange` dos
 * componentes continuam funcionando como antes, com um evento de mudança real.
 */
export function Select({
  id,
  children,
  className,
  size = 'md',
  invalid = false,
  placeholder = 'Escolha…',
  searchThreshold = 6,
  value,
  defaultValue,
  disabled,
  onChange,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  ...nativeProps
}: SelectProps) {
  const generatedId = useId();
  const buttonId = id ?? `${generatedId}-botao`;
  const listId = `${generatedId}-lista`;
  const nativeRef = useRef<HTMLSelectElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const options = useMemo(() => collectOptions(children), [children]);
  const controlled = value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState(() =>
    defaultValue !== undefined ? String(defaultValue) : (options[0]?.value ?? ''),
  );
  const current = controlled ? String(value) : uncontrolledValue;
  const selected = options.find((option) => option.value === current) ?? null;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeValue, setActiveValue] = useState<string | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  // Dentro de um <dialog> modal nativo, a lista fica no próprio diálogo (camada superior). Fora dele,
  // a camada 110 fica acima dos formulários (Modal, 90) e do Tomo (100).
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const searchable = options.length > searchThreshold;

  const filtered = useMemo(() => {
    const term = normalize(query.trim());
    return term ? options.filter((option) => normalize(option.label).includes(term)) : options;
  }, [options, query]);
  const enabled = filtered.filter((option) => !option.disabled);
  const activeIndex = filtered.findIndex((option) => option.value === activeValue);
  const optionId = (option: SelectOption) => `${listId}-${options.indexOf(option)}`;

  // Formulários com valor inicial: depois de um reset, relê o valor do <select> nativo.
  useEffect(() => {
    if (controlled) return;
    const form = nativeRef.current?.form;
    if (!form) return;
    const onReset = () => setTimeout(() => setUncontrolledValue(nativeRef.current?.value ?? ''), 0);
    form.addEventListener('reset', onReset);
    return () => form.removeEventListener('reset', onReset);
  }, [controlled]);

  const place = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const margin = 8;
    const below = window.innerHeight - rect.bottom - margin;
    const above = rect.top - margin;
    const openBelow = below >= 220 || below >= above;
    const width = Math.max(rect.width, 224);
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
    const maxHeight = Math.max(140, Math.min(360, openBelow ? below : above));
    setPlacement(
      openBelow
        ? { left, width, maxHeight, top: rect.bottom + 4 }
        : { left, width, maxHeight, bottom: window.innerHeight - rect.top + 4 },
    );
  }, []);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    setQuery('');
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  const show = (initialQuery = '') => {
    if (disabled) return;
    setQuery(initialQuery);
    setActiveValue(
      selected && !selected.disabled
        ? selected.value
        : (options.find((option) => !option.disabled)?.value ?? null),
    );
    setPortalTarget(buttonRef.current?.closest('dialog') ?? document.body);
    place();
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open) return;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    // Em telas de toque, não abre o teclado sozinho: a busca fica a um toque.
    if (searchable && !coarse) searchRef.current?.focus();
    else listRef.current?.focus();
  }, [open, searchable]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      close(false);
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, close, place]);

  const commit = (option: SelectOption) => {
    if (option.disabled) return;
    const select = nativeRef.current;
    if (select && select.value !== option.value) {
      // O React não rastreia o valor de <select>: basta atribuir e disparar a mudança.
      select.value = option.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (!controlled) setUncontrolledValue(option.value);
    close(true);
  };

  const move = (delta: number) => {
    if (enabled.length === 0) return;
    const position = enabled.findIndex((option) => option.value === activeValue);
    const next =
      position === -1
        ? delta > 0
          ? 0
          : enabled.length - 1
        : (position + delta + enabled.length) % enabled.length;
    setActiveValue(enabled[next]?.value ?? null);
  };

  const onListKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown') move(1);
    else if (event.key === 'ArrowUp') move(-1);
    else if (event.key === 'Home') setActiveValue(enabled[0]?.value ?? null);
    else if (event.key === 'End') setActiveValue(enabled.at(-1)?.value ?? null);
    else if (event.key === 'Enter') {
      const option = filtered[activeIndex];
      if (option) commit(option);
    } else if (event.key === 'Escape') close(true);
    else if (event.key === 'Tab') close(false);
    else return;
    if (event.key !== 'Tab') event.preventDefault();
  };

  const onButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      show();
    } else if (
      searchable &&
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      show(event.key);
    }
  };

  const activeOption = activeIndex >= 0 ? filtered[activeIndex] : undefined;
  const activeDescendant = activeOption ? optionId(activeOption) : undefined;

  useEffect(() => {
    if (open && activeDescendant)
      document.getElementById(activeDescendant)?.scrollIntoView({ block: 'nearest' });
  }, [open, activeDescendant]);

  const popover =
    open && placement && portalTarget
      ? createPortal(
          <div
            ref={popoverRef}
            className="fixed z-[110] flex flex-col overflow-hidden rounded-md border border-line-strong bg-raised shadow-[0_18px_40px_-12px_rgb(0_0_0/0.85)]"
            style={{
              left: placement.left,
              width: placement.width,
              maxHeight: placement.maxHeight,
              top: placement.top,
              bottom: placement.bottom,
            }}
          >
            {searchable ? (
              <div className="flex items-center gap-2 border-b border-line px-3">
                <Search className="h-4 w-4 shrink-0 text-fg-subtle" aria-hidden="true" />
                <input
                  ref={searchRef}
                  type="text"
                  role="combobox"
                  aria-expanded="true"
                  aria-controls={listId}
                  aria-autocomplete="list"
                  aria-activedescendant={activeDescendant}
                  aria-label="Buscar nas opções"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Digite para buscar…"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    const term = normalize(event.target.value.trim());
                    const first = options.find(
                      (option) =>
                        !option.disabled && (!term || normalize(option.label).includes(term)),
                    );
                    setActiveValue(first?.value ?? null);
                  }}
                  onKeyDown={onListKeyDown}
                  className="h-10 min-w-0 flex-1 bg-transparent text-sm text-fg placeholder:text-fg-subtle focus:outline-none"
                />
              </div>
            ) : null}
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              tabIndex={-1}
              aria-labelledby={ariaLabelledBy ?? (ariaLabel ? undefined : buttonId)}
              aria-label={ariaLabelledBy ? undefined : ariaLabel}
              aria-activedescendant={searchable ? undefined : activeDescendant}
              onKeyDown={searchable ? undefined : onListKeyDown}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1 focus:outline-none"
            >
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-fg-muted">Nenhuma opção encontrada.</li>
              ) : null}
              {filtered.map((option, index) => {
                const isSelected = option.value === current;
                const isActive = option.value === activeValue;
                const groupStart = option.group && option.group !== filtered[index - 1]?.group;
                return (
                  <Fragment key={`${option.value}-${index}`}>
                    {groupStart ? (
                      <li
                        role="presentation"
                        className="px-3 pt-2 pb-1 font-display text-[11px] tracking-[0.18em] text-fg-subtle uppercase"
                      >
                        {option.group}
                      </li>
                    ) : null}
                    <li
                      id={optionId(option)}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={option.disabled || undefined}
                      onPointerMove={() => {
                        if (!option.disabled && !isActive) setActiveValue(option.value);
                      }}
                      onClick={() => commit(option)}
                      className={cx(
                        'flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm',
                        isSelected ? 'text-fg-accent' : 'text-fg-secondary',
                        isActive && !option.disabled && 'bg-hover text-fg',
                        option.disabled && 'cursor-not-allowed opacity-45',
                      )}
                    >
                      <span className="min-w-0 flex-1">{option.label || ' '}</span>
                      {isSelected ? (
                        <Check className="h-4 w-4 shrink-0 text-fg-accent" aria-hidden="true" />
                      ) : null}
                    </li>
                  </Fragment>
                );
              })}
            </ul>
          </div>,
          portalTarget,
        )
      : null;

  return (
    <div className={cx('relative min-w-0', className)}>
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        onClick={() => (open ? close(false) : show())}
        onKeyDown={onButtonKeyDown}
        className={controlClasses(
          invalid,
          cx(
            'flex items-center justify-between gap-2 text-left',
            size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-11 text-sm',
          ),
        )}
      >
        <span className={cx('min-w-0 flex-1 truncate', !selected && 'text-fg-subtle')}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown
          className={cx(
            'h-4 w-4 shrink-0 text-fg-muted transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>
      <select
        ref={nativeRef}
        {...nativeProps}
        {...(controlled ? { value } : { defaultValue })}
        onChange={onChange ?? (() => undefined)}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        onFocus={() => buttonRef.current?.focus()}
        className="pointer-events-none absolute bottom-0 left-3 h-px w-px opacity-0"
      >
        {children}
      </select>
      {popover}
    </div>
  );
}
