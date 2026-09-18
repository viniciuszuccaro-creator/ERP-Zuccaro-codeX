# ERP-RUNTIME-05 — Diagnóstico arquitetural

**Status:** `DIAGNÓSTICO SOMENTE — AGUARDANDO REVIEW`
**Base:** `4c4d798d5108cdf9f49adb222397c8891f00f056`
**Decisão:** evoluir o relacionamento comercial **Cliente × Empresa** já
existente em `cliente_empresas`.

## 1. Decisão

O ERP-RUNTIME-05 deve ser:

> **Relacionamento Comercial Cliente × Empresa — núcleo e elegibilidade**

Não é Cliente 360º. Não cria outra identidade Cliente e não substitui
Financeiro, Preço, Vendedor, Endereço, Estoque, Orçamento ou Pedido.

### Por que agora

1. RUNTIME-04 já criou `clientes` no Grupo e o vínculo mínimo
   `cliente_empresas`; evoluir essa tabela melhora o existente.
2. O cadastro Base44 ainda grava `vendedor_responsavel_id`,
   `condicao_comercial`, tabela, forma e limite dentro do documento Cliente
   compartilhado do Grupo (`CadastroClienteCompleto.jsx`). Isso não distingue
   regras da CPA e da 3Z.
3. Pedido, Site CPA, catálogo, crédito e vendedor já resolvem `empresa_id`, mas
   não consultam `cliente_empresas`.
4. Preço, Orçamento e Pedido precisam saber antes se o Cliente está habilitado,
   bloqueado ou inativo naquela empresa.
5. O núcleo do vínculo pode ser um lote pequeno, reversível e E2E, sem migrar
   todo o Comercial.

## 2. Evidência do código atual

### PostgreSQL/API

- `server/migrations/009_clientes_master_data.sql`: `clientes` (Grupo) e
  `cliente_empresas` (Empresa), hoje apenas com `ativo` e timestamps.
- `server/src/repositories/postgresClienteRepository.ts`: cria o vínculo como
  side effect quando Cliente nasce com `empresa_id`; não há CRUD próprio.
- `server/src/services/clienteService.ts`: rejeita limite, crédito, tabela e
  vendedor na identidade master.
- `server/tests/runtime04.test.ts`: prova integridade cross-group, RBAC e RLS.
- Não há tabela/API PostgreSQL para preço, estoque, endereço, obra, orçamento,
  pedido, forma de pagamento, colaborador ou representante.

### Cadastro Geral e consumidores Base44

- `src/components/cadastros/CadastroClienteCompleto.jsx` persiste no Cliente:
  `vendedor_responsavel_id`, `condicao_comercial`, `endereco_principal`,
  `contatos[]` e `locais_entrega[]`.
- `src/components/cadastros/blocks/Bloco1Pessoas.jsx` mantém Cliente,
  Colaborador, ContatoB2B e SegmentoCliente no Hub de Cadastros.
- `src/components/cadastros/blocks/Bloco2Produtos.jsx` mantém `TabelaPreco`.
- `src/components/cadastros/blocks/Bloco3Financeiro.jsx` mantém
  `FormaPagamento`.
- `base44/functions/_lib/security/siteCpaCustomerResolve/entry.ts` lê endereços,
  ContatoB2B, vendedor e condição do Cliente.
- `siteCpaCatalogRead/entry.ts` lê
  `Cliente.condicao_comercial.tabela_preco_id`.
- `siteCpaOrderCreate/entry.ts` lê forma/condição e cria Pedido da empresa.
- `useFluxoPedido.jsx`/`pedidoFaturamentoPolicy.js` leem limite incorporado.

Contagem aproximada de arquivos com referências (busca textual; não é grafo de
dependências): Cliente/comercial 43; endereços/contatos/obras 80; preço 63;
estoque 159; orçamento 34; pedido 468; pagamento 96; vendedor/colaborador 144.

## 3. Fontes de verdade por domínio

| Dado | Ownership correto | RUNTIME-05 |
|---|---|---|
| identidade, CPF/CNPJ, nome | Cliente/Grupo | somente FK `clientes.id` |
| habilitação/situação/bloqueio por empresa | `cliente_empresas` | sim |
| observação/classificação comercial por empresa | `cliente_empresas` | sim, após fechar vocabulário |
| vendedor responsável | relacionamento por empresa | conceitualmente sim; FK aguarda identidade canônica de Colaborador/Representante |
| tabela de preço padrão | relacionamento por empresa | conceitualmente sim; FK aguarda TabelaPreco PostgreSQL |
| forma/condição padrão | relacionamento por empresa | conceitualmente sim; FK aguarda FormaPagamento/Condição canônica |
| limite, utilizado, títulos, risco | Financeiro | não duplicar; Cliente 360º consultará projeção financeira |
| endereço/contato/obra | cadastro relacionado ao Cliente | fora do RUNTIME-05 |
| preço efetivo | motor de Preço | fora do RUNTIME-05 |

`clientes.empresa_id` permanece empresa de origem/preferencial por
compatibilidade; não define ownership. O vínculo canônico é `cliente_empresas`.

