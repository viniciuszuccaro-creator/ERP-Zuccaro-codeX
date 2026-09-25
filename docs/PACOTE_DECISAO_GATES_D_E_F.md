# Pacote de decisão por gate — D / E / F (pós-Gate E)

## Distinção obrigatória de estado

| Estado | Significado | Valor atual |
|---|---|---|
| `READY_FOR_REVIEW` | Pacote técnico revisável | **SIM** (pré-D) |
| `AUTHORIZED` (Gate E) | Checkbox + assinatura VINICIUS | **SIM** (E) |
| `EXECUTED` (Gate E) | Migrations 016–024 no DEV + `test:postgres` | **SIM** (`GATE_E_STATUS=OK`) |
| `AUTHORIZED` / `EXECUTED` (D) | Auth + canário + smokes Gate D | **SIM** (D EXECUTADO 2026-09-25) |
| `AUTHORIZED` / `EXECUTED` (F) | Promoção 3080 | **EXECUTED_OK** · `894b0db8` · `16:35:34Z` · pós-smoke + cleanup §E OK |

`GATE_*_READY=YES` **nunca** autoriza nem executa.

## Fatos pós-Gate F (2026-09-25)

| Item | Valor |
|---|---|
| Main (pré-docs #40) | `894b0db8` (PR #37) |
| Gate E | **OK** |
| Gate D | **OK** (Auth · canário · Bearer · browser · mutação · negativos · limpeza) |
| Gate F | **EXECUTED_OK** — promoção 3080 · Auth+smoke · cleanup §E |
| API 3080 | `comercial360-main-894b0db8` · `ERP-RUNTIME-08B` · `supabase_user` |
| Rollback | `erp-api-dev-r07b-pre-f-20260925-163531` (ex-R07B `ca0bc5f3`) |
| Schema DEV | 001–024 |

## Bloqueios Gate F

~~Todos concluídos~~ — build · re-smoke canário · promote · pós-smoke 3080 · cleanup §E.

## Próximo (fora D/E/F)

1. Merge PR **#40** (docs/evidências Gate F) em `main`.
2. Comercial 360 **Onda 3** — Central Cliente 360 · PR **#39** (resolver conflito com `main`).

## Proibições

Não re-promover 3080 · não promover `2fc2fc80` · não dump no Git · não inventar assinatura.
