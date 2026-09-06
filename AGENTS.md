# AGENTS.md — ERP ZUCCARO

## 0. FINALIDADE, ESCOPO E PRIORIDADE

Este arquivo contém as regras permanentes e obrigatórias para Codex, Cursor, agentes de IA, automações e desenvolvedores que alterem este repositório. Seu escopo é todo o repositório, salvo instrução mais específica em `AGENTS.md` localizado em subdiretório.

Antes de alterar código, ler este arquivo e cumprir as regras aplicáveis. Não repetir no chat todo o conteúdo deste arquivo: usá-lo como contexto permanente.

Objetivo: evoluir o ERP Zuccaro rapidamente e com baixo consumo de contexto, sem duplicar estruturas, quebrar fluxos, perder dados ou enfraquecer multiempresa, RBAC, segurança, auditoria, rastreabilidade, responsividade e integrações.

Quando houver conflito entre conveniência técnica e estas regras, preservar segurança, integridade de dados e Regra-Mãe. Se uma solicitação exigir violação de regra crítica, parar e registrar `BLOCKED`, motivo e alternativa segura.

---

# 1. REGRA-MÃE — OBRIGATÓRIA E INVIOLÁVEL

## 1.1 Proibição de criação paralela

É proibido criar módulo, tela, página, funcionalidade, componente, hook, serviço, entidade, endpoint, função backend, relatório, dashboard, rotina ou automação quando já existir implementação com propósito igual ou semelhante.

Antes de criar algo:
1. pesquisar nomes e finalidades relacionadas;
2. localizar implementação existente e consumidores;
3. verificar rotas, imports, hooks, entidades, funções e integrações;
4. melhorar/refatorar o existente;
5. criar somente se não houver equivalente viável ou se a extração for necessária à refatoração.

Se for indispensável criar arquivo/componente auxiliar, registrar por que não havia equivalente, o que foi reutilizado e como se integra ao fluxo atual.

Não criar versões como `ComercialV2`, `FinanceiroNovo`, `DashboardNovo`, `PortalCliente2`, `RoteirizadorNovo`, `ChatbotNovo` para evitar corrigir o existente.

## 1.2 Refatoração de estruturas grandes

Arquivos acima de aproximadamente 400–600 linhas, ou cuja complexidade comprometa manutenção/testes, devem ser divididos quando forem tocados e quando isso for seguro. Extrair hooks, helpers, schemas, validators, componentes, serviços e funções puras reutilizáveis, preservando interface pública e comportamento.

## 1.3 Nunca apagar funcionalidades

Não apagar/remover/desativar de forma irreversível funcionalidades, botões, abas, campos, páginas, relatórios, integrações, dados históricos ou código legado ainda consumido.

Antes de retirar algo: inventário → consumidores → equivalência → migração → testes → homologação → autorização.

## 1.4 Não quebrar fluxos existentes

Preservar fluxos como:
- pedido → estoque → aprovação → faturamento → NF → financeiro → entrega → WhatsApp;
- compra → recebimento → estoque → financeiro;
- produção → apontamento → estoque → expedição;
- entrega → motorista → prova → ocorrência → ERP.

---

# 2. POLÍTICA DE ECONOMIA DE CRÉDITOS, TOKENS E CONTEXTO

Esta política é obrigatória para Codex e deve ser seguida também no Cursor sempre que a ferramenta suportar comportamento equivalente.

## 2.1 Princípio

Usar o menor contexto e o menor número de operações necessários para resolver completamente a tarefa atual, sem reduzir segurança ou qualidade.

## 2.2 Antes de trabalhar

1. Ler `AGENTS.md` como regra permanente.
2. Ler somente a parte necessária de `PLANO_GO_LIVE.md`, `PLANO_MELHORIA_ERP_ZUCCARO.md` e `STATUS_DO_PROJETO.md` relacionada à tarefa.
3. Não reler documentos inteiros quando a seção/tarefa já estiver identificada.
4. Não auditar o repositório inteiro para tarefa localizada.
5. Começar pelos arquivos explicitamente relacionados à tarefa.
6. Expandir a busca apenas quando dependência real exigir.
7. Reutilizar diagnóstico já registrado no status quando ainda for válido.

## 2.3 Unidade de trabalho

Trabalhar em UMA tarefa, Gate, subgate ou defeito por vez, salvo quando dependências inseparáveis exigirem um lote pequeno conjunto.

Não avançar automaticamente para a próxima tarefa.

