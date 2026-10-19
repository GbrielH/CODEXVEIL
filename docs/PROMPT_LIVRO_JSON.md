# Prompt: transformar um livro de RPG em pacote JSON do Codexveil

Copie o bloco abaixo para o Claude (ou outro agente) junto com o PDF do livro. O resultado é um
arquivo `.book.json` para importar em **Meus livros** no site; depois disso, marcar o livro na
campanha libera o conteúdo na criação de personagem, na subida de nível e na ficha (site e app).

O pacote é gerado do exemplar do próprio usuário e **nunca vai para o Git**.

---

```text
Você vai converter um livro de RPG que eu comprei em um pacote JSON do Codexveil.

1. PRIMEIRO, confira o sistema do livro. O Codexveil hoje só tem o sistema "dnd5e"
   (Dungeons & Dragons 5ª edição, regras de 2014 e de 2024; livros de terceiros para D&D 5e
   também servem). Veja os sistemas em packages/rpg-systems/src/registry.ts (SYSTEM_IDS).
   Se o livro for de outro sistema (Tormenta20, Pathfinder, Ordem Paranormal, Call of Cthulhu,
   um RPG de Stranger Things que não use as regras de D&D 5e etc.), PARE e me avise:
   "Este livro é do sistema X, que o Codexveil ainda não tem. É preciso criar o sistema antes."
   Não tente encaixar regras de outro sistema no formato de D&D.

2. Leia o formato em packages/rpg-systems/src/dnd5e/books/pack.ts (é a fonte da verdade:
   bookInfoSchema, BOOK_ENTRY_KINDS e o esquema de cada tipo). Resumo:
   {
     "format": "codexveil.dnd5e.book", "version": 1,
     "book": { "id": "...", "name": "...", "category": "core|player|monsters|gm|setting|adventure",
               "edition": "2014|2024", "origin": "PDF do exemplar do usuário" },
     "entries": [ { "kind": "...", "key": "minusculas-com-hifens", "name": "Nome", "data": { ... } } ]
   }
   - book.id: use o id do livro em packages/rpg-systems/src/dnd5e/sourcebooks.ts
     (DND5E_SOURCEBOOKS) quando o livro estiver lá; é por esse id que a campanha libera o
     conteúdo. Se não estiver, me avise para acrescentarmos o livro à lista.
   - kinds: class, subclass, species, background, feat, spell, spell_list, monster, magic_item
     e section (texto corrido do livro, opcional).

3. Extraia TUDO o que o livro tiver de cada tipo, com os dados estruturados completos:
   - class: dado de vida, atributos principais, salvaguardas, perícias, armaduras, armas,
     ferramentas, equipamento inicial (texto do livro), ouro inicial, níveis de aumento de
     atributo, nível da subclasse, conjuração (atributo, lista, progressão, truques e magias
     preparadas por nível) e todas as características com o nível.
   - subclass: classId (wizard, cleric… ou a key de uma classe do pacote), resumo e
     características com o nível; magias sempre preparadas, se houver.
   - species: resumo, tipo de criatura, tamanhos, deslocamento EM PÉS, traços, sub-raças em
     "lineage" e truques fixos.
   - background: resumo, perícias (ids em inglês: athletics, stealth…), ferramentas, idiomas,
     equipamento (texto do livro, com as moedas) e a característica.
   - feat, spell (círculo, escola, classes, tempo, alcance, componentes, duração,
     concentração, ritual, texto, nome original em inglês), spell_list, monster e magic_item.
   Escreva os textos como estão no livro. Não invente nada que o livro não diga; se um
   número estiver ilegível, me diga qual em vez de chutar.

4. Use os scripts de scripts/books/ (README.md) quando ajudarem: layout.py para PDFs com texto,
   ocr.ps1 + ocr_to_layout.py para PDFs escaneados, e os extratores (spells.py, subclasses.py,
   feats_items.py, backgrounds.py, races_ocr.py, species.py, monsters.py) como base.
   Trabalhe numa pasta FORA do repositório (ex.: Documents/Codexveil/livros-trabalho) e não
   versione o PDF, os textos extraídos nem o JSON.

5. Valide o pacote com parseBookPack (packages/rpg-systems/src/dnd5e/books/pack.ts): 0 erros.
   Simule a criação com buildDnd5eBookContent + setActiveDnd5eBookContent e confira que as
   novas classes, subclasses, raças, antecedentes, talentos e magias aparecem sem repetir
   nomes do SRD ou de outros livros.

6. Me entregue o caminho do arquivo .book.json e um resumo com a contagem de cada tipo e o
   que ficou de fora ou com dúvida.
```

---

## Depois de gerar

1. No site: **Meus livros → Escolher arquivo do livro (.json) → Importar**.
2. Na campanha: marque o livro nas opções de livros.
3. Na criação de personagem (site ou app), as opções do livro aparecem junto com o básico.
