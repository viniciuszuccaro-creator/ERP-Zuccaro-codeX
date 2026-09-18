# ERP-RUNTIME-07A — Especificação fechada: TabelaPreco + TabelaPrecoItem

**Status:** `ESPECIFICAÇÃO DOCUMENTAL — AGUARDANDO REVIEW HUMANO`  
**Modo:** somente análise + documentação. Nenhuma migration 013, código de
produção, seed, teste novo, banco, VPS, API, frontend HTTP, merge ou
RUNTIME-07B.

| Item | Valor |
|---|---|
| Repo | `viniciuszuccaro-creator/ERP-Zuccaro-codeX` |
| Baseline 06B / `origin/main` de referência | `67686298be2fa125966e714b1cf20759a7991765` |
| API DEV oficial | **permanece `ERP-RUNTIME-06B`** |
| Migrations imutáveis | 001–012 |
| Diagnóstico 07 | `docs/ERP_RUNTIME_07_DIAGNOSTICO.md` (PR #26 Draft; usar sem mergear) |
| Próximo agregado | `TabelaPreco` + `TabelaPrecoItem` |
| Migration futura (não criar agora) | `013_tabelas_preco.sql` |
| Frontend HTTP | **NÃO ATIVAR**; `HTTP_PILOT_ENTITIES` inalterado |
| RUNTIME-07B | **não iniciado** |

Objetivo: fechar decisões estruturais para que o 07B **não invente regra**
durante a programação. “Provável” não vira SQL neste lote.

---

## 0. Fontes e método

Fontes lidas (sem alterar):

- `AGENTS.md`, Regra-Mãe, `STATUS_DO_PROJETO.md`
- `docs/ERP_RUNTIME_07_DIAGNOSTICO.md` (PR #26)
- `docs/ERP_RUNTIME_03.md` / `_PRODUTO_MATRIX.md`, `04`, `05`(+diagnóstico),
  `06A`, `06B`(+diagnóstico)
- Migrations `001`–`012` (em especial `005` unidades, `006`/`007` produto,
  `009`/`010` ClienteEmpresa, `012` Obra / `obra_empresas`)
- UI/legado Base44: `TabelaPrecoFormCompleto`, `TabelaPrecoItensModal`,
  `AplicadorTabelaPreco`, Site CPA (`siteCpaCatalogRead` / order / quote)
- `CLIENTE_FORBIDDEN_FIELDS` (`tabela_preco_id` proibido até canônico PG)
- RBAC/audit/RLS padrões 002 e 05–06B

Regra de escolha quando legado UI e runtime PG divergem:

1. Regra-Mãe + contrato multiempresa já canônico (Cliente / Obra);
2. evidência de migration/testes PG;
3. legado Base44 como consumidor a migrar, não como schema a copiar cegamente.

---

## 1. Multiempresa — decisão

### Decisão

**Ownership canônico = Grupo + empresa de origem, com autorização N:N por Empresa.**

| Aspecto | Decisão fechada |
|---|---|
| Tenant raiz | `group_id` NOT NULL em toda linha de preço |
| Dona comercial / origem | `empresa_id` NOT NULL no cabeçalho (`tabelas_preco`) = Empresa criadora/origem |
| Tabela “só de Grupo” sem owner | **proibida** |
| Compartilhamento A ↔ A2 (mesmo Grupo) | **sim**, via `tabela_preco_empresas` (N:N) |
| Flag legada `compartilhar_grupo` | **não** promover para PG |
| Empresa irmã sem autorização | **não** vê, não lista operacionalmente, não usa, não vincula a ClienteEmpresa |
| Visão consolidada no Grupo | lista tabelas das Empresas autorizadas ao usuário, **preservando** `empresa_id` origem e vínculos |
| Papel de `group_id` | isolamento de tenant; FK composta; código sequencial |
| Papel de `empresa_id` (cabeçalho) | origem/ownership comercial; nunca identidade fiscal genérica do Grupo |
| Papel de `tabela_preco_empresas` | autorização de **uso** por Empresa (espelho de `obra_empresas`) |

### Por que este modelo (não o oposto)

Comparado a “tabela owned só por Empresa, sem N:N”:

- Regra-Mãe: cadastro do Grupo fica disponível às empresas **autorizadas**, sem
  copiar fisicamente o master; consolidado no Grupo preserva a empresa.
- Runtime 06B já cravou o padrão **master + autorização N:N** (`obra_empresas`).
- Flag booleana `compartilhar_grupo` do legado UI é ambígua (todas as empresas?
  só irmãs? revoke?). N:N dá revoke, auditoria e fail-closed explícitos.
- Preço **não** emite NF; ownership ≠ faturamento. NF continua na Empresa
  transacional do Pedido futuro.

Na criação: inserir automaticamente vínculo ativo em `tabela_preco_empresas`
para a `empresa_id` origem (dona sempre autorizada). Demais empresas exigem
ação explícita `vincular-empresa`.

Cross-group: sempre negar (404 se o ator não pode saber que o id existe;
403 no mesmo grupo sem permissão). Cross-company: negar sem linha ativa em
`tabela_preco_empresas`.

---

## 2. ClienteEmpresa → tabela

### Decisão

| Aspecto | Decisão fechada |
|---|---|
| Cliente master | **nunca** guarda `tabela_preco_id` (permanece em `CLIENTE_FORBIDDEN_FIELDS`) |
| ClienteEmpresa | **pode** ter tabela específica: coluna aditiva `tabela_preco_id` (NULL permitido) |
| Onde | na mesma migration futura `013` (ALTER em `cliente_empresas`); 010 permanece imutável no texto histórico |
| Integridade | tabela referenciada deve ser do **mesmo** `group_id` e ter autorização ativa para a **mesma** `empresa_id` do vínculo |
| NULL | significa “sem tabela específica” → cai no fallback (§3) |
| Inativação da tabela | **bloqueia** inativar enquanto for padrão da empresa ou referenciada por ClienteEmpresa ativo (`409` com motivo); unlink/troca primeiro |
| Inativação do vínculo ClienteEmpresa | não apaga histórico de documentos; FK pode permanecer para consulta autorizada, mas resolução operacional exige elegibilidade 05 |
| Histórico documental | Pedido/Orçamento futuros **snapshotam**; não leem de novo o master |
| Audit | create/update do vínculo de tabela + unlink + tentativas bloqueadas relevantes |
| Cross-tenant | trigger/FK composta: impossível apontar tabela de outro grupo ou empresa não autorizada |

Sem tabela paralela de “condição comercial” no PG neste agregado.

---

## 3. Precedência de resolução de preço

Algoritmo futuro (determinístico), sempre no contexto `{ groupId, empresaId }`:

1. Se `ClienteEmpresa.tabela_preco_id` NOT NULL **e** tabela `ativo=true`
   **e** vigência válida **e** autorização ativa para a Empresa → usar essa
   tabela.
2. Senão, se existir **exatamente uma** tabela padrão ativa da Empresa
   (`tabela_preco_empresas.eh_padrao = true` + tabela ativa + vigência válida)
   → usar essa.
3. Senão → **sem preço**. Operação que exige preço **falha fechada**.
   Nunca inventar preço, nunca assumir `0` implícito, nunca pegar tabela de
   outra empresa “parecida”.

Item: dentro da tabela escolhida, buscar item ativo por
`(produto_id, unidade_medida_id)`. Ausência de item = sem preço (mesmo
fallback de cabeçalho não inventa valor).

### Integridade de padrão único por Empresa

- No máximo **uma** linha `tabela_preco_empresas` com
  `eh_padrao = true AND ativo = true` por `empresa_id`.
- Índice único parcial obrigatório.
- Troca de padrão: mesma transação (unset anterior + set novo + audit).
- Tabela inativa ou fora da vigência **não** pode permanecer como padrão
  operacional (backend rejeita ou exige unset na mesma TX de inativação).

---

## 4. Vigência

| Aspecto | Decisão fechada |
|---|---|
| Campos | `vigencia_inicio DATE NOT NULL`, `vigencia_fim DATE NULL` (aberta) |
| Timezone | **data civil** (sem horário). Comparar com a data de negócio do contexto (`America/Sao_Paulo` no application layer); não armazenar `TIMESTAMPTZ` de vigência |
| `ativo` | lifecycle (soft delete); **não** substitui vigência |
| Status machine extra | **não** criar (`VIGENTE`/`EXPIRADA` como enum persistido) — derivar na leitura |
| Futura | `hoje < vigencia_inicio` → não resolve preço |
| Expirada | `vigencia_fim IS NOT NULL AND hoje > vigencia_fim` → não resolve |
| Sobreposição entre tabelas | **permitida** no calendário; desempate **não** é por vigência, e sim por precedência §3 |
| Item | **sem** vigência própria no 013 (evita state machine e overlap por item) |
| Check | `vigencia_fim IS NULL OR vigencia_fim >= vigencia_inicio` |

UI legada com `data_inicio`/`data_fim` no item mapeia para o cabeçalho no
cutover; não duplicar no item PG agora.

---

## 5. TabelaPreco — campos mínimos

Tabela física: `tabelas_preco`.

| Campo | Obrigatório | Notas |
|---|---|---|
| `id` UUID PK | sim | `gen_random_uuid()` |
| `group_id` | sim | FK `groups`; `UNIQUE (id, group_id)` para FK composta |
| `empresa_id` | sim | Empresa origem; mesmo grupo (trigger) |
| `codigo` | sim | `reserve_entity_codigo(group_id, 'TabelaPreco', 6)`; **nunca** payload; **nunca** `count(*)+1` |
| `nome` | sim | `btrim` ≠ '' |
| `descricao` | não | texto curto; sem PII |
| `ativo` | sim | default `true` |
| `vigencia_inicio` / `vigencia_fim` | sim / não | §4 |
| `codigo_tabela_legado` | não | max 64; preservação migração (já existe no Base44) |
| `moeda` | sim | `CHAR(3)` default `'BRL'` |
| `created_at` / `updated_at` | sim | `TIMESTAMPTZ` UTC |
| `created_by` / `updated_by` | não | `profiles` |
| legado opcional | não | `origem`, `legacy_id`, `source_system`, `migration_batch`, `imported_at` no padrão 05/06B |

**Fora do 013:** `tipo` textual “Padrão”, `compartilhar_grupo`, PriceBrain,
margem de cabeçalho, alçada, versionamento imutável por revisão.

Padrão da empresa **não** é campo do cabeçalho; é `eh_padrao` no vínculo N:N.

---

## 6. TabelaPrecoItem — identidade e campos

Tabela física: `tabela_preco_itens`.

### Identidade lógica

`(tabela_preco_id, produto_id, unidade_medida_id)` no mesmo `group_id`.

| Campo | Obrigatório | Notas |
|---|---|---|
| `id` UUID PK | sim | |
| `group_id` | sim | denormalizado; FK composta para cabeçalho |
| `tabela_preco_id` | sim | FK composta `(tabela_preco_id, group_id) → tabelas_preco(id, group_id)` |
| `produto_id` | sim | mesmo `group_id` (FK composta se `produtos` expuser `UNIQUE(id,group_id)`; senão trigger no padrão Obra) |
| `unidade_medida_id` | sim | `unidades_medida` do mesmo grupo |
| `preco` | sim | `NUMERIC(18,6)`; §8 |
| `ativo` | sim | soft delete do item |
| timestamps/actors | sim / não | igual cabeçalho |

**Não** persistir no item: descrição, marca, NCM, código de barras, foto,
custo, estoque (master permanece em `produtos`). Snapshot descritivo só em
documento transacional futuro.

**Não** no 013: vigência por item, faixa qty, desconto máximo, margem
percentual, `preco_com_desconto` calculado, moeda por item.

Campos legados de margem/desconto da UI ficam para lote comercial futuro
(alçada), não no núcleo 013.

---

## 7. Unidades (obrigatório)

Evidências: `unidades_medida` (005) com fator para base; `produtos` (006/007)
com `unidade_medida_id`, `unidade_principal`, `unidades_secundarias`,
`fatores_conversao`, `peso_teorico_kg_m`, `comprimento_barra_padrao_m`;
matrix 03: preço de venda **fora** do Produto.

| Pergunta | Decisão fechada |
|---|---|
| Preço só por Produto ou Produto+unidade? | **Produto + `unidade_medida_id`** |
| Onde fica conversão? | Domínio canônico **Produto / UnidadeMedida** (já existente). Item de preço **não** guarda fator paralelo |
| Mesmo produto pode ter preço KG e UN/barra? | **Sim** — duas linhas de item |
| Peso teórico entra como conversão? | Sim, como dado de **Produto** para cálculo de aplicação; **não** como coluna de preço |
| Preço barra vs kg: armazenado ou calculado? | **Armazenado** por unidade comercial cotada. Equivalência calculada só na aplicação usando fatores do Produto; 013 não deriva automaticamente um do outro |
| Arredondamento na conversão de exibição | half-up para escala monetária de **documento** (2 casas BRL) no futuro Pedido; valor **armazenado** no item mantém até 6 casas |

Validação de negócio (backend): `unidade_medida_id` do item deve ser a unidade
principal do produto **ou** constar nas secundárias/fatores cadastrados.
Sem unidade → rejeitar. Sem inventar fator CPA real ausente.

---

## 8. Dinheiro

| Aspecto | Decisão fechada |
|---|---|
| Tipo | `NUMERIC(18,6)` — **nunca** `float`/`double`/`real` |
| Moeda | `BRL` no cabeçalho (default); sem multi-moeda operacional no 013 |
| Escala | 6 casas no unitário (kg/m muito pequenos); totais de documento futuro em 2 casas |
| Negativo | **proibido** (`CHECK (preco >= 0)`) |
| Zero | **permitido** apenas se cadastrado explicitamente; ausência de item ≠ zero |
| Limite superior | `preco <= 999999999999.999999` implícito em NUMERIC(18,6); sem teto de negócio inventado |
| Arredondamento de write | rejeitar escala > 6; não arredondar silenciosamente para “caber” |

---

## 9. Faixas de quantidade

Pesquisa: UI atual de item não modela ranges reais de qty; Site CPA resolve
item por produto; diagnósticos não exigem faixa para o próximo agregado.

**Classificação: FUTURO.**  
013 **não** cria `quantidade_min`/`max`, overlap de faixa nem prioridade.
Se no futuro for obrigatório: tabela filha ou colunas com ranges
`[min, max)` sem overlap por `(tabela, produto, unidade)` e prioridade
explícita — fora do 07B núcleo.

---

## 10. Histórico

| Aspecto | Decisão fechada |
|---|---|
| Master 013 | **update in-place** + `audit_logs` before/after |
| Versionamento imutável (nova tabela a cada revisão) | **fora** do 013 |
| Vigência por item | **não** (§4/§6) |
| Documentos futuros | **snapshot** obrigatório: `tabela_preco_id`, nome/código da tabela, `produto_id`, unidade, `preco` aplicado, moeda, timestamp |
| Efeito de mudança master | **nunca** altera Pedido/Orçamento antigo |

---

## 11. Reajuste e cópia (futuros — especificar, não implementar)

### Reajuste percentual (futuro)

- Input: percentual (+/−), escopo (tabela ou subset de itens), preview obrigatório.
- Arredondamento: half-up para `NUMERIC(18,6)` no unitário.
- Persistência: update in-place dos itens em **uma** transação + audit por
  item (ou audit agregado com lista de ids + before/after resumido).
- Sem preview confirmado → não grava.
- RBAC futuro: `cadastros.tabela_preco.reajustar` (não no núcleo 07B se
  adiar implementação).

### Cópia (futuro)

- Gera **nova** identidade (`id` novo) + **novo** `codigo` via
  `reserve_entity_codigo`.
- Copia itens ativos; não copia `codigo_tabela_legado` salvo mapeamento
  explícito de migração.
- **Não** copia automaticamente vínculos `tabela_preco_empresas` de clientes
  nem `ClienteEmpresa.tabela_preco_id`.
- Pode copiar autorizações de empresa **somente** se a ação declarar
  `copiar_autorizacoes=true` (default false).
- Não implementar no 07B salvo se o lote de código explicitamente incluir;
  default do escopo 07B = **fora**.

---

## 12. Unicidades

| Objeto | Regra |
|---|---|
| Código | `UNIQUE (group_id, codigo)` |
| Nome | índice único parcial `(group_id, lower(nome)) WHERE ativo` — permite reuso do nome após soft delete da identidade antiga somente se a antiga estiver inativa; restore mantém o mesmo nome |
| Item | `UNIQUE (tabela_preco_id, produto_id, unidade_medida_id)` **sempre** (inclui inativos) para preservar identidade no restore |
| Autorização | `UNIQUE (tabela_preco_id, empresa_id)` |
| Padrão | único parcial por empresa (§3) |
| Fingerprint MD5 | **proibido** como identidade |

Duplicidade de preço “parecido” não é identidade. Conflito = unique violation
(`409`).

---

## 13. Soft delete

| Aspecto | Decisão fechada |
|---|---|
| Mecanismo | `ativo = false` em cabeçalho, item e vínculo empresa |
| Hard delete | **proibido** no 013/07B |
| Restore | mesma identidade (`id`/`codigo`); sem cascade automático de itens/vínculos (espelha Obra) |
| Efeito resolução | tabela/item/vínculo inativo **fora** da resolução §3 |
| ClienteEmpresa | inativar tabela referenciada: bloqueado até unlink (§2) |
| Padrão | inativar padrão: exige unset/`eh_padrao=false` na mesma TX |
| Histórico | documentos snapshotados intactos; listagens históricas autorizadas podem ver inativos com filtro explícito |

---

## 14. Banco (contrato para `013_tabelas_preco.sql`)

Uma migration aditiva. 001–012 imutáveis.

Objetos:

1. `tabelas_preco`
2. `tabela_preco_itens`
3. `tabela_preco_empresas`
4. `ALTER TABLE cliente_empresas ADD COLUMN tabela_preco_id UUID NULL` (+ checks/triggers)

Integridade preferencial:

| Relação | Mecanismo |
|---|---|
| item → tabela | FK composta `(tabela_preco_id, group_id)` |
| autorização → tabela | FK composta `(tabela_preco_id, group_id)` |
| cabeçalho → group | FK `groups` |
| cabeçalho → empresa origem | trigger `empresa.group_id = tabelas_preco.group_id` |
| autorização → empresa | trigger mesmo grupo + (opcional) existência da empresa |
| item → produto | FK composta se disponível; senão trigger mesmo `group_id` |
| item → unidade | trigger/FK mesmo `group_id` |
| ClienteEmpresa → tabela | trigger: mesmo grupo + `tabela_preco_empresas` ativa para a `empresa_id` do vínculo |

Checks: monetários, vigência, nome, moeda `BRL` (ou allowlist curta se precisar
abrir depois).  
`REVOKE ALL … FROM PUBLIC`.  
Índices: tenant, código, nome, produto, empresa, padrão parcial.

Backend + banco: app faz allowlist/RBAC; banco é última barreira tenant/unique.

---

## 15. RLS + FORCE RLS

Obrigatório em `tabelas_preco`, `tabela_preco_itens`, `tabela_preco_empresas`.

- `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`
- **Sem** policy permissiva (padrão 002)
- Sem contexto / role não privilegiada = **0 linhas**
- BFF privileged **server-only**
- Empresa só opera tabelas autorizadas (filtro backend alinhado ao N:N)
- Grupo consolidado só conforme guard de empresas do usuário
- Cross-group nunca

Coluna nova em `cliente_empresas` herda RLS FORCE já existente da tabela.

---

## 16. RBAC (fail-closed)

Padrão pesquisado: UI usa `Cadastros` / `TabelaPreco` e chaves
`comercial.visualizar_tabela_preco` / `editar_tabela_preco` (legado). Runtime
05–06B granulariza `cadastros.*`.

**Chaves canônicas do 07B (propor e implementar no backend):**

| Chave | Ação |
|---|---|
| `cadastros.tabela_preco.visualizar` | list/get/search/count |
| `cadastros.tabela_preco.criar` | create cabeçalho (+ vínculo dona) |
| `cadastros.tabela_preco.editar` | update allowlist cabeçalho |
| `cadastros.tabela_preco.inativar` | soft delete cabeçalho |
| `cadastros.tabela_preco.restaurar` | restore |
| `cadastros.tabela_preco.vincular-empresa` | link/unlink `tabela_preco_empresas` |
| `cadastros.tabela_preco.gerenciar-itens` | CRUD itens |
| `cadastros.tabela_preco.definir-padrao` | `eh_padrao` |
| `Cadastros.Produtos.TabelaPreco.codigo_tabela_legado.editar` | preservar campo legado |

Futuro (não obrigatório no núcleo 07B): `reajustar`, `copiar`.

Vínculo `ClienteEmpresa.tabela_preco_id`: permissão de editar ClienteEmpresa
(05) **e** `visualizar` da tabela. Fail-closed: sem actor/contexto/perfil
carregado = negar. Admin sem escopo **não** bypassa.

---

## 17. Auditoria atômica

Reutilizar somente `audit_logs` (001). Mutação + audit na **mesma**
transação; falha de audit → **rollback**.

Eventos mínimos:

- create/update/inactivate/restore de `TabelaPreco`
- link/unlink empresa; definir/remover padrão
- create/update/inactivate/restore de item
- update de `ClienteEmpresa.tabela_preco_id` (set/clear)
- futuros: reajuste, cópia

Snapshot: ids, códigos, nomes de tabela, preços, unidade, flags — **sem** PII
(documento, endereço, telefone, e-mail, geo). Sem segredo/token.

---

## 18. API futura (contrato; não implementar neste lote)

Prefixo sugerido sob o router runtime existente. `frontendHttp=false`.

| Método | Rota | Notas |
|---|---|---|
| GET | `/tabelas-preco` | paginação/busca/filtros server-side; exige `groupId`; `empresaId` no modo empresa |
| GET | `/tabelas-preco/:id` | 404 cross-group |
| POST | `/tabelas-preco` | cria + vínculo dona; código reservado no server |
| PATCH | `/tabelas-preco/:id` | allowlist |
| POST | `/tabelas-preco/:id/inactivate` | |
| POST | `/tabelas-preco/:id/restore` | |
| GET/POST/PATCH | `/tabelas-preco/:id/itens`… | gerenciar itens |
| GET/POST/DELETE | `/tabelas-preco/:id/empresas`… | autorizações |
| POST | `/tabelas-preco/:id/empresas/:empresaId/padrao` | definir padrão |
| PATCH | `/cliente-empresas/:id` | allowlist inclui `tabela_preco_id` **somente** aqui (não no Cliente) |

Payload: allowlist. Bloquear no write: `group_id`/`empresa_id` adulterados,
`codigo`, actors, `created_*`, legacy forjado, empresa arbitrária no item,
preço em PATCH de Produto/Cliente.

Copy/reajuste: rotas só se o 07B decidir incluí-las; default = ausentes.

---

## 19. Concorrência

| Cenário | Barreira |
|---|---|
| Dois creates | `reserve_entity_codigo` serializa código por grupo |
| Dois padrões simultâneos | unique parcial + TX com `SELECT … FOR UPDATE` da linha de autorização |
| Dois itens iguais | unique `(tabela, produto, unidade)` → um 201 / um 409 |
| Restore vs create duplicando nome ativo | unique parcial de nome |
| Reajuste futuro | lock da tabela/itens no preview→commit |
| Vincular ClienteEmpresa durante inativação | inativação bloqueada se FK ativa; ou unlink atômico ordenado |
| Banco | última barreira (unique/check/trigger) |

---

## 20. Pedido / Orçamento futuro (não implementar)

- `empresa_id` transacional resolve a tabela via §3.
- Documento guarda `tabela_preco_id` + snapshot suficiente (preço, unidade,
  nome/código tabela, moeda).
- Alteração posterior do master **não** muda histórico.
- `obra_id` continua **opcional** (06B).
- Sem preço resolvido → não fecha item comercial.

---

## 21. Site / Base44 / B2B

Consumidores futuros consultam **somente** preço autorizado por
Empresa/ClienteEmpresa. Sem acoplamento de schema do Site ao PG além do
contrato de leitura. Sem vazamento cross-tenant. Cutover Base44 / dual-write
**fora** do 07B.

---

## 22. Seed 07B (sintético, idempotente)

| Entidade | Conteúdo |
|---|---|
| Grupos | A, B |
| Empresas | A, A2 (grupo A); B (grupo B) |
| Produtos | Produto A (grupo A) com UN e KG se unidades seedadas; Produto B (grupo B) |
| Tabelas | T-A origem Empresa A; T-A2 compartilhada A→A2 via N:N; T-B em B |
| Padrão | T-A padrão de A; A2 com padrão próprio ou herdado autorizado |
| Itens | preços ≥ 0 explícitos; incluir ao menos um produto com duas unidades |
| Negativos | tentativas cross-group / cross-company sem auth devem falhar nos testes |
| Idempotência | 2ª execução do seed não duplica (upsert por códigos sintéticos estáveis) |

Sem dados reais de cliente/PII.

---

## 23. Testes 07B (PostgreSQL real obrigatório no gate)

Cobertura mínima:

1. Migration 013 idempotente; 001–012 intocadas  
2. Seed 2× convergente  
3. CRUD cabeçalho/itens/autorizações  
4. Tenant / cross-group (404) / cross-company sem auth  
5. IDOR por UUID  
6. RBAC fail-closed / mass assignment (preço em Produto; tabela no Cliente)  
7. RLS ENABLE+FORCE; role comum = 0 linhas  
8. Monetário (negativo rejeitado; escala; zero explícito ≠ missing)  
9. Vigência futura/expirada/aberta  
10. Padrão único por empresa  
11. Produto de outro grupo rejeitado  
12. Item duplicado (mesmo produto+unidade) → 409  
13. Soft delete/restore identidade  
14. ClienteEmpresa FK + fallback §3  
15. Audit rollback  
16. Concorrência código / padrão / item  
17. Paginação/busca/filtros server-side  
18. Meta `frontendHttp=false`; entidade fora de `HTTP_PILOT_ENTITIES`

PGlite pode cobrir unidade local; **gate de promoção** exige PostgreSQL real
(padrão 06B).

---

## 24. Decisões que não podem ficar abertas — quadro final

| # | Tema | Decisão |
|---|---|---|
| 1 | Ownership | Grupo + `empresa_id` origem; sem tabela órfã de Grupo |
| 2 | Compartilhamento | N:N `tabela_preco_empresas`; sem flag `compartilhar_grupo` |
| 3 | Padrão | `eh_padrao` no vínculo; único ativo por Empresa |
| 4 | ClienteEmpresa | `tabela_preco_id` NULLABLE aditivo na 013 |
| 5 | Fallback | específica → padrão Empresa → sem preço (fail-closed) |
| 6 | Vigência | DATE início/fim no cabeçalho; sem machine; sem vigência de item |
| 7 | Item identity | tabela + produto + unidade |
| 8 | Produto+unidade | preço por unidade; conversão no domínio Produto |
| 9 | Precisão | `NUMERIC(18,6)`; BRL; ≥ 0; zero só explícito |
| 10 | Histórico | in-place + audit; snapshot no documento futuro |
| 11 | Soft delete | `ativo=false`; restore mesma identidade |
| 12 | Tenant integrity | FK composta + triggers; cross-group nunca |
| 13 | RBAC | chaves §16; fail-closed |
| 14 | Audit | atômica; sem PII |
| 15 | Frontend HTTP | **não ativar** |
| 16 | Escopo 07B | §25 |

**Bloqueadores para autorizar 07B:** **NENHUM** (após review humano desta
especificação).

---

## 25. Escopo fechado do RUNTIME-07B

**Inclui (quando autorizado):**

- `013_tabelas_preco.sql` com as três tabelas + coluna em `cliente_empresas`
- repositories/services/router conforme contrato §18
- RBAC §16, audit §17, RLS §15
- seed sintético §22 e testes §23
- meta API `ERP-RUNTIME-07B` (ou nome oficial do lote) com `frontendHttp=false`

**Exclui:**

- Pedido, Orçamento, Estoque, FormaPagamento, Vendedor, Contato, Pessoa
- Faixas qty, reajuste, cópia (salvo decisão explícita futura)
- PriceBrain/IA gravando preço sem confirmação
- Dual-write Base44, cutover UI, ativação HTTP piloto
- Edição de migrations 001–012
- Promoção DEV/VPS sem runbook e gate PostgreSQL real

---

## 26. Critérios de entrada do 07B

1. Review humano desta especificação.  
2. Concordância com o quadro §24.  
3. Branch de **código** distinta desta documental.  
4. DEV permanece `ERP-RUNTIME-06B` até promoção própria.  
5. PR #26 (diagnóstico) pode permanecer Draft; não é pré-requisito de merge
   se este documento for a fonte operacional das decisões.

Sem review: **não iniciar 07B**.

---

## 27. Validação deste lote documental

- Arquivos pretendidos: este documento + registro em `STATUS_DO_PROJETO.md`
- `git diff --check`
- Nenhum código/migration/test/seed/config de produção
- Nenhum merge; 07B não iniciado

---

## 28. Referências

- `docs/ERP_RUNTIME_07_DIAGNOSTICO.md` (PR #26)
- `docs/ERP_RUNTIME_05_DIAGNOSTICO.md`, `docs/ERP_RUNTIME_06B.md`,
  `docs/ERP_RUNTIME_06B_DIAGNOSTICO.md`, `docs/ERP_RUNTIME_03_PRODUTO_MATRIX.md`
- `server/migrations/001_foundation.sql` … `012_obras.sql`
- `server/src/repositories/clienteTypes.ts` (`CLIENTE_FORBIDDEN_FIELDS`)
- `src/components/cadastros/TabelaPrecoFormCompleto.jsx`
- `src/components/comercial/TabelaPrecoItensModal.jsx`
- `base44/functions/_lib/security/siteCpaCatalogRead/entry.ts`
