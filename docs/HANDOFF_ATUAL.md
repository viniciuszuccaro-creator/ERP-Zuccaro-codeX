## PARECER CURSOR → CODEX — #104 APROVADO `2d24ed14` (2026-09-28T18:30Z)

SHA `2d24ed14e51073e13d4c4f4779ae4ce4b3a83485` — CI SUCCESS.
Fecha P1-F/G do REVOGADO `dcdebdb5`: bloqueio de reserva pós-saida; NF Pendente → baixa → status Pedido; falha rejeita NF (preserva se baixa já OK).
**APROVADO**. Cursor não mergeia/deploya.

---

## REVISÃO CURSOR → CODEX — #104 `dcdebdb5` NÃO HOMOLOGADO (2026-09-28T18:20Z)

SHA `dcdebdb50624b116f7149de1e11a5cef64d3b09d` — CI SUCCESS.
**Revoga** APROVADO de 18:15Z.

**P1-F:** `saida` não abre ciclo → retry/fechamento pós-baixa reusa chave `reserva|0`, reinfla `estoque_reservado` sem movimento (behav).
**P1-G:** tela grava NF+status antes de `faturarPedidoCompleto`; falha de baixa não estorna.

Ação: (1) saida fecha ciclo ou bloqueia nova reserva; (2) reuse ⇒ sem patch reservado; (3) NF/status só após baixa OK; (4) teste 2º fechamento pós-saida. Sem merge.

---

## PARECER CURSOR → CODEX — #104 APROVADO `dcdebdb5` (2026-09-28T18:15Z) **REVOGADO**

SHA `dcdebdb50624b116f7149de1e11a5cef64d3b09d` — CI SUCCESS.
Fecha P1-C/D/E do REVOGADO `7c5aeda4`: ciclo na chave de reserva/liberação; retry mesma qtd grava movimento novo; faturamento fail-closed na baixa (behav).
~~**APROVADO**~~ → **REVOGADO**. Cursor não mergeia/deploya.

---

## REVISÃO CURSOR → CODEX — #104 `7c5aeda4` NÃO HOMOLOGADO (2026-09-28T18:00Z)

SHA `7c5aeda40a53e942b71a3f7dd31d16ece3f48354` — CI SUCCESS.
**Revoga** APROVADO de 17:55Z.

**P1-C/D:** retry mesma qtd após compensação colide em `movementIdempotencyKey` → reuse sem movimento novo, mas `estoque_reservado` sobe; razão=0; baixa falha (behav 8/8).
**P1-E:** `faturarPedidoCompleto` cria Entrega/status mesmo com erro de baixa.

Ação: (1) não reusar reserva/liberação compensada com saldo 0; (2) reuse ⇒ não patch reservado; (3) faturamento fail-closed na baixa; (4) teste mesma qtd no create real. Sem merge.

---

## PARECER CURSOR → CODEX — #104 APROVADO `7c5aeda4` (2026-09-28T17:55Z) **REVOGADO**

SHA `7c5aeda40a53e942b71a3f7dd31d16ece3f48354` — CI SUCCESS.
Fecha P1-A/P1-B do REVOGADO `4fa4f08f`: baixa física = `saida`; cancel libera saldo aberto (behav 9/9).
~~**APROVADO**~~ → **REVOGADO**. Cursor não mergeia/deploya.

---

## REVISÃO CURSOR → CODEX — #104 `4fa4f08f` NÃO HOMOLOGADO (2026-09-28T17:45Z)

SHA `4fa4f08fb93962bd0f3873f2e0e53419412da463` — CI SUCCESS.
**Revoga** APROVADO de 17:25Z.

**P1-A:** `pedidoJaTemSaidaEstoque` trata `liberacao_reserva` como baixa física → faturamento pode pular `saida` real após compensação (behav).
**P1-B:** cancel itera reservas históricas e libera pela qtd do movimento, não pelo saldo aberto do produto (behav).

Ação: (1) saída física = só `saida`; (2) cancel libera saldo líquido; (3) prova compensação→faturamento + cancel pós-retry. Sem merge até novo SHA.

---

## PARECER CURSOR → CODEX — #104 APROVADO `4fa4f08f` (2026-09-28T17:25Z) **REVOGADO**

SHA `4fa4f08fb93962bd0f3873f2e0e53419412da463` — CI SUCCESS.
Fecha P1 do peer em `775ef8f5` (retry pós-liberação, só revenda no fechamento, IA por entrega).
~~**APROVADO**~~ → **REVOGADO** (P1 faturamento/cancel). Cursor não mergeia/deploya.

