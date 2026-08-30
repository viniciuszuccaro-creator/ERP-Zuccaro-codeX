# Plano de Melhoria Geral do ERP Zuccaro

Atualizado em: 2026-08-30

Este plano organiza o que deve ser feito para melhorar o ERP Zuccaro respeitando a regra-mae: melhorar o existente, nao duplicar, nao apagar funcionalidades, perguntar antes de incluir ou excluir, manter multiempresa, RBAC, seguranca e auditoria.

## Plano Mestre incorporado

O Plano Mestre de Evolucao passa a ser executado neste arquivo, sem criar plano concorrente. O Volume 01 de Fundacao e referencia metodologica; o clone `ERP-Zuccaro-codeX` e o GitHub sao a fonte de verdade do codigo.

Ordem de liberacao aprovada:

1. Baseline, inventario, testes e seguranca.
2. Contrato multiempresa e RBAC backend/frontend.
3. Simplificacao e ramificacao dos setores.
4. Projetos tecnicos, BOM e produtos.
5. Site existente e Mercado Livre.
6. Roteirizacao e App Motorista PWA existente.
7. IA governada e observabilidade.

Regras de entrega por lote:

1. Atualizar `STATUS_DO_PROJETO.md` com concluido, pendencias, testes e proximo passo.
2. Executar `npm run audit:baseline`, `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` e `git diff --check` conforme o escopo do lote.
3. Fazer commit separado e push no GitHub depois das validacoes obrigatorias.
4. Nunca trabalhar no projeto do HD externo; usar somente o clone interno vinculado ao GitHub.

### Baseline reproduzivel - Lote 1

- [x] Criar inventario estatico reproduzivel em `scripts/audit-baseline.mjs`.
- [x] Configurar testes nativos do Node sem adicionar dependencia externa.
- [x] Cobrir o inventario e os helpers puros da Central de Perfis RBAC.
- [x] Corrigir o comportamento fail-open do guard de permissoes para mutacoes e funcoes sensiveis.
- [ ] Padronizar o contrato canonico `{ groupId, empresaId, scopeType }` no frontend e backend.
- [ ] Ampliar testes de isolamento entre Grupo CPA, CPA Ferro e Aco e 3Z LTDA.

## Objetivo central

Transformar o ERP em um sistema mais seguro, ramificado por grupo/empresa, auditavel, consistente e funcional em todos os setores, usando `Cadastros Gerais` como base estrutural para dados, relatorios, permissoes e configuracoes.

## Ordem obrigatoria de trabalho

1. Diagnosticar o que ja existe.
2. Verificar duplicidades.
3. Melhorar somente o existente.
4. Perguntar antes de criar ou excluir.
5. Corrigir persistencia e funcionamento.
6. Aplicar multiempresa.
7. Aplicar RBAC.
8. Aplicar seguranca e auditoria.
9. Validar no fluxo real.
10. Registrar o que foi feito.

## Fase 1 - Base de dados local, snapshot e contexto

Objetivo: garantir que o sistema use apenas os dados corretos do `GRUPO CPA`, `CPA FERRO E ACO` e `3Z LTDA`.

Tarefas:

1. Confirmar que existe somente um grupo ativo: `GRUPO CPA`.
2. Confirmar que existem somente duas empresas ativas:
   - `CPA FERRO E ACO`
   - `3Z LTDA`
3. Remover ou consolidar placeholders locais quando o snapshot real ja existir:
   - `GRUPO CPA LOCAL`
   - `3Z LTDA LOCAL`
   - `CPA FERRO E ACO LOCAL`
4. Revisar `localBase44Client.js` para garantir que:
   - todo registro tenha `grupo_id` quando aplicavel;
   - todo registro operacional tenha `empresa_id` quando aplicavel;
   - registros feitos no grupo alimentem as empresas quando a entidade exigir;
   - registros feitos nas empresas alimentem a visao consolidada do grupo.
5. Validar reset local:
   - `http://localhost:5173/?reset-local=1`
6. Conferir se os Cadastros Gerais aparecem com dados do snapshot.

Resultado esperado:

- O usuario ve apenas `GRUPO CPA`.
- O usuario ve apenas `CPA FERRO E ACO` e `3Z LTDA`.
- Nenhum cadastro relevante fica sem grupo/empresa quando deveria ter.

## Fase 2 - Administracao do Sistema

Objetivo: melhorar a area que sustenta seguranca, acessos, configuracoes e governanca.

Tarefas:

1. Mapear todos os arquivos existentes de `AdministracaoSistema`.
2. Mapear abas existentes:
   - Gestao de Acessos
   - Configuracoes Gerais
   - Seguranca
   - Auditoria
   - Integracoes
   - Apps externos
   - Parametros
