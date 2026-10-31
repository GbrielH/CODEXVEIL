'use client';

import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { CopyButton } from '@/components/ui/copy-button';

/** Instruções fixas: a imagem precisa servir de textura quadrada para a face do dado 3D. */
const BASE_PROMPT = `Crie uma textura quadrada (1:1, 1024 × 1024 px) para ser aplicada nas faces de um dado de RPG 3D.
Regras:
- Padrão contínuo que preencha a imagem inteira, sem bordas, molduras, sombras externas ou fundo branco.
- Nada de números, letras, logotipos ou marcas d'água: os números do dado são colocados depois.
- Contraste médio no centro, para que um número por cima continue legível.
- Visual de material (pedra, metal, cristal, osso, tecido, energia…) visto de frente, sem perspectiva e sem mostrar o dado inteiro.
- Estilo de fantasia sombria, rico em detalhes, alta resolução.

Descrição da skin que eu quero:`;

/**
 * Prompt para gerar a skin do dado numa IA de imagens. A descrição da pessoa vai junto do
 * prompt (sem ela, o resultado sai genérico), por isso o "Copiar" só libera depois de escrever.
 */
export function SkinPrompt() {
  const [description, setDescription] = useState('');
  const text = description.trim();
  const prompt = `${BASE_PROMPT}\n${text || '[descreva aqui a skin que você quer]'}`;
  return (
    <div className="flex flex-col gap-3">
      <Alert tone="warning">
        <strong>Importante:</strong> junto com o prompt vai a <strong>descrição da skin</strong>{' '}
        que você quer (cores, material, tema, detalhes). Escreva abaixo: ela entra no fim do prompt.
      </Alert>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-fg">
        Descrição da skin
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          maxLength={600}
          placeholder="Ex.: obsidiana negra com veios de lava alaranjada brilhando, pequenas runas gravadas"
          className="rounded-md border border-line bg-sunken px-3 py-2 text-sm font-normal text-fg placeholder:text-fg-muted focus:border-fg-brand focus:outline-none"
        />
      </label>
      <pre className="max-h-56 overflow-auto rounded-md border border-dashed border-line bg-sunken/60 p-3 text-xs whitespace-pre-wrap text-fg-secondary">
        {prompt}
      </pre>
      <div className="flex flex-wrap items-center gap-3">
        {text ? (
          <CopyButton value={prompt} label="Copiar o prompt" />
        ) : (
          <span className="flex items-center gap-2 text-xs text-fg-muted">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Escreva a descrição para liberar o botão de copiar.
          </span>
        )}
      </div>
      <p className="text-xs text-fg-muted">
        Cole na IA de imagens da sua preferência (ChatGPT, Gemini, Midjourney…). Depois baixe a
        imagem e use “Imagem de fundo” no editor acima.
      </p>
    </div>
  );
}
