"""Extração do Tormenta20 (edição Jogo do Ano) a partir das linhas do layout.py.

Uso: python -X utf8 scripts/books/t20.py <layout/T20.jsonl> <saída.json>

O PDF tem texto limpo: títulos em `Tormenta20-Regular` (27 = raça/classe, 21 = seção, 16 =
subseção), corpo em `IowanOldStyle-Roman` 9,5, entradas com o nome em negrito no começo da linha
("Nome. texto", detectado em `lead`) e listas com "•". As páginas são as do PDF (iguais ao sumário).
"""
import json, re, sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from bookkit import clean, join_lines, slug  # noqa: E402

TITLE = 'Tormenta20-Regular'
SOFT_HYPHEN = chr(0xAD)
BODY_FONTS = ('IowanOldStyle-Roman', 'IowanOldStyle-Bold', 'IowanOldStyle-Italic', 'IowanOldStyle-BoldIt', 'IowanOldStyle-Black')
ATTRS = {'forca': 'for', 'destreza': 'des', 'constituicao': 'con', 'inteligencia': 'int', 'sabedoria': 'sab', 'carisma': 'car'}


def plain(text):
    import unicodedata
    text = unicodedata.normalize('NFD', text)
    return ''.join(ch for ch in text if unicodedata.category(ch) != 'Mn').lower()


class Book:
    def __init__(self, rows):
        self.rows = rows
        # Hífen de quebra (soft hyphen) no fim da linha vira "-" para `join_lines` juntar a palavra.
        self.texts = [clean(r['t']) + ('-' if r['t'].rstrip().endswith(SOFT_HYPHEN) else '') for r in rows]
        for i, r in enumerate(rows):
            if r['y'] > 735:  # rodapé: "Capítulo Um", "Construção de Personagem", número da página
                self.texts[i] = ''
            # Ornamento de fim de texto (glifo "e" depois do ponto final): "por um dia. e".
            self.texts[i] = re.sub(r'([.!?)])\s+e$', r'\1', self.texts[i])

    def is_title(self, i, size):
        r = self.rows[i]
        return r['f'].startswith(TITLE) and abs(r['s'] - size) <= 0.6

    def is_body(self, i):
        r = self.rows[i]
        # Itálico é fala de personagem, exceto quando a linha começa com um nome em negrito
        # (o PDF marca alguns parágrafos de itens mágicos como itálico).
        return r['f'].startswith(BODY_FONTS) and 9.0 <= r['s'] <= 10.0 and (not r['f'].startswith('IowanOldStyle-Italic') or bool(r['lead']))

    def is_body_size(self, i):
        return 9.0 <= self.rows[i]['s'] <= 10.0

    def index_of_page(self, page):
        return next(i for i, r in enumerate(self.rows) if r['p'] >= page)

    def titles(self, size, first_page, last_page):
        """Títulos (juntando linhas quebradas) num intervalo de páginas: [(índice, texto)]."""
        out = []
        for i, r in enumerate(self.rows):
            if not (first_page <= r['p'] <= last_page) or not self.is_title(i, size):
                continue
            if out and out[-1][0] == i - 1:
                out[-1] = (out[-1][0], f'{out[-1][1]} {self.texts[i]}')
            else:
                out.append((i, self.texts[i]))
        return out

    def is_bold(self, i):
        return 'Bold' in self.rows[i]['f'] or 'Black' in self.rows[i]['f']

    def entries(self, start, stop, bullets=True):
        """Entradas "Nome. texto" e itens "• Nome. texto" entre dois índices.

        O nome é o trecho em negrito no começo (às vezes em linhas só de negrito, quando o texto
        contorna uma imagem) até o primeiro ponto. Devolve [{'name', 'text', 'row', 'bullet'}].
        """
        out, current, pending = [], None, None  # pending = nome em negrito ainda sem ponto final
        for i in range(start, stop):
            r, t = self.rows[i], self.texts[i]
            if not t:
                continue
            if r['f'].startswith(TITLE) and r['s'] >= 12:
                current, pending = None, None
                continue
            if r['f'].startswith('SourceSansPro'):
                pending = None  # linha de tabela: o negrito acima era o cabeçalho ("d% Acessório Preço")
                continue
            if not self.is_body(i) and not (self.is_bold(i) and 9.0 <= r['s'] <= 10.0 and r['f'].startswith('IowanOldStyle')):
                continue
            if self.is_bold(i) and r['s'] >= 9.9:
                continue  # cabeçalho de tabela ("d% Acessório Preço", "Nível Habilidades de Classe")
            bullet = bullets and t.startswith('•')
            body = t.lstrip('•	 ').strip()
            if self.is_bold(i) and not r['f'].startswith('IowanOldStyle-Italic'):
                # Linha toda em negrito: começa (ou continua) um nome.
                pending = join_lines([pending, body]) if pending else body
                if bullet:
                    pending = body
                if '.' in pending:
                    name, _, rest = pending.partition('.')
                    current = {'name': name.strip(), 'lines': [rest.strip()] if rest.strip() else [], 'row': i, 'bullet': bullet}
                    out.append(current)
                    pending = None
                continue
            lead = clean(r['lead'] or '')
            if pending is not None:
                # Nome em negrito quebrado: termina no começo desta linha ("redrimm.").
                tail = lead if lead else ''
                name = join_lines([pending, tail]) if tail else pending
                rest = body[len(tail):].strip() if tail and body.startswith(tail) else body
                current = {'name': name.rstrip('.').strip(), 'lines': [rest] if rest else [], 'row': i, 'bullet': False}
                out.append(current)
                pending = None
                continue
            m = re.match(r'^([^.:]{2,80}?)\.\s+(.*)$', body)
            # Um nome em destaque só abre entrada se for o nome inteiro ("Aparar."); um termo em itálico no
            # começo da linha ("Amedrontar (atributo-chave Carisma). Esta…") continua o texto anterior.
            lead_is_name = bool(lead) and lead.lstrip('•	 ')[:1].isupper() and (lead.rstrip().endswith('.') or m is not None and m.group(1).strip() == lead.strip())
            if (lead_is_name and m and body.startswith(lead.rstrip('.').split()[0] if lead.split() else lead)) or (bullet and m):
                current = {'name': m.group(1).strip(), 'lines': [m.group(2)], 'row': i, 'bullet': bullet}
                out.append(current)
            elif bullet:
                current = {'name': '', 'lines': [body], 'row': i, 'bullet': True}
                out.append(current)
            elif current is not None:
                current['lines'].append(t)
        for e in out:
            e['text'] = join_lines(e.pop('lines'))
        return out

    def paragraphs(self, start, stop, italic=False):
        """Parágrafos de corpo (sem títulos e quadros) entre dois índices."""
        paras, current, last = [], [], None
        for i in range(start, stop):
            r, t = self.rows[i], self.texts[i]
            if not t:
                continue
            ok = self.is_body(i) or (italic and r['f'].startswith('IowanOldStyle-Italic') and 9.0 <= r['s'] <= 10.0)
            if not ok:
                continue
            new = last is None or r['lead'] or (r['p'], r['c']) != (last['p'], last['c']) and False or (
                (r['p'], r['c']) == (last['p'], last['c']) and (r['y'] - last['y'] > r['s'] * 1.8 or r['x'] - last['x'] > 12))
            if current and new:
                paras.append(join_lines(current))
                current = []
            current.append(t)
            last = r
        if current:
            paras.append(join_lines(current))
        return paras


