'use client';

import { MessageCircleQuestion } from 'lucide-react';

export interface CreationAnswer {
  question: string;
  answer: string;
}

/** Monta a lista de respostas na ordem das perguntas do mestre. */
export function answersFor(questions: readonly string[], values: Record<number, string>): CreationAnswer[] {
  return questions.map((question, index) => ({ question, answer: (values[index] ?? '').trim() }));
}

export function answersComplete(questions: readonly string[], values: Record<number, string>): boolean {
  return questions.every((_, index) => (values[index] ?? '').trim().length > 0);
}

/**
 * Perguntas do mestre da campanha (todas obrigatórias). As respostas ficam visíveis só para o
 * jogador e para o mestre.
 */
export function CreationAnswersFields({
  questions,
  values,
  onChange,
  showErrors = false,
}: {
  questions: readonly string[];
  values: Record<number, string>;
  onChange: (values: Record<number, string>) => void;
  showErrors?: boolean;
}) {
  if (questions.length === 0) return null;
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <h3 className="flex items-center gap-2 text-base">
        <MessageCircleQuestion className="h-4 w-4 text-fg-brand" aria-hidden="true" /> Perguntas do mestre
      </h3>
      <p className="text-xs text-fg-muted">Responda a todas para criar o personagem. Só você e o mestre veem as respostas.</p>
      {questions.map((question, index) => {
        const missing = showErrors && !(values[index] ?? '').trim();
        return (
          <label key={index} className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-fg">
              {index + 1}. {question}
            </span>
            <textarea
              value={values[index] ?? ''}
              maxLength={2000}
              rows={3}
              required
              aria-invalid={missing || undefined}
              onChange={(event) => onChange({ ...values, [index]: event.target.value })}
              className={`rounded-md border bg-raised px-3 py-2 text-sm text-fg ${missing ? 'border-danger' : 'border-line'}`}
            />
            {missing ? <span className="text-xs text-danger">Resposta obrigatória.</span> : null}
          </label>
        );
      })}
    </section>
  );
}

/** Respostas já gravadas (ficha do personagem). */
export function CreationAnswersView({ answers }: { answers: readonly CreationAnswer[] }) {
  if (answers.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 text-base">
        <MessageCircleQuestion className="h-4 w-4 text-fg-brand" aria-hidden="true" /> Perguntas do mestre
      </h3>
      <p className="text-xs text-fg-muted">Visível só para o jogador e para o mestre.</p>
      <dl className="flex flex-col gap-3 text-sm">
        {answers.map((entry, index) => (
          <div key={index}>
            <dt className="font-medium text-fg">{entry.question}</dt>
            <dd className="whitespace-pre-wrap text-fg-secondary">{entry.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
