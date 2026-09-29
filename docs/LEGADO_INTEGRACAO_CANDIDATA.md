# Candidata de integracao legado e Onda 7 (2026-09-29)

## Baseline e escopo

- Base: `main` em `d02cd012948a597a734573ab0a5a7aed6d604a3b`.
- Fonte da candidata: PR #137 em `ae4c5a1c42d57b3f450665e9a72c7b6c566ff7b1`.
- O merge de ensaio em branch separada nao apresentou conflitos textuais. Isto nao substitui CI, revisao cruzada nem gate de dados reais.
- Nenhuma PR foi mesclada na `main`; nenhuma migration foi executada na VPS, backup lido ou registro importado no ERP operacional.

## Ordem de integracao comprovada pela ancestralidade Git

| Ordem logica | PR | Contribuicao | Observacao |
| --- | --- | --- | --- |
| 1 | #104 | Fluxo de Pedido, reserva/compensacao de estoque, faturamento e entrega da Onda 7 | Homologada pelo Cursor em `87101b4d`; congelar esse HEAD. |
| 2 | #106 | Inventario legado somente leitura e protecoes contra vazamento | Nao representa extracao nem importacao. |
| 3 | #107 | Preflight de escopo e reconciliacao atomica em memoria | Base da #108 e da #111. |
| 4 | #108 | Contrato entre mapeador e staging | Depende da #107. |
| 5 | #109 | Retry/conflito entre lotes sinteticos | Apesar do nome da branch, nao comprova staging persistente real. |
| 6 | #111 | Contagens, dependencias e vinculo empresarial comprovado | Incorporada depois da #109 no ensaio da cadeia; sem inferir emissor por `001`. |
| 7 | #48 | Mapeador sintetico do Cursor e contrato de escopo do legado | Incorporado por merge na #128; a #48 isolada consta conflituosa com a `main`. Nao editar sua branch. |
| 8 | #123/#125 | Ensaio combinado com #104, banco isolado e unicidade dos mestres | Incluidos na ancestralidade da #137. |
| 9 | #128 | Integra mapeador #48 ao adaptador Codex e prova staging PostgreSQL temporario | Nao persiste backup real. |
| 10 | #137 | Fornecedor, lote all-or-none, contagens obrigatorias e hardening da revisao Cursor | HEAD fonte da candidata; requer CI e novo parecer consolidado. |

Os HEADs de #104, #48, #106-#109, #111, #125 e #128 sao ancestrais da branch #137. Portanto, nao mesclar sequencialmente essas PRs na `main` depois de integrar a candidata: isso repetiria historico e poderia reabrir conflitos. Revisar esta candidata como uma unidade; so entao decidir a integracao humana. As PRs de origem permanecem abertas/draft ate a decisao.

## Dependencia separada: Produto com codigo legado

A #132 (`29211815c7fe81fbdfcfe0dcb6a6a7d60b429ed8`) nao e ancestral da #137. Sua base e a #92 (`8d9ce6e5`) e ela adiciona `codigo_legado` ao Produto canonico com migration 034 e testes. A candidata atual **nao** inclui #92/#132 nem a migration 034. Antes de promover qualquer Produto de revenda do staging para o cadastro operacional, integrar/revisar #92 e #132 na ordem, validar a migration em ambiente isolado, preservar codigo antigo e conferir conflito de codigos. Nao adicionar essa cadeia ao ensaio legado por hipotese.

## Conflitos, gates e limites da prova

- No merge de ensaio #137 -> `main` houve zero arquivos em conflito; o diff altera status, mapper/staging, workflow e fluxo Pedido/Estoque/Faturamento/Entrega. A ausencia de conflito textual nao prova compatibilidade de comportamento.
- A #48 isolada registra `mergeable=false`; sua integracao no historico da #128 resolveu o caminho combinado. Qualquer avanco da `main` exige novo fetch, diff e CI da candidata.
- A CI da candidata deve confirmar frontend, backend, migrations/test:postgres efemeros, staging PostgreSQL isolado e API R07B sobre schema de teste. Esses testes nao provam staging persistente nem dados do HD.
- Consulta somente leitura aos relatorios privados locais em `04_REPORTS` (2026-09-29), sem abrir registros: o resumo de validacao humana registra 3 decisoes confirmadas, 0 pendentes, `mappingApproved=true` e `importAuthorized=false`; o mapa de aliases tem 3 entradas e o dry-run marcou 0 escritas. Isto aprova a identidade dos aliases no escopo daquele mapa, nao atribui automaticamente cada operacao historica a uma empresa.
- O relatorio SQL de identidade das 15:31 registrava 5 linhas, 3 CNPJs validos e 3 vinculos ainda nao resolvidos naquele momento. A validacao humana posterior, das 15:49, registra 3 decisoes confirmadas e 0 pendentes no mapa de aliases; o dry-run posterior, das 17:34, marcou 0 escritas. Nao tratar o diagnostico SQL anterior como pendencia atual dos aliases nem estender essa aprovacao a cada operacao historica. Para Pedido, estoque, contas e notas, ainda e necessario comprovar coluna/origem efetiva e Empresa juridica por conjunto; codigo de seletor `001`/`002`/`005` sozinho nao basta. Registros sem essa prova ficam em quarentena. `003` e Grupo, nunca emissor.
- Antes de carga real: extracao controlada fora do Git, destino staging isolado, contagens por entidade/empresa, conflitos, dependencias, backup restauravel do destino, reconciliacao e plano de reversao; gate humano especifico para importar no banco operacional.