def attribute_mods(text):
    """"Constituição +2, Sabedoria +1, Destreza –1" → {'con': 2, 'sab': 1, 'des': -1}; escolhas à parte."""
    mods = {}
    for name, sign, value in re.findall(r'(Força|Destreza|Constituição|Inteligência|Sabedoria|Carisma)\s*([+–\-−])\s*(\d)', text):
        mods[ATTRS[plain(name)]] = int(value) * (-1 if sign in '–-−' else 1)
    return mods


def _race(book, name, intro_start, abilities_start, stop):
    entries = book.entries(abilities_start, stop)
    attrs_entry = next((e for e in entries[:2] if re.search(r'[+–\-−]\s*\d|Atributos? Diferentes', e['name'])), None)
    text = attrs_entry['name'] if attrs_entry else ''
    return {'name': name.strip(), 'summary': book.paragraphs(intro_start, abilities_start), 'attributesText': text,
            'attributes': attribute_mods(text), 'abilities': [e for e in entries if e is not attrs_entry]}


def races(book):
    out = []
    main = book.titles(27, 25, 32)
    for n, (i, name) in enumerate(main):
        stop = main[n + 1][0] if n + 1 < len(main) else book.index_of_page(33)
        heading = next((k for k in range(i, stop) if book.texts[k].startswith('Habilidades')), i)
        out.append(_race(book, name, i + 1, heading + 1, stop))
    # Raças extras (Golem a Trog): título menor, habilidades logo após a descrição.
    extra = [(i, t) for i, t in book.titles(21, 33, 37)]
    for n, (i, name) in enumerate(extra):
        stop = extra[n + 1][0] if n + 1 < len(extra) else book.index_of_page(38)
        first_bold = next((k for k in range(i + 1, stop) if book.is_bold(k) and book.is_body_size(k)), stop)
        out.append(_race(book, name.replace('/tritão', '/Tritão'), i + 1, first_bold, stop))
    return out


SKILL_ATTR = re.compile(r'([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?: \([a-záéíóúâêôãõç]+\))?)\s*\((For|Des|Con|Int|Sab|Car)\)')
PREREQ = re.compile(r'\s*Pré-requisitos?:\s*(.+?)\.?$')


