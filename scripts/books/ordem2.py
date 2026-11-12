"""Gera os pacotes privados do Ordem Paranormal RPG 2 (playtests Alpha e Beta).

Uso:
  <venv-com-pymupdf>/python -X utf8 -I scripts/books/ordem2.py alpha "<Alpha.pdf>" "<saida.book.json>" [senha]
  <venv-com-pymupdf>/python -X utf8 -I scripts/books/ordem2.py beta  "<Beta.pdf>"  "<saida.book.json>"
  ... beta "<Beta.pdf>" "<saida>" --extras "<pasta Extras da Missão 1>=pantano-dos-afogados" \
                                   --extras "<pasta Extras da Missão 2>=caverna-de-cruachan"

`--extras`: pastas de extras que o livro distribui à parte (Handouts/, Mapas/, Tokens/), ligadas
a uma missão. Handouts e tokens viram entradas `handout`; mapas, entradas `map`. As imagens são
reduzidas para caber no pacote; músicas e outros arquivos ficam de fora.

O PDF e o JSON gerado ficam fora do Git. O pacote traz:
- `section`: capítulos do jogador (introdução, cartas, ficha, regras), página a página;
- `tool`: ferramentas da Ordo Realitas (Alpha);
- `mission`, `scene`: as missões prontas, com o roteiro do mestre e a narração em citações;
- `point_of_interest`: os quadros de investigação (perícia, DT, informação, contexto);
- `creature`: as fichas de criaturas;
- `map` e imagens: páginas e artes renderizadas, em `assets` (base64, nome = hash).
"""
from __future__ import annotations

import base64
import hashlib
import json
import re
import sys
import unicodedata
from pathlib import Path

import pymupdf as fitz

# ---------------------------------------------------------------------------- configuração

BOOKS = {
    'alpha': {
        'id': 'ordem2-alpha',
        'name': 'Ordem Paranormal RPG 2 — Playtest Alpha',
        'edition': 'Playtest Alpha',
        'chapters': [(2, 'Apresentação'), (3, 'Créditos e sumário'), (4, 'Introdução'), (6, 'Cartas dos autores'),
                     (14, 'Ficha de personagem'), (18, 'Regras'), (27, None)],
        'tools': (65, 70),
        'missions': [
            {
                'key': 'idolo-de-pedra-ato-1', 'name': 'A Maldição do Ídolo de Pedra, Ato I', 'order': 1,
                'summary': (28, 31), 'body': [(60, 64)],
                'scenes': [
                    {'key': 'ato-1-porao', 'name': 'Ato I: o porão', 'pages': (32, 53), 'maps': [34]},
                    {'key': 'ato-1-sala-secreta', 'name': 'Ato I: a sala secreta', 'pages': (54, 59), 'maps': []},
                ],
            },
            {
                'key': 'idolo-de-pedra-ato-2', 'name': 'A Maldição do Ídolo de Pedra, Ato II', 'order': 2,
                'summary': (72, 78), 'body': [(101, 102)],
                'scenes': [
                    {'key': 'ato-2-porao', 'name': 'Ato II: o porão', 'pages': (79, 95), 'maps': [80]},
                    {'key': 'ato-2-sala-secreta', 'name': 'Ato II: a sala secreta', 'pages': (96, 100), 'maps': []},
                ],
            },
        ],
        'creature_art': {},
    },
    'beta': {
        'id': 'ordem2-beta',
        'name': 'Ordem Paranormal RPG 2 — Playtest Beta',
        'edition': 'Playtest Beta',
        'chapters': [(2, 'Apresentação'), (3, 'Créditos e sumário'), (4, 'Introdução'),
                     (6, 'Ficha de personagem'), (10, 'Regras'), (26, None)],
        'tools': None,
        'missions': [
            {
                'key': 'pantano-dos-afogados', 'name': 'O Pântano dos Afogados', 'order': 1,
                'summary': (28, 30), 'body': [(46, 47)],
                'scenes': [
                    {'key': 'pantano-cena-1', 'name': 'Cena 1: Os Afogados', 'pages': (31, 33), 'maps': []},
                    {'key': 'pantano-cena-2', 'name': 'Cena 2: O Aughisk', 'pages': (34, 45), 'maps': [36]},
                ],
            },
            {
                'key': 'caverna-de-cruachan', 'name': 'A Caverna de Cruachan', 'order': 2,
                'summary': (50, 53), 'body': [(75, 75)],
                'scenes': [
                    {'key': 'caverna-cena-1', 'name': 'Cena 1: Nas Profundezas da Mata', 'pages': (54, 59), 'maps': []},
                    {'key': 'caverna-cena-2', 'name': 'Cena 2: Os Enigmas Druídicos', 'pages': (60, 67), 'maps': [61]},
                    {'key': 'caverna-cena-3', 'name': 'Cena 3: As Crianças da Floresta', 'pages': (68, 71), 'maps': []},
                    {'key': 'caverna-cena-4', 'name': 'Cena 4: As Três Cabeças da Morte', 'pages': (72, 74), 'maps': []},
                ],
            },
        ],
        # Artes de criaturas: página e retângulo (pontos do PDF).
        'creature_art': {
            'afogado': (33, (0, 111, 381, 781)),
            'aughisk': (42, (0, 289, 528, 781)),
            'crias-da-floresta': (71, (45, 288, 449, 781)),
        },
    },
}

