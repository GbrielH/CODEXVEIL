"""Aplica a correção de OCR (`ocr_fix.fix_text`) num pacote de livro já gerado, sem refazer o OCR.

Uso: python -X utf8 scripts/books/ocr_fix_pack.py <pasta-layout> <pacote.book.json> [saída.book.json]

Só os textos (nomes e campos de texto das entradas) mudam; chaves, números e a estrutura ficam
iguais. Sem saída, grava por cima e deixa uma cópia `.bak` do original.
"""
import json, pathlib, shutil, sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import ocr_fix  # noqa: E402

CLEAN = ('T20.jsonl', 'CALDEIRÃO DE TASHA.jsonl', 'LIVRO DE MAGIAS.jsonl', 'MANUAL DE MONSTROS.jsonl', 'MONSTROS DO MULTIVERSO.jsonl')


def fix_value(value, vocab, stats):
    if isinstance(value, str):
        fixed = ocr_fix.fix_text(value, vocab)
        if fixed != value:
            stats['changed'] += 1
        return fixed
    if isinstance(value, list):
        return [fix_value(item, vocab, stats) for item in value]
    if isinstance(value, dict):
        # Chaves e identificadores não são texto de leitura.
        return {key: item if key in ('key', 'id', 'kind', 'source') else fix_value(item, vocab, stats) for key, item in value.items()}
    return value


def main():
    layout, src = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
    dest = pathlib.Path(sys.argv[3]) if len(sys.argv) > 3 else src
    vocab = ocr_fix.build_vocabulary([layout / name for name in CLEAN])
    pack = json.load(src.open(encoding='utf-8'))
    stats = {'changed': 0}
    for entry in pack['entries']:
        entry['name'] = ocr_fix.fix_text(entry['name'], vocab)
        entry['data'] = fix_value(entry['data'], vocab, stats)
    if dest == src:
        shutil.copyfile(src, src.with_suffix('.json.bak'))
    with dest.open('w', encoding='utf-8') as f:
        json.dump(pack, f, ensure_ascii=False)
    print(f'{src.name}: {stats["changed"]} textos alterados')


if __name__ == '__main__':
    main()
