"""Monta o pacote `codexveil.tormenta20.book` a partir da extração do `t20.py`.

Uso: python -X utf8 scripts/books/t20_pack.py <saída/t20.json> <saída/t20-jda.book.json>

O pacote fica FORA do Git (conteúdo do exemplar do usuário) e é importado em "Meus livros".
"""
import json, re, sys, unicodedata
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from bookkit import slug  # noqa: E402

ATTR = {'for': 'for', 'des': 'des', 'con': 'con', 'int': 'int', 'sab': 'sab', 'car': 'car'}
SIZE_WORDS = {'minúsculo': 'minusculo', 'pequeno': 'pequeno', 'médio': 'medio', 'grande': 'grande'}


def plain(text):
    text = unicodedata.normalize('NFD', text)
    return ''.join(ch for ch in text if unicodedata.category(ch) != 'Mn').lower().strip()


SKILLS = {plain(n): k for k, n in {
    'acrobacia': 'Acrobacia', 'adestramento': 'Adestramento', 'atletismo': 'Atletismo', 'atuacao': 'Atuação', 'cavalgar': 'Cavalgar',
    'conhecimento': 'Conhecimento', 'cura': 'Cura', 'diplomacia': 'Diplomacia', 'enganacao': 'Enganação', 'fortitude': 'Fortitude',
    'furtividade': 'Furtividade', 'guerra': 'Guerra', 'iniciativa': 'Iniciativa', 'intimidacao': 'Intimidação', 'intuicao': 'Intuição',
    'investigacao': 'Investigação', 'jogatina': 'Jogatina', 'ladinagem': 'Ladinagem', 'luta': 'Luta', 'misticismo': 'Misticismo',
    'nobreza': 'Nobreza', 'oficio': 'Ofício', 'percepcao': 'Percepção', 'pilotagem': 'Pilotagem', 'pontaria': 'Pontaria',
    'reflexos': 'Reflexos', 'religiao': 'Religião', 'sobrevivencia': 'Sobrevivência', 'vontade': 'Vontade'}.items()}


def skill_id(name):
    return SKILLS.get(plain(re.sub(r'\s*\(.*$', '', name)))


def skills_in(text):
    """Perícias citadas num texto, na ordem ("Luta (For) ou Pontaria (Des)")."""
    found = []
    for word in re.findall(r'[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+', text):
        sid = skill_id(word)
        if sid and sid not in found:
            found.append(sid)
    return found


def entry(kind, name, data, key=None):
    return {'kind': kind, 'key': (key or slug(name))[:80], 'name': name[:200], 'data': data}


def race(r):
    text = r['attributesText']
    data = {'summary': '\n\n'.join(r['summary'])[:4000], 'attributes': {}, 'variants': [], 'size': 'medio', 'speed': 9,
            'abilities': [{'name': a['name'], 'text': a['text']} for a in r['abilities'] if a['name']]}
    choice = re.search(r'\+(\d) em (Três|Dois|Duas|Quatro) Atributos Diferentes(?: \(exceto (\w+)\))?', text, re.I)
    if choice:
        exclude = [ATTR[plain(choice.group(3))[:3]]] if choice.group(3) else []
        data['attributeChoice'] = {'count': {'tres': 3, 'dois': 2, 'duas': 2, 'quatro': 4}[plain(choice.group(2))], 'value': int(choice.group(1)), 'exclude': exclude}
    if '(' in text and ';' in text:  # Suraggel: duas variantes
        for part in text.split(';'):
            variant = re.search(r'\((\w+)\)', part)
            mods = {}
            for name, sign, value in re.findall(r'(Força|Destreza|Constituição|Inteligência|Sabedoria|Carisma)\s*([+–\-])\s*(\d)', part):
                mods[ATTR[plain(name)[:3]]] = int(value) * (-1 if sign in '–-' else 1)
            if variant:
                data['variants'].append({'name': variant.group(1).capitalize(), 'attributes': mods})
    else:
        data['attributes'] = {k: v for k, v in r['attributes'].items()}
    joined = ' '.join(a['text'] for a in r['abilities'])
    size = re.search(r'[Ss]eu tamanho é (Minúsculo|Pequeno|Médio|Grande)', joined)
    if size:
        data['size'] = SIZE_WORDS[size.group(1).lower()]
    speed = re.search(r'deslocamento (?:é |de )?(\d+(?:,\d)?)m', joined)
    if speed:
        data['speed'] = float(speed.group(1).replace(',', '.'))
    return entry('species', r['name'], data)


