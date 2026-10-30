"""Monta o pacote `codexveil.assimilacao.book` a partir da extração do `assimilacao.py`.

Uso: python -X utf8 scripts/books/assimilacao_pack.py <saída/assimilacao.json> <saída/assimilacao-rpg.book.json>

O pacote fica FORA do Git (conteúdo do exemplar do usuário) e é importado em "Meus livros".
"""
import json, sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from bookkit import slug  # noqa: E402


def entry(kind, name, data, key=None):
    return {'kind': kind, 'key': (key or slug(name))[:80], 'name': name[:200], 'data': data}


def unique(entries):
    """Chaves repetidas (seções com o mesmo título) ganham o número da página."""
    seen = {}
    for item in entries:
        base = (item['kind'], item['key'])
        if base in seen:
            item['key'] = f"{item['key'][:72]}-p{item['data'].get('page', len(seen))}"
            while (item['kind'], item['key']) in seen:
                item['key'] += 'x'
        seen[(item['kind'], item['key'])] = True
    return entries


def main():
    src, dest = sys.argv[1], sys.argv[2]
    data = json.load(open(src, encoding='utf-8'))
    entries = []
    for order, section in enumerate(data['sections']):
        entries.append(entry('section', section['name'], {
            'chapter': section['chapter'], 'order': order, 'page': max(0, section['page']), 'body': section['text'][:60000],
        }))
    for item in data['characteristics']:
        entries.append(entry('characteristic', item['name'], {
            'cost': item['cost'], 'requirement': item['requirement'], 'text': item['text'], 'page': item['page'],
        }))
    for card in data['assimilations']:
        entries.append(entry('assimilation', card['name'], {
            'kind': card['kind'], 'rank': card['rank'], 'suit': card['suit'], 'text': card['text'], 'page': card['page'],
            'levels': [{'cost': level['cost'], 'name': level['name'], 'requirement': level['requirement'], 'text': level['text']} for level in card['levels']],
        }))
    for item in data['artifacts']:
        entries.append(entry('artifact', item['name'], {'scarcity': item['scarcity'], 'text': item['text'], 'page': item['page']}))
    for card in data['events']:
        entries.append(entry('event', card['name'], {
            'category': card['category'], 'rank': card['rank'], 'suit': card['suit'], 'text': card['text'], 'page': card['page'],
        }))
    pack = {
        'format': 'codexveil.assimilacao.book',
        'version': 1,
        'book': {
            'id': 'assimilacao-rpg',
            'name': 'Assimilação RPG — Livro de Regras',
            'category': 'core',
            'edition': 'Livro de Regras',
            'origin': 'Exemplar do usuário (PDF)',
        },
        'entries': unique(entries),
    }
    with open(dest, 'w', encoding='utf-8') as f:
        json.dump(pack, f, ensure_ascii=False)
    print(len(pack['entries']), 'entradas')


if __name__ == '__main__':
    main()
