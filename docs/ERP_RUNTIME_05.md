# ERP-RUNTIME-05 — Cliente × Empresa

**Status:** `ERP-RUNTIME-05 — CONCLUÍDO E VALIDADO NO DEV`
**PR/merge oficial:** #19 / `079f594c798c33d903cd4e70a673f9f068639142`
**Validação DEV:** 2026-09-18
**Diagnóstico aprovado:** `docs/ERP_RUNTIME_05_DIAGNOSTICO.md`

## Objetivo

Evoluir `cliente_empresas` como relacionamento comercial e de elegibilidade
entre a identidade Cliente do Grupo e cada Empresa autorizada.

Não cria Cliente paralelo e não implementa Cliente/Comercial 360º.

## Estado oficial no DEV

- migrations 001–010 presentes e validadas;
- `010_cliente_empresas_comercial.sql` aplicada;
- `cliente_empresas`: RLS `ENABLE=true`, `FORCE=true`
  (`RLS_STATE=true|true`);
- unicidade `(cliente_id, empresa_id)` sem duplicados (`DUP_COUNT=0`);
- API oficial em `127.0.0.1:3080` retorna `ERP-RUNTIME-05`;
- imagem promovida: `erp-zuccaro-erp-api:runtime05-f83acd03`;
- Cliente MASTER preservado como identidade única do Grupo;
- ClienteEmpresa, elegibilidade, multiempresa, RBAC, RLS, unicidade,
  lifecycle, auditoria, atomicidade e PII: aprovados;
- frontend HTTP não ativado.

## Modelo

```text
clientes (identidade do Grupo)
   |
   +-- cliente_empresas (situação/elegibilidade CPA)
   |
   +-- cliente_empresas (situação/elegibilidade 3Z)
```

`clientes.empresa_id` continua sendo origem/preferência de compatibilidade. A
identidade não pertence exclusivamente àquela Empresa.

## Migration

`010_cliente_empresas_comercial.sql` é aditiva e convergente:

- preserva vínculo e unicidade `(cliente_id, empresa_id)` do RUNTIME-04;
- mantém o trigger que garante Cliente/Empresa no mesmo Grupo;
- acrescenta situação, habilitação, bloqueio, motivo/quando/quem, observação,
  origem, legado/importação e actor de criação/alteração;
- reafirma RLS `ENABLE` + `FORCE`;
- não altera migrations 001–009.

Vocabulário:

- `situacao_comercial`: `PROSPECT`, `ATIVO`, `INATIVO`;
- `ativo`: lifecycle técnico/soft delete;
- `habilitado_operacao`: habilitação administrativa;
- `bloqueado`: bloqueio comercial temporário da Empresa;
- `elegivel_operacao`: derivado de ativo + situação + habilitação + bloqueio.

Crédito, saldo, títulos, preço, estoque, endereço, contato, obra, pedido e
orçamento não fazem parte da tabela.

## API

Base: `/api/v1/clientes/:clienteId/empresas`

| Método | Caminho | Operação |
|---|---|---|
| GET | `/` | lista/pagina/count |
| GET | `/:empresaId` | obtém vínculo ativo |
| POST | `/:empresaId` | vincula idempotentemente |
| PATCH | `/:empresaId` | atualiza campos permitidos |
| POST | `/:empresaId/block` | bloqueia com motivo |
| POST | `/:empresaId/unblock` | desbloqueia |
| DELETE | `/:empresaId` | inativa sem hard delete |
| POST | `/:empresaId/restore` | restaura |

Listagem suporta `limit`, `offset`, `empresa_id`, `situacao`, `ativo`,
`bloqueado`, `search`, `order_by` e `order_dir`, com count separado.

## Multiempresa e RBAC

- identidade: `clientes.group_id`;
- vínculo: uma linha por Cliente + Empresa;
- actor de Empresa só opera a própria Empresa;
- actor de Grupo consolida empresas do Grupo conforme perfil;
- Grupo B não lê/altera vínculos A;
- body não pode sobrescrever IDs/actor.

Permissões backend, no `PostgresRbacGuard` existente:

- `cadastros.cliente-empresa.visualizar`;
- `cadastros.cliente-empresa.criar`;
- `cadastros.cliente-empresa.editar`;
- `cadastros.cliente-empresa.inativar`;
- `cadastros.cliente-empresa.restaurar`;
- `cadastros.cliente-empresa.bloquear`.

Criar Cliente com `empresa_id` também exige permissão de criar o vínculo. Usar
Cliente em Pedido futuramente não concede edição/bloqueio.

E2E DEV:

- Grupo consolidado: OK;
- Empresa A → vínculo A: OK;
- Empresa A → vínculo A2 sem autorização: HTTP 403;
- Grupo B → Cliente/vínculo A: HTTP 404;
- tentativa Cliente Grupo A + Empresa Grupo B: bloqueada no PostgreSQL e não
  persistida (`BAD_LINKS=0`);
- sem actor: HTTP 403.

## Auditoria e lifecycle

Entidade auditada: `ClienteEmpresa`.

Eventos: `link`, `update`, `block`, `unblock`, `inactivate`, `restore`, com
before/after, actor, Grupo, Empresa e request/correlation ID. O snapshot não
replica CPF/CNPJ do Cliente.

Inativação remove o vínculo da listagem operacional padrão, mantém histórico e
exige restore explícito.

E2E lifecycle:

- update, block, unblock, inactivate e restore: HTTP 200;
- após block: `bloqueado=true` e `elegivel_operacao=false`;
- GET inativo: HTTP 404;
- estado final: situação ATIVO, habilitado, não bloqueado e `ativo=true`;
- busca, paginação/count: HTTP 200; inativos excluídos por padrão.

### Atomicidade

As mutações sensíveis de ClienteEmpresa executam no mesmo
`DbClient.withTransaction` que a escrita em `audit_logs`:

```text
BEGIN → validar estado → mutar ClienteEmpresa → inserir audit_logs → COMMIT
```

Falha de domínio ou auditoria provoca `ROLLBACK`. Isso vale para:

- link;
- update;
- block/unblock;
- inactivate/restore.

`AuditRepository.append` aceita opcionalmente o executor transacional existente,
sem abrir transação aninhada. A abstração é reutilizável por outros agregados,
mas somente ClienteEmpresa foi migrado neste lote.

Criação de Cliente com `empresa_id` também foi coberta: Cliente, vínculo,
auditoria Cliente e auditoria ClienteEmpresa compartilham uma única transação.
Se a auditoria do vínculo falhar, nenhum Cliente ou vínculo permanece gravado.

No DEV, `audit_logs` confirmou update, block, unblock, inactivate e restore.
Os testes automatizados anteriores ao E2E comprovaram que falha de auditoria
rollbacka a mutação.

### PII

O regex genérico `[0-9]{11,14}` produziu falso positivo por sequências numéricas
legítimas do snapshot. A validação específica confirmou:

- `EXACT_CLIENT_DOCUMENT_LEAK=0`;
- `AUDIT_ROWS_WITH_PII_KEYS=0`;
- nenhuma chave `cpf`, `cnpj`, `documento`, `documento_normalizado`,
  `telefone`, `celular` ou `email` nos snapshots ClienteEmpresa.

Conclusão: auditoria sem PII do Cliente.

## Seed DEV

- Grupo A: Cliente PJ A vinculado à Empresa A (liberado);
- Grupo A: mesmo Cliente PJ A vinculado à Empresa A2 (bloqueado);
- Grupo A: Cliente PF A como prospect não habilitado;
- Grupo B: Cliente PJ B vinculado à Empresa B;
- perfis sintéticos recebem permissões ClienteEmpresa;
- seed executado duas vezes: convergente/idempotente, sem duplicação.

## Compatibilidade e dependências futuras

Campos comerciais incorporados no Cliente Base44 permanecem inalterados. Não
há dual-write nem ativação HTTP no frontend.

Ficam fora até suas fontes PostgreSQL canônicas:

- vendedor/Colaborador/Representante;
- TabelaPreco;
- Forma/CondiçãoPagamento;
- crédito e títulos do Financeiro.

## Validação local

`server/tests/runtime05.test.ts` cobre migration real em PGlite, seed duplo,
integridade cross-group, unicidade, RLS, tenant A/A2/B, RBAC, mass assignment,
paginação/count/busca/filtros, concorrência, bloqueio, lifecycle e auditoria.

`server/tests/runtime05-audit-atomicity.test.ts` força falha real de INSERT em
`audit_logs` no PostgreSQL/PGlite e comprova rollback de link, update, block,
unblock, inactivate, restore e Cliente + vínculo indireto. O repositório
in-memory comprova semântica equivalente.

Resultados:

- `npm run audit:baseline`: OK;
- `npm test`: 570 pass;
- `npm run lint`: OK;
- `npm run typecheck`: baseline histórico do frontend (exit 2), sem erro novo
  nos arquivos do lote;
- `npm run build`: OK;
- server: 51 pass/1 skip, typecheck e build OK;
- `git diff --check`: OK.

## Rollback e próxima fundação

- `erp-api-dev-runtime04-backup` e `erp-api-dev-runtime03-backup` permanecem
  preservados temporariamente;
- ClienteEmpresa permanece fora de `HTTP_PILOT_ENTITIES`;
- planejamento, sem implementação: RUNTIME-06 — Locais/Endereços/Obras.