Não aproveitar uma tarefa para “melhorar” módulos não relacionados.

Não refatorar código saudável fora do escopo apenas por preferência estética.

## 2.4 Busca econômica

Preferir esta sequência:
1. arquivo/caminho informado;
2. símbolos/imports diretamente relacionados;
3. consumidores diretos;
4. testes relacionados;
5. somente então busca mais ampla.

Não abrir dezenas de arquivos apenas para produzir relatório. Não repetir pesquisas que já deram resposta suficiente.

## 2.5 Respostas econômicas

Ao concluir, responder de forma objetiva. Não repetir código inteiro nem este AGENTS.md. Informar apenas diagnóstico, arquivos alterados, mudança, testes, resultado, pendências e próximo passo.

## 2.6 Testes em duas camadas

Durante desenvolvimento de lote pequeno:
- executar primeiro testes focados e baratos;
- usar lint/typecheck direcionados quando disponíveis;
- não executar repetidamente a suíte completa após cada edição mínima.

No fechamento de lote/Gate ou antes de commit de mudança relevante, executar os checks obrigatórios definidos na seção 16.

Mudança exclusivamente documental pode dispensar testes de aplicação quando comprovadamente não altera runtime; nesse caso executar ao menos `git diff --check` e registrar a justificativa. Mudança de código não pode usar essa exceção.

## 2.7 Evitar trabalho duplicado entre Codex e Cursor

Antes de iniciar, verificar `STATUS_DO_PROJETO.md` e commits recentes relacionados à tarefa. Não reimplementar nem reaudar integralmente trabalho já homologado sem evidência de regressão.

Codex deve ser preferido para lotes autônomos e completos; Cursor pode ser usado para correções locais e edição assistida. Não fazer os dois analisarem o mesmo módulo inteiro sem necessidade.

## 2.8 Limite de expansão

Se a tarefa inicialmente localizada revelar impacto amplo:
- não transformar silenciosamente em auditoria geral;
- registrar dependências encontradas;
- corrigir apenas o necessário para manter integridade;
- propor tarefa separada para o restante.

---

# 3. PROTOCOLO OBRIGATÓRIO DE EXECUÇÃO

## 3.1 Antes da edição

O agente deve determinar:
- objetivo exato;
- problema atual;
- causa provável ou confirmada;
- estruturas existentes a reutilizar;
- arquivos diretamente envolvidos;
- entidades e campos afetados;
- consumidores downstream;
- risco multiempresa;
- permissões necessárias;
- auditoria necessária;
- testes mínimos.

## 3.2 Durante a edição

Fazer a menor alteração segura que resolva completamente a tarefa. Preservar compatibilidade. Evitar mudanças massivas de formatação, renomeações sem necessidade e diffs ruidosos.

## 3.3 Quando parar

Parar e marcar `BLOCKED` quando faltar requisito indispensável, credencial, contrato de API, decisão fiscal/financeira, dado de produção, acesso ou quando a única forma de continuar violar segurança/integridade.

Não inventar comportamento para contornar bloqueio.

## 3.4 Concorrência entre agentes

Codex e Cursor podem trabalhar no mesmo repositório, mas não devem editar simultaneamente o mesmo arquivo/lote sem coordenação. Antes de alterar arquivo crítico, verificar estado/commit recente. Evitar sobrescrever trabalho de outro agente. Nunca desfazer mudança desconhecida apenas para fazer a própria solução passar.

---

# 4. MULTIEMPRESA ABSOLUTA

Toda leitura, criação, alteração, exclusão lógica, aprovação, relatório, importação, exportação, integração, job, webhook, IA e automação deve operar com contexto explícito de Grupo e Empresa quando aplicável.

## 4.1 Contrato canônico

Toda operação deve considerar:
- `groupId` / `group_id`;
- `empresaId` / `empresa_id`;
- `scopeType` quando aplicável;
- usuário autenticado;
- permissões efetivas.

Normalizar nomes legados progressivamente sem quebrar consumidores.

## 4.2 Grupo → Empresas

Cadastro compartilhado criado no Grupo deve ficar disponível às empresas autorizadas/selecionadas conforme regra da entidade. Isso não significa copiar fisicamente operações para todas as empresas. Preferir mestre + vínculo/visibilidade/parametrização.

## 4.3 Empresa → Grupo

Operação criada na Empresa aparece consolidada no Grupo preservando a empresa proprietária. O Grupo consolida; a Empresa opera.

