# PROGRAMA COMERCIAL 360 OMNICANAL — EXECUÇÃO AUTÔNOMA

> Documento mestre para Codex e Cursor — CPA Ferro e Aço / ERP Zuccaro / Site CPA
>
> Data de consolidação: 22/09/2026
>
> Estado factual em 22/09/2026: branch `codex/comercial-360`, PR #33 aberta/draft e limpa no HEAD `e960ec4bfcd5fed340ddac75052378c092c7c1f8`, base histórica `a329c8751323890fd5737e4d3f6d659b10dca52c`, Orçamento backend/frontend/PDF e Pedido backend/frontend/conversão inicial implementados, migrations do repositório até `017`, CI final `35667682013` verde; nenhuma migration 016/017 aplicada na VPS e porta 3080 não alterada.

---

## 1. Finalidade

Este documento é a fila oficial e executável do Comercial 360 da CPA Ferro e Aço. Ele consolida o núcleo comercial, a operação industrial e os canais digitais em um único programa, evitando entregas pequenas que dependam repetidamente da palavra “próximo”.

O programa deve transformar o ERP Zuccaro na fonte central de verdade para:

- clientes, contatos, obras, projetos e oportunidades;
- produtos revendidos, matérias-primas, componentes, retalhos, kits e produtos fabricados;
- imagens, vídeos, documentos, desenhos técnicos, arquivos CAD, manuais e certificados;
- preços, tabelas, promoções, descontos, margens, crédito e condições de pagamento;
- estoque físico, disponível, reservado, em produção, em trânsito, retalhos e sucata;
- orçamentos, pedidos, pagamentos, notas fiscais, produção, entrega e pós-venda;
- site, portal B2B, aplicativo, chatbots, redes sociais e marketplaces;
- auditoria, permissões, integrações e indicadores.

Site, aplicativo, chatbot e marketplaces não podem manter uma segunda verdade comercial independente. Eles consomem e atualizam o núcleo canônico por APIs idempotentes, auditáveis e multiempresa.

---

## 2. Destinatários e modo obrigatório de execução

Toda instrução deste documento é destinada conjuntamente ao **Codex e ao Cursor**.

### 2.1 Execução contínua

1. Ler este documento completamente antes de modificar código.
2. Executar as ondas na ordem de dependência indicada.
3. Frentes independentes podem ser trabalhadas em paralelo, sempre em branches/worktrees isoladas.
4. Não parar após inventário, diagnóstico, documento, teste local ou commit intermediário.
5. Após cada checkpoint estável: revisar, testar, commitar, fazer push e confirmar o remoto.
6. Acompanhar a CI; corrigir automaticamente falhas corrigíveis.
7. Continuar para o próximo checkpoint sem aguardar mensagem do usuário.
8. Parar somente diante de bloqueio externo real, ação de produção, dado real, credencial ausente ou decisão comercial materialmente ambígua.

### 2.2 Checkpoint obrigatório

Cada checkpoint deve registrar:

- objetivo e escopo;
- dependências;
- riscos e rollback;
- arquivos/tabelas/rotas afetados;
- critérios de aceite;
- testes executados;
- commit local e remoto;
- workflow e resultado;
- status: `PENDENTE`, `EM_EXECUÇÃO`, `CONCLUÍDO`, `BLOQUEADO` ou `NÃO APLICÁVEL`.

### 2.3 GitHub

- Código, migrations, scripts, documentação e relatórios sanitizados devem terminar no GitHub.
- Não deixar trabalho concluído somente no HD interno ou externo.
- Não fazer push direto em `main`.
- Usar PRs, revisão, CI, rollback e gates.
- Não declarar conclusão sem commit, push, confirmação do SHA remoto e CI final.
- Atualizar a descrição da PR quando o escopo ou estado real mudar.

### 2.4 Dados reais e backup legado

- O backup real do ERP antigo nunca deve ir ao GitHub.
- Localizá-lo somente quando autorizado, procurando a pasta `BACKUP ERP ANTIGO - CODEX` em qualquer letra de unidade (`D:`, `E:`, etc.).
- Até autorização explícita: somente descoberta/leitura controlada; não alterar, mover, executar, importar ou copiar os dados reais.
- Nunca versionar dumps, PII, documentos de clientes, `.env`, tokens, chaves ou credenciais.
- GitHub pode conter apenas schemas, mapeamentos, scripts, hashes, métricas agregadas e amostras completamente sintéticas/sanitizadas.

---

## 3. Regra-Mãe

1. Não criar módulos, entidades, telas, services, repositories ou fontes de verdade paralelas.
2. Inventariar e evoluir o que já existe.
3. Não apagar funcionalidade válida; refatorar e migrar com compatibilidade.
4. Alterações estruturais são permitidas quando melhorarem a arquitetura e possuírem migration, testes e rollback.
5. `Grupo` consolida; `Empresa` opera, vende, fatura, emite NF e movimenta estoque.
6. Toda tabela, consulta, cache, operação, arquivo e integração deve respeitar `groupId` e `empresaId`.
7. RBAC granular e fail-closed no backend e no frontend.
8. Nenhum wildcard global deve liberar operação crítica do Comercial 360.
9. Auditoria transacional com ator, grupo, empresa, request ID, ação, antes/depois sanitizados e data/hora.
10. Cross-tenant deve retornar resposta segura, sem revelar existência do registro.
11. Valores monetários usam precisão decimal; servidor recalcula totais.
12. Operações externas e conversões são idempotentes.
13. RLS + FORCE RLS, constraints, FKs compostas e privilégios mínimos no PostgreSQL.
14. Soft delete/restauração onde o domínio permitir; documentos comerciais e fiscais nunca são apagados para simular cancelamento.
15. Paginação, filtros, ordenação e busca nas listagens.
16. Frontend responsivo, acessível, com loading, vazio, erro recuperável e bloqueio visual coerente com RBAC/estado.
17. IA recomenda e prepara; ações críticas exigem regra determinística e, quando aplicável, aprovação humana.
18. Arquivo técnico lido por IA nunca segue diretamente para produção.

---

## 4. Modelo operacional do Comercial 360

