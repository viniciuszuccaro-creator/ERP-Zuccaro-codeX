# Contrato mínimo — portas Expedição ↔ Pedido / estoque

## Candidata integrada Codex (2026-10-04)

`server/src/integrations/expedicaoPersistentPorts.ts` implementa as portas persistentes usando o `DbQueryExecutor` da mesma transação de Entrega/Romaneio. A migration aditiva `037_expedicao_estoque_movimentos.sql` cria eventos de Pedido sem inventar novos estados, saldo de estoque por Grupo/Empresa/Produto e movimentos por item de despacho, devolução e cancelamento, com chaves idempotentes e auditoria. A migration **não cria saldo de abertura**. A porta falha se o saldo reconciliado estiver ausente ou insuficiente (`ESTOQUE_BASELINE_OR_SALDO_INSUFICIENTE`); não habilitar no runtime DEV antes dessa reconciliação e da revisão independente.

**Unidade canônica (ressalva #218):** a PK de `expedicao_estoque_saldos` permanece `(group_id, empresa_id, produto_id)` — **sem** coluna de unidade e **sem** somar unidades distintas. A unidade oficial é `produtos.unidade_medida_id` (uma por produto). O comparador offline usa a mesma chave composta; duas linhas de unidades diferentes no mesmo produto são `DUPLICATE_KEY`. A porta persistente rejeita `ESTOQUE_UNIDADE_CANONICA_AUSENTE` / `_MISMATCH` / `_COLISAO`. Não há migration 038/032 para “consertar” a PK.

**Candidata Codex tip:** `f514c2e3` (+ #219) em `codex/comercial-expedicao-cliente360-207-209-20261005`.

**Fonte oficial dos saldos (caminho HTTP/BFF):** `expedicao_estoque_saldos` + `expedicao_estoque_movimentos`. Com `VITE_ERP_HTTP_EXPEDICAO=true`, a SPA **não** cria `MovimentacaoEstoque` nem altera `produto.estoque_atual` no despacho/devolução — isso evita contabilidade paralela/dupla. Opt-in de runtime: `EXPEDICAO_PERSISTENT_PORTS=true` (exige `DATABASE_URL`); `/meta` reporta `pedidoEstoqueSideEffects: ledger` e `estoqueFonteOficial: expedicao_estoque_saldos`. Sem flag, permanece `reserved` (fail-closed para Pedido vinculado). Sequência de migrations: 001–031, **gap intencional sem 032**, 033–037; trava histórica da 026 preservada.

**Limite da afirmação de fonte oficial:** o ledger 037 é canônico apenas para operações da Expedição no caminho HTTP/BFF opt-in. O modo legado/local continua com `MovimentacaoEstoque`; `isHttpExpedicaoEnabled` exige simultaneamente backend HTTP e flag de Expedição, e `LogisticaReversa` usa ramos mutuamente exclusivos. Não há prova de que o saldo Base44/local e o ledger PostgreSQL já estejam reconciliados entre si, nem autorização para dois writers sobre o mesmo estoque operacional. Antes de ativar, congelar o writer legado para as mesmas empresas/produtos/fluxos ou estabelecer corte controlado e reconciliado. Para cada `(group_id, empresa_id, produto_id, unidade_medida_id)`, registrar origem, instante de corte, saldo da fonte, saldo de abertura proposto, diferenças e responsável; exigir contagens iguais, unidades compatíveis, zero divergências não justificadas e ausência de movimentos concorrentes durante o corte. Não inferir saldo por `produto.estoque_atual` ou por ausência de linha; a 037 não insere abertura. Validar esses relatórios somente em ambiente isolado antes de qualquer carga, com backup/restore e reversão aprovados para o destino específico.

**Comparação offline preliminar:** `reconcileExpedicaoStock` recebe dois snapshots já extraídos e mapeados, sem credenciais, rede ou gravação. Cada linha requer Grupo, Empresa, produto canônico, unidade, quantidade decimal exata e identificador de evidência; ambos os lados requerem o mesmo instante de corte UTC. O resultado bloqueia duplicidades, ausências, unidades e quantidades divergentes. `ready` significa apenas igualdade desses snapshots, **não** autorização de carga ou ativação: a extração precisa demonstrar cobertura de locais/lotes, mapeamento de unidades, ausência de writers concorrentes e trilha de origem; depois são necessários backup do destino, ensaio de restore, plano de rollback, piloto isolado e aprovação humana. Nenhum saldo real deve ser incluído no GitHub.

**Prova técnica do lote integrado:** o teste R11 PostgreSQL cria dois itens sintéticos ordenados; o segundo sem baseline força falha após a primeira dedução na mesma transação e exige rollback do saldo, dos movimentos, do evento de Pedido e da auditoria. Após baseline sintético isolado, retry aplica um despacho por item e cancelamento compensa uma vez. Isso prova atomicidade do ledger, não reconciliação de saldos reais nem autorização de ativação. O gap 032 permanece ausência de arquivo, não migration a fabricar.

As portas persistentes também podem ser injetadas por `createApp({ expedicaoPedidoPort, expedicaoEstoquePort })`. O default `reserved` e o bloqueio de Pedido vinculado permanecem. Cada efeito exige `actorId`, executor ativo, tenant e item; nenhuma conexão paralela ou transação aninhada. O `ExpedicaoService` altera primeiro os estados na transação ainda não comitada, depois chama Pedido e estoque; qualquer erro reverte **todos** os estados, movimentos e auditorias. Na devolução vinculada, a quantidade por item é obrigatória. Cancelamento de Entrega vinculada chama compensação de estoque e evento de Pedido na mesma transação, creditando apenas o saldo ainda não devolvido por item. A CI PostgreSQL isolada exige migrações 025–037 e prova concorrência, retry, parcial, devolução, cancelamento e rollback. Esta prova sintética não homologa saldo operacional, credenciais nem implantação.

**Destinatário:** Codex Comercial (#178 / tip-port autorizado).
**Autor:** Cursor (#199). **Sem tip-port nesta branch** — este documento é o contrato para implementação no lado Comercial.

## Princípios

1. Expedição **não** muta Pedido nem estoque diretamente.
2. Side-effects passam por portas injetáveis no `ExpedicaoService`.
3. Default em produção/CI até tip-port: `reserved` (no-op seguro).
4. Retorno `failed` em estoque **aborta a TX** da Expedição (sem romaneio órfão / sem falso sucesso).
5. Multiempresa absoluta: toda chamada carrega `groupId` + `empresaId`.
6. Fail-closed: sem escopo ou sem permissão → não chama porta.

### Executor transacional compartilhado (candidata Codex 02/10)

Cada método de porta recebe agora `executor?: DbQueryExecutor` como segundo argumento. Em PostgreSQL, o serviço passa o executor ativo de `ExpedicaoRepository.withTransaction`; o adaptador deve executar **todas** as leituras, movimentos, mudanças de Pedido e auditorias com esse executor, sem abrir transação aninhada ou usar a conexão do pool diretamente. O `undefined` preserva os ensaios in-memory, mas não autoriza efeito persistente fora de transação. O teste PGlite grava efeitos sintéticos pelas duas portas, força falha de estoque e verifica rollback de ambos junto com Romaneio/Entrega. Nenhum adaptador de estoque real foi ativado por esta alteração; `reserved` e os bloqueios vinculados permanecem.

## Tipos canônicos (já no tip #199)

Fonte: `server/src/repositories/expedicaoTypes.ts`

```ts
export type ExpedicaoPedidoSideEffectPort = {
  onSeparacaoConcluida(input: {
    groupId: string;
    empresaId: string;
    pedidoId: string | null;
    entregaId: string;
  }, executor?: DbQueryExecutor): Promise<'reserved' | 'applied'>;

  onDespacho(input: {
    groupId: string;
    empresaId: string;
    pedidoIds: string[];
    romaneioId: string;
  }, executor?: DbQueryExecutor): Promise<'reserved' | 'applied'>;
};

export type ExpedicaoEstoquePort = {
  onDespacho(input: {
    groupId: string;
    empresaId: string;
    entregaIds: string[];
  }, executor?: DbQueryExecutor): Promise<'reserved' | 'applied' | 'failed'>;

  onDevolucao(input: {
    groupId: string;
    empresaId: string;
    entregaId: string;
    quantidade: string; // NUMERIC string; nunca float
  }, executor?: DbQueryExecutor): Promise<'reserved' | 'applied' | 'failed'>;
};
```

Defaults: `reservedPedidoPort`, `reservedEstoquePort` (sempre `'reserved'`).

## Pontos de chamada (ExpedicaoService)

| Momento | Porta | Quando |
|---|---|---|
| Separação concluída sem divergência | `pedidoPort.onSeparacaoConcluida` | Após persistir Separacao + status `PRONTO_EXPEDIR` |
| Romaneio com `despachar: true` | `estoquePort.onDespacho` após marcar saída, ainda na TX | Se `failed` → throw `ESTOQUE_SIDE_EFFECT_FAILED` (502) + rollback TX |
| Romaneio despachado | `pedidoPort.onDespacho` | Após status `SAIU_ENTREGA` / romaneio `EM_ROTA` |
| Devolução (`devolver_estoque`) | `estoquePort.onDevolucao` | Após status `DEVOLVIDA`; `failed` → rollback TX |

## Semântica esperada do tip-port Codex

### Pedido

| Método | Efeito mínimo quando `applied` |
|---|---|
| `onSeparacaoConcluida` | Pedido elegível → status alinhado a “Pronto para Expedir” (ou equivalente canônico), **somente** se `pedidoId` no mesmo `groupId∧empresaId` |
| `onDespacho` | Pedidos listados → “Em Trânsito” / “Saiu para Entrega”, mesmo tenant; IDs fora do escopo → ignore/fail-closed sem vazamento |

Não inventar Pedido. Sem `pedidoId` → no-op `applied` ou `reserved` sem erro.

### Estoque

| Método | Efeito mínimo quando `applied` |
|---|---|
| `onDespacho` | Baixa/reserva das quantidades das entregas no escopo empresa |
| `onDevolucao` | Devolve `quantidade` à posição de estoque da entrega |

`failed` = indisponibilidade/regra de negócio; Expedição **não** mascara como sucesso.

## Injeção

`createApp({ expedicaoPedidoPort, expedicaoEstoquePort })` — testes #199 já cobrem `failed` → rollback.

## Fora de escopo deste contrato

- Tip-port na branch Expedição (#199)
- Alterar migrations comerciais 025–035
- Mutação Pedido via SPA `updateInContext` no caminho HTTP canônico
- Emissão fiscal / financeiro

## Migration Expedição

Arquivo: `server/migrations/036_expedicao_entregas_romaneios.sql`.
Numeração **036** para não colidir com a reserva comercial Codex **025–035**.

## Aceite tip-port

1. Implementar adapters nas portas acima no tip Comercial.
2. Testes PG: despacho `applied`, falha estoque → Entrega permanece `PRONTO_EXPEDIR`, sem romaneio.
3. Meta BFF: `pedidoEstoqueSideEffects` deixa de ser só `'reserved'` quando adapters ativos (combinar com feature flag se necessário).
4. Sem tip-port silencioso na Expedição.


## Pacote DEV (preparação — execução sob gate)

Checklist reprodutível **sem** executar VPS/Auth/publisher sem autorização:

1. **Portas:** API `3080` (BFF) e SPA `3081`/`5173` conforme runbooks existentes; isolamento de schema exigido.
2. **Grants/RLS:** migration 037 já faz `ENABLE+FORCE RLS` e `REVOKE ALL … FROM PUBLIC` em `expedicao_estoque_saldos` / `movimentos` / `pedido_eventos`. Role de probe sem `BYPASSRLS` deve ver zero linhas cross-tenant (provado em `runtime11-expedicao-persistent-postgres` quando `DATABASE_URL` existe).
3. **Saldo de abertura:** **não inventar**. Reconciliar cada `(group_id, empresa_id, produto_id)` com a fonte de estoque aprovada **antes** de `EXPEDICAO_PERSISTENT_PORTS=true`. Ausência → `ESTOQUE_BASELINE_OR_SALDO_INSUFICIENTE`.
4. **Backup/rollback:** backup SQL restaurável do destino + imagem/container anterior preservados (gates D/E/F). Rollback de código = reverter flag/`reserved`; rollback de dados = restore do backup — sem DROP operacional.
5. **Smoke:** `/meta` → `pedidoEstoqueSideEffects` (`reserved`|`ledger`) + fluxo sintético Pedido→separação→romaneio→despacho→parcial→devolução com auditoria. Publisher/Auth reais fora deste pacote.

**Estado atual:** preparação documentada; execução VPS/DEV real **BLOCKED** até gate explícito.

### Evidência sanitizada — skip path `DATABASE_URL` (runtime11)

Quando `DATABASE_URL` está ausente, o teste `R11 persistent-postgres: evidência sanitizada do skip path` **passa** documentando:

```json
{
  "databaseUrlConfigured": false,
  "persistentPostgresExecutable": false,
  "blockedReason": "DATABASE_URL_NOT_AVAILABLE",
  "doesNotInventOpeningBalance": true,
  "doesNotInventMigration032": true
}
```

O teste de fluxo completo permanece `skip` (não é sucesso silencioso). Com URL isolada autorizada, o mesmo arquivo executa despacho/retry/parcial/devolução/cancelamento/rollback + probe RLS. **Nunca** logar a connection string.

### Evidência local sem `DATABASE_URL` (candidata Codex)

| Prova | Resultado |
|---|---|
| `runtime11-expedicao-pglite` (HTTP fluxo + rollback) | PASS (suíte existente) |
| `R11 PGlite: ledger canônico — despacho/retry/parcial/devolução/cancelamento/rollback` | Portas `PostgresExpedicao*` reais sobre 037 em PGlite — cobre concorrência/idempotência/rollback **sem** inventar saldo de abertura |
| `runtime11-expedicao-persistent-postgres` | **SKIP** — `DATABASE_URL` ausente neste ambiente (sem Docker/serviço PG) |
| Grants/RLS probe role (`SET LOCAL ROLE`) | Só no teste PostgreSQL real; PGlite não substitui |
| Saldo abertura reconciliado operacional | **BLOCKED** — gate humano; migration 037 não inventa |

Comando quando houver PG isolado autorizado:

```bash
DATABASE_URL=postgresql://… npm test -- --test-name-pattern='R11 PostgreSQL real: despacho'
# ou
cd server && DATABASE_URL=… node --import tsx --test tests/runtime11-expedicao-persistent-postgres.test.ts
```
