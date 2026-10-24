"""Características opcionais de classe (Caldeirão de Tasha): kind 'class_option'.

Em cada capítulo de classe (título 27,7), entre "Características opcionais de classe" e o próximo
título de seção (19,8), cada característica é um título (12,9–14,8) seguido da linha
"Característica de Nº nível de <classe> [que substitui a <característica>]". Títulos sem essa linha
(estilos de luta, magias adicionais) são opções dentro da característica de cima.
"""
import re

from bookkit import clean, join_lines, slug
from subclasses import CLASS_IDS

SUBCLASS_GROUP = re.compile(r'^(colegio|dominio|circulo|juramento|arquetipo|tradic|patrono|caminho|trilha|origens? de feitic|conclave|especializac|tradicoes|caminhos|trilhas|patronos|circulos|dominios|juramentos|arquetipos|colegios)')
FEATURE_LINE = re.compile(r'^Caracter[íi]stica\s+de\s+(?:(\d{1,2})\s*[º°o]?\s*n[íi]vel\s+de\s+(\S+)|(\S+)\s+de\s+(\d{1,2})\s*[º°o]?\s*n[íi]vel)', re.I)


def _plain(text):
    import unicodedata
    return ''.join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn').lower().strip()


def parse(rows):
    texts = [clean(r['t']) for r in rows]
    entries, klass, active, current = [], None, False, None
    lines = []

    def close():
        nonlocal current, lines
        if current is not None:
            body, paragraph = [], []
            for line in lines:
                if line.startswith('### '):
                    if paragraph:
                        body.append(join_lines(paragraph)); paragraph = []
                    body.append(line)
                else:
                    paragraph.append(line)
            if paragraph:
                body.append(join_lines(paragraph))
            text = '\n\n'.join(body).strip()
            replaces = re.search(r'que\s+substitu[ií]\w*\s+(?:a|o)?\s*(?:caracter[íi]stica\s+)?([A-ZÀ-Ú][\wÀ-ú]*(?:\s+(?:de|do|da|dos|das|[A-ZÀ-Ú][\wÀ-ú]*))*)', current['line'] + ' ' + text[:200])
            entries.append({'kind': 'class_option', 'key': slug(f"{current['classId']}-{current['name']}")[:80].rstrip('-'), 'name': current['name'][:200],
                            'data': {'classId': current['classId'], 'level': current['level'], 'replaces': re.sub(r'\s+(Você|Quando|Ao|Se|Começando|A partir)\b.*$', '', replaces.group(1).strip())[:200] if replaces else '',
                                     'description': text[:8000]}})
        current, lines = None, []

    for i, r in enumerate(rows):
        t = texts[i]
        if not t:
            continue
        if abs(r['s'] - 27.7) <= 0.3 and _plain(t) in {_plain(k) for k in CLASS_IDS}:
            close()
            klass = CLASS_IDS[next(k for k in CLASS_IDS if _plain(k) == _plain(t))]
            active = True  # o Clérigo não tem o título "Características opcionais de classe"
            continue
        # Fim das opções: começa a lista de subclasses (Colégio de Bardos, Domínios Divinos…).
        if active and r['s'] >= 11.5 and SUBCLASS_GROUP.match(_plain(t)):
            close()
            active = False
            continue
        if abs(r['s'] - 19.8) <= 0.3:
            if _plain(t).startswith('caracteristicas opcionais'):
                close()
                active = True
            elif not _plain(t).startswith('de classe'):
                close()
                active = False
            continue
        if not active or klass is None:
            continue
        if 11.5 <= r['s'] <= 15.0:
            nxt = next((texts[j] for j in range(i + 1, min(i + 4, len(rows))) if texts[j]), '')
            match = FEATURE_LINE.match(nxt)
            if match:
                close()
                level = int(match.group(1) or match.group(4))
                current = {'name': t, 'classId': klass, 'level': level, 'line': nxt}
            elif current is not None:
                lines.append('### ' + t)
            continue
        if current is not None and 8.5 <= r['s'] <= 10.7:
            if FEATURE_LINE.match(t) and not lines:
                current['line'] = t
                continue
            lines.append(t)
    close()
    return entries
