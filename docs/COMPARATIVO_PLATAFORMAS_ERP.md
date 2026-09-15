# COMPARATIVO DE PLATAFORMAS — ERP ZUCCARO

**Tipo:** diagnóstico de decisão de arquitetura (sem migração, sem deploy, sem criação de conta/banco).  
**Data:** 2026-09-15  
**Repositório:** `viniciuszuccaro-creator/ERP-Zuccaro-codeX`  
**Branch:** `cursor/comparativo-plataformas-erp-392b`  
**Base técnica:** `docs/DIAGNOSTICO_RUNTIME_ERP.md` (HYBRID_TRANSITION) + inventário real do código neste clone.  
**Cotação FX usada:** **1 USD ≈ 5,15 BRL** (fonte: open.er-api.com, referência UTC 2026-09-15). Valores em BRL são aproximados.

---

## 0. Premissas obrigatórias (não negociáveis neste lote)

1. **Não** migrar código, **não** remover Base44, **não** criar banco/conta/provider, **não** fazer deploy, **não** alterar Site CPA, **não** iniciar ERP-RUNTIME-01.
2. Preservar **HYBRID_TRANSITION**: UI atual → facade compatível → nova implementação → API/banco real.
3. **Não** reescrever ~900 call sites `base44.entities.*`.
4. Banco principal do ERP = **relacional** (PostgreSQL preferencial).
5. IA = provider **desacoplado** (não decide a plataforma).
6. Alinhar com decisão documental Gate 0 (2026-09-14): destino PostgreSQL/Supabase em SP foi **adiado**, não cancelado — este comparativo **revalida** com as 5 plataformas pedidas.

---

## 1. Revalidação do estado atual (delta curto)

| Item | Evidência no código | Conclusão |
|---|---|---|
| Cliente dual | `src/api/base44Client.js` → local vs SDK | Default GitHub = `localBase44` + localStorage |
| Adapter ativo | `src/api/localBase44Client.js` (~2,5k linhas) | Facade já existe; caminho natural = HttpApiClient |
| Superfície UI | ~900 entities / ~120 invoke / ~110 auth | Migração só via facade/BFF |
| Functions | ~70 pastas em `base44/functions` | Portáveis após extrair domínio |
| Entidades | Snapshot ~134 tipos | Schema Postgres amplo, incremental |
| Postgres próprio | Ausente no repo | Bloqueador de HML/PROD real |
| Site CPA S2S | `legacyIntegrationsMirror` + policies ERP-SITE-01..12 | Desacoplável; precisa host HTTP + DB |
| Gate 0 | `PLANO_GO_LIVE.md` / STATUS | Destino Supabase adiado; não executado |

**Decisão de runtime prévia mantida:** `HYBRID_TRANSITION` — destino fora do Base44.

---

## 2. Requisitos do ERP (peso na escolha)

Multiempresa (`groupId`/`empresaId`), RBAC fail-closed, auditoria antes/depois, CRM, clientes, produtos, preços, estoque, compras, vendas, orçamentos, pedidos, financeiro, fiscal/NF-e, expedição, logística, produção, RH, contratos, documentos, integrações, webhooks, Site CPA S2S, IA desacoplada, jobs/filas, backup, monitoramento.

**Implicação:** priorizar SQL transacional + storage de arquivos + API de domínio própria. Evitar NoSQL/document-first como núcleo.

---

## 3. Escala

134+ entidades hoje; histórico longo; XML/PDF/DANFE/fotos/DWG/DXF; logs/auditoria; múltiplas empresas/usuários.  
Banco precisa crescer além de free tiers (500 MB–20 GB). Storage e egress crescerão com fiscal e documentos.

---

## 4. Banco relacional — filtro duro

| Opção | Adequação ao core ERP |
|---|---|
| **PostgreSQL** (Supabase / Cloud SQL / RDS / self-managed) | **Alta** — joins, constraints, transações, BI, RLS |
| **Oracle Autonomous / Oracle DB** | Alta em capacidade; custo/ops/lock-in piores nesta fase |
| **MySQL HeatWave (OCI)** | Média — possível, mas ecossistema do código não é MySQL |
| **Appwrite TablesDB / Documents** | **Baixa** como núcleo fiscal/financeiro sem SQL bruto |
| **Appwrite “Native PostgreSQL” (anunciado em tiers dedicados)** | Potencial, mas camada Appwrite + maturidade/contratos ainda não são o caminho mais seguro para ERP |
| **Firestore** | **Rejeitado** como banco principal (sem justificativa forte) |

---

# COMPARATIVO POR PLATAFORMA

## 5–6. SUPABASE

### Arquitetura proposta (para ESTE ERP)

```text
Vite/React (Cloudflare Pages / Vercel / Supabase estático via host externo)
    ↓ facade base44 (inalterada na UI)
HttpApiClient / BFF (Edge Functions +/ou Node em Fly/Railway — domínio ERP)
    ├── Auth: Supabase Auth (JWT) mapeado para base44.auth
    ├── Entities: PostgREST + services SQL (group_id, empresa_id + RLS)
    ├── Functions: Edge Functions / BFF routes (port das ~70)
    ├── Storage: Supabase Storage (PDF/XML/fotos) via Core.Upload*
    └── Realtime: opcional (subscriptions) depois do núcleo
PostgreSQL (Supabase) — região São Paulo quando disponível no projeto
Vault/secrets: dashboard secrets + nunca VITE_* para S2S
```