## 4.4 Faturamento pelo Grupo

Faturamento iniciado na visão do Grupo deve emitir NF exclusivamente pela empresa jurídica responsável, usando identidade fiscal, certificado, série, estoque e regras daquela empresa. Nunca emitir NF por identidade genérica do Grupo.

## 4.5 Bloqueios

Backend deve bloquear:
- empresa que não pertence ao grupo;
- empresa não autorizada ao usuário;
- IDs adulterados na request;
- localStorage manipulado;
- acesso cruzado indevido;
- cliente acessando outro cliente;
- motorista acessando entrega não atribuída;
- export/download fora do escopo.

Frontend não é mecanismo de segurança.

---

# 5. RBAC GRANULAR — FRONTEND E BACKEND

Toda tela, módulo, submódulo, aba, seção, campo, botão, ação, endpoint, exportação, importação, integração e dado sensível deve ter controle de permissão.

Preferir chaves granulares, por exemplo:
- `comercial.pedido.visualizar`
- `comercial.pedido.criar`
- `comercial.pedido.editar`
- `comercial.pedido.aprovar`
- `comercial.pedido.desconto.aprovar`
- `financeiro.caixa.baixa-manual`
- `financeiro.contas-pagar.aprovar`
- `fiscal.nota.emitir`
- `fiscal.nota.cancelar`
- `administracao.acessos.editar`

Separar visualizar, criar, editar, inativar, restaurar, aprovar, rejeitar, emitir, cancelar, receber, pagar, conciliar, estornar, importar, exportar, configurar, executar e administrar acessos.

Dados sensíveis como custo, margem, salário e dados bancários exigem permissão própria quando aplicável.

Segregação de funções:
- criador não aprova o próprio pagamento quando política exigir;
- desconto fora da alçada exige outro aprovador;
- criador da compra não aprova a própria compra quando política exigir;
- administrador de permissões não pode apagar auditoria;
- cancelamento fiscal exige permissão específica.

Permissões devem ser fail-closed em operações sensíveis: enquanto perfil/permissão não estiver carregado, não liberar ação crítica.

---

# 6. SEGURANÇA OBRIGATÓRIA

Toda alteração deve reforçar segurança.

Backend deve aplicar schema, sanitização, allowlist de campos, limites, validação de documentos, datas, valores, percentuais, IDs, URLs e arquivos.

Nunca confiar em input do frontend, importação, webhook, XML, planilha, site, marketplace, chatbot ou IA.

Uploads: validar extensão, MIME, tamanho, conteúdo, quantidade, origem, permissão e Grupo/Empresa. Não gravar segredo, token ou URL temporária em auditoria.

Perfis privilegiados devem usar política forte de sessão; quando suportado, MFA, expiração, revogação e controle de dispositivo.

Webhooks/integrações: assinatura, idempotência, proteção contra replay, timeout, retry limitado, fila morta, logs sanitizados e alerta de falha persistente.

Nunca colocar segredo/API key/token em código frontend, commit, log, prompt, screenshot ou documentação.

---

# 7. AUDITORIA COMPLETA

Ações relevantes devem registrar:
- usuário/perfil;
- data/hora;
- módulo/entidade/registro;
- ação;
- antes/depois;
- `groupId` e `empresaId`;
- origem;
- correlação;
- sucesso/falha;
- justificativa quando necessária.

Auditar criar, editar, aprovar, rejeitar, inativar, restaurar, emitir, cancelar, receber, pagar, conciliar, estornar, preço, desconto, permissão, integração, export sensível, importação e migração.

`catch {}` ou equivalente silencioso é proibido em persistência, auditoria, integração, segurança e operação crítica. Falha deve ser tratada, comunicada, registrada e causar rollback/bloqueio quando necessário.

---

# 8. CADASTROS GERAIS COMO FONTE MESTRE

Cadastros Gerais é a fonte mestre consumida por Comercial, Financeiro, Compras, Estoque, Fiscal, Produção, Logística, RH, Chatbot, Portal, Site e Marketplace.

Não criar cadastro paralelo em cada módulo.

Todo registro que exija código deve ter código interno sequencial único controlado pelo backend. Nunca usar `count + 1` no frontend. Reserva deve ser segura contra concorrência.

Importação do ERP antigo com conflito:
1. preservar código original/legado;
2. detectar conflito;
3. reservar próximo código interno;
4. registrar mapeamento;
5. impedir sobrescrita silenciosa;
6. auditar;
7. gerar relatório de conflito.

