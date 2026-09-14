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
- [x] Padronizar o contrato canonico `{ groupId, empresaId, scopeType }` no frontend e backend.
- [x] Fechar chamadas backend criticas que ignoravam negacao ou indisponibilidade do `entityGuard`.
- [x] Ampliar testes de isolamento entre Grupo CPA, CPA Ferro e Aco e 3Z LTDA.

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

## Plano Mestre - Lotes de Fundacao em Execucao

### Lote 6 - Validacao operacional confiavel (concluido em 2026-08-30)

1. Manter documentos historicos `.jsx`, `.md.jsx` e relatorios JSON no repositorio.
2. Excluir esses artefatos somente do lint operacional, por classificacao de conteudo.
3. Continuar contabilizando todos no `audit:baseline` e detectar importacao pelo runtime.
4. Corrigir erros reais de JSX, filtros, hooks, `case`, estilos e codificacao encontrados no lote.
5. Manter o typecheck com `checkJs` e adicionar os tipos de `vite/client`.

Resultado: 312 artefatos historicos preservados, zero importacoes pelo runtime, 20 testes aprovados e build completo aprovado.

### Lote 7 - Contratos compartilhados (concluido em 2026-08-30)

1. Tipar por JSDoc as primitivas de interface existentes, comecando por Button, Input, Tabs, Select, Dialog, Card e formularios.
2. Preservar como opcionais apenas propriedades que ja funcionam dessa forma.
3. Padronizar o contrato dinamico do cliente Base44 sem criar um `any` global.
4. Atacar primeiro TS2322, TS2559, TS2339 e TS2741.

Resultado: primitivas de alta reutilizacao e cliente Base44 tipados; diagnosticos reduzidos de 14.003 para 1.788 sem desligar `checkJs`.

### Lote 8 - Controles, erros e seguranca visual

1. Ativar o guard backend do botao compartilhado e falhar fechado.
2. Revisar catches vazios por criticidade, com erro visivel ou auditoria em persistencia, acesso e operacoes criticas.
3. Validar botoes, toggles, selecoes, formularios e reabertura dos dados.

Andamento 8A em 2026-08-30: guard fail-closed ativado e unificado em Button, ProtectedAction e ProtectedSection; falhas criticas de contexto, backup, sessoes e App Motorista deixaram de ser silenciosas. O inventario passou a acompanhar catches vazios por arquivo para a continuacao 8B/9.

Andamento 8B em 2026-08-30: removidos os silenciamentos das funcoes criticas de aprovacao, analise financeira, integracoes legadas, autorizacao de NF-e, eventos de pedido e pagamentos. Cada falha agora registra operacao e contexto disponivel; a IA financeira informa warnings quando a analise for parcial. O inventario caiu de 436 para 352 catches vazios operacionais, sem alterar o comportamento principal dos fluxos. Proxima frente: funcoes fiscais, roteirizacao e manutencao de frota, seguida pelos catches do frontend no Lote 9.

Conclusao 8B em 2026-08-30: fiscal, NF-e, roteirizacao e manutencao de frota tambem passaram a registrar falhas auxiliares. O inventario encerrou o lote com 330 catches vazios operacionais; a continuacao passa ao Lote 9.

### Lote 9 - Qualidade verde

1. Zerar erros e avisos do lint operacional.
2. Zerar diagnosticos de typecheck sem desligar `checkJs`.
3. Corrigir CSS invalido, imports mistos e bundle principal.
4. Configurar E2E para contexto, RBAC, persistencia e fluxos criticos.

Andamento 9A em 2026-08-30: corrigido o seletor global que gerava CSS invalido; o build nao apresenta mais o aviso Unexpected button. O trecho critico do Layout passou a registrar falhas de contexto, auditoria e criptografia, e a sanitizacao de chamadas backend agora falha fechada. O lint caiu de 217 para 200 erros e o inventario global de catches vazios caiu de 330 para 313.

Andamento 9B em 2026-08-30: concluidos os tratamentos de PWA, cache offline, erros globais, navegacao e telemetria do Layout. O arquivo ficou com zero catches vazios, o lint caiu para 160 erros e o inventario global caiu para 273.

Andamento 9C em 2026-08-31: aprovacao com assinatura, cliente Base44 local e auditoria de UI ficaram sem catches vazios. A sanitizacao local agora falha fechada, o lint global ficou com 139 erros, o inventario caiu para 241 e o typecheck para 1.778 diagnosticos.

Andamento 9D em 2026-08-31: guard backend, consolidacao de Grupo e envio WhatsApp ficaram sem catches vazios. Validacao SoD e conclusao de contexto passaram a falhar fechadas, a consolidacao exige contexto inclusive para administrador e o WhatsApp recebeu verificacao backend para chamadas de usuario. O inventario caiu para 227 ocorrencias.

Andamento 9E em 2026-08-31: o motor de intents, o importador de produtos e os chamados do Portal ficaram sem catches vazios. Falhas dos fallbacks de IA e leitura de planilha agora sao rastreaveis; a criacao automatica de unidades e ignorada quando nao for possivel verificar duplicidades; chamados exigem Grupo e Empresa e recebem sanitizacao antes da gravacao. O lint caiu para 122 erros, sem avisos, e o inventario para 210 ocorrencias. Proxima frente: paginas Comercial e Dashboard e funcoes backend com maior concentracao de excecoes silenciosas, mantendo os contratos TS2339/TS2741 em lotes separados.

Andamento 9F em 2026-08-31: Comercial e Dashboard passaram a exigir contexto canonico completo, usar chaves de cache com tipo de escopo, Grupo e Empresa e ativar assinaturas realtime apenas quando houver permissao do setor. Falhas de auditoria, cache, armazenamento local e encerramento de assinaturas agora sao rastreaveis. O lint caiu para 112 erros, sem avisos, e o inventario para 200 ocorrencias. Proxima frente: endurecer syncGroupCompany e upsertConfig contra escopo global, vazamento entre Grupos e sucesso falso.

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

## Andamento Gate 18 - Conciliacao financeira

Em 2026-09-13, a politica visual da conciliacao financeira foi homologada com dados sinteticos para Grupo CPA, CPA Ferro e Aco e 3Z LTDA. Contexto, cache, filtro defensivo e segregacao entre registrante, revisor e aprovador foram exercitados sem persistir dados reais. O registro permaneceu bloqueado em `PENDING_MANUAL_RECONCILIATION` durante todo o fluxo.

Proxima frente: validar persistencia e reabertura entre tres sessoes em armazenamento descartavel, restaurando o ambiente automaticamente ao final. Nenhuma promocao para titulos operacionais sera implementada sem autorizacao expressa.

Andamento em 2026-09-13: o cliente local real foi homologado com `localStorage` em memoria e recarga entre registrante, revisor e aprovador. CPA Ferro e Aco e 3Z LTDA permaneceram isoladas, a visao de Grupo falhou fechada, a auditoria preservou os tres atores e nenhum titulo operacional foi criado. O armazenamento de teste foi restaurado integralmente ao final.

