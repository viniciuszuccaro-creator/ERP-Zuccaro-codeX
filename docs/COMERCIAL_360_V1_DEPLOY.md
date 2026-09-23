# Comercial 360 V1 - Preparacao de deploy

Este documento prepara o gate futuro e nao autoriza acesso a VPS, merge, migration, seed, promocao ou alteracao da porta 3080. Seguir tambem `OPERACAO_DEV_VPS.md` e `HANDOFF_ATUAL.md`.

## Artefato candidato

- Fonte: merge futuro da PR #33 na `main`; nunca construir a imagem oficial a partir da branch.
- Tag: imutavel, contendo o `MERGE_SHA`, por exemplo `erp-zuccaro-erp-api:comercial360-main-<sha8>`.
- Runtime esperado: definir `EXPECTED_RUNTIME` conforme `/api/v1/meta` da `main` revisada.
- Migrations candidatas na branch: 016-022. Inventariar as aplicadas no DEV antes de decidir qualquer migracao; CI efemera nao equivale a DEV.
- Migrations historicas sao imutaveis e nao podem ser reaplicadas manualmente.

## Gates obrigatorios

1. PR aprovada, CI frontend/backend/PostgreSQL verde e `MERGE_SHA` registrado.
2. Precheck VPS autorizado: worktree limpo, runtime 3080, containers, rede, porta temporaria e `schema_migrations` inventariados.
3. Backup novo em `/opt/erp-zuccaro/backups`, com caminho, tamanho e SHA-256; preservar todos os rollbacks existentes.
4. Quando autorizado, aplicar apenas migrations faltantes da MAIN aprovada pelo migrator canonico, com `ON_ERROR_STOP`; conferir 001-022 em ordem, cada uma exatamente uma vez, e investigar qualquer migration posterior antes de prosseguir.
5. Executar `npm run test:postgres` no checkout exato da `main`, com PostgreSQL real, >0 testes e zero fail/skip.
6. Construir imagem imutavel da mesma `main`; iniciar canario em porta temporaria livre com `scripts/deploy/comercial360-canary.sh`.
7. Executar `scripts/deploy/comercial360-smoke.sh` e smoke autenticado sintético de Orcamento/Pedido, incluindo RBAC negado e cross-tenant bloqueado.
8. Promover somente a imagem que passou no canario. A promocao da 3080 exige autorizacao expressa e rollback preservado.
9. Pos-promocao: health/ready/meta, operacoes sintéticas, RLS/FORCE, auditoria e monitoramento. Nao apagar containers nem backups.

## Variaveis dos scripts

- Canario: `IMAGE`, `ENV_FILE`, `ERP_DOCKER_NETWORK`, `EXPECTED_RUNTIME`; opcionais `CANARY_NAME`, `CANARY_PORT`. O script rejeita 3080, nome oficial e metadata que nao declare `auth.mode=supabase_user`.
- Smoke: `BASE_URL`, `EXPECTED_RUNTIME`; exige runtime revisado, `auth.mode=supabase_user` e entidades Orcamento/Pedido.
- Rollback: `ROLLBACK_CONTAINER`; opcionais `OFFICIAL_CONTAINER`. O script e dry-run por padrao e so altera containers com `CONFIRM_ROLLBACK=YES` apos autorizacao humana.
- Segredos permanecem somente no arquivo de ambiente da VPS; nunca no Git, argumentos, logs ou evidencias.

## Smoke autenticado minimo

Usar exclusivamente identidade sintetica autorizada via Bearer validado pelo Supabase Auth self-hosted e contexto Grupo/Empresa permitido. Nao usar `dev_headers` como prova do Auth novo. Confirmar: list/get/create/update/cancel de Orcamento; conversao idempotente; list/get/update/status/cancel/historico de Pedido; 403 sem permissao; bloqueio de Empresa externa; totais recalculados pelo servidor. Limpar somente os IDs sinteticos criados pelo gate, respeitando FKs e auditoria.

## Rollback

Rollback de API e schema sao independentes. Preferir retornar ao container/imagem anterior preservado. Nao desfazer 016-022 automaticamente: o runtime anterior deve ser verificado quanto a compatibilidade. Qualquer necessidade de rollback de schema exige plano e autorizacao separados. O script de rollback nao remove imagem, container, volume, backup ou migration.

## Gates C-F: passagem condicional da API

- C, leitura: evidenciar runtime oficial 3080, modo Auth, `schema_migrations`, totais/vinculos agregados, rede Docker, porta isolada livre, backups e rollback. O 07B com `dev_headers` nao homologa Auth do codigo novo.
- E, schema: somente apos aprovacao e backup, aplicar no DEV apenas migrations faltantes da MAIN; testar PostgreSQL real (>0 testes, 0 fail/skip), RLS/FORCE e compatibilidade com rollback 07B. Se a imagem nova depender do schema, E antecede o smoke funcional de D.
- D, canario: imagem imutavel da MAIN aprovada em porta localhost diferente de 3080, com health/ready/meta, Bearer sintetico, RBAC negado, tenant cruzado bloqueado e auditoria. `CLEAN` de scan nao publica midia.
- F, promocao: autorizacao separada; somente digest da imagem que passou D, preservando backup/rollback. A 3080 permanece 07B ate F. Pos-promocao exige health/ready/meta e smoke autenticado sem erro.

### SQL agregado para o Gate C

Executar pelo acesso PostgreSQL DEV ja aprovado na Web Console, sem imprimir senha, URL, email, nome, UUID individual ou `.env`. Confirmar o banco correto antes de executar; o banco efemero da CI nao serve como evidencia DEV.

```sql
BEGIN READ ONLY;
SELECT id, count(*) AS ocorrencias FROM schema_migrations GROUP BY id ORDER BY id;
SELECT count(*) AS total_grupos FROM groups;
SELECT count(*) AS total_empresas FROM empresas;
SELECT count(*) AS total_auth_users FROM auth.users;
SELECT count(*) AS total_profiles FROM profiles;
SELECT count(*) FILTER (WHERE p.ativo AND p.auth_user_id IS NULL) AS ativos_sem_auth,
       count(*) FILTER (WHERE p.auth_user_id IS NOT NULL AND u.id IS NULL) AS auth_inexistente,
       count(*) FILTER (WHERE p.ativo AND (p.group_id IS NULL OR g.id IS NULL)) AS ativos_sem_grupo,
       count(*) FILTER (WHERE p.empresa_id IS NOT NULL AND (e.id IS NULL OR e.group_id IS DISTINCT FROM p.group_id)) AS empresa_fora_grupo
FROM profiles p LEFT JOIN auth.users u ON u.id = p.auth_user_id
LEFT JOIN groups g ON g.id = p.group_id LEFT JOIN empresas e ON e.id = p.empresa_id;
ROLLBACK;
```

As contagens nao provam autorizacao efetiva. Homologar Auth somente com token sintetico valido/negado e escopo Grupo/Empresa no canario, apos gate autorizado. A configuracao do canario deve ser conferida por presenca, rede e portas, nunca pelo conteudo de variaveis/segredos.

## Criterio de parada

Parar sem improvisar se SHA/imagem divergirem, backup falhar, migration estiver duplicada, houver migration >022 inesperada, E2E tiver zero testes/fail/skip, canario/meta divergir, smoke cross-tenant/RBAC/Auth falhar ou rollback nao estiver preservado.