"""Extrai do SRD 5.2.1 (Wizards of the Coast, CC-BY-4.0) as descrições das magias, os itens
mágicos e os blocos de estatísticas de monstros e animais, no formato usado por
`packages/rpg-systems/src/dnd5e/srd/data/`.

Uso:
    pdftotext -enc UTF-8 SRD_CC_v5.2.1.pdf srd.txt
    python -I scripts/srd/extract_srd.py srd.txt packages/rpg-systems/src/dnd5e/srd/data

O PDF oficial está em https://www.dndbeyond.com/srd. O texto continua em inglês, como no
original; a tradução dos campos estruturados para o português acontece no código
(`srd/catalog.ts`).
"""
import json
import pathlib
import re
import sys

source, out_dir = sys.argv[1], pathlib.Path(sys.argv[2])
out_dir.mkdir(parents=True, exist_ok=True)
raw = pathlib.Path(source).read_text(encoding='utf-8').split('\n')

FOOTER = re.compile(r'^\d+\s+System Reference Document 5\.2\.1$|^System Reference Document 5\.2\.1$|^\d+$')


def clean(line):
    return re.sub(r'[ \t ]+', ' ', line).strip()


lines = [clean(line) for line in raw]


def is_noise(line):
    return line == '' or bool(FOOTER.match(line))


def prev_text(i, floor=0):
    j = i - 1
    while j > floor and is_noise(lines[j]):
        j -= 1
    return j


ATTRIBUTION = (
    'This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards '
    'of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the '
    'Creative Commons Attribution 4.0 International License, available at '
    'https://creativecommons.org/licenses/by/4.0/legalcode.'
)

# ---------------------------------------------------------------------------- Magias
SCHOOLS = ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation']
SPELL_HEADER = re.compile(r'^(?:Level ([1-9]) (\w+)|(\w+) Cantrip) \(')
items_start = next(i for i, line in enumerate(lines) if line == 'Magic Items A–Z')
monsters_start = next(i for i, line in enumerate(lines) if line == 'Monsters A–Z')
glossary_start = next(i for i, line in enumerate(lines) if line.endswith('[Condition]')) - 400

spell_headers = []
for i, line in enumerate(lines):
    if i < 1000 or i > glossary_start + 400:
        continue
    m = SPELL_HEADER.match(line)
    if m and (m.group(2) or m.group(3)) in SCHOOLS:
        spell_headers.append(i)

spells = {}
spell_problems = []
for index, h in enumerate(spell_headers):
    name_line = prev_text(h)
    name = lines[name_line]
    # Fim do cabeçalho técnico: linha com "Duration:".
    k = h
    while k < h + 8 and 'Duration:' not in lines[k]:
        k += 1
    if 'Duration:' not in lines[k]:
        spell_problems.append(name)
        continue
    end = prev_text(spell_headers[index + 1]) if index + 1 < len(spell_headers) else min(k + 40, len(lines))
    paragraphs = []
    for j in range(k + 1, end):
        text = lines[j]
        if is_noise(text):
            continue
        if text in ('Rules Glossary',):
            break
        paragraphs.append(text)
    if not paragraphs:
        spell_problems.append(name)
    spells[name] = paragraphs

# ---------------------------------------------------------------------------- Itens mágicos
ITEM_TYPE = re.compile(r'^(Armor|Weapon|Wondrous Item|Potion|Ring|Rod|Scroll|Staff|Wand)(?: \(([^)]*)\))?, (.+)$')
RARITY_WORDS = ('Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact', 'Rarity Varies')
item_headers = []
for i in range(items_start, monsters_start):
    m = ITEM_TYPE.match(lines[i])
    if m and any(word in m.group(3) for word in RARITY_WORDS):
        item_headers.append(i)

magic_items = []
for index, h in enumerate(item_headers):
    m = ITEM_TYPE.match(lines[h])
    name = lines[prev_text(h)]
    rarity_text = m.group(3)
    attunement = re.search(r'\(Requires Attunement([^)]*)\)', rarity_text)
    rarity = re.sub(r'\s*\(Requires Attunement[^)]*\)', '', rarity_text).strip()
    if index + 1 < len(item_headers):
        end = prev_text(item_headers[index + 1])
    else:
        # O último item termina onde começa a introdução do capítulo de monstros.
        end = next(j for j in range(h + 1, monsters_start) if lines[j] == 'Stat Block Overview')
    paragraphs = [lines[j] for j in range(h + 1, end) if not is_noise(lines[j]) and lines[j] != 'Monsters']
    magic_items.append({
        'name': name,
        'category': m.group(1),
        'subtype': m.group(2) or '',
        'rarity': rarity,
        'attunement': (attunement.group(0)[1:-1] if attunement else ''),
        'description': paragraphs,
    })

