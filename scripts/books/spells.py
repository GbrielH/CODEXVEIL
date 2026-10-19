"""Extrai as magias de um compêndio (formato do pacote: kind 'spell').

Cada magia: nome (título grande), "(Nome em Inglês)", linha de nível e escola ("2º Nível de
Transmutação (Ritual)" ou "Truque de Evocação") e os campos "Conjuradores:", "Tempo de
Conjuração:", "Alcance:", "Componentes:", "Duração:"; o texto vai até "Fonte:".
"""
import re

from bookkit import clean, fix_words, join_lines, slug

SCHOOLS = {'abjura': 'abjuration', 'conjura': 'conjuration', 'adivinha': 'divination', 'encanta': 'enchantment',
           'evoca': 'evocation', 'invoca': 'conjuration', 'ilus': 'illusion', 'necroman': 'necromancy', 'transmuta': 'transmutation'}
CLASSES = {'artífice': 'artificer', 'bardo': 'bard', 'bruxo': 'warlock', 'clérigo': 'cleric', 'druida': 'druid',
           'feiticeiro': 'sorcerer', 'mago': 'wizard', 'paladino': 'paladin', 'patrulheiro': 'ranger', 'guardião': 'ranger', 'ranger': 'ranger'}
LEVEL = re.compile(r'^(?:(\d)\s*[º°o]?\s*(?:n[íi]vel de|c[íi]rculo,)|truque(?: de|,))\s+([A-Za-zÀ-ÿ]+)(.*)$', re.I)
# Variante "Evocação, truque" (Xanathar).
LEVEL_SCHOOL_FIRST = re.compile(r'^([A-Za-zÀ-ÿ]+),?\s+(?:de\s+)?(truque|(\d)\s*[º°o]?\s*(?:nível|c[íi]rculo))(.*)$', re.I)
FIELDS = {'tempo': 'castingTime', 'alc': 'range', 'comp': 'components', 'dur': 'duration', 'c': 'classes'}
FIELD_RE = re.compile(r'^(Conjuradores|C(?= [a-zà-ÿ])|Tempo de (?:Conjuração|lançamento)|Alcance|Componentes|Duração)(?::|(?<=^C)(?= ))\s*', re.I)
TITLE_MIN = 13.0


def _paragraphs(rows):
    paras, current, last = [], [], None
    for r in rows:
        if current and (r['lead'] or r['p'] == last['p'] and r['c'] == last['c'] and
                        (r['y'] - last['y'] > r['s'] * 1.9 or r['x'] - last['x'] > 4)):
            paras.append(join_lines(current)); current = []
        current.append(r['t']); last = r
    if current:
        paras.append(join_lines(current))
    return [fix_words(p)[:8000] for p in paras if p]


def _level(text):
    m = LEVEL.match(text)
    if m:
        return (int(m.group(1)) if m.group(1) else 0), m.group(2), m.group(3)
    m = LEVEL_SCHOOL_FIRST.match(text)
    if m and any(m.group(1).lower().startswith(stem) for stem in SCHOOLS):
        return (int(m.group(3)) if m.group(3) else 0), m.group(1), m.group(4)
    return None


def table_classes(rows, pages, size):
    """Tabela "Círculo | Magia | Escola | … | Classes" do livro: {nome em minúsculas: 'Bruxo, Mago'}."""
    lines = {}
    for r in rows:
        if r['p'] in pages and abs(r['s'] - size) <= 0.2:
            lines.setdefault((r['p'], round(r['y'])), []).append(r)
    out = {}
    for cells in lines.values():
        cells.sort(key=lambda r: (r['c'], r['x']))
        texts = [clean(r['t']) for r in cells]
        if len(texts) >= 4 and re.fullmatch(r'\d', texts[0]):
            out[texts[1].lower()] = texts[-1]
    return out