Proxima frente: fazer a persistencia especializada confirmar a escrita e falhar fechada quando o armazenamento estiver indisponivel ou exceder a quota, evitando sucesso falso. A promocao operacional continua dependente de autorizacao expressa.

Andamento em 2026-09-13: a persistencia especializada passou a confirmar a escrita por leitura imediata e a falhar fechada, com tentativa de restauracao do snapshot anterior. Excecao de quota e escrita silenciosamente nao confirmada foram simuladas em memoria; nenhuma delas avancou a etapa da pendencia ou declarou sucesso.

Proxima frente: documentar a matriz de impacto, pre-condicoes, rollback, idempotencia, RBAC e segregacao necessaria para eventual promocao manual. Essa frente nao habilitara acao executavel nem criara ou alterara titulos sem autorizacao expressa.

### Matriz de decisao para eventual promocao manual

Esta matriz e somente um contrato de seguranca. Ela nao autoriza implementacao, nao cria permissao, botao, endpoint, entidade ou titulo e nao altera o bloqueio atual do staging.

| Area | Pre-condicao obrigatoria | Comportamento futuro permitido | Bloqueio obrigatorio |
|---|---|---|---|
| Contexto | `scope_type=empresa`, `group_id` e `empresa_id` validos; Empresa ativa e pertencente ao Grupo | Operar somente na Empresa proprietaria; Grupo recebe visao consolidada | Grupo sem Empresa emissora, Empresa de outro Grupo ou contexto divergente |
| Estado | Solicitacao `pendente`, bloqueada, com etapa `aprovada_aguardando_promocao_manual` | Iniciar promocao uma unica vez, sob versao conhecida do envelope | Qualquer outra etapa, envelope alterado, cancelado, ja promovido ou em processamento |
| Origem | Entidade `ContaPagar` ou `ContaReceber`, codigo legado e referencia do staging presentes | Manter rastreio permanente da solicitacao e do codigo legado | Entidade desconhecida, codigo ausente ou origem sem rastreabilidade |
| Evidencia | Pelo menos uma evidencia acessivel, validada e vinculada; antes da implementacao, exigir hash imutavel e verificacao de arquivo | Referenciar a evidencia no evento de promocao sem copiar segredo ou URL temporaria para auditoria | Arquivo ausente, expirado, adulterado, infectado ou sem hash verificavel |
| Segregacao | Registrante, revisor e aprovador final distintos | Um quarto usuario, tambem distinto, executa a promocao | Auto-promocao ou acumulacao com qualquer uma das tres etapas anteriores |
| RBAC | Nova acao especifica proposta `Financeiro.Migracao.promover`, validada no frontend e backend, com sessao reforcada | Exibir e executar somente apos autorizacao expressa e confirmacao humana | Reuso de `conciliar`, `aprovar`, perfil administrativo generico ou falha do guard |
| Decisao `ABERTO` | Valor, vencimento, contraparte, categoria/conta e Empresa confirmados | Criar titulo operacional inicialmente pendente, sem data/valor de baixa | Projetar pagamento, recebimento ou conciliacao em titulo classificado como aberto |
| Decisao `PAGO` | Todos os campos de `ABERTO` mais data, valor, forma, conta/caixa e comprovante de liquidacao | Criar titulo e evento de liquidacao na mesma unidade atomica; nunca apenas marcar `status=Pago` | Campo financeiro incompleto, divergencia de valor ou impossibilidade de atomicidade |
| Idempotencia | Chave unica proposta `migracao-promocao|grupo|empresa|entidade|codigo-legado` | Repeticao devolve o mesmo resultado confirmado | Atualizar automaticamente titulo conflitante ou aceitar mesma chave em outro destino |
| Auditoria | Antes/depois sanitizados, quatro atores, timestamp, Grupo, Empresa, decisao, correlacao e resultado | Confirmar sucesso somente depois de titulo, staging e auditoria persistidos | Auditoria indisponivel, incompleta ou contendo segredo/evidencia temporaria |
| Integridade | Validar `assertTituloOnCreate`, duplicidade e escopo antes da escrita | Remover do payload operacional as marcas que mantem o envelope no staging e preservar a origem em campos proprios | Contornar `financeiroTituloPolicy` ou copiar diretamente o envelope para o titulo |
| Concorrencia | Reserva/lock por solicitacao e verificacao de versao imediatamente antes da escrita | Uma unica promocao vence; repeticoes sao idempotentes | Duas sessoes criarem titulos ou liquidacoes concorrentes |

#### Sequencia futura condicionada a autorizacao

1. Revalidar usuario, sessao reforcada, permissao especifica e contexto no backend.
2. Recarregar a solicitacao por ID, Grupo e Empresa e validar integralmente o envelope aprovado.
3. Verificar hash e disponibilidade das evidencias, quatro atores distintos e decisao final consistente.
4. Reservar a chave idempotente e impedir outra promocao concorrente.
5. Construir por allowlist o payload minimo de `ContaPagar` ou `ContaReceber`.
6. Para `ABERTO`, criar titulo pendente. Para `PAGO`, criar titulo e liquidacao na mesma unidade atomica.
7. Auditar antes/depois e somente entao marcar o staging como promovido, preservando referencia ao titulo.
8. Confirmar o resultado por releitura e liberar notificacoes/invalidacoes de cache apenas depois da persistencia completa.

#### Rollback e recuperacao obrigatorios

- Falha antes da escrita: manter a solicitacao intacta em `aprovada_aguardando_promocao_manual`.
- Falha ao criar titulo: liberar a reserva idempotente e registrar tentativa negada, sem alterar o staging.
- Falha de auditoria ou ao atualizar o staging: desfazer o titulo recem-criado somente se ele ainda nao tiver consumidores; caso contrario, bloquear ambos e abrir reconciliacao tecnica.
- Falha depois de liquidacao: nunca apagar titulo ou pagamento; aplicar estorno compensatorio auditado e manter a solicitacao bloqueada para intervencao.
- Timeout com resultado desconhecido: consultar pela chave idempotente antes de repetir; nunca executar novamente por suposicao.

#### Bloqueios tecnicos ainda nao resolvidos

- Nao foi confirmada uma primitiva transacional entre `SolicitacaoAprovacao`, `ContaPagar`/`ContaReceber` e `AuditLog`.
- Nao foi confirmado indice unico persistente para a chave de promocao.
- As evidencias aceitam referencia controlada, mas ainda nao exigem hash imutavel e verificacao de conteudo.
- Nao foi homologada sessao reforcada/MFA especificamente para promocao financeira migrada.
- O mapeamento obrigatorio de contraparte, conta, categoria, vencimento, forma e liquidacao ainda exige aprovacao do responsavel financeiro.
- O clone continua sem configuracao de deploy Base44; nenhum recurso remoto pode ser alterado por este lote.

