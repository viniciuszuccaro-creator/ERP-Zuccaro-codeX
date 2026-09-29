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

A candidata revisável contra `main` é a branch `cursor/comercial360-candidata-main-53c4`. O código de runtime dela é exatamente `6218511a`. O commit posterior a esse SHA é só este registro. A pilha draft #114–#151 permanece como está; a CI isolada de cada degrau continua válida só para o seu delta, e a CI desta candidata é a do conjunto contra `main`.

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

1. **Candidata Comercial contra `main`.** Revisar o conjunto cujo código é `6218511a` (PR da branch `cursor/comercial360-candidata-main-53c4`). A CI desse PR é a CI do conjunto #114–#151, no lugar da CI isolada de cada draft. Migrations que entram: 029, 030, 031. Sem 025–028, sem 033, sem 034.
2. **#141 (`b8a9f493`) em seguida.** Sem editar `codex/legado-integracao-candidata`. Sem reaplicar o fix `b8a9f493`. O único arquivo a resolver na integração é `STATUS_DO_PROJETO.md`. Schema da #141 continua em 024; 029–031 já estarão em `main` se o passo 1 tiver sido aceito.
3. **#92 (`8d9ce6e5`) num lote próprio, depois dos passos 1 e 2.** Fora da #141 e fora da candidata Comercial. O lote resolve os 9 conflitos de Orçamento/Pedido e relê o auto-merge de `router.ts` e do teste `runtime08c`. Migrations 025–028 e 033 entram nesse lote, depois de 029–031.
4. **#132 (`29211815`) somente depois da #92.** Fora da #141. Migration 034 entra nesse lote. Código legado de produto permanece não único, para reconciliação explícita.

Enquanto esta ordem não for aceita: não mergear #151 nem os degraus #114–#150 na `main` por engano de base; não mergear #141; não abrir gate de VPS; não aplicar 025–034 fora da CI efêmera já prevista em cada PR.

## Fora desta ordem

Linhas abertas que não são o conjunto Comercial nem a #141 (omnicanal #68–#90, onda 6 #64–#67, handoff e demais drafts) ficam de fora até uma ordem posterior. Não entram no HEAD `6218511a`.
