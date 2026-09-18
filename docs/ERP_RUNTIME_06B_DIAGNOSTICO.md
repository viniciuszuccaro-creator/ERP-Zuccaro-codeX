# ERP-RUNTIME-06B — Diagnóstico arquitetural (Obra)

**Status:** `DIAGNÓSTICO SOMENTE — AGUARDANDO REVIEW FINAL`
**Base:** `067d002f90b162c507581dfa2f6909b3c1059ed4` (main; ERP-RUNTIME-06A)
**Software/API DEV:** permanece `ERP-RUNTIME-06A`
**Este lote:** documentação. Nenhuma migration, código, VPS ou frontend.

Arquitetura **aprovada** no review. Este arquivo é a fonte canônica de Obra.
`docs/ERP_RUNTIME_06_DIAGNOSTICO.md` guarda o rascunho original
(`obras.cliente_local_id`) como histórico e aponta para cá o modelo final.

---

## 1. Resumo executivo

Obra é **contexto comercial/operacional do Cliente**, não um endereço e não
uma finalidade de `ClienteLocal`.

Cadeia canônica oficial:

```text
Cliente MASTER (identidade no Grupo)
   |
   +-- ClienteEmpresa (elegibilidade comercial por Empresa)
   |
   +-- ClienteLocal (endereço físico canônico + finalidades)
   |
   +-- Obra (contexto comercial/operacional; group_id + cliente_id)
          |
          +-- obra_empresas   → autorização de atendimento por Empresa
          |
          +-- obra_locais     → ClienteLocal (uso_na_obra + principal)
```

Obra **não** é filha de ClienteEmpresa. ClienteEmpresa e `obra_empresas`
são relações de autorização; o dono da Obra é Grupo + Cliente.

Pedido **não exige** Obra. Marketplace, site PF e venda avulsa continuam
válidos sem Obra. B2B/obra industrial podem selecionar ou criar Obra.

O RUNTIME-06A já entregou o endereço canônico.

**Modelo original do diagnóstico 06:** `obras.cliente_local_id` obrigatório
(um Local por Obra) e compartilhamento implícito via ClienteEmpresa.

**Refinamento oficial 06B:** `obra_locais` N:N tipado e `obra_empresas`
explícito. Motivo: uma Obra pode ter local físico, portaria, entrega,
administrativo, fiscal e outros pontos; várias Obras reutilizam o mesmo
ClienteLocal; CPA e 3Z não devem herdar atendimento só porque o Cliente
está elegível.

---

## 1.1 Arquitetura oficial consolidada (review)

```text
Cliente MASTER (identidade no Grupo)
   |
   +-- ClienteEmpresa (elegibilidade comercial por Empresa)
   |
   +-- ClienteLocal (endereço físico canônico + finalidades)
   |
   +-- Obra (contexto comercial/operacional; group_id + cliente_id)
          |
          +-- obra_empresas   → autorização de atendimento por Empresa
          |
          +-- obra_locais     → ClienteLocal (uso_na_obra + principal)
```

Ownership: Obra **não** pertence à Empresa. Empresa opera quando existe
`obra_empresas` **e**, para nova operação comercial, ClienteEmpresa elegível.

Pedido futuro **não** é obrigado a ter Obra. Comercial 360º **consulta**
Obra; não é dono do agregado.

`uso_na_obra` **não** substitui `cliente_local_finalidades`.
Finalidade = papel do endereço para o **Cliente**.
`uso_na_obra` = papel do Local **naquela Obra**.
Exemplo: Local com finalidade ENTREGA no cadastro pode ser `FISICO` na Obra.

Principal no 06B: **um** Local principal **geral** por Obra (`principal=true`
e `ativo=true`). Não significa entrega/fiscal/cobrança padrão do Pedido.
**Não** implementar principal por uso (FISICO/ENTREGA/…) neste lote.

Obra operacional nova: ≥1 `obra_local` ativo e exatamente 1 principal.
Importação legado: staging → resolver Local → criar Obra canônica →
`obra_local` principal → só então operacional. Sem status `INCOMPLETA`.

POST no contexto Empresa, **mesma transação**:

1. Obra;
2. `reserve_entity_codigo(group_id, 'Obra', 6)` (`000001`; UI: `OBRA 000001`);
3. `obra_empresas` da Empresa do contexto;
4. ≥1 `obra_local` do mesmo `group_id` + `cliente_id`;
5. Local principal;
6. auditoria.

Qualquer falha (incluindo audit): **ROLLBACK** completo. Sem Obra órfã,
sem código inconsistente.

Novo Local no Comercial futuro: reutilizar API/serviço ClienteLocal (06A).
Não duplicar endereço em `ObraService`. Se a transação única entre
agregados exigir orquestração, usar application service que chama os dois
repositórios no **mesmo** `db.withTransaction` — sem segundo cadastro de
endereço.

---

## 2. Estado atual

| Item | Estado |
|---|---|
| RUNTIME-06A ClienteLocal | implementado na main `067d002f`; migration `011_cliente_locais.sql` |
| Finalidades de Local | CADASTRAL, FISCAL, COBRANCA, ENTREGA, CORRESPONDENCIA, OUTRO |
| Finalidade OBRA | **proibida** no schema/teste do 06A — preservar |
| Tabela `obras` PostgreSQL | **não existe** |
| API `/obras` | **não existe** |
| Frontend HTTP piloto | Cliente/ClienteLocal **fora** de `HTTP_PILOT_ENTITIES` |
| Legado Base44 | `Cliente.locais_entrega[]` com `tipo_endereco=Obra`; wizard trata local como obra |

