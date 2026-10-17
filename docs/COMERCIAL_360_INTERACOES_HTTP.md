# Onda 3 — Interacao CRM HTTP, 2026-10-17

## Escopo, origem e independência

Contraparte persistente da entidade `Interacao` existente, cujos consumidores são `src/components/crm/InteracaoForm.jsx`, CRM e PesquisaUniversal. Inventário em `COMERCIAL_360_ONDA_3_CLIENTE_CRM.md` comprova ausência de endpoint/migration; busca das entregas não encontrou Interacao HTTP. Versionamento do Orçamento já existe na #52 e não foi reimplementado. A ordem do usuário autoriza este pacote do programa; não autoriza cutover do legado nem dispensa revisão por falta de crédito do Cursor.

Branch `codex/crm-interacoes-http-20261017`, base #331 `b3a683bba1bdd8dc3870ce4ba4eeb87430b3e561`. Independente da candidata #334 `e36231b3`; não precisa das portas/tabelas de Expedição. Reserva registrada na #261. Migration 045 é aditiva, depois de 040–044; não altera 026 ou migrations históricas. Arquivos de interface, Central360, formulários, store, policies compartilhadas e branches Cursor não foram alterados.

Não cria outro CRM ou formulário. Reutiliza referências ClienteEmpresa/Oportunidade, códigos `reserveEntityCodigo`, executor DB/tenant, RBAC e auditoria existentes. Repositório/service/rotas novos são necessários porque não havia a contraparte HTTP desta entidade. Não cria versão in-memory apresentada como operacional: flag habilitada sem persistência continua indisponível.

## Contrato funcional

- `GET/POST /api/v1/interacoes`: paginação/filtros/registro.
- `GET/PATCH /api/v1/interacoes/:id`: reabertura e edição com `expected_version`.
- `DELETE /api/v1/interacoes/:id`: inativação lógica, preservando registro/IDs/vínculos.
- `POST /api/v1/interacoes/:id/restaurar`: restauração autorizada.
- `GET /api/v1/interacoes/:id/historico`: snapshots imutáveis paginados por versão.

Respostas autenticadas usam `Cache-Control: no-store`. UUID técnico e código numérico sequencial são separados. Criar exige `idempotency_key` (intenção estável; UUID recomendado), vínculo canônico `cliente_empresa_id` e/ou `oportunidade_id`; se ambos vierem, precisam corresponder. Sem referência canônica retorna 422: nome textual não autoriza operar um Cliente. `cliente_nome`/`responsavel` são descrições históricas, não identidades de autorização. Grupo/Empresa/ator/código/status/versão não são aceitos no payload comercial. Vínculos não podem ser trocados silenciosamente por PATCH.

Campos do formulário preservados: tipo, título, descrição, data, duração, cliente_nome, responsável, resultado, próxima ação/data e observações. Campo omitido no PATCH é preservado; null explícito limpa somente campo nullable. Datas impossíveis, duração fora do limite, filtros inválidos, campos desconhecidos e mass assignment são rejeitados. Nenhuma mensagem WhatsApp/e-mail é enviada: o tipo registra a interação, sem simular provider.

Registro idempotente por Grupo/Empresa/intenção e fingerprint do payload normalizado: retry devolve o mesmo ID sem nova história/auditoria/código; payload diferente retorna409. Edições são serializadas por lock e versão esperada; concorrente obsoleto retorna409, sem sobrescrever. Inativo é consultável mas não editável; restauração revalida referências. Resposta perdida em edição exige GET/reconciliação da versão antes de reenviar, não repetição cega.

## Segurança e persistência

Permissões existentes `CRM.interacoes`: visualizar, criar, editar, inativar, restaurar; sem wildcard global. Referência a Oportunidade exige também `CRM.oportunidades.visualizar`. Serviço captura o contexto antes dos awaits, valida tenant/ator no executor e reautoriza após locks antes de persistir. ClienteEmpresa precisa estar ativo, habilitado e não bloqueado. Snapshots/histórico pertencem ao mesmo tenant.

Migration045 contém `interacoes` e histórico append-only, FKs compostas Grupo+Empresa para ClienteEmpresa/Oportunidade, RLS/FORCE e REVOKE PUBLIC. Gatilho de sequência sincroniza high-water inclusive para futuras cargas autorizadas, sem fazer importação agora. Atualização/DELETE do histórico é recusada também por trigger; a aplicação recebe apenas INSERT/SELECT. Grants nas provas são somente fixtures, nunca grants DEV.