Duplicidade deve considerar, conforme entidade, código, descrição normalizada, documento, e-mail, identificador externo e chaves compostas. Não mesclar destrutivamente de forma automática.

---

# 9. FUNCIONALIDADE DE PONTA A PONTA

Tela aberta não significa funcionalidade pronta. Todo fluxo deve comprovar:
entrada → validação → autorização → persistência → estado → integração downstream → auditoria → tratamento de erro → reabertura correta → relatório/KPI correto.

Todo botão, switch, toggle, checkbox, radio, select, combobox, input, upload, menu e ação de tabela deve ser funcional. Testar visualização, permissão, interação, loading, persistência, reabertura, Grupo/Empresa, erro, auditoria e duplo clique/idempotência.

Controle que muda visualmente e não persiste é defeito.

---

# 10. LAYOUT, RESPONSIVIDADE E MULTITAREFA

Telas, páginas, modais e containers principais devem respeitar `w-full`, `h-full`, flex/grid responsivo, redimensionamento, tablet/desktop/celular quando aplicável, abas fixas, conteúdo rolável e rodapé acessível.

Evitar alturas rígidas que cortem conteúdo. Preservar estado ao minimizar/maximizar/restaurar janelas quando o fluxo existente oferecer multitarefa.

---

# 11. CONSULTAS, PAGINAÇÃO, CACHE E KPIs

Não calcular total/KPI usando apenas primeira página carregada.

Usar:
- paginação server-side;
- busca server-side em grandes volumes;
- contagem/agregação separada da listagem;
- queryKey incluindo usuário + grupo + empresa + filtros relevantes;
- cancelamento/invalidação ao trocar contexto;
- exportação de todos os registros filtrados;
- drill-down reproduzindo exatamente o KPI.

Evitar N+1 e carregamento integral de entidade apenas para contar/somar.

---

# 12. IA E AGENTES NO ERP

IA deve reutilizar a camada existente e respeitar RBAC/multiempresa do usuário.

Pode sugerir, classificar, prever, resumir, detectar anomalias, auxiliar preenchimento, interpretar projeto, recomendar compra, prever atraso, explicar indicador e apoiar migração.

Não executar sem política, autorização e confirmação: pagamento, baixa, emissão/cancelamento NF, alteração de preço, desconto, permissão, estoque, fiscal, bloqueio de cliente ou inativação crítica.

Agentes previstos quando a arquitetura existente suportar: Comercial, Financeiro, Fiscal, Compras, Estoque, Produção, Logística, Atendimento, Auditoria, Segurança, Migração e Diretoria.

Princípio do menor privilégio: agente nunca recebe mais acesso que o usuário que o invocou. Registrar ferramentas usadas, ação proposta/executada, contexto e resultado em operações sensíveis.

---

# 13. SITE, CHATBOT, PORTAL, MARKETPLACE, ROTEIRIZADOR E MOTORISTA

Site próprio já existente deve ser integrado; não criar outro site.

Chatbot: reutilizar/consolidar `ChatbotAtendimento`, `HubAtendimento` e estruturas equivalentes existentes; não criar terceiro centro paralelo.

Portal: melhorar `PortalCliente`/portal existente; não criar outro.

Marketplace: completar estrutura existente de catálogo, estoque, preço, pedido, cliente, frete, NF, taxas, conciliação, devolução e erros.

Roteirizador + App Motorista devem formar fluxo único: ERP → rota → veículo → motorista → app → entrega → prova → ocorrência/reversa → ERP.

---

# 14. MIGRAÇÃO DO ERP ANTIGO

Prioridade:
1. exportação nativa;
2. CSV/Excel/XML/PDF estruturado;
3. Power Automate Desktop para telas sem exportação;
4. agente visual como apoio/exceção;
5. staging;
6. validação e reconciliação;
7. lote piloto;
8. produção.

Preservar ID/código antigo, origem, data, lote, mapeamento antigo→novo, responsável e status de validação.

Nunca migrar diretamente para produção sem staging e relatório de divergência. Migração deve ser reexecutável/idempotente sempre que tecnicamente possível.

---

# 15. BANCO, INTEGRIDADE E OPERAÇÕES DESTRUTIVAS

Preferir inativação/arquivamento a delete físico. Não executar migração destrutiva, drop, truncate, limpeza em massa, renumeração automática, merge destrutivo ou sobrescrita de produção sem plano de rollback, backup e autorização.

