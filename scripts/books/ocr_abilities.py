"""Completa, por OCR, a tabela de atributos de blocos cujo texto do PDF está incompleto.

Alguns PDFs (ex.: Monstros do Multiverso) trazem só parte dos valores FOR…CAR na camada de
texto. Aqui a faixa da tabela é recortada da página, lida pelo OCR do Windows (ocr.ps1) e cada
coluna recebe o valor mais próximo abaixo do seu cabeçalho — do OCR ou, na falta, do texto do PDF.
"""
import json, pathlib, re, subprocess, tempfile

import pymupdf

from bookkit import clean
from monsters import ABILS, HEADER

SCRIPT = pathlib.Path(__file__).with_name('ocr.ps1')
DPI = 400
SCALE = 72 / DPI
NAMES = ['FOR', 'DES', 'CON', 'INT', 'SAB', 'CAR']
LEADING = re.compile(r'^\s*(\d{1,2})\b')


def _header_row(rows, indices):
    for k in sorted(indices):
        if HEADER.match(clean(rows[k]['t'])):
            return rows[k]
    return None


def _pdf_cells(rows, header):
    """Valores que existem no texto do PDF: (centro x em pontos, valor)."""
    cells = []
    for r in rows:
        if r['p'] != header['p'] or r['c'] != header['c'] or not (header['y'] + 4 <= r['y'] <= header['y'] + 22):
            continue
        for match in re.finditer(r'(\d{1,2})\s*[\(\[{]', r['t']):
            cells.append((r['x'] + 12 + match.start() * 3, int(match.group(1))))
    return cells


HEADER_FIX = {'OES': 'DES', 'D ES': 'DES', 'COM': 'CON', 'SAR': 'SAB', 'CAP': 'CAR'}


def _parse(ocr_lines, left):
    """Cabeçalhos (centro x em pontos) e valores lidos pelo OCR."""
    headers, values = {}, []
    for line in ocr_lines:
        text = line['t'].strip().upper().replace('0', 'O')
        text = HEADER_FIX.get(text, text)
        center = left + (line['x'] + line['r']) / 2 * SCALE
        if text in NAMES:
            headers[text] = center
        else:
            found = LEADING.match(line['t'].replace('O', '0').replace('o', '0'))
            if found:
                values.append((center, int(found.group(1))))
    return headers, values


def _column_centers(headers, left, width):
    """Centros das 6 colunas: os lidos pelo OCR ou, faltando, colunas de largura igual."""
    if len(headers) >= 2:
        known = sorted((NAMES.index(n), x) for n, x in headers.items())
        (i0, x0), (i1, x1) = known[0], known[-1]
        step = (x1 - x0) / (i1 - i0) if i1 != i0 else width / 6
        return {n: headers.get(n, x0 + (NAMES.index(n) - i0) * step) for n in NAMES}
    return {n: left + width / 12 + i * width / 6 for i, n in enumerate(NAMES)}


def _resolve(columns, values, pdf_cells):
    result, missing = {}, []
    for name, ability in zip(NAMES, ABILS):
        x = columns[name]
        near = [(abs(cx - x), v) for cx, v in values if abs(cx - x) < 22]
        near = near or [(abs(cx - x), v) for cx, v in pdf_cells if abs(cx - x) < 26]
        value = min(near)[1] if near else None
        if value is None or not 1 <= value <= 30:
            missing.append(name)
        else:
            result[ability] = value
    return result, missing


def _ocr(images, outputs):
    subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', str(SCRIPT),
                    str(images), str(outputs)], check=True, capture_output=True)


def complete(monsters, rows, pdf_path):
    """Preenche `abilities` dos monstros com menos de 6 valores. Devolve quantos foram corrigidos."""
    pending = [(m, _header_row(rows, m['_rows'])) for m in monsters if len(m['abilities']) < 6]
    pending = [(m, h) for m, h in pending if h]
    if not pending:
        return 0
    doc = pymupdf.open(pdf_path)
    fixed = 0
    with tempfile.TemporaryDirectory() as tmp:
        images, outputs = pathlib.Path(tmp, 'img'), pathlib.Path(tmp, 'ocr')
        images.mkdir()
        lefts = []
        for n, (m, h) in enumerate(pending):
            page = doc[h['p'] - 1]
            half = page.rect.width / 2
            left = (0 if h['c'] == 0 else half) + 4
            lefts.append(left)
            clip = pymupdf.Rect(left, h['y'] - 3, left + half - 8, h['y'] + 26)
            page.get_pixmap(dpi=DPI, clip=clip).save(images / f'p{n:04d}.png')
        _ocr(images, outputs)

        # 1ª passada: a faixa inteira. 2ª passada: cada célula que faltou, isolada e ampliada.
        partial, cells = {}, []
        for n, (m, h) in enumerate(pending):
            out = outputs / f'p{n:04d}.json'
            lines = json.loads(out.read_text(encoding='utf-8-sig'))['lines'] if out.exists() else []
            page = doc[h['p'] - 1]
            half = page.rect.width / 2
            headers, values = _parse(lines, lefts[n])
            columns = _column_centers(headers, lefts[n], half - 8)
            result, missing = _resolve(columns, values, _pdf_cells(rows, h))
            partial[n] = result
            for name in missing:
                x = columns[name]
                clip = pymupdf.Rect(x - 20, h['y'] + 7, x + 20, h['y'] + 22)
                cells.append((n, name, page.get_pixmap(dpi=600, clip=clip)))

        cell_images, cell_outputs = pathlib.Path(tmp, 'cells'), pathlib.Path(tmp, 'cells-ocr')
        cell_images.mkdir()
        for c, (_, _, pix) in enumerate(cells):
            pix.save(cell_images / f'p{c:04d}.png')
        if cells:
            _ocr(cell_images, cell_outputs)
        for c, (n, name, _) in enumerate(cells):
            out = cell_outputs / f'p{c:04d}.json'
            if not out.exists():
                continue
            text = ' '.join(line['t'] for line in json.loads(out.read_text(encoding='utf-8-sig'))['lines'])
            found = LEADING.match(text.replace('O', '0').replace('o', '0').replace('l', '1').replace('I', '1'))
            if found and 1 <= int(found.group(1)) <= 30:
                partial[n][ABILS[NAMES.index(name)]] = int(found.group(1))

        for n, (m, h) in enumerate(pending):
            if len(partial[n]) == 6:
                m['abilities'] = {ability: partial[n][ability] for ability in ABILS}
                fixed += 1
            else:
                print('  sem leitura completa:', m['name'], partial[n])
    return fixed
