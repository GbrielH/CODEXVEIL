"""Monta os pacotes (codexveil.dnd5e.book) dos livros do usuário.

Uso: python -X utf8 scripts/books/build_pack.py <pasta com os .jsonl do layout> <pasta de saída> [pasta dos PDFs] [livros…]

Gera <saída>/<id>.book.json. O id é o do livro oficial (`DND5E_SOURCEBOOKS`): é por ele que a
campanha libera o conteúdo na criação de personagem. As magias do compêndio "Livro de Magias"
vão para o livro de origem (Livro do Jogador → phb-2014; as do Xanathar entram no xgte).
"""
import collections
import re, json, pathlib, re, sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import ocr_fix  # noqa: E402
import class_options  # noqa: E402
import backgrounds, bookkit, feats_items, monsters, races_ocr, sections, species, spells, subclasses  # noqa: E402
from run_monsters import extract  # noqa: E402

ORIGIN = 'PDF do exemplar do usuário (uso pessoal, não distribuir)'
PACKS = {
    'MANUAL DE MONSTROS': {'id': 'mm-2014', 'name': 'Manual dos Monstros', 'category': 'core', 'species': None, 'toc_end': 5},
    'MONSTROS DO MULTIVERSO': {'id': 'mpmm', 'name': 'Monstros do Multiverso', 'category': 'monsters', 'species': (7, 37),
                               'table_pages': (287, 289)},
    # Livro do Jogador 2014: as magias vêm do compêndio "Livro de Magias" (fonte "Livro do Jogador");
    # o capítulo de regras de conjuração do compêndio entra como texto.
    'LIVRO DE MAGIAS': {'id': 'phb-2014', 'name': 'Livro do Jogador (2014)', 'category': 'core', 'species': None,
                        'monsters': False, 'spells': 'Livro do Jogador', 'extras': 'phb'},
    'XANATAR': {'id': 'xgte', 'name': 'Guia de Xanathar para Todas as Coisas', 'category': 'player', 'species': None,
                'monsters': False, 'extras': 'xanathar', 'sections': False},
    'CALDEIRÃO DE TASHA': {'id': 'tcoe', 'name': 'Caldeirão de Tudo de Tasha', 'category': 'player', 'species': None,
                           'monsters': False, 'extras': 'tasha', 'text': {'any_body_font': True, 'body_min': 8.5}, 'toc_end': 3},
}


# Artífice (Tasha): os números da classe (dado de vida, salvaguardas, perícias, progressão) são
# regras do livro conferidas à mão; o texto das características vem do PDF.
ARTIFICER_LEVELS = {'Engenharia Mágica': 1, 'Conjuração': 1, 'Infundir Item': 2, 'Especialização de Artífice': 3,
                    'A ferramenta certa para o trabalho': 3, 'Maestria em Ferramenta': 6, 'Lampejo de Genialidade': 7,
                    'Perito em Itens Mágicos': 10, 'Item de armazenar magia': 11, 'Versado em itens mágicos': 14,
                    'Mastria em itens mágicos': 18, 'Alma do Artífice': 20}