### Substituição sem reescrever 900 call sites

| Superfície hoje | Destino |
|---|---|
| `base44.entities.*` | Facade → HttpApiClient → tabelas Postgres / views |
| `base44.auth.*` | Facade → Supabase Auth session + User/RBAC próprio |
| `base44.functions.invoke` | Facade → Edge Function ou rota BFF com mesmo nome |
| `Core.UploadFile` | Facade → Storage signed upload |
| `subscribe` | Facade → Realtime ou polling temporário |

**BFF compatível:** expor shape próximo de entities/functions/auth (Opção D do diagnóstico).

### Frontend

Pode ficar em **Cloudflare Pages / Vercel / GitHub Pages** (estático Vite). Supabase **não exige** hospedar o front lá. Custo front típico: **USD 0** (free tiers Pages/Vercel) até baixo pago.

### Backend / DB / Auth / Storage

| Peça | Escolha |
|---|---|
| API domínio | BFF próprio + Edge Functions (não acoplar telas ao client Supabase sem facade) |
| Banco | **Postgres Supabase** |
| Auth | Supabase Auth |
| Storage | Supabase Storage |

### Free / preços (consulta 2026-09-15)

Fonte: https://supabase.com/pricing

| Plano | Preço | Notas críticas |
|---|---|---|
| Free | **USD 0** | 500 MB DB, 1 GB storage, 5 GB egress; **pausa após 1 semana inativa**; máx. 2 projetos ativos |
| Pro | **from USD 25/org** | + compute por projeto; crédito USD 10 (cobre 1× Micro USD 10) |
| Micro compute | USD 10/projeto | Incluso via crédito no 1º projeto Pro |
| Backup diário | 7 dias no Pro | PITR add-on **USD 100/mês por 7 dias** |
| Spend cap | **Ligado por padrão** no Pro | Reduz surpresa de fatura |

### Adequação DEV / HML / PROD

| Amb. | Serve? | Comentário |
|---|---|---|
| DEV | Sim (Free ou local Postgres) | Free pausa — OK se aceitar unpause; ideal DEV local + Free remoto opcional |
| HML | Sim com **Pro** (não Free) | Free pausa = ruim para E2E Site |
| PROD pequeno | Sim Pro Micro/Small | Alinhado Gate 0 |
| PROD médio | Sim (upgrade compute/disk) | Monitorar conexões/pooler |

### Notas de score (resumo)

Melhor equilíbrio **SQL + custo + migração via facade + RLS multiempresa + Auth/Storage**. Vendor lock-in médio (Postgres portável; Auth/Storage com custo de troca).

---

## 7–8. ORACLE CLOUD (OCI)

### Arquitetura adequada

```text
Frontend estático (OCI Object Storage + CDN / ou Cloudflare)
API: Compute VM / Container Instances / Functions + API Gateway
DB: Autonomous Transaction Processing (pago) — Always Free só DEV
Object Storage: XML/PDF/docs
Vault + IAM + Monitoring
Filas: Streaming / Functions + Object Storage events (fase 2)
```

MySQL HeatWave Always Free (50 GB) **não** é a escolha preferida do core (Postgres/SQL reportes do ecossistema atual). Oracle ADB é forte, porém muda stack mental (Oracle SQL/ops).

### Oracle Always Free — limites ATUAIS (2026-09-15)

Fonte oficial:  
https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm

| Recurso | Limite Always Free (home region) |
|---|---|
| Compute AMD Micro | até **2×** `VM.Standard.E2.1.Micro` |
| Ampere A1 | **2 OCPU / 12 GB** no total (flex) |
| Block Volume | **200 GB** (+ 5 backups) |
| Object Storage | **20 GB** (cenário Free-only) |
| Autonomous AI Database | **2** instâncias; **1 OCPU**; **20 GB**; **máx. 20 sessões** simultâneas; sem scale |
| MySQL HeatWave | 1 standalone + HeatWave; **50 GB** data/log + 50 GB backup |
| Load Balancer | 1 flex 10 Mbps (tenancies elegíveis) |
| Vault secrets | 150 Always Free |
| Reclaim idle compute | Se 7 dias com CPU/net/mem < 20% (critérios oficiais) → **pode reclaim** |

**Cartão:** Free Tier Oracle tipicamente exige cadastro com cartão no trial; Always Free permanece após trial se conta permanecer válida — **confirmar no fluxo atual de signup** (política Oracle pode variar; marcar risco operacional).

| Amb. | Adequação Always Free |
|---|---|
| DEV | **Boa** (compute + ADB 20 GB) com risco reclaim/capacity |
| HML | **Frágil** (sessões 20, 20 GB, reclaim, out-of-capacity) |
| PROD ERP | **Não adequado** no Always Free; exige **pago** (ADB/Compute) |

### Custo

- DEV Always Free: **USD 0** (com riscos).  
- PROD pago: **UNKNOWN** sem quote ADB shape em `sa-saopaulo-1` no calculador no momento da consulta — tipicamente **maior** que Supabase Pro Micro para o mesmo estágio.  
- Ops: nota alta de complexidade (IAM, VCN, patches, reclaim).

### Frontend / Backend / Auth / Storage