Recomendacao atual: manter a promocao desabilitada. O proximo trabalho permitido e uma auditoria tecnica somente leitura das primitivas existentes de transacao, unicidade/idempotencia e evidencia, sem criar acao executavel.

### Auditoria tecnica das primitivas para promocao

Auditoria concluida em 2026-09-13 somente com leitura do SDK instalado, do codigo e das definicoes versionadas no repositorio. Nenhum recurso remoto foi consultado ou alterado.

| Tema | Evidencia encontrada | Conclusao | Risco para promocao |
|---|---|---|---|
| Transacao | O SDK `@base44/sdk` instalado documenta `create`, `update`, `updateMany`, operacoes em lote e exclusao por entidade; nao documenta transacao multi-entidade | Nao ha garantia local de commit atomico entre solicitacao, titulo, liquidacao e auditoria | Critico: falha intermediaria pode deixar titulo sem staging concluido ou staging sem auditoria |
| Reserva concorrente | `updateMany(query, patch)` informa quantos registros foram atualizados e pode futuramente reivindicar uma solicitacao ainda no estado esperado | Pode reduzir corrida no mesmo registro, mas nao torna as escritas posteriores atomicas | Alto: reserva evita dois vencedores, mas exige recuperacao duravel apos timeout/falha |
| Rollback existente | `solicitacoesAprovacao` remove solicitacao recem-criada se a auditoria falhar e restaura o envelope anterior quando a transicao nao puder ser auditada | Ha compensacao localizada e testada apenas dentro da conciliacao em staging | Alto: nao existe compensacao homologada envolvendo `ContaPagar`, `ContaReceber` ou liquidacao |
| Unicidade | A idempotencia atual consulta por chave e depois cria; o repositorio nao possui schema versionado para `SolicitacaoAprovacao`, `ContaPagar` ou `ContaReceber` | Nao foi comprovado indice unico para impedir duas criacoes concorrentes | Critico: filtro antes de `create` nao garante unicidade sob concorrencia |
| Configuracao Base44 | `base44/config.jsonc` nao existe e somente `ConfiguracaoSistema.jsonc` esta versionada em `base44/entities` | O clone nao consegue provar nem publicar RLS, FLS, indices ou constraints das entidades financeiras | Critico: nao implementar promocao remota sem vinculo/configuracao controlada do aplicativo |
| Upload atual | A aba usa `Core.UploadFile`, que retorna apenas `file_url` em armazenamento publico | A referencia pode ser persistida, mas nao comprova imutabilidade, privacidade ou conteudo | Critico: comprovante financeiro nao deve depender de URL publica como unica evidencia |
| Upload privado | O SDK instalado documenta `UploadPrivateFile`, que retorna `file_uri`, e `CreateFileSignedUrl` temporaria | Existe caminho de armazenamento privado reutilizavel | Medio: ainda falta adaptar cliente local, backend, expiração e autorizacao de leitura |
| Hash | O envelope aceita `hash_sha256`, mas ele e opcional; a interface nao calcula hash e o backend aceita URL, hash ou referencia sem verificar o arquivo | Nao existe prova criptografica obrigatoria do conteudo revisado | Critico: troca de arquivo nao seria detectada pelo contrato atual |
| Validacao de arquivo | A interface limita PDF/JPG/PNG/WEBP e 10 MB; o backend valida apenas metadados textuais | MIME, tamanho e conteudo nao sao confirmados por uma autoridade backend | Alto: validacao frontend pode ser contornada |

#### Decisao tecnica

- A promocao manual permanece desabilitada.
- `updateMany` pode ser estudado como reivindicacao atomica do estado da solicitacao, mas nao resolve a unidade atomica multi-entidade.
- Sem indice unico confirmado, toda futura escrita deve tratar a chave como idempotencia de recuperacao, nao como garantia absoluta contra concorrencia.
- Se a plataforma nao oferecer transacao multi-entidade, a unica alternativa aceitavel sera uma saga duravel com reserva, estados intermediarios, releitura, compensacao e fila de reconciliacao tecnica. Essa alternativa exigira nova avaliacao e autorizacao.
- Antes de qualquer promocao, a evidencia existente deve migrar para armazenamento privado, hash SHA-256 obrigatorio, allowlist backend de MIME/tamanho e acesso temporario auditado.

Proxima frente: endurecer o fluxo de evidencia ja existente, reutilizando `UploadPrivateFile`/`CreateFileSignedUrl`, hash SHA-256 e validacao backend. O hash calculado no cliente sera apenas uma verificacao complementar ate existir confirmacao confiavel no backend. A promocao continuara ausente.

### Evidencias financeiras privadas no staging

Lote concluido em 2026-09-13 na Central de Aprovacoes existente, sem criar modulo paralelo e sem habilitar promocao financeira.

- Novos comprovantes usam `UploadPrivateFile`; URL publica e URL assinada nao sao persistidas no envelope.
- A interface valida PDF/JPG/PNG/WEBP, extensao correspondente e tamanho entre 1 byte e 10 MB antes do upload, calcula SHA-256 com Web Crypto e falha fechada quando a integridade nao pode ser calculada.
- A politica backend repete a allowlist de MIME, extensao, tamanho, nome, URI privada, algoritmo e formato hexadecimal de 64 caracteres do SHA-256. Campos publicos ou referencias livres nao satisfazem mais um novo anexo.
- A evidencia persistida inclui `file_uri`, nome, tamanho, MIME, SHA-256, algoritmo e marcador de armazenamento privado, alem do usuario e horario ja auditados.
- Revisor ou aprovador autorizado pode abrir a evidencia mais recente por URL assinada com validade de 300 segundos. O backend valida Grupo, Empresa, perfil, solicitacao e evidencia antes de assinar.
- Cada acesso registra `evidencia_id`, usuario, Grupo e Empresa; a URL assinada nunca entra no log ou no staging.
- O cliente local recebeu os mesmos contratos para upload privado e URL temporaria, mantendo testes de persistencia e reabertura entre sessoes.
- Evidencias historicas permanecem preservadas e contam no workflow; somente novos anexos recebem o contrato obrigatorio, evitando alteracao destrutiva de dados existentes.

Limite conhecido: o SHA-256 e calculado no navegador e validado estruturalmente pelo backend, mas o clone ainda nao possui um servico backend capaz de reler o conteudo privado e recalcular o hash. O valor e complementar, nao prova backend de imutabilidade. Upload privado que conclua antes de uma falha posterior tambem pode ficar orfao porque o SDK instalado nao documenta exclusao de arquivo privado.

Proxima frente: homologar em ambiente Base44 vinculado a leitura real por URL assinada e investigar uma primitiva backend de leitura/hash e descarte de upload orfao. Enquanto `base44/config.jsonc` estiver ausente, nao declarar essas garantias nem habilitar promocao.

### Homologacao remota das evidencias - BLOCKED

Verificacao executada em 2026-09-13 exclusivamente no clone interno. O repositorio continua sem `base44/config.jsonc` e, portanto, sem um vinculo versionado e comprovavel com o aplicativo Base44 correto.