O Comercial 360 é a central de trabalho do vendedor, mas os módulos especializados continuam donos de suas regras e dados. Comercial orquestra, não duplica:

- Cadastros: Cliente, ClienteEmpresa, ClienteLocal, Obra, Produto, Unidade, Marca, Tabela de Preço e Condição de Pagamento.
- CRM: lead, oportunidade, atividade, relacionamento e comunicação.
- Estoque: saldo, lote, localização, reserva, separação, retalho e sucata.
- Engenharia: projeto, revisão, desenho, BOM, roteiro e aprovação.
- Produção: OP, apontamento, inspeção, consumo, perdas e produto acabado.
- Financeiro: crédito, recebimento, caixa, cobrança, conciliação e inadimplência.
- Fiscal/Faturamento: tipo de NF, emissão, faturamento parcial/total e devolução.
- Expedição/Logística: carga, rota, veículo, motorista, entrega, comprovante e logística reversa.
- Integrações: site, aplicativo, chat, telefonia, pagamentos e marketplaces.

### 4.1 Visão única do vendedor

Na Central Comercial 360, exibir em uma experiência integrada:

- dados e contatos do cliente;
- grupo econômico/empresas autorizadas;
- situação comercial e crédito;
- endereços, mapa, obras e projetos;
- histórico de ligações, mensagens, leads, oportunidades e negociações;
- orçamentos e versões;
- pedidos e origem/canal;
- produção, separação, entrega/retirada e mapa;
- notas, boletos, PIX, recebimentos e pendências relevantes;
- reclamações, devoluções, garantia e recompra;
- indicadores de margem, desconto, frequência e churn.

---

## 5. Fluxos canônicos

### 5.1 Comercial

`LEAD → OPORTUNIDADE → ORÇAMENTO → APROVAÇÃO → PEDIDO → RESERVA/SEPARAÇÃO → PRODUÇÃO (quando aplicável) → PRONTO → RETIRADA ou EXPEDIÇÃO → FATURAMENTO PARCIAL/TOTAL → FINALIZADO`

- Não usar “Fechado” como estado final visível; usar **Finalizado**.
- Orçamento/Pedido em aberto pode ser alterado conforme RBAC.
- Após reserva, produção ou faturamento, mudanças materiais exigem revisão/versionamento e aprovação.
- Cancelamento preserva registro, motivo, ator e histórico.

### 5.2 Oportunidades

Status mínimos: `OPEN`, `IN_PROGRESS`, `WAITING_CUSTOMER`, `WAITING_SELLER`, `WON`, `LOST`, `CANCELLED`.

Sinais mínimos: `QUOTE_WAITING`, `NEGOTIATION_OPEN`, `BETTER_PRICE_REQUESTED`, `ARMACAO_WAITING_SELLER`, `CUSTOM_ITEM_NEEDS_REVIEW`, `ORDER_PENDING`, `CHAT_WAITING_AGENT`, `REPURCHASE_SIGNAL`, `MATERIAL_LIST_SUBMITTED`, `PROJECT_SUBMITTED`.

### 5.3 Engenharia

`UPLOAD/CONFIGURAÇÃO → EXTRAÇÃO → CONFIANÇA/EVIDÊNCIA → CONFERÊNCIA DO CLIENTE → REVISÃO TÉCNICA → APROVAÇÃO → ORÇAMENTO → PEDIDO → OP → PRODUÇÃO → INSPEÇÃO`

---

## 6. Trilhas de execução e paralelismo seguro

Após a Onda 0, estas trilhas podem avançar em paralelo com contratos versionados:

- **Trilha A — Núcleo comercial:** Ondas 3 a 7.
- **Trilha B — Produto/PIM e canais:** Ondas 1, 2, 15 a 18.
- **Trilha C — Engenharia/produção:** Ondas 9 a 14.
- **Trilha D — Logística/fiscal/financeiro:** Ondas 8, 19 e 20.
- **Trilha E — Segurança/observabilidade/testes:** transversal e Onda 23.
- **Trilha F — Legado/VPS:** Ondas 24 a 26, bloqueadas até seus gates.

Nenhuma trilha pode inventar contratos duplicados. APIs, eventos e schemas compartilhados devem ser definidos antes da implementação paralela.

---

## 6.1 Referências canônicas e precedência

Este programa consolida, sem substituir nem duplicar, `AGENTS.md`, `COMERCIAL_360.md`, `COMERCIAL_360_V1_EXECUCAO_AUTONOMA.md`, `COMERCIAL_360_V1_DEPLOY.md`, `CONSOLIDACAO_SITE_CPA_ERP_RUNTIME_04.md`, `OPERACAO_DEV_VPS.md`, `HANDOFF_ATUAL.md`, `PLANO_GO_LIVE.md` e `STATUS_DO_PROJETO.md`. Em divergência, prevalecem segurança/integridade, Regra-Mãe, código e migrations comprovados, CI e handoff operacional mais recente.

## 6.2 Baseline comprovado reutilizável

- Orçamento canônico: migration 016, repositories, service, TenantGuard, RBAC, auditoria, HTTP, frontend, filtros, impressão/PDF e compartilhamento revisável.
- Pedido canônico inicial: migration 017, repositories, service, HTTP, frontend, histórico, workflow inicial e conversão idempotente de Orçamento.
- PostgreSQL efêmero: migrations 001–017, seed exclusivamente sintético e suítes R08B/R08C/R09 aprovadas na CI.
- Deploy: runbook e scripts parametrizados de canário, smoke e rollback preparados, mas não executados.
- Este baseline é fundação das Ondas 4 e 5; não representa conclusão integral dessas ondas.

## 6.3 Controle executável das ondas

