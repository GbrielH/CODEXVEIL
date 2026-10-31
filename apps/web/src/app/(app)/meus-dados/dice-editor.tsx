'use client';

import { CAMPAIGN_MEDIA_BUCKET, saveDice } from '@codexveil/database';
import { DICE_FONTS, diceFontLabels, type DiceLook } from '@codexveil/validation';
import { Brush, Eraser, ImagePlus, PaintBucket, Trash2, Undo2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition, type PointerEvent } from 'react';
import { diceFontFamily } from '@/components/dice/dice-look';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cx } from '@/lib/cx';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { updateDiceLookAction } from '../perfil/actions';

/** Tamanho da face desenhada (a biblioteca estica a imagem em cada face do dado). */
const SIZE = 512;
const HISTORY = 20;
/** Cor padrão do dado (quando a pessoa não escolhe uma). */
const DEFAULT_DIE = '#6b1d2a';

type Tool = 'brush' | 'fill' | 'eraser';

const tools: { key: Tool; label: string; icon: typeof Brush }[] = [
  { key: 'brush', label: 'Pincel', icon: Brush },
  { key: 'fill', label: 'Balde', icon: PaintBucket },
  { key: 'eraser', label: 'Borracha', icon: Eraser },
];

function hexToRgba(hex: string): [number, number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, 255];
}

/** Preenche a região contígua da cor clicada (balde de tinta), com pequena tolerância. */
function floodFill(context: CanvasRenderingContext2D, x: number, y: number, hex: string) {
  const image = context.getImageData(0, 0, SIZE, SIZE);
  const data = image.data;
  const start = (y * SIZE + x) * 4;
  const target = [data[start]!, data[start + 1]!, data[start + 2]!, data[start + 3]!];
  const fill = hexToRgba(hex);
  if (target.every((value, index) => Math.abs(value - fill[index]!) < 8)) return;
  const matches = (offset: number) =>
    Math.abs(data[offset]! - target[0]!) < 32 &&
    Math.abs(data[offset + 1]! - target[1]!) < 32 &&
    Math.abs(data[offset + 2]! - target[2]!) < 32 &&
    Math.abs(data[offset + 3]! - target[3]!) < 32;
  const stack = [x, y];
  const visited = new Uint8Array(SIZE * SIZE);
  while (stack.length) {
    const py = stack.pop()!;
    const px = stack.pop()!;
    if (px < 0 || py < 0 || px >= SIZE || py >= SIZE) continue;
    const index = py * SIZE + px;
    if (visited[index]) continue;
    visited[index] = 1;
    const offset = index * 4;
    if (!matches(offset)) continue;
    data.set(fill, offset);
    stack.push(px + 1, py, px - 1, py, px, py + 1, px, py - 1);
  }
  context.putImageData(image, 0, 0);
}