O software em DEV permanece RUNTIME-06A. Este diagnóstico não altera runtime.

---

## 3. Evidências encontradas

### 3.1 PostgreSQL já existente (reutilizar)

- `groups` / `empresas` / `profiles` / `audit_logs` / `integration_events` (`001`).
- RLS fail-closed `ENABLE` + `FORCE`, sem policy permissiva (`002`).
- `entity_code_sequences` + `reserve_entity_codigo(group_id, entity_name, width)` (`009`).
- `clientes` no Grupo; `cliente_empresas` com situação, bloqueio e
  `elegivel_operacao` (`009`/`010`).
- `cliente_locais` + `cliente_local_finalidades`, fingerprint textual,
  principal por finalidade, geo em par, RLS (`011`).
- Padrão de serviço: TenantGuard + PostgresRbacGuard + mutação e auditoria
  na mesma transação (R05/R06A).

### 3.2 Legado que mistura Obra e endereço

- `WizardEtapa1Cliente.jsx` lista `cliente.locais_entrega` e grava
  `obra_destino_id` / `obra_destino_nome` + snapshot `endereco_entrega_principal`.
- Site CPA usa `addressId` como `obraId` (`siteCpaWork`, quotes/orders).
- Pedido já tem o hábito correto de **snapshot** de endereço; o ID ainda aponta
  para o local, não para uma entidade Obra.
- UI grava `tipo_endereco: "Obra"`; Site lê `tipo`/`type`/`obra=true`.

Conclusão: o legado trata Obra como apelido de endereço. O modelo canônico
inverte isso: endereço vive em ClienteLocal; Obra referencia um ou mais Locais.

### 3.3 O que o 06 original acertou e o que deve ser refinado

Acertado e preservado:

- Obra não é finalidade de Local;
- Local pertence ao Cliente/Grupo;
- snapshot transacional; master mutável não reescreve histórico;
- código sequencial via `reserve_entity_codigo`;
- várias Obras podem compartilhar o mesmo Local;
- Pedido futuro referencia Obra **e** Local de entrega.

Refinamento obrigatório para o 06B:

| 06 original | 06B recomendado |
|---|---|
| `obras.cliente_local_id` obrigatório único | `obra_locais` N:N tipado; pelo menos um Local principal |
| compartilhamento implícito via ClienteEmpresa | `obra_empresas` explícito, fail-closed |
| cardinalidade “um Cliente, um Local” | um Cliente comercial; N Locais; N Empresas autorizadas |

Não é alteração silenciosa da Regra-Mãe: continua-se melhorando o existente
(Cliente, ClienteEmpresa, ClienteLocal) sem cadastro paralelo de endereço.

---

## 4. Decisões arquiteturais

### A. Entidade canônica Obra

Obra = contexto de atendimento (residência, edifício, reforma, contrato,
frente de serviço, indústria, etc.). Tem código humano, nome, status
operacional da obra, lifecycle técnico (`ativo`), origem/legado e vínculos.

Não é ledger, não é pedido, não é projeto de engenharia, não é endereço.

### B. Tenant

Obra **pertence ao Grupo + Cliente**. Não pertence a uma Empresa.

`empresa_id` na request é contexto de operação/autorização, não ownership.
Visão Grupo autorizada consolida; visão Empresa só vê Obras com
`obra_empresas` ativo **e** `cliente_empresas` elegível.

### C. Compartilhamento entre empresas do Grupo

Sim, a **mesma** Obra pode ser atendida por CPA e 3Z quando ambas estiverem
autorizadas em `obra_empresas`. Não duplicar Obra por Empresa. Faturamento,
estoque e NF continuam da Empresa da transação, nunca do Grupo.

### D. Papel de ClienteEmpresa

Pré-condição de **nova operação comercial** (criar Obra, vincular Empresa
para atendimento novo, usar Obra em venda nova):

1. Cliente e Empresa no mesmo Grupo;
2. `cliente_empresas` existe, `ativo`, habilitado, não bloqueado e
   `elegivel_operacao`;
3. `obra_empresas` ativo para aquela Empresa.

**Visualização histórica** (Obra já existente, Pedidos/NF antigos): RBAC +
tenant + relacionamento autorizado podem permitir leitura **mesmo** se o
Cliente estiver inelegível/bloqueado hoje. Não esconder histórico porque a
elegibilidade atual mudou.

Não basta só ClienteEmpresa ou só `obra_empresas`.

Criar Obra no contexto Empresa cria o vínculo daquela Empresa na mesma
transação. Adicionar outra Empresa: mesmo Grupo; `cliente_empresas` existe;
para ativação operacional nova, ClienteEmpresa elegível; RBAC
`cadastros.obra.vincular-empresa`. Mutação + audit na mesma transação.

Inativar `obra_empresas` (`ativo=false`): não hard-delete; não inativa Obra,
Cliente, Local nem outras Empresas. Restore com RBAC.

### E/F. Relação Obra × ClienteLocal

Não copiar logradouro/CEP/coordenadas para `obras`.

```text
obras 1 ── N obra_locais N ── 1 cliente_locais
```