def split_prereq(text):
    m = PREREQ.search(text)
    return (text[:m.start()].strip(), m.group(1).strip()) if m else (text, '')


def class_table(book, start, stop):
    """Tabela "Nível | Habilidades de Classe": {nível: 'Caminho do arcanista, magias (1º círculo)'}."""
    cells = {}
    for i in range(start, stop):
        r = book.rows[i]
        if r['f'].startswith('SourceSansPro') and abs(r['s'] - 9.0) < 0.3 and book.texts[i]:
            cells.setdefault((r['p'], r['c'], round(r['y'])), []).append((r['x'], book.texts[i]))
    table, last = {}, None
    for key in sorted(cells):
        row = [t for _, t in sorted(cells[key])]
        m = re.fullmatch(r'(\d{1,2})º', row[0]) if row else None
        if m and len(row) >= 2:
            last = int(m.group(1))
            table[last] = ', '.join(row[1:])
        elif last is not None and row and table[last].endswith(','):
            table[last] += ' ' + ' '.join(row)  # linha da tabela quebrada em duas
    return table


def ability_level(name, table):
    """Primeiro nível da tabela que cita a habilidade; nome exato vale mais que prefixo
    ("Evasão aprimorada" não casa com "Evasão")."""
    key = plain(re.sub(r'\s*\(.*?\)', '', name)).strip()
    best = None
    for level in sorted(table):
        for item in table[level].split(','):
            # "Baluarte +2", "Duelo +3": o número não faz parte do nome.
            item = re.sub(r'\s*[+–-]\s*\d.*$', '', plain(re.sub(r'\s*\(.*?\)', '', item))).strip()
            if not item:
                continue
            score = 3 if item == key else 2 if item.startswith(key) else 1 if key.startswith(item) and len(item) > 4 else 0
            if score and (best is None or score > best[0]):
                best = (score, level)
    return best[1] if best else 1


def classes(book):
    out = []
    titles = book.titles(27, 42, 90)
    end = book.index_of_page(91)
    for n, (i, name) in enumerate(titles):
        stop = titles[n + 1][0] if n + 1 < len(titles) else end
        heads = [k for k in range(i, stop) if book.rows[k]['f'].startswith(TITLE) and abs(book.rows[k]['s'] - 21) < 0.6]
        char = next((k for k in heads if book.texts[k].startswith('Características')), None)
        hab = next((k for k in heads if book.texts[k].startswith('Habilidades de Classe')), None)
        if char is None or hab is None:
            continue
        stats = {e['name']: e['text'] for e in book.entries(char, hab)}
        pv = re.search(r'começa com (\d+) pontos de vida.*?ganha (\d+) PV', stats.get('Pontos de Vida', ''))
        pm = re.search(r'(\d+) PM por nível', stats.get('Pontos de Mana', ''))
        skills_text = stats.get('Perícias', '')
        fixed_part, _, choice_part = skills_text.partition('mais ')
        count = re.match(r'(\d+)', choice_part)
        table = class_table(book, i, stop)
        # Seções extras da classe (Linhagens, Forma Selvagem, Engenhocas…) depois das habilidades.
        extra_heads = [k for k in heads if k > hab and k - 1 not in heads]  # título em duas linhas conta uma vez
        hab_stop = extra_heads[0] if extra_heads else stop
        abilities, powers, golpe, boxed = [], [], [], []
        last = None  # tipo da última entrada: 'ability' ou 'power'
        # Quadros do livro (título em SourceSansPro-Bold grande): onde ficam, por página e coluna.
        box_titles = {}
        for k in range(i, stop):
            r_ = book.rows[k]
            if r_['f'].startswith('SourceSansPro-Bold') and r_['s'] >= 12.5:
                box_titles.setdefault((r_['p'], r_['c']), r_['y'])
        for e in book.entries(hab + 1, hab_stop):
            if not e['name'] and not e['bullet'] or e['name'].startswith('Nível') or e['name'][:1].islower():
                continue  # cabeçalho da tabela ou negrito no meio do texto
            if re.search(r'\((?:[+–\-]\d+ PM|Custo)', e['name']):
                # Opções do Golpe Pessoal (guerreiro): "Amplo (+3 PM)"…, num quadro à parte.
                golpe.append({'name': e['name'], 'text': e['text']})
                continue
            # Poder da classe: "•<tab>Nome." Itens sem a tabulação ("• Coruja." dos familiares)
            # vêm de quadros e não são poderes.
            row_ = book.rows[e['row']]
            is_power = row_['t'].lstrip().startswith('•	')
            in_box = not is_power and (row_['p'], row_['c']) in box_titles and row_['y'] > box_titles[(row_['p'], row_['c'])]
            announces_options = last == 'ability' and re.search(r'[Ee]scolha (?:uma|um|entre)[^.]*(?:a seguir|opções|caminhos)', abilities[-1]['text'])
            if e['bullet'] and e['name'] and announces_options:
                # Itens logo após uma habilidade são opções dela (Caminho do Arcanista, Caminho do Cavaleiro).
                abilities[-1].setdefault('options', []).append({'name': e['name'], 'text': e['text']})
                continue
            if e['bullet'] and e['name'] and in_box:
                if powers:
                    powers[-1]['text'] += f"\n• {e['name']}. {e['text']}"
                else:
                    boxed.append({'name': e['name'], 'text': e['text']})
                continue
            if e['bullet'] and e['name']:
                text, prereq = split_prereq(e['text'])
                powers.append({'name': e['name'], 'text': text, 'prerequisite': prereq})
                last = 'power'
            elif e['bullet'] and abilities:
                abilities[-1]['text'] += '\n• ' + e['text']
            else:
                ability = {'name': e['name'], 'text': e['text'], 'level': ability_level(e['name'], table)}
                abilities.append(ability)
                # "Poder de X" abre a lista de poderes; as demais habilidades podem ter opções.
                last = 'power' if plain(e['name']).startswith('poder de') else 'ability'
        sections = [{'title': 'Golpe Pessoal', 'paragraphs': [], 'entries': golpe}] if golpe else []
        if boxed:
            sections.append({'title': 'Quadro', 'paragraphs': [], 'entries': boxed})
        # Familiares do arcanista: o quadro descreve as opções do poder Familiar.
        familiar = next((p for p in powers if plain(p['name']) == 'familiar'), None)
        if familiar and boxed:
            familiar['text'] += ''.join(f"\n• {b_['name']}. {b_['text']}" for b_ in boxed)
            sections.pop()
        for m, k in enumerate(extra_heads):
            sec_stop = extra_heads[m + 1] if m + 1 < len(extra_heads) else stop
            title = book.texts[k]
            while k + 1 < sec_stop and book.is_title(k + 1, 21):
                k += 1
                title += ' ' + book.texts[k]
            sections.append({'title': title, 'paragraphs': book.paragraphs(k + 1, sec_stop), 'entries': book.entries(k + 1, sec_stop)})
        out.append({
            'name': name, 'summary': book.paragraphs(i + 1, char),
            'pvInitial': int(pv.group(1)) if pv else 0, 'pvPerLevel': int(pv.group(2)) if pv else 0,
            'pmPerLevel': int(pm.group(1)) if pm else 0,
            'skillsFixed': [{'name': n_, 'attr': a_.lower()} for n_, a_ in SKILL_ATTR.findall(fixed_part)],
            'skillsChoice': {'count': int(count.group(1)) if count else 0,
                             'options': [{'name': n_, 'attr': a_.lower()} for n_, a_ in SKILL_ATTR.findall(choice_part)]},
            'skillsText': skills_text, 'proficiencies': stats.get('Proficiências', ''),
            'table': table, 'abilities': abilities, 'powers': powers, 'sections': sections,
        })
    return out


