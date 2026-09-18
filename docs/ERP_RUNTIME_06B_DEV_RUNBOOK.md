# ERP-RUNTIME-06B — Runbook DEV

**Status:** `IMPLEMENTADO NA BRANCH / AGUARDANDO REVIEW`

Execução futura exclusivamente humana e após review. **Não executar neste
lote.** Não acessar VPS agora. Não promover a API oficial. Não iniciar
RUNTIME-07. Não ativar Obra em `HTTP_PILOT_ENTITIES`.

A API DEV oficial deve permanecer `ERP-RUNTIME-06A` até promoção explícita.

## 1. Precheck

```bash
cd /opt/erp-zuccaro
```

```bash
git fetch origin
```

```bash
git pull origin cursor/erp-runtime-06b-obras-392b
```

```bash
cd /opt/erp-zuccaro/server
```

```bash
npm ci
```

```bash
npm test
```

```bash
npm run typecheck
```

```bash
npm run build
```

```bash
node dist/db/migrate.js --status
```

Esperado neste momento: 001–011 aplicadas no DEV atual; `012_obras.sql`
pendente até a promoção deste lote.

## 2. Backup

```bash
mkdir -p /opt/erp-zuccaro/backups
```

```bash
docker exec supabase-db pg_dump -U postgres -d postgres > /opt/erp-zuccaro/backups/pre-runtime06b-$(date +%Y%m%d%H%M).sql
```

Não versionar dump no Git.

## 3. Imagem temporária (opcional)

Subir API temporária da branch 06B sem substituir a API oficial DEV, se o
procedimento de homologação local exigir. Não alterar porta/runtime oficial
`ERP-RUNTIME-06A`.

## 4. Migration 012

```bash
node dist/db/migrate.js
```

```bash
node dist/db/migrate.js --status
```

Confirmar `012_obras.sql` aplicada uma vez. Não reexecutar 001–011 para
“parecer” idempotentes.

## 5. Seed duas vezes

```bash
docker exec -i supabase-db psql -U postgres -d postgres < /opt/erp-zuccaro/server/scripts/seed-dev-synthetic.sql
```

```bash
docker exec -i supabase-db psql -U postgres -d postgres < /opt/erp-zuccaro/server/scripts/seed-dev-synthetic.sql
```

Confirmar duas Obras sintéticas, vínculos sem duplicar, códigos `000001` por
Grupo e `entity_code_sequences` Obra `next_value=2`.

## 6. E2E

- `/api/v1/meta` → `ERP-RUNTIME-06B`, `obra.frontendHttp=false`, Obra ausente
  de `httpPilotEntities`;
- create atômico com ClienteEmpresa elegível + Local existente → 201;
- create sem local / sem principal / dois principais → 400 e zero persistência;
- Local de outro Cliente/Grupo → 404/SQL bloqueado;
- Empresa de outro Grupo e Empresa sem ClienteEmpresa → bloqueadas;
- ClienteEmpresa inelegível bloqueia nova operação; histórico autorizado
  permanece;
- Empresa irmã sem `obra_empresa` não vê operacionalmente;
- uma Obra autorizada a duas Empresas elegíveis;
- soft delete / GET 404 / restore com o mesmo código;
- principal único, troca concorrente e inativação do principal rejeitada;
- ClienteLocal em uso por Obra ativa → 409;
- duplicidade conservadora + override auditado;
- paginação `total/hasMore`;
- auditoria atômica sem PII de endereço/documento.

## 7. Promoção

Promover imagem/API oficial somente após aprovação explícita do E2E. Até lá,
a API DEV oficial permanece **ERP-RUNTIME-06A**.

Não ativar Obra em `HTTP_PILOT_ENTITIES`. Não implementar frontend.

## Rollback

Restaurar o dump `pre-runtime06b-*` pelo procedimento aprovado. Não executar
DROP, prune ou remoção de backups sem autorização.
