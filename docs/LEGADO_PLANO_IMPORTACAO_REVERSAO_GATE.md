# Legado — Plano de importação e reversão (Gate Onda 25)

**Status:** `RASCUNHO DE GATE / AGUARDANDO AUTORIZAÇÃO HUMANA`  
**Programa:** itens 4–5 · Onda 25 em `docs/PROGRAMA_COMERCIAL_360_OMNICANAL_EXECUCAO_AUTONOMA.md`  
**Branch de preparação:** `codex/legado-origem-relatorios-392b`  
**Política existente (não duplicar):** `src/components/lib/migracaoErpPolicy.js`  
**Mapper Cursor #48:** não alterar neste gate

---

## 0. Declaração obrigatória (fail-closed)

| Flag | Valor neste plano |
|---|---|
| `importAuthorized` | **false** |
| `operationalLoadAuthorized` | **false** |
| Promoção staging → operacional | **proibida** até gate humano explícito |
| Backup original `BACKUP ERP ANTIGO - CODEX` | **somente leitura** — nunca alterar, renomear, compactar no lugar ou apagar |
| Dados reais / PII / dumps no GitHub | **proibidos** — só código, schemas, fixtures sintéticas e evidências sanitizadas |

Este documento **não** autoriza carga operacional. É o contrato de gate a ser assinado
antes de qualquer promoção.

---

## 1. Pré-requisitos (todos obrigatórios)

1. **HD montado** com pasta `BACKUP ERP ANTIGO - CODEX` (letra/unidade descoberta; não fixar `D:`).
2. **Validação de origem dos relatórios** (`validar-origem-relatorios-privados.mjs`) com
   `all_origins_verified=true` sobre manifesto privado em `04_REPORTS` (fora do Git).
3. **Vínculos jurídicos comprovados** (`resolver-vinculo-juridico-legado.mjs` + mapa
   privado do HD): CPA Ferro e Aço e 3Z LTDA = empresas operacionais; Grupo CPA =
   agrupamento (não emissor); zero inferência por pasta/`EMP03`/`003`.
4. **Staging isolado reconciliado** (`carregar-staging-isolado-legado.mjs` ou equivalente
   autorizado): deduplicação, dependências, reconciliação por empresa em centavos,
   quarentena sem prova; `importAuthorized=false`.
5. **Backup fresco do destino** (Postgres/ERP canônico) com hash e procedimento de
   restore testado em ambiente isolado — não no HD do legado.
6. **RBAC** com permissões granulares de migração
   (`Financeiro.Migracao.*` / `Fiscal.Migracao.*` / equivalentes Cadastros) e
   segregação de funções (quem prepara ≠ quem aprova).
7. **Auditoria** disponível e fail-closed (falha de audit = aborta promoção).
8. **Aprovação humana explícita** (proprietário ou responsável autorizado) registrada
   com timestamp, escopo (Grupo/Empresas), lote e critérios de aceite abaixo.

Bloqueios atuais neste Cloud VM: HD ausente → itens 1–4 reais **BLOCKED**; fixtures
sintéticas dos itens 1–3 no repositório **não** substituem a evidência do HD.

---

## 2. Ordem de execução (quando o gate for autorizado)

Ordem fixa; falha em qualquer passo **interrompe** e aciona reversão da fatia.

| Passo | Ação | Escopo | Critério de avanço |
|---|---|---|---|
| A | Reconferir hashes origem + manifesto `04_REPORTS` (2 passagens) | somente leitura HD | zero mismatch |
| B | Resolver vínculos jurídicos lote a lote | CPA / 3Z / Grupo | só `VINCULO_COMPROVADO` segue |
| C | Extrair → transformar → carregar **staging isolado** | memória/DB staging | contagens + centavos OK |
| D | Quarentena explícita do restante | sem prova / conflito / EMP03 | não entra no lote de promoção |
| E | Homologação amostral humana | amostra por empresa | ata assinada |
| F | **Somente após E + aprovação:** promoção controlada staging→canônico | por entidade/empresa | ver §4–§5 |
| G | Reconciliação pós-promoção | contagens/centavos/saldos | diff centavos = 0 no lote |
| H | Encerrar janela; preservar staging e logs sanitizados | — | rollback ainda possível (§5) |

Passos F–H **não** estão autorizados por este documento. Permanecem `operationalLoadAuthorized=false`
até nova autorização humana com SHA deste plano + SHA do lote.

### 2.1 Ordem de entidades na promoção (futura)

1. Mestres de Grupo (cliente, fornecedor, produto) — sem `empresa_id` proprietário indevido  
2. Cadastros auxiliares (condição, tabela preço)  
3. Operações por empresa emissora (pedido, NF, estoque, CR/CP) — **nunca** emitir NF pelo Grupo  
4. Vínculos e históricos que dependem de 1–3  

CPA Ferro e Aço e 3Z LTDA são reconciliadas **separadamente**; o Grupo CPA apenas consolida.

---

## 3. Reconciliação (antes e depois de qualquer promoção futura)

Por empresa operacional e, quando aplicável, consolidado do Grupo:

- Contagens: origem = carregados + quarentena + rejeitados + conflitos (reusos não
  aumentam destino).
- Monetário: totais em **centavos inteiros** (sem float); `diferencasCentavos[destino] = 0`.
- Chaves: `codigo_legado` + `group_id` + `empresa_id` (operação) únicos; retry idempotente.
- Quarentena: lista só motivos agregados no Git; detalhes nominais só no HD/`04_REPORTS`.
- Multiempresa: registro da 3Z processado no contexto CPA → rejeitar; Grupo sem
  `empresa_id` em operação emissora → rejeitar.

