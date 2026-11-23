# HANDOFF — retomada bc-d973626e (2026-11-23 America/Sao_Paulo)

Documento de continuidade para qualquer agente (Cursor/Codex Casa/Codex Empresa).
Complementa `docs/HANDOFF_ATUAL.md`, `docs/HANDOFF_CASA_2026-11-20.md` e `STATUS_DO_PROJETO.md`.
Não substitui `AGENTS.md` nem a Regra-Mãe.

**Fonte desta revisão:** transcript JSON do agent `bc-d973626e` (131 099 mensagens; corte em 15/11/2026 no checkpoint PR596 / `d43ae30b1`), reconciliado com tip Casa `bf2f02810` e com a PR documental [#598](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/598).

---

## 1. Por que este handoff existe

O Cloud Agent **`bc-d973626e-1060-4071-a25a-6a549769392b`** executou continuidade longa (“próxima ordem”) no ERP Zuccaro e **travou no limite de uso/crédito** em **15/11/2026**, no meio da coordenação Cursor ↔ Codex Casa sobre a **PR #596**.

Este arquivo registra:

- o que aquele chat já entregou (com cronologia de tips Bugbot);
- onde parou exatamente (última mensagem útil do transcript);
- a instrução consolidada do proprietário em 15/11 (12 etapas);
- o que a Casa fez depois (15/11 → 23/11);
- decisões de ownership ainda válidas;
- o próximo passo executável para Cursor e para Casa;
- trilha **separada** da remarge #350/Comercial360 (não misturar).

---

## 2. Identidade do chat anterior

| Campo | Valor |
|---|---|
| Agent ID | `bc-d973626e-1060-4071-a25a-6a549769392b` |
| Papel | Cursor (frontend / Cadastros / Dashboard / Central360) |
| Branch Cursor tip congelada | `cursor/hml-cadastros-dash-c360-ux-392b` |
| Tip Cursor final | **`1a5bc05ea`** (docs) · código útil **`d43ae30b1`** (OrcamentosTab) |
| PR | [#596](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/596) — OPEN |
| Base da PR596 | `cursor/c360-pos594-continuidade-ui-392b` (PR #595) |
| Stack | PR #594 (draft) → #595 → #596 |
| Motivo da parada | limite de uso no Cloud Agent; corte após publicar `d43ae30b1` / docs `1a5bc05ea` |
| Runtime HML registrado na época | `d054e2b3` — **tip ≠ HML; sem deploy Cursor** |
| Último checkpoint no transcript | msg `131090` — “Checkpoint 15/11 — Cursor (PR596)” |

**Atenção:** o `main` público (`baba91a6b`, merge #257 de 09/10) **não** é o tip operacional desta continuidade. O trabalho vivo está nas branches Codex/Cursor da pilha HML 11/2026.

### Trilha paralela (NÃO é esta continuidade)

| Trilha | PR / tip | Nota |
|---|---|---|
| Remarge Comercial360 candidata | [#350](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/350) tip `1053cd4c7` sobre consolidação `5d1fa0fc` | Conflitos só STATUS/HANDOFF; MERGEABLE/CLEAN em 23/11. Hunk publication 6403101757 já na base. **Não misturar com PR596.** |

---

## 3. Onde o agente parou (ponto de freeze)

Última entrega Cursor publicada (confirmada no transcript + remoto):

1. `d43ae30b1` — `OrcamentosTab` com paridade de `PedidoCanonicoPanel`:
   - `hydrateEpoch` monotônico (A→B→A);
   - `canViewLiveRef` (RBAC pós-await);
   - clear de `hydrateInflightRef` / intent;
   - fecha Bugbot High de GET stale na Central360.
2. Docs `1a5bc05ea` — registra SFTP Casa 4MB concluído e tip alinhado.
3. CI do tip **`1a5bc05ea`**: frontend/backend/compose **SUCCESS**; Bugbot/Security/Approval **NEUTRAL**.
4. Testes focados na época: 61 PASS (`hml-cadastros-dash-ux-596`, layout v6, orçamento).

**Corte do transcript:** após o checkpoint `d43ae30b1` o agente ainda lia notificação/comentário Casa de retomada 15/11 e **não** chegou a abrir novo lote de código. Próximo declarado no próprio checkpoint: Casa (Completo/SFTP/preflight) · Cursor segue Cadastros/C360 **sem Completo**.

Casa, em seguida (sem editar a branch Cursor `1a5bc05ea`):

- confirmou SFTP ~4MB (tam/SHA iguais; ≠ deploy);
- revisão só-leitura Pedido @ `4d6b0478` — 3 resíduos **fechados focalmente**;
- port controlado Shell+Pedido+Orcamentos para branch Casa;
- SHA Casa cruzado **`e92045a05`** (CI7176 SUCCESS) com fix de `selectionEpoch` no deny.

---

## 4. O que já foi feito (resumo do ciclo Cursor na PR #596)

Escopo Cursor autorizado: **Cadastros / Dashboard / Central360**, sem `CadastroClienteCompleto` (reserva Casa).

### 4.0 Cronologia de tips (transcript → tip congelado)

| Tip código | Tema | Nota |
|---|---|---|
| `f2d92ec9c` | ProdutosProducao / Estruturantes / Formas hydrate / PedidoCanonico `genAtStart` | CI SUCCESS |
| `f7603d651` | loading→`—`; CanaisOrigem cache/perm; Formas atalho; epoch/intent; Top5≤100 | CI SUCCESS |
| `4485508c9` | Formas rebalance sem apagar hidratado | CI SUCCESS; Bugbot tip neutral |
| `7a6c769e7` | Dashboard KPIs derivados fail-closed | — |
| `800524f36` | Casa P1 A→B→A + RBAC pós-await + toast sessão antiga | — |
| `c9bb620d7` | C360 limpa seleção no tenant; Bloco2 `ownOnly` | Security Review |
| `9f8c11842` | Fluxo CR∩CP; `hydrateInflightRef.clear()` | Bugbot High/Med |
| `c34f63e73` | `canViewEntity` sem DFS null; shell lê `sessionToken` vivo | Bugbot High/Med |
| `5cf08bb77` | pins hash `Dashboard.jsx` (`a2e0cc61…`) | CI SUCCESS `43650315916` |
| `4d6b0478d` | docs do tip 5cf08 | — |
| **`d43ae30b1`** | **OrcamentosTab** paridade sessão | tip código final Cursor |
| **`1a5bc05ea`** | docs SFTP 4MB + alinhamento | tip docs final Cursor |

### 4.1 Segurança de sessão / seleção (Central360)

- `PedidoCanonicoPanel`: hydrateEpoch, RBAC pós-await, toast de sessão antiga, clear de inflight.
- `OrcamentosTab`: mesma proteção (tip `d43ae30b1`).
- `CentralVendas360Shell`: limpa seleção/Cliente360 e sobe epoch ao trocar grupo/empresa/ator/sessão; lê `sessionToken` vivo via `readErpHttpSession` quando a prop não vem do Comercial.
- Bloco2 Produtos: gate **por entidade** (`ownOnly`) — grant de Marca não abre Produto; sem `hasPermission(Cadastros, null)`.

### 4.2 Dashboard fail-closed (≠ zero falso)

- KPIs derivados (Fluxo, Vendas, Ticket, Conversão, OTD, Peso, Aproveitamento, Inadimplência) + `FinancialSummary`: amostra vazia/erro/cap → **"—"** (não R$ 0,00 / 0%).
- Fluxo exige CR **∩** CP; receitas/inadimplência = CR; despesas = CP.
- Cards Base44 tratados: CanaisOrigem, ProdutosProdução, Estruturantes (loading/erro/cap → "—").
- Pins de hash do `Dashboard.jsx` atualizados após fail-closed (`a2e0cc61…`).

### 4.3 Formas de pagamento / parcelas

- Hydrate não apaga parcelas salvas (`userRequestedRegenRef` / `skipRebalanceOnceRef` + baseline).
- Rebalance só quando total/acréscimo mudam; atalho regenera sob intenção explícita.

### 4.4 Códigos UI

- Representante: coluna `codigo` na grade.
- CondicaoComercial: **sem** coluna `codigo` inventada (`idOnly` / fora de MASTER_CODE) — visualizador preenchia com nome.

### 4.5 Freeze de endereços (Casa; Cursor não disputa)

| Item | SHA |
|---|---|
| Freeze Completo/endereços | `0ffff5100` |
| Port Casa | `81d1e849` |
| Completo ownership-in-load / draft durante catálogo | **RESERVA CASA** — Cursor **não edita** `CadastroClienteCompleto.jsx` |

### 4.6 Instrução do proprietário (15/11) — contexto, não checklist cego

A última ordem longa no transcript (“CONTINUIDADE COORDENADA E AUTÔNOMA”, 15/11) define 12 frentes. **Responsável Cursor** permanece só frontend/visual nas frentes 4 (revisão residual sem Completo), 8 (Cadastros/Dashboard Base44 sem inventar zeros), 9 (Central360 layout v6) e 10 (unificar/códigos UI). Frentes SFTP/legado/HML/importação/automação 15 min → **Casa/Codex**. Não reabrir inventário visual nem criar segunda Central.

---

## 5. O que a Casa fez depois do freeze (15/11 → 23/11)

Branch principal Casa: **`codex/casa-fechamento-hml-20261114`**  
Tip consultado nesta retomada: **`bf2f02810`** (2026-11-23).

Marcos (sanitizados; sem PII/credenciais):

| Tema | Estado |
|---|---|
| Port UI sessão/deny da PR596 | Aplicado na Casa; tip Cursor `1a5bc` preservado |
| HML API live registrada | `a305a143` (reconfirmar web/API no ambiente) |
| Clientes HML | 17.472 mestres; cargas unitárias/lotes conciliados; **não reaplicar** |
| Pacote privado 5.423 | **ENCERRADO** no tip Casa: 5.384 em revisão + 39 no histórico (=5.423); recibo preservado; **não reaplicar** (`docs/HANDOFF_ATUAL.md` / tip `bf2f02810`) |
| Faturamento/baixa HTTP | Implementado/provado em **clone isolado** (`d47f29c75` e sucessores); **não publicado na HML** |
| Backup / espaço | Provas e preflight em andamento; folga vs reserva ainda crítica em leituras |
| Obras / Preços | Sem lote apto (falta prova de empresa / calendário / vínculos) |

Documento de escopo Cursor preparado em 19/11 (branch `codex/handoff-casa-20261120`):  
`docs/HANDOFF_CASA_2026-11-20.md` — **somente frontend/visual**; API/banco/VPS/deploy → Codex.  
**Nota 23/11:** o texto histórico de 19/11 ainda falava em “falta persistência” do 5.423; isso foi **supersedido** pelo tip Casa — ver §8.

---

## 6. Decisões tomadas (ainda válidas)

1. **Um responsável por tarefa.** Cursor e Casa não editam o mesmo arquivo no mesmo lote.
2. **`CadastroClienteCompleto` = Casa.** Endereços operacionais, ownership de draft no load, freeze `0ffff5100`.
3. **CI verde ≠ integração ≠ HML ≠ produção.** Tip ≠ runtime até promote autorizado.
4. **Fail-closed.** Sem contexto Grupo/Empresa ou sem permissão → bloquear; KPI sem amostra → "—", nunca zero falso.
5. **Sem deploy Cursor.** Publicação HML/produção só com gate Casa/Codex + autorização.
6. **Dados reais fora do GitHub.** Evidências sanitizadas; legado em VPS/HD privado.
7. **Não criar módulos paralelos** (`CentralVendas360Nova`, `OrcamentosV2`, etc.). Melhorar o existente.
8. **Contrato financeiro HTTP** (Casa → Cursor): rotas sob `/api/v1/pedidos/:id` — ver §7. Enquanto não estiver na HML, UI deve informar indisponível (já há guard em `FechamentoFinanceiroTab` para modo HTTP genérico).
9. **Automação Casa 15 min:** reutilizar a existente; não criar polling concorrente.
10. **Stack PRs #594/#595/#596:** não force-push; não reescrever tip Cursor `1a5bc05ea` por inferência.

---

## 7. Contrato financeiro para Cursor (clone — tip Casa)

Candidato de referência: `d47f29c75` (e tip Casa posterior). **Não** disponível na HML `a305a143`.

Base: `/api/v1/pedidos/:id` (UUID, sessão verificada, contexto Empresa).

| Rota | Permissão | Notas |
|---|---|---|
| GET `/vinculos-contabeis` | `Comercial.pedidos.faturar` | `data.centros` / `data.planos` |
| POST `/faturar` | `Comercial.pedidos.faturar` | UUIDs centro/plano; status PRONTO_*; replay/409 |
| GET `/titulos` | `Financeiro.contas_receber.visualizar` | valores string decimal |
| POST `/titulos/baixa` | `Financeiro.contas_receber.baixar` | parcela + evento estável + valor; replay/409 |

Regras UI:

- Exibir saldo do **servidor**; parcial se recebido > 0 e saldo > 0; quitado se saldo 0.
- Não atualizar ContaReceber genérico nem gerar outro evento no retry.
- Tratar 401/403/404/422/`503 FINANCEIRO_SCHEMA_INVALIDO`.
- Grade Contas a Receber atual usa id CRUD genérico — precisa identificar pedido/parcela no servidor antes de consumir a baixa.
- Opt-in no server `index.ts`; HML ainda sem schema/ACL/promote.

Consumidor existente a melhorar (não duplicar):  
`src/components/comercial/FechamentoFinanceiroTab.jsx` (+ políticas em `pedidoFaturamentoPolicy.js` / `useFluxoPedido.jsx`).

---

## 8. O que falta (fila)

### Cursor (frontend/visual) — próximo

1. Ler este handoff + `AGENTS.md` + tip Casa atual (`codex/casa-fechamento-hml-20261114`).
2. Branch frontend própria (ex.: esta `cursor/handoff-retomada-bc-d973-3cfd` ou sucessora). Conferir #595/#596 antes de portar hunks.
3. **Central de Vendas 360° layout v6:** navegação, consistência visual, responsividade, pesquisa, estados loading/vazio/erro; orçamento salvo/reaberto; seletor de entrega; totais; caminho para financeiro.
4. Quando Casa confirmar promote do contrato §7: adaptar `FechamentoFinanceiroTab` / Contas a Receber ao HTTP canônico; até lá manter indisponível explícito + fixtures sintéticas em teste.
5. Reaproveitar Cadastro/Dashboard existentes e referência Base44 **só** para capacidades UI úteis já aprovadas (fail-closed).
6. Entregar diff + testes + build + prova browser; informar SHA exato para o Codex integrar.

### Codex Casa — próximo

1. **Não reaplicar** o lote 5.423 (já 5.384 revisão + 39 histórico; mestres 17.472 intactos).
2. Fechar prova de backup agendado (timeout/`SNAPSHOT_READ_FAILED`, publicação autorizada do serviço, restauração + cópia externa) e margem de disco vs reserva.
3. Preflight/promote faturamento (DDL/ACL, dependências Pedido/centros/planos, aceite browser) — contrato §7 ainda só no clone.
4. Endereços → pedido; Obras/Preços quando houver lote apto (hoje sem lote: falta prova de empresa / calendário / vínculos).
5. Composição jornada inteira após deltas Cursor.

### Explicitamente fora / bloqueado sem autorização

- Deploy HML/produção por inferência.
- Editar `CadastroClienteCompleto` no Cursor.
- DDL, grants admin, BYPASSRLS, apagar backups/legado.
- Simular sucesso de faturamento/baixa na HML sem contrato publicado.
- Force-push nas branches Cursor/Casa da pilha.

---

## 9. HEADs de referência (consultados em 23/11/2026 America/Sao_Paulo)

| Fonte | Branch / ref | SHA curto |
|---|---|---|
| Continuidade Casa (código+docs) | `codex/casa-fechamento-hml-20261114` | `bf2f02810` |
| Handoff escopo Cursor 20/11 | `codex/handoff-casa-20261120` | `4b5c2afec` |
| Tip Cursor PR596 | `cursor/hml-cadastros-dash-c360-ux-392b` | `1a5bc05ea` |
| PR595 | `cursor/c360-pos594-continuidade-ui-392b` | `b5862fc53` |
| PR594 (draft) | `codex/continuidade-591-20261111` | `69430028d` (docs) |
| main (legado merge #257) | `main` | `baba91a6b` |
| HML API registrada | runtime | `a305a143` |
| Freeze endereços | — | `0ffff5100` / port `81d1e849` |

Sempre revalidar com `git fetch` antes de editar — estes SHAs envelhecem.

---

## 10. Arquivos-chave tocados pelo chat bc-d973 (não exaustivo)

- `src/components/comercial/PedidoCanonicoPanel.jsx`
- `src/components/comercial/OrcamentosTab.jsx`
- `src/components/comercial/CentralVendas360Shell.jsx`
- `src/components/comercial/FormasPagamentoPedido.jsx`
- `src/components/cadastros/blocks/Bloco2Produtos.jsx`
- `src/pages/Dashboard.jsx` (+ cards Base44 relacionados)
- `tests/hml-cadastros-dash-ux-596.test.js` / `tests/central-vendas360-layout-v6-591.test.js`
- `STATUS_DO_PROJETO.md` / `docs/HANDOFF_ATUAL.md`

Não tocar sem coordenação: `CadastroClienteCompleto.jsx`, payload sync locais, DDL HML, pacotes privados.

---

## 11. Checklist de retomada (copiar)

```
[ ] git fetch origin
[ ] Conferir tip Casa: origin/codex/casa-fechamento-hml-20261114
[ ] Conferir tip Cursor PR596: origin/cursor/hml-cadastros-dash-c360-ux-392b (=1a5bc05ea?)
[ ] Ler AGENTS.md + este HANDOFF.md + topo de STATUS/HANDOFF_ATUAL
[ ] Definir responsável do lote (Cursor vs Casa)
[ ] Se frontend: branch cursor/*-3cfd a partir do HEAD validado; não editar Completo
[ ] Se faturamento UI: só após contrato §7 na HML ou com estado indisponível explícito
[ ] Testes focados → checks do lote → commit/push → atualizar STATUS + handoff
[ ] tip ≠ HML até promote autorizado
```

---

## 12. Próximo comando executável (Cursor — esta retomada)

1. Manter este `HANDOFF.md` versionado na branch de retomada ([#598](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/598)).
2. Abrir branch frontend a partir de `origin/cursor/hml-cadastros-dash-c360-ux-392b` (`1a5bc05ea` / código `d43ae30b1`), **não** a partir desta branch documental Casa.
3. Continuar lote frontend na Central360 layout v6 / consumidores existentes **sem** Completo.
4. Preparar (sem ativar na HML) a adaptação de `FechamentoFinanceiroTab` ao contrato §7 quando o tip Casa indicar promote; até lá preservar mensagem de indisponível no modo HTTP.
5. Publicar PR da branch Cursor de código e informar SHA ao Codex Casa para composição.

---

## 13. Retomada desta sessão (23/11 — agent atual)

| Item | Estado |
|---|---|
| Transcript `bc-d973626e` | Lido (corte no checkpoint `d43ae30b1` / PR596) |
| HANDOFF canônico | Este arquivo na [#598](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/598) |
| Tip Casa revalidado | `bf2f02810` — fila 5.423 encerrada; faturamento HTTP só no clone |
| Tip Cursor PR596 | `1a5bc05ea` inalterado |
| Trilha #350 | Remarge `1053cd4c7` / base `5d1fa0fc` — **paralela**; não portar para cá |
| Próximo código Cursor | Branch nova a partir da PR596 → Central360 v6 + FechamentoFinanceiro (indisponível até promote) |

---

*Gerado/atualizado na retomada do agent bc-d973626e em 2026-11-23 (America/Sao_Paulo), com leitura do transcript. Evidências privadas e recibos permanecem fora do GitHub.*
