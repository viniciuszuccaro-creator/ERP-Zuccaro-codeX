# Gate E — cartão (migrations faltantes) — NÃO EXECUTAR agora

**Status:** `PREPARADO / BLOQUEADO até termo + backup novo + autorização humana`
**Frente Cursor:** só inventário/precheck. Apply = processo VPS autorizado.

## Entrada

```bash
bash scripts/vps/gate-d-f-precheck.sh --from-gate-c-output saida-gate-c.txt \
  --candidate-list docs/vps/migrations-candidatas-comercial360.txt
bash scripts/vps/print-gate-e-fatias.sh
bash scripts/vps/check-backup-novo-gate-e.sh
bash scripts/vps/go-nogo-def.sh
```

Esperado hoje (VPS 001–015): `missing_for_gate_e=016,017,018,019,020,021,022,023,024`
Backup histórico Gate C: `BACKUP_NOVO_STATUS=STALE_NEED_NEW`
Agregado: `GO_NOGO=NO`

## Fatias propostas (aguardam Codex)

| Fatia | IDs | Conteúdo |
|---|---|---|
| Comercial | 016, 017 | Orçamento + Pedido |
| Produto / DAM / canais | 018–024 | PIM/DAM/outbox/mídia/norma/canais |

Ordem sugerida: comercial → `test:postgres` → produto. Alternativa: 016–024 juntas se Codex confirmar.

## Quando autorizado (futuro)

1. Backup **novo** em `/opt/erp-zuccaro/backups` (bytes + SHA-256), nome sugerido `pre-gate-e-YYYYMMDD-HHMMSS.sql`.
2. Rollback R07B preservado (`rollback-dry-run-check.sh`).
3. Checkout = **main** pós-merge (não branch feature).
4. Migrator canônico + `ON_ERROR_STOP`; só ids faltantes da fatia autorizada.
5. Conferir cada migration da main exatamente 1×.
6. `npm run test:postgres` no PostgreSQL **real**, >0 testes, 0 fail/skip.
7. Não reaplicar 001–015. Não usar CI efêmera como prova.

## Parar se

Duplicata, id inesperado >024, backup falhou, SHA divergente, ou pedido para
aplicar a partir da branch `codex/comercial-360` sem merge.