| Peça | OCI |
|---|---|
| Front | Object Storage estático + CDN ou host externo |
| API | Compute / Containers / Functions |
| DB | Autonomous ATP (pago PROD) |
| Auth | IAM + IdP próprio (Cognito-like não nativo app) → **mais trabalho** que Supabase Auth |
| Storage | Object Storage |

### Migração

Facade → BFF em Compute → SQL Oracle ou Postgres self-managed na VM.  
Portar policies S2S: médio. Auth: esforço **maior** (não há Auth BaaS equivalente simples).  
Lock-in Oracle DB: **alto** se escolher Autonomous como núcleo.

---

## 9–10. GOOGLE CLOUD

### Arquitetura

```text
Firebase Hosting (front Vite)  OR  Cloud Storage + Load Balancer
Identity Platform / Firebase Auth  →  mapeado na facade auth
Cloud Run (BFF Node/Deno) — API domínio + S2S gateway
Cloud SQL PostgreSQL (região southamerica-east1 / São Paulo)
Cloud Storage — docs/XML/PDF
Secret Manager
Cloud Tasks + Pub/Sub + Cloud Scheduler — filas/jobs
Cloud Logging / Monitoring
```

**Firestore:** não usar como banco principal.

### Free / preços (consulta 2026-09-15)

Fontes:  
- https://cloud.google.com/free/docs/free-cloud-features  
- https://cloud.google.com/sql/pricing  

| Item | Situação |
|---|---|
| Cloud Run | Always Free com limites (ex.: 2M requests/mês no modo request-based) |
| Cloud Storage free | 5 GB-months **somente regiões US** listadas — **não** cobre SP free |
| Cloud SQL | **Sem** always free permanente; trial **30 dias** “Try Cloud SQL” |
| Preço Cloud SQL SP `db-f1-micro` | **UNKNOWN oficial no calculador desta sessão**; referência terciária histórica ~USD 12/mês — **não usar como contrato** |

### DEV / HML / PROD

| Amb. | Avaliação |
|---|---|
| DEV | Cloud Run free + Cloud SQL trial/local Postgres — **R$ 0 possível** só com DB local |
| HML | Cloud SQL pago + Run — custo contínuo |
| PROD | Maduro, região SP, excelente escala |

### Pontos fortes / fracos para ESTE ERP

- **Forte:** Postgres gerenciado, SP, filas nativas, observabilidade, escala.  
- **Fraco nesta fase:** custo DB desde cedo; complexidade IAM; Auth/Hosting Firebase ok mas **ops > Supabase**.  
- Migração facade: boa (BFF em Cloud Run).

---

## 11–12. AWS

### Arquitetura

```text
S3 + CloudFront (front)
API: ECS/Fargate (BFF) e/ou Lambda + API Gateway
RDS PostgreSQL ou Aurora PostgreSQL
Cognito (auth)
S3 (docs)
SQS + EventBridge (filas)
Secrets Manager
CloudWatch + WAF
```

### Free tier (consulta 2026-09-15)

Fonte: https://aws.amazon.com/free/

- Novo modelo: até **USD 200** em créditos (conta Free plan até 6 meses / créditos); depois pago.  
- “Always Free” em subset de serviços com limites.  
- **RDS permanente free para PROD:** não confiar; histórico de 12 meses free mudou para modelo de créditos — tratar DB PROD como **pago**.

### Complexidade operacional nesta fase

**Nota ops ~9/10** — injustificada para o estágio atual (ainda sem Postgres no repo). Capacidade excelente; time DevOps necessário.

### DEV / HML / PROD

| Amb. | Avaliação |
|---|---|
| DEV | Possível com créditos; depois custo |
| HML | RDS + Fargate/Lambda — custo + ops |
| PROD | Excelente longo prazo; overkill agora |

---

## 13–14. APPWRITE

### Arquitetura

```text
Appwrite Sites (front) + Auth + Storage + Functions + Realtime
Database: TablesDB / Documents  (+ dedicated Native Postgres anunciado em tiers)
```

### Adequação do modelo de dados ao ERP

| Domínio | Adequação Appwrite DB “clássico” |
|---|---|
| CRM / cadastros simples | Média |
| Financeiro / conciliação | **Baixa** sem SQL analítico/transações fortes |
| Fiscal / NF-e / XML ledger | **Baixa** |
| Estoque / produção / locks | **Baixa–média** (risco) |
| Relatórios BI | **Fraca** sem SQL ad-hoc |

Appwrite Pro oferece dedicated DBs incluindo PostgreSQL (pricing page 2026-09-15). Mesmo assim, o caminho natural Appwrite empurra API proprietária — **pior portabilidade** e risco de “marketing vs adequação ERP”.

**Conclusão Appwrite:** bom BaaS para apps; **não** é a melhor base para núcleo ERP fiscal/financeiro deste código. Só faria sentido se o BFF falasse **Postgres puro** e Appwrite fosse só auth/host — hipótese sem vantagem clara vs Supabase.

### Preços (2026-09-15)

Fonte: https://appwrite.io/pricing

| Plano | Preço | Notas |
|---|---|---|
| Free | USD 0 | Pausa 1 semana inatividade; 2 projetos; limites baixos de functions/DB |
| Pro | **from USD 25/projeto** | Crédito USD 10 compute DB; backups 7 dias; budget caps |
| Extra project | USD 15 (Pro) | HML+PROD somam |