def titled_blocks(book, size, first_page, last_page, end_index=None):
    """Blocos "título (tamanho dado) → corpo até o próximo título do mesmo tamanho ou maior"."""
    titles = book.titles(size, first_page, last_page)
    end = end_index if end_index is not None else book.index_of_page(last_page + 1)
    blocks = []
    for n, (i, name) in enumerate(titles):
        stop = titles[n + 1][0] if n + 1 < len(titles) else end
        # Um título maior no meio (início de outra seção) também encerra o bloco.
        bigger = next((k for k in range(i + 1, stop) if book.rows[k]['f'].startswith(TITLE) and book.rows[k]['s'] > size + 0.6 and book.texts[k]), stop)
        blocks.append((i, name.strip(), min(stop, bigger)))
    return blocks


def origins(book):
    out = []
    for i, name, stop in titled_blocks(book, 21, 91, 101):
        if name.startswith('Sua Própria'):
            continue
        entries = {e['name']: e['text'] for e in book.entries(i + 1, stop)}
        # Poder exclusivo da origem: subtítulo de 16 dentro do bloco.
        unique = [(k, t, e) for k, t, e in titled_blocks(book, 16, book.rows[i]['p'], book.rows[stop - 1]['p'], stop) if i < k < stop]
        powers = [{'name': t, 'text': join_lines(book.paragraphs(k + 1, e))} for k, t, e in unique]
        first_entry = next((k for k in range(i + 1, stop) if book.rows[k]['lead']), stop)
        out.append({'name': name, 'summary': book.paragraphs(i + 1, first_entry), 'items': entries.get('Itens', ''),
                    'benefits': entries.get('Benefícios', ''), 'uniquePowers': powers})
    return out