| Onda | Estado inicial | Dependências imediatas | Próximo checkpoint | Risco principal | Rollback |
| --- | --- | --- | --- | --- | --- |
| 0 | CONCLUÍDO | baseline V1 | `COMERCIAL_360_ONDA_0_CONTRATOS.md` | duplicar fonte de verdade | revert documental |
| 1 | PENDENTE | Onda 0 concluída | contrato em `COMERCIAL_360_ONDA_1_PRODUTO_PIM_DAM.md`; implementar no Produto existente | criar Produto paralelo | manter schema atual |
| 2 | PENDENTE | 0/1 | lacunas de preço, margem e aprovação | alterar snapshot histórico | feature gate/revert aditivo |
| 3 | PENDENTE | Onda 0 concluída | contrato em `COMERCIAL_360_ONDA_3_CLIENTE_CRM.md`; implementar read model no existente | expor dados financeiros | RBAC fail-closed |
| 4 | PENDENTE | baseline comprovado | versões, anexos e aprovações faltantes | regressão no Orçamento atual | preservar fluxo V1 |
| 5 | PENDENTE | 0/1/3/4 | lacunas omnicanal do Pedido existente | agregado paralelo | preservar Pedido V1 |
| 6 | PENDENTE | 2/3/5 | crédito e pagamentos oficiais | baixa duplicada | compensação/idempotência |
| 7 | PENDENTE | 1/5 | disponibilidade e reserva | overselling | liberar reserva |
| 8 | PENDENTE | 1/7 | abastecimento ligado à venda | custo divergente | desacoplar sugestão |
| 9 | PENDENTE | 0/1/3 | contrato Engenharia/arquivos | arquivo técnico virar produção | revisão humana obrigatória |
| 10 | PENDENTE | 9 | Armação 2.0 no motor existente | cálculo técnico incorreto | manter lançamento manual |
| 11 | PENDENTE | 9/10 | corte/dobra vergalhão e chapa | plano inseguro | aprovação técnica |
| 12 | PENDENTE | 1/9/11 | BOM/roteiro/fabricação | produto duplicado | versionamento/revisão |
| 13 | PENDENTE | 7/11/12 | corte, retalho e sucata | saldo incorreto | transação/estorno |
| 14 | PENDENTE | 5/9/12/13 | produção canônica | baixa indevida | apontamento reversível |
| 15 | PENDENTE | 0/1/2/7 | contrato catálogo/outbox | divergência de canal | replay/reconciliação |
| 16 | PENDENTE | 3/5/6/15 | evoluir Site/Portal existentes | segunda verdade | desligar adaptador |
| 17 | PENDENTE | 16/20 | vistas móveis sobre mesmas APIs | conflito offline | fila idempotente |
| 18 | PENDENTE | 3/5/15 | evoluir Hub/Chatbot existentes | bot executar ação crítica | transferência humana |
| 19 | PENDENTE | 5/6/7/15 | adaptadores marketplace | pedido/estoque paralelo | pausar publicação |
| 20 | PENDENTE | 5/7 | evoluir Expedição/Roteirizador/App | entrega sem prova | retornar estado anterior |
| 21 | PENDENTE | 5/6/20 | faturamento/fiscal por Empresa | emissão jurídica errada | bloquear emissão |
| 22 | PENDENTE | 3/5/20/21 | pós-venda integrado | perda de rastreabilidade | preservar ocorrência |
| 23 | PENDENTE | contratos/eventos | BI/IA/observabilidade explicáveis | KPI de página parcial | desabilitar automação |
| 24 | PENDENTE | ondas implementadas | homologação integral sintética | aprovação falsa por skip | gate bloqueado |
| 25 | BLOQUEADO | autorização + staging | migração legado | PII/perda de dados | origem intocável |
| 26 | BLOQUEADO | merge + autorização VPS | canário/implantação/go-live | indisponibilidade/perda | backups e runtime anterior |

## 6.4 Matriz inicial de rastreabilidade

| Requisito | Fonte canônica existente | Lacuna inicial | Onda | Contrato/API/tela | Teste/gate |
| --- | --- | --- | --- | --- | --- |
| Produto/PIM | Produto, Cadastros, formulários e policies existentes | taxonomia universal, mídia/versionamento/canais | 1 | ampliar Produto; sem entidade paralela | tenant, RBAC, upload, versão |
| Preço/condição | TabelaPreco e CondicaoPagamento | custo/margem/alçadas/canal | 2 | services atuais e snapshots | monetário, vigência, aprovação |
| Cliente 360/CRM | Cliente, ClienteEmpresa, ClienteLocal, Obra e CRM | visão agregada e sinais | 3 | consultas dos módulos donos | RBAC sensível e paginação |
| Orçamento | agregado/HTTP/frontend migration 016 | versões, anexos e aprovações | 4 | `/api/v1/orcamentos` e Comercial | R08C, HTTP, frontend |
| Pedido | agregado/HTTP/frontend migration 017 | canais, crédito, reserva e marcos críticos | 5 | `/api/v1/pedidos` e Comercial | R09, idempotência, estados |
| Pagamento/crédito | Financeiro e policies existentes | vínculo canônico com Pedido | 6 | Financeiro proprietário | webhook repetido/estorno |
| Estoque/reserva | Estoque e movimentação existentes | reserva omnicanal/ATP | 7 | Estoque proprietário | concorrência/overselling |
| Engenharia | projetos, produção e leitura assistida existentes | revisão/evidência/aprovação | 9 | projeto/revisão congelada | arquivo sintético e gate humano |
| Fabricação | Produção, formulários e otimizadores existentes | BOM/roteiro/custo realizado | 10–14 | Produção proprietária | cálculo, perda, rastreio |
| Catálogo/canais | Site CPA gateway, Portal, Chatbot e marketplace policies | outbox/reconciliação | 15–19 | APIs versionadas/adaptadores | replay, assinatura, dead-letter |
| Logística | Expedição, roteirização e App Motorista | vínculo integral ao Pedido | 20 | módulo logístico existente | prova, reversa, tenant |
| Fiscal | NotaFiscal e emissão existentes | faturamento parcial/multiempresa | 21 | empresa jurídica emissora | certificado/série/estoque corretos |
| Pós-venda | ocorrências, portal e atendimento | fluxo unificado | 22 | visão na Central 360 | SLA, evidências, autorização |
| BI/IA | relatórios, dashboards e agentes existentes | eventos/qualidade/SLO | 23 | leitura agregada paginada | explicabilidade e menor privilégio |
| Legado/VPS | runbooks e staging local | autorização externa | 25–26 | fora do GitHub para dados | reconciliação, backup e rollback |