---

# CORTES TRANSVERSAIS (15–61)

## 15. Frontend — onde hospedar

| Plataforma | Host front | Precisa Vercel/CF? | Custo típico DEV |
|---|---|---|---|
| Supabase | Externo (Pages/Vercel) | Recomendado | USD 0 |
| OCI | Object Storage / externo | Opcional | USD 0 |
| GCP | Firebase Hosting | Não obrigatório | Free tier / baixo |
| AWS | S3+CloudFront | Não | Baixo + egress |
| Appwrite | Sites | Não | Incluso Free/Pro |

## 16. Backend — onde roda API de domínio

| Plataforma | API |
|---|---|
| Supabase | Edge Functions + BFF Node (recomendado para domínio longo) |
| OCI | Compute / Containers / Functions |
| GCP | Cloud Run |
| AWS | ECS/Fargate / Lambda |
| Appwrite | Appwrite Functions |

## 17. Database

| Plataforma | Banco recomendado para ESTE ERP |
|---|---|
| Supabase | **PostgreSQL Supabase** |
| OCI | Autonomous ATP **pago** (Always Free só DEV) |
| GCP | **Cloud SQL PostgreSQL** (SP) |
| AWS | **RDS/Aurora PostgreSQL** |
| Appwrite | **Evitar TablesDB como core**; se usado, Postgres dedicado — ainda assim plano B fraco |

## 18. Auth — substituir `base44.auth`

| Plataforma | Estratégia |
|---|---|
| Supabase | Supabase Auth + mapeamento sessão na facade + RBAC ERP |
| OCI | IdP próprio / OAuth + JWT no BFF |
| GCP | Identity Platform / Firebase Auth |
| AWS | Cognito |
| Appwrite | Appwrite Auth |

## 19. Storage (PDF, XML, fotos, comprovantes, projetos)

Todos: object storage da plataforma (Supabase Storage / OCI Object / GCS / S3 / Appwrite Storage).  
Certificados fiscais: **secret store**, nunca bucket público.

## 20. Destino das ~70 functions (classificação)

Inventário baseado em pastas reais `base44/functions` (amostra representativa):

| Classe | Exemplos | Destino típico |
|---|---|---|
| **HTTP/API** | `legacyIntegrationsMirror`, `entityGuard`, `upsertConfig`, `verifyTotp`, `portalToken` | Rotas BFF / Edge |
| **WEBHOOK** | `siteCpaPaymentWebhook` (lib), providers pagamento | HTTP + verificação assinatura |
| **BACKGROUND JOB** | `applyOrderStockMovements`, `applyInventoryAdjustments`, `financeLinkLogistica` | Fila + worker |
| **SCHEDULED JOB** | `autoBackup`, `reconcileLogisticaCosts`, scans IA | Scheduler (cron) |
| **EVENT HANDLER** | `onPedidoCreated`, `onEntregaUpdated`, `onNotaFiscalAuthorized`, `onOrcamentoConfirmed` | Triggers DB / bus de eventos |
| **AI** | `iaFinanceAnomalyScan`, `iaChurnAnalyzer`, `oportunidadeScorer`, `productPriceOptimizer` | Worker + LLM externo |
| **MIGRATION/LEGACY** | `migrate*`, `onLegacy*`, `seed*` | Scripts one-off; não runtime PROD |
| **Integração** | `whatsappSend`, `emitirBoleto`, `nfeActions`, `ConsultarCNPJ`, `sendEmailProvider` | Adapters HTTP + secrets |

## 21. Filas

ERP precisará: retry, dead-letter, idempotência (`IntegracaoEvento`).

| Plataforma | Filas |
|---|---|
| Supabase | pg-boss / Queue table + Edge cron; ou worker externo |
| OCI | Streaming / Functions / custom |
| GCP | **Cloud Tasks + Pub/Sub** (forte) |
| AWS | **SQS + EventBridge** (forte) |
| Appwrite | Functions + webhooks (mais limitado) |

## 22. NF-e (somente requisitos)

Emissão/consulta/webhook, XML, DANFE/PDF, certificado A1, SEFAZ/provider (ex. eNotas já referenciado em `_lib/nfeEnotas`).  
Plataforma deve oferecer: storage privado, jobs longos, secrets, logs auditáveis. **Nenhuma plataforma “emite NF” nativamente** — provider fiscal externo.

## 23. Pagamentos

PIX/boleto/cartão + webhook + reconciliação: já há superfícies (`emitirBoleto`, `paymentStatusManager`, Site CPA payment). Precisam HTTP estável + idempotência SQL — independente do cloud vendor.

## 24–25. Site CPA + contratos ERP-SITE-01..12

```text
Site CPA (server)
  → Gateway S2S ERP (HMAC + token)  [hoje: legacyIntegrationsMirror]
  → Services / policies ERP-SITE-01..12
  → Database (Postgres)
```

Esforço portar gateway: **baixo–médio** (HTTP) + **alto** na troca entities→SQL (já no diagnóstico).  
Contratos **preservados**; host muda.

## 26–28. Facade, BFF, migração incremental

**Obrigatório:**

```text
UI → base44Client (facade) → HttpApiClient → BFF → Postgres
```

