# Comercial 360 - Contrato da Onda 3: Cliente 360 e CRM

## Decisão

Cliente, ClienteEmpresa, ClienteLocal e Obra permanecem mestres em Cadastros. CRM mantém lead, oportunidade, interação, campanha, tarefa e sinais comerciais. A Central Cliente 360 é uma composição de leitura e ações autorizadas; não cria tabela que replique saldos, títulos, pedidos, entregas ou conversas.

## Identidade e deduplicação

- Identidade de pessoa: `Cliente` no Grupo; elegibilidade operacional, crédito e parâmetros comerciais: `ClienteEmpresa` por Empresa.
- Contatos, locais e obras mantêm vínculos existentes. Telefone/e-mail/documento são normalizados para busca e deduplicação, mas respostas e auditoria mascaram dados sensíveis.
- Lead recebido por canal usa chave idempotente de origem + identificador externo. Match seguro sugere vínculo; mescla destrutiva exige revisão humana e trilha antes/depois.
- Cross-tenant sempre retorna resultado seguro. Busca por documento, telefone ou e-mail exige permissão sensível e escopo completo.

## Read model da Central 360

A API futura compõe sob demanda, com paginação por bloco e timeout parcial controlado:

- cadastro, contatos, locais, obras e projetos;
- oportunidades, atividades, comunicações e próxima ação;
- Orçamentos/Pedidos canônicos e origem/canal;
- visão permitida de crédito, títulos e comportamento de pagamento;
- estoque/reserva/produção/entrega apenas relacionados às operações do cliente;
- fiscal, documentos e pós-venda conforme permissões específicas;
- até 20 produtos mais comprados calculados por agregação server-side, nunca pela primeira página.

Falha de um bloco não amplia acesso nem inventa zero; retorna indisponibilidade identificada pelo request ID. Cache inclui ator, Grupo, Empresa, cliente e permissões relevantes.

## CRM e estados

Reutilizar página CRM e `crmOportunidadePolicy`. Estados canônicos: `OPEN`, `IN_PROGRESS`, `WAITING_CUSTOMER`, `WAITING_SELLER`, `WON`, `LOST`, `CANCELLED`. Transições registram ator, motivo e timestamp. Ganho vincula Orçamento/Pedido existente; não copia seus itens. Perda exige motivo controlado e texto sanitizado.

Sinais seguem o programa mestre e são eventos/sugestões, não novos estados. Churn, recompra e próxima ação são recomendações explicáveis; nenhuma automação cria Pedido, concede crédito ou altera preço sem autorização.

## API e ações

- Evoluir endpoints canônicos de Cliente e criar somente endpoints CRM ausentes após inventário de consumidores.
- Central 360: composição tenant-scoped por ClienteEmpresa, com campos por permissão e paginação independente.
- Ações mínimas: `cliente.visualizar`, `cliente.dados-sensiveis.visualizar`, `crm.oportunidade.*`, `crm.interacao.*`, `crm.campanha.*`, `financeiro.credito.visualizar` e permissões específicas dos blocos consultados.
- Exportação exige permissão própria, limite, audit e geração server-side de todos os registros filtrados.

## Auditoria e LGPD

Auditar mutações, mescla/vínculo, exportação sensível, mudança de responsável/estado e consulta excepcional de dados protegidos. Snapshots minimizam documento, telefone, e-mail, crédito e observações. Definir finalidade, retenção, consentimento/opt-out por canal e resposta a exportação/anonimização sem apagar documentos transacionais obrigatórios.

## Compatibilidade

`src/pages/CRM.jsx`, policies e componentes atuais serão evoluídos. Comercial pode abrir a Central 360 com o mesmo contexto, sem ganhar acesso administrativo aos módulos donos. Portal/Chatbot/Site utilizam APIs próprias e o mesmo Cliente; não criam “cliente do canal”.

## Primeiro checkpoint de implementação

