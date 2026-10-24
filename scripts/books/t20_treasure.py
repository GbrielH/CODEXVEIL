"""Tabelas de tesouro do Tormenta20 (capítulo 8) em dados: d% → resultado.

Cada tabela vira {title, subtables: {rótulo: [{min, max, text, extra: [...]}]}}. As colunas são
achadas pela posição do cabeçalho ("d%" + rótulo); o rótulo muda quando aparece um cabeçalho novo
no meio da coluna (Arma → Armadura → Esotérico). A Tabela 8-1 (por ND) é lida à parte: para cada
ND, as faixas de dinheiro (coluna da esquerda) e de itens (coluna da direita, mesma altura).
"""
import re

RANGE = re.compile(r'^(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?$')
ND = re.compile(r'^(\d{1,2}|1/2|1/4|1/3|1/8)$')


def _clean(text):
    return re.sub(r'\s+', ' ', text.replace('\xad', '')).strip()


def _lines(rows):
    """Agrupa as células por página e altura (até 2,5 pontos de diferença = mesma linha). Só
    página e altura: o PDF às vezes separa células da mesma linha em colunas diferentes."""
    lines = {}
    current_key, current_y = None, None
    for r in sorted(rows, key=lambda r: (r['p'], r['y'], r['x'])):
        if current_key is None or current_key[0] != r['p'] or r['y'] - current_y > 2.5:
            current_key, current_y = (r['p'], r['y']), r['y']
        lines.setdefault(current_key, []).append(r)
    out = []
    for _, cells in sorted(lines.items()):
        split = []
        for cell in sorted(cells, key=lambda r: r['x']):
            # Faixa e resultado na mesma célula ("99-100 Virotes (20)").
            m = re.match(r'^(\d{1,3}\s*[-–]\s*\d{1,3}|\d{1,3})\s+(\D.*)$', _clean(cell['t']))
            if m:
                split.append({**cell, 't': m.group(1)})
                split.append({**cell, 't': m.group(2), 'x': cell['x'] + 1})
            else:
                split.append(cell)
        out.append(split)
    return out


def _range(text):
    m = RANGE.match(text.replace('00', '100') if text == '00' else text)
    if not m:
        return None
    low = int(m.group(1))
    high = int(m.group(2)) if m.group(2) else low
    return (low, 100 if high == 0 else high)


def _table_rows(book_rows, title, pages):
    start = next(i for i, r in enumerate(book_rows) if r['p'] in pages and r['t'].strip().startswith(title))
    head = book_rows[start]
    region = []
    for r in book_rows[start + 1:]:
        if r['p'] > head['p'] + 1:
            break
        if r['t'].strip().startswith('Tabela ') and r['p'] >= head['p'] and not r['t'].strip().startswith(title):
            break
        if r['p'] == head['p'] and r['c'] < head['c']:
            continue
        region.append(r)
    return region


def parse_table(book_rows, title, pages, value_columns=1):
    """Tabela d% com uma ou mais colunas lado a lado. `value_columns`: células de texto depois de
    cada faixa (Poções: nome e preço = 2)."""
    rows = _table_rows(book_rows, title, pages)
    columns = []  # [(x da faixa, rótulo)]
    subtables = {}
    current_labels = {}
    for cells in _lines(rows):
        texts = [_clean(c['t']) for c in cells]
        if not any(texts):
            continue
        if texts[0] in ('d%',) or (all(_range(t) is None for t in texts) and 'd%' in ' '.join(texts)):
            # Cabeçalho: "d% Arma d% Arma" → colunas em cada "d%".
            columns = []
            for k, (c, t) in enumerate(zip(cells, texts)):
                if t.startswith('d%'):
                    label = t[2:].strip() or (texts[k + 1] if k + 1 < len(texts) else '')
                    columns.append((c['x'], label))
            for x, label in columns:
                current_labels[x] = label
            continue
        if not columns:
            continue
        if all(_range(t) is None for t in texts) and len(texts) <= 2 and not subtables:
            continue
        # Linha de dados: cada faixa abre um resultado na coluna mais próxima à esquerda.
        k = 0
        while k < len(cells):
            span = _range(texts[k])
            if span is None:
                # Continuação do texto da linha anterior na mesma coluna.
                k += 1
                continue
            x = cells[k]['x']
            column = min(columns, key=lambda col: abs(col[0] - x))
            label = current_labels.get(column[0], column[1])
            values = []
            k += 1
            while k < len(cells) and _range(texts[k]) is None and len(values) < value_columns + 2:
                values.append(texts[k])
                k += 1
            if values:
                # Nota de rodapé grudada no nome ("Material especial2", "Atroz1").
                name = re.sub(r'(?<=[a-zà-ú)])\d$', '', values[0])
                subtables.setdefault(label, []).append({'min': span[0], 'max': span[1], 'text': name, 'extra': values[1:]})
    return {'title': title, 'subtables': subtables}


def parse_nd_table(book_rows):
    """Tabela 8-1: por ND, dinheiro (coluna da esquerda) e itens (coluna da direita, mesma altura).

    Cada ND abre um grupo na coluna da esquerda; as linhas de dinheiro e de itens entre o ND e o
    próximo ND (pela altura na página) são desse grupo.
    """
    rows = [r for r in book_rows if r['p'] in (334, 335) and 8.5 <= r['s'] <= 9.5]
    groups = []
    for page in (334, 335):
        left = [r for r in rows if r['p'] == page and r['c'] == 0]
        right = [r for r in rows if r['p'] == page and r['c'] == 1]
        starts = sorted({(round(r['y']), _clean(r['t'])) for r in left if r['x'] < 110 and ND.match(_clean(r['t']))})
        for n, (y, nd) in enumerate(starts):
            end = starts[n + 1][0] if n + 1 < len(starts) else 10_000
            group = {'nd': nd, 'money': [], 'items': []}
            for side, cells_rows, key in ((left, None, 'money'), (right, None, 'items')):
                for cells in _lines([r for r in side if y - 1 <= round(r['y']) < end - 1]):
                    texts = [_clean(c['t']) for c in cells]
                    if key == 'money' and texts and ND.match(texts[0]) and cells[0]['x'] < 110:
                        texts = texts[1:]
                    if len(texts) >= 2 and _range(texts[0]):
                        low, high = _range(texts[0])
                        group[key].append({'min': low, 'max': high, 'text': ' '.join(texts[1:])})
            groups.append(group)
    return groups


def parse_riches(book_rows):
    """Tabela 8-2: faixas de d% para riqueza menor, média e maior; valor (dados) e exemplos."""
    rows = _table_rows(book_rows, 'Tabela 8-2: Riquezas', (336,))
    out, current = [], None
    for cells in _lines(rows):
        texts = [_clean(c['t']) for c in cells if _clean(c['t'])]
        if len(texts) >= 4 and all(_range(t) or t == '—' for t in texts[:3]):
            spans = [(_range(t) if t != '—' else None) for t in texts[:3]]
            current = {
                'menor': spans[0], 'media': spans[1], 'maior': spans[2],
                'value': texts[3], 'average': '', 'example': ' '.join(texts[4:]),
            }
            out.append(current)
        elif current is not None and texts:
            for t in texts:
                if re.fullmatch(r'\(\d[\d.]*\)', t):
                    current['average'] = t.strip('()')
                else:
                    current['example'] = (current['example'] + ' ' + t).strip()
    for row in out:
        row['example'] = row['example'].replace('- ', '')
        for key in ('menor', 'media', 'maior'):
            row[key] = {'min': row[key][0], 'max': row[key][1]} if row[key] else None
    return out
