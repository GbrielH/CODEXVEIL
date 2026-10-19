"""Ferramentas comuns para gerar pacotes de livro do Codexveil a partir das linhas do layout.py."""
import json, re, unicodedata

def load(path):
    return [json.loads(line) for line in open(path, encoding='utf-8')]

def slug(text, maxlen=80):
    text = unicodedata.normalize('NFD', text)
    text = ''.join(ch for ch in text if unicodedata.category(ch) != 'Mn').lower()
    text = re.sub(r"[’'`]", '', text)
    text = re.sub(r'[^a-z0-9]+', '-', text).strip('-')
    return text[:maxlen].strip('-') or 'x'

def family(font):
    return re.sub(r'(MT|PSMT|PS)$', '', re.split(r'[,-]', font)[0])

def clean(text):
    text = text.replace('­', '').replace('ﬁ', 'fi').replace('ﬂ', 'fl')
    text = re.sub(r'_{3,}', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

# Erros comuns de leitura dos PDFs (fontes trocadas e OCR).
def fix_dice(text):
    text = re.sub(r'\b[lI](d\d)', r'1\1', text)            # ld6 -> 1d6
    text = re.sub(r'(\d)\s+d(\d)', r'\1d\2', text)          # 1 d4 -> 1d4
    text = re.sub(r'd[lI]([0-9])', r'd1\1', text)          # dl0 -> d10
    text = re.sub(r'd[lI]\b', 'd1', text)
    text = re.sub(r'\b(\d+d\d+)\s*4-\s*(\d)', r'\1 + \2', text)   # 2d10 4- 2 -> 2d10 + 2
    return text

def fix_signs(text):
    """No Monstros do Multiverso o sinal + saiu como "4-": "Int 4-12" = "Int +12"."""
    text = re.sub(r'\(4-(\d+)\)', r'(+\1)', text)
    text = re.sub(r'(?<![\d/–-])4-(\d{1,2})\b(?!\s*(?:m\b|metros|pés|horas|dias|vezes))', r'+\1', text)
    return text

def join_lines(lines):
    """Junta linhas de um parágrafo, desfazendo a hifenização do fim da linha."""
    out = ''
    for line in lines:
        line = clean(line)
        if not line:
            continue
        if out.endswith('-') and line[:1].islower():
            out = out[:-1] + line
        elif out:
            out += ' ' + line
        else:
            out = line
    return out

SIZES = r'(?:Miúd[oa]|Pequen[oa]|Médi[oa]|Grande|Enorme|Imens[oa]|Colossal)'
TYPE_LINE = re.compile(rf'^(?P<type>[^,]{{2,60}}?) (?P<size>{SIZES}(?: ou {SIZES})?)\b ?(?P<tags>\([^)]*\))?\s*,\s*(?P<align>.+)$')
TYPE_LINE_SIZE_FIRST = re.compile(rf'^(?P<size>{SIZES}(?: ou {SIZES})?) (?P<type>[^,(]{{2,60}}?) ?(?P<tags>\([^)]*\))?\s*,\s*(?P<align>.+)$')

FIELDS = [
    ('savingThrows', r'(?:Testes de Resistência|Salvaguardas)'),
    ('skills', r'Perícias'),
    ('vulnerabilities', r'Vulnerabilidades? (?:a|à) Danos?'),
    ('resistances', r'Resistências? (?:a|à) Danos?'),
    ('damageImmunities', r'Imunidades? (?:a|à) Danos?'),
    ('conditionImmunities', r'Imunidades? (?:a|à) Condi[çc](?:ão|ões)'),
    ('senses', r'Sentidos'),
    ('languages', r'Idiomas'),
    ('cr', r'(?:Nível de Desafio|Desafio)'),
    ('gear', r'Equipamento'),
]
FIELD_RES = [(key, re.compile(rf'^{pattern}\b\s*(.*)$')) for key, pattern in FIELDS]
SECTION_RES = [
    ('bonusActions', re.compile(r'^AÇÕES BÔNUS\b|^Ações Bônus\b', re.I)),
    ('legendaryActions', re.compile(r'^AÇÕES LENDÁRIAS\b|^Ações Lendárias\b', re.I)),
    ('reactions', re.compile(r'^REAÇÕES\b|^Reações\b', re.I)),
    ('actions', re.compile(r'^AÇÕES\b|^Ações\b', re.I)),
    ('mythic', re.compile(r'^AÇÕES MÍTICAS\b|^Ações Míticas\b', re.I)),
    ('lair', re.compile(r'^AÇÕES DE COVIL\b|^Ações de Covil\b', re.I)),
]
ENTRY_NAME = re.compile(r'^(?P<name>[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9][^.:]{0,70}?(?:\s*\([^)]{1,60}\))?)\.\s+(?P<rest>.*)$')
ABILITY_ROW = re.compile(r'(\d{1,2})\s*\(\s*([+\-–−]?\s*\d+(?:\s*[-–]\s*\d+)?)\s*\)')
