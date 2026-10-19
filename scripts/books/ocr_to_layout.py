"""Converte o OCR por página (JSON do ocr.ps1) nas linhas do layout.py (sem fonte; tamanho = altura da linha)."""
import json, pathlib, sys
src, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
with out.open('w', encoding='utf-8') as f:
    for path in sorted(src.glob('p*.json')):
        pno = int(path.stem[1:])
        data = json.loads(path.read_text(encoding='utf-8-sig'))
        width = data.get('w') or 1654
        rows = []
        for l in data.get('lines') or []:
            col = 0 if l['x'] < width / 2 - 20 else 1
            rows.append({'p': pno, 'c': col, 'x': l['x'], 'y': l['y'], 'r': l['r'], 's': l['h'], 'f': 'ocr', 'b': False, 'i': False, 'lead': '', 't': l['t'].strip()})
        rows.sort(key=lambda r: (r['c'], r['y'], r['x']))
        for r in rows: f.write(json.dumps(r, ensure_ascii=False) + '\n')
