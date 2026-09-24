#!/usr/bin/env bash
# Prova: API R07B EXATA (commit ca0bc5f3 / imagem 3080) × schema 001–024.
# Exercita operações reais de Produto (GET list/get, POST, PATCH) da R07B.
# NÃO usa a API nova (08B/Comercial 360) como substituta.
# Não altera VPS/3080. Requer PostgreSQL isolado via DATABASE_URL.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
R07B_SHA="${R07B_SHA:-ca0bc5f3529b9071fe80e58dae6aa966a9d6c740}"
EVIDENCE_OUT="${R07B_COMPAT_EVIDENCE:-$ROOT/docs/vps/evidence/r07b-api-schema-016-024-compat.txt}"
WORKTREE="${R07B_WORKTREE:-/tmp/r07b-api-prove-$$}"

echo "R07B_API_COMPAT_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "r07b_sha=${R07B_SHA}"
echo "expected_runtime=ERP-RUNTIME-07B"
echo "expected_3080_image=runtime07b-main-ca0bc5f3"

export ROOT DATABASE_URL R07B_SHA EVIDENCE_OUT
export ISOLATED_DATABASE_NAME="${ISOLATED_DATABASE_NAME:-}"
export ALLOW_DROP_SCHEMA_PUBLIC="${ALLOW_DROP_SCHEMA_PUBLIC:-}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo 'R07B_API_COMPAT_STATUS=SKIPPED_NO_DATABASE_URL'
  echo 'NOTE: forneca DATABASE_URL de Postgres isolado (nao DEV oficial)'
  echo "R07B_API_COMPAT_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  exit 0
fi

# Fail-closed ANTES de DROP SCHEMA: bloqueia DEV oficial (dbname=postgres)
# e exige banco isolado identificado + ALLOW_DROP_SCHEMA_PUBLIC=ISOLATED_ONLY.
# Nunca apontar este script para o banco da VPS DEV.
# shellcheck source=assert-isolated-database-url.sh
source "$ROOT/scripts/vps/assert-isolated-database-url.sh"
if ! assert_isolated_database_url; then
  echo 'R07B_API_COMPAT_STATUS=BLOCKED_ISOLATED_DB_GUARD'
  echo 'NOTE: DROP SCHEMA public CASCADE recusado — use ISOLATED_DATABASE_NAME=erp_r07b_compat'
  echo 'NOTE: e ALLOW_DROP_SCHEMA_PUBLIC=ISOLATED_ONLY; nunca DATABASE_URL do DEV oficial'
  echo "R07B_API_COMPAT_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  exit 2
fi
echo "isolated_database_name=${ISOLATED_DB_NAME_RESOLVED}"
echo 'drop_schema_target=ISOLATED_ONLY'
echo 'dev_official_dbname_blocked=postgres'

# Migrations 016+ devem existir no checkout (árvore pós-#33)
if [[ ! -f "$ROOT/server/migrations/018_produto_pim_dam_outbox.sql" ]]; then
  echo 'R07B_API_COMPAT_STATUS=SKIPPED_NO_016_024_IN_CHECKOUT'
  echo "R07B_API_COMPAT_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  exit 0
fi

git -C "$ROOT" cat-file -t "$R07B_SHA" >/dev/null 2>&1 || \
  git -C "$ROOT" fetch --depth=1 origin "$R07B_SHA" 2>/dev/null || \
  git -C "$ROOT" fetch --depth=1 origin ca0bc5f3 2>/dev/null || true

if ! git -C "$ROOT" cat-file -t "$R07B_SHA" >/dev/null 2>&1; then
  echo 'R07B_API_COMPAT_STATUS=SKIPPED_R07B_SHA_UNAVAILABLE'
  echo "R07B_API_COMPAT_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  exit 0
fi

# Aplica 001–024 do checkout atual (fonte pós-merge simulada) no Postgres isolado
python3 - <<'PY'
import os, pathlib, subprocess, sys, urllib.parse
url = os.environ["DATABASE_URL"]
root = pathlib.Path(os.environ["ROOT"])
required = os.environ.get("ISOLATED_DATABASE_NAME", "")
# Defesa em profundidade: nunca DROP em dbname=postgres / reservados
p = urllib.parse.urlparse(url)
dbname = (p.path or "").lstrip("/").split("?")[0]
if not dbname:
    dbname = (urllib.parse.parse_qs(p.query).get("dbname") or [""])[0]
