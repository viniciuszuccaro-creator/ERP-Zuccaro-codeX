# Expedição — dependência legada `updateInContext("Pedido")` na Separação

## Estado factual

Em `SeparacaoConferencia.jsx`, quando a conferência conclui **sem divergência** e a tela recebeu a prop `pedido`, o fluxo legado ainda executa:

```js
updateInContext("Pedido", pedido.id, {
  status: "Pronto para Faturar",
  group_id, grupo_id, empresa_id,
})
```

Isso **não** passa por `pedidoService` / contratos HTTP canônicos do Comercial 360.

## Coordenação com Codex (#178)

| Item | Valor |
|---|---|
| Constante descritiva | `SEPARACAO_PEDIDO_LEGADO_SIDE_EFFECT` em `expedicaoFluxoOperacionalPolicy.js` |
| Entidade | `Pedido` |
| Via | `updateInContext` |
| Status alvo | `Pronto para Faturar` |
| Reservado | Sim — contratos Pedido/Orçamento, migrations 026–035, Armado/Corte/Dobra |
| Ação Cursor | Documentar + isolar side-effect descritivo; **não** sobrescrever trabalho Codex |
| Integração canônica | Codex define o caminho final (serviço/status/auditoria); Cursor adapta a Separação só após FINAL declarado |

## Regras deste lote

1. Não editar `pedidoService`, `orcamentoService`, tipos/repos, `saleIngress`, `migrate.ts`, mig 035, `ORDEM_INTEGRACAO`.
2. O helper `resolveSeparacaoConclusion` apenas **descreve** o patch legado (`pedidoLegadoPatch`); a tela continua responsável pela chamada `updateInContext`.
3. Com divergência de quantidade, o side-effect de Pedido **não** dispara.
4. Qualquer tip-port do #178 para este caminho exige declaração FINAL do Codex e revisão cruzada.

## Homologação mínima do side-effect

1. Separar entrega com prop `pedido` e itens conferidos → Pedido local deve ir para `Pronto para Faturar` (legado).
2. Separar com divergência → Pedido **não** muda.
3. Sem prop `pedido` (só `entregaId`) → nenhum update em Pedido.