- A documentacao instalada do SDK confirma `UploadPrivateFile` e `CreateFileSignedUrl`, mas nao documenta uma primitiva backend para reler o arquivo privado, recalcular seu hash ou excluir upload orfao.
- Foi localizado apenas um identificador historico em exportacao somente leitura. Esse identificador nao sera tratado como fonte de verdade nem usado para vincular ou alterar ambiente remoto.
- A autenticacao interativa da CLI Base44 nao foi concluida. Esse login depende de confirmacao manual do proprietario e nao pode ser automatizado com seguranca.
- A instalacao experimental da CLI nao foi incorporada ao projeto: `package.json` e `package-lock.json` foram restaurados integralmente, sem nova dependencia versionada.
- A auditoria do conjunto de dependencias instalado reportou 24 vulnerabilidades de producao (1 critica, 13 altas, 9 moderadas e 1 baixa). Nenhum `npm audit fix` sera aplicado automaticamente, pois pode alterar contratos ou introduzir quebra; o tema deve ser tratado em lote proprio de seguranca.
- Nenhum recurso remoto, arquivo privado, dado real, configuracao, entidade ou banco foi consultado ou alterado.

Estado: `BLOCKED` para homologacao Base44 ate que o proprietario conclua manualmente o login na conta correta e o vinculo controlado do aplicativo seja comprovado. A promocao financeira permanece ausente e desabilitada.

Proxima frente segura: realizar triagem direcionada das vulnerabilidades de producao, sem atualizacoes automaticas e sem misturar esse trabalho com a homologacao remota. A retomada da homologacao exigira autenticacao manual valida.

### Seguranca de dependencias - jsPDF

Lote concluido em 2026-09-13 para eliminar a vulnerabilidade critica de producao identificada na geracao de PDF, sem alterar telas, fluxos, dados ou formatos de saida.

- A dependencia direta `jspdf` foi atualizada de `2.5.2` para `4.2.1`, primeira versao indicada pelo registro npm como corrigida para os alertas criticos vigentes.
- As funcoes existentes `exportEstoqueAco` e `emitirBoleto` deixaram de fixar `jspdf@4.0.0` e passaram a usar `jspdf@4.2.1` no runtime Deno.
- Os usos atuais continuam limitados a construcao do documento, texto, paginas e `output('arraybuffer')`, contratos preservados na versao corrigida.
- O teste de seguranca existente agora impede regressao da versao declarada e das duas importacoes backend.
- A geracao real de um PDF de duas paginas foi validada com a dependencia instalada.
- A auditoria de producao passou de 24 para 22 alertas e de 1 critico para 0 criticos. Permanecem 13 altos, 8 moderados e 1 baixo, que serao tratados em lotes isolados.
- Nenhuma correcao automatica ampla, `npm audit fix`, acesso Base44, dado real ou HD externo foi utilizado.

Proxima frente: triagem isolada da dependencia direta `lodash`, classificada como alta, verificando usos e compatibilidade antes de qualquer atualizacao. React Router, PostCSS e dependencias transitivas permanecem fora deste lote.

### Qualidade operacional - ESLint verde e falhas observaveis

Lote concluido em 2026-09-13 para eliminar erros e avisos do ESLint operacional sem remover funcionalidades, relaxar regras ou ocultar falhas criticas.

- O ESLint global passou de 84 erros e 17 avisos para zero erros e zero avisos.
- Foram removidas 17 diretivas `eslint-disable` obsoletas e corrigidos 81 blocos vazios com tratamento explicito e rastreavel.
- Falhas de cache, contexto, auditoria, persistencia e encerramento de assinaturas passaram a ser registradas. Fluxos de portal, permissao da tabela e exclusao em lote agora falham fechados quando a verificacao critica nao pode ser concluida.
- Foram corrigidos o hook de notificacao ausente na liquidacao financeira, a sanitizacao de caracteres de controle da politica transversal de IA e o tratamento redundante de erro no realtime.
- O inventario `audit:baseline` reduziu `operationalEmptyCatches` de 127 para 45. Os casos restantes estao principalmente em funcoes backend fora do ESLint operacional e permanecem inventariados para lotes direcionados.
- O typecheck global permanece ativo, sem `ts-ignore` global ou desativacao de `checkJs`, e reporta 2.909 diagnosticos historicos. A continuidade foi expressamente autorizada pelo proprietario; essa divida nao e declarada resolvida.
- Nenhum dado, entidade, recurso Base44, banco ou HD externo foi acessado ou alterado.

Proxima frente: reduzir o typecheck por contratos JSDoc compartilhados, iniciando por uma politica de alta propagacao e sem introduzir `any` global. Cada lote deve comprovar que nao aumenta a contagem total antes do commit.

### Contratos JSDoc - politica de roteirizacao

Lote concluido em 2026-09-13 na politica compartilhada de roteirizacao, preservando algoritmo, exports, telas e tolerancia das entradas dinamicas existentes.

- O contrato local passou a descrever coordenadas, registros de rota/entrega, capacidade, parametros de otimizacao, dados de criacao e stores sem usar `any`, `ts-ignore` ou desativar `checkJs`.
- O typecheck isolado de `roteirizacaoPolicy.js` passou de 94 diagnosticos para zero.
- O typecheck global caiu de 2.909 para 2.814 diagnosticos, uma reducao liquida de 95, sem transferir erros para consumidores.
- Foram preservados o retorno historico `NaN` quando `distanciaKm` recebe argumentos ausentes e a normalizacao tolerante de entradas dinamicas em `sortedEntregaIdsKey`.
- Os contratos continuam aceitando campos legados de Grupo, Empresa, motorista, veiculo, entrega e sequencia usados pelos consumidores atuais.
- Nenhum dado, entidade, recurso Base44, banco ou HD externo foi acessado ou alterado.

Proxima frente: aplicar o mesmo metodo incremental a `atendimentoConversaPolicy.js`, atual maior concentrador compartilhado com 94 diagnosticos, preservando ciclo de vida, multiempresa, RBAC e idempotencia do Atendimento.

### Contratos JSDoc - politica de Atendimento

Lote concluido em 2026-09-13 na politica compartilhada de conversas e Chatbot, sem alterar telas, estados, roteamento, idempotencia ou persistencia.

- Foram tipados registros de conversa, cliente, atendente, configuracao de canal, webhook externo, regras de roteamento, sentimento, sessao e stores com JSDoc local e sem `any`.
- O typecheck isolado de `atendimentoConversaPolicy.js` passou de 94 diagnosticos para zero.
- O typecheck global caiu de 2.814 para 2.716 diagnosticos, reducao liquida de 98, sem transferir falhas para Hub, Chatbot ou outros consumidores.
- Os contratos de entrada preservam aliases legados, payload WhatsApp, verificacao por Empresa, canal ativo, fila, assumir, transferir, fechar, escalar e sessao estavel.
- Declaracoes repetidas foram consolidadas em aliases JSDoc e a politica encerrou com 569 linhas, abaixo do limite de 600, sem criar arquivo ou funcionalidade paralela.
- Nenhum dado, entidade, recurso Base44, banco ou HD externo foi acessado ou alterado.