Ferramentas de apoio já no repo (sintéticas):  
`validar-origem-relatorios-privados.mjs`, `resolver-vinculo-juridico-legado.mjs`,
`carregar-staging-isolado-legado.mjs`.

---

## 4. Critérios de aceite do gate (go / no-go)

**GO** somente se TODOS forem verdadeiros:

1. Pré-requisitos §1 completos com evidência sanitizada.  
2. Staging do lote com `monetary.reconciliado=true` e `totalDiffCentavos=0`.  
3. Zero promoção silenciosa; flags `importAuthorized` / `operationalLoadAuthorized`
   ainda false até a ata humana do passo F.  
4. Amostra homologada por empresa (CPA e 3Z) e consolidado Grupo sem mistura.  
5. Backup de destino restauro-testado; janela e responsável nomeados.  
6. Plano de reversão §5 ensaiado (dry-run) no mesmo ambiente.

**NO-GO** (qualquer um): HD/alteração na origem; hash mismatch; vínculo por pasta/EMP03;
diff monetário ≠ 0; quarentena “esquecida” no lote; auditoria indisponível; ausência de
aprovação humana datada.

---

## 5. Plano de reversão (rollback)

Objetivo: desfazer **apenas** a fatia promovida, sem tocar no backup legado original.

1. **Congelar** novas promoções do lote (`operationalLoadAuthorized=false` imediato).  
2. **Identificar** registros pelo `lote_migracao` / `chave_idempotente_migracao` /
   `codigo_legado` + tenant.  
3. **Inativar/arquivar** no canônico (preferir soft-delete / status migratório; evitar
   delete físico de histórico financeiro/fiscal).  
4. **Restaurar** snapshot do destino (Postgres) se a fatia for inconsistente —
   restore isolado validado no pré-requisito §1.5.  
5. **Reabrir staging** do lote como `PENDING_MANUAL_RECONCILIATION` quando a baixa/
   vínculo for dúbio (política já existente em `migracaoErpPolicy.js`).  
6. **Auditar** before/after, usuário, timestamp, `groupId`, `empresaId`, motivo.  
7. **Não** reescrever, “corrigir” ou recompactar arquivos no HD `BACKUP ERP ANTIGO - CODEX`.

Ensaio de reversão deve ser documentado com contagens (promovidos / revertidos /
restantes em staging) e `totalDiffCentavos` pós-rollback = 0 no escopo da fatia.

---

## 6. Evidências publicáveis vs privadas

| Publicável no GitHub | Somente HD / ambiente privado |
|---|---|
| Este plano, scripts, fixtures sintéticas, testes | Relatórios `04_REPORTS` com hashes reais |
| Contagens agregadas e diffs em centavos | CNPJ/UUID/nomes/valores nominais |
| STATUS/HANDOFF sanitizados | Mapa `legacy-approved-business-alias-map.json` real |
| Motivos de quarentena agregados | Extratos SQL/TPS, MDF/LDF, dumps |

---

## 7. Ferramentas e fixtures de preparação (já entregues)

| Item | Artefato |
|---|---|
| 1 · Origem relatórios | `scripts/legado/validar-origem-relatorios-privados.mjs` |
| 2 · Vínculo jurídico | `scripts/legado/resolver-vinculo-juridico-legado.mjs` |
| 3 · Staging isolado | `scripts/legado/carregar-staging-isolado-legado.mjs` |
| Contrato aliases sintético | `fixtures/legado/vinculos-juridicos-sinteticos/` |
| Lote staging sintético | `fixtures/legado/staging-isolado-sintetico/` |

---

## 8. Coordenação Comercial/Cursor (canônico)

Instrução do chat principal — obrigatória antes de atribuir falhas ao legado:

> Investiguem a diferença entre a versão anterior do ERP novo e a VPS:
> commit/imagem implantada, flags, configurações, rotas, layouts e permissões.
> Entreguem uma lista de diferenças comprovadas e correções em branch própria,
> coordenada com o legado. Não tratem toda ausência de tela ou cadastro como
> problema de importação.

**Legado não assume** que falta de tela/cadastro = falha de ETL/staging.  
Layouts e funcionalidades podem depender da versão implantada ou de configuração.

Pedido mínimo ao Comercial/Cursor (evidência sanitizada):

1. commit/SHA e imagem (API+SPA) na VPS;
2. flags/opt-in e runtime efetivos;
3. rotas/menus/layouts presentes vs esperados;
4. permissões do perfil de teste (Grupo CPA / CPA Ferro e Aço / 3Z LTDA);
5. lista de diferenças vs versão anterior + branch de correção.

Somente após essa triagem, divergências de **dados** (contagens/centavos/quarentena)
voltam ao escopo do gate de importação deste plano.

---

## 9. Próximo passo

**Aguardar gate humano** (autorização explícita + HD montado + backup de destino
restauro-testado) **e** evidências VPS do Comercial/Cursor (§8). Até lá:

- manter `importAuthorized=false` e `operationalLoadAuthorized=false`;
- não promover staging → operacional;
- não editar o mapper Cursor #48;
- não abrir tip-port / carga operacional;
- preservar o backup original somente leitura;
- não classificar ausência de tela/cadastro como falha de importação sem o diff VPS.
