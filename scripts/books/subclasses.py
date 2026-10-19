"""Extrai subclasses (kind 'subclass') pelas linhas "Característica de Nº nível d… <Subclasse>".

O nome de cada característica é o subtítulo logo acima dessa linha; o texto vai até o próximo
título. A classe vem do título de capítulo da classe ("Bárbaro", "Mago"…) acima da subclasse, e o
resumo são os parágrafos entre o título da subclasse e a primeira característica.
"""
import re

from bookkit import clean, fix_words, join_lines, slug

CLASS_IDS = {'artífice': 'artificer', 'bárbaro': 'barbarian', 'bardo': 'bard', 'bruxo': 'warlock', 'clérigo': 'cleric',
             'druida': 'druid', 'feiticeiro': 'sorcerer', 'guardião': 'ranger', 'patrulheiro': 'ranger',
             'guerreiro': 'fighter', 'ladino': 'rogue', 'mago': 'wizard', 'monge': 'monk', 'paladino': 'paladin'}
FEATURE_LINE = re.compile(r'^Caracter[íi]stica\s+(?:de|do)\s+(\d{1,2})\s*[º°o]?\s*n[íi]vel\s+(?:d[aoe]s?|de)\s+(.+?)\.?$', re.I)


def _paragraphs(rows):
    paras, current, last = [], [], None
    for r in rows:
        if current and (r['lead'] or r['p'] == last['p'] and r['c'] == last['c'] and
                        (r['y'] - last['y'] > r['s'] * 1.9 or r['x'] - last['x'] > 4)):
            paras.append(join_lines(current)); current = []
        current.append(r['t']); last = r
    if current:
        paras.append(join_lines(current))
    return [fix_words(p) for p in paras if p]


def parse(rows, class_size, subclass_size, feature_size, body_max=10.5):
    """Tamanhos (com tolerância de 0,3) do título da classe, da subclasse e da característica."""
    texts = [clean(r['t']) for r in rows]
    near = lambda r, size: abs(r['s'] - size) <= 0.3
    is_title = lambda r: r['s'] > body_max + 0.6
    klass, class_at = None, {}
    for i, r in enumerate(rows):
        if near(r, class_size) and texts[i].lower() in CLASS_IDS:
            klass = CLASS_IDS[texts[i].lower()]
        class_at[i] = klass
    subs = {}
    for i, t in enumerate(texts):
        m = FEATURE_LINE.match(t)
        if not m or not class_at[i]:
            continue
        sub_name = m.group(2).strip()
        words = sub_name.split()
        if ',' in sub_name or words[0].lower() in CLASS_IDS and (len(words) == 1 or words[1][:1].islower() or words[1] in ('A', 'As', 'O', 'Os', 'Você')):
            continue  # característica opcional da classe ou que substitui a de uma subclasse antiga
        name_row = next((k for k in range(i - 1, max(i - 4, -1), -1) if near(rows[k], feature_size) and texts[k]), None)
        if name_row is None:
            continue
        name = texts[name_row]
        while name_row - 1 >= 0 and near(rows[name_row - 1], feature_size) and rows[name_row]['y'] - rows[name_row - 1]['y'] < 20:
            name_row -= 1; name = texts[name_row] + ' ' + name
        end = next((k for k in range(i + 1, len(rows)) if is_title(rows[k]) and texts[k] and not re.fullmatch(r'\d{1,3}', texts[k])), len(rows))
        body = [rows[k] | {'t': texts[k]} for k in range(i + 1, end)
                if texts[k] and rows[k]['s'] <= body_max and rows[k]['s'] >= 8.5 and not re.fullmatch(r'\d{1,3}', texts[k])]
        sub = subs.setdefault(sub_name.lower(), {'name': sub_name, 'classId': class_at[i], 'first': name_row, 'features': []})
        sub['features'].append({'level': int(m.group(1)), 'name': name[:120],
                                'description': '\n\n'.join(_paragraphs(body))[:8000]})
    # "Domínio da Ordem Você pode…": a linha da característica seguiu no texto; junta na subclasse
    # de nome mais curto que é prefixo deste.
    for key in sorted(subs, key=len, reverse=True):
        base = next((other for other in subs if other != key and key.startswith(other + ' ')), None)
        if base:
            subs[base]['features'] += subs.pop(key)['features']
    entries, seen = [], set()
    for sub in subs.values():
        sub['features'].sort(key=lambda f: f['level'])
        title = max((k for k in range(sub['first']) if near(rows[k], subclass_size)
                     and sub['name'].lower().split()[-1] in texts[k].lower()), default=None)
        summary = ''
        if title is not None:
            summary = '\n\n'.join(_paragraphs([rows[k] | {'t': texts[k]} for k in range(title + 1, sub['first'])
                                              if texts[k] and 8.5 <= rows[k]['s'] <= body_max]))[:2000]
        name = sub['name'][:1].upper() + sub['name'][1:]
        key = slug(f"{sub['classId']}-{name}")
        if key in seen:
            continue
        seen.add(key)
        entries.append({'kind': 'subclass', 'key': key, 'name': name[:200],
                        'data': {'classId': sub['classId'], 'summary': summary, 'features': sub['features'][:60], 'alwaysPrepared': []}})
    return entries


