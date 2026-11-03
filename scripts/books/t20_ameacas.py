"""Ameaças de Arton (Tormenta20) a partir das linhas do layout.py.

Uso: python -X utf8 scripts/books/t20_ameacas.py <layout/AMEACAS.jsonl> <saída.book.json> [<PDF>]
(com o PDF, os quadros de habilidades de raça são lidos pelo retângulo desenhado, inteiros)

O livro inteiro vira um pacote `t20-ameacas`:
- ameaças: cada ficha começa pela linha de tipo em itálico seguida de "Iniciativa"; o nome são as
  linhas de título acima e o ND pode estar ao lado, alinhado à direita (o PDF o põe na outra coluna);
- Bazar Monstruoso: armas, armaduras, itens gerais, melhorias, materiais especiais, itens mágicos,
  artefatos e magias novas;
- Apêndice A: raças jogáveis (Tabela A-1 + quadro "<Raça>: Habilidades de Raça" na página da raça);
- texto corrido de todos os capítulos (perigos, regras, criação de ameaças, encontros), sem as fichas.
As páginas daqui são as do PDF (o número impresso é 2 a menos).
"""
import collections
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from bookkit import join_lines, slug  # noqa: E402
from t20 import TITLE, Book, descriptions, plain, spells, table_rows, threats, titled_blocks  # noqa: E402
from t20_pack import ATTR, SIZE_WORDS, entry, number, spell, text_sections, threat  # noqa: E402

ATTRS = {'for': 'for', 'des': 'des', 'con': 'con', 'int': 'int', 'sab': 'sab', 'car': 'car'}
WORD_COUNT = {'um': 1, 'uma': 1, 'dois': 2, 'duas': 2, 'tres': 3, 'quatro': 4}


def descriptions_before(book, found):
    """Texto corrido antes de cada ficha: do título grande mais próximo até o nome da ameaça."""
    titles = [k for k, r in enumerate(book.rows) if r['f'].startswith(TITLE) and r['s'] >= 21 and book.texts[k]]
    out = {}
    for t in found:
        before = [k for k in titles if k < t['_first']]
        if before:
            out[t['name']] = book.paragraphs(before[-1] + 1, t['_first'])
    return out


def anchored_titles(book):
    """Cada ficha começa pela linha de tipo em itálico ("Humanoide (humano) Médio") seguida de
    "Iniciativa". O nome são as linhas de título logo acima (sem o "ND"); o ND, se houver, também."""
    out, nds = [], {}
    rows, texts = book.rows, book.texts
    for k, r in enumerate(rows):
        if not (r['f'].startswith('SourceSansPro-It') and texts[k]):
            continue
        # "Iniciativa" logo depois (às vezes o tipo quebra em duas linhas).
        if not any(texts[j].startswith('Iniciativa') for j in range(k + 1, min(k + 4, len(rows)))):
            continue
        # Tipo em duas linhas itálicas: a ficha começa na primeira.
        if out and out[-1][0] >= k - 3:
            continue
        # O nome pode ficar no fim da página anterior; títulos de ficha têm 13 a 17 pontos, e os
        # gigantes (dragões-reis, arquilich) só valem quando não há outro.
        near = [j for j in range(max(0, k - 8), k) if rows[j]['f'].startswith(TITLE) and texts[j] and rows[j]['p'] >= r['p'] - 1
                and not re.fullmatch(r'\d+', texts[j])]
        heads = [j for j in near if 12.5 <= rows[j]['s'] <= 17.5] or [j for j in near if rows[j]['s'] >= 12.5]
        nd = next((re.search(r'ND\s*(\S+)', texts[j]).group(1) for j in reversed(near) if re.search(r'^ND\s*\S+', texts[j])), '')
        names = [j for j in heads if not re.match(r'^ND\s', texts[j], re.I)]
        if not names:
            # Título gigante bem acima na página (Arquilich Ferren Asloth): os maiores da página.
            names = [j for j in range(max(0, k - 400), k) if rows[j]['p'] == r['p'] and rows[j]['f'].startswith(TITLE)
                     and rows[j]['s'] >= 30 and texts[j]]
        if not names:
            continue
        if not nd:
            # ND alinhado à direita, na mesma altura do nome (o PDF o põe na outra coluna).
            y = rows[names[-1]]['y']
            nd = next((re.search(r'ND\s*(\S+)', texts[j]).group(1) for j in range(max(0, k - 300), min(len(rows), k + 300))
                       if rows[j]['p'] == r['p'] and rows[j]['f'].startswith(TITLE) and re.match(r'^ND\s*\S+', texts[j])
                       and abs(rows[j]['y'] - y) <= 22), '')
        # Último grupo de linhas de nome consecutivas com o mesmo tamanho.
        group = [names[-1]]
        for j in reversed(names[:-1]):
            if (rows[j]['s'] == rows[group[0]]['s'] or rows[j]['s'] >= 30) and group[0] - j <= 2:
                group.insert(0, j)
            else:
                break
        name = re.sub(r'\s*ND\s*[\d/]+\s*$', '', ' '.join(texts[j] for j in group)).strip()
        name = re.sub(r',(?=\S)', ', ', name)
        out.append((k - 1, name, group[0]))
        nds[group[0]] = nd
    return out, nds


