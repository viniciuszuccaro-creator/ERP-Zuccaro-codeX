# ERP-RUNTIME-07 — Diagnóstico arquitetural (próximo agregado)

**Status:** `DIAGNÓSTICO SOMENTE — AGUARDANDO REVIEW HUMANO`
**Modo:** leitura/documentação. Nenhuma migration, código de produção, banco,
API, VPS, frontend HTTP, merge ou RUNTIME-07A.

**Baseline obrigatório (fechamento 06B):**

| Item | Valor |
|---|---|
| Repo | `viniciuszuccaro-creator/ERP-Zuccaro-codeX` |
| `origin/main` neste diagnóstico | `67686298be2fa125966e714b1cf20759a7991765` |
| SHA de referência 06B | `67686298be2fa125966e714b1cf20759a7991765` |
| Commits posteriores a 06B em `main` | **nenhum** |
| Worktree inicial | limpa (somente este documento após o lote) |
| API DEV 3080 | `ERP-RUNTIME-06B` |
| Migrations DEV | 001–012; `012_obras.sql` aplicada |
| PR #25 | mergeado |
| Gate PostgreSQL real | 64/64 pass, 0 fail, 0 skipped (histórico 06B) |
| RLS + FORCE Obra | aprovados |
| Rollback 06A | preservado |
| Frontend HTTP ClienteLocal / Obra | desativado (`HTTP_PILOT_ENTITIES` inalterado) |
| RUNTIME-07 implementação | **não iniciado** |

Se `main` divergir deste SHA no futuro: **não resetar**. Listar commits
posteriores e avaliar legitimidade antes de qualquer 07A.

Convenção de arquivo: o repositório já usa `docs/ERP_RUNTIME_*_DIAGNOSTICO.md`
(sublinhado). Este documento segue esse padrão. Equivale ao nome sugerido
`docs/ERP-RUNTIME-07-DIAGNOSTICO.md`.

---

## 1. Objetivo

Determinar, com evidência deste repositório, o **único** próximo agregado
canônico após a espinha já persistida em PostgreSQL:

```text
Grupo → Cliente → ClienteEmpresa → ClienteLocal → Obra
```

Não escolher por preferência. Não criar módulo paralelo (`TabelaPrecoV2`,
`PedidoNovo`, `EnderecoPedido`, `Contato2`). Comentário isolado não decide.

Regra de decisão (nesta ordem):

1. dependência estrutural (FK / slot já reservado / consumidor bloqueado);
2. roadmap explícito dos diagnósticos 05 e 06B;
3. não duplicar master data já canônico;
4. integridade multiempresa;
5. suporte a módulos posteriores (Orçamento, Pedido, Site, Marketplace);
6. isolamento de tenant;
7. estabilidade **antes** de frontend HTTP;
8. menor retrabalho (reutilizar entidade Base44 existente, não inventar outra).

---

## 2. Gate do repositório (execução deste lote)

```text
branch ........ cursor/erp-runtime-07-diagnostico-392b (criada a partir de origin/main)
HEAD .......... 67686298be2fa125966e714b1cf20759a7991765
origin/main ... 67686298be2fa125966e714b1cf20759a7991765
delta 06B ..... vazio (HEAD == baseline)
worktree ...... limpa antes deste documento
```

`git fetch origin main` confirmou o mesmo SHA. Nenhum commit posterior a
avaliar. Worktree não foi alterada para mascarar divergência.

---

## 3. Mapa das migrations 001–012 (imutáveis)

Nenhuma migration histórica deve ser editada. Reconstrução somente documental.