def deities(book):
    out = []
    # Tabela 1-20: divindade, energia, poderes concedidos.
    table = {}
    start, stop = book.index_of_page(103), book.index_of_page(104)
    rows = {}
    for i in range(start, stop):
        r = book.rows[i]
        if r['f'].startswith('SourceSansPro') and abs(r['s'] - 9.0) < 0.3 and book.texts[i]:
            rows.setdefault((r['c'], round(r['y'])), []).append((r['x'], book.texts[i]))
    current = None
    for key in sorted(rows):
        cells = [t for _, t in sorted(rows[key])]
        if len(cells) >= 3:
            current = cells[0]
            table[current] = {'energy': cells[1], 'powers': ' '.join(cells[2:])}
        elif current and cells:
            table[current]['powers'] += ' ' + ' '.join(cells)
    for i, name, stop in titled_blocks(book, 21, 102, 111):
        if name not in table:
            continue
        entries = book.entries(i + 1, stop)
        info = {e['name']: e['text'] for e in entries}
        first_entry = next((k for k in range(i + 1, stop) if book.rows[k]['lead']), stop)
        out.append({'name': name, 'summary': book.paragraphs(i + 1, first_entry), 'energy': table[name]['energy'],
                    'grantedPowers': [p.strip() for p in re.split(r',\s*', table[name]['powers']) if p.strip()],
                    'details': info})
    return out


def skills(book):
    out = []
    blocks = titled_blocks(book, 21, 121, 129)
    # Furtividade vem com nome e atributo na mesma linha de 16 ("Furtividade	Des • Armadura").
    for k, r in enumerate(book.rows):
        m = re.match(r'^(\w+)\s+(For|Des|Con|Int|Sab|Car)\b', book.texts[k]) if 121 <= r['p'] <= 129 and book.is_title(k, 16) else None
        if m:
            following = min((i for i, _, _ in blocks if i > k), default=book.index_of_page(130))
            blocks.append((k - 1, m.group(1), following))
            book.texts[k] = book.texts[k][len(m.group(1)):].strip()
            book.rows[k] = dict(book.rows[k])
    blocks.sort()
    for i, name, stop in blocks:
        attr_row = next((k for k in range(i + 1, min(i + 4, stop)) if book.is_title(k, 16)), None)
        if attr_row is None:
            continue
        flags = book.texts[attr_row]
        attr = flags.split('•')[0].strip().lower()[:3]
        uses = [{'name': e['name'], 'text': e['text']} for e in book.entries(attr_row + 1, stop)]
        first_entry = uses and next((k for k in range(attr_row + 1, stop) if book.rows[k]['lead'] or book.is_bold(k)), stop) or stop
        out.append({'name': name, 'attr': plain(attr), 'trainedOnly': 'Treinad' in flags, 'armorPenalty': 'Armadura' in flags,
                    'summary': book.paragraphs(attr_row + 1, first_entry), 'uses': uses})
    return out


def general_powers(book):
    out = []
    groups = [(g, t) for g, t in book.titles(27, 130, 143) if t.startswith('Poderes')]
    for n, (g, group) in enumerate(groups):
        g_stop = groups[n + 1][0] if n + 1 < len(groups) else book.index_of_page(144)
        kind = plain(group).replace('poderes ', '').replace('de ', '').replace('da ', '').strip()
        for i, name, stop in titled_blocks(book, 16, book.rows[g]['p'], book.rows[g_stop - 1]['p'], g_stop):
            if not (g < i < g_stop) or name.startswith('Escolhendo'):
                continue
            text, prereq = split_prereq(join_lines(book.paragraphs(i + 1, stop, italic=True)))
            out.append({'group': kind, 'name': name, 'text': text, 'prerequisite': prereq})
    return out


SPELL_HEADER = re.compile(r'^(Arcana|Divina|Universal)\s+(\d)\s*\((\w[\w ]*)\)')
SPELL_FIELDS = ('Execução', 'Alcance', 'Alvos?', 'Área', 'Efeito', 'Duração', 'Resistência')


def narrow_columns(book, first_page, last_page):
    """Linhas das páginas de magias em ordem de leitura: cada página tem 4 colunas estreitas
    (o layout só separa 2). Agrupa pela posição x e lê coluna por coluna."""
    ordered = []
    for page in range(first_page, last_page + 1):
        idx = [i for i, r in enumerate(book.rows) if r['p'] == page and book.texts[i]]
        xs = sorted({round(book.rows[i]['x']) for i in idx})
        starts = []
        for x in xs:
            if not starts or x - starts[-1] > 60:
                starts.append(x)
        col = lambda i: max(n for n, start in enumerate(starts) if book.rows[i]['x'] >= start - 1)
        ordered += sorted(idx, key=lambda i: (col(i), book.rows[i]['y'], book.rows[i]['x']))
    return ordered


