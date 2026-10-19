"""Extrai os blocos de estatísticas de monstros (formato do pacote: kind 'monster')."""
import re
from bookkit import (ABILITY_ROW, ENTRY_NAME, FIELD_RES, SECTION_RES, TYPE_LINE, TYPE_LINE_SIZE_FIRST,
                     clean, family, fix_dice, fix_signs, fix_words, join_lines, normalize_type_line, slug)

ABILS = ['str', 'dex', 'con', 'int', 'wis', 'cha']
GARBLED = {122: 'Duplo', 197: 'Kenku'}
HEADER = re.compile(r'^(?:(?:FOR|DES|CON|INT|SAB|CAR)\s*){1,6}$')
FOOTER = re.compile(r'^(\d{1,3}|CAP[ÍI]TULO \d+.*|AP[ÊE]NDICE.*)$')


def _type_info(text):
    text = normalize_type_line(text)
    m = TYPE_LINE.match(text) or TYPE_LINE_SIZE_FIRST.match(text)
    if not m:
        return None
    size = m.group('size')
    return {'type': (m.group('type') + (' ' + m.group('tags') if m.group('tags') else '')).strip(),
            'size': size[:1].upper() + size[1:], 'alignment': m.group('align').strip()}


def _is_name(row, type_row):
    t = clean(row['t'])
    return 2 <= len(t) <= 70 and not t.endswith('.') and not _type_info(t) and row['s'] >= type_row['s'] - 0.6


LEGENDARY_INTRO = re.compile(
    r'(?:pode|consegue)\s+(?:executar|realizar|usar)\s+(?:\d+|uma|duas|três)\s+(?:opç(?:ão|ões)\s+de\s+)?aç(?:ão|ões)\s+lendári', re.I)


def _recover_legendary(m):
    """Título "Ações Lendárias" perdido: a introdução ficou grudada na entrada anterior."""
    for section in ('actions', 'bonusActions', 'reactions'):
        entries = m[section]
        for k, entry in enumerate(entries):
            found = LEGENDARY_INTRO.search(entry['description'])
            if not found:
                continue
            cut = entry['description'].rfind('. ', 0, found.start())
            cut = cut + 2 if cut >= 0 else 0
            intro = entry['description'][cut:].strip()
            entry['description'] = entry['description'][:cut].strip()
            moved = entries[k + 1:]
            m[section] = entries[: k + 1] if entry['description'] else entries[:k]
            m['legendaryActions'] = [{'name': 'Ações Lendárias', 'description': intro}] + moved
            return


RUN_GAP = 28  # pontos: dentro de um bloco as linhas distam no máximo ~18; entre caixas, bem mais


def _column(row):
    return (row['p'], row['c'])


