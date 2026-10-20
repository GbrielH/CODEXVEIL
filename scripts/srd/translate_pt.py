"""
Tradução do SRD 5.2.1 (CC-BY-4.0) para o português, feita pelo Codexveil.

Gera `packages/rpg-systems/src/dnd5e/srd/data/monsters.pt.json` e `magic-items.pt.json`, que a
aplicação sobrepõe aos dados originais (o nome em inglês continua sendo o identificador).

Como funciona:
  * frases mecânicas dos blocos de estatísticas (jogadas de ataque, acerto, salvaguardas, falha e
    sucesso) são traduzidas por regras, sempre com os mesmos termos;
  * as demais frases vêm dos dicionários em `scripts/srd/pt/` (chave = frase original com os
    números trocados por {n}); nomes de monstros, de habilidades e de itens também;
  * distâncias em pés viram metros (5 pés = 1,5 m).

Uso:
  python scripts/srd/translate_pt.py            # gera os arquivos e lista o que falta traduzir
  python scripts/srd/translate_pt.py --missing  # só grava as pendências em scripts/srd/pt/missing-*.json
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'packages' / 'rpg-systems' / 'src' / 'dnd5e' / 'srd' / 'data'
DICTS = Path(__file__).resolve().parent / 'pt'

ABILITIES = {
    'Strength': 'Força', 'Dexterity': 'Destreza', 'Constitution': 'Constituição',
    'Intelligence': 'Inteligência', 'Wisdom': 'Sabedoria', 'Charisma': 'Carisma',
}
DAMAGE = {
    'Acid': 'Ácido', 'Bludgeoning': 'Concussão', 'Cold': 'Frio', 'Fire': 'Fogo', 'Force': 'Energia',
    'Lightning': 'Elétrico', 'Necrotic': 'Necrótico', 'Piercing': 'Perfurante', 'Poison': 'Veneno',
    'Psychic': 'Psíquico', 'Radiant': 'Radiante', 'Slashing': 'Cortante', 'Thunder': 'Trovejante',
}
NUM = re.compile(r'\d+(?:,\d{3})*(?:\.\d+)?')


def load_spell_names() -> dict:
    source = (ROOT / 'packages' / 'rpg-systems' / 'src' / 'dnd5e' / 'srd' / 'spell-names-pt.ts').read_text(encoding='utf8')
    pairs = re.findall(r'''^\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z]+)): (?:'([^']+)'|"([^"]+)"),''', source, re.M)
    return {(a or b or c): (d or e) for a, b, c, d, e in pairs}


def load(name: str) -> dict:
    path = DICTS / name
    return json.loads(path.read_text(encoding='utf8')) if path.exists() else {}


def meters(feet: float) -> str:
    value = round(feet * 0.3 * 10) / 10
    text = str(int(value)) if value == int(value) else str(value)
    return text.replace('.', ',')


def convert_feet(text: str) -> str:
    """Pés para metros no texto já traduzido (mantém "ft." e "pés" do original e da tradução)."""
    text = re.sub(r'(\d[\d,]*)/(\d[\d,]*) ?(?:ft\.?|pés)', lambda m: f"{meters(float(m[1].replace(',', '')))}/{meters(float(m[2].replace(',', '')))} m", text)
    text = re.sub(r'(\d[\d,]*)(?: |-)(?:ft\.?|feet|foot|pés|pé)(?![a-z])(?! (?:cúbicos|quadrados))', lambda m: f"{meters(float(m[1].replace(',', '')))} m", text)
    # Libras para quilos (1 libra ≈ 0,5 kg), como nos livros em português.
    text = re.sub(r'(\d[\d,]*) libras?', lambda m: f"{kilos(float(m[1].replace(',', '')))} kg", text)
    return text


def kilos(pounds: float) -> str:
    value = pounds / 2
    text = str(int(value)) if value == int(value) else str(value)
    return text.replace('.', ',')


def template(sentence: str) -> tuple[str, list[str]]:
    numbers = NUM.findall(sentence)
    return NUM.sub('{n}', sentence), numbers


def fill(text: str, numbers: list[str]) -> str:
    out = text
    for number in numbers:
        out = out.replace('{n}', number, 1)
    return out


NOUN_DAMAGE = {'Cold', 'Fire', 'Poison', 'Force', 'Bludgeoning'}


def damage_word(kind: str) -> str:
    """Fogo, Frio, Veneno, Energia e Concussão são substantivos ("dano de Fogo"); os outros, adjetivos ("dano Ácido")."""
    return f'de {DAMAGE[kind]}' if kind in NOUN_DAMAGE else DAMAGE[kind]


def damage_list(text: str) -> str | None:
    """'14 (2d8 + 5) Piercing damage plus 7 (2d6) Poison damage' → '14 (2d8 + 5) de dano Perfurante mais …'."""
    part = r'(\d+(?: \([^)]*\))?) (' + '|'.join(DAMAGE) + r') damage'
    if not re.fullmatch(part + r'(?:(?:,| plus| and)(?: plus| and)? ' + part + r')*', text):
        return None
    return re.sub(part, lambda m: f'{m[1]} de dano {damage_word(m[2])}', text).replace(' plus ', ' mais ').replace(', and ', ' e ').replace(' and ', ' e ')


def area(text: str) -> str | None:
    rules = [
        (r'each creature in an? (\d+)-foot Cone', lambda m: f'cada criatura num Cone de {m[1]} pés'),
        (r'each creature in an? (\d+)-foot Cube', lambda m: f'cada criatura num Cubo de {m[1]} pés'),
        (r'each creature in an? (\d+)-foot-radius Sphere', lambda m: f'cada criatura numa Esfera de {m[1]} pés de raio'),
        (r'each creature in an? (\d+)-foot-long, (\d+)-foot ?wide Line', lambda m: f'cada criatura numa Linha de {m[1]} pés de comprimento e {m[2]} pés de largura'),
    ]
    for pattern, build in rules:
        match = re.fullmatch(pattern, text)
        if match:
            return build(match)
    return None


PREFIXES = {
    'Failure or Success': 'Falha ou Sucesso', 'Failure': 'Falha', 'Success': 'Sucesso', 'First Failure': 'Primeira Falha',
    'Second Failure': 'Segunda Falha', 'Third Failure': 'Terceira Falha', 'Trigger': 'Gatilho', 'Response': 'Resposta',
    'At Will': 'À vontade', 'Hit or Miss': 'Acerto ou Erro', 'Miss': 'Erro',
}


def spell_list(text: str) -> str | None:
    """'Acid Arrow (level 3 version), Detect Magic, Fear' → nomes das magias em português."""
    out = []
    text = re.sub(r'(\w)- (\w)', r'\1\2', text.rstrip('.'))  # hifenização do PDF: "En- tangle"
    parts = [part.strip() for part in re.split(r',\s*(?![^()]*\))', text) if part.strip()]  # vírgulas fora de parênteses
    for raw in parts:
        m = re.fullmatch(r'(.*?)(?: \((.*)\))?', raw)
        name, note = m[1].strip(), m[2]
        pt = SPELLS.get(name) or SPELLS.get(name.replace('’', "'"))
        # Título de página colado no fim da lista ("Control Weather Succubus"): tira palavras do fim.
        words = name.split()
        while pt is None and len(words) > 1:
            words.pop()
            candidate = ' '.join(words)
            pt = SPELLS.get(candidate) or SPELLS.get(candidate.replace('’', "'"))
        if pt is None:
            MISSING[f'[magia] {name}'] = name
            return None
        if note:
            note = (re.sub(r'level (\d+) version', r'versão de \1º círculo', note).replace('as an action', 'como ação').replace('self only', 'só em si')
                    .replace('Beast or Humanoid form only', 'só formas de Fera ou Humanoide')
                    .replace('and no Concentration or Temporary Hit Points required to maintain the spell', 'sem Concentração nem Pontos de Vida Temporários para manter a magia')
                    .replace('and the hag leaves no tracks while Invisible', 'e a bruxa não deixa rastros enquanto estiver Invisível')
                    .replace('no Temporary Hit Points gained from the spell', 'sem ganhar os Pontos de Vida Temporários da magia'))
        out.append(f'{pt} ({note})' if note else pt)
    return ', '.join(out)


def rule(sentence: str) -> str | None:
    s = sentence.strip()
    m = re.fullmatch(r'(Melee|Ranged|Melee or Ranged) Attack Roll: ([+-]\d+)(?: \((.*?)\))?(?:, (.*))?\.?', s)
    if m:
        kind = {'Melee': 'Corpo a Corpo', 'Ranged': 'à Distância', 'Melee or Ranged': 'Corpo a Corpo ou à Distância'}[m[1]]
        rest = (m[4] or '').replace('reach', 'alcance').replace('range', 'distância').replace(' or ', ' ou ')
        note = ''
        if m[3]:
            inner = translate_fragment(m[3])
            if inner is None:
                return None
            note = f' ({inner})'
        return f'Jogada de Ataque {kind}: {m[2]}{note}' + (f', {rest}' if rest else '') + '.'
    m = re.fullmatch(r'Hit: (.*?)\.', s)
    if m:
        dmg = damage_list(m[1])
        if dmg:
            return f'Acerto: {dmg}.'
        cut = re.fullmatch(r'(.*? damage)(,? (?:and|or) .*|\. .*)', m[1])
        if cut and damage_list(cut[1]):
            tail = translate_fragment(cut[2].lstrip(',. ') + '.')
            return f'Acerto: {damage_list(cut[1])}{"," if cut[2].startswith(",") else ""} {tail}' if tail else None
        rest = translate_fragment(m[1] + '.')
        return f'Acerto: {rest}' if rest else None
    m = re.fullmatch(r'(' + '|'.join(sorted(PREFIXES, key=len, reverse=True)) + r'): (.*)', s)
    if m:
        label = PREFIXES[m[1]]
        if m[1] == 'At Will':
            spells = spell_list(m[2])
            return f'{label}: {spells}' if spells else None
        inner = m[2]
        dmg = damage_list(inner.rstrip('.'))
        if dmg:
            return f'{label}: {dmg}.'
        cut = re.fullmatch(r'(.*? damage)(,? (?:and|or) .*)', inner.rstrip('.'))
        if cut and damage_list(cut[1]):
            tail = translate_fragment(cut[2].lstrip(', ') + '.')
            return f'{label}: {damage_list(cut[1])}, {tail}' if tail else None
        sub = translate_sentence(inner)
        return f'{label}: {sub}' if sub else None
    m = re.fullmatch(r'(\d+)/Day(?: Each)?: (.*)', s)
    if m:
        spells = spell_list(m[2].rstrip('.'))
        return f'{m[1]}/Dia cada: {spells}' if spells else None
    if s == 'Half damage.':
        return 'Metade do dano.'
    if s == 'Half damage only.':
        return 'Apenas metade do dano.'
    m = re.fullmatch(r'(' + '|'.join(ABILITIES) + r') Saving Throw: DC (\d+)(?:, (.*?))?\.', s)
    if m:
        head = f'Salvaguarda de {ABILITIES[m[1]]}: CD {m[2]}'
        if not m[3]:
            return head + '.'
        where = area(m[3]) or translate_fragment(m[3])
        return f'{head}, {where}.' if where else None
    m = re.fullmatch(r'(\d+) \((\d+) in Lair\)\.', s)
    if m:
        return f'{m[1]} ({m[2]} no Covil).'
    return None


REFERENTS: dict[str, list[str]] = {}
CURRENT_REF: list[str] = ['']


def generalize(key: str) -> str | None:
    """Troca "the aboleth"/"The aboleth" pela criatura genérica ({c}/{C}) da frase."""
    ref = CURRENT_REF[0]
    if not ref or not re.search(r'\b[Tt]he ' + re.escape(ref) + r'\b', key):
        return None
    key = re.sub(r'\bThe ' + re.escape(ref) + r'\b', '{C}', key)
    return re.sub(r'\bthe ' + re.escape(ref) + r'\b', '{c}', key)


def fill_ref(text: str) -> str:
    """{O} O balor / A medusa; {o}; {do} do/da; {ao} ao/à; {no} no/na; {pelo} pelo/pela; {um} um/uma."""
    ref = CURRENT_REF[0]
    if not ref or ref not in REFERENTS:
        return text
    noun, gender = REFERENTS[ref]
    fem = gender == 'f'
    forms = {
        '{O}': ('A ' if fem else 'O ') + noun, '{o}': ('a ' if fem else 'o ') + noun, '{do}': ('da ' if fem else 'do ') + noun,
        '{ao}': ('à ' if fem else 'ao ') + noun, '{no}': ('na ' if fem else 'no ') + noun, '{pelo}': ('pela ' if fem else 'pelo ') + noun,
        '{um}': ('uma ' if fem else 'um ') + noun, '{-o}': 'a' if fem else 'o', '{-e}': 'a' if fem else 'e', '{ele}': 'ela' if fem else 'ele',
        '{Ele}': 'Ela' if fem else 'Ele', '{dele}': 'dela' if fem else 'dele', '{nele}': 'nela' if fem else 'nele',
    }
    for token, value in forms.items():
        text = text.replace(token, value)
    return text


COUNTS = {'one': ('um', 'uma'), 'two': ('dois', 'duas'), 'three': ('três', 'três'), 'four': ('quatro', 'quatro'), 'five': ('cinco', 'cinco'), 'six': ('seis', 'seis'), 'seven': ('sete', 'sete'), 'eight': ('oito', 'oito')}
ENTRY_NAMES: dict[str, str] = {}
SPELL_ONLY: dict[str, str] = {}


def action_name(name: str) -> str | None:
    return ENTRY_NAMES.get(name) or SPELLS.get(name)


def names_list(text: str) -> str | None:
    parts = [part.strip() for part in re.split(r',\s*(?:or\s+)?|\s+or\s+', text) if part.strip()]
    out = [action_name(part) for part in parts]
    if not out or any(name is None for name in out):
        return None
    return ', '.join(out[:-1]) + (' ou ' if len(out) > 1 else '') + out[-1] if len(out) > 1 else out[0]


def attack_rules(general: str) -> str | None:
    """Frases de Ataques Múltiplos e de substituição de ataque, montadas com os nomes traduzidos."""
    m = re.fullmatch(r'\{C\} makes (one|two|three|four|five|six|seven|eight) ([A-Z][\w’ -]*?) attacks?\.', general)
    if m and action_name(m[2]):
        return f'{{O}} faz {COUNTS[m[1]][0]} ataque{"s" if m[1] != "one" else ""} de {action_name(m[2])}.'
    m = re.fullmatch(r'\{C\} makes (one|two|three|four|five|six) attacks, using (.+?) in any combination\.', general)
    if m and names_list(m[2]):
        return f'{{O}} faz {COUNTS[m[1]][0]} ataques, usando {names_list(m[2])} em qualquer combinação.'
    m = re.fullmatch(r'\{C\} makes (one|two|three|four) ([A-Z][\w’ -]*?) attacks? and (one|two|three|four) ([A-Z][\w’ -]*?) attacks?\.', general)
    if m and action_name(m[2]) and action_name(m[4]):
        a = f'{COUNTS[m[1]][0]} ataque{"s" if m[1] != "one" else ""} de {action_name(m[2])}'
        b = f'{COUNTS[m[3]][0]} ataque{"s" if m[3] != "one" else ""} de {action_name(m[4])}'
        return f'{{O}} faz {a} e {b}.'
    m = re.fullmatch(r'It can replace (one|two|three) attacks? with a use of ([A-Z][\w’ -]*?)( if available)?\.', general)
    if m and action_name(m[2]):
        return f'Ele pode substituir {COUNTS[m[1]][0]} ataque{"s" if m[1] != "one" else ""} por um uso de {action_name(m[2])}{" se disponível" if m[3] else ""}.'
    m = re.fullmatch(r'It can replace one attack with a use of Spellcasting to cast ([A-Z][\w’/ -]*?)(?: \(level \{n\} version\))?\.', general)
    if m and SPELLS.get(m[1]):
        level = ' (versão de {n}º círculo)' if 'level {n} version' in general else ''
        return f'Ele pode substituir um ataque por um uso de Conjuração para lançar {SPELLS[m[1]]}{level}.'
    m = re.fullmatch(r'\{C\} uses Spellcasting to cast ([A-Z][\w’/ -]*?)(?: \(level \{n\} version\))?\.', general)
    if m and SPELLS.get(m[1]):
        level = ' (versão de {n}º círculo)' if 'level {n} version' in general else ''
        return f'{{O}} usa Conjuração para lançar {SPELLS[m[1]]}{level}.'
    m = re.fullmatch(r'\{C\} casts (?:the )?([A-Z][\w’/ -]*?)(?: spell)?, (requiring no (?:spell|Material) components and )?using (Intelligence|Wisdom|Charisma) as the spellcasting ability \(spell save DC \{n\}\)\.', general)
    if m and names_list(m[1].replace(', or ', ', ').replace(' or ', ', ')):
        req = ' sem precisar de componentes ' + ('de magia' if m[2] and 'spell' in m[2] else 'Materiais') + ' e' if m[2] else ''
        return f'{{O}} lança {names_list(m[1].replace(", or ", ", ").replace(" or ", ", "))},{req} usando {ABILITIES[m[3]]} como atributo de conjuração (CD de salvaguarda das magias {{n}}).'
    return None


def lookup(raw: str) -> str | None:
    key, numbers = template(raw.strip())
    if key in SENTENCES:
        return fill_ref(fill(SENTENCES[key], numbers))
    general = generalize(key)
    if general and general in SENTENCES:
        return fill_ref(fill(SENTENCES[general], numbers))
    built = attack_rules(general or key)
    if built:
        return fill_ref(fill(built, numbers))
    MISSING[general or key] = raw.strip()
    return None


def translate_fragment(fragment: str) -> str | None:
    """Pedaço de frase (área de salvaguarda, complemento de acerto): dicionário."""
    return lookup(fragment)


SENTENCES: dict[str, str] = {}
SPELLS: dict[str, str] = {}
MISSING: dict[str, str] = {}


def translate_sentence(sentence: str, allow_missing: bool = False) -> str | None:
    by_rule = rule(sentence)
    if by_rule:
        return by_rule
    # Fragmentos de tabela só com números ("1–4", "2d6 7–9") passam como estão.
    if not re.search(r'[A-Za-z]{2,}', sentence):
        return sentence.strip()
    s = sentence.strip()
    # Frases com prefixo/regra cuja parte livre falta já registraram só essa parte.
    if re.match(r'(Melee|Ranged|Hit|' + '|'.join(PREFIXES) + r'|\d+/Day Each)\b.*?:', s) or re.match(r'(' + '|'.join(ABILITIES) + r') Saving Throw:', s):
        key, numbers = template(s)
        return fill_ref(fill(SENTENCES[key], numbers)) if key in SENTENCES else None
    return lookup(s)


def split_sentences(text: str) -> list[str]:
    return [part for part in re.split(r'(?<=[.!?])\s+(?=[A-Z“"(])', text.strip()) if part]


HEADING = re.compile(r"[A-Z][\w’'-]*(?: (?:of|the|[A-Z][\w’'-]*))*")


def clean_lines(text: str) -> list[str]:
    """Linhas do texto, sem os títulos de página que a extração do PDF deixou no fim ("Ankheg")."""
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    while lines and HEADING.fullmatch(lines[-1]) and len(lines[-1].split()) <= 5:
        lines.pop()
    # Linhas quebradas no meio da frase pela extração do PDF voltam a ser uma só.
    merged: list[str] = []
    for line in lines:
        if merged and not re.search(r'[.:!?)]$', merged[-1]):
            merged[-1] = f'{merged[-1]} {line}'
        else:
            merged.append(line)
    return merged


def translate_text(text: str) -> str | None:
    out_lines = []
    complete = True
    for line in clean_lines(text):
        line = re.sub(r'-foot- ?wide', '-foot-wide', line).replace('-footwide', '-foot-wide')
        line = re.sub(r'(Trigger|Response)—', r'\1: ', line)
        # Listas de magias ("At Will: …, 1/Day Each: …") viram frases separadas.
        line = re.sub(r':\s+(?=At Will:|\d+/Day(?: Each)?:)', ':\n', line)
        line = re.sub(r'(?<=[a-z)])\s+(?=\d+/Day(?: Each)?:)', '\n', line)
        for piece in line.split('\n'):
            parts = []
            for sentence in split_sentences(piece):
                pt = translate_sentence(sentence)
                if pt is None:
                    complete = False
                    parts.append(sentence)
                else:
                    parts.append(pt)
            out_lines.append(' '.join(parts))
    return convert_feet('\n'.join(out_lines)) if complete else None


def entry_name(name: str, names: dict) -> str | None:
    """Nome de habilidade com sufixo entre parênteses ("Recharge 5–6", "3/Day"…) traduzido por regra."""
    m = re.fullmatch(r'(.*?)(?: \((.*)\))?', name)
    base, suffix = m[1], m[2]
    pt = names.get(base)
    if pt is None:
        MISSING_NAMES[base] = base
        return None
    if suffix:
        s = (suffix.replace('Recharge', 'Recarga').replace('/Day', '/Dia').replace(' in Lair', ' no Covil').replace(', or ', ', ou ')
             .replace('Requires ', 'Exige ').replace('Each', 'Cada'))
        s = re.sub(r'(\d+)/Turn', r'\1/Turno', s)
        return f'{pt} ({s})'
    return pt


MISSING_NAMES: dict[str, str] = {}


def monster_referent(monster: dict) -> str:
    """Como o texto chama a criatura ("the dragon", "the pit fiend")."""
    text = ' '.join(e['description'] for k in ('traits', 'actions', 'bonusActions', 'reactions', 'legendaryActions') for e in monster.get(k) or [])
    tokens = monster['name'].lower().replace("'", '’').split()
    candidates = [' '.join(tokens[i:]) for i in range(len(tokens))] + [tokens[0]]
    best, count = '', 0
    for candidate in candidates:
        found = len(re.findall(r'\bthe ' + re.escape(candidate) + r'\b', text, re.I))
        if found > count:
            best, count = candidate, found
    return best


def build_monsters() -> tuple[dict, int, int]:
    monsters = json.loads((DATA / 'monsters.json').read_text(encoding='utf8'))
    names = load('monster-names.json')
    entry_names = load('monster-entry-names.json')
    # Exceções traduzidas à mão (texto do PDF quebrado ou fórmula fora do padrão).
    overrides = load('monster-overrides.json')
    out: dict = {}
    total = done = 0
    REFERENTS.update(load('monster-referents.json'))
    ENTRY_NAMES.update(load('monster-entry-names.json'))
    for monster in monsters:
        CURRENT_REF[0] = monster_referent(monster)
        record: dict = {'name': names.get(monster['name'])}
        if record['name'] is None:
            MISSING_NAMES[monster['name']] = monster['name']
        for section in ('traits', 'actions', 'bonusActions', 'reactions', 'legendaryActions'):
            items = []
            for entry in monster.get(section) or []:
                total += 1
                text = overrides.get(f"{monster['name']}|{entry['name']}") or translate_text(entry['description'])
                name = entry_name(entry['name'], entry_names)
                if text is not None and name is not None:
                    done += 1
                items.append({'name': name, 'description': text})
            if items:
                record[section] = items
        out[monster['name']] = record
    return out, done, total


def build_items() -> tuple[dict, int, int]:
    CURRENT_REF[0] = ''
    items = json.loads((DATA / 'magic-items.json').read_text(encoding='utf8'))
    names = load('item-names.json')
    subtypes = load('item-subtypes.json')
    out: dict = {}
    total = done = 0
    for item in items:
        paragraphs = []
        for paragraph in item['description']:
            total += 1
            pt = translate_text(paragraph)
            if pt is not None:
                done += 1
            paragraphs.append(pt)
        if names.get(item['name']) is None:
            MISSING_NAMES[item['name']] = item['name']
        out[item['name']] = {'name': names.get(item['name']), 'subtype': subtypes.get(item['subtype'], None) if item['subtype'] else '', 'description': paragraphs}
    return out, done, total


def main() -> None:
    global SENTENCES
    SENTENCES = {**load('monster-sentences.json'), **load('item-sentences.json')}
    SPELLS.update(load_spell_names())
    monsters, m_done, m_total = build_monsters()
    monster_missing = dict(MISSING)
    MISSING.clear()
    items, i_done, i_total = build_items()
    item_missing = dict(MISSING)
    (DICTS / 'missing-monster-sentences.json').write_text(json.dumps(monster_missing, ensure_ascii=False, indent=1), encoding='utf8')
    (DICTS / 'missing-item-sentences.json').write_text(json.dumps(item_missing, ensure_ascii=False, indent=1), encoding='utf8')
    (DICTS / 'missing-names.json').write_text(json.dumps(sorted(MISSING_NAMES), ensure_ascii=False, indent=1), encoding='utf8')
    if '--missing' not in sys.argv:
        (DATA / 'monsters.pt.json').write_text(json.dumps(monsters, ensure_ascii=False, separators=(',', ':')), encoding='utf8')
        (DATA / 'magic-items.pt.json').write_text(json.dumps(items, ensure_ascii=False, separators=(',', ':')), encoding='utf8')
    print(f'monstros: {m_done}/{m_total} entradas; itens: {i_done}/{i_total} parágrafos')
    print(f'frases pendentes: monstros {len(monster_missing)}, itens {len(item_missing)}; nomes pendentes {len(MISSING_NAMES)}')


if __name__ == '__main__':
    main()
