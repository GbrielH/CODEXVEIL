"""Antecedentes (kind 'background') de um livro, a partir da linha "Proficiência em Perícias:".

Os nomes vêm em ordem (o título grande do OCR é pouco confiável); o resumo são os parágrafos
antes das proficiências, e a característica é o bloco "CARACTERÍSTICA: Nome".
"""
import re

from bookkit import clean, fix_words, join_lines, slug

SKILL_WORDS = {'acrobacia': 'acrobatics', 'adestrar': 'animal_handling', 'arcanismo': 'arcana', 'atletismo': 'athletics',
               'enganação': 'deception', 'história': 'history', 'intuição': 'insight', 'intimidação': 'intimidation',
               'investigação': 'investigation', 'medicina': 'medicine', 'natureza': 'nature', 'percepção': 'perception',
               'atuação': 'performance', 'persuasão': 'persuasion', 'religião': 'religion', 'prestidigitação': 'sleight_of_hand',
               'furtividade': 'stealth', 'sobrevivência': 'survival'}
LABELS = {'perícias': 'skills', 'ferramentas': 'tools', 'idiomas': 'languages', 'equipamento': 'equipment'}
LABEL = re.compile(r'^(?:Profici\S*\s+em\s+(Per\S*cias|Ferramentas)|(Idiomas)|(Equipamento))\s*:\s*(.*)$', re.I)
FEATURE = re.compile(r'^CARACTER\S*STICA\s*:\s*(.+)$', re.I)


def _heading(t):
    letters = [ch for ch in t if ch.isalpha()]
    return len(letters) >= 4 and sum(ch.isupper() for ch in letters) >= 0.8 * len(letters)


def _paragraphs(rows):
    paras, current, last = [], [], None
    for r in rows:
        if current and r['p'] == last['p'] and r['c'] == last['c'] and r['y'] - last['y'] > r['s'] * 2.2:
            paras.append(join_lines(current)); current = []
        current.append(r['t']); last = r
    if current:
        paras.append(join_lines(current))
    return [fix_words(p) for p in paras if len(p) > 20]


def parse(rows, names, first_page, last_page):
    texts = [clean(r['t']) for r in rows]
    anchors = [i for i, t in enumerate(texts) if first_page <= rows[i]['p'] <= last_page and re.match(r'Profici\S*\s+em\s+Per', t)]
    entries = []
    for n, (a, name) in enumerate(zip(anchors, names)):
        # Resumo: linhas antes das perícias, desde o fim do antecedente anterior (ou 25 linhas).
        # O título com o nome do antecedente ("HERÓI DO POVO") marca o começo; sem ele, o último
        # título antes das perícias (tabelas de personalidade do antecedente anterior ficam de fora).
        title = next((k for k in range(a - 1, max(a - 90, 0), -1) if texts[k].upper() == name.upper()), None)
        start = max(a - 25, 0)
        if title is not None:
            start = title + 1
        else:
            for k in range(a - 1, start, -1):
                if _heading(texts[k]) and len(texts[k]) > 3:
                    start = k + 1
                    break
        summary = '\n\n'.join(_paragraphs([rows[k] | {'t': texts[k]} for k in range(start, a) if texts[k]]))
        fields, field = {'skills': '', 'tools': '', 'languages': '', 'equipment': ''}, None
        k = a
        while k < len(rows) and k < a + 24:
            m = LABEL.match(texts[k])
            if m:
                word = (m.group(1) or m.group(2) or m.group(3)).lower()
                field = next(v for key, v in LABELS.items() if word.startswith(key[:5]))
                fields[field] = m.group(4)
            elif field == 'equipment' and texts[k] and not _heading(texts[k]) and not FEATURE.match(texts[k]):
                # O equipamento é o último campo e quebra em várias linhas: vai até o ponto final.
                fields[field] = join_lines([fields[field], texts[k]])
                if fields[field].rstrip().endswith('.'):
                    k += 1
                    break
            elif field and texts[k] and not _heading(texts[k]) and (texts[k][:1].islower() or fields[field].endswith((',', 'e', 'de'))):
                fields[field] = join_lines([fields[field], texts[k]])
            elif field:
                break
            k += 1
        feature = None
        end = anchors[n + 1] if n + 1 < len(anchors) else len(rows)
        for f in range(k, end):
            m = FEATURE.match(texts[f])
            if m:
                body = []
                for g in range(f + 1, end):
                    if _heading(texts[g]) and len(texts[g]) > 3:
                        break
                    if texts[g]:
                        body.append(rows[g] | {'t': texts[g]})
                title = m.group(1).strip().title().replace(' Da ', ' da ').replace(' De ', ' de ').replace(' Do ', ' do ').replace(' Dos ', ' dos ')
                feature = {'name': fix_words(title)[:120], 'description': '\n\n'.join(_paragraphs(body))[:4000]}
                break
        skills = [v for w, v in SKILL_WORDS.items() if w in fields['skills'].lower()][:4]
        data = {'summary': summary[:4000], 'skills': skills, 'tools': fields['tools'][:300],
                'languages': fields['languages'][:300], 'equipment': fix_words(fields['equipment'])[:1000]}
        if feature:
            data['feature'] = feature
        entries.append({'kind': 'background', 'key': slug(name), 'name': name, 'data': data})
    return entries
