"""Extrai os blocos de estatísticas de monstros (formato do pacote: kind 'monster')."""
import re
from bookkit import (ABILITY_ROW, ENTRY_NAME, FIELD_RES, SECTION_RES, TYPE_LINE, TYPE_LINE_SIZE_FIRST,
                     clean, family, fix_dice, fix_signs, join_lines, slug)

ABILS = ['str', 'dex', 'con', 'int', 'wis', 'cha']
GARBLED = {122: 'Doppelganger', 197: 'Kenku'}
HEADER = re.compile(r'^(?:(?:FOR|DES|CON|INT|SAB|CAR)\s*){1,6}$')
FOOTER = re.compile(r'^(\d{1,3}|CAP[ÍI]TULO \d+.*|AP[ÊE]NDICE.*)$')


def _type_info(text):
    m = TYPE_LINE.match(text) or TYPE_LINE_SIZE_FIRST.match(text)
    if not m:
        return None
    return {'type': (m.group('type') + (' ' + m.group('tags') if m.group('tags') else '')).strip(),
            'size': m.group('size'), 'alignment': m.group('align').strip()}


def _is_name(row, type_row):
    t = clean(row['t'])
    return 2 <= len(t) <= 70 and not t.endswith('.') and not _type_info(t) and row['s'] >= type_row['s'] - 0.6


