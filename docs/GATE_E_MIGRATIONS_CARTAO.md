# Gate E — cartão (migrations faltantes) — NÃO EXECUTAR agora

**Status:** `PREPARADO / BLOQUEADO até Gate C APROVADO + backup novo + autorização humana`
**Frente Cursor:** só inventário/precheck. Apply = processo VPS autorizado.

## Entrada

```bash
bash scripts/vps/gate-d-f-precheck.sh --from-gate-c-output saida-gate-c.txt \
  --candidate-list docs/vps/migrations-candidatas-comercial360.txt
```

Esperado hoje (VPS 001–015): `missing_for_gate_e=016,017,018,019,020,021,022,023,024`

## Quando autorizado (futuro)

1. Backup **novo** em `/opt/erp-zuccaro/backups` (bytes + SHA-256).
2. Rollback R07B preservado (`rollback-dry-run-check.sh`).
3. Checkout = **main** pós-merge (não branch feature).
4. Migrator canônico + `ON_ERROR_STOP`; só ids faltantes.
5. Conferir cada migration da main exatamente 1×.
6. `npm run test:postgres` no PostgreSQL **real**, >0 testes, 0 fail/skip.
7. Não reaplicar 001–015. Não usar CI efêmera como prova.

## Parar se

Duplicata, id inesperado >024, backup falhou, SHA divergente, ou pedido para
aplicar a partir da branch `codex/comercial-360` sem merge.