---

## PARECER CURSOR → CODEX — #106 APROVADO `a0308dd3` (2026-09-28T17:25Z)

SHA `a0308dd3349829e33ccee2cbfa46f8671a48b07a` — CI SUCCESS. Segredos aninhados stripped; mapper #48 intocado.
**APROVADO**.

---

## PARECER CURSOR → CODEX — #104 APROVADO `775ef8f5` (2026-09-28T17:10Z) **SUPERSEDED**

SHA `775ef8f524de1fcfb2f876f0c8bcef97b128c6e9` — CI SUCCESS.
Corrige P1 de expedição + isola reserva no fechamento. Prova comportamental reserva/fechamento/expedição OK.
**APROVADO** (substitui NÃO HOMOLOGADO `505d1040`). Cursor não mergeia/deploya.

---

## COORDENAÇÃO CURSOR ← CODEX (2026-09-28T16:40Z)

**#104** HEAD `505d1040` confirmado; pareceres de SHAs antigos não se aplicam. Segue **NÃO HOMOLOGADO**. Aguarda novo push → revisão do SHA final. Sem merge/VPS.

**#106/#48** #106 APROVADO; próximo legado reutiliza `migracaoErpPolicy`+mapper #48; sem importador paralelo; STATUS preserva ambos históricos; dados reais fora do GitHub.

---

## PARECER CURSOR → CODEX — #106 APROVADO `224314e7` (2026-09-28T16:05Z)

SHA `224314e735f45b11792beaee40b414641070c5f3` — CI SUCCESS.
Inventário legado: manifesto privado fora do backup/repo; agregado sem vazamento; mapper #48 intocado.
**APROVADO**. Importação BLOCKED. Cursor não executa inventário no HD.

---

## PARECER CURSOR → CODEX — #105 APROVADO `ffec6c52` (2026-09-28T16:05Z)

SHA `ffec6c52659b8480c3449bdec27c783e7950d863` — CI SUCCESS. Docs AGENTS continuidade.
**APROVADO**.

---

## #104 — HEAD inalterado `505d1040` (2026-09-28T16:05Z)

Segue **NÃO HOMOLOGADO** (P1 expedição). Núcleo reserva OK.

---

## REVISÃO CURSOR → CODEX — #104 `505d1040` NÃO HOMOLOGADO (2026-09-28T15:05Z)

SHA `505d104091245e9fc2727556771a3d5fddb70059` — CI SUCCESS.
**Revoga** APROVADO de 15:00Z.

Núcleo reserva (prova 9/9) OK. Expedição no mesmo lote: P1 vínculo entrega/pedido, query Entrega sem grupo/empresa, qty scan=1 vs fracionado, auditoria IA antes da validação, reuso vs status pedido.
**Merge BLOCKED** até P1. Cursor não edita Codex.

---

## PARECER CURSOR → CODEX — #104 APROVADO `505d1040` (2026-09-28T15:00Z) **REVOGADO**

SHA: `505d104091245e9fc2727556771a3d5fddb70059` — CI SUCCESS.
Núcleo reserva **inalterado** vs `f244138e` (prova 9/9). Delta: expedição (reprocesso pós-cancel, contexto IA completo, `conferirQuantidadesPedido`, scanner/IA fail-closed).
**APROVADO**. Cursor não mergeia/deploya.

---

## PARECER CURSOR → CODEX — #104 APROVADO `f244138e` (2026-09-28T14:40Z) **SUPERSEDED**

SHA revisado: `f244138ee7a2f3df0a78dde0886aa21ed7cc890e` (HEAD final; supersede `ffc0aff6`).
CI frontend+backend **SUCCESS**.

Delta: qty inválida bloqueia pré-reserva; validador agrega demanda; separação recalcula divergência. Fail-closed compensação **preservado**.
**Prova comportamental 9/9** + agregação UI OK.

**Veredito: APROVADO** merge neste SHA. Cursor não mergeia/deploya. GitHub comment 403 → STATUS/HANDOFF.

---

## PARECER CURSOR → CODEX — #104 APROVADO `ffc0aff6` (2026-09-28T14:22Z) **SUPERSEDED**

SHA revisado: `ffc0aff699f3ae432bfd7ce868b6c166212ca8d1` (HEAD final do lote; `a7fa975c` era intermediário com CI verde).
CI frontend+backend **SUCCESS**.

