# AGENTS.md — ERP ZuCCARO

## 0. FINALIDADE DESTE ARQUIVO

Este arquivo contém as regras permanentes e obrigatórias para qualquer agente de IA, Codex, Cursor, automação, desenvolvedor ou ferramenta que altere este repositório.

Estas instruções têm prioridade operacional dentro do projeto. Antes de criar, alterar, mover, refatorar, excluir, integrar, migrar ou testar qualquer parte do ERP, o agente deve ler este arquivo integralmente e seguir todas as regras abaixo.

O objetivo é evoluir o ERP Zuccaro sem criar módulos paralelos, sem quebrar o que já existe, sem perder dados, sem enfraquecer segurança, e mantendo multiempresa, RBAC, auditoria, rastreabilidade, responsividade e integração entre todos os módulos.

---

# 1. REGRA-MÃE — OBRIGATÓRIA E INVIOLÁVEL

## 1.1 Proibição absoluta de criação paralela

É proibido criar módulo, tela, página, funcionalidade, componente, hook, serviço, entidade, endpoint, função backend, relatório, dashboard, rotina, automação ou arquivo novo quando já existir implementação com propósito, nome ou função igual ou semelhante.

Antes de criar qualquer coisa, o agente deve:

1. pesquisar todo o repositório;
2. localizar nomes iguais e similares;
3. localizar componentes com finalidade equivalente;
4. mapear consumidores existentes;
5. verificar rotas, imports, hooks, funções, entidades e integrações relacionadas;
6. decidir se o requisito pode ser atendido melhorando o existente;
7. somente criar algo novo quando não existir equivalente técnico viável e quando a nova criação for indispensável à refatoração ou à infraestrutura.

Mesmo em caso de criação tecnicamente necessária, o agente deve registrar no relatório final:

- por que não havia equivalente;
- por que a criação era indispensável;
- quais componentes existentes foram reutilizados;
- como a nova estrutura se integra ao fluxo atual.

## 1.2 Melhorar sempre no existente

Toda correção, melhoria, otimização ou evolução funcional deve acontecer prioritariamente nos módulos, telas, arquivos, entidades e fluxos já existentes.

Não criar `ComercialV2`, `FinanceiroNovo`, `DashboardNovo`, `PortalCliente2`, `RoteirizadorNovo`, `ChatbotNovo`, `PedidosNovaVersao` ou equivalentes apenas para evitar corrigir a estrutura atual.

## 1.3 Refatoração obrigatória de arquivos grandes

Quando um arquivo, componente ou módulo ultrapassar aproximadamente 400–600 linhas, ou quando sua legibilidade, manutenção, teste ou compreensão estiver comprometida, ele deve ser refatorado.

A refatoração pode extrair:

- hooks;
- helpers;
- validadores;
- schemas;
- componentes internos;
- serviços;
- adaptadores;
- funções puras;
- tabelas auxiliares;
- utilitários.

A refatoração deve preservar:

- comportamento atual;
- props públicas;
- fluxos do usuário;
- rotas;
- permissões;
- auditoria;
- multiempresa;
- integrações;
- responsividade.

## 1.4 Nunca apagar funcionalidades

Não apagar, remover, esconder permanentemente, desativar ou substituir de forma irreversível:

- funcionalidades;
- botões;
- abas;
- campos;
- fluxos;
- páginas;
- relatórios;
- integrações;
- códigos legados ainda consumidos;
- dados históricos.

Antes de retirar algo de navegação ou de uso, deve existir:

1. inventário;
2. análise de consumidores;
3. equivalência funcional comprovada;
4. migração;
5. testes;
6. homologação;
7. autorização explícita.

## 1.5 Não quebrar o fluxo existente

Nenhuma alteração pode interromper o fluxo operacional já existente.

Exemplos de fluxos que devem permanecer íntegros:

- pedido → estoque → aprovação → faturamento → NF → financeiro → entrega → WhatsApp;
- compra → recebimento → estoque → financeiro;
- produção → apontamento → estoque → expedição;
- entrega → motorista → prova de entrega → ocorrência → retorno ao ERP.

