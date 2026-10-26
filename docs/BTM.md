# Behind the Magic (BTM) — implantação no Codexveil

Sistema da comunidade criado por **Will Nascimento** ("Manual de Runas", uso autorizado pelo
autor). O PDF fica em [`sistemas/behind-the-magic/MANUAL DE RUNAS.pdf`](sistemas/behind-the-magic/MANUAL%20DE%20RUNAS.pdf).

## Situação (2026-10-26)

- **Feito:** as regras escritas no manual estão em código em
  [`packages/rpg-systems/src/btm/rules.ts`](../packages/rpg-systems/src/btm/rules.ts), com testes:
  - atributos e distribuição de pontos;
  - as 34 perícias, com atributo, "só treinado", penalidade de armadura e graus de treino;
  - as 11 raças com sub-raças, bônus e características;
  - as 12 classes com 36 subclasses;
  - armaduras e penalidades, elementos, mana remanescente, runas de exemplo;
  - testes de combate (resistir, contra-atacar, esquivar, bloquear, crítico);
  - sanidade, vida e morte, movimento e queda.
- **Leitura do manual:** a maior parte do texto é imagem; foi lida por OCR (Windows, pt-BR) e as
  páginas ilegíveis foram conferidas à mão.
- **Ainda não está no site:** a ficha, a criação de personagem e o registro do sistema na aba
  **Sistemas da comunidade** esperam as respostas abaixo. Sem elas não dá para calcular a ficha
  (pontos de vida, mana, defesa, evolução).

## Resumo das regras transcritas

| Tema                   | Regra (página do manual)                                                                                                                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Teste                  | d20 + atributo (+ treino da perícia). Atributo 0: 2d20, fica o pior (p. 10).                                                                                                                                    |
| Atributos              | Todos começam em 1; 8 pontos; máximo 5 na criação; baixar um a 0 dá +1 ponto (p. 10).                                                                                                                           |
| Perícias               | 3 treinadas na criação. Destreinado 0, Treinado +3, Veterano +5, Expert +7 (p. 49–50).                                                                                                                          |
| Armadura               | Defesa Corporal: leve +2, média +3, pesada +5. Perícias com penalidade: leve −2, média −3, pesada −5, escudo −2. Sem kit de ferramentas: −5 (p. 51, 64).                                                        |
| Ataque                 | Corpo a corpo d20+Força; à distância d20+Destreza; soma o treino da perícia e o bônus da arma, contra a defesa do alvo (p. 88, 94).                                                                             |
| Reações (1 por rodada) | Resistir (magia): 1d20+Int+metade do nível. Contra-atacar (inimigo errou de perto): 1d20+Força. Esquivar: Defesa Corporal+Destreza. Bloquear: toma metade do dano (p. 89–91).                                   |
| Penalidades de arma    | Arremessar arma que não é de arremesso −4; arma improvisada −4; sem proficiência −4; arma dupla que não é dupla −10; arma à distância usada de perto −4 (p. 62–63, 94).                                         |
| Crítico                | 20 natural; o dano é o máximo da fórmula (2d8+3 = 19). 1 natural quase sempre falha. Empate favorece o defensor. Arredonda para baixo (p. 98).                                                                  |
| Vida e morte           | 0 PV: inconsciente; morre no negativo de metade da vida; 3 turnos para primeiros socorros (p. 78).                                                                                                              |
| Sanidade               | Teste de resistência mental: 1d100 ≤ NCM resiste. Loucura total por 3 turnos: o mestre passa a interpretar o personagem (p. 77).                                                                                |
| NCM                    | Nível de Conhecimento Mágico, de 0% a 100% (p. 79).                                                                                                                                                             |
| Mana remanescente      | Natural (sacrifícios), Mortal (ossos), Mágica (mox), Infernal (pactos); usada nas Runas Arcanas; regenera no descanso e com utensílios (p. 72–73).                                                              |
| Runas                  | Algumas duram mais de um turno; algumas só uma vez por dia. Exemplos de 1º mandamento: Telecinese Inicial, Luminescência, Anti Morto-vivo (1d6) (p. 74–75).                                                     |
| Ajuda e condições      | Ajudantes fazem DT 12; cada sucesso dá +1 ao líder. Condição favorável +3, desfavorável −3 (p. 80–81).                                                                                                          |
| Movimento              | Normal 10 m; máximo 10 m (pequeno 8 m); rastejar, esgueirar e nadar 5 m; escalar 2,5 m; queda 1d8 a cada 10 m (p. 82–86).                                                                                       |
| Combate                | Ação padrão, de movimento e livre; a padrão pode virar de movimento. Iniciativa define a ordem. Preparar: +3 na próxima rodada. Manobras: agarrar, atropelar, derrubar, desarmar, empurrar, separar (p. 87–97). |

