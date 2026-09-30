# Expedição/Logística — candidata de integração #192–#197

## Identidade

| Campo | Valor |
|---|---|
| Candidata | Stack draft **#192 → #197** (tip = #197) |
| Branch tip | `cursor/expedicao-integracao-romaneio-canonico-392b` |
| Base tip | tip #196 (`cursor/expedicao-fluxo-integrado-pedido-392b`) |
| Escopo | Seleção → separação/conferência → Entrega → romaneio → despacho → parcial/total → ocorrências → pendências |
| Estado | **Candidata de integração** — CI verde no tip ≠ homologação SPA/VPS |

## Cadeia de PRs

| PR | Branch | Entrega |
|---|---|---|
| #192 | `cursor/expedicao-entregas-filtros-392b` | Filtros listagem/romaneio (empresa/cidade/data/futuras) |
| #193 | `cursor/expedicao-detalhe-separacao-failclosed-392b` | Detalhe + separação fail-closed (policy) |
| #194 | `cursor/expedicao-roteirizacao-contexto-392b` | Roteirização fail-closed |
| #195 | `cursor/expedicao-fluxo-consolidado-392b` | Fluxo operacional consolidado + testes comportamentais |
| #196 | `cursor/expedicao-fluxo-integrado-pedido-392b` | Pedidos→separação, unidades, rollback despacho |
| #197 | `cursor/expedicao-integracao-romaneio-canonico-392b` | IntegracaoRomaneio canônica + soft∨ caminho crítico + comprovante/ocorrência/IA |

Merge somente na ordem da pilha, com autorização explícita. Sem merge/VPS neste documento.

## Dependências

| Dependência | Tipo | Notas |
|---|---|---|
| Policy `expedicaoEntregaPolicy` + `expedicaoFluxoOperacionalPolicy` | Código | Asserts, seleção, romaneio, registro final, pendências, rollback |
| Telas existentes Expedição/Logística | Código | Sem módulo paralelo |
| Side-effect `Pedido` (`updateInContext`) | **Contrato Codex** | Documentado; mutação descritiva; tip-port só após #178 FINAL |
| Orçamento / mig 026–035 / legado mapper / Armado-Corte-Dobra | Reserva Codex | Intocados |
| Export Empresas / reconciliação legado | Frente chat principal | Não duplicar |

## Cobertura de testes (comportamental)

Arquivo: `tests/expedicao-fluxo-operacional.test.js` (+ `expedicao-entrega-policy`).

- Isolamento grupo∧empresa (seleção cruzada bloqueia)
- RBAC/confirmação/checklist fail-closed
- Unidades na conferência
- Concorrência/idempotência (reuse Separação/Romaneio/Entrega)
- Rollback de despacho parcial
- Parcial / ocorrência / pendências
- IntegracaoRomaneio Pedidos→Entrega→romaneio
- Candidata E2E: Pedido→…→pendências + auditoria/falha

```bash
node --test tests/expedicao-entrega-policy.test.js tests/expedicao-fluxo-operacional.test.js
```

CI tip (#197): `erp-runtime-ci` frontend + backend SUCCESS. **CI verde não substitui homologação manual do fluxo.**

## Homologação manual (obrigatória antes de merge)

Pré-condições: grupo∧empresa, permissões Separação/Romaneio/Entrega/Ocorrência.

1. Pedido elegível (não retirada) → Separação (manual ou IA) → Entrega `Pronto para Expedir`
2. IntegracaoRomaneio ou RomaneioForm: checklist + confirm → despacho `Saiu para Entrega`
3. Comprovante digital / Detalhes: total com prova; parcial com qtd; ocorrência com motivo
4. Pendências em listagem + QueuesLogistica
5. Troca de empresa: seleção cruzada some; retry não duplica Entrega/Romaneio
6. Simular falha de update no meio do despacho → rollback + auditoria
7. Pedido legado: status muda conforme side-effect — validar com Codex no #178 FINAL

## Riscos

| Risco | Mitigação |
|---|---|
| Contrato Pedido/Orçamento muda no #178 | Sem tip-port até FINAL; side-effect só descritivo |
| Soft∨ residual em dashboard/config/financeiro | Leitura consolidada de grupo deliberada; mutações do fluxo já ∧ |
| Homologação SPA não executada | Checklist acima; bloqueio de merge/VPS |
| Stack longa (#192–#197) | Merge ordenado; rollback = fechar drafts / revert tip |

## Rollback

1. **Sem merge:** abandonar/fechar drafts na ordem inversa (#197→#192); tip anterior permanece.
2. **Pós-merge (só autorizado):** `git revert` do merge da candidata; **não** reverter mig 026–035; **não** tocar Pedido/Orçamento Codex.
3. **VPS:** este lote **não** autoriza deploy. Rollback futuro = imagem anterior (gates vigentes).

## Quadro objetivo (tip #197)

| Item | Status |
|---|---|
| Fluxo Pedido→…→pendências (policy + UI existentes) | **Pronto para integração** (falta homologação humana) |
| Isolamento∧ / RBAC / unidades / idempotência / rollback / auditoria | **Pronto** (testes) |
| IntegracaoRomaneio / Comprovante / Ocorrência / Separação IA canônicos | **Pronto** |
| Soft∨ dashboard/config/financeiro leitura | Residual deliberado |
| #178 FINAL / tip Comercial | **Bloqueado** |
| Merge / VPS / migration / import Empresas | **Bloqueado** por política |
