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
