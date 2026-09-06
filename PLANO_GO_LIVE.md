# PLANO_GO_LIVE.md — ERP ZUCCARO

## Plano detalhado para colocar o ERP em operação real com segurança

Este documento transforma a evolução do ERP Zuccaro em uma sequência objetiva de liberação operacional. Deve ser executado em conjunto com `AGENTS.md`, `PLANO_MELHORIA_ERP_ZUCCARO.md` e `STATUS_DO_PROJETO.md`.

O objetivo imediato não é “terminar tudo que um ERP pode ter”. O objetivo é liberar o núcleo operacional com segurança, migrar os dados do ERP antigo de forma controlada e depois evoluir as funções avançadas sem interromper a empresa.

---

# 1. DEFINIÇÃO DE GO-LIVE

O ERP somente poderá ser considerado apto para uso real quando os blocos P0 estiverem homologados.

## P0 — bloqueia entrada em produção

- [ ] Segurança e autenticação.
- [ ] RBAC granular frontend + backend.
- [ ] Multiempresa Grupo/Empresas.
- [ ] Auditoria e logs.
- [ ] Cadastros Gerais confiáveis.
- [ ] Comercial mínimo operacional.
- [ ] Estoque mínimo operacional.
- [ ] Financeiro mínimo operacional.
- [ ] Fiscal/NF-e mínimo operacional.
- [ ] Produção mínima necessária para os pedidos atuais.
- [ ] Expedição/entrega mínima.
- [ ] Backup e rollback.
- [ ] Testes e homologação.
- [ ] Migração piloto validada.

## P1 — pode ser concluído durante operação controlada

- [ ] Compras avançadas.
- [ ] CRM completo.
- [ ] Roteirizador avançado.
- [ ] App Motorista completo.
- [ ] Portal do Cliente completo.
- [ ] Chatbot omnichannel.
- [ ] Integração total do site.
- [ ] Marketplaces.
- [ ] Dashboards avançados.

## P2 — evolução inteligente

- [ ] IA transversal.
- [ ] Agentes especializados.
- [ ] Previsões.
- [ ] Detecção de anomalias.
- [ ] Automações avançadas.

---

# 2. GATE 0 — BASE TÉCNICA E GOVERNANÇA

## Objetivo

Impedir que Codex, Cursor ou qualquer desenvolvedor acelerem o projeto criando inconsistências.

## Execução

1. Ler integralmente `AGENTS.md` antes de cada lote.
2. Pesquisar o repositório antes de criar arquivo ou componente.
3. Usar `PLANO_MELHORIA_ERP_ZUCCARO.md` como backlog técnico existente.
4. Usar `STATUS_DO_PROJETO.md` como histórico de execução.
5. Trabalhar em lotes pequenos e reversíveis.
6. Executar validações obrigatórias antes de commit.
7. Registrar commit de cada lote.
8. Não misturar refatoração estrutural e mudança grande de regra de negócio no mesmo lote sem necessidade.

## Validações obrigatórias

