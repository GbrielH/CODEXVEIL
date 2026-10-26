import { Field } from '@/components/ui/field';
import { Card, CardTitle } from '@/components/ui/primitives';

/** Monta a lista de respostas na ordem das perguntas do mestre. */
export function answersFor(questions: readonly string[], values: Record<number, string>) {
  return questions.map((question, index) => ({ question, answer: (values[index] ?? '').trim() }));
}

export function answersComplete(questions: readonly string[], values: Record<number, string>): boolean {
  return questions.every((_, index) => (values[index] ?? '').trim().length > 0);
}

/** Perguntas do mestre da campanha (todas obrigatórias; só o jogador e o mestre veem as respostas). */
export function CreationAnswersCard({
  questions,
  values,
  onChange,
}: {
  questions: readonly string[];
  values: Record<number, string>;
  onChange: (values: Record<number, string>) => void;
}) {
  if (questions.length === 0) return null;
  return (
    <Card>
      <CardTitle
        title="Perguntas do mestre"
        description="Responda a todas para criar o personagem. Só você e o mestre veem as respostas."
      />
      {questions.map((question, index) => (
        <Field
          key={index}
          label={`${index + 1}. ${question}`}
          value={values[index] ?? ''}
          onChangeText={(text) => onChange({ ...values, [index]: text })}
          maxLength={2000}
          multiline
          error={(values[index] ?? '').trim() ? undefined : 'Resposta obrigatória.'}
        />
      ))}
    </Card>
  );
}
