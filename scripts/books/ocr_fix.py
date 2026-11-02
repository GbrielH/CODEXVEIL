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


_ACCENTS = {'a': 'áâã', 'e': 'éê', 'i': 'í', 'o': 'óôõ', 'u': 'ú'}


def _unique(options, vocab):
    """A única opção que existe no vocabulário (nenhuma ou várias = não troca)."""
    found = {option for option in options if option.lower() in vocab}
    return found.pop() if len(found) == 1 else None


def _second_pass(word, vocab):
    """Trocas sistemáticas da 2ª rodada (2026-11-02), só com resultado único e conhecido.

    - "m" lido no lugar de "rn" ("tumo" → "turno");
    - "Í" maiúsculo lido como "f" no meio de palavra em caixa alta ("NfVEIS" → "NÍVEIS");
    - acento perdido numa vogal ("beneficios" → "benefícios").

    Fora: "tom…" (o verbo tomar viraria tornar) e acento na última letra ("destaca" → "destacá",
    "quilo" → "quilô"), que trocavam palavras certas.
    """
    if 'm' in word and not word.lower().startswith('tom'):
        options = [word[:i] + 'rn' + word[i + 1:] for i, ch in enumerate(word) if ch == 'm']
        found = _unique(options, vocab)
        if found:
            return found
    if 'f' in word[1:] and word.replace('f', '').isupper():
        candidate = word.replace('f', 'Í')
        if candidate.lower() in vocab:
            return candidate
    options = []
    for i, ch in enumerate(word[:-1]):
        for accented in _ACCENTS.get(ch.lower(), ''):
            options.append(word[:i] + (accented.upper() if ch.isupper() else accented) + word[i + 1:])
    return _unique(options, vocab)


def fix_dice(text):
    """Notação de dados lida com letras: "ld4"/"Id8" → "1d4"/"1d8", "dlOO"/"d1OO" → "d100"."""
    text = re.sub(r'\b[lI](d(?:2|3|4|6|8|10|12|20|100))\b', r'1\1', text)
    text = re.sub(r'\bd[lI1][O0]{2}\b', 'd100', text)
    text = re.sub(r'\b(\d*)d[lI]([02])\b', lambda m: f'{m.group(1)}d1{m.group(2)}', text)
    return text


def fix_text(text, vocab):
    def fix(match):
        word = match.group(0)
        if word.lower() in vocab or word.isdigit() or len(word) < 3:
            return word
        for candidate in _candidates(word):
            if candidate.lower() in vocab and candidate.isalpha():
                # Mantém a caixa da primeira letra.
                return candidate[0].upper() + candidate[1:] if word[:1].isupper() else candidate
        if word.isalpha():
            second = _second_pass(word, vocab)
            if second:
                return second
        return word

    text = fix_dice(text)
    text = _WORD.sub(fix, text)
    text = re.sub(r'\b[Oo] (metros?|pés|minutos?|horas?|pontos?)\b', r'0 \1', text)
    # Parágrafo partido no meio da frase (OCR): junta quando o seguinte começa em minúscula.
    text = re.sub(r'([^.!?:;"”)\n])\n\n(?=[a-zà-ú])', r'\1 ', text)
    return text
