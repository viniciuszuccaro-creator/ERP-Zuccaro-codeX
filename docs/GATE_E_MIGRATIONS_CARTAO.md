# Gate E — cartão de operação (DEV)

**Status:** `ASSINADO` · Gate E autorizado para Web Console (após backup novo)
**Escopo:** migrations **016–024** da `main` @ `2fc2fc80adb9ca876be6ca3d29aab49305839e8a` no DEV.
**Não autorizados:** Gate D · Gate F · alteração da 3080 · canário.

Termo: `docs/TERMO_AUTORIZACAO_GATES_D_E_F.md` — assinatura **VINICIUS** · `24/09/2026`.

---

## Fatos (pós-merge #35)

| Item | Valor |
|---|---|
| Merge | PR **#35** (contém #33+#34) → `main` |
| SHA main | `2fc2fc80adb9ca876be6ca3d29aab49305839e8a` |
| 016–024 na main | **presentes** → `GATE_E_READY=YES` |
| Restore isolado prévio | **OK** (dump fora do Git) |
| DEV antes do apply | esperado 001–015; 016–024 pendentes |

---

## Pré-checks locais (Workbench — sem VPS)

```bash
bash scripts/vps/go-nogo-def.sh
bash scripts/vps/validate-termo-autorizacao.sh
bash scripts/vps/print-gate-e-fatias.sh
```

Esperado: `GATE_E_READY=YES` · termo ainda `FACTS_READY_WAITING_SIGNATURE` ou `WAITING_SIGNATURE` até assinar.

---

## Bloco Web Console (autorizado — assinatura VINICIUS)

Colar **na ordem**. Dump permanece em `/opt/erp-zuccaro/backups`. Colar no GitHub **somente** blocos `PASTE_TO_GIT_*` / evidência sanitizada.

### 0) Identidade main + R07B + DEV (somente leitura)

```bash
set -euo pipefail
cd /opt/erp-zuccaro
git fetch origin main
git rev-parse HEAD
git rev-parse origin/main
# Exigido: ambos = 2fc2fc80adb9ca876be6ca3d29aab49305839e8a (ou checkout origin/main)
git checkout --detach origin/main
test "$(git rev-parse HEAD)" = "2fc2fc80adb9ca876be6ca3d29aab49305839e8a"

docker ps --format '{{.Names}} {{.Image}}' | grep -E 'erp-api|supabase-db' || true
# Confirmar imagem R07B da 3080 presente; NÃO restart/promote

docker exec supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc \
  "SELECT current_database()||'|mig='||count(*)::text FROM schema_migrations;"
docker exec supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc \
  "SELECT id||'='||count(*) FROM schema_migrations GROUP BY id ORDER BY id;"
```

### 1) Backup **novo** imediatamente antes (obrigatório)

```bash
cd /opt/erp-zuccaro
bash scripts/vps/create-pre-gate-e-backup.sh
# Copiar PASTE_TO_GIT_* → docs/vps/evidence/pre-gate-e-backup-latest.txt (sem o .sql)
```

### 2) Pré-check rollback R07B (dry-run)

```bash
bash scripts/vps/rollback-dry-run-check.sh --docker
```

### 3) Gate E — migrator canônico **uma vez**

Usa `DATABASE_URL` do DEV já aprovado (não imprimir). Uma TX por arquivo; se falhar → parar.

```bash
cd /opt/erp-zuccaro/server
# Confirmar pendentes antes:
npm run migrate:status
npm run migrate
npm run migrate:status
```

### 4) Conferir 016–024 cada 1×

```bash
docker exec supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc \
  "SELECT id FROM schema_migrations WHERE id ~ '^(016|017|018|019|020|021|022|023|024)_' ORDER BY id;"
# Esperado: exatamente 9 linhas (016–024), cada id uma vez
```

### 5) Testes PostgreSQL reais + smoke 3080 (sem trocar imagem)

```bash
cd /opt/erp-zuccaro/server
npm run test:postgres
curl -sS -o /dev/null -w 'health=%{http_code}\n' http://127.0.0.1:3080/health
curl -sS -o /dev/null -w 'ready=%{http_code}\n' http://127.0.0.1:3080/ready
curl -sS http://127.0.0.1:3080/api/v1/meta | head -c 400; echo
# Ops R07B Produto (list) com headers de DEV existentes — sem alterar container
```

### 6) Evidência sanitizada para o GitHub

Publicar apenas: SHA `2fc2fc80…`, nome/bytes/sha256 do **backup novo**, lista 016–024, resultado `test:postgres`, health/ready/meta da 3080, `GATE_E_STATUS=OK` ou falha com `schema_migrations`. **Sem** dump SQL, `.env`, PII.

---

## Parar se

Assinatura ausente · backup novo falhou · HEAD ≠ `2fc2fc80…` · migration falhou no meio · pedido de canário/D/F/3080 · aplicar de branch ≠ main.