def artificer(rows):
    texts = [bookkit.clean(r['t']) for r in rows]
    heads = [i for i, r in enumerate(rows) if 10 <= r['p'] <= 13 and abs(r['s'] - 14.8) <= 0.2]
    features = []
    for n, i in enumerate(heads):
        name = texts[i]
        if name not in ARTIFICER_LEVELS:
            continue
        end = next((k for k in range(i + 1, len(rows)) if rows[k]['s'] >= 14.5 and texts[k]), len(rows))
        body = [rows[k] | {'t': texts[k]} for k in range(i + 1, end) if texts[k] and 8.5 <= rows[k]['s'] <= 10.0
                and not re.fullmatch(r'\d{1,3}', texts[k]) and texts[k] != 'Opções de Personagens']
        paras = feats_items._paragraphs(body)
        if paras and paras[0].startswith('Característica de'):
            paras = paras[1:]
        features.append({'level': ARTIFICER_LEVELS[name], 'name': name.replace('Mastria', 'Maestria')[:120],
                         'description': '\n\n'.join(paras)[:8000]})
    features.append({'level': 4, 'name': 'Aumento no Valor de Atributo',
                     'description': 'No 4º, 8º, 12º, 16º e 19º níveis, aumente um atributo em 2 ou dois atributos em 1 (máximo 20), ou escolha um talento.'})
    features.sort(key=lambda f: f['level'])
    intro = [rows[k] | {'t': texts[k]} for k in range(len(rows)) if rows[k]['p'] == 8 and 8.5 <= rows[k]['s'] <= 10.0 and texts[k]]
    summary = '\n\n'.join(feats_items._paragraphs(intro)[:3])[:2000]
    data = {'summary': summary, 'hitDie': 'd8', 'primaryAbilities': ['int'], 'savingThrows': ['con', 'int'],
            'skillChoices': {'count': 2, 'options': ['arcana', 'history', 'investigation', 'medicine', 'nature', 'perception', 'sleight_of_hand']},
            'armor': ['light', 'medium', 'shield'], 'weapons': {'simple': True, 'martial': 'none'},
            'tools': 'Ferramentas de ladrão, ferramentas de funileiro e um tipo de ferramenta de artesão à sua escolha',
            'equipment': 'Duas armas simples quaisquer; uma besta leve e 20 virotes; armadura de couro batido ou brunea; ferramentas de ladrão e um pacote de aventureiro',
            'startingGold': 125, 'asiLevels': [4, 8, 12, 16, 19], 'subclassLevel': 3, 'subclassLabel': 'Especialização de Artífice',
            'spellcasting': {'ability': 'int', 'list': 'artificer', 'progression': 'half',
                             'cantrips': [2] * 9 + [3] * 4 + [4] * 7,
                             'prepared': [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15]},
            'features': features}
    return [{'kind': 'class', 'key': 'artificer', 'name': 'Artífice', 'data': data},
            spells.column_list(rows, {12}, 9.9, 11.9, 'artificer')]


def tasha(rows):
    """Subclasses, magias, talentos e itens mágicos do Caldeirão de Tasha (tamanhos de título do PDF)."""
    classes = spells.table_classes(rows, {104}, 9.9)
    classes.setdefault('invocar feérico', classes.get('invocar fada', ''))  # nome diferente na tabela
    return (artificer(rows) + subclasses.parse(rows, 27.7, 14.8, 12.9) + class_options.parse(rows) + spells.parse(rows, 12.5, classes)
            + feats_items.feats(rows, 80, 84, 14.8) + feats_items.items(rows, 118, 136, 12.5))


XANATHAR_CLASS_PAGES = {'barbarian': (9, 16), 'bard': (17, 19), 'warlock': (20, 25), 'cleric': (26, 28),
                        'druid': (29, 34), 'sorcerer': (35, 39), 'fighter': (40, 44), 'rogue': (45, 48),
                        'wizard': (49, 51), 'monk': (52, 55), 'paladin': (56, 59), 'ranger': (60, 68)}


# Magias cujo nome o OCR quebrou na lista de classes: nome corrigido e classes conferidas no livro.
XANATHAR_SPELL_FIXES = {'evaporação de abi- dalzim-dalzim': ('Evaporação de Abi-Dalzim', ('sorcerer', 'wizard')),
                        'inundação de energia negativa': ('Inundação de Energia Negativa', ('warlock', 'wizard'))}