# ONDAS DE IMPLEMENTAÇÃO

## Onda 0 — Inventário, arquitetura e contratos

### Entregas

- Inventariar ERP, Site CPA/Base44, páginas, rotas, entidades, migrations, APIs e integrações existentes.
- Mapear requisitos contra funcionalidades existentes, parciais, ausentes e duplicadas.
- Consolidar modelo de dados, estados, eventos, RBAC, auditoria e ownership por módulo.
- Criar matriz de rastreabilidade requisito → entidade → tela → API → teste → gate.
- Definir versionamento de API, idempotency key, correlation/request ID, outbox e webhooks.
- Definir OpenAPI/contratos compartilhados e estratégia de compatibilidade.
- Registrar ADRs das decisões estruturais.

### Aceite

- Nenhum módulo paralelo planejado.
- Toda frente possui dono canônico.
- Todos os requisitos deste documento aparecem na matriz.
- PR e CI verdes antes de iniciar migrations novas.

---

## Onda 1 — Cadastro mestre de produto, PIM e DAM

### Produto universal

Um cadastro canônico deve suportar, sem duplicação indevida:

- mercadoria para revenda;
- matéria-prima;
- componente/insumo;
- produto intermediário;
- produto fabricado;
- kit/pacote;
- serviço agregado;
- retalho/saldo;
- sucata.

### Dados mínimos

- código/SKU interno, código de barras e SKU por canal;
- nome interno e nomes comerciais por canal;
- descrições técnica, comercial e SEO;
- categorias e aplicações;
- material, liga, norma, bitola, espessura, largura, altura, comprimento e peso;
- unidades `PÇ`, `MT`, `M²`, `M³`, `KG`, `TON` e conversões controladas;
- embalagem, múltiplos, quantidade mínima e política de fracionamento;
- NCM, origem e atributos fiscais;
- imagens, galeria, vídeos, 360°, desenho, manual, certificado e arquivos CAD;
- variações e produtos equivalentes/substitutos;
- canais autorizados e conteúdo específico por canal;
- versão, responsável, aprovação e vigência.

### DAM

- Armazenamento seguro de arquivos e metadados.
- Hash, MIME, tamanho, antivírus, autorização e expiração de URL.
- Versões e vínculo com produto/projeto/pedido/OP.
- Nunca armazenar binário sensível diretamente em log ou GitHub.

---

## Onda 2 — Preço, custo, margem, desconto e condições

- Tabela de preço nomeada e multiempresa.
- Preço por cliente, segmento, empresa, região, canal e vigência.
- Preço para site, B2B, marketplace, balcão, vendedor e contrato.
- Custos de compra, médio, reposição, produção, máquina, mão de obra, perdas, embalagem, comissão, frete e taxas do canal.
- Margem mínima e alvo.
- Desconto percentual/valor por item e no total.
- Acréscimos, frete e impostos estimados.
- Alçadas por vendedor/supervisor/gestor.
- Condição à vista sem aprovação de supervisor quando a regra permitir.
- Condições e parcelas atômicas.
- Histórico e vigência; nunca alterar retroativamente snapshot de venda.
- Promoções, cupons e contratos B2B.
- Simulação antes de gravar e recálculo definitivo no servidor.

---

## Onda 3 — Cliente 360, CRM, leads e oportunidades

- Cliente/ClienteEmpresa/contatos/locais/obras como fonte única.
- Busca por nome, CPF/CNPJ, telefone, e-mail e número de pedido.
- Endereço com latitude/longitude, validação e mapa.
- Lead originado de site, app, telefone, vendedor, WhatsApp, Telegram, Instagram, Messenger, marketplace ou importação.
- Deduplicação segura de leads/clientes.
- Distribuição automática e manual de leads.
- Funil, tarefas, agenda, retorno e SLA.
- Histórico unificado de contatos e canais.
- Oportunidades, sinais, motivos de ganho/perda e próxima ação.
- Obra, projeto, etapa, pavimento, posição e centro de custo.
- Visão comercial de crédito, atraso, compras, margem, entregas e reclamações.
- Churn, recompra e recomendação como sugestão, não ação automática.

---

## Onda 4 — Orçamento 360

Preservar e evoluir o backend/HTTP já validado.

### Funções

- Listar, pesquisar, filtrar, criar, versionar, editar, consultar, imprimir, compartilhar e cancelar.
- ClienteEmpresa, local, obra/projeto, vendedor e empresa emissora.
- Origem/canal/campanha e identificador externo.
- Validade, prazo estimado e Data de Entrega do Cliente.
- Itens de revenda, serviços, fabricados, kits e projetos.
- Peso, quantidade, unidade, preços, descontos, acréscimos, frete e impostos estimados.
- Tabela e condição de pagamento visíveis pelo nome.
- Snapshots comerciais e técnicos.
- Anexos, imagens, desenhos e revisões.
- Aprovação de desconto/margem/crédito.
- PDF/visual de impressão profissional e envio auditado.
- Conversão idempotente em Pedido, preservando o original.

### Frontend

- Menu e RBAC visual.
- Listagem/paginação/filtros.
- Formulário reutilizável com totais em tempo real.
- Detalhe, versões, histórico e ações permitidas por estado.
- Proteção contra duplo envio e abandono de formulário alterado.

---

## Onda 5 — Pedido 360 omnicanal

### Origem única

Pedidos manuais, de orçamento, site, portal B2B, app, chatbot, marketplace ou importação usam o mesmo agregado canônico.

### Campos e regras

- empresa, número sequencial, cliente, contato, local, obra/projeto e vendedor;
- origem, canal, `externalOrderId`, idempotency key e campanha;
- tipo: revenda, Armado, Corte e Dobra, fabricação, kit, serviço ou misto;
- itens, snapshots, pesos, preços, descontos, acréscimos, frete e totais;
- Entrega ou Retirada com confirmação editável de endereço;
- Data de Entrega do Cliente em pedido, produção, separação, expedição, romaneio e filtros;
- condição de pagamento, crédito e autorização;
- Tipo de NF exigido somente ao fechar/transferir, alterável no Faturamento conforme permissão;
- status, histórico, anexos e observações;
- faturamento parcial e entrega parcial;
- seleção múltipla para operações compatíveis;
- bloqueio de alterações após marcos críticos, salvo revisão autorizada;
- cancelamento com motivo, impacto e rollback/domínio compensatório.