def stat_rows(book, titles):
    """Índices das linhas das fichas (para o texto corrido não repetir as fichas)."""
    drop = set()
    for last_line, _, first_line in titles:
        drop.update(range(first_line, last_line + 1))
        k = last_line + 1
        while k < len(book.rows):
            r = book.rows[k]
            if r['f'].startswith('SourceSansPro') and r['s'] < 12.5:
                drop.add(k)
            elif book.texts[k] and not (r['f'].startswith(TITLE) and re.match(r'^(ND\s|\d+$)', book.texts[k])):
                break
            k += 1
    return drop


def monsters(book):
    titles, nds = anchored_titles(book)
    found = threats(book, first_page=1, last_page=max(r['p'] for r in book.rows), titles=titles)
    texts = descriptions_before(book, found)
    out = []
    for t in found:
        t['nd'] = nds.get(t['_first'], '') or t['nd']
        t['summary'] = texts.get(t['name']) or t['summary']
        # "Tesouro Nenhum." encosta nos quadros de armadilha da página: fica só a primeira frase.
        if t.get('tesouro'):
            t['tesouro'] = re.split(r'(?<=\.)\s', t['tesouro'], maxsplit=1)[0]
        if t['hp'] or t['defense'] or t['abilities']:
            out.append(threat(t))
    return out, titles


# ---------------------------------------------------------------- Bazar Monstruoso

def weapons(book, desc):
    """Tabela 3-1 (p. 396): à esquerda nome/preço/dano por seção; à direita crítico/alcance/tipo/espaços na mesma ordem."""
    left, right, category, section, seen_right = [], [], '', '', False
    for _, row in table_rows(book, [396], fonts=('SourceSansPro', 'IowanOldStyle-Bold'), max_size=12.1, by_column=True):
        if row[0] == 'Crítico':
            seen_right = True
            continue
        if seen_right:
            if len(row) == 4:
                right.append(row)
            elif len(row) == 3 and not row[0].startswith('*'):
                right.append([row[0], row[1], '', row[2]])  # tipo em duas linhas ("Corte ou Perfuração"), vem a seguir
            elif len(row) == 1 and right and not right[-1][2] and not row[0].startswith('*'):
                right[-1][2] = row[0]
            continue
        if len(row) == 3 and row[1] == 'Preço':
            category = row[0].rstrip('*')
        elif len(row) == 1 and re.match(r'^(Corpo a Corpo|Ataque à Distância)', row[0]):
            section = row[0]
        elif len(row) == 3 and row[1].startswith('T$'):
            left.append((category, section, row))
    out = []
    for n, (category, section, (name, price, damage)) in enumerate(left):
        crit, rng, kind, spaces = right[n] if n < len(right) else ('', '', '', '')
        sec = plain(section)
        grip = 'duas' if 'duas' in sec else 'leve' if 'leve' in sec else 'uma' if 'uma' in sec else None
        data = {'group': 'arma', 'category': category, 'price': price.replace('T$', 'T$ ').replace('  ', ' ').strip(),
                'spaces': spaces, 'damage': '' if damage.startswith('*') else damage, 'critical': crit, 'range': '' if rng == '—' else rng,
                'damageType': kind, 'attack': 'corpo' if sec.startswith('corpo') else 'distancia',
                'text': desc.get(plain(name), '')[:8000]}
        if grip:
            data['grip'] = grip
        out.append(entry('equipment', name[:1].upper() + name[1:], data, key=slug(f'arma-{name}')))
    return out


