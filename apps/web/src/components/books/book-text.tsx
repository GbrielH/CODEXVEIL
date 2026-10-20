import { Fragment, type ReactNode } from 'react';

/**
 * Texto dos livros em Markdown simples: títulos (#), parágrafos, listas ("- "), tabelas ("|"),
 * **negrito** e *itálico*. Nada vira HTML: o texto do pacote é exibido como texto.
 */
export function BookText({ body, className }: { body: string; className?: string }) {
  return (
    <div className={className ?? 'flex flex-col gap-3 text-sm leading-relaxed text-fg-secondary'}>
      {blocks(body)}
    </div>
  );
}

/** Parágrafos simples (descrições de magias, itens e monstros). */
export function BookParagraphs({ paragraphs }: { paragraphs: readonly string[] }) {
  return <BookText body={paragraphs.join('\n\n')} />;
}

type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'table'; rows: string[][] };

function parse(body: string): Block[] {
  const result: Block[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) result.push({ type: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };
  for (const raw of body.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    const last = () => result[result.length - 1];
    if (!line) {
      flush();
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      result.push({ type: 'heading', level: heading[1]!.length, text: heading[2]! });
      continue;
    }
    const item = /^(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line);
    if (item) {
      flush();
      const tail = last();
      if (tail?.type === 'list') tail.items.push(item[1]!);
      else result.push({ type: 'list', items: [item[1]!] });
      continue;
    }
    if (line.startsWith('|')) {
      flush();
      const cells = line
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((cell) => cell.trim());
      // Linha separadora do cabeçalho ("| --- | --- |").
      if (cells.every((cell) => /^:?-{2,}:?$/.test(cell))) continue;
      const tail = last();
      if (tail?.type === 'table') tail.rows.push(cells);
      else result.push({ type: 'table', rows: [cells] });
      continue;
    }
    paragraph.push(line);
  }
  flush();
  return result;
}

function blocks(body: string): ReactNode[] {
  return parse(body).map((block, index) => {
    switch (block.type) {
      case 'heading':
        return block.level <= 2 ? (
          <h3 key={index} className="mt-2 font-display text-lg text-fg">
            {inline(block.text)}
          </h3>
        ) : (
          <h4 key={index} className="mt-1 font-display text-base text-fg-accent">
            {inline(block.text)}
          </h4>
        );
      case 'list':
        return (
          <ul key={index} className="flex list-disc flex-col gap-1 pl-5">
            {block.items.map((item, position) => (
              <li key={position}>{inline(item)}</li>
            ))}
          </ul>
        );
      case 'table': {
        const [head, ...rows] = block.rows;
        return (
          <div key={index} className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-max border-collapse text-left text-sm">
              <thead>
                <tr>
                  {head?.map((cell, position) => (
                    <th
                      key={position}
                      className="border-b border-line-strong px-2 py-1.5 font-medium text-fg"
                    >
                      {inline(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="odd:bg-sunken/60">
                    {row.map((cell, position) => (
                      <td key={position} className="border-b border-line px-2 py-1.5 align-top">
                        {inline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      default:
        return <p key={index}>{inline(block.text)}</p>;
    }
  });
}

/** **negrito**, *itálico* e `código`. */
function inline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={index} className="font-semibold text-fg">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2)
      return <em key={index}>{part.slice(1, -1)}</em>;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={index} className="rounded bg-sunken px-1 text-xs">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}