| ID | Arquivo | Runtime | Finalidade | Entidades | Tenant | RLS/FORCE | Auditoria |
|---|---|---|---|---|---|---|---|
| 001 | `001_foundation.sql` | 01 | Fundação | `groups`, `empresas`, `profiles`, `audit_logs`, `integration_events`, `schema_migrations` | `empresas.group_id` | 002 | `audit_logs` canônico |
| 002 | `002_rls_foundation.sql` | 01 | RLS fail-closed | ENABLE+FORCE nas tabelas 001; **sem** policy permissiva | BFF privilegiado | ENABLE+FORCE | — |
| 003 | `003_marcas_pilot.sql` | 01/02 | Piloto cadastro | `marcas` | `group_id` + `empresa_id` origem | ENABLE+FORCE | via app |
| 004 | `004_tenant_integrity.sql` | 02 | FK tenant | reforço group/empresa em marcas | composto | — | — |
| 005 | `005_cadastros_simples.sql` | 02 | Cadastros simples | `unidades_medida`, `grupos_produto`, `setores_atividade` | group + empresa origem | ENABLE+FORCE | via app |
| 006 | `006_produtos_base.sql` | 02 | Produto base | `produtos` **sem** estoque/custo/**preço**/fiscal operacional | group + empresa origem | ENABLE+FORCE | via app |
| 007 | `007_produtos_master_data.sql` | 03 | Produto master | campos master; sem preço de venda | group | ENABLE+FORCE | via app |
| 008 | `008_produtos_fk_tenant.sql` | 03 | FK tenant produto | integridade composta | group/empresa | — | — |
| 009 | `009_clientes_master_data.sql` | 04 | Cliente master + vínculo | `entity_code_sequences`, `reserve_entity_codigo`, `clientes`, `cliente_empresas` | Cliente = Grupo; vínculo = Empresa | ENABLE+FORCE | via app |
| 010 | `010_cliente_empresas_comercial.sql` | 05 | Elegibilidade comercial | evolui `cliente_empresas` (situação, bloqueio, habilitação) | `group_id` + `empresa_id` | herdado | via app |
| 011 | `011_cliente_locais.sql` | 06A | Endereço canônico | `cliente_locais`, `cliente_local_finalidades`; **OBRA proibida** como finalidade | Local = Grupo+Cliente | ENABLE+FORCE | atômica |
| 012 | `012_obras.sql` | 06B | Obra canônica | `obras`, `obra_empresas`, `obra_locais` | Obra = Grupo+Cliente; Empresa autoriza | ENABLE+FORCE | atômica |

**Não existe** em 001–012: `tabelas_preco`, `tabela_preco_itens`, `pedidos`,
`orcamentos`, `contatos`, `estoques`, `formas_pagamento`, `condicoes_pagamento`.

Produto PostgreSQL é **cadastro master**, não lista de preço. Preço operacional
foi explicitamente excluído em 006/007.

---

## 4. Arquitetura canônica atual (pós-06B)

```text
Grupo
  ├── Empresa                          (identidade jurídica / contexto operacional)
  ├── Produto                          (master; sem preço de venda PG)
  ├── Cliente                          (identidade master no Grupo; documento; código)
  │     ├── ClienteEmpresa             (elegibilidade / bloqueio / situação por Empresa)
  │     ├── ClienteLocal               (endereço físico + finalidades; sem finalidade OBRA)
  │     └── Obra                       (contexto de negócio; código sequencial)
  │           ├── obra_empresas        (autorização de atendimento por Empresa)
  │           └── obra_locais          (N:N → ClienteLocal; 1 principal geral)
  └── (lacuna) TabelaPreco / item      (somente Base44 / UI; slot FK em ClienteEmpresa)
```

### 4.1 Cliente

Identidade master no **Grupo**. Documento único no grupo, código via
`reserve_entity_codigo`, soft delete/restore, paginação, auditoria. Fronteira:
não carrega crédito, preço, vendedor, endereço nem obra. `CLIENTE_FORBIDDEN_FIELDS`
bloqueia `tabela_preco_id`, `vendedor_id`, crédito.

### 4.2 ClienteEmpresa

Vínculo Cliente × Empresa. Elegibilidade, bloqueio, situação comercial,
isolamento por empresa, visão consolidada autorizada no Grupo. **Não** grava
`tabela_preco_id` (mass-assignment / teste 05). Diagnóstico 05 reserva o slot
conceitual: “tabela de preço padrão = relacionamento por empresa; FK aguarda
TabelaPreco PostgreSQL”.

### 4.3 ClienteLocal

Endereço canônico do Cliente. Finalidades CADASTRAL/FISCAL/COBRANCA/ENTREGA/
CORRESPONDENCIA/OUTRO. Principal único por finalidade. Geolocalização e
fingerprint internos. Isolamento por grupo/cliente; operação em empresa exige
ClienteEmpresa elegível. **Não duplicar** logradouro em Obra nem em Pedido
(Pedido futuro = ref + snapshot). Relação com Obra: somente via `obra_locais`.

### 4.4 Obra