---

# 2. MULTIEMPRESA ABSOLUTA

Toda leitura, criação, alteração, exclusão lógica, aprovação, relatório, importação, exportação, integração, job, webhook, IA e automação deve operar com contexto explícito de Grupo e Empresa quando aplicável.

## 2.1 Contrato canônico

Toda operação deve trabalhar com:

- `groupId` / `group_id`;
- `empresaId` / `empresa_id`;
- `scopeType` quando existir contexto Grupo ou Empresa;
- usuário autenticado;
- permissões efetivas.

Nomes legados devem ser normalizados progressivamente sem quebrar consumidores.

## 2.2 Regra Grupo → Empresas

Tudo que for feito no Grupo e for cadastro compartilhado deve ficar automaticamente disponível para as empresas selecionadas ou pertencentes ao grupo conforme regra da entidade.

Isso não significa copiar fisicamente registros operacionais para todas as empresas.

Cadastros mestres devem ser compartilhados por vínculo, visibilidade ou parametrização, evitando duplicação desnecessária.

## 2.3 Regra Empresa → Grupo

Tudo que for feito em uma Empresa deve aparecer no Grupo em visão consolidada, preservando a empresa proprietária original.

O Grupo consolida; a Empresa opera.

## 2.4 Faturamento no Grupo

Quando o usuário iniciar faturamento pela visão do Grupo, a Nota Fiscal deve ser emitida exclusivamente pela empresa jurídica responsável pela operação.

Nunca emitir NF usando identidade fiscal genérica do Grupo.

## 2.5 Bloqueios obrigatórios

O backend deve bloquear:

- `empresaId` que não pertence ao `groupId`;
- empresa não autorizada ao usuário;
- troca manual de IDs em request;
- tentativa de acesso via localStorage manipulado;
- acesso cruzado entre empresas sem permissão;
- acesso de cliente a dados de outro cliente;
- acesso de motorista a entrega não atribuída.

Frontend não é segurança. Toda regra deve ser validada novamente no backend.

---

# 3. RBAC GRANULAR — FRONTEND E BACKEND

Toda tela, módulo, submódulo, aba, seção, campo, botão, ação, endpoint, exportação, importação, integração e dado sensível deve ter controle de permissão.

## 3.1 Padrão de chave

Preferir chaves granulares como:

- `comercial.pedido.visualizar`
- `comercial.pedido.criar`
- `comercial.pedido.editar`
- `comercial.pedido.aprovar`
- `comercial.pedido.desconto.aprovar`
- `financeiro.caixa.visualizar`
- `financeiro.caixa.baixa-manual`
- `financeiro.contas-pagar.aprovar`
- `fiscal.nota.emitir`
- `fiscal.nota.cancelar`
- `administracao.acessos.visualizar`
- `administracao.acessos.editar`
- `sistema.integracoes.executar`

## 3.2 Ações que não devem ser agrupadas indevidamente

Separar sempre que houver risco operacional:

- visualizar;
- criar;
- editar;
- inativar;
- restaurar;
- aprovar;
- rejeitar;
- emitir;
- cancelar;
- receber;
- pagar;
- conciliar;
- estornar;
- importar;
- exportar;
- configurar;
- executar;
- administrar acessos;
- visualizar custo;
- visualizar margem;
- visualizar salário;
- visualizar dados bancários.

## 3.3 Segregação de funções

Evitar que a mesma pessoa execute ponta a ponta um processo crítico sem alçada.

Exemplos:

- quem cria pagamento não aprova o próprio pagamento;
- quem concede desconto fora da alçada não aprova o próprio desconto;
- quem cria compra não aprova a mesma compra;
- quem administra permissões não pode apagar auditoria;
- quem emite NF não cancela sem permissão específica.

---

# 4. SEGURANÇA OBRIGATÓRIA

Toda alteração deve reforçar segurança, nunca reduzi-la.

## 4.1 Entrada de dados

