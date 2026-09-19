# ERP-RUNTIME-08 — Diagnóstico do Comercial 360º

**Modo:** diagnóstico e documentação.
**Base GitHub:** `f9ba707364d746b8d0150413c3d6a33504677fce`.
**Base DEV declarada:** ERP-RUNTIME-07B, migrations 001–013.
**Não executado:** VPS, migration, banco, API, frontend HTTP, merge e runtime
funcional novo.

## Decisão

**Opção A — próximo agregado único: Condição de Pagamento canônica.** A
migration futura proposta é `014_condicoes_pagamento.sql`; ela não foi criada.

Esta decisão não escolhe Pedido por preferência. O servidor canônico ainda não
tem agregados de Orçamento, Pedido, Estoque, Entrega, Frete, Pagamento ou
Vendedor. Em contraste, a condição comercial aparece como dado oficial que
deve ser revalidado antes de criar Orçamento ou Pedido, enquanto meio de
pagamento, crédito final, frete e estoque são explícita ou tecnicamente
posteriores. A condição é um master comercial pequeno, reutilizável por ambos
os documentos e pelo Financeiro futuro.

Um agregado inclui naturalmente seu cabeçalho e regras de parcelas; isso não é
um módulo paralelo nem um "Commercial Foundation" amplo. Vendedor,
desconto/alçada e crédito exigem decisões adicionais sobre identidade e
política. Agrupá-los agora misturaria responsabilidades sem dependência
circular comprovada.

## Base canônica já fechada

| Domínio | Evidência | Situação |
|---|---|---|
| Produto e Unidade | `006_produtos_base.sql`, `007_produtos_master_data.sql`, `008_produtos_fk_tenant.sql` | Master de Grupo; conversões permanecem no Produto/Unidade. |
| Cliente e ClienteEmpresa | `009_clientes_master_data.sql`, `010_cliente_empresas_comercial.sql`, `clienteTypes.ts` | Cliente é master; elegibilidade é por Empresa. |
| ClienteLocal | `011_cliente_locais.sql`, `clienteLocalService.ts` | Endereço é master do Cliente; não duplicar no comercial. |
| Obra | `012_obras.sql`, `obraService.ts` | Contexto opcional do Cliente, autorizado por Empresa. |
| TabelaPreco | `013_tabelas_preco.sql`, `tabelaPrecoService.ts` | Preço Produto+Unidade, autorização N:N, padrão por Empresa e fallback fail-closed. |

`clienteService.ts` e `clienteTypes.ts` bloqueiam no Cliente master campos
como `limite_credito`, `credito_disponivel`, `tabela_preco_id`, `vendedor_id`,
`saldo_devedor` e `titulo_vencido`. Isso confirma que preço, crédito e vendedor
não devem ser adicionados silenciosamente ao Cliente.

## Evidências comerciais e classificação

| Tema | Evidência | Leitura para o runtime canônico |
|---|---|---|
| Condição de pagamento | `docs/PLANO_CPA_B2B_MARKETPLACE_ERP.md` §§23–24 exige condição oficial e revalidação; `server/` não contém repository/service/migration correspondente. | Ausente no backend canônico; pré-requisito de Orçamento/Pedido. |
| Forma/meio de pagamento | O plano cita `FormaPagamento`, PIX/boleto e pagamento futuro; não há tabela/API server correspondente. | Conceito distinto, pertencente à seleção de recebimento/checkout e ao Financeiro; não entra no 08. |
| Vendedor | `src/pages/Comercial.jsx` preenche `vendedor_id` com o usuário; o plano cita vendedor oficial/Colaborador; `001_foundation.sql` possui `profiles`, mas não vínculo comercial canônico por Empresa. | A UI/planejamento não prova um master Vendedor canônico. Não duplicar Profile/Pessoa. |
| Desconto/aprovação | `AdicionarItemRevendaModal.jsx`, `CalculadorPrecoItem.jsx`, `PedidoFormCompleto.jsx` e `AprovacaoDescontosManager.jsx` calculam/aprovam fluxos Base44. | Legado/UI; não há política server-side canônica. Desconto é transacional, não campo da TabelaPreco. |
| Pedido/Orçamento | `src/pages/Comercial.jsx` usa entidade Base44 `Pedido`; o plano Site CPA descreve Pedido e reutiliza Pedido com `tipo=Orçamento`. Não existem serviço, repository ou migration de venda no `server/src`. | Estruturas legadas/planejadas, não agregados PostgreSQL canônicos. |
| Estoque | `006`/`007` dizem expressamente que Produto não contém saldo, custo ou movimentação operacional; não há agregado server de disponibilidade/reserva. | Produto master existe; consultar, reservar, baixar e produzir permanecem separados e futuros. |
| Entrega/frete | `011` tem finalidade `ENTREGA`; `012` tem `obra_locais`; o plano diferencia DELIVERY/PICKUP e frete pendente. | ClienteLocal é origem; documentos futuros devem snapshotar destino/modalidade. Frete não é pré-requisito do 08. |
| Crédito/elegibilidade | `010_cliente_empresas_comercial.sql` fornece ativo, situação, habilitação e bloqueio. O plano reserva crédito final para fluxo posterior. | Elegibilidade já existe; limite/saldo/crédito avançado não existem e não devem ser duplicados. |
| Produção/armado | O plano Site CPA exige revisão humana e proíbe OP automática. | Consumidor posterior de item sob encomenda; não bloqueia condição de pagamento. |