def _assign_rows(rows, texts, blocks):
    """Linhas de cada bloco, pela geometria da página.

    Cada bloco fica com as linhas da própria coluna, do título até o próximo bloco ou o fim da
    coluna. Quando um bloco quebra para a coluna seguinte, a continuação aparece no topo dela,
    antes de qualquer bloco novo. Se dois blocos ficaram abertos (um abaixo do outro na mesma
    coluna), o topo da coluna seguinte traz as duas continuações em sequência, separadas por um
    salto vertical: cada trecho vai, em ordem, para os últimos blocos que ficaram abertos.
    """
    assigned = [[] for _ in blocks]
    for i, (name_i, _type_i, a) in enumerate(blocks):
        column = _column(rows[a])
        stop = blocks[i + 1][0] if i + 1 < len(blocks) else min(len(rows), a + 400)
        j = name_i
        while j < stop and _column(rows[j]) == column:
            assigned[i].append(j)
            j += 1
        if j >= stop:
            continue
        # Zona entre o fim da coluna do bloco e o próximo bloco: possíveis continuações.
        anchor = rows[a]
        body = family(anchor['f'])
        runs, last = [], None
        for k in range(j, stop):
            r = rows[k]
            styled = family(r['f']) == body or ((r['i'] or r['b']) and ENTRY_NAME.match(texts[k]))
            heading = any(rx.match(texts[k]) for _, rx in SECTION_RES) and len(texts[k]) < 40
            size_ok = abs(r['s'] - anchor['s']) <= (3.0 if heading else 1.2)
            if not styled or not size_ok or not texts[k] or FOOTER.match(texts[k]):
                if runs and last is not None and family(r['f']) != body and r['s'] - anchor['s'] > 1.2:
                    last = None  # texto corrido encerra o trecho atual
                continue
            if last is None or _column(r) != _column(last) or r['y'] - last['y'] > RUN_GAP:
                runs.append([])
            runs[-1].append(k)
            last = r
        # Blocos ainda abertos: este e os anteriores da mesma coluna que terminaram antes do fim dela.
        open_blocks = [i]
        for b in range(i - 1, -1, -1):
            if _column(rows[blocks[b][2]]) != column or len(open_blocks) >= len(runs):
                break
            has_actions = any(SECTION_RES[3][1].match(texts[k]) and len(texts[k]) < 40 for k in assigned[b])
            if has_actions:
                break  # bloco completo na própria coluna: não recebe continuação
            open_blocks.insert(0, b)
        if len(runs) > len(open_blocks):
            # Mais trechos que blocos abertos: os excedentes são do último bloco.
            runs = runs[: len(open_blocks) - 1] + [sum(runs[len(open_blocks) - 1:], [])]
        for b, run in zip(open_blocks[len(open_blocks) - len(runs):], runs):
            assigned[b].extend(run)
    return assigned