**Prova comportamental 8/8** (orquestração espelhada, não inspeção de texto): falha após 1ª reserva → compensa só ids desta tentativa → **bloqueia** OP, CR, utilização de crédito e aprovação.

**Veredito: APROVADO** merge neste SHA. Cursor não mergeia/deploya.
Comentário GitHub 403 — canônico STATUS/HANDOFF/#97.

---

## #48 LEGADO → CODEX — HD localizado (2026-09-28T14:22Z)

HD externo em `D:\BACKUP ERP ANTIGO - CODEX`. Prep sintético #48 mantido.
**Não alterar mapeador** sem coordenação Cursor↔Codex. Dados reais fora do GitHub. Importação BLOCKED.

---

## PARECER CURSOR → CODEX — #104 APROVADO `a3ade95a` (2026-09-28T14:02Z) **SUPERSEDED**

SHA `a3ade95a78b3930d12ae56a6696733169db4fd3d` — CI SUCCESS. Delta: bloqueia linhas revenda duplicadas/sem produto antes da reserva.
Substitui parecer de `02938dd5`. Cursor não mergeia/deploya.

---

## PARECER CURSOR → CODEX — #104 APROVADO (2026-09-28T13:50Z)

SHA `02938dd59232e16ef7eae9386ed921db33224fc8` — CI SUCCESS #1232/#1233.
Fail-closed: reserva parcial → compensa desta tentativa e bloqueia OP/CR/aprovação.
**Veredito: APROVADO** merge. Cursor não mergeia/deploya.

---

## REAFIRMAÇÃO CURSOR → CODEX — #92 `8d9ce6e5` (2026-09-28T11:46Z)

Mesmo HEAD do parecer 23:12Z. Checklist Grupo/Empresa, RBAC/RLS, idempotência, auditoria, **026 bloqueio** e guard #101: **OK**.
**APROVADO_COM_GATES**. Sem merge/implantação DEV por esta solicitação. Cursor não executa.

---

## #102 — owner autoriza descarte DEV dos 3 Pedidos teste (2026-09-28T09:48Z)

Sem inferir tipo pelo Produto. Execução condicionada a IDs privados, vínculos, backup, reconciliação, auditoria.
Cursor **não** executa. G1 fecha só com evidência. Tooling `d8f95baf` segue APROVADO_COM_GATES.

---

## PARECER CURSOR → CODEX — #102 APROVADO_COM_GATES (2026-09-27T23:28Z)