`obra_locais.uso_na_obra`: `FISICO`, `ENTREGA`, `ADMINISTRATIVO`, `FISCAL`,
`OUTRO`. Flag `principal`: no máximo **um** principal geral ativo por Obra
(`principal=true` AND `ativo=true`). Vínculo inativo **não** pode ser
principal. Troca A→B é atômica (nunca dois principais no commit).

**Fora do 06B:** principal por uso (principal ENTREGA, principal FISICO…).

O mesmo ClienteLocal pode aparecer em várias Obras e em mais de um uso da
mesma Obra. Campos conceituais de `obra_locais`: `id`, `group_id`,
`obra_id`, `cliente_local_id`, `uso_na_obra`, `principal`, `ativo`,
`created_at`, `updated_at`, `created_by`, `updated_by`.

Finalidades de ClienteLocal permanecem do **endereço**. Usos de
`obra_locais` descrevem o papel **na Obra**. Não adicionar finalidade
`OBRA`. Local de outro Cliente/Grupo: bloqueio no banco e no backend.

### G. `obra_empresas`

Sim, no 06B. Representa **autorização de atendimento/operação** da Obra
pela Empresa. **Não** é ownership, faturamento, estoque, crédito, preço ou
série fiscal. A NF futura sai da `empresa_id` do Pedido, nunca do Grupo.

Unicidade `(obra_id, empresa_id)`. Trigger: Obra, Cliente e Empresa no
mesmo `group_id`; deve existir `cliente_empresas` do mesmo Cliente para
aquela Empresa (cadastro). Elegibilidade de **venda nova** continua em
`cliente_empresas.elegivel_operacao`.

Exemplo: Obra 000001 com CPA e 3Z ativas = **uma** Obra, dois vínculos.
Se só CPA estiver vinculada, usuário 3Z não lista operacionalmente, não
vende e não infere dados protegidos. Grupo autorizado vê consolidado.

### H. Responsáveis

**Fora do 06B.** Não há Pessoa/Colaborador canônico no PostgreSQL (mesmo
bloqueio do vendedor no R05). Futuro: `obra_responsaveis` tipado
(engenheiro, arquiteto, comprador, mestre, financeiro, recebedor), não
dezenas de colunas.

### I. Código sequencial

Reutilizar `reserve_entity_codigo(group_id, 'Obra', 6)` → armazenar
`000001` (sem prefixo `OBRA ` no valor). Exibição `OBRA 000001` é só UI.
Escopo **por Grupo**. Nunca `count(*)+1`. Teste obrigatório: duas criações
concorrentes → códigos distintos, sem reaproveitamento. Preservar
`legacy_code`.

### J. Status canônico da Obra

Separar conceitos:

| Conceito | Onde |
|---|---|
| status da obra | `obras.status` |
| lifecycle técnico | `obras.ativo` (soft delete) |
| situação comercial do cliente na empresa | `cliente_empresas.situacao_comercial` |
| status do pedido | Pedido (futuro) |
| status financeiro | título/financeiro (futuro) |

Vocabulário mínimo de `obras.status`:

- `ATIVA`
- `PAUSADA`
- `CONCLUIDA`
- `CANCELADA`

`PROSPECT` não entra: pertence a CRM/oportunidade, não ao canteiro.
`ARQUIVADA` = `ativo=false`, não um quinto status operacional.

Obra `CONCLUIDA`/`CANCELADA`/`ativo=false` permanece visível em histórico e
referenciável em documentos antigos.

**Seleção para nova operação (padrão):** `ativo=true` **e** `status=ATIVA`
**e** `obra_empresas` ativo **e** ClienteEmpresa elegível.

- `PAUSADA`: **não** entra na seleção padrão. Operar exige reativar para
  `ATIVA` ou política/autorização explícita futura — sem exceção silenciosa.
- `CONCLUIDA` / `CANCELADA` / `ativo=false`: fora da seleção nova.
- Histórico continua listável com filtro explícito + RBAC.

### K. Soft delete / restore

Igual Cliente/ClienteLocal: inativar (`ativo=false`), restore, GET de
inativo = 404 na API operacional, listagem padrão só ativos. Sem hard
delete. Sem cascade para ClienteLocal, `obra_empresas`, Pedido/NF/Entrega
futuros. Relacionamentos permanecem para rastreio.

Inativar Local com `obra_locais` **ativo** de Obra **ativa**: **bloquear**.
Exigir desvínculo ou substituição. Se for o principal, outro principal
entra antes ou na mesma transação. Sem cascade. Inativar Obra **não**
inativa o Local.

### L. Duplicidade

Não criar UNIQUE de endereço nem fingerprint de Obra como identidade.
Identidade = UUID. Identificador humano = `codigo`. Possible duplicate é
só proteção operacional.

Alerta conservador `409 POSSIBLE_DUPLICATE` quando, no mesmo Cliente/Grupo,
o **nome normalizado** coincide **e** o Local principal é o mesmo.
**Não** impede casos legítimos: Torre A/B, Reforma 2026/2027, Etapa 1/2
no mesmo endereço. Override explícito (flag/confirmação) + permissão/
política + auditoria `possible_duplicate` / override. Sem merge.

### M. Endereço histórico (Pedido / NF / Entrega / contrato)

Contrato futuro obrigatório, **não implementado no 06B**:

1. `obra_id` opcional;
2. `cliente_local_id` do destino efetivo;
3. snapshot imutável enxuto: `obra_id`/`codigo_obra`/`nome_obra` quando
   houver; dados do Local efetivo; `captured_at`. Não copiar a Obra inteira.