Contexto comercial/operacional (`group_id` + `cliente_id`). Código 6 dígitos
por grupo. `obra_empresas` autoriza empresa; `obra_locais` reutiliza Local;
um principal geral. Soft delete/restore sem cascade. RLS ENABLE+FORCE.
Pedido futuro: `obra_id` **opcional**. Endereço **fora** de `obras`. Frontend
HTTP desligado.

A espinha Cliente/Local/Obra está **fechada** para master data de pessoa e
lugar. O próximo agregado não deve reabrir endereço, documento ou finalidade
OBRA.

---

## 5. Evidências pesquisadas (não ranking)

Cada linha: arquivo representativo, significado, natureza, dependências, risco
de duplicar master.

| Tema | Evidência | Significado | Natureza | Dependências | Risco de duplicar master |
|---|---|---|---|---|---|
| Tabela / preço | `docs/ERP_RUNTIME_05_DIAGNOSTICO.md` §10 item 3: **RUNTIME-07 — Tabela de Preço** | roadmap explícito pós Local/Obra | requisito futuro **nomeado** | Produto PG (já existe); ClienteEmpresa (slot) | alto se nascer preço em `produtos` ou no Cliente |
| Tabela / preço | `docs/ERP_RUNTIME_06B_DIAGNOSTICO.md` §23: “RUNTIME-07 (preço) permanece o próximo domínio comercial depois de 06B” | confirma sequência após Obra | requisito futuro **nomeado** | 06B fechado | idem |
| Tabela / preço | `src/components/cadastros/TabelaPrecoFormCompleto.jsx`, `TabelaPrecoItem`, `useTabelaPreco`, `AplicadorTabelaPreco` | entidade **existente** Base44 (não módulo novo) | legado operacional vivo | `group_id`, `empresa_id`, `compartilhar_grupo`, vigência, itens por produto | criar `PrecoV2` violaria Regra-Mãe |
| Tabela / preço | `base44/functions/_lib/security/siteCpaCatalogRead/entry.ts` (+ quote/order) | Site CPA resolve catálogo por `condicao_comercial.tabela_preco_id` | consumidor atual Base44 | Cliente comercial + TabelaPrecoItem | snapshot de preço no pedido do site já existe; master deve permanecer a tabela |
| Tabela / preço | `server/src/repositories/clienteTypes.ts` `CLIENTE_FORBIDDEN_FIELDS` | PG **recusa** gravar `tabela_preco_id` no Cliente/vínculo até existir canônico | requisito atual (bloqueio) | TabelaPreco PG | não improvisar coluna em 010 |
| Tabela / preço | `server/migrations/006_produtos_base.sql` / 007 | Produto **sem** preço operacional | requisito atual | — | preço em `produtos` = duplicação |
| Orçamento | `src/pages/OrcamentoSite.jsx` lê `TabelaPrecoItem` | orçamento de site **consome** tabela, não a substitui | legado | TabelaPreco, Cliente, Produto | orçamento PG agora consolidaria dependências instáveis (diagnóstico 05) |
| Pedido / venda | `src/components/comercial/*Pedido*`, `siteCpaOrderCreate` | Pedido Base44; snapshots de tabela/nome | legado + futuro | preço, pagamento, vendedor, local, obra opcional, estoque | Pedido PG agora = monólito (05/06) |
| Comercial | Comercial 360º consulta Obra; não é dono | UI futura | futuro | todos os masters | dono de preço não é a tela 360º |
| Condição / forma pagamento | `FormaPagamentoFormCompleto.jsx`; `CondicaoPagamento` string/template; 05: “FK aguarda FormaPagamento/Condição canônica” | cadastro financeiro Base44; **sem** tabela PG | futuro (lote próprio se faltar) | Empresa, Financeiro | necessário ao Pedido, **não** desbloqueia catálogo/site sozinho |
| Vendedor | 05: identidade ambígua Colaborador/Representante; `vendedor_id` forbidden | não criar `Vendedor` paralelo | futuro / bloqueado | Pessoa/Colaborador canônico PG | duplicação explícita proibida |
| Entrega / expedição | 06/06B: snapshot deriva do Pedido, não do Local mutável | transacional | futuro | Pedido PG + ClienteLocal | endereço paralelo = regressão 06A |
| Obra / cliente / local / endereço | 011–012 + docs 06A/06B | já canônicos | **atual** | — | não reimplementar |
| Telefone / e-mail / responsável / contato | 06B §H “depois (sem Pessoa canônica)”; 06: `contatos[]` / `ContatoB2B` / `locais_entrega.contato_*` | PII fragmentado; sem Pessoa PG | futuro | Pessoa/contato canônico | agregado agora misturaria PII com preço/obra |
| Estoque | 006/007 excluem estoque; 05 marca RUNTIME-08 | disponibilidade de venda | futuro nomeado **depois** de preço | Produto, LocalEstoque, concorrência | 3 caminhos de reserva atuais; lote contábil |

