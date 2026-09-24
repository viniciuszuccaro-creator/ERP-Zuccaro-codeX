# Pacote de decisão por gate — D / E / F (sem execução)

**Status:** `PRONTO PARA DECISÃO HUMANA — NÃO EXECUTAR`
**Gerado:** 2026-09-24 · frente Cursor PR #34
**Não faz:** merge, migration VPS, canário, promoção 3080, alteração da 3080.

Comando de leitura:

```bash
bash scripts/vps/go-nogo-def.sh
# → GATE_E_READY / GATE_D_READY / GATE_F_READY separados
```

---

## 1. Revisão PR #33 e PR #34 (mergeabilidade — sem merge)

| PR | Branch | HEAD observado | Draft | mergeable (GitHub) | CI (HEAD) | Conflitos com `main` |
|---|---|---|---|---|---|---|
| #33 | `codex/comercial-360` | `ceeb92e99954b39d3137dde497208b0db1010869` | sim | **MERGEABLE** / CLEAN | frontend+backend SUCCESS | API sem conflito; merge-tree sem `CONFLICT` |
| #34 | `cursor/vps-hml-gate-c-legado-392b` | `cfc4c2ab24d6cad9791b1e73cf1208febd2a1d9b` | sim | **MERGEABLE** / CLEAN | revalidar após push | sem conflito |
| `main` | — | `ca4171600cc30f9922c2f8b2ccb8b22d06aa6888` | — | — | — | base comum das PRs |

**Leitura go-nogo (local, pós-correção anti-circular):**
`GATE_E_READY=YES` · `GATE_D_READY=NO` (digest+Auth+schema E) · `GATE_F_READY=NO` · `GO_NOGO=NO` · `EXECUTE_DEF=NO`
Digest/`PENDING_AUTH_GATE` **não** entram em `gate_e_blockers`.

Revalidar SHAs no GitHub antes de qualquer merge (não congelar cegamente).

**Ordem de merge sugerida (só após autorização humana explícita):**
1) review + undraft + merge **#33** na `main` → 2) (opcional) merge **#34** documental → 3) só então Gate E a partir da **main** pós-merge.

---

## 2. Migrations 016–024

Presentes na PR #33 (ausentes em `main` e na VPS Gate C):

| ID | Arquivo | Natureza (revisão) |
|---|---|---|
| 016 | `016_orcamentos_comercial_360.sql` | CREATE IF NOT EXISTS + RLS (tabelas novas) |
| 017 | `017_pedidos_comercial_360.sql` | CREATE IF NOT EXISTS + RLS (tabelas novas) |
| 018 | `018_produto_pim_dam_outbox.sql` | ALTER `produtos` (cols+CHECK) + tabelas PIM/DAM; **maior risco residual** se dados violarem CHECKs |
| 019 | `019_produto_relacoes_tenant.sql` | ALTER aditivo + triggers |
| 020 | `020_produto_midia_storage_key_unique.sql` | índice/unique aditivo |
| 021–022 | midia upload/scan | ALTER `produto_midias` + CHECKs |
| 023 | `023_produto_material_norma.sql` | ALTER `produtos` + length CHECKs |
| 024 | `024_produto_canais_rascunho.sql` | CREATE `produto_canais` + RLS |

**Migrator** (`server/src/db/migrate.ts`, igual em #33): uma invocação percorre **todos** os pendentes em ordem lexicográfica; **uma transação por arquivo** (`withTransaction`: SQL + `INSERT schema_migrations`); se N falha, N **não** fica registrada; 016…N−1 **permanecem**. Fatias 016–017 / 018–024 = **revisão humana**, não duas execuções.

---

## 3. Compatibilidade API R07B no intervalo E → D

| Fato | Implicação |
|---|---|
| 3080 permanece `runtime07b-main-ca0bc5f3` / `dev_headers` até Gate F | Código antigo + schema novo (016–024) coexistem após E |
| 016/017/024 = tabelas novas | R07B ignora; health/ready não dependem delas |
| 018+ = ALTER em `produtos`/`produto_*`/`integration_events` | Colunas com DEFAULT tendem a ser compatíveis; CHECKs novos podem rejeitar UPDATE legado se dados inválidos |
| Canário (Gate D) = imagem nova + `EXPECTED_RUNTIME=ERP-RUNTIME-08B` | Smoke Auth/`supabase_user` só no canário, **não** na 3080 |
| Se schema novo quebrar R07B | **Parar**; não D; forward-fix ou restore autorizado do pre-gate-e |

Durante E→D: **não** promover 3080; observar health/ready da 3080 após E; queries R07B em tabelas alteradas devem continuar sem exigir colunas novas.

---

## 4. Plano de recuperação se migration N falhar após 016…N−1

1. **Parar imediatamente** — não iniciar Gate D/F; 3080 permanece R07B.
2. Consultar `SELECT id FROM schema_migrations ORDER BY id` — listar o que ficou 1×.
3. Schema **parcialmente avançado** (TX por arquivo: N rolou back; anteriores commitados).
4. Opções (só com autorização humana explícita):
   - **Forward-fix:** corrigir SQL/dados na MAIN; reexecutar migrator (só pendentes; já aplicadas são skip).
   - **Restore isolado:** restaurar `pre-gate-e-20260924-140304.sql` em instância **isolada** para prova.
   - **Restore na DEV oficial:** exige termo + backup adicional pós-falha; **não** automatizado.
   - **Não** usar `CONFIRM_ROLLBACK` de API como rollback de schema.
5. Evidência atual: `restore_destructive=NOT_PERFORMED` — restore isolado **ainda não** homologado.

---

## 5. Prontidão por gate (leitura local)

| Gate | READY quando | Não exige (anti-circular) | Exige além do READY |
|---|---|---|---|
| **E** | Gate C + backup pre-gate-e + rollback dry-run + sanitize + §4 documentado | digest pós-build, Auth sintético | termo checkbox E + assinatura + MAIN pós-merge |
| **D** | §4 + digest **não** pendente + Auth sintético pronto + schema E aplicado | — | termo checkbox D + canário + `EXPECTED_RUNTIME` explícito |
| **F** | D aprovado + mesmo digest do canário + rollback | — | termo checkbox F; 3080 só aqui |

`GATE_*_READY=YES` **não** autoriza execução.

---

## 6. Backup e rollback (preenchidos)

| Item | Valor |
|---|---|
| Backup | `pre-gate-e-20260924-140304.sql` |
| bytes | `390275` |
| sha256 | `e72ca99b453fa6b060b5264f636794b3a601202c18e4185deb12f0020cae3f80` |
| mode / umask | `600` / `0077` |
| integridade | header/tail/sha256/mode = YES |
| restore isolado | `NOT_PERFORMED` |
| Rollback API | imagem `runtime07b-main-ca0bc5f3` + containers preservados (dry-run OK) |
| Rollback schema | ≠ rollback API; via restore autorizado do pre-gate-e |

---

## 7. Decisão pedida ao responsável

Marcar **somente** no termo (`docs/TERMO_AUTORIZACAO_GATES_D_E_F.md` §C), sem executar nesta instrução:

- [ ] Autorizo **merge #33** (undraft+CI) após review
- [ ] Autorizo **Gate E** (016–024 uma invocação na MAIN)
- [ ] Autorizo **Gate D** (após E + digest + Auth)
- [ ] Autorizo **Gate F** (após D OK)

Assinatura / data: campos abertos no termo.
