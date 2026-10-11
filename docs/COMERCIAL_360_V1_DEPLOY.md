# Comercial 360 V1 - Preparacao de deploy

Este documento prepara o gate futuro e nao autoriza acesso a VPS, merge, migration, seed, promocao ou alteracao da porta 3080. Seguir tambem `OPERACAO_DEV_VPS.md` e `HANDOFF_ATUAL.md`.

## Artefato candidato

- Fonte: merge futuro da PR #33 na `main`; nunca construir a imagem oficial a partir da branch.
- Tag: imutavel, contendo o `MERGE_SHA`, por exemplo `erp-zuccaro-erp-api:comercial360-main-<sha8>`.
- Runtime esperado: definir `EXPECTED_RUNTIME` conforme `/api/v1/meta` da `main` revisada.
- Migrations candidatas na branch: 016-024; 023 e 024 validadas em codigo/CI, nenhuma aplicada na VPS. Inventariar as aplicadas no DEV antes de decidir qualquer migracao; CI efemera nao equivale a DEV.
- Migrations historicas sao imutaveis e nao podem ser reaplicadas manualmente.

## Gates obrigatorios

1. PR aprovada, CI frontend/backend/PostgreSQL verde e `MERGE_SHA` registrado.
2. Precheck VPS autorizado: worktree limpo, runtime 3080, containers, rede, porta temporaria e `schema_migrations` inventariados.
3. Backup novo em `/opt/erp-zuccaro/backups`, com caminho, tamanho e SHA-256; preservar todos os rollbacks existentes.
4. Quando autorizado, aplicar apenas migrations faltantes da MAIN aprovada pelo migrator canonico, com `ON_ERROR_STOP`; conferir todas as migrations da MAIN aprovada em ordem, cada uma exatamente uma vez, e investigar qualquer migration posterior antes de prosseguir.
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

Rollback de API e schema sao independentes. Preferir retornar ao container/imagem anterior preservado. Nao desfazer migrations automaticamente: o runtime anterior deve ser verificado quanto a compatibilidade. Qualquer necessidade de rollback de schema exige plano e autorizacao separados. O script de rollback nao remove imagem, container, volume, backup ou migration.

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
## Preparação candidata CRM → Pedido (2026-10-11, substitui pressupostos históricos para este pacote)

A composição #296/#297 e o endurecimento #298 são candidatos empilhados, não main implantada. A main conferida é baba91a6b0d5d626edd607b8cd3522927e1904ab. Não construir/prometer imagem oficial desses HEADs antes da revisão independente e integração aprovada. Os estados de setembro acima são históricos e não comprovam o destino atual.

### Contrato de passagem do pacote

| Gate | Evidência necessária | Estado do pacote |
|---|---|---|
| Código | árvores iguais local/remoto; CI do SHA final; parecer Cursor da composição inteira | CI do #298 em execução; revisão não aprovada |
| Destino | identidade de banco/schema esperados; session_user=current_user; LOGIN sem SUPERUSER/BYPASSRLS | precisa de prova privada no destino; SET ROLE de fixture não substitui |
| Schema CRM | preflight existente: ledger040, colunas, trigger, vínculo único, policies, RLS/FORCE e ACL de oportunidade e sequência | diagnóstico somente leitura; ready não autoriza ativação |
| Dependências Pedido | Pedido/itens/histórico/audit, Orçamento/itens, ClienteEmpresa, ProdutoEmpresa, Unidade, Condição, Tabela, Local e Obra; grants/policies efetivos no executor real | preflight CRM sozinho NÃO cobre estas dependências |
| Auth/RBAC | Bearer real proprietário e usuário restrito; CRM.oportunidades.aprovar, Comercial.pedido.converter-pedido/visualizar, Comercial.orcamento.visualizar; empresa externa negada | testes sintéticos não homologam Auth/VPS |
| Backup | arquivo privado recuperável, hash, leitura do archive e restauração isolada reconciliada antes da mudança | pendente no destino; preservar originais/rollbacks |
| Canário | API/SPA do mesmo MERGE_SHA, IDs/digests/labels registrados; readiness e contrato funcional | executar só após gates; manter porta oficial até promoção |
| Reversão | imagem anterior preservada e compatibilidade do schema comprovada; IDs sintéticos conhecidos; nenhuma exclusão ampla | rollback de imagem separado de schema/dados |

### Aceite integrado no destino isolado

Usar somente identidades/registros sintéticos autorizados, fora de GitHub quando contiverem credenciais. Confirmar Orçamento original ativo e Ganho vinculado; conversão cria um Pedido e mantém preços, itens, IDs e empresa fiscal. Repetição idêntica retorna mesmo Pedido; payload divergente409; concorrência preserva unicidade. Falha de auditoria após criação reverte registro, itens, histórico, audit e numeração; retry conserva o contrato. Cancelamento concorrente do Orçamento não cria Pedido.

Produto mestre de Grupo exige vínculo empresarial ativo/habilitado. Testar desabilitação deste vínculo; Local/Obra de outro Grupo; proprietário na visão Grupo com empresa-alvo explícita; usuário restrito sem aprovação/conversão; troca de empresa/sessão durante consulta e submissão. Resultado tardio não confirma sucesso no contexto novo. No modal, Entrega exige Local e data/hora; não enviar preços/itens/actor/tenant fabricados no comando.

A rota candidata é /api/v1/oportunidades/:id/converter-orcamento-pedido e usa os serviços/repositórios existentes no mesmo executor. ENABLE_CRM_HTTP e VITE_ERP_HTTP_CLIENTE_360 continuam desligáveis e não foram alterados na VPS por esta preparação. Modo memória da operação nova retorna503 pré-escrita; modo legado permanece disponível e não é declarado atômico. Não aplicar automaticamente 043 ou afrouxar026, nem ativar estoque/providers/canais como efeito desta entrega.

Próximo responsável Codex: verificar dependências físicas/grants com identidade restrita em destino isolado e preparar evidência privada de backup/restauração; integração só após revisão independente. O bot reportou revisão desabilitada no repositório em #298, comentário6115199925; isso bloqueia revisão, não desenvolvimento independente. Nenhuma homologação operacional ou importação real declarada.

### Gate complementar de persistência central (candidato)
Executar o CLI existente com CRM_PREFLIGHT_PEDIDO_PERSISTENCE=true somente after_migration e destino esperado explícito. A checagem é READ ONLY e exige LOGIN restrito real no CLI. Cobre tabelas, RLS/FORCE, grants necessários, policies permissivas aplicáveis e ausência de PUBLIC nos seis recursos centrais Pedido/itens/histórico/audit/Orçamento/itens. Histórico exige INSERT, não leitura/edição/exclusão. Não muda grants/policies/migrations.
Saída scope=crm_pedido_persistence_only, activationAuthorized=false e unverifiedGates mantém explícitos Auth/RBAC, semântica das policies/referências, isolamento comportamental, backup/restauração e fluxo funcional. ready=true cobre somente estes catálogos, não autoriza implantação. Ausência da opção preserva schema_only; opção inválida ou combinação before_migration bloqueia antes de conexão. Provas reais/sintéticas e fila registradas no HANDOFF.
