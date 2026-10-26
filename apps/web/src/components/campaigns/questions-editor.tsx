'use client';

import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Card, CardHeader } from '@/components/ui/card';

const MAX_QUESTIONS = 20;

/**
 * Perguntas do mestre para a criação de personagem. Vai para a ação como JSON num campo
 * escondido (`creationQuestions`); linhas em branco são descartadas.
 */
export function QuestionsEditor({ initial = [], error, bare = false }: { initial?: readonly string[]; error?: string; bare?: boolean }) {
  const [questions, setQuestions] = useState<string[]>([...initial]);
  const filled = questions.map((question) => question.trim()).filter(Boolean);

  const body = (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="creationQuestions" value={JSON.stringify(filled)} />
      {questions.length === 0 ? <p className="text-sm text-fg-muted">Nenhuma pergunta. Os jogadores criam o personagem direto.</p> : null}
      {questions.map((question, index) => (
        <div key={index} className="flex items-start gap-2">
          <span className="mt-2 w-6 shrink-0 text-right text-sm text-fg-muted">{index + 1}.</span>
          <textarea
            aria-label={`Pergunta ${index + 1}`}
            value={question}
            maxLength={300}
            rows={2}
            onChange={(event) => setQuestions((current) => current.map((item, position) => (position === index ? event.target.value : item)))}
            placeholder="Ex.: Qual o maior medo do seu personagem?"
            className="min-h-10 flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg"
          />
          <button
            type="button"
            onClick={() => setQuestions((current) => current.filter((_, position) => position !== index))}
            aria-label={`Remover pergunta ${index + 1}`}
            className="mt-1 rounded-md p-2 text-fg-muted hover:bg-hover hover:text-fg"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ))}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div>
        <button
          type="button"
          disabled={questions.length >= MAX_QUESTIONS}
          onClick={() => setQuestions((current) => [...current, ''])}
          className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm text-fg hover:bg-hover disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Adicionar pergunta
        </button>
      </div>
    </div>
  );

  const description =
    'Opcional. Os jogadores respondem a todas para criar (ou trazer) um personagem nesta campanha. As respostas ficam visíveis só para o jogador e para o mestre.';
  if (bare) {
    return (
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-fg">Perguntas para os jogadores</legend>
        <p className="text-xs text-fg-muted">{description}</p>
        {body}
      </fieldset>
    );
  }
  return (
    <Card>
      <CardHeader title="Perguntas para os jogadores" description={description} />
      {body}
    </Card>
  );
}
