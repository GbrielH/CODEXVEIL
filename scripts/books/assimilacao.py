"""Extração do Assimilação RPG (livro de regras) direto do PDF do usuário.

Uso: venv/Scripts/python -X utf8 -I scripts/books/assimilacao.py <livro.pdf> <saída.json>

O PDF tem texto selecionável em duas colunas. Os ícones do jogo vêm na fonte
`simbolos_assimilas` e viram marcadores entre chaves, que a interface desenha como ícones:
  {A} Sucesso · {B} Adaptação · {C} Pressão · {d} Ponto de Determinação · {e} Ponto de Assimilação
  {s} Ponto de Saúde · {D} Nível de Determinação · {E} Nível de Assimilação · {S} Nível de Saúde
  {6} {1} {2} dados d6, d10 e d12 · {F} {G} {H} {I} naipes das cartas · {P} penalidade
Um "A" sozinho no começo da linha, seguido de maiúscula ou número, é o marcador de lista (vira "- ").

A página do livro é a do PDF menos 9 (a numeração impressa).
"""
import json, re, sys, unicodedata
import pymupdf

SYMBOL_FONT = 'simbolos_assimilas'
TITLE_FONT = 'ASRPGDINDEMIBLANK'
HEAD_FONT = 'ASRPGDINDEMI'
PAGE_OFFSET = 9
SYMBOLS = set('ABCdeDEsS612FGHIP')


def book_page(pdf_page):
    return pdf_page - PAGE_OFFSET


def span_text(span):
    raw = span['text']
    if span['font'] == SYMBOL_FONT and raw.strip():
        return ''.join('{%s}' % ch for ch in raw.strip() if ch in SYMBOLS) + (' ' if raw.endswith(' ') else '')
    return raw


def table_markdown(page, table):
    """Tabela do PDF em Markdown, montada célula a célula com os símbolos marcados."""
    spans = []
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines', []):
            for span in line['spans']:
                if span['text'].strip() and not span['text'].startswith('Licenciado'):
                    spans.append(span)
    grid = []
    for row in table.rows:
        cells = []
        for cell in row.cells:
            if cell is None:
                cells.append('')
                continue
            x0, y0, x1, y1 = cell
            inside = [sp for sp in spans if x0 - 1 <= (sp['bbox'][0] + sp['bbox'][2]) / 2 <= x1 + 1 and y0 - 1 <= (sp['bbox'][1] + sp['bbox'][3]) / 2 <= y1 + 1]
            inside.sort(key=lambda sp: (round(sp['bbox'][1] / 3), sp['bbox'][0]))
            # Linha a linha dentro da célula, para desfazer a hifenização ("retor-" / "nam").
            lines, current, top, right = [], '', None, None
            for sp in inside:
                if top is not None and abs(sp['bbox'][1] - top) > 3:
                    lines.append(current)
                    current = ''
                piece = span_text(sp)
                # Trechos separados por espaço no desenho (ex.: "Tamanho  Perigo  Habitação").
                if current and not current.endswith(' ') and right is not None and sp['bbox'][0] - right > 2:
                    current += '  '
                current += piece
                top, right = sp['bbox'][1], sp['bbox'][2]
            lines.append(current)
            text = join_text([unicodedata.normalize('NFKC', line) for line in lines])
            cells.append(text.replace('|', '/'))
        if any(cells):
            grid.append(cells)
    if not grid:
        return ''
    width = max(len(row) for row in grid)
    grid = [row + [''] * (width - len(row)) for row in grid]
    lines = ['| ' + ' | '.join(grid[0]) + ' |', '|' + '---|' * width]
    lines += ['| ' + ' | '.join(row) + ' |' for row in grid[1:]]
    return '\n'.join(lines)


