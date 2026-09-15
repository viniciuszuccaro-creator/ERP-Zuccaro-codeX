# GO-LIVE-HML-01 (Opção A) — Preparação ERP para E2E externo

Data: 2026-09-15  
Repositório: `viniciuszuccaro-creator/ERP-Zuccaro-codeX`  
Branch de entrega: `cursor/go-live-hml-01-392b`  
Precursor: `docs/ERP_SITE_HML_01.md` (`ERP_READY_FOR_SITE_E2E`)

## Decisão deste lote

| Chave | Valor |
|---|---|
| Preparação ERP | **`ERP_HML_PREPARED_FOR_EXTERNAL_E2E`** |
| E2E externo | **`EXTERNAL_E2E_STATUS=BLOCKED_CONFIGURATION`** |
| Explicitamente **não** declarado | `ERP_E2E_READY`, `GO_LIVE_READY` |

Esta Opção A prepara o ERP (dataset sintético, harness S2S, checklist, template de env sem segredos).  
Não configura Site CPA, não inventa URL/credenciais e não transforma `BLOCKED`/`DEGRADED` em `READY` via mock.

## Checklist de provisionamento HML (humano / Opção B)

1. Runtime HML do ERP disponível (`SITE_HML_CONNECTION`) — fora do Git.
2. Secret store com `SITE_CPA_SERVICE_TOKEN` e `SITE_CPA_HMAC_SECRET` reais.
3. Preencher `SITE_CPA_GROUP_ID`, `SITE_CPA_DEFAULT_EMPRESA_ID`, `SITE_CPA_ALLOWED_EMPRESA_IDS`.
4. Rate limit (`SITE_CPA_RATE_LIMIT`, `SITE_CPA_RATE_WINDOW_MS`) conforme capacidade.
5. Provider de pagamento sandbox por empresa (`SITE_CPA_PAYMENT_*_<EMPRESA>`).
6. Storage privado + assinador de URL (portal documento / provas).
7. Scanner de malware (chat/armação) quando cenário exigir anexo.
8. Dataset operacional HML alinhado aos IDs/roles do helper sintético (sem copiar produção).
9. Site CPA apontando para o mesmo contrato S2S v1 — **somente na Opção B**.
10. Validar health real: core `ready`, dependências externas honestas.

Template seguro: [`.env.site-cpa.hml.example`](../.env.site-cpa.hml.example).

## Inventário real de configuração (`SITE_CPA_*`)

Inventariado no código (sem aliases inventados):

| Variável | Onde | Função |
|---|---|---|
| `SITE_CPA_SERVICE_TOKEN` | `siteCpaS2SPolicy/entry.ts` | Bearer S2S |
| `SITE_CPA_HMAC_SECRET` | idem | HMAC `x-site-cpa-signature` |
| `SITE_CPA_GROUP_ID` | idem | Grupo canônico |
| `SITE_CPA_DEFAULT_EMPRESA_ID` | idem | Empresa padrão |
| `SITE_CPA_ALLOWED_EMPRESA_IDS` | idem | CSV allowlist |
| `SITE_CPA_RATE_LIMIT` | idem | Limite por janela |
| `SITE_CPA_RATE_WINDOW_MS` | idem | Janela ms |
| `SITE_CPA_PAYMENT_API_KEY_<EMPRESA>` | `siteCpaPayment/provider.ts` | API key provider |
| `SITE_CPA_PAYMENT_WEBHOOK_SECRET_<EMPRESA>` | idem | Segredo webhook |
| `SITE_CPA_PAYMENT_CUSTOMER_ID_<EMPRESA>` | idem | Customer mapping |
| `SITE_CPA_PAYMENT_WEBHOOK_RATE_LIMIT` | webhook | Rate limit webhook |
| Fallbacks sem sufixo | `SITE_CPA_PAYMENT_API_KEY`, `_WEBHOOK_SECRET`, `_CUSTOMER_ID` | Lidos se presentes |

Sufixo de empresa: `empresaId` com `[^A-Za-z0-9]` → `_` e UPPERCASE.

## Blockers externos (classificados)

