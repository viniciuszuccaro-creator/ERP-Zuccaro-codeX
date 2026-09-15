# DIAGNÓSTICO DE RUNTIME — ERP ZUCCARO (pré-HML)

Data: 2026-09-15  
Repositório oficial: `viniciuszuccaro-creator/ERP-Zuccaro-codeX`  
Branch: `cursor/diagnostico-runtime-erp-392b`  
Escopo: **somente diagnóstico** (sem migração, sem HML, sem Site CPA, sem provider)

## Premissa confirmada pelo produto

O **ERP principal** é este repositório GitHub.  
Há origem/código Base44 e pode existir **cópia separada** no Base44 para testes — **essa cópia não é o runtime oficial**.

Neste diagnóstico:

- **não** se assume app Base44 ativo/publicado para o principal;
- **não** se configura HML no Base44;
- **não** se altera arquitetura ainda.

---

## 1. Estado atual (o que o código faz de fato)

### 1.1 Dois modos de cliente

`src/api/base44Client.js`:

| Condição | Cliente | Persistência |
|---|---|---|
| `VITE_LOCAL_ONLY=true` **ou** ausência de `appId` + `serverUrl` | `localBase44` | Browser `localStorage` (+ snapshot JSON) |
| `appId` + `serverUrl` Base44 configurados | `@base44/sdk` remoto | Backend/entidades Base44 |

**Conclusão:** o caminho padrão do clone GitHub, sem credenciais Base44, é **runtime local no browser**, não um app Base44 publicado.

### 1.2 Acoplamento de superfície

Aproximações no `src/` (chamadas estáticas):

| Superfície | Ordem de magnitude |
|---|---|
| `base44.entities.*` | ~900 |
| `base44.functions.invoke` | ~120 |
| `base44.auth.*` | ~110 |
| `base44.integrations.Core.*` (upload/LLM/etc.) | dezenas |

Ou seja: o frontend fala o **contrato Base44** em toda a UI, mesmo quando o backend real é o adapter local.

### 1.3 Artefatos Base44 no repo

- `base44/functions/*` (~70 funções Deno)
- `@base44/sdk` + `@base44/vite-plugin`
- Snapshots: `public/base44-local-snapshot.json` (~14 MB, **134** tipos de entidade)
- Docs/planos de Site CPA assumindo gateway em função Base44 (legado documental)

---

## 2. Dependências Base44 por categoria

| Categoria | O que existe hoje | Status no ERP principal (GitHub) | Substituível? |
|---|---|---|---|
| **A) FRONTEND** | Vite/React; plugin Base44; import `@base44/sdk` | UI independente de host; SDK só como contrato | Sim (manter facade) |
| **B) BACKEND/FUNCTIONS** | `base44/functions` Deno + `createClientFromRequest` | Código versionado; **execução oficial não confirmada** | Parcial → API própria |
| **C) DATABASE/ENTITIES** | Entidades via SDK / `localBase44` | Local = `localStorage`; remoto = Base44 DB | **Sim — necessário Postgres** |
| **D) AUTH** | `base44.auth` remoto; sessão local + RBAC próprio | Local já tem política de sessão | Sim (IdP/JWT próprio) |
| **E) STORAGE** | `Core.UploadFile` / `UploadPrivateFile` / signed URL | Local = URIs mock `local://` / `private/local/...` | Sim (S3/R2) |
| **F) REALTIME** | `entity.subscribe()` em cadastros | Local: pub/sub in-memory; remoto: Base44 | Sim (SSE/WebSocket depois) |
| **G) SECRETS** | `Deno.env` nas functions; `VITE_*` no front | Sem secret store do principal documentado | Sim |
| **H) INTEGRATIONS** | LLM, e-mail, SMS, CNPJ, boleto, webhooks, WhatsApp | Mistura Core Base44 + functions | Sim, provider a provider |

---

## 3. Legado vs usado vs adapter

| Camada | Classificação | Notas |
|---|---|---|
| Telas React + hooks | **Usado** | Motor do ERP |
| `localBase44Client.js` (~2,5k linhas) | **Adapter ativo** | Emula entities/functions/auth/integrations |
| `localStorageAdapter` / snapshots | **Runtime local / fixture** | Não é banco empresarial |
| `base44/functions` Deno | **Backend portável em graus** | Depende de deploy Base44 para rodar “como está” |
| `siteCpaS2SPolicy` + routers ERP-SITE-01..12 | **Usado em testes; lógica pouco acoplada** | Gateway fino que chama policy |
| Mirrors/migrations `onLegacy*`, `migrate*` | **Utilitário/legado de transição** | Não são core de negócio contínuo |
| Cópia Base44 com outro nome | **Ambiente paralelo de teste** | Fora do escopo do principal |

