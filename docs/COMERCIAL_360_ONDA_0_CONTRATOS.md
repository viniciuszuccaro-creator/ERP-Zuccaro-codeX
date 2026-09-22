# Comercial 360 Omnicanal - Onda 0: Inventário e Contratos

## Estado e objetivo

- Branch: `codex/comercial-360`; PR: `#33` (draft, sem merge).
- Baseline funcional reutilizado: Orçamento/Pedido V1 e migrations 016/017.
- Objetivo: congelar ownership, compatibilidade e contratos antes das próximas migrations.
- Este checkpoint é arquitetural; não altera runtime, schema, VPS ou porta 3080.

## Inventário e classificação

| Domínio | Estrutura real | Classificação | Decisão |
| --- | --- | --- | --- |
| Contexto/autorização | `requestContext`, `TenantGuard`, `rbacGuard` | canônica | toda API reutiliza contexto e validação backend |
| Auditoria | `audit_logs`, `AuditRepository`, sanitização | canônica | mutação sensível e audit na mesma transação |
| Eventos de integração | `integration_events` migrations 001/002 | parcial | evoluir como outbox; não criar segunda tabela |
| Produto | types/repositories/service/HTTP e Cadastros | canônica parcial | ampliar para PIM/DAM na Onda 1 |
| Cliente | Cliente, ClienteEmpresa, ClienteLocal, Obra | canônica | CRM e Central 360 consultam, não copiam |
| Preço/pagamento | TabelaPreco e CondicaoPagamento | canônica parcial | Onda 2 amplia alçadas/canal sem reescrever snapshots |
| Orçamento | migration 016, service/HTTP/frontend | canônica parcial | Onda 4 fecha versões/anexos/aprovações |
| Pedido | migration 017, service/HTTP/frontend | canônica parcial | Onda 5 fecha canais/crédito/reserva/marcos |
| CRM | página CRM e policies de oportunidade | legada consumida/parcial | evoluir na Onda 3; não criar CRM paralelo |
| Estoque | página/componentes/policies de movimento | legada consumida/parcial | continua dono de saldo e reserva |
| Engenharia/Produção | páginas, formulários, leitura e otimizadores | legada consumida/parcial | convergir projeto/revisão/BOM/OP nas Ondas 9–14 |
| Expedição/Logística | entrega, romaneio, rotas e motorista | legada consumida/parcial | continua dona de entrega/prova/reversa |
| Financeiro/Fiscal | módulos e policies existentes | legada consumida/parcial | continuam donos de título, baixa, NF e conciliação |
| Site/Portal | gateway Site CPA e PortalCliente existentes | consumidores parciais | mesmas APIs canônicas; nenhum pedido paralelo |
| Chatbot/canais | HubAtendimento, ChatbotAtendimento e adapters | consumidores parciais | transferir ao humano e chamar contratos canônicos |
| Marketplace | policies/componentes existentes | consumidor parcial | adaptadores com outbox/reconciliação na Onda 19 |
| Storage/DAM | `StoragePort` sem adapter definitivo | ausente controlado | adapter seguro na Onda 1; binário fora de banco/log/Git |

## Ownership canônico

- Grupo consolida; Empresa é proprietária da operação, estoque, faturamento, fiscal e entrega.
- Cadastros Gerais é mestre de Cliente, Produto, Unidade, Marca e referências compartilhadas.
- Comercial orquestra Orçamento e Pedido; não grava saldo, título, NF, OP ou entrega paralelos.
- Módulos especialistas validam e persistem seus estados. A Central 360 recebe projeções/links e executa ações somente pelas APIs proprietárias.
- Site, Portal, App, Chatbot e marketplaces são canais; `externalOrderId`, canal, correlação e idempotência vinculam o agregado canônico.

## Contrato HTTP compartilhado