def circles(table):
    out = {}
    for level, text in table.items():
        m = re.search(r'[Mm]agias \((\d)º círculo\)', text)
        if m:
            out[m.group(1)] = int(level)
    return out


SPELL_ATTR = {'Arcanista': None, 'Bardo': 'car', 'Clérigo': 'sab', 'Druida': 'sab'}
SPELL_TYPE = {'Arcanista': 'arcana', 'Bardo': 'arcana', 'Clérigo': 'divina', 'Druida': 'divina'}


def klass(c):
    prof = plain(c['proficiencies'])
    weapons = ['simples'] + (['marciais'] if 'marcia' in prof else []) + (['exoticas'] if 'exotica' in prof else []) + (['fogo'] if 'fogo' in prof else [])
    armors = (['leves'] if c['name'] != 'Arcanista' else []) + (['pesadas'] if 'pesada' in prof else []) + (['escudos'] if 'escudo' in prof else [])
    fixed_text = c['skillsText'].split('mais ')[0]
    fixed, alternatives = [], []
    for part in re.split(r',\s*|\s+e\s+', fixed_text):
        ids = skills_in(part)
        if len(ids) >= 2 and ' ou ' in part:
            alternatives.append(ids)
        elif ids:
            fixed.extend(i for i in ids if i not in fixed)
    choice_options = [skill_id(o['name']) for o in c['skillsChoice']['options']]
    data = {
        'summary': '\n\n'.join(c['summary'])[:6000], 'pvInitial': c['pvInitial'], 'pvPerLevel': c['pvPerLevel'], 'pmPerLevel': c['pmPerLevel'],
        'skillsFixed': fixed, 'skillsFixedChoices': alternatives,
        'skillsChoice': {'count': c['skillsChoice']['count'], 'options': [o for o in choice_options if o]},
        'proficiencies': {'weapons': weapons, 'armors': armors, 'text': c['proficiencies'][:400]},
        'abilities': [{'name': a['name'], 'text': a['text'][:8000], 'level': a['level'],
                       'options': [{'name': o['name'], 'text': o['text'][:8000]} for o in a.get('options', [])]} for a in c['abilities']],
        'table': {str(k): v[:300] for k, v in c['table'].items()},
        'powers': [{'name': p['name'], 'text': p['text'][:8000], 'prerequisite': p['prerequisite'][:400]} for p in c['powers'] if p['name']],
        'sections': [{'title': s['title'], 'text': '\n\n'.join(s['paragraphs'])[:20000],
                      'entries': [{'name': e['name'], 'text': e['text'][:8000]} for e in s['entries'] if e.get('name')]} for s in c['sections']],
    }
    table_circles = circles(c['table'])
    if c['name'] in SPELL_TYPE and table_circles:
        # Arcanista: Int (bruxo/mago) ou Car (feiticeiro); a ficha guarda o atributo escolhido.
        magic = next((a['text'] for a in c['abilities'] if a['name'] == 'Magias'), '')
        initial = {'duas': 2, 'tres': 3, 'quatro': 4}.get(plain((re.search(r'começa com (\w+) magias', magic) or [None, 'duas'])[1]), 2)
        schools = re.search(r'Escolha (\w+) escolas', magic)
        data['spellcasting'] = {'type': SPELL_TYPE[c['name']], 'attribute': SPELL_ATTR[c['name']] or 'int', 'circles': {**{'1': 1}, **table_circles},
                                'initial': initial, 'learnEvery': 2 if 'nível par' in magic else 1,
                                'schoolsChoice': {'tres': 3, 'duas': 2, 'quatro': 4}.get(plain(schools.group(1)), 0) if schools else 0,
                                'addsAttributeToPm': 'total de PM' in magic}
    return entry('class', c['name'], data)


