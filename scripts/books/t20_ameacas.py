"""Ameaças de Arton (Tormenta20) a partir das linhas do layout.py.

Uso: python -X utf8 scripts/books/t20_ameacas.py <layout/AMEACAS.jsonl> <saída.book.json>

As fichas seguem o modelo do livro básico (nome em `Tormenta20-Regular` 16 ou 21, "ND x" em 14,4,
bloco em SourceSansPro). A descrição de cada ameaça é o texto corrido entre o título da criatura
(21 ou 27) e a ficha. O pacote usa o id `t20-ameacas`.
"""
import collections
import re
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from bookkit import slug  # noqa: E402
from t20 import TITLE, Book, threats  # noqa: E402
from t20_pack import threat  # noqa: E402


def descriptions(book, found):
    """Texto corrido antes de cada ficha: do título grande mais próximo até o nome da ameaça."""
    titles = [k for k, r in enumerate(book.rows) if r['f'].startswith(TITLE) and r['s'] >= 21 and book.texts[k]]
    out = {}
    for t in found:
        first = t['_first']
        before = [k for k in titles if k < first]
        if not before:
            continue
        paragraphs = book.paragraphs(before[-1] + 1, first)
        out[t['name']] = paragraphs
    return out


def main():
    rows = [json.loads(line) for line in open(sys.argv[1], encoding='utf-8')]
    book = Book(rows)
    last_page = max(r['p'] for r in rows)
    found = threats(book, first_page=1, last_page=last_page, nd_sizes=(14.4, 16.0, 11.0))
    texts = descriptions(book, found)
    entries = []
    for t in found:
        t['summary'] = texts.get(t['name']) or t['summary']
        # "Tesouro Nenhum." encosta nos quadros de armadilha da página: fica só a primeira frase.
        if t.get('tesouro'):
            t['tesouro'] = re.split(r'(?<=\.)\s', t['tesouro'], maxsplit=1)[0]
        if not t['hp'] and not t['defense'] and not t['abilities']:
            continue
        entries.append(threat(t))
    seen = {}
    for e in entries:
        base = e['key']
        n = seen.get(base, 0)
        if n:
            e['key'] = f'{base[:76]}-{n + 1}'
        seen[base] = n + 1
    pack = {'format': 'codexveil.tormenta20.book', 'version': 1,
            'book': {'id': 't20-ameacas', 'name': 'Ameaças de Arton', 'category': 'monsters', 'edition': 'Tormenta20',
                     'origin': 'PDF do exemplar do usuário (uso pessoal, não distribuir)'},
            'entries': entries}
    pathlib.Path(sys.argv[2]).write_text(json.dumps(pack, ensure_ascii=False), encoding='utf-8')
    print(sys.argv[2], dict(collections.Counter(e['kind'] for e in entries)))


if __name__ == '__main__':
    main()