SHA `d8f95baf5b75d995512bd3af48c9771a3172190c` (base #92 `8d9ce6e5`) — CI #1220/#1221 + PG #81 SUCCESS.
Tooling 026 explícito/atômico/auditado **OK**. Apply DEV **BLOCKED** até plano privado+backup.
Cursor não mergeia/aplica. Navegação #101 ≠ acesso homologado.

---

## PARECER CURSOR → CODEX — lote #92/#93 APROVADO_COM_GATES (2026-09-27T23:12Z)

|#|SHA|CI|Veredito|
|---|---|---|---|
|#92|`8d9ce6e544b802528aea79ae843e6df4e69bf9f8`|#1214+#77|APROVADO_COM_GATES|
|#93|`264a61f479e77854e19f5e89ccb82e3e70bbd557`|#1216+#79|APROVADO_COM_GATES|

Merge main OK **só** com canais OFF e **sem** apply 025–033 até mapeamento 026 (DEV 3 Pedidos).
Ativação schema/canais **BLOCKED** (G1–G4). Guard #101 preservado.
Cursor não mergeia/deploya. Browser acesso ainda PENDENTE.

---

## #101 DEPLOY DEV COMPROVADO — browser PENDENTE (2026-09-27T22:16Z)

Main `d02cd012` APPLY+promote OK. API/SPA revision no merge.
**Acesso NÃO fechado** até prova owner Grupo/CPA/3Z/Comercial/Administração.
Observação: “Acesso negado” isolado no topo de Administração (Integrações carrega).

---

## #101 PÓS-MERGE — NÃO implantado (2026-09-27T21:16Z)

Merge `d02cd012` / CI SUCCESS. Codex: **ainda NÃO implantado** (política navegador p/ catálogo admin).
Cursor não deploya. Acesso só após promote + browser owner.

---

## #101 MERGED — aguarda deploy + browser (2026-09-27T20:58Z)

Merge `d02cd012948a597a734573ab0a5a7aed6d604a3b` (aprovado `4a5270a87c171db36cad8d9457c106960e938de8`). CI main SUCCESS `36349770102`.
Cursor **não** deploya. Acesso só fecha após promote + browser (Grupo/CPA/3Z/Comercial/Config).

---

## PARECER CURSOR → CODEX — #101 APROVADO 4a5270a8 (2026-09-27T20:32Z)

SHA `4a5270a87c171db36cad8d9457c106960e938de8` — CI SUCCESS (`36348110527` / `36348113765`).
B1/B2 fechados: hints Layout no schema (sem autoridade); árvore owner cobre Configurações.*/Segurança.
**Veredito: APROVADO** para merge + deploy controlado API/SPA **somente** neste SHA.
Cursor não mergeia/deploya. Browser owner (Grupo/CPA/3Z/Comercial/Config) ainda **PENDENTE**.

---

## PARECER CURSOR → CODEX — #101 BLOQUEADO d336734f (2026-09-27T20:18Z)

**REVOKED.** B1 (P1): aceitar `entity_name`/`operation`/`function_name` do Layout ou atualizar callers.
B2 (P2): alinhar árvore owner a `Sistema.Configurações.*` / `Segurança`.
Sem merge/deploy até novo HEAD+CI. Cursor não edita Codex.

---

## PARECER CURSOR → CODEX — #101 APROVADO d336734f — REVOGADO

~~APROVADO~~ → ver BLOQUEADO acima.

---

## DIRETRIZ LOTE COMERCIAL (2026-09-27T19:41Z)

Cursor: **só** parecer consolidado no HEAD final do lote #92/#93 (sem microcommits).
#100 deploy OK; browser owner **PENDENTE**. `4fea5a63` REVOKED.

---

## #100 DEPLOY DEV COMPROVADO — browser PENDENTE (2026-09-27T19:37Z)

Main `5dfa7562` APPLY+promote OK. Formulário de login entregue ao proprietário.
**Acesso NÃO fechado** até prova Grupo/CPA/3Z/Comercial/Administração.

---

## #100 DEPLOY EM CURSO (2026-09-27T19:33Z)

Main `5dfa7562` CI SUCCESS. Canário/promoção iniciados. Cursor não deploya.
Acesso só fecha após promote + browser (Grupo/CPA/3Z/Comercial/Config).

---

## #100 MERGED — aguarda deploy + browser (2026-09-27T19:31Z)

Merge `5dfa7562` (aprovado `e7ad20e1`). CI main em curso. Cursor não deploya.
Acesso só fecha após prova browser (Grupo/CPA/3Z/Comercial/Config).

---

## PARECER CURSOR → CODEX — #100 APROVADO e7ad20e1 (2026-09-27T19:30Z)

SHA `e7ad20e1f450c85b3d6e3b1948fae81a9e5003b6` — CI SUCCESS.
**Veredito: APROVADO** para merge + deploy controlado API/SPA **somente** neste SHA.
Contexto HTTP/Grupo/Empresa + permissões servidor. Cursor não deploya.
Acesso só fecha após login real (Grupo/CPA/3Z/Comercial/Config).

---

## MODO AUTÔNOMO (2026-09-27T19:14Z)

#99: MERGED; TTY proprietário; credencial não alterada. Cursor não captura senha.
#92/#93: aguarda **lote final** para parecer consolidado (sem micro-sync).
`4fea5a63` REVOKED.

---

## #99 PASSWORD no TTY do proprietário (2026-09-27T18:53Z)

Main `3e327ea0` CI SUCCESS; AUDIT PASS; procedimento parado no TTY privado.
Credencial **ainda não** alterada. Cursor não captura senha. Acesso pós-login real.

---

## #99 MERGED — aguarda PASSWORD TTY (2026-09-27T18:51Z)

Merge `3e327ea0` (aprovado `a19a81f5`). CI main em curso. Cursor **não** executa senha.
Acesso só fecha após login real. Comercial 360: revisão só no **SHA final do lote** (#92 diretriz).

---

## REAFIRMAÇÃO → CODEX — #99 APROVADO a19a81f5 (2026-09-27T18:50Z)

**APROVADO** `a19a81f50307bbc3ceec0bbc89e36531a05694c9` (CI SUCCESS). Prosseguir merge exact HEAD + PASSWORD (TTY proprietário).
`39d3b905` revogado. Cursor não executa. Sem senha em chat/env.

---

## PARECER CURSOR → CODEX — #99 APROVADO a19a81f5 (2026-09-27T18:42Z)

SHA `a19a81f50307bbc3ceec0bbc89e36531a05694c9` — CI SUCCESS. B1/B2 fechados.
**Veredito: APROVADO** para merge + `OWNER_ACCESS_MODE=PASSWORD` **somente** neste SHA.
TTY privada do proprietário; sem BOOTSTRAP/nova Auth/API/SPA. Cursor não executa.
`39d3b905` permanece revogado. Acesso só fecha após login real.

---

## PARECER CURSOR → CODEX — #99 BLOQUEADO 39d3b905 (2026-09-27T18:36Z)

**REVOKED.** B1 (P1): validar role/admin/GROUP/perms antes do PUT password.
B2 (P2): parse 2xx ambíguo → `unconfirmed_no_automatic_retry` + audit.
Sem merge/PASSWORD até novo HEAD+CI. Cursor não edita Codex.

---

## PARECER CURSOR → CODEX — #99 APROVADO 39d3b905 — REVOGADO

~~APROVADO~~ → ver BLOQUEADO acima.

---

## SELO CI — #92 ac0f25c9 / #93 ba83d7bf (2026-09-27T18:14Z)

Ambos **SUCCESS**. Sync #98 **OK**; merge/ativação **BLOCKED**. Browser owner **PENDENTE**.

---

## REVISÃO — #92 ac0f25c9 / #93 ba83d7bf (2026-09-27T18:12Z)

Sync main `#98` nas omnicanal: **OK** (sem delta comercial). Merge/ativação **BLOCKED**.
CI **SUCCESS** (selo 18:14Z). Deploy #98 OK; browser owner **PENDENTE**.

---

## #98 DEPLOY DEV COMPROVADO — browser PENDENTE (2026-09-27T18:07Z)

Main `9ed1a30e` APPLY EXIT0 + promote + pós-check DB OK ([#98 comment 5858407946](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/98#issuecomment-5858407946)).
**Acesso NÃO fechado** até login real do proprietário (CPA/3Z, Comercial/Config, Bearer sessão).
#92/#93: CI SUCCESS; merge/ativação **BLOCKED**. `4fea5a63` **REVOKED**.

---

## SELO CI + APPLY #98 (2026-09-27T18:05Z)

#92 `01798e71` e #93 `ee59f04d`: CI **SUCCESS**; sync OK; merge/ativação **BLOCKED**.
#98 MERGED `9ed1a30e`; main CI SUCCESS; APPLY concluído (ver topo).
`4fea5a63` permanece **REVOKED**.

---

## ESCLARECIMENTO — #96 `4fea5a63` NÃO APROVADO (2026-09-27T18:05Z)

**Não registrar APROVADO de `4fea5a639f839c94fc2a5a24dc582b2e0b847662`.**
Esse SHA foi **REVOKED** (B1–B4). Aprovação vigente foi `23252cc9` (já MERGED na #96).
Follow-up APPLY: #98 `bb7df2db` (já MERGED). Cursor **não** consegue comentar na #96 (403).
Canônico: STATUS + este HANDOFF + [#97](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/97).
Próximo gate: APPLY #98 + browser proprietário. Não reabrir `4fea5a63`.

---

## PARECER CURSOR → CODEX — #98 APROVADO bb7df2db (2026-09-27T15:00Z)

SHA `bb7df2dbe59f184600396abb7cdd99ce70bb93dd` — CI SUCCESS. Sem `pg_read_file`.
**Veredito: APROVADO** para merge + re-APPLY controlado (canário/identidade/grant/promote).
Cursor não faz deploy. Novo HEAD invalida. (#98 já MERGED `9ed1a30e`.)

---

## PARECER CURSOR → CODEX — #96 APROVADO 23252cc9 (2026-09-27T14:33Z)

SHA `23252cc97c7dd9dd4de60f8f88304ecdcbffabae` — CI SUCCESS. B1–B4 fechados.
**Veredito: APROVADO** para merge + `OWNER_ACCESS_MODE=APPLY` **somente** neste SHA.
Ordem: AUDIT IDs → backup → canário (identidade DB) → grant → promote imagens testadas → browser proprietário.
Cursor não faz deploy. `4fea5a63` permanece revogado. Novo push invalida. (#96 já MERGED `56dae696`.)

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
