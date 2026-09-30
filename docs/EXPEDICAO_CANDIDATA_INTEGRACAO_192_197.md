# Expedição/Logística — candidata consolidada de integração (#192–#197)

## Identidade

| Campo | Valor |
|---|---|
| Candidata | Stack draft **#192 → #197** (tip = #197) |
| Branch tip | `cursor/expedicao-integracao-romaneio-canonico-392b` |
| Estado | **Candidata de integração** — pacote funcional fechado em código/testes |
| CI tip | frontend+backend SUCCESS no HEAD do tip (**≠** homologação SPA/VPS) |

## Cadeia

| PR | Entrega |
|---|---|
| #192 | Filtros listagem/romaneio (empresa/cidade/data/futuras) |
| #193 | Detalhe + separação fail-closed |
| #194 | Roteirização fail-closed |
| #195 | Fluxo operacional consolidado + testes |
| #196 | Pedidos→separação, unidades, rollback despacho |
| #197 | IntegracaoRomaneio + soft∨ crítico + comprovante/ocorrência/IA + **cliente** coerente listagem/mapa/romaneio + devolução assert + quantidades pendentes + compensação≠atômico |

## Escopo coberto (pacote)

1. Seleção Pedidos elegíveis; separação/conferência integral/parcial; bloqueio por qtd/unidade/estado  
2. Create/reuse Entrega; romaneio; despacho; idempotência; recuperação de falha (compensação)  
3. Parcial/total + prova; ocorrências; logística reversa (assert); quantidades pendentes  
4. Filtros empresa, cidade, **cliente**, data cliente, futuras — coerentes em listagem, mapa e romaneio  
5. RBAC + grupo∧empresa + auditoria nas ações sensíveis  
6. Testes comportamentais: persistência simulada, concorrência/retry, rollback compensatório vs decisão atômica de policy  
7. Esta candidata documentada (deps comerciais, homologação, rollback)

## Dependências comerciais (Codex)

| Item | Status |
|---|---|
| Side-effect `Pedido` (`updateInContext`) | Descritivo; tip-port **só após #178 FINAL** |
| Orçamento / mig 026–035 / mapper legado / Armado-Corte-Dobra | Reserva — intocado |
| Export Empresas / reconciliação | Frente legado chat principal — não duplicar |

## Persistência: compensação × atômico

| Operação | Modelo | Mecanismo |
|---|---|---|
| `assertRomaneioOnCreate` / `assertEntregaOnCreate` / `resolveRegistroEntregaFinal` | **Atômico de policy** | Uma decisão create\|reuse\|patch validado |
| `applyDespachoPatchesWithRollback` | **Compensação** | N updates de Entrega; falha no meio reverte já aplicados |
| `IntegracaoRomaneio` | **Compensação** | Creates + romaneio + patches + Pedido legado |
| `LogisticaReversa` | **Compensação** | Entrega → ContaReceber → estoque → notificação (**sem** TX única) |

Constante: `PERSISTENCIA_EXPEDICAO` em `expedicaoFluxoOperacionalPolicy.js`.

## Integrações externas (explicitamente pendentes)

| Integração | Estado |
|---|---|
| WhatsApp / mensageria real | Pendente — mocks/simuladores **não** homologados |
| Roteirizador avançado / provedor externo | Pendente — otimização local ≠ serviço homologado |
| Assinatura digital como serviço | Pendente — prova local (foto/assinatura base64) na Entrega |

## Testes

```bash
node --test tests/expedicao-entrega-policy.test.js tests/expedicao-fluxo-operacional.test.js
```

Inclui filtro cliente, E2E Pedido→pendências, quantidades pendentes, compensação≠atômico.

## Homologação SPA (obrigatória antes de merge)

1. Grupo∧empresa + permissões Separação/Romaneio/Entrega/Ocorrência/Reversa  
2. Pedido elegível → separação (manual/IA) → Entrega pronta  
3. Filtros listagem/mapa/romaneio alinhados (empresa, cidade, cliente, data, futuras)  
4. Romaneio + despacho; simular falha parcial → status revertido + auditoria  
5. Comprovante total/parcial; ocorrência; devolução; pendências com qtd  
6. Retry não duplica Entrega/Romaneio  
7. Pedido legado: validar com Codex no #178 FINAL  

## Rollback

1. Sem merge: fechar drafts #197→#192  
2. Pós-merge autorizado: revert do merge; **não** reverter 026–035; **não** tocar Pedido Codex  
3. VPS: **não** autorizado neste lote  

## Quadro objetivo

| Pronto p/ integração | Falta | Bloqueios reais |
|---|---|---|
| Fluxo operacional completo no tip #197 | Homologação humana SPA | #178 FINAL |
| Isolamento∧, RBAC, filtros coerentes, testes | WhatsApp/roteirizador/assinatura como serviço | Merge/VPS/import Empresas |
| Compensação documentada e testada | Tip Comercial 360 | Autorização merge ordenado |
