# Instruções para agentes (Claude, Codex e outros)

Codexveil: plataforma de RPG de mesa em monorepo pnpm + Turborepo, com web (Next.js),
mobile (Expo) e Supabase. Comece por [`README.md`](README.md) e
[`docs/PROGRESS.md`](docs/PROGRESS.md).

## Documentação sempre em dia (obrigatório)

O projeto precisa estar **sempre documentado**. Toda mudança atualiza a documentação **no mesmo
commit**:

- [`docs/PROXIMOS_PASSOS.md`](docs/PROXIMOS_PASSOS.md): o relatório de próximos passos. Marque o
  que foi concluído, ajuste a ordem e registre no histórico com a data.
- [`docs/PROGRESS.md`](docs/PROGRESS.md): estado atual, testes executados (com números reais) e
  o próximo passo exato.
- [`docs/PENDENCIAS.md`](docs/PENDENCIAS.md): status dos critérios de aceitação e das pendências
  em relação ao escopo inicial.
- [`docs/DEPLOY.md`](docs/DEPLOY.md), [`docs/DATABASE.md`](docs/DATABASE.md),
  [`docs/SECURITY.md`](docs/SECURITY.md), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): quando
  mudar a publicação, o esquema, as regras de acesso ou uma decisão de arquitetura.

Registre resultados de forma fiel: o que foi verificado, como e o que ficou sem verificar.
Formate os Markdown com `pnpm exec prettier --write`.

## Git

- Faça commit e push para `origin main` só quando o responsável pedir, junto com a
  documentação atualizada.
- **Push em `main` publica em produção:** a Vercel publica o site, e o GitHub Actions
  (`.github/workflows/ci.yml`) roda `pnpm check` e publica a atualização OTA do app com
  `eas update` (na máquina do GitHub, sem gastar os minutos de CI do EAS). Rode `pnpm check`
  antes de cada push. Mudanças nativas (dependências Expo/React Native, plugins,
  `app.config.ts`) exigem um APK novo gerado à mão (`eas build`), que gasta um build da cota.
- Nunca versione segredos: `.env.local`, `.vercel/` e `supabase/.temp/` são ignorados.

## Verificações

- `pnpm check` (lint, typecheck e testes) e `pnpm build` precisam passar antes de publicar.
- O teste ao vivo (`packages/database/test/live`) só roda com as credenciais descritas em
  [`docs/PROGRESS.md`](docs/PROGRESS.md#teste-ao-vivo-contra-o-supabase-real). Ele cria e apaga
  contas temporárias.

## Produção: cuidados

- Supabase: só o projeto `CODEXVEIL` (`ityfhobhpjzhlkgvjhfb`). A conta da CLI tem outros
  projetos (por exemplo, FinFlow) que **não** devem ser tocados.
- Configuração do Auth em produção: só `deploy/supabase/config.toml`, com
  `--workdir deploy`. **Nunca** envie o `supabase/config.toml` da raiz, que é do ambiente local.
- Mudanças de esquema: sempre por nova migração em `supabase/migrations/`, conferindo antes
  com `supabase db push --dry-run`.
- Vercel: projeto `codexveil`. A conta tem outros projetos (finflow) que não devem ser tocados.
- A chave secreta do Supabase nunca vai para os apps nem para arquivos. Os apps recusam
  iniciar com ela.