### Venda Armado/Solto

- Manter fluxos separados e claros.
- Tabela nomeada pode afetar Armado segundo a regra atual, sem alterar indevidamente revenda.
- Produto Armado segue Produção → Pronto → Entrega/Retirada.
- Corte e Dobra pode existir sem serviço Armado.

---

## Onda 6 — Crédito, pagamento, caixa e cobrança

- Análise de crédito por ClienteEmpresa/Empresa.
- Limite, comprometido, disponível, atraso, bloqueio e exceções aprovadas.
- Venda futura condicionada ao crédito.
- PIX, boleto, cartão, link de pagamento e recebimentos presenciais.
- Link com antifraude, identificação de pedido/CNPJ/pagador e evidências.
- Webhooks idempotentes; nunca confiar apenas no retorno do navegador.
- Caixa com abertura obrigatória.
- Centralização de recebimentos e liquidações.
- Proibir exclusão/baixa fora da data sem fluxo autorizado.
- Conciliação de cartão, boleto, PIX e banco.
- Cobrança: envio NF+boleto, lembrete D-2 e histórico.
- Nenhum chatbot confirma pagamento sem validação no provedor/financeiro.

---

## Onda 7 — Estoque, disponibilidade, reserva e separação

- Estoque físico, disponível, reservado, em separação, produção, trânsito e qualidade.
- Saldo por Grupo/Empresa, depósito, endereço, lote e unidade.
- Conversões e peso teórico/real.
- Reserva idempotente por pedido/canal.
- Expiração/liberação de reserva.
- Prevenção de overselling omnicanal.
- Sem estoque: bloquear transferência e destacar item em vermelho.
- Alternativos/equivalentes exigem aceite e registro.
- Separação com coletor, etiquetas e QR Code.
- Inventário, divergência, ajuste e auditoria.
- Estoque detalhado para Compras e reposição múltipla.

---

## Onda 8 — Compras e abastecimento ligados ao Comercial

- Necessidade gerada por venda, estoque mínimo, produção ou projeto.
- Cotação unificada e comparação por preço, prazo, imposto, frete e qualidade.
- Pedido de compra em unidade e/ou kg com conversão.
- Sugestão de reposição múltipla.
- Reserva futura ligada ao pedido de venda.
- Follow-up de fornecedor e previsão de chegada.
- Recebimento, lote, qualidade e divergência.
- Atualização de custo e impacto controlado em preço/margem.

---

## Onda 9 — Engenharia, projetos e arquivos técnicos

- Projeto, revisão, versão, responsável, situação e aprovação.
- Upload seguro de PDF, DWG, DXF, JPG/PNG e preparação futura para IFC/BIM.
- Extração de peças, medidas, bitolas, estribos, dobras, reforços e referências.
- Resolver variáveis, referências cruzadas e medidas derivadas.
- Preservar origem, página/camada, evidência e nível de confiança.
- Tabela editável para conferência/correção do cliente e equipe.
- Revisão técnica humana obrigatória antes de orçamento/produção.
- Comparar versões e registrar divergências.
- Desenho de fabricação, montagem, vista explodida e manual.
- Aprovação/assinatura do cliente quando necessária.

---

## Onda 10 — Monte sua Armação 2.0

- Viga, Coluna, Estaca, Bloco e Sapata.
- Ferro principal de 6,3 a 25,0 mm; estribos 4,2/5,0 mm, mantendo cadastro configurável.
- Cálculo base de estribos: `floor(comprimento(cm) / distância(cm)) + 1`, validado por regras técnicas/revisão.
- Campos de medidas, bitolas, espaçamentos, ganchos, dobras, emendas e reforços.
- Visualização 2D/3D atualizada pelas medidas.
- Peças, posições, etapa, ponto da obra, pavimento e cronograma.
- Lista de materiais, peso, plano de corte, perdas, sobras e preço.
- Salvar configuração versionada; enviar ao vendedor/ERP/produção sem redigitação.
- Leitura de projeto segue o gate humano da Onda 9.

---

## Onda 11 — Corte e dobra de vergalhão e chapa

### Vergalhão

- posições, formatos, medidas, ângulos, bitola, quantidade e peso;
- plano de corte por barras disponíveis;
- otimização, emendas permitidas, perdas e sobras;
- etiquetas por peça/posição/obra;
- inspeção e certificado/lote.

### Chapa

- material/liga, espessura, largura, comprimento e peso;
- corte, dobra, furação, recorte, solda e acabamento;
- desenho 2D/3D e arquivos CAD anexados;
- nesting/plano de corte;
- número, ângulo, raio, tolerância e sentido das dobras;
- tempo de setup, máquina e operador;
- simulação de custo, preço, capacidade e prazo;
- inspeção dimensional e rastreabilidade da peça.

---

## Onda 12 — Fabricação de peças, kits e produtos próprios

O sistema deve permitir usar qualquer material vendido pela CPA como matéria-prima de produtos, incluindo tubos/metalon, perfis, chapas, cantoneiras, barras, vergalhões, telas, treliças, arames e acessórios.

### Exemplos

- mãos francesas, suportes, bases, cavaletes, racks, prateleiras e bancadas;
- estacas, cercamentos, portões e estruturas simples;
- kits de serralheria/construção;
- peças cortadas/dobradas e estruturas de metalon;
- produto montado, desmontado, kit ou instalação no local.

### Engenharia do produto

- BOM/lista de materiais multinível;
- roteiro: corte, furação, dobra, solda, usinagem, pintura, inspeção, embalagem e montagem;
- desenhos de fabricação e montagem;
- versão/revisão e substitutos aprovados;
- máquinas, ferramentas, habilidades e tempos;
- consumíveis: arame MIG, eletrodo, gás, discos, tinta e embalagem;
- terceirização de operação;
- custo previsto e realizado;
- qualidade, retrabalho, não conformidade e garantia.

