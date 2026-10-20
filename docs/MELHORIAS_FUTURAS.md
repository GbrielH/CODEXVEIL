# Melhorias futuras

Ideias aprovadas pelo responsável, mas **adiadas**. Antes de começar uma delas, mova-a para
[`PROXIMOS_PASSOS.md`](PROXIMOS_PASSOS.md).

## Dado 3D de verdade (estilo app "Dice") — adiado em 2026-10-20

- Hoje (2026-10-20): dados grandes em 2D caem, quicam e giram no meio da tela (site e app), até 6
  por vez (`components/dice/dice-throw.tsx`).
- Desejado: dados 3D com o número certo de lados, física real (rolam, batem e param na face
  sorteada pelo servidor).
- Caminho avaliado: biblioteca de dados 3D com física (por exemplo `@3d-dice/dice-box`) no site.
  No app exige componente nativo (WebView ou GL), ou seja, **APK novo** (gasta um build da cota e
  todos reinstalam uma vez).
- O resultado continua vindo do servidor (`roll_dice`); a animação só precisa parar na face certa.

## Sistema da comunidade "Behind the Magic" (Manual de Runas) — adiado em 2026-10-20

- RPG original de um amigo do responsável, com uso autorizado de todo o conteúdo (regras e
  imagens). Vai direto no Codexveil, na aba **Sistemas da comunidade**, e só aparece depois que o
  usuário ativar.
- Seguir o modelo dos sistemas existentes (`packages/rpg-systems/src/<id>/`, `registry.ts`,
  migração em `rpg_systems`, ficha e assistente no site e no app).
- PDF versionado: [`sistemas/behind-the-magic/MANUAL DE RUNAS.pdf`](sistemas/behind-the-magic/MANUAL%20DE%20RUNAS.pdf).
- Detalhes no item 12 dos pedidos de 2026-10-20 em [`PROXIMOS_PASSOS.md`](PROXIMOS_PASSOS.md).