Comentários de UI (“V21.0”, “PriceBrain”) **não** definem o modelo PG.
A existência de `TabelaPreco` Base44 + slot FK + exclusão de preço em Produto
**sim**.

---

## 6. Matriz de candidatos (somente sustentados pelo repo)

Não há pontuação subjetiva. Colunas descrevem evidência.

### 6.1 TabelaPreco / TabelaPrecoItem (preço comercial)

| Aspecto | Evidência |
|---|---|
| Propósito | Lista comercial versionável de preços por produto, no contexto de grupo/empresa, aplicável a ClienteEmpresa, Site, Orçamento e Pedido |
| Evidências | 05 §10 R07; 06B §23; UI/entidade Base44; Site CPA; `CLIENTE_FORBIDDEN_FIELDS`; Produto PG sem preço |
| Dependências já satisfeitas | `groups`, `empresas`, `produtos` (001–008); ClienteEmpresa (009–010) para **aplicação** futura |
| Pré-requisito para Venda/Pedido | **sim**: pedido/site já leem tabela; sem PG o comercial 360º e o BFF não têm preço canônico |
| Risco de duplicação | médio-alto se copiar preço no Produto, no Cliente master ou no item do Pedido como única fonte |
| Tenant boundary | `group_id` obrigatório; `empresa_id` de propriedade/contexto (UI já grava ambos; `compartilhar_grupo` existe no legado) |
| N:N | possível `tabela_preco_empresas` **ou** flag de compartilhamento; **ainda não decidido** (ver §8) |
| Sequência | `codigo_tabela_legado` já existe; código interno via `reserve_entity_codigo` é o padrão 04–06B |
| Soft delete | padrão `ativo=false` + restore; itens acompanham a tabela |
| Auditoria | reutilizar `audit_logs`; sem PII de cliente |
| RLS/FORCE | obrigatório no padrão 002/012 |
| RBAC | Cadastros.TabelaPreco / item (legado já usa permissões de cadastro) |
| IDOR / cross-group / cross-company | risco clássico de lista de preço “global”; sanitizador Base44 **já** deixou de tratar TabelaPreco como catálogo global |
| PII | preço não é PII; não copiar documento/endereço do cliente para a tabela |
| Frontend | `TabelaPrecoFormCompleto` existe; HTTP piloto **não** deve ligar até 07A aprovado |
| Integrações futuras | Site CPA, Marketplace, Orçamento, Pedido, ClienteEmpresa.tabela_preco_id, IA de preço (somente sugestão) |
| Nome provável da migration | `013_tabelas_preco.sql` (**não criada**) |

### 6.2 Pedido / Venda

| Aspecto | Evidência |
|---|---|
| Propósito | documento transacional de venda |
| Evidências | dezenas de consumidores Base44; 05: “não cabe em lote pequeno”; 06B: `obra_id` opcional **não implementado** |
| Dependências **não** satisfeitas | TabelaPreco PG, condição/forma PG, vendedor canônico, estoque/reserva, snapshot Local, NF/financeiro |
| Pré-requisito invertido | Pedido **depende** do preço; preço não depende do Pedido |
| Risco | máximo (monólito + snapshots + estoque + fiscal) |
| Migration | **não** 013 |

### 6.3 Orçamento

| Aspecto | Evidência |
|---|---|
| Propósito | negociação pré-pedido |
| Evidências | 05 R09; três trilhas atuais; `OrcamentoSite` lê TabelaPrecoItem |
| Dependências | ClienteEmpresa, Local/Obra opcional, **preço**, pagamento |
| Risco | consolidar trilhas com masters ainda Base44 |
| Migration | não 013; roadmap R09 |

### 6.4 Estoque / disponibilidade

