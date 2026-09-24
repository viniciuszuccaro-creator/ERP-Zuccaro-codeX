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
5. Adicionar blocos Financeiro/Fiscal/Logística somente após contratos dos módulos proprietários.

## Aceite

Fonte única preservada; busca sensível autorizada; leitura agregada paginada; nenhuma cópia de saldo/título/pedido; deduplicação revisável; cache isolado; recomendações sem ação crítica automática; testes tenant/RBAC/LGPD e auditoria sanitizada.