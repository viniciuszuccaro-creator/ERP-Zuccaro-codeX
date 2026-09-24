# Comercial 360 V1 - Execucao Autonoma

## Controle

- Versao: `COMERCIAL 360 V1`
- Branch: `codex/comercial-360`
- PR: `#33`
- Base historica obrigatoria: `a329c8751323890fd5737e4d3f6d659b10dca52c`
- Politica: checkpoints pequenos, estaveis, testados, commitados e enviados ao remoto.
- Restricoes: sem merge, VPS, porta 3080, migration remota, dados reais, backup legado ou credenciais.

## Fila executavel

| ID | Objetivo | Dependencias | Arquivos/componentes | Criterios de aceite | Testes obrigatorios | Riscos | Rollback | Status | Commit | Workflow CI | Resultado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C360-V1-01 | Consolidar a fila oficial e o baseline | A3.1 e CI aprovados | este documento; `STATUS_DO_PROJETO.md` | estado real documentado e fila versionada | `git diff --check` | divergencia entre documento e Git | revert do commit documental | CONCLUÍDO | registrado no Git | pendente | documento e status criados |
| C360-V1-02 | Fechar pesquisa e filtros de Orcamento | HTTP e frontend A3.1 | service/repositories/rotas; `OrcamentosTab.jsx` | pesquisa e filtros tenant-scoped, paginados e compatíveis com backend | unitarios, HTTP, frontend, PostgreSQL CI | KPI/lista divergente; filtro cross-tenant | revert do checkpoint | CONCLUÍDO | registrado no Git | pendente | filtros por numero/status/cliente/validade implementados |
| C360-V1-03 | Recursos operacionais do Orcamento | C360-V1-02 | componentes Comercial e helpers existentes | visualizacao de impressao/PDF com empresa, cliente, itens, totais, condicao, validade, observacoes, status e numero; compartilhamento preparado sem segredo | frontend e smoke sanitizado | PII em URL/log; layout inconsistente | desativar somente a acao adicionada | CONCLUÍDO | registrado no Git | pendente | impressao/PDF e textos revisaveis implementados; envio externo bloqueado por credencial |
| C360-V1-04 | Dominio e persistencia canonicos de Pedido | C360-V1-03; cadastros mestres | tipos/repositorios; migration 017 se indispensavel | agregado tenant-scoped, sequencia por Empresa, snapshots, totais sem float, historico, RLS/FORCE e constraints | contratos memoria/PG e migration estrutural | duplicacao do Pedido legado; regra comercial | rollback documentado da migration | CONCLUÍDO | registrado no Git | pendente | tipos e repositorios memoria/PG; migration 017 somente no repositorio |
| C360-V1-05 | Conversao Orcamento para Pedido | C360-V1-04 | services/repositorios/auditoria | transacional, idempotente, vinculo preservado e rollback integral | unitarios e PostgreSQL efemero | pedido duplicado; snapshot divergente | rollback transacional | CONCLUÍDO | registrado no Git | pendente | PedidoService converte com vinculo unico, snapshots, RBAC e auditoria |
| C360-V1-06 | Backend HTTP de Pedido | C360-V1-05 | service, repositories, routes e metadata | CRUD permitido, status, cancelamento, conversao e historico com RBAC/auditoria | HTTP, seguranca, contratos e PG CI | exposicao sem RBAC; vazamento tenant | revert das rotas e composicao | CONCLUÍDO | `d81a811f` | `35664399576` | backend HTTP, migration 017 e R09 verdes |
| C360-V1-07 | Frontend funcional de Pedido | C360-V1-06 | modulo Comercial e cliente HTTP | lista, busca, filtros, create/detalhe/update/historico/cancelamento/conversao com RBAC visual | frontend e smoke | persistencia paralela; cache cruzado | revert do checkpoint frontend | CONCLUÍDO | `0040e994` | `35666828387` | painel HTTP integrado; legado preservado como fallback |
| C360-V1-08 | Fluxo comercial inicial | C360-V1-06/07 | dominio, service e UI de Pedido | transicoes validas, `FINALIZADO` visivel, historico e contratos downstream sem integracoes falsas | estados, RBAC, rollback e HTTP | ambiguidade de producao/entrega | manter Pedido em estado anterior | CONCLUÍDO | `0040e994` | `35666828387` | workflow entrega/retirada/producao/finalizado ativo |
| C360-V1-09 | Cobertura de seguranca e regressao | C360-V1-02..08 | suites existentes | Grupo/Empresa, RBAC, wildcard, auditoria, rollback, sequencia, idempotencia, filtros e valores cobertos | suites frontend/backend/PG | falsa aprovacao por skip | revert apenas dos testes incorretos | CONCLUÍDO | `0040e994` | `35666828387` | frontend 588/588; backend local 138/138 aplicaveis; PostgreSQL CI sem skip |
| C360-V1-10 | Homologacao tecnica | C360-V1-09 | scripts existentes | todos os checks aplicaveis verdes e skips explicados | audit, test, lint, typecheck, build, diff-check, PG16, smoke | baseline historico fora do lote | registrar bloqueio comprovado | CONCLUÍDO | `0040e994` | `35666828387` | frontend/backend, migrate, seed sintetico e test:postgres SUCCESS |
| C360-V1-11 | Preparacao de deploy sem VPS | C360-V1-10 | docs/scripts operacionais existentes | checklist, canario, smoke, rollback, variaveis, imagem, backup e gates documentados | lint/sintaxe de scripts e diff-check | comando destrutivo ou segredo | revert documental/scripts | CONCLUÍDO | `3c96bb67` | `35667460162` | runbook e scripts parametrizados; CI frontend/backend SUCCESS |
| C360-V1-12 | Fechamento da versao | C360-V1-11 | status, handoff e PR #33 | remoto sincronizado, CI completa verde, docs factuais, PR nao mesclada | workflow final frontend/backend/PG | declarar pronto sem evidencia | reabrir checkpoint afetado | CONCLUÍDO | commit de fechamento | `35667460162` | versao fechada sem merge, VPS ou dados reais |

## Baseline comprovado antes desta fila

- Fundacao e frontend funcional de Orcamento: concluidos nos checkpoints A1 ate A3.1.
- Commit funcional A3.1: `d4da33f4c36caa2f4d456ede3983990283ae0b99`.
- Commit de status/CI: `6f48f80950525b87d8c4369afd1d8d2712a2d787`.
- Workflow funcional: `35657166381`, frontend e backend `SUCCESS`.
- PostgreSQL efemero: migrations 001-016 sem pendencias; R08B 2/2 e R08C 2/2, sem falha ou skip.
- Nenhuma migration foi aplicada na VPS e a porta 3080 nao foi alterada.

## Regras de atualizacao

1. Marcar somente um checkpoint de implementacao como `EM EXECUCAO`.
2. Preencher commit, workflow e resultado somente com evidencia observada.
3. Em falha corrigivel, corrigir e repetir sem pular checkpoint.
4. Em bloqueio real, concluir e enviar todo trabalho independente antes de registrar `BLOQUEADO`.
5. Nao mesclar a PR #33 durante esta versao.