## Perguntas para o criador

Lista para enviar ao Will. As respostas destravam a ficha automática e a criação no site.

### Personagem e evolução

1. **Pontos de vida:** quantos PV cada classe tem no 1º nível e quanto ganha por nível? Soma a
   Constituição?
2. **Mana remanescente:** quantos pontos de mana o personagem tem e como aumentam (por nível, por
   atributo, por classe, pelo NCM)? Cada personagem tem um tipo só de mana (Natural, Mortal,
   Mágica, Infernal)? Quem escolhe o tipo, e como?
3. **"Mox":** o que é o mox que a mana Mágica exige? Os "ossos", "sacrifícios" e "pactos" são
   itens gastos (quantos por runa)?
4. **Níveis:** qual o nível máximo? Como se sobe de nível (experiência, marcos)? O que se ganha
   a cada nível (atributo, perícia, habilidades da classe)?
5. **Habilidades das classes e subclasses:** o manual descreve cada uma em uma frase. Quais são
   as habilidades concretas (nome, nível, custo, efeito, dados)? Em que nível se escolhe a
   subclasse?
6. **Proficiências por classe:** quais armas (comuns, bélicas, incomuns) e armaduras cada
   classe sabe usar?
7. **Atributo de conjuração:** o teste de invocação de magia é "1d20 + modificador invocador de
   cada classe". Qual atributo cada classe usa?
8. **Sanidade:** quantos pontos de sanidade o personagem tem? Como se recupera? Quanto dano de
   sanidade cada situação causa?
9. **NCM inicial:** com quanto de NCM (0–100%) o personagem começa? Como aumenta? Os utensílios
   aumentam quanto?
10. **Defesa Corporal:** qual o valor base (sem armadura)? É 10 + Destreza, só a armadura, outro?
11. **Perícias por grau:** como se passa de Treinado para Veterano e Expert?
12. **Raças:**
    - quais são o tamanho (baixo, médio, grande) e a velocidade de cada raça?
    - "Ligeiro" (Elfo da Floresta) aumenta a velocidade em quanto?
    - qual a área e o dano do Sopro do Draconato?
    - as sub-raças do Githyanki, do Meio-orc e do Humano existem?
13. **Magias das sub-raças:** quais são as "magias de fogo, gelo, escuridão, destruição e marca"
    liberadas no nível 3 e no nível 5 (Drow, Meio-elfo Drow, Tiefling)? Os "truques à escolha"
    (Elfo Altaneiro, Meio-elfo Altaneiro) vêm de qual lista?

### Equipamento

14. **Tabela de armas:** existe uma lista de armas com dano, tipo, crítico, alcance, peso e
    preço? E de armaduras (peso, preço, penalidade)?
15. **Moeda e preços:** qual a moeda do mundo e o dinheiro inicial?
16. **Carga:** quanto peso o personagem carrega por ponto de Força?
17. **Itens amaldiçoados:** como funcionam na regra (bônus de NCM, efeitos, riscos)? Existe uma
    lista?

### Runas e combate

18. **Runas arcanas:** existe a lista completa por mandamento (2º, 3º…), com custo de mana,
    duração, alcance e teste? Quantas runas o personagem conhece no início?
19. **"Mandamento":** é o nível ou círculo da runa? Quem pode usar cada mandamento?
20. **Resistir:** contra que número se compara o teste de resistência a magia (o teste de
    invocação de quem lançou)?
21. **Contra-atacar e esquivar:** o contra-ataque causa o dano normal da arma? A esquiva
    substitui a Defesa Corporal naquele ataque?
22. **Elementos:** existe tabela de fraquezas e resistências entre os elementos? O "raio" e o
    "ácido" dos Draconatos são Eletricidade e Veneno da lista de elementos?
23. **Descanso:** quanto se recupera de PV, mana e sanidade num descanso curto e num longo?

### Outros

24. **Santuário (p. 76):** a página está em código binário. É um segredo de propósito? Qual a
    regra do Santuário?
25. **Governo (p. 99):** Infantaria, Marinha, Alquimia Real e Aeronáutica dão algum benefício de
    regra (patente, equipamento)?
26. **Ficha oficial:** existe um modelo de ficha do BTM? Ajudaria a montar a tela igual à do jogo
    de mesa.