Aplicar no backend:

- schema de validação;
- sanitização;
- allowlist de campos;
- limites de tamanho;
- validação de CPF/CNPJ;
- e-mail;
- telefone;
- datas;
- valores;
- percentuais;
- IDs;
- URLs;
- arquivos.

## 4.2 Proteção contra XSS e injeção

Nunca confiar em input recebido do frontend, importação, webhook, planilha, XML, site, marketplace, chatbot ou IA.

Sanitizar no write path e escapar no render path quando necessário.

## 4.3 Uploads

Validar:

- extensão;
- MIME;
- tamanho;
- conteúdo;
- quantidade;
- origem;
- permissão;
- vínculo Grupo/Empresa.

Não persistir URLs temporárias ou credenciais em auditoria.

## 4.4 Sessões e perfis sensíveis

Exigir política mais forte para:

- administradores;
- financeiro;
- fiscal;
- usuários com acesso a permissões;
- integrações;
- certificados;
- configurações de segurança.

Quando suportado, utilizar MFA, expiração de sessão, revogação e controle de dispositivo.

## 4.5 Webhooks e integrações

Implementar:

- assinatura;
- idempotência;
- proteção contra replay;
- timeout;
- retry;
- fila morta;
- logs sanitizados;
- alerta em falha persistente.

---

# 5. AUDITORIA COMPLETA E CONFIÁVEL

Toda ação relevante deve gerar log de auditoria.

Registrar pelo menos:

- usuário;
- perfil;
- data/hora;
- módulo;
- entidade;
- registro;
- ação;
- antes;
- depois;
- `groupId`;
- `empresaId`;
- origem;
- identificador de correlação;
- sucesso/falha;
- justificativa quando necessária.

## 5.1 Ações obrigatoriamente auditadas

- criar;
- editar;
- aprovar;
- rejeitar;
- inativar;
- restaurar;
- emitir;
- cancelar;
- receber;
- pagar;
- conciliar;
- estornar;
- alterar preço;
- alterar desconto;
- alterar permissão;
- alterar integração;
- exportar informação sensível;
- importar dados;
- migração.

## 5.2 Catch vazio proibido em operação crítica

Não utilizar `catch {}` para ignorar falha operacional, auditoria, integração, permissão, persistência ou segurança.

Falhas devem:

1. ser tratadas;
2. gerar mensagem apropriada;
3. ser registradas de forma segura;
4. reverter ou bloquear a operação quando necessário.

---

# 6. CADASTROS GERAIS COMO FONTE MESTRE

Cadastros Gerais deve ser a fonte única e confiável para dados mestres consumidos pelo ERP.

## 6.1 Não duplicar cadastros por módulo

Comercial, Financeiro, Compras, Estoque, Fiscal, Produção, Logística, RH, Chatbot, Portal, Site e Marketplace devem reutilizar os cadastros mestres existentes.

## 6.2 Código sequencial

Todo registro que exija código deve possuir código interno sequencial, único e controlado pelo backend.

Nunca gerar código com base apenas em `count + 1` no frontend.

A reserva deve ser atômica ou segura contra concorrência.

## 6.3 Importação do ERP antigo

Quando importar registro com código já existente:

1. preservar o código original em campo de origem/legado;
2. detectar conflito;
3. gerar próximo código interno disponível;
4. registrar o mapeamento;
5. impedir sobrescrita silenciosa;
6. registrar auditoria;
7. produzir relatório de conflitos.

## 6.4 Duplicidade

A validação deve considerar, conforme entidade:

- código;
- descrição normalizada;
- documento;
- e-mail;
- identificador externo;
- chaves compostas.

Comparação deve tratar espaços, caixa e outras normalizações necessárias sem destruir o valor original exibido.

---

# 7. FUNCIONALIDADE DE PONTA A PONTA

Uma tela não é considerada pronta apenas porque renderiza.

Todo fluxo deve comprovar:

1. entrada;
2. validação;
3. autorização;
4. persistência;
5. atualização de estado;
6. integração com módulos relacionados;
7. auditoria;
8. erro controlado;
9. reabertura com estado correto;
10. relatório ou indicador correto quando aplicável.

---

# 8. LAYOUT, RESPONSIVIDADE E MULTITAREFA

Todas as telas, páginas, modais e containers principais devem respeitar:

- `w-full`;
- `h-full`;
- flex/grid responsivo;
- redimensionamento;
- tablet;
- desktop;
- celular quando aplicável;
- abas fixas;
- conteúdo rolável;
- rodapé de ações acessível.

Evitar alturas rígidas que cortem conteúdo em janelas menores.

Preservar multitarefa e estado quando minimizar/maximizar/restaurar janelas.

---

# 9. CONTROLES INTERATIVOS

Todo botão, switch, toggle, checkbox, radio, select, combobox, input, upload, menu e ação de tabela deve ser funcional.

O agente deve testar:

1. visualização correta;
2. permissão;
3. clique/interação;
4. loading;
5. persistência;
6. reabertura;
7. Grupo/Empresa;
8. erro;
9. auditoria;
10. duplo clique/idempotência.

Controle que muda apenas visualmente e não persiste deve ser tratado como defeito.

---

# 10. CONSULTAS, PAGINAÇÃO E KPIs

Não calcular KPI total usando apenas registros carregados na primeira página.

Regras:

- paginação server-side;
- busca server-side para volumes grandes;
- contagem separada da listagem;
- agregação no backend;
- queryKey por usuário + grupo + empresa + filtros;
- invalidação correta ao trocar contexto;
- exportação de todos os registros filtrados;
- drill-down deve reproduzir exatamente o KPI.

---

# 11. IA NO ERP

A IA deve ser integrada de forma governada ao sistema inteiro, reutilizando componentes existentes.

A IA pode:

- sugerir;
- classificar;
- prever;
- resumir;
- detectar anomalias;
- responder dúvidas;
- auxiliar preenchimento;
- interpretar projeto;
- recomendar compra;
- prever atraso;
- explicar indicadores;
- apoiar migração.

A IA não deve executar automaticamente, sem política e autorização:

- pagamento;
- baixa financeira;
- emissão/cancelamento de NF;
- alteração de preço;
- aprovação de desconto;
- alteração de permissão;
- exclusão/inativação crítica;
- bloqueio de cliente;
- alteração de estoque;
- alteração fiscal.

Toda ação sensível sugerida por IA deve ter confirmação, RBAC e auditoria.

---

# 12. AGENTES ESPECIALIZADOS

Quando a arquitetura existente suportar agentes, eles devem reutilizar a camada de IA, RBAC e contexto existente.

Agentes previstos:

- Comercial;
- Financeiro;
- Fiscal;
- Compras;
- Estoque;
- Produção;
- Logística;
- Atendimento;
- Auditoria;
- Segurança;
- Migração do ERP antigo;
- Diretoria.

Cada agente deve receber somente dados permitidos ao usuário que o invocou.

Nunca conceder ao agente privilégio maior que o do usuário.

---

# 13. SITE, CHATBOT, PORTAL, MARKETPLACE E APP MOTORISTA

## 13.1 Site

O site próprio já existente deve ser integrado ao ERP.

É proibido criar outro site apenas para facilitar a integração.

## 13.2 Chatbot

Reutilizar e consolidar `ChatbotAtendimento`, `HubAtendimento` e componentes existentes.

Não criar um terceiro centro paralelo.

## 13.3 Portal do Cliente

Melhorar o portal existente.

Não criar novo portal.

## 13.4 Marketplaces

Reutilizar a estrutura existente de integrações e sincronização.

Completar catálogo, estoque, preço, pedidos, cliente, frete, NF, taxas, conciliação, devolução e erros.

## 13.5 Roteirizador e App Motorista

Roteirizador e App Motorista devem formar fluxo único:

ERP → rota → veículo → motorista → app → entrega → prova → ocorrência → retorno ERP.

---

