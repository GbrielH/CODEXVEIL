"""Monta o pacote (codexveil.dnd5e.book) do Manual de Monstros e do Monstros do Multiverso.

Uso: python -X utf8 scripts/books/build_pack.py <pasta com os .jsonl do layout> <pasta de saída> [pasta dos PDFs]

Gera <saída>/<id>.book.json com monstros, raças (Multiverso) e o texto corrido do livro.
"""
import collections, json, pathlib, sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import bookkit, monsters, sections, species  # noqa: E402
from run_monsters import extract  # noqa: E402

ORIGIN = 'PDF do exemplar do usuário (uso pessoal, não distribuir)'
PACKS = {
    'MANUAL DE MONSTROS': {'id': 'mm-2014', 'name': 'Manual dos Monstros', 'category': 'core', 'species': None},
    'MONSTROS DO MULTIVERSO': {'id': 'mpmm', 'name': 'Monstros do Multiverso', 'category': 'monsters', 'species': (7, 37)},
}


def classifier(rows):
    """Títulos pelo tamanho; texto só na fonte do corpo (tabelas e blocos em outra fonte ficam de fora)."""
    body = collections.Counter(bookkit.family(r['f']) for r in rows if 9.5 <= r['s'] <= 10.6).most_common(1)[0][0]

    def classify(r, t):
        if r['s'] >= 17:
            return 1
        if r['s'] >= 12.5 and len(t) > 2:
            return 2
        if r['s'] >= 10.8 and len(t) > 2 and (r['b'] or bookkit.family(r['f']) != body):
            return 3
        if bookkit.family(r['f']) == body and 9.0 <= r['s'] <= 10.7:
            return 0
        return -1
    return classify


def build(book, rows, out_dir, pdf_dir):
    info = PACKS[book]
    ms = extract(book, rows, out_dir, pdf_dir)
    used = set().union(*(m['_rows'] for m in ms))
    entries = monsters.to_entries(ms)
    if info['species']:
        sp = species.parse(rows, *info['species'])
        for s in sp:
            used |= s.pop('_rows')
        entries += sp
    # As páginas iniciais (créditos e sumário) ficam de fora do texto.
    toc_end = 6
    entries += sections.build(rows, classifier(rows), exclude=frozenset(used), skip=lambda r, t: r['p'] <= toc_end)
    pack = {'format': 'codexveil.dnd5e.book', 'version': 1,
            'book': {'id': info['id'], 'name': info['name'], 'category': info['category'], 'edition': '2014', 'origin': ORIGIN},
            'entries': entries}
    path = out_dir / f"{info['id']}.book.json"
    path.write_text(json.dumps(pack, ensure_ascii=False), encoding='utf-8')
    print(book, '→', path.name, dict(collections.Counter(e['kind'] for e in entries)))


if __name__ == '__main__':
    layout_dir, out_dir = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
    pdf_dir = pathlib.Path(sys.argv[3]) if len(sys.argv) > 3 else None
    for book in PACKS:
        build(book, bookkit.load(layout_dir / f'{book}.jsonl'), out_dir, pdf_dir)
