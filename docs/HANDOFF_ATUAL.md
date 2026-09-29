## LOTE CURSOR — tenant cache fail-closed (pós-#145) (2026-09-29T18:30Z)

| Campo | Valor |
|---|---|
| Choice | **C** tenant switch limpa form/list cache comercial fail-closed |
| Branch | `cursor/comercial360-onda3-tenant-cache-392b` |
| Base | `#145` tip `73279042` (`cursor/comercial360-onda3-list-search-392b`) |
| Tip | `c484194d` (`c484194df2ea9c3a115dcbc5ad11383114086962`) |
| Draft PR | **#146** — https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/146 |
| Abrir PR | https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/compare/cursor/comercial360-onda3-list-search-392b...cursor/comercial360-onda3-tenant-cache-392b?expand=1 |
| Meta | `tenantCacheFailClosed` + **Pedido backend HTTP is active** |
| Colisão | A/B fracos; margem #47; anexos/PDF #52–#62; stack #126–#145 |

---

## LOTE CURSOR — list search/filter fail-closed (pós-#144) (2026-09-29T18:20Z)

| Campo | Valor |
|---|---|
| Choice | **A** list search/filter: empty busca ≠ erro; queryKey tenant+filters; sanitize na policy |
| Branch | `cursor/comercial360-onda3-list-search-392b` |
| Base | `#144` tip `01ee61de` (`cursor/comercial360-onda3-simular-dirty-392b`) |
| Tip | `dbe72104` (`dbe7210426534a2f6571b2a1dfaf25d68d712648`) |
| Draft PR | BLOCKED createPullRequest — compare: https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/compare/cursor/comercial360-onda3-simular-dirty-392b...cursor/comercial360-onda3-list-search-392b?expand=1 |
| Abrir PR | https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/compare/cursor/comercial360-onda3-simular-dirty-392b...cursor/comercial360-onda3-list-search-392b?expand=1 |
| Meta | `listSearchFilterFailClosed` + **Pedido backend HTTP is active** |
| Colisão | #136 base; dirty #144; margem #47; anexos/PDF #52–#62 |

---

## LOTE CURSOR — simular-venda dirty-state fail-closed (pós-#143) (2026-09-29T18:05Z)

| Campo | Valor |
|---|---|
| Choice | **A** dirty-state simular-venda: limpa preview + exige re-simular antes de salvar |
| Branch | `cursor/comercial360-onda3-simular-dirty-392b` |
| Base | `#143` tip `4777b4fb` (`cursor/comercial360-onda3-delivery-address-392b`) |
| Tip | `9d5235bf` feat / docs tip `1eee761b` |
| Draft PR | **#144** — https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/144 createPullRequest — compare: https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/compare/cursor/comercial360-onda3-delivery-address-392b...cursor/comercial360-onda3-simular-dirty-392b?expand=1 |
| Abrir PR | https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/compare/cursor/comercial360-onda3-delivery-address-392b...cursor/comercial360-onda3-simular-dirty-392b?expand=1 |
| Meta | `simulacaoDirtyFailClosed` + **Pedido backend HTTP is active** |
| Colisão | B/C já no stack; margem #47; anexos/PDF #52–#62 |

---

## LOTE CURSOR — delivery Local/Obra address summary fail-closed (pós-#142) (2026-09-29T17:55Z)

| Campo | Valor |
|---|---|
| Choice | **B** resumo endereço Local/Obra pós-seleção; fail-closed se HTTP get falhar |
| Branch | `cursor/comercial360-onda3-delivery-address-392b` |
| Base | `#142` tip `d7871c23` (`cursor/comercial360-onda3-parcela-schedule-ui-392b`) |
| Tip | `d65d9618` feat / docs tip `207c26cc`+ |
| Draft PR | BLOCKED createPullRequest — compare: https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/compare/cursor/comercial360-onda3-parcela-schedule-ui-392b...cursor/comercial360-onda3-delivery-address-392b?expand=1 |
| Abrir PR | https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/compare/cursor/comercial360-onda3-parcela-schedule-ui-392b...cursor/comercial360-onda3-delivery-address-392b?expand=1 |
| Meta | `deliveryAddressSummaryFailClosed` + **Pedido backend HTTP is active** |
| Colisão | A/C já cobertos no stack; margem #47; anexos/PDF #52–#62 |