### Rendimento

Exemplo obrigatório: uma barra de 6 m pode gerar 10 mãos francesas. Calcular:

- cortes e espessura da serra;
- quantidade possível;
- perda operacional;
- sobra aproveitável;
- sucata;
- material, mão de obra, máquina, consumíveis, acabamento e embalagem;
- custo unitário, margem e preço.

---

## Onda 13 — Otimização de corte, retalhos e sucata

- Otimizar barras de 6/12 m, tubos, metalons, perfis, cantoneiras, vergalhões, chapas e bobinas.
- Priorizar combinação economicamente adequada entre material inteiro e retalho.
- Considerar kerf/espessura de corte, garras, perdas técnicas e orientação.
- Explicar o plano e permitir revisão humana.
- Retalho útil retorna ao estoque com material, medidas, peso, lote, localização, custo proporcional, foto e disponibilidade.
- Outlet CPA para retalhos/saldos por tipo, espessura/bitola, comprimento, conservação e peso.
- Sucata inviável controlada por classificação e peso.
- Comparar orçado × reservado × consumido × produzido × sucata.

---

## Onda 14 — Produção e chão de fábrica

- Ordem de Produção originada de pedido/projeto aprovado.
- Capacidade finita por máquina, turno e equipe.
- Fila e prioridade por Data de Entrega do Cliente.
- Separação/baixa de matéria-prima e consumíveis.
- Apontamento de início, pausa, término, quantidade, perda e motivo.
- Etapas, posições e dependências.
- Etiquetas/QR Code, lote e rastreabilidade.
- Inspeção dimensional/qualidade e liberação.
- Retrabalho e não conformidade.
- Manutenção preventiva/corretiva das máquinas.
- Impressão do Armado somente em Produção; registrar usuário/impressora/data e impedir reimpressão não autorizada.
- Alertar Vendas quando estiver pronto para entrega/retirada.

---

## Onda 15 — Catálogo omnicanal e sincronização

Distribuir do ERP para site, portal, app, chatbots e marketplaces:

- produto/SKU e variações;
- imagens, vídeos, desenhos, manuais e certificados;
- descrições e atributos;
- preço/promoção conforme canal/cliente;
- estoque disponível e prazo;
- peso, dimensões, embalagem e frete;
- kit, montagem e serviços;
- situação de publicação.

### Hub de integração

- fila/outbox transacional;
- versão enviada por canal;
- sucesso, erro, tentativas e próxima tentativa;
- dead-letter e reprocessamento;
- rate limit e idempotência;
- reconciliação ERP × canal;
- alerta de divergência;
- webhooks verificados e auditados.

---

## Onda 16 — Site CPA, e-commerce e portal B2B

### Jornadas

1. Comprar online.
2. Montar lista e enviar para vendedor/orçamento.
3. Monte sua Armação/projeto técnico para orçamento e produção.

### Site/e-commerce

- catálogo, busca técnica e visual, filtros e SEO;
- preço e estoque autorizados;
- carrinho, frete, checkout e pagamento;
- B2B/B2C conforme política;
- pedido idempotente no ERP;
- analytics/campanhas sem expor dados sensíveis.

### Portal do Cliente

- contas empresariais, usuários e permissões;
- obras, projetos, listas recorrentes e aprovações;
- orçamentos, pedidos, notas, boletos, PIX e pagamentos;
- entrega em tempo real, comprovantes e ocorrências;
- documentos, certificados, desenhos e manuais;
- chat, suporte, devolução e assinatura;
- SSO/autenticação e isolamento multiempresa.

---

## Onda 17 — Aplicativo e operação móvel

- Aplicativo do cliente com catálogo, orçamento, pedido, pagamento, rastreio e suporte.
- Aplicativo/vista operacional para vendedor.
- Aplicativo do motorista com rota, navegação, comprovantes, fotos e ocorrências.
- Operações offline controladas, sincronização idempotente e conflitos explícitos.
- Push notification e preferências de comunicação.
- Mesmas APIs e regras do ERP; nenhuma base comercial paralela.

---

## Onda 18 — Vendas conversacionais, chatbot e GoTo

### Canais

- WhatsApp;
- Telegram;
- Instagram Direct;
- Facebook Messenger;
- chat do site;
- aplicativo;
- canais futuros via adaptadores.

### Chatbot vendedor

- identificar cliente ou criar lead;
- catálogo, imagens, dados técnicos, preço, estoque e prazo;
- recomendar produto/aplicação dentro de regras;
- receber lista, projeto e arquivos;
- montar carrinho/orçamento e gerar PDF;
- solicitar aprovação de vendedor/desconto/crédito;
- converter em pedido de forma idempotente;
- gerar link de pagamento;
- informar produção, separação, faturamento e entrega;
- abrir pós-venda;
- transferir ao humano com contexto completo.

### Segurança

- consentimento, opt-in/opt-out e LGPD;
- templates oficiais;
- mascaramento e retenção;
- bot não altera preço, crédito, produção, cancelamento ou pagamento fora das regras;
- mensagens automáticas críticas passam por gates.

### GoTo/telefonia

- identificar cliente por telefone;
- screen-pop da Central 360;
- click-to-call;
- registrar chamada, duração, atendente, resultado e retorno;
- vínculo lead/cliente/oportunidade/orçamento/pedido;
- gravação ou link somente conforme permissão, política e LGPD;
- métricas de atendimento e SLA.

---

## Onda 19 — Marketplaces

- Adaptadores para Mercado Livre, Shopee, TikTok Shop e canais futuros.
- Vínculo SKU/anúncio/variação.
- Publicação de catálogo e mídia.
- Preço, promoção, comissão, tarifa e margem por canal.
- Estoque/reserva sincronizados.
- Importação idempotente de pedido.
- Pagamento, fiscal, etiqueta, separação e expedição.
- Perguntas/mensagens integradas ao CRM.
- Cancelamento, devolução, reclamação e reputação.
- Conciliação financeira e de taxas.
- Nunca permitir pedido/estoque paralelo sem reconciliação com ERP.

---

