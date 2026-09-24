# Gate E — cartão (migrations faltantes) — NÃO EXECUTAR agora

**Status:** `PREPARADO / BLOQUEADO até termo assinado + backup pre-gate-e + autorização humana`
**Frente Cursor:** inventário/precheck/backup. Apply = só com checkbox Gate E no termo.

## Entrada

```bash
bash scripts/vps/gate-d-f-precheck.sh --from-gate-c-output saida-gate-c.txt \
  --candidate-list docs/vps/migrations-candidatas-comercial360.txt
bash scripts/vps/print-gate-e-fatias.sh
bash scripts/vps/check-backup-novo-gate-e.sh
bash scripts/vps/go-nogo-def.sh
```

Esperado enquanto backup VPS não colado: `BACKUP_NOVO_STATUS=STALE_NEED_NEW` · `GO_NOGO=NO`
`GO_NOGO=YES_PENDING_HUMAN_FINAL` **não** autoriza apply.

## Fatias propostas (aguardam Codex)

| Fatia | IDs | Conteúdo |
|---|---|---|
| Comercial | 016, 017 | Orçamento + Pedido |
| Produto / DAM / canais | 018–024 | PIM/DAM/outbox/mídia/norma/canais |

Ordem sugerida de **revisão**: comercial `016–017` depois produto `018–024`.
Execução Gate E (migrator atual): **uma invocação** aplica todos os pendentes
`016–024` em ordem — fatias **não** são duas execuções.

## Backup novo pré-Gate E (sem migration)

Na VPS (Web Console), **somente backup**:

```bash
bash scripts/vps/create-pre-gate-e-backup.sh
# Colar bloco PASTE_TO_GIT_* em docs/vps/evidence/pre-gate-e-backup-latest.txt
```

Integridade (sem restore destrutivo): header `pg_dump` + marker
`PostgreSQL database dump complete` + SHA-256 recompute.
Dump real **não** vai para o Git.

Workbench:

```bash
bash scripts/vps/verify-pre-gate-e-backup-meta.sh
bash scripts/vps/check-backup-novo-gate-e.sh
```

## Restore isolado do dump (prova — NÃO é Gate E apply)

O script **não** está no checkout da VPS (`/opt/erp-zuccaro`) até merge na main.
Baixar para `/tmp` e executar (não altera tree DEV nem o banco `postgres`):

```bash
SCRIPT_SHA=0889eac60d15ae58b578a32479dc19a912b5f143
curl -fsSL "https://raw.githubusercontent.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/${SCRIPT_SHA}/scripts/vps/restore-pre-gate-e-isolated-webconsole.sh" \
  -o /tmp/restore-pre-gate-e-isolated-webconsole.sh
bash /tmp/restore-pre-gate-e-isolated-webconsole.sh
# Colar PASTE_TO_GIT_* em docs/vps/evidence/restore-isolated-db-pending.txt
```

Cria `erp_restore_isolated_*`; confere hash do dump; prova `dev_untouched=YES`.
Dump permanece em `/opt/erp-zuccaro/backups`. **Não** autoriza D/E/F.

## Quando autorizado (futuro — após termo + checkbox Gate E)

1. Backup **novo** já validado (`BACKUP_NOVO_STATUS=NAMED_CANDIDATE_PRESENT`).
2. Rollback R07B preservado (`rollback-dry-run-check.sh`).
3. Checkout = **main** pós-merge (não branch feature).
4. Migrator canônico + `ON_ERROR_STOP`; só ids faltantes da fatia autorizada.
5. Conferir cada migration da main exatamente 1×.
6. `npm run test:postgres` no PostgreSQL **real**, >0 testes, 0 fail/skip.
7. Não reaplicar 001–015. Não usar CI efêmera como prova.

## Parar se

Duplicata, id inesperado >024, backup falhou, SHA divergente, ou pedido para
aplicar a partir da branch `codex/comercial-360` sem merge.