Sem big bang. Entidade a entidade / módulo a módulo. localBase44 permanece fallback DEV.

## 29. Ordem de migração (ajustada ao código)

1. **Foundation** — projeto cloud, secrets, ambientes, schema migrations  
2. **Auth** — sessão/JWT + User  
3. **Grupo / Empresa / RBAC / AuditLog**  
4. **Cliente / Produto / Preço**  
5. **IntegracaoEvento + S2S health** (Site CPA gateway)  
6. **Orçamento / Pedido**  
7. **Estoque / compras**  
8. **Financeiro**  
9. **Fiscal / NF-e**  
10. **Expedição / logística**  
11. **Produção / RH / contratos**  
12. Storage real + jobs + realtime  
13. Desligar Base44 remoto no principal  

## 30–31. DEV / HML / PROD + isolamento

| Amb. | Regra |
|---|---|
| DEV | Dados sintéticos; pode Free/local |
| HML | **Projeto/DB separado** de PROD; dataset CPA homologação |
| PROD | Isolado; backups; sem misturar HML |

## 32–33. Backup / DR

| Plataforma | Backup | PITR | DR |
|---|---|---|---|
| Supabase | Diário 7d (Pro) | Add-on USD 100/7d | Bom; export Postgres |
| OCI | ADB backups nativos (pago) | Forte no pago | Forte |
| GCP | Cloud SQL backups/PITR | Forte | Forte |
| AWS | RDS snapshots/PITR | Forte | Forte |
| Appwrite | Diário 7d (Pro) | PITR em dedicated (+%) | Médio |

## 34–35. Segurança / LGPD

Todos os hyperscalers têm IAM/encryption/audit maduros.  
Supabase: RLS + Auth excelente para multiempresa no Postgres.  
LGPD: preferir **região Brasil (SP)** para dados pessoais/fiscais; controlar retenção de logs/backups; DPA com o vendor.  
Appwrite: verificar região efetiva dos dados no plano escolhido (**confirmar na conta** — UNKNOWN se SP nativo no Free).

## 36. Região Brasil

| Plataforma | SP / BR |
|---|---|
| Supabase | Projetos em AWS; **São Paulo** tipicamente disponível (confirmar no create project) |
| OCI | Região BR (ex. Vinhedo/SP) — verificar home region no signup |
| GCP | `southamerica-east1` (SP) |
| AWS | `sa-east-1` |
| Appwrite | Confirmar região do plano — **UNKNOWN** sem conta |

## 37–38. Vendor lock-in / portabilidade (notas 0–10; maior = mais lock-in / melhor portabilidade)

| | Lock-in (↑pior) | Portabilidade (↑melhor) |
|---|---|---|
| Supabase | 5 | 7 (Postgres padrão) |
| OCI Oracle DB | 8 | 3 |
| GCP Cloud SQL PG | 4 | 8 |
| AWS RDS PG | 4 | 8 |
| Appwrite | 7 | 3 |

## 39–45. Custos (aprox., 2026-09-15, FX 5,15)

### Premissas de cenário

- **DEV:** poucos acessos; objetivo R$ 0.  
- **HML:** ambiente ativo para testes/E2E.  
- **PROD pequeno:** 10–30 usuários, Site CPA, volume moderado.  
- **PROD médio:** 50–100 usuários, mais empresas/docs.

### Tabela de custo aproximado (USD / BRL)

| Plataforma | DEV | HML | PROD pequeno | PROD médio |
|---|---|---|---|---|
| **Supabase** | **USD 0 / R$ 0** (Free ou local) | **~USD 25 / ~R$ 129** (Pro 1 Micro) | **~USD 35 / ~R$ 180** (Pro + 2 Micro HML+PROD) | **~USD 70–120 / ~R$ 360–620** (Small/Medium + disk) |
| **OCI** | **USD 0** Always Free | **USD 0** Always Free (**risco**) | **UNKNOWN** pago (estim. ≥ USD 50–150 se ADB/Compute pago) | UNKNOWN–alto |
| **GCP** | USD 0 com DB local; Cloud SQL trial 30d | **~USD 20–40 / ~R$ 103–206** (SQL+Run) **parcialmente UNKNOWN** | **~USD 40–80 / ~R$ 206–412** | **~USD 100–250** |
| **AWS** | Créditos temporários → depois pago | **~USD 30–60** | **~USD 50–120** | **~USD 150–400** |
| **Appwrite** | USD 0 Free | **~USD 25 / ~R$ 129** /projeto | **~USD 40 / ~R$ 206** (Pro+extra) | **~USD 60–150** |

### Custo por componente (PROD pequeno — Supabase vencedor)

| Componente | USD/mês aprox. |
|---|---|
| Frontend (Pages/Vercel) | 0 |
| Backend (Edge incluso + BFF mínimo) | 0–15 (se BFF externo) |
| Database Micro×1–2 | incluso no Pro packing |
| Storage | incluso até 100 GB Pro |
| Egress | incluso até 250 GB Pro |
| Auth | incluso (MAU interno baixo) |
| Functions | incluso (2M Pro) |
| Logs | 7d incluso |
| Backup diário | incluso; PITR extra 100 se ligado |

## 46. Free tier — quadro

