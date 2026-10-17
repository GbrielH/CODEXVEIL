# Armazenamento e limites do Supabase

> Análise de 2026-10-17, pedida pelo responsável ("o Supabase tem espaço limitado, imagens etc.").
> Medições feitas no projeto `CODEXVEIL` com `supabase inspect db db-stats --linked`,
> `supabase inspect db table-stats --linked` e `supabase --experimental storage ls`.

## Quanto usamos hoje

| Recurso                   | Uso em 2026-10-17                                                            | Limite do plano gratuito |
| ------------------------- | ---------------------------------------------------------------------------- | ------------------------ |
| Banco (Postgres)          | 14 MB no total, quase tudo do próprio Postgres; tabelas do Codexveil: 320 kB | 500 MB                   |
| Arquivos (Storage)        | 1 imagem (um retrato)                                                        | 1 GB                     |
| Tráfego de saída (egress) | Não medido (uso de teste)                                                    | 5 GB/mês                 |
| Usuários ativos no mês    | 3 contas                                                                     | 50.000                   |
| Edge Functions            | 1 função (`notify-session`)                                                  | 500 mil chamadas/mês     |
| Realtime                  | Uso de teste                                                                 | 200 conexões simultâneas |

Fonte dos limites: <https://supabase.com/pricing>. **Atenção:** projetos gratuitos são
**pausados após 1 semana sem uso**; o site e o app param até alguém reativar no painel.

## O que ocupa espaço

| Dado                                      | Tamanho típico               | Limite já aplicado                                     |
| ----------------------------------------- | ---------------------------- | ------------------------------------------------------ |
| Ficha de personagem                       | 5–20 kB                      | 256 kB por ficha; plano limita personagens por conta   |
| Cópias de segurança da ficha              | igual à ficha                | 30 por personagem                                      |
| Rolagens de dados                         | ~0,5 kB cada                 | 200 por campanha (as antigas são apagadas)             |
| Itens da campanha                         | ~1–8 kB                      | 500 por campanha                                       |
| Roteiros, anotações, criaturas            | alguns kB cada               | limites de texto por campo                             |
| Imagens (retratos, criaturas, roteiro)    | 100–400 kB depois da redução | 2 MB por arquivo; reduzidas para WebP no site e no app |
| Conteúdo do SRD (magias, monstros, itens) | ~1 MB                        | **Fora do banco**: vai junto com o site e o app        |

Conta rápida: 1 GB de Storage comporta cerca de **3.000 a 5.000 imagens** reduzidas; 500 MB de
banco comportam dezenas de milhares de fichas. **O primeiro limite a apertar é o das imagens**
(e o egress de exibi-las), muito antes do banco.

## Possibilidades

1. **Continuar no gratuito (recomendado agora).** O uso é pequeno e as proteções acima já
   seguram o crescimento. Monitorar uma vez por mês com os comandos do topo.
2. **Apertar as imagens.** Já reduzimos para WebP (768 px no retrato, 1024 px nas criaturas,
   1600 px no roteiro). Dá para baixar mais (ex.: 512 px nos retratos) e apagar arquivos órfãos
   (imagens trocadas cujo envio falhou no meio) com uma rotina agendada.
3. **Limite por campanha/conta no Storage.** Contar os bytes por campanha e recusar envios
   acima de, por exemplo, 50 MB. Ainda não implementado.
4. **Imagens fora do Supabase.** Cloudflare R2 (10 GB grátis e sem custo de egress) ou
   Backblaze B2, com URLs assinadas geradas por uma Edge Function. Mais trabalho, mas resolve
   imagens e tráfego de vez.
5. **Supabase Pro (US$ 25/mês).** 8 GB de banco, 100 GB de arquivos, 250 GB de egress, backups
   diários e sem pausa por inatividade. É o caminho natural antes de abrir para outras pessoas.

**Recomendação:** ficar no gratuito enquanto o uso for da mesa de teste, usar o site pelo
menos uma vez por semana (ou reativar quando pausar), e migrar para o Pro antes de convidar
pessoas de fora. Se as imagens crescerem antes disso, o passo 3 (limite por campanha) é o mais
barato de implementar.