## 4. Candidatos e dependências

| Candidato | Depende de | É dependência de | Diagnóstico |
|---|---|---|---|
| **Cliente × Empresa** | Cliente e Empresa (já disponíveis) | preço por cliente, elegibilidade, orçamento, pedido, Site/B2B | alto valor estrutural; risco médio; lote pequeno; máxima reutilização |
| Endereços/Contatos/Obras | Cliente; geolocalização; regras de snapshot | Pedido, Fiscal, Expedição, GoTo/omnichannel | alto valor, mas reúne PII e três modelos atuais (`contatos[]`, `ContatoB2B`, `locais_entrega[]`) |
| Tabela/Preço | Produto, Empresa e, para personalização, ClienteEmpresa | Site, B2B, Marketplace, Orçamento, Pedido | crítico, porém shapes divergentes e alçada/versionamento tornam o lote maior |
| Estoque/Disponibilidade | Produto, Empresa, LocalEstoque, transações concorrentes | Site, Pedido, Compras, Produção | bloqueador de venda; alto risco contábil/concorrente; 3 caminhos atuais de reserva |
| Orçamento/Negociação | ClienteEmpresa, endereço, preço, pagamento e disponibilidade | Pedido | três trilhas atuais; migrar agora consolidaria dependências ainda instáveis |
| Pedido | todos os anteriores + Fiscal/Financeiro/Produção/Logística | operação ponta a ponta | maior número de consumidores e maior risco; não cabe em lote pequeno |
| Forma/Condição Pagamento | Empresa, Financeiro, gateways | ClienteEmpresa, Orçamento, Pedido | cadastro canônico necessário; `CondicaoPagamento` hoje é string/template |
| Vendedor | Colaborador/Representante/Profile e empresa | ClienteEmpresa, oportunidade, comissão | identidade ambígua; criar `Vendedor` paralelo violaria Regra-Mãe |
| Site CPA S2S | Cliente, preço, disponibilidade, pagamento, pedido | canais externos | reserva histórica como “RUNTIME-05” em `ERP_RUNTIME_01.md`; já existe em Base44, mas não deve preceder suas fontes PostgreSQL |

### Matriz qualitativa

| Critério | ClienteEmpresa | Endereço/Obra | Preço | Estoque | Orçamento | Pedido | Pagamento | Vendedor |
|---|---|---|---|---|---|---|---|---|
| dependência Comercial 360 | fundacional | alta | alta | alta | alta | alta | média | alta |
| dependência de Pedido | direta | direta | direta | direta | origem | agregado | direta | direta |
| Site/B2B/Marketplace | habilitação | entrega | preço | disponibilidade | negociação | venda | checkout | atendimento |
| risco se adiado | regra comercial no Cliente global | snapshots paralelos | preço divergente | sobre-reserva | trilhas paralelas | monólito cresce | strings/mocks | IDs ambíguos |
| independência para lote pequeno | **alta** | média | baixa/média | baixa | baixa | muito baixa | média | baixa |
| compatibilidade R01–04 | **direta; tabela já existe** | usa Cliente 04 | usa Produto 03 | usa Produto 03 | usa Cliente/Produto | usa tudo | sem PG | sem PG |
| valor Go-Live | alto | alto | alto | crítico | alto | crítico | alto | médio |
| valor Produção | indireto | obra/projeto | custo/preço | insumo | demanda | origem OP | baixo | responsável |

Não há pontuação numérica: a precedência decorre das FKs já disponíveis,
reutilização de `cliente_empresas`, tamanho do lote e dependências downstream.

## 5. Escopo proposto do RUNTIME-05

### Dentro

- melhorar `cliente_empresas`, sem tabela paralela;
- definir situação/habilitação e bloqueio comercial por Empresa;
- observação comercial sanitizada e metadados de origem/legado estritamente
  necessários à futura migração;
- lifecycle ativo/inativo + restore, sem hard delete;
- API tenant-scoped para listar, obter, criar/vincular, atualizar, inativar e
  restaurar o relacionamento;
- paginação/count quando a listagem for por empresa;
- RBAC backend, RLS, allowlist/mass-assignment, auditoria antes/depois;
- seed A/B convergente e E2E PostgreSQL DEV.

### Fora

- limite/crédito/títulos;
- cadastro ou FK improvisada de vendedor;
- tabela/preço, forma/condição de pagamento;
- contatos, endereços, obras e projetos;
- Cliente 360º, Comercial 360º, Orçamento, Pedido, Estoque;
- Site/Portal/Marketplace/GoTo/omnichannel/IA;
- ativação no `HTTP_PILOT_ENTITIES`.

Os campos comerciais atuais do Cliente Base44 permanecem compatibilidade
legada até migração homologada; não haverá dual-write silencioso.

## 6. Implementação provável (não executada)

- Migration: **`010_cliente_empresas_comercial.sql`**, aditiva, convergente e
  não destrutiva, alterando `cliente_empresas`.
- Reutilizar:
  - `clienteTypes.ts`;
  - `postgresClienteRepository.ts`/`inMemoryClienteRepository.ts`;
  - `ClienteService`;
  - `PostgresRbacGuard`, `TenantGuard`, auditoria e router atuais.