def spells(book):
    order = narrow_columns(book, 184, 217)
    out, current, pending_title = [], None, ""
    for pos, i in enumerate(order):
        r, t = book.rows[i], book.texts[i]
        if book.is_title(i, 16):
            nxt = order[pos + 1] if pos + 1 < len(order) else None
            if nxt is not None and SPELL_HEADER.match(book.texts[nxt]):
                # Nome em duas linhas: a primeira veio antes (guardada em `pending_title`).
                name = f'{pending_title} {t}' if pending_title else t
                pending_title = ''
                current = {'name': name, 'lines': [], 'fields': [], 'upgrades': []}
                out.append(current)
                continue
            if nxt is not None and book.is_title(nxt, 16):
                pending_title = f'{pending_title} {t}'.strip()
                continue
        if current is None:
            continue
        m = SPELL_HEADER.match(t)
        if m and not current.get('type'):
            current.update(type=m.group(1).lower(), circle=int(m.group(2)), school=m.group(3).strip())
            continue
        if not (8.0 <= r['s'] <= 9.6) or r['f'].startswith(TITLE):
            continue
        if re.match(r'^\+\d+ PM:', t) or re.match(r'^\+\d+ PM ', t):
            current['upgrades'].append([t])
        elif current['upgrades']:
            current['upgrades'][-1].append(t)
        elif re.match(r'^(Execução|Alcance|Alvos?|Área|Efeito|Duração|Resistência)\b', t) or (
            # Campo quebrado em duas linhas: a anterior termina em ";", "," ou hífen, ou esta começa minúscula.
            current['fields'] and not current['lines'] and not current['fields'][-1].rstrip().endswith('.')
            and (current['fields'][-1].rstrip().endswith((';', ',', '-', ':')) or t[:1].islower())
        ):
            current['fields'].append(t)
        else:
            current['lines'].append(t)
    result = []
    for sp in out:
        fields_text = join_lines(sp['fields'])
        fields = {}
        # Campos separados por ";" (ou por ponto, em algumas magias: "… descarregada. Resistência: …").
        for part in re.split(r';\s*|\.\s+(?=(?:Execução|Alcance|Alvos?|Área|Efeito|Duração|Resistência)\b)', fields_text):
            name, _, value = part.partition(':')
            if value:
                fields[plain(name.strip())] = value.strip().rstrip('.')
        upgrades = []
        for lines in sp['upgrades']:
            text = join_lines(lines)
            m = re.match(r'^\+(\d+) PM:?\s*(.*)$', text)
            if m:
                upgrades.append({'cost': int(m.group(1)), 'text': m.group(2)})
        result.append({'name': sp['name'], 'type': sp.get('type', ''), 'circle': sp.get('circle', 0), 'school': sp.get('school', ''),
                       'execution': fields.get('execucao', ''), 'range': fields.get('alcance', ''),
                       'target': fields.get('alvo', fields.get('alvos', '')), 'area': fields.get('area', ''), 'effect': fields.get('efeito', ''),
                       'duration': fields.get('duracao', ''), 'resistance': fields.get('resistencia', ''),
                       'text': join_lines(sp['lines']), 'upgrades': upgrades})
    return result


def table_rows(book, pages, fonts=('SourceSansPro',), max_size=12.1, by_column=False):
    """Linhas de tabela (células das duas colunas na mesma altura), em ordem: [(página, [células])].
    by_column=True lê cada coluna da página como uma tabela à parte (tabelas lado a lado)."""
    cells = {}
    for i, r in enumerate(book.rows):
        if r['p'] in pages and r['f'].startswith(fonts) and r['s'] <= max_size and book.texts[i]:
            key = (r['p'], r['c'], round(r['y'] / 2)) if by_column else (r['p'], round(r['y'] / 2))
            cells.setdefault(key, []).append((r['c'], r['x'], book.texts[i]))
    return [(key[0], [t for _, _, t in sorted(v)]) for key, v in sorted(cells.items())]


def descriptions(book, first_page, last_page):
    """Descrições "Nome. texto" de um capítulo (armas, itens…), pelo nome em minúsculas."""
    start, stop = book.index_of_page(first_page), book.index_of_page(last_page + 1)
    return {plain(e['name']): e['text'] for e in book.entries(start, stop) if e['name']}


def weapons(book):
    desc = descriptions(book, 151, 158)
    out, category, group = [], '', ''
    for page, row in table_rows(book, range(150, 153), fonts=('SourceSansPro', 'IowanOldStyle-Bold'), max_size=10.1):
        head = row[0]
        if head.startswith('Armas ') and (len(row) <= 4 or row[1] == 'Preço'):
            category = plain(head.replace('Armas ', ''))
            continue
        if re.match(r'^(Corpo a Corpo|Ataque à Distância)', head):
            group = head
            continue
        if len(row) >= 7 and (row[1].startswith('T$') or row[1] == '—'):
            name = row[0]
            out.append({'name': name, 'category': category, 'group': group, 'price': row[1], 'damage': row[2], 'critical': row[3],
                        'range': row[4], 'damageType': row[5], 'spaces': row[6],
                        'text': desc.get(plain(re.sub(r'\s*\(\d+\)', '', name)), '')})
    return out


