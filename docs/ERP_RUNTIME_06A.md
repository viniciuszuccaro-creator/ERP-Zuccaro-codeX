# ERP-RUNTIME-06A — ClienteLocal

**Status:** `IMPLEMENTATION_READY — DEV_MIGRATION_PENDING`
**Branch:** `cursor/erp-runtime-06a-cliente-locais-392b`
**Base:** `821b335fd6bff01896fcba3ba3291adab94df262`

## Objetivo

Criar a fonte PostgreSQL canônica de Local/endereço físico do Cliente, com
múltiplas finalidades, sem duplicar Cliente ou Local por Empresa.

Obra não faz parte deste runtime e não é finalidade de Local.

## Migration

`011_cliente_locais.sql` cria:

- `cliente_locais`;
- `cliente_local_finalidades`;
- integridade Cliente/Grupo;
- unicidade de principal por Cliente + finalidade;
- fingerprint não único para detecção conservadora;
- RLS ENABLE/FORCE;
- lifecycle e metadados de legado/importação.

Migrations 001–010 permanecem imutáveis. Não há backfill Base44.

## Modelo

### Local

UUID, Cliente/Grupo, nome, CEP, logradouro, número textual, complemento, bairro,
cidade, UF, país, referência, coordenadas opcionais, metadados de geocode,
origem/legado, lifecycle e actors.

API operacional exige endereço completo. A estrutura suporta
`endereco_incompleto=true` somente para futura migração controlada com origem,
sistema e lote; esse estado não é exposto pelo CRUD comum.

### Finalidades

Vocabulário fechado:

- CADASTRAL
- FISCAL
- COBRANCA
- ENTREGA
- CORRESPONDENCIA
- OUTRO

OBRA é proibida. Um Local pode possuir várias finalidades. Existe no máximo um
principal por `(group_id, cliente_id, finalidade)`, garantido por índice único
parcial no banco.

Trocar principal ocorre na mesma transação: o anterior é desmarcado e o novo é
marcado sem janela com dois principais. A operação serializa no Cliente para
resolver concorrência.

## Multiempresa

- ClienteLocal pertence ao Cliente MASTER/Grupo;
- não existe cópia CPA/3Z;
- visão Empresa exige Empresa no Grupo e `cliente_empresas.elegivel_operacao`;
- visão Grupo autorizada consolida;
- integridade cross-group é bloqueada por trigger PostgreSQL.

## API

Base: `/api/v1/clientes/:clienteId/locais`

| Método | Caminho | Operação |
|---|---|---|
| GET | `/` | list/search/count/paginação/filtros |
| POST | `/` | criar Local e finalidades |
| GET | `/:localId` | obter Local ativo |
| PATCH | `/:localId` | editar endereço |
| PUT | `/:localId/finalidades` | substituir finalidades/set primary |
| DELETE | `/:localId` | inativar |
| POST | `/:localId/restore` | restaurar |

Filtros: ativo, finalidade, principal, cidade, UF, busca, ordenação, limit e
offset. Fingerprint interno não é exposto.

## RBAC

Reutiliza `PostgresRbacGuard`:

- `cadastros.local-cliente.visualizar`;
- `cadastros.local-cliente.criar`;
- `cadastros.local-cliente.editar`;
- `cadastros.local-cliente.inativar`;
- `cadastros.local-cliente.restaurar`;
- `cadastros.local-cliente.principal`.

Criar Local principal também exige permissão `principal`. Selecionar Local em
Pedido futuramente não concede edição.

## Segurança e geolocalização

- schemas strict/allowlist e UUIDs de rota;
- CEP normalizado, UF/país uppercase, número textual (`S/N`, `100-A`, `KM 12`);
- latitude -90/90 e longitude -180/180, ambas opcionais e informadas juntas;
- sem coordenadas, Local continua válido;
- geocode provider-neutral; nenhuma chamada ViaCEP/Maps/Nominatim;
- sem URL de mapa canônica;
- mass assignment de tenant/actors bloqueado.

## Duplicidade

Fingerprint usa Cliente/Grupo + endereço normalizado, incluindo complemento.
Endereço equivalente retorna `409 POSSIBLE_DUPLICATE`; não há merge automático
nem UNIQUE agressivo. Complementos distintos permanecem permitidos.

## Auditoria atômica e PII

CREATE, UPDATE, SET_PURPOSES/SET_PRIMARY, INACTIVATE e RESTORE compartilham a
transação PostgreSQL com `audit_logs`. Falha de auditoria rollbacka mutação.

O snapshot de audit registra ID, nome, cidade/UF/país, fingerprint, presença de
coordenadas, status geocode, lifecycle e finalidades. Não replica CEP,
logradouro, número, complemento, referência ou coordenadas.

## Soft delete

Não há hard delete. Local principal não pode ser inativado até o usuário remover
explicitamente a marca principal; nenhum substituto é escolhido
automaticamente. RUNTIME-06B adicionará a regra de Obra ativa.

## Seed

- Grupo A / Cliente A:
  - Local A: CADASTRAL + FISCAL + COBRANCA, todos principais;
  - Local B: ENTREGA principal;
  - Local C: ENTREGA não principal;
- Grupo B / Cliente B: Local B1 ENTREGA principal.

Dados são sintéticos e o seed converge em duas execuções.

## Compatibilidade

`Cliente.endereco_principal` e `Cliente.locais_entrega[]` permanecem
inalterados. Não há cutover, dual-write ou backfill real. Legado
`tipo_endereco=Obra` será tratado no RUNTIME-06B via staging Local → Obra.

Pedido/Entrega/NF não foram alterados. Contrato futuro: `cliente_local_id` +
snapshot imutável.

## Fora do escopo

Obra/migration 012, Pedido, Orçamento, Expedição, Roteirizador, App Motorista,
Fiscal, Site/B2B/Marketplace, providers externos, Cliente/Comercial 360º,
frontend HTTP e migração real.

## Validação

- migration 011 executada/reexecutada em PostgreSQL/PGlite;
- multifinalidade e principal único;
- tenant A/A2/B, elegibilidade ClienteEmpresa, RBAC e RLS;
- paginação/count/busca/filtros;
- fingerprint, geo, lifecycle, concorrência e mass assignment;
- rollback real de PATCH e SET_PRIMARY quando audit falha;
- sem tabela/campo/finalidade Obra.

Fechamento local:

- `npm run audit:baseline`: OK;
- `npm test`: 570 pass;
- `npm run lint`: OK;
- `npm run typecheck`: baseline histórico do frontend (exit 2), sem erro novo;
- `npm run build`: OK;
- server: 56 pass/1 skip, typecheck e build OK;
- `git diff --check`: OK.

Aplicação DEV e E2E permanecem pendentes conforme
`docs/ERP_RUNTIME_06A_DEV_RUNBOOK.md`.