| Blocker | Classe | Impacto no health |
|---|---|---|
| `SITE_HML_CONNECTION` | Configuração | Impede E2E real |
| `S2S_REAL_CREDENTIAL` | Segredo | Gateway 503/401 sem credencial |
| Payment provider | Integração | `PAYMENT` / `PAYMENT_PROVIDER` = `blocked` |
| Private storage | Integração | Portal documento / provas `unavailable` |
| Malware scanner | Integração | Anexos chat/armação |
| DWG converter | Integração | Conversão técnica futura |
| AI provider | Integração | `COMMERCIAL_COPILOT` = `degraded` |
| Outbound messaging | Opcional | `not_required` no núcleo |

## Matriz E2E (preparação × execução)

| Domínio | Ops (resumo) | Prep Opção A | Execução externa |
|---|---|---|---|
| Health | `siteHealth` | Harness + schema | BLOCKED até URL/creds |
| Cliente | `siteClienteResolve` | Dataset A/B + roles | BLOCKED_CONFIGURATION |
| Catálogo | `siteCatalogoList` | Produtos ativo/inativo/sem preço/estoque | idem |
| Pedido | `sitePedidoCreate` | Idempotência / mass assignment | idem |
| Orçamento | quote/negociação | Roteamento validado | idem |
| Pagamento | create/status/cancel | `PROVIDER_BLOCKED` honesto | exige sandbox |
| Portal | 7 ops | Documento sem storage = blocked | exige storage |
| Entrega | 4 ops | Ownership | provas via storage |
| Chat | 6 ops | Privacidade nota interna | scanner/realtime |
| Armação | 5 ops | Confirm ≠ release; `PRODUCTION_RELEASE=blocked` | scanner/DWG |
| Obras | 6 ops | `allowedWorkIds` | — |
| Oportunidade | 4 ops | Signal idempotente; Copiloto degraded | AI opcional |

Operações públicas: **43** (ERP-SITE-01..12). Este lote não cria ERP-SITE-13.

## Capabilities esperadas com dataset sintético + env sem provider

- Core (`CUSTOMER_RESOLVE`, `CATALOG_READ`, `ORDER_CREATE`, `QUOTE_CREATE`, `NEGOTIATION`): `ready` após probe de entidades.
- `PAYMENT` / `PAYMENT_PROVIDER`: `blocked` sem chaves/provider.
- `PRODUCTION_RELEASE`: sempre `blocked` neste contrato.
- `COMMERCIAL_COPILOT`: `degraded`.
- Health geral: `degraded` (não `ready` global).

## Artefatos deste lote

| Artefato | Função |
|---|---|
| `.env.site-cpa.hml.example` | Template sem segredos |
| `tests/helpers/siteCpaHmlDataset.js` | Fixture `hml_*` in-memory |
| `tests/helpers/siteCpaHmlHarness.js` | Assinatura HMAC + gateway/router |
| `tests/site-cpa-go-live-hml-01.test.js` | Evidência Opção A |
| Este documento | Checklist / decisão / runbook |

Credenciais sintéticas de teste (somente harness):  
`hml-test-service-token-not-a-real-secret` / `hml-test-hmac-not-a-real-secret`.

## Runbook Opção B (sem segredos neste repo)

1. Provisionar HML e secret store (passos do checklist).
2. Copiar `.env.site-cpa.hml.example` → env do ambiente; preencher valores reais fora do Git.
3. Publicar URL HML apenas no canal seguro da operação.
4. Apontar Site CPA ao contrato S2S v1 existente (sem fork de contrato).
5. Rodar health real e suíte E2E; manter `blocked`/`degraded` honestos.
6. Só então avaliar `ERP_E2E_READY` em lote separado — nunca neste.

## P0 / P1 / P2

### P0 (código)

Nenhum aberto neste lote. Contratos ERP-SITE-01..12 reutilizados.

### P1

Nenhum de código ligado ao harness. Dependências externas continuam condicionais.

### P2 / backlog

- Opção B: conexão Site CPA + credenciais reais + storage/provider.
- Homologar scanner, DWG, IA e mensageria quando escolhidos.
- Não declarar `GO_LIVE_READY` sem Gates humanos 18–20.

## Evidências

- Teste dedicado: `node --experimental-strip-types --test tests/site-cpa-go-live-hml-01.test.js`
- Suites existentes `tests/site-cpa-*.test.js` permanecem a fonte de regressão ERP-SITE.
- Zero segredo real no Git; Site CPA não alterado; sem merge automático em `main`.