## Onda 20 — Expedição, roteirização, motorista e instalação

- Separar Entregas e Retiradas.
- Relatório de entregas futuras.
- Seleção múltipla para roteirizador.
- Painel por cidade/região/data/status.
- Geocodificação, mapa e validação do endereço.
- Peso, volume, capacidade, restrição, janela e prioridade.
- Roteirização com caminhão, motorista, placa, sequência e previsão.
- GPS/rastreamento quando disponível.
- Romaneio com fonte legível, assinatura e documento do recebedor.
- Fotos nítidas da mercadoria e do canhoto.
- Etiquetas de separação.
- Tentativa, não entrega, falta, avaria, devolução e logística reversa.
- Histórico completo e mensagem ao cliente.
- Instalação no local: equipe, agenda, peças numeradas, desenho/manual, checklist, fotos antes/depois e aceite.
- Integração de conclusão com faturamento e financeiro.

---

## Onda 21 — Faturamento, fiscal e devolução

- Tipo de NF definido ao fechar/transferir e alterável no Faturamento com permissão/auditoria.
- Faturamento parcial ou total por quantidade/entrega.
- Seleção múltipla segura.
- NF-e/NFS-e conforme natureza da operação.
- Regras por Empresa, cliente, produto, serviço e canal.
- Vínculo pedido → entrega → NF → cobrança.
- Devolução por unidade com peso teórico/real.
- Travamentos e autorização para NF de devolução.
- Carta de correção/cancelamento conforme regra fiscal.
- Nunca inventar regra tributária; parametrizar e homologar com responsável fiscal.

---

## Onda 22 — Pós-venda, garantia e relacionamento

- Reclamação, ocorrência, assistência, garantia, troca e devolução.
- Vínculo com cliente, pedido, item, lote, produção, entrega e atendimentos.
- Fotos, documentos e evidências.
- SLA, responsável, causa, ação corretiva e custo.
- Pesquisa de satisfação.
- Reposição/reentrega e logística reversa.
- Alertas de recompra, churn e oportunidade.
- Histórico disponível na Central 360 e no Portal.

---

## Onda 23 — BI, IA, automações e observabilidade

### Indicadores

- funil, conversão e tempo por etapa;
- vendas, margem, desconto e comissão;
- vendedor, cliente, produto, canal, região e empresa;
- orçado × pedido × reservado × produzido × faturado × entregue × recebido;
- capacidade, eficiência, perdas, sucata e retrabalho;
- estoque, giro, ruptura e excesso;
- prazo prometido × realizado;
- frete, rota e entrega;
- inadimplência, cobrança e conciliação;
- chatbot, telefone e SLA;
- marketplace, taxas, reputação e devolução.

### IA

- recomendação de produtos e próxima ação;
- detecção de anomalias de margem, preço, crédito, estoque, produção e financeiro;
- previsão de demanda, churn e atraso;
- leitura assistida de projetos;
- otimização de corte e rota;
- resumo de atendimento;
- sugestões sempre explicáveis e auditadas.

### Observabilidade

- logs estruturados e sanitizados;
- métricas, traces, correlation ID e dashboards;
- tela de erros com tela/usuário/data/hora/request ID;
- monitoramento de filas/webhooks e alertas;
- runbooks e SLOs.

---

## Onda 24 — Segurança, testes e homologação integral

### Segurança

- RBAC backend/frontend por ação e Empresa.
- TenantGuard e 404 cross-tenant.
- RLS/FORCE, privilégios mínimos e secrets fora do repositório.
- validação estrita de payload e upload;
- rate limit, antifraude, CSRF/CORS/autenticação conforme arquitetura;
- LGPD: finalidade, consentimento, retenção, exportação e anonimização quando aplicável;
- auditoria imutável e sanitizada.

### Testes

- unitários, contratuais, integração, PostgreSQL, HTTP e frontend;
- E2E das jornadas balcão, orçamento, site, chatbot, marketplace, produção, entrega e pagamento;
- isolamento Grupo/Empresa;
- RBAC positivo/negativo;
- idempotência, concorrência, rollback e sequência;
- valores monetários, unidades e conversões;
- arquivos técnicos e aprovação humana;
- estoque/reserva e overselling;
- webhooks e reconciliação;
- acessibilidade, responsividade e performance;
- migrations em PostgreSQL efêmero e dados apenas sintéticos;
- backup/restore e disaster recovery em ambiente autorizado.

---

## Onda 25 — Migração do ERP antigo

### Gate obrigatório

Somente iniciar leitura/importação real após autorização e ambiente de staging isolado.

### Processo

1. Descobrir formato, engine, arquivos, volumes e hashes sem alterar a origem.
2. Criar inventário sanitizado.
3. Mapear origem → canônico.
4. Criar perfil de qualidade e regras de deduplicação.
5. Construir ETL idempotente, reexecutável e auditável.
6. Testar com dados sintéticos.
7. Executar cópia de trabalho protegida, nunca sobre o original.
8. Importar para staging.
9. Reconciliar contagens, valores, saldos, clientes, produtos, pedidos, financeiro e documentos.
10. Homologação amostral e assinatura dos responsáveis.
11. Planejar delta/cutover e rollback.

Dados reais permanecem fora do GitHub.

---

## Onda 26 — VPS, canário, implantação e go-live

### Não executar automaticamente sem autorização

- backup oficial e hashes;
- auditoria inicial somente leitura;
- migrations pendentes;
- imagem imutável e rotulada com SHA;
- canário em porta isolada;
- health, ready, meta, smoke e E2E;
- rollback testado;
- promoção controlada;
- observação pós-deploy;
- documentação do estado comprovado.

### Gates

- Gate A: código/PR/revisão.
- Gate B: CI frontend/backend/PostgreSQL.
- Gate C: auditoria VPS somente leitura.
- Gate D: canário.
- Gate E: migrations/compatibilidade autorizadas.
- Gate F: promoção e smoke oficial.
- Gate G: dados legado/staging.
- Gate H: homologação do negócio.
- Gate I: go-live e estabilização.

Não alterar a porta 3080, executar migration/seed real, promover container ou mesclar PR sem o gate correspondente.

