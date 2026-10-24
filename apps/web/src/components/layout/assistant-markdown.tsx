import { Fragment, type ReactNode } from 'react';

/** Negrito (**x**), itálico (*x* ou _x_) e código (`x`) dentro de uma linha. */
function inline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  let index = 0;
  for (const match of text.matchAll(pattern)) {
    const token = match[0];
    const start = match.index ?? 0;
    if (start > last) parts.push(text.slice(last, start));
    const key = `t${index++}`;
    if (token.startsWith('**'))
      parts.push(
        <strong key={key} className="font-semibold text-fg-accent">
          {token.slice(2, -2)}
        </strong>,
      );
    else if (token.startsWith('`'))
      parts.push(
        <code key={key} className="rounded bg-raised px-1 text-[0.85em]">
          {token.slice(1, -1)}
        </code>,
      );
    else parts.push(<em key={key}>{token.slice(1, -1)}</em>);
    last = start + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

type Block = { kind: 'p' | 'h'; text: string } | { kind: 'ul' | 'ol'; items: string[] };

/**
 * Markdown simples das respostas do assistente: títulos, parágrafos, listas com marcadores ou
 * números e ênfases. Sem HTML do modelo (tudo vira texto), então não há risco de injeção.
 */
export function AssistantMarkdown({ text }: { text: string }) {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: 'p', text: paragraph.join(' ') });
    paragraph = [];
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const bullet = /^[*\-•]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (!line) {
      flush();
    } else if (heading) {
      flush();
      blocks.push({ kind: 'h', text: heading[1] ?? '' });
    } else if (bullet || numbered) {
      flush();
      const kind = bullet ? 'ul' : 'ol';
      const item = (bullet ?? numbered)?.[1] ?? '';
      const previous = blocks[blocks.length - 1];
      if (previous && previous.kind === kind) previous.items.push(item);
      else blocks.push({ kind, items: [item] });
    } else {
      paragraph.push(line);
    }
  }
  flush();
  return (
    <div className="flex flex-col gap-2 leading-relaxed">
      {blocks.map((block, position) => (
        <Fragment key={position}>
          {block.kind === 'p' ? <p>{inline(block.text)}</p> : null}
          {block.kind === 'h' ? (
            <p className="font-display text-base text-fg-accent">{inline(block.text)}</p>
          ) : null}
          {block.kind === 'ul' ? (
            <ul className="flex list-disc flex-col gap-1 pl-5 marker:text-fg-brand">
              {block.items.map((item, at) => (
                <li key={at}>{inline(item)}</li>
              ))}
            </ul>
          ) : null}
          {block.kind === 'ol' ? (
            <ol className="flex list-decimal flex-col gap-1 pl-5 marker:text-fg-brand">
              {block.items.map((item, at) => (
                <li key={at}>{inline(item)}</li>
              ))}
            </ol>
          ) : null}
        </Fragment>
      ))}
    </div>
  );
}