# ---------------------------------------------------------------------------- Monstros e animais
SIZES = '(?:Tiny|Small|Medium|Large|Huge|Gargantuan)'
TYPES = '(?:Aberration|Beast|Celestial|Construct|Dragon|Elemental|Fey|Fiend|Giant|Humanoid|Monstrosity|Ooze|Plant|Undead|Swarm of (?:Tiny|Small|Medium) \\w+)'
TYPE_LINE = re.compile(rf'^({SIZES}(?: or {SIZES})?) ({TYPES})(?: \(([^)]*)\))?, (.+)$')
SECTIONS = {'Traits': 'traits', 'Actions': 'actions', 'Bonus Actions': 'bonusActions', 'Reactions': 'reactions', 'Legendary Actions': 'legendaryActions'}
ENTRY = re.compile(r"^([A-Z][A-Za-z’'\- ]{0,60}(?: \([^)]*\))?)\. (.*)$")
ABILITY = re.compile(r'\b(Str|Dex|Con|Int|Wis|Cha) (\d+) ([+−-]\d+) ([+−-]\d+)')
ABILITY_LOOSE = re.compile(r'\b(Str|Dex|Con|Int|Wis|Cha) ?(\d+)(?: ([+−-]\d+) ([+−-]?\d+))?(?= |$)')
DETAIL_KEYS = ['Skills', 'Resistances', 'Vulnerabilities', 'Immunities', 'Gear', 'Senses', 'Languages', 'CR']

