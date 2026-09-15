# PROVISIONAMENTO-HML-01 — Fase 1 (Descoberta + Núcleo HML)

Data: 2026-09-15  
Repositório: `viniciuszuccaro-creator/ERP-Zuccaro-codeX`  
Branch: `cursor/provisionamento-hml-01-392b`  
Escopo desta execução: **somente FASE 1**  
Site CPA: **não alterado**

## Decisão da Fase 1

**`HML_CORE_BLOCKED_CONFIGURATION`**

O núcleo de código S2S está pronto (contratos ERP-SITE-01..12, health, harness GO-LIVE-HML-01).  
Faltam ações humanas/externas obrigatórias antes de autorizar FASE 2 / Opção B:

| Blocker | Tipo | Ação |
|---|---|---|
| `SITE_HML_CONNECTION` | Runtime | Provisionar app/ambiente Base44 HML e obter URL real |
| `S2S_REAL_CREDENTIAL` | Segredo | Configurar `SITE_CPA_SERVICE_TOKEN` e `SITE_CPA_HMAC_SECRET` no secret store do runtime |
| `HML_GROUP_EMPRESA_ENTITIES` | Dados | Criar Grupo/Empresa HML no runtime (não no Git) |
| `HML_DATASET_MATERIALIZATION` | Dados | Materializar clientes/produtos/obras HML no runtime |

Não há blocker de código no gateway para o núcleo comercial (`CUSTOMER_RESOLVE`, `CATALOG_READ`, `QUOTE_CREATE`, `NEGOTIATION`, `ORDER_CREATE`, `WORK`).

**Não declarado:** `GO_LIVE_READY`, `ERP_E2E_READY`, Opção B.

Quando os blockers acima forem resolvidos pelo usuário, a decisão pode evoluir para `HML_CORE_READY_FOR_SITE_CONNECTION` em lote posterior.

---

## 1. Runtime / plataforma identificados

| Item | Evidência no código | Conclusão |
|---|---|---|
| Backend S2S | `base44/functions/legacyIntegrationsMirror/entry.ts` (`Deno.serve`) | Função Base44 hospedada (Deno) |
| Cliente SDK na função | `createClientFromRequest` de `@base44/sdk` | Service role via request Base44 |
| Secrets | `env: (name) => Deno.env.get(name)` | Variáveis no ambiente Deno/Base44 do app |
| Frontend | Vite + `@base44/vite-plugin` + React | UI ERP; pode ser `VITE_LOCAL_ONLY=true` |
| Modo local | `src/api/base44Client.js` | Snapshot local **não** publica S2S externo |
| Deploy | `@base44/vite-plugin` + estrutura `base44/functions/*` | Deploy/publicação via plataforma **Base44** |
| Painel | Não há Terraform/Vercel/Fly no repo para funções | Configurar secrets/app no painel **Base44** (não inventar outro) |

**Ambiente HML existente:** não há URL HML versionada no Git. Snapshot local referencia `serverUrl: https://base44.app` e um `appId` de export — isso **não** é autorização para usar produção como HML. O usuário deve confirmar/criar ambiente HML no Base44.

---

## 2. Endpoint S2S real (formato, sem URL inventada)

Função canônica: **`legacyIntegrationsMirror`**.

Formato canônico (SDK `@base44/sdk` → `functions.invoke`):

```text
POST {BASE44_SERVER_URL}/api/apps/{APP_ID}/functions/legacyIntegrationsMirror
```

Formato relativo usado na UI de Integrações:

```text
{ERP_APP_ORIGIN}/functions/legacyIntegrationsMirror
```

(`src/components/administracao-sistema/IntegracoesIndex.jsx`)

**`ERP_BASE_URL` / `SITE_CPA_BASE_URL`:** **não existem** no código do ERP.  
`ERP_BASE_URL` será variável **do Site CPA** (FASE 2), apontando para o endpoint acima. Valor concreto: obter no painel Base44 do app HML — **não inventar**.

Health: mesmo endpoint, body `operation: "siteHealth"`, headers S2S.  
**Auth obrigatória:** token + HMAC também no health (fail-closed; não enfraquecer).