def armors(book):
    desc = descriptions(book, 158, 160)
    out, group = [], ''
    for page, row in table_rows(book, [159]):
        if row[0] in ('Armaduras Leves', 'Armaduras Pesadas', 'Escudos'):
            group = plain(row[0])
            continue
        if len(row) >= 5 and row[1].startswith('T$'):
            out.append({'name': row[0], 'group': group, 'price': row[1], 'defense': row[2], 'penalty': row[3], 'spaces': row[4],
                        'text': desc.get(plain(row[0]), '')})
    return out


def general_items(book):
    desc = descriptions(book, 161, 169)
    out, group = [], ''
    for page, row in table_rows(book, [162, 163], fonts=('SourceSansPro', 'IowanOldStyle-Bold'), max_size=10.1, by_column=True):
        if row[0] in ('Item',) or row[0].startswith('Tabela'):
            continue
        if len(row) == 1 and not row[0][:1].islower():
            group = row[0].replace(' (continuação)', '')
            continue
        if len(row) >= 3 and re.match(r'^T\$', row[1]):
            name = row[0]
            if name[:1].islower() and out:  # "comum", "confortável" (estadia), "terrestre" (condução)
                name = f"{out[-1]['parent'] or out[-1]['name']} ({name})"
            out.append({'name': name, 'group': group, 'price': row[1], 'spaces': row[2], 'parent': '',
                        'text': desc.get(plain(re.sub(r'\s*\(.*?\)', '', name)), '')})
        elif len(row) == 1 and row[0][:1].isupper():
            group = row[0]
        elif len(row) == 1 and out:
            out.append({'name': row[0], 'group': group, 'price': '', 'spaces': '', 'parent': row[0], 'text': ''})
    return [dict(item, **{}) for item in out if item['price']]


def improvements(book):
    """Melhorias de itens superiores (Tabela 3-8) com a descrição completa."""
    desc = descriptions(book, 170, 173)
    out, group = [], ''
    for page, row in table_rows(book, [171], fonts=('SourceSansPro', 'IowanOldStyle-Bold'), max_size=10.1, by_column=True):
        if row[0].startswith('Melhorias para'):
            group = row[0].replace('Melhorias para ', '')
            continue
        if row[0] in ('Melhoria',) or row[0].startswith('Tabela') or '.' in row[0]:
            continue
        if len(row) >= 2:
            out.append({'name': row[0], 'group': group, 'effect': row[1], 'text': desc.get(plain(row[0]), '')})
        elif out and row[0][:1] in '+–-' or (out and row[0][:1].islower()):
            out[-1]['effect'] += ' ' + row[0]
    return out


STAT_FIELDS = ('Iniciativa', 'Defesa', 'Pontos de Vida', 'Pontos de Mana', 'Deslocamento', 'Corpo a Corpo', 'À Distância',
               'Perícias', 'Equipamento', 'Tesouro')


