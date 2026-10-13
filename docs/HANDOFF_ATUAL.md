## CODEX LEGADO — confirmacao e resolucao da policy canonica (2026-10-13)

- Lote delimitado na branch local `codex/typecheck-guard-context-20261013`: `confirm-dialog.jsx`, `usePermissions.jsx` e testes de contrato/harness, comunicado ao Comercial sem editar UserContext, erpHttpSession.js ou Pedido. Descricao realmente opcional do dialogo, callback/ref booleano do hook e contrato dos callbacks documentados; JSX emitido do dialogo permanece identico. Nao declarar cancelamento do hook corrigido apenas por tipagem.
- Import do hook passou a usar nome sem extensao, ja suportado pelo bundler; teste com resolver TypeScript comprova mesmo arquivo entry.ts canonico. Nenhuma alteracao em jsconfig, regra, baseline ou autoridade de permissoes. Cinco falhas reais da primeira suite vieram do harness com mock registrado apenas pelo nome antigo; resolver local foi ajustado exclusivamente para os dois nomes canonicos, mantendo assercoes RBAC/sessao e rejeicao de dependencias desconhecidas. Nao esconder falhas ou inventar nova policy.
- Teste de emissao cobre onze wrappers; fixture aceita props/refs validos, promise booleano e mantem nove rejeicoes de contratos invalidos. Linux Node22/Python/git com candidatos anteriores: audit, 934/934 testes, lint, build e diff-check PASS; typecheck FAIL exit2, 1.483/238 -> 1.478/236, cinco diagnosticos removidos e zero novos. Desde 1.658, 180 eliminados. Sem commit/push de codigo enquanto global falhar.
- Achados funcionais separados, nao mascarados: DataTable recebe callbacks bulk export/delete mas nao os inclui no objeto audited, portanto as acoes nao sao ligadas; corrigir exige lote com permissoes, auditoria, contexto e reversao, sem ativar exclusao silenciosamente. useConfirm tem handleCancel mas nao o liga ao fechamento/cancelamento, podendo deixar promise pendente; nenhuma chamada externa ao hook foi encontrada no recorte. Preservados para correcao comportamental especifica, sem apagar export ou alegar pronto.
- Pacote acumulado de vinte arquivos somente codigo/testes e patch privados recuperaveis/conferidos; reverse-check local PASS. Original/dados/staging intactos. Checkpoint exclusivamente documental na #322 com diff-check; novo HEAD/CI pendente. Proximo P0: contratos restantes e defeitos funcionais comprovados em lotes seguros/coordenados, sem relaxar gate. Importacao operacional zero, nenhum deploy/merge/schema operacional.

## CODEX LEGADO — menus, paineis e contratos auditados (2026-10-13)

- Lote local de passivo na branch `codex/typecheck-guard-context-20261013`: reservados ContextMenu, Sheet, Resizable, RadioGroup auditado, `sensitiveActionGuardPolicy.js` e teste de contracts existente; comunicado ao Comercial sem tocar Pedido/Central/formularios. DropdownMenu e Tooltip ja tipados permaneceram intocados. Nenhuma nova funcionalidade ou modulo paralelo.
- Apenas JSDoc: props/ref das bibliotecas, `inset`, lados suportados de Sheet, direction obrigatoria do painel, value obrigatorio dos radios e tres campos de contexto explicito ja implementados no guard. Wrapper auditado preserva data-action/data-permission/data-toast-success e tratamento do marker existente; nao altera auditoria, hasPermissionKey, callback ou validacao backend. Nao usar o contrato frontend como autorizacao.
- O teste de emissao cobre agora dez wrappers UI contra HEAD original, JS identico sem comentarios. Fixture sem supressoes aceita props/refs reais e mantem oito rejeicoes esperadas (tipos invalidos, ref errado, value/direction ausentes e lado/orientacao invalidos). Seis testes existentes de guard/RBAC local PASS, incluindo preferencia do contexto explicito e fail-closed sem backend allowed=true.
- Copia privada Linux Node22/Python/git da base ef4b14f2 com candidatos anteriores: audit, 933/933 testes, lint, build e diff-check PASS. Typecheck segue FAIL exit2, 1.528/246 -> 1.483/238, 45 diagnosticos removidos e zero novos neste lote consolidado; 175 eliminados desde 1.658. Ainda nao autoriza commit/push de codigo, conforme decisao expressa do proprietario.
- Pacote acumulado de dezessete arquivos somente codigo/testes e patch dos existentes privados recuperaveis/conferidos, reverse-check local PASS. Mantidos pacotes anteriores, original, staging e filas financeiras. Publica-se somente checkpoint sanitizado pela #322 com diff-check; novo HEAD/CI pendente. Importacao operacional zero, sem merge/deploy/schema aplicado.
- Proximo P0: continuar contratos compartilhados restantes e reparar consumidores somente por incompatibilidade real demonstrada; preservar required props e runtime. Pilotos/importador/mapa persistente permanecem candidatos separados, sem repetir ensaios suficientes ou pedir excecao ja recusada.

## CODEX LEGADO — contratos dos primitives compartilhados (2026-10-13)

- Ordem Comercial encaminhada ao ambiente proprio; resposta confirmou arquivos livres e reserva limitada a Pedido/Comercial, com primeira acao concreta de comparar bases Expedicão/#328. Nao tratar a comparacao ou a CI isolada como composicao implantada; Legado nao alterou arquivos dessa frente. Decisao de corrigir passivo antes de publicar codigo continua, sem excecao ou nova pergunta.
- Lote coeso de tipagem na branch local `codex/typecheck-guard-context-20261013`: reservados `src/components/ui/alert-dialog.jsx`, `accordion.jsx`, `avatar.jsx`, `progress.jsx`, `scroll-area.jsx`, `separator.jsx` e `tests/alert-dialog-types.test.js`. Reutilizado padrao React/Radix ja presente em Dialog; Tooltip ja tinha contrato correto e permaneceu intocado. Somente JSDoc de props/ref, sem alterar classes, eventos, estilo ou logica; Progress segue div com seu contrato real, nao foi substituido por outra implementacao.
- Defeito reproduzido antes da correcao: fixture de AlertDialog rejeitava props/refs validos e exigia className nos wrappers. Testes agora confrontam JS emitido contra HEAD original nos seis arquivos (igualdade integral sem comentarios) e compilam casos positivos/negativos pelos tipos reais: ref/className/orientation invalidos e AccordionItem sem value continuam rejeitados. Validacao focada usa diagnostics da fixture; typecheck global continua executado sem filtros ou supressoes. Falha inicial do teste de emissao em imagem minima sem git foi resolvida com prerequisitos, nao mudando expectativa.
- Linux Node22/Python/git, copia privada ef4b14f2 com candidatos anteriores preservados: audit, 933/933 testes, lint, build e diff-check PASS. Typecheck FAIL exit2, reduzido de 1.610/262 para 1.528/246, 82 diagnosticos removidos e zero novos; 130 eliminados desde base 1.658. Nao declarar typecheck verde, homologacao visual no navegador ou publicacao de codigo: prova foi equivalencia do emit/contrato e suite, nao deploy.
- Codigo/testes de passivo (doze arquivos no pacote acumulado) e patch dos existentes privados recuperaveis/conferidos; reverse-check local PASS. Nenhum commit/push de codigo permitido enquanto global falhar. Checkpoint somente documental na #322 com diff-check; novo HEAD/CI a conferir. Original, filas financeiras, staging e worktrees alheios preservados; importacao operacional zero.
- Proximo P0: continuar contratos compartilhados restantes em arquivos coordenados, preservando required props genuinos e contratos de API/negocio; nao enfraquecer tipos ou tests para esconder defeitos. Worker relacional e mapa persistente/revisao continuam candidatos privados; provas ja suficientes nao devem ser repetidas sem regressao.

## CODEX LEGADO — contratos IA no passivo de typecheck (2026-10-13)

- Mantida decisao do proprietario: corrigir passivo antes de publicar codigo, nenhuma excecao. Na branch local `codex/typecheck-guard-context-20261013`, reservados policy IA/teste e dois helpers de extracao; Comercial foi avisado, sem tocar Pedido/Central/formularios ou branches do Cursor. Lote corrige contratos existentes, nao inicia funcionalidade P2 nova.
- Reutilizada `iaTransversalPolicy.js`: parametros opcionais de invocacao/contexto/anomalia recebem contratos JSDoc precisos; contas/ordenacao de Date usam getTime, sem mudar faixas, defaults ou politica sugestao-only. Para cumprir Regra-Mae sobre arquivo grande, extraidos `iaInvocationPolicy.js` (guards/contexto/sanitizacao/stamp compartilhados) e `iaFinancePolicy.js` (rotinas financeiras puras); exports antigos preservados e testados como as mesmas referencias. Arquivo principal ficou em 492 linhas. Nenhum endpoint, fonte de dados ou modulo ERP paralelo.
- IA focado 11/11 PASS, tres testes novos cobrem identidade dos exports, limites 25/35 dias/data invalida e ordenacao de recompra com data invalida. Contexto/RBAC/MFA anterior 21/21 PASS. Copia privada Linux Node22/Python/git da base ef4b14f2, mantendo a ponte anterior para validar composicao: audit, 931/931 testes raiz, lint, build e diff-check PASS. Typecheck continua FAIL exit2: 1.647/263 -> 1.610/262, 37 diagnosticos adicionais removidos e nenhum novo; desde a base inicial 1.658, 48 eliminados. Nao declarar typecheck verde ou associar estes resultados a codigo publicado.
- Cinco arquivos de codigo/testes do passivo e patch dos existentes preservados privadamente, transferencia do pacote conferida e reverse-check local PASS. Sem commit/push de codigo conforme AGENTS. Helper novo e necessario a extracao, nao alternativa ao modulo existente; clientes e interfaces continuam importando a facade antiga.
- Checkpoint somente documental na PR #322; CI anterior a02895ce SUCCESS, run4314, novo HEAD pendente. Proximo P0: corrigir diagnosticos de contratos compartilhados restantes, em arquivos coordenados e sem supressoes/baseline frouxo. Original/dados financeiros privados preservados; nenhuma importacao operacional, merge ou deploy.

## CODEX LEGADO — decisao de typecheck e componentes financeiros (2026-10-13)

- Decisao expressa recebida do proprietario: corrigir o passivo global antes de publicar codigo. A proposta anterior de excecao NAO foi autorizada. Verificador, ponte, patches backend e harnesses continuam privados/locais; nao voltar a solicitar a mesma decisao nem interpretar continuar como excecao. Regra de AGENTS 18.1 item 3 preservada.
- Primeira correcao concreta do passivo em branch/worktree separado `codex/typecheck-guard-context-20261013`, base `ef4b14f2`: reservado `base44/functions/_lib/security/entityGuardPolicy/entry.ts`. Declarado contrato de onze aliases de entrada ja consumidos por normalize/validateGuardContext, campos unknown de fronteira, sem alterar normalizacao/RBAC/comportamento e sem supressoes ou mudanca de baseline. Comercial foi avisado da reserva; seus arquivos Pedido/Central/formularios nao foram tocados.
- Testes de contexto, isolamento/RBAC/MFA: 21/21 local e Node22/Linux. Na copia privada de validacao com candidato anterior preservado, audit, suite raiz 928/928, lint, build e diff-check PASS; typecheck ainda FAIL exit2, mas caiu de 1.658/264 arquivos para 1.647/263: onze diagnosticos removidos, zero novos e zero restantes nessa policy. A primeira execucao na imagem minima falhou em tres testes por Python/git ausentes; prerequisitos corrigidos e suite repetida sem alterar expectativas. Correcao de codigo sem commit/push; patch privado recuperavel e reverse-check local PASS. Isso inicia, nao conclui, o passivo global.
- Nova lacuna financeira comprovada no catalogo recebido: staging antigo nao tinha componentes de CaixaFormasRecebimento01 nem campos complementares de credito/desconto. Sem redescobrir/reattach original, consulta READ_ONLY na copia SQL existente extraiu somente complemento: 80.750 linhas de Caixa01, 49.601 parcelas e 13.476 formas de recebimento. Manifesto/arquivos novos privados transferidos por SSH autenticado, hashes conferidos, acesso local restrito e VPS 700/600. Servico voltou a Stopped/Manual; banco original e staging anterior intactos.
- Paridade com recorte anterior: todas as chaves e oito campos antigos de caixa e sete de parcela coincidem nas 80.750/49.601 linhas. Componentes novos possuem zero pais ausentes. Para as 1.233 diferencas caixa/cartao, todos os pais possuem mais de uma forma explicita e a soma dos componentes recebidos coincide exatamente com o valor pai. Em 1.217, um unico componente coincide com soma das parcelas; nos outros dezesseis a identidade do componente cartao permanece em revisao. Comparacao Decimal dos valores de origem, sem completar diferencas, ajustar saldo ou excluir componentes.
- Fila privada derivada de 1.233 linhas guarda fingerprint/valores originais, componentes brutos e classificacao factual 1.217/16; integridade/FK conferidas e efeitos autorizados zero. Fonte historica/hash preservados, fila anterior nao substituida. A correspondencia numerica e a multiplicidade de formas apoiam a investigacao de pagamentos compostos, mas nao aprovam semantica contabil/fiscal, baixa, saldo devido, estorno ou cobranca. Identificar contratos das formas/Empresa antes de uso operacional; historico continua apenas consultavel no Grupo.
- Checkpoint sanitizado exclusivamente documental, diff-check PASS, PR #322. SHA anterior `95980b08fc3642347567e06fdaf19b5b7cf320f8` CI SUCCESS, run4304; novo HEAD requer nova CI. Proximo P0: continuar correcao dos contratos que concentram diagnosticos sem tocar arquivos reservados, mantendo codigo recuperavel; financeiro segue investigacao sem efeitos operacionais. Importacao operacional zero.

## CODEX LEGADO — ponte revisavel no consumidor existente (2026-10-13)