---

## 3. Origin / CORS

| Conceito | Realidade no código |
|---|---|
| `x-origin` | Header/contrato deve ser literal **`SITE_CPA`** (`SITE_CPA_ORIGIN`) |
| `SITE_CPA_ALLOWED_ORIGIN` / CORS `*` | **Não existem** no gateway S2S |
| HTTP Origin/CORS browser | S2S é server-to-server; não abrir `Access-Control-Allow-Origin: *` por causa deste contrato |

Domínio HML do Site entra na FASE 2 (lado Site), não como env CORS no ERP.

---

## 4. Autenticação S2S / HMAC (procedimento, sem segredo)

### Headers

- `Authorization: Bearer <SITE_CPA_SERVICE_TOKEN>`
- `Content-Type: application/json`
- `x-origin: SITE_CPA`
- `x-correlation-id`
- `x-site-cpa-timestamp` (ISO-8601, skew padrão 5 min)
- `x-site-cpa-nonce` (16..160 chars, único)
- `x-site-cpa-signature` = HMAC-SHA256 hex de `timestamp.nonce.rawBody`
- `idempotency-key` (obrigatório exceto `siteHealth`)

### Algoritmo

`hmacSha256Hex(SITE_CPA_HMAC_SECRET, timestamp + '.' + nonce + '.' + rawBody)` → 64 hex.

### Geração de token/HMAC

O código **não** gera segredo. Procedimento seguro:

1. Gere valores criptograficamente fortes **fora do chat/Git**.
2. Configure apenas no secret store / `Deno.env` do app Base44 HML.
3. Não cole o valor no chat, PR, commit, screenshot ou teste.
4. Confirme apenas: “configurado” / “não configurado”.

Sem `SITE_CPA_SERVICE_TOKEN` ou `SITE_CPA_HMAC_SECRET`: `503 site_cpa_credentials_not_configured`.

---

## 5. Matriz canônica de variáveis

### Investigação de aliases (NÃO criar)

| Nome investigado | Existe no ERP? |
|---|---|
| `ERP_BASE_URL` | Não (lado Site, FASE 2) |
| `SITE_CPA_BASE_URL` | Não |
| `ERP_SERVICE_TOKEN` / `ERP_S2S_TOKEN` | Não |
| `ERP_HMAC_SECRET` | Não |
| `ERP_GROUP_ID` / `ERP_EMPRESA_ID` | Não |
| `SITE_CPA_ALLOWED_ORIGIN` / `ERP_ALLOWED_ORIGIN` | Não |
| `SITE_CPA_ENV` / `ERP_ENV` | Não |

### Canônicos (código real)

| PURPOSE | CANONICAL_ENV_NAME | USED_BY | REQUIRED | SECRET | CURRENT_STATUS | CONFIG_LOCATION |
|---|---|---|---|---|---|---|
| Service token S2S | `SITE_CPA_SERVICE_TOKEN` | `siteCpaS2SPolicy` via `legacyIntegrationsMirror` | Sim (núcleo) | Sim | Não provisionado | `Deno.env` no app Base44 HML |
| HMAC secret | `SITE_CPA_HMAC_SECRET` | idem | Sim (núcleo) | Sim | Não provisionado | idem |
| Grupo canônico | `SITE_CPA_GROUP_ID` | `resolveSiteCpaScope` | Sim | Não | Não provisionado | idem + entidade `Grupo`/contexto |
| Empresa padrão | `SITE_CPA_DEFAULT_EMPRESA_ID` | idem | Sim | Não | Não provisionado | idem + entidade `Empresa` |
| Allowlist empresas | `SITE_CPA_ALLOWED_EMPRESA_IDS` | idem (CSV) | Sim | Não | Não provisionado | idem |
| Rate limit | `SITE_CPA_RATE_LIMIT` | ledger/rate | Não (default 120) | Não | Opcional | idem |
| Janela rate | `SITE_CPA_RATE_WINDOW_MS` | idem | Não (default 60000) | Não | Opcional | idem |
| Payment API key | `SITE_CPA_PAYMENT_API_KEY_<EMPRESA>` (+ fallback sem sufixo) | `siteCpaPayment/provider` | FASE 5 | Sim | Fora da Fase 1 | idem |
| Payment webhook secret | `SITE_CPA_PAYMENT_WEBHOOK_SECRET_<EMPRESA>` | idem | FASE 5 | Sim | Fora da Fase 1 | idem |
| Payment customer map | `SITE_CPA_PAYMENT_CUSTOMER_ID_<EMPRESA>` | idem | FASE 5 | Não/sensível | Fora da Fase 1 | idem |
| Webhook rate | `SITE_CPA_PAYMENT_WEBHOOK_RATE_LIMIT` | payment webhook | FASE 5 | Não | Fora da Fase 1 | idem |
| URL pública do gateway | *(não é env do ERP)* | Site CPA | FASE 2 | Não | Desconhecida | Painel Base44 → informar ao Site como `ERP_BASE_URL` |