def read_lines(path):
    """Linhas do PDF com estilo e símbolos marcados, na ordem de leitura (página, coluna, altura).
    Tabelas viram uma linha só, já em Markdown (campo `table`)."""
    doc = pymupdf.open(path)
    pages = []
    for pno, page in enumerate(doc, 1):
        width = page.rect.width
        mid = width / 2
        rows = []
        boxes = []
        for table in page.find_tables().tables:
            markdown = table_markdown(page, table)
            x0, y0, x1, y1 = table.bbox
            boxes.append((x0 - 2, y0 - 2, x1 + 2, y1 + 2))
            if markdown:
                rows.append({'p': pno, 'c': 0 if x0 < mid - 10 else 1, 'x': round(x0), 'y': round(y0), 'r': round(x1),
                             's': 12.0, 'f': 'table', 'b': False, 'i': False, 't': markdown, 'table': True})
        for block in page.get_text('dict')['blocks']:
            for line in block.get('lines', []):
                spans = [s for s in line['spans'] if s['text'].strip()]
                if not spans:
                    continue
                lx0, ly0, lx1, ly1 = line['bbox']
                cx, cy = (lx0 + lx1) / 2, (ly0 + ly1) / 2
                if any(b[0] <= cx <= b[2] and b[1] <= cy <= b[3] for b in boxes):
                    continue
                parts = []
                for index, span in enumerate(line['spans']):
                    raw = span['text']
                    if span['font'] == SYMBOL_FONT and raw.strip():
                        glyphs = raw.strip()
                        first = index == 0 or not ''.join(s['text'] for s in line['spans'][:index]).strip()
                        rest = ''.join(s['text'] for s in line['spans'][index + 1:]).strip()
                        # Marcador de lista: "A" isolado abrindo a linha e seguido de texto comum.
                        if first and glyphs == 'A' and rest and (rest[0].isupper() or rest[0].isdigit()):
                            parts.append('- ')
                            continue
                        tokens = ''.join('{%s}' % ch for ch in glyphs if ch in SYMBOLS)
                        parts.append(tokens + (' ' if raw.endswith(' ') else ''))
                    else:
                        parts.append(raw)
                # NFKC desfaz as ligaduras do PDF (ﬁ, ﬂ) sem mexer nos acentos.
                text = unicodedata.normalize('NFKC', ''.join(parts)).strip()
                if not text or text.startswith('Licenciado para'):
                    continue
                main = max(spans, key=lambda s: len(s['text']))
                x0, y0, x1, _ = line['bbox']
                col = 0 if x0 < mid - 10 else 1
                rows.append({
                    'p': pno, 'c': col, 'x': round(x0), 'y': round(y0), 'r': round(x1),
                    's': round(main['size'], 1), 'f': main['font'], 'b': bool(main['flags'] & 16),
                    'i': bool(main['flags'] & 2), 't': text,
                })
        # Número da página (rodapé) fora.
        rows = [r for r in rows if not (r['f'] == TITLE_FONT and r['s'] >= 23 and r['y'] > 780)]
        rows.sort(key=lambda r: (r['c'], r['y'], r['x']))
        pages.append(rows)
    return pages


def join_text(lines):
    """Junta linhas de um parágrafo, desfazendo hifenização de fim de linha."""
    out = ''
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if out.endswith('-') and not out.endswith(' -') and out[-2:-1].isalpha() and line[:1].isalpha() and (line[:1].islower() or out[-2:-1].isupper()):
            out = out[:-1] + line  # hifenização de fim de linha ("PRES-" + "SÃO")
        elif out:
            out += ' ' + line
        else:
            out = line
    out = re.sub(r'\s+', ' ', out)
    out = re.sub(r'\}(?=[^\s.,;:!?)\]}{–—-])', '} ', out)  # "{d}Ponto" -> "{d} Ponto"
    return out.strip()


def heading_level(row):
    """1 = capítulo, 2 = seção, 3 = subseção; 0 = corpo."""
    if row['t'].strip().isdigit():
        return 0  # passos numerados ("1", "2"...) desenhados na fonte de título
    if row['f'] == TITLE_FONT and row['s'] >= 28:
        return 1
    if row['f'] == TITLE_FONT and row['s'] >= 19:
        return 2
    if row['f'] in (TITLE_FONT, HEAD_FONT) and row['s'] >= 15.5:
        return 3
    return 0