# Xanathar (PDF escaneado, OCR): classe em título grande, subclasse em caixa alta (~9,5) e cada
# característica em caixa alta menor (~8,3), com o nível no texto ("Começando no 6° nível…").
LEVEL_IN_TEXT = re.compile(r'(\d{1,2})\s*[°ºoQ0]?\s*n[íi]vel')
CLASS_TITLES = {'BÁRBARO': 'barbarian', 'BARDO': 'bard', 'BRUXO': 'warlock', 'CLÉRIGO': 'cleric', 'DRUIDA': 'druid',
                'GUERREIRO': 'fighter', 'MONGE': 'monk', 'PALADINO': 'paladin', 'PATRULHEIRO': 'ranger',
                'LADINO': 'rogue', 'FEITICEIRO': 'sorcerer', 'MAGO': 'wizard'}


# Nomes de subclasse que o OCR do Xanathar estraga.
NAME_FIXES = {'caminho do guardiã o ancestral': 'Caminho do Guardião Ancestral', 'oligio dos sussurros': 'Colégio dos Sussurros',
              'juramento da rendencão': 'Juramento da Redenção'}
TABLE_TITLE = re.compile(r'^CARACTER\S{1,3}STICAS\s+D[OAE]S?\s+(.+)$', re.I)


def _upper(t):
    letters = [ch for ch in t if ch.isalpha()]
    return len(letters) >= 4 and sum(ch.isupper() for ch in letters) >= 0.85 * len(letters)


def _ocr_name(t):
    t = t.strip('.· ').replace('Ü', 'O')  # o OCR lê "O" como "Ü"
    t = re.sub(r'^[oO]\s+(?=[A-ZÀ-Ý])', '', t)  # artigo solto ("o LÂMINA MALDITA")
    return t


def parse_ocr(rows, class_pages, sub_size=(9.0, 10.4), feature_size=(7.8, 8.9)):
    """class_pages: {classe: (primeira página, última página)} do capítulo de cada classe."""
    texts = [_ocr_name(clean(r['t'])) for r in rows]
    page_class = {p: c for c, (a, b) in class_pages.items() for p in range(a, b + 1)}
    first_page, last_page = min(page_class), max(page_class)
    klass, current, subs = None, None, []
    body_rows = lambda k: 9.3 <= rows[k]['s'] <= 10.6 and not _upper(texts[k])
    for i, r in enumerate(rows):
        if not first_page <= r['p'] <= last_page or not texts[i]:
            continue
        t = texts[i]
        klass = page_class.get(r['p'])
        if current and current['classId'] != klass:
            current = None
        table = TABLE_TITLE.match(t)
        if klass and table and r['s'] < feature_size[0] + 0.3:
            # Tabela "CARACTERÍSTICAS DO X" (o OCR às vezes perde ou embaralha o título da subclasse).
            name = _ocr_name(re.sub(r'[\[\]()|~:]', '', table.group(1))).strip()
            last = current['name'].lower().split()[-1] if current else ''
            if name and (not current or not name.lower().endswith(last[-5:])):
                current = {'name': name, 'classId': klass, 'row': i, 'features': []}
                subs.append(current)
            continue
        if klass and sub_size[0] <= r['s'] <= sub_size[1] and _upper(t) and r['f'].startswith('Times') and len(t) > 6:
            current = {'name': t, 'classId': klass, 'row': i, 'features': []}
            subs.append(current)
            continue
        if current and feature_size[0] <= r['s'] <= feature_size[1] and _upper(t) and r['f'].startswith('Times'):
            body = []
            for k in range(i + 1, min(i + 200, len(rows))):
                if not texts[k] or rows[k]['f'].startswith('Hidden'):
                    continue
                if _upper(texts[k]) and rows[k]['s'] <= 10.6 and len(texts[k]) > 6:
                    break
                if body_rows(k):
                    body.append(rows[k] | {'t': texts[k]})
            text = '\n\n'.join(_paragraphs(body)).replace('Ü', 'O')
            level = LEVEL_IN_TEXT.search(text[:160])
            if level and 1 <= int(level.group(1)) <= 20:
                current['features'].append({'level': int(level.group(1)), 'name': t.title()[:120], 'description': text[:8000]})
    entries, seen = [], set()
    for sub in subs:
        if sub['classId'] == 'warlock':
            # As invocações místicas novas vêm logo depois do último patrono: não são dele.
            sub['features'] = [f for f in sub['features'] if f['level'] in (1, 6, 10, 14)]
        if len(sub['features']) < 2:
            continue
        intro = [rows[k] | {'t': texts[k]} for k in range(sub['row'] + 1, min(sub['row'] + 60, len(rows)))
                 if body_rows(k)]
        summary = '\n\n'.join(_paragraphs(intro[:25]))[:2000]
        name = ' '.join(w if w.lower() in ('do', 'da', 'dos', 'das', 'de', 'e') else w.capitalize() for w in sub['name'].lower().split())
        name = name[:1].upper() + name[1:]
        name = NAME_FIXES.get(name.lower(), name)
        key = slug(f"{sub['classId']}-{name}")
        if key in seen:
            continue
        seen.add(key)
        sub['features'].sort(key=lambda f: f['level'])
        entries.append({'kind': 'subclass', 'key': key, 'name': name[:200],
                        'data': {'classId': sub['classId'], 'summary': summary, 'features': sub['features'][:60], 'alwaysPrepared': []}})
    return entries