---

## 4. Data layer

### 4.1 Como Cliente / Produto / Pedido / etc. persistem

Não há Prisma/Drizzle/SQL/Postgres/Mongo no `package.json` nem migrations SQL no repo.

Fluxo atual:

```text
UI → base44.entities.<Entidade>.filter/create/update
        ├─ (local)  localBase44 → objeto DB em localStorage
        └─ (remoto) @base44/sdk → API Base44 → DB Base44
```

### 4.2 Respostas diretas

| Pergunta | Resposta |
|---|---|
| Dependem diretamente de Base44? | **Da API-shape sim**; da nuvem Base44 **só se** `serverUrl`/`appId` estiverem setados |
| Existe abstração/repository? | **Parcial:** um único `base44` facade; sem repositórios por domínio |
| Existe `localBase44Client`? | **Sim** — implementação principal do modo GitHub default |
| Existe API intermediária própria? | **Não** (além das Deno functions no formato Base44) |
| Quanto do frontend chama Base44 diretamente? | **Quase tudo** de dados (~900 calls `entities`) |

### 4.3 Escala do modelo

Snapshot local: **134** tipos de entidade (Cliente, Produto, Pedido, Orcamento, ContaReceber, Entrega, Projeto, Oportunidade, estoque, fiscal, RH, etc.).

---

## 5. Backend (`base44/functions`)

Inventário (~70 pastas de função), classes:

| Classe | Exemplos | Acoplamento Base44 |
|---|---|---|
| **S2S / webhook** | `legacyIntegrationsMirror` (+ policies Site CPA) | Wrapper Deno + `createClientFromRequest`; **policies majoritariamente testáveis em Node** |
| **Negócio** | estoque, boleto, fiscal, comissão, logística, IA | Alto: leem/gravam entities via service role Base44 |
| **Integração** | WhatsApp, CNPJ, e-mail/SMS via Core | Médio/alto |
| **Webhook/evento** | `onPedidoCreated`, `onEntregaUpdated`, … | Alto (triggers da plataforma) |
| **Utilitário** | count/list/guard/audit/backup | Médio |
| **Migração/mirror** | `migrate*`, `onLegacy*` | Legado |

### 5.1 Site CPA S2S — esforço fora do Base44

Componentes:

1. **HTTP entry** (`legacyIntegrationsMirror`) — hoje Deno.serve + SDK Base44  
2. **Policy pura** (`siteCpaS2SPolicy`, routers, health, ERP-SITE-01..12) — já coberta por `node --test`  
3. **Acesso a dados** — hoje `base44.asServiceRole.entities.*`

**Esforço para hospedar fora do Base44 (ordem de grandeza):**

| Fatia | Esforço | Notas |
|---|---|---|
| Rehost do gateway HTTP (Express/Hono/Deno deploy) | **Baixo–médio** | Headers/HMAC já especificados |
| Policy/contratos | **Baixo** | Quase prontos |
| Trocar entities Base44 por repositório SQL | **Alto** | Bloqueador real do E2E |
| Idempotência/ledger (`IntegracaoEvento`) | **Médio** | Precisa tabela própria |

**Conclusão S2S:** o contrato Site↔ERP **não exige Base44**; exige um **host HTTP + DB real**. Base44 é só um dos hosts possíveis da entry atual.

---

## 6. Auth

| Aspecto | Situação |
|---|---|
| Usuários internos ERP | `User` / perfis / `entityGuard` / RBAC multiempresa |
| Service role | `asServiceRole` nas functions; no local, alias do próprio client |
| Sessão | Remoto: token Base44; Local: `localAuthSessionPolicy` + `localStorage` |
| MFA/TOTP | Fluxos locais recentes (`verifyTotp` / policies) |
| Externos Site CPA | Não usam login ERP; usam **S2S token+HMAC** + vínculo cliente/role |

Dependência Base44 Auth: **forte no modo remoto**; **já contornada** no modo local.

---

## 7. Banco

**Não existe banco próprio fora do Base44 neste repositório.**

Persistência observada:

- localStorage (dev/demo);
- snapshot JSON estático;
- (opcional) DB gerenciado Base44 se app remoto estiver ligado.