3. Verificar botoes, toggles, checkboxes, selects e formularios.
4. Para cada controle:
   - confirmar se aparece corretamente;
   - confirmar se salva;
   - confirmar se recarrega com valor salvo;
   - confirmar se respeita grupo/empresa;
   - confirmar se exige permissao;
   - confirmar se gera auditoria quando sensivel.
5. Consolidar configuracoes duplicadas.
6. Melhorar textos, organizacao visual e responsividade sem alterar fluxo.

Resultado esperado:

- Administracao do Sistema vira a central confiavel de configuracoes, acessos, seguranca e auditoria.

## Fase 3 - Gestao de Acessos e RBAC granular

Objetivo: controlar acesso por modulo, submodulo, aba, acao, grupo e empresa.

Tarefas:

1. Mapear o modelo atual de usuarios, perfis e permissoes.
2. Identificar onde ja existe `usePermissions`, `ProtectedAction`, `ProtectedSection` e similares.
3. Criar uma matriz de permissoes usando o que ja existe.
4. Padronizar permissoes por chave granular:
   - `administracao.acessos.visualizar`
   - `administracao.acessos.editar`
   - `administracao.configuracoes.alterar`
   - `cadastros.empresa.criar`
   - `cadastros.empresa.editar`
   - `cadastros.grupo.editar`
   - `comercial.pedido.aprovar`
   - `financeiro.caixa.baixa-manual`
   - `fiscal.nota.emitir`
5. Aplicar permissao em:
   - menus;
   - abas;
   - botoes;
   - campos editaveis;
   - acoes sensiveis;
   - funcoes da API local.
6. Bloquear no frontend e tambem na API/local client.
7. Auditar mudancas de permissao.

Resultado esperado:

- Cada usuario ve e executa somente o que tem permissao.
- O bloqueio visual nao e a unica seguranca; a acao tambem e bloqueada na execucao.

## Fase 4 - Seguranca obrigatoria

Objetivo: reduzir riscos de entrada invalida, XSS, acao indevida e alteracao sensivel sem validacao.

Tarefas:

1. Localizar sanitizadores existentes, como `sanitizeOnWrite.ts` ou equivalente.
2. Aplicar sanitizacao nas escritas de entidades.
3. Validar dados antes de salvar:
   - campos obrigatorios;
   - CNPJ/CPF;
   - email;
   - telefone;
   - valores monetarios;
   - datas;
   - IDs de grupo e empresa.
4. Proteger acoes sensiveis:
   - alterar perfil;
   - alterar permissao;
   - excluir/inativar registro;
   - emitir nota;
   - baixar financeiro;
   - alterar configuracao de seguranca;
   - alterar integracao.
5. Exigir confirmacao ou dupla validacao quando necessario.
6. Gerar alerta de seguranca para evento critico.

Resultado esperado:

- Escritas mais seguras.
- Acoes sensiveis rastreadas e protegidas.

## Fase 5 - Auditoria completa

Objetivo: toda acao relevante deve deixar rastro claro.

Tarefas:

1. Mapear `AuditLog`, `auditEntityEvents.ts`, `securityAlerts.ts` e equivalentes.
2. Padronizar evento de auditoria com:
   - usuario;
   - data/hora;
   - modulo;
   - entidade;
   - acao;
   - antes;
   - depois;
   - grupo;
   - empresa;
   - origem da tela.
3. Aplicar auditoria em:
   - criar;
   - editar;
   - aprovar;
   - inativar;
   - excluir;
   - emitir;
   - baixar;
   - alterar permissao;
   - alterar configuracao.
4. Mostrar historico nas telas onde fizer sentido.

Resultado esperado:

- Qualquer alteracao importante pode ser rastreada.

## Fase 6 - Cadastros Gerais como base do ERP

Objetivo: garantir que Cadastros Gerais alimente todos os setores e relatorios.

Tarefas:

1. Revisar blocos de Cadastros Gerais:
   - Pessoas e Parceiros
   - Produtos e Servicos
   - Financeiro e Fiscal
   - Logistica
   - Organizacional
   - Tecnologia
2. Verificar entidades duplicadas ou similares.
3. Confirmar campos obrigatorios para relatorios.
4. Garantir que cada entidade tenha grupo/empresa quando necessario.
5. Garantir que cadastros compartilhados no grupo fiquem disponiveis nas empresas.
6. Garantir que cadastros de empresa aparecam no consolidado do grupo.
7. Corrigir contadores, filtros e buscas.
8. Verificar formularios e listas.

Resultado esperado:

- Cadastros Gerais vira a fonte confiavel dos dados usados por todos os setores.

## Fase 7 - Ramificacao grupo e empresas

Objetivo: consolidar a regra operacional entre `GRUPO CPA`, `CPA FERRO E ACO` e `3Z LTDA`.

Regras:

1. O grupo consolida tudo.
2. As empresas operam individualmente.
3. Cadastro feito no grupo deve poder ser usado pelas empresas quando for cadastro compartilhado.
4. Cadastro feito na empresa deve aparecer na visao do grupo.
5. Operacao fiscal sempre deve sair pela empresa, mesmo se iniciada no grupo.
6. Relatorio no grupo deve consolidar empresas.
7. Relatorio na empresa deve mostrar apenas a empresa.

Tarefas:

1. Revisar filtros por contexto.
2. Revisar `useContextoVisual`, `useContextoGrupoEmpresa` e componentes relacionados.
3. Padronizar escrita de `grupo_id`, `group_id`, `empresa_id`, `empresa_atual_id`.
4. Corrigir telas que listam tudo sem respeitar contexto.
5. Corrigir telas que escondem dados compartilhados do grupo indevidamente.

Resultado esperado:

- O usuario entende onde esta operando: grupo ou empresa.
- O dado aparece no lugar certo sem duplicar.

## Fase 8 - Setores do sistema

Objetivo: revisar cada setor para melhorar funcionamento, seguranca, permissao e relatorios.

Setores a revisar:

1. Comercial
2. Financeiro
3. Fiscal
4. Estoque
5. Logistica
6. Producao
7. Compras
8. CRM
9. Atendimento
10. RH
11. Contratos
12. Relatorios
13. Dashboard
14. Integracoes
15. IA e automacoes

Para cada setor:

1. Mapear telas existentes.
2. Mapear botoes/toggles/selects.
3. Verificar se cada acao funciona.
4. Verificar duplicidades.
5. Aplicar contexto grupo/empresa.
6. Aplicar RBAC.
7. Aplicar auditoria.
8. Validar relatorios.
9. Melhorar layout mantendo fluxo.

Resultado esperado:

- Cada setor funciona de ponta a ponta e conversa com Cadastros Gerais, grupo/empresa, RBAC e auditoria.

## Fase 9 - Relatorios e dashboards

Objetivo: tornar relatorios confiaveis por grupo e empresa.

Tarefas:

1. Listar todos os relatorios existentes.
2. Verificar fonte de dados de cada relatorio.
3. Garantir filtros:
   - grupo;
   - empresa;
   - periodo;
   - status;
   - entidade relacionada.
4. Validar consolidado do grupo.
5. Validar individual por empresa.
6. Garantir que dados venham dos Cadastros Gerais quando necessario.
7. Corrigir exportacoes.
8. Auditar geracao/exportacao quando sensivel.

Resultado esperado:

- Relatorios confiaveis para decisao gerencial.

## Fase 10 - UX, layout e responsividade

Objetivo: melhorar uso diario sem quebrar padrao visual.

Tarefas:

1. Garantir `w-full` e `h-full` em telas, paginas e containers principais.
2. Corrigir telas cortadas ou com overflow ruim.
3. Melhorar modais grandes.
4. Garantir funcionamento em celular, tablet e desktop.
5. Padronizar botoes e icones.
6. Nao criar landing page.
7. Nao criar cards dentro de cards.
8. Manter abas fixas.
9. Evitar texto quebrando layout.

Resultado esperado:

- Sistema mais limpo, responsivo e facil de usar.

## Fase 11 - Duplicidades

Objetivo: evitar que o ERP cresca com telas, funcoes e componentes repetidos.

Tarefas:

1. Procurar entidades/telas/componentes com nomes parecidos.
2. Comparar proposito antes de alterar.
3. Se houver duplicidade:
   - nao excluir automaticamente;
   - documentar;
   - perguntar;
   - consolidar no existente aprovado.
4. Dar prioridade ao componente mais usado e mais integrado.
5. Migrar comportamento sem perder funcionalidade.

Resultado esperado:

- Menos repeticao, mais manutencao, menos erro.

## Fase 12 - Validacao final continua

Objetivo: cada melhoria deve ser validada antes de seguir.

Checklist por alteracao:

1. A tela abre.
2. O fluxo antigo continua funcionando.
3. Nao criou duplicidade.
4. Grupo/empresa estao corretos.
5. Permissao funciona.
6. Botao/toggle/select salva e recarrega.
7. Auditoria e gerada quando necessario.
8. Build passa.
9. O usuario aprovou inclusao ou exclusao, se houver.

## Primeira frente recomendada para executar agora

Comecar por:

`Administracao do Sistema > Gestao de Acessos`

Motivo:

Essa area controla usuarios, perfis, permissoes, seguranca, configuracoes e governanca. Sem ela consolidada, os outros setores continuam sem base segura.

Primeiro pacote de trabalho:

1. Mapear arquivos existentes de Gestao de Acessos.
2. Mapear permissoes atuais.
3. Verificar toggles/botoes/checkboxes da tela.
4. Corrigir persistencia real.
5. Aplicar grupo/empresa.
6. Aplicar auditoria.
7. Aplicar RBAC visual e funcional.
8. Confirmar duplicidades antes de qualquer criacao/exclusao.