def parse(rows, signs=False):
    texts = [clean(r['t']) for r in rows]
    anchors = [i for i, t in enumerate(texts) if t.startswith('Classe de Armadura')]
    blocks = []
    for a in anchors:
        type_i = None
        for k in range(a - 1, max(-1, a - 6), -1):
            if _type_info(texts[k]):
                type_i = k
                break
        if type_i is None:
            continue
        name_i = None
        for k in range(type_i - 1, max(-1, type_i - 6), -1):
            if rows[k]['p'] == rows[type_i]['p'] and _is_name(rows[k], rows[type_i]) and not texts[k][:1].islower():
                name_i = k
                break
        # Sem título reconhecível: o bloco começa na linha do tipo (o nome vem do texto ao redor).
        blocks.append((name_i if name_i is not None else type_i, type_i, a))

    monsters = []
    for index, (name_i, type_i, a) in enumerate(blocks):
        end = blocks[index + 1][0] if index + 1 < len(blocks) else min(len(rows), a + 400)
        body = family(rows[a]['f'])
        name = texts[name_i]
        prev = rows[name_i - 1] if name_i > 0 else None
        if (prev and prev['p'] == rows[name_i]['p'] and prev['c'] == rows[name_i]['c'] and family(prev['f']) == family(rows[name_i]['f'])
                and abs(prev['s'] - rows[name_i]['s']) < 1.2 and 0 < rows[name_i]['y'] - prev['y'] < 22 and not FOOTER.match(texts[name_i - 1])
                and name[:1].islower()):
            name = f"{texts[name_i - 1]} {name}"
        if name_i == type_i:
            name = ''
            for k in range(a, end):
                q = rows[k]
                if family(q['f']) != body and q['s'] >= 11 and 3 <= len(texts[k]) <= 40 and not texts[k].endswith('.') and not FOOTER.match(texts[k]):
                    name = texts[k]
                    break
            name = name or f"Criatura sem nome (p. {rows[a]['p']})"
        if any(0x17f < ord(ch) < 0x2000 or ord(ch) < 0x20 for ch in name):
            # Nomes com a fonte embaralhada no PDF.
            name = GARBLED.get(rows[name_i]['p'], name)
        if name.isupper():
            name = name.title().replace(' De ', ' de ').replace(' Da ', ' da ').replace(' Do ', ' do ').replace(' Dos ', ' dos ').replace(' Das ', ' das ').replace(' E ', ' e ')
        info = _type_info(texts[type_i])
        m = {'name': name, 'size': info['size'], 'type': info['type'], 'alignment': info['alignment'],
             'ac': 10, 'acNote': '', 'hp': 1, 'hpFormula': '', 'speed': '', 'abilities': {},
             'savingThrows': '', 'skills': '', 'vulnerabilities': '', 'resistances': '', 'damageImmunities': '',
             'conditionImmunities': '', 'senses': '', 'languages': '', 'cr': '', 'xp': '',
             'traits': [], 'actions': [], 'bonusActions': [], 'reactions': [], 'legendaryActions': [], 'lore': []}
        field = None
        phase = 'top'
        section = 'traits'
        entry = None
        skipping = False
        consumed = set()
        used = {name_i, type_i}
        lore_rows = []

        def finish_entry():
            nonlocal entry
            if entry:
                text = fix_dice(join_lines(entry['lines']))
                if signs:
                    text = fix_signs(text)
                target = m.get(entry['section'])
                if isinstance(target, list):
                    target.append({'name': entry['name'], 'description': text[:8000]})
                entry = None

        for j in range(a, end):
            r = rows[j]
            t = texts[j]
            if not t or FOOTER.match(t):
                continue
            if family(r['f']) != body:
                if r['s'] >= 9 and len(t) > 25:
                    lore_rows.append(r)
                continue
            used.add(j)
            if j in consumed:
                continue
            if HEADER.match(t):
                # Tabela de atributos: valores na mesma faixa vertical, em ordem da esquerda para a direita.
                hy, page, col = r['y'], r['p'], r['c']
                cells = []
                for k in range(j, min(end, j + 24)):
                    q = rows[k]
                    if q['p'] != page or q['c'] != col or not (hy - 3 <= q['y'] <= hy + 32):
                        continue
                    qt = texts[k]
                    if HEADER.match(qt):
                        consumed.add(k)
                        continue
                    found = re.findall(r'(\d{1,2})\s*[\(\[{]?\s*[+\-–−H4]?', qt)
                    values = [int(v) for v in re.findall(r'(\d{1,2})\s*\(', qt)] or ([int(found[0])] if found and re.match(r'^\d{1,2}\b', qt) else [])
                    if values:
                        consumed.add(k)
                        for n, v in enumerate(values):
                            cells.append((q['x'] + n * 30, v))
                cells.sort()
                if len(cells) >= 6:
                    for ab, (_, v) in zip(ABILS, cells[:6]):
                        m['abilities'][ab] = max(1, min(30, v))
                continue
            if phase == 'top':
                if t.startswith('Classe de Armadura'):
                    rest = t[len('Classe de Armadura'):].strip()
                    mm = re.match(r'(\d+)\s*(.*)', rest)
                    if mm:
                        m['ac'] = int(mm.group(1)); m['acNote'] = mm.group(2).strip(' ()')
                    field = 'acNote'
                    continue
                if t.startswith('Pontos de Vida'):
                    mm = re.match(r'Pontos de Vida\s+(\d+)\s*(?:\((.*)\))?', fix_dice(t))
                    if mm:
                        m['hp'] = int(mm.group(1)); m['hpFormula'] = (mm.group(2) or '').strip()
                    field = None
                    continue
                if t.startswith('Deslocamento'):
                    m['speed'] = t[len('Deslocamento'):].strip(); field = 'speed'
                    continue
                matched = False
                for key, rx in FIELD_RES:
                    mm = rx.match(t)
                    if mm:
                        value = mm.group(1).strip()
                        if key == 'cr':
                            value = re.sub(r'\s*Bônus de Profici[êe]ncia.*$', '', value)
                            cm = re.match(r'([\d/]+)\s*(?:\(([^)]*)\))?', value)
                            if cm:
                                m['cr'] = cm.group(1); m['xp'] = (cm.group(2) or '').replace(' XP', '').strip()
                            phase = 'traits'
                            field = None
                        else:
                            m[key] = value
                            field = key
                        matched = True
                        break
                if matched:
                    continue
                if field and field in m and isinstance(m[field], str):
                    m[field] = (m[field] + ' ' + t).strip()
                continue
            # Seções e entradas
            sec = None
            for key, rx in SECTION_RES:
                if rx.match(t) and len(t) < 40:
                    sec = key
                    break
            if sec:
                finish_entry()
                section = sec if sec in ('actions', 'bonusActions', 'reactions', 'legendaryActions') else 'legendaryActions'
                skipping = False
                continue
            if t.isupper() and len(t) > 3 and (r['b'] or r['s'] < 8.6):
                # Quadro lateral dentro da faixa do bloco: ignora até a próxima seção.
                finish_entry()
                skipping = True
                used.discard(j)
                continue
            if skipping:
                used.discard(j)
                continue
            em = ENTRY_NAME.match(t)
            starts = em and (r['lead'] or r['i'] or r['b'])
            if starts:
                finish_entry()
                entry = {'section': section, 'name': em.group('name').strip(), 'lines': [em.group('rest')]}
            elif entry:
                if r['lead'] and ':' in t[:30]:
                    entry['lines'].append('\n' + t)
                else:
                    entry['lines'].append(t)
            elif section == 'legendaryActions' and not m['legendaryActions']:
                entry = {'section': section, 'name': 'Ações Lendárias', 'lines': [t]}
        finish_entry()
        if signs:
            for key in ('savingThrows', 'skills', 'senses'):
                m[key] = fix_signs(m[key])
        for key in ('savingThrows', 'skills', 'speed', 'senses', 'languages', 'resistances', 'damageImmunities', 'conditionImmunities', 'vulnerabilities'):
            m[key] = clean(m[key])[:390]
        # Ambientação: parágrafos de texto corrido próximos ao bloco.
        paras, current, last_y = [], [], None
        for r in lore_rows:
            if current and (r['lead'] or (last_y is not None and abs(r['y'] - last_y) > 16)):
                paras.append(join_lines(current)); current = []
            current.append(r['t']); last_y = r['y']
        if current:
            paras.append(join_lines(current))
        m['lore'] = [p[:8000] for p in paras if len(p) > 40][:30]
        m['_rows'] = used | consumed
        monsters.append(m)
    return monsters


def to_entries(monsters):
    entries, seen = [], set()
    for m in monsters:
        key = slug(m['name'])
        base, n = key, 2
        while key in seen:
            key = f'{base}-{n}'[:80]; n += 1
        seen.add(key)
        data = {k: v for k, v in m.items() if k not in ('name', '_rows')}
        data['type'] = data['type'][:120]
        data['alignment'] = data['alignment'][:80]
        data['acNote'] = data['acNote'][:200]
        data['hpFormula'] = data['hpFormula'][:80]
        data['cr'] = data['cr'][:20]
        data['xp'] = data['xp'][:40]
        for sec in ('traits', 'actions', 'bonusActions', 'reactions', 'legendaryActions'):
            data[sec] = [{'name': e['name'][:200], 'description': e['description']} for e in data[sec]][:60]
        entries.append({'kind': 'monster', 'key': key, 'name': m['name'][:200], 'data': data})
    return entries