def xanathar(rows, layout_dir):
    """Subclasses (OCR) e magias do Xanathar; o texto da magia vem do compêndio quando o nome bate."""
    compendium = {s['name'].lower(): s for s in spells.parse(bookkit.load(layout_dir / 'LIVRO DE MAGIAS.jsonl'))}
    found, class_lists = [], spells.ocr_class_lists(rows, {150, 151, 152})
    for spell in spells.parse(rows, body_max=10.6, upper_names=True, pages=(150, 200)):
        if spell['name'].startswith('Magia sem nome'):
            continue
        same = compendium.get(spell['name'].lower())
        spell = same | {'key': spell['key']} if same else spell
        # Classes: as do compêndio somadas às listas do próprio Xanathar (capítulo 3).
        fix = XANATHAR_SPELL_FIXES.get(spell['name'].lower())
        if fix:
            spell = spell | {'name': fix[0]}
        listed = class_lists.get(spells.ocr_spell_name(spell['name']), set()) | set(fix[1] if fix else ())
        spell['data'] = spell['data'] | {'classes': sorted(set(spell['data']['classes']) | listed)}
        found.append(spell)
    text = ocr_sections(rows, skip_pages=lambda page: page <= 3 or 150 <= page <= 174, key_prefix='xgte')
    print('  texto do livro (OCR):', len(text), 'seções')
    return (subclasses.parse_ocr(rows, XANATHAR_CLASS_PAGES) + found + feats_items.feats_ocr(rows, 76, 79)
            + feats_items.items(rows, 130, 150, 8.0, 10.6, ocr=True) + text)


PHB_BACKGROUNDS = ['Acólito', 'Artesão de Guilda', 'Artista', 'Charlatão', 'Criminoso', 'Eremita', 'Forasteiro',
                   'Herói do Povo', 'Marinheiro', 'Nobre', 'Órfão', 'Sábio', 'Soldado']


PHB_CLASS_PAGES = {'barbarian': (45, 49), 'bard': (50, 54), 'warlock': (55, 61), 'cleric': (62, 69), 'druid': (70, 75),
                   'sorcerer': (76, 81), 'fighter': (82, 87), 'rogue': (88, 92), 'wizard': (93, 100), 'monk': (101, 106),
                   'paladin': (107, 113), 'ranger': (114, 121)}


def phb(rows, layout_dir):
    """Raças, antecedentes e talentos do Livro do Jogador 2014 (OCR do PDF escaneado, "LIVRO DO JOGADOR.jsonl")."""
    source = layout_dir / 'LIVRO DO JOGADOR.jsonl'
    if not source.exists():
        print('  faltando', source, '(rode o OCR do Livro do Jogador)')
        return []
    ocr = bookkit.load(source)
    subs = subclasses.parse_phb(ocr, PHB_CLASS_PAGES)
    known = [s['name'] for s in spells.parse(bookkit.load(layout_dir / 'LIVRO DE MAGIAS.jsonl'))]
    print('  terrenos do Círculo da Terra:', subclasses.add_land_terrains(ocr, subs, known))
    print('  magias de domínio/juramento:', subclasses.add_table_spells(ocr, subs), 'subclasses')
    text = ocr_sections(ocr, skip_pages=lambda page: page <= 2 or 211 <= page <= 287, key_prefix='phb')
    print('  texto do livro (OCR):', len(text), 'seções')
    return (races_ocr.parse(ocr, 17, 44) + subs + backgrounds.parse(ocr, PHB_BACKGROUNDS, 127, 142)
            + feats_items.feats_ocr(ocr, 166, 171, (15, 40), (15, 40), None,
                                    skip=('talentos', 'espaço de magia por nível de magia'))
            + text)


_WORD = re.compile(r'[A-Za-zÀ-ÿ]+')
PUNCT = '.,;:!?()"“”\'—–-'


def readable(text):
    """Linha de OCR que é texto de verdade (e não ruído de imagem/marca d'água): a maioria das
    palavras tem vogal e só letras."""
    words = text.split()
    if not words:
        return False
    good = sum(1 for w in words if _WORD.fullmatch(w.strip(PUNCT)) and re.search(r'[aeiouáéíóúâêôãõà]', w, re.I))
    return good / len(words) >= 0.6


_VOCAB = None


def _ocr_vocabulary():
    global _VOCAB
    if _VOCAB is None:
        layout = pathlib.Path(sys.argv[1])
        _VOCAB = ocr_fix.build_vocabulary([layout / f for f in ('T20.jsonl', 'CALDEIRÃO DE TASHA.jsonl', 'LIVRO DE MAGIAS.jsonl',
                                                                 'MONSTROS DO MULTIVERSO.jsonl', 'MANUAL DE MONSTROS.jsonl')])
    return _VOCAB