1. Inventariar entidades CRM realmente persistidas e seus consumidores antes de schema novo.
2. Centralizar normalização/deduplicação já existente.
3. Criar teste de composição sintética com dois grupos/empresas e permissões diferentes.
4. Implementar primeiro o endpoint/read model mínimo de identidade + operações comerciais canônicas.
5. Adicionar blocos Local/Obra reutilizando serviços canônicos (entregue na PR #39).
6. Bloco CRM HTTP: só após inventário — hoje `skipped` (`CRM_CANONICAL_HTTP_PENDING`); Oportunidade permanece no localBase44.
7. Adicionar blocos Financeiro/Fiscal/Logística somente após contratos dos módulos proprietários.

### Inventário CRM (2026-09-25) — BLOCKED para HTTP canônico novo

| Entidade | Persistência | Consumidores principais | Server `/api/v1` | Migration PG |
|---|---|---|---|---|
| `Oportunidade` | `localBase44` / Base44 entities | `CRM.jsx`, `crmOportunidadePolicy`, Site CPA opportunity/negotiation, `oportunidadeScorer`, `iaChurnAnalyzer`, `onOportunidadeStageChanged`, PesquisaUniversal | **ausente** | **ausente** |
| `Interacao` | `localBase44` / Base44 | CRM, PesquisaUniversal, backfillGroupEmpresa | **ausente** | **ausente** |
| `Campanha` | `localBase44` / Base44 | `CampanhasLista`/`CampanhaForm`, CRM | **ausente** | **ausente** |
| Lead/tarefa/sinais | policies/funções Base44 | Site CPA signals, churn IA | **ausente** | **ausente** |

Conclusões (Regra-Mãe):

1. **Não** criar tabela/`OportunidadeService`/rota CRM paralela sem autorização humana explícita — equivalência legada já existe no localBase44.
2. Central 360 mantém `blocks.crm.status=skipped` + `code=CRM_CANONICAL_HTTP_PENDING` (honesto, fail-closed).
3. Evolução segura futura (requer decisão): (A) migrar CRM legado → schema canônico + HTTP com dual-read; ou (B) composição somente-leitura via adaptador controlado sobre o store legado, sem segunda fonte de verdade.
4. Contato mestre HTTP também **ausente** no server (só e-mail/telefone no `Cliente`); não inventar `ClienteContato` neste lote.

**BLOCKED:** preencher o bloco CRM da Central 360 com dados reais até existir caminho canônico autorizado (A ou B).

### Checkpoint entregue (2026-09-25)

- `GET /api/v1/clientes/:id/central-360` compõe identidade mascarada, vínculo `ClienteEmpresa`, blocos `empresas`/`locais`/`obras`/`orcamentos`/`pedidos` e `crm=skipped`.
- Status por bloco (`ok|forbidden|unavailable|skipped`); sem cópia de saldo/título; sem migration; frontend HTTP permanece desligado.
- Testes sintéticos cobrem composição Local/Obra, RBAC parcial e isolamento Grupo A/B.


### Correções P1 Codex (2026-09-25)

1. PII (`email`/`telefone`/`celular`): exige `Cadastros.cliente` + ação `dados-sensiveis.visualizar`; caso contrário mascara.
2. Identidade só após vínculo `ClienteEmpresa` ativo na Empresa do contexto; sem vínculo → 404 seguro.
3. Blocos `forbidden`/`unavailable` usam `meta: null` (não inventam total=0); erro não-AppError isola o bloco.

UI: composição no `DetalhesCliente` existente via `CentralCliente360Panel` (flag `VITE_ERP_HTTP_CLIENTE_360`).
Acesso browser: SPA `http://127.0.0.1:3081/` — não confundir com API 3080.

## Aceite

Fonte única preservada; busca sensível autorizada; leitura agregada paginada; nenhuma cópia de saldo/título/pedido; deduplicação revisável; cache isolado; recomendações sem ação crítica automática; testes tenant/RBAC/LGPD e auditoria sanitizada.