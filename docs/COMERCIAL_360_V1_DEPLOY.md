# Comercial 360 V1 - Preparacao de deploy

Este documento prepara o gate futuro e nao autoriza acesso a VPS, merge, migration, seed, promocao ou alteracao da porta 3080. Seguir tambem `OPERACAO_DEV_VPS.md` e `HANDOFF_ATUAL.md`.

## Artefato candidato

- Fonte: merge futuro da PR #33 na `main`; nunca construir a imagem oficial a partir da branch.
- Tag: imutavel, contendo o `MERGE_SHA`, por exemplo `erp-zuccaro-erp-api:comercial360-main-<sha8>`.
- Runtime esperado: definir `EXPECTED_RUNTIME` conforme `/api/v1/meta` da `main` revisada.
- Migrations novas: `016_orcamentos_comercial_360.sql` e `017_pedidos_comercial_360.sql`.
- Migrations historicas sao imutaveis e nao podem ser reaplicadas manualmente.

## Gates obrigatorios

1. PR aprovada, CI frontend/backend/PostgreSQL verde e `MERGE_SHA` registrado.
2. Precheck VPS autorizado: worktree limpo, runtime 3080, containers, rede, porta temporaria e `schema_migrations` inventariados.
3. Backup novo em `/opt/erp-zuccaro/backups`, com caminho, tamanho e SHA-256; preservar todos os rollbacks existentes.
4. Aplicar 016/017 uma unica vez pelo migrator canonico, com `ON_ERROR_STOP`; conferir 001-017 exatamente uma vez e nenhuma migration posterior.
5. Executar `npm run test:postgres` no checkout exato da `main`, com PostgreSQL real, >0 testes e zero fail/skip.
6. Construir imagem imutavel da mesma `main`; iniciar canario em porta temporaria livre com `scripts/deploy/comercial360-canary.sh`.
7. Executar `scripts/deploy/comercial360-smoke.sh` e smoke autenticado sintético de Orcamento/Pedido, incluindo RBAC negado e cross-tenant bloqueado.
8. Promover somente a imagem que passou no canario. A promocao da 3080 exige autorizacao expressa e rollback preservado.
9. Pos-promocao: health/ready/meta, operacoes sintéticas, RLS/FORCE, auditoria e monitoramento. Nao apagar containers nem backups.

## Variaveis dos scripts

- Canario: `IMAGE`, `ENV_FILE`, `ERP_DOCKER_NETWORK`, `EXPECTED_RUNTIME`; opcionais `CANARY_NAME`, `CANARY_PORT`.
- Smoke: `BASE_URL`, `EXPECTED_RUNTIME`.
- Rollback: `ROLLBACK_CONTAINER`; opcionais `OFFICIAL_CONTAINER`. O script e dry-run por padrao e so altera containers com `CONFIRM_ROLLBACK=YES` apos autorizacao humana.
- Segredos permanecem somente no arquivo de ambiente da VPS; nunca no Git, argumentos, logs ou evidencias.

## Smoke autenticado minimo

Usar exclusivamente IDs sintéticos e headers de ator/grupo/empresa já aprovados no ambiente DEV. Confirmar: list/get/create/update/cancel de Orcamento; conversao idempotente; list/get/update/status/cancel/historico de Pedido; 403 sem permissao; bloqueio de Empresa externa; totais recalculados pelo servidor. Limpar somente os IDs sintéticos criados pelo gate, respeitando FKs e auditoria.

## Rollback

Rollback de API e schema sao independentes. Preferir retornar ao container/imagem anterior preservado. Nao desfazer 016/017 automaticamente: sao aditivas e o runtime anterior deve ser verificado quanto a compatibilidade. Qualquer necessidade de rollback de schema exige plano e autorizacao separados. O script de rollback nao remove imagem, container, volume, backup ou migration.

## Criterio de parada

Parar sem improvisar se SHA/imagem divergirem, backup falhar, migration estiver duplicada, houver migration >017 inesperada, E2E tiver zero testes/fail/skip, canario/meta divergir, smoke cross-tenant/RBAC falhar ou rollback nao estiver preservado.