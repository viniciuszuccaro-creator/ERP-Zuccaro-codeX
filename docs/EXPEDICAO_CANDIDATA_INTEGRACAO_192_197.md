# Expedição/Logística — candidata consolidada de integração (#192–#197)

## Identidade

| Campo | Valor |
|---|---|
| Candidata | Stack draft **#192 → #197** (tip = #197) |
| Branch tip | `cursor/expedicao-integracao-romaneio-canonico-392b` |
| Estado | **Candidata de integração homologável** — persistência/recuperação provada em testes de integração das telas |
| CI tip | frontend+backend no HEAD do tip (**≠** homologação SPA/VPS) |

## Cadeia

| PR | Entrega |
|---|---|
| #192 | Filtros listagem/romaneio (empresa/cidade/data/futuras) |
| #193 | Detalhe + separação fail-closed |
| #194 | Roteirização fail-closed |
| #195 | Fluxo operacional consolidado + testes |
| #196 | Pedidos→separação, unidades, rollback despacho |
| #197 | IntegracaoRomaneio canônica + soft∨ crítico + comprovante/ocorrência/IA + filtros cliente + devolução assert + **persistência multi-etapa fail-closed (sem toast de sucesso parcial)** |

## Escopo coberto (pacote)

1. Seleção Pedidos elegíveis; separação/conferência integral/parcial; bloqueio por qtd/unidade/estado  
2. Create/reuse Entrega; romaneio; despacho; idempotência; recuperação de falha (compensação)  
3. Parcial/total + prova; ocorrências; logística reversa (assert + `logistica_reversa`); quantidades pendentes  
4. Filtros empresa, cidade, **cliente**, data cliente, futuras — coerentes em listagem, mapa e romaneio  
5. RBAC + grupo∧empresa + auditoria fail-closed nas ações sensíveis  
6. **UI não declara sucesso com estado parcialmente persistido** (IntegracaoRomaneio, RomaneioForm, Comprovante, Ocorrência, LogisticaReversa)  
7. Testes de policy **e** integração das telas (concorrência, despacho repetido, falha parcial, auditoria, parcial repetida, devolução)  
8. Esta candidata documentada (deps comerciais, homologação, rollback)

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
| `IntegracaoRomaneio` / `RomaneioForm` | **Compensação** | Creates + romaneio + patches + Pedido legado; audit final fail-closed |
| `ComprovanteEntregaDigital` | **Compensação** | Entrega → Pedido → estoque; falha posterior → `Estado parcial…` (sem toast success) |
| `LogisticaReversa` | **Compensação** | Entrega → ContaReceber → estoque → notificação (**sem** TX única) |

Constante: `PERSISTENCIA_EXPEDICAO` em `expedicaoFluxoOperacionalPolicy.js` (`comprovanteEntrega`, `logisticaReversa`, `despachoPatches` = `compensacao`).

### Cenários de recuperação cobertos

| Cenário | Comportamento esperado |
|---|---|
| Duas operações concorrentes (mesmo romaneio) | `assertRomaneioOnCreate` / `resolveRomaneioDespacho` → reuse; sem segundo despacho |
| Despacho repetido | Pós-`Saiu para Entrega` não re-seleciona; reuse via romaneio existente |
| Falha após update parcial no despacho | Rollback dos patches já aplicados; audit `*.rollback`; sem sucesso UI |
| Auditoria final falha | Throw fail-closed; UI sem toast de sucesso (mesmo com despacho já persistido) |
| Pedido legado incompleto | `Estado parcial: … Pedido legado incompleto`; audit `*.parcial` |
| Entrega parcial repetida | Mesma qtd → retry idempotente; redução bloqueada; aumento permitido; total bloqueia novo parcial |
| Devolução com falha secundária | Entrega `Devolvido` + `Estado parcial…`; sem toast success; retry completa cadeia |

## Integrações externas (explicitamente pendentes)

| Integração | Estado |
|---|---|
| WhatsApp / mensageria real | Pendente — mocks/simuladores **não** homologados |
| Roteirizador avançado / provedor externo | Pendente — otimização local ≠ serviço homologado |
| Assinatura digital como serviço | Pendente — prova local (foto/assinatura base64) na Entrega |

## Testes

```bash
node --test \
  tests/expedicao-entrega-policy.test.js \
  tests/expedicao-fluxo-operacional.test.js \
  tests/expedicao-integracao-telas.test.js
```

Inclui filtro cliente, E2E Pedido→pendências, quantidades pendentes, compensação≠atômico, **integração telas** (41 testes no conjunto).

## Homologação SPA (obrigatória antes de merge)

1. Grupo∧empresa + permissões Separação/Romaneio/Entrega/Ocorrência/Reversa  
2. Pedido elegível → separação (manual/IA) → Entrega pronta  
3. Filtros listagem/mapa/romaneio alinhados (empresa, cidade, cliente, data, futuras)  
4. Romaneio + despacho; simular falha parcial → status revertido + auditoria; **UI não toast success**  
5. Comprovante: Entrega antes do estoque; falha de estoque → mensagem `Estado parcial` (sem sucesso)  
6. Parcial repetida (retry / aumento / bloqueio de redução); ocorrência; devolução; pendências com qtd  
7. Retry não duplica Entrega/Romaneio  
8. Pedido legado: validar com Codex no #178 FINAL  

## Rollback

1. Sem merge: fechar drafts #197→#192  
2. Pós-merge autorizado: revert do merge; **não** reverter 026–035; **não** tocar Pedido Codex  
3. VPS: **não** autorizado neste lote  

## Quadro objetivo

| Pronto p/ integração | Falta | Bloqueios reais |
|---|---|---|
| Fluxo operacional + persistência fail-closed no tip #197 | Homologação humana SPA | #178 FINAL |
| Isolamento∧, RBAC, filtros, testes policy+telas | WhatsApp/roteirizador/assinatura como serviço | Merge/VPS/import Empresas |
| Compensação≠atômico documentada e testada | Tip Comercial 360 | Autorização merge ordenado |
