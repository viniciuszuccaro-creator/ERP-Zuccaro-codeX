# Expedição/Logística — candidata consolidada (#192–#194 + fluxo operacional)

## Escopo da candidata

Branch: `cursor/expedicao-fluxo-consolidado-392b`  
Base de consolidação: tip stack Expedição `#192 → #193 → #194` (filtros → detalhe/separação → roteirização) + fluxo operacional.

Fluxo coberto (telas/serviços existentes):

1. Selecionar entregas (empresa/grupo fail-closed)
2. Separar/conferir quantidades + checklist + dupla confirmação
3. Montar romaneio (`assertRomaneioOnCreate` + seleção elegível)
4. Despachar (status `Saiu para Entrega` + histórico)
5. Registrar entrega total / parcial / ocorrência (prova/motivo)
6. Acompanhar pendências (listagem + filas)

**Não simulado neste lote:** roteirizador avançado, WhatsApp, provedores externos ausentes, VPS/merge, tip-port #178.

## Arquivos principais

| Área | Arquivo |
|---|---|
| Asserts canônicos | `src/components/lib/expedicaoEntregaPolicy.js` |
| Fluxo operacional (extração) | `src/components/lib/expedicaoFluxoOperacionalPolicy.js` |
| UI | `SeparacaoConferencia`, `RomaneioForm`, `DetalhesEntregaView`, `EntregasListagem`, `QueuesLogistica`, `RoteirizacaoMapa` |
| Testes comportamentais | `tests/expedicao-fluxo-operacional.test.js` |
| Pedido legado | `docs/EXPEDICAO_SEPARACAO_PEDIDO_LEGADO.md` |

## CI do conjunto

Executar na PR consolidada:

```bash
node --test tests/expedicao-entrega-policy.test.js tests/expedicao-fluxo-operacional.test.js
npm test
npm run lint
npm run typecheck
npm run build
git diff --check
```

Workflow esperado: `erp-runtime-ci` (frontend + backend) SUCCESS no HEAD da candidata.

## Homologação manual (SPA existente)

Pré-condições: contexto grupo∧empresa, perfil com `Expedicao.Separacao.conferir`, `Expedicao.Romaneios.criar`, `Expedicao.Entrega.entregar` / `ocorrencia`.

1. **Troca de empresa:** na listagem em visão de grupo, selecionar entregas da empresa A; filtrar empresa B → seleção de A some; romaneio não aceita ID de outra empresa.
2. **RBAC:** perfil sem conferir/criar romaneio → botões/ações bloqueados; tentativa audita bloqueio.
3. **Separação:** informar quantidades; checklist incompleto bloqueia; confirmação cancelada não grava; quantidades zeradas bloqueiam; divergência grava separação sem liberar “Pronto para Expedir”.
4. **Romaneio/despacho:** só entregas “Pronto para Expedir” da empresa; checklist de saída; confirmação; após gerar, entregas em “Saiu para Entrega” com `romaneio_id`.
5. **Parcial/total/ocorrência:** parcial exige quantidade > 0 e prova; total exige prova (assinatura); ocorrência exige motivo; confirmação dupla.
6. **Pendências:** banner na listagem e resumo em `QueuesLogistica` refletem parcial/ocorrência/atraso/separação.
7. **Pedido legado:** ver `docs/EXPEDICAO_SEPARACAO_PEDIDO_LEGADO.md` — não validar contrato canônico Codex neste gate.

## Rollback

1. **Sem merge:** fechar/abandonar a draft PR consolidada; tip `#194` permanece referência anterior.
2. **Após merge em main (só se autorizado):** `git revert` do merge commit da candidata; não reverter migrations 026–035; não tocar Pedido/Orçamento Codex.
3. **Runtime VPS:** este lote **não** autoriza deploy. Se um gate futuro aplicar a candidata, rollback = imagem/container anterior preservado (gates vigentes); sem drop/truncate.

## Reserva Codex

Arquivos Pedido/Orçamento, mig 035 e correlatos do #178 permanecem intocados. Integração canônica do side-effect `Pedido` só após FINAL do Codex.