def parse(rows, title_min=TITLE_MIN, classes_by_name=None, body_max=9.5, upper_names=False, pages=None):
    """classes_by_name: {nome: 'Bruxo, Mago'} quando a magia não traz "Conjuradores:" (tabela do livro)."""
    texts = [clean(r['t']) for r in rows]
    body = lambda k: 8.5 <= rows[k]['s'] <= body_max
    anchors = [k for k, t in enumerate(texts) if body(k) and _level(t)
               and any(FIELD_RE.match(texts[j]) for j in range(k + 1, min(k + 4, len(rows))))]
    spells, seen = [], set()
    for n, a in enumerate(anchors):
        names = []
        if pages and not pages[0] <= rows[a]['p'] <= pages[1]:
            continue
        k, below = a - 1, rows[a]
        if upper_names:  # OCR (Xanathar): o nome é a linha em caixa alta logo acima, em letra menor
            while k >= 0 and not texts[k]:
                k -= 1
            if texts[k].upper() == texts[k] and len(texts[k]) > 2:
                names, k = [texts[k].capitalize()], k - 1
        while (not upper_names and k >= 0 and rows[k]['s'] >= title_min and len(names) < 4 and rows[k]['p'] == below['p']
               and rows[k]['c'] == below['c'] and 0 <= below['y'] - rows[k]['y'] < 30):
            names.insert(0, texts[k]); below = rows[k]; k -= 1
        title_row = k + 1
        english = next((t.strip('() ') for t in names if t.startswith('(')), '')
        name = ' '.join(t for t in names if not t.startswith('(')).strip() or f'Magia sem nome (p. {rows[a]["p"]})'
        level, school_text, rest = _level(texts[a])
        school = next((v for stem, v in SCHOOLS.items() if school_text.lower().startswith(stem)), 'evocation')
        data = {'level': level, 'school': school, 'classes': [], 'castingTime': '', 'range': '', 'components': '',
                'duration': '', 'concentration': False, 'ritual': 'ritual' in rest.lower(), 'description': [],
                'original': english[:120], 'source': ''}
        end = anchors[n + 1] if n + 1 < len(anchors) else len(rows)
        field, desc = None, []
        for k in range(a + 1, end):
            r, t = rows[k], texts[k]
            if not t or re.fullmatch(r'\d{1,3}', t):
                continue  # número de página
            if not body(k):
                # Títulos de outras magias (ilustração de página inteira no meio) são pulados;
                # qualquer outro título encerra a magia.
                if rows[k]['s'] >= title_min and not any(_level(texts[j]) for j in range(k + 1, min(k + 4, len(rows)))):
                    break
                continue
            if t.startswith('Fonte:'):
                data['source'] = t[6:].strip()[:200]
                break
            label = FIELD_RE.match(t)
            if label:
                field = next(v for stem, v in FIELDS.items() if label.group(1).lower().startswith(stem))
                data[field] = t[label.end():].strip()
                continue
            if field and not desc and field != 'duration' and not r['lead'] and (t[:1].islower() or data[field].endswith('-')):
                data[field] = join_lines([data[field], t])  # campo quebrado em duas linhas
                continue
            field = None
            desc.append(r | {'t': t})
        if not data['classes'] and classes_by_name:
            data['classes'] = next((v for k, v in classes_by_name.items() if k.startswith(name.lower())), '')
        if isinstance(data['classes'], str):
            data['classes'] = sorted({v for pt, v in CLASSES.items() if pt in data['classes'].lower()})
        for f in ('castingTime', 'range', 'components', 'duration'):
            data[f] = data[f].strip().rstrip('.')[:400 if f == 'components' else 120]
        data['concentration'] = data['duration'].lower().startswith('concentra')
        data['description'] = _paragraphs(desc)[:200]
        key = slug(name)
        base, i = key, 2
        while key in seen:
            key = f'{base}-{i}'[:80]; i += 1
        seen.add(key)
        spells.append({'kind': 'spell', 'key': key, 'name': name[:200], 'data': data, '_first': title_row})
    return spells


def column_list(rows, pages, item_size, heading_size, list_id):
    """Lista de magias em colunas ("Truques (Círculo 0)", "1º Círculo"…): kind 'spell_list'.

    Lê cada subcoluna (página, coluna, x) de cima para baixo; linhas recuadas, em minúscula ou só
    "(ritual)" continuam o nome anterior.
    """
    cells = [r for r in rows if r['p'] in pages and (abs(r['s'] - item_size) <= 0.2 or abs(r['s'] - heading_size) <= 0.2)]
    columns = {}
    for r in cells:
        x = round(r['x'] / 40)  # agrupa posições próximas (recuo de continuação fica na mesma subcoluna)
        key = next((k for k in columns if k[0] == r['p'] and k[1] == r['c'] and abs(k[2] - x) <= 1), (r['p'], r['c'], x))
        columns.setdefault(key, []).append(r)
    level, spells, last_x = None, [], None
    for key in sorted(columns):
        last_x = None  # nova subcoluna: a primeira linha nunca continua a anterior
        for r in sorted(columns[key], key=lambda r: r['y']):
            t = clean(r['t'])
            if abs(r['s'] - heading_size) <= 0.2:
                found = re.match(r'^(\d)', t)
                level = int(found.group(1)) if found else (0 if t.lower().startswith('truque') else None)
                last_x = None
                continue
            if level is None or not t:
                continue
            if spells and last_x is not None and (r['x'] - last_x > 5 or t[:1].islower() or t.startswith('(') or t in ('Tasha',)):
                spells[-1]['name'] = f"{spells[-1]['name']} {t}"
                continue
            spells.append({'name': t, 'level': level})
            last_x = r['x']
    for s in spells:
        s['name'] = re.sub(r'\s*\(ritual\)\s*', '', s['name']).replace('/ ', '/').strip()[:120]
    return {'kind': 'spell_list', 'key': slug(list_id), 'name': f'Lista de magias ({list_id})',
            'data': {'list': list_id, 'spells': spells[:400]}}