Sufixo `<EMPRESA>`: `empresaId` com `[^A-Za-z0-9]` → `_` e UPPERCASE  
(ex.: `hml_empresa_cpa` → `HML_EMPRESA_CPA`).

Template versionado: [`.env.site-cpa.hml.example`](../.env.site-cpa.hml.example).

---

## 6. Grupo / Empresa / identidade HML

### Recomendado (alinhado ao dataset sintético)

| Campo | Valor recomendado |
|---|---|
| Nome visível | **CPA HOMOLOGAÇÃO** |
| `groupId` / `SITE_CPA_GROUP_ID` | `hml_grupo_cpa` *(ou ID real gerado pelo Base44 ao criar o Grupo — usar o ID persistido)* |
| `empresaId` padrão | `hml_empresa_cpa` *(ou ID real da Empresa criada)* |
| Empresa negativa | fora de `SITE_CPA_ALLOWED_EMPRESA_IDS` |

**Importante:** se o Base44 gerar IDs automáticos, os env devem usar os **IDs reais** criados — os `hml_*` do harness são contrato de teste in-memory. Preferir criar entidades com códigos/nomes HML claros e copiar os IDs resultantes para o env.

**Não criar automaticamente** neste lote. Não contaminar produção.

Validação de escopo: `validateConfiguredCompany` exige `Empresa` com `id` + `group_id` coerentes no runtime.

---

## 7. Dataset / usuários / produtos / obras

Fonte in-memory: `tests/helpers/siteCpaHmlDataset.js` (`HML_IDS`, `HML_ROLES`).

| Domínio | Preparação Fase 1 | Materialização runtime |
|---|---|---|
| Clientes A/B | IDs/roles definidos no helper | Criar no HML manualmente / import controlado (FASE 2+) |
| Roles | `ADMIN_EMPRESA`, `COMPRADOR`, `FINANCEIRO`, `CONSULTA` via `SolicitacaoAprovacao` (`vinculo_site_cpa_cliente`) | Idem |
| Produtos | ativo / inativo / sem preço / sem estoque | Idem |
| Obras | Obra A/B + Projeto + Centro de Custo | Idem |
| Pedido/CR/Entrega/Chat/Armacao/Opp | seeds no harness | Opcional para health core; necessários nas FASES 3–4 |

O harness **não** grava app/localStorage/produção.

---

## 8. Health / capabilities do núcleo (Fase 1)

Operação: `siteHealth`.

Com entidades core sondáveis e **sem** payment keys:

- Core esperado: `CUSTOMER_RESOLVE`, `CATALOG_READ`, `ORDER_CREATE`, `QUOTE_CREATE`, `NEGOTIATION` → `ready` (após materializar entidades)
- `WORK` → conforme `Projeto`/`CentroCusto`
- `PAYMENT` / `PAYMENT_PROVIDER` → `blocked` (honesto; FASE 5)
- `PRODUCTION_RELEASE` → sempre `blocked`
- `COMMERCIAL_COPILOT` → `degraded`

Harness local (já existente) confirma schema e fail-closed sem credencial real.

---

## 9. Segurança confirmada no código