MASTER mutável. Documento transacional imutável. Alterar Obra,
ClienteLocal ou `obra_locais` **não** altera Pedido/NF/Entrega/contrato
antigos.

### N–T. Demais respostas

Ver seções 21–24.

---

## 5. Modelo proposto (conceitual — não é migration)

### 5.1 `obras`

Finalidade: identidade da Obra.

- PK: `id UUID`
- Tenant: `group_id` NOT NULL → `groups`
- Dono comercial: `cliente_id` NOT NULL → `clientes`
- Campos essenciais: `codigo`, `nome`, `status`, `observacao` (opcional,
  sanitizada, tamanho limitado; **não** é depósito de PII, CAD, projeto
  ou instrução logística — isso fica no Local/Entrega), `ativo`,
  origem/legado (`legacy_id`, `legacy_code`, `source_system`,
  `migration_batch`, `imported_at`), actors, timestamps
- Sem: latitude, logradouro, CPF, telefone, crédito, BOM, anexos
- UNIQUE `(group_id, codigo)`
- CHECK `status IN ('ATIVA','PAUSADA','CONCLUIDA','CANCELADA')`
- CHECK nome não vazio
- Trigger: `cliente.group_id = obras.group_id`
- Índices: `(group_id, cliente_id, ativo)`, `(group_id, status, ativo)`,
  `(group_id, updated_at DESC)`
- RLS ENABLE + FORCE; `REVOKE ALL ... PUBLIC`

### 5.2 `obra_empresas`

Finalidade: autorização de atendimento da Obra por Empresa do Grupo.

- PK `id`; UNIQUE `(obra_id, empresa_id)`
- `group_id`, `obra_id`, `empresa_id`, `ativo`, actors, timestamps
- Trigger: Obra/Empresa/ClienteEmpresa no mesmo Grupo; `cliente_id` da Obra
  possui linha em `cliente_empresas` para aquela Empresa
- Índice `(group_id, empresa_id, ativo)`
- Soft delete do vínculo (`ativo=false`); restore
- RLS ENABLE + FORCE

Não guardar limite, tabela de preço, estoque ou série fiscal aqui.

### 5.3 `obra_locais`

Finalidade: reutilizar ClienteLocal na Obra, com papel operacional.

- PK `id`
- `group_id`, `obra_id`, `cliente_local_id`
- `uso_na_obra` CHECK `IN ('FISICO','ENTREGA','ADMINISTRATIVO','FISCAL','OUTRO')`
- `principal BOOLEAN DEFAULT false`
- `ativo`, actors, timestamps
- UNIQUE `(obra_id, cliente_local_id, uso_na_obra)`
- UNIQUE parcial: uma linha `principal=true AND ativo=true` por `obra_id`
- CHECK: `principal=true` implica `ativo=true`
- Trigger: Local e Obra com o mesmo `group_id` **e** o mesmo `cliente_id`
- Índice `(cliente_local_id)` para bloquear inativação do Local
- RLS ENABLE + FORCE

Geolocalização: sempre via join em ClienteLocal. Sem lat/lng em Obra.

### 5.4 Relacionamentos futuros (não criar agora)

| Entidade | Relação |
|---|---|
| `obra_responsaveis` | N papéis → Pessoa/Contato canônico |
| `entity_documents` | anexos genéricos (Cliente, Obra, Pedido, Item, Produto…) |
| Pedido | `obra_id` NULLABLE + `cliente_local_id` + snapshot |
| Projeto/CC | referenciam `obras.id`, não `addressId` |
| Financeiro | dimensão analítica `obra_id` no título; Obra não é ledger |
| Produção | herda `obra_id` do item/pedido quando houver |

Não criar tabela polimórfica de endereço. Não criar `obras_v2`.

---

## 6. Relação Obra × Cliente

| Cenário | Como o modelo cobre |
|---|---|
| 1. Uma obra, um cliente | `obras.cliente_id` = Cliente comercial principal |
| 2. Cliente com várias obras | N `obras` por `cliente_id` |
| 3. Atendida por mais de uma empresa | N `obra_empresas` no mesmo Grupo |
| 4. Construtora compra para obra de terceiro | Cliente da Obra = comprador/operador no ERP (ex.: Construtora ABC). Condomínio XYZ = papel futuro, não segundo FK |
| 5. Proprietário ≠ comprador | `cliente_id` **não** é proprietário do imóvel. Papéis futuros; 06B sem dois FKs de Cliente |
| 6. Troca de responsável | Fora do 06B; histórico no relacionamento de papéis |
| 7. Obra encerrada com histórico | `status=CONCLUIDA` ou inativa; documentos guardam snapshot |
| 8. Pedido sem obra | `obra_id` NULL no Pedido futuro; API de Obra não é bloqueio |
| 9. Marketplace sem obra | canal não envia Obra; snapshot de endereço do marketplace |
| 10. B2B escolhe obra | lista Obras ativas do Cliente na Empresa autorizada |

Consórcio/multi-cliente: extensão futura por relacionamento, não coluna extra
agora.

---

## 7. Relação Obra × ClienteEmpresa

```text
NOVA operação na Empresa X
  ⇒ mesmo group_id
  ⇒ cliente_empresas(cliente, X) elegível
  ⇒ obra_empresas(obra, X) ativo

LEITURA histórica autorizada
  ⇒ RBAC + tenant + vínculo
  ⇒ NÃO exige elegivel_operacao atual
```