def origin(o):
    benefits = o['benefits']
    skills_part, _, powers_part = benefits.partition('(perícias)')
    powers = [p.strip() for p in re.sub(r'\(poderes?\)\.?', '', powers_part).strip(' ;.').split(',') if p.strip()]
    data = {'summary': '\n\n'.join(o['summary'])[:4000], 'items': o['items'][:1000], 'benefitsText': benefits[:1000],
            'benefitSkills': skills_in(skills_part), 'benefitPowers': [p[:120] for p in powers],
            'uniquePowers': [{'name': p['name'], 'text': p['text'][:8000]} for p in o['uniquePowers']]}
    return entry('background', o['name'], data)


def deity(d):
    return entry('deity', d['name'], {'summary': '\n\n'.join(d['summary'])[:4000], 'energy': d['energy'][:40],
                                      'grantedPowers': d['grantedPowers'][:12], 'details': {k: v[:4000] for k, v in d['details'].items()}})


def spell(s):
    return entry('spell', s['name'], {k: s[k] for k in ('type', 'circle', 'school', 'execution', 'range', 'target', 'area', 'effect', 'duration', 'resistance', 'text')}
                 | {'upgrades': s['upgrades'][:20]})


def number(text):
    m = re.search(r'[–\-+]?\d+', text.replace('–', '-'))
    return int(m.group(0)) if m else 0


def threat(t):
    skills = t.get('pericias', '')
    initiative = number(t.get('iniciativa', ''))
    kind = t['type'] or ('Perigo' if not t['hp'] and not t['defense'] else '')  # perigos (Avalanche etc.) não têm ficha
    data = {'type': kind[:160], 'challenge': t['nd'][:10], 'senses': t.get('iniciativa', '')[:400], 'initiative': initiative,
            'defense': t['defense'], 'defenseNotes': t['defenseText'][:600], 'hitPoints': t['hp'],
            'manaPoints': number(t['pontos_de_mana']) if t.get('pontos_de_mana') else None,
            'speed': t.get('deslocamento', '')[:200], 'melee': t.get('corpo_a_corpo', '')[:1000], 'ranged': t.get('a_distancia', '')[:1000],
            'abilities': [{'name': a['name'][:200], 'text': a['text'][:8000]} for a in t['abilities'][:40]],
            'attributes': {k: t['attributes'].get(k) for k in ATTR}, 'skills': skills[:600], 'equipment': t.get('equipamento', '')[:600],
            'treasure': t.get('tesouro', '')[:400], 'description': '\n\n'.join(t['summary'])[:8000]}
    return entry('monster', t['name'][:1].upper() + t['name'][1:], data)


TREASURE_TABLES = [
    ('itens-diversos', 'Tabela 8-3: Itens Diversos', (337,), 1),
    ('equipamento', 'Tabela 8-4: Equipamento', (337,), 1),
    ('itens-superiores', 'Tabela 8-5: Itens Superiores', (338,), 1),
    ('pocoes', 'Tabela 8-12: Poções', (347,), 2),
    ('acessorios-menores', 'Tabela 8-13: Acessórios Menores', (348,), 2),
    ('acessorios-medios', 'Tabela 8-14: Acessórios Médios', (349,), 2),
    ('acessorios-maiores', 'Tabela 8-15: Acessórios Maiores', (349,), 2),
]


def treasure_tables(layout):
    """Tabelas de tesouro do capítulo 8 (kind 'table'), usadas para rolar tesouro por ND."""
    import bookkit
    import t20_treasure
    rows = bookkit.load(layout)
    out = [
        entry('table', 'Tabela 8-1: Tesouro por Nível de Desafio', {'title': 'Tabela 8-1: Tesouro por Nível de Desafio', 'format': 'nd', 'nd': t20_treasure.parse_nd_table(rows)}, key='tesouro-por-nd'),
        entry('table', 'Tabela 8-2: Riquezas', {'title': 'Tabela 8-2: Riquezas', 'format': 'riches', 'riches': t20_treasure.parse_riches(rows)}, key='riquezas'),
    ]
    for key, title, pages, values in TREASURE_TABLES:
        table = t20_treasure.parse_table(rows, title, pages, values)
        out.append(entry('table', title, {'title': title, 'format': 'd100', 'subtables': table['subtables']}, key=key))
    return out


