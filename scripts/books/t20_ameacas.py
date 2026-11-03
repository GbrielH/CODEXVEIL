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


def anchored_titles(book):
    """Cada ficha começa pela linha de tipo em itálico ("Humanoide (humano) Médio") seguida de
    "Iniciativa". O nome são as linhas de título logo acima (sem o "ND"); o ND, se houver, também."""
    out, nds = [], {}
    rows, texts = book.rows, book.texts
    for k, r in enumerate(rows):
        if not (r['f'].startswith('SourceSansPro-It') and texts[k]):
            continue
        # "Iniciativa" logo depois (às vezes o tipo quebra em duas linhas).
        if not any(texts[j].startswith('Iniciativa') for j in range(k + 1, min(k + 4, len(rows)))):
            continue
        # Tipo em duas linhas itálicas: a ficha começa na primeira.
        if out and out[-1][0] >= k - 3:
            continue
        # O nome pode ficar no fim da página anterior; títulos de ficha têm 13 a 17 pontos, e os
        # gigantes (dragões-reis, arquilich) só valem quando não há outro.
        near = [j for j in range(max(0, k - 8), k) if rows[j]['f'].startswith(TITLE) and texts[j] and rows[j]['p'] >= r['p'] - 1
                and not re.fullmatch(r'\d+', texts[j])]
        heads = [j for j in near if 12.5 <= rows[j]['s'] <= 17.5] or [j for j in near if rows[j]['s'] >= 12.5]
        nd = next((re.search(r'ND\s*(\S+)', texts[j]).group(1) for j in reversed(near) if re.search(r'^ND\s*\S+', texts[j])), '')
        names = [j for j in heads if not re.match(r'^ND\s', texts[j], re.I)]
        if not names:
            # Título gigante bem acima na página (Arquilich Ferren Asloth): os maiores da página.
            page = [j for j in range(max(0, k - 400), k) if rows[j]['p'] == r['p'] and rows[j]['f'].startswith(TITLE)
                    and rows[j]['s'] >= 30 and texts[j]]
            names = page
        if not names:
            continue
        if not nd:
            # ND alinhado à direita, na mesma altura do nome (o PDF o põe na outra coluna).
            y = rows[names[-1]]['y']
            nd = next((re.search(r'ND\s*(\S+)', texts[j]).group(1) for j in range(max(0, k - 300), min(len(rows), k + 300))
                       if rows[j]['p'] == r['p'] and rows[j]['f'].startswith(TITLE) and re.match(r'^ND\s*\S+', texts[j])
                       and abs(rows[j]['y'] - y) <= 22), '')
        # Último grupo de linhas de nome consecutivas com o mesmo tamanho.
        group = [names[-1]]
        for j in reversed(names[:-1]):
            if (rows[j]['s'] == rows[group[0]]['s'] or rows[j]['s'] >= 30) and group[0] - j <= 2:
                group.insert(0, j)
            else:
                break
        name = re.sub(r'\s*ND\s*[\d/]+\s*$', '', ' '.join(texts[j] for j in group)).strip()
        name = re.sub(r',(?=\S)', ', ', name)
        out.append((k - 1, name, group[0]))
        nds[group[0]] = nd
    return out, nds


def main():
    rows = [json.loads(line) for line in open(sys.argv[1], encoding='utf-8')]
    book = Book(rows)
    last_page = max(r['p'] for r in rows)
    titles, nds = anchored_titles(book)
    found = threats(book, first_page=1, last_page=last_page, titles=titles)
    for t in found:
        t['nd'] = nds.get(t['_first'], '') or t['nd']
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