def armors(book, desc):
    """Tabela 3-2 (p. 397): nomes e preços às vezes em linhas separadas; estatísticas à direita, na mesma ordem."""
    names, prices, stats, category = [], [], [], ''
    for _, row in table_rows(book, [397], fonts=('SourceSansPro', 'IowanOldStyle-Bold'), max_size=12.1, by_column=True):
        if row[0] == 'Defesa' or row[0].startswith('Tabela'):
            continue
        if len(row) == 2 and row[1] == 'Preço':
            category = row[0]
        elif len(row) == 3 and re.match(r'^[+\-–]?\d', row[0]):
            stats.append(row)
        elif row[0].startswith('T$'):
            prices.append(row[0])
        elif len(row) == 2 and row[1].startswith('T$'):
            names.append((category, row[0]))
            prices.append(row[1])
        elif len(row) == 1 and not row[0].endswith('.') and '.' not in row[0]:
            names.append((category, row[0]))
    out = []
    for n, (category, name) in enumerate(names):
        defense, penalty, spaces = stats[n] if n < len(stats) else ('0', '0', '')
        out.append(entry('equipment', name[:1].upper() + name[1:], {
            'group': 'armadura', 'category': category, 'price': prices[n] if n < len(prices) else '', 'spaces': spaces,
            'defense': abs(number(defense)), 'penalty': min(0, number(penalty)), 'text': desc.get(plain(name), '')[:8000]},
            key=slug(f'armadura-{name}')))
    return out


def general_items(book, desc):
    """Tabela 3-3 (p. 400): grupos e itens; um preço que sai antes do nome fica guardado até o nome."""
    out, group, pending = [], '', None
    for _, row in table_rows(book, [400], fonts=('SourceSansPro', 'IowanOldStyle-Bold'), max_size=12.1, by_column=True):
        if row[0] in ('Item',) or row[0].startswith('Tabela'):
            continue
        if row[0].startswith('T$'):
            pending = row
            continue
        if len(row) == 1:
            if pending:
                name, price, spaces = row[0], pending[0], pending[1] if len(pending) > 1 else ''
                pending = None
            else:
                group = row[0]
                continue
        elif len(row) >= 3 and row[1].startswith('T$'):
            name, price, spaces = row[0], row[1], row[2]
        else:
            continue
        out.append(entry('equipment', name[:1].upper() + name[1:], {
            'group': 'item', 'category': group, 'price': price, 'spaces': '' if spaces == '—' else spaces,
            'text': desc.get(plain(name), '')[:8000]}, key=slug(f'item-{name}')))
    return out


def improvements_and_materials(book):
    """Itens Superiores (p. 401-403): melhorias "Nome. texto" e materiais especiais com título próprio."""
    out = []
    start = next(k for k, r in enumerate(book.rows) if r['p'] == 401 and book.texts[k] == 'Novas Melhorias')
    materials = next(k for k, r in enumerate(book.rows) if r['p'] == 401 and book.texts[k] == 'Materiais Especiais')
    for e in book.entries(start + 1, materials):
        if e['name']:
            out.append(entry('equipment', e['name'], {'group': 'melhoria', 'category': 'Melhoria', 'text': e['text'][:8000]},
                             key=slug(f"melhoria-{e['name']}")))
    stop = next(k for k, r in enumerate(book.rows) if r['p'] == 403 and plain(book.texts[k]) == 'recursos naturais')
    for i, name, end in titled_blocks(book, 16, 401, 403, end_index=stop):
        if i < materials:
            continue
        out.append(entry('equipment', name[:1].upper() + name[1:], {
            'group': 'melhoria', 'category': 'Material especial', 'text': '\n\n'.join(book.paragraphs(i + 1, end))[:8000]},
            key=slug(f'material-{name}')))
    return out


MAGIC_KIND = [
    (r'acess[oó]rio menor', 'acessorio-menor'), (r'acess[oó]rio m[eé]dio', 'acessorio-medio'), (r'acess[oó]rio maior', 'acessorio-maior'),
    (r'armadura espec[ií]fica|escudo espec[ií]fico', 'armadura-especifica'), (r'arma espec[ií]fica', 'arma-especifica'),
    (r'po[cç][aã]o', 'pocao'), (r'encanto de arma', 'encanto-arma'), (r'encanto de armadura', 'encanto-armadura'),
]


