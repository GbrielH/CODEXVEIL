"""Extrai as raças/espécies de um capítulo de raças (formato do pacote: kind 'species').

Cada espécie começa na linha "Tipo de Criatura" (uma seção pode ter várias, como as quatro
variantes de Genasi). O nome vem do título da seção, de um subtítulo "Traços d… X" entre as
espécies ou, sem nenhum dos dois, de um número ("Genasi (2)") para o arquivo de correções
renomear. Os parágrafos antes dos traços viram o resumo. "Tipo de Criatura", "Tamanho" e
"Deslocamento" alimentam os campos estruturados (deslocamento em pés, como no esquema).
"""
import collections, re

from bookkit import ENTRY_NAME, clean, family, fix_words, join_lines, slug

TITLE_MIN = 13.5
TITLE_TEXT = re.compile(r'^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ’\'\- ]{2,40}$')
TRAITS_HEADING = re.compile(r'^Traços d(?:os|as|o|a|e)\s+(.+)$')
SIZE_KEYS = {'médi': 'medium', 'pequen': 'small'}
CANTRIP = re.compile(r'conhece o truque ([^.,;]+?)(?=[.,;]| e (?:pode|o |a |você))')


def _feet(meters):
    return max(0, min(120, round(meters / 0.3)))


def _paragraphs(rows):
    paras, current, last = [], [], None
    for r in rows:
        if current and (r['lead'] or last is None or r['p'] != last['p'] or r['c'] != last['c']
                        or r['y'] - last['y'] > r['s'] * 1.9 or r['x'] - last['x'] > 4):
            paras.append(join_lines(current)); current = []
        current.append(r['t']); last = r
    if current:
        paras.append(join_lines(current))
    return [p for p in paras if len(p) > 30]


def _species_data(traits, intro):
    summary = re.sub(r'^Traços d(?:os|as|o|a|e)\s+\S+(?:\s+d[oa]s?\s+\S+)?\s+', '', '\n\n'.join(intro[:2]))
    data = {'summary': summary[:2000],'creatureType': '', 'sizes': ['medium'], 'speed': 30,
            'traits': [], 'cantrips': []}
    for trait in traits:
        text = join_lines(trait['lines'])
        key = trait['name'].lower()
        if key.startswith('tipo de criatura'):
            found = re.search(r'Você é (?:um|uma) ([^.]+)', text)
            data['creatureType'] = (found.group(1).strip().capitalize() if found else text)[:60]
            continue
        if key.startswith('tamanho'):
            chosen = {value for stem, value in SIZE_KEYS.items() if stem in text.lower()}
            data['sizes'] = sorted(chosen, key=['small', 'medium'].index) or ['medium']
            continue
        if key.startswith('deslocamento'):
            found = re.search(r'(\d+(?:,\d+)?)\s*m(?:etros)?\b', text)
            if found:
                data['speed'] = _feet(float(found.group(1).replace(',', '.')))
            continue
        data['traits'].append({'level': 1, 'name': trait['name'][:120], 'description': text[:8000]})
        for cantrip in CANTRIP.findall(fix_words(text)):
            cantrip = re.sub(r'\s+e$', '', cantrip.strip())
            if cantrip and len(data['cantrips']) < 6:
                data['cantrips'].append(cantrip.strip()[:120])
    data['traits'] = data['traits'][:40]
    return data


