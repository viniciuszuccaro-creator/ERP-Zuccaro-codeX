# Gate F — promoção 3080 (cartão)

**Status:** `PREPARADO / BLOQUEADO até D APROVADO + autorização expressa`
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

## Regras

- Promover **somente** a imagem que passou no canário.
- 3080 permanece R07B até este gate.
- Rollback de API ≠ rollback de schema.
- `CONFIRM_ROLLBACK=YES` só com autorização.
- Pós-promoção: health/ready/meta + smoke Auth sintético + auditoria.

## Parar se

Digest divergente, backup falhou, canário não é o promovido, Auth ainda
`dev_headers` na imagem nova, ou termo sem assinatura.
