# Extração dos livros do usuário (pacotes de livro)

Estes scripts geram, a partir dos PDFs que o responsável **possui**, os pacotes `.json`
(formato `codexveil.dnd5e.book`, validado por `parseBookPack` em
`packages/rpg-systems/src/dnd5e/books/pack.ts`) que ele importa em **Meus livros** no site.

**Nunca versione PDFs, textos extraídos ou pacotes gerados.** Só a lógica de leitura fica no
repositório. Gere tudo numa pasta fora do projeto (por exemplo, `Documents/Codexveil/livros`).

## Pré-requisitos

- Python 3.12+ com PyMuPDF numa venv fora do repositório:
  `python -m venv C:\caminho\venv` e `C:\caminho\venv\Scripts\python -m pip install pymupdf`.
- PDFs em `C:\Users\<você>\Downloads\D&D livros\` (Tasha, Xanathar, Manual de Monstros,
  Monstros do Multiverso, Livro de Magias e `D&D.pdf`, o Livro do Jogador 2014 escaneado).

## Etapas

1. **Layout dos PDFs com texto** (linhas com página, coluna, posição, fonte e negrito):
   `venv\Scripts\python -I scripts/books/layout.py "<pdf>" "<saída>/layout/<NOME>.jsonl"`
   para `CALDEIRÃO DE TASHA`, `XANATAR`, `MANUAL DE MONSTROS`, `MONSTROS DO MULTIVERSO` e
   `LIVRO DE MAGIAS` (use o nome do PDF sem extensão).
2. **Livro do Jogador (`D&D.pdf`, texto desenhado como curvas):** renderizar as páginas em PNG a
   200 dpi com PyMuPDF (`page.get_pixmap(dpi=200).save("pNNN.png")`), rodar o OCR do Windows
   (`scripts/books/ocr.ps1 <pngs> <ocr>`) e converter:
   `python -I scripts/books/ocr_to_layout.py <ocr> "<saída>/layout/LIVRO DO JOGADOR.jsonl"`.
3. **Estilos de um livro** (para descobrir tamanhos de título): `python -X utf8 scripts/books/styles.py <jsonl>`.
4. **Monstros:** `python -X utf8 scripts/books/run_monsters.py <saída>/layout <saída> [pasta dos PDFs]`.
   Com a pasta dos PDFs, atributos ilegíveis são lidos por OCR (`ocr_abilities.py`). Correções
   conferidas à mão ficam em `<saída>/correcoes.json` (fora do Git). Resultado em 2026-10-19:
   Manual de Monstros 428 blocos, Monstros do Multiverso 261.
5. **Texto corrido** (`sections.py`): `build(rows, classify, exclude=...)` monta capítulos e seções;
   `classify` é por livro (tamanho e fonte dos títulos). Os blocos de monstro já extraídos são
   excluídos pelas linhas em `m['_rows']` (devolvidas por `monsters.parse`).

6. **Raças** (`species.py`): `parse(rows, primeira_página, última_página)`; no Multiverso, 7 a 37.
7. **Pacotes:** `python -X utf8 scripts/books/build_pack.py <saída>/layout <saída> [pasta dos PDFs]`
   gera `<saída>/mm-2014.book.json` e `<saída>/mpmm.book.json` (monstros, raças e texto), prontos
   para importar em Meus livros.

Veja o andamento e o que falta em `docs/PROXIMOS_PASSOS.md` ("Continuidade").
