# Bloqueios únicos — candidata estoque @ `b8492074`

**Branch:** `codex/comercial-expedicao-cliente360-207-209-20261005`  
**SHA tip:** `b8492074e254fc015fa61fb1fb89ecd8210b7d7c`  
**Funcional B2:** `2c6e898e` (+ harness `28dee1da`)  
**Data:** 2026-10-06 (substitui `f5591d55`)

## Fechado

| ID | Item | Evidência |
|---|---|---|
| B1 | Automacao HTTP | `3decc4e4` |
| B2 | `useFluxoPedido` writers locais HTTP | `2c6e898e`; writer-guard 6/6 |
| — | Entrega/Retirada/Comprovante/Reversa | ancestral |
| — | CLI `reconcile:stock` | ancestral |

## Abertos

| ID | Bloqueio | Sev | Responsável |
|---|---|---|---|
| B3 | Snapshots privados G/E/produto/unidade/corte | P1 | Comercial |
| B4 | PG real (única mov., retry, concorrência, saldo, rollback) | P1 | Comercial |
| B5 | Telas autenticadas API/PG (recarga, retry, RBAC, troca empresa) | P1 | Cursor+Comercial |
| B6 | Homolog DEV / backup / reversão sob gates | P1 | Humano+gates |
| B7 | Publisher outbox real | Fora | — |
| B8 | Gap 032 / trava 026 | Histórico | — |
| R2 | `GerarOPModal` writer local sem guard HTTP | P2 | Comercial |

## Legado (coordenação)

Export VPS já existe — **não** refazer:  
`/root/erp-private/legado-empresas-api-20261006T153440Z.json`  
`private_sha256=18e2ab9a085dda6040d4d63d2dfc88d702b0a84203a5cf19d80358c46cca3d7e`  
SFTP → `BACKUP ERP ANTIGO - CODEX/04_REPORTS/` (sem sobrescrever) — [Legado: CADESP + staging](bc-4427c136-a373-5bb6-83b8-ffa135fdb2d9).