| Aspecto | Evidência |
|---|---|
| Propósito | saldo e reserva concorrente |
| Evidências | 05 R08; 006/007 excluem estoque |
| Dependências | Produto, local de estoque, política de reserva (3 caminhos) |
| Relação com Pedido | bloqueador de venda, **depois** de haver preço canônico para cotar |
| Migration | não 013; roadmap R08 |

### 6.5 FormaPagamento / Condição de pagamento

| Aspecto | Evidência |
|---|---|
| Propósito | instrumento e prazos |
| Evidências | UI Cadastros Financeiro; 05: necessário antes de R09; `CondicaoPagamento` ainda string |
| Dependências de Pedido | sim, checkout |
| Dependências já quebradas no Site | Site também precisa de **tabela** para formar o item |
| Risco de escolher agora | deslocaria R07 nomeado; não preenche o slot `tabela_preco_id` |
| Migration | lote próprio se R09/Pedido exigirem; **não** o agregado imediatamente após Obra segundo 05/06B |

### 6.6 Vendedor / Colaborador

| Aspecto | Evidência |
|---|---|
| Propósito | responsável comercial por empresa |
| Evidências | 05: identidade ambígua; criar `Vendedor` paralelo **proibido** |
| Pessoa canônica PG | **ausente** |
| Decisão | **insuficiente** para 013; aguarda Pessoa/Colaborador |

### 6.7 Contato / telefone / e-mail / responsável de Obra

| Aspecto | Evidência |
|---|---|
| Propósito | PII de comunicação |
| Evidências | 06B: responsáveis depois, sem Pessoa; 06: três modelos de contato |
| Risco | duplicar PII; misturar com local/obra |
| Decisão | não 013; exige Pessoa canônica |

### 6.8 Endereço de Pedido / expedição

| Aspecto | Evidência |
|---|---|
| Propósito | destino logístico |
| Evidências | 06A/06B: ref ClienteLocal + snapshot no documento transacional |
| Risco | tabela paralela de endereço = violar 06A |
| Decisão | não é agregado master; nasce **com** Pedido |

Nenhum outro candidato (CRM, Projeto, Marketplace, NF) tem evidência de ser o
**próximo** após Obra.

---

## 7. Decisão

**PRÓXIMO AGREGADO = TabelaPreco (preço comercial canônico), persistido com
itens (`TabelaPrecoItem`), reutilizando a entidade Base44 existente.**

Não é continuação da cadeia de pessoa/lugar. Essa cadeia **já fechou** em 012.
O próximo domínio comercial nomeado pelo próprio repositório, com dependências
PG já disponíveis (Produto + Empresa + slot ClienteEmpresa) e consumidores
vivos (Site, Orçamento, Pedido Base44), é a lista de preço.

Justificativa objetiva:

1. `ERP_RUNTIME_05_DIAGNOSTICO.md` define RUNTIME-07 = Tabela de Preço, após
   RUNTIME-06 Locais (depois refinado em 06A Local + 06B Obra).
2. `ERP_RUNTIME_06B_DIAGNOSTICO.md` §23 confirma: após código 06B, o próximo
   domínio comercial é preço; não iniciar 07 no diagnóstico de Obra.
3. `tabela_preco_id` está **proibido** no PG precisamente porque a tabela
   canônica ainda não existe — o slot é o contrato de composição.
4. Produto PG existe e **não** deve absorver preço de venda (006/007).
5. Pedido/Orçamento/Estoque **dependem** de preço ou são lotes posteriores
   nomeados (R08, R09, Pedido depois).
6. Contato/Vendedor/endereço de entrega não têm Pessoa/Pedido PG e violariam
   não-duplicação se nascessem agora.

**Não bloqueado.** Informação suficiente para nomear o agregado e a migration
**proposta**. Detalhes internos de compartilhamento, vigência e FK em
ClienteEmpresa ficam em OBRIGATÓRIO / PROVÁVEL / AINDA NÃO DECIDIDO (§8).

RUNTIME-07A **não** está autorizado por este documento.

---

## 8. Migration 013 — somente proposta (sem SQL)

**Nome proposto:** `013_tabelas_preco.sql`  
**Não criar. Não aplicar.**

Uma única migration aditiva, no espírito de 012 (núcleo + filhos no mesmo
arquivo). 001–012 imutáveis.

