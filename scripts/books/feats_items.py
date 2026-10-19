"""Talentos (kind 'feat') e itens mágicos (kind 'magic_item') de um livro.

Talentos: cada título do tamanho dado entre duas páginas; "Pré-requisito:" logo abaixo.
Itens: o título acima de uma linha de tipo e raridade ("Item maravilhoso, raro (requer sintonização)").
"""
import re

from bookkit import clean, fix_words, join_lines, slug

ABILITY_WORDS = {'força': 'str', 'destreza': 'dex', 'constituição': 'con', 'inteligência': 'int',
                 'sabedoria': 'wis', 'carisma': 'cha'}
ITEM_TYPE = re.compile(r'^(Item maravilhoso|Arma|Armadura|Anel|Bastão|Cajado|Varinha|Poção|Pergaminho|Tatuagem|Escudo|Munição)'
                       r'[^.]{0,80}?,\s*(?P<rarity>(?:comum|incomum|rar[oa]|muito rar[oa]|lendári[oa]|artefato|(?:a )?raridade (?:varia|variável)).*?)'
                       r'\s*(?:\((?P<att>requer sintoniza[^)]*)\)?)?\.?$', re.I)


def _paragraphs(rows):
    paras, current, last = [], [], None
    for r in rows:
        if current and (r['lead'] or r['p'] == last['p'] and r['c'] == last['c'] and
                        (r['y'] - last['y'] > r['s'] * 1.9 or r['x'] - last['x'] > 4)):
            paras.append(join_lines(current)); current = []
        current.append(r['t']); last = r
    if current:
        paras.append(join_lines(current))
    return [fix_words(p)[:8000] for p in paras if p]


def _body(rows, texts, start, body_max, ocr=False):
    """Linhas de corpo a partir de start até o próximo título (ignora números de página)."""
    out = []
    for k in range(start, len(rows)):
        t = texts[k]
        if not t or re.fullmatch(r'\d{1,3}', t):
            continue
        if rows[k]['s'] > body_max + 0.6 or ocr and _upper(t) and 3 < len(t) < 60:  # OCR: título em caixa alta menor
            break
        if rows[k]['s'] >= 8.5:
            out.append(rows[k] | {'t': t})
    return out


def feats(rows, first_page, last_page, title_size, body_max=10.5):
    texts = [clean(r['t']) for r in rows]
    entries, seen = [], set()
    for i, r in enumerate(rows):
        if not (first_page <= r['p'] <= last_page and abs(r['s'] - title_size) <= 0.3 and texts[i]):
            continue
        body = _body(rows, texts, i + 1, body_max)
        prereq = ''
        if body and body[0]['t'].startswith('Pré-requisito'):
            lines = [body.pop(0)['t']]
            while body and body[0]['t'][:1].islower() or body and lines[-1].endswith(('de', 'ou', 'e')):
                lines.append(body.pop(0)['t'])
            prereq = join_lines(lines).split(':', 1)[-1].strip().rstrip('.')
        text = '\n\n'.join(_paragraphs(body))
        data = {'category': 'general', 'description': text[:8000], 'prerequisite': prereq[:300], 'abilityIncrease': [],
                'repeatable': 'mais de uma vez' in text}
        found = re.search(r'Aumente (?:o seu|seu|um) valor de ([^.]+?) em 1', text)
        if found:
            data['abilityIncrease'] = [v for w, v in ABILITY_WORDS.items() if w in found.group(1).lower()]
        key = slug(texts[i])
        if key in seen or not text:
            continue
        seen.add(key)
        entries.append({'kind': 'feat', 'key': key, 'name': texts[i][:200], 'data': data})
    return entries


