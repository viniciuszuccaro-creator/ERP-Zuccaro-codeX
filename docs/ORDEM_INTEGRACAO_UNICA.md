# Ordem única de integração — Comercial 360 × #141 × #92/#132

Registro de coordenação em 2026-09-29. Este documento congela o HEAD funcional e define a única ordem de integração antes de qualquer merge ou gate de VPS.

Nada neste registro autoriza merge, push em `main`, edição da branch da #141 ou aplicação de migration em DEV/VPS.

## Heads congelados

| Linha | PR | Branch | HEAD | Papel |
|---|---|---|---|---|
| `main` | — | `main` | `d02cd012948a597a734573ab0a5a7aed6d604a3b` | Base comum (merge de #101). Migrations 001–024. |
| Comercial consolidada | #114→#151 | `cursor/comercial360-onda3-network-retry-392b` | `6218511a19b43f7ca87ed32b89d48dcfbd4ee195` | HEAD funcional de código. 116 commits e 101 arquivos à frente de `main`. |
| Legado / Onda 7 | #141 | `codex/legado-integracao-candidata` | `b8a9f4936bdd46c48c754ab450ec22f275093ee4` | Candidata legada. CI [36617354170](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/actions/runs/36617354170) SUCCESS no mesmo SHA (correção de alias dinâmico no staging). Branch intocável por este registro. |
| Omnicanal | #92 | `codex/comercial-omnicanal-contratos-canonicos` | `8d9ce6e544b802528aea79ae843e6df4e69bf9f8` | Fora da #141. 58 commits à frente de `main`. |
| Código legado de produto | #132 | `codex/produto-codigo-legado` | `29211815c7fe81fbdfcfe0dcb6a6a7d60b429ed8` | Fora da #141. Base = branch da #92. Delta de 3 commits. |

Ancestralidade verificada com `git merge-base --is-ancestor`:

- #92 não é ancestral da #141.
- #132 não é ancestral da #141.
- A cadeia Comercial e a #141 divergem em `main` (`d02cd012`). Nenhuma contém a outra.

A candidata revisável contra `main` é a PR **#152** (`cursor/comercial360-candidata-main-53c4`). O código de runtime dela é exatamente `6218511a`. Os commits posteriores a esse SHA são só este registro. A pilha draft #114–#151 permanece como está; a CI isolada de cada degrau continua válida só para o seu delta.

CI do conjunto em `11a5914a`: SUCCESS. [pull_request 36618417250](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/actions/runs/36618417250) (frontend e backend) e [push 36618410386](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/actions/runs/36618410386) (frontend e backend). Esse resultado não autoriza merge.

## Cadeia Comercial (ancestral linear até `6218511a`)

#114 tem base `main`. Cada PR seguinte tem base na branch da anterior. Todas draft. SHAs conferidos como ancestrais de `6218511a`.

| PR | Tip | Migration |
|---|---|---|
| #114 | `53900f3d` | — |
| #116 | `00bd7c85` | — |
| #117 | `9bb3bccc` | — |
| #118 | `8cea7778` | — |
| #120 | `5b444a69` | — |
| #122 | `d82c7096` | — |
| #124 | `7c70de69` | — |
| #126 | `45195749` | **029** condição |
| #127 | `8fba0782` | — |
| #129 | `6f42f061` | **030** promoção |
| #130 | `080dd951` | — |
| #131 | `1682f686` | **031** tabela de preço |
| #133 | `70576db7` | — |
| #134 | `fa362ff0` | — |
| #135 | `5b559c9a` | — |
| #136 | `a1b78672` | — |
| #138 | `90a76433` | — |
| #139 | `3da72df5` | — |
| #140 | `f5009c7c` | — |
| #142 | `d7871c23` | — |
| #143 | `4777b4fb` | — |
| #144 | `01ee61de` | — |
| #145 | `73279042` | — |
| #146 | `c1fdf63d` | — |
| #147 | `0e7111af` | — |
| #148 | `c38a768d` | — |
| #149 | `50dc8b5c` | — |
| #150 | `33c3b456` | — |
| #151 | `6218511a` | — |

Números entre #114 e #151 que não estão nessa lista pertencem a outras linhas (legado que alimenta a #141, ensaios, ou #132). Eles não são degraus da candidata Comercial.

## Migrations 025–034

| Número | Onde está | Efeito |
|---|---|---|
| 025 | só #92 | `pedidos`: origem, canal, external_id, idempotency_key; `origem` NOT NULL |
| 026 | só #92 | `pedidos.tipo_comercial` e snapshot no item |
| 027 | só #92 | `orcamentos`: versão; status `EM_ABERTO`/`CANCELADO`/`SUPERSEDIDO`; unicidade passa de `(empresa_id, numero)` para `(empresa_id, numero, versao)` |
| 028 | só #92 | `orcamentos`: origem, canal, external_id, idempotency_key, campanha |
| 029 | só Comercial (#126) | snapshot de condição em Orçamento/Pedido; `tabela_preco_id` no Orçamento; recria `assert_orcamento_same_tenant` |
| 030 | só Comercial (#129) | snapshot de promoção |
| 031 | só Comercial (#131) | snapshot código+nome de TabelaPreco |
| 032 | inexistente | lacuna reservada; nenhum branch a ocupa |
| 033 | só #92 | RLS em `integration_events` |
| 034 | só #132 | `produtos.codigo_legado` nullable, não único |

`main` e a #141 param em **024**. Os números 025–028, 029–031, 033 e 034 não colidem entre si. A #141 não traz 025–028 nem 034.

Dependência de schema, separada do conflito git:

- 029–031 aplicam em cima de 024. Esse é o estado de `main` e da #141. Não exigem 025–028 para o SQL aditivo.
- 029 recria a função de tenant do Orçamento e não lê colunas de origem/versão. Convive com 025–028 no catálogo, desde que 029 rode depois de 016 e não seja sobrescrita por outra cópia da mesma função.
- 027 troca a unicidade do número do Orçamento. O código Comercial em `6218511a` grava Orçamento com status `EM_ABERTO`/`CANCELADO` e não conhece `versao`. O SQL de 027 cabe nos status atuais; o código não faz merge limpo com #92.
- 025 torna `pedidos.origem` obrigatória. Os inserts da cadeia Comercial não preenchem essa coluna. #92 não pode ser aplicada em silêncio sobre o HEAD comercial.
- 034 só acrescenta coluna nullable em `produtos`. Não altera Orçamento/Pedido nem 029–031.

## Conflitos (`git merge-tree --write-tree`, exit 1)

### Comercial `6218511a` × #141 `b8a9f493`

Único conflito de conteúdo: `STATUS_DO_PROJETO.md`.

Os 30 arquivos da #141 e os 101 da Comercial se cruzam só nesse documento. O código faz merge limpo. A #141 permanece MERGEABLE contra `main` hoje; deixará de ser um merge trivial de documentação se a candidata Comercial entrar em `main` antes, e o inverso vale para o `STATUS` desta candidata.

A resolução desse arquivo fica para o merge futuro, num commit de integração. A branch `codex/legado-integracao-candidata` não recebe esse commit.

### Comercial `6218511a` × #92 `8d9ce6e5`

Conflito de conteúdo nestes 9 arquivos:

- `server/src/repositories/inMemoryOrcamentoRepository.ts`
- `server/src/repositories/inMemoryPedidoRepository.ts`
- `server/src/repositories/orcamentoTypes.ts`
- `server/src/repositories/pedidoTypes.ts`
- `server/src/repositories/postgresOrcamentoRepository.ts`
- `server/src/repositories/postgresPedidoRepository.ts`
- `server/src/services/orcamentoService.ts`
- `server/src/services/pedidoService.ts`
- `server/tests/runtime01.test.ts`

Também houve edição dos dois lados, com auto-merge git, em `server/src/api/router.ts` e `server/tests/runtime08c-orcamento-postgres-e2e.test.ts`. Auto-merge não dispensa leitura humana desses dois arquivos no lote que integrar #92.

### Comercial `6218511a` × #132 `29211815`

Os conflitos de código são os mesmos 9 herdados da #92. O delta da #132 não acrescenta conflito de schema com 029–031. `server/tests/runtime03.test.ts` aparece nos dois diffs e o merge-tree não o marcou como conflito; a leitura humana entra no lote posterior a #92.

### #141 × #92 e #141 × #132

Único conflito de conteúdo: `STATUS_DO_PROJETO.md`. #92 e #132 continuam fora da branch da #141.

## Ordem única

Executar só depois de revisão humana desta ordem. Este registro não executa nenhum passo.

1. **Candidata Comercial contra `main`.** Revisar o conjunto cujo código é `6218511a` (draft #152). A CI do conjunto já está SUCCESS em `11a5914a` ([36618417250](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/actions/runs/36618417250)). Migrations que entram: 029, 030, 031. Sem 025–028, sem 033, sem 034. O passo continua sem merge até revisão humana.
2. **#141 (`b8a9f493`) em seguida.** Sem editar `codex/legado-integracao-candidata`. Sem reaplicar o fix `b8a9f493`. O único arquivo a resolver na integração é `STATUS_DO_PROJETO.md`. Schema da #141 continua em 024; 029–031 já estarão em `main` se o passo 1 tiver sido aceito.
3. **#92 (`8d9ce6e5`) num lote próprio, depois dos passos 1 e 2.** Fora da #141 e fora da candidata Comercial. O lote resolve os 9 conflitos de Orçamento/Pedido e relê o auto-merge de `router.ts` e do teste `runtime08c`. Migrations 025–028 e 033 entram nesse lote, depois de 029–031.
4. **#132 (`29211815`) somente depois da #92.** Fora da #141. Migration 034 entra nesse lote. Código legado de produto permanece não único, para reconciliação explícita.

Enquanto esta ordem não for aceita: não mergear #151 nem os degraus #114–#150 na `main` por engano de base; não mergear #141; não abrir gate de VPS; não aplicar 025–034 fora da CI efêmera já prevista em cada PR.

## Fora desta ordem

Linhas abertas que não são o conjunto Comercial nem a #141 (omnicanal #68–#90, onda 6 #64–#67, handoff e demais drafts) ficam de fora até uma ordem posterior. Não entram no HEAD `6218511a`.

## Ensaio integrado Codex sem merge na main

- Branch `codex/integracao-comercial-legado-20260929` criada de `main` `d02cd012`. Foram integrados, somente nela, os HEADs exatos #152 `2b34338e` e #141 `b8a9f493`. O conflito de `STATUS_DO_PROJETO.md` foi resolvido preservando os registros de ambas as frentes; nao houve conflito de codigo entre essas duas candidatas.
- O ensaio seguinte com #92 `8d9ce6e5` foi interrompido sem commit. Conflitaram `STATUS_DO_PROJETO.md`, os tipos, repositories e services de Orcamento/Pedido e `runtime01.test.ts`; nenhuma resolucao automatica por "ours/theirs" foi aceita. A #132 depende da #92 e nao entrou.
- A integracao de #92 exige compor origem/idempotencia/versoes com snapshots de condicao, promocao e tabela, e testar especialmente insert com `pedidos.origem` obrigatoria, conversao Orcamento→Pedido, tenant, auditoria e rollback. Migrations 025–028/033 nao foram aplicadas na VPS ou no DEV. CI da branch parcial comprova somente #152 + #141, nunca o conjunto de quatro candidatas.

### Contrato de compatibilidade pendente para #92 e #132

- O ensaio repetido sobre a branch da #153 (`eb282195`) confirmou conflitos de conteudo em `STATUS_DO_PROJETO.md`, oito arquivos de tipos/repositorios/services de Orcamento e Pedido, e `runtime01.test.ts`. `router.ts` e o E2E R08C tiveram auto-merge e ainda exigem revisao semantica. O merge foi abortado sem commit; #153 permanece limpa e com CI verde [36622636311](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/actions/runs/36622636311), incluindo PostgreSQL efemero e staging sintetico.
- A migration 025 preenche `pedidos.origem` e depois exige `NOT NULL`; a 026 recusa aplicar em banco que ja contenha Pedidos sem classificacao historica comprovada. Uma CI que cria banco vazio nao prova esse precheck em DEV. Antes do gate, exigir contagem/classificacao sanitizada de todos os Pedidos historicos, backup restauravel e ensaio isolado com a mesma topologia de dados. Nao inferir tipo comercial pelo Produto atual.
- A migration 027 substitui a unicidade `(empresa_id, numero)` por `(empresa_id, numero, versao)` e permite `SUPERSEDIDO`. A composicao deve preservar a sequencia por Empresa, um unico `EM_ABERTO` por numero, snapshots comerciais por versao, conversao idempotente para Pedido e trilha de auditoria. A migration 028 acrescenta origem/canal/idempotencia ao Orcamento sem permitir que input externo altere tenant ou valores do servidor.
- O lote de reconciliacao precisa executar, no mesmo candidato: testes de create/update/cancel/versao/conversao e ingress omnicanal; RBAC e tenant A/B; concorrencia/idempotencia; rollback de auditoria; E2E PostgreSQL com migrations 025–031/033/034; e compatibilidade com dados historicos sinteticos antes de pedir revisao final. A #132 so pode entrar apos a #92, preservando `codigo_legado` de Produto como proveniencia, sem sobrescrever o codigo interno.

## Checkpoint de composição posterior (2026-09-30)

Este checkpoint substitui os HEADs históricos acima apenas para **planejamento**, não aprova merge ou operação. #155 integrou os contratos #92/#132 em `c717628f86fa7559e315b666c94c157eeafa0a7d`; `erp-runtime-ci` 36635617839 e `omnicanal-postgres` 36635617443 passaram nesse SHA. O endurecimento do contrato de custo está em #177, baseada na #155, e depende da CI do seu HEAD final. #175 (anexos técnicos, `ea4d057167b4c5b904edbdf902126569c02b110e`, CI 36645652566 SUCCESS) e #176 (lease da outbox de Produto, `b39cbeb79447c8943fd8acd21a63350ca610037b`, CI 36655482468 SUCCESS) continuam em branches próprias, sem merge. #104 permanece congelada em `87101b4dd184326ce7cdb915d4b2d8947e028244`.

Comparação somente de árvore (`git merge-tree --write-tree`) da #177 contra #175 e contra #176 encontrou conflito de conteúdo apenas em `STATUS_DO_PROJETO.md`; nenhum merge foi executado. Isso prova apenas a ausência de conflito textual adicional nesses pares, **não** a compatibilidade semântica do runtime combinado. A #175 mantém upload técnico HTTP bloqueado até contrato canônico de Storage/DAM e não autoriza produção/IA. A #176 não ativa worker ou canal externo. Crédito continua sem porta proprietária Financeiro/ClienteEmpresa; não inferir limite a partir do cadastro mestre nem liberar venda a prazo como se houvesse análise de crédito.

Pacote mínimo para um futuro candidato integrado, em branch de integração **após autorização e revisão das PRs**:

1. Fixar SHA de cada PR e resolver `STATUS_DO_PROJETO.md` preservando todos os checkpoints; revisar os contratos cruzados, não usar `ours/theirs` indiscriminado. Verificar conflito e compatibilidade da #104 separadamente antes de incluí-la.
2. Rodar lint, typecheck, build, suites HTTP de Pedido/Orçamento, anexos e outbox, mais E2E PostgreSQL efêmero do conjunto exato. Exercitar tenant Grupo/Empresa A/B, RBAC, custo inválido, falha de auditoria, retry/idempotência e ausência de persistência/efeitos posteriores nos erros. Exigir CI e parecer independente do **SHA combinado**, não somar CIs individuais.
3. Antes de qualquer gate VPS: provar diretamente SHA/image ID efetivos de API e SPA, migrations registradas, conexão/tenant reais e estado de canais, sem inferir execução a partir de PR, CI ou handoff. Conferir classificação histórica requerida pela migration 026 e contagens sanitizadas por Empresa; backup restaurável do destino e reversão separada de API/schema; precheck de rede, banco, Auth/RBAC e portas conforme `docs/OPERACAO_DEV_VPS.md`.
4. Só com autorização específica para esse SHA, alvo e janela: ensaio isolado, migration aditiva controlada, canário, smoke HTTP/PostgreSQL e eventual promoção. Não executar importação real, mudança VPS ou ativação de upload/worker por força deste documento.

## Gate do parecer #155 e histórico da migration 026 (2026-09-30)

O Cursor reprovou #155 `c717628f` pelos achados de cadeia de conversão, edição retroativa de Pedido, tipo especial sem contrato, recibo `SUPERSEDIDO` e 026 em base com Pedidos. Correção candidata posterior deve ser revisada e ter CI no seu próprio SHA; a CI verde de #155/#177 não remove esse parecer. #175 também está reprovada e não participa de composição; #176 teve parecer favorável somente ao contrato interno, sem worker externo.

A migration 026 **permanece fail-closed** diante de `pedidos`/`pedido_itens` preexistentes sem classificação histórica. O teste sintético `omnichannel-rls-postgres.test.ts` já prova, em PGlite e PostgreSQL real na CI, que 026 aborta antes do DDL, não registra `schema_migrations`, preserva as linhas e só aceita uma classificação explícita de ensaio. Isso não constitui mapa do destino nem autorização de backfill. Como 025 pode ter sido registrada antes da falha de 026, o precheck do gate deve ocorrer **antes de iniciar 025** e inventariar migrations e Pedidos por Grupo/Empresa, incluindo itens sem tipo e divergências entre cabeçalho/itens. Não inferir pelo Produto atual.

Plano para um destino com histórico: backup restaurável e hash, cópia privada isolada, extração sanitizada de contagens por Empresa, classificação explícita por documento/item com origem e responsável, reconciliação de totais e exceções, aprovação do mapa e ensaio idempotente em staging. Só então propor migration/backfill aditivo específico e testar repetição, falha e reversão nessa cópia. Se qualquer linha continuar ambígua, bloquear 025–034 no destino; não publicar o mapa real nem os dados no GitHub. Versão de código aprovada, versão efetiva da VPS e dados importados são três evidências distintas.

ARMADO/CORTE_DOBRA em conversão de Orçamento segue gate separado: o Orçamento atual não persiste tipo especial/requer produção por item. É inseguro derivá-los do Produto vivo ou de texto livre. A alteração de schema não foi incluída neste lote sem contrato e teste completo de persistência, RBAC, auditoria e histórico; até lá, essa conversão não deve ser homologada como suporte a tipos especiais.