- Versão atual: `/api/v1`; evolução incompatível exige nova versão, nunca quebra silenciosamente consumidores.
- Contexto canônico: `x-group-id`, `x-empresa-id`, `x-actor-id`, `x-actor-email` e `x-request-id`. Tenant do payload é rejeitado; compatibilidade legada por query não concede autorização.
- Leitura e mutação exigem TenantGuard e RBAC de ação. Cross-tenant responde de forma segura, sem confirmar existência.
- Listas usam `limit` 1–200, `offset >= 0`, ordenação determinística e `meta { limit, offset, total, hasMore }`.
- Erro público usa status HTTP + `code` estável + mensagem segura + request ID; detalhes internos/PII não saem na resposta.
- Valores monetários/quantidades usam decimal exato; totais e snapshots são recalculados no servidor.

## Contrato transacional e de idempotência

- Services abrem uma transação e repassam o mesmo executor a repositories, validações compatíveis, audit e outbox.
- Repositories não abrem transação aninhada quando recebem executor.
- Conversões e entradas externas exigem chave idempotente estável por origem/tenant/operação; mesmo payload retorna o resultado anterior, payload divergente retorna conflito.
- Código sequencial usa lock/reserva backend por Grupo ou Empresa conforme a entidade; nunca `count + 1` e nunca reutiliza soft-deleted.
- Falha de audit/outbox obrigatória rollbacka a mutação. Entrega externa assíncrona não ocorre dentro da transação de negócio.

## Contrato de eventos/outbox

Reutilizar `integration_events`. Antes de ativar publicação, a Onda 15 deve endurecer o schema de forma aditiva e compatível para suportar tentativa, próxima tentativa, dead-letter e versão.

Envelope lógico mínimo:

```json
{
  "eventId": "uuid",
  "eventType": "pedido.criado.v1",
  "occurredAt": "UTC ISO-8601",
  "source": "erp-zuccaro",
  "groupId": "uuid",
  "empresaId": "uuid",
  "aggregateType": "Pedido",
  "aggregateId": "uuid",
  "requestId": "string",
  "idempotencyKey": "string",
  "schemaVersion": 1,
  "payload": {}
}
```

- Payload usa allowlist e snapshots mínimos, sem segredo, URL temporária, documento completo ou observação livre desnecessária.
- Consumidor registra versão, sucesso/erro, tentativas e reconciliação. Webhook exige assinatura, timestamp/nonce, proteção contra replay e rate limit.

## Compatibilidade e lifecycle

- Migrations aplicadas são imutáveis; mudanças futuras são aditivas.
- Frontends legados permanecem como fallback até o cliente HTTP canônico e testes E2E serem aprovados.
- Remoção de duplicidade exige inventário de consumidores, equivalência, migração, homologação e autorização.
- Estado comercial final visível é `FINALIZADO`; cancelamento é transição auditada, não delete físico.
- Pedido/Orçamento guardam snapshots. Alteração material após marco crítico cria revisão/fluxo de aprovação, não mutação retroativa.

## Matriz RBAC transversal

Cada recurso declara ações exatas: `visualizar`, `criar`, `editar`, `cancelar`, `restaurar`, `aprovar-*`, `alterar-status`, `importar`, `exportar`, `publicar`, `executar` e ações sensíveis próprias. Wildcard global não autoriza mutação crítica. Custo, margem, crédito, dados financeiros/fiscais e arquivos técnicos têm permissões específicas.

## Gates de contrato

1. Toda nova onda aponta para o dono canônico desta matriz.
2. API/schema/evento compartilhado é definido antes de consumidores paralelos.
3. Testes mínimos: autorizado, negado, Grupo/Empresa A/B, ID adulterado, idempotência, concorrência, rollback e auditoria.
4. PostgreSQL: tenant integrity, RLS+FORCE, constraints e migration idempotente em banco efêmero.
5. Nenhuma integração é marcada pronta sem reconciliação, erro persistente e dead-letter.
6. Dados reais, credenciais, dumps e arquivos técnicos reais ficam fora do GitHub.

## Próximos contratos liberados

Ordem sequencial no mesmo worktree: Onda 1 Produto/PIM/DAM; Onda 3 Cliente 360/CRM; Onda 5 lacunas do Pedido; Onda 9 Engenharia/arquivos; Onda 15 catálogo/outbox. A implementação começa pela menor ampliação segura do Produto existente após esses contratos.