- Comercial confirmou recebimento da ordem autonoma e primeira acao no ambiente proprio: verificar idempotencia existente no backend Pedido antes de corrigir lacuna entre abas/reload; composicao #320 permanece coordenada. Legado nao editou seus arquivos. Nao confundir esse recebimento com entrega das ondas Comercial.
- Base remota/local do consumidor conferida: `ef4b14f2c8aa94ceed07a867905b50ef378c7e38`, branch publicada `codex/legado-cliente-lifecycle-atomico-20261011`. Branch local reservada `codex/legado-importador-canonico-20261013`, worktree separado. Arquivos assumidos exclusivamente por Legado: `scripts/legado/consumir-lote-staging.mjs`, `scripts/legado/persistencia-endereco-legado.mjs`, `tests/legado-consumir-lote-staging.test.js`; tres mudancas de codigo sem commit/push. Preservadas todas as branches/worktrees anteriores e o trabalho do Cursor.
- Reuso: consumidor ja possui persistencia canonica de Cliente/Produto, mantida sem reimplementacao. Helper novo extrai a logica de endereco do prototipo privado, inexistente no consumidor, mantendo export no modulo existente e servicos/RBAC/auditoria canonicos. Nao cria endpoint, modulo ERP ou schema operacional. Exige port transacional que compartilhe servico/mapa; adapter PostgreSQL do ensaio fica privado, contrato persistente de producao e revisao ainda pendentes.
- Helper registra bruto, payload transformado e versao da transformacao no mapa. Cobre create/replay, atualizacao com fingerprint/snapshot anteriores e mesmo ID, ambiguidade, bloqueio de edicao externa e reversao seletiva. Os 19 testes focados passaram (seis novos). PostgreSQL/GoTrue real isolados passaram usando o arquivo candidato efetivo: dez enderecos, dois workers com um create/um replay, falha servico->mapa revertida, atualizacao/replay, RBAC/perfil e reversao nove/um protegido/tres fixtures preservadas. Dez mestres mantidos ate descarte para preservar referencias; nao declarar reversao integral desse cenario nem implantacao da ponte.
- Checks em copia privada Linux da base exata, Node 22 com Python/git: npm ci, audit, suite raiz 928/928, lint e build PASS; typecheck FAIL exit 2, 1.658 erros em 264 arquivos (frontend e policy Base44). Esses arquivos, jsconfig/manifests estao identicos ao HEAD; nenhuma ocorrencia nos tres arquivos do lote. Contagem anterior 1.633/260 pertence a outra base e nao deve substituir esta. Diff-check Windows PASS; Linux falhou inicialmente em CRLF transferidos e passou apos normalizar somente finais de linha na copia de validacao, sem alterar regras/baseline.
- AGENTS 18.1 item 3 proibe commit/push com validacoes falhas; secoes 16.2/16.4 exigem typecheck e nao mascarar baseline. Decisao concreta apresentada ao proprietario: corrigir passivo global antes de publicar, ou autorizar expressamente ajuste restrito aos tres arquivos desta ponte e dois arquivos do verificador, mantendo evidencia vermelha/revisao e gates operacionais. Nenhuma resposta/excecao inferida ou aplicada. Os quatro patches backend antigos e demais harnesses nao estao incluidos nessa proposta.
- Pacote privado adicional de nove arquivos somente de codigo/testes e patch dos dois arquivos existentes preservados na VPS, hash de transferencia conferido; helper novo preservado no pacote e em seus caminhos originais. Nao contem JSON/SQLite/CSV/dados reais. Documentacao sanitizada publicada pela PR #322; codigo candidato permanece local e privado, nao publicado/implantado/revisado independentemente.
- Reconciliacao read-only de integridade: staging 18.458 Clientes, 790 Fornecedores, 1.208 Produtos, gates com 4.437/271/14 quarentenas respectivamente; quick_check OK, import_authorized zero. Mestres escalares 18.458 nao comprovam todas as dependencias; API100 identidade de teste e API10/worker10 GoTrue real sao coortes sobrepostas, nao contagens somaveis. Casos documentais/codigos possuem planos/gates derivados, sem alvo operacional aprovado. Produtos/unidades/classes, Fornecedor e historicos seguem trilhas independentes. Importacao operacional zero.
- CI do checkpoint anterior `3908b4f453cc2f9f1c96fbe2a1ff31c284ce97a4` SUCCESS, run 4302; novo HEAD documental requer nova CI. Proximo requisito: decisao de publicacao/precondicao, revisao do contrato transacional/mapa e preparo no destino aprovado com Auth/RBAC, backup recuperavel e reconciliacao/reversao. Original/segredos preservados; recursos descartaveis removidos.

## CODEX LEGADO — mestre Cliente e mapa atomicos (2026-10-13)

- Lacuna concreta corrigida apenas no prototipo privado: o harness anterior criava Cliente pela API e gravava mapa depois, em outra transacao. Reutilizado o worker existente com adaptador transacional comum, ClienteService/repositorio/reserva/auditoria canonicos e middleware de identidade real; sem novo endpoint ou tabela no banco operacional. Mapas deste ensaio existem somente no PostgreSQL descartavel.
- Dez Clientes reais preparados anteriormente foram criados pelo servico canonico, nao pelo endpoint create neste cenario, e consultados/validados pela API; dez enderecos pelo fluxo API existente. Campos mapeados reabertos 10/10, create audits 10/10, edicao/reabertura, Grupo/RBAC e GoTrue real passaram. Nao apresentar chamadas diretas ao servico como POST HTTP de importacao.
- Duas execucoes concorrentes da mesma origem aguardaram o lock e produziram um create/um replay, mesmo ID/mapa. Falha injetada apos criar e antes de mapear reverteu Cliente, reserva de codigo, auditoria e mapa. Repeticao dos dez criou zero linhas novas. Fingerprint/payload e snapshot protegem origem e destino; nao adotar registro externo por documento/codigo automaticamente.
- Reversao enquanto havia endereco ativo foi bloqueada. Apos inativar dependencias do lote pelo fluxo canonico, nove Clientes foram inativados seletivamente; um editado externamente foi preservado, com replay/reversao bloqueados. Repetir reversao foi no-op e reimportar mestre revertido foi bloqueado. O Cliente protegido foi descartado apenas com o banco temporario, sem afirmar reversao integral por API.
- Regressao do worker de enderecos com o adaptador comum e GoTrue real tambem PASS: concorrencia/replay, rollback atomico, perfil desativado, atualizacao controlada, nove reversoes e protecao de um endereco externo/ tres fixtures. Ensaios de mestre e endereco seguem coortes separadas; nao declarar uma unica transacao para todo o grafo. Syntax-check Node PASS; recursos e segredos efemeros removidos.
- Codigo privado recuperavel em pacote adicional de seis arquivos, sem dados reais, com transferencia conferida; original/staging/gates preservados. Typecheck global segue impedindo publicacao de codigo conforme AGENTS; checkpoint somente documental com diff-check. CI do SHA anterior `62d728a23a7c897f86065dd16318e1c6300e9373` SUCCESS, run 4300; revalidar novo HEAD.
- Importacao operacional zero. Proximo P0 concreto: resolver precondicao de publicacao/revisao do importer e contrato persistente do mapa, depois preparar lote no destino aprovado com Auth/RBAC, backup recuperavel e reconciliacao/reversao. Nenhum merge/deploy/gate foi dispensado; prototipo nao e importador implantado.

## CODEX LEGADO — worker e identidade real em ensaio conjunto (2026-10-13)

- Branch/arquivos reservados: Legado em `codex/legado-historico-audit-20261013`; ampliados somente `pilot.mjs`, `address-worker.mjs`, `worker-scenario.mjs` e `run-real-auth.py` no diretorio privado ignorado. Reutilizados middleware Supabase, servicos, repositorios, RBAC e auditoria canonicos, sem endpoint/modulo paralelo nem alteracao de runtime publicado.
- Worker privado valida token contra GoTrue real e perfil ERP pelo middleware canonico a cada transacao, apos lock do lote, com executor PostgreSQL da propria transacao. Requer importar e permissoes canonicas da acao; nao usa actor informado como prova de identidade. Perfil desativado foi bloqueado sem mapa/auditoria novos e perfil reativado permitiu continuidade. Permissao importar ausente permaneceu bloqueada.
- Dez pares reais anteriormente comprovados passaram ensaio conjunto: mestre criado/reaberto pela API, endereco pelo worker/servico, concorrencia com um create e um replay no mesmo ID/mapa, repeticao integral com zero linhas novas, falha entre servico e mapa com rollback de local/finalidade/auditoria/mapa, ambiguidade rejeitada e atualizacao controlada mantendo ID. Texto bruto preservado nos dez mapas.
- Reversao seletiva inativou nove enderecos, preservou um editado externamente e tres fixtures externas sem alteracoes. Dez mestres permaneceram ativos enquanto o banco descartavel existiu para proteger referencias; foram descartados com os containers, nao revertidos integralmente por API neste cenario. Nao confundir a prova anterior de reversao integral do lote simples com este cenario de conflito protegido. Original/staging/gates intocados, importacao operacional zero.
- GoTrue/PostgreSQL/Node/rede descartaveis removidos e segredos efemeros eliminados. Insumos/logs privados; seis arquivos de codigo sem dados reais preservados em pacote privado recuperavel adicional, sem substituir o anterior. Syntax-check Node PASS e cenario conjunto PASS; codigo continua privado pelo bloqueio global de typecheck, sem excecao aplicada ou revisao independente inventada. Publicacao deste checkpoint exclusivamente documental, `git diff --check` PASS.
- CI do checkpoint documental anterior `7346c703155a8d9ab531187f305ba414a2fef055`: SUCCESS, run 4298. Novo HEAD exige nova CI. Pendencias de carga: integrar/revisar importer e seu contrato de identidade, destino/Auth real aprovado, dependencias restantes, backup recuperavel, reconciliacao e gate operacional. Este ensaio nao implanta o prototipo nem homologa Auth do ambiente operacional.

## CODEX LEGADO — Auth real isolado no piloto relacional (2026-10-13)

- Responsavel: Legado, branch `codex/legado-historico-audit-20261013`, PR #322. Reutilizados harness privado, API/servicos/repositorios publicados e dez pares Cliente/endereco anteriormente confrontados com a extracao. Nenhum arquivo de runtime ou da frente Comercial/Cursor foi alterado.
- PostgreSQL descartavel recebeu as 24 migrations da base do piloto; GoTrue real `supabase/gotrue:v2.189.0` usou schema `auth`, rede Docker interna sem portas publicadas e usuarios/segredos efemeros exclusivos. O middleware canonico recebeu tokens reais, sem `authFetchImpl`; proxy HTTP privado apenas encaminhou `/auth/v1/user` ao GoTrue. Isso nao homologa Supabase/Auth/RBAC do destino operacional.
- Login e refresh de quatro identidades de teste passaram. API validou ausencia/token invalido (401), permissoes insuficientes e Grupo nao autorizado (403), registro de outro Grupo (404), duplicidade (409), desativacao do perfil ERP (403) e reativacao (200). Nao foi comprovada revogacao de access token por logout; desativacao de perfil e controle distinto.
- Dez Clientes e dez enderecos reais foram persistidos isoladamente e reabertos com campos mapeados; dez auditorias create de Cliente, edicao/reabertura de Cliente e endereco, retry do mapa com zero novas linhas e vinculo empresarial sintetico sem habilitacao operacional passaram. Reversao canonica deixou zero importados ativos; containers/rede removidos e arquivo de segredos efemeros eliminado. Nao houve importacao operacional, alteracao de gates ou atribuicao fiscal automatica.
- Falhas de infraestrutura corrigidas apenas no ensaio: reinicio inicial da imagem PostgreSQL e GoTrue buscando `schema_migrations.version` no schema publico; conexao de Auth com `search_path=auth` resolveu o conflito sem alterar migrations ou schema operacional. Logs, insumos e harness estao privados recuperaveis na VPS. Codigo permanece sem commit pelo bloqueio de typecheck global registrado; este lote publica somente documentacao sanitizada e passa `git diff --check`.
- Proximo requisito: integrar/revisar o worker e validar Auth/permissoes reais do destino canônico aprovado, antes de preparar/promover lote operacional. A prova de concorrencia do worker anterior permanece com identidade de teste; nao somar as duas provas como ensaio integrado. Decisao especifica de publicacao do verificador continua pendente, sem excecao aplicada.

## CURSOR — validação login API pós-secrets (2026-10-08)

| Fase | Estado |
|---|---|
| implantado | `68c311cc` |
| login API | **PASS** 200 (secrets Environment) |
| CPA/3Z IDs | CPA=`cccccccc-…` · 3Z=`c2c2c2c2-…` (mesmo group) |
| isolamento pedidos | **PASS** CPA 0 ≠ 3Z 3 |
| sugestao-vinculo #113 | **PASS** 200 + mescla proibida |
| browser UI Cadastros/Financeiro | em andamento |

Evidência: `docs/vps/evidence/browser-api-login-68c311cc-20261008.txt`.

## CODEX LEGADO — decisao de escopo dos mestres (2026-10-10)

