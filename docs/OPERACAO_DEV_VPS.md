# Operação DEV: GitHub, Codex, Cursor e VPS

## Diagnóstico Codex — versão ERP novo × VPS (layouts/funcionalidades) — 2026-10-05

Branch própria: `codex/erp-novo-vps-layout-diff-20261005` (base `main` `d02cd012`).
Candidata preservada: tip código `899ec9b3` em `codex/comercial-expedicao-cliente360-207-209-20261005` (**não** tip-portada nesta branch).
Leitura ao vivo da VPS (Hostinger MCP `vps_virtual-machines_list`): **BLOCKED** — timeout MCP; sem SSH/docker inspect autorizado neste lote. Evidências abaixo são **comprovadas em Git/docs locais**.

### Diferenças comprovadas (não são “falta de importação”)

| # | Área | Evidência | VPS / versão anterior (docs) | Código atual | Impacto em tela/layout |
|---|---|---|---|---|---|
| 1 | Commit/imagem API | `docs/HANDOFF_ATUAL.md` (captura Web Console); `docs/OPERACAO_DEV_VPS.md` §pg_read_file | Imagem oficial `erp-zuccaro-erp-api:runtime07b-main-ca0bc5f3` (SHA `ca0bc5f3`); meta `ERP-RUNTIME-07B`; `auth.mode=dev_headers`. #96 chegou a `56dae696` na main mas APPLY abortou — promoção incompleta documentada | `main` `d02cd012`: `server/src/api/router.ts` declara `runtime: 'ERP-RUNTIME-08B'`. Candidata `899ec9b3` **não** é ancestral de `main` | UI/API da VPS pode estar em runtime antigo enquanto o Git já espera 08B / candidata 025–037 |
| 2 | Migrations | HANDOFF Web Console `schema_migrations` 001–015 | VPS: **001–015** apenas | `main`: 001–024 no repo; candidata `899ec9b3`: 001–031 + gap 032 + 033–037 (`git ls-tree`) | Cadastros/Comercial/Expedição “vazios” ou erro de API por schema parcial — **não** é só backup legado |
| 3 | Flags SPA build | `docker-compose.erp.yml` args `erp-web` | Compose canônico bakeia `VITE_ERP_BACKEND=http` + `VITE_ERP_API_SAME_ORIGIN=true` (sem `VITE_ERP_HTTP_EXPEDICAO` / `PRODUTO` / `CLIENTE_360`) | Tip `899ec9b3`: `src/api/runtimeBackend.js` exige `VITE_ERP_HTTP_EXPEDICAO=true` para Entrega/Romaneio/Separacao no BFF; `VITE_ERP_HTTP_PRODUTO` / `VITE_ERP_HTTP_CLIENTE_360` opt-in; server `EXPEDICAO_PERSISTENT_PORTS` | Telas Expedição/Cliente360/Produto HTTP **existem** no SPA mas operam localBase44/fallback se flags OFF — parece “sem cadastro” |
| 4 | Pilotos HTTP | `src/api/runtimeBackend.js` main vs `899ec9b3` | main: pilotos só `Marca`,`UnidadeMedida`,`GrupoProduto`,`SetorAtividade` | tip: +`CondicaoPagamento`,`TabelaPreco`,`Cliente`,`ClienteEmpresa`,`ClienteLocal`,`Obra`,`Produto` + Expedição opt-in | Mesma rota `/Expedicao` / Cadastros com comportamento totalmente diferente conforme SHA+flags |
| 5 | Rotas/páginas | `src/pages.config.js` | R07B já registra `Expedicao`,`Comercial`,`Cadastros` (arquivo em `ca0bc5f3`) | tip e main: **46** páginas — contagem igual | Ausência de menu/cadastro **não** se explica por página faltando no bundle; investigar flag/RBAC/dados |
| 6 | Layouts Expedição | `git diff --stat main...899ec9b3 -- src/components/expedicao src/pages/Expedicao.jsx` | VPS/main sem wiring HTTP Expedição tip | tip: milhares de linhas em listagem/detalhe/separação/romaneio/logística + policies | Layout “antigo” na VPS vs candidata é **gap de versão**, não import TPS |
| 7 | Auth/RBAC | HANDOFF: `auth.users=0`, profiles sem `auth_user_id`; OPERACAO: APPLY owner abortou `pg_read_file` | Login real / permissões owner **não** homologados na VPS | main `#100`/`#101` guards Layout/contexto (`d02cd012` ancestral) — código na main, promoção VPS não comprovada pós-APPLY | Módulo escondido/bloqueado por permissão ou falta de Auth ≠ dado não importado |
| 8 | Candidata vs main | `git merge-base --is-ancestor 899ec9b3 origin/main` = false | VPS alinhada a main/R07B no máximo | candidata #207+#209+#212 tip `899ec9b3` só em branch isolada | Homologar layouts da candidata **na VPS sem merge/gate** é inválido |

