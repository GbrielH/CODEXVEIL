'use client';

import {
  rollT20Treasure,
  t20TreasureNds,
  type T20Item,
  type T20Treasure,
} from '@codexveil/rpg-systems/tormenta20';
import { Coins, Dices } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Select } from '@/components/ui/select';

/**
 * Tesouro por ND (Tormenta20, capítulo 8): rola dinheiro e itens com as tabelas do livro
 * importado. Só para o mestre (as tabelas são do livro do mestre).
 */
export function T20TreasureRoller({
  tables,
  defaultNd,
}: {
  tables: T20Item<'table'>[];
  defaultNd: string;
}) {
  const nds = t20TreasureNds(tables);
  const [nd, setNd] = useState(nds.includes(defaultNd) ? defaultNd : (nds[0] ?? ''));
  const [result, setResult] = useState<T20Treasure | null>(null);
  if (nds.length === 0) return null;
  const total = result?.lines.reduce((sum, line) => sum + (line.totalTibares ?? 0), 0) ?? 0;
  return (
    <Card>
      <CardHeader
        icon={<Coins className="h-5 w-5" aria-hidden="true" />}
        title="Tesouro"
        description="Tabela 8-1 do livro: dinheiro e itens pelo nível de desafio."
      />
      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Nível de desafio"
          value={nd}
          onChange={(event) => setNd(event.target.value)}
          className="w-28"
        >
          {nds.map((value) => (
            <option key={value} value={value}>
              ND {value}
            </option>
          ))}
        </Select>
        <Button
          icon={<Dices className="h-4 w-4" aria-hidden="true" />}
          onClick={() => setResult(rollT20Treasure(tables, nd))}
        >
          Rolar tesouro
        </Button>
      </div>
      {result ? (
        <div className="mt-4 flex flex-col gap-3 text-sm">
          {result.lines.map((line) => (
            <div key={line.kind}>
              <p className="font-medium text-fg">
                {line.kind === 'money' ? 'Dinheiro' : 'Itens'}{' '}
                <span className="text-xs font-normal text-fg-muted">({line.rolled})</span>
              </p>
              {line.results.length === 0 ? (
                <p className="text-fg-muted">Nada.</p>
              ) : (
                <ul className="list-disc pl-5 text-fg-secondary">
                  {line.results.map((text, index) => (
                    <li key={index}>{text}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          {total > 0 ? (
            <p className="text-fg">Total em dinheiro: T$ {total.toLocaleString('pt-BR')}</p>
          ) : null}
          {result.lines.some((line) => line.rolled.endsWith('2D')) ? (
            <p className="text-xs text-fg-muted">2D: o grupo escolhe uma das duas opções.</p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