Os arquivos sob `src/components/comercial` e o plano do Site CPA são evidência
de intenção, fluxo legado ou integração planejada. Eles não substituem os
serviços PostgreSQL, RLS/FORCE, RBAC e auditoria do runtime canônico.

## DAG comercial proposta

```text
Masters fechados: Produto + Cliente + ClienteEmpresa + ClienteLocal + Obra + TabelaPreco
        ├─→ Condição de Pagamento (R08)
        ├─→ Responsável comercial por Empresa e Política de desconto/alçada
        │        └─→ Orçamento canônico (snapshot comercial, versão e validade)
        └─→ Disponibilidade/reserva de estoque
                  └─→ Pedido canônico (pode nascer de Orçamento ou direto)
                            ├─→ faturamento/financeiro
                            └─→ expedição/entrega/produção quando aplicável
```

Orçamento e Pedido são transações da Empresa. Produto, Cliente e Obra são
referências de masters; preço, condição, responsável, itens, desconto,
endereço/modalidade e valores devem ser snapshotados no documento. Mudança
posterior de master não pode mudar histórico.

## Condição de Pagamento — contrato futuro

Condição de Pagamento descreve **quando** o valor vence, não **como** ele é
recebido. Portanto PIX, boleto, cartão, dinheiro e gateway são meio/forma de
pagamento e permanecem para o recebimento/checkout financeiro.

O agregado futuro deve suportar ao menos:

- à vista: uma regra, vencimento no dia base;
- 28 dias: uma regra com prazo de 28 dias;
- 28/35/42: regras ordenadas de vencimento;
- entrada + parcelas: regras ordenadas com divisão explícita;
- quantidade, intervalo ou proporção definidos sem arredondamento silencioso;
- snapshot das regras e da versão/descrição no Orçamento/Pedido, sem gerar
  ContaReceber enquanto o documento não alcançar o evento financeiro correto.

Proposta de ownership: `group_id` e Empresa de origem, com autorização
explícita às empresas do Grupo quando o compartilhamento for necessário. O
uso por uma Empresa exige vínculo ativo dessa Empresa, RLS + FORCE, RBAC
fail-closed, FKs/triggers tenant-scoped e auditoria atômica. Uma futura
referência default nullable em `cliente_empresas` é compatível com o modelo,
mas só deve ser adicionada se o contrato do 08 decidir que o default é parte
do mesmo agregado; não deve ir ao Cliente master.

Eventos futuros: criar, editar, inativar, restaurar, autorizar/desautorizar
Empresa, alterar regra de parcela e definir/remover default. Snapshots de
auditoria incluem IDs, código, nome, regras e flags; não incluem PII, títulos,
dados bancários ou valores de crédito.

## Decisões dos candidatos obrigatórios

| Candidato | Tipo | Decisão e dependência |
|---|---|---|
| Condição de Pagamento | Master/configuração | R08. Necessária antes de Orçamento/Pedido para prazo e parcelamento oficiais. |
| Forma/meio de pagamento | Configuração/integração financeira | Depois do 08. Não confundir com condição nem criar contas a receber cedo. |
| Vendedor/responsável | Relação de identidade/política | Antes de Orçamento, mas não no 08. Reutilizar `profiles`; investigar vínculo Profile×Empresa e eventual Colaborador canônico, sem Pessoa/Vendedor paralelo. |
| Desconto/alçada | Política transacional | Antes de Orçamento/Pedido. Preço original, desconto por item/total e preço final serão snapshot; aprovação, justificativa e segregação serão auditadas. |
| Crédito | Política/financeiro | ClienteEmpresa já decide elegibilidade e bloqueio. Limite/saldo são futuros e não pertencem ao Cliente master. |
| Orçamento | Transação versionada | Depois de condição, responsável e desconto. Pode converter em Pedido, preservando referência, versão, validade e snapshots. |
| Pedido | Transação operacional por Empresa | Depois de Orçamento/políticas ou diretamente quando o fluxo permitir; depende de disponibilidade/reserva no fechamento. |
| Endereço/entrega | Snapshot transacional | Reutilizar ClienteLocal/Obra; endereço de entrega e modalidade são snapshot, não novo master. |
| Estoque/disponibilidade | Operacional | Antes de confirmar/reservar Pedido, não para cadastrar condição ou elaborar proposta sem reserva. Separar consultar, reservar, baixar e produzir. |
| Frete/transportadora/expedição | Operacional/configuração | Consome Pedido; retirada não exige frete. Não antecede R08. |

