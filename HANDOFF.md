# HANDOFF — PR #350 / Comercial360 + consolidação

Atualizado: 2026-11-23  
Executor atual: Cursor Cloud Agent  
Run anterior (travou): `bc-d973626e-1060-4071-a25a-6a549769392b`  
Run de coordenação CANAL: `bc-2366d040-9c1f-4f72-b34b-e2ba7e494727`  
Branch desta PR: `cursor/comercial360-proposta-347-evolucao-392b`  
PR: https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/350  
Base: `codex/consolidacao-infra-20261017` (PR #342)

---

## 1. Objetivo deste ciclo

1. Continuar o chat anterior (coordenação CANAL / publication / parecer `0a67aa4b`).
2. Resolver conflitos de merge da #350 com o tip atual da consolidação.
3. Registrar handoff completo do que já foi feito, o que falta e próximos passos.

**Fora de escopo (inalterado):** merge final, deploy, carga operacional, dados reais, migration/grants em produção/HML.

---

## 2. Estado das branches (após este trabalho)

| Item | Valor |
|---|---|
| HEAD pré-merge #350 | `34b89eb39` (remarge sobre `90f0a315`) |
| Tip base consolidação fetched | `5d1fa0fca` |
| Conflitos | somente `STATUS_DO_PROJETO.md` e `docs/HANDOFF_ATUAL.md` |
| Runtime | auto-merge (`OrcamentosTab.jsx`, testes orçamento) **sem marcadores** |
| Classificação | **simples** (docs de status/histórico) — sem conflito de intenção de runtime |

Resolução aplicada:
- Remarge note nova para tip `5d1fa0fc` (2026-11-23).
- Preservado histórico Cursor (`0c18d995`) **e** histórico da consolidação/integração (`Pacote B`, sequência 350→351→352, `8e68484b`).
- Sem force-push; branch Codex não editada fora do merge na candidata Cursor.

---

## 3. O que já foi feito (histórico do chat anterior + CANAL)

### 3.1 Coordenação publication (CANAL-05)

- Handoff **6403101757** liberado explicitamente para **Codex na #342**, exclusividade por trava no checkout da consolidação.
- Cursor **não aplicou** o hunk em `tests/publication-baseline-contracts.test.js`.
- Em `0a67aa4b` e no tip documental posterior `79d002a3` a linha ainda era a forma antiga:
  `restoreApprovedBulkDelta(source)` direto (sem `clienteConferenciaRemainder` no loop do manifesto).
- Manifesto `publicationBaselineManifest.json`: **18 cases**, byte-idêntico a `90f0a315` na verificação daquela rodada.
- Comentários publicados:
  - #350: https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/350#issuecomment-6403968826
  - #342: https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/342#issuecomment-6403968646

Escopo liberado (somente esse trecho):

```diff
+import { clienteConferenciaRemainder } from './helpers/consolidation81Remainder.js';
@@ for(const entry of manifest.cases)
- const prior=entry.path==='server/tests/bulk-consolidacao.test.ts'?restoreApprovedBulkDelta(source):source;
+ const reviewed=clienteConferenciaRemainder(entry.path,source);
+ const prior=entry.path==='server/tests/bulk-consolidacao.test.ts'?restoreApprovedBulkDelta(reviewed):reviewed;
```

Fora da liberação: manifesto/18 hashes, stage48/49, P1 reopen Cursor, candidata #353.

### 3.2 Parecer independente CANAL02–04 por SHA `0a67aa4b`

**Não é aprovação de merge/CI/deploy.**

- **Sessão:** rota `POST /api/v1/clientes/conferencia-legado` exige `authVerified === true`; header de ator sem Supabase → 401 e zero chamada ao serviço; adapter exige token/groupId/actorId string não vazia, sem empresa; primitivo malformado não faz fetch; escopo congelado; resposta tardia/abort → 409 e descarte; Bearer não vai no body.
- **RBAC:** Grupo UUID; empresa rejeitada; `Cadastros.cliente.visualizar` + `importar` com `allowGlobalWildcard: false`, rechecados em volta de cada lookup; UI não lê sozinha; wrapper `Comercial` com `conferencia_legado=1` evita montar `ComercialContent`/pré-carga ampla.
- **100/200 + no-write:** schema máx. 100 identidades; 101 não lê; 100×2 = 200 leituras pontuais; sem create/update/delete/auditoria de negócio no caminho; resposta mínima `id`/`codigo`/`ativo`; `cache-control: no-store`.
- **Ressalva:** `findByDocumento` usa `LIMIT 1` sem falhar em duplicata; identidade legada ambígua falha 409.

### 3.3 Reservas Cursor vigentes (quando do handoff CANAL)

- P1 #351 reopen: `cadastroReopenPolicy.js`, `useCadastroReopenOnIdentity.js`, forms da coorte + `RegiaoAtendimentoForm`, testes reopen associados.
- Candidata `#353` `cursor/integracao-350-351-352-392b`.
- Sem novas micro-PRs `useConfirm` até integração fechar (decisão daquela rodada).

### 3.4 Remarge #350 desta sessão

- `git fetch origin codex/consolidacao-infra-20261017`
- Merge da base `5d1fa0fc` na branch da #350.
- Conflitos docs resolvidos preservando ambos os lados + nota de remarge.
- Runtime auto-merged (inclui evolução HTTP de masters em `OrcamentosTab`).

---

## 4. O que falta

| Prioridade | Item | Dono sugerido | Notas |
|---|---|---|---|
| P0 CI | ~~Confirmar hunk publication 6403101757 na tip #342~~ **já presente em `5d1fa0fc`** (`clienteConferenciaRemainder(entry.path,source)` no loop) | — | Verificar só se a CI da #350 pós-remarge fica verde |
| P0 CI | CI da #350 pós-remarge `5d1fa0fc` | Cursor | Não declarar CLEAN até verde por SHA |
| P1 | Remarge candidata #353 preservando ambos os lados, se ainda divergente | Cursor | Depende tip consolidação estável |
| P1 | Homologação visual Comercial360 / aprovação do proprietário | Humano | Prévia sintética ≠ operação real |
| P1 | Achado ressalva `findByDocumento` LIMIT 1 | Codex (se priorizado) | Não bloqueou handoff; não é deploy |
| P2 | Gates legado/HML (#344) | Codex | Continuam separados; sem carga/deploy |

---

## 5. Decisões tomadas

1. **Publication hunk:** Codex exclusivo na #342; Cursor não aplica em paralelo.
2. **Parecer `0a67aa4b`:** código CANAL02–04 coerente com sessão/RBAC/limites/no-write; **não** equivale a aprovação CI/merge/deploy.
3. **Conflitos #350 × consolidação (2026-11-23):** classificados como **simples** (só STATUS/HANDOFF); resolução = preservar ambos históricos + registrar remarge `5d1fa0fc`.
4. **Runtime auto-merge** de `OrcamentosTab` / testes: aceito (sem marcadores; traz masters HTTP + mensagens de schema 044 da consolidação junto da prévia Comercial).
5. **Implantação / dados reais / merge final:** permanecem gates separados.

---

## 6. Próximos passos recomendados

1. Após push deste remarge: confirmar `mergeable` da #350 e acompanhar CI do novo SHA.
2. Verificar no tip atual da #342 se `tests/publication-baseline-contracts.test.js` já normaliza via `clienteConferenciaRemainder` (handoff 6403101757). Se não, Codex ainda é o escritor exclusivo desse trecho.
3. Se CI #350 verde: avaliar remarge da candidata #353 e só então retomar micro-PRs pausadas.
4. Manter aprovação visual / homologação operacional fora do “CI verde”.
5. Não editar branch Codex fora de merges explícitos na candidata Cursor; um escritor por hunk reservado.

---

## 7. Referências rápidas

- PR #350: https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/350
- PR #342: https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/342
- Handoff publication liberação: comentário 6403873982 / 6403101757
- Parecer CANAL02–04 Cursor: comentário 6403968826 (#350)
- Docs canônicos do repo: `STATUS_DO_PROJETO.md`, `docs/HANDOFF_ATUAL.md`, `AGENTS.md`

---

## 8. Checklist rápido pós-retomada

- [x] Fetch da base `codex/consolidacao-infra-20261017`
- [x] Merge na branch da #350
- [x] Classificar conflitos
- [x] Resolver conflitos simples (docs)
- [x] Escrever este `HANDOFF.md`
- [ ] Commit + push do remarge
- [ ] Atualizar/registrar PR #350
- [ ] Confirmar CI do novo tip
- [ ] Verificar tip #342 quanto ao hunk publication
