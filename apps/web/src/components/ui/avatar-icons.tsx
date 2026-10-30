import { AVATAR_LABELS, type AvatarPreset } from '@codexveil/validation';
import Image from 'next/image';

/** Retrato de perfil: imagem circular em `public/retratos/<chave>.webp` (nada no banco além da escolha). */
export function AvatarIconArt({ icon, className }: { icon: AvatarPreset; className?: string }) {
  return (
    <Image
      src={`/retratos/${icon}.webp`}
      alt={AVATAR_LABELS[icon]}
      width={256}
      height={256}
      className={className}
    />
  );
}
