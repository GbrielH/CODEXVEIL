"""Extrai os monstros dos livros de criaturas e mostra quais blocos ficaram incompletos.

Uso: python -X utf8 scripts/books/run_monsters.py <pasta com os .jsonl do layout> <pasta de saída>
"""
import collections, json, pathlib, sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import bookkit, monsters  # noqa: E402

layout_dir, out_dir = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
out_dir.mkdir(parents=True, exist_ok=True)
# Livro → corrigir o sinal "+" que o PDF do Monstros do Multiverso trocou por "4-".
BOOKS = {'MANUAL DE MONSTROS': False, 'MONSTROS DO MULTIVERSO': True}
for book, signs in BOOKS.items():
    source = layout_dir / f'{book}.jsonl'
    if not source.exists():
        print('faltando', source)
        continue
    ms = monsters.parse(bookkit.load(source), signs)
    why = collections.Counter()
    bad = []
    for m in ms:
        missing = [k for k, ok in (('abil', len(m['abilities']) == 6), ('cr', bool(m['cr'])), ('act', bool(m['actions']))) if not ok]
        if missing:
            bad.append((m['name'], missing))
            why.update(missing)
    print(book, len(ms), 'incompletos', len(bad), dict(why))
    print(bad[:40])
    for m in ms:
        m.pop('_rows', None)
    (out_dir / f'{book}.monsters.json').write_text(json.dumps(ms, ensure_ascii=False, indent=1), encoding='utf-8')
