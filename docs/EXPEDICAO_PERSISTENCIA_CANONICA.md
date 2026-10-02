# Expedição — Persistência canônica (Entrega / Romaneio / Separação)

## Inventário (pré-implementação)

| Camada | Entrega | Romaneio | Separação | Achado |
|---|---|---|---|---|
| SPA / policies | `expedicaoEntregaPolicy`, `expedicaoFluxoOperacionalPolicy` | idem | idem | **Existente** — reutilizado |
| Telas | `EntregasListagem`, `DetalhesEntregaView`, `LogisticaReversa`, `SeparacaoConferencia`, `RomaneioForm`, `IntegracaoRomaneio` | idem | idem | **Existente** — ligadas à API quando `VITE_ERP_HTTP_EXPEDICAO=true` |
| Server types/repos | — | — | — | **Ausente** → criado |
| Migration PG | — (até 024) | — | — | **Ausente** → `036_expedicao_entregas_romaneios.sql` (evita 025–035 comercial) |
| HTTP `/api/v1/entregas\|romaneios` | — | — | — | **Ausente** → montado |
| Side-effect Pedido/estoque | descritivo SPA | descritivo | descritivo | **Reservado** (portas; coordenação Codex; sem tip-port) |

Prova SPA local (`SPA_LOCAL_BASE44`) permanece válida como UX — **não** é persistência real.

## Contrato canônico

- Escopo: `{ groupId, empresaId }` obrigatório; RBAC `Expedicao.{entrega|romaneio|separacao}` fail-closed.
- Status Entrega: `AGUARDANDO_SEPARACAO` → `EM_SEPARACAO` → `PRONTO_EXPEDIR` → `EM_ROMANEIO`/`SAIU_ENTREGA` → `ENTREGUE_PARCIAL`/`ENTREGUE`/`FRUSTRADA` → `DEVOLVIDA`/`CANCELADA`.
- Facade SPA: `status` = label PT-BR; `status_code` = código canônico.
- Idempotência: `idempotency_key` + `entregas_key` (romaneio) + `empresa_id+pedido_id` (entrega).
- Auditoria: `create` / `change_status` com snapshot sanitizado.
- Portas: `ExpedicaoPedidoSideEffectPort`, `ExpedicaoEstoquePort` → default `reserved`. Falha estoque (`failed`) aborta TX (sem falso sucesso). Contrato: `docs/EXPEDICAO_PORTAS_PEDIDO_ESTOQUE.md`.

## Endpoints

| Método | Path | Ação RBAC |
|---|---|---|
| GET/POST | `/api/v1/entregas` | visualizar / criar |
| GET/PATCH | `/api/v1/entregas/:id` | visualizar / editar\|transição |
| GET | `/api/v1/entregas/:id/historico` | visualizar |
| POST | `/api/v1/entregas/:id/separacao` | conferir |
| POST | `/api/v1/entregas/:id/registrar` | entregar / ocorrencia |
| POST | `/api/v1/entregas/:id/devolucao` | ocorrencia |
| GET/POST | `/api/v1/romaneios` | visualizar / criar (+despacho) |
| GET | `/api/v1/romaneios/:id` | visualizar |

## Migration

Arquivo: `server/migrations/036_expedicao_entregas_romaneios.sql`  
Numeração **036** — a candidata comercial Codex (#178) reserva **025–035**.  
**Somente no repositório / CI.** Sem aplicação operacional em VPS/HML nesta candidata.

## UI

Flag: `VITE_ERP_BACKEND=http` + `VITE_ERP_HTTP_EXPEDICAO=true`  
Telas passam a chamar `httpApiClient.expedicao.*` (Separacao, RomaneioForm, IntegracaoRomaneio, DetalhesEntregaView, LogisticaReversa). Sem flag, SPA local permanece.

## Testes

```bash
cd server && node --import tsx --test \
  tests/runtime11-expedicao-http.test.ts \
  tests/runtime11-expedicao-http-client.test.ts \
  tests/runtime11-expedicao-migration.test.ts \
  tests/runtime11-expedicao-pglite.test.ts
# Com DATABASE_URL (CI opcional):
# tests/runtime11-expedicao-postgres-e2e.test.ts
# Navegador × API+PGlite (≠ SPA local / ≠ mock):
# node --test tests/expedicao-api-pg.playwright.test.mjs
```

| Suíte | Camada |
|---|---|
| `runtime11-expedicao-http*` | **Mock in-memory** (BFF sem PG) |
| `runtime11-expedicao-pglite` | **PostgreSQL isolado (PGlite)** — tenant/RBAC/concorrência/rollback/despacho/parcial/devolução |
| `runtime11-expedicao-postgres-e2e` | PostgreSQL real se `DATABASE_URL` |
| `expedicao-api-pg.playwright` | **Navegador × API+PGlite** |
| `expedicao-spa-launchpad.playwright` | **SPA_LOCAL_BASE44** (≠ persistência real) |

Cobertura: ciclo completo, RBAC, isolamento empresa, concorrência de número, retry idempotente, falha intermediária estoque → rollback, bridge cliente HTTP, auditoria TX no PG.

## Roteiro HML (pós-merge / gate VPS)

1. Aplicar migration 036 **somente** após backup + autorização operacional (após 025–035 comerciais se presentes).
2. Subir BFF com auth supabase; seed sintético de grupo/empresa/perfil Expedicao.
3. SPA: `VITE_ERP_BACKEND=http` + `VITE_ERP_HTTP_EXPEDICAO=true`.
4. Percorrer: criar entrega → separação → romaneio/despacho → parcial → total → ocorrência → devolução.
5. Retry: repetir romaneio (mesmas entregas) → reuse; parcial mesma qty → reuse.
6. Simular falha estoque (porta `failed`) → Entrega permanece `PRONTO_EXPEDIR`, sem romaneio órfão.
7. Confirmar auditoria e histórico; **não** esperar mutação Pedido/estoque até tip-port Codex.

## Coordenação Codex Comercial

Pedido/estoque: portas reserved. Sem tip-port #178. Side-effect legado SPA permanece descritivo fora do caminho HTTP canônico.

## Rollback de código

Reverter branch / fechar draft PR. Migration não aplicada operacionalmente → sem DROP em produção.
