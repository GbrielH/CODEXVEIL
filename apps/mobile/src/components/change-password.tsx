import { fieldErrorsFrom, resetPasswordSchema, type FieldErrors } from '@codexveil/validation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Notice } from '@/components/ui/states';
import { failureMessage } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';

/**
 * Nova senha para quem já está com a sessão aberta (Perfil ou depois do código de recuperação).
 * Usa a mesma validação do site (`resetPasswordSchema`).
 */
export function NewPasswordForm({ submitLabel = 'Salvar nova senha', onDone }: { submitLabel?: string; onDone?: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [result, setResult] = useState<{ tone: 'success' | 'danger'; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setResult(null);
    const parsed = resetPasswordSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    const { error } = await getSupabase().auth.updateUser({ password: parsed.data.password });
    setBusy(false);
    if (error) {
      setResult({ tone: 'danger', message: failureMessage(error) });
      return;
    }
    setPassword('');
    setConfirmPassword('');
    setResult({ tone: 'success', message: 'Senha alterada.' });
    onDone?.();
  };

  return (
    <>
      {result ? <Notice tone={result.tone} message={result.message} /> : null}
      <Field label="Nova senha" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" error={errors.password} />
      <Field
        label="Repita a nova senha"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        autoComplete="new-password"
        error={errors.confirmPassword}
      />
      <Button label={submitLabel} onPress={() => void submit()} loading={busy} />
    </>
  );
}