# 14. MIGRAÇÃO DO ERP ANTIGO

A migração deve priorizar:

1. exportação nativa do ERP antigo;
2. CSV/Excel/XML/PDF estruturado;
3. Power Automate Desktop para telas sem exportação;
4. agente visual apenas como apoio;
5. validação amostral e reconciliação.

Nunca migrar diretamente para produção sem staging, validação e relatório de divergência.

Preservar:

- identificador antigo;
- origem;
- data de importação;
- lote de migração;
- mapeamento código antigo → código novo;
- usuário/automação responsável;
- status da validação.

---

# 15. TESTES OBRIGATÓRIOS ANTES DE CONCLUIR QUALQUER LOTE

Executar conforme escopo:

1. `npm run audit:baseline`
2. `npm test`
3. `npm run lint`
4. `npm run typecheck`
5. `npm run build`
6. `git diff --check`

Além disso, testar manualmente ou por automação o fluxo alterado.

## 15.1 Testes mínimos de segurança

- usuário autorizado;
- usuário não autorizado;
- Grupo;
- Empresa A;
- Empresa B;
- tentativa de trocar ID;
- tentativa de acessar URL diretamente;
- tentativa de repetir ação;
- falha de backend;
- auditoria.

---

# 16. REGRA DE STATUS E ENTREGA

Ao concluir cada lote, atualizar `STATUS_DO_PROJETO.md` com:

- objetivo;
- diagnóstico;
- causa raiz;
- arquivos alterados;
- componentes reutilizados;
- alterações implementadas;
- regras de negócio afetadas;
- multiempresa;
- RBAC;
- segurança;
- auditoria;
- testes executados;
- resultado dos testes;
- commit;
- pendências;
- riscos;
- próximo passo.

Nunca encerrar uma tarefa apenas com “implementado”, “feito” ou “funcionando”.

---

# 17. ORDEM DE PRIORIDADE DO PROJETO

Enquanto o sistema não estiver liberado para operação real, seguir esta ordem:

## P0 — BLOQUEADORES DE GO-LIVE

1. segurança;
2. RBAC;
3. multiempresa;
4. auditoria;
5. Cadastros Gerais;
6. Comercial;
7. Estoque;
8. Financeiro;
9. Fiscal;
10. Produção essencial;
11. Expedição/entrega essencial;
12. backup/rollback;
13. testes;
14. migração piloto.

## P1 — OPERAÇÃO COMPLETA

1. Compras;
2. CRM;
3. Logística avançada;
4. Roteirizador;
5. App Motorista;
6. Portal Cliente;
7. Chatbot;
8. Site integrado;
9. Marketplace;
10. relatórios executivos.

## P2 — AUTOMAÇÃO E INTELIGÊNCIA

1. IA transversal;
2. agentes especializados;
3. previsões;
4. detecção de anomalias;
5. automações avançadas;
6. otimizações.

---

# 18. CRITÉRIO DE PRONTO

Uma tarefa só está pronta quando:

- funciona em produção simulada/homologação;
- não quebra fluxo existente;
- respeita Grupo/Empresa;
- respeita RBAC frontend e backend;
- valida e sanitiza dados;
- audita ações relevantes;
- persiste corretamente;
- reabre corretamente;
- trata falhas;
- não cria duplicidade;
- não introduz regressão;
- passa testes obrigatórios;
- atualiza o status do projeto.

---

# 19. PROIBIÇÕES FINAIS

É proibido:

- duplicar módulo;
- criar versão paralela sem necessidade;
- confiar apenas no frontend para segurança;
- usar localStorage como autorização;
- ignorar erro;
- esconder erro crítico;
- usar mock como solução definitiva;
- apagar dado histórico;
- emitir NF pelo Grupo;
- misturar dados de empresas;
- permitir IA com privilégio superior ao usuário;
- migrar dados sem rastreabilidade;
- marcar como concluído sem testes.

Estas regras devem ser consideradas parte permanente da arquitetura e da governança do ERP Zuccaro.