---

## 8. Relação Obra × ClienteLocal

- Obra **referencia**; Local **é** o endereço.
- Local principal da Obra ≠ automaticamente local de entrega do Pedido.
- Dívida de cutover: Site CPA hoje usa `addressId` como `obraId`. Modelo
  final: `addressId`/`cliente_local_id` ≠ `obra_id`. Alias só na transição,
  com mapeamento explícito; não eternizar ambiguidade.
- `tipo_endereco=Obra` é legado: staging → ClienteLocal → Obra →
  `obra_local`. Sem finalidade OBRA.
- Pedido futuro escolhe o `cliente_local_id` efetivo (descarga, portaria,
  depósito) entre os `obra_locais` (ou, se política permitir, outro Local
  ativo do mesmo Cliente, com auditoria).
- Várias Obras no mesmo edifício: mesmo `cliente_local_id`, nomes/códigos
  diferentes.
- Geo, CEP e fingerprint permanecem no Local (06A). Obra não duplica.

---

## 9. Multiempresa / multigrupo

- Cross-group: trigger + 404. Grupo B não enumerar Obras do Grupo A.
- Cross-company no mesmo Grupo: listagem Empresa filtra `obra_empresas`.
- Consolidado do Grupo: vê todas as Obras do Cliente, com quais Empresas
  estão vinculadas.
- NF/estoque/financeiro: sempre da Empresa da transação.
- IDOR: `clienteId` da rota deve coincidir com `obras.cliente_id`; Local
  informado deve ser do mesmo Cliente.

---

## 10. Segurança

Fail-closed, backend como autoridade:

- actor obrigatório nas mutações;
- TenantGuard (`groupId` + `empresaId` quando `scopeType=empresa`);
- RBAC `PostgresRbacGuard` (chaves abaixo);
- schemas Zod strict / allowlist (sem mass assignment de tenant, actors,
  codigo, fingerprint);
- UUID de rota;
- paginação server-side + count separado;
- sem listagem completa sem limite;
- RLS ENABLE/FORCE nas três tabelas; sem policy permissiva;
- FK/trigger tenant-aware;
- concorrência: `reserve_entity_codigo` já serializa código; troca de
  principal da Obra na mesma transação, serializada por `obra_id`;
- mutação + audit atômicos (`db.withTransaction`).

RBAC canônico (reutilizar guard; não criar motor novo):

- `cadastros.obra.visualizar`
- `cadastros.obra.criar`
- `cadastros.obra.editar`
- `cadastros.obra.inativar`
- `cadastros.obra.restaurar`
- `cadastros.obra.vincular-empresa`
- `cadastros.obra.vincular-local`
- `cadastros.obra.principal`

Proposta alinhada a `cadastros.cliente-empresa.*` e
`cadastros.local-cliente.*`. **Não existe** chave `cadastros.obra` no código
hoje. Na implementação, confirmar o vocabulário real e **não** duplicar
equivalente. Usar Obra no Pedido futuro (`comercial.pedido.*`) ≠ editar
cadastro. Permissão extra de “usar” só no runtime do Pedido, se necessária.

Usar Obra no Pedido futuro não concede editar cadastro.

---

## 11. Auditoria

Eventos do 06B (ou equivalentes já usados no projeto):

- `create`, `update`, `change_status`
- `soft_delete` / `inactivate`, `restore`
- `link` / unlink / restore Empresa
- `link` / unlink / restore Local
- `change_primary_local` (ou `principal`)
- `possible_duplicate` / override

Snapshot **sem PII**: `obra_id`, codigo, nome quando seguro, status, ativo,
`empresa_id`, `cliente_local_id`, `uso_na_obra`, `principal`, IDs e flags.
**Não** gravar logradouro/CEP completos, coordenadas, telefone, e-mail,
CPF/CNPJ, arquivos.

Atomicidade: mutação + auditoria na **mesma transação**. Falha de audit →
ROLLBACK completo.

---

## 12. LGPD / PII

Obra em si tem pouco PII (nome da obra pode coincidir com nome de pessoa em
residência). Risco real está no Local vinculado e em futuros anexos/contatos.

Regras:

- API de Obra não ecoa endereço completo a menos que a permissão de Local
  autorize o join explícito (`include=local` + `cadastros.local-cliente.visualizar`);
- listagem operacional pode mostrar cidade/UF do Local principal, não
  logradouro completo por padrão;
- audit redigido;
- logs de observabilidade: `requestId`, actor id, group, empresa, ação,
  entity id, resultado — sem payload de endereço.

---

## 13. API futura (não implementar neste diagnóstico)

Base: `/api/v1/clientes/:clienteId/obras`

| Método | Caminho | Operação | RBAC |
|---|---|---|---|
| GET | `/` | list/search/count; limit/offset/hasMore; search codigo/nome; filtros status/ativo/empresa/cidade/UF; order_by allowlist | visualizar |
| POST | `/` | criar atômico: Obra + código + obra_empresas + ≥1 local + principal + audit | criar (+ `principal`) |
| GET | `/:obraId` | obter ativa | visualizar |
| PATCH | `/:obraId` | nome/status/observacao | editar; status pode exigir editar |
| DELETE | `/:obraId` | inativar | inativar |
| POST | `/:obraId/restore` | restaurar | restaurar |
| GET/POST/DELETE | `/:obraId/empresas[/:empresaId]` | vínculos | vincular-empresa |
| GET/POST/PATCH/DELETE | `/:obraId/locais[/:localId]` | vínculos | vincular-local |
| POST | `/:obraId/locais/:localId/principal` | principal | principal |

