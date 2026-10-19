"""Texto corrido do livro em seções (kind 'section'): capítulo → seção, com subtítulos em Markdown."""
import re
from bookkit import clean, slug

NOISE = re.compile(r'^(\d{1,3}|[^\wÀ-ÿ]{1,3}|.{1,2})$')
MAX_BODY = 58000


def build(rows, classify, exclude=frozenset(), skip=None, min_size=6.0):
    """classify(row, text) -> 1 capítulo, 2 seção, 3 subtítulo, 0 texto, -1 ignorar."""
    sections = []
    chapter = ''
    current = None
    para = []
    last = None

    def flush_para():
        nonlocal para
        if current is not None and para:
            text = ''
            for line in para:
                if text.endswith('-') and line[:1].islower():
                    text = text[:-1] + line
                elif text:
                    text += ' ' + line
                else:
                    text = line
            text = re.sub(r'^[•●▪■]\s*', '- ', text)
            current['parts'].append(text)
        para = []

    def open_section(title, page):
        nonlocal current
        flush_para()
        if current is not None and (current['parts'] or current['title'] != chapter):
            sections.append(current)
        current = {'chapter': chapter, 'title': title, 'page': page, 'parts': []}

    for i, r in enumerate(rows):
        if i in exclude or r['s'] < min_size:
            continue
        t = clean(r['t'])
        if not t or NOISE.match(t) or (skip and skip(r, t)):
            continue
        level = classify(r, t)
        if level < 0:
            continue
        if level == 1:
            flush_para()
            if current is not None and current['parts']:
                sections.append(current)
            chapter = t.title() if t.isupper() else t
            current = {'chapter': chapter, 'title': chapter, 'page': r['p'], 'parts': []}
            last = None
            continue
        if level == 2:
            open_section(t.title() if t.isupper() and len(t) > 3 else t, r['p'])
            last = None
            continue
        if current is None:
            current = {'chapter': chapter, 'title': chapter or 'Início', 'page': r['p'], 'parts': []}
        if level == 3:
            flush_para()
            current['parts'].append('### ' + (t.capitalize() if t.isupper() else t))
            last = None
            continue
        new_para = (
            last is None
            or r['p'] != last['p']
            and False
            or r['lead'] != ''
            or (r['p'] == last['p'] and r['c'] == last['c'] and r['y'] - last['y'] > r['s'] * 1.9)
            or (r['p'] == last['p'] and r['c'] == last['c'] and r['x'] - last['x'] > 4)
            or t[:1] in '•●▪■'
        )
        if new_para:
            flush_para()
        para.append(t)
        last = r
    flush_para()
    if current is not None and current['parts']:
        sections.append(current)

    entries, seen = [], set()
    order = 0
    for sec in sections:
        body = '\n\n'.join(sec['parts']).strip()
        if len(body) < 40:
            continue
        chunks = [body]
        if len(body) > MAX_BODY:
            chunks, buf = [], ''
            for part in sec['parts']:
                if len(buf) + len(part) > MAX_BODY and buf:
                    chunks.append(buf); buf = ''
                buf = (buf + '\n\n' + part) if buf else part
            if buf:
                chunks.append(buf)
        for n, chunk in enumerate(chunks):
            title = sec['title'] if len(chunks) == 1 else f"{sec['title']} ({n + 1})"
            key = slug(f"{sec['chapter']}-{title}" if sec['chapter'] and sec['chapter'] != title else title)
            base, k = key, 2
            while key in seen:
                key = f'{base[:74]}-{k}'; k += 1
            seen.add(key)
            entries.append({'kind': 'section', 'key': key, 'name': title[:200],
                            'data': {'chapter': sec['chapter'][:160], 'path': [p[:200] for p in [sec['chapter'], title] if p][:8],
                                     'order': order, 'page': sec['page'], 'body': chunk[:60000]}})
            order += 1
    return entries