# Capítulos com o título desenhado (imagem): número → nome.
IMAGE_CHAPTERS = {'8': 'Recompensas'}


def text_sections(layout):
    """Texto corrido do livro (todos os capítulos), do layout do PDF: capítulo → seção, subtítulos em Markdown.

    Títulos pelo tamanho da fonte do livro (Tormenta20-Regular): ≥ 60 capítulo, 26–27 seção, 16–21
    subtítulo. Capitulares (letra grande no começo do parágrafo) voltam para a frente da linha.
    Ficam de fora a abertura (créditos e sumário) e a ficha de personagem do fim.
    """
    import sections
    import bookkit
    rows = bookkit.load(layout)
    merged, carry = [], ''
    for r in rows:
        t = r.get('t', '')
        if r['s'] >= 40 and len(t.strip()) == 1 and t.strip().isalpha():
            carry = t.strip()
            continue
        if carry:
            t = carry + t.lstrip()
            carry = ''
        # Hífen opcional do fim da linha (U+00AD): vira hífen comum para a palavra se juntar.
        if t.rstrip().endswith('­'):
            t = t.rstrip()[:-1] + '-'
        r = {**r, 't': t.replace('­', '')}
        # Títulos em duas linhas ("O que é" / "Tormenta20?") viram um título só.
        prev = merged[-1] if merged else None
        if (prev and 'Tormenta20' in r['f'] and 'Tormenta20' in prev['f'] and 15.5 <= r['s'] < 60
                and abs(r['s'] - prev['s']) < 0.5 and r['p'] == prev['p'] and 0 < r['y'] - prev['y'] <= r['s'] * 1.6
                and prev['t'].strip() != r['t'].strip()):
            merged[-1] = {**prev, 't': f"{prev['t'].strip()} {r['t'].strip()}"}
            continue
        # Título de capítulo: impresso duas vezes (sombra) e em linhas de tamanhos diferentes
        # ("Construção de" / "personagem"); junta as partes da mesma página sem repetir.
        # Capítulo cujo título é imagem (só o número sai no texto do PDF).
        if 'Tormenta20' in r['f'] and r['s'] >= 40 and t.strip() in IMAGE_CHAPTERS:
            merged.append({**r, 's': 100, 't': IMAGE_CHAPTERS[t.strip()]})
            continue
        if r['s'] >= 60:
            part = ' '.join(r['t'].split())
            if part.isdigit():
                continue  # número do capítulo
            if prev and prev['s'] >= 60 and r['p'] == prev['p']:
                if part not in ' '.join(prev['t'].split()):
                    merged[-1] = {**prev, 't': f"{' '.join(prev['t'].split())} {part}"}
                continue
            r = {**r, 't': part}
        merged.append(r)

    def classify(r, t):
        title_font = 'Tormenta20' in r['f']
        if r['s'] >= 60:
            return 1
        if title_font and r['s'] >= 25.5:
            return 2
        if title_font and r['s'] >= 15.5:
            return 3
        if title_font:
            return -1  # números de página e marcadores
        return 0 if r['s'] >= 7.5 else -1

    found = sections.build(merged, classify, skip=lambda r, t: r['p'] <= 11 or r['p'] >= 405)
    out = []
    for e in found:
        out.append({'kind': 'section', 'key': e['key'], 'name': e['name'],
                    'data': {'chapter': e['data']['chapter'], 'order': e['data']['order'], 'body': e['data']['body']}})
    return out