Dados e snapshot de versão são gravados com auditoria na mesma transação; falha da auditoria reverte registro, histórico e sequência. AuditLog guarda apenas metadados técnicos/tipo/versão/vínculos, sem descrição, observação ou texto de contato. Histórico completo permanece protegido pelo RBAC/RLS da interação, não é dump público de auditoria. Chave idempotente/fingerprint não saem nas respostas nem nos snapshots.

## Ativação e legado

`ENABLE_CRM_INTERACOES_HTTP=false` por padrão, independente de `ENABLE_CRM_HTTP`. Sem opt-in explícito + DB, API retorna503 `CRM_INTERACOES_HTTP_DISABLED`. `/api/v1/meta` anuncia a capacidade e `frontendHttp:false`. A fachada local, formulário e consumidores existentes continuam intactos, sem dual-write, backfill, alteração de IDs ou importação automática. `legacy_store_id` é reservado à reconciliação futura; API não inventa UUID para IDs legados.

Antes de ativar: revisão do SHA exato, CI PostgreSQL, migration045 e privilégios/policies mínimos homologados no destino correto, backup recuperável, reconciliação e reversão. A decisão histórica de corte/migração de Interacao continua pendente. Desligar a flag reverte o código de exposição; não apagar tabelas/IDs/histórico para desfazer. Nenhum dado real, backup original, credencial, provider ou VPS foi alterado.

## Critérios e validação

Percurso sintético persistido registrar→GET→editar→histórico→inativar/restaurar; criação concorrente/replay, códigos concorrentes e high-water, CAS, filtros/paginação, campos preservados, histórico imutável, ator/Grupo/Empresa/IDs adulterados, RLS/FORCE/PUBLIC, falha de auditoria/rollback e retomada. Teste de autorização após lock injeta revogação no guard da fixture e exige403 sem atualizar versão.

`runtime45-crm-interacoes.test.ts` usa os helpers PGlite/PG existentes. O runner PostgreSQL obrigatório inclui a suíte e rejeita ausência de URL/skips; o mesmo percurso real conecta com LOGIN NOSUPERUSER/NOBYPASSRLS. Testes HTTP locais usam explicitamente headers DEV, não homologam Auth operacional. Resultado final de testes/CI/SHA deve constar na PR e no handoff; implementação/teste não equivale a implantação ou importação operacional.

### Verificação local do pacote (2026-10-17)

Fluxos focados:3 PASS/0 FAIL/0 SKIP. Regressão backend:384 PASS/0 FAIL/20 dependentes de PostgreSQL local. Typecheck/build backend, audit:baseline, lint, build SPA e diff-check aprovados. Typecheck global frontend:1660 diagnósticos, exatamente a base #331, sem mudança em src/. npm test raiz Windows:919 PASS/50 FAIL (infraestrutura Bash/PowerShell de Legado/VPS); exigir CI Linux, não remover testes.

Teste acrescentado reproduziu perda de descrição quando PATCH enviava undefined junto de outro campo; falhou antes e passou após filtrar somente undefined antes do merge. Null explícito continua limpando campo nullable, omissão preserva. Fixture PostgreSQL usa LOGIN sem superuser/bypass, UPDATE limitado às colunas mutáveis e recusa alteração SQL de código. Manifesto de migrations preserva todas as asserções anteriores e acrescenta045 na cauda; nenhuma migration histórica foi reescrita. Referência de ClienteEmpresa pode ser derivada da Oportunidade autorizada na criação, sem usar nome textual como identidade e sem relink automático de histórico. Publicação/CI/revisão do SHA final ainda necessárias; sem integração ou ativação operacional.

### Compatibilidade de UUID no retry (2026-10-17)

Teste de criação concorrente com a mesma intenção e UUIDs equivalentes em maiúsculas/minúsculas falhou antes do fix com INTERACAO_IDEMPOTENCY_CONFLICT. Schemas e scope do lock agora normalizam somente UUIDs canônicos, mantendo fingerprint/lock coerentes com PostgreSQL. IDs legados textuais não são normalizados. O mesmo teste passou após o fix (3/3 focados). Exigir CI do novo HEAD; resultados do SHA anterior não aprovam este delta.
