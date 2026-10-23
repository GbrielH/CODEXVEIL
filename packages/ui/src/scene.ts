/**
 * Cena arcana do Codexveil: paisagem noturna em SVG (céu violeta, estrelas, lua, montanhas,
 * um castelo de torres pontiagudas sobre um rochedo e névoa). É gerada a partir de uma
 * "semente" (ex.: o nome da campanha), então cada campanha tem a sua própria paisagem, sempre
 * no mesmo estilo. Usada como banner, capa padrão de campanha e fundo (web e mobile).
 *
 * A saída nunca contém o texto da semente: ela só alimenta o gerador pseudoaleatório.
 */

/** Gerador determinístico (mulberry32) a partir do hash da semente. */
function random(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const W = 800;
const H = 450;
const r1 = (value: number) => Math.round(value * 10) / 10;

/** Cordilheira irregular entre `base` e `base - height`. */
function ridge(rand: () => number, base: number, height: number, step: number): string {
  let path = `M0 ${H} L0 ${r1(base - rand() * height)}`;
  for (let x = step; x <= W + step; x += step) {
    const peak = base - height * (0.35 + rand() * 0.65);
    path += ` L${r1(x - step / 2)} ${r1(peak)} L${r1(x)} ${r1(base - rand() * height * 0.4)}`;
  }
  return `${path} L${W} ${H} Z`;
}

/** Castelo: rochedo + torres com telhados pontiagudos e janelas acesas. */
function castle(rand: () => number, cx: number, ground: number): { body: string; windows: string } {
  const towers = 4 + Math.floor(rand() * 4);
  const spread = 150 + rand() * 90;
  let body = '';
  let windows = '';
  // Rochedo
  body += `<path d="M${r1(cx - spread * 0.85)} ${H} L${r1(cx - spread * 0.6)} ${r1(ground + 10)} Q${r1(cx)} ${r1(ground - 18)} ${r1(cx + spread * 0.6)} ${r1(ground + 12)} L${r1(cx + spread * 0.9)} ${H} Z"/>`;
  for (let i = 0; i < towers; i++) {
    const t = towers === 1 ? 0.5 : i / (towers - 1);
    const center = i === Math.floor(towers / 2);
    const x = cx - spread / 2 + t * spread + (rand() - 0.5) * 14;
    const w = (center ? 22 : 10) + rand() * (center ? 10 : 10);
    const h = (center ? 150 : 55) + rand() * (center ? 70 : 85);
    const top = ground - h;
    const roof = w * (1.4 + rand() * 1.2);
    body += `<rect x="${r1(x - w / 2)}" y="${r1(top)}" width="${r1(w)}" height="${r1(h + 20)}"/>`;
    body += `<path d="M${r1(x - w / 2 - 2)} ${r1(top)} L${r1(x)} ${r1(top - roof)} L${r1(x + w / 2 + 2)} ${r1(top)} Z"/>`;
    // Pináculo fino no alto das torres maiores
    if (h > 120) body += `<rect x="${r1(x - 0.8)}" y="${r1(top - roof - 14)}" width="1.6" height="14"/>`;
    const lit = 1 + Math.floor(rand() * 3);
    for (let k = 0; k < lit; k++) {
      if (rand() < 0.35) continue;
      const wy = top + 14 + rand() * Math.max(10, h - 40);
      windows += `<rect x="${r1(x - 1.6)}" y="${r1(wy)}" width="3.2" height="5.5" rx="1.2"/>`;
    }
  }
  // Muralha entre as torres
  body += `<rect x="${r1(cx - spread / 2)}" y="${r1(ground - 38)}" width="${r1(spread)}" height="60"/>`;
  return { body, windows };
}

export interface ArcaneSceneOptions {
  /** Esconde o castelo (fundos discretos). */
  noCastle?: boolean;
  /** Esconde a lua (quando outro elemento ocupa o céu, como o círculo arcano do Tomo). */
  noMoon?: boolean;
}

/** SVG da cena (viewBox 800×450, cobre a área como `object-fit: cover`). */
export function arcaneSceneSvg(seed: string, options: ArcaneSceneOptions = {}): string {
  const rand = random(seed || 'codexveil');
  const hue = 258 + (rand() - 0.5) * 30; // violeta, puxando para índigo ou magenta
  const sky = [`hsl(${r1(hue)} 55% 4%)`, `hsl(${r1(hue)} 52% 14%)`, `hsl(${r1(hue + 6)} 48% 30%)`];
  const moonX = W * (0.55 + rand() * 0.3);
  const moonY = H * (0.16 + rand() * 0.14);
  const moonR = 34 + rand() * 26;
  const crescent = rand() < 0.35;
  const castleLeft = rand() < 0.5;
  const castleX = castleLeft ? W * (0.2 + rand() * 0.15) : W * (0.62 + rand() * 0.18);
  const ground = H * (0.72 + rand() * 0.06);

  let stars = '';
  for (let i = 0; i < 70; i++) {
    const x = rand() * W;
    const y = rand() * H * 0.62;
    const r = rand() < 0.1 ? 1.6 : 0.4 + rand() * 0.8;
    stars += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}" opacity="${r1(0.3 + rand() * 0.7)}"/>`;
  }
  // Duas estrelas de quatro pontas (o símbolo da marca)
  let sparkles = '';
  for (let i = 0; i < 2; i++) {
    const x = rand() * W;
    const y = 20 + rand() * H * 0.4;
    const s = 5 + rand() * 5;
    sparkles += `<path d="M${r1(x)} ${r1(y - s)} L${r1(x + s * 0.22)} ${r1(y - s * 0.22)} L${r1(x + s)} ${r1(y)} L${r1(x + s * 0.22)} ${r1(y + s * 0.22)} L${r1(x)} ${r1(y + s)} L${r1(x - s * 0.22)} ${r1(y + s * 0.22)} L${r1(x - s)} ${r1(y)} L${r1(x - s * 0.22)} ${r1(y - s * 0.22)} Z"/>`;
  }

  const far = ridge(rand, H * 0.66, H * 0.22, 90);
  const mid = ridge(rand, H * 0.8, H * 0.16, 70);
  const build = options.noCastle ? null : castle(rand, castleX, ground);
  const near = ridge(rand, H * 0.95, H * 0.1, 60);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">`,
    '<defs>',
    `<linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset=".55" stop-color="${sky[1]}"/><stop offset="1" stop-color="${sky[2]}"/></linearGradient>`,
    `<radialGradient id="g"><stop offset="0" stop-color="#F5EDE7" stop-opacity=".55"/><stop offset=".35" stop-color="#A88BFF" stop-opacity=".22"/><stop offset="1" stop-color="#A88BFF" stop-opacity="0"/></radialGradient>`,
    `<linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A88BFF" stop-opacity="0"/><stop offset="1" stop-color="#C2AEFF" stop-opacity=".22"/></linearGradient>`,
    '</defs>',
    `<rect width="${W}" height="${H}" fill="url(#s)"/>`,
    `<g fill="#F5EDE7">${stars}</g>`,
    `<g fill="#DCD0FF" opacity=".9">${sparkles}</g>`,
    options.noMoon ? '' : `<circle cx="${r1(moonX)}" cy="${r1(moonY)}" r="${r1(moonR * 3.2)}" fill="url(#g)"/>`,
    options.noMoon ? '' : `<circle cx="${r1(moonX)}" cy="${r1(moonY)}" r="${r1(moonR)}" fill="#F3EAF2"/>`,
    crescent && !options.noMoon ? `<circle cx="${r1(moonX + moonR * 0.45)}" cy="${r1(moonY - moonR * 0.2)}" r="${r1(moonR * 0.92)}" fill="${sky[1]}"/>` : '',
    `<path d="${far}" fill="hsl(${r1(hue)} 40% 20%)" opacity=".85"/>`,
    `<rect y="${r1(H * 0.55)}" width="${W}" height="${r1(H * 0.3)}" fill="url(#m)"/>`,
    `<path d="${mid}" fill="hsl(${r1(hue)} 38% 11%)"/>`,
    build ? `<g fill="hsl(${r1(hue)} 40% 7%)">${build.body}</g><g fill="#C2AEFF" opacity=".95">${build.windows}</g>` : '',
    `<path d="${near}" fill="#07070A"/>`,
    '</svg>',
  ].join('');
}

/** A cena como `data:` URL (para `background-image` ou `<img>`). */
export function arcaneSceneDataUrl(seed: string, options?: ArcaneSceneOptions): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(arcaneSceneSvg(seed, options))}`;
}