### 8.1 OBRIGATÓRIO (se 07A for autorizado)

- Tabelas: `tabelas_preco` (cabeçalho) e `tabela_preco_itens` (filhos).
- PK UUID; `UNIQUE (id, group_id)` no cabeçalho para FK composta das filhas.
- `group_id` NOT NULL → `groups`.
- Cabeçalho com `empresa_id` NOT NULL → `empresas` (propriedade comercial da
  lista; ver AINDA NÃO DECIDIDO para compartilhamento).
- Item: `tabela_preco_id` + `group_id` (FK composta para o cabeçalho);
  `produto_id` + `group_id` (FK composta para `produtos`) — **mesmo grupo**.
- Unicidade de item ativo: um produto por tabela (parcial se soft delete).
- Soft delete `ativo` no cabeçalho e nos itens; restore; **sem** hard delete.
- Checks: nome não vazio; valores monetários ≥ 0; datas de vigência consistentes
  se ambas existirem (`data_fim` nula = aberta).
- Índices: `(group_id, empresa_id)`, `(group_id, codigo)` se houver código,
  `(tabela_preco_id)` nos itens, busca por produto.
- Triggers de integridade cross-tenant no padrão 012 (produto e empresa do
  mesmo `group_id` da tabela).
- RLS ENABLE + FORCE nas duas tabelas; **sem** policy permissiva (padrão 002);
  BFF privilegiado + filtro no backend.
- `REVOKE ALL … FROM PUBLIC`.
- Reutilizar `audit_logs`; mutação + audit na mesma transação; rollback se
  audit falhar.
- Mass-assignment: allowlist; não aceitar preço no PATCH de Produto/Cliente.
- Não criar endereço, cliente, obra, pedido, estoque, forma de pagamento.

### 8.2 PROVÁVEL

- Código interno `reserve_entity_codigo(group_id, 'TabelaPreco', n)` +
  preservação de `codigo_tabela_legado` (já existe no cadastro Base44, max 64).
- Campos de vigência `data_inicio` / `data_fim` e flag `ativo` (UI atual).
- Tipo textual controlado (legado: `Padrão` etc.) — vocabulário a fechar no 07A.
- Itens com preço, unidade herdada do Produto (não duplicar descrição master;
  snapshot descritivo só se o 07A provar necessidade de histórico de item).
- Margem / desconto máximo **no item** (UI `TabelaPrecoItem` já tem campos
  conceituais no STATUS legado) — sem motor de alçada neste lote.
- Seed sintético A/B (duas empresas, um produto, tabelas isoladas).
- Meta API `ERP-RUNTIME-07A` somente no lote de código futuro; `frontendHttp=false`.

### 8.3 AINDA NÃO DECIDIDO (07A não pode inventar sem review)

- Compartilhamento entre empresas do mesmo grupo: coluna `compartilhar_grupo`
  (legado UI) **versus** tabela `tabela_preco_empresas` (espelho de
  `obra_empresas`). Evidência legado = flag; evidência 06B = N:N explícito.
  **Não copiar a flag cegamente** se o isolamento cross-company exigir vínculo.
- FK `cliente_empresas.tabela_preco_id` **nesta** 013 ou lote 07B: o slot é
  real, mas 010 foi propositalmente sem preço. Incluir FK agora reduz janela
  de inconsistência; adiar evita inflar 013. Precisa decisão humana.
- Versionamento imutável (nova tabela a cada revisão) versus update in-place
  com audit. Legado tem “histórico de alterações” só na UI.
- Precisão monetária / moeda (cadastro `MoedaIndice` Base44, sem PG).
- Recálculo em lote / IA PriceBrain: **fora** do núcleo 013 (sugestão, não
  persistência autônoma).
- Principal “tabela padrão da empresa” além do vínculo ClienteEmpresa.
- Dual-write Base44: **fora**; cutover só após E2E.

---

## 9. Modelo multitenant

- **Tenant raiz:** `group_id`. Nenhuma linha de preço sem grupo.
- **Empresa:** contexto operacional e, no modelo obrigatório proposto,
  **proprietária** da tabela (`empresa_id` no cabeçalho). Não emitir “preço do
  Grupo” sem empresa dona.