Proxima frente: tipar `comprasOrdemPolicy.js`, politica compartilhada com 74 diagnosticos e testes existentes. A pagina `Contratos.jsx`, com 79 diagnosticos e 1.575 linhas, exige lote proprio de refatoracao e nao sera misturada a esta sequencia curta.

### Contratos JSDoc - politica de Ordens de Compra

Lote concluido em 2026-09-13 na politica compartilhada de Compras, sem alterar criacao, recebimento, movimentacao de estoque, Conta a Pagar ou permissoes.

- Um contrato `ComprasRecord` descreve OC, solicitacao, cotacao, itens, fornecedor, valores, documentos, contexto e vinculos financeiros; opcoes por operacao foram tipadas sem `any`.
- O typecheck isolado de `comprasOrdemPolicy.js` passou de 74 diagnosticos para zero.
- O typecheck global caiu de 2.716 para 2.640 diagnosticos, reducao liquida de 76, sem deslocar falhas para o cliente local ou para a tela de Ordens de Compra.
- Permanecem iguais as chaves idempotentes, o bloqueio sem Empresa, o recebimento unico, o carimbo Grupo/Empresa, a geracao de movimento e titulo e a classificacao granular de permissoes.
- A politica encerrou com 282 linhas, sem necessidade de extracao e sem criar modulo, entidade ou funcionalidade paralela.
- Nenhum dado, entidade, recurso Base44, banco ou HD externo foi acessado ou alterado.

Proxima frente: tipar `crmOportunidadePolicy.js`, politica compartilhada com 71 diagnosticos e testes existentes. A pagina grande de Contratos continua reservada para refatoracao propria.

### Contratos JSDoc - politica de Oportunidades CRM

Lote concluido em 2026-09-13 na politica compartilhada de Oportunidades CRM, sem alterar criacao, atualizacao, fechamento, conversao ou permissoes.

- Contratos locais descrevem registros de oportunidade, cliente, funil, contexto, conversao e opcoes de operacao sem `any`, `ts-ignore` ou desativacao de `checkJs`.
- O typecheck isolado de `crmOportunidadePolicy.js` passou de 71 diagnosticos para zero.
- O typecheck global caiu de 2.640 para 2.569 diagnosticos, reducao liquida de 71, sem deslocar falhas para os consumidores.
- Permanecem iguais o contexto Grupo/Empresa, a deduplicacao, as chaves idempotentes, as etapas do funil, o fechamento e congelamento e a conversao para pedido ou orcamento.
- As classificacoes de permissoes por acao foram preservadas e a politica encerrou com 366 linhas, sem necessidade de extracao.
- Nenhum dado, entidade, recurso Base44, banco ou HD externo foi acessado ou alterado.

Proxima frente: tipar `notaFiscalEmissaoPolicy.js`, politica compartilhada com 53 diagnosticos. `Contratos.jsx`, `ArmadoPadraoTab.jsx` e o cliente local permanecem reservados para lotes proprios por tamanho e propagacao.

### Contratos JSDoc - politica de emissao de Nota Fiscal

Lote concluido em 2026-09-13 na politica compartilhada de NF-e, sem alterar numeracao, ambiente, emissao, simulacao, cancelamento ou congelamento fiscal.

- Contratos locais descrevem Nota Fiscal, itens, integracao fiscal, sequencia, criacao, atualizacao, emissao e cancelamento sem `any`, `ts-ignore` ou desativacao de `checkJs`.
- O typecheck isolado de `notaFiscalEmissaoPolicy.js` passou de 53 diagnosticos para zero.
- O typecheck global caiu de 2.569 para 2.514 diagnosticos, reducao liquida de 55, sem deslocar falhas para os consumidores.
- Permanecem iguais a sequencia por Empresa e serie, a exigencia de empresa emitente e CFOP, a autorizacao explicita para producao, o modo piloto, a simulacao em homologacao e os bloqueios de exclusao e recalculo.
- As permissoes de emitir e cancelar foram preservadas e a politica encerrou com 317 linhas, sem necessidade de extracao.
- Nenhum dado, entidade, recurso Base44, banco ou HD externo foi acessado ou alterado.

Proxima frente: tipar `localCadastroMasterPolicy.js`, politica compartilhada com 51 diagnosticos e 383 linhas. As telas grandes de Nota Fiscal, Dashboard, Contratos e Armado permanecem reservadas para lotes proprios de refatoracao.

### Contratos JSDoc - politica local de Cadastros Mestres

Lote concluido em 2026-09-13 na politica compartilhada de cadastros, sem alterar validacao de fornecedor, codigos legados, sequencias ou deteccao de duplicidade.

- Contratos locais descrevem registros mestres, empresas, dados bancarios, especificacoes de codigo, escopo, sequencias e erros com detalhe de duplicidade sem `any`, `ts-ignore` ou desativacao de `checkJs`.
- O typecheck isolado de `localCadastroMasterPolicy.js` passou de 51 diagnosticos para zero.
- O typecheck global caiu de 2.514 para 2.458 diagnosticos, reducao liquida de 56, incluindo cinco diagnosticos removidos do cliente local.
- Permanecem iguais a validacao de CPF/CNPJ, website, RG, Simples Nacional e dados bancarios, o bloqueio de empresa fora do Grupo e a reserva de codigos pelo backend.
- Migracoes continuam preservando codigo de origem e legado; duplicidades continuam isoladas por Grupo e o arquivo encerrou com 466 linhas.
- Nenhum dado, entidade, recurso Base44, banco ou HD externo foi acessado ou alterado.

Proxima frente: tipar `portalClientePolicy.js`, politica compartilhada com 42 diagnosticos e 232 linhas. O cliente local e as telas acima do limite permanecem reservados para lotes proprios.

### Contratos JSDoc - politica do Portal do Cliente

Lote concluido em 2026-09-13 na politica compartilhada do Portal, sem alterar autenticacao, vinculo, filtragem, segunda via, PIX ou documentos fiscais.

- Contratos locais descrevem usuario, cliente, titulo, NF-e, sessao, leitura, saldo e operacoes financeiras do Portal sem `any`, `ts-ignore` ou desativacao de `checkJs`.
- O typecheck isolado de `portalClientePolicy.js` passou de 42 diagnosticos para zero.
- O typecheck global caiu de 2.458 para 2.413 diagnosticos, reducao liquida de 45, sem transferir falhas para dashboards, boletos, documentos ou cliente local.
- Permanecem iguais o bloqueio contra outro cliente, a filtragem das entidades pelo vinculo, o timeout explicito e a protecao contra troca do titular do recebivel.
- A segunda via e o PIX continuam idempotentes e os links de XML/DANFE continuam restritos a NF-e do cliente; a politica encerrou com 310 linhas.
- Nenhum dado, entidade, recurso Base44, banco ou HD externo foi acessado ou alterado.