- Decisao expressa do proprietario: Clientes, Fornecedores, Produtos de revenda e auxiliares compartilhados do legado pertencem ao Grupo CPA. Nao exigir divisao artificial de cada mestre entre CPA e 3Z. Preservar ID/codigo de origem, vinculos e registros existentes do ERP novo; nenhum seed ou substituicao em massa.
- Diretriz visual do proprietario para todo o ERP: manter o azul claro aprovado e evoluir o layout sem desfazer funcionalidades recentes. Capturas sao referencias de campos e experiencia, nao metas de contagem; listas vazias exigem diagnostico de contexto, permissao, API e banco antes de qualquer recuperacao.
- Recuperar auxiliares uteis do ERP novo anterior a VPS em trilha separada da carga de Clientes, Fornecedores e Produtos do ERP antigo. Comparar significado, conteudo, IDs, codigos numericos e referencias; preservar os atuais quando validos, sem renumeracao ou substituicao em massa.
- Comparacao read-only agregada de 10/10: o snapshot core pre-VPS local tem 15 Marcas, 91 Grupos de Produto, 15 Unidades, 11 Setores e 23 Centros de Custo; o PostgreSQL efetivo na VPS tem respectivamente 5, 4, 4 e 4 nas quatro tabelas existentes, sem tabela canonica de Centro de Custo neste recorte. Contagens sao versionadas, nao metas de restauracao. IDs do snapshot nao sao UUIDs do destino; 828 referencias internas atingem 85 Grupos de Produto e 828 atingem os 11 Setores. Nenhuma correspondencia por ID foi comprovada. Nomes sugerem somente duas Unidades univocas; outras duas sao ambiguas. Fazer matriz privada de conteudo/codigo/vinculos antes de qualquer recuperacao, sem alterar os registros atuais.
- Matriz privada v4 restrita ao Grupo CPA (nao usar os totais cross-tenant acima como alvo): 155 auxiliares pre-VPS classificados, cobrindo 15 Marcas, 91 Grupos de Produto, 15 Unidades, 11 Setores e 23 Centros de Custo. No Grupo CPA atual ha 4 Marcas, 3 Grupos, 3 Unidades e 3 Setores; Centro de Custo segue sem contrato canonico neste recorte. Quatro Unidades antigas possuem um candidato atual por nome e campo basico, mas duas disputam o mesmo alvo. Comparacao completa das regras de conversao mostrou zero equivalencias integrais: duas propostas divergem em `permite_conversao` e duas em `unidade_base_conversao`. Todas continuam em revisao; nenhuma pode ser mesclada por nome/codigo. Os demais 151 registros nao possuem match automatico seguro ou alvo canonico. A matriz com IDs, conteudo e referencias esta somente em arquivo `.local` ignorado no worktree Legado; nenhuma restauracao ou alteracao do PostgreSQL ocorreu. `is_sample=false` no snapshot nao prova uso operacional.
- Paridade read-only adicional dos Clientes candidatos: os 18.458 codigos constam da prova privada de consulta SQL; razao social e nome fantasia coincidem 18.458/18.458 apos normalizacao de acentos/espacos/caixa. O documento selecionado no staging corresponde ao mesmo campo CPF ou CNPJ da prova SQL em 18.458/18.458, sem ambos preenchidos. Isto comprova campos selecionados por codigo no recorte, nao a versao/hash da consulta historica nem a cadeia MDF -> extrator -> CSV; `HISTORICAL_CSV_LINEAGE_UNPROVEN` e os demais gates permanecem ativos. Nenhum valor, codigo individual ou hash foi publicado.
- Paridade ampliada read-only: os 790 Fornecedores candidatos aparecem na prova SQL privada, com razao social, nome fantasia e documento selecionado coincidentes 790/790 apos normalizacao. Os 1.208 Produtos de revenda candidatos aparecem na prova SQL, com descricao e unidade de origem coincidentes 1.208/1.208. Incluindo quarentenas, os conjuntos de codigos de 22.895 Clientes e 1.061 Fornecedores sao exatamente os da prova SQL. Dos 2.360 materiais SQL, 1.222 estao no staging principal (1.208 candidatos + 14 quarentenas) e os outros 1.138 correspondem exatamente a coorte privada de nao-revenda, sem sobreposicao. Isto e paridade de chaves/campos selecionados, nao prova completa da geracao historica dos CSVs ou autorizacao de carga; todos os gates permanecem.
- Ensaio de contrato, nao carga: PostgreSQL temporario sem rede e sem porta recebeu as 24 migrations canonicas; transacao com Cliente de Grupo sintetico confirmou insercao, retry sem duplicacao, edicao/consulta e rollback integral. Contagens finais `groups=0`, `clientes=0`; container e tmpfs removidos. Nenhum candidato real entrou no PostgreSQL, nenhum banco operacional foi alterado. Importador real, mapa de destino, proveniencia e gates permanecem pendentes.
- Piloto real minimo posterior, separado do ensaio sintetico: exatamente 1 Cliente candidato sem bloqueio individual adicional foi temporariamente carregado nas entidades canonicas de PostgreSQL descartavel sem rede, com codigo interno reservado, ID/codigo legados e procedencia preservados, mapa privado origem->ID destino, retry 0 novas linhas, edicao/reabertura e reconciliacao 1/1. Reversao verificada em nova conexao deixou 0 Grupo, 0 Cliente e 0 mapa; container removido. `import_authorized=0` nao foi alterado, nenhum dado real foi publicado e nada entrou no ERP operacional. Linhagem historica MDF->CSV, contrato de importacao concorrente/RBAC e liberacao de lote maior continuam pendentes.
- Fila Produto priorizada sem mutacao: 989 candidatos em 46 pares possuem codigo de unidade KG/UN ativo no Grupo CPA; 43 em 5 pares usam CX existente mas inativa; 176 em 22 pares dependem de unidade ausente ou alias. Nenhum par tem classe de destino aprovada, de modo que as tres coortes continuam bloqueadas para carga. Nao reativar CX, criar unidade ou converter alias automaticamente; revisar semantica, vinculo e aprovacao do crosswalk em staging privado.
- Piloto privado de escala posterior ao piloto unitario: 1.000 Clientes reais de coorte sem conflito individual foram testados temporariamente em PostgreSQL canônico sem rede. Mapa e campos reabertos 1.000/1.000, retry identico 0 novas linhas, fingerprint divergente detectado pelo executor antes de retry, edicao/reabertura 1/1 e reversao completa 0/0/0; container removido. O teste nao remove bloqueios de referencias opcionais, geracao historica MDF->CSV, aprovacao de destino ou importador operacional; `import_authorized=0` e carga operacional=0 permanecem. Executor e dados ficam em staging privado.
- Consolidar submodulos duplicados somente apos inventario de capacidades, consumidores, contratos, permissao e auditoria, com equivalencia testada. O Comercial 360 integra as informacoes dos modulos existentes; nao cria outra fonte de verdade.
- Historico nao fiscal pode ser consultado no Grupo. Quando a origem comprovar CPA ou 3Z, preservar e permitir filtro; empresa desconhecida deve aparecer como historico legado sem empresa identificada, nunca como titulo, saldo, baixa ou movimento de estoque operacional. Documento fiscal requer emitente/destinatario comprovado. Grupo nao e emitente fiscal.
- Staging privado derivado na VPS: 20.456 candidatos (18.458 Clientes, 790 Fornecedores, 1.208 Produtos) receberam apenas o escopo de Grupo aprovado; 4.722 quarentenas mantidas. Integridade, chaves e fingerprints conferidos na copia; 25.178 gates no total, zero IDs de destino e zero autorizacoes de importacao. O gate anterior e o backup original permanecem intactos. Nenhum registro foi carregado no ERP operacional.
- Contrato efetivo verificado: `clientes` e `produtos` aceitam `group_id` com `empresa_id` nulo; `cliente_empresas` representa vinculo operacional separado. A listagem de Produto em contexto de Empresa filtra Empresa e nao deve ser ampliada automaticamente para operacoes. A API efetiva ainda nao possui tabela canonica de Fornecedor. O caminho de importacao de Grupo e os alvos explicitos precisam de teste em PostgreSQL isolado antes de promover candidatos.
- Pendencias: linhagem historica completa da extracao, dependencias e codigos canonicos do destino, duplicidades documentais, contrato de Fornecedor, consulta historica separada de saldos, e gate de carga com backup/reversao. Nenhuma atribuição automatica de operacoes ou documentos fiscais a CPA/3Z.
- Reuso obrigatorio: `scripts/legado/carregar-staging-isolado-legado.mjs` da frente #211 ja aceita mestres em escopo de Grupo; seus 8 testes sinteticos focados passaram em 10/10. Nao criar outro mapeador. Esse carregador usa Map em memoria e nao grava nas entidades PostgreSQL; a ponte canônica continua pendente.
- Revisao real de Produto: 1.208 candidatos em 73 pares classe/unidade; nenhum par tem ambos os IDs de destino aprovados. As oito divergencias de unidade se agrupam em dois aliases lexicais (6 abreviacoes de litro, 2 grafias de metro quadrado). A API efetiva nao possui as unidades LT/M2 correspondentes; nao converter por semelhanca textual nem gerar seed para ocultar o bloqueio.
- Lacuna adicional no contrato canonico: `clientes` preserva `legacy_id`/`source_system`/`migration_batch`, mas `produtos` nao tem esses campos; o codigo atual de Produto sozinho nao e mapa de procedencia antigo->novo. Itens de Orcamento/Pedido exigem Produto da Empresa juridica da operacao, enquanto o mestre legado aprovado esta no Grupo. Resolver por vinculo/visibilidade explicita e testada, nao por copia automatica ou alargamento silencioso do filtro empresarial.
- Validacao isolada do patch local Cliente/Produto de escopo: checkout privado da branch #262 em VPS, sem dados reais ou conexao ao ERP operacional. `npm ci` raiz/backend, audit, teste raiz 771/771, lint e build raiz, backend 306 pass/18 skip, backend typecheck/build e diff-check passaram. `npm run typecheck` raiz continua vermelho em arquivos frontend preexistentes; `jsconfig.json` inclui apenas `src/components`, `src/pages` e `src/Layout.jsx`, nao os quatro arquivos backend/testes do patch. Pelas regras do repositorio, o patch de codigo permanece sem commit/push. O ensaio nao constitui carga PostgreSQL nem homologacao operacional.
- Historico transacional adicional em staging privado separado: extracao read-only atual da copia SQL local produziu 80.750 lancamentos de caixa e 49.601 parcelas de cartao, sem NSU/autorizacao. Hashes, chaves unicas e vinculos parcela->caixa conferidos; carga SQLite 130.351/130.351, retry zero insercoes, FK=0 e reversao testada em copia. Cruzamento read-only com cadastros existentes: caixa 59.093 Cliente candidato, 19.168 Cliente em quarentena, 2.489 sem Cliente; cartoes 38.316 candidato e 11.285 quarentena. Segunda classificacao foi idempotente e o staging cadastral original nao mudou. Isto nao comprova a linhagem historica MDF->extrator->CSV nem semantica de titulos/saldos, empresa fiscal ou carga nas entidades canônicas. Consulta futura deve exibir empresa nao identificada — historico legado e impedir cobranca, baixa, saldo e estoque. Compras, notas e demais titulos ainda nao foram recuperados; importacao operacional segue zero.

### Continuidade no computador de casa — checkpoint 10/10

- Responsaveis: Legado nesta tarefa, branch `codex/legacy-group-scope`, PR #262; Comercial 360 na tarefa separada "Comercial 360" (recebimento confirmado, primeira acao: conferir HEADs e revisao #265); Cursor nos arquivos/branches proprios. Nao aplicar patches de uma frente sobre worktree da outra. O usuario autorizou continuidade entre lotes independentes, mas os gates de AGENTS.md continuam obrigatorios.
- Checkpoint comunicado pela tarefa Comercial 360 e confirmado no GitHub: PR #265 draft no HEAD `fdb4af816123c829d7427cff5dd43fd3a3426b3a`, checks frontend/backend SUCCESS. A tarefa informa revisao do Cursor e merge local de codigo #261; #265 ainda nao foi integrada na #261/main nem implantada/homologada. #254 e #261 permanecem PRs separadas. A frente Comercial e responsavel pelo seu handoff final e pela revisao do resultado integrado; revalidar HEADs dinamicos no novo computador.
- Legado remoto confirmado antes deste handoff: PR #262 aberta no checkpoint-base do patch `af909ae68b2c281abb5dc92a72fe56a56124a1dd`, com quatro checks frontend/backend concluidos com sucesso. Este proprio handoff gera novo HEAD; revalidar branch/CI antes de integrar. Main remota no instante da consulta: `baba91a6b0d5d626edd607b8cd3522927e1904ab`.
- Worktree Legado tem quatro arquivos de codigo/teste locais sem commit: `server/src/services/clienteService.ts`, `server/src/services/produtoService.ts`, `server/tests/runtime04.test.ts` e `server/tests/runtime10-produto-pim.test.ts`. Patch recuperavel privado em `/root/erp-private/legacy-handoff-20261010/unpublished-code.patch` na VPS, baseado no HEAD acima; checksum da transferencia conferido, diretorio modo 700. `git apply --reverse --check` passou no worktree sujo. No computador de casa, usar checkout limpo do SHA-base e `git apply --check` antes de aplicar. Nao commitar/push ate os checks obrigatorios passarem: typecheck raiz falha em frontend preexistente; demais resultados anteriores constam acima. O worktree original nao foi revertido.
- Artefatos privados recuperaveis na VPS: staging cadastral em `/root/erp-private/legacy-stage-20261009T115402Z`, gates derivados em `/root/erp-private/legacy-group-master-gates-20261010-v1`, historico e extrator read-only em `/root/erp-private/legacy-history-20261010`, matriz auxiliar pre-VPS em `/root/erp-private/legacy-handoff-20261010/legacy-aux-review.local`. Dados, patches privados, hashes e backup original nao estao no GitHub. O SQL local `MSSQL$ERPZLEGACY` foi devolvido a `Stopped/Manual`. Nao presumir que HD ou credencial SSH estejam disponiveis no computador de casa; verificar acesso efetivo e localizar `BACKUP ERP ANTIGO - CODEX` pelo nome quando necessario.
- VPS DEV: `/opt/erp-zuccaro` estava no checkout `f22d1151` e API/web estavam ativos, com health OK. A tarefa Comercial relata `f22d1151` como ultimo deploy/homologacao documentado pelo Cursor; um registro de deploy anterior presente no checkout da VPS ainda informa `6e397596`, backup e rollback. As imagens ativas nao possuem etiqueta de revisao, de modo que esta checagem direta nao prova sozinha o SHA compilado; consultar a evidencia de deploy mais recente antes de implantar. Nenhum deploy, merge ou importacao foi executado por Legado neste checkpoint.
- Proximo lote Legado: no ambiente privado isolado, reconciliar a semantica dos eventos Caixa/Cartao antes de expor consulta historica, preservar empresa comprovada e classificar desconhecida; continuar mapa de alvos/dependencias de Produtos e contrato canonico de Fornecedor. O piloto de 1.000 Clientes PostgreSQL continua apenas ensaio; zero carga operacional, `import_authorized=0`. Na ausencia de HD/SSH em casa, avancar codigo/testes de contrato sem inventar dados, seeds ou alvos. Comercial 360 deve confirmar seu proprio handoff/HEAD final apos revisao #254/#261/#265; nao tratar essas PRs isoladas como candidata integrada.

## CURSOR — #113 Onda 3 sugestão vínculo (2026-10-08T15:09Z)

| Fase | SHA |
|---|---|
| implementado | `502122bc` |
| **integrado** | `68c311cc` MERGED #113 |
| **implantado** | `68c311cc` VPS |
| validado rota | `GET .../sugestao-vinculo` → **401** sem token (não 404) |
| validado CPA/3Z browser | BLOCKED `ERP_DEV_LOGIN_*` |

Evidência: `docs/vps/evidence/deploy-113-main-68c311cc-20261008.txt`. Rollback `pre-spa-login-20261008-150832`.
Contém também #246 Financeiro UX + #245 nginx 404-all.

## CURSOR — #246 integrado+implantado `64301fdb` (2026-10-08T15:01Z)

| Fase | SHA |
|---|---|
| implementado | `3faa46ff` |
| **integrado** | `64301fdb` MERGED #246 |
| **implantado** | `64301fdb` VPS rebuild |
| validado health/snapshots | sim |
| validado CPA/3Z browser | BLOCKED `ERP_DEV_LOGIN_*` |

Evidência: `docs/vps/evidence/deploy-246-main-64301fdb-20261008.txt`. Rollback `pre-spa-login-20261008-150055`.

## CURSOR — fases #245 reconciliadas (2026-10-08T14:52Z)

| Fase | SHA | Nota |
|---|---|---|
| implementado | `542be525` | nginx regex 404 |
| **integrado** | `dd6c211d` | MERGED #245 → main |
| **implantado** | `dd6c211d` | VPS rebuild pós-merge |
| validado health/snapshots | sim | 404 `base44-local-*.json` |
| validado CPA/3Z browser | **não** | secrets login ausentes |