def threats(book, first_page=288, last_page=329):
    """Fichas de ameaças: título (21) + "ND x" (16) + bloco em SourceSansPro."""
    out = []
    start, end = book.index_of_page(first_page), book.index_of_page(last_page + 1)
    # Cada ficha tem um marcador "ND x" (fonte 16 ou 11) logo depois do nome (título de 21 ou 16).
    markers = [k for k in range(start, end) if book.rows[k]['f'].startswith(TITLE) and book.rows[k]['s'] in (11.0, 16.0)
               and re.match(r'^ND\s', book.texts[k], re.I)]
    titles = []
    for k in markers:
        lines = [j for j in range(max(k - 4, start), k) if book.rows[j]['f'].startswith(TITLE) and book.rows[j]['s'] >= 16 and book.texts[j]
                 and not re.match(r'^ND\s', book.texts[j], re.I) and book.rows[j]['c'] == book.rows[k]['c']]
        if lines:
            titles.append((k, ' '.join(book.texts[j] for j in lines[-2:] if book.rows[j]['s'] == book.rows[lines[-1]]['s']), lines[-2:][0]))
    # Fichas com o "ND" na mesma linha do nome ("Capelão de Guerra<tab>ND 4").
    for k in range(start, end):
        if book.rows[k]['f'].startswith(TITLE) and book.rows[k]['s'] >= 16 and re.search(r'\sND\s*[\d/]+\s*$', book.texts[k]):
            name = re.sub(r'\s*ND\s*[\d/]+\s*$', '', book.texts[k]).strip()
            if name:
                titles.append((k, name, k))
    titles.sort()
    for n, (last_line, name, first_line) in enumerate(titles):
        stop = titles[n + 1][2] if n + 1 < len(titles) else end
        nd_row = last_line
        block = [k for k in range(nd_row + 1, stop) if book.rows[k]['f'].startswith('SourceSansPro') and 8.5 <= book.rows[k]['s'] <= 9.5 and book.texts[k]]
        if not block:
            continue
        kind = next((book.texts[k] for k in block if book.rows[k]['f'].startswith('SourceSansPro-It')), '')
        fields, abilities, current = {}, [], None
        attrs = ''
        for k in block:
            r, t = book.rows[k], book.texts[k]
            if r['f'].startswith('SourceSansPro-It') and t == kind:
                continue
            if re.match(r'^For\s+[–\-+]?\d', t):
                attrs, current = t, None
                continue
            lead = clean(r['lead'] or '')
            field = next((f for f in STAT_FIELDS if t.startswith(f)), None)
            if field:
                current = {'name': field, 'lines': [t[len(field):].strip()]}
                fields[field] = current
            elif lead and t.startswith(lead) and r['x'] < min(book.rows[b]['x'] for b in block) + 3:
                current = {'name': lead.strip(), 'lines': [t[len(lead):].strip()]}
                abilities.append(current)
            elif current is not None:
                current['lines'].append(t)
        mods = {}
        for name_, value in re.findall(r'(For|Des|Con|Int|Sab|Car)\s+([–\-+]?\d+|—)', attrs):
            mods[name_.lower()] = None if value == '—' else int(value.replace('–', '-'))
        defense = join_lines(fields.get('Defesa', {}).get('lines', []))
        dm = re.match(r'(\d+)', defense)
        hp = re.match(r'(\d+)', join_lines(fields.get('Pontos de Vida', {}).get('lines', [])))
        first_stat = block[0]
        out.append({
            'name': name, 'nd': re.search(r'ND\s*(\S+)\s*$', book.texts[nd_row], re.I).group(1) if re.search(r'ND\s*(\S+)\s*$', book.texts[nd_row], re.I) else '', 'type': kind,
            'summary': book.paragraphs(nd_row + 1, first_stat),
            'attributes': mods, 'defense': int(dm.group(1)) if dm else 0, 'defenseText': defense,
            'hp': int(hp.group(1)) if hp else 0,
            **{plain(f).replace(' ', '_'): join_lines(v['lines']) for f, v in fields.items() if f not in ('Defesa',)},
            'abilities': [{'name': a_['name'], 'text': join_lines(a_['lines'])} for a_ in abilities],
        })
    return out


def conditions(book):
    start, stop = book.index_of_page(400), book.index_of_page(402)
    return [{'name': e['name'], 'text': e['text']} for e in book.entries(start, stop) if e['name'] and not e['name'][:1].islower()]


MAGIC_TABLES = {'8-8': 'encanto-arma', '8-9': 'arma-especifica', '8-10': 'encanto-armadura', '8-11': 'armadura-especifica',
                '8-12': 'pocao', '8-13': 'acessorio-menor', '8-14': 'acessorio-medio', '8-15': 'acessorio-maior'}


def magic_items(book):
    desc = descriptions(book, 341, 351)
    out, kind = [], None
    for page, row in table_rows(book, range(340, 352), fonts=('SourceSansPro', 'IowanOldStyle-Bold'), max_size=12.1, by_column=True):
        m = re.match(r'^Tabela (8-\d+)', row[0])
        if m:
            kind = MAGIC_TABLES.get(m.group(1))
            continue
        if not kind or len(row) < 3 or not re.match(r'^\d{2}(-\d{2,3})?$|^\d{1,3}$', row[0]):
            continue
        name = re.sub(r'[\d*]+$', '', row[1]).strip()
        if name.startswith(('Arma específica', 'Item específico')):
            continue
        third = ' '.join(row[2:])
        price = third if third.startswith('T$') else ''
        out.append({'name': name, 'kind': kind, 'roll': row[0], 'price': price, 'effect': '' if price else third,
                    'text': desc.get(plain(re.sub(r'\s*\(.*?\)', '', name)), desc.get(plain(name), ''))})
    # Artefatos: um título por artefato, descrição corrida.
    for i, name, stop in titled_blocks(book, 21, 352, 355):
        out.append({'name': name[:1].upper() + name[1:], 'kind': 'artefato', 'roll': '', 'price': '', 'effect': '',
                    'text': '\n\n'.join(book.paragraphs(i + 1, stop))})
    return out


def main():
    rows = [json.loads(line) for line in open(sys.argv[1], encoding='utf-8')]
    book = Book(rows)
    data = {'races': races(book), 'classes': classes(book), 'origins': origins(book), 'deities': deities(book),
            'skills': skills(book), 'powers': general_powers(book), 'spells': spells(book),
            'weapons': weapons(book), 'armors': armors(book),
            'items': general_items(book), 'improvements': improvements(book),
            'threats': threats(book), 'conditions': conditions(book),
            'magicItems': magic_items(book)}
    pathlib.Path(sys.argv[2]).write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding='utf-8')
    for key, value in data.items():
        print(key, len(value))


if __name__ == '__main__':
    main()