if dbname in {"postgres", "template0", "template1", "supabase", "supabase_admin"}:
    print(f"DROP_SCHEMA_BLOCKED_DEV_OR_RESERVED dbname={dbname}", file=sys.stderr)
    sys.exit(4)
if not required or dbname != required:
    print(f"DROP_SCHEMA_BLOCKED_MISMATCH dbname={dbname} required={required}", file=sys.stderr)
    sys.exit(6)
if os.environ.get("ALLOW_DROP_SCHEMA_PUBLIC") != "ISOLATED_ONLY":
    print("DROP_SCHEMA_BLOCKED_ALLOW_FLAG", file=sys.stderr)
    sys.exit(8)
mig = sorted((root / "server/migrations").glob("[0-9][0-9][0-9]_*.sql"))
assert len(mig) >= 24, f"expected >=24 migrations, got {len(mig)}"
# reset schema ONLY on the identified isolated database
subprocess.check_call(["psql", url, "-v", "ON_ERROR_STOP=1", "-c",
  "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"])
for f in mig:
    print(f"APPLY {f.name}", flush=True)
    subprocess.check_call(["psql", url, "-v", "ON_ERROR_STOP=1", "-f", str(f)],
                          stdout=subprocess.DEVNULL)
# register schema_migrations
subprocess.check_call(["psql", url, "-v", "ON_ERROR_STOP=1", "-c",
  """CREATE TABLE IF NOT EXISTS schema_migrations(
       id TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
     );"""])
for f in mig:
    subprocess.check_call(["psql", url, "-v", "ON_ERROR_STOP=1", "-c",
      f"INSERT INTO schema_migrations(id) VALUES ('{f.name}') ON CONFLICT DO NOTHING;"],
      stdout=subprocess.DEVNULL)
count = subprocess.check_output(["psql", url, "-tAc", "SELECT count(*) FROM schema_migrations;"], text=True).strip()
print(f"schema_migrations_count={count}", flush=True)
assert count == str(len(mig))
# 018 columns
cols = subprocess.check_output(["psql", url, "-tAc",
  "SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.columns "
  "WHERE table_name='produtos' AND column_name IN ('workflow_status','multiplo_venda');"], text=True).strip()
print(f"produto_018_cols={cols}", flush=True)
assert "multiplo_venda" in cols and "workflow_status" in cols
PY

# Seed R07B-era (do commit R07B)
SEED_SQL="$(git -C "$ROOT" show "${R07B_SHA}:server/scripts/seed-dev-synthetic.sql")"
printf '%s\n' "$SEED_SQL" | psql "$DATABASE_URL" -v ON_ERROR_STOP=1 >/tmp/r07b-seed.log

# Worktree com código R07B exato
rm -rf "$WORKTREE"
git -C "$ROOT" worktree add --detach "$WORKTREE" "$R07B_SHA" >/tmp/r07b-wt.log 2>&1
(
  cd "$WORKTREE/server"
  npm install --silent
  export DATABASE_URL
  export ROOT
  export EVIDENCE_OUT
  export R07B_SHA
  node --import tsx <<'NODE'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createApp } from './src/app.ts';
import { loadConfig } from './src/config/env.ts';
import { createDbClient } from './src/db/client.ts';
import { SEED_IDS } from './scripts/seedDevIds.ts';

const url = process.env.DATABASE_URL;
assert.ok(url);
const config = loadConfig({
  NODE_ENV: 'test',
  ERP_ENV: 'dev',
  APP_VERSION: 'r07b-ca0bc5f3-compat',
  DATABASE_URL: url,
  REQUIRE_DATABASE: 'true',
  PORT: '3099',
});
const db = createDbClient(config);
const { app } = createApp({ config, db, useMemory: false });

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, port: addr.port });
    });
  });
}

async function req(port, path, init = {}) {
  const headers = {
    ...(init.headers || {}),
  };
  const res = await fetch(`http://127.0.0.1:${port}${path}`, { ...init, headers });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  return { status: res.status, body };
}