---

## LOTE CURSOR — parcela schedule preview fail-closed (pós-#140) (2026-09-29T17:45Z)

| Campo | Valor |
|---|---|
| Choice | **A** agenda parcelas read-only pós simular/condição; fail-closed se ausente |
| Branch | `cursor/comercial360-onda3-parcela-schedule-ui-392b` |
| Base | `#140` tip `f5009c7c` (`cursor/comercial360-onda3-masters-banner-392b`) |
| Tip | `ad927286f533379abd7c7aa5abe70a2ac4354193` |
| Draft PR | BLOCKED createPullRequest — compare: https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/compare/cursor/comercial360-onda3-masters-banner-392b...cursor/comercial360-onda3-parcela-schedule-ui-392b?expand=1 |
| Abrir PR | https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/compare/cursor/comercial360-onda3-masters-banner-392b...cursor/comercial360-onda3-parcela-schedule-ui-392b?expand=1 |
| Meta | `parcelaSchedulePreviewFailClosed` + **Pedido backend HTTP is active** |
| Colisão | Convert UX já #133/#134; margem #47; anexos/PDF #52–#62 |

---

## LOTE CURSOR — snapshot reload pós-save (pós-#138) (2026-09-29T17:25Z)

| Campo | Valor |
|---|---|
| Choice | **B** reload after save prova snapshots condição/promo/tabela |
| Branch | `cursor/comercial360-onda3-snapshot-reload-392b` |
| Base | `#138` tip `90a76433` (`cursor/comercial360-onda3-alcada-ui-failclosed-392b`) |
| Tip | `953ca272e365dbd22aff22d823065c67425e9b67` (feat `0acbec43`) |
| Draft PR | BLOCKED createPullRequest — compare: https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/compare/cursor/comercial360-onda3-alcada-ui-failclosed-392b...cursor/comercial360-onda3-snapshot-reload-392b?expand=1 |
| Meta | note preserva **Pedido backend HTTP is active** |
| Colisão | Margem UI adiada (#47 OPEN); anexos/PDF #52–#62 |

---

## LOTE CURSOR — tip alçada UI fail-closed (pós-#136) (2026-09-29T17:16Z)

| Campo | Valor |
|---|---|
| Tip | `dcde4ceff12c9e027d57a282b27d5b571c7f07c7` |
| Branch | `cursor/comercial360-onda3-alcada-ui-failclosed-392b` |
| Base | `#136` tip `2db1a38d` |
| Draft PR | **#138** — https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/138 — compare: https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/compare/cursor/comercial360-onda3-list-failclosed-392b...cursor/comercial360-onda3-alcada-ui-failclosed-392b?expand=1 |
| Escopo | Desconto alçada UI fail-closed + save idempotency; sem migration |
| Meta | note preserva **Pedido backend HTTP is active** |
| Colisão | Anexos/PDF #52–#62 — não duplicar |

---

## LOTE CURSOR — tip list-failclosed (draft PR #136) (2026-09-29T17:06Z)

| Campo | Valor |
|---|---|
| Tip | `3880793b` (`3880793be2e741e2320fd25469d3c59ce3b7063f`) |
| Branch | `cursor/comercial360-onda3-list-failclosed-392b` |
| Base | `#135` `5b559c9a` (`cursor/comercial360-onda3-pedido-cancel-392b`) |
| Draft PR | **#136** — https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/136 — ManagePullRequest indisponível; `gh pr create` → `Resource not accessible by integration (createPullRequest)` |
| Abrir PR | https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/compare/cursor/comercial360-onda3-pedido-cancel-392b...cursor/comercial360-onda3-list-failclosed-392b?expand=1 |
| Meta | note preserva **Pedido backend HTTP is active** |
| Push | `origin/cursor/comercial360-onda3-list-failclosed-392b` |

---

> CI fix 2026-09-29T17:18Z: `sanitizeObservacoesText` sem regex C0 (eslint `no-control-regex`).

## OPINIÃO CURSOR — #135 tip + list fail-closed A+C (pós-#135) (2026-09-29T17:05Z)

| PR | Tip / Branch | CI | Escopo |
| --- | --- | --- | --- |
| #134 | `fa362ff0` | **SUCCESS** | Convert snapshots fail-closed |
| #135 | `5b559c9a` | pendente | Pedido cancel fail-closed |
| este | `cursor/comercial360-onda3-list-failclosed-392b` | pendente | List HTTP fail-closed + update CANCELADO |

Próximo após este: Onda 4 slice **sem** 025–028. Sem merge/VPS. Sem Codex/#104/#48.

---

## LOTE CURSOR — Pedido cancel fail-closed symmetry (pós-#134) (2026-09-29T17:05Z)

| Campo | Valor |
|---|---|
| Choice | **Pedido cancel** — simetria fail-closed com Orçamento cancel |
| Branch | `cursor/comercial360-onda3-pedido-cancel-392b` |
| Base | `#134` tip `fa362ff0` (`cursor/comercial360-onda3-convert-snapshot-392b`) |
| Escopo | sem migration; RBAC+estado+audit; UI disable; meta `cancelByState`; note preserva `Pedido backend HTTP is active` |
| Testes | 09 security/http/service 13/13 + 08c 12/12 + convert/preco 13/13 + UI 15/15 + typecheck PASS |
| Tip | `c2bfb17c` (feat) |
| Draft PR | **#135** — https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/135 — ManagePullRequest indisponível; `gh pr create` → `Resource not accessible by integration (createPullRequest)` |
| Abrir PR | https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/compare/cursor/comercial360-onda3-convert-snapshot-392b...cursor/comercial360-onda3-pedido-cancel-392b?expand=1 |
| Integração | draft; sem merge/VPS; sem Codex/#104/#48 |
| Próximo | Onda 4 sem colisão 025–028 **ou** list empty-state HTTP Pedido |

---

## LOTE CURSOR — Convert snapshot harden residual (pós-#133) (2026-09-29T16:45Z)

| Campo | Valor |
|---|---|
| Choice | **A residual** — convert Orçamento→Pedido copy/verify ALL snapshots fail-closed pós-031 |
| Branch | `cursor/comercial360-onda3-convert-snapshot-392b` |
| Base | `#133` tip `70576db7` (`cursor/comercial360-onda3-orc-validade-392b`) |
| Escopo | sem migration; policy convert; UI hint; meta `convertSnapshotFailClosed`; note preserva `Pedido backend HTTP is active`; validade #133 intacta |
| Testes | convert-snapshot 8/8 + regressões 60/60 + UI 11/11 + 07b 13/13; typecheck PASS |
| Tip | `01521a92` (feat) |
| Draft PR | **#134** — https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/134 — ManagePullRequest indisponível; `gh pr create` → `Resource not accessible by integration (createPullRequest)` |
| Abrir PR | https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/compare/cursor/comercial360-onda3-orc-validade-392b...cursor/comercial360-onda3-convert-snapshot-392b?expand=1 |
| Integração | draft; sem merge/VPS; sem Codex/#104/#48 |
| Próximo | Onda 4 sem colisão 025–028 **ou** Pedido cancel fail-closed / list empty-state HTTP |

---

## LOTE CURSOR — Validade Orçamento fail-closed (pós-#131) (2026-09-29T16:50Z)

| Campo | Valor |
|---|---|
| Choice | **B** — validade_em fail-closed create/update/convert |
| Branch | `cursor/comercial360-onda3-orc-validade-392b` |
| Base | `#131` tip `1682f686` (`cursor/comercial360-onda3-tabela-snapshot-392b`) |
| Escopo | sem migration; policy + UI hint; meta `validadeFailClosed`; note preserva `Pedido backend HTTP is active` |
| Testes | validade 8/8 + UI 10/10 + regressões 35/35; typecheck PASS |
| Tip | `de369c4b` (feat `53aeda8d`) |
| Draft PR | **#133** — https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/133 — ManagePullRequest indisponível; `gh pr create` → `Resource not accessible by integration (createPullRequest)` |
| Abrir PR | https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/compare/cursor/comercial360-onda3-tabela-snapshot-392b...cursor/comercial360-onda3-orc-validade-392b?expand=1 |
| Integração | draft; sem merge/VPS; sem Codex/#104/#48 |
| Próximo | Onda 4 sem colisão 025–028 **ou** harden convert snapshot legado |

---

## LOTE CURSOR — TabelaPreço snapshot codigo+nome (pós-#130) (2026-09-29T16:45Z)

| Campo | Valor |
|---|---|
| Branch | `cursor/comercial360-onda3-tabela-snapshot-392b` |
| Base | `#130` tip `080dd951` (`cursor/comercial360-onda3-simular-persist-392b`) |
| Escopo | migration **031** + wire create/update/get/convert + UI reload; espelha condição 029 |
| Meta | note preserva `Pedido backend HTTP is active` + `tabelaSnapshot` |
| Tip | `07561d2d` |
| Draft PR | **#131** — https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/131 — `gh pr create` createPullRequest 403; ManagePullRequest indisponível |
| Abrir PR | https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/compare/cursor/comercial360-onda3-simular-persist-392b...cursor/comercial360-onda3-tabela-snapshot-392b?expand=1 |
| Integração | draft; sem merge/VPS; sem Codex/#104/#48 |
| Próximo | Onda 4 slice sem colisão 025–028 |

---

## LOTE CURSOR — simular→persist desconto/total (pós-#129) (2026-09-29T16:30Z)

| Campo | Valor |
|---|---|
| Choice | **B** — applyPromocaoOnPersist no create/update |
| Branch | `cursor/comercial360-onda3-simular-persist-392b` |
| Base | `#129` tip `6f42f061` (`cursor/comercial360-onda3-promocao-snapshot-392b`) |
| Escopo | sem migration; servidor aplica promo/desconto/total; UI merge+preview servidor; meta preserva `Pedido backend HTTP is active` |
| Tip | `eef875b7` (feat `f51f021c`) |
| Draft PR | **#130** — https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/130 — `gh pr create` → `Resource not accessible by integration`; ManagePullRequest indisponível |
| Abrir PR | https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/compare/cursor/comercial360-onda3-promocao-snapshot-392b...cursor/comercial360-onda3-simular-persist-392b?expand=1 |
| Integração | draft; sem merge/VPS; sem Codex/#104/#48 |
| Próximo | tabela preço code/nome snapshot (**031**) **ou** Onda 4 sem colisão 025–028 |

---

## LOTE CURSOR — promoção snapshot Orçamento/Pedido (pós-#127) (2026-09-29T16:15Z)

| Campo | Valor |
|---|---|
| Choice | **A** — persist refs promoção fail-closed |
| Branch | `cursor/comercial360-onda3-promocao-snapshot-392b` |
| Base | `#127` tip `8fba0782` (`cursor/comercial360-onda3-produto-http-392b`) |
| Escopo | migration **030** + wire create/update/get/convert + UI save refs; reusa `comercialPromocaoPolicy` |
| Meta | note preserva `Pedido backend HTTP is active` |
| Tip | `7dbfe5cf` |
| Draft PR | **#129** — https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/129 — `gh pr create` → `Resource not accessible by integration`; ManagePullRequest indisponível |
| Abrir PR | https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/compare/cursor/comercial360-onda3-produto-http-392b...cursor/comercial360-onda3-promocao-snapshot-392b?expand=1 |
| Integração | draft; sem merge/VPS; sem Codex/#104/#48 |
| Próximo | choice B (simular→persist desconto) **ou** Onda 4 sem colisão #50/#92 |

---

## LOTE CURSOR — Produto frontendHttp piloto (pós-#126) (2026-09-29T15:55Z)

| Etapa | Estado |
| --- | --- |
| Implementado | **SIM** — piloto HTTP Produto + picker Orçamento/Pedido fail-closed; sem migration |
| Testado | **SIM** — client/policy + http-api-client + runtime03/04/07b PASS; typecheck PASS |
| Base | `#126` tip `2e221def` (`cursor/comercial360-onda3-condicao-snapshot-392b`) |
| Branch | `cursor/comercial360-onda3-produto-http-392b` |
| Draft PR | **#127** — https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/127 — `gh pr create` → `Resource not accessible by integration` |
| Abrir PR | https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/compare/cursor/comercial360-onda3-condicao-snapshot-392b...cursor/comercial360-onda3-produto-http-392b?expand=1 |
| Próximo | promoção snapshot **ou** pickers legados; sem Codex/#104/#48 |

Reservados: runtimeBackend, httpApiClient (`produtos`), router meta (Pedido backend HTTP is active), comercialProdutoHttpUiPolicy, OrcamentosTab, PedidoCanonicoPanel, testes client/policy/runtime03/07b, docs R03. Sem merge/VPS.

---

## LOTE CURSOR — snapshot CondicaoPagamento Orçamento/Pedido (2026-09-29T15:46Z)

| Etapa | Estado |
| --- | --- |
| Implementado | **SIM** — choice A: migration `029` aditiva + wire create/update/get/convert + UI reload |
| Testado | **SIM** — 94/94 focados PASS; typecheck PASS |
| Base | `#124` tip `7c70de69` (`cursor/comercial360-onda3-cliente-local-obra-http-392b`) |
| Branch | `cursor/comercial360-onda3-condicao-snapshot-392b` |
| Draft PR | **#126** — https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/126 |
| Coordenação | Renumerado **025→029** (colisão com #50/#92 025–028) |
| Próximo | Produto frontendHttp piloto **ou** promoção snapshot; sem CRM paralelo |

Reservados: migration 029, comercialCondicaoSnapshot, orcamento/pedido services+repos+types, router meta, comercialCondicaoHttpUiPolicy, OrcamentosTab, PedidoCanonicoPanel, testes snapshot/UI/stubs. Sem Codex/#104/#48, sem merge/VPS. Meta preserva Pedido backend HTTP is active.

---

## LOTE CURSOR — #123 ClienteLocal + Obra frontendHttp (2026-09-29T15:45Z)

| Etapa | Estado |
| --- | --- |
| Implementado | **SIM** — nested HTTP Local/Obra + Pedido delivery fail-closed; sem migration |
| Testado | **SIM** — 33 frontend + runtime06a/06b/07b 20/20 |
| Base | `#122` tip `d82c7096` (`cursor/comercial360-onda3-cliente-empresa-http-392b`) |
| Branch | `cursor/comercial360-onda3-cliente-local-obra-http-392b` @ `a2c59236` |
| Abrir PR | https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/compare/cursor/comercial360-onda3-cliente-empresa-http-392b...cursor/comercial360-onda3-cliente-local-obra-http-392b?expand=1 |
| Draft PR | **#139** — https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/139 — `gh pr create` → `Resource not accessible by integration` |
| Próximo | snapshot condição/parcelas (migration) |

Reservados: runtimeBackend, httpApiClient, router meta, comercialClienteLocalObraHttpUiPolicy, PedidoCanonicoPanel, testes client/policy/runtime06a/06b/07b, docs 06A/06B/05. Sem Codex/#104/#48, sem merge/VPS.

---

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