Proxima frente: tipar `siteOrigemPolicy.js`, politica compartilhada com 39 diagnosticos e 265 linhas. O cliente local e as telas acima do limite permanecem reservados para lotes proprios.

### Contratos JSDoc - politica de origem e operacao do Site

Lote concluido em 2026-09-13 na politica compartilhada do site, sem alterar catalogo, checkout, lead, pagamento ou acompanhamento do pedido.

- Contratos locais descrevem produto, catalogo, cliente, contato, carrinho, lead, pagamento e resumo do pedido sem `any`, `ts-ignore` ou desativacao de `checkJs`.
- O typecheck isolado de `siteOrigemPolicy.js` passou de 39 diagnosticos para zero.
- O typecheck global caiu de 2.413 para 2.365 diagnosticos, reducao liquida de 48, sem transferir falhas para Orcamento Site, Catalogo Web, IA comercial ou cliente local.
- Permanecem iguais a exigencia de Empresa, contato valido, preco e estoque online, a origem canonica `site` e a correspondencia de cliente por e-mail ou documento.
- Pagamento sem link continua pendente, sem falso status de gerado, e o acompanhamento permanece integrado ao Portal; a politica encerrou com 360 linhas.
- Nenhum dado, entidade, recurso Base44, banco ou HD externo foi acessado ou alterado.

Proxima frente: tipar `financeiroTituloPolicy.js`, politica compartilhada com 34 diagnosticos e 207 linhas. O cliente local e as telas acima do limite permanecem reservados para lotes proprios.

### Contratos JSDoc - politica de Titulos Financeiros

Lote concluido em 2026-09-13 na politica compartilhada de titulos, sem alterar criacao, baixa, conciliacao, estorno, exclusao protegida ou staging manual.

- Contratos locais descrevem titulo, valores, vinculos, historico, criacao, atualizacao e erro codificado sem `any`, `ts-ignore` ou desativacao de `checkJs`.
- Os 34 diagnosticos proprios de `financeiroTituloPolicy.js` foram reduzidos a zero. Sete diagnosticos preexistentes da dependencia importada `migracaoErpPolicy.js` permanecem fora deste lote.
- O typecheck global caiu de 2.365 para 2.331 diagnosticos, reducao liquida de 34, sem deslocar falhas para o cliente local.
- Permanecem iguais a exigencia de Empresa, a idempotencia por documento/parcela, o bloqueio de staging manual e o congelamento de valores e vinculos depois da baixa.
- Conciliacao e estorno continuam caminhos explicitos, com historico preservado, e titulo liquidado continua protegido contra exclusao; a politica encerrou com 262 linhas.
- Nenhum dado, entidade, recurso Base44, banco ou HD externo foi acessado ou alterado.

Proxima frente: tipar `appMotoristaPolicy.js`, politica compartilhada com 33 diagnosticos e 329 linhas. O cliente local e as telas acima do limite permanecem reservados para lotes proprios.

### Contratos JSDoc - politica do App Motorista

Lote concluido em 2026-09-13 na politica compartilhada do App Motorista, sem alterar atribuicao, rota, comprovantes, ocorrencias, estorno ou operacao offline.

- Contratos locais descrevem usuario, motorista, entrega, localizacao, comprovante, historico, patches e fila offline sem `any`, `ts-ignore` ou desativacao de `checkJs`.
- O typecheck isolado de `appMotoristaPolicy.js` passou de 33 diagnosticos para zero.
- O typecheck global caiu de 2.331 para 2.298 diagnosticos, reducao liquida exata de 33, sem transferir falhas para o App, expedicao ou cliente local.
- Permanecem iguais a validacao de motorista atribuido, escopo, GPS, comprovacao parcial, ocorrencia, estorno e atualizacao de status.
- Idempotencia e retomada da fila offline continuam preservadas; a politica encerrou com 433 linhas apos a documentacao dos contratos.
- Nenhum dado, entidade, recurso Base44, banco ou HD externo foi acessado ou alterado.

Proxima frente: tipar `viradaProducaoPolicy.js`, politica compartilhada com 290 linhas. O cliente local e as telas acima do limite permanecem reservados para lotes proprios.

### Contratos JSDoc - politica de backup e virada de producao

Lote concluido em 2026-09-13 na politica compartilhada de backup e virada, sem alterar snapshot, restauracao, expiracao, congelamento da migracao ou checklist de producao.

- Contratos locais descrevem registros, configuracao, escopo, resumo, snapshot, entidades e operacoes de backup/virada sem `any`, `ts-ignore` ou desativacao de `checkJs`.
- O typecheck isolado de `viradaProducaoPolicy.js` passou de 30 diagnosticos para zero.
- O typecheck global caiu de 2.298 para 2.265 diagnosticos, reducao liquida de 33, incluindo tres diagnosticos removidos do consumidor de configuracao.
- Permanecem iguais a exigencia de Grupo, o isolamento por Empresa, o hash estavel, a validacao do snapshot e os bloqueios de restauracao fora do escopo.
- Checklist assinado, backup valido e janela congelada continuam obrigatorios para a virada; a politica encerrou com 400 linhas.
- Nenhum dado, entidade, recurso Base44, banco ou HD externo foi acessado ou alterado.

Proxima frente: tipar `expedicaoEntregaPolicy.js`, politica compartilhada com 27 diagnosticos e 220 linhas. Telas grandes permanecem reservadas para lotes proprios.

### Contratos JSDoc - politica de entrega e expedicao

Lote concluido em 2026-09-13 na politica compartilhada de expedicao, sem alterar entrega, romaneio, separacao, comprovante, ocorrencia ou logistica reversa.

- Contratos locais descrevem entrega, usuario, comprovante, romaneio, separacao, atualizacao e stores da expedicao sem `any`, `ts-ignore` ou desativacao de `checkJs`.
- O typecheck isolado de `expedicaoEntregaPolicy.js` passou de 27 diagnosticos para zero.
- O typecheck global caiu de 2.265 para 2.238 diagnosticos, reducao liquida exata de 27, sem transferir falhas para o App Motorista ou cliente local.
- Permanecem iguais a exigencia de Empresa, a deteccao de duplicidade, a idempotencia e o bloqueio de troca da Empresa proprietaria.
- Prova de entrega, ocorrencia, devolucao, campos congelados e permissoes por transicao continuam preservados; a politica encerrou com 302 linhas.
- Nenhum dado, entidade, recurso Base44, banco ou HD externo foi acessado ou alterado.

Proxima frente: tipar `ordemProducaoPolicy.js`, politica compartilhada com 23 diagnosticos e 158 linhas. Telas grandes permanecem reservadas para lotes proprios.

### Contratos JSDoc - politica de Ordem de Producao

Lote concluido em 2026-09-14 na politica compartilhada de Ordem de Producao, sem alterar criacao, apontamento, transicao de status, liberacao para expedicao ou exclusao protegida.