monster_headers = [i for i in range(monsters_start, len(lines)) if TYPE_LINE.match(lines[i])]
monsters = []
monster_problems = []
for index, h in enumerate(monster_headers):
    m = TYPE_LINE.match(lines[h])
    name_line = prev_text(h)
    name = lines[name_line]
    end = prev_text(monster_headers[index + 1]) if index + 1 < len(monster_headers) else len(lines)
    body = [lines[j] for j in range(h + 1, end) if not is_noise(lines[j]) and lines[j] != 'Animals']
    # Combate: AC ... Initiative ... HP ... Speed ... até a tabela de atributos.
    # O pdftotext embaralha a tabela de atributos: às vezes a Iniciativa vem no meio dela, e os
    # modificadores de alguns atributos vêm depois, numa linha só de números, na mesma ordem.
    head_parts = []
    abilities = {}
    missing = []
    pos = 0
    while pos < len(body) and not any(body[pos].startswith(key + ' ') or body[pos] == key for key in DETAIL_KEYS) and body[pos] not in SECTIONS:
        text = body[pos]
        pos += 1
        if text.startswith('MOD SAVE'):
            continue
        if re.fullmatch(r'(?:[+−-]?\d+ ?)+', text) and missing:
            values = text.split()
            while values and missing:
                key = missing.pop(0)
                abilities[key]['mod'], abilities[key]['save'] = values[0].replace('−', '-'), values[1].replace('−', '-')
                values = values[2:]
            continue
        found = list(ABILITY_LOOSE.finditer(text))
        if found:
            for a in found:
                key = a.group(1).lower()
                abilities[key] = {'score': int(a.group(2)), 'mod': None, 'save': None}
                if a.group(3):
                    abilities[key]['mod'] = a.group(3).replace('−', '-')
                    save = a.group(4).replace('−', '-')
                    abilities[key]['save'] = save if save[0] in '+-' else '+' + save
                else:
                    missing.append(key)
            rest = ABILITY_LOOSE.sub('', text).strip()
            if rest:
                head_parts.append(rest)
            continue
        head_parts.append(text)
    head = ' '.join(head_parts)
    ac_match = re.search(r'\bAC (\d+)(?: \(([^)]*)\))?', head)
    init_match = re.search(r'Initiative ([+−-]\d+) \((\d+)\)', head)
    hp_match = re.search(r'\bHP (\d+)(?: \(([^)]*)\))?', head)
    speed_match = re.search(r'Speed (.*?)(?= Initiative [+−-]|$)', head)
    combat = ac_match and init_match and hp_match and speed_match
    if any(value['mod'] is None for value in abilities.values()):
        abilities = {}
    details_text = []
    while pos < len(body) and body[pos] not in SECTIONS:
        details_text.append(body[pos])
        pos += 1
    details_joined = ' '.join(details_text)
    details = {}
    marks = [(mm.start(), mm.group(1)) for mm in re.finditer(r'(?:(?<=^)|(?<= ))(Skills|Resistances|Vulnerabilities|Immunities|Gear|Senses|Languages|CR) ', details_joined)]
    for n, (start, key) in enumerate(marks):
        stop = marks[n + 1][0] if n + 1 < len(marks) else len(details_joined)
        details[key] = details_joined[start + len(key) + 1:stop].strip()
    sections = {value: [] for value in SECTIONS.values()}
    current = None
    for text in body[pos:]:
        if text in SECTIONS:
            current = SECTIONS[text]
            continue
        if current is None:
            continue
        if text.startswith('Legendary Action Uses:'):
            sections[current].append({'name': 'Legendary Action Uses', 'description': text[len('Legendary Action Uses:'):].strip()})
            continue
        entry = ENTRY.match(text)
        if entry:
            sections[current].append({'name': entry.group(1).strip(), 'description': entry.group(2).strip()})
        elif sections[current]:
            sections[current][-1]['description'] += '\n' + text
        else:
            sections[current].append({'name': '—', 'description': text})
    cr = re.match(r'([\d/]+)(?: \((.*)\))?', details.get('CR', ''))
    if not combat or len(abilities) != 6 or not cr:
        monster_problems.append({'name': name, 'combat': bool(combat), 'abilities': len(abilities), 'cr': details.get('CR', '')})
        continue
    immunities = details.get('Immunities', '')
    damage_imm, cond_imm = (immunities.split(';', 1) + [''])[:2] if ';' in immunities else (immunities, '')
    CONDITIONS = ('Blinded', 'Charmed', 'Deafened', 'Exhaustion', 'Frightened', 'Grappled', 'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious')
    if ';' not in immunities and immunities and all(part.strip() in CONDITIONS for part in immunities.split(',')):
        damage_imm, cond_imm = '', immunities
    monsters.append({
        'name': name,
        'size': m.group(1),
        'type': m.group(2),
        'tags': m.group(3) or '',
        'alignment': m.group(4),
        'ac': int(ac_match.group(1)),
        'acNote': ac_match.group(2) or '',
        'initiative': init_match.group(1).replace('−', '-'),
        'hp': int(hp_match.group(1)),
        'hpFormula': hp_match.group(2) or '',
        'speed': speed_match.group(1).strip(),
        'abilities': abilities,
        'skills': details.get('Skills', ''),
        'resistances': details.get('Resistances', ''),
        'vulnerabilities': details.get('Vulnerabilities', ''),
        'damageImmunities': damage_imm.strip(),
        'conditionImmunities': cond_imm.strip(),
        'gear': details.get('Gear', ''),
        'senses': details.get('Senses', ''),
        'languages': details.get('Languages', ''),
        'cr': cr.group(1),
        'crDetail': cr.group(2) or '',
        'animal': h >= next(i for i, line in enumerate(lines) if line == 'Animals'),
        **sections,
    })

# Nomes com apóstrofo reto, como na lista de magias do Codexveil ("Hunter's Mark").
spells = {name.replace('’', "'"): paragraphs for name, paragraphs in spells.items()}
for entry in magic_items + monsters:
    entry['name'] = entry['name'].replace('’', "'")

ORDER = ['str', 'dex', 'con', 'int', 'wis', 'cha']
for monster in monsters:
    monster['abilities'] = {key: monster['abilities'][key] for key in ORDER}
    monster['hpFormula'] = monster['hpFormula'].replace('−', '-')


def dump(name, data):
    text = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    (out_dir / name).write_text(text + chr(10), encoding='utf-8')


dump('spell-texts.json', spells)
dump('magic-items.json', magic_items)
dump('monsters.json', monsters)
print(f'magias: {len(spells)} (problemas: {spell_problems})')
print(f'itens mágicos: {len(magic_items)}')
print(f'monstros: {len(monsters)} (animais: {sum(1 for x in monsters if x["animal"])}); problemas: {len(monster_problems)}')
for problem in monster_problems[:30]:
    print('  -', problem)
if spell_problems or monster_problems:
    sys.exit(1)
