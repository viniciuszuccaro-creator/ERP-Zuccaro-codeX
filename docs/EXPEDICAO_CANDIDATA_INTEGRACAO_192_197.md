# Expedição/Logística — candidata consolidada de integração (#192–#197)

## Identidade

| Campo | Valor |
|---|---|
| Candidata | Stack draft **#192 → #197** (tip = #197) |
| Branch tip | `cursor/expedicao-integracao-romaneio-canonico-392b` |
| HEAD tip (código pacote) | `7d4f445e` (persistência fail-closed) |
| HEAD tip (atual) | tip pós-Playwright/navegação (pacote código `7d4f445e`) |
| Estado | **Candidata de integração** — SPA local Playwright avançou A–D+E+I; ≠ API/PG/VPS |
| CI tip | frontend+backend no HEAD do tip (**≠** homologação SPA/VPS) |
| Codex Comercial #178 | `4f8c6593` ainda **candidata** (R08C fixture); sem tip-port; CI SUCCESS |

## Cadeia

| PR | Entrega |
|---|---|
| #192 | Filtros listagem/romaneio (empresa/cidade/data/futuras) |
| #193 | Detalhe + separação fail-closed |
| #194 | Roteirização fail-closed |
| #195 | Fluxo operacional consolidado + testes |
| #196 | Pedidos→separação, unidades, rollback despacho |
| #197 | IntegracaoRomaneio canônica + soft∨ crítico + comprovante/ocorrência/IA + filtros cliente + devolução assert + **persistência multi-etapa fail-closed (sem toast de sucesso parcial)** |

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

### Estado da homologação SPA (2026-10-01)

| Item | Status |
|---|---|
| Pacote tip #197 (código `7d4f445e`) + correções navegação | OK |
| Diagnóstico cards não abrem (computerUse) | **Limitação da ferramenta** — não defeito do `openWindow`; Playwright prova clique→janela |
| Correções app no tip | Hydrate parcial preserva tenant; topologia `Empresa` sem escopo `empresa_id` fantasma; `resolveEmpresaOperacionalExpedicao`; merge `pedidosBase` no Romaneio; clamp viewport; `data-testid=erp-window` |
| Camada | `SPA_LOCAL_BASE44` / IndexedDB — **não** substitui API HTTP nem PostgreSQL real nem VPS |
| Playwright roteiro | `tests/expedicao-spa-hml-flow.mjs` + `expedicao-spa-launchpad.playwright.test.mjs` |
| A seleção/listagem | PASS |
| B separação | PASS_attempted (UI SeparacaoConferencia) |
| C romaneio+despacho | PASS (1 Romaneio persistido) |
| D retry | PASS (sem duplicar Entrega/Romaneio) |
| E parcial | PASS_attempted (DetalhesEntregaView) |
| I falha estoque | PASS_sem_falso_sucesso (status permanece; sem marcar Entregue) |
| G ocorrência | PASS_attempted / reabrir detalhe |
| H devolução | **BLOCKED** — `LogisticaReversa` não ligada na listagem (gap existente; coberto em integração telas) |
| #178 compat | Branch isolada de simulação; tip-port **não** autorizado enquanto candidata |

```bash
# SPA HTTPS local (VITE_ERP_BACKEND=local) + Playwright
HML_REQUIRE_SPA=1 node tests/expedicao-spa-hml-flow.mjs
node --test tests/expedicao-spa-launchpad.playwright.test.mjs tests/expedicao-launchpad-openwindow-contract.test.js
```

### Recuperação executável (estado parcial)

| Sintoma | Recuperação verificável |
|---|---|
| `Estado parcial: … Pedido legado incompleto` | Reabrir romaneio/despacho; Pedido ainda elegível; retry `updateInContext` legado; **sem** novo Romaneio se Entrega já despachada |
| `Estado parcial: … baixa de estoque incompleta` | Corrigir estoque/produto; reabrir comprovante da mesma Entrega; completar baixa; conferir 1 Entrega + movimentações idempotentes |
| `Estado parcial` pós-devolução | Completar financeiro/estoque/notificação faltantes; Entrega permanece `Devolvido`; sem segundo `logistica_reversa` criado |
| `session_access_changed` na SPA local | `/?reset-local=1` ou reload — mestre local reidrata `local_perfil_admin` e nova sessão |

## Coordenação Comercial (#178) × Expedição (#197)

| Frente | HEAD | CI | Contrato cruzado | Tip-port |
|---|---|---|---|---|
| #178 Comercial 360 | `4f8c6593` (R08C validade fixture) | frontend+backend+concurrency SUCCESS | Pedido/Orçamento/mig 026–035 / `saleIngress` — **reserva Codex** | **Não** até FINAL |
| #197 Expedição tip | `b8497171` | frontend+backend SUCCESS | Side-effect legado `Pedido` só descritivo (`INTEGRACAO_ROMANEIO_PEDIDO_LEGADO_SIDE_EFFECT` / separação) | Aguarda #178 FINAL |
| Integrada Comercial+Expedição | — | — | Contratos HTTP Pedido + Entrega/Romaneio no mesmo tenant | Bloqueada |

## Pacote de implantação (gates vigentes — sem VPS neste lote)

| Item | Conteúdo |
|---|---|
| Dependências de merge | Stack draft **#192→#197** em ordem; **não** mesclar tip Expedição antes de revisão humana; tip Comercial **só após #178 FINAL** |
| Artefato código | Branch `cursor/expedicao-integracao-romaneio-canonico-392b` @ `b8497171` |
| Validações pré-merge | `node --test tests/expedicao-*.test.js` (41); CI `erp-runtime-ci`; `git diff --check` |
| Runtime | Sem promoção VPS; sem migration nova nesta candidata |
| Rollback | Fechar drafts #197→#192; pós-merge autorizado: revert do merge; **não** reverter 026–035; **não** tocar Pedido Codex |
| Segredos | Nenhum no pacote; evidências SPA sem tokens/PII |


## Simulação compat #178 (branch isolada)

| Campo | Valor |
|---|---|
| Branch | `cursor/expedicao-compat-178-sim-392b` |
| SHA #178 | `4f8c6593` mesclado sobre tip Expedição |
| Tip-port Comercial | **Não** — Codex #178 preservada |
| Achado | Contratos fonte Separacao divergem (#178 inline vs tip #197 `expedicaoFluxoOperacionalPolicy`); testes adaptados para aceitar ambas |
| CI flaky herdado #178 | `orcamento-ui-policy`: validade YYYY-MM-DD vs T12:00 local falha após meio-dia no dia da fixture — estabilizado com `now` fixo **só** na branch compat |
| Aprovação/deploy | **Bloqueados** (ambas candidatas) |

## Rollback

1. Sem merge: fechar drafts #197→#192  
2. Pós-merge autorizado: revert do merge; **não** reverter 026–035; **não** tocar Pedido Codex  
3. VPS: **não** autorizado neste lote  

## Quadro objetivo

| Pronto p/ integração | Falta | Bloqueios reais |
|---|---|---|
| Fluxo operacional + persistência fail-closed no tip #197 (`b8497171`) | Homologação navegador A–J completa no ambiente do agente | #178 FINAL |
| Isolamento∧, RBAC, filtros, testes policy+telas 41/41 | WhatsApp/roteirizador/assinatura como serviço | Merge/VPS/import Empresas |
| Compensação≠atômico + recuperação documentada | Tip Comercial 360 + candidata integrada | Autorização merge ordenado |