| | Existe? | Permanente? | Expira? | Pausa? | Cartão? | DEV | HML | PROD |
|---|---|---|---|---|---|---|---|---|
| Supabase Free | Sim | Sim (com limites) | Não o plano | **Sim 1 sem.** | Tipicamente sim p/ Pro | Sim | Não ideal | Não |
| OCI Always Free | Sim | Sim | Não | Reclaim idle | Cadastro/trial | Sim | Frágil | Não |
| GCP | Parcial | Alguns always free | Trial SQL 30d | N/A | Sim p/ billing | Parcial | Pago | Pago |
| AWS | Créditos + always free parcial | Sempre free limitado | Free plan ~6m | N/A | Sim | Parcial | Pago | Pago |
| Appwrite Free | Sim | Sim (limites) | Não | **Sim 1 sem.** | P/ Pro | Sim | Não ideal | Não |

## 47. Surpresa de fatura

| Plataforma | Risco |
|---|---|
| Supabase | **BAIXO** (spend cap default Pro) |
| OCI Free | **MÉDIO** (sair do Always Free sem perceber) |
| GCP | **MÉDIO–ALTO** sem budgets |
| AWS | **ALTO** sem budgets/SCPs |
| Appwrite | **BAIXO–MÉDIO** (caps no Pro) |

## 48. Limite de gasto

- Supabase: spend cap nativo.  
- Appwrite: budget caps.  
- GCP/AWS/OCI: budgets/alerts/quotas — **exigem configuração explícita**.

## 49–53. Ops / migração / tempo / DevOps / manutenção

| | Ops (0–10 ↑difícil) | Migração (0–10 ↑difícil) | Tempo relativo | DevOps | Manutenção mensal |
|---|---|---|---|---|---|
| Supabase | 3 | 5 | MÉDIO | Baixo–médio | Baixa |
| OCI | 8 | 8 | ALTO | Alto | Média–alta |
| GCP | 6 | 6 | MÉDIO–ALTO | Médio–alto | Média |
| AWS | 9 | 7 | ALTO | Alto | Média–alta |
| Appwrite | 4 | 7 (modelo dados) | MÉDIO–ALTO | Baixo | Baixa–média |

## 54–56. Observabilidade / escala / performance BR

Hyperscalers (GCP/AWS/OCI) vencem observabilidade “enterprise”. Supabase suficiente no início (logs 7d Pro; drains pagos). Performance BR: preferir SP em todos.

## 57–60. Transações / concorrência / RLS / SQL

**Peso alto:** Postgres (Supabase/GCP/AWS) > Oracle pago > Appwrite TablesDB.  
RLS multiempresa: **Supabase destaca**.  
SQL relatórios: Postgres/Oracle.

## 61. IA

Desacoplada (OpenAI/Anthropic/etc. via backend). **Não** decide vencedor.

---

# SCORE PONDERADO (62–63)

Pesos (conforme pedido; sem ajuste):

| Critério | Peso |
|---|---|
| Adequação ERP/SQL | 20 |
| Facilidade de migração | 15 |
| Custo inicial | 15 |
| Custo produção | 10 |
| Simplicidade operacional | 10 |
| Segurança | 10 |
| Backup/DR | 5 |
| Escalabilidade | 5 |
| Portabilidade | 5 |
| Site CPA/S2S | 5 |

### Notas parciais (0–peso)

| Critério | Supabase | OCI | GCP | AWS | Appwrite |
|---|---|---|---|---|---|
| ERP/SQL (20) | 18 | 15 | 18 | 18 | 8 |
| Migração (15) | 13 | 7 | 10 | 9 | 6 |
| Custo inicial (15) | 14 | 13 | 8 | 6 | 12 |
| Custo prod (10) | 8 | 6 | 6 | 5 | 7 |
| Ops simples (10) | 9 | 3 | 5 | 2 | 8 |
| Segurança (10) | 8 | 9 | 9 | 9 | 6 |
| Backup/DR (5) | 4 | 4 | 4 | 5 | 3 |
| Escala (5) | 4 | 4 | 5 | 5 | 3 |
| Portabilidade (5) | 4 | 2 | 4 | 4 | 2 |
| Site S2S (5) | 4 | 3 | 4 | 4 | 3 |
| **TOTAL** | **86** | **66** | **73** | **67** | **58** |

### Tabela final

| PLATAFORMA | SCORE | DEV COST | HML COST | PROD COST (pequeno) | MIGRATION | OPS | LOCK-IN | RECOMMENDATION |
|---|---|---|---|---|---|---|---|---|
| **Supabase** | **86** | ~R$ 0 | ~R$ 129 | ~R$ 180 | MÉDIO | Baixa | Médio | **VENCEDOR** |
| Google Cloud | 73 | ~R$ 0* | ~R$ 100–200 | ~R$ 200–400 | MÉDIO–ALTO | Média | Baixo–médio | **Plano B** |
| Oracle OCI | 66 | R$ 0 Free | R$ 0 risco | UNKNOWN pago | ALTO | Alta | Alto (ADB) | DEV barato / PROD só se Oracle estratégico |
| AWS | 67 | créditos | médio+ | médio+ | ALTO | Muito alta | Baixo–médio | Fase futura / escala |
| Appwrite | 58 | R$ 0 | ~R$ 129 | ~R$ 206 | ALTO (dados) | Baixa | Alto | Não para core ERP |