Filtros: `ativo`, `status`, `empresa_id`, `search` (codigo/nome),
`cidade`/`uf` via join no Local principal, `order_by`, `limit`, `offset`.
Count separado. Fingerprint interno não exposto.

Erros: 401 actor; 403 RBAC/tenant; 404 cross-tenant/inativo; 409 duplicidade
possível ou unicidade; 422 schema.

Idempotência: POST empresa é upsert do vínculo; código nunca vem do client.

Frontend HTTP: **não ativar**. Fora de `HTTP_PILOT_ENTITIES`.

---

## 14. Comercial 360º (preparação, sem implementação)

Na seleção do Cliente, Obra entra como filho consultável:

```text
Cliente
  ├── empresas habilitadas (ClienteEmpresa)
  ├── locais (ClienteLocal)
  ├── obras (este agregado)
  └── futuro: crédito, pedidos, entregas, projetos, docs, comunicações
```

Wizard atual (`WizardEtapa1Cliente`) deverá, no cutover futuro, listar
**Obras** (não `locais_entrega` como se fossem Obra) e, à parte, o Local de
entrega efetivo.

Comercial 360º **compõe** agregados canônicos; não é dono dos dados.

Criação rápida: `+ Nova Obra` no pedido, sem sair do fluxo, com os mesmos
guards. Campos mínimos: nome + Local existente ou Local novo (reusa 06A) +
Empresa do contexto. Código gerado no servidor — nunca pedido ao usuário.
Pendentes: papéis, datas, anexos, classificação rica.
Seleção rápida só oferece `ATIVA` + `ativo` (não PAUSADA/CONCLUIDA/
CANCELADA).

Obra opcional no Pedido: marketplace, varejo, PF, retirada, venda avulsa,
site, balcão.

Origem do pedido, canal, marketplace e origem do cadastro do Cliente são
dimensões **distintas** (não modelar no 06B).

---

## 15. Integrações futuras (impacto apenas)

| Canal / domínio | Impacto |
|---|---|
| Site CPA | `addressId` deixa de ser `obraId`; mapear Local UUID e Obra UUID |
| B2B | seleção de Obra quando o Cliente tiver obras ativas na Empresa |
| Marketplace | Pedido sem Obra; snapshot do endereço do canal |
| App / televendas | igual Comercial; Obra opcional |
| WhatsApp / chat / GoTo | camada futura de **interações**, vínculo opcional a Cliente/Obra/Pedido; não nascer dentro de `obras` |
| Roteirizador / Expedição | coordenadas do **snapshot** / Local escolhido, não da Obra |
| NF-e | snapshot fiscal; Obra no máximo como referência/observação autorizada |
| Produção / Armação / chapa / kit / BOM | item do Pedido aponta Obra quando houver; versão técnica no item/projeto |
| Documentos | infraestrutura genérica `entity_documents` (storage privado, MIME allowlist, hash, antivírus, URL assinada, tenant, retenção, versionamento). **Não** criar anexo só de Obra no 06B |
| `integration_events` | outbox futuro `obra.created` / `updated` / `status_changed` / `local_linked`; **não** emitir no 06B; nunca HTTP síncrono na transação da mutação |

Tipos futuros de item (estoque, corte/dobra, armação, chapa, fabricado, kit,
marketplace, sob projeto, serviço) **não** alteram o núcleo da Obra. Exigem
Pedido/item versionado + documentos genéricos.

---

## 16. Matriz de impacto

| Área | Impacto do 06B | Agora | Futuro | Risco |
|---|---|---|---|---|
| Cliente | FK dono | sim | cadastro 360º lista obras | baixo |
| ClienteEmpresa | cadastro obrigatório; `elegivel_operacao` só para **nova** operação | sim | venda/B2B | médio se misturar histórico |
| ClienteLocal | reuso via `obra_locais`; bloqueio de inativação | sim | geo/rota | médio |
| Obra | Grupo+Cliente; `obra_empresas` explícito; `obra_locais` N:N; 1 principal geral | sim | comercial | — |
| Comercial | seleção/criação rápida; só ATIVA por padrão | não UI | 360º / wizard | alto se cutover precoce |
| Pedido | `obra_id` **opcional** + Local efetivo + snapshot | não | canônico | alto se obrigar Obra |
| Produto / BOM / kit | nenhum | não | item especial | baixo |
| Produção | nenhum | não | herda obra do pedido | baixo |
| Expedição | nenhum | não | snapshot + janela do Local | médio se reidratar master |
| Financeiro | nenhum ledger | não | dimensão analítica | baixo |
| Fiscal | nenhum | não | snapshot NF | médio se PII |
| CRM / GoTo / WhatsApp | nenhum | não | interações genéricas | baixo |
| Site / App / B2B / Marketplace | nenhum dual-write | não | IDs estáveis | alto no alias `addressId=obraId` |
| Documentos | só requisito | não | storage genérico | malware/PII |
| Auditoria / RBAC / RLS | novas entidades no mesmo padrão | sim | — | médio se PII no snapshot |
| Integrações | outbox depois | não | S2S | baixo |

---

## 17. Threat model

