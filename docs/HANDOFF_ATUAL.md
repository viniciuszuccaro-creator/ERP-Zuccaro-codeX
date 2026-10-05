## CURSOR — parecer SHA `0c00318d` candidata +#212 (2026-10-05)

- Merge tip Comercial `0c00318d` no [#213](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/213).
- Parecer novo: `docs/PARECER_CURSOR_213_SHA_0c00318d.md` — APPROVED COM RESSALVAS (B1 PG real; B3 telas).
- #214 **não** aprova este pacote. Ordem: #207→#209+#210→#212→#213.
- B7 fechado. Espelhos #214/#210/#209/#212 isolados supersedíveis após merge humano.

## CURSOR — ordem integração candidata + bloqueios (2026-10-05)

- Autoritativa: `codex/comercial-expedicao-cliente360-207-209-20261005` `00d7add2` · espelho #213 `b0b983aa`.
- Encaminhado [Comercial candidata integrada](bc-55d5261f-d7a1-5e68-9b15-bd09a65ecb6a): consolidar #212 (`a37dca55`) — ainda ausente.
- Ordem PRs: #207 → #209+#210 (já) → #212 (pendente) → #213 SHA final → parecer Cursor novo.
- Supersedir após compose: #214 (parecer-only), #210/#209 isoladas, #212 isolada; preservar pareceres.
- Bloqueios B1–B7 em STATUS (DATABASE_URL, PG real, telas 3080/5173, VPS, saldo abertura, Legado HD, #212 fora).
- #214 **não** aprova o pacote #213. Margem/avista/Cliente360: 19/19 PASS neste tip.

## CURSOR — CI tip #213 SUCCESS (2026-10-05)

- Tip `1b1def8e` · 7 checks SUCCESS (merge asserts gap 032 + ledger/skip path).
- #211 tip `b78258e8` SUCCESS · #214 tip `1932b868` SUCCESS.
- Próximo: DATABASE_URL isolado → runtime11; merge humano das stacks.

## CURSOR — merge Comercial `00d7add2` (2026-10-05)

- Incorporado tip Codex `00d7add2` no espelho [#213](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/213) sem tip-port cego.
- Asserts: único gap 032; 037 sem INSERT saldo; `EXPEDICAO_PERSISTENT_PORTS` fail-closed sem URL; evidência sanitizada skip runtime11.
- Agente [Comercial próximo independente](bc-55d5261f-d7a1-5e68-9b15-bd09a65ecb6a) entregue; Legado [plano importação/reversão](bc-4427c136-a373-5bb6-83b8-ffa135fdb2d9) já espelhado no #211.
- PENDENTE: DATABASE_URL → runtime11; VPS/Auth/publisher.

## CURSOR — checkpoint pacotes (2026-10-05)

- #214 parecer #212 saldo inicial APPROVED @ `1932b868`.
- #211 plano Legado APPROVED @ `b78258e8`; HD/carga BLOCKED.
- #202/#203 CI SUCCESS — publisher externo BLOCKED.

## CURSOR — revalidação HEAD integrado #207+#209 (2026-10-05)

- Parecer: `docs/PARECER_CURSOR_207_209_SHA_aaf29c19.md` — APPROVED + follow-up decimal/estados.
- PGlite ledger 037 + asserts gap 032 no tip pós-`00d7add2`.## CODEX — consolidar #212 gate saldo na candidata autoritativa (2026-10-05)

Recebido e executado. Branch autoritativa `codex/comercial-expedicao-cliente360-207-209-20261005` tip código `899ec9b3` (#212 funcional `0c00318d`). #212 consolidado semanticamente (`bee11785`/`a37dca55`, sem tip-port #213): gate `ESTOQUE_BASELINE_OR_SALDO_INSUFICIENTE` + `unidade_medida_id`; asserts gap 032 + 026; ledger `expedicao_estoque_saldos`; #210 `to_char` 6 casas. Item independente: espelho PGlite do gate baseline (sem DATABASE_URL). PG real BLOCKED (skip sanitizado). #214 APPROVED só o gate — não o pacote. Sem inventar 032/saldo; sem outbox/DAM tip-*; sem VPS/main.


## CODEX — próximo item: asserts gap 032 + skip path sanitizado (2026-10-05)

Recebido. Tip candidata `284a9871` (CI SUCCESS). `DATABASE_URL` ausente → persistent-postgres BLOCKED (não inventar sucesso). Entregue: asserts gap 032 + 037 sem INSERT saldo; fail-closed ports; meta ledger; evidência sanitizada skip path. Sem tip-port #213/#212; sem outbox/DAM; sem VPS/saldo abertura. Próximo: DATABASE_URL isolado ou revisão humana #213/#212.


## CODEX — PGlite ledger + decimal/estados (2026-10-05, pós-aaf29c19)

`DATABASE_URL` ausente (sem Docker/PG local). Sem tip-port tip-* #213. Aplicado semanticamente: `to_char` 6 casas em `topProducts` e teste EM_ABERTO/CANCELADO. Novo teste PGlite com portas persistentes reais (037): despacho concorrente/retry, parcial→devolução, cancelamento e rollback atômico. Pacote DEV atualizado com evidência local vs gap PG real/grants. VPS/Auth/publisher/saldo abertura operacional continuam BLOCKED.

## CODEX — candidata integrada #207+#209 (2026-10-05)

Branch `codex/comercial-expedicao-cliente360-207-209-20261005` tip `85e48156` (base #207 `506a5d35` + semântica #209 `bb3ef069`). Compose sem tip-port cego: Cliente360 `produtosMaisComprados` e segregação de margem (#205/#206 — outro aprovador) preservando contratos fail-closed de alçada em Pedido/Orçamento. Ledger Expedição: `expedicao_estoque_saldos` fonte oficial no HTTP/BFF; opt-in `EXPEDICAO_PERSISTENT_PORTS`; SPA não duplica `MovimentacaoEstoque`. Migrations: 001–031, gap sem 032, 033–037; trava 026 intacta; sem saldo de abertura inventado. Fluxo PG isolado Pedido→separação→romaneio→despacho→parcial/devolução/cancelamento permanece em `runtime11-expedicao-persistent-postgres`. Pacote DEV: preparar grants/RLS/smoke só sob gates vigentes — VPS/Auth/publisher bloqueados. Cursor revisa #209 e avança Produto/DAM/outbox em arquivos independentes; não disputar tip-* / outbox Cursor.

## CODEX — composição incremental #199 na #201 (2026-10-02)

HEAD #199 `7879ecbe` foi incorporado **somente** à branch isolada da #201, preservando a branch Cursor. O conflito único de conteúdo em `docs/HANDOFF_ATUAL.md` foi resolvido mantendo os dois checkpoints. O delta traz gate CI Compose, provas SPA×BFF+PGlite com reload e teste de migrations comerciais 025–035 + Expedição 036; nenhum adaptador de estoque real foi ativado. Testes locais: servidor 303 pass/0 fail/17 skip; focados PGlite+composição 6/6 e UI 17/17; audit/lint/build raiz passaram. `npm test` raiz no Windows permanece falhando em guards Bash/VPS preexistentes; a CI Linux do novo HEAD será a verificação aplicável. #178 continua separada; 026 histórica continua travada. Não houve merge em main, VPS ou importação.

---

## CODEX — executor compartilhado nas portas Pedido/estoque (2026-10-02, candidata isolada)

Base: #200 `619bddd0` (que incorpora #199; migration Expedição 036). #178 segue `4f8c6593` separado. O ensaio `git merge-tree` ainda aponta conflitos semânticos em router/app/testes e SPA; não houve merge de PR, aplicação de migration, VPS ou importação. A 026 mantém seu preflight histórico.

As portas existentes de Pedido/estoque receberam o `DbQueryExecutor` ativo do `ExpedicaoService`, sem abrir transação aninhada. Teste PGlite força a porta de Pedido a gravar, a de estoque a enxergar essa gravação e falhar, e verifica rollback de ambos os efeitos e de Romaneio/Entrega. Teste adicional injeta falha na devolução após parcial e verifica rollback de movimento/status. PGlite 5/5; servidor completo do primeiro commit 301 pass/0 fail/17 skip; servidor typecheck/build, audit/lint/build raiz e diff-check passaram. CI do primeiro commit `70d1e75a` SUCCESS. Typecheck raiz falha em arquivos fora do diff; suíte SPA/VPS raiz não se aplica ao código servidor deste subgate. Ensaio PGlite efêmero aplicou 001–024 + dez migrations comerciais 025–035 da #178 + 036 Expedição sem erro; isso não libera a 026 em banco com histórico. A mudança **não ativa** efeitos reais: defaults `reserved` e gates de despacho/devolução vinculados seguem fail-closed. Próximo lote: compor semanticamente #178 e implementar adaptadores persistentes com unidades/quantidades por item, auditoria e retry; só então pedir revisão do HEAD integrado. CI do commit adicional: conferir após push.

---

Atualização do teste adicional: suíte completa do servidor reexecutada, **302 pass / 0 fail / 17 skip** (o 301 acima corresponde ao primeiro commit). PGlite 5/5.

---

## CURSOR — #199 CI verde tip dd8ee9d1 (2026-10-02)

CI push/PR **success** no tip `dd8ee9d1` (frontend, backend, `expedicao-comercial-compose`). Hotfix REQUIRE + pacote compose/telas/#201 entregues. Parecer #201 `d20a6dde` não estende #200. Tip-port/merge/VPS bloqueados. Canal documental atualizado.

---

## CURSOR — #199 hotfix CI backend compose PG REQUIRE (2026-10-02)

Backend `npm test` falhava: compose PG exigia DATABASE_URL sob CI. REQUIRE agora só com `COMERCIAL_COMPOSE_REQUIRE=1`. Job `expedicao-comercial-compose` permanece fail-closed. Sem tip-port/merge/VPS.

---

## CURSOR — #199 fechar integração: CI compose + PG + telas + #201 (2026-10-02)

Causa CI: grep de skip batia em `# skipped 0` → falso fail com teste PASS. Corrigido (só skip real). Compose **PGlite + PostgreSQL isolado** com SHA Comercial `4f8c6593` e trava histórica **026** — **PASS**. Telas: Nova Entrega→FormularioEntrega; fluxo completo + reload — **PASS**. Parecer **#201** SHA `d20a6dde` em `docs/PARECER_CODEX_201_SHA_d20a6dde.md` — **não** estende #200. Comercial 360 → tarefa existente. Legado → executor staging. HEAD tip `009be3c3` (pacote `59207a71`). Sem tip-port/merge/VPS.

---

## CURSOR — #199 reload real + CI compose + telas ERP + parecer #200 (2026-10-02)

Reload Playwright com `page.reload()` real — **PASS**. Job CI `expedicao-comercial-compose` fetch tip Comercial `4f8c6593`; ref ausente/skip = fail. SPA `/Expedicao` × BFF+PGlite **PASS** (`localhost`). Parecer **#200** SHA `619bddd0` em `docs/PARECER_CODEX_200_SHA_619bddd0.md` — **não** estende #178. Descrição #199: migration **036** (não 025) — ManagePullRequest bloqueado; corpo canônico no STATUS/HANDOFF. Sem tip-port/merge/VPS. HEAD `f969e49e`.

---

## CURSOR — pacote complementar #199 UI BFF + composição (2026-10-01T19:50Z)

Wire completo separação/expedição/parcial/total/ocorrência/devolução via BFF canônico (estados suportados). Prova Playwright: reload, RBAC 403, isolamento empresa 404, erro com code. Composição mig comercial 025–035 + 036 PGlite. Parecer Codex SHA `4f8c6593` em `docs/PARECER_CODEX_178_SHA_4f8c6593.md` (canal documental). Sem tip-port. Merge/VPS bloqueado.

---

## CURSOR — pacote #197 LogisticaReversa + Playwright objetivo (2026-10-01T15:00Z)

Listagem/detalhe abrem LogisticaReversa existente (RBAC+contexto). Playwright A–H+I+J PASS com persistência+reload. Camada SPA local ≠ API/PG (sem endpoints Entrega/Romaneio no router). Pedido de revisão Codex do pacote #192–#197. #178 sem tip-port. Merge/VPS bloqueado.

---

## CURSOR — navegação + Playwright Expedição #197 (2026-10-01T13:10Z)

Cards: limitação computerUse; Playwright OK. Correções: hydrate/contexto, topologia Empresa, empresa operacional, pedidosBase romaneio. Prova SPA local (≠ PG). A–D+E+I PASS; H LogisticaReversa não ligada. #178 `4f8c6593` sem tip-port; sim compat isolada. Merge/VPS bloqueado.

---

## CURSOR — vigília #178 (2026-10-01T12:14Z)

#178 `4f8c6593` ainda candidato. Sem tip-port. #197 `01d5c16e` CI OK. Homologação SPA parcial (A–J BLOCKED agente). Vigília 15min.

---

## CURSOR — homologação SPA Expedição #197 (2026-10-01T12:05Z)

#197: bootstrap sessão + redirect `/Expedicao/*`→launchpad. Seed+KPIs OK. A–J **BLOCKED** no agente (`openWindow`/cards). Requisito: operar cards do launchpad. #178 `4f8c6593` sem tip-port. Merge/VPS bloqueado. Doc canônica candidata atualizada.

---

## CURSOR — homologação SPA Expedição #197 (2026-10-01T10:56Z)

#197 `b8497171` CI OK. Bootstrap sessão mestre local corrigido. SPA isolada + seed HML no tenant snapshot. Homologação navegador A–J parcial (launchpad). #178 `4f8c6593` ainda candidato — sem tip-port. Merge/VPS bloqueado. Doc: `EXPEDICAO_CANDIDATA_INTEGRACAO_192_197.md`.

---

## CURSOR — vigília #178 (2026-10-01T09:30Z)

#178 `4f8c6593` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-10-01T09:14Z)

#178 `4f8c6593` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-10-01T08:59Z)

#178 `4f8c6593` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-10-01T08:43Z)

#178 `4f8c6593` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-10-01T08:27Z)

#178 `4f8c6593` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-10-01T08:11Z)

#178 `4f8c6593` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-10-01T07:55Z)

#178 `4f8c6593` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-10-01T07:39Z)

#178 `4f8c6593` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-10-01T07:23Z)

#178 `4f8c6593` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-10-01T07:08Z)

#178 `4f8c6593` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-10-01T06:52Z)

#178 `4f8c6593` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-10-01T06:35Z)

#178 `4f8c6593` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-10-01T06:20Z)

#178 `4f8c6593` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-10-01T06:04Z)

#178 `4f8c6593` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-10-01T05:48Z)

#178 `4f8c6593` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-10-01T05:32Z)

#178 `4f8c6593` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-10-01T05:17Z)

#178 `4f8c6593` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-10-01T05:01Z)

#178 `4f8c6593` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-10-01T04:45Z)

#178 `4f8c6593` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-10-01T04:30Z)

#178 `4f8c6593` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-10-01T04:14Z)

#178 `4f8c6593` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-10-01T03:58Z)

#178 `4f8c6593` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-10-01T03:43Z)

#178 `4f8c6593` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-10-01T03:27Z)

#178 `4f8c6593` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-10-01T03:12Z)

#178 `4f8c6593` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-10-01T02:56Z)

#178 `4f8c6593` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-10-01T02:41Z)

#178 `4f8c6593` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-10-01T02:25Z)

#178 `4f8c6593` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-10-01T02:09Z)

#178 `4f8c6593` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-10-01T01:54Z)

#178 HEAD `4f8c6593` (antes `790e4be1`) — ainda candidato; delta R08C auditoria. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-10-01T01:34Z)

#178 `790e4be1` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-10-01T01:19Z)

#178 `790e4be1` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-10-01T01:03Z)

#178 `790e4be1` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-10-01T00:48Z)

#178 `790e4be1` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-10-01T00:31Z)

#178 `790e4be1` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-10-01T00:15Z)

#178 `790e4be1` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-10-01T00:00Z)

#178 `790e4be1` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-09-30T23:44Z)

#178 `790e4be1` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-09-30T23:29Z)

#178 `790e4be1` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-09-30T23:13Z)

#178 `790e4be1` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-09-30T22:58Z)

#178 `790e4be1` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-09-30T22:43Z)

#178 `790e4be1` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-09-30T22:27Z)

#178 `790e4be1` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-09-30T22:12Z)

#178 `790e4be1` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-09-30T21:56Z)

#178 `790e4be1` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-09-30T21:41Z)

#178 `790e4be1` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-09-30T21:23Z)

#178 `790e4be1` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-09-30T21:08Z)

#178 `790e4be1` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-09-30T20:52Z)

#178 `790e4be1` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-09-30T20:37Z)

#178 `790e4be1` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-09-30T20:28Z)

#178 `790e4be1` ainda candidato. Sem tip-port. #197 CI OK. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 + CI #197 (2026-09-30T20:23Z)

#178 `790e4be1` ainda candidato (CI OK). Sem tip-port. #197 `7d4f445e` CI SUCCESS (persistência fail-closed). Homologação SPA pendente. Merge/VPS bloqueado. Vigília 15min.

---

## CURSOR — vigília #178 (2026-09-30T20:08Z)

#178 `790e4be1` ainda candidato. Sem tip-port. Vigília 15min.

---

## CURSOR — vigília #178 (2026-09-30T20:01Z)

#178 `790e4be1` ainda candidato. Sem tip-port. Vigília 15min.

---

## CURSOR — vigília #178 (2026-09-30T19:58Z)

#178 HEAD `790e4be1` (delta: aprovação sem confirmação da reserva) — ainda candidato. Sem tip-port. #197 OK. Vigília 15min.

---

## CURSOR — pacote Expedição #197 (2026-09-30T19:55Z)

Pacote fechado: filtros cliente coerentes, devolução assert, qtd pendentes, compensação≠atômico.
Doc: `docs/EXPEDICAO_CANDIDATA_INTEGRACAO_192_197.md`. Testes 32/32.
#178 ainda candidato. Homologação SPA pendente. Sem merge/VPS.

### Quadro
- **Pronto:** fluxo operacional completo + candidata documentada
- **Falta:** homologação SPA; WhatsApp/roteirizador/assinatura como serviço
- **Bloqueios:** #178 FINAL; merge/VPS; import Empresas

---

## CURSOR — vigília #178 (2026-09-30T19:52Z)

#178 `0596a763` ainda candidato. Sem tip-port. Homologação SPA pendente. Vigília 15min.

---

## CURSOR — vigília #178 (2026-09-30T19:49Z)

#178 `0596a763` ainda candidato. Sem tip-port. Vigília 15min.

---

## CURSOR — vigília #178 (2026-09-30T19:46Z)

#178 `0596a763` ainda candidato. Sem tip-port. Vigília 15min.

---

## CURSOR — vigília #178 (2026-09-30T19:39Z)

#178 `0596a763` ainda candidato. Sem tip-port. Vigília 15min.

---

## CURSOR — vigília #178 (2026-09-30T19:36Z)

#178 `0596a763` ainda candidato. Sem tip-port. #197 OK. Vigília 15min.

---

## CURSOR — vigília #178 (2026-09-30T19:31Z)

#178 `0596a763` estável — ainda candidato. Sem tip-port. Vigília 15min.

---

## CURSOR — vigília #178 (2026-09-30T19:27Z)

#178 HEAD `0596a763` (delta: histórico pré-025/026) — ainda candidato. Sem tip-port. Vigília 15min.

---

## CURSOR — vigília #178 (2026-09-30T19:21Z)

#178 HEAD `49ec5d97` (delta preflight 026) — ainda candidato. Sem tip-port. #197 OK. Vigília 15min.

---

## CURSOR — candidata #192–#197 (2026-09-30T19:20Z)

Candidata documentada em `docs/EXPEDICAO_CANDIDATA_INTEGRACAO_192_197.md`.
Tip #197: IntegracaoRomaneio + soft∨ crítico + comprovante/ocorrência/IA canônicos + teste E2E.
#178 ainda candidata. Homologação SPA pendente. Sem merge/VPS.

### Quadro
- **Pronto:** fluxo integrado completo no tip #197 (testes 16/16)
- **Falta:** homologação humana; soft∨ residual dashboard/financeiro
- **Bloqueios:** #178 FINAL; merge/VPS; import Empresas

---

## CURSOR — vigília #178 (2026-09-30T19:10Z)

#178 `9df73886` ainda candidato. #197 CI SUCCESS `0ac5af04`. Sem tip-port. Vigília 15min.

---

## CURSOR — comprovante/ocorrência canônicos + vigília #178 (2026-09-30T19:08Z)

`ComprovanteEntregaDigital` e `RegistroOcorrenciaLogistica` usam `resolveRegistroEntregaFinal`/asserts.
#178 `9df73886` ainda candidato. #197 em recheck. Sem merge/VPS.

### Quadro
- **Pronto:** fluxo integrado + IntegracaoRomaneio + soft∨ crítico + comprovante/ocorrência policy
- **Falta:** soft∨ residual dashboard/config; #178 FINAL
- **Bloqueios:** tip Comercial; merge/VPS; import Empresas

---

## CURSOR — vigília #178 (2026-09-30T18:57Z)

#178 `9df73886` ainda candidato; CI SUCCESS. Sem tip-port. #197 OK. Vigília 15min.

---

## CURSOR — #197 CI SUCCESS HEAD soft∨ (2026-09-30T18:56Z)

#197 CI SUCCESS `09ada19d`. Soft∨ caminho crítico ok. #178 ainda candidata. Sem merge/VPS.

---

## CURSOR — #197 CI SUCCESS + soft∨ + vigília #178 (2026-09-30T18:55Z)

#197 CI SUCCESS. Soft∨→∧ em ocorrência/comprovante/notificador/reversa/chat.
#178 HEAD `9df73886` ainda candidato (delta transição). Sem tip-port. Sem merge/VPS.

### Quadro
- **Pronto:** fluxo operacional integrado + IntegracaoRomaneio canônica + soft∨ caminho crítico
- **Falta:** #178 FINAL; soft∨ residual só em dashboard/config leitura
- **Bloqueios:** tip Comercial; merge/VPS; import Empresas (frente legado)

---

## CURSOR — Expedição Integração Romaneio canônica (2026-09-30T18:50Z)

`IntegracaoRomaneio` conectado à policy canônica (Pedidos→Entrega create/reuse→romaneio→despacho+rollback→legado descritivo).
Docs: `docs/EXPEDICAO_INTEGRACAO_ROMANEIO_CANONICO.md`. Sem merge/VPS. #178 ainda candidato.

### Quadro: pronto | falta | bloqueios
- **Pronto:** seleção→separação→romaneio→despacho→parcial/ocorrência→pendências; Isolamento∧; RBAC; unidades; concurrency/idempotência/rollback.
- **Falta:** tip-port Comercial só após #178 FINAL; homologação humana VPS (autorizada).
- **Bloqueios:** #178 não-final; merge/VPS/migration/import Empresas (frente legado chat principal).

---

## CURSOR — vigília #178 (2026-09-30T18:38Z)

#178 `e5eef59d` ainda candidato. Sem tip-port. Vigília 15min.

---

## CURSOR — vigília #178 (2026-09-30T18:33Z)

#178 `e5eef59d` ainda candidato. Sem tip-port. Vigília 15min.

---

## CURSOR — vigília #178 (2026-09-30T18:29Z)

#178 `e5eef59d` estável — ainda candidato. Sem tip-port. Vigília 15min.

---

## CURSOR — vigília #178 (2026-09-30T18:22Z)

#178 HEAD `e5eef59d` (delta: impede transição com status alterado). Ainda candidato — sem tip-port. Vigília 15min.

---

## CURSOR — vigília #178 (2026-09-30T18:18Z)

#178 `e84315e6` ainda candidato. Sem tip-port. #196 OK. Vigília 15min.

---

## CURSOR — vigília #178 (2026-09-30T18:13Z)

#178 HEAD `e84315e6` (delta: bloqueio edição pedido cancelado em corrida). Ainda candidato — sem tip-port. #196 OK. Vigília 15min.

---

## CURSOR — #196 CI SUCCESS + vigília #178 (2026-09-30T18:07Z)

#196 CI SUCCESS (`ef0a583d`). Stack Expedição #192–#196 ok.
#178 `98820d20` ainda candidato — sem tip-port. Sem merge/VPS. Vigília 15min.

---

## CURSOR — Expedição fluxo integrado Pedido (2026-09-30T18:01Z)

Draft PR **#196**. Branch `cursor/expedicao-fluxo-integrado-pedido-392b`. Lacunas pós-#195: Pedidos→separação, unidades, rollback.
Reservados Codex intactos. Sem merge/VPS. CI em curso.

---

## CURSOR — vigília #178 (2026-09-30T17:51Z)

#178 `98820d20` ainda candidato. Sem tip-port. Vigília 15min.

---

## CURSOR — vigília #178 (2026-09-30T17:43Z)

#178 `98820d20` ainda candidato. Sem tip-port. Vigília 15min.

---

## CURSOR — vigília #178 (2026-09-30T17:36Z)

#178 `98820d20` ainda candidato. Sem tip-port. Vigília 15min.

---

## CURSOR — vigília #178 (2026-09-30T17:27Z)

#178 `98820d20` ainda candidato. Sem tip-port. Vigília 15min.

---

## CURSOR — vigília #178 (2026-09-30T17:20Z)

#178 `98820d20` estável — ainda candidato. Sem tip-port. Vigília 15min.

---

## CURSOR — vigília #178 (2026-09-30T17:12Z)

#178 `98820d20` estável — ainda candidato. Sem tip-port. #195 CI OK. Vigília 15min.

---

## CURSOR — #195 CI SUCCESS + vigília #178 (2026-09-30T17:05Z)

Draft PR **#195** CI SUCCESS (`2db2ca6b`). Stack Expedição #192–#195 ok.
#178 `98820d20` ainda candidato (não final) — sem tip-port. Sem merge/VPS. Vigília 15min.

---

## CURSOR — Expedição fluxo consolidado (2026-09-30T17:00Z)

Draft PR **#195**. Candidata `cursor/expedicao-fluxo-consolidado-392b` sobre tip #194.
Fluxo: selecionar→separar→romaneio→despachar→parcial/total/ocorrência→pendências.
Docs: `EXPEDICAO_SEPARACAO_PEDIDO_LEGADO.md`, `EXPEDICAO_FLUXO_CONSOLIDADO_HOMOLOGACAO.md`.
Reservados Codex #178 intactos. Sem merge/VPS. CI em curso.

---

## CURSOR — vigília #178 (2026-09-30T16:45Z)

#178 `e4d3d904` estável — ainda candidato. Sem tip-port. Vigília 15min.

---

## CURSOR — vigília #178 (2026-09-30T16:29Z)

#178 `e4d3d904` CI OK — ainda candidato (não final). Sem tip-port. Stack Expedição #192–#194 ok. Vigília 15min.

---

## CURSOR — Expedição #194 CI + vigília #178 (2026-09-30T16:13Z)

Stack **#192–#194** CI SUCCESS. #178 `03fd92d2` ainda candidato (não final) — sem tip-port.
Soft contexto expedicao/logistica esgotado no inventário. Sem merge/VPS. Vigília 15min.

---

## CURSOR — Expedição roteirização fail-closed (2026-09-30T16:02Z)

#193 CI SUCCESS. Draft PR **#194** — mapa contexto∧ + filtros.
Reservados Codex #178 intactos. Sem merge/VPS. CI em curso.

---

## CURSOR — Expedição detalhe/separação fail-closed (2026-09-30T15:55Z)

#192 CI SUCCESS. Draft PR **#193** — detalhe∧ + assert update/prova; separação assertSeparacaoOnCreate.
Reservados Codex #178 intactos. Sem merge/VPS. CI em curso.

---

## CURSOR — Expedição filtros listagem/romaneio (2026-09-30T15:45Z)

Draft PR **#192** CI SUCCESS. Filtros empresa/cidade/data/futuras.
**Reservados Codex #178** intactos. Próximo: detalhe/separação fail-closed.
Sem merge/VPS.

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
## CODEX — composição Comercial + Expedição candidata (2026-10-04)

Branch isolada `codex/comercial-expedicao-fechamento-20261004`: #201 `59c4f506` + #199 **vigente** `f88460e9` + #178 `4f8c6593`. A referência `refs/pull/199/head` foi usada porque a branch remota nominal apontava para base antiga. A correção CI do falso `# skipped 0` e a prova PostgreSQL isolada foram preservadas. Migration 026 tem blob `07292e0c86133ad13e3d0c68a8a13d6d6322b228` idêntico à #178; nenhuma reclassificação histórica. Adicionada candidata 037 para saldo reconciliado, movimentos por item e eventos de Pedido, com portas persistentes opt-in; runtime default continua `reserved`, canais desligados. Testes locais de UI 27/27 e typecheck backend passaram; PostgreSQL real e CI do HEAD final ainda são gates, sem merge/VPS/dados reais. Cursor deve revisar o SHA final desta branch; não editar branches dele.

---
