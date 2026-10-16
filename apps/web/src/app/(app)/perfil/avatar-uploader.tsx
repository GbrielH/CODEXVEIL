'use client';

import { AVATARS_BUCKET, setAvatarPath } from '@codexveil/database';
import { IMAGE_EXTENSIONS, validateImageFile } from '@codexveil/validation';
import { ImageUp, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

interface AvatarUploaderProps {
  userId: string;
  displayName: string;
  currentUrl: string | null;
  currentPath: string | null;
}

/**
 * Envia o avatar direto ao Storage (bucket `avatars`, pasta do próprio usuário — garantido
 * pelas policies) e só então atualiza o perfil. Tipo e tamanho são validados antes do envio
 * e novamente pelo bucket no servidor.
 */
export function AvatarUploader({ userId, displayName, currentUrl, currentPath }: AvatarUploaderProps) {
  const router = useRouter();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setError(null);
    const check = validateImageFile(file, 'avatar');
    if (!check.ok) {
      setError(check.message);
      return;
    }
    setBusy(true);
    const supabase = getSupabaseBrowserClient();
    const path = `${userId}/${crypto.randomUUID()}.${IMAGE_EXTENSIONS[check.mimeType]}`;
    try {
      const { error: uploadError } = await supabase.storage
        .from(AVATARS_BUCKET)
        .upload(path, file, { contentType: check.mimeType, upsert: false, cacheControl: '3600' });
      if (uploadError) throw uploadError;
      try {
        await setAvatarPath(supabase, userId, path);
      } catch (profileError) {
        await supabase.storage.from(AVATARS_BUCKET).remove([path]);
        throw profileError;
      }
      if (currentPath) await supabase.storage.from(AVATARS_BUCKET).remove([currentPath]);
      toast({ tone: 'success', title: 'Foto atualizada.' });
      router.refresh();
    } catch (cause) {
      setError(failureMessage(cause, 'Não foi possível enviar a imagem. Tente novamente.'));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async () => {
    if (!currentPath) return;
    setBusy(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    try {
      await setAvatarPath(supabase, userId, null);
      await supabase.storage.from(AVATARS_BUCKET).remove([currentPath]);
      toast({ tone: 'success', title: 'Foto removida.' });
      router.refresh();
    } catch (cause) {
      setError(failureMessage(cause, 'Não foi possível remover a foto.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <Avatar name={displayName} src={currentUrl} size="lg" />
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <Button
            variant="secondary"
            size="sm"
            loading={busy}
            onClick={() => inputRef.current?.click()}
            icon={<ImageUp className="h-4 w-4" aria-hidden="true" />}
            aria-describedby={`${inputId}-hint`}
          >
            {currentPath ? 'Trocar foto' : 'Enviar foto'}
          </Button>
          {currentPath ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={remove}
              icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
            >
              Remover
            </Button>
          ) : null}
        </div>
        <p id={`${inputId}-hint`} className="text-xs text-fg-muted">
          PNG, JPEG ou WebP, até 2 MB.
        </p>
        {error ? (
          <p className="text-xs font-medium text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