| Ameaça | Mitigação |
|---|---|
| IDOR / enumeração | UUID; 404 uniforme; paginação; sem lista global sem cliente |
| Cross-group | trigger + TenantGuard + RLS FORCE |
| Cross-company | filtro `obra_empresas`; visão Empresa ≠ Grupo |
| Mass assignment | schema strict; codigo/tenant/actors só no servidor |
| Spoof de cliente/empresa/local | FKs + mesmo `cliente_id`/`group_id` no trigger |
| Local de outro Cliente | trigger `obra_locais` + 404/422 |
| Empresa sem ClienteEmpresa | trigger `obra_empresas` |
| Actor ausente/inválido | fail-closed |
| Restore indevido | RBAC restaurar + audit |
| Status indevido / PAUSADA silenciosa | allowlist; seleção só ATIVA |
| Principal concorrente | lock da Obra; unique parcial; transação |
| Código concorrente | `reserve_entity_codigo` |
| Falha de audit | rollback completo |
| PII (endereço na listagem/audit) | join explícito + RBAC Local; audit redigido |
| Arquivo malicioso (futuro) | fora do 06B |
| Pedido forçado a ter Obra | coluna futura NULLABLE |

---

## 18. Fluxos

**Fluxo 1 — Local existente:** POST atômico no contexto Empresa cria Obra +
código + `obra_empresas` + `obra_local` (Local do mesmo Cliente/Grupo) +
principal + audit. Local de outro Cliente/Grupo → bloqueio banco/backend.

**Fluxo 2 — Novo Local:** application service reutiliza ClienteLocal 06A no
mesmo `db.withTransaction` (RBAC Local **e** Obra). Sem endereço em
`obras` e sem segundo cadastro.

**Fluxo 3 — Pedido futuro, Obra existente:** Cliente → Empresa do Pedido →
Obra autorizada (`obra_empresas` + ClienteEmpresa elegível) → usuário
escolhe Local de entrega (não o principal por default) → snapshot
(`obra_id` + `cliente_local_id` + cópia). NF pela Empresa do Pedido.

**Fluxo 4 — Obra rápida no pedido:** modal mínimo (nome + local); código
servidor; vínculo Empresa implícito; RBAC criar. Pedido ainda não existe
no PG neste lote.

**Fluxo 5 — Pedido sem Obra:** permitido (marketplace/varejo/PF/retirada/
avulsa/site/balcão).

**Fluxo 6 — Duas empresas:** uma Obra 000001; `obra_empresas` CPA e 3Z
ativos; cada operação tem `empresa_id` próprio. Sem cópia CPA/3Z.

**Fluxo 7 — Encerrada / bloqueio posterior:** `CONCLUIDA` fora da seleção
nova. Se ClienteEmpresa CPA bloquear depois da venda, nova operação
bloqueada; histórico permanece visível ao autorizado.

**Fluxo 8 — Troca de endereço atual:** PATCH ClienteLocal ou troca de
`obra_locais`/principal atômica; documentos históricos inalterados.

---

## 19. Plano de testes da implementação futura

Obrigatório no lote de código 06B:

CREATE, GET, LIST, PATCH, SEARCH, FILTER, PAGINATION, COUNT (`hasMore`),
SOFT DELETE, RESTORE, RBAC fail-closed, RLS + FORCE RLS, CROSS-GROUP 404,
CROSS-COMPANY filtrado, MASS ASSIGNMENT rejeitado, TENANT FK trigger,
FRONTEND HTTP OFF, finalidade OBRA continua proibida em
`cliente_local_finalidades`, seed A/A2/B convergente, legacy fields,
meta `ERP-RUNTIME-06B` **somente na implementação**.

Casos explícitos:

- A. criação atômica: Obra + Empresa + Local principal + audit;
- B. falha de audit: nada persiste (nem código inconsistente);
- C. Local de outro Cliente: bloqueado;
- D. Local de outro Grupo: bloqueado;
- E. Empresa de outro Grupo: bloqueada;
- F. Empresa sem ClienteEmpresa: bloqueada;
- G. ClienteEmpresa inelegível: nova operação bloqueada;
- H. histórico consultável após inelegibilidade (RBAC/tenant);
- I. duas criações concorrentes: códigos distintos;
- J. duas trocas concorrentes de principal: um único principal;
- K. inativar Local principal usado por Obra ativa: bloqueado;
- L. inativar Obra: Local continua ativo;
- M. inativar `obra_empresas`: outras Empresas continuam;
- N. PAUSADA fora da seleção operacional padrão;
- O. CONCLUIDA fora da seleção operacional;
- P. CANCELADA fora da seleção operacional;
- Q. contrato: Pedido futuro sem Obra permitido (sem implementar Pedido);
- R. OBRA continua proibida em `cliente_local_finalidades`.

Não exigir teste de Pedido/NF/anexo neste lote.

---

## 20. Riscos

1. Cutover do wizard ainda usando `locais_entrega` como Obra — aliases e
   mapa `legacy_id`/`addressId` até o cutover; sem dual-write no 06B.
2. Tornar Obra obrigatória no Pedido — **proibido** pelo contrato.
3. Copiar endereço para `obras` “para facilitar UI” — regressão do 06A.
4. Compartilhamento implícito CPA/3Z — faturamento cruzado; por isso
   `obra_empresas` fail-closed.
5. Dois FKs de Cliente (proprietário/comprador) sem Pessoa canônica —
   adiar papéis.
