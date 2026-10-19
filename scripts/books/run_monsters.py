"""Extrai os monstros dos livros de criaturas e mostra quais blocos ficaram incompletos.

Uso: python -X utf8 scripts/books/run_monsters.py <pasta com os .jsonl do layout> <pasta de saída> [pasta dos PDFs]

Com a pasta dos PDFs, tabelas de atributos incompletas no texto do PDF são lidas por OCR.
"""
import collections, json, pathlib, sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import bookkit, monsters  # noqa: E402

# Correções conferidas à mão contra o livro (dados do livro: o arquivo fica FORA do Git,
# em <saída>/correcoes.json). Formato: {livro: {nome extraído: {campo: valor, "_drop": true}}};
# "abilities" aceita a lista [FOR, DES, CON, INT, SAB, CAR].
def load_corrections(out_dir):
    path = out_dir / 'correcoes.json'
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}


def apply_corrections(ms, fixes):
    for name in sorted(set(fixes) - {m['name'] for m in ms}):
        print('  correção sem bloco correspondente:', name)
    count = 0
    for m in ms:
        fix = fixes.get(m['name'])
        if not fix:
            continue
        for key, value in fix.items():
            if key == 'abilities' and isinstance(value, list):
                value = dict(zip(monsters.ABILS, value))
            m[key] = value
        count += 1
    return count


# Livro → corrigir o sinal "+" que o PDF do Monstros do Multiverso trocou por "4-".
BOOKS = {'MANUAL DE MONSTROS': False, 'MONSTROS DO MULTIVERSO': True}


def extract(book, rows, out_dir, pdf_dir=None):
    """Monstros do livro com OCR (opcional) e correções aplicadas; mantém m['_rows']."""
    ms = monsters.parse(rows, BOOKS[book])
    if pdf_dir and (pdf_dir / f'{book}.pdf').exists():
        import ocr_abilities
        print(book, 'atributos completados por OCR:', ocr_abilities.complete(ms, rows, pdf_dir / f'{book}.pdf'))
    applied = apply_corrections(ms, load_corrections(out_dir).get(book, {}))
    if applied:
        print(book, 'correções manuais aplicadas:', applied)
    return [m for m in ms if not m.get('_drop')]


if __name__ == '__main__':
    layout_dir, out_dir = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
    pdf_dir = pathlib.Path(sys.argv[3]) if len(sys.argv) > 3 else None
    out_dir.mkdir(parents=True, exist_ok=True)
    for book in BOOKS:
        source = layout_dir / f'{book}.jsonl'
        if not source.exists():
            print('faltando', source)
            continue
        ms = extract(book, bookkit.load(source), out_dir, pdf_dir)
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