Para ERP empresarial (financeiro/fiscal/estoque/auditoria): localStorage é **inadequado** como PROD/HML oficial.

---

## 8. Storage

| Modo | Comportamento |
|---|---|
| Remoto Base44 | `UploadFile` / `UploadPrivateFile` / `CreateFileSignedUrl` |
| Local | Mock de URL/`file_uri` sem blob store real |

Documentos fiscais, comprovantes e XML exigirão object storage real na arquitetura-alvo.

---

## 9. Realtime

- Cadastros usam `api.subscribe(...)` quando disponível.
- Local: notificação in-process.
- Remoto: capacidade da plataforma Base44.

Não há dependencia crítica de realtime para o núcleo S2S Site CPA.

---

## 10. Build / frontend independente

Sim: **Vite/React pode publicar estático** (Pages/Vercel/Cloudflare) **desde que** exista API backend compatível com o facade `base44`.

Publicar só o frontend sem API = continua no modo localStorage (não serve HML/PROD).

---

## 11. Opções de arquitetura

### OPÇÃO A — Continuar ERP principal no Base44

- Prós: functions já existem; menos código novo curto prazo.  
- Contras: **conflita com a premissa** (principal ≠ Base44 ativo); cópia paralela gera drift; vendor lock-in; HML oficial ficaria em plataforma não eleita.  
- Adequação: baixa para o GitHub como fonte da verdade.

### OPÇÃO B — Frontend independente + API própria + PostgreSQL

- Prós: controle total; multiempresa/RLS; backup; jobs; S2S limpo; alinhado a ERP sério.  
- Contras: exige introduzir DB + portar acesso a dados; não reescrever UI se facade for mantida.  
- Adequação: **alta como destino**.

### OPÇÃO C — Híbrida temporária (recomendada como transição)

- Manter contrato `base44.entities/functions/auth` no frontend.
- Trocar implementação do client: Local → **HttpApiClient** → Postgres.
- Portar primeiro: Auth session, cadastros mestres, depois S2S gateway, depois financeiro/fiscal.
- Cópia Base44 (se existir) só como sandobox legado, sem ser HML oficial.

### OPÇÃO D (complementar) — BFF “compat Base44”

API Node/Deno que expõe rotas compatíveis com o SDK shape (`/entities/:name`, `/functions/:name`) para minimizar churn de UI.

---

## 12. Plataformas (avaliação para este ERP)

| Peça | Candidatos adequados | Evitar como núcleo |
|---|---|---|
| Frontend estático | Cloudflare Pages, Vercel | — |
| API Node/Deno | Railway, Fly.io, Render | Vercel **só** se jobs/webhooks longos forem separados |
| PostgreSQL | **Neon** ou **Supabase (Postgres)**; RDS se já houver AWS | localStorage; SQLite browser |
| Object storage | Cloudflare R2, S3 | URLs públicas sem controle |
| Secrets | Platform secrets + (depois) vault | `VITE_*` para segredos S2S |
| Filas/jobs | Railway/Fly cron; depois SQS/Queues | Functions Base44 triggers como única fila |

**Combinação sugerida (custo/controle):**  
Frontend Cloudflare Pages ou Vercel + API Railway/Fly + Postgres Neon + R2.

Supabase cabe se quiser Auth+Storage+Postgres no mesmo vendor — ainda assim a **API de domínio** deve ser sua (não acoplar telas ao client Supabase direto sem facade).

---

## 13. Recomendação

### Decisão: `HYBRID_TRANSITION`

**Justificativa técnica:**

1. O principal já **não depende** de Base44 publicado para abrir o app (modo local).  
2. Reescrever ~900 call sites é risco inaceitável; a facade já existe.  
3. Não há Postgres ainda — HML/PROD empresariais **exigem** DB real.  
4. S2S Site CPA está **quase desacoplável** e deve ser o primeiro backend “de verdade”.  
5. Manter Base44 como runtime oficial contradiz governança do repo e a cópia paralela.  
6. Destino estratégico = **MIGRATE_FROM_BASE44**; o caminho = híbrido incremental (Opção C + D).

**Não escolher `KEEP_BASE44`** como arquitetura do principal.  
**Não declarar migração big-bang (`MIGRATE_FROM_BASE44` sem híbrido)** nesta fase.

---

## 14. Arquitetura-alvo (textual)