SKILL_KEYS = {
    'acrobacia': 'acrobacia', 'animais': 'animais', 'aptidao': 'aptidao', 'atletismo': 'atletismo',
    'crime': 'crime', 'disciplina': 'disciplina', 'enganacao': 'enganacao', 'furtividade': 'furtividade',
    'intimidar': 'intimidar', 'intuicao': 'intuicao', 'luta': 'luta', 'maquinas': 'maquinas',
    'medicina': 'medicina', 'metalurgia': 'metalurgia', 'oficio': 'metalurgia', 'ocultismo': 'ocultismo',
    'bruxaria': 'ocultismo', 'percepcao': 'percepcao', 'persuasao': 'persuasao', 'pesquisar': 'pesquisar',
    'inspecionar': 'pesquisar', 'pontaria': 'pontaria', 'sobrevivencia': 'sobrevivencia',
    'tecnologia': 'tecnologia', 'vigor': 'vigor',
}

# ---------------------------------------------------------------------------- texto


def plain(value: str) -> str:
    return unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode().lower()


def slug(value: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', plain(value)).strip('-')[:70] or 'entrada'


def fix(text: str) -> str:
    """Hifenização, ícones de dados ("8_on_d8" → "d8", "26_on_d6" → "2d6") e espaços."""
    text = text.replace('\xad', '').replace(' ', ' ')
    text = re.sub(r'(\d*?)(\d+)_on_d\2(?!\d)', lambda m: f'{m.group(1)}d{m.group(2)}', text)
    text = re.sub(r'(\d+)_on_d\d+', r'\1', text)
    return re.sub(r'[ \t]+', ' ', text).strip()


class Line:
    __slots__ = ('page', 'x0', 'y0', 'x1', 'y1', 'size', 'font', 'text', 'col', 'used')

    def __init__(self, page, bbox, size, font, text, col):
        self.page, (self.x0, self.y0, self.x1, self.y1) = page, bbox
        self.size, self.font, self.text, self.col, self.used = size, font, text, col, False

    @property
    def bold(self):
        return any(k in self.font for k in ('Bold', 'Black', 'Semibo', 'Heavy'))

    @property
    def italic(self):
        return 'Italic' in self.font or self.font.endswith('I') or 'LightI' in self.font

    @property
    def mono(self):
        return 'Mono' in self.font

    @property
    def heading(self):
        return self.size >= 12.5


def page_lines(doc, number: int) -> list[Line]:
    page = doc[number - 1]
    width = page.rect.width
    rows = []
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines', []):
            spans = [s for s in line['spans'] if s['text'].strip()]
            if not spans:
                continue
            text = fix(''.join(s['text'] for s in line['spans']))
            if not text or (text.isdigit() and line['bbox'][1] > page.rect.height - 60):
                continue  # número da página
            main = max(spans, key=lambda s: len(s['text'].strip()))
            x0, _, x1, _ = line['bbox']
            col = 0 if x0 < width / 2 - 10 else 1
            if x0 < width / 2 - 10 and x1 > width / 2 + 40:
                col = 0
            rows.append(Line(number, line['bbox'], round(main['size'], 1), main['font'], text, col))
    # Linhas repetidas (o PDF às vezes desenha o mesmo texto duas vezes).
    seen, unique = set(), []
    for row in rows:
        key = (round(row.x0), round(row.y0), row.text)
        if key not in seen:
            seen.add(key)
            unique.append(row)
    unique.sort(key=lambda r: (r.col, round(r.y0), r.x0))
    return unique


def to_markdown(lines: list[Line]) -> str:
    """Junta linhas em parágrafos; títulos viram `##`/`###` e a narração (fonte mono) vira citação."""
    out: list[str] = []
    buffer: list[str] = []
    kind = None
    last = None

    def flush():
        nonlocal buffer, kind
        if not buffer:
            return
        text = ' '.join(buffer)
        text = re.sub(r'(\w)- (\w)', r'\1\2', text) if False else text
        if kind == 'h2':
            out.append(f'## {text}')
        elif kind == 'h3':
            out.append(f'### {text}')
        elif kind == 'quote':
            out.append('> ' + text)
        else:
            out.append(text)
        buffer, kind = [], None

    for line in lines:
        this = 'h2' if line.size >= 24 else 'h3' if line.heading or (line.bold and line.size >= 10 and line.text.isupper()) else 'quote' if line.mono else 'p'
        gap = None if last is None else line.y0 - last.y1
        new_par = (
            this != kind
            or last is None
            or last.page != line.page
            or last.col != line.col
            or (gap is not None and (gap > line.size * 0.9 or gap < -line.size * 2))
            or (this == 'p' and line.bold and not last.bold)
        )
        if new_par:
            flush()
            kind = this
        buffer.append(line.text)
        last = line
    flush()
    text = '\n\n'.join(out)
    return re.sub(r'\n{3,}', '\n\n', text).strip()


# ---------------------------------------------------------------------------- pontos de interesse


def skill_keys(text: str) -> list[str]:
    keys = []
    for word in re.findall(r'[A-Za-zÀ-ú]+', text):
        key = SKILL_KEYS.get(plain(word))
        if key and key not in keys:
            keys.append(key)
    return keys


def near(a: float, b: float, tolerance: float = 14) -> bool:
    return abs(a - b) <= tolerance


def is_title(line: Line) -> bool:
    letters = re.sub(r'[^A-Za-zÀ-ú]', '', line.text.split('(')[0])
    return (line.bold and 9.5 <= line.size <= 11 and len(letters) >= 3 and letters.isupper()
            and not line.text.isdigit())


def is_label(line: Line) -> bool:
    return line.size >= 16 and bool(re.fullmatch(r'\d{1,2}(\.\d)?', line.text))


def title_name(lines: list[Line]) -> str:
    text = ' '.join(l.text for l in lines)
    base, paren, rest = text.partition('(')
    base = base.strip()
    base = base.title() if base.isupper() else base
    return f'{base} ({rest}'.strip() if paren else base


def grouped(items: list[Line], gap: float) -> list[list[Line]]:
    out: list[list[Line]] = []
    for l in sorted(items, key=lambda l: l.y0):
        if out and l.y0 - out[-1][-1].y1 < gap:
            out[-1].append(l)
        else:
            out.append([l])
    return out


def center(group: list[Line]) -> float:
    return (group[0].y0 + group[-1].y1) / 2


def parse_table(header: Line, lines: list[Line], region: list[Line], bottom: float):
    """Linhas da tabela "Perícia | DT | Informação"; devolve (linhas, linhas usadas, início do contexto)."""
    dt_head = next((l for l in lines if l.text == 'DT' and near(l.y0, header.y0, 4)), None)
    info_head = next((l for l in lines if l.text.startswith('Informação') and near(l.y0, header.y0, 4)), None)
    if not dt_head or not info_head:
        return [], [], header.y1
    after = [l for l in region if l.y0 > header.y1 - 2 and not is_label(l)]
    context_ys = [l.y0 for l in after if header.x0 + 25 < l.x0 < dt_head.x0 - 8 and not re.match(r'^\d', l.text)]
    table_bottom = min(context_ys) if context_ys else bottom
    table = [l for l in after if l.y0 < table_bottom - 1]
    skill_groups = grouped([l for l in table if l.x0 < dt_head.x0 - 8], 4)
    info_groups = grouped([l for l in table if l.x0 >= info_head.x0 - 6], 6)
    dt_groups = grouped([l for l in table if near(l.x0, dt_head.x0, 16) and re.match(r'^\d+( ou)?$', l.text)], 6)
    rows = []
    for dts in dt_groups:
        c = center(dts)
        skill = min(skill_groups, key=lambda g: abs(center(g) - c), default=None)
        info = min(info_groups, key=lambda g: 0 if g[0].y0 - 3 <= c <= g[-1].y1 + 3 else
                   min(abs(c - g[0].y0), abs(c - g[-1].y1)), default=None)
        if not skill or not info:
            continue
        skill_text = ' '.join(l.text for l in skill)
        numbers = re.findall(r'\d+', ' '.join(l.text for l in dts))
        requirement = []
        match = re.search(r'\(([^)]*)\)', skill_text)
        if match and re.search(r'apenas|exclusiv|requer|caso|se ', match.group(1), re.I):
            requirement.append(match.group(1))
        info_text = ' '.join(l.text for l in info)
        lead = re.match(r'^\((apenas[^)]*|requer[^)]*|se [^)]*)\)\s*', info_text, re.I)
        if lead:
            requirement.append(lead.group(1))
            info_text = info_text[lead.end():]
        if len(numbers) > 1:
            requirement.append('DT ' + ' ou '.join(numbers))
        rows.append({
            'skill': skill_text[:160],
            'skillKeys': skill_keys(skill_text),
            'dc': int(numbers[0]),
            'text': info_text[:4000],
            'requirement': '; '.join(requirement)[:400],
        })
    return rows, table + [header, dt_head, info_head], table_bottom - 1


def find_pois(lines: list[Line]) -> list[dict]:
    """Quadros de pontos de interesse de uma página: título, descrição, tabela e contexto."""
    headers = [l for l in lines if l.text == 'Perícia']
    groups: list[list[Line]] = []
    for t in sorted((l for l in lines if is_title(l)), key=lambda l: (l.col, l.y0)):
        if groups and groups[-1][-1].font == t.font and 0 <= t.y0 - groups[-1][-1].y1 < 6:
            groups[-1].append(t)
        else:
            groups.append([t])
    # Conta como ponto de interesse o título seguido de descrição em itálico ou de uma tabela.
    starts = []
    for group in groups:
        last = group[-1]
        italic = any(l.italic and -4 <= l.y0 - last.y1 < 20 for l in lines)
        table = any(0 < h.y0 - last.y0 < 260 for h in headers)
        if italic or table or 'CONTINUA' in last.text.upper():
            starts.append(group)
    starts.sort(key=lambda g: g[0].y0)
    pois = []
    for index, group in enumerate(starts):
        top = group[-1].y1
        bottom = starts[index + 1][0].y0 if index + 1 < len(starts) else 10_000
        region = [l for l in lines if top - 1 < l.y0 < bottom - 1 and l not in group]
        header = next((h for h in headers if top < h.y0 < bottom), None)
        description = [l for l in region if l.italic and l.size <= 9.5 and (header is None or l.y0 < header.y0)]
        label = next((l for l in lines if is_label(l) and abs(l.y0 - group[0].y0) < 45), None)
        rows, table_lines, context_start = [], [], top
        boxed = []
        if header:
            rows, table_lines, context_start = parse_table(header, lines, region, bottom)
            boxed = [l for l in region if l not in description and l not in table_lines and not is_label(l)
                     and l.y0 < header.y0]
        context = [l for l in region if l.y0 >= context_start and l not in description and l not in table_lines
                   and l not in boxed and not is_label(l) and not l.heading]
        for l in group + description + table_lines + boxed + context + ([label] if label else []):
            l.used = True
        name = title_name(group)
        pois.append({
            'name': name,
            'description': ' '.join(l.text for l in description),
            'rows': rows,
            'context': '\n\n'.join(part for part in (to_markdown(boxed), to_markdown(context)) if part),
            'mapLabel': label.text if label else '',
            'keyEvidence': 'EVIDÊNCIA-CHAVE' in name.upper(),
            'page': group[0].page,
        })
    return pois


# ---------------------------------------------------------------------------- criaturas

ATTR_RE = re.compile(r'F[IÍ]SICO\s*(d\d+)\s*MENTE\s*(d\d+)\s*EMO[CÇ][AÃ]O\s*(d\d+)', re.I)


def find_creatures(text: str, page: int, mission: str | None) -> list[dict]:
    creatures = []
    for match in re.finditer(r'^([A-ZÁÉÍÓÚÂÊÔÃÕÇ ]{3,40}?)[ \t]*\n?[ \t]*PV[ \t]*(\d+)[ \t]*$', text, re.M):
        name = match.group(1).strip()
        before = text[: match.start()].rstrip('\n').split('\n')
        if before and re.fullmatch(r'[A-ZÁÉÍÓÚÂÊÔÃÕÇ ]{2,30} D[AEO]S?', before[-1].strip()):
            name = before[-1].strip() + ' ' + name
        name = name.title().replace(' Da ', ' da ').replace(' De ', ' de ').replace(' Do ', ' do ')
        rest = text[match.end():]
        attrs = ATTR_RE.search(rest[:200])
        if not attrs:
            continue
        after = rest[attrs.end():]
        stop = re.search(r'\n\s*(AÇÕES|ACOES)\s*\n', after)
        skills_text = after[: stop.start()] if stop else after[:200]
        actions_text = after[stop.end():] if stop else ''
        skills = []
        for skill, die in re.findall(r'([A-ZÁÉÍÓÚÂÊÔÃÕÇ]+)\s*(d\d+)', skills_text):
            key = SKILL_KEYS.get(plain(skill))
            if key:
                skills.append({'key': key, 'die': int(die[1:])})
        actions, abilities = [], []
        for block in re.split(r'\n(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ ]{3,30}\.)', '\n' + actions_text):
            block = ' '.join(block.split())
            if not block:
                continue
            head, _, body = block.partition('.')
            head = head.strip()
            if not head or not head.isupper() or len(head) > 30:
                if abilities:
                    abilities[-1]['text'] += ' ' + block
                continue
            if head in ('CORPO A CORPO', 'À DISTÂNCIA', 'A DISTANCIA', 'DISTÂNCIA'):
                dice = re.search(r'((?:\d*d\d+\s*\+\s*)*\d*d\d+)', body)
                if dice:
                    damage = re.search(r'dano\s+(R[AB](?:\s*[+-]\s*\d+)?)', body)
                    action = re.split(r'\s*\(|\s+\d*d\d', body.strip(), maxsplit=1)[0]
                    actions.append({
                        'name': action.strip(' .,')[:160] or head.title(),
                        'kind': 'corpo-a-corpo' if head == 'CORPO A CORPO' else 'distancia',
                        'dice': re.sub(r'\s+', '', dice.group(1))[:60],
                        'damage': (re.sub(r'\s+', '', damage.group(1)) if damage else '')[:80],
                        'text': body.strip()[:4000],
                    })
                    continue
            abilities.append({'name': head.title()[:160], 'text': body.strip()[:6000]})
        hp = int(match.group(2))
        creatures.append({
            'name': name,
            'stats': {
                'hitPoints': hp,
                'attributes': {'fisico': int(attrs.group(1)[1:]), 'mente': int(attrs.group(2)[1:]),
                               'emocao': int(attrs.group(3)[1:])},
                'skills': skills,
                'actions': actions,
                'abilities': [a for a in abilities if a['name'] and a['text']][:20],
            },
            'page': page,
            'mission': mission,
        })
    return creatures


# ---------------------------------------------------------------------------- imagens


class Assets:
    def __init__(self):
        self.items: dict[str, dict] = {}

    def add(self, data: bytes, mime='image/jpeg') -> str:
        ext = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp'}[mime]
        key = f'{hashlib.sha256(data).hexdigest()[:40]}-{ext}'
        self.items[key] = {'key': key, 'mime': mime, 'data': base64.b64encode(data).decode('ascii')}
        return key

    def page(self, doc, number: int, clip=None, dpi=110) -> str:
        pix = doc[number - 1].get_pixmap(dpi=dpi, clip=fitz.Rect(*clip) if clip else None)
        return self.add(pix.tobytes('jpeg', jpg_quality=82))


# ---------------------------------------------------------------------------- extras

EXTRA_FOLDERS = {
    'handouts': ('handout', 1600, 'Handout'),
    'mapas': ('map', 3000, 'Mapa'),
    'tokens': ('handout', 512, 'Token'),
    'mapa': ('map', 3000, 'Mapa'),
    'fichas de personagem': ('handout', 1600, 'Ficha'),
    'historicos de personagem': ('handout', 1600, 'Histórico'),
    'fichas e historicos de personagem': ('handout', 1600, 'Ficha'),
}


def shrink(path: Path, max_side: int) -> tuple[bytes, str]:
    """Reduz a imagem para o maior lado caber em `max_side`. Com transparência, PNG; senão, JPEG."""
    pix = fitz.Pixmap(str(path))
    factor = 1
    while max(pix.width, pix.height) / factor > max_side:
        factor *= 2
    if factor > 1:
        pix = fitz.Pixmap(pix, pix.width // factor, pix.height // factor, None)
    if pix.alpha:
        return pix.tobytes('png'), 'image/png'
    if pix.n > 3:
        pix = fitz.Pixmap(fitz.csRGB, pix)
    return pix.tobytes('jpeg', jpg_quality=82), 'image/jpeg'


def add_extras(entries: list[dict], assets: 'Assets', folder: Path, mission: str) -> int:
    """Inclui handouts, mapas e tokens de uma pasta de extras, ligados à missão."""
    added = 0
    taken = {(e['kind'], e['key']) for e in entries}
    for sub in sorted(folder.rglob('*')):
        if not sub.is_dir() or plain(sub.name) not in EXTRA_FOLDERS:
            continue
        kind, max_side, label = EXTRA_FOLDERS[plain(sub.name)]
        for image in sorted(sub.iterdir()):
            if image.suffix.lower() not in ('.png', '.jpg', '.jpeg', '.webp'):
                continue
            data, mime = shrink(image, max_side)
            key_asset = assets.add(data, mime)
            title = re.sub(r'^(handout|mapa)\s+', '', image.stem, flags=re.I).strip() or image.stem
            name = f'{label}: {title}'[:120]
            key = slug(f'{mission}-{label}-{image.stem}')[:80]
            if (kind, key) in taken:
                continue
            taken.add((kind, key))
            data_entry = {'page': 0, 'mission': mission, 'image': key_asset}
            data_entry.update({'legend': ''} if kind == 'map' else {'caption': f'{label} da missão (extras).'})
            entries.append(entry(kind, key, name, data_entry))
            added += 1
    return added


# ---------------------------------------------------------------------------- montagem


def same_poi(a: str, b: str) -> bool:
    """Mesmo ponto de interesse, ignorando "(requer…)", "[EVIDÊNCIA-CHAVE]" e caixa."""
    norm = lambda v: re.sub(r'\s+', ' ', re.sub(r'\(.*?\)|\[.*?\]', '', plain(v))).strip()
    return norm(a) == norm(b)


def entry(kind: str, key: str, name: str, data: dict) -> dict:
    return {'kind': kind, 'key': key[:80], 'name': name[:200], 'data': data}


def main() -> None:
    args = sys.argv[1:]
    extras: list[tuple[Path, str]] = []
    while '--extras' in args:
        at = args.index('--extras')
        folder, _, mission_key = args[at + 1].rpartition('=')
        extras.append((Path(folder), mission_key))
        del args[at:at + 2]
    which, source, destination = args[0], Path(args[1]), Path(args[2])
    password = args[3] if len(args) > 3 else None
    book = BOOKS[which]
    doc = fitz.open(source)
    if doc.needs_pass and not doc.authenticate(password or ''):
        raise SystemExit('Senha do PDF incorreta.')
    lines = {n: page_lines(doc, n) for n in range(1, doc.page_count + 1)}
    entries: list[dict] = []
    assets = Assets()

    # Capítulos do jogador, página a página.
    chapters = book['chapters']
    for (start, title), (end, _) in zip(chapters, chapters[1:]):
        for n in range(start, end):
            body = to_markdown(lines[n])
            if not body:
                continue
            first = next((l.text for l in lines[n] if not l.text.isdigit() and len(l.text) > 3), f'Página {n}')
            entries.append(entry('section', f'pagina-{n:03d}', first.title() if first.isupper() else first, {
                'chapter': title, 'order': n, 'page': n, 'body': body[:60000],
            }))

    # Ferramentas da Ordo Realitas (texto do jogador; as mecânicas ficam na missão do mestre).
    if book['tools']:
        start, end = book['tools']
        for n in range(start, end + 1):
            names: list[list[Line]] = []
            for l in lines[n]:
                if (l.size >= 17 and l.bold or l.size >= 40) and not l.text.isdigit():
                    prev = names[-1][-1] if names else None
                    if prev and l.font == prev.font and 0 < l.y0 - prev.y0 < prev.size * 1.6 and abs(l.x0 - prev.x0) < 120:
                        names[-1].append(l)
                    else:
                        names.append([l])
            if n == start:
                names = []  # página de abertura
            image = assets.page(doc, n, dpi=90)
            for i, group in enumerate(names):
                name = ' '.join(l.text for l in group).title()
                below = [g[0].y0 for g in names if g[0].y0 > group[-1].y0]
                limit = min(below) if below else 10_000
                body = [l for l in lines[n] if l not in group and group[-1].y0 < l.y0 < limit]
                entries.append(entry('tool', slug(name), name, {
                    'page': n, 'body': to_markdown(body)[:12000], 'mechanics': '', 'image': image,
                }))
        entries.append(entry('section', f'pagina-{start:03d}', 'Ferramentas da Ordo Realitas', {
            'chapter': 'Ferramentas da Ordo Realitas', 'order': start, 'page': start,
            'body': to_markdown(lines[start])[:60000],
        }))

    # Missões.
    for mission in book['missions']:
        scene_keys = []
        mission_creatures = []
        s0, s1 = mission['summary']
        summary_lines = [l for n in range(s0, s1 + 1) for l in lines[n]]
        body_lines = [l for a, b in mission['body'] for n in range(a, b + 1) for l in lines[n]]
        for order, scene in enumerate(mission['scenes'], 1):
            a, b = scene['pages']
            poi_keys, creature_keys, map_keys = [], [], []
            last_poi = None
            for n in range(a, b + 1):
                for poi in find_pois(lines[n]):
                    base = re.sub(r'\s*\(CONTINUA[ÇC][AÃ]O\)\s*', '', poi['name'], flags=re.I).strip()
                    if last_poi and same_poi(base, last_poi['name']):
                        last_poi['data']['rows'] += poi['rows']
                        last_poi['data']['context'] = (last_poi['data']['context'] + '\n\n' + poi['context']).strip()
                        continue
                    key = slug(f"{scene['key']}-{base}")
                    while any(e['key'] == key for e in entries if e['kind'] == 'point_of_interest'):
                        key = key[:76] + '-' + str(len(poi_keys))
                    last_poi = entry('point_of_interest', key, base.title() if base.isupper() else base, {
                        'page': poi['page'], 'mission': mission['key'], 'scene': scene['key'],
                        'description': poi['description'][:4000], 'rows': poi['rows'][:40],
                        'context': poi['context'][:20000], 'mapLabel': poi['mapLabel'],
                        'keyEvidence': poi['keyEvidence'], 'image': None,
                    })
                    entries.append(last_poi)
                    poi_keys.append(key)
                page_text = '\n'.join(l.text for l in lines[n])
                for creature in find_creatures(page_text, n, mission['key']):
                    ckey = slug(creature['name'])
                    if any(e['kind'] == 'creature' and e['key'] == ckey for e in entries):
                        continue
                    art = book['creature_art'].get(ckey)
                    image = assets.page(doc, art[0], art[1], dpi=130) if art else None
                    entries.append(entry('creature', ckey, creature['name'], {
                        'page': n, 'mission': mission['key'], 'stats': creature['stats'], 'image': image,
                    }))
                    creature_keys.append(ckey)
                    mission_creatures.append(ckey)
            for n in scene['maps']:
                mkey = f"mapa-{scene['key']}"
                image = assets.page(doc, n, dpi=120)
                legend = to_markdown([l for l in lines[n] if not l.used])
                entries.append(entry('map', mkey, f"Mapa — {scene['name']}", {
                    'page': n, 'mission': mission['key'], 'image': image, 'legend': legend[:4000],
                }))
                map_keys.append(mkey)
            scene_lines = [l for n in range(a, b + 1) for l in lines[n] if not l.used]
            read_aloud = '\n\n'.join(p[2:] for p in to_markdown([l for l in scene_lines if l.mono]).split('\n\n') if p.startswith('> '))
            entries.append(entry('scene', scene['key'], scene['name'], {
                'page': a, 'mission': mission['key'], 'order': order,
                'readAloud': read_aloud[:20000], 'body': to_markdown(scene_lines)[:60000],
                'pointsOfInterest': poi_keys, 'creatures': creature_keys, 'maps': map_keys,
            }))
            scene_keys.append(scene['key'])
        entries.append(entry('mission', mission['key'], mission['name'], {
            'page': s0, 'order': mission['order'],
            'summary': to_markdown(summary_lines)[:20000], 'body': to_markdown(body_lines)[:60000],
            'scenes': scene_keys,
        }))

    for folder, mission_key in extras:
        print(f'extras {folder.name} → {mission_key}: {add_extras(entries, assets, folder, mission_key)} imagens')

    pack = {
        'format': 'codexveil.ordem2.book',
        'version': 1,
        'book': {'id': book['id'], 'name': book['name'], 'category': 'core', 'edition': book['edition'],
                 'origin': 'Exemplar do usuário (PDF)'},
        'entries': entries,
        'assets': list(assets.items.values()),
    }
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(pack, ensure_ascii=False), encoding='utf-8')
    kinds: dict[str, int] = {}
    for e in entries:
        kinds[e['kind']] = kinds.get(e['kind'], 0) + 1
    size = destination.stat().st_size / 1e6
    print(f'{doc.page_count} páginas; {kinds}; {len(assets.items)} imagens; {size:.1f} MB; {destination}')


if __name__ == '__main__':
    main()