def magic_items(book):
    """Novos Itens Mágicos e Novos Artefatos (p. 404-405): título 16, texto e "Tipo, preço T$ x." no fim."""
    artifacts = next(k for k, r in enumerate(book.rows) if r['p'] == 405 and book.texts[k] == 'Novos Artefatos')
    start = next(k for k, r in enumerate(book.rows) if r['p'] == 404 and book.texts[k] == 'Novos Itens')
    out = []
    for i, name, end in titled_blocks(book, 16, 404, 405):
        if i < start:
            continue
        # O fim de cada item ("Acessório maior, preço T$ 90.000.") é em itálico.
        text = '\n\n'.join(book.paragraphs(i + 1, end, italic=True))
        price = re.search(r'pre[cç]o (T\$ ?[\d.]+\d)', text)
        if i > artifacts:
            kind = 'artefato'
        else:
            tail = plain(text[-200:])
            kind = next((k for pattern, k in MAGIC_KIND if re.search(pattern, tail)), 'acessorio-maior')
        # "pilão ConspurcadO" (versalete no PDF): só a primeira letra maiúscula.
        if any(w[1:] != w[1:].lower() for w in name.split()):
            name = name.lower()
        out.append(entry('magic_item', name[:1].upper() + name[1:],
                         {'kind': kind, 'price': price.group(1) if price else '', 'effect': '', 'text': text[:12000]},
                         key=slug(f'{kind}-{name}')))
    return out


# ---------------------------------------------------------------- Raças (Apêndice A)

def race_table(book):
    """Tabela A-1 (p. 418, coluna da direita): nome, modificadores (às vezes em 2-3 linhas) e página."""
    cells = [(k, r) for k, r in enumerate(book.rows) if r['p'] == 418 and r['f'].startswith('SourceSansPro') and r['s'] <= 9.1
             and book.texts[k] and r['x'] > 280]
    names = [(r['y'], book.texts[k]) for k, r in cells if r['x'] < 345]
    out = []
    for n, (y, name) in enumerate(names):
        top = names[n - 1][0] if n else 0
        bottom = names[n + 1][0] if n + 1 < len(names) else 9999
        # Modificadores e página: as linhas entre a metade das distâncias para o nome de cima e o de baixo.
        near = lambda r: (y + top) / 2 < r['y'] <= (y + bottom) / 2
        mods = [book.texts[k] for k, r in cells if 345 <= r['x'] < 470 and near(r)]
        pg = [book.texts[k] for k, r in cells if r['x'] >= 470 and near(r)]
        out.append({'name': name, 'mods': join_lines(mods), 'page': int(pg[0]) + 2 if pg and pg[0].isdigit() else None})
    return out


def _box_title(book, k):
    r = book.rows[k]
    return book.texts[k] and ((r['f'].startswith('SourceSansPro-Bold') and r['s'] >= 12.5) or r['f'].startswith('Mansalva')
                              or (r['f'].startswith('IowanOldStyle-Black') and 'Habilidades' in book.texts[k]))


def race_boxes(book, name, page):
    """Quadros "<Raça>: Habilidades de Raça" (título às vezes em duas linhas, ou "Habilidades de Trogs",
    "Raça Variante: Trog Anão", "Soterrado") perto da página indicada na Tabela A-1."""
    stem = plain(name).rstrip('s').replace(' anao', '')
    pages = range((page or 0) - 2, (page or 0) + 4) if page else range(0, 999)
    found = []
    for k, r in enumerate(book.rows):
        if r['p'] not in pages or not _box_title(book, k):
            continue
        if k and _box_title(book, k - 1) and book.rows[k - 1]['p'] == r['p'] and abs(book.rows[k - 1]['y'] - r['y']) < 30:
            continue  # segunda linha de um título já visto
        title = book.texts[k]
        nxt = k + 1
        if nxt < len(book.rows) and _box_title(book, nxt) and abs(book.rows[nxt]['y'] - r['y']) < 30:
            title = f'{title} {book.texts[nxt]}'
        t = plain(title).replace('-', ' ')
        own = stem.replace('-', ' ')
        # O título começa pelo nome da raça ("Orc:" não pega "Meio-Orc:"), ou é "Habilidades de Trogs".
        if (t.startswith(own) and ('habilidade' in t or t.strip() == own)) or 'variante: ' + own in t                 or t.startswith('habilidades de ' + own.split()[0][:4]):
            found.append(k)
    return found


