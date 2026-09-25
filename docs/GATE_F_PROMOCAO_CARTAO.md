# Gate F — promoção 3080 (cartão)

**Status:** `PREPARADO / BLOQUEADO` — Gate D **completo** (incl. limpeza §E); Gate F **sem** autorização humana.
**Não executar** neste lote Cursor.

## Pré-requisitos

| # | Item |
|---|---|
| 1 | Gate C APROVADO |
| 2 | Gate E APROVADO (se a imagem exigir 016+) |
| 3 | Gate D APROVADO com o **mesmo digest** a promover |
| 4 | Backup novo + rollback R07B preservados |
| 5 | `comercial360-rollback.sh` dry-run OK no instante |
| 6 | Autorização humana no termo (`TERMO_AUTORIZACAO_GATES_D_E_F.md`) |

**Atenção digest (2026-09-25):** a mutação Orçamento→Pedido passou em `comercial360-gate-d-2b45292e` (from-checkout), **não** na tag MAIN `comercial360-main-2fc2fc80`. Gate F **não** pode promover a MAIN antiga sem o fix do map Orçamento: exige merge do fix na MAIN + rebuild imutável `comercial360-main-<MERGE_SHA8>` + re-smoke no canário com essa tag, **ou** autorização explícita para promover o digest do canário aprovado.

## Regras

- Promover **somente** a imagem que passou no canário.
- 3080 permanece R07B até este gate.
- Rollback de API ≠ rollback de schema.
- `CONFIRM_ROLLBACK=YES` só com autorização.
- Pós-promoção: health/ready/meta + smoke Auth sintético + auditoria.

## Parar se

Digest divergente, backup falhou, canário não é o promovido, Auth ainda
`dev_headers` na imagem nova, ou termo sem assinatura.
