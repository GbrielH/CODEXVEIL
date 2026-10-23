/**
 * Emblema do Codexveil: um arco gótico (o "véu") que se abre para revelar um códex
 * e a centelha do conhecimento oculto.
 *
 * Os caminhos usam um viewBox 64×64 e são compartilhados entre web (SVG), mobile
 * (react-native-svg) e o script que gera ícones PNG. Este arquivo não pode importar
 * outros módulos: ele é lido diretamente pelo Node no script de geração de assets.
 */

export const EMBLEM_VIEWBOX = '0 0 64 64';

export const emblemPaths = {
  /** Arco ogival externo — o véu. */
  arch: 'M12 58V30A24.4 24.4 0 0 1 32 6A24.4 24.4 0 0 1 52 30V58Z',
  /** Abertura em forma de mandorla, onde o véu se afasta. */
  opening: 'M32 11C38 20 44 30 45 44H19C20 30 26 20 32 11Z',
  /** Centelha de quatro pontas. */
  star: 'M32 20L33.6 25.4L39 27L33.6 28.6L32 34L30.4 28.6L25 27L30.4 25.4Z',
  /** Páginas do códex aberto. */
  bookLeft: 'M32 44C27 40.5 20 40 14 42V53C20 51 27 51.5 32 55Z',
  bookRight: 'M32 44C37 40.5 44 40 50 42V53C44 51 37 51.5 32 55Z',
  /** Lombada. */
  spine: 'M32 44V55',
} as const;

export interface EmblemColors {
  veil: string;
  opening: string;
  star: string;
  pages: string;
  spine: string;
  outline: string;
}

export const defaultEmblemColors: EmblemColors = {
  veil: '#6B3BC6',
  opening: '#0F0F11',
  star: '#F5EDE7',
  pages: '#F5EDE7',
  spine: '#6B3BC6',
  outline: '#B8B8BC',
};

export interface EmblemSvgOptions {
  /** Tamanho do quadro final em pixels (o SVG é quadrado). */
  size?: number;
  /** Cor de fundo do quadro; omitida = transparente. */
  background?: string;
  /** Fração do quadro ocupada pelo emblema (0–1). Ícones adaptativos usam ~0.6. */
  scale?: number;
  /** Desenha tudo em uma única cor (ícones monocromáticos do Android). */
  monochrome?: string;
  colors?: Partial<EmblemColors>;
}

/** Gera a marcação SVG completa do emblema (usada para favicon e ícones rasterizados). */
export function emblemSvg(options: EmblemSvgOptions = {}): string {
  const size = options.size ?? 64;
  const scale = options.scale ?? 1;
  const c = { ...defaultEmblemColors, ...options.colors };
  const offset = (64 - 64 * scale) / 2;
  const transform = `translate(${offset} ${offset}) scale(${scale})`;
  const background = options.background
    ? `<rect width="64" height="64" fill="${options.background}"/>`
    : '';

  // Versão monocromática: contorno do arco + dobras do véu, com centelha e códex preenchidos.
  const body = options.monochrome
    ? [
        `<path d="${emblemPaths.arch}" fill="none" stroke="${options.monochrome}" stroke-width="3" stroke-linejoin="round"/>`,
        `<path d="${emblemPaths.opening}" fill="none" stroke="${options.monochrome}" stroke-width="2" stroke-linejoin="round"/>`,
        `<path d="${emblemPaths.star}" fill="${options.monochrome}"/>`,
        `<path d="${emblemPaths.bookLeft}" fill="${options.monochrome}"/>`,
        `<path d="${emblemPaths.bookRight}" fill="${options.monochrome}"/>`,
      ].join('')
    : [
        `<path d="${emblemPaths.arch}" fill="${c.veil}" stroke="${c.outline}" stroke-width="2" stroke-linejoin="round"/>`,
        `<path d="${emblemPaths.opening}" fill="${c.opening}"/>`,
        `<path d="${emblemPaths.star}" fill="${c.star}"/>`,
        `<path d="${emblemPaths.bookLeft}" fill="${c.pages}"/>`,
        `<path d="${emblemPaths.bookRight}" fill="${c.pages}"/>`,
        `<path d="${emblemPaths.spine}" stroke="${c.spine}" stroke-width="1.5" stroke-linecap="round"/>`,
      ].join('');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${EMBLEM_VIEWBOX}">` +
    background +
    `<g transform="${transform}">${body}</g>` +
    `</svg>`
  );
}