- **Cross-group:** sempre negar. FK composta impede produto/empresa de outro
  grupo. Resposta: **404** se o ator não pode saber que o id existe em outro
  tenant; **403** se o ator autenticado no grupo certo não tem permissão.
  Padrão já usado em Cliente/Obra: não revelar existência cross-group.
- **Cross-company:** tabela da empresa A não opera na empresa B salvo modelo
  de compartilhamento **aprovado**. Visão consolidada no Grupo lista tabelas
  das empresas autorizadas ao usuário, **preservando** `empresa_id`.
- **Aplicação ao cliente:** só via ClienteEmpresa da **mesma** empresa dona
  (ou autorizada). Não gravar tabela no Cliente master.
- **Frontend não autoriza.** Backend + RLS FORCE. Fail-closed sem actor,
  sem `groupId`, sem permissão.

---

## 10. RBAC (conceitual; chaves a cravar no 07A)

Fail-closed. Sem actor/contexto válido = negar.

Proposta alinhada a `Cadastros.TabelaPreco` já usado na UI, granularizado:

| Ação | Chave ilustrativa | Notas |
|---|---|---|
| list / search / count | `cadastros.tabela_preco.visualizar` | paginação server-side; queryKey com grupo+empresa |
| get | idem | 404 cross-group; 403 sem permissão |
| create | `cadastros.tabela_preco.criar` | cabeçalho + itens iniciais na mesma TX se o contrato exigir |
| update | `cadastros.tabela_preco.editar` | allowlist |
| inactivate | `cadastros.tabela_preco.inativar` | soft delete |
| restore | `cadastros.tabela_preco.restaurar` | |
| item link/unlink (CRUD item) | `cadastros.tabela_preco.item.editar` | não criar entidade paralela |
| compartilhar / descompartilhar | `cadastros.tabela_preco.admin` ou `link` | só se N:N for aprovado |
| código legado | campo já existente `…codigo_tabela_legado.editar` | preservar |
| aplicar a ClienteEmpresa | permissão do vínculo 05 **e** visualizar tabela | lote da FK |

Usar tabela no Pedido futuro ≠ editar cadastro (mesmo princípio da Obra).

Administrador sem escopo de grupo/empresa **não** bypassa.

---

## 11. Auditoria e PII

Reutilizar **somente** `audit_logs` (001). Sem log paralelo.

Campos: actor, `group_id`, `empresa_id`, entity (`TabelaPreco` /
`TabelaPrecoItem`), `entity_id`, action, before/after **sanitizados**,
timestamp, origem, correlação, sucesso/falha.

**Não** replicar em snapshot: CPF/CNPJ, telefone, e-mail, endereço completo,
geolocalização. Preço e ids de produto/tabela são dados comerciais, não PII
de pessoa; ainda assim não vazar segredo/token.

Master data permanece canônico:

- documento continua em Cliente;
- endereço continua em ClienteLocal;
- Obra não ganha preço;
- Pedido futuro poderá **snapshotar** preço unitário/nome da tabela (hábito
  já existe no Site CPA) sem tornar o Pedido a fonte master.

---

## 12. Frontend HTTP

Qualquer persistência nova: `frontendHttp=false` até migration + backend +
E2E PostgreSQL real + RLS/RBAC/auditoria/IDOR/cross-group/cross-company/
concorrência/rollback aprovados.

**Não** adicionar `TabelaPreco` nem `TabelaPrecoItem` a `HTTP_PILOT_ENTITIES`.
Piloto atual permanece: Marca, UnidadeMedida, GrupoProduto, SetorAtividade.

UI Base44 existente **não** é cutover. Este diagnóstico não a altera.

---

## 13. Plano de testes futuro (não implementar)

1. Migration 013 idempotente; 001–012 intocadas.
2. Seed sintético A/B convergente na 2ª execução.
3. CRUD cabeçalho e item; normalização de nome/código legado.
4. Unicidade produto×tabela (ativo).
5. Integridade tenant: produto/empresa de outro grupo rejeitados no banco.
6. Cross-group: 404 / sem vazamento.
7. Cross-company: B não lê/edita tabela de A sem autorização.
8. IDOR por UUID.
9. RBAC sem actor = negar; mass assignment (`tabela_preco_id` em Cliente,
   preço em Produto) bloqueado.