- API provável:
  - `GET /api/v1/clientes/:clienteId/empresas`;
  - `GET /api/v1/clientes/:clienteId/empresas/:empresaId`;
  - `PUT/PATCH /api/v1/clientes/:clienteId/empresas/:empresaId`;
  - `DELETE .../:empresaId` (inativar);
  - `POST .../:empresaId/restore`.
- Nenhuma migration/importação real foi criada neste diagnóstico.

## 7. Multiempresa, RBAC, auditoria e segurança

### Multiempresa

- identidade: `clientes.group_id`;
- relacionamento: exatamente um por `(cliente_id, empresa_id)`;
- Empresa só lê/opera seus vínculos;
- Grupo consolida vínculos das empresas autorizadas;
- FK/trigger deve manter Cliente e Empresa no mesmo Grupo;
- query/cache sempre inclui actor + `groupId` + `empresaId` + `scopeType`.

### RBAC provável

- `cadastros.cliente.relacionamento.visualizar`;
- `cadastros.cliente.relacionamento.criar`;
- `cadastros.cliente.relacionamento.editar`;
- `cadastros.cliente.relacionamento.inativar`;
- `cadastros.cliente.relacionamento.restaurar`;
- bloqueio comercial, se sensível, exige ação própria.

O uso do Cliente em Pedido deve ter permissão Comercial separada e não conceder
edição cadastral. A implementação deve ampliar o resolver canônico existente,
não criar outro sistema de permissões.

### Auditoria

CREATE/LINK, UPDATE, BLOCK/UNBLOCK, INACTIVATE e RESTORE, com before/after,
actor/perfil, grupo/empresa, correlationId, origem e timestamp. Não copiar PII
desnecessária; falha de auditoria em ação sensível deve bloquear/rollback.

### Segurança

- schema estrito, allowlist e limites;
- rejeitar `cliente_id`, `group_id` e `empresa_id` adulterados;
- RLS FORCE fail-closed e integridade composta;
- nenhuma atualização de crédito/preço por mass assignment;
- concorrência: UPSERT/unique `(cliente_id, empresa_id)`;
- idempotência por chave natural do vínculo;
- soft delete preserva pedidos e histórico.

## 8. Seed e E2E propostos

Seed sintético convergente:

- Grupo A: Cliente A vinculado à Empresa A;
- Grupo A: mesmo Cliente A vinculado a uma segunda empresa A2;
- Grupo B: Cliente B vinculado à Empresa B;
- vínculos ativo, inativo/bloqueado e legado parcial para reconciliação.

E2E obrigatório:

1. Empresa A cria/lê/edita/inativa/restaura seu vínculo;
2. Grupo A consolida A/A2 conforme permissão;
3. Empresa A não lê dados privados A2 sem autorização;
4. Grupo/Empresa B não lê nem altera Cliente/vínculo A;
5. RBAC negado → 403 mesmo com tenant correto;
6. permissão correta + tenant adulterado → bloqueado;
7. vínculo repetido não duplica;
8. Cliente e Empresa de grupos diferentes → bloqueio no banco;
9. list/search/count/paginação consistentes;
10. auditoria before/after e falha rollback;
11. soft delete mantém histórico e impede uso em nova operação;
12. seed executado duas vezes converge.

## 9. Impacto no Comercial 360º

O RUNTIME-05 fornecerá a resposta canônica para:

> “Este Cliente do Grupo pode operar nesta Empresa e em qual situação?”

Isso evita copiar Cliente, separa dados globais dos empresariais e cria o ponto
de composição futuro para vendedor, preço e condição. Cliente 360º continuará
sendo uma visão; Financeiro, Preço, Estoque e Atendimento permanecem
proprietários de seus dados.

## 10. Sequência provisória

1. **RUNTIME-05 — Cliente × Empresa / elegibilidade comercial.**
2. **RUNTIME-06 — Locais do Cliente (endereços de cobrança, fiscal, entrega e
   obra), preservando snapshot no Pedido.**
3. **RUNTIME-07 — Tabela de Preço / preço comercial versionado e explicável.**
4. **RUNTIME-08 — Estoque, disponibilidade de venda e reserva concorrente.**
5. **RUNTIME-09 — Orçamento e negociação canônicos.**

Antes de RUNTIME-09, Forma/Condição de Pagamento e a identidade
Colaborador/Representante usada como vendedor precisam de decisão/migração
canônica; se não estiverem prontas, entram como lotes próprios e deslocam a
numeração. Pedido canônico vem somente depois dessas dependências.

Contatos omnichannel, Projeto/Engenharia, Site S2S e Pedido permanecem
posteriores; nenhum deles foi autorizado por este diagnóstico.

## 11. Baseline

- `npm run audit:baseline`: PASS;
- `npm run lint`: PASS;
- `npm run typecheck`: baseline histórico, exit 2; nenhuma alteração funcional
  ou nova falha causada por este lote documental;
- `npm run build`: PASS;
- `git diff --check`: PASS.