/** Desenha a imagem cobrindo o quadrado todo (corta as sobras, como `object-fit: cover`). */
function drawCover(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource & { width: number; height: number },
) {
  const scale = Math.max(SIZE / image.width, SIZE / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  context.drawImage(image, (SIZE - width) / 2, (SIZE - height) / 2, width, height);
}

/**
 * Editor de "Meus dados": o jogador desenha, pinta e escolhe uma imagem de fundo para a face
 * dos seus dados 3D, além da cor e da fonte dos números. As partes transparentes mostram a cor
 * do dado escolhida em cada sessão.
 */
export function DiceEditor({
  userId,
  initial,
  initialImageUrl,
  target,
}: {
  /** Dado da coleção em edição (`id` nulo = novo); sem ele, edita o dado padrão. */
  target?: { id: string | null; name: string };
  userId: string;
  initial: DiceLook;
  initialImageUrl: string | null;
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const history = useRef<ImageData[]>([]);
  const drawing = useRef<{ x: number; y: number } | null>(null);
  const [tool, setTool] = useState<Tool>('brush');
  const [color, setColor] = useState('#e8c872');
  const [size, setSize] = useState(16);
  const [numberColor, setNumberColor] = useState(initial.numberColor);
  const [font, setFont] = useState(initial.font);
  const [dieColor, setDieColor] = useState(initial.color);
  const [diceName, setDiceName] = useState(target?.name ?? '');
  const [blank, setBlank] = useState(!initialImageUrl);
  const [version, setVersion] = useState(0);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const context = () => canvasRef.current?.getContext('2d', { willReadFrequently: true }) ?? null;
  const changed = () => {
    setBlank(false);
    setVersion((value) => value + 1);
  };
  const remember = () => {
    const ctx = context();
    if (!ctx) return;
    history.current = [...history.current, ctx.getImageData(0, 0, SIZE, SIZE)].slice(-HISTORY);
  };

  // Carrega a face já salva para continuar editando.
  useEffect(() => {
    if (!initialImageUrl) return;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const ctx = canvasRef.current?.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.clearRect(0, 0, SIZE, SIZE);
      drawCover(ctx, image);
      setVersion((value) => value + 1);
    };
    image.src = initialImageUrl;
  }, [initialImageUrl]);

  // Prévia: a face sobre a cor de amostra do dado, com um número na cor e fonte escolhidas.
  const drawPreview = useCallback(() => {
    const preview = previewRef.current?.getContext('2d');
    const source = canvasRef.current;
    if (!preview || !source) return;
    const side = preview.canvas.width;
    preview.clearRect(0, 0, side, side);
    preview.save();
    preview.beginPath();
    for (let corner = 0; corner < 6; corner++) {
      const angle = (Math.PI / 3) * corner - Math.PI / 2;
      const px = side / 2 + (side / 2 - 4) * Math.cos(angle);
      const py = side / 2 + (side / 2 - 4) * Math.sin(angle);
      if (corner === 0) preview.moveTo(px, py);
      else preview.lineTo(px, py);
    }
    preview.closePath();
    preview.clip();
    preview.fillStyle = dieColor ?? DEFAULT_DIE;
    preview.fillRect(0, 0, side, side);
    preview.drawImage(source, 0, 0, side, side);
    preview.restore();
    const family = diceFontFamily(font) ?? 'Arial, sans-serif';
    preview.font = `${Math.round(side * 0.36)}px ${family}`;
    preview.textAlign = 'center';
    preview.textBaseline = 'middle';
    preview.lineWidth = 4;
    preview.strokeStyle = '#000000';
    preview.strokeText('20', side / 2, side / 2);
    preview.fillStyle = numberColor ?? '#ffffff';
    preview.fillText('20', side / 2, side / 2);
  }, [font, numberColor, dieColor]);

  useEffect(() => {
    drawPreview();
  }, [drawPreview, version]);

  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.floor(((event.clientX - rect.left) / rect.width) * SIZE),
      y: Math.floor(((event.clientY - rect.top) / rect.height) * SIZE),
    };
  };

  const stroke = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const ctx = context();
    if (!ctx) return;
    ctx.save();
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.restore();
  };

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const at = point(event);
    remember();
    if (tool === 'fill') {
      const ctx = context();
      if (ctx) floodFill(ctx, at.x, at.y, color);
      changed();
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = at;
    stroke(at, at);
  };
  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const at = point(event);
    stroke(drawing.current, at);
    drawing.current = at;
  };
  const onPointerUp = () => {
    if (!drawing.current) return;
    drawing.current = null;
    changed();
  };

  const undo = () => {
    const ctx = context();
    const previous = history.current.pop();
    if (!ctx || !previous) return;
    ctx.putImageData(previous, 0, 0);
    setVersion((value) => value + 1);
  };
  const clear = () => {
    const ctx = context();
    if (!ctx) return;
    remember();
    ctx.clearRect(0, 0, SIZE, SIZE);
    setBlank(true);
    setVersion((value) => value + 1);
  };

  const background = (file: File) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const ctx = context();
      if (ctx) {
        remember();
        // A imagem vai por baixo do que já foi desenhado.
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        drawCover(ctx, image);
        ctx.restore();
        changed();
      }
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      setResult({ ok: false, message: 'Não foi possível abrir essa imagem.' });
      URL.revokeObjectURL(url);
    };
    image.src = url;
  };

  const save = () =>
    startTransition(async () => {
      setResult(null);
      const client = getSupabaseBrowserClient();
      const bucket = client.storage.from(CAMPAIGN_MEDIA_BUCKET);
      let image: string | null = null;
      if (!blank && canvasRef.current) {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvasRef.current!.toBlob(resolve, 'image/webp', 0.9),
        );
        if (!blob) {
          setResult({ ok: false, message: 'Não foi possível gerar a imagem do dado.' });
          return;
        }
        image = `users/${userId}/dice/${crypto.randomUUID()}.webp`;
        const { error } = await bucket.upload(image, blob, {
          contentType: 'image/webp',
          upsert: false,
        });
        if (error) {
          setResult({ ok: false, message: 'Não foi possível enviar o desenho do dado.' });
          return;
        }
      }
      const look = { image, numberColor, font, color: dieColor };
      let response: { ok: boolean; message?: string };
      let savedId: string | null = null;
      if (target) {
        // Dado da coleção: grava na tabela de dados salvos.
        try {
          savedId = (await saveDice(client, { id: target.id ?? undefined, name: diceName, look }))
            .id;
          response = { ok: true, message: 'Dado salvo na coleção.' };
        } catch {
          response = { ok: false, message: 'Não foi possível salvar o dado.' };
        }
      } else {
        response = await updateDiceLookAction(look);
      }
      if (!response.ok) {
        if (image) await bucket.remove([image]);
      } else if (initial.image && initial.image !== image) {
        // A face anterior não é mais usada.
        await bucket.remove([initial.image]);
      }
      setResult({ ok: response.ok, message: response.message ?? '' });
      if (response.ok && target && !target.id && savedId) router.replace(`?dado=${savedId}`);
      else if (response.ok) router.refresh();
    });

  return (
    <div className="flex flex-col gap-5">
      {result ? <Alert tone={result.ok ? 'success' : 'danger'}>{result.message}</Alert> : null}
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {tools.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                aria-pressed={tool === key}
                onClick={() => setTool(key)}
                className={cx(
                  'flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors',
                  tool === key
                    ? 'border-fg-brand bg-hover text-fg'
                    : 'border-line text-fg-secondary hover:bg-hover',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </button>
            ))}
            <label className="flex items-center gap-2 text-sm text-fg">
              Cor
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-line bg-transparent"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-fg">
              Tamanho
              <input
                type="range"
                min={2}
                max={80}
                value={size}
                onChange={(event) => setSize(Number(event.target.value))}
                className="w-24"
              />
            </label>
          </div>
          <canvas
            ref={canvasRef}
            width={SIZE}
            height={SIZE}
            aria-label="Face do dado: desenhe aqui"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="aspect-square w-full max-w-[32rem] touch-none rounded-lg border border-line bg-[repeating-conic-gradient(rgb(255_255_255/0.08)_0_25%,transparent_0_50%)] bg-[length:24px_24px]"
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
              <ImagePlus className="h-4 w-4" aria-hidden="true" />
              Imagem de fundo
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) background(file);
                event.target.value = '';
              }}
            />
            <Button size="sm" variant="ghost" onClick={undo}>
              <Undo2 className="h-4 w-4" aria-hidden="true" />
              Desfazer
            </Button>
            <Button size="sm" variant="ghost" onClick={clear}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Limpar
            </Button>
          </div>
          <p className="text-xs text-fg-muted">
            O desenho cobre cada face do dado. As partes vazias (quadriculadas) mostram a cor do
            dado.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-2">
            <canvas ref={previewRef} width={160} height={160} aria-label="Prévia da face do dado" />
            <span className="text-xs text-fg-muted">Prévia</span>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-fg">Cor do dado</p>
            <input
              type="color"
              aria-label="Cor do dado"
              value={dieColor ?? DEFAULT_DIE}
              onChange={(event) => setDieColor(event.target.value)}
              className="h-9 w-12 cursor-pointer rounded border border-line bg-transparent"
            />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-fg">Cor dos números</p>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={numberColor ?? '#ffffff'}
                onChange={(event) => setNumberColor(event.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-line bg-transparent"
              />
              <Button
                size="sm"
                variant="ghost"
                disabled={numberColor === null}
                onClick={() => setNumberColor(null)}
              >
                Automática
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-fg">Fonte dos números</p>
            <div className="grid grid-cols-2 gap-2">
              {[null, ...DICE_FONTS].map((key) => (
                <button
                  key={key ?? 'padrao'}
                  type="button"
                  aria-pressed={font === key}
                  onClick={() => setFont(key)}
                  style={key ? { fontFamily: diceFontLabels[key].family } : undefined}
                  className={cx(
                    'h-9 rounded-md border px-2 text-sm transition-colors',
                    font === key
                      ? 'border-fg-brand bg-hover text-fg'
                      : 'border-line text-fg-secondary hover:bg-hover',
                  )}
                >
                  {key ? diceFontLabels[key].name : 'Padrão'}
                </button>
              ))}
            </div>
          </div>
          {target ? (
            <label className="flex flex-col gap-1.5 text-sm font-medium text-fg">
              Nome do dado
              <input
                value={diceName}
                maxLength={40}
                onChange={(event) => setDiceName(event.target.value)}
                placeholder="Ex.: Escamas douradas"
                className="h-9 rounded-md border border-line bg-sunken px-3 text-sm font-normal text-fg focus:border-fg-brand focus:outline-none"
              />
            </label>
          ) : null}
          <Button loading={pending} onClick={save} disabled={Boolean(target) && !diceName.trim()}>
            {target
              ? target.id
                ? 'Salvar este dado'
                : 'Salvar na coleção'
              : 'Salvar como dado padrão'}
          </Button>
        </div>
      </div>
    </div>
  );
}
