# Contrato mínimo — portas Expedição ↔ Pedido / estoque

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
| Romaneio com `despachar: true` | `estoquePort.onDespacho` **antes** de fechar status de saída | Se `failed` → throw `ESTOQUE_SIDE_EFFECT_FAILED` (502) + rollback TX |
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