def _bare(text):
    """Texto sem acento, pontuação e espaço (para comparar variações de OCR)."""
    import unicodedata
    text = unicodedata.normalize('NFD', text)
    return re.sub(r'[^a-z0-9]', '', ''.join(c for c in text if unicodedata.category(c) != 'Mn').lower())


def ocr_sections(rows, skip_pages, key_prefix):
    """Texto corrido de um livro escaneado: "CAPÍTULO N" abre capítulo; linha curta em MAIÚSCULAS
    abre seção; o resto é texto (parágrafo novo pelo recuo). Linhas ilegíveis ficam de fora."""
    state = {'chapter': ''}

    def classify(r, t):
        letters = [c for c in t if c.isalpha()]
        upper = letters and sum(c.isupper() for c in letters) / len(letters) >= 0.85
        if re.match(r'^(CAP[ÍI]TULO\s+\d+|AP[ÊE]NDICE\s+[A-Z])\s*:', t) and len(t) < 70:
            state['chapter'] = t
            return 1
        # Rodapé com o capítulo ("CAPÍTULO 1 I OPÇÕES DE PERSONALIZAÇÃO"): abre o capítulo quando muda.
        footer = re.match(r'^(CAP[ÍI]TULO\s+\d+|AP[ÊE]NDICE\s+[A-Z])\s*[I|l1]\s+(.+)$', t)
        if footer and len(t) < 80:
            name = f"{footer.group(1)}: {footer.group(2)}"
            if _bare(name) == _bare(state['chapter']):
                return -1
            state['chapter'] = name
            return 1
        if upper and 3 <= len(t) <= 45 and not t.endswith('.') and readable(t):
            return 2
        return 0 if readable(t) else -1

    found = sections.build(rows, classify, skip=lambda r, t: skip_pages(r['p']), min_size=0)
    # Erros típicos de OCR corrigidos pelo vocabulário dos livros com texto limpo.
    vocab = _ocr_vocabulary()
    for entry in found:
        entry['name'] = ocr_fix.fix_text(entry['name'], vocab).lstrip('~|][ ')
        entry['data']['body'] = ocr_fix.fix_text(entry['data']['body'], vocab)
    for entry in found:
        entry['key'] = f"{key_prefix}-{entry['key']}"[:80].rstrip('-')
    return found


EXTRAS = {'tasha': lambda rows, layout_dir: tasha(rows), 'xanathar': xanathar, 'phb': phb}


def classifier(rows, any_body_font=False, body_min=9.0):
    """Títulos pelo tamanho; texto só na fonte do corpo (tabelas e blocos em outra fonte ficam de fora).

    `any_body_font`/`body_min`: livros com o corpo em mais de uma fonte ou menor que 9 (Tasha: 8,9).
    """
    body = collections.Counter(bookkit.family(r['f']) for r in rows if 9.5 <= r['s'] <= 10.6).most_common(1)[0][0]

    def classify(r, t):
        if any_body_font:
            if 25 <= r['s'] <= 40:
                return 1
            if r['s'] >= 17 and len(t) > 2:
                return 2 if r['s'] < 40 else -1  # acima de 40: capitular
            if r['s'] >= 10.8 and len(t) > 2:
                return 3
            return 0 if body_min <= r['s'] <= 10.7 else -1
        if r['s'] >= 17:
            return 1
        if r['s'] >= 12.5 and len(t) > 2:
            return 2
        if r['s'] >= 10.8 and len(t) > 2 and (r['b'] or bookkit.family(r['f']) != body):
            return 3
        if bookkit.family(r['f']) == body and 9.0 <= r['s'] <= 10.7:
            return 0
        return -1
    return classify