def is_body(row):
    return row['f'].startswith('AGaramondPro') and 11 <= row['s'] <= 12.6


def paragraphs(rows):
    """Texto corrido em Markdown: subtítulos (### / ####), listas e parágrafos."""
    blocks, current, last = [], [], None

    def flush():
        if current:
            blocks.append(join_text(current))
            current.clear()

    for row in rows:
        if row.get('table'):
            flush()
            blocks.append(row['t'])
            last = row
            continue
        level = heading_level(row)
        text = row['t']
        small_head = row['f'] == HEAD_FONT and 11.5 <= row['s'] < 15.5 and len(text) < 90
        if level >= 3 or small_head:
            flush()
            prefix = '###' if level >= 3 else '####'
            # Título quebrado em duas linhas seguidas.
            if blocks and blocks[-1].startswith(prefix + ' ') and last and last['y'] < row['y'] < last['y'] + row['s'] * 1.6 and last['c'] == row['c']:
                blocks[-1] = join_text([blocks[-1], text])
            else:
                blocks.append(f'{prefix} {text}')
        elif text.startswith('- '):
            flush()
            current.append(text)
        else:
            gap = last is not None and last['c'] == row['c'] and last['p'] == row['p'] and row['y'] - last['y'] > row['s'] * 1.9
            if gap or (last is not None and (last['f'] != row['f'] and not is_body(last))):
                flush()
            current.append(text)
        last = row
    flush()
    return [b for b in blocks if b]


def sections(pages):
    """Capítulos (título 30) e seções (título 20) do livro inteiro, com o texto em Markdown."""
    out, chapter, rows = [], 'Introdução', []
    # Antes do primeiro título: créditos do livro.
    section = {'name': 'Créditos', 'page': 0, 'level': 2}

    def close():
        if section and rows:
            text = '\n\n'.join(paragraphs(rows))
            if text.strip():
                out.append({'chapter': chapter, 'name': section['name'], 'page': section['page'], 'text': text})

    for page_rows in pages:
        for row in page_rows:
            level = heading_level(row)
            if level in (1, 2):
                # Títulos quebrados em duas linhas.
                if section and section['page'] == book_page(row['p']) and not rows and section.get('level') == level:
                    section['name'] += ' ' + row['t']
                    if level == 1 and section['name'].upper().startswith('CAPÍTULO'):
                        chapter = section['name']
                    continue
                close()
                if level == 1 and row['t'].upper().startswith('CAPÍTULO'):
                    chapter = row['t']
                section = {'name': row['t'], 'page': book_page(row['p']), 'level': level}
                rows = []
            elif section:
                rows.append(row)
    close()
    out = [entry for entry in out if entry['name'].strip().upper() != 'SUMÁRIO']
    for entry in out:
        entry['name'] = clean_title(entry['name'])
        entry['chapter'] = clean_title(entry['chapter'])
    return out


def clean_title(text):
    text = join_text(text.split('\n'))
    text = re.sub(r'\s+', ' ', text).strip(' :')
    if not re.sub(r'\{.\}', '', text).isupper():
        return text
    # Caixa alta vira frase, preservando os símbolos ({A}, {E}...).
    pieces = re.split(r'(\{.\})', text)
    lowered = ''.join(piece if piece.startswith('{') else piece.lower() for piece in pieces)
    lowered = PROPER.sub(lambda m: PROPER_WORDS[m.group(0).lower()], lowered)
    return lowered[:1].upper() + lowered[1:]


# Termos do jogo que o livro sempre escreve com inicial maiúscula.
PROPER_WORDS = {w.lower(): w for w in (
    'Assimilação', 'Assimilações', 'RPG', 'ASRPG', 'Infectado', 'Infectados', 'Infectada', 'Assimilador', 'Assimiladores',
    'Assimilador(a)', 'Colapso', 'pré-Colapso', 'pós-Colapso', 'Determinação', 'Saúde', 'Conflito', 'Conflitos',
    'Instinto', 'Instintos', 'Conhecimentos', 'Práticas', 'Aptidões', 'Origens', 'Propósito', 'Propósitos',
    'Refúgio', 'Refúgios', 'Artefatos', 'Equipamentos', 'Recursos', 'Regiões', 'Características', 'Cabo de Guerra',
    'Sucesso', 'Adaptação', 'Pressão', 'Ameaças', 'Objetivos', 'Brasil',
)}
PROPER = re.compile(r'(?<![\w-])(' + '|'.join(re.escape(w) for w in sorted(PROPER_WORDS, key=len, reverse=True)) + r')(?![\w-])', re.IGNORECASE)