def main():
    d = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
    entries = []
    entries += [race(r) for r in d['races']]
    entries += [klass(c) for c in d['classes']]
    entries += [origin(o) for o in d['origins']]
    entries += [deity(x) for x in d['deities']]
    for p in d['powers']:
        owners = [x['name'] for x in d['deities'] if p['name'] in x['grantedPowers']] if p['group'] == 'concedidos' else []
        entries.append(entry('feat', p['name'], {'group': p['group'], 'owners': owners, 'text': p['text'][:8000], 'prerequisite': p['prerequisite'][:400]}))
    for c in d['classes']:
        for p in c['powers']:
            if p['name']:
                entries.append(entry('feat', p['name'], {'group': 'classe', 'owners': [c['name']], 'text': p['text'][:8000], 'prerequisite': p['prerequisite'][:400]},
                                     key=slug(f"{c['name']}-{p['name']}")))
    for o in d['origins']:
        for p in o['uniquePowers']:
            entries.append(entry('feat', p['name'], {'group': 'origem', 'owners': [o['name']], 'text': p['text'][:8000], 'prerequisite': ''},
                                 key=slug(f"origem-{p['name']}")))
    entries += [spell(s) for s in d['spells']]
    for w in d['weapons']:
        # "Corpo a Corpo — Duas Mãos" → seção e empunhadura (Estilos de Uma Arma, Duas Mãos, arremesso).
        section = plain(w.get('group', ''))
        grip = 'duas' if 'duas' in section else 'leve' if 'leve' in section else 'uma' if 'uma' in section else None
        extra = {'attack': 'corpo' if section.startswith('corpo') else 'distancia'} if section else {}
        if grip:
            extra['grip'] = grip
        entries.append(entry('equipment', w['name'], {'group': 'arma', 'category': w['category'], 'price': w['price'], 'spaces': w['spaces'],
                                                       'damage': w['damage'], 'critical': w['critical'], 'range': w['range'],
                                                       'damageType': w['damageType'], 'text': w['text'][:8000], **extra},
                             key=slug(f"arma-{w['category']}-{w['name']}")))
    for a in d['armors']:
        entries.append(entry('equipment', a['name'], {'group': 'armadura', 'category': a['group'], 'price': a['price'], 'spaces': a['spaces'],
                                                       'defense': number(a['defense']), 'penalty': min(0, number(a['penalty'])), 'text': a['text'][:8000]}))
    for i in d['items']:
        if i['group'] == 'Magia' and re.match(r'^\d+º círculo$', i['name']):
            i = {**i, 'name': f"Lançamento de magia ({i['name']})"}  # serviço da tabela de preços
        entries.append(entry('equipment', i['name'], {'group': 'item', 'category': i['group'], 'price': i['price'], 'spaces': i['spaces'], 'text': i['text'][:8000]},
                             key=slug(f"item-{i['name']}")))
    for m in d['improvements']:
        entries.append(entry('equipment', m['name'], {'group': 'melhoria', 'category': m['group'], 'effect': m['effect'][:300], 'text': m['text'][:8000]},
                             key=slug(f"melhoria-{m['group']}-{m['name']}")))
    for m in d['magicItems']:
        entries.append(entry('magic_item', m['name'], {'kind': m['kind'], 'price': m['price'], 'effect': m['effect'][:300], 'text': m['text'][:12000]},
                             key=slug(f"{m['kind']}-{m['name']}")))
    entries += [threat(t) for t in d['threats']]
    if len(sys.argv) > 3:
        entries += text_sections(pathlib.Path(sys.argv[3]))
        entries += treasure_tables(pathlib.Path(sys.argv[3]))
    # Chaves repetidas (mesmo nome em grupos diferentes): sufixo numérico.
    seen = {}
    for e in entries:
        base = e['key']
        n = seen.get((e['kind'], base), 0)
        if n:
            e['key'] = f'{base[:76]}-{n + 1}'
        seen[(e['kind'], base)] = n + 1
    pack = {'format': 'codexveil.tormenta20.book', 'version': 1,
            'book': {'id': 't20-jda', 'name': 'Tormenta20 — Edição Jogo do Ano', 'category': 'core', 'edition': 'Jogo do Ano',
                     'origin': 'PDF do exemplar do usuário (uso pessoal, não distribuir)'},
            'entries': entries}
    pathlib.Path(sys.argv[2]).write_text(json.dumps(pack, ensure_ascii=False), encoding='utf-8')
    import collections
    print(sys.argv[2], dict(collections.Counter(e['kind'] for e in entries)))


if __name__ == '__main__':
    main()