PDF = None  # caminho do PDF (3º argumento): lê os quadros pelo retângulo desenhado


def pdf_box(page, title):
    """Texto do quadro desenhado em volta do título, com os nomes das habilidades pelo negrito.
    Funciona quando o quadro contorna uma imagem ou atravessa as duas colunas."""
    import pymupdf
    doc = pymupdf.open(PDF)
    pg = doc[page - 1]
    hits = pg.search_for(title.split(':')[0] + (':' if ':' in title else ''))
    for hit in hits:
        rects = sorted((d['rect'] for d in pg.get_drawings() if d['rect'].contains(hit) and d['rect'].width > 100),
                       key=lambda r: r.get_area())
        # Sem retângulo (Kobolds: o quadro é a página inteira): do título até o rodapé.
        clip = rects[0] if rects else pymupdf.Rect(36, hit.y0 - 2, pg.rect.width - 40, pg.rect.height - 30)
        lines = []
        for block in pg.get_text('dict', clip=clip)['blocks']:
            for line in block.get('lines', []):
                spans = [s for s in line['spans'] if s['text'].strip()]
                if spans:
                    lines.append(spans)
        # Quadro largo (duas colunas): lê a coluna da esquerda inteira antes da direita.
        middle = (clip.x0 + clip.x1) / 2
        two_columns = clip.width > 350
        lines.sort(key=lambda spans: (two_columns and spans[0]['bbox'][0] > middle - 10, spans[0]['bbox'][1] // 4, spans[0]['bbox'][0]))
        first, abilities, started = '', [], False
        for spans in lines:
            text = ''.join(s['text'] for s in spans).strip()
            bold = lambda s: 'Black' in s['font'] or 'Bold' in s['font']
            if not started:
                if 'Habilidades' in text or plain(text).startswith(plain(title.split(':')[0])):
                    started = True
                continue
            if re.match(r'^\((Continua|Continuação)', text):
                continue
            # Opções com marcador ("• Dínamo de Mana. …"): entram no texto da habilidade anterior.
            if text.startswith('•') and abilities:
                abilities[-1]['lines'].append('\n- ' + text.lstrip('•\t ').strip())
                continue
            if bold(spans[0]):
                head = ''.join(s['text'] for s in spans if bold(s)).strip()
                m = re.match(r'^(.{2,70}?[.!…])\s*(.*)$', text)
                # Linha de atributos e sua continuação em negrito ("(exceto Carisma), Carisma –2.").
                if not abilities and (re.match(r'^(Força|Destreza|Constituição|Inteligência|Sabedoria|Carisma|\+\d)', head)
                                      or (head.startswith('(') and first and not first.endswith('.'))):
                    first = join_lines([first, text]) if first else text
                    continue
                # O nome em negrito pode terminar antes do ponto ("Longevidade x5.").
                if m and len(head) >= len(m.group(1)) - 4:
                    abilities.append({'name': m.group(1).rstrip('.').strip(), 'lines': [m.group(2)] if m.group(2) else []})
                    continue
                if abilities and not abilities[-1]['lines'] and not abilities[-1]['name'].endswith(('.', '!', '…')):
                    abilities[-1]['name'] += ' ' + head  # nome em duas linhas
                    continue
            if abilities:
                abilities[-1]['lines'].append(text)
            elif first and not first.endswith('.'):
                first = join_lines([first, text])
        if abilities:
            return first, abilities
    return '', []


def race_box(book, name, page):
    first, abilities = '', []
    for start in race_boxes(book, name, page):
        if PDF:
            title_text = book.texts[start]
            if start + 1 < len(book.rows) and _box_title(book, start + 1):
                title_text = f'{title_text} {book.texts[start + 1]}'
            got_first, got = pdf_box(book.rows[start]['p'], title_text)
            if got:
                first = first or got_first
                abilities += got
                continue
        title = book.rows[start]
        col, pg, last_y = title['c'], title['p'], title['y']
        for k in range(start + 1, len(book.rows)):
            r, t = book.rows[k], book.texts[k]
            if r['p'] != pg:
                break
            if r['c'] != col or not t:
                continue
            if _box_title(book, k):
                last_y = r['y']  # segunda linha do título
                continue
            # O quadro acaba numa ficha, num título ou num vão grande (texto do capítulo abaixo).
            if not r['f'].startswith('IowanOldStyle') or r['y'] - last_y > 40:
                break
            last_y = r['y']
            lead = (r.get('lead') or '').strip()
            m = re.match(r'^([A-ZÁÉÍÓÚÂÊÔÃÕÇ][^.…]{1,60})[.…]\s*(.*)$', t)
            starts = (lead and lead.endswith('.') and t.startswith(lead)) or ('Black' in r['f'] and m)
            if not abilities and not first or (not abilities and re.match(r'^(Força|Destreza|Constituição|Inteligência|Sabedoria|Carisma|\+\d)', t)):
                if re.match(r'^(Força|Destreza|Constituição|Inteligência|Sabedoria|Carisma|\+\d)', t) and not starts:
                    first = join_lines([first, t]) if first else t
                    continue
            if starts and m:
                abilities.append({'name': m.group(1).strip(), 'lines': [m.group(2)] if m.group(2) else []})
            elif abilities:
                abilities[-1]['lines'].append(t)
            elif first and not first.endswith('.'):
                first = join_lines([first, t])
    seen, out = set(), []
    for a in abilities:
        # A linha de atributos ("Força +2, Destreza +1…") às vezes vem com o negrito de habilidade.
        if re.match(r'^(Força|Destreza|Constituição|Inteligência|Sabedoria|Carisma|For|Des|Con|Int|Sab|Car)\s*[+–-]\d', a['name'])                 or a['name'] in seen:
            continue
        seen.add(a['name'])
        out.append({'name': a['name'], 'text': join_lines(a['lines'])[:4000]})
    return first, out


def golem_section(book):
    """Golem: as regras ficam na seção "Golens despertos" (Chassi com os materiais, Tamanho etc.)."""
    start = next((k for k, r in enumerate(book.rows) if r['f'].startswith(TITLE) and plain(book.texts[k]) == 'despertos'), None)
    if start is None:
        return []
    stop = next((k for k in range(start + 1, len(book.rows)) if book.rows[k]['f'].startswith(TITLE) and book.rows[k]['s'] >= 16
                 and book.texts[k]), len(book.rows))
    out, current = [], None
    for e in book.entries(start + 1, stop):
        if not e['name'] or re.match(r'^(Força|For)\s|^[“"—–-]', e['name']):
            continue
        if e['bullet'] and current is not None:
            current['text'] += f"\n- {e['name']}. {e['text']}"
            continue
        current = {'name': e['name'], 'text': e['text']}
        out.append(current)
    return [{'name': a['name'], 'text': a['text'][:4000]} for a in out]


def races(book):
    out = []
    for r in race_table(book):
        first, abilities = race_box(book, r['name'], r['page'])
        if not abilities and plain(r['name']) == 'golem':
            abilities = golem_section(book)
        mods_text = r['mods']
        data = {'summary': f"Raça jogável de Ameaças de Arton (descrita na página {r['page'] - 2 if r['page'] else '?'}). "
                           f"Modificadores: {mods_text}."[:4000],
                'attributes': {}, 'variants': [], 'size': 'medio', 'speed': 9, 'abilities': abilities[:30]}
        if '(macho)' in mods_text or '(fêmea)' in mods_text:
            for part in re.split(r',\s*(?=[A-Z][a-z]{2} \+\d[^)]*\((?:fêmea|macho)\))|\)\s*,?\s*', mods_text):
                variant = re.search(r'\((macho|fêmea)\)', part + ')')
                mods = {a.lower(): int(v.replace('–', '-')) for a, v in re.findall(r'(For|Des|Con|Int|Sab|Car) ([+–\-]\d)', part)}
            # Nagah: macho For/Des/Con +1; fêmea Int/Sab/Car +1.
            males = {a.lower(): int(v.replace('–', '-')) for a, v in re.findall(r'(For|Des|Con|Int|Sab|Car) ([+–\-]\d)', mods_text.split('(macho)')[0])}
            females = {a.lower(): int(v.replace('–', '-')) for a, v in re.findall(r'(For|Des|Con|Int|Sab|Car) ([+–\-]\d)', mods_text.split('(macho)')[1])}
            data['variants'] = [{'name': 'Macho', 'attributes': males}, {'name': 'Fêmea', 'attributes': females}]
        else:
            data['attributes'] = {a.lower(): int(v.replace('–', '-')) for a, v in re.findall(r'(For|Des|Con|Int|Sab|Car) ([+–\-]\d)', mods_text)}
            choice = re.search(r'\+(\d) em (um|uma|dois|duas|três|tres|quatro|outro) atributos?(?: diferentes)?(?: \(exceto (\w+)\))?', mods_text)
            if choice:
                count = 1 if choice.group(2) == 'outro' else WORD_COUNT[plain(choice.group(2))]
                exclude = [ATTRS[plain(choice.group(3))[:3]]] if choice.group(3) else []
                exclude += list(data['attributes'])  # "+1 em outro atributo": não o que já recebeu
                data['attributeChoice'] = {'count': count, 'value': int(choice.group(1)), 'exclude': sorted(set(exclude))[:5]}
        joined = ' '.join(a['text'] for a in abilities)
        size = re.search(r'[Ss]eu tamanho é (Minúsculo|Pequeno|Médio|Grande)', joined)
        if size:
            data['size'] = SIZE_WORDS[size.group(1).lower()]
        speed = re.search(r'deslocamento (?:é |de )?(\d+(?:,\d)?)m', joined)
        if speed:
            data['speed'] = float(speed.group(1).replace(',', '.'))
        name = r['name']
        if plain(name) == 'golem':
            # O livro básico já tem "Golem" (ferro, elemental, médio); esta é a versão ampliada
            # ("golens despertos"). Nome próprio para as duas aparecerem na criação de personagem.
            name = 'Golem desperto'
            data['summary'] = ('Versão ampliada do golem do livro básico: escolha o material do chassi (barro, bronze, '
                               'carne, espelhos, ferro…), a fonte de energia e o tamanho. O golem do livro básico equivale '
                               'ao chassi de ferro, fonte elemental, tamanho Médio. ' + data['summary'])[:4000]
        out.append(entry('species', name, data))
    return out


def main():
    global PDF
    PDF = sys.argv[3] if len(sys.argv) > 3 else None
    rows = [json.loads(line) for line in open(sys.argv[1], encoding='utf-8')]
    book = Book(rows)
    entries, titles = monsters(book)
    desc = descriptions(book, 394, 401)
    entries += weapons(book, desc) + armors(book, desc) + general_items(book, desc) + improvements_and_materials(book)
    entries += magic_items(book)
    entries += [spell(s) for s in spells(book, 406, 407)]
    entries += races(book)
    # Texto corrido: sem as fichas, sem créditos/sumário (até p. 5), apoiadores e índices (408-423).
    drop = stat_rows(book, titles)
    kept = [r for k, r in enumerate(rows) if k not in drop]
    # Os títulos gigantes das criaturas confundiriam os capítulos: cada capítulo real é lido à parte.
    chapters = [('Introdução', 6, 9), ('Capítulo 1: Ameaças', 10, 373), ('Capítulo 2: Regras Avançadas de Ameaças', 374, 391),
                ('Capítulo 3: Bazar Monstruoso', 392, 407), ('Apêndice A: Raças e Parceiros', 418, 419),
                ('Apêndice D: Encontros Aleatórios', 424, 436)]
    order = 0
    for chapter, first, last in chapters:
        for e in text_sections(kept, skip=lambda r, t, a=first, b=last: not a <= r['p'] <= b):
            order += 1
            sub = e['data']['chapter']
            e['name'] = e['name'] if not sub or sub == chapter or plain(sub) in plain(e['name']) else f"{sub[:1].upper() + sub[1:]}: {e['name']}"
            e['name'] = e['name'][:160]
            e['data']['chapter'], e['data']['order'] = chapter, order
            e['key'] = slug(f"{chapter[:20]}-{e['name']}")
            entries.append(e)
    seen = {}
    for e in entries:
        base = e['key']
        n = seen.get((e['kind'], base), 0)
        if n:
            e['key'] = f'{base[:76]}-{n + 1}'
        seen[(e['kind'], base)] = n + 1
    pack = {'format': 'codexveil.tormenta20.book', 'version': 1,
            'book': {'id': 't20-ameacas', 'name': 'Ameaças de Arton', 'category': 'monsters', 'edition': 'Tormenta20',
                     'origin': 'PDF do exemplar do usuário (uso pessoal, não distribuir)'},
            'entries': entries}
    pathlib.Path(sys.argv[2]).write_text(json.dumps(pack, ensure_ascii=False), encoding='utf-8')
    print(sys.argv[2], dict(collections.Counter(e['kind'] for e in entries)))


if __name__ == '__main__':
    main()