# O título às vezes quebra em duas linhas ("CARACTERÍSTICAS" / "DE 4 PONTOS").
CHAR_COST = re.compile(r'DE (\d) PONTOS?')


def characteristics(pages):
    """Características de Infectados (custo pela seção, requisito e texto)."""
    out, cost, current = [], None, None
    for page_rows in pages:
        if not page_rows or not (90 <= page_rows[0]['p'] <= 99):
            continue
        # Página com dois cabeçalhos de custo (4 e 5 pontos lado a lado): cada coluna tem o seu.
        heads = [(r, int(CHAR_COST.search(r['t']).group(1))) for r in page_rows if r['f'] == TITLE_FONT and CHAR_COST.search(r['t'])]
        by_column = {}
        if len(heads) > 1:
            for head, value in heads:
                by_column[0 if head['x'] < 297 else 1] = value
        for row in page_rows:
            match = CHAR_COST.search(row['t'])
            if row['f'] == TITLE_FONT and match:
                cost = int(match.group(1))
                continue
            if by_column:
                cost = by_column.get(0 if row['x'] < 297 else 1, cost)
            if row['f'] == TITLE_FONT and current and 'EQUIPAMENTOS' in row['t']:
                cost = None
            if cost is None:
                continue
            if row['f'] == HEAD_FONT and row['s'] == 12.0 and row['t'].isupper():
                current = {'name': clean_title(row['t']), 'cost': cost, 'requirement': '', 'lines': [], 'page': book_page(row['p'])}
                out.append(current)
            elif current and row['b'] and row['t'].strip().startswith('Requisito'):
                current['requirement'] = row['t'].split(':', 1)[1].strip()
            elif current and is_body(row):
                current['lines'].append(row['t'])
    for entry in out:
        entry['text'] = join_text(entry.pop('lines'))
    return out


CARD_TITLE = re.compile(r'^(?P<name>.+?)\s+(?P<rank>[AJQK]|10|[2-9])\s*\{(?P<suit>[FGHI])\}$')
LEVEL = re.compile(r'^(?P<cost>(?:\{[ABC]\}\s*)+)\s*[–—-]\s*(?P<name>[^:]+?)\s*(?::\s*(?P<req>.*))?$')
SUIT_KIND = {'F': 'evolutiva', 'G': 'adaptativa', 'H': 'inoportuna', 'I': 'singular'}


def assimilations(pages):
    """Cartas de Assimilação (capítulo 4): nome, carta, descrição e níveis com custo."""
    out, current, level, pending = [], None, None, ''
    for page_rows in pages:
        if not page_rows or not (133 <= page_rows[0]['p'] <= 172):
            continue
        for row in page_rows:
            text = row['t']
            if row['f'] == HEAD_FONT and row['s'] >= 17:
                title = (pending + ' ' + text).strip() if pending else text
                # Avisos em fonte de título antes do nome da carta ("Anulando Pressões AVISO ...").
                if 'Assimilação' in title:
                    title = title[title.rfind('Assimilação'):]
                match = CARD_TITLE.match(title)
                if not match:
                    pending = title
                    continue
                pending = ''
                current = {
                    'name': match.group('name').strip(), 'rank': match.group('rank'), 'suit': match.group('suit'),
                    'kind': SUIT_KIND[match.group('suit')], 'page': book_page(row['p']), 'lines': [], 'levels': [],
                }
                level = None
                out.append(current)
                continue
            if not current:
                continue
            heading_font = row['f'] in (HEAD_FONT, SYMBOL_FONT) and 11.5 <= row['s'] <= 12.6
            if heading_font and text.startswith('{') and re.match(r'^(?:\{[ABC]\}\s*)+[–—-]', text):
                # Título do nível; pode continuar na linha de baixo ("{A}{A}{A}{A} – Res-" / "tauração: {E} 3+").
                level = {'heading': [text], 'lines': []}
                current['levels'].append(level)
            elif level and row['f'] == HEAD_FONT and heading_font and not level['lines'] and not text.startswith('{'):
                level['heading'].append(text)
            elif is_body(row) or row['f'] == SYMBOL_FONT:
                (level['lines'] if level else current['lines']).append(text)
    for card in out:
        card['text'] = join_text(card.pop('lines'))
        for level in card['levels']:
            heading = join_text(level.pop('heading'))
            match = LEVEL.match(heading)
            if not match:
                raise ValueError(f'nível ilegível em {card["name"]}: {heading}')
            cost = match.group('cost')
            level['cost'] = {k: cost.count('{%s}' % k) for k in 'ABC'}
            level['name'] = match.group('name').strip()
            level['requirement'] = (match.group('req') or '').strip()
            level['text'] = join_text(level.pop('lines'))
    return out