\*GCP DEV R$ 0 pressupõe Postgres local; Cloud SQL contínuo não é free.

---

## 64. Arquitetura SUPABASE (vencedora)

```text
[Browser Vite/React]
        |  base44 facade (entities/auth/functions/integrations)
        v
[HttpApiClient]
        v
[BFF Node/Deno] ---- Edge Functions (webhooks curtos)
   |        |
   |        +--> Supabase Auth
   |        +--> Supabase Storage
   |        +--> (opcional) Realtime
   v
[PostgreSQL Supabase]  RLS: group_id + empresa_id
   |
[pg-boss / cron] --> workers NF-e, boleto, WhatsApp, IA
   |
Site CPA --HMAC--> /s2s (policy ERP-SITE-01..12) --> SQL
```

Front: Cloudflare Pages ou Vercel.  
Secrets: apenas server-side.

---

## 65. Arquitetura ORACLE

```text
Front estático → API Gateway → Compute/Containers (BFF)
                              → Autonomous ATP (pago PROD)
                              → Object Storage + Vault
Site CPA → API Gateway → mesmo BFF
```

Always Free = laboratório, não HML oficial estável.

---

## 66. Arquitetura GOOGLE

```text
Firebase Hosting → Cloud Run (BFF) → Cloud SQL PostgreSQL (SP)
                                  → GCS + Secret Manager
                                  → Tasks/PubSub/Scheduler
Site CPA → Cloud Run /s2s
```

---

## 67. Arquitetura AWS

```text
CloudFront/S3 → Fargate/Lambda → RDS/Aurora PostgreSQL
                              → S3 + Cognito + SQS + Secrets + WAF
Site CPA → API Gateway/ALB → BFF
```

---

## 68. Arquitetura APPWRITE

```text
Sites + Auth + Functions + Storage + TablesDB
```

**Não recomendada** como núcleo transacional deste ERP sem Postgres externo dedicado e BFF SQL — hipótese sem vantagem vs Supabase.

---

## 69. TOP 3

1. **Supabase** (Postgres + Auth + Storage + facade) — score 86  
2. **Google Cloud** (Cloud Run + Cloud SQL PG SP) — score 73  
3. **AWS** (RDS PG + Fargate) — score 67 *(capacidade; ops alta)*  

*(OCI Close 4º por Always Free atrativo em DEV, mas PROD/migração piores para este código.)*

---

## 70. VENCEDOR

# **SUPABASE (PostgreSQL + Auth + Storage) + BFF/facade própria**

Não “depende”: esta é a arquitetura recomendada para o ERP Zuccaro **neste momento**.

---

## 71. Plano B

**Google Cloud: Cloud Run + Cloud SQL PostgreSQL (`southamerica-east1`) + Cloud Storage + Identity Platform**, mantendo a mesma facade/BFF.  
Acionar se: necessidade forte de IAM enterprise, filas nativas, ou limitação regional/comercial do Supabase.

---

## 72. Por que o vencedor é melhor para ESTE ERP

1. Já há **facade** (`base44Client` / `localBase44Client`) — encaixa HttpApiClient.  
2. **Postgres + RLS** atendem multiempresa/RBAC/auditoria/SQL fiscal-financeiro.  
3. Auth/Storage/Functions no mesmo vendor **reduzem peças** na fase inicial.  
4. Custo DEV ~0 e PROD pequeno **previsível** (spend cap).  
5. Região BR / latência alinhada ao Gate 0.  
6. Site CPA S2S porta para HTTP + SQL sem reescrever policies.  
7. Consistente com decisão documental Gate 0 (destino Supabase adiado, não invalidado).

---

## 73. O que perdemos com o vencedor

- Observabilidade “enterprise” inferior a GCP/AWS no Day 0.  
- Filas nativas menos maduras (precisa pg-boss/worker).  
- PITR caro (USD 100/7d) se ligado cedo.  
- Free pausa — HML/PROD **não** podem ficar no Free.  
- Algum lock-in em Auth/Storage/Realtime (mitigado por Postgres dump).  
- Edge Functions: limites de duração para jobs longos de NF-e → BFF/worker separado.

---

## 74. Custo de troca futura

| Camada | Dificuldade de sair |
|---|---|
| Postgres schema | **Baixa** (dump/restore → Cloud SQL/RDS) |
| Auth Supabase | Média (migração usuários/senhas/JWT) |
| Storage | Média (copy objetos + URLs) |
| Edge Functions | Baixa se lógica estiver no BFF/domain |

**Conclusão:** custo de saída **aceitável** se a regra “domínio no BFF, não nas telas Supabase” for mantida.

---

## 75–76. Plano de migração (somente plano — NÃO executar)

1. Congelar decisão humana: **Supabase = destino runtime**.  
2. ERP-RUNTIME-01 (abaixo) — foundation sem dados reais.  
3. HttpApiClient atrás do facade; dual-write/read se necessário.  
4. Portar Auth + Grupo/Empresa.  
5. Cadastros mestres.  
6. Gateway S2S + IntegracaoEvento.  
7. Comercial → estoque → financeiro → fiscal.  
8. HML isolado → E2E Site (PROVISIONAMENTO-HML / GO-LIVE Opção B).  
9. PROD com backup testado.  
10. Base44 cópia = sandbox referência; não apagar.

---

