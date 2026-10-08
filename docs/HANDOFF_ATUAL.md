## CODEX Comercial — follow-up #226/#203 (2026-10-07T20:50Z)

Agente: [Comercial Cadastros Empresas](bc-55d5261f-d7a1-5e68-9b15-bd09a65ecb6a)

| Item | Estado |
|---|---|
| #226 ⊇ #227/#228/#229 | **SIM** · visual≡save Organizacional · merge `6dfd39d2` |
| #203 outbox | **MERGED** `2403586e` (tip `91675712`) · CI SUCCESS |
| #227/#228/#229 | **arquivar** (conteúdo em #226); close negado à integration — HUMAN close |
| Main | `2403586e` (#231+#226+#225+#233+#234+#203) |
| Deploy erp-dev | ainda BLOCKED VPS MCP |

## LEGADO — follow-up verifier (2026-10-07T20:50Z)

Agente: [Legado evidência ERP novo](bc-4427c136-a373-5bb6-83b8-ffa135fdb2d9)

| Campo | Valor |
|---|---|
| Estado | **BLOCKED** — execução real não avançou |
| Checksum | **UNVERIFIED** (`FOUND_EXPORT=NONE`) |
| Tentativa Cloud | `executar-verifier-host-local.sh` exit 4 `LEGACY_HOST_REPORTS_DIR_NOT_FOUND` |
| Host com backup | PC proprietário `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS` (não este Cloud) |
| Workers | 0 · sem `usePrivateWorker` |
| Contagens reais | **0** processadas |
| Sintético (≠ efetivo) | staging 8→4/1/1/2 · vínculos 3/4 |
| PR | [#211](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/211) tip remoto `66f0520f` |

**HUMAN_NEXT (único bloqueio):** no PC com o HD → `bash scripts/legado/executar-verifier-host-local.sh` → colar saída sanitizada · ou `cursor worker start` nesse PC.

Dados reais / credenciais: fora do GitHub.

## TRÊS PACOTES — integrado em main (2026-10-07T20:45Z)

Chat: [ERP ZUCCARO - CODEX/CURSOR](bc-d973626e-1060-4071-a25a-6a549769392b)
Main tip: `e2c51d84` (#231 + #226 + #225).

| Fase | #231 snapshots | #226 Cadastros | #225 Financeiro | Legado | erp-dev |
|---|---|---|---|---|---|
| implementado | sim | sim | sim | scripts/verifier | — |
| revisado | sim | sim | parcial (fluxo real local) | UNVERIFIED cloud | — |
| integrado | **MERGED** `c0efab11` | **MERGED** `6dfd39d2` | **MERGED** `e2c51d84` | — | código em main |
| implantado | **não** | **não** | **não** | não | **BLOCKED** VPS MCP timeout; workers 0; sem SSH neste Cloud |
| validado VPS | **não** — assets ainda HTTP 200 (~13.8MB / ~1.0MB) | **não** | **não** | N/A | RUNTIME-08B pré-promoção |
| dados reais | — | — | — | **0** (BLOCKED host HD) | — |

**Pendência concreta de implantar:** Hostinger VPS MCP `vps_virtual-machines_list` timeout (−32001); self-hosted workers = 0; sem chave SSH no ambiente Cloud. Autorização válida ≠ conexão efetiva.

**Arquivar (não mergear):** #227, #228, #229. Lote indep. Comercial: #203. Auth local #230 ≠ Auth VPS.

| Frente | Responsável | Próxima ação |
|---|---|---|
| CODEX Comercial | [bc-55d5261f](bc-55d5261f-d7a1-5e68-9b15-bd09a65ecb6a) | #203 outbox; confirmar arquive 227/8/9 |
| CURSOR | este chat | desbloquear VPS (MCP/SSH/worker) → backup → build/promover main `e2c51d84` → validar CPA/3Z + financeiro + snapshots 404 |
| CODEX Legado | [bc-4427c136](bc-4427c136-a373-5bb6-83b8-ffa135fdb2d9) | **BLOCKED** exit4 HD ausente; HUMAN_NEXT no PC com D: |

## TRÊS PACOTES ATÉ CONCLUSÃO — atualização (2026-10-07T20:40Z)

Chat: [ERP ZUCCARO - CODEX/CURSOR](bc-d973626e-1060-4071-a25a-6a549769392b)

| Frente | Responsável | 1ª ação | Estado |
|---|---|---|---|
| CODEX Comercial | [Comercial Cadastros Empresas](bc-55d5261f-d7a1-5e68-9b15-bd09a65ecb6a) | #226⊇#227/8/9 + #203 | **#226 MERGED** `6dfd39d2`; arquivar 227/8/9; #203 indep. |
| CURSOR | este chat | merge #231→#226→#225; deploy; validar erp-dev | **#231+#226 em main**; #225 rebase; deploy **BLOCKED** VPS MCP timeout |
| CODEX Legado | [Legado evidência ERP novo](bc-4427c136-a373-5bb6-83b8-ffa135fdb2d9) | executor PC com HD | workers 0; HD não no Cloud |

### Fases

| Fase | #231 | #226 | #225 | Legado | erp-dev |
|---|---|---|---|---|---|
| implementado | sim | sim | sim | scripts | — |
| revisado | sim | sim | parcial | UNVERIFIED | — |
| integrado | **sim** | **sim** | tip | — | parcial |
| implantado | não | não | não | não | MCP timeout |
| validado VPS | não | não | não | N/A | snapshots ainda 200 |
| dados reais | — | — | — | pendente host | — |

## CODEX — candidata #226 ⊇ #227/#228/#229 (2026-10-07)

Matriz: `docs/MATRIZ_226_CONTEM_227_228_229.md`. **#226 MERGED**. PRs a arquivar: #227, #228, #229.

## CURSOR — Financeiro #225 (2026-10-07)

- Rebase sobre main (#231+#226). Launchpad grant plano + fluxo ContaReceber A/B.
- Próximo: merge #225 → deploy → validar CPA/3Z e financeiro na VPS.

## CURSOR — 3 frentes + Financeiro launchpad (2026-10-06)

| Frente | Responsável | Arquivos quentes | Não tocar |
|---|---|---|---|
| Cadastros/Empresas | Comercial #226 **MERGED** | — | — |
| Legado | [Legado](bc-4427c136-a373-5bb6-83b8-ffa135fdb2d9) | verifier HD | CADESP |
| Financeiro | Cursor #225 | Financeiro.jsx, financeiroLaunchpadAccess.js | Cadastros tip |

## Checkpoint Onda 15 - limpeza outbox na troca de Empresa (2026-10-06)
- Branch `cursor/comercial360-onda15-outbox-claim-392b`: `ProdutoRelationsDamSection` zera variantes/equivalentes/mídia/métricas/dead-letter quando `empresaId`/produto/view faltam — fail-closed entre tenants.
- Teste estrutural em `tests/produto-pim-ui.test.js`. Sem publisher externo.
- Coordenação pacotes paralelos: Comercial = candidata/#219/#221 + ledger; Legado = export/CADESP/staging; Cursor = revisão #221 + outbox/DAM nesta branch. Não editar router/STATUS da candidata daqui.

## Checkpoint Onda 15 - PG concorrencia + consumidor prepared (2026-10-04)
- Branch `cursor/comercial360-onda15-outbox-claim-392b`: alem de claim/lease/projecao, E2E PG cobre claim concorrente, lease/executor antigo, retry→DL, isolamento A/A2/B e rollback; consumidor prepared fail-closed para external.
- Meta `outboxConsumerPrepared`. Env: `ERP_OUTBOX_CONSUMER_MODE` / fake outcome / channel flags (sem segredo).
- Divisao Cursor vs Comercial: ver secao de coordenacao na branch #202 (`docs/HANDOFF_ATUAL.md`); Comercial nao edita midia/outbox deste pacote.
- Bloqueado: publisher real, cron VPS, Auth, tip-port.

## Checkpoint Onda 15 - claim/lease + projecao allowlisted (2026-10-02)
- Branch `cursor/comercial360-onda15-outbox-claim-392b`: claim/confirm/fail/reprocess/discard/list/metrics + UI prepared; projecao allowlisted no emit e no FakeCatalogPublisher (rejeita custo/margem/ncm/URL).
- Rotas: GET outbox (+produtoId) + outbox/metrics; POST claim/process/confirm/fail/reprocess/discard.
- Bloqueado externo: publisher real, Storage/Auth/VPS, reconciliacao de canal.

## Resposta Codex ao contrato Cursor do canario - PR #34 secao 4 (2026-09-24)
- Fonte: PR #33 branch codex/comercial-360 em bfdfe834; PR #34 branch cursor/vps-hml-gate-c-legado-392b em e40a8a61. Main ainda ca417160. O Gate C foi marcado aprovado pelo Cursor com evidencias sanitizadas; isso NAO autoriza D/E/F, migration ou Auth novo.
- 1. EXPECTED_RUNTIME=ERP-RUNTIME-08B. `server/src/api/router.ts` fixa esse valor em `/api/v1/meta`. O default `COMERCIAL-360-V1` de `scripts/deploy/comercial360-canary.sh` esta incorreto para este candidato; antes do Gate D passar EXPECTED_RUNTIME explicitamente e ajustar o default em checkpoint validado. Revalidar meta na imagem da MAIN, nao confiar em branch.
- 2. `auth.mode=supabase_user` e requisito de aceitaçao, nao fato do DEV. `server/src/config/env.ts` permite configurar ERP_AUTH_MODE=supabase_user e exige SUPABASE_URL+SUPABASE_ANON_KEY; producao usa este modo por padrao e rejeita dev_headers. `requestContext.ts` valida Bearer no Supabase Auth e resolve `profiles.auth_user_id` ativo e escopado. O canario deve iniciar com configuracao local segura e o smoke deve verificar `/meta` + requisiçao autenticada real. Nao exibir env, token ou chave.
- 3. Gate E: aplicar somente migrations faltantes 016-024 da MAIN ja revisada, em ordem numerica pelo migrator canonico, numa janela autorizada com backup NOVO e rollback preparado. Dividir o controle em 016-017 (Orcamento/Pedido) e 018-024 (Produto/PIM/DAM/canais), conferindo contagens e invariantes apos cada fatia; falha interrompe e bloqueia Gate D. Nao usar API de todo o Comercial 360 sobre esquema parcial; `test:postgres` real (>0, 0 fail/skip) ao final, sem reaplicar 001-015. Nenhuma fatia esta autorizada ou aplicada agora.
- 4. Tag futura `erp-zuccaro-erp-api:comercial360-main-<MERGE_SHA8>` construida somente do SHA efetivamente mesclado na MAIN. Registrar MERGE_SHA, image ID/digest obtidos do build/inspect e prova do canario usando a mesma imagem; nao reutilizar SHA da branch. Digest/tag finais INDETERMINADOS ate merge e build; nao alegar imagem imutavel existente.
- 5. `auth.users=0` e dois profiles ativos sem `auth_user_id` tornam smoke Bearer impossivel hoje. Em gate Auth separado e autorizado, provisionar identidade de teste exclusivamente sintética no Supabase Auth self-hosted, vincular seu UUID a profile ERP sintetico ativo no Grupo/Empresa sinteticos autorizados, com permissoes minimas Orcamento/Pedido. Validar scope positivo e RBAC/tenant negativos. Token, senha, email e chaves somente no ambiente seguro; nenhum valor no Git/log/handoff. Depois revogar sessao/desabilitar identidade de teste conforme procedimento auditavel. Nao reutilizar automaticamente os dois profiles existentes sem provar que sao sinteticos.
- Coordenacao: Cursor revisa este contrato e as verificacoes Gate D/E na PR #34; Codex revisa requisitos da PR #33. Ordem sugerida: fechar/revisar PR #34 documental-operacional primeiro; revisar PR #33 e seu default de runtime; so entao decidir merges por revisao humana e atualizar SHA da MAIN. PR #33 segue draft, sem merge; 3080 continua R07B.
- Frente independente Cliente 360 esta somente no workspace local, sem push e sem CI deste codigo; testes focados passaram, suite completa e build local sofreram OOM. Nao apresentar o endpoint como disponivel no remoto ou na VPS.

## Contrato Cursor/deploy - preco por ClienteEmpresa (2026-09-24)
- API read-only: GET /api/v1/tabelas-preco/preco-cliente?clienteEmpresaId=<uuid>&produtoId=<uuid>&unidadeMedidaId=<uuid>&businessDate=YYYY-MM-DD. Resposta {data: ResolvedPrice|null}; 422 para query/campo invalido, 403 para RBAC negado/ator ausente, 404 seguro para vinculo ClienteEmpresa fora do tenant. Nao enviar tabelaPrecoId, groupId ou empresaId na query; estes ultimos vem do contexto autenticado.
- Backend: TabelaPrecoService consulta ClienteRepository.getEmpresaLinkById no mesmo Grupo/Empresa e usa tabela_preco_id configurada no vinculo, com fallback para tabela padrao autorizada. Produto especifico de outra Empresa nao resolve; mestre compartilhado do Grupo pode resolver. RBAC exige Cadastros.tabela_preco.visualizar e Cadastros.cliente_empresa.visualizar.
- Nenhuma migration ou variavel nova. Frontend HTTP de TabelaPreco permanece nao ativado como piloto; nao ligar na 3080 R07B. Orcamento/Pedido e seus snapshots de itens nao foram alterados. Futuro consumo exige preco efetivo no servidor, regra comercial de alçada/desconto e teste de nao retroatividade antes de habilitar a captura em vendas.
- PR #33 continua draft. Migrations 023/024 somente codigo/CI; gate DEV real segue separado da CI efemera. Nenhuma aplicacao de migration, seed, Auth novo, canario ou promocao neste checkpoint.

## Contrato Cursor/deploy - resolucao de preco (2026-09-24)
- Onda 2: TabelaPrecoService.resolvePrice permanece contrato interno, sem rota nova, flag HTTP, migration ou configuracao. Requer contexto autenticado groupId/empresaId, TenantGuard e RBAC Cadastros.tabela_preco.visualizar; input estrito aceita produtoId, unidadeMedidaId, businessDate opcional YYYY-MM-DD real e clienteEmpresaTabelaId opcional. Nunca aceitar tenant/ator do payload.
- Repositories PostgreSQL e in-memory resolvem somente Produto ativo do Grupo, compartilhado (empresa_id NULL) ou proprietario da Empresa em contexto, e Unidade ativa do Grupo. Tabela e item continuam sujeitos a vinculo empresarial, vigencia e estado. ID de tabela especifica nao deve ser exposto como escolha livre ao frontend antes de validar o vinculo ClienteEmpresa.
- Orcamento/Pedido nao foram alterados. Ao integrar, escolher tabela autorizada pelo ClienteEmpresa/canal, calcular no servidor e persistir snapshot imutavel do preco por item; nao recalcular vendas historicas a partir da tabela atual. Requer teste tenant A/B, fallback, vigencia, concorrencia e RBAC antes de habilitar HTTP.
- Migrations 023/024 estao somente no codigo/CI; nenhuma aplicada na VPS. Gate C ainda exige restauracao isolada, backup novo e precheck de porta/canario. Preservar API 3080 R07B e PR #33 draft.

## Contrato Cursor/deploy - Produto por canal (2026-09-24)
- PR #33 segue draft, branch codex/comercial-360. A migration aditiva 024_produto_canais_rascunho.sql e o CRUD canonico de Produto/canais estao no codigo/CI; nao aplicar na VPS sem gate aprovado, novo backup, teste de restauracao e precheck da porta isolada. A migration 023 tambem nao foi aplicada na VPS.
- API: GET/POST /api/v1/produtos/:id/canais, PATCH/DELETE /api/v1/produtos/:id/canais/:canalId. POST aceita somente canal, sku?, nome?, descricao?; PATCH aceita somente subconjunto nao vazio de sku, nome, descricao. Canal exige slug minusculo; status permanece RASCUNHO. DELETE e inativacao logica. Respostas 201/200, erros 400/403/404/409.
- Contratos: escopo vem exclusivamente do contexto autenticado Grupo/Empresa; Produto deve estar ativo e pertencer a Empresa, RBAC Cadastros.produto.visualizar/editar, auditoria na mesma transacao. Nao enviar groupId, empresaId, actorId, status ou preco no body. SKU e unico por Grupo/Empresa/canal, inclusive soft-deleted. CRUD nao aciona catalogo, outbox de publicacao, preco, estoque, fiscal ou integracao externa.
- Configuracao: nenhuma variavel nova. Produto HTTP continua opt-in/desligado na 3080; sem Auth real homologado, nao ativar VITE_ERP_HTTP_PRODUTO nem associar IDs legados. StoragePort/scanner/publicacao permanecem gates separados.
- Testes: service/in-memory, HTTP e PostgreSQL sintetico na suite existente. CI do novo HEAD deve confirmar backend/frontend e E2E PostgreSQL sem fail/skip antes de handoff operacional.
- Proximo deploy autorizado deve inventariar migrations reais, aplicar somente faltantes da MAIN aprovada, validar RLS/FORCE e smoke autenticado no canario isolado; 3080 so muda em gate de promocao explicito.

## Checkpoint vigente - Comercial 360 / Gate C (2026-09-23)
- Branch `codex/comercial-360`, PR #33 draft e sem merge; ultimo HEAD funcional antes deste checkpoint documental `c3df0c3ca0f95a4c27e21de7b91cb002fb154f53`. CI `35919084889` frontend/backend SUCCESS, incluindo PostgreSQL efemero. A CI nao homologa o DEV real.
- Migrations 001-022 existem no repositorio/CI; a evidencia agregada fornecida pelo usuario da VPS mostrou somente 001-015 aplicadas uma vez. Nao executar 016-022, seed, Auth novo, scanner, Produto HTTP ou canario sem gate especifico.
- API oficial 3080 permanece R07B/`dev_headers` conforme capturas fornecidas; backup SQL de 21/09 tem tamanho, hash e marcador de dump completo, mas nao teve restauracao comprovada. Imagem/container de rollback R07B preservados; 3086 estava livre no momento da consulta, sem autorizar implantacao.
- Gate C PARCIAL: comparar em leitura somente a conexao efetiva da API com uma conexao direta ao `supabase-db` por identidade do servidor/migrations, sem imprimir URL ou credenciais; confirmar restaurabilidade e backup atualizado no gate autorizado. Comparar apenas IP nao e prova suficiente.
- Orientacoes R08 abaixo sao historicas. Nao usar a secao antiga "Passo historico R08B" como ordem de execucao atual. Preservar PR draft, main e 3080 ate gate separado.
## Checkpoint vigente - Gate C, evidencia Web Console (2026-09-24)
- Captura do usuario mostrou `conexao_api_vs_supabase_db=MATCH` ao comparar `current_database()` e identificador do cluster PostgreSQL da API e do `supabase-db`. A divergencia anterior de IP era inconclusiva e nao deve ser usada para negar este resultado.
- Backup SQL de 21/09: 486969 bytes, SHA-256 calculado, marcador de dump completo; restaurabilidade ainda nao testada. Rollback R07B: container preservado/exited e imagem presente. Porta 3086 livre no instante da consulta; 3080 preservada.
- PR #33 permanece draft e sem merge. HEAD anterior `38bb311709673e87fd00c00e9a81d0c660c0bf6b`, CI `35985748032` SUCCESS; migrations 001-024 no codigo/CI, somente 001-015 evidenciadas na VPS. Gate C nao autoriza canario/migration: falta restauracao isolada, backup novo pre-implantacao e precheck imediatamente antes do uso. Auth novo, scanner real e Produto HTTP nao homologados.
- As secoes de 23/09 abaixo sao historicas e nao substituem este checkpoint.

## Gate C - precheck Web Console adicional (2026-09-23)
- Backup SQL de 21/09/2026 encontrado com 486969 bytes, SHA-256 calculado e marcador de dump completo; restauracao nao testada e backup atualizado ainda pendente para o gate autorizado.
- API oficial `erp-api-dev` running na imagem R07B; container de rollback R07B exited e imagem preservada. Porta 3086 sem listener nem container ativo no instante da consulta; 3080 preservada.
- Gate C segue parcial ate comparacao read-only da conexao efetiva da API com `supabase-db`. Nao iniciar canario, Auth novo, migration ou promocao com base apenas nesse precheck.

## Gate C - Web Console complementar (2026-09-23)
- Evidencia fornecida pelo usuario: API oficial 3080 na imagem R07B, health/ready 200; Auth/DB healthy; API e DB na rede `supabase_default`. Conexao da API reportou banco `postgres` e 15 migrations.
- Comparacao de IP retornou `api_usa_supabase_db=NO`; resultado e inconclusivo para identidade fisica por possivel proxy/IPv6/traducao. Nao declarar banco divergente nem Gate C aprovado ate comparar conexao efetiva e conexao direta ao DB.
- Backups de 20/09 e containers antigos de rollback aparecem preservados, sem verificacao de integridade/restaurabilidade. Porta 3086 nao apareceu em `ss` entre os filtros; 3080 segue oficial. Nao houve escrita VPS ou ativacao.

## Gate C prioritario - checkpoint de 2026-09-23
- PR #33 draft/mergeable no HEAD `750a4ab14854e184d6fb2fc8afef7f6e2094b277`; CI `35910005796` frontend/backend e PostgreSQL efemero SUCCESS. A CI do commit funcional `52167840` (`35909747751`) tambem passou.
- Evidencia VPS nao avancou nesta sessao: Web Console falhou antes de abrir (`helper_unknown_error: apply deny-read ACLs`) e nao ha ferramenta VPS interna disponivel. Banco efetivo da API, rede, backup e rollback continuam sem precheck atual; nao inferir Gate C aprovado.
- O bloco unico de leitura sanitizada foi entregue ao usuario. Nao executar Auth, scanner, Produto HTTP, migration ou promocao na 3080 ate gates separados.

## Gate C DEV - evidencia SQL agregada (2026-09-23)
- Web Console informada pelo usuario: `schema_migrations` possui `id`/`applied_at`; 001-015 cada 1x, 016-022 ausentes nas 15 linhas. `auth.users=0`, `profiles=2`, `groups=2`, `empresas=3`; ambos os perfis ativos estao sem Auth. Sem vinculos de grupo/empresa invalidos nas contagens.
- Nome do banco da API e `current_database()` nao visiveis na captura; identidade do banco da API ainda pendente. Gate C nao aprovado para Auth/canario: API oficial 3080 permanece 07B/`dev_headers`.
- Nenhuma escrita VPS realizada. Continuar somente leitura para banco/rede/backup/rollback; identidade sintetica e perfil requerem gate autorizado separado.

## Gate DEV parcial - 2026-09-23
- Web Console, conforme evidencia informada pelo usuario: API oficial `erp-api-dev` em 3080, imagem `runtime07b-main-ca0bc5f3`; health/ready 200; meta `ERP-RUNTIME-07B`, `auth.mode=dev_headers`.
- MCP Hostinger confirmou VPS `srv1982741` running e Supabase Auth/DB/Storage healthy. Nao ha evidencia SQL de migrations nem dos vinculos de profiles nesta sessao.
- Gate C ainda nao aprovado. PR #33 segue draft; codigo Auth novo nao foi implantado/homologado. Nenhuma acao de escrita na VPS, 3080 preservada.
- Consultas agregadas e gates condicionais constam em `COMERCIAL_360_V1_DEPLOY.md`.


## Checkpoint Comercial 360 - 2026-09-23 (PR #33 draft)
- Branch `codex/comercial-360`; referencia comprovada antes deste checkpoint: `865e23d29ed72d6b00180fc52a4bde572f85c864`; CI `35873286965` verde com PostgreSQL efemero. A `main` e a VPS nao foram alteradas aqui.
- Migrations 001-021 existem no repositorio. Orcamento/Pedido iniciais e Produto/PIM/DAM/Auth estao preparados em codigo; Produto HTTP desligado e midias em QUARENTENA. Nenhuma aplicacao real das migrations 016-021 foi comprovada.
- Gate C DEV ainda sem auditoria VPS verificavel nesta sessao: MCP Hostinger nao expos ferramentas VPS e Web Console falhou antes de abrir. Nao assumir estado atual da API 3080, Auth, PostgreSQL ou buckets a partir do historico abaixo.
- Proximo gate: auditoria somente leitura via Web Console/Hostinger VPS, saida sanitizada; depois homologacao controlada de Auth/perfis. Sem SSH, migration, seed, restart, bucket, ClamAV na VPS, promocao ou merge neste checkpoint.

# ERP ZUCCARO — Handoff atual

## Atualizacao Comercial 360 V1 - 2026-09-21

- Branch de trabalho: `codex/comercial-360`; PR aberta: `#33`; nao mesclada.
- Checkpoint funcional do frontend: `0040e994a8d4c3c3cdd417cc9502fa332c6b3567`; preparação de deploy validada: `3c96bb677aef9c5498842005a6a4a2dd3bc36de3`.
- CI final comprovada antes do fechamento documental: workflow PR `35667460162`, frontend/backend `SUCCESS`; migrate, seed sintetico e PostgreSQL E2E passaram.
- Orçamento e Pedido usam backend HTTP canonico, tenant Grupo/Empresa, RBAC fail-closed e auditoria transacional. Migrations novas 016/017 foram validadas somente no PostgreSQL efemero da CI.
- Preparacao de deploy: `COMERCIAL_360_V1_DEPLOY.md` e `scripts/deploy/comercial360-{canary,smoke,rollback}.sh`. Os scripts nao foram executados; rollback e dry-run por padrao.
- VPS permanece intocada por esta versao: API oficial 3080, migrations aplicadas, imagens, containers e backups continuam no estado operacional descrito abaixo. Proximo gate exige merge e autorizacao VPS separados.
Atualizado em 2026-09-20 após o diagnóstico definitivo do gate do ERP-RUNTIME-08.

## Referências

- Repositório: `viniciuszuccaro-creator/ERP-Zuccaro-codeX`.
- SHA funcional 07B: `ca0bc5f3529b9071fe80e58dae6aa966a9d6c740`.
- Um commit documental posterior, quando existir, deve ser registrado separado
  desse SHA funcional.

## DEV

- VPS: `/opt/erp-zuccaro`.
- API oficial 3080: `ERP-RUNTIME-07B`.
- Imagem: `erp-zuccaro-erp-api:runtime07b-main-ca0bc5f3`.
- PostgreSQL: migrations 001–015 aplicadas exatamente uma vez. As migrations 014 e
  015 são imutáveis e não devem ser reaplicadas manualmente.
- `013_tabelas_preco.sql` permanece aplicada uma vez.

O pós-promoção 07B foi aprovado. A API oficial, banco e VPS não são alterados
por esta documentação.

## Último runtime e agregados canônicos

O ERP-RUNTIME-07B está fechado. Os agregados relevantes são Produto, Cliente,
ClienteEmpresa, ClienteLocal, Obra, TabelaPreco, TabelaPrecoEmpresa e
TabelaPrecoItem.

TabelaPreco tem origem por Empresa, autorização N:N, padrão por Empresa e
referência específica nullable em ClienteEmpresa. A resolução é específica,
depois padrão, depois sem preço. Itens usam Produto + Unidade, valores
`NUMERIC(18,6)`, vigência no cabeçalho, soft delete, RLS, RBAC e auditoria.

## Frontend e rollback

`TabelaPreco.frontendHttp=false`; esse cutover não ocorreu.

Os rollbacks 06B e 06A estão preservados e não devem ser apagados.

## Diagnóstico do gate R08

As constraint triggers reais da 015 estão `DEFERRABLE INITIALLY DEFERRED` e a
barreira rejeita, no `COMMIT`, condição ativa sem parcelas, total de 99%, remoção
da única parcela e reativação sem parcelas. Os testes locais também comprovam o
rollback após cada falha.

O gate que registrou `INVALID_INSERT_EXIT=0` usava `docker exec` sem `-i`. Sem
stdin interativo, o heredoc do Bash não é encaminhado ao `psql`; o processo pode
encerrar com sucesso sem executar o `BEGIN`/`INSERT`/`COMMIT`. A causa é, portanto,
o harness, não aceitação persistida da condição inválida. Com `ON_ERROR_STOP=1`,
um erro SQL em execução não interativa precisa resultar em status não zero.

## Hotfix de metadata R08B

O container temporário do R08B iniciou normalmente. O gate aguardava
`ERP-RUNTIME-08B`, mas `/api/v1/meta` respondia literalmente
`ERP-RUNTIME-07B`; o timeout do gate provocou o cleanup com `SIGTERM`. Não
houve crash nem OOM. O hotfix da branch altera somente a identidade de metadata
para `ERP-RUNTIME-08B` e declara `CondicaoPagamento` como preparado no backend,
mantendo `frontendHttp=false` e fora do piloto HTTP.

## Diagnóstico RBAC e E2E R08B

O `403` do smoke de Condição de Pagamento é causado por seed RBAC incompleto,
não por falha do canário: o actor usado no gate,
`a4a4a4a4-aaaa-4aaa-8aaa-a4a4a4a4a4a4`, pertence ao Grupo A e pode operar as
Empresas A/A2, mas não possuía `Cadastros.condicao_pagamento.visualizar`.
LIST e GET exigem essa mesma ação; as demais ações são `criar`, `editar`,
`inativar`, `restaurar`, `vincular-empresa`, `gerenciar-parcelas` e
`definir-padrao`. O seed idempotente foi corrigido somente para os dois actors
sintéticos A/B, com essas ações explícitas e sem wildcard.

A imagem runtime contém somente artefatos de produção, portanto `npm test`
dentro dela encontrar zero testes é esperado e não prova E2E. O mecanismo
canônico do próximo gate é `npm run test:postgres` no worktree exato do PR,
com dependências de teste efêmeras e `DATABASE_URL` fornecida apenas no
ambiente do gate. O runner falha sem `DATABASE_URL` ou se executar zero testes.

O primeiro E2E PostgreSQL real executou um teste e chegou ao banco. LIST/GET
autorizados passaram, e RBAC/cross-group permaneceram bloqueados. A falha
`SQLSTATE 23514` veio exclusivamente do payload de teste: ele enviava
`E2E-...` para `codigo`, enquanto a constraint exige seis dígitos. A constraint
funcionou corretamente. O hotfix reserva, dentro da transação rollbackável, um
código numérico livre entre `900000` e `999999`; API e schema já eram coerentes.

## Passo historico R08B (nao executar como proximo gate)

Registro de 20/09, superado pelo checkpoint vigente acima. No Gate VPS autorizado, repetir somente o E2E PostgreSQL real e concluir o
canário. O seed RBAC já foi aplicado e não deve ser reaplicado por este hotfix;
não reaplicar migrations. A API oficial 3080 continua R07B. Não
criar migration 016, não promover a API R08 e não fazer merge neste gate.

## CODEX — contencao dos snapshots publicos (2026-10-07)

- O proprietario autorizou retirar da versao atual os dois snapshots reais do ERP novo servidos por `public/` e preparar a limpeza do historico. O repositorio e publico; remover arquivos na HEAD nao elimina blobs de commits anteriores, caches, clones nem artefatos ja implantados.
- Branch `codex/remove-public-erp-snapshots`, baseada na main atual: remove os dois assets reais, desliga hidratacao automatica por URL publica, exige arquivo privado escolhido pelo usuario para recuperar somente em localhost e adiciona guardas contra reintroducao. Copias originais privadas foram preservadas fora desta worktree.
- A limpeza do historico NAO foi executada: inventariar refs/PRs afetados, congelar pushes, preparar copia recuperavel e janela coordenada; reescrita/force-push exigem decisao operacional separada antes de executar. Nao publicar dados, IDs, hashes ou credenciais no PR.
- Implantacao na VPS tambem e separada: antes de trocar imagem/build, conferir gates, backup, rollback e eliminar assets antigos da distribuicao/CDN. Nao presumir que merge remove arquivos ja servidos.
- Runbook separado: `docs/LIMPEZA_HISTORICA_SNAPSHOTS_PUBLICOS.md`. CI tip SUCCESS. Coordenacao Cadastros #226 tip `7bfd3f93` (port #229 completo).
## Segurança e legado local - inventário verificado (2026-10-08)

- #231 foi mesclada e a CI do HEAD `4ca140f` passou. A `main` não contém os dois snapshots na árvore atual; deploy e limpeza histórica continuam separados.
- Após `git fetch origin --prune`, 237/249 refs remotas conhecidas ainda tinham ambos os snapshots no tip (86 `codex/`, 151 `cursor/`). Sem tags locais; forks, refs internas de PR, caches e builds não estão cobertos. Runbook existente: `docs/LIMPEZA_HISTORICA_SNAPSHOTS_PUBLICOS.md`. Nenhum rewrite, delete ou force-push foi feito.
- Bundle de pré-reescrita preservado fora do GitHub no diretório privado do proprietário (~19 MB); verificação de história completa e clone bare independente com 268 refs passaram. Checksum completo permanece somente no manifesto privado. Esta cópia não é autorização para executar rewrite.
- Novo fetch/consulta pública de PRs: 237/251 refs remotas conhecidas e 176/178 PRs abertas ainda têm o snapshot no tip; 2 PRs não têm. O bundle anterior é checkpoint, não backup final da janela. Coordenar preservação de revisões e branches antes de qualquer rewrite.
- Espelho fresco enumerou 663 refs: 237/250 branches e 400/413 refs internas de PR com os caminhos no tip. Ensaio de rewrite em dois clones privados falhou no `git fast-import` (`OSError: [Errno 22] Invalid argument`); nenhum push/rewrite remoto. Bundles privados verificados intactos; resolver o erro e coordenar GitHub para refs internas antes da janela. Ver runbook existente.
- Ensaio posterior em **novo** espelho privado do GitHub passou com configuracao NTFS limitada ao processo: 250 branches + 413 refs de PR preservadas; zero caminhos sensiveis alcancaveis; `git fsck --full --no-reflogs --strict` passou. O espelho nao foi enviado. Tres refs auxiliares de arvore existem apenas no bundle local e nao no espelho remoto. CI da #236 no SHA `655d1f0e` verde. Rewrite remoto, caches/refs internas, deploy e importacao permanecem bloqueados por gates distintos; detalhes no runbook.
- Neste executor **local Windows**, `D:\BACKUP ERP ANTIGO - CODEX` está acessível em leitura. Isto não altera o bloqueio do executor Cloud sem HD descrito abaixo. Os CSVs reais derivados foram lidos sem expor registros: clientes 22.895 = 18.458 candidatos + 4.437 quarentena; fornecedores 1.061 = 790 + 271; produtos 1.222 = 1.208 + 14. Os hashes dos 3 CSVs candidatos conferem com seus resumos privados.
- Preflight privado novo dos 20.456 candidatos (18.458 clientes, 790 fornecedores, 1.208 produtos): zero grupos de codigo legado ou fingerprint duplicados, zero codigo/Grupo ausente, zero Empresa preenchida e zero `import_authorized=true`. Os CSVs usam um unico `group_id`, mas ele nao coincide literalmente com nenhum ID de Grupo no export atual da API; o mapa privado aprovado cobre o identificador dos CSVs, nao estabelece sozinho o crosswalk para o Grupo atual. Relatorio com hashes permanece em `04_REPORTS`, fora do GitHub. Nao houve carga em banco isolado nem operacional; linhagem MDF->CSV e vinculo ao Grupo atual ainda requerem prova.
- Integridade fisica adicional: os 18 MDF/LDF da copia de trabalho (~17,38 GiB) foram re-hashados em leitura; 18/18 conferem com o manifesto da copia e 18/18 entradas coincidem por caminho/hash com o manifesto de origem. Relatorio e digests somente em `04_REPORTS`. Isto prova a copia, **nao** a linhagem do extrator ate os CSVs, nem autoriza carga.
- Carga **real em SQLite privado isolado** dos tres CSVs candidatos concluiu sob `03_STAGING/LEGADO-CANDIDATOS-20261008T111456Z`: 20.456 linhas (18.458 clientes, 790 fornecedores, 1.208 produtos), zero chave duplicada, um Grupo **de origem**, zero Grupo/Empresa de destino atribuidos, zero autorizacao de importacao, `PRAGMA integrity_check=ok` em segunda leitura. Hashes, JSONL e banco ficam apenas no staging privado; ACL sem heranca e sem ACE publica. Nao confundir este staging com carga no PostgreSQL operacional. Crosswalk do Grupo atual e linhagem MDF->extrator->CSV continuam pendentes; nenhum registro foi promovido.
- Segunda copia isolada do SQLite preserva a primeira e adiciona ledger de 129.206 referencias legadas de clientes (7 campos por candidato), todas `UNCLASSIFIED` e sem ID de destino, com FK composta valida. O mapa privado de condicao de pagamento tem 26 codigos/textos e cobre exatamente 2.217 clientes, mas zero ID de destino: isto **nao** resolve a dependencia. Perfil de 1.208 produtos encontrou 8 divergencias entre unidade de origem e principal; unidade medida coincide com a principal, sem conversao de quantidade/saldo. Reabertura independente: zero FK violada, `integrity_check=ok`. Manifesto privado novo; nenhuma carga operacional.
- Proposta **nao aplicada** de crosswalk do Grupo ficou apenas no staging privado: hash do alias aprovado corresponde ao Grupo de origem dos tres CSVs; as duas Empresas operacionais comprovadas compartilham um Grupo atual existente, com rotulo identico ao alias, enquanto a terceira Empresa esta em outro Grupo. O conjunto fortalece uma proposta para mestres compartilhados, mas nao atribui propriedade de Pedido/titulo nem substitui revisao/gate. Nenhum `target_group_id` foi gravado nos 20.456 registros. Fila privada dos 8 produtos com unidade divergente pronta para revisao, sem conversao ou saldo.
- Terceira copia SQLite privada separou as 129.206 posicoes de referencia de clientes: 52.144 ausentes por convencao legada (`0` ou vazio), 77.062 com codigo presente e mapa de destino pendente. A view nao altera a classificacao original, nao preenche IDs e nao autoriza importacao. A copia anterior conserva o hash do manifesto; nova copia passou `integrity_check` e FK sem violacoes. Condicao de pagamento tem 2.217 referencias presentes com mapa textual anterior, ainda sem ID canonico de destino.
- Quarentena real carregada **separadamente** em SQLite privado: 4.722 linhas (4.437 clientes, 271 fornecedores, 14 produtos), todas com motivo e payload de origem preservados, nenhum ID de destino/flag de importacao. Confronto por entidade+Grupo de origem+codigo legado: zero chaves duplicadas na quarentena e zero sobreposicoes com os 20.456 candidatos. Totais por fonte reconciliados: 22.895/1.061/1.222. Hashes dos tres CSVs, JSONL e SQLite conferidos em leitura independente com manifesto privado; integridade SQLite OK. Nenhum banco operacional tocado; origem MDF->CSV continua sem linhagem comprovada.
- Auditoria privada dos **25.178 registros**: candidatos com documento CPF/CNPJ valido pelo tipo e digito (18.458 clientes, 790 fornecedores); na quarentena de clientes, 4.410 falhas de formato e 4 de digito, restando 23 com documento valido mas outro bloqueio; fornecedores, 215 falhas de formato e 13 de digito, restando 43 ainda bloqueados. Duplicidades por documento/Grupo reproduzidas com HMAC efemero descartado: clientes 8 grupos/24 linhas, fornecedores 10/25, sem cruzamento candidato-quarentena. Produtos: 8 divergencias de unidade entre candidatos e 14 unidades ausentes na quarentena. Todos os 25.178 mantem `import_authorized=false`; nenhum documento, HMAC ou registro real no GitHub. Relatorio privado v2 preserva a versao inicial corrigida. Proxima dependencia: comprovar a linhagem MDF->CSV, revisar crosswalk do Grupo e resolver referencias canônicas antes de selecionar piloto.
- Matriz privada de dependencias: 77.062 referencias presentes sem destino, em 100 pares tipo/codigo; **18.458/18.458 clientes candidatos** possuem ao menos uma referencia pendente, logo zero cliente atende ao gate estrito de piloto neste momento. A matriz nao prova que todo campo seja obrigatorio no destino; essa decisao depende do contrato canonico e de snapshot atual dos mestres. A instancia SQL legada local `MSSQL$ERPZLEGACY` esta `Stopped`/`Manual`; tentativa de `Start-Service` com acesso disponivel falhou por nao poder abrir o servico, e ele permaneceu parado. Nao houve consulta direta ao MDF neste lote. Intervencao tecnica para reproduzir a origem: iniciar a instancia em sessao Windows administrativa autorizada, confirmar bancos `READ_ONLY` e encerrar o servico apos as consultas; nao usar esta falha para presumir linhagem.
- Revisao privada acionavel da quarentena: 66 cadastros com CPF/CNPJ valido continuam bloqueados (23 clientes: 22 duplicados no legado, 1 ja existente no ERP atual; 43 fornecedores: 27 por website/e-mail, 16 por duplicidade). Fila JSONL guarda apenas entidade, linha/codigo de origem e motivo, sem documento; hash e contagem foram verificados independentemente. Outra fila privada preserva as 14 linhas de produto sem unidade mapeada, complementar a homologacao existente por cinco siglas e a fila anterior dos 8 candidatos com unidades divergentes; nenhuma unidade, quantidade ou ID de destino foi inferido. Os contratos de extracao cliente/fornecedor e resumos de produto nao registram versao do gerador nem hash da consulta; o status historico informa que geradores temporarios foram removidos. Reproducao MDF->CSV exige consulta controlada da copia `READ_ONLY` e registro novo da cadeia, nao manifesto retroativo.
- Ensaio **novo e isolado** de reingestao dos 25.178 registros privados (candidatos+quarentena): primeira carga 25.178/25.178; retry identico 0 insercoes/25.178 identidades verificadas; payload diferente sob a mesma chave rejeitado sem sobrescrita; falha injetada apos uma insercao sintetica reverteu a transacao integral. Reabertura independente: 25.178 linhas, `integrity_check=ok`, hash do SQLite igual ao manifesto privado v2, zero IDs de destino/flag de importacao. A prova vale apenas para o loader SQLite de staging, nao para PostgreSQL ou importacao operacional. SQL LocalDB nao esta instalado; a instancia legada do SQL Server exige sessao Windows administrativa para reproduzir a origem.
- A instancia SQL da copia de trabalho foi iniciada com permissao administrativa; `LEGACY_TID_EXETPS` e `LEGACY_TID_EMP03` estavam `ONLINE`/`READ_ONLY`. Duas consultas agregadas deram os mesmos totais: `Clientes` 22.895, `Fornecedores` 1.061 e `CadastroMateriais` de revenda 1.222, iguais a candidatos + quarentena. O servico `MSSQL$ERPZLEGACY` voltou a `Stopped`/`Manual`. Esta prova e de populacao agregada, nao de classificacao linha a linha, versao do extrator ou linhagem MDF->CSV; sem carga operacional.
- Confronto adicional em memoria, com bancos `READ_ONLY`: o conjunto completo de codigos legados das tres tabelas SQL coincide com candidatos + quarentena dos CSVs (25.178 chaves unicas; zero SQL-only, CSV-only ou duplicatas). Para os 1.222 produtos de revenda, `UNIDADE` da origem coincide com `unidade_origem` por codigo em 1.222/1.222; nenhuma conversao de unidade ou saldo foi feita. Nenhuma chave bruta foi publicada. Isto reforca completude de chaves e um campo de produto, mas nao prova os demais payloads, regra de classificacao ou versao do extrator. Servico SQL confirmado novamente `Stopped`/`Manual`; importacao segue bloqueada.
- Paridade documental por chave, ainda em memoria e sem exportar valores: nas 23.956 linhas de clientes/fornecedores (19.248 candidatas + 4.708 em quarentena), exatamente um CPF/CNPJ preenchido em cada CSV coincide com o campo correspondente da copia SQL apos retirar pontuacao; zero divergencias e zero chaves ausentes. Por coorte: clientes 18.458/4.437 e fornecedores 790/271 conferidos. Isto nao valida suficiencia fiscal, propriedade de Empresa, demais campos do payload ou autenticidade retroativa do extrator; registros em quarentena permanecem bloqueados. Instancia SQL voltou a `Stopped`/`Manual`.
- Paridade adicional por codigo na copia SQL `READ_ONLY`: tipo e status das 25.178 linhas conferem com os CSVs candidatos + quarentena, usando somente os mapeamentos explicitados (`F/J` para tipo de pessoa; `Potencial` para `Prospect`; `Revenda` para produto). Razao social de fornecedores (1.061) e descricao de produtos (1.222) conferiram por hash Unicode apos trim. Em clientes, 116/22.895 hashes SQL-trim versus CSV-trim diferiram; comparacao do texto Unicode em memoria mostrou apenas variacao de espacos (108 apos trim completo; 8 absorvidas pelo trim), e 22.895/22.895 equivalentes apos normalizar sequencias de espacos. Nenhum nome ou documento saiu no resultado. SQL voltou a `Stopped`/`Manual`. A regra de particionamento candidato/quarentena, demais campos e versao do extrator ainda nao foram reproduzidos; sem importacao.
- Predicados de quarentena reproduzidos em memoria sem expor valores: CPF/CNPJ dos 19.248 candidatos validos; 4.414 clientes e 228 fornecedores da quarentena invalidos, com zero divergencia frente aos respectivos motivos. Documentos repetidos por Grupo nos CSVs: clientes 8 grupos/24 linhas, fornecedores 10/25; todas essas linhas marcadas como duplicadas e nenhuma candidata duplicada. Dos clientes restantes, uma linha depende da evidencia contextual `DOCUMENTO_JA_EXISTE_ERP_ATUAL`, nao revalidada aqui. Na fonte SQL `READ_ONLY`, `HOMEPAGE` dos fornecedores gerou 42 URLs invalidas no preflight independente de URI absoluta http/https e `EMAIL` 5 formatos basicos invalidos, coincidindo com os motivos e sem falso positivo/negativo; esse preflight nao substitui o validador historico. Produtos: as 14 linhas em quarentena usam precisamente as cinco siglas pendentes de homologacao, com contagens por sigla iguais ao mapa privado e nenhum candidato usando essas siglas. Sobreposicoes de motivos foram preservadas; SQL devolvido a `Stopped`/`Manual`. Isto reforca os gates deterministicos conhecidos, mas nao comprova versao/hash do extrator, todo payload ou autorizacao operacional.
- O guard adicional contra backup ERP renomeado em `public/*.json` esta implementado **somente localmente** e passou 5 testes focados, audit, lint e build. Nao foi commitado: typecheck global acusa erros em outros arquivos e a suite raiz falha em testes de infraestrutura fora do guard. Preservar a alteracao local sem declará-la publicada; corrigir/triagem desses baselines antes de entrega de codigo.
- A integridade CSV-versus-resumo e o re-hash da copia MDF/LDF nao comprovam a cadeia de extracao MDF->CSV: ainda faltam arquivo-fonte verificavel por lote, versao do extrator e hash da consulta. Nenhuma linha candidata estava marcada `import_authorized=true`; houve apenas staging SQLite privado, sem carga operacional ou liberacao de importacao.