ARTIFACT = re.compile(r'^(?P<name>.+?)\s*\(Escassez\s*(?P<scarcity>-?\d+)\)\s*:?$')


def artifacts(pages):
    """Lista de Artefatos (nome, Escassez e características)."""
    out, current = [], None
    for page_rows in pages:
        if not page_rows or not (105 <= page_rows[0]['p'] <= 106):
            continue
        for row in page_rows:
            if row['f'] == TITLE_FONT:
                current = None
            match = ARTIFACT.match(row['t'])
            if row['f'] == HEAD_FONT and match:
                current = {'name': match.group('name').strip(), 'scarcity': int(match.group('scarcity')), 'lines': [], 'page': book_page(row['p'])}
                out.append(current)
            elif current and is_body(row):
                current['lines'].append(row['t'])
    for entry in out:
        entry['text'] = join_text(entry.pop('lines'))
    return out


EVENT_SUIT = re.compile(r'^(?P<name>.+?)\s*\{(?P<suit>[FGHI])\}$')


def events(pages):
    """Baralho de Eventos (capítulo 8): categoria (naipe), nome, carta e texto."""
    out, category, current = [], {}, None
    for page_rows in pages:
        if not page_rows or not (262 <= page_rows[0]['p'] <= 272):
            continue
        for row in page_rows:
            text = row['t']
            suit = EVENT_SUIT.match(text)
            if row['f'] == TITLE_FONT and row['s'] >= 15.5 and suit:
                category[suit.group('suit')] = clean_title(suit.group('name'))
                current = None
                continue
            if row['f'] == TITLE_FONT and row['s'] >= 15.5:
                current = None  # outra seção (ex.: "Costa Brava"): a carta anterior terminou
                continue
            match = CARD_TITLE.match(text)
            if row['f'] == HEAD_FONT and 13 <= row['s'] < 15.5 and match:
                current = {
                    'name': clean_title(match.group('name')), 'rank': match.group('rank'), 'suit': match.group('suit'),
                    'category': category.get(match.group('suit'), ''), 'page': book_page(row['p']), 'lines': [],
                }
                out.append(current)
            elif current and (is_body(row) or text.startswith('- ')):
                current['lines'].append(text)
    for card in out:
        lines, block = [], []
        for line in card.pop('lines'):
            if line.startswith('- '):
                if block:
                    lines.append(join_text(block))
                block = [line]
            else:
                block.append(line)
        if block:
            lines.append(join_text(block))
        card['text'] = '\n'.join(lines)
    return out


def main():
    src, dest = sys.argv[1], sys.argv[2]
    pages = read_lines(src)
    data = {
        'sections': sections(pages),
        'characteristics': characteristics(pages),
        'assimilations': assimilations(pages),
        'artifacts': artifacts(pages),
        'events': events(pages),
    }
    with open(dest, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    for key, value in data.items():
        print(key, len(value))


if __name__ == '__main__':
    main()