### O que pedir ao Legado (importação)

- Reconciliar **somente** entidades cujo schema VPS já aplica (hoje evidência: até 015) e cujo cadastro mestre está no contrato de migração.
- **Não** tratar como defeito de importação: Expedição HTTP tip, ledger 037, Cliente360 opt-in, migrations 016–037, flags OFF, Auth/owner sem vínculo, runtime 07B vs código 08B.

### O que é gap de versão/config (Codex / deploy)

1. Confirmar na VPS (gate leitura autorizado): label/image ID de `erp-api-dev`/`erp-web-dev`, `/api/v1/meta` (`runtime`,`auth.mode`), `schema_migrations`, env bakeado do SPA (`VITE_*` no build args — sem secrets).
2. Só após gate: decidir promoção main→canário→3080; **nunca** tip-port candidata `899ec9b3` direto na VPS.
3. Antes de ligar `VITE_ERP_HTTP_EXPEDICAO` / `EXPEDICAO_PERSISTENT_PORTS`: migrations 036/037 + saldo reconciliado (sem inventar abertura).

## Fontes de verdade

- GitHub `viniciuszuccaro-creator/ERP-Zuccaro-codeX`: código e histórico Git.
- VPS DEV: estado operacional do ambiente em Docker.
- PostgreSQL DEV: migrations e dados sintéticos reais.
- PR e CI: revisão e gates de código; não substituem os gates PostgreSQL reais.

## Ferramentas e precheck

Codex e Cursor são intercambiáveis. Cada workspace é descartável e deve nascer
ou sincronizar do repositório canônico. Antes de editar, confirmar repositório,
branch, HEAD e `git status`; depois ler este documento, `HANDOFF_ATUAL.md` e
os documentos do runtime relacionado.

Se GitHub, workspace, VPS ou handoff divergirem, parar e diagnosticar. Não
resetar, fazer force-push, reaplicar migration, recriar container ou corrigir
silenciosamente.

## Fluxo normal

```text
branch → implementação/testes → push → PR draft → CI/review/hardening
→ precheck VPS → backup → migration autorizada → PostgreSQL real/E2E
→ pre-merge → merge → build da main → canário da main → promoção 3080
→ restart gate → pós-promoção → fechamento
```

Merge não é promoção. Migration não é promoção. CI local não substitui
PostgreSQL real. Frontend não substitui segurança. Documentação não é
autorização operacional.

## VPS DEV

- Raiz: `/opt/erp-zuccaro`.
- PostgreSQL Docker: `supabase-db`.
- API oficial: `erp-api-dev`.
- Bind oficial: `127.0.0.1:3080`.

A rede Docker deve ser consultada na configuração existente durante uma tarefa
VPS autorizada; não deve ser presumida. Não documentar senhas, tokens, arquivos
de ambiente, cookies, dados de clientes ou IP público desnecessário.

## Backup e rollback

Antes de migration, promoção ou gate destrutivo: executar backup/checkpoint
autorizado e guardar em `/opt/erp-zuccaro/backups`. Quando o gate exigir,
registrar caminho e hash. Nunca remover backups automaticamente.

Preservar ao menos o rollback imediato do runtime anterior durante a
estabilização. Rollback de API e rollback de schema são decisões independentes;
não reverter schema automaticamente se a API anterior continuar compatível.

## Migrations

Migrations históricas são imutáveis. Uma migration nova deve ser aditiva,
passar por precheck e backup, ser registrada em `schema_migrations` e ser
validada no PostgreSQL real antes da promoção. Usar transação e
`ON_ERROR_STOP` quando aplicável. Nunca reaplicar manualmente uma migration já
registrada sem diagnóstico.

## Segurança obrigatória

Todas as operações observam multiempresa, com `group_id` como tenant raiz e
Empresa no contexto aplicável. RLS + FORCE, RBAC fail-closed, bloqueio de
IDOR/cross-group/cross-company, allowlist contra mass assignment e auditoria
atômica são barreiras de backend e banco. A auditoria minimiza PII.

## Portas temporárias

A porta 3080 é oficial. Canários e testes usam porta temporária somente após
precheck de disponibilidade e devem ser parados ao final do gate. Nunca assumir
que uma porta, inclusive 3086, está livre.

## Incidente ou divergência

Registrar a evidência, interromper a mudança e decidir o próximo passo com
autorização. Não promover, apagar, resetar ou reiniciar para ocultar a
divergência.


## Gate proprietário: auditoria e promoção do candidato revisado

### Primeira senha na conta existente