- Contratos locais descrevem OP, apontamento, opcoes de criacao/atualizacao e acoes de status sem `any`, `ts-ignore` ou desativacao de `checkJs`.
- O typecheck isolado de `ordemProducaoPolicy.js` passou de 23 diagnosticos para zero.
- O typecheck global caiu de 2.233 para 2.209 diagnosticos, reducao liquida de 24, incluindo um diagnostico removido de consumidor.
- Permanecem iguais a exigencia de Empresa, o isolamento por Empresa, a idempotencia por Pedido, o congelamento apos finalizacao e as permissoes por transicao.
- Apontamento continua exigindo quantidade ou peso, e expedicao continua liberada somente por conferencia ou conclusao integral; a politica encerrou com 184 linhas.
- Nenhum dado, entidade, recurso Base44, banco ou HD externo foi acessado ou alterado.

Proxima frente: tipar `pedidoFaturamentoPolicy.js`, politica compartilhada com 23 diagnosticos. Telas grandes e `localBase44Client.js` permanecem reservados para lotes proprios.

### Contratos JSDoc - politica de faturamento do Pedido

Lote concluido em 2026-09-14 na politica compartilhada de faturamento, sem alterar calculo, persistencia de Nota Fiscal, credito ou movimentacao de estoque.

- Contratos locais descrevem Pedido, Cliente, movimentos, opcoes de leitura/faturamento e metadados de erro sem `any`, `ts-ignore` ou desativacao de `checkJs`.
- O typecheck isolado de `pedidoFaturamentoPolicy.js` passou de 23 diagnosticos para zero.
- O typecheck global caiu de 2.209 para 2.182 diagnosticos, reducao liquida de 27, incluindo quatro diagnosticos removidos dos consumidores.
- Permanecem iguais o faturamento parcial, a exclusao de notas canceladas, o bloqueio de sobrefaturamento, a consulta de credito fail-closed e a idempotencia do movimento de estoque.
- Nenhum dado, entidade, recurso Base44, banco ou HD externo foi acessado ou alterado.

Proxima frente P0: tipar `estoqueMovimentoPolicy.js`, politica compartilhada de Estoque com 22 diagnosticos. `iaTransversalPolicy.js` permanece posterior por pertencer a P2.

### Contratos JSDoc - politica de movimentacao de Estoque

Lote concluido em 2026-09-14 na politica compartilhada de movimentacao, sem alterar calculo de saldo, inventario, transferencias ou persistencia do historico.

- Contratos locais descrevem movimento, Produto, configuracao, escopo e metadados de erro sem `any`, `ts-ignore` ou desativacao de `checkJs`.
- O typecheck isolado de `estoqueMovimentoPolicy.js` passou de 22 diagnosticos para zero.
- O typecheck global caiu de 2.182 para 2.160 diagnosticos, reducao liquida exata de 22, sem transferir falhas para o cliente local.
- Permanecem iguais o bloqueio de saldo negativo sem politica, a exigencia de origem e Empresa, o isolamento de Produto por Empresa/Grupo e a idempotencia por documento.
- Inventario continua aplicando saldo absoluto, transferencias preservam direcao e o historico de estoque continua protegido contra exclusao.
- Nenhum dado, entidade, recurso Base44, banco ou HD externo foi acessado ou alterado.

Proxima frente P0: selecionar no ranking atualizado a proxima politica operacional de maior impacto, mantendo `iaTransversalPolicy.js` para P2 e `marketplacePedidoPolicy.js` para P1.

### Contratos JSDoc - formulario de Inventario

Lote concluido em 2026-09-14 no formulario existente de Inventario, sem alterar contagem, aprovacao, aplicacao de ajustes ou persistencia.

- Contratos locais descrevem o estado do Inventario, dados resumidos de auditoria, propriedades do componente e opcoes de salvamento sem `any`, `ts-ignore` ou desativacao de `checkJs`.
- O typecheck isolado de `InventarioForm.jsx` passou de 20 diagnosticos para zero.
- O typecheck global caiu de 2.160 para 2.140 diagnosticos, reducao liquida exata de 20, sem transferir falhas para consumidores.
- Permanecem iguais o contexto obrigatorio, o RBAC separado para salvar e aprovar, a confirmacao de estados sensiveis e a aplicacao backend dos ajustes.
- Auditoria de sucesso/falha, protecao contra duplo salvamento e bloqueio de aprovacao sem registro persistido continuam preservados.
- Nenhum dado, entidade, recurso Base44, banco ou HD externo foi acessado ou alterado.

Proxima frente P0: refatorar com seguranca e tipar `RecebimentoTab.jsx`, tela existente de Estoque com 527 linhas e 22 diagnosticos, preservando seu contrato publico e fluxo operacional.

### Refatoracao e contratos - Recebimento de Estoque

Lote concluido em 2026-09-14 no fluxo existente de Recebimento, sem criar rota, tela, entidade ou operacao paralela.

- `RecebimentoTab.jsx` caiu de 527 para 319 linhas; o formulario legado oculto e seus manipuladores foram extraidos para `RecebimentoLegacyDialog.jsx`, componente auxiliar privado com 323 linhas e o mesmo ponto de uso.
- A extracao preserva campos, controles, acoes RBAC e o estado oculto `open=false`; nenhuma funcionalidade legada foi excluida.
- Contratos JSDoc descrevem recebimentos, itens, ordens e produtos sem `any`, `ts-ignore` ou desativacao de `checkJs`.
- O typecheck isolado dos arquivos do lote passou de 22 diagnosticos para zero; o global caiu de 2.140 para 2.118, reducao liquida exata de 22.
- O helper existente de Estoque agora normaliza os aliases ativos/legados de numero, NF e responsavel; a mutacao tambem preserva `descricao` ou `produto_descricao` do item.
- Permanecem iguais o contexto obrigatorio, o RBAC de criacao, a idempotencia de movimentos, a atualizacao da Ordem de Compra e a auditoria do recebimento.
- Nenhum dado real, entidade remota, banco ou HD externo foi acessado ou alterado.

Proxima frente P0: refatorar e tipar `ConfiguracaoSeguranca.jsx`, tela existente de Seguranca com 943 linhas e 21 diagnosticos, em lote proprio.

### Refatoracao e contratos - Configuracao de Seguranca

Lote concluido em 2026-09-14 na tela existente de configuracao de seguranca, sem criar rota, modulo ou fluxo paralelo.

