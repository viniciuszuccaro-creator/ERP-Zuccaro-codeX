## CURSOR — #251 parecer publicado + fechamento (2026-10-09T09:55Z)

| Item | Valor |
|---|---|
| tip branch | `6ed9e7dc` |
| runtime | `dd13fb5f` |
| parecer | **APROVAR COM RESSALVAS** → `docs/vps/evidence/parecer-251-dd13fb5f-20261009.txt` |
| CI | PASS |
| overlap #252 | só STATUS/HANDOFF (runtime disjunto) |
| merge main | em curso |
| PR body GitHub | tentativa update; se BLOCKED, este handoff é canônico |

## CURSOR — #251 CLIENTE_360 ON + validação (2026-10-09T09:43Z)

| Item | Valor |
|---|---|
| código implantado | **`dd13fb5f`** |
| flag | `VITE_ERP_HTTP_CLIENTE_360=true` (após prova Auth supabase_user) |
| spa_asset | `index-B0gNWKWR.js` |
| browser Central360 | **PASS** (visível) |
| carregar mais UI | NO_BUTTON_MAYBE_EOF nesta vista; API limit/offset já PASS |
| sugestão UI Novo | BLOCKED_NAV no path Cadastros headless → lote indep. [#252](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/252) |
| branch tip docs | `3e0d61dd`+ |
| merge main | **não** |
| PRs redundantes #248/#249/#250 | manter abertas até merge #251; inventário no handoff anterior |

Evidências: `deploy-251-c360-flag-on-dd13fb5f-20261009.txt`, `browser-251-c360-flag-on-dd13fb5f-20261009.txt`.

## CURSOR — #251 continuidade (2026-10-09T09:39Z)

| Fase | SHA / estado |
|---|---|
| branch tip | `8ad3cdbd` |
| **implantado** | **`dd13fb5f`** erp-dev (asset `index-CMrmwZdE.js`) |
| CI | PASS tip `8ad3cdbd` + `dd13fb5f` |
| revisado | **APROVAR COM RESSALVAS** (parecer SHA final `dd13fb5f`; docs `8ad3cdbd` sem runtime) |
| integrado | PR #251 aberta; **não** merged em main |
| validado tip implantado | Playwright revalidação 2026-10-09: Empresas/Financeiro PASS; sugestão UI BLOCKED_NAV; 360 UI oculta (flag off) |
| Auth prova CLIENTE_360 | `/api/v1/meta` → `auth.mode=supabase_user` · `browserLogin=true` · `central360ReadModel=true` · env=dev **PASS** |
| PR body update | **BLOCKED** ManagePullRequest (repo rename) + `gh pr edit` (integration sem write) — corpo canônico neste handoff |

### Inventário incorporado (#248/#249/#250 → #251)
| Origem | Arquivos runtime |
|---|---|
| #249 | `Empresas.jsx`, `EmpresaSwitcher.jsx`, `input.jsx`, `localBase44Client.js`, `erpHttpSession.js`, `useContextoVisual.jsx`, `LaunchpadCard.jsx`, `ModulosGridFinanceiro.jsx`, `CaixaCentralLiquidacao.jsx`, `WindowModal.jsx`, `authSessionService.ts` + testes |
| #248 | `clienteSugestaoVinculoUi.js`, `CadastroClienteCompleto.jsx`, `httpApiClient.js` (sugestaoVinculo) + teste UI |
| #250 | `CentralCliente360Panel.jsx`, `centralCliente360Pagination.js`, `httpApiClient.js` (offsets), Dockerfile/compose flag, runtime test paginação |

Antes de fechar #248/#249/#250: merge #251 → main e confirmar ancestrais no tip merged.

### Lote indep. reservado (≠ #251)
Branch `cursor/comercial-clientes-tab-v24-392b` — `ClientesTab.jsx` → Visualizador V24 (Cadastros); `AcoesRapidasGlobal.jsx` data-action; **não** edita arquivos do #251.

≠ Codex outbox/legado/#236.

## CURSOR — pacote #251 implantado+validado `dd13fb5f` (2026-10-08T21:01Z)

| Fase | Estado |
|---|---|
| implementado | merge-tree #248 `bdf54b86` + #249 `4ab97760` + #250 `49e677ce` |
| revisado | **APROVAR COM RESSALVAS** |
| integrado | PR [#251](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/251) tip `dd13fb5f` (não merged em main) |
| **implantado** | **`dd13fb5f`** erp-dev (antes `54b9f9d0`) |
| **validado** | Playwright Empresas/Financeiro PASS · API paginação/sugestão/isolamento PASS |
| flag CLIENTE_360 | `false` — UI 360 oculta; API central-360 testada |
| rollback | `pre-spa-login-20261008-204827` · backup `pre-gate-e-20261008-204826.sql` |

Evidências: `docs/vps/evidence/deploy-251-integra-dd13fb5f-20261008.txt`, `browser-251-integra-dd13fb5f-20261008.txt`.
Pendência: UI Novo Cliente sugestão (BLOCKED_NAV headless); merge em main após aprovação humana.

## CURSOR — parecer integração #251 (2026-10-08T20:45Z)

| Item | Valor |
|---|---|
| branch | `cursor/cliente360-cadfin-integra-392b` |
| tip | `100cf997` |
| PR | [#251](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/251) |
| parecer | **APROVAR COM RESSALVAS** (revisão independente) |
| CI | em andamento |
| implantado | **não** |
| validado | **não** |
| flag CLIENTE_360 | `false` no deploy |

Ressalvas baixas: reset paginação via useEffect (sem vazamento cross-tenant); EmpresaSwitcher fallback HTTP sem groupId; Empresas FE sem usePermissions (pré-existente). Sem auto-mescla. Deploy DEV seguro após CI verde com flag off.

## CURSOR — pacote integração #248+#249+#250 (2026-10-08T20:55Z)

Branch `cursor/cliente360-cadfin-integra-392b` · base main `6ff6b0f2`.
Merge-tree: #249 `4ab97760` + #248 `bdf54b86` + #250 `49e677ce` (reset escopo + flag CLIENTE_360).

| Fase | Estado |
|---|---|
| implementado | HEADs das 3 PRs no branch de integração |
| revisado | pendente |
| integrado | merge-tree neste branch; **não** merged em main |
| implantado | **não** — erp-dev tip anterior `54b9f9d0` ≠ pacote |
| validado VPS | **não** |

Flag `VITE_ERP_HTTP_CLIENTE_360` default `false`. ≠ Codex outbox/legado.

## CURSOR — Onda 3 sugestão UI race-guard (#248)

Arquivos: `clienteSugestaoVinculoUi.js`, `CadastroClienteCompleto.jsx`, `httpApiClient.js` sugestaoVinculo.
Race: `buildClienteSugestaoVinculoRaceKey` + `shouldApplyClienteSugestaoVinculoBanner` descartam resposta atrasada.
Sem mescla automática. HEAD `bdf54b86`.

## CURSOR — #248 validado API/bundle + #249 restaurado (2026-10-08T20:17Z)

| frente | integrado | implantado | validado |
|---|---|---|---|
| [#249](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/249) Empresas/Financeiro | tip `54b9f9d0` / save `1e691933` | **`54b9f9d0`** erp-dev (atual) | browser PASS save/seletor/CNPJ/Caixa |
| [#248](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/248) sugestão UI | `bdf54b86` CI PASS | temporário `bdf54b86` → restaurado | API ausente+401+mescla proibida+bundle PASS; UI Novo janela BLOCKED_NAV headless |

Evidências: `browser-249-empresas-save-1e691933-20261008.txt`, `browser-248-sugestao-bdf54b86-20261008.txt`, `deploy-249-restored-54b9f9d0-20261008.txt`.

Lote independente reservado: Central 360 paginação por bloco → branch `cursor/comercial360-onda3-central360-pagina-392b`. ≠ Codex outbox/legado.

## CURSOR — #249 validado browser `1e691933` (2026-10-08T20:08Z)

| fase | estado |
|---|---|
| integrado | PR [#249](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/249) tip docs `b297b50d` / código save `1e691933` |
| implantado | **`1e691933`** erp-dev |
| validado | **PASS** switcher Grupo×Empresa · lista · save/reopen fantasia · CNPJ origem · Caixa open |

Evidência: `docs/vps/evidence/browser-249-empresas-save-1e691933-20261008.txt`. ≠ #248 / Codex.

## CURSOR — implantado #249 `1e691933` (2026-10-08T20:04Z)

| fase | estado |
|---|---|
| integrado | PR [#249](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/249) tip `1e691933` · CI no tip |
| implantado | **`1e691933`** erp-dev · rollback `pre-spa-login-20261008-200329` · backup `pre-gate-e-20261008-200329.sql` |
| validado browser | **PASS** (ver bloco abaixo) |

Causa save: RHF perdia digitação (`Input` spread após onChange) + remirror sessão sobrescrevia `nome_fantasia`. Testes focados 5/5. ≠ Codex outbox/legado. ≠ #248.

## CURSOR — CI verde #248/#249 (2026-10-08T17:33Z)

| PR | Tip CI | frontend/backend |
|---|---|---|
| [#248](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/248) sugestão UI | `bdf54b86` | **PASS** |
| [#249](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/249) SPA/Financeiro/Empresas | tip branch incl. `9c19da80` | **PASS** |
| implantado erp-dev | `b81bc1cd` | — |

Aguarda review/merge. Persistência save Empresa segue BLOCKED.

## CURSOR — tip implantado `b81bc1cd` (2026-10-08T17:30Z)

| Pacote | Tip | PR | Estado |
|---|---|---|---|
| SPA UI + Financeiro + Empresas | **`b81bc1cd`** implantado erp-dev | [#249](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/249) | Caixa/CR/CP/Conciliação/Lote/Cartões PASS; Empresas lista PASS; save Empresa BLOCKED local |
| Onda 3 sugestão UI + race | `bdf54b86` | [#248](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/248) | testes 5/5; aguarda CI/merge |
| Legado destino | tip `fff3abc8` · main `6ff6b0f2` | — | contratos #113/#246/#245; sem reprocessar backup |
| rollback | `pre-spa-login-20261008-173140` | — | |

Evidências: `docs/vps/evidence/browser-financeiro-pos-caixa-9b2c9b63-20261008.txt`, `browser-financeiro-caixa-08da3b8e-20261008.txt`, `browser-empresas-lista-empresa-2e50ee33-20261008.txt`.

## CURSOR — Empresas save regime + carimbar group_id (2026-10-08T17:25Z)

| Item | Estado |
|---|---|
| tip | tip local pós-regime/carimbar (base `2e50ee33` implantado) |
| lista escopo empresa | PASS edits=2 |
| save falhava | regime_tributario vazio no edit + carimbar `group_id`←empresaId |
| fix | defaults REGIMES/TIPOS no handleEdit; carimbar não estampa group_id como campo empresa; payload preserva group_id |
| testes | empresas-dialog-edit + contexto-multiempresa-policy PASS |

## CURSOR — Empresas lista no escopo empresa (2026-10-08T17:22Z)

Causa: `filterInContext('Empresa', …, 'group_id')` + `getFiltroContexto('group_id')` sobrescrevia `group_id` com UUID da empresa → lista vazia sem Editar.
Fix: `MASTER_GROUP_SET` em `useContextoVisual` (leitura só por groupId canônico) + `queryKey` `empresas-cadastro` com `groupIdCadastro`.
Testes: empresas-dialog-edit + contexto-multiempresa-policy **17/17**.
Branch `cursor/spa-ui-empresas-financeiro-clicks-392b` · PR **#249**. ≠ Codex #209 / outbox.

## CURSOR — paralelo SPA UI + Onda 3 sugestão UI (2026-10-08T17:06Z)

| Pacote | Branch | SHA tip | Estado |
|---|---|---|---|
| SPA UI + Caixa Button | `cursor/spa-ui-empresas-financeiro-clicks-392b` | `9b2c9b63` | **implantado** erp-dev · PR **#249** |
| Onda 3 sugestão vínculo UI | `cursor/comercial360-onda3-sugestao-ui-392b` | `ce99d428` | implementado; PR **#248** draft |

PR sugestão UI: https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/248  
PR SPA UI / Financeiro: https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/249

### Legado / destino erp-dev (contratos; sem reprocessar backup)
| Campo | Valor |
|---|---|
| **implantado tip** | **`9b2c9b63`** |
| main integrado | `6ff6b0f2` (#247) · contém #113/#246/#245 |
| contratos no destino | #231 snapshots · #226 Cadastros · #225/#246 Financeiro · #113 sugestão API · #203/#237 outbox · #239 troca empresa · #242 acesso VPS |
| snapshots públicos | ausentes |
| escrita títulos reais | proibida neste lote (só sintético/isolado) |
| rollback | `pre-spa-login-20261008-170810` |

Evidência: `docs/vps/evidence/browser-financeiro-caixa-08da3b8e-20261008.txt` · `docs/vps/evidence/browser-financeiro-pos-caixa-9b2c9b63-20261008.txt`.

## CURSOR — SPA UI empresas/financeiro implantado `677b1ab1` (2026-10-08)

| Fase | Estado |
|---|---|
| implementado | `11fd3510` |
| integrado | PR pendente (`cursor/spa-ui-empresas-financeiro-clicks-392b` → main) |
| **implantado** | `11fd3510` |
| auth `empresas[].cnpj` | **PASS** |
| /Empresas lista CNPJ | **PASS** |
| Financeiro cores CR≠Régua | **PASS** |
| seletor/Editar/close browser | PARTIAL (overlays Chrome) |
| rollback | `pre-spa-login-20261008-161558` |

Evidência: `docs/vps/evidence/browser-spa-ui-677b1ab1-20261008.txt`. ≠ outbox/legado.

## CURSOR — validação login API pós-secrets (2026-10-08)

| Fase | Estado |
|---|---|
| implantado | `68c311cc` (superseded por `677b1ab1` acima) |
| login API | **PASS** 200 (secrets Environment) |
| CPA/3Z IDs | CPA=`cccccccc-…` · 3Z=`c2c2c2c2-…` (mesmo group) |
| isolamento pedidos | **PASS** CPA 0 ≠ 3Z 3 |
| sugestao-vinculo #113 | **PASS** 200 + mescla proibida |
| browser UI Cadastros/Financeiro | ver seção `677b1ab1` |

Evidência: `docs/vps/evidence/browser-api-login-68c311cc-20261008.txt`.

## CURSOR — #113 Onda 3 sugestão vínculo (2026-10-08T15:09Z)

| Fase | SHA |
|---|---|
| implementado | `502122bc` |
| **integrado** | `68c311cc` MERGED #113 |
| **implantado** | `68c311cc` VPS |
| validado rota | `GET .../sugestao-vinculo` → **401** sem token (não 404) |
| validado CPA/3Z browser | BLOCKED `ERP_DEV_LOGIN_*` |

Evidência: `docs/vps/evidence/deploy-113-main-68c311cc-20261008.txt`. Rollback `pre-spa-login-20261008-150832`.
Contém também #246 Financeiro UX + #245 nginx 404-all.

## CURSOR — #246 integrado+implantado `64301fdb` (2026-10-08T15:01Z)

| Fase | SHA |
|---|---|
| implementado | `3faa46ff` |
| **integrado** | `64301fdb` MERGED #246 |
| **implantado** | `64301fdb` VPS rebuild |
| validado health/snapshots | sim |
| validado CPA/3Z browser | BLOCKED `ERP_DEV_LOGIN_*` |

Evidência: `docs/vps/evidence/deploy-246-main-64301fdb-20261008.txt`. Rollback `pre-spa-login-20261008-150055`.

## CURSOR — fases #245 reconciliadas (2026-10-08T14:52Z)

| Fase | SHA | Nota |
|---|---|---|
| implementado | `542be525` | nginx regex 404 |
| **integrado** | `dd6c211d` | MERGED #245 → main |
| **implantado** | `dd6c211d` | VPS rebuild pós-merge |
| validado health/snapshots | sim | 404 `base44-local-*.json` |
| validado CPA/3Z browser | **não** | secrets login ausentes |

Evidência: `docs/vps/evidence/reconcile-245-main-vps-dd6c211d-20261008.txt`.
Rollback: `pre-spa-login-20261008-145118`.

## CURSOR — #246 Financeiro scope + stale cancel (2026-10-08)

| Fase | Estado |
|---|---|
| implementado | `cancelFinanceiroQueriesOnScopeSwitch` + reset CR/CP/Caixa/Cartões/Conciliação/Lote |
| integrado | PR #246 (rebase main `dd6c211d`) — CI a correr |
| implantado | **não** (aguardar merge) |
| validado VPS browser | BLOCKED `ERP_DEV_LOGIN_EMAIL` + `ERP_DEV_LOGIN_PASSWORD` |

Testes focados empresa-switch **7/7**. ≠ outbox/legado/#245.

## CURSOR — estado vivo pós-validação (2026-10-08T14:25Z)

| Item | Valor |
|---|---|
| **implantado erp-dev** | **`542be525`** (branch #245 nginx 404-all; detached) |
| Anterior | `85049afd` (#243) — superseded |
| health/ready/web | **200** · RUNTIME-08B · supabase_user |
| Snapshots `base44-local-*.json` | **404** application/json (clientes/produtos/empresas/snapshot/core) |
| Browser CPA/3Z | **BLOCKED** — Environment sem `ERP_DEV_LOGIN_*` (pedido ao usuário) |
| Lote UX | `cursor/cadastros-financeiro-empresa-ux-392b` (rebase main; PR) |
| Legado destino | runtime **`542be525`**; contratos #231/#226/#225/#203/#237/#239/#242/#243/#245; **não** duplicar mapper; **não** vínculos sem prova |

> Seções abaixo com `implantado=9a277011` / `NONE` são **históricas**.

## CURSOR — Cadastros ↔ Financeiro ↔ empresa UX (2026-10-08)

Branch `cursor/cadastros-financeiro-empresa-ux-392b` · SHA `ec27b9f7` (base main). Gap: Financeiro sem scope `grupo:empresa` no queryKey/uniqueKey; CR/CP com seleção residual na troca; sem alerta sem contexto. Fix: `buildMultiempresaQueryScopeKey` + `buildFinanceiroTitulosScopeSwitchReset` em launchpad + tabs. Testes **47/47**. PR create **BLOCKED** (integration) — abrir: https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/new/cursor/cadastros-financeiro-empresa-ux-392b. ≠ outbox/legado. **Sem deploy VPS.**

## CURSOR — implantado erp-dev `542be525` (2026-10-08T14:24Z)

| Item | Valor |
|---|---|
| **implantado** | **`542be525`** · PR [#245](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/245) |
| Anterior | `85049afd` (#243) — superseded |
| Smoke | health/ready/web **200** · RUNTIME-08B · supabase_user |
| Snapshots `base44-local-*.json` | **404** JSON (clientes/produtos/empresas/snapshot/core) via HTTPS público |
| Rollback tags | `pre-spa-login-20261008-142359` (api+web) |
| Evidência | `docs/vps/evidence/deploy-542be525-snapshot-404-all-20261008.txt` |
| Browser CPA/3Z | **BLOCKED** sem `ERP_DEV_LOGIN_EMAIL`/`PASSWORD` |
| Legado destino | runtime **`542be525`**; sem mapper paralelo; sem vínculos sem prova |

> `implantado=9a277011` / `NONE` abaixo = histórico.

## CURSOR — validação pós-deploy + gap snapshots (2026-10-08)

| Item | Valor |
|---|---|
| **implantado erp-dev** | `85049afd` (main #243+#244) · web/api rebuilt ~14:12Z |
| health/ready :3080/:3081 | **200** ok/ready |
| HTTPS público | SPA 200; `/api/health`/`ready` 401 AUTH_REQUIRED (edge) |
| Snapshots canônicos | `/base44-local-snapshot.json` + `core` → **404** |
| Gap encontrado | `/base44-local-clientes|produtos|empresas.json` → **200 HTML SPA** (não JSON) |
| Correção | branch `cursor/spa-snapshot-paths-404-all-392b` (regex 404 todos `base44-local-*.json`) |
| Browser CPA/3Z | **BLOCKED** sem `ERP_DEV_LOGIN_EMAIL`/`PASSWORD` no Environment |
| Lote UX indep | `cursor/cadastros-financeiro-empresa-ux-392b` SHA `ec27b9f7` (PR a abrir) |
| Legado destino | erp-dev **85049afd**; sem vínculos empresariais sem prova; mapper não duplicar |

> Histórico abaixo com `implantado=NONE` / `9a277011` é **superseded** por esta seção.


## COORDENAÇÃO CURSOR → LEGADO — implantado=`9a277011` (2026-10-08 pós-deploy)

Chat: [ERP ZUCCARO - CODEX/CURSOR](bc-d973626e-1060-4071-a25a-6a549769392b)
Agente Legado: [Legado: versão implantada](bc-4427c136-a373-5bb6-83b8-ffa135fdb2d9)
PR: [#211](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/211)

| Campo | Valor |
|---|---|
| **Versão efetivamente implantada em erp-dev** | **`9a277011`** (não mais NONE) |
| Imagens | `erp-api-dev` / `erp-web-dev` rebuild **2026-10-08T13:34Z** |
| Smoke VPS | health/ready/web **200** · `auth.mode=supabase_user` · meta **ERP-RUNTIME-08B** |
| Snapshots JSON públicos | **AUSENTES** (SPA HTML fallback ~1958B; 0 arquivos no nginx) |
| Contratos no destino | #231 snapshots · #226 Cadastros Organizacional · #225 Financeiro · #203/#237 outbox · #239 troca empresa · #242 acesso VPS canônico |
| Main GitHub tip | pode estar à frente só em docs (ex. `f6ec95bc`); **runtime VPS = `9a277011`** |
| Flags Legado | `importAuthorized=false` · sintético ≠ importação · **não** alterar vínculos empresariais · mapper #48 intocado |
| Checksum 153440Z | **UNVERIFIED** neste Cloud |
| Contagens REAIS backup | **0** processadas neste agente |

**HUMAN_NEXT (Legado — PC com HD):** somente verifier host-local — sem re-export/CADESP/transferência; sem tratar teste sintético como importação:
```bash
bash scripts/legado/executar-verifier-host-local.sh
# ou: --reports-dir "D:/BACKUP ERP ANTIGO - CODEX/04_REPORTS"
```
Colar só `PASTE_TO_GIT_HOST_*` + JSON do verifier.

**#211:** `gh pr edit` costuma falhar neste token — Cursor/humano: título `legado: erp-dev implantado=9a277011 — verifier host-local`; corpo = tabela acima + flags + HUMAN_NEXT verifier.

### Histórico — versão implantada=NONE (pré-deploy, obsoleto)
Antes do rebuild 13:34Z a VPS ainda estava em NONE (SPA last-mod 2026-09-27; snapshots HTTP 200; deploy BLOCKED SSH/MCP). Superseded pela seção acima.

## CURSOR — validação pós-deploy `9a277011` (2026-10-08)

| Item | Resultado |
|---|---|
| Versão VPS | **`9a277011`** implantada |
| health/ready/web | **200** |
| HTTPS meta | RUNTIME-08B · supabase_user |
| Snapshots JSON | **ausentes** (HTML fallback 1958B; 0 arquivos) |
| Browser CPA/3Z | em andamento (agente) |
| Defeito tratado | nginx passa a **404** nos paths legados (não mascarar com SPA) |
| Parecer Codex | #236 `6581cfec` — APROVAR runbook (sem rewrite) |
| Evidência | `docs/vps/evidence/validacao-pos-deploy-9a277011-20261008.txt` |


## ACESSO VPS CANÔNICO (Cursor + Codex) — 2026-10-08

Contrato operacional: `docs/OPERACAO_DEV_VPS.md` § «Acesso operacional Cursor / Codex».

| Item | Valor no Git | Segredo |
|---|---|---|
| Host | `srv1982741` · erp-dev.cpaferroeaco.com.br | IP não versionar |
| Path | `/opt/erp-zuccaro` | `.env.erp.dev` só na VPS |
| SSH user | tipicamente `root` | nome do secret: `ERP_DEV_VPS_SSH_USER` |
| SSH key | pubkey + fingerprint no OPERACAO_DEV_VPS | privada: `ERP_DEV_VPS_SSH_PRIVATE_KEY` (Environment Secret) |
| authorized_keys | deve conter `erp-zuccaro-vps` na VPS viva | hPanel sozinho não basta |

**Regra:** após qualquer deploy/backup/rollback VPS → atualizar este HANDOFF + `docs/vps/evidence/` + push. Trocar de PC não exige reenviar chave no chat se o Environment Cursor mantiver os secrets.

## CURSOR — deploy erp-dev main `9a277011` (2026-10-08T13:35Z)

| Fase | Estado |
|---|---|
| integrado | sim (main `9a277011`) |
| **implantado** | **sim** — SPA/API rebuild em srv1982741 |
| validado VPS (browser CPA/3Z) | **pendente** hard refresh + login real |
| snapshots públicos JSON | **ausentes** (fallback HTML SPA; não os dumps) |

- Backup: `pre-gate-e-20261008-133238.sql` · 845186 B · sha256 `1f1b55b2…` · evidence `docs/vps/evidence/pre-gate-e-backup-latest.txt`
- Rollback: `erp-zuccaro-erp-api:pre-spa-login-20261008-133314` / `…-web:…`
- Evidência: `docs/vps/evidence/deploy-main-9a277011-20261008.txt`
- Contém: #231 #226 #225 #203 #237 #239

**HUMAN_NEXT browser:** abrir https://erp-dev.cpaferroeaco.com.br/ com hard refresh → login → CPA/3Z → Cadastros Empresas → Financeiro.

## CURSOR — UX troca de empresa fail-closed (2026-10-08)

Agente: [Comercial UX empresa-switch](bc-5656ace2-6ada-57dc-87dd-81e7868ccc0c)
PR: [#239](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/239) · tip pós-rebase main (#240)

- Gap: troca de grupo/empresa fechava form sem zerar seleção em massa / isSaving / formKey.
- Fix: `buildCadastroScopeSwitchReset` + effect `scopeKey` no VisualizadorUniversal.
- Testes: `cadastros-empresa-edicao-load` **15/15** · CI SUCCESS.
- ≠ outbox #237 / legado.

## HISTÓRICO — Legado versão implantada=NONE (obsoleto) (2026-10-08)

**Versão efetivamente implantada em erp-dev: NONE.** Main tem #231/#226/#225/#203/#237 no código; SPA last-mod 2026-09-27; snapshots HTTP 200; deploy BLOCKED (SSH/MCP). Legado: só verifier no PC com HD.

## CURSOR — pacote frentes paralelas (2026-10-08)

Chat: [ERP ZUCCARO - CODEX/CURSOR](bc-d973626e-1060-4071-a25a-6a549769392b)

| Fase | Main (#231…#237) | Deploy erp-dev | Legado |
|---|---|---|---|
| integrado | **sim** | código em main | scripts |
| implantado | **não** | **BLOCKED** SSH/MCP | não |
| validado VPS | **não** | snapshots HTTP 200 | N/A |

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