6. Unique agressivo de duplicidade — falsos bloqueios.
7. Audit com snapshot de Local — vazamento LGPD.
8. Inativar Local com Obra ativa em cascade — perda de referência.
9. Implementar 06B antes do review deste diagnóstico.

Nenhum bloqueio técnico: Cliente, ClienteEmpresa, ClienteLocal, sequência,
RLS, audit e RBAC já existem.

---

## 21. Escopo definitivo recomendado para o RUNTIME-06B

Implementação **posterior**, após review final:

1. **uma** migration `012_obras.sql` (aditiva; 001–011 imutáveis) com
   `obras`, `obra_empresas` e `obra_locais` no mesmo arquivo;
2. código sequencial, status, lifecycle, triggers tenant, RLS/FORCE;
3. types/schemas Zod;
4. repositórios in-memory e PostgreSQL (transação compartilhada);
5. service/API aninhada, RBAC proposto, duplicidade conservadora;
6. busca/paginação/count server-side;
7. auditoria atômica sem PII de endereço;
8. seed sintético A/A2/B;
9. testes (inclui A–R);
10. docs/runbook; meta `ERP-RUNTIME-06B` **somente nesse lote de código**.

Não dividir em 012/013/014. Sem `obra_responsaveis`, anexos, tipo rico,
datas, eventos emitidos, frontend, staging real.

---

## 22. Fora do escopo do 06B

Pedido/orçamento canônicos, Comercial 360º UI, produção, corte/dobra,
armação 2.0, BOM/CAD/kit, marketplace/site/app/B2B, GoTo, WhatsApp, NF-e,
financeiro, expedição, storage/anexos, CRM, responsáveis, dual-write
Base44, backfill real, ativação `HTTP_PILOT_ENTITIES`, VPS, merge deste
diagnóstico sem review.

Nenhuma fundação improvisada de arquivos ou telefonia dentro de `obras`.

---

## 23. Plano de implementação posterior (após aprovação)

1. Review ChatGPT/humano deste diagnóstico.
2. Branch de código distinta; não misturar com este lote documental.
3. Escrever `012_obras.sql` convergente.
4. Service/API/testes no padrão 06A.
5. Seed + meta `ERP-RUNTIME-06B`.
6. PR de implementação; E2E DEV; promoção só depois.
7. RUNTIME-07 (preço) permanece o próximo domínio comercial **depois** de
   06B código, salvo reordenação oficial. Não iniciar 07 neste diagnóstico.

---

## 24. Critérios de aceite da **implementação** futura

- Obra não é finalidade de ClienteLocal.
- Não há colunas de endereço/geo em `obras`.
- `obra_locais` e `obra_empresas` com integridade tenant no banco.
- Código via `reserve_entity_codigo` por Grupo.
- Pedido continua possível sem Obra (contrato documentado; coluna ainda
  inexistente no PG).
- Soft delete/restore, RBAC, RLS FORCE, audit atômico sem PII de endereço.
- Frontend HTTP desligado.
- Migrations 001–011 intocadas.

Critérios deste lote documental: apenas arquivos de diagnóstico/status;
nenhuma migration/código; API DEV inalterada.

---

## Respostas A–T (quadro)

| | Decisão |
|---|---|
| A | Contexto comercial/operacional do Cliente |
| B | Grupo + Cliente; Empresa é autorização, não dona |
| C | Sim, via `obra_empresas` |
| D | Pré-condição de operação; não duplica endereço |
| E | Referência N:N; Local permanece canônico |
| F | Sim, no 06B |
| G | Sim, no 06B |
| H | Depois (sem Pessoa canônica) |
| I | `reserve_entity_codigo(group_id, 'Obra', 6)` |
| J | ATIVA / PAUSADA / CONCLUIDA / CANCELADA + `ativo` |
| K | Soft delete/restore no padrão 04–06A |
| L | Alerta nome+local principal; sem UNIQUE de endereço |
| M | Ref + snapshot no documento transacional futuro |
| N | Núcleo obras + vínculos empresa/local + API/RBAC/RLS/audit/testes |
| O | Ver §22 |
| P | Só `012_obras.sql` na implementação futura |
| Q | types, 2 repos, service, router, app, rbac, audit, seed, testes |
| R | Ver §19 |
| S | Ver §20 |
| T | Filho consultável do Cliente; seleção/criação no pedido; nunca obrigatória |

---

## SUGESTÕES PARA AGENTS.md

Não aplicar agora. Candidatas reutilizáveis:

1. **Obra não é finalidade de Local.** Finalidade descreve uso do endereço;
   entidade de negócio referencia Local.
2. **Documento transacional guarda referência + snapshot**; cadastro master
   mutável não reidrata histórico (Pedido, NF, Entrega, contrato).
3. **Obra é opcional no Pedido**; canal/marketplace não podem ser forçados
   a um canteiro.
4. **Anexos/projetos** nascem em infraestrutura documental genérica
   (`entity_documents`), não em tabela de arquivo por módulo.
5. **Interações** (voz, WhatsApp, chat) nascem em camada genérica, não
   dentro do agregado Obra.
6. **Master compartilhado no Grupo** não deve ser copiado fisicamente por
   Empresa quando uma relação de autorização (`obra_empresas`,
   `cliente_empresas`) resolve o escopo.

Nenhuma dessas regras contradiz a Regra-Mãe; apenas materializam decisões
já usadas em 06A/Comercial legado. **Não aplicar AGENTS.md neste lote.**
