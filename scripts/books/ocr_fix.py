"""Correção conservadora de erros de OCR em português, por vocabulário.

O vocabulário vem dos livros com texto limpo (PDF com texto: Tormenta20, Tasha, Livro de Magias,
livros de monstros). Uma palavra desconhecida só é trocada quando uma troca típica de OCR
("rn" → "m", "1" → "l", "0" → "o", "Ü" → "O", sujeira "~ ] |") gera uma palavra conhecida. Trocas
ambíguas (f/t, c/e, cl/d) ficam de fora: estragavam palavras certas. Palavras que já existem no vocabulário nunca mudam.
"""
import json
import pathlib
import re

_WORD = re.compile(r"[A-Za-zÀ-ÿ0-9~\]\[|]+")
_SWAPS = [('rn', 'm'), ('1', 'l'), ('0', 'o')]
_FIRST = {'1': 'l', 'Ü': 'O', 'ü': 'o'}


def build_vocabulary(layout_files):
    vocab = {}
    for path in layout_files:
        path = pathlib.Path(path)
        if not path.exists():
            continue
        for line in path.open(encoding='utf-8'):
            for word in re.findall(r'[A-Za-zÀ-ÿ]+', json.loads(line).get('t', '')):
                if len(word) >= 2:
                    key = word.lower()
                    vocab[key] = vocab.get(key, 0) + 1
    return {w for w, n in vocab.items() if n >= 2}


def _candidates(word):
    core = word.strip('~|][')
    yield core
    if core[:1] in _FIRST:
        yield _FIRST[core[0]] + core[1:]
    for a, b in _SWAPS:
        if a in core:
            yield core.replace(a, b)
            # Só a primeira ocorrência também (ex.: "rnorrer" → "morrer").
            yield core.replace(a, b, 1)


def fix_text(text, vocab):
    def fix(match):
        word = match.group(0)
        if word.lower() in vocab or word.isdigit() or len(word) < 3:
            return word
        for candidate in _candidates(word):
            if candidate.lower() in vocab and candidate.isalpha():
                # Mantém a caixa da primeira letra.
                return candidate[0].upper() + candidate[1:] if word[:1].isupper() else candidate
        return word

    text = _WORD.sub(fix, text)
    text = re.sub(r'\b[Oo] (metros?|pés|minutos?|horas?|pontos?)\b', r'0 \1', text)
    # Parágrafo partido no meio da frase (OCR): junta quando o seguinte começa em minúscula.
    text = re.sub(r'([^.!?:;"”)\n])\n\n(?=[a-zà-ú])', r'\1 ', text)
    return text