Evidência: `docs/vps/evidence/reconcile-245-main-vps-dd6c211d-20261008.txt`.
Rollback: `pre-spa-login-20261008-145118`.

## CURSOR — #246 Financeiro scope + stale cancel (2026-10-08)

| Fase | Estado |
|---|---|
| implementado | `cancelFinanceiroQueriesOnScopeSwitch` + reset CR/CP/Caixa/Cartões/Conciliação/Lote |
| integrado | PR #246 (rebase main `dd6c211d`) — CI a correr |
| implantado | **não** (aguardar merge) |
| validado VPS browser | BLOCKED `ERP_DEV_LOGIN_EMAIL` + `ERP_DEV_LOGIN_PASSWORD` |

Testes focados empresa-switch **7/7**. ≠ outbox/legado/#245.

## CURSOR — estado vivo pós-validação (2026-10-08T14:25Z)

| Item | Valor |
|---|---|
| **implantado erp-dev** | **`542be525`** (branch #245 nginx 404-all; detached) |
| Anterior | `85049afd` (#243) — superseded |
| health/ready/web | **200** · RUNTIME-08B · supabase_user |
| Snapshots `base44-local-*.json` | **404** application/json (clientes/produtos/empresas/snapshot/core) |
| Browser CPA/3Z | **BLOCKED** — Environment sem `ERP_DEV_LOGIN_*` (pedido ao usuário) |
| Lote UX | `cursor/cadastros-financeiro-empresa-ux-392b` (rebase main; PR) |
| Legado destino | runtime **`542be525`**; contratos #231/#226/#225/#203/#237/#239/#242/#243/#245; **não** duplicar mapper; **não** vínculos sem prova |

> Seções abaixo com `implantado=9a277011` / `NONE` são **históricas**.

## CURSOR — Cadastros ↔ Financeiro ↔ empresa UX (2026-10-08)

Branch `cursor/cadastros-financeiro-empresa-ux-392b` · SHA `ec27b9f7` (base main). Gap: Financeiro sem scope `grupo:empresa` no queryKey/uniqueKey; CR/CP com seleção residual na troca; sem alerta sem contexto. Fix: `buildMultiempresaQueryScopeKey` + `buildFinanceiroTitulosScopeSwitchReset` em launchpad + tabs. Testes **47/47**. PR create **BLOCKED** (integration) — abrir: https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/new/cursor/cadastros-financeiro-empresa-ux-392b. ≠ outbox/legado. **Sem deploy VPS.**

## CURSOR — implantado erp-dev `542be525` (2026-10-08T14:24Z)

| Item | Valor |
|---|---|
| **implantado** | **`542be525`** · PR [#245](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/245) |
| Anterior | `85049afd` (#243) — superseded |
| Smoke | health/ready/web **200** · RUNTIME-08B · supabase_user |
| Snapshots `base44-local-*.json` | **404** JSON (clientes/produtos/empresas/snapshot/core) via HTTPS público |
| Rollback tags | `pre-spa-login-20261008-142359` (api+web) |
| Evidência | `docs/vps/evidence/deploy-542be525-snapshot-404-all-20261008.txt` |
| Browser CPA/3Z | **BLOCKED** sem `ERP_DEV_LOGIN_EMAIL`/`PASSWORD` |
| Legado destino | runtime **`542be525`**; sem mapper paralelo; sem vínculos sem prova |

> `implantado=9a277011` / `NONE` abaixo = histórico.

## CURSOR — validação pós-deploy + gap snapshots (2026-10-08)

| Item | Valor |
|---|---|
| **implantado erp-dev** | `85049afd` (main #243+#244) · web/api rebuilt ~14:12Z |
| health/ready :3080/:3081 | **200** ok/ready |
| HTTPS público | SPA 200; `/api/health`/`ready` 401 AUTH_REQUIRED (edge) |
| Snapshots canônicos | `/base44-local-snapshot.json` + `core` → **404** |
| Gap encontrado | `/base44-local-clientes|produtos|empresas.json` → **200 HTML SPA** (não JSON) |
| Correção | branch `cursor/spa-snapshot-paths-404-all-392b` (regex 404 todos `base44-local-*.json`) |
| Browser CPA/3Z | **BLOCKED** sem `ERP_DEV_LOGIN_EMAIL`/`PASSWORD` no Environment |
| Lote UX indep | `cursor/cadastros-financeiro-empresa-ux-392b` SHA `ec27b9f7` (PR a abrir) |
| Legado destino | erp-dev **85049afd**; sem vínculos empresariais sem prova; mapper não duplicar |

> Histórico abaixo com `implantado=NONE` / `9a277011` é **superseded** por esta seção.


## COORDENAÇÃO CURSOR → LEGADO — implantado=`9a277011` (2026-10-08 pós-deploy)

Chat: [ERP ZUCCARO - CODEX/CURSOR](bc-d973626e-1060-4071-a25a-6a549769392b)
Agente Legado: [Legado: versão implantada](bc-4427c136-a373-5bb6-83b8-ffa135fdb2d9)
PR: [#211](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/211)

| Campo | Valor |
|---|---|
| **Versão efetivamente implantada em erp-dev** | **`9a277011`** (não mais NONE) |
| Imagens | `erp-api-dev` / `erp-web-dev` rebuild **2026-10-08T13:34Z** |
| Smoke VPS | health/ready/web **200** · `auth.mode=supabase_user` · meta **ERP-RUNTIME-08B** |
| Snapshots JSON públicos | **AUSENTES** (SPA HTML fallback ~1958B; 0 arquivos no nginx) |
| Contratos no destino | #231 snapshots · #226 Cadastros Organizacional · #225 Financeiro · #203/#237 outbox · #239 troca empresa · #242 acesso VPS canônico |
| Main GitHub tip | pode estar à frente só em docs (ex. `f6ec95bc`); **runtime VPS = `9a277011`** |
| Flags Legado | `importAuthorized=false` · sintético ≠ importação · **não** alterar vínculos empresariais · mapper #48 intocado |
| Checksum 153440Z | **UNVERIFIED** neste Cloud |
| Contagens REAIS backup | **0** processadas neste agente |

**HUMAN_NEXT (Legado — PC com HD):** somente verifier host-local — sem re-export/CADESP/transferência; sem tratar teste sintético como importação:
```bash
bash scripts/legado/executar-verifier-host-local.sh
# ou: --reports-dir "D:/BACKUP ERP ANTIGO - CODEX/04_REPORTS"
```
Colar só `PASTE_TO_GIT_HOST_*` + JSON do verifier.

**#211:** `gh pr edit` costuma falhar neste token — Cursor/humano: título `legado: erp-dev implantado=9a277011 — verifier host-local`; corpo = tabela acima + flags + HUMAN_NEXT verifier.

### Histórico — versão implantada=NONE (pré-deploy, obsoleto)
Antes do rebuild 13:34Z a VPS ainda estava em NONE (SPA last-mod 2026-09-27; snapshots HTTP 200; deploy BLOCKED SSH/MCP). Superseded pela seção acima.

## CURSOR — validação pós-deploy `9a277011` (2026-10-08)

| Item | Resultado |
|---|---|
| Versão VPS | **`9a277011`** implantada |
| health/ready/web | **200** |
| HTTPS meta | RUNTIME-08B · supabase_user |
| Snapshots JSON | **ausentes** (HTML fallback 1958B; 0 arquivos) |
| Browser CPA/3Z | em andamento (agente) |
| Defeito tratado | nginx passa a **404** nos paths legados (não mascarar com SPA) |
| Parecer Codex | #236 `6581cfec` — APROVAR runbook (sem rewrite) |
| Evidência | `docs/vps/evidence/validacao-pos-deploy-9a277011-20261008.txt` |


## ACESSO VPS CANÔNICO (Cursor + Codex) — 2026-10-08

Contrato operacional: `docs/OPERACAO_DEV_VPS.md` § «Acesso operacional Cursor / Codex».

| Item | Valor no Git | Segredo |
|---|---|---|
| Host | `srv1982741` · erp-dev.cpaferroeaco.com.br | IP não versionar |
| Path | `/opt/erp-zuccaro` | `.env.erp.dev` só na VPS |
| SSH user | tipicamente `root` | nome do secret: `ERP_DEV_VPS_SSH_USER` |
| SSH key | pubkey + fingerprint no OPERACAO_DEV_VPS | privada: `ERP_DEV_VPS_SSH_PRIVATE_KEY` (Environment Secret) |
| authorized_keys | deve conter `erp-zuccaro-vps` na VPS viva | hPanel sozinho não basta |

**Regra:** após qualquer deploy/backup/rollback VPS → atualizar este HANDOFF + `docs/vps/evidence/` + push. Trocar de PC não exige reenviar chave no chat se o Environment Cursor mantiver os secrets.

## CURSOR — deploy erp-dev main `9a277011` (2026-10-08T13:35Z)

| Fase | Estado |
|---|---|
| integrado | sim (main `9a277011`) |
| **implantado** | **sim** — SPA/API rebuild em srv1982741 |
| validado VPS (browser CPA/3Z) | **pendente** hard refresh + login real |
| snapshots públicos JSON | **ausentes** (fallback HTML SPA; não os dumps) |

- Backup: `pre-gate-e-20261008-133238.sql` · 845186 B · sha256 `1f1b55b2…` · evidence `docs/vps/evidence/pre-gate-e-backup-latest.txt`
- Rollback: `erp-zuccaro-erp-api:pre-spa-login-20261008-133314` / `…-web:…`
- Evidência: `docs/vps/evidence/deploy-main-9a277011-20261008.txt`
- Contém: #231 #226 #225 #203 #237 #239

**HUMAN_NEXT browser:** abrir https://erp-dev.cpaferroeaco.com.br/ com hard refresh → login → CPA/3Z → Cadastros Empresas → Financeiro.

## CURSOR — UX troca de empresa fail-closed (2026-10-08)

Agente: [Comercial UX empresa-switch](bc-5656ace2-6ada-57dc-87dd-81e7868ccc0c)
PR: [#239](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/239) · tip pós-rebase main (#240)

- Gap: troca de grupo/empresa fechava form sem zerar seleção em massa / isSaving / formKey.
- Fix: `buildCadastroScopeSwitchReset` + effect `scopeKey` no VisualizadorUniversal.
- Testes: `cadastros-empresa-edicao-load` **15/15** · CI SUCCESS.
- ≠ outbox #237 / legado.

## HISTÓRICO — Legado versão implantada=NONE (obsoleto) (2026-10-08)

**Versão efetivamente implantada em erp-dev: NONE.** Main tem #231/#226/#225/#203/#237 no código; SPA last-mod 2026-09-27; snapshots HTTP 200; deploy BLOCKED (SSH/MCP). Legado: só verifier no PC com HD.

## CURSOR — pacote frentes paralelas (2026-10-08)

Chat: [ERP ZUCCARO - CODEX/CURSOR](bc-d973626e-1060-4071-a25a-6a549769392b)

| Fase | Main (#231…#237) | Deploy erp-dev | Legado |
|---|---|---|---|
| integrado | **sim** | código em main | scripts |
| implantado | **não** | **BLOCKED** SSH/MCP | não |
| validado VPS | **não** | snapshots HTTP 200 | N/A |

## CODEX Comercial — follow-up #226/#203 (2026-10-07T20:50Z)

Agente: [Comercial Cadastros Empresas](bc-55d5261f-d7a1-5e68-9b15-bd09a65ecb6a)

| Item | Estado |
|---|---|
| #226 ⊇ #227/#228/#229 | **SIM** · visual≡save Organizacional · merge `6dfd39d2` |
| #203 outbox | **MERGED** `2403586e` (tip `91675712`) · CI SUCCESS |
| #227/#228/#229 | **arquivar** (conteúdo em #226); close negado à integration — HUMAN close |
| Main | `2403586e` (#231+#226+#225+#233+#234+#203) |
| Deploy erp-dev | ainda BLOCKED VPS MCP |

## LEGADO — follow-up verifier (2026-10-07T20:50Z)

Agente: [Legado evidência ERP novo](bc-4427c136-a373-5bb6-83b8-ffa135fdb2d9)

| Campo | Valor |
|---|---|
| Estado | **BLOCKED** — execução real não avançou |
| Checksum | **UNVERIFIED** (`FOUND_EXPORT=NONE`) |
| Tentativa Cloud | `executar-verifier-host-local.sh` exit 4 `LEGACY_HOST_REPORTS_DIR_NOT_FOUND` |
| Host com backup | PC proprietário `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS` (não este Cloud) |
| Workers | 0 · sem `usePrivateWorker` |
| Contagens reais | **0** processadas |
| Sintético (≠ efetivo) | staging 8→4/1/1/2 · vínculos 3/4 |
| PR | [#211](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/211) tip remoto `66f0520f` |

**HUMAN_NEXT (único bloqueio):** no PC com o HD → `bash scripts/legado/executar-verifier-host-local.sh` → colar saída sanitizada · ou `cursor worker start` nesse PC.

Dados reais / credenciais: fora do GitHub.

## TRÊS PACOTES — integrado em main (2026-10-07T20:45Z)

Chat: [ERP ZUCCARO - CODEX/CURSOR](bc-d973626e-1060-4071-a25a-6a549769392b)
Main tip: `e2c51d84` (#231 + #226 + #225).

| Fase | #231 snapshots | #226 Cadastros | #225 Financeiro | Legado | erp-dev |
|---|---|---|---|---|---|
| implementado | sim | sim | sim | scripts/verifier | — |
| revisado | sim | sim | parcial (fluxo real local) | UNVERIFIED cloud | — |
| integrado | **MERGED** `c0efab11` | **MERGED** `6dfd39d2` | **MERGED** `e2c51d84` | — | código em main |
| implantado | **não** | **não** | **não** | não | **BLOCKED** VPS MCP timeout; workers 0; sem SSH neste Cloud |
| validado VPS | **não** — assets ainda HTTP 200 (~13.8MB / ~1.0MB) | **não** | **não** | N/A | RUNTIME-08B pré-promoção |
| dados reais | — | — | — | **0** (BLOCKED host HD) | — |

**Pendência concreta de implantar:** Hostinger VPS MCP `vps_virtual-machines_list` timeout (−32001); self-hosted workers = 0; sem chave SSH no ambiente Cloud. Autorização válida ≠ conexão efetiva.

**Arquivar (não mergear):** #227, #228, #229. Lote indep. Comercial: #203. Auth local #230 ≠ Auth VPS.

| Frente | Responsável | Próxima ação |
|---|---|---|
| CODEX Comercial | [bc-55d5261f](bc-55d5261f-d7a1-5e68-9b15-bd09a65ecb6a) | #203 outbox; confirmar arquive 227/8/9 |
| CURSOR | este chat | desbloquear VPS (MCP/SSH/worker) → backup → build/promover main `e2c51d84` → validar CPA/3Z + financeiro + snapshots 404 |
| CODEX Legado | [bc-4427c136](bc-4427c136-a373-5bb6-83b8-ffa135fdb2d9) | **BLOCKED** exit4 HD ausente; HUMAN_NEXT no PC com D: |

## TRÊS PACOTES ATÉ CONCLUSÃO — atualização (2026-10-07T20:40Z)

Chat: [ERP ZUCCARO - CODEX/CURSOR](bc-d973626e-1060-4071-a25a-6a549769392b)

| Frente | Responsável | 1ª ação | Estado |
|---|---|---|---|
| CODEX Comercial | [Comercial Cadastros Empresas](bc-55d5261f-d7a1-5e68-9b15-bd09a65ecb6a) | #226⊇#227/8/9 + #203 | **#226 MERGED** `6dfd39d2`; arquivar 227/8/9; #203 indep. |
| CURSOR | este chat | merge #231→#226→#225; deploy; validar erp-dev | **#231+#226 em main**; #225 rebase; deploy **BLOCKED** VPS MCP timeout |
| CODEX Legado | [Legado evidência ERP novo](bc-4427c136-a373-5bb6-83b8-ffa135fdb2d9) | executor PC com HD | workers 0; HD não no Cloud |

### Fases

| Fase | #231 | #226 | #225 | Legado | erp-dev |
|---|---|---|---|---|---|
| implementado | sim | sim | sim | scripts | — |
| revisado | sim | sim | parcial | UNVERIFIED | — |
| integrado | **sim** | **sim** | tip | — | parcial |
| implantado | não | não | não | não | MCP timeout |
| validado VPS | não | não | não | N/A | snapshots ainda 200 |
| dados reais | — | — | — | pendente host | — |

## CODEX — candidata #226 ⊇ #227/#228/#229 (2026-10-07)

Matriz: `docs/MATRIZ_226_CONTEM_227_228_229.md`. **#226 MERGED**. PRs a arquivar: #227, #228, #229.

## CURSOR — Financeiro #225 (2026-10-07)

- Rebase sobre main (#231+#226). Launchpad grant plano + fluxo ContaReceber A/B.
- Próximo: merge #225 → deploy → validar CPA/3Z e financeiro na VPS.

## CURSOR — 3 frentes + Financeiro launchpad (2026-10-06)

| Frente | Responsável | Arquivos quentes | Não tocar |
|---|---|---|---|
| Cadastros/Empresas | Comercial #226 **MERGED** | — | — |
| Legado | [Legado](bc-4427c136-a373-5bb6-83b8-ffa135fdb2d9) | verifier HD | CADESP |
| Financeiro | Cursor #225 | Financeiro.jsx, financeiroLaunchpadAccess.js | Cadastros tip |

## Checkpoint Onda 15 - limpeza outbox na troca de Empresa (2026-10-06)
- Branch `cursor/comercial360-onda15-outbox-claim-392b`: `ProdutoRelationsDamSection` zera variantes/equivalentes/mídia/métricas/dead-letter quando `empresaId`/produto/view faltam — fail-closed entre tenants.
- Teste estrutural em `tests/produto-pim-ui.test.js`. Sem publisher externo.
- Coordenação pacotes paralelos: Comercial = candidata/#219/#221 + ledger; Legado = export/CADESP/staging; Cursor = revisão #221 + outbox/DAM nesta branch. Não editar router/STATUS da candidata daqui.

## Checkpoint Onda 15 - PG concorrencia + consumidor prepared (2026-10-04)
- Branch `cursor/comercial360-onda15-outbox-claim-392b`: alem de claim/lease/projecao, E2E PG cobre claim concorrente, lease/executor antigo, retry→DL, isolamento A/A2/B e rollback; consumidor prepared fail-closed para external.
- Meta `outboxConsumerPrepared`. Env: `ERP_OUTBOX_CONSUMER_MODE` / fake outcome / channel flags (sem segredo).
- Divisao Cursor vs Comercial: ver secao de coordenacao na branch #202 (`docs/HANDOFF_ATUAL.md`); Comercial nao edita midia/outbox deste pacote.
- Bloqueado: publisher real, cron VPS, Auth, tip-port.

## Checkpoint Onda 15 - claim/lease + projecao allowlisted (2026-10-02)
- Branch `cursor/comercial360-onda15-outbox-claim-392b`: claim/confirm/fail/reprocess/discard/list/metrics + UI prepared; projecao allowlisted no emit e no FakeCatalogPublisher (rejeita custo/margem/ncm/URL).
- Rotas: GET outbox (+produtoId) + outbox/metrics; POST claim/process/confirm/fail/reprocess/discard.
- Bloqueado externo: publisher real, Storage/Auth/VPS, reconciliacao de canal.

## Resposta Codex ao contrato Cursor do canario - PR #34 secao 4 (2026-09-24)
- Fonte: PR #33 branch codex/comercial-360 em bfdfe834; PR #34 branch cursor/vps-hml-gate-c-legado-392b em e40a8a61. Main ainda ca417160. O Gate C foi marcado aprovado pelo Cursor com evidencias sanitizadas; isso NAO autoriza D/E/F, migration ou Auth novo.
- 1. EXPECTED_RUNTIME=ERP-RUNTIME-08B. `server/src/api/router.ts` fixa esse valor em `/api/v1/meta`. O default `COMERCIAL-360-V1` de `scripts/deploy/comercial360-canary.sh` esta incorreto para este candidato; antes do Gate D passar EXPECTED_RUNTIME explicitamente e ajustar o default em checkpoint validado. Revalidar meta na imagem da MAIN, nao confiar em branch.
- 2. `auth.mode=supabase_user` e requisito de aceitaçao, nao fato do DEV. `server/src/config/env.ts` permite configurar ERP_AUTH_MODE=supabase_user e exige SUPABASE_URL+SUPABASE_ANON_KEY; producao usa este modo por padrao e rejeita dev_headers. `requestContext.ts` valida Bearer no Supabase Auth e resolve `profiles.auth_user_id` ativo e escopado. O canario deve iniciar com configuracao local segura e o smoke deve verificar `/meta` + requisiçao autenticada real. Nao exibir env, token ou chave.
- 3. Gate E: aplicar somente migrations faltantes 016-024 da MAIN ja revisada, em ordem numerica pelo migrator canonico, numa janela autorizada com backup NOVO e rollback preparado. Dividir o controle em 016-017 (Orcamento/Pedido) e 018-024 (Produto/PIM/DAM/canais), conferindo contagens e invariantes apos cada fatia; falha interrompe e bloqueia Gate D. Nao usar API de todo o Comercial 360 sobre esquema parcial; `test:postgres` real (>0, 0 fail/skip) ao final, sem reaplicar 001-015. Nenhuma fatia esta autorizada ou aplicada agora.
- 4. Tag futura `erp-zuccaro-erp-api:comercial360-main-<MERGE_SHA8>` construida somente do SHA efetivamente mesclado na MAIN. Registrar MERGE_SHA, image ID/digest obtidos do build/inspect e prova do canario usando a mesma imagem; nao reutilizar SHA da branch. Digest/tag finais INDETERMINADOS ate merge e build; nao alegar imagem imutavel existente.
- 5. `auth.users=0` e dois profiles ativos sem `auth_user_id` tornam smoke Bearer impossivel hoje. Em gate Auth separado e autorizado, provisionar identidade de teste exclusivamente sintética no Supabase Auth self-hosted, vincular seu UUID a profile ERP sintetico ativo no Grupo/Empresa sinteticos autorizados, com permissoes minimas Orcamento/Pedido. Validar scope positivo e RBAC/tenant negativos. Token, senha, email e chaves somente no ambiente seguro; nenhum valor no Git/log/handoff. Depois revogar sessao/desabilitar identidade de teste conforme procedimento auditavel. Nao reutilizar automaticamente os dois profiles existentes sem provar que sao sinteticos.
- Coordenacao: Cursor revisa este contrato e as verificacoes Gate D/E na PR #34; Codex revisa requisitos da PR #33. Ordem sugerida: fechar/revisar PR #34 documental-operacional primeiro; revisar PR #33 e seu default de runtime; so entao decidir merges por revisao humana e atualizar SHA da MAIN. PR #33 segue draft, sem merge; 3080 continua R07B.
- Frente independente Cliente 360 esta somente no workspace local, sem push e sem CI deste codigo; testes focados passaram, suite completa e build local sofreram OOM. Nao apresentar o endpoint como disponivel no remoto ou na VPS.

## Contrato Cursor/deploy - preco por ClienteEmpresa (2026-09-24)
- API read-only: GET /api/v1/tabelas-preco/preco-cliente?clienteEmpresaId=<uuid>&produtoId=<uuid>&unidadeMedidaId=<uuid>&businessDate=YYYY-MM-DD. Resposta {data: ResolvedPrice|null}; 422 para query/campo invalido, 403 para RBAC negado/ator ausente, 404 seguro para vinculo ClienteEmpresa fora do tenant. Nao enviar tabelaPrecoId, groupId ou empresaId na query; estes ultimos vem do contexto autenticado.
- Backend: TabelaPrecoService consulta ClienteRepository.getEmpresaLinkById no mesmo Grupo/Empresa e usa tabela_preco_id configurada no vinculo, com fallback para tabela padrao autorizada. Produto especifico de outra Empresa nao resolve; mestre compartilhado do Grupo pode resolver. RBAC exige Cadastros.tabela_preco.visualizar e Cadastros.cliente_empresa.visualizar.
- Nenhuma migration ou variavel nova. Frontend HTTP de TabelaPreco permanece nao ativado como piloto; nao ligar na 3080 R07B. Orcamento/Pedido e seus snapshots de itens nao foram alterados. Futuro consumo exige preco efetivo no servidor, regra comercial de alçada/desconto e teste de nao retroatividade antes de habilitar a captura em vendas.
- PR #33 continua draft. Migrations 023/024 somente codigo/CI; gate DEV real segue separado da CI efemera. Nenhuma aplicacao de migration, seed, Auth novo, canario ou promocao neste checkpoint.

## Contrato Cursor/deploy - resolucao de preco (2026-09-24)
- Onda 2: TabelaPrecoService.resolvePrice permanece contrato interno, sem rota nova, flag HTTP, migration ou configuracao. Requer contexto autenticado groupId/empresaId, TenantGuard e RBAC Cadastros.tabela_preco.visualizar; input estrito aceita produtoId, unidadeMedidaId, businessDate opcional YYYY-MM-DD real e clienteEmpresaTabelaId opcional. Nunca aceitar tenant/ator do payload.
- Repositories PostgreSQL e in-memory resolvem somente Produto ativo do Grupo, compartilhado (empresa_id NULL) ou proprietario da Empresa em contexto, e Unidade ativa do Grupo. Tabela e item continuam sujeitos a vinculo empresarial, vigencia e estado. ID de tabela especifica nao deve ser exposto como escolha livre ao frontend antes de validar o vinculo ClienteEmpresa.
- Orcamento/Pedido nao foram alterados. Ao integrar, escolher tabela autorizada pelo ClienteEmpresa/canal, calcular no servidor e persistir snapshot imutavel do preco por item; nao recalcular vendas historicas a partir da tabela atual. Requer teste tenant A/B, fallback, vigencia, concorrencia e RBAC antes de habilitar HTTP.
- Migrations 023/024 estao somente no codigo/CI; nenhuma aplicada na VPS. Gate C ainda exige restauracao isolada, backup novo e precheck de porta/canario. Preservar API 3080 R07B e PR #33 draft.

## Contrato Cursor/deploy - Produto por canal (2026-09-24)
- PR #33 segue draft, branch codex/comercial-360. A migration aditiva 024_produto_canais_rascunho.sql e o CRUD canonico de Produto/canais estao no codigo/CI; nao aplicar na VPS sem gate aprovado, novo backup, teste de restauracao e precheck da porta isolada. A migration 023 tambem nao foi aplicada na VPS.
- API: GET/POST /api/v1/produtos/:id/canais, PATCH/DELETE /api/v1/produtos/:id/canais/:canalId. POST aceita somente canal, sku?, nome?, descricao?; PATCH aceita somente subconjunto nao vazio de sku, nome, descricao. Canal exige slug minusculo; status permanece RASCUNHO. DELETE e inativacao logica. Respostas 201/200, erros 400/403/404/409.
- Contratos: escopo vem exclusivamente do contexto autenticado Grupo/Empresa; Produto deve estar ativo e pertencer a Empresa, RBAC Cadastros.produto.visualizar/editar, auditoria na mesma transacao. Nao enviar groupId, empresaId, actorId, status ou preco no body. SKU e unico por Grupo/Empresa/canal, inclusive soft-deleted. CRUD nao aciona catalogo, outbox de publicacao, preco, estoque, fiscal ou integracao externa.
- Configuracao: nenhuma variavel nova. Produto HTTP continua opt-in/desligado na 3080; sem Auth real homologado, nao ativar VITE_ERP_HTTP_PRODUTO nem associar IDs legados. StoragePort/scanner/publicacao permanecem gates separados.
- Testes: service/in-memory, HTTP e PostgreSQL sintetico na suite existente. CI do novo HEAD deve confirmar backend/frontend e E2E PostgreSQL sem fail/skip antes de handoff operacional.
- Proximo deploy autorizado deve inventariar migrations reais, aplicar somente faltantes da MAIN aprovada, validar RLS/FORCE e smoke autenticado no canario isolado; 3080 so muda em gate de promocao explicito.

## Checkpoint vigente - Comercial 360 / Gate C (2026-09-23)
- Branch `codex/comercial-360`, PR #33 draft e sem merge; ultimo HEAD funcional antes deste checkpoint documental `c3df0c3ca0f95a4c27e21de7b91cb002fb154f53`. CI `35919084889` frontend/backend SUCCESS, incluindo PostgreSQL efemero. A CI nao homologa o DEV real.
- Migrations 001-022 existem no repositorio/CI; a evidencia agregada fornecida pelo usuario da VPS mostrou somente 001-015 aplicadas uma vez. Nao executar 016-022, seed, Auth novo, scanner, Produto HTTP ou canario sem gate especifico.
- API oficial 3080 permanece R07B/`dev_headers` conforme capturas fornecidas; backup SQL de 21/09 tem tamanho, hash e marcador de dump completo, mas nao teve restauracao comprovada. Imagem/container de rollback R07B preservados; 3086 estava livre no momento da consulta, sem autorizar implantacao.
- Gate C PARCIAL: comparar em leitura somente a conexao efetiva da API com uma conexao direta ao `supabase-db` por identidade do servidor/migrations, sem imprimir URL ou credenciais; confirmar restaurabilidade e backup atualizado no gate autorizado. Comparar apenas IP nao e prova suficiente.
- Orientacoes R08 abaixo sao historicas. Nao usar a secao antiga "Passo historico R08B" como ordem de execucao atual. Preservar PR draft, main e 3080 ate gate separado.
## Checkpoint vigente - Gate C, evidencia Web Console (2026-09-24)
- Captura do usuario mostrou `conexao_api_vs_supabase_db=MATCH` ao comparar `current_database()` e identificador do cluster PostgreSQL da API e do `supabase-db`. A divergencia anterior de IP era inconclusiva e nao deve ser usada para negar este resultado.
- Backup SQL de 21/09: 486969 bytes, SHA-256 calculado, marcador de dump completo; restaurabilidade ainda nao testada. Rollback R07B: container preservado/exited e imagem presente. Porta 3086 livre no instante da consulta; 3080 preservada.
- PR #33 permanece draft e sem merge. HEAD anterior `38bb311709673e87fd00c00e9a81d0c660c0bf6b`, CI `35985748032` SUCCESS; migrations 001-024 no codigo/CI, somente 001-015 evidenciadas na VPS. Gate C nao autoriza canario/migration: falta restauracao isolada, backup novo pre-implantacao e precheck imediatamente antes do uso. Auth novo, scanner real e Produto HTTP nao homologados.
- As secoes de 23/09 abaixo sao historicas e nao substituem este checkpoint.

## Gate C - precheck Web Console adicional (2026-09-23)
- Backup SQL de 21/09/2026 encontrado com 486969 bytes, SHA-256 calculado e marcador de dump completo; restauracao nao testada e backup atualizado ainda pendente para o gate autorizado.
- API oficial `erp-api-dev` running na imagem R07B; container de rollback R07B exited e imagem preservada. Porta 3086 sem listener nem container ativo no instante da consulta; 3080 preservada.
- Gate C segue parcial ate comparacao read-only da conexao efetiva da API com `supabase-db`. Nao iniciar canario, Auth novo, migration ou promocao com base apenas nesse precheck.

## Gate C - Web Console complementar (2026-09-23)
- Evidencia fornecida pelo usuario: API oficial 3080 na imagem R07B, health/ready 200; Auth/DB healthy; API e DB na rede `supabase_default`. Conexao da API reportou banco `postgres` e 15 migrations.
- Comparacao de IP retornou `api_usa_supabase_db=NO`; resultado e inconclusivo para identidade fisica por possivel proxy/IPv6/traducao. Nao declarar banco divergente nem Gate C aprovado ate comparar conexao efetiva e conexao direta ao DB.
- Backups de 20/09 e containers antigos de rollback aparecem preservados, sem verificacao de integridade/restaurabilidade. Porta 3086 nao apareceu em `ss` entre os filtros; 3080 segue oficial. Nao houve escrita VPS ou ativacao.

## Gate C prioritario - checkpoint de 2026-09-23
- PR #33 draft/mergeable no HEAD `750a4ab14854e184d6fb2fc8afef7f6e2094b277`; CI `35910005796` frontend/backend e PostgreSQL efemero SUCCESS. A CI do commit funcional `52167840` (`35909747751`) tambem passou.
- Evidencia VPS nao avancou nesta sessao: Web Console falhou antes de abrir (`helper_unknown_error: apply deny-read ACLs`) e nao ha ferramenta VPS interna disponivel. Banco efetivo da API, rede, backup e rollback continuam sem precheck atual; nao inferir Gate C aprovado.
- O bloco unico de leitura sanitizada foi entregue ao usuario. Nao executar Auth, scanner, Produto HTTP, migration ou promocao na 3080 ate gates separados.

## Gate C DEV - evidencia SQL agregada (2026-09-23)
- Web Console informada pelo usuario: `schema_migrations` possui `id`/`applied_at`; 001-015 cada 1x, 016-022 ausentes nas 15 linhas. `auth.users=0`, `profiles=2`, `groups=2`, `empresas=3`; ambos os perfis ativos estao sem Auth. Sem vinculos de grupo/empresa invalidos nas contagens.
- Nome do banco da API e `current_database()` nao visiveis na captura; identidade do banco da API ainda pendente. Gate C nao aprovado para Auth/canario: API oficial 3080 permanece 07B/`dev_headers`.
- Nenhuma escrita VPS realizada. Continuar somente leitura para banco/rede/backup/rollback; identidade sintetica e perfil requerem gate autorizado separado.

## Gate DEV parcial - 2026-09-23
- Web Console, conforme evidencia informada pelo usuario: API oficial `erp-api-dev` em 3080, imagem `runtime07b-main-ca0bc5f3`; health/ready 200; meta `ERP-RUNTIME-07B`, `auth.mode=dev_headers`.
- MCP Hostinger confirmou VPS `srv1982741` running e Supabase Auth/DB/Storage healthy. Nao ha evidencia SQL de migrations nem dos vinculos de profiles nesta sessao.
- Gate C ainda nao aprovado. PR #33 segue draft; codigo Auth novo nao foi implantado/homologado. Nenhuma acao de escrita na VPS, 3080 preservada.
- Consultas agregadas e gates condicionais constam em `COMERCIAL_360_V1_DEPLOY.md`.


## Checkpoint Comercial 360 - 2026-09-23 (PR #33 draft)
- Branch `codex/comercial-360`; referencia comprovada antes deste checkpoint: `865e23d29ed72d6b00180fc52a4bde572f85c864`; CI `35873286965` verde com PostgreSQL efemero. A `main` e a VPS nao foram alteradas aqui.
- Migrations 001-021 existem no repositorio. Orcamento/Pedido iniciais e Produto/PIM/DAM/Auth estao preparados em codigo; Produto HTTP desligado e midias em QUARENTENA. Nenhuma aplicacao real das migrations 016-021 foi comprovada.
- Gate C DEV ainda sem auditoria VPS verificavel nesta sessao: MCP Hostinger nao expos ferramentas VPS e Web Console falhou antes de abrir. Nao assumir estado atual da API 3080, Auth, PostgreSQL ou buckets a partir do historico abaixo.
- Proximo gate: auditoria somente leitura via Web Console/Hostinger VPS, saida sanitizada; depois homologacao controlada de Auth/perfis. Sem SSH, migration, seed, restart, bucket, ClamAV na VPS, promocao ou merge neste checkpoint.

# ERP ZUCCARO — Handoff atual

## Atualizacao Comercial 360 V1 - 2026-09-21

- Branch de trabalho: `codex/comercial-360`; PR aberta: `#33`; nao mesclada.
- Checkpoint funcional do frontend: `0040e994a8d4c3c3cdd417cc9502fa332c6b3567`; preparação de deploy validada: `3c96bb677aef9c5498842005a6a4a2dd3bc36de3`.
- CI final comprovada antes do fechamento documental: workflow PR `35667460162`, frontend/backend `SUCCESS`; migrate, seed sintetico e PostgreSQL E2E passaram.
- Orçamento e Pedido usam backend HTTP canonico, tenant Grupo/Empresa, RBAC fail-closed e auditoria transacional. Migrations novas 016/017 foram validadas somente no PostgreSQL efemero da CI.
- Preparacao de deploy: `COMERCIAL_360_V1_DEPLOY.md` e `scripts/deploy/comercial360-{canary,smoke,rollback}.sh`. Os scripts nao foram executados; rollback e dry-run por padrao.
- VPS permanece intocada por esta versao: API oficial 3080, migrations aplicadas, imagens, containers e backups continuam no estado operacional descrito abaixo. Proximo gate exige merge e autorizacao VPS separados.
Atualizado em 2026-09-20 após o diagnóstico definitivo do gate do ERP-RUNTIME-08.

## Referências

- Repositório: `viniciuszuccaro-creator/ERP-Zuccaro-codeX`.
- SHA funcional 07B: `ca0bc5f3529b9071fe80e58dae6aa966a9d6c740`.
- Um commit documental posterior, quando existir, deve ser registrado separado
  desse SHA funcional.

## DEV

- VPS: `/opt/erp-zuccaro`.
- API oficial 3080: `ERP-RUNTIME-07B`.
- Imagem: `erp-zuccaro-erp-api:runtime07b-main-ca0bc5f3`.
- PostgreSQL: migrations 001–015 aplicadas exatamente uma vez. As migrations 014 e
  015 são imutáveis e não devem ser reaplicadas manualmente.
- `013_tabelas_preco.sql` permanece aplicada uma vez.

O pós-promoção 07B foi aprovado. A API oficial, banco e VPS não são alterados
por esta documentação.

## Último runtime e agregados canônicos

O ERP-RUNTIME-07B está fechado. Os agregados relevantes são Produto, Cliente,
ClienteEmpresa, ClienteLocal, Obra, TabelaPreco, TabelaPrecoEmpresa e
TabelaPrecoItem.

TabelaPreco tem origem por Empresa, autorização N:N, padrão por Empresa e
referência específica nullable em ClienteEmpresa. A resolução é específica,
depois padrão, depois sem preço. Itens usam Produto + Unidade, valores
`NUMERIC(18,6)`, vigência no cabeçalho, soft delete, RLS, RBAC e auditoria.

## Frontend e rollback

`TabelaPreco.frontendHttp=false`; esse cutover não ocorreu.

Os rollbacks 06B e 06A estão preservados e não devem ser apagados.

## Diagnóstico do gate R08

As constraint triggers reais da 015 estão `DEFERRABLE INITIALLY DEFERRED` e a
barreira rejeita, no `COMMIT`, condição ativa sem parcelas, total de 99%, remoção
da única parcela e reativação sem parcelas. Os testes locais também comprovam o
rollback após cada falha.

O gate que registrou `INVALID_INSERT_EXIT=0` usava `docker exec` sem `-i`. Sem
stdin interativo, o heredoc do Bash não é encaminhado ao `psql`; o processo pode
encerrar com sucesso sem executar o `BEGIN`/`INSERT`/`COMMIT`. A causa é, portanto,
o harness, não aceitação persistida da condição inválida. Com `ON_ERROR_STOP=1`,
um erro SQL em execução não interativa precisa resultar em status não zero.

## Hotfix de metadata R08B

O container temporário do R08B iniciou normalmente. O gate aguardava
`ERP-RUNTIME-08B`, mas `/api/v1/meta` respondia literalmente
`ERP-RUNTIME-07B`; o timeout do gate provocou o cleanup com `SIGTERM`. Não
houve crash nem OOM. O hotfix da branch altera somente a identidade de metadata
para `ERP-RUNTIME-08B` e declara `CondicaoPagamento` como preparado no backend,
mantendo `frontendHttp=false` e fora do piloto HTTP.

## Diagnóstico RBAC e E2E R08B

O `403` do smoke de Condição de Pagamento é causado por seed RBAC incompleto,
não por falha do canário: o actor usado no gate,
`a4a4a4a4-aaaa-4aaa-8aaa-a4a4a4a4a4a4`, pertence ao Grupo A e pode operar as
Empresas A/A2, mas não possuía `Cadastros.condicao_pagamento.visualizar`.
LIST e GET exigem essa mesma ação; as demais ações são `criar`, `editar`,
`inativar`, `restaurar`, `vincular-empresa`, `gerenciar-parcelas` e
`definir-padrao`. O seed idempotente foi corrigido somente para os dois actors
sintéticos A/B, com essas ações explícitas e sem wildcard.

A imagem runtime contém somente artefatos de produção, portanto `npm test`
dentro dela encontrar zero testes é esperado e não prova E2E. O mecanismo
canônico do próximo gate é `npm run test:postgres` no worktree exato do PR,
com dependências de teste efêmeras e `DATABASE_URL` fornecida apenas no
ambiente do gate. O runner falha sem `DATABASE_URL` ou se executar zero testes.

O primeiro E2E PostgreSQL real executou um teste e chegou ao banco. LIST/GET
autorizados passaram, e RBAC/cross-group permaneceram bloqueados. A falha
`SQLSTATE 23514` veio exclusivamente do payload de teste: ele enviava
`E2E-...` para `codigo`, enquanto a constraint exige seis dígitos. A constraint
funcionou corretamente. O hotfix reserva, dentro da transação rollbackável, um
código numérico livre entre `900000` e `999999`; API e schema já eram coerentes.

## Passo historico R08B (nao executar como proximo gate)

Registro de 20/09, superado pelo checkpoint vigente acima. No Gate VPS autorizado, repetir somente o E2E PostgreSQL real e concluir o
canário. O seed RBAC já foi aplicado e não deve ser reaplicado por este hotfix;
não reaplicar migrations. A API oficial 3080 continua R07B. Não
criar migration 016, não promover a API R08 e não fazer merge neste gate.

## CODEX — contencao dos snapshots publicos (2026-10-07)

- O proprietario autorizou retirar da versao atual os dois snapshots reais do ERP novo servidos por `public/` e preparar a limpeza do historico. O repositorio e publico; remover arquivos na HEAD nao elimina blobs de commits anteriores, caches, clones nem artefatos ja implantados.
- Branch `codex/remove-public-erp-snapshots`, baseada na main atual: remove os dois assets reais, desliga hidratacao automatica por URL publica, exige arquivo privado escolhido pelo usuario para recuperar somente em localhost e adiciona guardas contra reintroducao. Copias originais privadas foram preservadas fora desta worktree.
- A limpeza do historico NAO foi executada: inventariar refs/PRs afetados, congelar pushes, preparar copia recuperavel e janela coordenada; reescrita/force-push exigem decisao operacional separada antes de executar. Nao publicar dados, IDs, hashes ou credenciais no PR.
- Implantacao na VPS tambem e separada: antes de trocar imagem/build, conferir gates, backup, rollback e eliminar assets antigos da distribuicao/CDN. Nao presumir que merge remove arquivos ja servidos.
- Runbook separado: `docs/LIMPEZA_HISTORICA_SNAPSHOTS_PUBLICOS.md`. CI tip SUCCESS. Coordenacao Cadastros #226 tip `7bfd3f93` (port #229 completo).
## CODEX LEGADO — contingencia Cursor sem creditos (2026-10-13)

### Checkpoint de destino e backup (2026-10-13)

- Atualizacao de passivo: contrato JSDoc de `src/api/httpPilotCountBridge.js` corrigido, Slider/Toggle tipados sem delta de runtime; fixture ampliada para doze rejeicoes. Oito testes focados e Linux audit/934 testes/lint/build/diff PASS; typecheck ainda FAIL 1.473 erros/235 arquivos, cinco removidos sem novos, 185 no acumulado. Codigo reservado na branch propria e pacote/patch privados conferidos, sem commit/push. CI documental c09548b4 SUCCESS. Nao repetir pedido de excecao: proprietario decidiu corrigir global antes de publicar.

- SSH e conexao PostgreSQL efetiva da API conferidos em READ ONLY; mesmo cluster do container do banco, Grupo aprovado existente. Duas Empresas e dois perfis ligados ao Auth real. Health 200 nao comprova login/RBAC; nenhuma identidade foi criada ou impersonada. Role ativa possui create-role/create-db, e imagem nao informa revisao: revisar privilegios e SHA antes de carga.
- Backup por snapshot consistente restaurado em container isolado sem rede: nove tabelas canonicas reconciliadas por contagens/fingerprints, 573.799 bytes privados. Container e segredo efemero removidos. Nao cobre ownership/ACL, roles ou segredos/configuracao Auth. Artefatos recuperaveis em armazenamento privado restrito; nunca anexar dump, IDs ou fingerprints ao GitHub.
- Piloto privado preparado: um Cliente e um endereco reais, fonte conferida, zero conflitos no destino e zero target IDs alocados. PREPARED_NOT_AUTHORIZED, import_authorized=false, sem efeitos operacionais. Gates: typecheck/publicacao/revisao, Auth/RBAC real, imagem/SHA, menor privilegio, recuperacao de permissoes/configuracao e autorizacao especifica da carga.
- Codigo/verificador/harness continuam privados pela decisao expressa de corrigir passivo global antes de publicar; ultimo typecheck 1.478 erros/236 arquivos. Este checkpoint nao entrega runtime do importador. Comercial foi acionado, mas ultima consulta mostra idle sem primeira acao comprovada; nao confundir envio com execucao. Preservar originais/worktrees e retomar contratos/passivo sem repetir provas suficientes.

- Cursor nao executara o proximo pacote ate recuperar creditos. Ultimo HEAD remoto observado em branches Cursor por data de commit: `6908f74e` (`cursor/cadastros-recuperacao-c360-contrato-392b`, checkpoint documental #321). Suas alteracoes publicadas ficam preservadas; nao ha revisao independente nova. A tarefa Comercial 360 recebeu a contingencia e iniciou conferencia de HEAD em seu ambiente proprio.
- Checkout local adicional `C:\Users\cpaba\ERP Zuccaro` esta em `main` HEAD `509b35aa`, atrasado em relacao ao remoto e com cinco arquivos modificados sem envio: `base44/functions/piiEncryptor/entry.ts`, `base44/functions/sanitizeOnWrite/entry.ts`, `src/Layout.jsx`, `src/api/localBase44Client.js`, `src/api/localCadastroMasterPolicy.js`. Autoria nao comprovada; preservar sem reset, rebase, limpeza ou edicao concorrente. Os tres clones Codex adicionais em `C:\Users\cpaba\ERP-Zuccaro-*` verificados estavam limpos. Nenhum checkout Cursor separado apareceu em `git worktree list` do clone principal; isso nao prova ausencia de outro ambiente privado do Cursor.
- Reserva Legado deste lote: branch `codex/legado-historico-audit-20261013`, base publicada `2948fb42` de `codex/legacy-group-scope`; somente `scripts/legado/auditar-historico-cartoes.py`, `tests/legado-auditar-historico-cartoes.test.py`, esta secao do handoff e status correspondente. Nao editar arquivos de interface, os quatro arquivos backend/testes pendentes em `legacy-group-scope`, nem o verificador pre-VPS pendente em outro worktree. A `main` remota observada era `baba91a6`; compor/revisar com HEADs novos antes de qualquer integracao.
- Auditoria somente leitura do SQLite historico privado na VPS: 80.750 lancamentos de caixa, 49.601 parcelas e 38.801 pais; 37.568 pais conferem com a soma bruta das parcelas e 1.233 divergem. Das divergencias, 891 vinculam-se a Cliente candidato e 342 a Cliente em quarentena; nenhuma das 1.233 corresponde tambem a soma liquida. A diferenca nao prova erro de origem: taxas, descontos e pagamentos mistos ainda carecem de semantica comprovada. A fila detalhada com IDs/valores permanece privada, nunca no GitHub.
- Testes sinteticos do verificador: 3/3; execucao real com contagens de manifesto passou. Gate de codigo: `audit:baseline` passou, `npm test` raiz 697/751 (54 falhas alheias neste Windows), lint/build falharam por dependencias incompletas apos `npm ci` sem termino, typecheck global falhou em arquivos preexistentes. Por `AGENTS.md`, script e teste permanecem locais, sem commit/push; somente este handoff documental pode ser publicado. Nenhuma cobranca, baixa, saldo, estoque ou importacao operacional ocorreu. Proximo passo: investigar a semantica das 1.233 divergencias e manter o historico apenas consultavel; revisar o HEAD integrado quando a revisao independente voltar a estar disponivel.
- Hipotese adicional read-only: as 1.233 divergencias sao lancamentos de credito com o campo numero de pedido preenchido, inclusive o valor `0` (ver correcao abaixo); 1.171 nao possuem juros nem desconto e 1.078 tem apenas uma parcela. Nenhuma coincide com as combinacoes testadas de valor pai, juros e desconto. Logo nao ha conversao financeira defensavel por formula simples; manter em revisao sem efeito operacional e buscar contrato do pedido/recebimento de origem antes de interpretar o valor.
- Correcao da chave de pedido: "numero presente" incluia o valor `0`, que e convencao de ausencia e nao identifica Pedido. Nos 38.801 lancamentos com parcela, 9.437 tem pedido `0` e 29.364 tem numero positivo; entre as 1.233 divergencias, 364 tem pedido `0` e somente 869 numero positivo. Cinco numeros positivos repetem entre 12 lancamentos, de modo que nem o positivo prova sozinho uma relacao 1:1. Inventario estrutural privado de pedidos de venda cobre apenas recorte aberto e nao fornece valor comparavel para todo esse historico. Nao vincular os 364 por pedido nem conciliar automaticamente os 869 por igualdade de numero; exigir banco/empresa, tipo de pedido e semantica do recebimento. Analise agregada em leitura somente; nenhum efeito operacional.
- Verificador local nao publicado passou a distinguir as 1.233 divergencias por chave: 364 sem pedido positivo, 4 com numero positivo repetido no conjunto de caixa e 865 com numero positivo unico nesse conjunto. Testes sinteticos Linux 4/4 e leitura real com manifesto 80.750/49.601 passaram. A unicidade no caixa nao comprova vinculo com o Pedido de origem. Copia recuperavel restrita foi atualizada na VPS; Python local indisponivel neste computador. Gate global de codigo continua pendente, portanto sem commit/push do script ou teste.
- Piloto Cliente ampliado em 13/10, somente no PostgreSQL descartavel privado da VPS (`--network none`, sem port binding, dados em tmpfs), reutilizando o executor privado anterior e 24 migrations canonicas. Auditoria integral: 18.458 candidatos com documento em formato valido e sem duplicidade documental interna ou com os 4.437 Clientes em quarentena; fingerprints coincidem entre staging original e gates derivados, que atribuem um unico Grupo sem modificar o original. Cinco codigos candidatos ja tem retencao por seis colisoes com alvos referenciados. Exatamente 17.983 candidatos compartilham o conjunto de bloqueios gerais aceito pelo ensaio; 475 tem bloqueio individual adicional ou combinacao de bloqueios distinta e nao entraram no lote. O ensaio com 5.000 e depois com os 17.983 inseriu/reabriu 17.983/17.983, retry identico criou zero, fingerprint alterado foi detectado, uma edicao foi reaberta e a reversao deixou zero Grupo/Cliente/mapa; container removido, `integrity_check=ok` nas fontes SQLite. Nenhuma linha foi importada no operacional. O ensaio direto no banco nao prova API, RBAC, concorrencia ou autorizacao de carga; linhagem CSV historica, referencias opcionais e identidades de destino seguem gates.
- Subcoorte adicional dos 475, sem promover vinculos: 281 Clientes tem somente `SOURCE_REFERENCE_MASTER_MISSING` alem dos bloqueios gerais da sua combinacao. Em fonte de dependencia separada, sao 281 referencias sem mestre de vendedor e 3 sem mestre de tabela de preco, todas sem target ID. O contrato `clientes` nao exige esses vinculos; o ensaio isolado inseriu/reabriu 281/281 campos escalares e identidade legada, retry 0, fingerprint divergente detectado, edicao/reabertura 1/1 e reversao 0. Nenhum ID auxiliar foi inventado ou gravado. O staging e a fonte de dependencias permanecem intactos (`integrity_check=ok`), container removido. Esses 281 continuam retidos para qualquer uso que dependa de vendedor/preco; o piloto nao altera `import_authorized=0`. Restam 194 candidatos fora dos ensaios escalares, alem dos 4.437 Clientes em quarentena.
- Analise dos 194 restantes: 186 Clientes tem `CROSS_ENTITY_ROLE_REVIEW`. Em staging privado, cada um possui exatamente um Fornecedor do mesmo Grupo e mesmo documento normalizado, mas com codigo legado diferente: 175 Fornecedores candidatos e 11 em quarentena. Em 19 casos, procurar Fornecedor pelo codigo do Cliente apontaria para documento diferente. Crosswalk derivado e reaberto em armazenamento privado restrito (diretorio 700, SQLite 600) preserva codigo/fingerprint de ambas as entidades, papel, coorte e proveniencia; 186 pares unicos, `integrity_check=ok`, zero target IDs, `import_authorized=0`, status `PROPOSED_NOT_APPLIED`. Hashes das fontes antes/depois iguais. Documento compartilhado sugere dupla funcao, nao autoriza merge de Cliente/Fornecedor nem resolve os outros oito casos (colisao de destino, revisao documental ou combinacao de bloqueios). Reconciliacao humana e contrato canonico de Fornecedor continuam pendentes.
- Ensaios escalares isolados adicionais: 177 Clientes com apenas revisao de papel e 9 com revisao de papel mais mestre auxiliar ausente foram carregados separadamente em `clientes` de PostgreSQL descartavel, reabertos 177/177 e 9/9, retry 0, fingerprint divergente detectado, edicao/reabertura 1/1 em cada coorte e reversao final 0. Nao foram criados Fornecedores, vinculos entre papeis ou IDs auxiliares. Somados aos ensaios anteriores, 18.450 Clientes candidatos tiveram persistencia escalar comprovada em coortes isoladas, nunca simultaneamente no operacional. Os oito candidatos restantes: cinco com `target_code_collision_review` (dois tambem com referencia auxiliar ausente), dois com `DOCUMENT_FORMAT_REVIEW` e um com combinacao de bloqueios gerais distinta. Os dois CPFs marcados para revisao documental tem 11 digitos e digitos verificadores validos no valor normalizado, mas isso nao prova fidelidade ao bruto nem remove o bloqueio. Nenhum caso foi liberado para importacao operacional.
- Reconciliacao relacional adicional no staging: 80.750/80.750 IDs de caixa e 49.601/49.601 pares pai/parcela sao unicos; zero parcelas sem lancamento pai. Os 2.489 `NO_CLIENT` de caixa usam codigo de Cliente `0` na origem (convencao), nao indicam orfandade de parcela. Isto nao resolve titulos, baixas ou significado do valor divergente.
- Recuperacao do codigo local: copia privada restrita do verificador e teste em `/root/erp-private/legacy-audit-validation` na VPS, hashes local/remoto iguais e permissao 600 nos arquivos. Na rodada anterior, teste sintetico Linux 3/3 e leitura real passaram, mas Node nao estava disponivel. A validacao vigente abaixo substitui essa limitacao de ambiente.

### Validacao vigente do verificador e fila financeira (13/10)

- Worker de enderecos, prototipo privado extraido do harness existente: consome o payload ja mapeado e reutiliza createApp/ClienteLocalService/repositorios/RBAC/auditoria. Servico e mapa passam a compartilhar uma unica transacao PostgreSQL, com chave de lock incluindo Grupo/origem; nenhuma rota ou modulo paralelo foi criado no ERP. Dez enderecos reais, com contexto de identidade de teste, passaram: dois workers aguardando a mesma chave produziram um create e um replay, mesmo ID/mapa; repeticao integral zero novos registros; falha entre servico e mapa reverteu local/finalidade/auditoria/mapa. Usuario sem importar foi bloqueado.
- Atualizacao controlada, ainda no prototipo: exige fingerprint/snapshot anteriores e editar canonico; enriquecimento de referencia com o texto bruto conhecido manteve ID, revisao e replay, sem downgrade automatico. Dois alvos com identidade legada igual foram rejeitados como ambiguos (fixtures). Bruto preservado em dez mapas. Reversao seletiva inativou nove enderecos do lote, deixou um protegido por edicao externa e conservou tres fixtures fora do lote sem alteracoes. Clientes de teste foram retidos para proteger essas referencias durante a prova e removidos apenas pelo cleanup do destino descartavel; containers/rede removidos. Nao declarar rollback integral de todos os enderecos nem importacao operacional. Prototipo ainda depende de integracao/revisao e Auth real.
- Publicacao tem decisao especifica pendente do proprietario: AGENTS 16/18 mantem bloqueio por typecheck global, mesmo com testes focados e Linux audit/test/lint/build aprovados. Alternativas concretas: priorizar correcao do passivo frontend antes de publicar, ou autorizar expressamente ajuste da regra existente para excecao restrita ao verificador/teste sem runtime, exigindo checks executados e evidencia de nao regressao; nenhuma excecao foi aplicada. Pacote privado recuperavel de cinco arquivos de codigo (sem JSON/CSV/SQLite/dados reais) foi preparado para revisao, junto das copias em seus caminhos originais. Codigo do worker permanece prototipo, nao importador operacional aprovado; outras ondas seguras continuam enquanto a decisao esta pendente.

- Concorrencia e rollback pelos servicos publicados, sem alterar runtime: no PostgreSQL isolado, duas criacoes do mesmo Cliente foram bloqueadas simultaneamente na reserva canonica e liberadas juntas; respostas 201/409, um cadastro e apenas um incremento confirmado da sequencia. Falha injetada na auditoria retornou 500 e reverteu cadastro, reserva e auditoria. Para ClienteLocal, duas requisicoes atingiram o lock de Cliente ja existente no repositorio; 201/409 e um local. Falha na auditoria do local reverteu endereco/finalidade e preservou auditoria anterior. Foram usados dois Clientes documentais reais e, em outro ensaio, dez pares Cliente/endereco previamente comprovados; reabertura/replay/RBAC/reversao passaram, zero importados ativos. Fixtures de falha/locks ficaram apenas no banco descartavel, containers/rede removidos. Isso comprova concorrencia dos endpoints, nao do worker/mapa de importacao distribuido; Auth real e demais gates permanecem. Harness/logs privados recuperaveis.

- Seis casos finais de mestre Cliente esclarecidos: cinco codigos legados colidem com cinco Clientes distintos no Grupo CPA, sem documento igual. O relatorio antigo tinha sexto par em outro Grupo, excluido do ensaio; codigo fora do Grupo nao serve para vinculo. Sequencia canonica Cliente atual foi conferida acima do maior codigo numerico do Grupo, sem reserva/escrita no destino real. O caso de combinacao distinta tem mestres unicos, sem zero/ref ausente/documento duplicado/papel compartilhado; era exclusao do seletor por igualdade estrita de blockers, nao conflito individual de origem.
- API isolada em destino nao vazio: seis novos Clientes reais, cinco copias de Clientes atuais do Grupo e referencias sinteticas de teste. Backend reservou novos codigos internos, codigo_legado/identidade de origem preservados; reabertura/auditoria 6/6, replay 0, edicao e controles Auth/RBAC/tenant passaram. Reversao deixou zero importados ativos, conservando os campos/IDs/codigos das cinco copias e cinco referencias de teste. Um alvo de outro Grupo nao foi copiado nem alterado. Plano privado dos seis casos registra reserva de novo codigo quando aplicavel e zero novos IDs destino/import_authorized; colisoes no manifesto original nao foram apagadas nem aprovadas para operacao. Mestres ensaiados em coortes separadas passam a 18.458/18.458 candidatos; campos/vinculos ainda nao mapeados, Auth real, importer concorrente e gates continuam pendentes. Containers/rede removidos, nenhum cadastro real sobrescrito.

- Dois Clientes com DOCUMENT_FORMAT_REVIEW foram esclarecidos por fonte/API: TIPOCLIENTE F, CPF bruto com pontuacao (14 caracteres), 11 digitos iguais ao staging e CGC apenas sentinela zero. A API canonica recebeu o bruto original, validou CPF, preservou bruto/normalizado e reabriu campos 2/2; RBAC/tenant, auditoria create 2/2, retry, edicao e reversao zero ativos passaram em isolamento (Auth de teste). Sem troca de documento ou uso de CGC zero.
- Copia privada derivada de gates remove somente DOCUMENT_FORMAT_REVIEW nesses dois casos e registra a resolucao/source fingerprint; original preservado por hash. Reabertura conferiu 25.178 chaves/fingerprints/escopos/autorizações iguais e dois registros de resolucao, import_authorized=0 e nenhum target_master_id. Bloqueios gerais de fonte/alvo/importador permanecem. Total de mestres Clientes ensaiados em coortes separadas passa a 18.452; restam seis da fila antes de oito: cinco colisoes de destino e um conjunto de bloqueios diferente. Isto nao libera operacao nem os outros vinculos em revisao. Harness/provas/brutos ficam privados recuperaveis, containers/rede removidos.

- Replay de ClienteLocal comprovado no harness privado: mapa por identidade legada, fingerprint de origem e hash deterministico da transformacao. Segunda execucao de 100 enderecos pela mesma API isolada reutilizou 100 IDs, zero novos locais; alteracao de fingerprint e alteracao de numero com fingerprint igual foram rejeitadas antes de escrita. Duplicacao direta no endpoint retornou 409; 100 auditorias create de ClienteLocal conferidas, campos/finalidades e edicao reabertos, reversao final zero ativos. Essa prova cobre replay sequencial do harness e validacao canonica, nao importador de producao com concorrencia/transacao entre mapa e HTTP. Copia privada recuperavel atualizada; Auth segue provedor de teste, operacional zero. Nao promover ou sobrescrever origem por mudanca de fingerprint.

- ClienteLocal avancou alem dos escalares: contrato/arquivo SQL existentes confirmam ausencia de coluna numero separada; ele aparece em parte do ENDERECO textual. Nos 18.458 candidatos, regra estrita de numero literal no ultimo token apos virgula identifica 2.321; 2.248 tambem possuem CEP/UF/bairro/cidade completos, 73 carecem de outros campos, 16.137 nao atendem a regra e nao foram preenchidos por suposicao. Essa contagem nao aprova carga de toda a coorte.
- Selecionados 100 Clientes/endereco (50 PF/50 PJ), seis campos confrontados com extracao SQL direta ja recebida: 99 conferiram inicialmente, um ENDERECO diferiu apenas em espacos. A limpeza existente no contrato ClienteLocal produz mesmo logradouro/numero; prova privada v2 registra a resolucao mantendo bruto e insumo inicial. Ensaios de 10, 99 e depois 100 passaram API canonica/PostgreSQL isolados: campos de Cliente e endereco reabertos 100/100, finalidade CADASTRAL (sem principal presumido), edicao/reabertura Cliente e Local 1/1, RBAC/tenant, 100 auditorias create de Cliente e replay de identidade do mestre sem duplicacao. Locais foram reconsultados, mas nao foi declarado importer de enderecos idempotente de producao. Reversao pelos endpoints inativou locais/vinculo sintetico/Clientes e deixou zero ativos; containers/rede removidos. Auth permanece com provedor de teste, Supabase real pendente. Nenhum saldo, limite de credito, geocoding ou operacao fiscal criado; carga operacional zero. Insumos/harness/logs/provas permanecem privados recuperaveis.

- Piloto Cliente pela API canonica, alem do ensaio SQL: lotes de 10 e 100 registros reais (100 = 50 PF/50 PJ) extraidos do staging somente leitura e conferidos por fingerprint, usando createApp/ClienteService/PostgresClienteRepository publicados, PostgreSQL descartavel e rede Docker interna sem portas publicadas. Middleware supabase_user ativo com provedor de identidade de teste injetado, nao homologacao do Supabase real. Os 14 campos disponiveis suportados no mestre foram mapeados/reabertos 100/100, com origem MIGRACAO e identidade legada preservada; codigo interno reservado pelo backend. Sem token/token invalido -> 401, permissoes de criar/editar ausentes -> 403, outro Grupo -> bloqueio, repeticao direta -> DUPLICATE_DOCUMENT 409. Reexecucao pelo mapa privado/fingerprint reabriu os mesmos IDs e criou zero; esse mapa e o harness do piloto, nao endpoint de importacao idempotente de producao. Auditoria de criacao 100/100; edicao/reabertura 1/1.
- Relacionamento foi exercitado com Empresa sintetica isolada: ClienteEmpresa PROSPECT sem habilitacao operacional, reabertura 1/1, retry sem novo vinculo e Empresa de outro Grupo rejeitada. Reversao pelos endpoints canonicos inativou vinculo/100 Clientes e deixou total ativo zero, preservando auditoria ate cleanup. Containers/rede removidos; hash do staging original permaneceu igual. Enderecos/cobranca e referencias auxiliares ficam preservados no staging: payload de origem nao traz campo numero exigido por ClienteLocal, portanto nao houve preenchimento presumido nem carga de enderecos. Falha inicial de infraestrutura SCRAM entre containers foi resolvida com senha efemera do banco isolado, sem usar credenciais operacionais.
- Harness, insumos reais e logs sao privados recuperaveis; codigo de runtime nao alterado. O lote confirma comportamento API/RBAC e persistencia dos campos mapeados, mas ainda faltam Auth real homologado, mapeamento de campos/endereco restantes, importador canonico com concorrencia/idempotencia, oito excecoes e gate de carga. Importacao operacional zero.
- Proposta concreta para precondicao de publicacao do verificador, dentro dos documentos existentes: manter bloqueio da secao 16/18, tratar passivo global em lote coordenado de frontend comecando pelos contratos compartilhados que concentram TS2339 (925), depois chamadas TS2345 (184), tipos TS2322 (177) e props obrigatorias TS2741 (47); confirmar consumidores antes de corrigir cada contrato e repetir typecheck integral. Nao excluir arquivos, tornar checks opcionais ou mudar expectativas para liberar o lote. O verificador de seis testes e o harness API ficam recuperaveis enquanto essa precondicao nao for satisfeita; outras ondas privadas/isoladas continuam.

- Produto/classe e recuperacao de GrupoProduto pre-VPS: a fila cadastral de 37 classes cobre 1.208 Produtos. Comparacao por nome normalizado com 91 grupos do snapshot antigo encontrou tres propostas unicas (81 Produtos), sem igualdade simultanea de codigo; 34 classes (1.127 Produtos) sem correspondencia. O arquivo de classes extraido no recorte nao-revenda tem cobertura diferente e nao foi usado para declarar classes ausentes globalmente. SQLite privado de revisao preserva classes/codigos/identidades antigas, 37/1.208 reconciliados e zero vinculos aprovados.
- Separadamente do vinculo Produto/classe, tres grupos auxiliares do ERP novo foram ensaiados em `grupos_produto` de PostgreSQL isolado com 001-024 + 038. IDs antigos mapeados 3/3, codigo original preservado em codigo_origem, codigo interno reservado em GrupoProduto, nome/natureza reabertos 3/3; retry 0, edicao/reabertura 1/1 e reversao removeram apenas recuperados/mapa. Cadastro sintetico de base manteve ID/codigo/nome; container removido. Nenhum Produto foi vinculado por nome nem tipo Revenda assumido para registros do legado; recuperacao/importacao operacional zero.

- Pendencia de schema das unidades esclarecida: `038_cadastros_codigo_registro.sql`, versionada no commit `55fcac4f` e registrada em `schema_migrations` da VPS, cria codigo/codigo_origem. O isolamento anterior tinha apenas 001-024. Nao se trata de DDL sem procedencia; nenhuma migration foi reaplicada na VPS ou adicionada a esta branch. Copia privada da 038 conferiu com o blob versionado. Novo ensaio 001-024 + 038 em PostgreSQL sem rede carregou MT com codigo numerico pela sequencia canonica `UnidadeMedida`, conservou dois IDs antigos no mapa e reabriu toda a semantica 2/2. Repeticao integral 0 novas linhas; edicao/reabertura 1/1; reversao removeu somente a unidade recuperada/mapa, preservando IDs/codigos de dois auxiliares sinteticos de base. Container removido. Origem antiga sem codigo continuou sem codigo no mapa; nenhum codigo legado foi inventado. Recuperacao operacional zero. Para integrar o importador, usar a base canonica que inclui 038, respeitando a branch responsavel por essa migration.

- Recuperacao de unidades pre-VPS, separada do legado antigo: o review privado contem 15 linhas e 10 siglas; KG, UN, MT e TON repetem com mesmo codigo/conteudo, mas PC diverge em `permite_conversao`. Contagem de referencias por sufixo `_id` desse review nao prova ausencia de referencias textuais. CX existe no destino, inativa, com descricao de teste de API; os 43 Produtos CX nao tem alvo ativo utilizavel, e isso nao autoriza reativar ou substituir esse registro. KG/UN atuais possuem diferencas de parametrizacao frente ao snapshot, alem do escopo empresarial; revisar antes de restaurar.
- MT/Metro tem duas identidades antigas distintas, mesma definicao completa (Comprimento, base MT, fator 1), sem codigo antigo preenchido. Ensaio em PostgreSQL privado sem rede, schema versionado 001-024: uma unidade canonica compartilhada e dois mapas de origem, reabertura de todos os campos semanticos 2/2, repeticao do carregamento completo 0 unidades/0 mapas novos, edicao/reabertura 1/1 e reversao 0; container removido. Isto cobre persistencia isolada da unidade, nao Produto/classe ou recuperacao operacional. Primeira tentativa com `codigo` falhou; reproducao confirmou `ERROR: column "codigo" does not exist` no schema 001-024, enquanto a VPS tem `codigo`/`codigo_origem` em unidades. A origem dessa diferenca ainda precisa ser conciliada com o contrato versionado antes de recuperar no destino; nao alterar schema/migrations silenciosamente. IDs e fontes privadas preservados, nenhum fator de conversao adicionado.

- Produto/unidade, conferencia posterior no banco canonico: apenas KG/Quilograma e UN/Unidade ativas no Grupo consultado, ambas com Empresa proprietaria. Cobrem por significado/sigla 989 candidatos (669 KG, 320 UN), com unidade bruta e principal coerentes; reutilizacao no mestre compartilhado exige verificar visibilidade CPA/3Z. Outros 219 nao possuem unidade canonica correspondente: CX 43, PC 164, MT 4, LT 6 e M2 2. Os oito aliases brutos LT/M2 permanecem separados. Matriz privada reaberta em SQLite restrito cobre 1.208 chaves/fingerprints, armazena IDs existentes apenas como candidatos de revisao, tem zero mapeamentos aprovados/IDs de Produto e import_authorized=0; fonte inalterada. Nao criar unidade repetida, promover escopo empresarial ou inventar conversao. Classes dos 73 pares ainda carecem de alvo comprovado.

- A #322 continua exclusivamente documental: os dez commits ate `17cea9ee` alteraram somente STATUS/HANDOFF. Script e teste Python seguem locais, com copias recuperaveis privadas atualizadas. Corrigidos dois defeitos do lote: rejeicao de valores monetarios nao finitos e bloqueio de relatorio que aponte para o SQLite fonte, inclusive hardlink. Seis testes sinteticos passaram e a leitura real conservou 80.750 lancamentos, 49.601 parcelas e 1.233 divergencias.
- Validacao em clone privado do HEAD, Node 22 Bookworm, Python 3 e git: instalacao, audit baseline, `npm test` (771/771), lint e build PASS. Typecheck global exit 2, com 1.633 erros em 260 arquivos; frontend/config/manifests identicos ao HEAD publicado. A primeira imagem minima falhou em cinco testes por ausencia de Python/git; com pre-requisitos, suite integralmente verde. Por AGENTS secao 16/18, codigo continua bloqueado para publicacao. Logs e copia recuperavel privados; nenhum teste removido ou baseline alterado.
- Fila factual privada adicional: 1.233 linhas com valores/fingerprint de origem, relacao de valores, sequencia, datas, chave de pedido e status de Cliente; integridade e hash da fonte antes/depois conferidos, SQLite 600, estado `UNRESOLVED_SEMANTICS`, efeitos autorizados zero. Todas as somas de parcela sao menores que o valor pai, positivas e sem marcador de exclusao; 1.232 sequencias comecam em 1 e uma comeca acima de 1, sem lacuna interna. Datas coincidem com o pai em 1.207 casos; 17 ficam antes e 9 depois. Sao fatos de reconciliacao, sem prova de pagamento parcial, baixa ou saldo devido. Nenhuma correcao de valor aplicada.
- Comercial 360 recebeu a ordem na tarefa propria, confirmou inicio sobre #324 e reservou seus arquivos de preco/snapshot. Legado permanece neste ambiente. Proximos trabalhos: explicar a revisao documental dos dois Clientes e preparar importador/API quando o baseline permitir publicar codigo; gates de fonte, alvo e referencias permanecem.