10. Soft delete/restore; item de tabela inativa não entra em nova operação.
11. Auditoria atômica; rollback se audit falhar; snapshots sem PII.
12. RLS ENABLE+FORCE; role não privilegiada não lê.
13. Concorrência: `reserve_entity_codigo` se houver sequência; dois POSTs
    simultâneos do mesmo produto na mesma tabela → um sucesso / um conflito.
14. Atomicidade cabeçalho+itens+audit.
15. Paginação/busca/filtros server-side; totais não usam só a 1ª página.
16. 403 vs 404 conforme §9.
17. Meta: `frontendHttp=false`; entidade ausente de `HTTP_PILOT_ENTITIES`.

Não exigir Pedido/NF/estoque neste futuro 07A.

---

## 14. Riscos (o que este diagnóstico tenta impedir)

| Risco | Mitigação |
|---|---|
| Tabela paralela `PrecoV2` / preço em `produtos` | reutilizar `TabelaPreco` + itens; 006/007 permanecem sem preço |
| Duplicar Cliente/Empresa/endereço no preço | só FKs; sem colunas de PII |
| `empresa_id` só no item ou só no grupo | cabeçalho com empresa dona; itens herdam `group_id` |
| Autorização só na UI | backend + FORCE RLS |
| RLS sem FORCE | proibido |
| FK simples permitindo produto de outro grupo | FK composta + trigger |
| Auditoria com PII | allowlist de snapshot |
| Hard delete | soft delete padrão 04–06B |
| Sequência `count+1` | `reserve_entity_codigo` |
| Filtro sem tenant | list/count obrigam group (+ empresa no contexto empresa) |
| Consolidado do grupo vazando empresa não autorizada | mesmo padrão Obra/ClienteEmpresa |
| Existência revelada (IDOR) | 404 cross-group |
| Endpoint HTTP cedo | fora do piloto |
| Escolher Pedido/Estoque agora | dependências e roadmap contra |
| Copiar `compartilhar_grupo` sem N:N | marcado AINDA NÃO DECIDIDO |
| FK `cliente_empresas.tabela_preco_id` improvisada em 010 | 010 imutável; só aditivo futuro |

---

## 15. Fora de escopo deste diagnóstico e de qualquer 07A não autorizado

- SQL 013, seed, API, testes, meta `ERP-RUNTIME-07A`.
- Pedido, Orçamento, Estoque, FormaPagamento PG, Vendedor, Contato, Pessoa.
- Frontend HTTP, dual-write, backfill real, VPS, merge, promoção DEV.
- Alterar 001–012, `HTTP_PILOT_ENTITIES`, runtime DEV.
- PriceBrain/IA executando preço sem confirmação humana.

---

## 16. Critérios de entrada para RUNTIME-07A (autorização **separada**)

1. Review humano deste diagnóstico.
2. Concordância: próximo agregado = TabelaPreco + itens.
3. Decisão explícita dos itens §8.3 (compartilhamento; FK ClienteEmpresa;
   versionamento).
4. Branch de **código** distinta desta documental.
5. DEV permanece 06B até 07A ser promovido por processo próprio.
6. Gate PostgreSQL real e rollback 06A continuam preservados.

Sem esses critérios: **não iniciar 07A**.

---

## 17. Validação deste lote documental

- Única alteração pretendida: este arquivo (+ registro em `STATUS_DO_PROJETO.md`).
- `git diff --check` no fechamento.
- Nenhuma migration/código/test/seed/config.
- Frontend HTTP inalterado.
- Nenhum merge.
- RUNTIME-07A não iniciado.

---

## 18. Referências

- `docs/ERP_RUNTIME_05_DIAGNOSTICO.md` (sequência R05→R06→R07 preço→R08 estoque→R09 orçamento)
- `docs/ERP_RUNTIME_06B_DIAGNOSTICO.md` e `docs/ERP_RUNTIME_06B.md`
- `docs/ERP_RUNTIME_06A.md`, `docs/ERP_RUNTIME_06_DIAGNOSTICO.md`
- `server/migrations/001_foundation.sql` … `012_obras.sql`
- `server/src/repositories/clienteTypes.ts` (`CLIENTE_FORBIDDEN_FIELDS`)
- `server/src/api/router.ts` (meta 06B; `frontendHttp=false`; piloto)
- `src/components/cadastros/TabelaPrecoFormCompleto.jsx`
- `base44/functions/_lib/security/siteCpaCatalogRead/entry.ts`