- `ConfiguracaoSeguranca.jsx` caiu de 943 para 362 linhas; as abas JWT, Sessoes, MFA e Senhas foram extraidas como componentes controlados entre 106 e 252 linhas.
- Normalizacao, defaults e validacao foram extraidos para `configuracaoSegurancaPolicy.js`, policy pura de 116 linhas reutilizada pela tela e pelos testes.
- Estado, consulta, RBAC, confirmacao, persistencia, espelhamento e auditoria permanecem centralizados no componente original.
- O contrato JSDoc de `persistOperationalAudit` foi completado para refletir os campos ja aceitos, sem alterar seu comportamento.
- O typecheck dos arquivos do lote passou de 21 diagnosticos para zero; o global caiu de 2.118 para 2.090, reducao liquida de 28 incluindo consumidores da auditoria.
- Defaults seguros e rejeicao de token curto, senha fraca e poucas tentativas de login receberam teste focado.
- Nenhum dado, configuracao remota, banco ou HD externo foi acessado ou alterado.

Proxima frente P0: refatorar e tipar `GestaoUsuariosAvancada.jsx`, tela existente de acessos com 614 linhas e 16 diagnosticos, em lote proprio.

### Refatoracao e contratos - Gestao avancada de usuarios

Lote concluido em 2026-09-14 na gestao existente de usuarios e acessos, sem criar tela, rota, entidade ou fluxo paralelo.

- `GestaoUsuariosAvancada.jsx` caiu de 614 para 306 linhas; os cinco cards e a barra de acoes foram extraidos para `UserAccessFormSections.jsx`, componente controlado de 351 linhas.
- Sanitizacao e estado inicial foram extraidos para `gestaoUsuarioPolicy.js`, policy pura de 80 linhas reutilizada pelo orquestrador, pela interface e pelos testes.
- Estado, contexto Grupo/Empresa, resolucao das empresas permitidas, mutacao, RBAC e auditoria permanecem centralizados no componente original.
- O typecheck do fluxo passou de 16 diagnosticos para zero; o global caiu de 2.090 para 2.074, reducao liquida exata de 16.
- Testes cobrem sanitizacao de texto/telefone, limite financeiro, normalizacao de empresas e permanencia da acao protegida de salvar.
- Nenhum usuario, permissao, configuracao remota, banco ou HD externo foi acessado ou alterado.

Proxima frente P0: refatorar e tipar `ArmadoPadraoTab.jsx`, fluxo Comercial existente com 805 linhas e 65 diagnosticos, em lote proprio.

### ERP-SITE-01 - Fundacao S2S do Site CPA

Nova prioridade autorizada em 2026-09-13: executar primeiro no ERP os 12 contratos Site CPA, sem alterar o repositorio do Site ate a homologacao da camada ERP.

- O gateway existente `legacyIntegrationsMirror` sera preservado como entrada unica e versionada.
- A origem tecnica canonica externa e `SITE_CPA`; a origem interna legada `site` continua preservada nos fluxos atuais.
- Grupo e Empresas autorizadas sao vinculados no servidor, nunca confiados ao navegador.
- Token dedicado, HMAC, timestamp, nonce, correlacao, idempotencia, rate limit persistente, auditoria e healthcheck sao obrigatorios.
- CPA Ferro e Aco e a Empresa padrao; 3Z LTDA exige selecao permitida e validacao no mesmo Grupo.
- Os dados atuais do Site serao tratados posteriormente por staging e reconciliacao, sem sobrescrita automatica e sem transformar carrinho em pedido.
- Provedor de pagamento permanece pendente; nenhuma integracao simulada podera declarar pagamento real.

O contrato tecnico detalhado e o andamento dos lotes ficam no plano existente `docs/PLANO_CPA_B2B_MARKETPLACE_ERP.md` e em `STATUS_DO_PROJETO.md`.

### ERP-SITE-02 - Cliente e conta empresarial

- siteClienteResolve reutiliza Cliente, ContatoB2B, enderecos incorporados, vendedor responsavel e SolicitacaoAprovacao.
- O CNPJ tem validacao de digitos; e-mail, telefone e nome nao sao chaves mestras.
- Dados somente sao liberados para Site user com vinculo aprovado no mesmo Grupo e Empresa.
- Cliente ausente, endereco novo e primeiro administrador nao geram cadastro ou privilegio automatico.
- CUSTOMER_RESOLVE e a unica capability de Cliente pronta; Catalogo permanece como proximo lote separado.

### ERP-SITE-03 - Catalogo oficial

- siteCatalogoList reutiliza Produto, CatalogoWeb, GrupoProduto, UnidadeMedida, TabelaPreco e TabelaPrecoItem.
- O contrato e paginado, aceita delta por updatedSince e preserva inativacoes para sincronizacao.
- Preco empresarial exige Cliente e vinculo aprovados; falha de tabela nunca autoriza fallback indevido.
- Estoque e minimizado em estados de disponibilidade, sem quantidade exata.
- Sellable e quoteRequired sao calculados no ERP; custo, margem e regras internas nao saem do backend.
- CUSTOMER_RESOLVE e CATALOG_READ ficam ready; Pedido permanece no lote seguinte.

### ERP-SITE-04 - Pedido e checkout

- `sitePedidoCreate` reutiliza Pedido, itens incorporados, Cliente, catalogo/preco, estoque, FormaPagamento, enderecos, vendedor e referencias existentes.
- Cliente, papel empresarial e ownership sao revalidados pelo ERP-SITE-02; Produto, preco, unidade, spec, minimo, multiplo e venda direta sao revalidados pelo ERP-SITE-03.
- Preco ou estoque alterados impedem a criacao e retornam conflito seguro; total, desconto, frete, vendedor e condicao enviados pelo Site nao sao autoridade.
- Pedido nasce aguardando aprovacao, com pagamento pendente e sem reserva antecipada. Entrega mantem frete pendente; retirada segue o fluxo oficial sem frete.
- O ledger S2S e o `externalOrderId` com hash canonico impedem duplicidade e conflito de payload.
- CUSTOMER_RESOLVE, CATALOG_READ e ORDER_CREATE ficam ready; pagamento, cancelamento, edicao e negociacao permanecem em lotes separados.

### ERP-SITE-05 - Orcamento e negociacao

- `siteOrcamentoCreate`, `siteOrcamentoGet`, `siteNegociacaoGet` e `siteNegociacaoResponder` reutilizam `Pedido`/Orcamento, itens, Cliente, catalogo, vendedor, enderecos, `Oportunidade` e `SolicitacaoAprovacao` existentes.
- Itens oficiais sao revalidados pelo ERP; itens customizados ficam em revisao humana sem Produto ou preco ficticio.
- A proposta possui versao, validade, snapshot imutavel e timeline publica. Respostas do cliente nao alteram diretamente preco, desconto, frete ou condicao.
- Concorrencia usa `expectedProposalVersion`; repeticoes usam `externalResponseId`, ledger e identificador externo idempotentes.
- O aceite reutiliza `sitePedidoCreate`, revalidando preco e estoque e mantendo o novo Pedido sem pagamento confirmado.
- Frete pendente, customizacao, expiracao ou dependencia indisponivel bloqueiam o aceite.
- CUSTOMER_RESOLVE, CATALOG_READ, ORDER_CREATE, QUOTE_CREATE e NEGOTIATION ficam ready; pagamento real permanece bloqueado para o ERP-SITE-06.