Mudanças de schema devem preservar compatibilidade durante transição quando houver consumidores ativos. Operações financeiras, fiscais, estoque e auditoria exigem rastreabilidade e reversão por fluxo de negócio, não apagamento.

---

# 16. TESTES E VALIDAÇÃO

## 16.1 Desenvolvimento focado

Durante edição, executar testes diretamente relacionados à mudança primeiro.

## 16.2 Fechamento de lote de código

Executar conforme scripts disponíveis e aplicabilidade:
1. `npm run audit:baseline`
2. `npm test`
3. `npm run lint`
4. `npm run typecheck`
5. `npm run build`
6. `git diff --check`

Não inventar sucesso. Se um comando não existir, falhar por infraestrutura ou possuir erro anterior não relacionado, registrar exatamente.

## 16.3 Segurança mínima

Testar quando aplicável:
- usuário autorizado;
- não autorizado;
- Grupo;
- Empresa A/B;
- ID adulterado;
- URL direta;
- repetição/duplo clique;
- falha backend;
- auditoria.

## 16.4 Não mascarar baseline

Não alterar teste, regra de lint, baseline, configuração ou expectativa apenas para fazer pipeline ficar verde sem corrigir a causa. Mudança de baseline exige justificativa técnica explícita.

---

# 17. GIT, COMMITS E DIFERENÇAS

Antes de editar, verificar estado atual. Não sobrescrever alterações de terceiros.

Preferir commits pequenos, coerentes e reversíveis. Não misturar vários módulos independentes no mesmo commit. Não fazer formatação global ou alteração de fim de linha que produza diff gigante sem necessidade.

Não reescrever histórico, fazer force push, reset destrutivo ou apagar branch sem autorização explícita.

Mensagem de commit deve descrever a finalidade, não apenas “ajustes”.

---

# 18. STATUS E RELATÓRIO DE ENTREGA

Ao concluir lote relevante, atualizar `STATUS_DO_PROJETO.md` sem reescrever histórico desnecessariamente.

Registrar:
- tarefa/ID;
- objetivo;
- causa raiz;
- arquivos alterados;
- estruturas reutilizadas;
- mudança implementada;
- multiempresa/RBAC/segurança/auditoria afetados;
- testes e resultados;
- commit;
- pendências/riscos;
- próximo passo recomendado.

Resposta final do agente deve ser curta e verificável. Nunca apenas “implementado com sucesso”.

---

# 19. ORDEM DE PRIORIDADE ATÉ GO-LIVE

## P0 — BLOQUEADORES
1. segurança/autenticação;
2. RBAC;
3. multiempresa;
4. auditoria;
5. Cadastros Gerais;
6. Comercial;
7. Estoque;
8. Financeiro;
9. Fiscal;
10. Produção essencial;
11. Expedição essencial;
12. backup/rollback;
13. testes;
14. migração piloto.

## P1 — OPERAÇÃO COMPLETA
Compras, CRM, logística avançada, roteirizador, app motorista, portal, chatbot, site integrado, marketplaces e relatórios executivos.

## P2 — AUTOMAÇÃO/INTELIGÊNCIA
IA transversal, agentes, previsões, anomalias e automações avançadas.

Não iniciar P1/P2 amplo se houver P0 crítico aberto, exceto tarefa explicitamente autorizada ou necessária para fechar P0.

---

# 20. CRITÉRIO DE PRONTO

Tarefa só está pronta quando:
- resolve o requisito;
- não quebra fluxo existente;
- respeita Grupo/Empresa;
- respeita RBAC frontend/backend;
- valida/sanitiza;
- audita ações relevantes;
- persiste/reabre corretamente;
- trata falhas;
- evita duplicidade;
- não introduz regressão conhecida;
- passa testes aplicáveis;
- atualiza status quando necessário.

---

# 21. PROIBIÇÕES FINAIS

É proibido:
- duplicar módulo/versão;
- confiar só no frontend para segurança;
- usar localStorage como autorização;
- ignorar/esconder erro crítico;
- usar mock como solução definitiva;
- apagar histórico;
- emitir NF pelo Grupo;
- misturar empresas;
- conceder à IA privilégio maior que o usuário;
- migrar sem rastreabilidade;
- alterar teste para esconder defeito;
- executar comando destrutivo sem autorização;
- ampliar silenciosamente o escopo;
- marcar concluído sem validação.

Estas regras fazem parte permanente da arquitetura e governança do ERP Zuccaro.