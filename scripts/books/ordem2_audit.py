"""Auditoria do pacote Ordem 2: só métricas, sem texto do livro.

Uso: <venv-com-pymupdf>/python -X utf8 -I scripts/books/ordem2_audit.py "<PDF>" "<pacote.book.json>"
"""
import json
import re
import sys
import unicodedata
from collections import Counter

import pymupdf


def words(text: str) -> list[str]:
    text = unicodedata.normalize('NFC', text.lower())
    return re.findall(r'[a-zà-ÿ0-9]{3,}', text)


pdf_path, pack_path = sys.argv[1], sys.argv[2]
doc = pymupdf.open(pdf_path)
pack = json.load(open(pack_path, encoding='utf-8'))
entries = pack['entries']
assets = {asset['key'] for asset in pack['assets']}

# 1. Cobertura de palavras (PDF inteiro x todo o texto do pacote).
pack_text = ' '.join(json.dumps(e['data'], ensure_ascii=False) + ' ' + e['name'] for e in entries)
pack_words = Counter(words(pack_text))
pdf_words_by_page = {i + 1: words(page.get_text()) for i, page in enumerate(doc)}
total = sum(len(w) for w in pdf_words_by_page.values())
found = 0
missing_pages = []
for number, page_words in pdf_words_by_page.items():
    if not page_words:
        continue
    hit = sum(1 for w in page_words if pack_words[w] > 0)
    found += hit
    ratio = hit / len(page_words)
    if ratio < 0.6:
        missing_pages.append((number, len(page_words), round(ratio, 2)))
print(f'palavras do PDF: {total}; presentes no pacote: {found} ({found / max(total, 1):.1%})')
print('páginas com cobertura < 60% (página, nº palavras, cobertura):', missing_pages)

# 2. Entradas por tipo e problemas.
kinds = Counter(e['kind'] for e in entries)
print('entradas:', dict(kinds))
dupes = [k for k, c in Counter((e['kind'], e['key']) for e in entries).items() if c > 1]
print('chaves repetidas:', dupes)
problems = []
for e in entries:
    d = e['data']
    k = e['kind']
    if k == 'section' and len(d.get('body', '')) < 80:
        problems.append((k, e['key'], 'seção curta', len(d.get('body', ''))))
    if k == 'scene':
        if len(d.get('body', '')) < 200:
            problems.append((k, e['key'], 'roteiro curto', len(d.get('body', ''))))
        if not d.get('readAloud'):
            problems.append((k, e['key'], 'sem narração', 0))
    if k == 'mission' and len(d.get('summary', '')) < 100:
        problems.append((k, e['key'], 'resumo curto', len(d.get('summary', ''))))
    if k == 'point_of_interest':
        if not d.get('rows'):
            problems.append((k, e['key'], 'sem linhas (perícia/DT)', 0))
        if not d.get('mapLabel'):
            problems.append((k, e['key'], 'sem número no mapa', 0))
    if k == 'creature':
        stats = d.get('stats', {})
        empty = [field for field in ('pv', 'hitPoints', 'actions', 'skills', 'attributes') if field in stats and not stats[field]]
        if empty:
            problems.append((k, e['key'], 'ficha incompleta', ','.join(empty)))
        if not d.get('image'):
            problems.append((k, e['key'], 'sem arte', 0))
    image = d.get('image')
    if image and image not in assets:
        problems.append((k, e['key'], 'imagem ausente', image[:12]))
print(f'problemas ({len(problems)}):')
for p in problems:
    print('  ', p)

# 3. Ligações: cenas citam criaturas, mapas e pontos de interesse que existem.
keys = {(e['kind'], e['key']) for e in entries}
broken = []
for e in entries:
    if e['kind'] != 'scene':
        continue
    for field, kind in (('pointsOfInterest', 'point_of_interest'), ('creatures', 'creature'), ('maps', 'map')):
        for ref in e['data'].get(field, []):
            if (kind, ref) not in keys:
                broken.append((e['key'], field, ref))
print('referências quebradas:', broken)
missions = {e['key'] for e in entries if e['kind'] == 'mission'}
orphans = Counter(e['kind'] for e in entries if e['kind'] in ('handout', 'map', 'point_of_interest', 'creature') and e['data'].get('mission') and e['data']['mission'] not in missions)
print('entradas ligadas a missão inexistente:', dict(orphans))