## Contrato futuro do Comercial 360º

Comercial 360º será uma experiência/orquestrador, não uma base de dados
paralela. Ela chamará serviços canônicos para selecionar Cliente e
ClienteEmpresa elegível, responsável, Obra e ClienteLocal; resolver preço por
TabelaPreco; validar Produto+Unidade; aplicar política de desconto; consultar
disponibilidade; registrar Orçamento/Pedido; e encaminhar o estado resultante
para financeiro, expedição e produção.

Ela não possuirá tabelas próprias de Cliente, Produto, Obra, TabelaPreco ou
endereço. Também não receberá `group_id`, `empresa_id`, preço, desconto,
crédito, estoque ou aprovação como autoridade do cliente/frontend. Backend e
banco revalidarão escopo, allowlists, IDOR e auditoria.

## Roadmap mínimo até o cutover

| Lote | Entrada | Saída e gate | Frontend |
|---|---|---|---|
| R08 | Masters 01–07B | Condição de Pagamento canônica; PostgreSQL real, RLS/FORCE, RBAC, tenant, concorrência e audit. | Não iniciar Comercial 360. |
| Próximo fundamento | R08 | Responsável comercial por Empresa e política de desconto/alçada, após diagnóstico próprio. | Não iniciar tela ampla. |
| Orçamento | Masters e políticas fechados | Agregado versionado, validade, snapshots e conversão auditada. | Pode iniciar interface de orçamento somente após API/gate. |
| Disponibilidade/Pedido | Orçamento e decisão de estoque | Consulta/reserva, Pedido por Empresa e idempotência; depois financeiro/expedição/produção. | Comercial 360 pode iniciar em modo orquestrador após esses contratos. |
| Cutover | Fluxos e gates aprovados | Integração gradual com frontend HTTP explicitamente autorizada. | Sem dual-write ou entidade paralela. |

## Segurança e multiempresa para os próximos lotes

Toda leitura/mutação exige Grupo, Empresa quando aplicável, actor e permissão.
Masters compartilhados usam ownership e vínculos explícitos; transações são da
Empresa e consolidam no Grupo sem cópia física. FKs compostas/triggers,
RLS+FORCE e resposta 404/403 para IDs fora do escopo são obrigatórios.

Desconto, aprovação/reprovação, mudança de condição, escolha de preço,
reserva, conversão, inativação e restore exigem auditoria atômica. Falha de
auditoria, perfil ausente ou contexto incompleto bloqueia a ação. O documento
transacional mantém snapshots mínimos sem duplicar PII nem segredos.

## Bloqueadores do R08

Nenhum bloqueador de informação impede o diagnóstico. A implementação futura
requer autorização própria, especificação do agregado, review humano, branch
de código, backup/precheck e gate PostgreSQL real. Esta etapa não autoriza
`014_condicoes_pagamento.sql`, acesso à VPS ou implementação do Comercial 360º.

## Referências

- `server/migrations/001_foundation.sql` a `013_tabelas_preco.sql`.
- `server/src/services/clienteService.ts` e
  `server/src/repositories/clienteTypes.ts`.
- `server/src/services/tabelaPrecoService.ts` e `013_tabelas_preco.sql`.
- `docs/ERP_RUNTIME_05.md`, `docs/ERP_RUNTIME_06_DIAGNOSTICO.md`,
  `docs/ERP_RUNTIME_06B.md`, `docs/ERP_RUNTIME_07B.md`.
- Histórico: `d42a39f0:docs/ERP_RUNTIME_07_DIAGNOSTICO.md` e
  `84163741:docs/ERP_RUNTIME_07A_ESPECIFICACAO_TABELA_PRECO.md`.
- `docs/PLANO_CPA_B2B_MARKETPLACE_ERP.md` e os componentes comerciais Base44
  citados na tabela de evidências.