def parse(rows, first_page, last_page, garbled=None):
    garbled = garbled or {}
    texts = [clean(r['t']) for r in rows]
    titles = []
    for i, r in enumerate(rows):
        if first_page <= r['p'] <= last_page and r['s'] >= TITLE_MIN and TITLE_TEXT.match(texts[i]):
            titles.append((i, texts[i].title() if texts[i].isupper() else texts[i]))
    end_of_chapter = next((i for i, r in enumerate(rows) if r['p'] > last_page), len(rows))

    species = []
    for n, (start, title) in enumerate(titles):
        stop = titles[n + 1][0] if n + 1 < len(titles) else end_of_chapter
        seg = range(start + 1, stop)
        fonts = collections.Counter(family(rows[k]['f']) for k in seg if 9.3 <= rows[k]['s'] <= 10.7)
        if not fonts:
            continue
        body = fonts.most_common(1)[0][0]
        in_body = lambda k: (family(rows[k]['f']) == body or rows[k]['i'] or rows[k]['b']) and 9.0 <= rows[k]['s'] <= 10.7
        kinds = [k for k in seg if texts[k].startswith('Tipo de Criatura')]
        headings = {k: TRAITS_HEADING.match(texts[k]).group(1).strip() for k in seg
                    if TRAITS_HEADING.match(texts[k]) and rows[k]['s'] >= 10.3}
        # 1ª passada: traços de cada espécie (as linhas que sobram são texto de apresentação).
        consumed, blocks = set(), []
        for b, kind_row in enumerate(kinds):
            next_kind = kinds[b + 1] if b + 1 < len(kinds) else stop
            next_heading = min([k for k in headings if kind_row < k < next_kind], default=next_kind)
            traits, entry, last, base_x = [], None, None, None

            def close(entry):
                # Texto de apresentação da próxima variante grudado no último traço: a partir do
                # parágrafo que leva a "…você tem os seguintes traços", as linhas voltam a ser livres.
                for p, part in enumerate(entry['parts'][1:], start=1):
                    tail = ' '.join(' '.join(q['lines']) for q in entry['parts'][p:])
                    if 'seguintes traços' in tail:
                        for q in entry['parts'][p:]:
                            consumed.difference_update(q['rows'])
                        entry['parts'] = entry['parts'][:p]
                        break
                entry['lines'] = [line for part in entry['parts'] for line in part['lines']]
                traits.append(entry)

            for k in range(kind_row, min(next_kind, next_heading)):
                r, t = rows[k], texts[k]
                if not t or not in_body(k):
                    continue
                em = ENTRY_NAME.match(t)
                if em and r['lead'] and t.startswith(r['lead'].rstrip('.').split()[0]):
                    if entry:
                        close(entry)
                    entry = {'name': em.group('name').strip(), 'parts': [{'lines': [em.group('rest')], 'rows': [k]}]}
                    last, base_x = r, None
                    consumed.add(k)
                elif entry:
                    same_column = r['p'] == last['p'] and r['c'] == last['c']
                    if same_column and r['y'] - last['y'] > r['s'] * 1.9:
                        close(entry)
                        entry = None  # bloco separado por espaço: fim do traço
                        continue
                    if base_x is not None and r['x'] - base_x > 4 and not r['lead']:
                        entry['parts'].append({'lines': [], 'rows': []})  # novo parágrafo do traço
                    base_x = r['x'] if base_x is None else min(base_x, r['x'])
                    entry['parts'][-1]['lines'].append(t)
                    entry['parts'][-1]['rows'].append(k)
                    consumed.add(k)
                    last = r
            if entry:
                close(entry)
            blocks.append((kind_row, traits))

        # 2ª passada: nome e texto de apresentação de cada espécie.
        intro_start = start + 1
        for b, (kind_row, traits) in enumerate(blocks):
            own_heading = max([k for k in headings if intro_start <= k < kind_row], default=None)
            intro = _paragraphs([rows[k] for k in range(intro_start, kind_row) if k not in consumed and k not in headings
                                 and in_body(k) and not rows[k]['lead'] and family(rows[k]['f']) == body])
            name = title
            if b > 0:
                spoken = next((re.search(r'Como (?:um|uma) ([^,]{3,40}), você tem os seguintes traços', p) for p in intro
                               if 'você tem os seguintes traços' in p), None)
                if own_heading is not None:
                    name = headings[own_heading]
                elif spoken:
                    name = ' '.join(w if w in ('do', 'da', 'de', 'dos', 'das') else w.capitalize() for w in spoken.group(1).split())
                else:
                    name = f'{title} ({b + 1})'
            elif len(blocks) > 1:
                spoken = next((re.search(r'Como (?:um|uma) ([^,]{3,40}), você tem os seguintes traços', p) for p in intro
                               if 'você tem os seguintes traços' in p), None)
                if spoken:
                    name = ' '.join(w if w in ('do', 'da', 'de', 'dos', 'das') else w.capitalize() for w in spoken.group(1).split())
            intro = [p for p in intro if 'você tem os seguintes traços' not in p] or intro
            data = _species_data(traits, intro)
            if not data['summary'] and species:
                data['summary'] = species[-1]['data']['summary']
            species.append({'kind': 'species', 'key': slug(name), 'name': name[:200], 'data': data,
                            '_rows': set(range(intro_start - (1 if b == 0 else 0), kind_row)) | {k for k in consumed}})
            intro_start = kind_row + 1
    return species