Se o proprietário nunca definiu/recebeu senha, não usar BOOTSTRAP ou criar outro Auth. Após revisão Cursor/CI/merge, o modo `OWNER_ACCESS_MODE=PASSWORD` do mesmo script exige checkout limpo no APPROVED_SHA, banco/rede/tenant reais, decisões anteriores e `CONFIRM_OWNER_PASSWORD_RESET=YES`. Faz AUDIT/preflight/backup sem mudar API/SPA. O proprietário assume o Web Console antes da entrada: digita e confirma senha de 12–200 caracteres em prompt sem eco. Agente não lê, escolhe nem envia a senha.

O GET administrativo deve corresponder ao Auth existente confirmado. A senha segue por stdin até o Auth; nunca em argumento/env/arquivo/chat/log. Intenção e resultado são auditados sem credenciais. Não há retry automático nem rollback de Auth: timeout ou falha de auditoria após PUT deixam estado possivelmente alterado, exigem inspeção privada e eventual nova redefinição pelo proprietário. Não restaurar dump operacional ou senha antiga desconhecida para esconder falha. Preservar backups; confirmar login real e permissões depois. A chave administrativa continua somente no container, jamais no navegador.

PASSWORD exige perfil ativo admin com empresa_id NULL, vínculo Auth/Grupo válido, permissões completas do arquivo canônico owner-admin-permissoes.json e ausência de wildcard. Perfil rebaixado, vinculado a uma Empresa ou com permissões incompletas bloqueia antes de GET/PUT. Resposta PUT 2xx ilegível ou identidade divergente também é ambígua: registrar unconfirmed quando o banco está disponível, interromper sem retry e inspecionar antes de nova tentativa.

`deploy-owner-access-incidente.sh` tem modo AUDIT sem escrita. Informar OWNER_EMAIL explicitamente; não enviar senha em chat, env, argumento ou arquivo. Conferir Auth/perfil, grupo e ambas empresas pela conexão efetiva da API antes de selecionar IDs. Não inventar UUID, renomear seed nem duplicar conta. Reaproveitamento dos registros existentes foi autorizado pelo proprietário; `APPROVE_EXISTING_TENANT_MAPPING=YES` registra essa decisão no gate.

APPLY exige IDs válidos distintos, banco/rede reais, APPROVED_SHA completo igual ao checkout limpo, CONFIRM_OWNER_ACCESS_DEPLOY e CONFIRM_OWNER_GROUP_ADMIN. Somente depois de revisão do Cursor, CI e integração controlada; nenhum operador deve concorrer no Web Console. O procedimento faz backup custom + validação de arquivo, canário API/SPA, grant auditado e promoção das mesmas imagens. BOOTSTRAP é separado e exige CONFIRM_OWNER_TENANT_CREATE; criação Auth externa pode permanecer após falha posterior, exigindo nova auditoria antes de retry. Não executar BOOTSTRAP para o proprietário já existente.

Evidência mínima após promoção: SHA da label + image ID de API e SPA iguais aos canários; ready API/BFF; rejeição de cabeçalhos fabricados; logout completo e login com conta real, escolha de cada empresa, Comercial e Configurações. CI verde ou login sintético não encerram o incidente. Rollback preserva dados; usar restore seletivo de perfil explicitamente autorizado e auditável se necessário, não replay cego de dump. Preservar backups e rollback 06A.

## Acesso proprietário — falha operacional pg_read_file (2026-09-27)

- #96 mesclada na main 56dae6966ae39a11eac3064ca7bb0d67553e7765 após parecer Cursor sobre 23252cc e CI; CI PUSH main #1135/run36326407270 SUCCESS frontend/backend.
- VPS atualizada para esse SHA; AUDIT, identidade efetiva do banco, backup custom e canário API/SPA aprovados. APPLY abortou no provisionamento: `permission denied for function pg_read_file`, transação revertida, nenhuma promoção. Oficiais preservados; canário antigo exclusivamente localhost3086 parado reversivelmente com container/imagem preservados. Backups privados preservados.
- Correção candidata em branch própria: JSON por COPY do cliente psql tanto na concessão quanto no restore seletivo, sem conceder leitura de arquivos do servidor nem elevar o usuário PostgreSQL. Preserva locks, validação de tenant, auditoria, transação e decisões do proprietário. Teste PostgreSQL CI com NOSUPERUSER/NOBYPASSRLS verifica leitura negada e COPY bem-sucedido, inclusive aspas/barra/acentos e comando real do restore.
- Ainda requer CI do novo HEAD e revisão independente Cursor antes de merge/APPLY. Não declarar acesso/deploy concluído. Login real, duas empresas e Comercial/Configurações continuam pendentes; canais OFF. Nenhuma migration ou dado real publicado.