---

## 7. Matriz RBAC mínima

Para cada recurso, considerar pelo menos:

- visualizar;
- criar;
- editar;
- cancelar/inativar/restaurar quando aplicável;
- aprovar desconto;
- aprovar margem;
- aprovar crédito;
- alterar preço;
- reservar/liberar estoque;
- aprovar projeto;
- liberar produção;
- apontar/inspecionar produção;
- faturar/cancelar NF;
- receber/estornar;
- roteirizar/entregar;
- publicar canal;
- exportar/importar;
- visualizar custo/margem/dados financeiros;
- administrar integrações.

A interface oculta/bloqueia ações não autorizadas, mas somente o backend decide.

---

## 8. Critério de conclusão do Comercial 360

O programa não está concluído apenas porque Orçamento e Pedido funcionam. A conclusão exige:

- matriz de rastreabilidade sem requisito órfão;
- fonte única e ausência de módulos paralelos;
- jornadas balcão, site, portal, app, chatbot e marketplace homologadas;
- catálogo/mídia/preço/estoque sincronizados e reconciliados;
- orçamento/pedido/crédito/reserva/produção/entrega/faturamento integrados;
- engenharia, Armado, Corte e Dobra, CAD, BOM, kits e fabricação validados;
- logística, pagamento, fiscal e pós-venda operacionais;
- multiempresa, RBAC, RLS e auditoria aprovados;
- testes e CI verdes;
- segurança e observabilidade aprovadas;
- scripts de deploy/rollback prontos;
- migração legado reconciliada quando autorizada;
- VPS promovida somente após todos os gates;
- documentação e handoff refletindo fatos comprovados.

---

## 9. Definição de pronto por checkpoint

Um checkpoint só pode ser marcado `CONCLUÍDO` quando:

1. implementação e migration necessárias existem;
2. revisão contra Regra-Mãe passou;
3. testes direcionados e regressão passaram;
4. typecheck, lint, build e `git diff --check` passaram;
5. PostgreSQL efêmero passou quando aplicável;
6. segurança/tenant/RBAC/auditoria foram testados;
7. documentação/status foram atualizados;
8. commit e push foram feitos;
9. SHA remoto foi confirmado;
10. CI finalizou verde;
11. nenhum dado real/segredo foi enviado;
12. rollback está descrito ou testado conforme risco.

---

## 10. Relatório consolidado obrigatório

```text
PROGRAMA ..................... COMERCIAL 360 OMNICANAL
DOCUMENTO .................... docs/PROGRAMA_COMERCIAL_360_OMNICANAL_EXECUCAO_AUTONOMA.md
BASE INICIAL ................. a329c8751323890fd5737e4d3f6d659b10dca52c
BRANCHES/PRS ................. <lista>
ONDAS CONCLUÍDAS ............. <lista>
ONDAS EM EXECUÇÃO ............ <lista>
ONDAS BLOQUEADAS ............. <lista e motivo real>
COMMITS ...................... <lista completa por checkpoint>
WORKFLOWS .................... <ids/links/resultados>
REGRA-MÃE .................... <resultado>
MULTIEMPRESA/RBAC/RLS ........ <resultado>
AUDITORIA .................... <resultado>
CLIENTE/CRM .................. <resultado>
ORÇAMENTO .................... <resultado>
PEDIDO ....................... <resultado>
PREÇO/CRÉDITO/PAGAMENTO ...... <resultado>
ESTOQUE/RESERVA .............. <resultado>
ENGENHARIA/CAD ............... <resultado>
ARMAÇÃO 2.0 .................. <resultado>
CORTE E DOBRA ................ <resultado>
FABRICAÇÃO/BOM/KITS .......... <resultado>
PRODUÇÃO ..................... <resultado>
PIM/DAM/CATÁLOGO ............. <resultado>
SITE/PORTAL/APP .............. <resultado>
CHATBOT/WHATSAPP/REDES ....... <resultado>
GOTO/TELEFONIA ............... <resultado>
MARKETPLACES ................. <resultado>
EXPEDIÇÃO/ROTAS/MOTORISTA .... <resultado>
FISCAL/FATURAMENTO ........... <resultado>
PÓS-VENDA .................... <resultado>
BI/IA/OBSERVABILIDADE ........ <resultado>
TESTES FRONTEND .............. <total/pass/fail/skip>
TESTES BACKEND ............... <total/pass/fail/skip>
POSTGRESQL/MIGRATIONS ........ <resultado>
MIGRAÇÃO LEGADO .............. <não iniciada/preparada/homologada>
VPS/CANÁRIO/PROMOÇÃO ......... <resultado>
DADOS REAIS NO GITHUB ........ NÃO
BLOQUEIOS REAIS .............. <lista objetiva>
PRÓXIMO GATE ................. <gate e ação exata>
```

---

## 11. Ordem imediata de execução

1. Versionar este documento consolidado e atualizar PR #33/status com o baseline factual.
2. Concluir a Onda 0 com inventário, ownership, contratos, eventos e matriz completa, sem reimplementar a V1.
3. Preparar sequencialmente os contratos das Ondas 1, 3, 5, 9 e 15 no mesmo worktree, evitando edição concorrente.
4. Iniciar a implementação da Onda 1 no cadastro de Produto existente, primeiro fechando o menor checkpoint estrutural sem migration desnecessária.
5. Manter as Ondas 4 e 5 como fundações parcialmente entregues até fechar todas as lacunas declaradas.
6. Continuar automaticamente pelos checkpoints liberados, sempre com commit, push, SHA remoto e CI verde.
7. Não aguardar nova mensagem de “próximo”; parar apenas nos gates externos descritos.

---

## 12. Controle de mudanças deste documento

Novos requisitos não devem ser perdidos em chats. Sempre que surgir melhoria:

1. registrar na matriz de rastreabilidade;
2. classificar a onda e dependências;
3. verificar duplicidade/conflito;
4. atualizar este documento no GitHub;
5. implementar em checkpoint rastreável;
6. testar e registrar o resultado.

Este documento é vivo, mas suas alterações também obedecem à Regra-Mãe, revisão e versionamento.