def items(rows, first_page, last_page, title_min, body_max=10.5, ocr=False):
    """ocr=True (Xanathar): o título é a linha em caixa alta acima do tipo, menor que o corpo."""
    texts = [clean(r['t']) for r in rows]
    entries, seen = [], set()
    for i, t in enumerate(texts):
        if not (first_page <= rows[i]['p'] <= last_page):
            continue
        m = ITEM_TYPE.match(t)
        if not m or i == 0 or rows[i - 1]['s'] < title_min:
            continue
        name = re.sub(r'^(\w+) \1\b', r'\1', texts[i - 1]).rstrip(',. ')  # "Tatuagem Tatuagem da…"
        if ocr:
            small = ('da', 'de', 'do', 'das', 'dos', 'e')
            name = ' '.join(w if w in small else w.capitalize() for w in name.replace('Ü', 'O').lower().split())
        rarity, attunement = m.group('rarity').strip(), m.group('att') or ''
        if rarity.endswith('(requer'):  # "(requer" no fim da linha e "sintonização)" na seguinte
            rarity, attunement = rarity[:-7].strip(), 'requer sintonização'
        data = {'type': t[:m.start('rarity')].rstrip(', ')[:200], 'rarity': rarity[:80],
                'attunement': attunement[:200], 'description': _paragraphs(_body(rows, texts, i + 1, body_max, ocr))[:200]}
        if data['description'] and data['description'][0].lower().startswith('sintoniza'):
            # "(requer" ficou na linha do tipo e "sintonização)" abriu o texto.
            data['description'] = data['description'][1:]
            data['attunement'] = 'requer sintonização'
        key = slug(name)
        base, n = key, 2
        while key in seen:
            key = f'{base}-{n}'; n += 1
        seen.add(key)
        entries.append({'kind': 'magic_item', 'key': key, 'name': name[:200], 'data': data})
    return entries


def _upper(t, share=0.85):
    letters = [ch for ch in t if ch.isalpha()]
    return len(letters) >= 4 and sum(ch.isupper() for ch in letters) >= share * len(letters)


def feats_ocr(rows, first_page, last_page, title_range=(7.9, 10.4), body_range=(9.3, 10.6), font='Times-Roman', skip=()):
    """font=None aceita qualquer fonte (OCR do Windows, sem fonte; tamanho = altura da linha)."""
    """Talentos de um PDF escaneado (Xanathar): título em caixa alta menor que o corpo."""
    texts = [clean(r['t']).replace('Ü', 'O') for r in rows]
    # Título: caixa alta (o OCR mistura algumas minúsculas, "BoA SoRTE"), curto, na fonte do corpo.
    is_title = lambda k: (title_range[0] <= rows[k]['s'] <= title_range[1] and _upper(texts[k], 0.6)
                          and (font is None or rows[k]['f'] == font) and 3 < len(texts[k]) <= 40
                          and not texts[k].endswith('.') and '•' not in texts[k])
    entries, seen = [], set()
    for i in range(len(rows)):
        if not (first_page <= rows[i]['p'] <= last_page and is_title(i)):
            continue
        body = []
        for k in range(i + 1, min(i + 120, len(rows))):
            if is_title(k) or rows[k]['p'] > last_page:
                break
            if texts[k] and body_range[0] <= rows[k]['s'] <= body_range[1] and not rows[k]['f'].startswith('Hidden'):
                body.append(rows[k] | {'t': texts[k]})
        prereq = ''
        if body and re.match(r'Pr.-?\s*[Rr]equisito', body[0]['t']):
            prereq = body.pop(0)['t'].split(':', 1)[-1].strip().rstrip('.')
        text = '\n\n'.join(_paragraphs(body))
        if len(text) < 60 or texts[i].lower().startswith('e '):
            continue
        text, prereq = fix_words(text), fix_words(prereq)
        name = ' '.join(w if w.lower() in ('do', 'da', 'de', 'dos', 'das', 'e', 'em', 'com') else w.capitalize() for w in texts[i].lower().split())
        if name.lower() in skip:
            continue
        data = {'category': 'general', 'description': text[:8000], 'prerequisite': prereq[:300], 'abilityIncrease': [],
                'repeatable': False}
        found = re.search(r'[Aa]umente (?:o seu|seu|sua|um|o) valor de ([^.]+?)\s+em\s+1', text)
        if found:
            data['abilityIncrease'] = [v for w, v in ABILITY_WORDS.items() if w in found.group(1).lower()]
        key = slug(name)
        if key in seen:
            continue
        seen.add(key)
        entries.append({'kind': 'feat', 'key': key, 'name': name[:200], 'data': data})
    return entries
