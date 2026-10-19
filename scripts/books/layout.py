"""Converte um PDF com texto em linhas com estilo (página, coluna, posição, tamanho, fonte), na ordem de leitura."""
import json, pathlib, sys
import pymupdf

src, out = sys.argv[1], pathlib.Path(sys.argv[2])
doc = pymupdf.open(src)
with out.open('w', encoding='utf-8') as f:
    for pno, page in enumerate(doc, 1):
        width = page.rect.width
        rows = []
        for block in page.get_text('dict')['blocks']:
            for line in block.get('lines', []):
                spans = [s for s in line['spans'] if s['text'].strip()]
                if not spans:
                    continue
                text = ''.join(s['text'] for s in line['spans']).strip()
                x0, y0, x1, y1 = line['bbox']
                main = max(spans, key=lambda s: len(s['text']))
                col = 0 if x0 < width / 2 - 10 else 1
                if x0 < width / 2 - 10 and x1 > width / 2 + 40:
                    col = 0  # linha larga (título ou tabela que ocupa as duas colunas)
                rows.append({
                    'p': pno, 'c': col, 'x': round(x0), 'y': round(y0), 'r': round(x1),
                    's': round(main['size'], 1), 'f': main['font'],
                    'b': bool(main['flags'] & 16), 'i': bool(main['flags'] & 2),
                    # trecho inicial em negrito (ex.: "Ataques Múltiplos." no bloco de estatísticas)
                    'lead': spans[0]['text'].strip() if len(spans) > 1 and (spans[0]['flags'] & 16 or spans[0]['font'] != main['font']) else '',
                    't': text,
                })
        rows.sort(key=lambda r: (r['c'], r['y'], r['x']))
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')
print(doc.page_count)