```text
Browser (Vite/React)
    ↓  facade estável (hoje: base44 client API)
API Gateway / BFF (Node ou Deno)
    ├── Auth (JWT/sessão + RBAC multiempresa)
    ├── Domain services (Comercial, Estoque, Financeiro, Fiscal, …)
    ├── Site CPA S2S Gateway (HMAC, token, health, ERP-SITE ops)
    ├── Jobs/webhooks (NFe, boleto, WhatsApp, …)
    ↓
PostgreSQL (tenant: group_id + empresa_id)
    ├── tabelas de domínio + auditoria + idempotência S2S
Object storage (docs, XML, comprovantes)
Queue/Cron (opcional fase 2)
LLM/Payment providers (fase posterior, secrets no server)
```

Site CPA:

```text
Site CPA (server-side)
  → HTTPS ERP_S2S_BASE_URL/site-cpa  (ou /functions/legacyIntegrationsMirror compat)
  → Gateway S2S no BFF
  → Services + PostgreSQL
```

Sem Base44 no caminho crítico, se a recomendação for seguida.

---

## 15. Ambientes DEV / HML / PROD

| Ambiente | Frontend | API | DB | Notas |
|---|---|---|---|---|
| **DEV** | Vite local | API local ou mocks | Postgres dev / local ephemeral | localStorage só para UI isolada |
| **HML** | Deploy estático HML | API HML | Postgres HML (dados sintéticos CPA HOMOLOGAÇÃO) | Secrets HML; URL real para Site |
| **PROD** | Deploy estático prod | API prod | Postgres prod HA + backup | Sem misturar HML |

**Não** usar a cópia Base44 paralela como HML oficial.

---

## 16. Migração incremental (evitar reescrita total)

Ordem sugerida:

1. **Contrato** — documentar facade `entities/functions/auth/integrations` (já implícita).  
2. **Postgres + schema mínimo** — Grupo, Empresa, User, AuditLog, IntegracaoEvento.  
3. **HttpApiClient** atrás do mesmo export `base44`.  
4. **S2S Gateway** fora do Base44 (primeiro valor Site CPA).  
5. Cadastros mestres (Cliente, Produto, …) módulo a módulo.  
6. Comercial (Pedido/Orcamento) → Estoque → Financeiro → Fiscal.  
7. Storage real; jobs; realtime se necessário.  
8. Desligar caminho remoto Base44 no principal.

### Dificuldade / risco

| Item | Estimativa |
|---|---|
| Dificuldade geral | **Alta**, mas **incremental** |
| Módulos afetados | Todos que tocam `base44.entities` (quase o ERP) |
| Adapters necessários | HttpApiClient, repos SQL, auth, storage |
| Reescrever UI? | **Não** (objetivo) |
| Risco big-bang | Alto se pular o híbrido |
| Esforço S2S standalone | Médio **após** repos das entidades que o health/ops usam |
| Esforço “ERP inteiro em Postgres” | Alto (meses, por domínio) — fora deste diagnóstico quantificar sprint a sprint |

---

## 17. Riscos

- Tratar snapshot/localStorage como HML “quase produção”.  
- Configurar HML na cópia Base44 e divergir do GitHub.  
- Portar functions Deno 1:1 sem extrair domínio → novo lock-in.  
- Expor secrets em `VITE_*`.  
- Site CPA apontar para URL Base44 não oficial.  
- Migrar fiscal/financeiro antes de auditoria/idempotência no DB.

---

## 18. Próximos passos (após aprovação humana)

1. Congelar decisão: **principal = GitHub; Base44 cópia ≠ oficial**.  
2. Aprovar `HYBRID_TRANSITION` e stack alvo (API + Postgres + storage).  
3. Spike curto: BFF + 2–3 entidades + health S2S contra Postgres.  
4. Só então retomar **PROVISIONAMENTO-HML** sobre a stack escolhida (não Base44 por padrão).  
5. Site CPA (Fase 2) só com `ERP_BASE_URL` do HML novo.

---

## 19. O que esta tarefa NÃO fez

- Não migrou código.  
- Não removeu Base44.  
- Não criou banco.  
- Não alterou deploy.  
- Não configurou HML.  
- Não alterou Site CPA.  
- Não continuou PROVISIONAMENTO-HML Fase 2.

---

## 20. Decisão final

```text
HYBRID_TRANSITION
```

Destino: runtime oficial **fora do Base44** (API + PostgreSQL + storage), preservando o contrato de cliente atual para não reescrever o ERP.  
Base44 permanece, no máximo, sandbox legado — nunca HML/PROD do repositório principal sem decisão explícita contrária.