def build(book, rows, layout_dir, out_dir, pdf_dir):
    info = PACKS[book]
    entries, used = [], set()
    if info.get('monsters', True):
        ms = extract(book, rows, out_dir, pdf_dir)
        used = set().union(*(m['_rows'] for m in ms))
        entries += monsters.to_entries(ms)
    if info.get('spells'):
        sp = [s for s in spells.parse(rows) if s['data']['source'] == info['spells']]
        # O texto do livro fica só até a primeira magia (regras de conjuração).
        first = min(s.pop('_first') for s in sp)
        used |= set(range(first, len(rows)))
        entries += sp
    if info.get('extras'):
        extra = EXTRAS[info['extras']](rows, layout_dir)
        for e in extra:
            e.pop('_first', None)
        entries += extra
    if info['species']:
        sp = species.parse(rows, *info['species'])
        for s in sp:
            used |= s.pop('_rows')
        entries += sp
    # As páginas iniciais (créditos e sumário) ficam de fora do texto.
    toc_end = info.get('toc_end', 6)
    if info.get('sections', True):
        entries += sections.build(rows, classifier(rows, **info.get('text', {})), exclude=frozenset(used), skip=lambda r, t: r['p'] <= toc_end)
    if info.get('table_pages'):
        # Tabelas em outra fonte (ex.: "Blocos de Estatísticas por Ambiente"): títulos (≥ 8,4 e
        # negrito/maiores) abrem uma tabela; as células da mesma altura viram uma linha "ND — criaturas".
        first, last = info['table_pages']
        tables, current = [], None
        lines = collections.OrderedDict()
        for r in sorted((r for r in rows if first <= r['p'] <= last), key=lambda r: (r['p'], r['c'], round(r['y'] / 4), r['x'])):
            lines.setdefault((r['p'], r['c'], round(r['y'] / 4)), []).append(r)
        for cells in lines.values():
            text = ' — '.join(bookkit.clean(c['t']) for c in cells if bookkit.clean(c['t']))
            if 'APÊNDICE |' in text:
                continue  # rodapé da página
            if not text or re.fullmatch(r'\d{1,3}', text):
                continue
            if len(cells) == 1 and text.startswith('Criaturas') and len(text) < 50:
                current = {'title': text, 'lines': [], 'page': cells[0]['p']}
                tables.append(current)
            elif current is not None:
                if current['lines'] and text[:1].islower():
                    current['lines'][-1] += ' ' + text  # célula quebrada em duas linhas
                else:
                    current['lines'].append(text)
        for order, table in enumerate(t for t in tables if t['lines']):
            entries.append({'kind': 'section', 'key': bookkit.slug(f"tabela-{table['title']}")[:80].rstrip('-'), 'name': table['title'][:200],
                            'data': {'chapter': 'Blocos de Estatísticas por Ambiente', 'path': ['Blocos de Estatísticas por Ambiente', table['title']],
                                     'order': 100000 + order, 'page': table['page'], 'body': chr(10).join(f'- {line}' for line in table['lines'])[:60000]}})
    if any(e['kind'] == 'subclass' for e in entries):
        # Magias sempre preparadas das subclasses: tabelas do livro, com os nomes corrigidos pela
        # lista de magias do próprio livro e do Livro de Magias.
        known = [e['name'] for e in entries if e['kind'] == 'spell']
        compendium = layout_dir / 'LIVRO DE MAGIAS.jsonl'
        if compendium.exists():
            known += [s['name'] for s in spells.parse(bookkit.load(compendium))]
        print('  tabelas de magias de subclasse:', subclasses.add_spell_tables(rows, entries, known))
        subclasses.fix_prepared_names(entries, known)
        subclasses.apply_prepared_errata(entries)
    pack = {'format': 'codexveil.dnd5e.book', 'version': 1,
            'book': {'id': info['id'], 'name': info['name'], 'category': info['category'], 'edition': '2014', 'origin': ORIGIN},
            'entries': entries}
    path = out_dir / f"{info['id']}.book.json"
    path.write_text(json.dumps(pack, ensure_ascii=False), encoding='utf-8')
    print(book, '→', path.name, dict(collections.Counter(e['kind'] for e in entries)))


if __name__ == '__main__':
    layout_dir, out_dir = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
    pdf_dir = pathlib.Path(sys.argv[3]) if len(sys.argv) > 3 else None
    only = sys.argv[4:]  # opcional: nomes dos livros a montar
    for book in PACKS:
        if only and book not in only:
            continue
        build(book, bookkit.load(layout_dir / f'{book}.jsonl'), layout_dir, out_dir, pdf_dir)