def parse(rows, signs=False):
    texts = [clean(r['t']) for r in rows]
    # Linha de tipo quebrada em duas ("Feérico Pequeno (goblinoide)," + "normalmente caótico e neutro").
    for k in range(len(texts) - 1):
        if texts[k].endswith(',') and not _type_info(texts[k]) and _type_info(f'{texts[k]} {texts[k + 1]}'):
            texts[k] = f'{texts[k]} {texts[k + 1]}'
            texts[k + 1] = ''
    anchors = [i for i, t in enumerate(texts) if t.startswith('Classe de Armadura')]
    # Blocos cujo cabeçalho (nome, tipo, CA e PV) não está na camada de texto: começam em
    # "Deslocamento", logo acima da tabela de atributos.
    for i, t in enumerate(texts):
        if (t.startswith('Deslocamento') and any(HEADER.match(texts[k]) for k in range(i + 1, min(len(texts), i + 4)))
                and not any(texts[k].startswith(('Classe de Armadura', 'Pontos de Vida')) for k in range(max(0, i - 4), i))):
            anchors.append(i)
    anchors.sort()
    blocks = []
    for a in anchors:
        type_i = None
        for k in range(a - 1, max(-1, a - 6), -1):
            if _type_info(texts[k]):
                type_i = k
                break
        if type_i is None:
            # Nome e tipo fora da camada de texto (desenhados como imagem): o bloco entra sem
            # nome, para ser completado pelo arquivo de correções.
            blocks.append((a, a, a))
            continue
        name_i = None
        for k in range(type_i - 1, max(-1, type_i - 6), -1):
            if rows[k]['p'] == rows[type_i]['p'] and _is_name(rows[k], rows[type_i]) and not texts[k][:1].islower():
                name_i = k
                break
        # Sem título reconhecível: o bloco começa na linha do tipo (o nome vem do texto ao redor).
        blocks.append((name_i if name_i is not None else type_i, type_i, a))

    block_rows = _assign_rows(rows, texts, blocks)

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
        name = fix_words(name)
        info = _type_info(texts[type_i]) or {'type': '', 'size': '', 'alignment': ''}
        if type_i == a:
            name = f"Criatura sem nome (p. {rows[a]['p']})"
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
                text = fix_words(fix_dice(join_lines(entry['lines'])))
                if signs:
                    text = fix_signs(text)
                target = m.get(entry['section'])
                if isinstance(target, list):
                    target.append({'name': fix_words(entry['name']), 'description': text[:8000]})
                entry = None

        for j in block_rows[index]:
            r = rows[j]
            t = texts[j]
            if not t or FOOTER.match(t):
                continue
            if family(r['f']) != body:
                # Nome de entrada noutra fonte (ex.: "Pancada." em Arial itálico num bloco em Calibri).
                foreign_entry = (r['i'] or r['b']) and ENTRY_NAME.match(t) and abs(r['s'] - rows[a]['s']) <= 1.2
                if not foreign_entry:
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
            if phase == 'top' and r['i'] and not r['b'] and ENTRY_NAME.match(t) and (m['senses'] or m['languages']):
                # Bloco sem linha de nível de desafio: o primeiro traço em itálico encerra o cabeçalho.
                phase = 'traits'
                field = None
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
            if not sec and len(t) <= 8 and r['b'] and any(ord(ch) < 0x20 for ch in t) and section == 'traits':
                # Título "AÇÕES" com a fonte embaralhada no PDF (ex.: "\x04\x17O ^").
                sec = 'actions'
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
            if (starts and entry and em.group('name').count(')') > em.group('name').count('(')
                    and len(entry['lines']) > 1 and entry['lines'][-1].count('(') > entry['lines'][-1].count(')')):
                # Nome quebrado em duas linhas: a última linha da entrada anterior traz o começo
                # ("Invisibilidade (Recarrega após um Descanso Curto ou") e esta linha, o fim ("Longo). …").
                head = entry['lines'].pop()
                section_now = entry['section']
                finish_entry()
                entry = {'section': section_now, 'name': f"{clean(head)} {em.group('name')}", 'lines': [em.group('rest')]}
                continue
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
        if not m['legendaryActions']:
            _recover_legendary(m)
        if not m['actions']:
            # O título "Ações" não veio na camada de texto: os ataques ficaram entre os traços.
            for k, trait in enumerate(m['traits']):
                if trait['name'].startswith('Ataques Múltiplos') or re.search(r'para (?:acertar|atingir)|Ataque (?:Corpo[- ]a[- ]Corpo|à Distância|com Arma|Mágico)', trait['description']):
                    m['actions'], m['traits'] = m['traits'][k:], m['traits'][:k]
                    break
        if signs:
            for key in ('savingThrows', 'skills', 'senses'):
                m[key] = fix_signs(m[key])
        for key in ('savingThrows', 'skills', 'speed', 'senses', 'languages', 'resistances', 'damageImmunities', 'conditionImmunities', 'vulnerabilities'):
            m[key] = clean(m[key])[:390]
        m['_rows'] = used | consumed
        m['_start'] = name_i
        m['_body'] = body
        monsters.append(m)

    # Ambientação: nos dois livros o texto da criatura vem ANTES do bloco de estatísticas,
    # entre o fim do bloco anterior e o título deste.
    previous_end = 0
    for m in monsters:
        lore_rows = [rows[k] for k in range(previous_end, m['_start'])
                     if k not in m['_rows'] and rows[k]['s'] >= 9 and len(texts[k]) > 25
                     and not FOOTER.match(texts[k])]
        paras, current, last = [], [], None
        for r in lore_rows:
            if current and (r['lead'] or last is None or r['p'] != last['p'] or r['c'] != last['c']
                            or abs(r['y'] - last['y']) > 16):
                paras.append(join_lines(current)); current = []
            current.append(r['t']); last = r
        if current:
            paras.append(join_lines(current))
        m['lore'] = [p[:8000] for p in paras if len(p) > 40][:30]
        previous_end = max(m['_rows']) + 1
        del m['_start'], m['_body']
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
