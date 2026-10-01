# Expedição/Logística — candidata consolidada de integração (#192–#199)

## Identidade

| Campo | Valor |
|---|---|
| Candidata | Stack draft **#192 → #199** (tip = #199 persistência canônica) |
| Branch tip | `cursor/expedicao-persistencia-canonica-392b` |
| Base tip anterior | `cursor/expedicao-integracao-romaneio-canonico-392b` (#197) |
| Migration | **`036_expedicao_entregas_romaneios.sql`** (evita 025–035 comercial Codex) |
| Estado | **Candidata de integração** — BFF+PG+HTTP+auditoria+telas API; SPA local ≠ persistência real |
| CI tip | frontend+backend no HEAD do tip (**≠** VPS/HML operacional) |
| Codex Comercial #178 | ainda **candidata**; **sem tip-port**; contrato portas em `docs/EXPEDICAO_PORTAS_PEDIDO_ESTOQUE.md` |

## Cadeia

| PR | Entrega |
|---|---|
| #192 | Filtros listagem/romaneio (empresa/cidade/data/futuras) |
| #193 | Detalhe + separação fail-closed |
| #194 | Roteirização fail-closed |
| #195 | Fluxo operacional consolidado + testes |
| #196 | Pedidos→separação, unidades, rollback despacho |
| #197 | IntegracaoRomaneio canônica + soft∨ crítico + comprovante/ocorrência/IA + filtros cliente + devolução assert + **persistência multi-etapa fail-closed (sem toast de sucesso parcial)** |
| #199 | **Persistência canônica** Entrega/Romaneio: migration 036, repos PG, `ExpedicaoService`, HTTP, auditoria TX, UI→API (`VITE_ERP_HTTP_EXPEDICAO`), portas reserved, PGlite+Playwright API |

## HEADs compostos (tip)

A branch tip #199 já inclui a cadeia #192–#197 via base. Não tip-port Comercial.

| Frente | Branch | Papel |
|---|---|---|
| Expedição tip | `cursor/expedicao-persistencia-canonica-392b` | Candidata integração #192–#199 |
| Comercial #178 | `codex/comercial-corrige-parecer-155` (e tip Cursor comercial) | Reserva mig 025–035; portas Pedido/estoque |

## Testes (camadas)

| Suíte | Camada |
|---|---|
| `runtime11-expedicao-http*` | Mock in-memory |
| `runtime11-expedicao-pglite` | PostgreSQL isolado (PGlite) |
| `expedicao-api-pg.playwright` | Navegador × API+PGlite |
| `expedicao-spa-launchpad.playwright` | SPA_LOCAL_BASE44 ≠ API/PG |

## Coordenação Comercial

Pedido/estoque: portas reserved até tip-port Codex. Contrato mínimo: `docs/EXPEDICAO_PORTAS_PEDIDO_ESTOQUE.md`.  
Migration Expedição = **036** — não reutilizar 025–035.

## Merge/VPS

**Bloqueado.** Migration 036 só no repositório/CI até gate operacional + backup.
## Escopo coberto (pacote)

1. Seleção Pedidos elegíveis; separação/conferência integral/parcial; bloqueio por qtd/unidade/estado  
2. Create/reuse Entrega; romaneio; despacho; idempotência; recuperação de falha (compensação)  
3. Parcial/total + prova; ocorrências; logística reversa (assert + `logistica_reversa`); quantidades pendentes  
4. Filtros empresa, cidade, **cliente**, data cliente, futuras — coerentes em listagem, mapa e romaneio  
5. RBAC + grupo∧empresa + auditoria fail-closed nas ações sensíveis  
6. **UI não declara sucesso com estado parcialmente persistido** (IntegracaoRomaneio, RomaneioForm, Comprovante, Ocorrência, LogisticaReversa)  
7. Testes de policy **e** integração das telas (concorrência, despacho repetido, falha parcial, auditoria, parcial repetida, devolução)  
8. Esta candidata documentada (deps comerciais, homologação, rollback)

## Dependências comerciais (Codex)

| Item | Status |
|---|---|
| Side-effect `Pedido` (`updateInContext`) | Descritivo; tip-port **só após #178 FINAL** |
| Orçamento / mig 026–035 / mapper legado / Armado-Corte-Dobra | Reserva — intocado |
| Export Empresas / reconciliação | Frente legado chat principal — não duplicar |

## Persistência: compensação × atômico

| Operação | Modelo | Mecanismo |
|---|---|---|
| `assertRomaneioOnCreate` / `assertEntregaOnCreate` / `resolveRegistroEntregaFinal` | **Atômico de policy** | Uma decisão create\|reuse\|patch validado |
| `applyDespachoPatchesWithRollback` | **Compensação** | N updates de Entrega; falha no meio reverte já aplicados |
| `IntegracaoRomaneio` / `RomaneioForm` | **Compensação** | Creates + romaneio + patches + Pedido legado; audit final fail-closed |
| `ComprovanteEntregaDigital` | **Compensação** | Entrega → Pedido → estoque; falha posterior → `Estado parcial…` (sem toast success) |
| `LogisticaReversa` | **Compensação** | Entrega → ContaReceber → estoque → notificação (**sem** TX única) |

Constante: `PERSISTENCIA_EXPEDICAO` em `expedicaoFluxoOperacionalPolicy.js` (`comprovanteEntrega`, `logisticaReversa`, `despachoPatches` = `compensacao`).

### Cenários de recuperação cobertos

| Cenário | Comportamento esperado |
|---|---|
| Duas operações concorrentes (mesmo romaneio) | `assertRomaneioOnCreate` / `resolveRomaneioDespacho` → reuse; sem segundo despacho |
| Despacho repetido | Pós-`Saiu para Entrega` não re-seleciona; reuse via romaneio existente |
| Falha após update parcial no despacho | Rollback dos patches já aplicados; audit `*.rollback`; sem sucesso UI |
| Auditoria final falha | Throw fail-closed; UI sem toast de sucesso (mesmo com despacho já persistido) |
| Pedido legado incompleto | `Estado parcial: … Pedido legado incompleto`; audit `*.parcial` |
| Entrega parcial repetida | Mesma qtd → retry idempotente; redução bloqueada; aumento permitido; total bloqueia novo parcial |
| Devolução com falha secundária | Entrega `Devolvido` + `Estado parcial…`; sem toast success; retry completa cadeia |

## Integrações externas (explicitamente pendentes)

| Integração | Estado |
|---|---|
| WhatsApp / mensageria real | Pendente — mocks/simuladores **não** homologados |
| Roteirizador avançado / provedor externo | Pendente — otimização local ≠ serviço homologado |
| Assinatura digital como serviço | Pendente — prova local (foto/assinatura base64) na Entrega |

## Testes

```bash
node --test \
  tests/expedicao-entrega-policy.test.js \
  tests/expedicao-fluxo-operacional.test.js \
  tests/expedicao-integracao-telas.test.js
```

Inclui filtro cliente, E2E Pedido→pendências, quantidades pendentes, compensação≠atômico, **integração telas** (41 testes no conjunto).

## Homologação SPA (obrigatória antes de merge)

Identidade sintética local (não Auth HTTP / não VPS):

| Campo | Valor |
|---|---|
| Backend | `VITE_ERP_BACKEND=local` (localBase44) |
| Usuário | `admin@erp-local.test` (`local-admin-user`) |
| Grupo / Empresa | `local_grupo_cpa` / `local_empresa_3z` (ou topologia do snapshot core após `?reset-local=1`) |
| Perfil | `local_perfil_admin` |
| Reset limpo | `/?reset-local=1` |
| Bootstrap sessão | `recoverMasterLocalAccess` recria perfil/sessão do mestre se storage órfão (`session_access_changed`) |

Checklist (navegador — **não** substituível por testes de policy):

1. Grupo∧empresa + permissões Separação/Romaneio/Entrega/Ocorrência/Reversa  
2. Pedido elegível → separação (manual/IA) → Entrega pronta  
3. Filtros listagem/mapa/romaneio alinhados (empresa, cidade, cliente, data, futuras)  
4. Romaneio + despacho; simular falha parcial → status revertido + auditoria; **UI não toast success**  
5. Comprovante: Entrega antes do estoque; falha de estoque → mensagem `Estado parcial` (sem sucesso)  
6. Parcial repetida (retry / aumento / bloqueio de redução); ocorrência; devolução; pendências com qtd  
7. Retry não duplica Entrega/Romaneio  
8. Pedido legado: validar com Codex no #178 FINAL  

### Estado da homologação SPA (2026-10-01T15:00Z)

| Item | Status |
|---|---|
| Pacote tip #197 + LogisticaReversa na listagem/detalhe | OK (RBAC + Grupo/Empresa; sem módulo paralelo) |
| Diagnóstico cards | **Limitação computerUse** — Playwright prova clique→janela |
| Camada SPA | `SPA_LOCAL_BASE44` — **não** substitui API HTTP / PostgreSQL / VPS |
| API/PG Entrega/Romaneio | **#199** — HTTP `/api/v1/entregas|romaneios` + mig 036 + PGlite/Playwright API; SPA local permanece ≠ PG |
| Prova policy/telas (mocks) | `expedicao-fluxo-operacional` + `expedicao-integracao-telas` PASS |
| A seleção/listagem | **PASS** (ação + UI) |
| B separação | **PASS** (status Pronto para Expedir + reload) |
| C romaneio+despacho | **PASS** (1 Romaneio + reload) |
| D retry | **PASS** (sem duplicar) |
| E parcial | **PASS** (Entrega Parcial qty=3 + reload) |
| I falha intermediária | **PASS** (Devolvido sem toast de sucesso; ContaReceber inexistente) |
| G ocorrência | **PASS** (Entrega Frustrada + reload) |
| H devolução | **PASS** (LogisticaReversa via listagem → Devolvido + reload) |
| Pedido revisão Codex | Pacote #192–#197 consolidado — **sem tip-port #178** |
| #178 compat | Branch isolada; tip-port **não** autorizado enquanto candidata |

```bash
# SPA HTTPS local (VITE_ERP_BACKEND=local) + Playwright
HML_ART=/tmp/hml-art HML_REQUIRE_SPA=1 node tests/expedicao-spa-hml-flow.mjs
node --test tests/expedicao-fluxo-operacional.test.js tests/expedicao-integracao-telas.test.js
```

### Solicitação de revisão Codex (pacote Expedição)

Pedido ao Codex: revisar o pacote consolidado **#192–#199** (tip `cursor/expedicao-persistencia-canonica-392b`) quanto a:
1. Side-effect Pedido/estoque via portas (`docs/EXPEDICAO_PORTAS_PEDIDO_ESTOQUE.md`) — tip-port no Comercial
2. Contratos de ocorrência/devolução vs Comercial 360
3. Coexistência mig **036** Expedição com reserva comercial **025–035**
4. Simulação compat #198 (branch isolada; sem tip-port)

Resposta esperada: parecer em comentário do #178/#199 ou handoff — **sem merge/VPS**.

### Recuperação executável (estado parcial)

| Sintoma | Recuperação verificável |
|---|---|
| `Estado parcial: … Pedido legado incompleto` | Reabrir romaneio/despacho; Pedido ainda elegível; retry `updateInContext` legado; **sem** novo Romaneio se Entrega já despachada |
| `Estado parcial: … baixa de estoque incompleta` | Corrigir estoque/produto; reabrir comprovante da mesma Entrega; completar baixa; conferir 1 Entrega + movimentações idempotentes |
| `Estado parcial` pós-devolução | Completar financeiro/estoque/notificação faltantes; Entrega permanece `Devolvido`; sem segundo `logistica_reversa` criado |
| `session_access_changed` na SPA local | `/?reset-local=1` ou reload — mestre local reidrata `local_perfil_admin` e nova sessão |

## Coordenação Comercial (#178) × Expedição (#199)

| Frente | HEAD | CI | Contrato cruzado | Tip-port |
|---|---|---|---|---|
| #178 Comercial 360 | tip Codex (mig 025–035) | frontend+backend SUCCESS | Pedido/Orçamento — **reserva Codex** | **Não** até FINAL |
| #199 Expedição tip | tip desta PR | frontend+backend | HTTP Entrega/Romaneio + portas reserved; mig **036** | Aguarda #178 FINAL p/ adapters |
| Integrada Comercial+Expedição | — | — | Portas Pedido/estoque `applied` no mesmo tenant | Bloqueada |

## Pacote de implantação (gates vigentes — sem VPS neste lote)

| Item | Conteúdo |
|---|---|
| Dependências de merge | Stack draft **#192→#199** em ordem; **não** mesclar tip Expedição antes de revisão humana; tip Comercial **só após #178 FINAL** |
| Artefato código | Branch `cursor/expedicao-persistencia-canonica-392b` |
| Validações pré-merge | `runtime11-expedicao-*` + PGlite + Playwright API; CI `erp-runtime-ci`; `git diff --check` |
| Runtime | Sem promoção VPS; mig 036 **só** no repositório/CI |
| Rollback | Fechar draft #199→#192; **não** reverter 025–035; **não** tocar Pedido Codex |
| Segredos | Nenhum no pacote; evidências SPA sem tokens/PII |

## Rollback

1. Sem merge: fechar drafts #199→#192  
2. Pós-merge autorizado: revert do merge; **não** reverter 025–035; **não** tocar Pedido Codex  
3. VPS: **não** autorizado neste lote  

## Quadro objetivo

| Pronto p/ integração | Falta | Bloqueios reais |
|---|---|---|
| Fluxo operacional + persistência canônica BFF+PG no tip #199 | Homologação HML com mig 036 aplicada | #178 FINAL (portas) |
| Isolamento∧, RBAC, HTTP, auditoria TX, PGlite+Playwright API | WhatsApp/roteirizador/assinatura como serviço | Merge/VPS/import Empresas |
| Contrato portas Pedido/estoque documentado | Tip-port Comercial adapters | Autorização merge ordenado |
