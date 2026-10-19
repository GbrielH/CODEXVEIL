"""Raças do Livro do Jogador 2014 (OCR, sem fonte): kind 'species' com as sub-raças em `lineage`.

Cada raça começa em "TRAÇOS RACIAIS DOS <RAÇA>"; os traços são parágrafos recuados "Nome. texto";
um título em caixa alta com "Aumento no Valor de Habilidade" logo abaixo abre uma sub-raça.
"""
import re

from bookkit import clean, fix_words, join_lines, slug
from species import CANTRIP

RACE_HEADING = re.compile(r'^TRA\S*OS RACIAIS D[OA]S\s+(.+)$')
ENTRY = re.compile(r'^([A-ZÀ-Ý][^.,"“”]{2,45})\.\s+(.*)$')
SINGULAR = {'ANÕES': 'Anão', 'ELFOS': 'Elfo', 'HALFLINGS': 'Halfling', 'HUMANOS': 'Humano', 'DRACONATOS': 'Draconato',
            'GNOMOS': 'Gnomo', 'MEIO-ELFOS': 'Meio-Elfo', 'MEIO-ORCS': 'Meio-Orc', 'TIEFLINGS': 'Tiefling'}
SKIP_TRAITS = ('idade', 'tendência', 'tamanho', 'deslocamento', 'sub-raça', 'sub-raças')


def _upper(t):
    letters = [ch for ch in t if ch.isalpha()]
    return len(letters) >= 4 and sum(ch.isupper() for ch in letters) >= 0.8 * len(letters) and not t.endswith('.')


def _feet(text):
    found = re.search(r'(\d+(?:,\d+)?)\s*metros', text)
    return max(0, min(120, round(float(found.group(1).replace(',', '.')) / 0.3))) if found else None


def _title(t):
    small = ('da', 'de', 'do', 'das', 'dos', 'e')
    return ' '.join(w if w in small else w.capitalize() for w in t.lower().split())


def parse(rows, first_page, last_page):
    texts = [clean(r['t']) for r in rows]
    heads = [i for i, t in enumerate(texts) if first_page <= rows[i]['p'] <= last_page and RACE_HEADING.match(t)]
    end_all = next((i for i, r in enumerate(rows) if r['p'] > last_page), len(rows))
    # Margem esquerda de cada coluna (o traço começa recuado em relação a ela).
    margin = {}
    for r in rows:
        key = (r['p'], r['c'])
        margin[key] = min(margin.get(key, 10 ** 6), r['x'])
    entries = []
    for n, h in enumerate(heads):
        plural = RACE_HEADING.match(texts[h]).group(1).strip()
        name = SINGULAR.get(plural, _title(plural))
        stop = heads[n + 1] if n + 1 < len(heads) else end_all
        groups = [{'name': None, 'entries': [], 'intro': []}]  # 0 = traços da raça
        target, entry, previous, heading = groups[0], None, '', None
        for k in range(h + 1, stop):
            t, r = texts[k], rows[k]
            if not t or re.fullmatch(r'[\d\W]{1,4}', t):
                continue
            if _upper(t) and len(t) < 40:
                heading, entry, previous = _title(t), None, ''
                if target is not groups[0]:
                    target = None  # quadro lateral depois de uma sub-raça: ignora até a próxima
                continue
            m = ENTRY.match(t)
            starts = r['x'] - margin[(r['p'], r['c'])] > 25 or previous.endswith(('.', ':')) or not previous
            if m and starts and len(m.group(1).split()) <= 6:
                if m.group(1).startswith('Aumento no Valor') and groups[0]['entries'] and (target is not groups[0] or len(groups[0]['entries']) > 1):
                    target = {'name': heading or f'{name} ({len(groups)})', 'entries': [], 'intro': []}
                    groups.append(target)
                entry = {'name': m.group(1).strip(), 'lines': [m.group(2)]}
                if target is not None:
                    target['entries'].append(entry)
            elif entry:
                entry['lines'].append(t)
            elif target is not None:
                target['intro'].append(t)
            previous = t
        race, subs = groups[0], [g for g in groups[1:] if g['name'] and g['entries']]
        traits, sizes, speed, cantrips = [], ['medium'], 30, []
        for e in race['entries']:
            text = fix_words(join_lines(e['lines']))
            key = e['name'].lower()
            if key.startswith('tamanho'):
                sizes = ['small'] if 'pequeno' in text.lower() else ['medium']
            if key.startswith('deslocamento'):
                speed = _feet(text) or 30
            if key.startswith(SKIP_TRAITS):
                continue
            traits.append({'level': 1, 'name': e['name'][:120], 'description': text[:8000]})
            cantrips += [c.strip() for c in CANTRIP.findall(text)][:6 - len(cantrips)]
        # Resumo: o capítulo abre com um conto; a descrição da raça vem depois do primeiro subtítulo
        # ("BAIXOS E ROBUSTOS", "UMA BELEZA ETÉREA"…).
        start = max((k for k in range(heads[n - 1] if n else 0, h) if texts[k].upper() == name.upper()), default=h - 30)
        first = next((k for k in range(start + 1, h) if _upper(texts[k]) and 3 < len(texts[k]) < 40), start)
        lines = []
        for k in range(first + 1, h):
            if _upper(texts[k]) and lines:
                break
            if texts[k] and not _upper(texts[k]):
                lines.append(texts[k])
        summary = join_lines(lines[:14])
        data = {'summary': fix_words(summary)[:2000] or fix_words(join_lines(race['intro']))[:2000], 'creatureType': 'Humanoide',
                'sizes': sizes, 'speed': speed, 'traits': traits[:40], 'cantrips': cantrips}
        options = []
        for g in subs:
            desc = '\n\n'.join(fix_words(f"{e['name']}. {join_lines(e['lines'])}") for e in g['entries'])
            option = {'id': slug(g['name'])[:80], 'name': g['name'][:120], 'description': desc[:4000]}
            for e in g['entries']:
                if e['name'].lower().startswith('pés ligeiros') or 'deslocamento base' in ' '.join(e['lines']):
                    option['speed'] = _feet(' '.join(e['lines'])) or speed
            options.append(option)
        if options and all('alternativ' in o['id'] for o in options):
            # Humano: a variante é opcional; o humano padrão continua disponível.
            options[0]['name'], options[0]['id'] = 'Humano variante', 'humano-variante'
            options.insert(0, {'id': 'humano-padrao', 'name': 'Humano padrão',
                               'description': '\n\n'.join(t['description'] for t in traits[:1])})
        if options:
            data['lineage'] = {'label': 'Sub-raça', 'options': options[:20]}
        entries.append({'kind': 'species', 'key': slug(name), 'name': name, 'data': data})
    return entries