- `npm run audit:baseline`
- `npm test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `git diff --check`

## Critério de saída

Nenhum agente pode trabalhar no ERP ignorando a Regra-Mãe.

---

# 3. GATE 1 — AUTENTICAÇÃO, USUÁRIOS E SESSÕES

## Objetivo

Garantir que somente usuários válidos entrem no sistema e que o ERP saiba exatamente quem está operando.

## Verificar e corrigir

1. Login.
2. Logout.
3. Expiração de sessão.
4. Usuário inativo.
5. Usuário desligado.
6. Perfil sem empresa.
7. Perfil sem grupo.
8. Sessão antiga após alteração de permissão.
9. Login simultâneo quando houver política.
10. MFA para perfis privilegiados quando suportado.
11. Recuperação de acesso.
12. Logs de login e tentativa negada.

## Testes

- usuário ativo;
- usuário inativo;
- senha/sessão inválida;
- perfil sem empresa;
- acesso direto por URL;
- sessão revogada;
- alteração de permissão durante sessão.

## Critério de saída

Nenhum usuário não autenticado ou inativo acessa dado interno.

---

# 4. GATE 2 — RBAC GRANULAR

## Objetivo

Controlar exatamente o que cada pessoa pode visualizar e executar.

## Matriz obrigatória

Criar/validar matriz por:

1. usuário;
2. perfil;
3. Grupo;
4. Empresa;
5. módulo;
6. submódulo;
7. página;
8. aba;
9. seção;
10. campo;
11. botão;
12. ação;
13. endpoint;
14. exportação;
15. importação;
16. dado sensível.

## Módulos que devem entrar na matriz

- Dashboard;
- CRM;
- Cadastros;
- Comercial;
- Compras;
- Estoque;
- Expedição;
- Produção;
- Financeiro;
- Fiscal;
- RH;
- Contratos;
- Relatórios;
- Atendimento;
- Administração;
- Portal;
- App Motorista;
- Integrações;
- IA.

## Regra frontend

Esconder ou desabilitar ação sem permissão e explicar quando apropriado.

## Regra backend

Revalidar sempre. Alterar HTML, URL, request ou localStorage não pode liberar ação.

## Cenários de homologação

Criar perfis de teste representando pelo menos:

- administrador geral;
- diretor;
- gerente comercial;
- vendedor;
- financeiro;
- faturamento/fiscal;
- estoque;
- produção;
- expedição;
- motorista;
- atendimento;
- cliente portal.

## Critério de saída

Cada perfil acessa somente aquilo que foi autorizado e tentativas fora da alçada falham no backend.

---

# 5. GATE 3 — MULTIEMPRESA

## Objetivo

Garantir separação operacional e consolidação correta.

## Regras obrigatórias

1. Grupo consolida.
2. Empresa opera.
3. Cadastro mestre de Grupo pode ser disponibilizado às empresas.
4. Cadastro empresarial preserva empresa proprietária.
5. Operação da Empresa aparece no Grupo.
6. Estoque é controlado por empresa/local conforme regra.
7. Financeiro pertence à empresa responsável.
8. Fiscal pertence à empresa emitente.
9. Relatório Grupo consolida empresas autorizadas.
10. Relatório Empresa mostra somente a empresa.
11. Faturamento iniciado no Grupo exige escolha/identificação da empresa jurídica responsável.
12. NF é emitida somente pela empresa.

## Testes negativos

- alterar `empresaId` manualmente;
- alterar `groupId`;
- usar empresa de outro grupo;
- abrir URL de empresa sem acesso;
- exportar dado de empresa sem acesso;
- trocar contexto durante edição;
- manter cache da empresa anterior.

## Critério de saída

Zero vazamento entre empresas e consolidação do Grupo consistente.

---

# 6. GATE 4 — AUDITORIA, SEGURANÇA E ERROS

## Auditoria mínima

Registrar ações de:

- criação;
- edição;
- aprovação;
- rejeição;
- inativação;
- restauração;
- emissão;
- cancelamento;
- baixa;
- pagamento;
- recebimento;
- conciliação;
- estorno;
- mudança de preço;
- mudança de desconto;
- mudança de permissão;
- integração;
- importação;
- exportação sensível;
- migração.

## Erros

Eliminar falhas silenciosas operacionais.

Todo erro relevante deve possuir:

- mensagem ao usuário;
- log técnico seguro;
- módulo;
- ação;
- usuário;
- Grupo/Empresa;
- correlação;
- status de resolução quando necessário.

## Segurança

Revisar:

- sanitização;
- XSS;
- injection;
- uploads;
- URLs;
- webhooks;
- tokens;
- certificados;
- dados bancários;
- dados pessoais;
- rate limit;
- idempotência.

## Critério de saída

Ações críticas são rastreáveis e erros não desaparecem silenciosamente.

---

# 7. GATE 5 — CADASTROS GERAIS

## Objetivo

Criar uma base confiável para os módulos.

## Revisar todas as entidades existentes

Para cada entidade:

1. abrir lista;
2. validar paginação;
3. validar busca;
4. validar filtros;
5. validar contagem;
6. criar;
7. editar;
8. inativar;
9. restaurar quando aplicável;
10. testar Grupo;
11. testar Empresa;
12. testar RBAC;
13. testar auditoria;
14. testar duplicidade;
15. testar código sequencial;
16. testar importação.

## Código sequencial

Backend deve reservar o próximo código com segurança contra concorrência.

## Migração

Preservar código antigo em campo de origem.

## Critério de saída

Todos os módulos consomem dados mestres confiáveis sem criar cadastros paralelos.

---

# 8. GATE 6 — COMERCIAL

## Fluxo mínimo de go-live

Cliente → Orçamento → Pedido → Itens → Preço/Desconto → Aprovação → Estoque/Produção → Faturamento → Financeiro → Entrega.

## Validar

- cadastro e seleção de cliente;
- endereços;
- contatos;
- condição de pagamento;
- tabela de preço;
- itens;
- unidade;
- peso;
- quantidade;
- desconto por item;
- desconto total;
- margem real;
- alçada;
- estoque;
- produção;
- entrega/retira;
- data prometida;
- observação;
- anexos;
- status;
- histórico;
- auditoria.

## Faturamento parcial

Permitir selecionar item/quantidade/etapa, gerar somente a parte faturada e manter saldo restante.

Bloquear faturamento acima do pedido.

## Indicadores

- quantidade vendida;
- peso vendido;
- valor vendido;
- faturado;
- saldo a faturar;
- cancelado;
- devolvido;
- margem;
- desconto;
- rentabilidade.

## Critério de saída

Pedido real completo pode ser criado e percorrer o fluxo sem ajuste manual de banco.

---

# 9. GATE 7 — ESTOQUE

## Validar

- saldo;
- entrada;
- saída;
- reserva;
- liberação;
- transferência;
- inventário;
- ajuste com alçada;
- lote;
- unidade;
- peso;
- produto;
- empresa;
- local;
- produção;
- venda;
- compra;
- devolução;
- sucata.

## Bloqueios

- saldo negativo sem política;
- movimentação em empresa errada;
- duplicidade por retry;
- ajuste sem permissão;
- exclusão de histórico.

## Critério de saída

Saldo físico e saldo sistêmico podem ser reconciliados e toda movimentação possui origem.

---

# 10. GATE 8 — FINANCEIRO

## Fluxos mínimos

- contas a receber;
- contas a pagar;
- caixa;
- bancos;
- PIX;
- boleto;
- cartão;
- link de pagamento;
- baixa;
- estorno;
- conciliação;
- centro de custo;
- rateio;
- fluxo de caixa;
- cobrança;
- inadimplência.

## Regras críticas

1. Não excluir título liquidado.
2. Estorno deve preservar histórico.
3. Baixa manual exige permissão.
4. Pagamento deve pertencer à empresa correta.
5. Grupo consolida sem alterar propriedade.
6. Pedido/NF/título devem permanecer vinculados.
7. Valores não podem ser recalculados silenciosamente após baixa.
8. Ações em lote exigem idempotência.

## Critério de saída

É possível fechar um ciclo de venda e um ciclo de compra com rastreabilidade financeira completa.

---

# 11. GATE 9 — FISCAL

## Validar antes de emissão real

- empresa emitente;
- certificado;
- ambiente homologação/produção;
- série;
- numeração;
- NCM;
- CFOP;
- CST/CSOSN quando aplicável;
- ICMS;
- ST;
- PIS;
- COFINS;
- IPI;
- totalizadores;
- XML;
- DANFE;
- autorização;
- rejeição;
- cancelamento;
- carta de correção;
- devolução;
- contingência quando suportada.

## Critério de saída

NF de homologação passa ponta a ponta e a emissão em produção possui autorização explícita e rollback operacional.

---

# 12. GATE 10 — PRODUÇÃO

## Armado

Validar:

- tipo de peça;
- obra;
- etapa;
- pavimento;
- posição;
- revisão;
- ferro principal;
- estribo;
- quantidade;
- peso;
- matéria-prima;
- perda;
- custo;
- OP;
- apontamento;
- etiqueta;
- lote;
- rastreabilidade;
- expedição.

## Corte e Dobra

Validar:

- projeto;
- posição;
- bitola;
- dimensões;
- ângulos;
- quantidade;
- peso;
- plano de corte;
- comprimento comercial;
- sobra reaproveitável;
- sucata;
- rendimento;
- OP;
- produção;
- conferência;
- entrega.

## Critério de saída

Pedido que exige produção consegue virar OP, ser produzido, conferido e liberado para expedição.

---

# 13. GATE 11 — EXPEDIÇÃO, ROTEIRIZADOR E APP MOTORISTA

## Expedição mínima

- pedido pronto;
- separação;
- conferência;
- romaneio;
- motorista;
- veículo;
- data;
- entrega/retira;
- comprovante;
- ocorrência.

## Roteirizador

Evoluir a estrutura existente para considerar:

- endereços;
- geocodificação;
- peso;
- volume quando disponível;
- capacidade;
- veículo;
- motorista;
- janela de entrega;
- prioridade;
- distância;
- tempo;
- sequência;
- restrições;
- ajuste manual;
- auditoria.

## App Motorista

Evoluir o app existente para:

- autenticação;
- entregas atribuídas;
- rota;
- próxima parada;
- navegação;
- chegada;
- geolocalização;
- foto;
- assinatura;
- nome do recebedor;
- documento;
- conferência;
- entrega parcial;
- ocorrência;
- devolução;
- offline;
- fila de sincronização;
- idempotência;
- histórico.

## Critério de saída

Entrega sai do ERP, chega ao motorista e retorna com prova e status correto.

---

# 14. GATE 12 — CHATBOT E HUB DE ATENDIMENTO

## Regra

Não criar novo módulo. Consolidar estruturas existentes.

## Canais

- WhatsApp;
- site;
- portal;
- e-mail;
- Instagram/Messenger quando integrados;
- outros canais somente se houver necessidade real.

## Fluxos

- identificar cliente;
- localizar pedido;
- consultar entrega;
- segunda via;
- orçamento;
- atendimento humano;
- fila;
- SLA;
- transferência;
- histórico;
- vendedor responsável;
- IA com base autorizada.

## Critério de saída

Atendimento iniciado em canal externo aparece no Hub, pode ser assumido por humano e mantém histórico ligado ao cliente.

---

# 15. GATE 13 — PORTAL DO CLIENTE

## Corrigir primeiro

Eliminar carregamento infinito e criar estados explícitos:

- autenticando;
- vinculando cliente;
- carregando;
- pronto;
- sem vínculo;
- sem permissão;
- timeout;
- erro.

## Funções

- pedidos;
- saldo;
- faturamento;
- NF;
- boletos;
- PIX quando aplicável;
- entrega;
- orçamento;
- documentos;
- chamados;
- histórico.

## Segurança

Cliente nunca pode consultar outro cliente alterando URL, token ou ID.

---

# 16. GATE 14 — SITE PRÓPRIO

## Regra

Integrar o site existente. Não criar outro.

## Integrações

- produto;
- catálogo;
- preço;
- disponibilidade;
- cliente;
- lead;
- orçamento;
- pedido;
- pagamento;
- chatbot;
- portal;
- status;
- entrega.

## Origem

Todo lead, orçamento e pedido deve registrar origem `site`.

---

# 17. GATE 15 — MARKETPLACES

## Evoluir integração existente

Para cada marketplace suportado:

- configuração;
- autenticação;
- catálogo;
- SKU;
- estoque;
- preço;
- pedido;
- cliente;
- frete;
- NF;
- comissão;
- taxa;
- recebível;
- conciliação;
- cancelamento;
- devolução;
- erro;
- retry;
- idempotência.

## Origem

Pedido deve registrar marketplace e identificador externo.

---

# 18. GATE 16 — IA TRANSVERSAL

## Objetivo

Disponibilizar IA contextual em todos os módulos relevantes sem dar autonomia perigosa.

## Comercial

- resumo de cliente;
- sugestão de follow-up;
- análise de margem;
- oportunidade;
- previsão de recompra.

## Financeiro

- previsão de caixa;
- anomalias;
- cobrança sugerida;
- conciliação assistida.

## Estoque/Compras

- ruptura;
- excesso;
- sugestão de compra;
- giro;
- curva ABC.

## Produção

- interpretação de projeto;
- previsão de material;
- gargalo;
- rendimento.

## Logística

- previsão de atraso;
- sugestão de rota;
- análise de ocorrência.

## Atendimento

- resposta assistida;
- resumo;
- classificação;
- transferência inteligente.

## Segurança/Auditoria

- detecção de comportamento anormal;
- resumo de eventos;
- priorização de alertas.

---

# 19. GATE 17 — AGENTES

## Agentes previstos

- Agente Comercial;
- Agente Financeiro;
- Agente Fiscal;
- Agente Compras;
- Agente Estoque;
- Agente Produção;
- Agente Logística;
- Agente Atendimento;
- Agente Auditor;
- Agente Segurança;
- Agente Migração;
- Agente Diretoria.

## Regra de autorização

O agente herda as permissões do usuário. Nunca ampliar privilégios.

## Regra de execução

Ações críticas exigem confirmação humana e revalidação backend.

---

# 20. GATE 18 — MIGRAÇÃO DO ERP ANTIGO

## Estratégia

### Nível 1 — exportação nativa

Priorizar CSV, Excel, XML e relatórios estruturados.

### Nível 2 — Power Automate Desktop

Usar para telas e consultas que não possuem exportação.

Automação deve:

1. abrir tela;
2. pesquisar faixa de registros;
3. extrair;
4. salvar arquivo intermediário;
5. registrar lote;
6. continuar do último checkpoint;
7. registrar erro.

### Nível 3 — agente visual

Usar para:

- mapear ERP antigo;
- interpretar telas;
- descobrir regras;
- casos excepcionais;
- validação assistida.

Não usar como método principal de extração massiva.

## Ordem de migração sugerida

1. empresas/grupo;
2. usuários e perfis sem senhas legadas;
3. clientes;
4. fornecedores;
5. produtos;
6. tabelas e parâmetros;
7. estoque inicial;
8. pedidos abertos;
9. contas a receber abertas;
10. contas a pagar abertas;
11. documentos fiscais necessários;
12. histórico selecionado;
13. anexos/documentos necessários.

## Reconciliação

Para cada lote comparar:

- quantidade;
- total financeiro;
- saldo;
- amostra de registros;
- código antigo/novo;
- empresa;
- status;
- datas.

---

# 21. GATE 19 — PILOTO

## Usuários piloto

Selecionar poucos usuários representativos.

Sugestão:

- 1 administrador;
- 1 vendedor;
- 1 financeiro;
- 1 faturamento;
- 1 estoque/expedição;
- 1 produção.

## Duração

Executar ciclos reais controlados antes da virada total.

## Cenários

- venda à vista;
- venda a prazo;
- pedido com produção;
- pedido com entrega;
- faturamento parcial;
- recebimento;
- compra/entrada;
- pagamento;
- devolução/ocorrência;
- cancelamento controlado.

## Critério de saída

Nenhum erro crítico aberto e divergências financeiras/fiscais/estoque reconciliadas.

---

# 22. GATE 20 — VIRADA PARA PRODUÇÃO

## Antes da virada

- [ ] Backup final do legado.
- [ ] Backup do novo ERP.
- [ ] Congelar janela de migração.
- [ ] Migrar deltas.
- [ ] Reconciliar saldos.
- [ ] Reconciliar financeiro.
- [ ] Reconciliar estoque.
- [ ] Validar fiscal.
- [ ] Validar usuários.
- [ ] Validar permissões.
- [ ] Validar integrações.
- [ ] Definir suporte de contingência.

## Durante

- monitorar erros;
- monitorar filas;
- monitorar integrações;
- monitorar auditoria;
- acompanhar usuários;
- registrar incidentes.

## Após

- reconciliar primeiro dia;
- reconciliar primeira semana;
- corrigir P0 imediatamente;
- priorizar P1 por impacto operacional.

---

# 23. MATRIZ DE SEVERIDADE

## P0 / Crítico

- vazamento de dados;
- acesso indevido;
- valor financeiro errado;
- estoque errado;
- NF incorreta;
- perda de dados;
- duplicidade financeira/fiscal;
- indisponibilidade total.

Bloqueia go-live.

## P1 / Alto

- fluxo principal quebrado;
- controle sem persistência;
- relatório operacional incorreto;
- integração essencial falhando.

Corrigir antes ou durante piloto, conforme impacto.

## P2 / Médio

- produtividade;
- UX;
- filtro;
- relatório secundário;
- automação não crítica.

Pode entrar em lote posterior.

## P3 / Baixo

- estética;
- texto;
- refinamento não operacional.

Não deve atrasar go-live.

---

# 24. FORMATO OBRIGATÓRIO DE CADA LOTE CODEX/CURSOR

Antes de alterar:

1. declarar objetivo;
2. localizar estrutura existente;
3. listar arquivos envolvidos;
4. listar consumidores;
5. listar riscos;
6. confirmar que não haverá módulo paralelo.

Durante:

1. preservar comportamento;
2. aplicar multiempresa;
3. aplicar RBAC;
4. aplicar segurança;
5. aplicar auditoria;
6. manter responsividade;
7. criar/atualizar testes.

Depois:

1. executar validações;
2. testar cenário positivo;
3. testar cenário negativo;
4. testar Grupo;
5. testar Empresa;
6. testar usuário sem permissão;
7. testar erro;
8. atualizar `STATUS_DO_PROJETO.md`;
9. informar pendências;
10. somente então realizar commit/push conforme fluxo aprovado.

---

# 25. CRITÉRIO FINAL PARA INICIAR USO REAL

O ERP pode iniciar operação controlada quando todos os P0 abaixo estiverem homologados:

- [ ] Login/sessão seguros.
- [ ] RBAC frontend/backend.
- [ ] Multiempresa validada.
- [ ] Auditoria confiável.
- [ ] Cadastros Gerais consistentes.
- [ ] Comercial ponta a ponta.
- [ ] Estoque reconciliável.
- [ ] Financeiro reconciliável.
- [ ] Fiscal homologado.
- [ ] Produção essencial funcional.
- [ ] Expedição essencial funcional.
- [ ] Backup/rollback testados.
- [ ] Migração piloto reconciliada.
- [ ] Testes críticos aprovados.
- [ ] Usuários piloto treinados.
- [ ] Plano de contingência definido.

IA avançada, agentes, marketplaces completos, chatbot omnichannel e otimizações avançadas devem continuar sendo desenvolvidos, mas não devem atrasar a entrada controlada do núcleo quando os P0 estiverem aprovados.