- Token e HMAC só server-side (`Deno.env`)
- Fail-closed sem credencial/escopo/ledger
- Multiempresa obrigatório (`groupId` + `empresaId` allowlisted)
- Mass assignment / privacy cobertos pelas suites ERP-SITE
- Secrets fora do Git (`.env` / `.env.*` ignorados; example liberado)

---

## 10. Checklist humano (prático)

| PASSO | ONDE ENTRAR | O QUE FAZER | VALOR/INFORMAÇÃO | COMO VALIDAR |
|---|---|---|---|---|
| 1 | Painel Base44 | Confirmar ou criar **app/ambiente HML** separado de produção | Nome sugerido: ERP Zuccaro HML / CPA HOMOLOGAÇÃO | App HML listado; **não** usar produção |
| 2 | Painel Base44 → app HML | Anotar `APP_ID` e `SERVER_URL` públicos | Formato endpoint da seção 2 | Montar URL sem publicar segredo |
| 3 | Painel Base44 → Secrets / Env | Criar `SITE_CPA_SERVICE_TOKEN` e `SITE_CPA_HMAC_SECRET` | Gerados fora do chat; **não colar aqui** | Confirmar “configurado”; health sem token deve falhar 401/503 |
| 4 | ERP HML → Cadastros | Criar Grupo + Empresa “CPA HOMOLOGAÇÃO” | Copiar IDs reais | Empresa com `group_id` correto |
| 5 | Secrets / Env | Preencher `SITE_CPA_GROUP_ID`, `SITE_CPA_DEFAULT_EMPRESA_ID`, `SITE_CPA_ALLOWED_EMPRESA_IDS` | IDs do passo 4 | Escopo inválido → 403 |
| 6 | ERP HML | Criar clientes A/B, vínculos com 4 roles, produtos, obras/projeto/CC | Alinhar a `siteCpaHmlDataset` | Listagens no UI HML |
| 7 | Cliente HTTP server-side (ou Site em FASE 2) | POST `siteHealth` assinado | Headers da seção 4 | `200` + capabilities; JSON sem segredos |
| 8 | Canal seguro | Guardar URL HML para configurar `ERP_BASE_URL` no **Site** (FASE 2) | Sem commit no Git | Site ainda não alterado nesta fase |

**Se faltar painel/acesso Base44:** pare no passo correspondente. Não inventar URL/token. Não pedir segredo no chat — diga apenas “configurei” / “não configurei”.

---

## 11. Fases futuras (NÃO executadas nesta execução)

| Fase | Objetivo | Onde |
|---|---|---|
| **2** Site ↔ ERP | Configurar no Site: `ERP_BASE_URL`, token, HMAC, grupo/empresa; `Site → siteHealth → ERP` | Repositório **Site CPA** |
| **3** E2E Comercial | Cliente → Catálogo → Carrinho → Orçamento → Negociação → Pedido → Obras | Ambos |
| **4** E2E Operacional | Portal, Entrega, Chat, Armação, Oportunidades | Ambos |
| **5** Providers obrigatórios | Payment sandbox, private storage, upload security | ERP HML + Site |
| **6** Opcionais | Copiloto generativo, DWG, mensageria | Não bloqueiam 1º lançamento se opcionais |
| **7** Opção B | `GO-LIVE-HML-01 Opção B` com S2S real | Ambos |

Pré-condições da Opção B: ERP HML + Site HML + S2S + HMAC + Grupo/Empresa + health real.

---

## 12. Evidências Fase 1

- Precursor: `docs/GO_LIVE_HML_01_ERP.md`, `docs/ERP_SITE_HML_01.md`
- Gateway: `legacyIntegrationsMirror` → `handleSiteCpaGatewayRequest`
- Harness: `tests/helpers/siteCpaHml{Dataset,Harness}.js`, `tests/site-cpa-go-live-hml-01.test.js`
- Suites: `tests/site-cpa-*.test.js`

## 13. Proibições respeitadas

- Sem ERP-SITE-13 / B2B novo / feature nova
- Sem Opção B / pagamento / Site CPA
- Sem `GO_LIVE_READY`
- Sem segredo real no Git
- Sem merge automático em `main` neste lote