## 77. ERP-RUNTIME-01 (definição futura — não iniciar agora)

**Objetivo:** criar a **fundação** do runtime oficial no Supabase **sem** migrar módulos de negócio nem dados reais.

Escopo sugerido:

1. Conta/org Supabase sob titularidade da empresa (ação humana).  
2. Projeto **DEV** (SP) — sem HML/PROD ainda se política exigir.  
3. Schema mínimo: `groups`, `empresas`, `users`, `audit_logs`, `integracao_eventos`.  
4. RLS fail-closed esboço.  
5. Spike facade: 2–3 entities via HttpApiClient.  
6. Health S2S read-only contra schema mínimo.  
7. Documentar secrets (não commit).  
8. Critérios de aceite abaixo.

**Fora de escopo RUNTIME-01:** import ERP antigo, NF-e real, Site CPA produção, remoção Base44, merge destrutivo.

---

## 78. Critério de aceite RUNTIME-01

- [ ] Projeto Supabase DEV existe sob conta da empresa.  
- [ ] Migrations versionadas no repo (SQL).  
- [ ] Facade consegue `auth` + CRUD de **uma** entidade mestre em Postgres.  
- [ ] localBase44 ainda funciona como fallback.  
- [ ] Nenhum segredo no Git.  
- [ ] Testes de contrato S2S health (synthetic) passam apontando para BFF DEV **ou** documentam BLOCKED com motivo.  
- [ ] STATUS atualizado; sem dados reais importados.

---

## 79. Quando retomar HML / Site

Só **depois** de ERP-RUNTIME-01 aceito + DB HML separado provisionado:

1. Retomar **PROVISIONAMENTO-HML-01** (Fases 2+) **sobre Supabase/BFF**, não Base44.  
2. Depois **GO-LIVE-HML-01 Opção B** (E2E externo Site CPA) com `ERP_BASE_URL` do HML novo.  
3. Dataset sintético CPA Homologação (já preparado na Opção A).

---

## 80. Papel da cópia Base44

- **Sandbox / referência temporária.**  
- **Não** HML oficial.  
- **Não** apagar.  
- Drift esperado; GitHub permanece fonte da verdade.

---

## 81–84. Fontes de preço / limites (consulta 2026-09-15)

| Fonte | URL | O que extraiu |
|---|---|---|
| Supabase Pricing | https://supabase.com/pricing | Free/Pro/Team; compute; spend cap; backups; PITR USD 100 |
| OCI Always Free | https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm | Compute A1 2 OCPU/12GB; ADB 20GB / **20 sessões**; reclaim idle; Object 20GB |
| GCP Free | https://cloud.google.com/free/docs/free-cloud-features | Cloud Run free; Cloud SQL trial 30d; GCS free só US |
| GCP Cloud SQL pricing | https://cloud.google.com/sql/pricing | Modelo pago (valores SP = **UNKNOWN** sem calculadora regional nesta sessão) |
| AWS Free | https://aws.amazon.com/free/ | Créditos até USD 200; Free plan ~6 meses |
| Appwrite Pricing | https://appwrite.io/pricing | Free pausa; Pro from USD 25/projeto; dedicated DB tiers |
| FX | https://open.er-api.com/v6/latest/USD | USD/BRL ≈ **5,146** → usado **5,15** |

**UNKNOWN (não inventado):** preço exato Cloud SQL `db-f1-micro` em `southamerica-east1`; preço Autonomous pago OCI SP; região física Appwrite Free; se cartão é obrigatório no Always Free OCI no fluxo atual de signup.

**Marketing vs adequação:** Appwrite “Native PostgreSQL” e OCI Always Free ADB são recursos reais, mas **não** adequados sozinhos como PROD ERP deste repositório sem BFF+capacidade paga.

---

## 85–87. Git / Codex

- Branch dedicada: `cursor/comparativo-plataformas-erp-392b`.  
- Somente documentação neste lote.  
- `git fetch origin main` em 2026-09-15: main em `3a51b62b` (GO-LIVE-HML Opção A); **sem sobreposição de código** com este doc.  
- Diagnóstico runtime permanece em branch/PR separada — referenciado, não reescrito aqui.  
- **Não** mergear main neste lote.

---

## 88. Relatório executivo

1. **Vencedor:** Supabase + BFF/facade  
2. **Score:** 86/100  
3. **Custo DEV:** ~USD 0 / ~R$ 0  
4. **Custo HML:** ~USD 25 / ~R$ 129  
5. **Custo PROD pequeno:** ~USD 35 / ~R$ 180 (HML+PROD na mesma org Pro)  
6. **Plano B:** GCP Cloud Run + Cloud SQL PostgreSQL SP  
7. **Motivo:** melhor fit ao código (facade + Postgres/RLS + custo + migração incremental)  
8. **Risco principal:** Free pause / subestimar necessidade de BFF+workers para NF-e/jobs  
9. **Próximo lote:** **ERP-RUNTIME-01** (somente após aprovação humana explícita)  
10. **Branch:** `cursor/comparativo-plataformas-erp-392b` (hash no commit deste lote)

---

## 89. PARADA

Este documento **encerra** a análise.  
**Não** iniciar ERP-RUNTIME-01.  
**Não** migrar banco.  
**Não** remover Base44.  
**Não** configurar HML.  
**Não** alterar Site CPA.
