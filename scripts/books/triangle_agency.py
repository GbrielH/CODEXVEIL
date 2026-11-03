"""Gera um pacote privado do exemplar de Triangle Agency.

Uso:
  <venv-com-pymupdf>/python -X utf8 -I scripts/books/triangle_agency.py \
    "<Triangle Agency.pdf>" "<triangle-agency.book.json>"

O PDF e o JSON gerado ficam fora do Git. O pacote contém o livro página a página e índices
estruturados do ARC, Requisições e Documentos com Bloqueio Lúdico.
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

import fitz


ANOMALIES = ['Sussurro', 'Catálogo', 'Drenagem', 'Cronometria', 'Crescimento', 'Arma', 'Sonho', 'Emaranhado', 'Ausência']
REALITIES = ['Cuidador', 'Sobrecarregado', 'Perseguido', 'Astro', 'Endividado', 'Recém-Nascido', 'Romântico', 'Mandachuva', 'Criatura']
COMPETENCIES = ['RP', 'P&D', 'Barista', 'CEO', 'Estagiário', 'Coveiro', 'Recepção', 'Atendimento', 'Palhaço']


def slug(value: str) -> str:
    value = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', value).strip('-') or 'entrada'


def clean(text: str) -> str:
    lines = []
    for raw in text.replace('\r', '').split('\n'):
        line = re.sub(r'\s+', ' ', raw).strip()
        if not line or line.startswith('Licenciado para '):
            continue
        lines.append(line)
    return '\n'.join(lines).strip()


def printed_page(pdf_index: int) -> int:
    return max(0, pdf_index - 3)


def chapter(page: int) -> str:
    if page < 10: return 'Abertura'
    if page < 54: return 'Manual do Agente de Campo'
    if page < 136: return 'Construindo o ARC'
    if page < 198: return 'Ferramentas do Gerente de Missão'
    return 'Documentos com Bloqueio Lúdico'


def entry(kind: str, key: str, name: str, data: dict) -> dict:
    return {'kind': kind, 'key': key[:80], 'name': name[:200], 'data': data}


def page_text(document, printed: int) -> str:
    return clean(document[printed + 3].get_text())


def main() -> None:
    source, destination = map(Path, sys.argv[1:3])
    document = fitz.open(source)
    entries = []
    for index, page in enumerate(document):
        body = clean(page.get_text())
        number = printed_page(index)
        first = next((line for line in body.splitlines() if not line.isdigit()), f'Página {number or index + 1}')
        entries.append(entry('section', f'pagina-{index + 1:03d}', first, {
            'chapter': chapter(number), 'order': index, 'page': number, 'body': body,
        }))

    for name, page in zip(ANOMALIES, range(60, 78, 2)):
        body = page_text(document, page) + '\n\n' + page_text(document, page + 1)
        entries.append(entry('arc_anomaly', slug(name), name, {'page': page, 'body': body}))
    for name, page in zip(REALITIES, range(80, 98, 2)):
        body = page_text(document, page) + '\n\n' + page_text(document, page + 1)
        entries.append(entry('arc_reality', slug(name), name, {
            'page': page, 'trigger': '', 'burnoutRelief': '', 'body': body,
        }))
    for name, page in zip(COMPETENCIES, range(100, 118, 2)):
        body = page_text(document, page) + '\n\n' + page_text(document, page + 1)
        entries.append(entry('arc_competency', slug(name), name, {
            'page': page, 'primaryDirective': '', 'sanctionedBehaviors': [],
            'initialRequisition': '', 'body': body,
        }))
    for page in range(128, 132):
        entries.append(entry('requisition', f'pagina-{page}', f'Requisições — página {page}', {
            'page': page, 'costs': [], 'body': page_text(document, page),
        }))
    for page in range(198, min(305, len(document) - 3)):
        body = page_text(document, page)
        match = re.search(r'(?<![A-Z0-9])([A-Z]\d+)(?![A-Z0-9])', body)
        code = match.group(1) if match else ''
        title = next((line for line in body.splitlines() if line and not line.isdigit()), f'Documento {page}')
        entries.append(entry('locked_document', f'documento-{page}', title, {
            'page': page, 'code': code, 'body': body,
        }))

    pack = {
        'format': 'codexveil.triangle-agency.book',
        'version': 1,
        'book': {
            'id': 'triangle-agency',
            'name': 'Triangle Agency: O Jogo de Interpretação',
            'category': 'core',
            'edition': 'Primeira edição',
            'origin': 'Exemplar do usuário (PDF)',
        },
        'entries': entries,
    }
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(pack, ensure_ascii=False), encoding='utf-8')
    print(f'{len(document)} páginas; {len(entries)} entradas; {destination}')


if __name__ == '__main__':
    main()