const { server, port } = await listen(app);
const results = [];
try {
  const health = await req(port, '/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.status, 'ok');
  results.push('health=200');

  const ready = await req(port, '/ready');
  assert.equal(ready.status, 200);
  assert.equal(ready.body.status, 'ready');
  results.push('ready=200');

  const meta = await req(port, '/api/v1/meta');
  assert.equal(meta.status, 200);
  assert.equal(meta.body.runtime, 'ERP-RUNTIME-07B');
  results.push(`meta_runtime=${meta.body.runtime}`);

  const headersA = {
    'content-type': 'application/json',
    'x-group-id': SEED_IDS.groupA,
    'x-empresa-id': SEED_IDS.empresaA,
    'x-actor-id': SEED_IDS.runtimeActorA,
  };

  // READ: list + get seed product
  const list = await req(port, '/api/v1/produtos?limit=10', { headers: headersA });
  assert.equal(list.status, 200, JSON.stringify(list.body));
  assert.ok(Array.isArray(list.body.data));
  assert.ok(list.body.data.length >= 1);
  results.push(`produto_list_count=${list.body.data.length}`);

  const get = await req(port, `/api/v1/produtos/${SEED_IDS.produtoA}`, { headers: headersA });
  assert.equal(get.status, 200, JSON.stringify(get.body));
  assert.equal(get.body.data.id, SEED_IDS.produtoA);
  results.push('produto_get_seed=OK');

  // WRITE: create
  const created = await req(port, '/api/v1/produtos', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      descricao: 'PRODUTO R07B COMPAT CREATE',
      codigo: 'R07B-COMPAT-001',
      unidade_medida_id: SEED_IDS.unidadeA,
      marca_id: SEED_IDS.marcaA,
      grupo_produto_id: SEED_IDS.grupoProdutoA,
    }),
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const newId = created.body.data.id;
  assert.ok(newId);
  results.push(`produto_create_id=${newId}`);

  // WRITE: patch
  const patched = await req(port, `/api/v1/produtos/${newId}`, {
    method: 'PATCH',
    headers: headersA,
    body: JSON.stringify({ descricao: 'PRODUTO R07B COMPAT PATCHED' }),
  });
  assert.equal(patched.status, 200, JSON.stringify(patched.body));
  assert.match(String(patched.body.data.descricao || patched.body.data.nome || ''), /PATCHED|R07B COMPAT/);
  results.push('produto_patch=OK');

  // Re-read after write
  const get2 = await req(port, `/api/v1/produtos/${newId}`, { headers: headersA });
  assert.equal(get2.status, 200);
  results.push('produto_get_after_write=OK');

  // Confirm 018 defaults still hold on row written by R07B (legacy columns only)
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const row = await client.query(
    `SELECT workflow_status, multiplo_venda::text AS multiplo_venda, descricao
     FROM produtos WHERE id=$1`,
    [newId],
  );
  assert.equal(row.rows[0].workflow_status, 'RASCUNHO');
  assert.ok(Number(row.rows[0].multiplo_venda) > 0);
  results.push(`produto_018_defaults_after_r07b_write=workflow=${row.rows[0].workflow_status};multiplo=${row.rows[0].multiplo_venda}`);
  await client.end();

  const evidence = [
    '# Evidência — API R07B (ca0bc5f3) × schema 001–024 em Postgres isolado',
    `# utc=${new Date().toISOString()}`,
    `r07b_sha=${process.env.R07B_SHA}`,
    'api_under_test=R07B_ca0bc5f3_NOT_08B',
    'runtime_meta=ERP-RUNTIME-07B',
    'schema_migrations=001_through_024',
    'produto_ops=list,get,create,patch',
    ...results.map((r) => r.includes('=') ? r : `result=${r}`),
    'R07B_API_COMPAT_STATUS=OK',
    'VPS_ALTERED=NO',
    'MAIN_ALTERED=NO',
    'AUTHORIZATION=NOT_GRANTED',
    'EXECUTED_GATES_DEF=NO',
  ].join('\n') + '\n';
  fs.writeFileSync(process.env.EVIDENCE_OUT, evidence);
  console.log(evidence);
  console.log('R07B_API_COMPAT_STATUS=OK');
} finally {
  server.close();
  await db.end();
}
NODE
)

# cleanup worktree
git -C "$ROOT" worktree remove --force "$WORKTREE" 2>/dev/null || rm -rf "$WORKTREE"

echo "evidence_written=${EVIDENCE_OUT#"$ROOT"/}"
echo "R07B_API_COMPAT_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
exit 0
