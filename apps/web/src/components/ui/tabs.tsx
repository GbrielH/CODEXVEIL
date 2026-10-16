'use client';

import { Tabs as RadixTabs } from 'radix-ui';
import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';

export interface TabItem {
  value: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  className?: string;
}

/**
 * Abas acessíveis (Radix): setas do teclado alternam entre abas, Home/End vão às pontas e
 * o leitor de tela anuncia a relação aba/painel. No celular, a lista rola horizontalmente.
 */
export function Tabs({ items, value, onValueChange, label, className }: TabsProps) {
  return (
    <RadixTabs.Root value={value} onValueChange={onValueChange} className={cx('flex flex-col gap-5', className)}>
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <RadixTabs.List aria-label={label} className="flex min-w-max gap-1 border-b border-line">
          {items.map((item) => (
            <RadixTabs.Trigger
              key={item.value}
              value={item.value}
              className={cx(
                '-mb-px flex h-11 items-center gap-2 border-b-2 border-transparent px-3 text-sm font-medium text-fg-muted transition-colors sm:px-4',
                'hover:border-line-strong hover:text-fg',
                'data-[state=active]:border-parchment-300 data-[state=active]:text-fg-accent',
              )}
            >
              {item.icon}
              {item.label}
            </RadixTabs.Trigger>
          ))}
        </RadixTabs.List>
      </div>
      {items.map((item) => (
        <RadixTabs.Content key={item.value} value={item.value} className="focus-visible:outline-none">
          {item.content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
