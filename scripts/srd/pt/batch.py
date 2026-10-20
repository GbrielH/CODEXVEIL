"""Ferramenta de trabalho da tradução: mostra um lote de frases pendentes ou mescla um lote traduzido.

  python scripts/srd/pt/batch.py show monster 0 80      # frases pendentes 0..79 (numeradas)
  python scripts/srd/pt/batch.py merge monster lote.txt # lote: "número<TAB>tradução" por linha
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def main() -> None:
    action, kind = sys.argv[1], sys.argv[2]
    missing = list(json.loads((HERE / f'missing-{kind}-sentences.json').read_text(encoding='utf8')).keys())
    if action == 'show':
        start, count = int(sys.argv[3]), int(sys.argv[4])
        for index in range(start, min(len(missing), start + count)):
            print(f'{index}\t{missing[index]}')
        return
    # Merge: "merge <tipo> <lote traduzido> <lista mostrada>" usa a lista exata que foi traduzida.
    if len(sys.argv) > 4:
        shown = {}
        for line in Path(sys.argv[4]).read_text(encoding='utf8').splitlines():
            if '	' in line:
                number, key = line.split('	', 1)
                shown[int(number)] = key
        missing = [shown.get(index, '') for index in range(max(shown) + 1)] if shown else missing
    target = HERE / f'{kind}-sentences.json'
    done = json.loads(target.read_text(encoding='utf8')) if target.exists() else {}
    added = 0
    for line in Path(sys.argv[3]).read_text(encoding='utf8').splitlines():
        if '\t' not in line:
            continue
        number, text = line.split('\t', 1)
        done[missing[int(number)]] = text.strip()
        added += 1
    target.write_text(json.dumps(done, ensure_ascii=False, indent=0), encoding='utf8')
    print(f'{added} frases mescladas; total {len(done)}')


if __name__ == '__main__':
    main()
