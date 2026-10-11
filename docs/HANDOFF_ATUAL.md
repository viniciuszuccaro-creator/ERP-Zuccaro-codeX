## POLICY CRM COMPARTILHADA — pacote 040 (2026-10-10)

Fonte única: `server/src/domain/crmOportunidadePolicy.js`. O arquivo `src/components/lib/crmOportunidadePolicy.js` permanece wrapper. A API empacota essa fonte porque o contexto Docker continua `server/` (`COPY src` → `dist/domain`). Não alargar o contexto para a raiz: `docker build ./server` é o contrato do compose, do gate-f, do canário e do incidente. Codex importa o módulo; não edita a policy nem a UI. Schema, repositório e RLS da 040 seguem no workspace Codex, sem corte do store e sem dual-write.

## REVISÃO CODEX AUTÔNOMO (2026-10-10)

Cursor monitora agentes/PRs Codex sem re-portar #254/#264.

| PR / agente | Achado | Ação Cursor |
|---|---|---|
| [#265](https://github.com/viniciuszuccaro-creator/erp-zuccaro-codex/pull/265) tip `910e4ec9` | Produto+Orçamento sobre #261; MERGEABLE | Produto já em `db89aa45`; **Orçamento porte** neste ciclo |
| [#263](https://github.com/viniciuszuccaro-creator/erp-zuccaro-codex/pull/263) | vs main · ancestral do Orçamento em #265 | absorvido via porte seletivo na #261 |
| [#266](https://github.com/viniciuszuccaro-creator/erp-zuccaro-codex/pull/266) tip `001e6c85` | Legado mestres+retry · agente RUNNING | **não** merge Cursor — #211 |
| #254 | ancestral OPEN | não re-portar |
| Agentes | Legado RUNNING | timer contínuo |

## RECONCILIAÇÃO PÓS-#264 (2026-10-10)

Consulta GitHub + lote Cursor CRM. **Não** re-portar #254/#264. **Não** atribuir homolog de `f22d1151` ao HEAD novo.

| Item | Valor |
|---|---|
| `origin/main` | **`baba91a6`** (merge #257) · **não** contém o HEAD da #261 |
| #261 | OPEN draft · branch `cursor/cadastros-recuperacao-c360-contrato-392b` · tip CRM legado C360 · mergeable vs main · **não** incorporada na main |
| #264 | **MERGED** na candidata #261 (não na main) · tip `d9403665` · merge **`861513cd`** · ancestral confirmado |
| #254 | tip `20a2c2fb` · ancestral confirmado · não re-portar |
| SHA implantado | **`9f084ed0`** · `index-C-lbE7zK.js` · ≡ PR HEAD (Orçamento+#265) |
| homolog deste SHA | owner login tipado fail_count=0 · **somente** `9f084ed0` |
| usuário restrito | **BLOCKED** reconfirmado: Environment sem `ERP_DEV_LOGIN_RESTRICTED_*` |
| CRM | C360 adaptador **opção B** (store Oportunidade legado) · HTTP canônico server **pendente Codex** · sem CRM paralelo · `useContextoVisual` reservado |
| próxima funcional | secret restrito · contrato HTTP Codex Oportunidade se A · merge owner #261→main · azul residual |

## CONTINUIDADE CASA — Cursor ↔ Codex (2026-10-10)

Troca de máquina. **Não depender** de alterações locais da empresa — só GitHub + este HANDOFF.

| Item | Valor |
|---|---|
| repositório canônico | `viniciuszuccaro-creator/ERP-Zuccaro-codeX` (clone também via `erp-zuccaro-codex`) |
| branch Cursor | `cursor/cadastros-recuperacao-c360-contrato-392b` |
| **main** | `baba91a6` — **#261 ainda não mesclada em main** |
| **#264** | MERGED **na #261** (não em main) · tip `d9403665` · merge `861513cd` |
| **PR HEAD #261** | **`9f084ed0`** · CI SUCCESS · MERGEABLE → `main` |
| **SHA implantado erp-dev** | **`9f084ed0`** · asset `index-C-lbE7zK.js` · ≡ PR HEAD |
| rollback | `pre-spa-login-20261010-172341` |
| backup | `pre-gate-e-20261010-144428.sql` (SPA-only tip; só VPS) |
| #254 Codex | tip `20a2c2fb` — ancestral confirmado; **não** re-portar |
| homologado tip implantado | login tipado fail_count=0 (owner) em **`9f084ed0`** (não reusar SHAs anteriores) |
| usuário restrito | **BLOCKED** — falta `ERP_DEV_LOGIN_RESTRICTED_*` no Environment |
| CRM | C360 adaptador **opção B** (legado Oportunidade); HTTP canônico **pendente Codex** (sem paralelo) |
| **recuperado / importado** | **NÃO** legado · SYNTH≠recuperado · #211 Codex Legado |
| arquivos reservados Codex | sessão/contexto/outbox (`erpHttpSession`, `useContextoGrupoEmpresa`, `useContextoVisual`) · schema CRM HTTP novo |
| ManagePR | URL lowercase `…/erp-zuccaro-codex/pull/261` |
| evidência | `deploy-261-tip-9f084ed0-orcamento-20261010.txt` · `deploy-261-tip-db89aa45-porte-265-20261010.txt` · `reconciliacao-261-pos-264-main-20261010.txt` |
| chat coordenação | [ERP ZUCCARO - CODEX/CURSOR](https://cursor.com/agents/bc-d973626e-1060-4071-a25a-6a549769392b) |

### Ao abrir no PC de casa
1. `git fetch origin cursor/cadastros-recuperacao-c360-contrato-392b` → checkout → **`9f084ed0`** (ou tip docs posterior).
2. Confirmar VPS: `MERGE_SHA8=9f084ed0` / `index-C-lbE7zK.js` — não atribuir homolog antiga a este tip.
3. Ler este bloco + STATUS topo; **não** sobrescrever seções Codex sem merge consciente.
4. Credenciais/SFTP/VPS: secrets do Environment (não via Git).

### Próxima ação Cursor (independente enquanto merge owner)
1. ~~CI + redeploy tip CRM+azul+#265+Orçamento~~ **feito** `9f084ed0` / `index-C-lbE7zK.js` · homolog owner fail_count=0.
2. Secret usuário restrito → homolog fail-closed FE+BE.
3. Inventário residual (POD/Separação keep-both; Painel seletivo).
4. Merge owner #261→main; fechar #254 como supersedido/ancestral.
5. Codex: decidir CRM HTTP (A schema) se for além do adaptador B; Legado #211.

### Pendências / parcial (não concluído)
- Homolog usuário restrito.
- CRM HTTP canônico (server) — adaptador B cobre leitura C360; funis ainda no store legado.
- #261 **não** incorporada em `main` (só #264→#261).
- Legado staging→ops: **não importado**.
- CI do tip ≠ prova de merge em `main`.
## CODEX LEGADO — ownership e gate de origem (2026-10-10)

| Frente | Arquivos / responsável | Estado |
|---|---|---|
| Comercial 360 | Tarefa própria em outra conta/chat; nenhum arquivo Comercial editado neste checkout | Encaminhamento direto ainda sem ID acessível; não criar tarefa duplicada |
| Cursor #261/#264 | Branches Cursor intocadas; `861513cd` é descendente da main `baba91a6`, não integrado à main | Integração anterior preservada como base deste checkout Codex |
| Codex Legado | `scripts/legado/mapear-registro-sintetico.mjs`, `consumir-lote-staging.mjs`, testes e documentação de mapeamento | Branch Codex isolada; mestres de Grupo, classificação Produto, conflito/idempotência |
| Cursor Legado #211 | Verificador, proveniência, vínculo jurídico e staging isolado | Reutilizar na etapa real; não copiar mapper nem editar branch Cursor |

O HD foi detectado no host, mas a leitura de `04_REPORTS` foi negada pelo
sistema de arquivos. Nenhuma leitura de conteúdo, carga real, importação
operacional, migration ou alteração do backup ocorreu. `importAuthorized=false`.
Próximo gate: acesso somente leitura à pasta dos relatórios, procedência
verificada, destino isolado identificado e backup recuperável antes do piloto
real; evidência pública somente agregada e sanitizada.

## ORIENTAÇÃO COORDENADA — Auditoria global / C360 / Legado (2026-10-10)

Substitui a orientação anterior. Imagens = exemplos; escopo = **todo o sistema**.
Chat principal: [ERP ZUCCARO - CODEX/CURSOR](https://cursor.com/agents/bc-d973626e-1060-4071-a25a-6a549769392b).

| Papel | Quem | Branch/ambiente | Não editar |
|---|---|---|---|
| Coordenação + UI/recuperação funcional | **Cursor** | `#261` `cursor/cadastros-recuperacao-c360-contrato-392b` · erp-dev | sessão/contexto/outbox Codex |
| Contratos/sequências C360 | **Codex Comercial 360** | tarefa própria | Visualizador em lote Cursor sem coordenação |
| Migração/recuperação real | **Codex Legado** | staging VPS privado | não misturar SYNTH como recuperado |

### CURSOR — mandato ativo
1. Inventariar módulos/submódulos/entidades (matriz global).
2. Recuperar melhorias da azul-clara seletivamente (sem restaurar versão inteira).
3. Código numérico + ID técnico em listas/detalhes/forms.
4. Corrigir abertura dupla, carga incompleta, campos sumindo, busca, paginação, permissões.
5. Confrontar UI/API × legado privado; SYNTH ≠ recuperado.
6. Consolidar #261, CI, implantar e homologar SHA VPS.

### Primeira ação efetiva Cursor
Corrigido Visualizador: gate `Organizacional` no `data-permission`; fallback sem `codigo` em campos descritivos; `GrupoEmpresarial` inclui `id===groupId` no filtro.
**Implantado** erp-dev tip **`ea213906`** · `index-Dqf6E74p.js` · evidências `orientacao-coordenada-auditoria-global-20261010.txt` · `deploy-261-tip-ea213906-*`.

### Segunda ação efetiva Cursor — Fiscal RBAC
Causa: cards/botões usavam `Fiscal.Notas Fiscais.*` enquanto owner tree é `Fiscal.nfe|tabelas_fiscais|sped|obrigacoes`.
Correção: `sectionKey` canônico no launchpad + aliases UI→owner em `usePermissions`/`localBase44Client` + `NotasFiscaisTab` consulta `Fiscal.nfe` + teste focado owner.
Fail-closed preservado (gate por seção).
**Implantado** erp-dev tip **`7f00e392`** · `index-BAZjmDZB.js` · backup `pre-gate-e-20261010-104907.sql` · rollback `pre-spa-login-20261010-104908` · evidência `deploy-261-tip-7f00e392-fiscal-rbac-20261010.txt`.
**Homologado browser** (session inject API→localStorage): Fiscal/Financeiro/Comercial PASS · 0 badges.

### Terceira ação — #254 contexto + Cadastros RBAC residual
- Revisado #254 HEAD `860114ca` (race refresh/espelho/grade).
- Port seletivo em #261 **sem** remover piloto HTTP `entityListSorted`/`countEntities` nem Organizacional/Marcas do Visualizador.
- Cadastros: aliases ContatoB2B/Segmento/Região→pessoas; Depto/Cargo/Turno→organizacional; PerfilAcesso→`Sistema.acessos`.
- Inventário: `docs/evidence/inventario-global-modulos-20261010.txt`.
- Login xdotool continua quebrado; homolog usa API session + inject.

### Quarta ação — #254 tip `b11843c8` (corridas login/empresa) no #261
- Fonte: PR #254 branch `codex/cadastros-http-context-race-20261009` tip **`b11843c8`**.
- Portado no mesmo arquivo #261: `loginErpHttpSession.shouldAccept` + evento contexto no login; Auth `loginVersion`/`bootstrapComplete`/revalidate background; `assertCadastroFormScopeCurrent` + `getScopedCadastroPlaceholder` + `formScopeRef`.
- **Não** revertido: piloto HTTP, Organizacional `data-permission`, fallback sem codigo/sigla, `classify`/`merge` edit load, `grupoSelfOr`.
- CI tip **`95ee6179` SUCCESS**. Redeploy VPS pendente (ainda `7fe1067b` no erp-dev).
- #254 Codex: tip já incorporado em #261 — fechar/merge coordenado sem segunda cópia dos arquivos.

### Quinta ação — launchpads sectionKey (Compras/Estoque/Expedição/Financeiro)
- Mesmo padrão Fiscal.nfe: `sectionKey` canônico + aliases em `usePermissions`/`localBase44Client`.
- DetalhesCliente: `uniqueKey` por id (anti janela dupla).
- Evidência: `docs/evidence/inventario-launchpad-sectionkey-20261010.txt`.

### Sexta ação — tip `4c0c167a` implantado erp-dev
- CI SUCCESS · SPA `index-DFgiLWLi.js` · backup `pre-gate-e-20261010-122408.sql` · rollback `pre-spa-login-20261010-122409`.
- Bundle público confirma sectionKeys + shouldAccept + DetalhesCliente uniqueKey.
- P0 codigo: Cliente/Produto/TabelaPreco via `reserveEntityCodigo` (preserve incoming + high-water).
- Evidência: `docs/vps/evidence/deploy-261-tip-4c0c167a-integrado-20261010.txt`.
- **Supersedido** pela sétima ação (`7e515fbc`).

### Sétima ação — tip `7e515fbc` + homolog login tipado + Onda 5 Pedido UX
- Port #254 `f0844fa5` + Pedido Onda 5 + FormaPagamento codigo/ID.
- **Supersedido** pela oitava ação (`3108b9f2`). Evidência tip antigo: `deploy-261-tip-7e515fbc-homolog-login-20261010.txt`.

### Oitava ação — tip `3108b9f2` (#254 HEAD `4a1ecf4c` + azul global + consolidação)
- **Supersedido** pela nona ação (`0d458ab9`). Evidência tip antigo: `deploy-261-tip-3108b9f2-integrado-20261010.txt`.

### Nona ação — tip `0d458ab9` (Clientes API×UI + V23→V24)
- **Supersedido** pela décima ação (`bdeec58c`). Evidência: `deploy-261-tip-0d458ab9-clientes-v24-20261010.txt`.

### Décima ação — tip `bdeec58c` (salvar minify-safe)
- Crash salvar: `Function.name` some no bundle → self-managed falso → `onSuccess`→`handlePersistSubmit`→ErrorBoundary.
- Fix: `FormComponent.isSelfManagedCadastro = true` (+ displayName) em Cliente/Fornecedor/Representante/Produto V22.
- Freeze scope só quando sessão HTTP ≡ render (visão consolidada Grupo ok).
- **Implantado** erp-dev tip **`bdeec58c`** · asset `index-5EmU7-cb.js` · backup `pre-gate-e-20261010-134527.sql` · rollback `pre-spa-login-20261010-134528`.
- **Homologado neste SHA** fail_count=0: login · Clientes V24 n=5 · abrir/campo/salvar/reabrir · trocar Grupo · launchpads.
- Residual: usuário restrito · Legado #211 · ManagePR casing repo.
- Evidência: `deploy-261-tip-bdeec58c-salvar-minify-20261010.txt`.

### Décima primeira ação — integração #264 + #254 final `20a2c2fb` em #261
| Pacote | Valor |
|---|---|
| responsável | **Cursor** (merge na candidata #261) · Codex porte #254→#264 |
| HEAD referência #254 | **`20a2c2fb`** (ancestral de #261 pós-merge) |
| HEAD #264 Codex | **`d9403665`** · CI SUCCESS · base #261 `d31b9bbe`/`a004044b` |
| **PR HEAD #261** | tip branch · merge código **`861513cd`** · docs **`c9f845a8`+** |
| código incorporado | `useProdutoHttpEditLoad` · actorId/token no form scope/edit policy · cliente consolidado · **preservado** `isSelfManagedCadastro` minify-safe |
| **SHA implantado** | supersedido pela 13ª ação (**`00edfb2b`**) |
| sem cópia divergente | Cursor **não** re-portou #254 enquanto Codex fechava #264; merge preservou ambos os conjuntos |
| testes | produto-http-edit-load + edicao-load + pim-ui 40/40 |
| próxima | supersedido pela 13ª ação |

### Décima segunda ação — Contratos/C360 independente
- Contratos: ID técnico em `ContratoForm` + `ContratoDialogs` (≠ número).
- Central 360: código + ID técnico; orçamentos/pedidos com status e id (fonte canônica).
- ManagePR: URL lowercase `erp-zuccaro-codex` (PR #261).

### Décima terceira ação — tip `00edfb2b` implantado + homolog
| Pacote | Valor |
|---|---|
| **PR HEAD / implantado** | **`00edfb2b`** · asset `index-ChwPPG6e.js` |
| incorporado | #254 `20a2c2fb` · #264 `d9403665` · minify-safe · Contratos/C360 |
| CI | erp-runtime-ci **SUCCESS** (4) |
| backup | `pre-gate-e-20261010-142336.sql` sha256 `501c0400…ba5f` |
| rollback | `pre-spa-login-20261010-142346` |
| **homologado** | login tipado fail_count=0 (não inject) |
| evidência | `deploy-261-tip-00edfb2b-integrado-20261010.txt` |
| ≠ implantado antigo | `bdeec58c` supersedido neste redeploy |
| próxima | 14ª ação (ID técnico) · merge owner · #211 |

### Décima quarta ação — tip `6e397596` ID técnico implantado
- `CadastroCodigoRegistroField` + `entityId` · 22 forms · ClienteCompleto · Produto V22 · C360 fontes canônicas.
- **Implantado** erp-dev **`6e397596`** · `index-BE23NqEC.js` · backup `pre-gate-e-20261010-143842.sql` · rollback `pre-spa-login-20261010-143842`.
- **Homologado** login tipado fail_count=0 neste SHA.
- Usuário restrito: **BLOCKED** (`homolog-usuario-restrito-blocked-20261010.txt`).
- Evidência: `deploy-261-tip-6e397596-id-tecnico-20261010.txt`.

### Décima quinta ação — tip `f22d1151` Fornecedor/Representante implantado
- `CadastroFornecedorCompleto` + `RepresentanteFormCompleto` com `CadastroCodigoRegistroField`.
- **Implantado** **`f22d1151`** · `index-KP6RdCBA.js` · backup `pre-gate-e-20261010-144428.sql` · rollback `pre-spa-login-20261010-144429`.
- **Homologado** login tipado fail_count=0 neste SHA.
- Evidência: `deploy-261-tip-f22d1151-fornecedor-rep-20261010.txt`.
- Residual: secret usuário restrito · merge owner · Legado #211.

### Codex Comercial 360 / Legado
Receber contexto por este HANDOFF; executar nos ambientes próprios; confirmar encaminhamento com ação efetiva (não só ack).
Contratos CPA/compartilhados e recuperação real: Legado (#211); Cursor prepara UI/consumo sem SYNTH.
#254 tip **`20a2c2fb`** + #264 tip **`d9403665`** em #261 tip implantado **`00edfb2b`** — merge owner; não abrir segundo porte.

## CURSOR — #261 tip `d6952b9d` implantado (2026-10-10)

| Item | Valor |
|---|---|
| responsável | Cursor |
| candidata | [#261](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/261) · `#258⊂#259⊂#260⊂#261` |
| tip | **`279f26fc`** · asset `index-D_uICNJK.js` (runtime forms em `d6952b9d`+) |
| delta | forms MASTER_CODE `codigo-registro` · HTTP `order_by` (Bugbot) · lint hasId |
| **implantado** | erp-dev · mig 038+039 · backup `pre-gate-e-20261010-100519.sql` · rollback `pre-spa-login-20261010-100519` |
| **homologado API** | CPA create/reopen/convert/dup409/cross404 PASS |
| **recuperado** | NÃO legado (#211) · auxiliares codigo API OK |
| UI | BLOCKED #254 Codex |
| ≠ | sessão/contexto/outbox Codex |
| evidências | `deploy-261-tip-d6952b9d-*` · `homolog-261-tip-d6952b9d-c360-*` |
| próxima | CI tip → merge owner; #254; #211 |

## CURSOR — #261 candidata integração + homolog API (2026-10-10)

| Item | Valor |
|---|---|
| tip | supersedido por **`d6952b9d`** acima |

## CURSOR — #261 tip `bd2fa504` implantado (2026-10-09T20:50Z)

| Item | Valor |
|---|---|
| tip | supersedido pelo bloco candidata 2026-10-10 acima |

## CURSOR — Cadastros recuperação + C360 contrato 039 (2026-10-09)

| Item | Valor |
|---|---|
| responsável | Cursor |
| tip | supersedido por **`bd2fa504`** implantado acima |

## CURSOR — #260 tip `18113337` implantado + homolog (2026-10-09T19:52Z)

| Item | Valor |
|---|---|
| responsável | Cursor |
| branch / PR | `cursor/comercial360-fluxo-cliente-orc-pedido-392b` · [#260](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/260) |
| tip | **`18113337`** |
| CI | **SUCCESS** · MERGEABLE |
| **implantado** | erp-dev · `index-wiWHreg3.js` · backup `pre-gate-e-20261009-194341.sql` · rollback `pre-spa-login-20261009-194342` |
| **homologado** | Orçamento busca+gap PASS · Pedido busca/tabela PASS · 3Z PASS |
| **importado** | **NÃO** |
| #259 | tip `55fcac4f` · MERGEABLE · merge owner |
| #258 | ancestor de #259 |
| #254 / #211 | Codex |
| evidências | `deploy-260-*` · `browser-260-*` |
| próxima | supersedido pelo lote recuperação+039 |

## CURSOR — Comercial 360 picker + #259 closeout (2026-10-09T19:40Z)

| Item | Valor |
|---|---|
| responsável | Cursor |
| #259 | tip **`55fcac4f`** implantado · CI SUCCESS · MERGEABLE · Setor/UM/Grupo edit+codigo **PASS** |
| #258 | ancestor OPEN — merge #259 cobre |
| Comercial 360 | supersedido pelo tip **`18113337`** implantado |
| **importado** | **NÃO** (#211 staging) |
| registros | matriz `registros-recuperacao-matriz-20261009.txt` · Fornecedor schema ausente · SYNTH≠legado |
| Financeiro menus | inventário `financeiro-menus-nav-20261009.txt` · sem módulo paralelo |
| #254 / #211 / outbox | **reservado Codex** — Cursor não edita sessão/contexto/outbox |
| mig | VPS 001–024+**038**; Codex 025–037 intocados |
| próxima | merge #259/#260 após owner |

## CURSOR — #259 tip `55fcac4f` implantado + homolog (2026-10-09T18:55Z)

| Item | Valor |
|---|---|
| responsável | Cursor |
| branch / PR | `cursor/cadastros-codigo-abrir-unico-392b` · [#259](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/259) |
| tip | **`55fcac4f`** |
| CI | **SUCCESS** |
| **implantado** | erp-dev · `index-DlbCJL3w.js` · mig **038** · backup `pre-gate-e-20261009-183944.sql` |
| **homologado** | Grupo/Marca Abrir=1 + edit+codigo PASS · Setor/UM supersedido closeout 19:35Z |
| **importado** | **NÃO** |
| #258 | ancestor — merge #259 cobre #258 |
| #254 / #211 | Codex |
| evidências | `deploy-259-*` · `browser-259-*` · inventário completo |
| próxima | merge #259 após owner; fechar #258 |

## CURSOR — Cadastros código + Abrir único tip `c2e32750` (2026-10-09)

| Item | Valor |
|---|---|
| tip | **`c2e32750`** (pré-fix CI) |
| mudança | Abrir único; código auxiliares; edit merge |
| **implantado** | **NÃO** |

## CURSOR — #258 badge Clientes HTTP tip `d9a72802` (2026-10-09T16:07Z)

| Item | Valor |
|---|---|
| responsável | Cursor |
| branch / PR | `cursor/homolog-254-cadfin-360-legado-392b` · [#258](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/258) |
| tip | **`e94f39b2`** (CI) · runtime implantado **`d9a72802`** |
| CI | erp-runtime-ci **SUCCESS** (`e94f39b2`) |
| **implantado** | **`d9a72802`** erp-dev · asset `index-okyVzZdT.js` · rollback `pre-spa-login-20261009-155123` |
| mudança | `countEntities` batch → piloto HTTP; filtro contagem = multiempresa Visualizador |
| **homologado** | hub badge Clientes=5 · V24 badge=5 · rows=5 · API n=5 (tip = d9a72802) |
| ops DB | clientes=6 · produtos=4 · empresas=3 · auxiliares OK · `fornecedores` tabela ausente |
| registros | preservados ops; volume legado só staging; sem reseed |
| #254 Codex | **reservado** |
| #211 | staging 20456 · authorized=0 · **importado=NÃO** · consumidor testes PASS |
| fases | implementado=sim · integrado=PR · implantado=sim · homologado=badge/lista · importado=não |
| próxima ação | CI tip `d9a72802` → merge #258 após owner; Codex #254/#211 contrato+crosswalk |

Evidências: `deploy-258-count-badge-d9a72802-20261009.txt`, `browser-258-count-badge-d9a72802-20261009.txt`, `registros-sumidos-fonte-api-ui-20261009.txt`, `legado-211-ensaio-consumidor-20261009.txt`.

## CURSOR — #258 ciclo edição Cliente PASS tip `02d59aa6` (2026-10-09T15:22Z)

| Item | Valor |
|---|---|
| responsável | Cursor |
| branch / PR | `cursor/homolog-254-cadfin-360-legado-392b` · [#258](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/258) |
| tip | **`02d59aa6`** |
| **implantado** | **`02d59aa6`** erp-dev · asset `index-BD0zl8Pi.js` · CLIENTE_360=true · rollback `pre-spa-login-20261009-151957` |
| mudança | RBAC Salvar=`editar`/`criar`; `toClienteMasterHttpPayload` allowlist; lista HTTP + consumidor (tips anteriores) |
| validado browser | Cadastros layout+busca PASS · lista n=5 PASS · **Cliente abrir→salvar→reabrir PASS (PATCH 200)** · Empresa PASS · Central360 PASS · Financeiro PASS |
| #254 Codex | **reservado** — Cursor não edita sessão |
| #211 | staging privado; **importado=NÃO** |
| fases | staging=contagens · reconciliado=consumidor · importado=não · **validado_nav=sim (ciclo completo)** |
| próxima ação | CI tip → merge #258 → main; Codex #254 rebase; Legado ensaio isolado |

Evidências: `deploy-258-cliente-cycle-02d59aa6-20261009.txt`, `browser-258-cliente-cycle-02d59aa6-20261009.txt`.

## CURSOR — #258 lista HTTP Cadastros + edição + consumidor (2026-10-09T14:45Z)

| Item | Valor |
|---|---|
| responsável | Cursor |
| branch / PR | `cursor/homolog-254-cadfin-360-legado-392b` · [#258](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/258) |
| tip | **`7418243f`** (+ `data-action` editar Visualizador pendente no tip seguinte) |
| **implantado** | **`7418243f`** erp-dev · asset `index-Bc213K00.js` · CLIENTE_360=true · rollback `pre-spa-login-20261009-143634` |
| mudança | `entityListSorted`→piloto HTTP (Cliente com flag); consumidor `consumir-lote-staging.mjs`; merge/classify edição |
| validado browser | Cadastros layout+busca PASS · Clientes lista n=5 PASS · edição abrir preenchido PASS · Empresa ciclo PASS · Central360 PASS |
| #254 Codex | **reservado** — Cursor não edita sessão |
| #211 | staging privado; **importado=NÃO**; consumidor testado (não mapper paralelo) |
| fases | staging=contagens · reconciliado=testes consumidor · importado=não · validado_nav=sim (lista/abrir) |
| próxima ação | CI tip · merge #258 → main; Codex #254 rebase; Legado ensaio isolado |

Evidências: `deploy-258-http-list-7418243f-20261009.txt`, `browser-258-cadfin-edit-7418243f-20261009.txt`.

## CURSOR — homolog #254 + CadFin/360 + consumidor legado (2026-10-09T12:10Z)

| Item | Valor |
|---|---|
| responsável | Cursor |
| branch | `cursor/homolog-254-cadfin-360-legado-392b` |
| #254 | parecer **APROVAR COM RESSALVAS** tip `fd1778f6` · arquivos **reservados Codex** (`erpHttpSession` / `useContextoGrupoEmpresa` / `useContextoVisual`) — Cursor **não** edita |
| mudança Cursor | `cadastroEditLoadPolicy` merge/classify (edição sem esvaziar); mapper legado +`fornecedor`; evidências sanitizadas |
| homolog tip implantado | `baba91a6` · login/CPA/contexto/Cadastros azul/edição Empresa/Financeiro CR≠Régua PASS · API×DB (clientes/produtos) ≠ lista V24 vazia |
| #211 Legado | checksum+CNPJs já OK nos comentários · stage VPS `legacy-stage-20261009T115402Z` · staging 20456 / quarentena 4722 · **importado=NÃO** |
| preservado | auxiliares ERP novo; visual azul; sem reseed; sem PII no GitHub |
| testes | cadastro edit load + legado mapear = **28/28** |
| próxima ação | Codex rebase #254 (STATUS) → merge → deploy; Legado vincular `target_empresa_id` + gate importação |

Evidências: `parecer-254-fd1778f6-20261009.txt`, `browser-homolog-254-cadfin-360-baba91a6-20261009.txt`, `legado-211-stage-consumo-20261009.txt`.

## CURSOR — padrão azul Comercial + auxiliares (2026-10-09T11:40Z)

| Item | Valor |
|---|---|
| responsável | Cursor |
| branch | `cursor/comercial-azul-padrao-visual-392b` |
| mudança | hub Comercial tiles → blue uniforme; V24 fallback Nome→descricao/nome_grupo; colunas auxiliares codigo-first |
| preservado | todos os módulos Comercial; auxiliares existentes; Financeiro CR≠Régua |
| testes | `comercial-azul-padrao-visual` + inventário + clientes-tab |
| #255 | já MERGED/validado `99ee35b0` |
| #254 Codex | não tocado |
| ref | `ref-visual-azul-aprovado-proprietario-20261009.txt` + artifacts `ref-visual-aprovado/*` |
| próxima ação | CI → merge → rebuild tip → browser Comercial azul + Cadastros auxiliares |

## CURSOR — #255 MERGED main `99ee35b0` + ajuste proprietário (2026-10-09T11:05Z)

| Item | Valor |
|---|---|
| responsável | Cursor |
| #255 | **MERGED** `99ee35b0` · implantado erp-dev · rollback `pre-spa-login-20261009-110013` |
| validado | Central360 PASS · Cadastros+azul PASS · Financeiro+CR≠Régua PASS |
| regras | AGENTS.md §14.1 — exemplos/sintéticos ≠ carga operacional/legado; sem reseed por lista vazia |
| visual | ref `ref-visual-azul-financeiro-20261009.txt` · testes regressão cores no inventário Financeiro |
| Codex #254 | **reservado Codex** — `erpHttpSession` / `useContextoGrupoEmpresa` / `useContextoVisual` · Cursor **não** edita |
| Codex Legado | staging privado + backup original; conflitos/lacunas; dados reais **fora** do GitHub |
| próxima ação | Codex concluir #254 (sessão/troca empresa); Cursor não reseed; legado prepara ETL staging |

Evidências: `deploy-255-main-99ee35b0-20261009.txt`, `browser-255-main-99ee35b0-20261009.txt`.

## CURSOR — DetalhesCliente→Central360 entry tip `b2ce9611` (2026-10-09T10:36Z)

| Item | Valor |
|---|---|
| responsável | Cursor |
| branch / PR | `cursor/comercial-detalhes-cliente-360-entry-392b` · [#255](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/255) |
| tip | **`b2ce9611`** |
| CI | **PASS** (erp-runtime-ci) |
| parecer | APROVAR COM RESSALVAS → `parecer-detalhes-cliente-360-entry-20261009.txt` |
| implantado | **`b2ce9611`** erp-dev · asset `index-DbVDch1Q.js` · CLIENTE_360=true |
| rollback | `pre-spa-login-20261009-101703` |
| validado browser | login/CPA · v24 · cliente-novo · **cliente-detalhes-360→Central360 PASS** · Carregar mais UI NO_BUTTON_MAYBE_EOF · API limit/offset PASS |
| #251/#252 | MERGED em main `d6cca4c2` (ancestrais); tip entry ainda **não** em main |
| próxima ação | **merge #255 → main** → rebuild spa-login no tip main → revalidar browser com evidência nova do SHA de merge |

≠ Codex outbox/legado. Evidências: `deploy-360-entry-b2ce9611-20261009.txt`, `browser-360-entry-b2ce9611-20261009.txt`.

## CURSOR — #251+#252 em main `d6cca4c2` (2026-10-09T10:10Z)

| Pacote | integrado | implantado | validado |
|---|---|---|---|
| #251 | `96287638` | superseded por d6cca4c2 | Empresas/Financeiro/API 360 PASS |
| #252 | **`d6cca4c2`** MERGED | **`d6cca4c2`** erp-dev | Novo Cliente Cadastros+Ações PASS |
| #248/#249/#250 | MERGED via #251 | — | ancestrais OK |

Rollback: `pre-spa-login-20261009-100721`. Flag CLIENTE_360=true.
Evidências novas: `deploy-252-main-d6cca4c2-20261009.txt`, `browser-252-main-d6cca4c2-20261009.txt`, `deploy-251-main-96287638-20261009.txt`, `browser-251-main-96287638-20261009.txt`.

### Próxima entrega (reservada Cursor)
`cursor/comercial-detalhes-cliente-360-entry-392b` — wire `DetalhesCliente`+Central360 a partir do Visualizador/Comercial. ≠ Codex outbox.

## CURSOR — #251 MERGED+implantado `96287638` (2026-10-09T10:06Z)

| Fase | Estado |
|---|---|
| implementado | #248+#249+#250 no merge-tree |
| revisado | APROVAR COM RESSALVAS |
| **integrado** | **`96287638` MERGED #251 → main** |
| **implantado** | **`96287638`** erp-dev · flag CLIENTE_360=true · rollback `pre-spa-login-20261009-095826` |
| **validado** | Playwright Empresas/Financeiro/sugestão PASS · API paginação/isolamento PASS · Central360 UI DetalhesCliente FAIL_NAV |
| #248/#249/#250 | **MERGED** (ancestrais em main) |
| #252 | rebase `d766e5df` · parecer APROVAR COM RESSALVAS · CI a correr |

Evidências: `deploy-251-main-96287638-20261009.txt`, `browser-251-main-96287638-20261009.txt`.
Próximo: merge/deploy #252; abrir consumidor DetalhesCliente se UI 360 for P0.

## CURSOR — #252 rebase pós-#251 (2026-10-09T10:03Z)

Branch `cursor/comercial-clientes-tab-v24-392b` · rebase `origin/main` `96287638` (#251 MERGED).
| Fase | Estado |
|---|---|
| implementado | ClientesTab V24 + Ações Rápidas fail-closed + `cliente-novo` |
| revisado | **APROVAR COM RESSALVAS** (rebase obrigatório — feito) |
| overlap #251 | só STATUS/HANDOFF (runtime NONE) |
| CI | a correr pós-push |
| implantado | não |
| validado | testes focados + browser a seguir |

≠ Codex outbox/legado.

## CURSOR — #251 parecer publicado + fechamento (2026-10-09T09:55Z)

| Item | Valor |
|---|---|
| tip branch | `6ed9e7dc` |
| runtime | `dd13fb5f` |
| parecer | **APROVAR COM RESSALVAS** → `docs/vps/evidence/parecer-251-dd13fb5f-20261009.txt` |
| CI | PASS |
| overlap #252 | só STATUS/HANDOFF (runtime disjunto) |
| merge main | em curso |
| PR body GitHub | tentativa update; se BLOCKED, este handoff é canônico |

## CURSOR — #251 CLIENTE_360 ON + validação (2026-10-09T09:43Z)

| Item | Valor |
|---|---|
| código implantado | **`dd13fb5f`** |
| flag | `VITE_ERP_HTTP_CLIENTE_360=true` (após prova Auth supabase_user) |
| spa_asset | `index-B0gNWKWR.js` |
| browser Central360 | **PASS** (visível) |
| carregar mais UI | NO_BUTTON_MAYBE_EOF nesta vista; API limit/offset já PASS |
| sugestão UI Novo | BLOCKED_NAV no path Cadastros headless → lote indep. [#252](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/252) |
| branch tip docs | `3e0d61dd`+ |
| merge main | **não** |
| PRs redundantes #248/#249/#250 | manter abertas até merge #251; inventário no handoff anterior |

Evidências: `deploy-251-c360-flag-on-dd13fb5f-20261009.txt`, `browser-251-c360-flag-on-dd13fb5f-20261009.txt`.

## CURSOR — #251 continuidade (2026-10-09T09:39Z)

| Fase | SHA / estado |
|---|---|
| branch tip | `8ad3cdbd` |
| **implantado** | **`dd13fb5f`** erp-dev (asset `index-CMrmwZdE.js`) |
| CI | PASS tip `8ad3cdbd` + `dd13fb5f` |
| revisado | **APROVAR COM RESSALVAS** (parecer SHA final `dd13fb5f`; docs `8ad3cdbd` sem runtime) |
| integrado | PR #251 aberta; **não** merged em main |
| validado tip implantado | Playwright revalidação 2026-10-09: Empresas/Financeiro PASS; sugestão UI BLOCKED_NAV; 360 UI oculta (flag off) |
| Auth prova CLIENTE_360 | `/api/v1/meta` → `auth.mode=supabase_user` · `browserLogin=true` · `central360ReadModel=true` · env=dev **PASS** |
| PR body update | **BLOCKED** ManagePullRequest (repo rename) + `gh pr edit` (integration sem write) — corpo canônico neste handoff |

### Inventário incorporado (#248/#249/#250 → #251)
| Origem | Arquivos runtime |
|---|---|
| #249 | `Empresas.jsx`, `EmpresaSwitcher.jsx`, `input.jsx`, `localBase44Client.js`, `erpHttpSession.js`, `useContextoVisual.jsx`, `LaunchpadCard.jsx`, `ModulosGridFinanceiro.jsx`, `CaixaCentralLiquidacao.jsx`, `WindowModal.jsx`, `authSessionService.ts` + testes |
| #248 | `clienteSugestaoVinculoUi.js`, `CadastroClienteCompleto.jsx`, `httpApiClient.js` (sugestaoVinculo) + teste UI |
| #250 | `CentralCliente360Panel.jsx`, `centralCliente360Pagination.js`, `httpApiClient.js` (offsets), Dockerfile/compose flag, runtime test paginação |

Antes de fechar #248/#249/#250: merge #251 → main e confirmar ancestrais no tip merged.

### Lote indep. reservado (≠ #251)
Branch `cursor/comercial-clientes-tab-v24-392b` — `ClientesTab.jsx` → Visualizador V24 (Cadastros); `AcoesRapidasGlobal.jsx` data-action; **não** edita arquivos do #251.

≠ Codex outbox/legado/#236.

## CURSOR — pacote #251 implantado+validado `dd13fb5f` (2026-10-08T21:01Z)

| Fase | Estado |
|---|---|
| implementado | merge-tree #248 `bdf54b86` + #249 `4ab97760` + #250 `49e677ce` |
| revisado | **APROVAR COM RESSALVAS** |
| integrado | PR [#251](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/251) tip `dd13fb5f` (não merged em main) |
| **implantado** | **`dd13fb5f`** erp-dev (antes `54b9f9d0`) |
| **validado** | Playwright Empresas/Financeiro PASS · API paginação/sugestão/isolamento PASS |
| flag CLIENTE_360 | `false` — UI 360 oculta; API central-360 testada |
| rollback | `pre-spa-login-20261008-204827` · backup `pre-gate-e-20261008-204826.sql` |

Evidências: `docs/vps/evidence/deploy-251-integra-dd13fb5f-20261008.txt`, `browser-251-integra-dd13fb5f-20261008.txt`.
Pendência: UI Novo Cliente sugestão (BLOCKED_NAV headless); merge em main após aprovação humana.

## CURSOR — parecer integração #251 (2026-10-08T20:45Z)

| Item | Valor |
|---|---|
| branch | `cursor/cliente360-cadfin-integra-392b` |
| tip | `100cf997` |
| PR | [#251](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/251) |
| parecer | **APROVAR COM RESSALVAS** (revisão independente) |
| CI | em andamento |
| implantado | **não** |
| validado | **não** |
| flag CLIENTE_360 | `false` no deploy |

Ressalvas baixas: reset paginação via useEffect (sem vazamento cross-tenant); EmpresaSwitcher fallback HTTP sem groupId; Empresas FE sem usePermissions (pré-existente). Sem auto-mescla. Deploy DEV seguro após CI verde com flag off.

## CURSOR — pacote integração #248+#249+#250 (2026-10-08T20:55Z)

Branch `cursor/cliente360-cadfin-integra-392b` · base main `6ff6b0f2`.
Merge-tree: #249 `4ab97760` + #248 `bdf54b86` + #250 `49e677ce` (reset escopo + flag CLIENTE_360).

| Fase | Estado |
|---|---|
| implementado | HEADs das 3 PRs no branch de integração |
| revisado | pendente |
| integrado | merge-tree neste branch; **não** merged em main |
| implantado | **não** — erp-dev tip anterior `54b9f9d0` ≠ pacote |
| validado VPS | **não** |

Flag `VITE_ERP_HTTP_CLIENTE_360` default `false`. ≠ Codex outbox/legado.

## CURSOR — Onda 3 sugestão UI race-guard (#248)

Arquivos: `clienteSugestaoVinculoUi.js`, `CadastroClienteCompleto.jsx`, `httpApiClient.js` sugestaoVinculo.
Race: `buildClienteSugestaoVinculoRaceKey` + `shouldApplyClienteSugestaoVinculoBanner` descartam resposta atrasada.
Sem mescla automática. HEAD `bdf54b86`.

## CURSOR — #248 validado API/bundle + #249 restaurado (2026-10-08T20:17Z)

| frente | integrado | implantado | validado |
|---|---|---|---|
| [#249](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/249) Empresas/Financeiro | tip `54b9f9d0` / save `1e691933` | **`54b9f9d0`** erp-dev (atual) | browser PASS save/seletor/CNPJ/Caixa |
| [#248](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/248) sugestão UI | `bdf54b86` CI PASS | temporário `bdf54b86` → restaurado | API ausente+401+mescla proibida+bundle PASS; UI Novo janela BLOCKED_NAV headless |

Evidências: `browser-249-empresas-save-1e691933-20261008.txt`, `browser-248-sugestao-bdf54b86-20261008.txt`, `deploy-249-restored-54b9f9d0-20261008.txt`.

Lote independente reservado: Central 360 paginação por bloco → branch `cursor/comercial360-onda3-central360-pagina-392b`. ≠ Codex outbox/legado.

## CURSOR — #249 validado browser `1e691933` (2026-10-08T20:08Z)

| fase | estado |
|---|---|
| integrado | PR [#249](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/249) tip docs `b297b50d` / código save `1e691933` |
| implantado | **`1e691933`** erp-dev |
| validado | **PASS** switcher Grupo×Empresa · lista · save/reopen fantasia · CNPJ origem · Caixa open |

Evidência: `docs/vps/evidence/browser-249-empresas-save-1e691933-20261008.txt`. ≠ #248 / Codex.

## CURSOR — implantado #249 `1e691933` (2026-10-08T20:04Z)

| fase | estado |
|---|---|
| integrado | PR [#249](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/249) tip `1e691933` · CI no tip |
| implantado | **`1e691933`** erp-dev · rollback `pre-spa-login-20261008-200329` · backup `pre-gate-e-20261008-200329.sql` |
| validado browser | **PASS** (ver bloco abaixo) |

Causa save: RHF perdia digitação (`Input` spread após onChange) + remirror sessão sobrescrevia `nome_fantasia`. Testes focados 5/5. ≠ Codex outbox/legado. ≠ #248.

## CURSOR — CI verde #248/#249 (2026-10-08T17:33Z)

| PR | Tip CI | frontend/backend |
|---|---|---|
| [#248](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/248) sugestão UI | `bdf54b86` | **PASS** |
| [#249](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/249) SPA/Financeiro/Empresas | tip branch incl. `9c19da80` | **PASS** |
| implantado erp-dev | `b81bc1cd` | — |

Aguarda review/merge. Persistência save Empresa segue BLOCKED.

## CURSOR — tip implantado `b81bc1cd` (2026-10-08T17:30Z)

| Pacote | Tip | PR | Estado |
|---|---|---|---|
| SPA UI + Financeiro + Empresas | **`b81bc1cd`** implantado erp-dev | [#249](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/249) | Caixa/CR/CP/Conciliação/Lote/Cartões PASS; Empresas lista PASS; save Empresa BLOCKED local |
| Onda 3 sugestão UI + race | `bdf54b86` | [#248](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/248) | testes 5/5; aguarda CI/merge |
| Legado destino | tip `fff3abc8` · main `6ff6b0f2` | — | contratos #113/#246/#245; sem reprocessar backup |
| rollback | `pre-spa-login-20261008-173140` | — | |

Evidências: `docs/vps/evidence/browser-financeiro-pos-caixa-9b2c9b63-20261008.txt`, `browser-financeiro-caixa-08da3b8e-20261008.txt`, `browser-empresas-lista-empresa-2e50ee33-20261008.txt`.

## CURSOR — Empresas save regime + carimbar group_id (2026-10-08T17:25Z)

| Item | Estado |
|---|---|
| tip | tip local pós-regime/carimbar (base `2e50ee33` implantado) |
| lista escopo empresa | PASS edits=2 |
| save falhava | regime_tributario vazio no edit + carimbar `group_id`←empresaId |
| fix | defaults REGIMES/TIPOS no handleEdit; carimbar não estampa group_id como campo empresa; payload preserva group_id |
| testes | empresas-dialog-edit + contexto-multiempresa-policy PASS |

## CURSOR — Empresas lista no escopo empresa (2026-10-08T17:22Z)

Causa: `filterInContext('Empresa', …, 'group_id')` + `getFiltroContexto('group_id')` sobrescrevia `group_id` com UUID da empresa → lista vazia sem Editar.
Fix: `MASTER_GROUP_SET` em `useContextoVisual` (leitura só por groupId canônico) + `queryKey` `empresas-cadastro` com `groupIdCadastro`.
Testes: empresas-dialog-edit + contexto-multiempresa-policy **17/17**.
Branch `cursor/spa-ui-empresas-financeiro-clicks-392b` · PR **#249**. ≠ Codex #209 / outbox.

## CURSOR — paralelo SPA UI + Onda 3 sugestão UI (2026-10-08T17:06Z)

| Pacote | Branch | SHA tip | Estado |
|---|---|---|---|
| SPA UI + Caixa Button | `cursor/spa-ui-empresas-financeiro-clicks-392b` | `9b2c9b63` | **implantado** erp-dev · PR **#249** |
| Onda 3 sugestão vínculo UI | `cursor/comercial360-onda3-sugestao-ui-392b` | `ce99d428` | implementado; PR **#248** draft |

PR sugestão UI: https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/248  
PR SPA UI / Financeiro: https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/249

### Legado / destino erp-dev (contratos; sem reprocessar backup)
| Campo | Valor |
|---|---|
| **implantado tip** | **`9b2c9b63`** |
| main integrado | `6ff6b0f2` (#247) · contém #113/#246/#245 |
| contratos no destino | #231 snapshots · #226 Cadastros · #225/#246 Financeiro · #113 sugestão API · #203/#237 outbox · #239 troca empresa · #242 acesso VPS |
| snapshots públicos | ausentes |
| escrita títulos reais | proibida neste lote (só sintético/isolado) |
| rollback | `pre-spa-login-20261008-170810` |

Evidência: `docs/vps/evidence/browser-financeiro-caixa-08da3b8e-20261008.txt` · `docs/vps/evidence/browser-financeiro-pos-caixa-9b2c9b63-20261008.txt`.

## CURSOR — SPA UI empresas/financeiro implantado `677b1ab1` (2026-10-08)

| Fase | Estado |
|---|---|
| implementado | `11fd3510` |
| integrado | PR pendente (`cursor/spa-ui-empresas-financeiro-clicks-392b` → main) |
| **implantado** | `11fd3510` |
| auth `empresas[].cnpj` | **PASS** |
| /Empresas lista CNPJ | **PASS** |
| Financeiro cores CR≠Régua | **PASS** |
| seletor/Editar/close browser | PARTIAL (overlays Chrome) |
| rollback | `pre-spa-login-20261008-161558` |

Evidência: `docs/vps/evidence/browser-spa-ui-677b1ab1-20261008.txt`. ≠ outbox/legado.

## CURSOR — validação login API pós-secrets (2026-10-08)

| Fase | Estado |
|---|---|
| implantado | `68c311cc` (superseded por `677b1ab1` acima) |
| login API | **PASS** 200 (secrets Environment) |
| CPA/3Z IDs | CPA=`cccccccc-…` · 3Z=`c2c2c2c2-…` (mesmo group) |
| isolamento pedidos | **PASS** CPA 0 ≠ 3Z 3 |
| sugestao-vinculo #113 | **PASS** 200 + mescla proibida |
| browser UI Cadastros/Financeiro | ver seção `677b1ab1` |

Evidência: `docs/vps/evidence/browser-api-login-68c311cc-20261008.txt`.

## CURSOR — #113 Onda 3 sugestão vínculo (2026-10-08T15:09Z)

| Fase | SHA |
|---|---|
| implementado | `502122bc` |
| **integrado** | `68c311cc` MERGED #113 |
| **implantado** | `68c311cc` VPS |
| validado rota | `GET .../sugestao-vinculo` → **401** sem token (não 404) |
| validado CPA/3Z browser | BLOCKED `ERP_DEV_LOGIN_*` |

Evidência: `docs/vps/evidence/deploy-113-main-68c311cc-20261008.txt`. Rollback `pre-spa-login-20261008-150832`.
Contém também #246 Financeiro UX + #245 nginx 404-all.

## CURSOR — #246 integrado+implantado `64301fdb` (2026-10-08T15:01Z)

| Fase | SHA |
|---|---|
| implementado | `3faa46ff` |
| **integrado** | `64301fdb` MERGED #246 |
| **implantado** | `64301fdb` VPS rebuild |
| validado health/snapshots | sim |
| validado CPA/3Z browser | BLOCKED `ERP_DEV_LOGIN_*` |

Evidência: `docs/vps/evidence/deploy-246-main-64301fdb-20261008.txt`. Rollback `pre-spa-login-20261008-150055`.

## CURSOR — fases #245 reconciliadas (2026-10-08T14:52Z)

| Fase | SHA | Nota |
|---|---|---|
| implementado | `542be525` | nginx regex 404 |
| **integrado** | `dd6c211d` | MERGED #245 → main |
| **implantado** | `dd6c211d` | VPS rebuild pós-merge |
| validado health/snapshots | sim | 404 `base44-local-*.json` |
| validado CPA/3Z browser | **não** | secrets login ausentes |

Evidência: `docs/vps/evidence/reconcile-245-main-vps-dd6c211d-20261008.txt`.
Rollback: `pre-spa-login-20261008-145118`.

## CURSOR — #246 Financeiro scope + stale cancel (2026-10-08)

| Fase | Estado |
|---|---|
| implementado | `cancelFinanceiroQueriesOnScopeSwitch` + reset CR/CP/Caixa/Cartões/Conciliação/Lote |
| integrado | PR #246 (rebase main `dd6c211d`) — CI a correr |
| implantado | **não** (aguardar merge) |
| validado VPS browser | BLOCKED `ERP_DEV_LOGIN_EMAIL` + `ERP_DEV_LOGIN_PASSWORD` |

Testes focados empresa-switch **7/7**. ≠ outbox/legado/#245.

## CURSOR — estado vivo pós-validação (2026-10-08T14:25Z)

| Item | Valor |
|---|---|
| **implantado erp-dev** | **`542be525`** (branch #245 nginx 404-all; detached) |
| Anterior | `85049afd` (#243) — superseded |
| health/ready/web | **200** · RUNTIME-08B · supabase_user |
| Snapshots `base44-local-*.json` | **404** application/json (clientes/produtos/empresas/snapshot/core) |
| Browser CPA/3Z | **BLOCKED** — Environment sem `ERP_DEV_LOGIN_*` (pedido ao usuário) |
| Lote UX | `cursor/cadastros-financeiro-empresa-ux-392b` (rebase main; PR) |
| Legado destino | runtime **`542be525`**; contratos #231/#226/#225/#203/#237/#239/#242/#243/#245; **não** duplicar mapper; **não** vínculos sem prova |

> Seções abaixo com `implantado=9a277011` / `NONE` são **históricas**.

## CURSOR — Cadastros ↔ Financeiro ↔ empresa UX (2026-10-08)

Branch `cursor/cadastros-financeiro-empresa-ux-392b` · SHA `ec27b9f7` (base main). Gap: Financeiro sem scope `grupo:empresa` no queryKey/uniqueKey; CR/CP com seleção residual na troca; sem alerta sem contexto. Fix: `buildMultiempresaQueryScopeKey` + `buildFinanceiroTitulosScopeSwitchReset` em launchpad + tabs. Testes **47/47**. PR create **BLOCKED** (integration) — abrir: https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/new/cursor/cadastros-financeiro-empresa-ux-392b. ≠ outbox/legado. **Sem deploy VPS.**

## CURSOR — implantado erp-dev `542be525` (2026-10-08T14:24Z)

| Item | Valor |
|---|---|
| **implantado** | **`542be525`** · PR [#245](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/245) |
| Anterior | `85049afd` (#243) — superseded |
| Smoke | health/ready/web **200** · RUNTIME-08B · supabase_user |
| Snapshots `base44-local-*.json` | **404** JSON (clientes/produtos/empresas/snapshot/core) via HTTPS público |
| Rollback tags | `pre-spa-login-20261008-142359` (api+web) |
| Evidência | `docs/vps/evidence/deploy-542be525-snapshot-404-all-20261008.txt` |
| Browser CPA/3Z | **BLOCKED** sem `ERP_DEV_LOGIN_EMAIL`/`PASSWORD` |
| Legado destino | runtime **`542be525`**; sem mapper paralelo; sem vínculos sem prova |

> `implantado=9a277011` / `NONE` abaixo = histórico.

## CURSOR — validação pós-deploy + gap snapshots (2026-10-08)

| Item | Valor |
|---|---|
| **implantado erp-dev** | `85049afd` (main #243+#244) · web/api rebuilt ~14:12Z |
| health/ready :3080/:3081 | **200** ok/ready |
| HTTPS público | SPA 200; `/api/health`/`ready` 401 AUTH_REQUIRED (edge) |
| Snapshots canônicos | `/base44-local-snapshot.json` + `core` → **404** |
| Gap encontrado | `/base44-local-clientes|produtos|empresas.json` → **200 HTML SPA** (não JSON) |
| Correção | branch `cursor/spa-snapshot-paths-404-all-392b` (regex 404 todos `base44-local-*.json`) |
| Browser CPA/3Z | **BLOCKED** sem `ERP_DEV_LOGIN_EMAIL`/`PASSWORD` no Environment |
| Lote UX indep | `cursor/cadastros-financeiro-empresa-ux-392b` SHA `ec27b9f7` (PR a abrir) |
| Legado destino | erp-dev **85049afd**; sem vínculos empresariais sem prova; mapper não duplicar |

> Histórico abaixo com `implantado=NONE` / `9a277011` é **superseded** por esta seção.


## COORDENAÇÃO CURSOR → LEGADO — implantado=`9a277011` (2026-10-08 pós-deploy)

Chat: [ERP ZUCCARO - CODEX/CURSOR](bc-d973626e-1060-4071-a25a-6a549769392b)
Agente Legado: [Legado: versão implantada](bc-4427c136-a373-5bb6-83b8-ffa135fdb2d9)
PR: [#211](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/211)

| Campo | Valor |
|---|---|
| **Versão efetivamente implantada em erp-dev** | **`9a277011`** (não mais NONE) |
| Imagens | `erp-api-dev` / `erp-web-dev` rebuild **2026-10-08T13:34Z** |
| Smoke VPS | health/ready/web **200** · `auth.mode=supabase_user` · meta **ERP-RUNTIME-08B** |
| Snapshots JSON públicos | **AUSENTES** (SPA HTML fallback ~1958B; 0 arquivos no nginx) |
| Contratos no destino | #231 snapshots · #226 Cadastros Organizacional · #225 Financeiro · #203/#237 outbox · #239 troca empresa · #242 acesso VPS canônico |
| Main GitHub tip | pode estar à frente só em docs (ex. `f6ec95bc`); **runtime VPS = `9a277011`** |
| Flags Legado | `importAuthorized=false` · sintético ≠ importação · **não** alterar vínculos empresariais · mapper #48 intocado |
| Checksum 153440Z | **UNVERIFIED** neste Cloud |
| Contagens REAIS backup | **0** processadas neste agente |

**HUMAN_NEXT (Legado — PC com HD):** somente verifier host-local — sem re-export/CADESP/transferência; sem tratar teste sintético como importação:
```bash
bash scripts/legado/executar-verifier-host-local.sh
# ou: --reports-dir "D:/BACKUP ERP ANTIGO - CODEX/04_REPORTS"
```
Colar só `PASTE_TO_GIT_HOST_*` + JSON do verifier.

**#211:** `gh pr edit` costuma falhar neste token — Cursor/humano: título `legado: erp-dev implantado=9a277011 — verifier host-local`; corpo = tabela acima + flags + HUMAN_NEXT verifier.

### Histórico — versão implantada=NONE (pré-deploy, obsoleto)
Antes do rebuild 13:34Z a VPS ainda estava em NONE (SPA last-mod 2026-09-27; snapshots HTTP 200; deploy BLOCKED SSH/MCP). Superseded pela seção acima.

## CURSOR — validação pós-deploy `9a277011` (2026-10-08)

| Item | Resultado |
|---|---|
| Versão VPS | **`9a277011`** implantada |
| health/ready/web | **200** |
| HTTPS meta | RUNTIME-08B · supabase_user |
| Snapshots JSON | **ausentes** (HTML fallback 1958B; 0 arquivos) |
| Browser CPA/3Z | em andamento (agente) |
| Defeito tratado | nginx passa a **404** nos paths legados (não mascarar com SPA) |
| Parecer Codex | #236 `6581cfec` — APROVAR runbook (sem rewrite) |
| Evidência | `docs/vps/evidence/validacao-pos-deploy-9a277011-20261008.txt` |


## ACESSO VPS CANÔNICO (Cursor + Codex) — 2026-10-08

Contrato operacional: `docs/OPERACAO_DEV_VPS.md` § «Acesso operacional Cursor / Codex».

| Item | Valor no Git | Segredo |
|---|---|---|
| Host | `srv1982741` · erp-dev.cpaferroeaco.com.br | IP não versionar |
| Path | `/opt/erp-zuccaro` | `.env.erp.dev` só na VPS |
| SSH user | tipicamente `root` | nome do secret: `ERP_DEV_VPS_SSH_USER` |
| SSH key | pubkey + fingerprint no OPERACAO_DEV_VPS | privada: `ERP_DEV_VPS_SSH_PRIVATE_KEY` (Environment Secret) |
| authorized_keys | deve conter `erp-zuccaro-vps` na VPS viva | hPanel sozinho não basta |

**Regra:** após qualquer deploy/backup/rollback VPS → atualizar este HANDOFF + `docs/vps/evidence/` + push. Trocar de PC não exige reenviar chave no chat se o Environment Cursor mantiver os secrets.

## CURSOR — deploy erp-dev main `9a277011` (2026-10-08T13:35Z)

| Fase | Estado |
|---|---|
| integrado | sim (main `9a277011`) |
| **implantado** | **sim** — SPA/API rebuild em srv1982741 |
| validado VPS (browser CPA/3Z) | **pendente** hard refresh + login real |
| snapshots públicos JSON | **ausentes** (fallback HTML SPA; não os dumps) |

- Backup: `pre-gate-e-20261008-133238.sql` · 845186 B · sha256 `1f1b55b2…` · evidence `docs/vps/evidence/pre-gate-e-backup-latest.txt`
- Rollback: `erp-zuccaro-erp-api:pre-spa-login-20261008-133314` / `…-web:…`
- Evidência: `docs/vps/evidence/deploy-main-9a277011-20261008.txt`
- Contém: #231 #226 #225 #203 #237 #239

**HUMAN_NEXT browser:** abrir https://erp-dev.cpaferroeaco.com.br/ com hard refresh → login → CPA/3Z → Cadastros Empresas → Financeiro.

## CURSOR — UX troca de empresa fail-closed (2026-10-08)

Agente: [Comercial UX empresa-switch](bc-5656ace2-6ada-57dc-87dd-81e7868ccc0c)
PR: [#239](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/239) · tip pós-rebase main (#240)

- Gap: troca de grupo/empresa fechava form sem zerar seleção em massa / isSaving / formKey.
- Fix: `buildCadastroScopeSwitchReset` + effect `scopeKey` no VisualizadorUniversal.
- Testes: `cadastros-empresa-edicao-load` **15/15** · CI SUCCESS.
- ≠ outbox #237 / legado.

## HISTÓRICO — Legado versão implantada=NONE (obsoleto) (2026-10-08)

**Versão efetivamente implantada em erp-dev: NONE.** Main tem #231/#226/#225/#203/#237 no código; SPA last-mod 2026-09-27; snapshots HTTP 200; deploy BLOCKED (SSH/MCP). Legado: só verifier no PC com HD.

## CURSOR — pacote frentes paralelas (2026-10-08)

Chat: [ERP ZUCCARO - CODEX/CURSOR](bc-d973626e-1060-4071-a25a-6a549769392b)

| Fase | Main (#231…#237) | Deploy erp-dev | Legado |
|---|---|---|---|
| integrado | **sim** | código em main | scripts |
| implantado | **não** | **BLOCKED** SSH/MCP | não |
| validado VPS | **não** | snapshots HTTP 200 | N/A |

## CODEX Comercial — follow-up #226/#203 (2026-10-07T20:50Z)

Agente: [Comercial Cadastros Empresas](bc-55d5261f-d7a1-5e68-9b15-bd09a65ecb6a)

| Item | Estado |
|---|---|
| #226 ⊇ #227/#228/#229 | **SIM** · visual≡save Organizacional · merge `6dfd39d2` |
| #203 outbox | **MERGED** `2403586e` (tip `91675712`) · CI SUCCESS |
| #227/#228/#229 | **arquivar** (conteúdo em #226); close negado à integration — HUMAN close |
| Main | `2403586e` (#231+#226+#225+#233+#234+#203) |
| Deploy erp-dev | ainda BLOCKED VPS MCP |

## LEGADO — follow-up verifier (2026-10-07T20:50Z)

Agente: [Legado evidência ERP novo](bc-4427c136-a373-5bb6-83b8-ffa135fdb2d9)

| Campo | Valor |
|---|---|
| Estado | **BLOCKED** — execução real não avançou |
| Checksum | **UNVERIFIED** (`FOUND_EXPORT=NONE`) |
| Tentativa Cloud | `executar-verifier-host-local.sh` exit 4 `LEGACY_HOST_REPORTS_DIR_NOT_FOUND` |
| Host com backup | PC proprietário `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS` (não este Cloud) |
| Workers | 0 · sem `usePrivateWorker` |
| Contagens reais | **0** processadas |
| Sintético (≠ efetivo) | staging 8→4/1/1/2 · vínculos 3/4 |
| PR | [#211](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/211) tip remoto `66f0520f` |

**HUMAN_NEXT (único bloqueio):** no PC com o HD → `bash scripts/legado/executar-verifier-host-local.sh` → colar saída sanitizada · ou `cursor worker start` nesse PC.

Dados reais / credenciais: fora do GitHub.

## TRÊS PACOTES — integrado em main (2026-10-07T20:45Z)

Chat: [ERP ZUCCARO - CODEX/CURSOR](bc-d973626e-1060-4071-a25a-6a549769392b)
Main tip: `e2c51d84` (#231 + #226 + #225).

| Fase | #231 snapshots | #226 Cadastros | #225 Financeiro | Legado | erp-dev |
|---|---|---|---|---|---|
| implementado | sim | sim | sim | scripts/verifier | — |
| revisado | sim | sim | parcial (fluxo real local) | UNVERIFIED cloud | — |
| integrado | **MERGED** `c0efab11` | **MERGED** `6dfd39d2` | **MERGED** `e2c51d84` | — | código em main |
| implantado | **não** | **não** | **não** | não | **BLOCKED** VPS MCP timeout; workers 0; sem SSH neste Cloud |
| validado VPS | **não** — assets ainda HTTP 200 (~13.8MB / ~1.0MB) | **não** | **não** | N/A | RUNTIME-08B pré-promoção |
| dados reais | — | — | — | **0** (BLOCKED host HD) | — |

**Pendência concreta de implantar:** Hostinger VPS MCP `vps_virtual-machines_list` timeout (−32001); self-hosted workers = 0; sem chave SSH no ambiente Cloud. Autorização válida ≠ conexão efetiva.

**Arquivar (não mergear):** #227, #228, #229. Lote indep. Comercial: #203. Auth local #230 ≠ Auth VPS.

| Frente | Responsável | Próxima ação |
|---|---|---|
| CODEX Comercial | [bc-55d5261f](bc-55d5261f-d7a1-5e68-9b15-bd09a65ecb6a) | #203 outbox; confirmar arquive 227/8/9 |
| CURSOR | este chat | desbloquear VPS (MCP/SSH/worker) → backup → build/promover main `e2c51d84` → validar CPA/3Z + financeiro + snapshots 404 |
| CODEX Legado | [bc-4427c136](bc-4427c136-a373-5bb6-83b8-ffa135fdb2d9) | **BLOCKED** exit4 HD ausente; HUMAN_NEXT no PC com D: |

## TRÊS PACOTES ATÉ CONCLUSÃO — atualização (2026-10-07T20:40Z)

Chat: [ERP ZUCCARO - CODEX/CURSOR](bc-d973626e-1060-4071-a25a-6a549769392b)

| Frente | Responsável | 1ª ação | Estado |
|---|---|---|---|
| CODEX Comercial | [Comercial Cadastros Empresas](bc-55d5261f-d7a1-5e68-9b15-bd09a65ecb6a) | #226⊇#227/8/9 + #203 | **#226 MERGED** `6dfd39d2`; arquivar 227/8/9; #203 indep. |
| CURSOR | este chat | merge #231→#226→#225; deploy; validar erp-dev | **#231+#226 em main**; #225 rebase; deploy **BLOCKED** VPS MCP timeout |
| CODEX Legado | [Legado evidência ERP novo](bc-4427c136-a373-5bb6-83b8-ffa135fdb2d9) | executor PC com HD | workers 0; HD não no Cloud |

### Fases

| Fase | #231 | #226 | #225 | Legado | erp-dev |
|---|---|---|---|---|---|
| implementado | sim | sim | sim | scripts | — |
| revisado | sim | sim | parcial | UNVERIFIED | — |
| integrado | **sim** | **sim** | tip | — | parcial |
| implantado | não | não | não | não | MCP timeout |
| validado VPS | não | não | não | N/A | snapshots ainda 200 |
| dados reais | — | — | — | pendente host | — |

## CODEX — candidata #226 ⊇ #227/#228/#229 (2026-10-07)

Matriz: `docs/MATRIZ_226_CONTEM_227_228_229.md`. **#226 MERGED**. PRs a arquivar: #227, #228, #229.

## CURSOR — Financeiro #225 (2026-10-07)

- Rebase sobre main (#231+#226). Launchpad grant plano + fluxo ContaReceber A/B.
- Próximo: merge #225 → deploy → validar CPA/3Z e financeiro na VPS.

## CURSOR — 3 frentes + Financeiro launchpad (2026-10-06)

| Frente | Responsável | Arquivos quentes | Não tocar |
|---|---|---|---|
| Cadastros/Empresas | Comercial #226 **MERGED** | — | — |
| Legado | [Legado](bc-4427c136-a373-5bb6-83b8-ffa135fdb2d9) | verifier HD | CADESP |
| Financeiro | Cursor #225 | Financeiro.jsx, financeiroLaunchpadAccess.js | Cadastros tip |

## Checkpoint Onda 15 - limpeza outbox na troca de Empresa (2026-10-06)
- Branch `cursor/comercial360-onda15-outbox-claim-392b`: `ProdutoRelationsDamSection` zera variantes/equivalentes/mídia/métricas/dead-letter quando `empresaId`/produto/view faltam — fail-closed entre tenants.
- Teste estrutural em `tests/produto-pim-ui.test.js`. Sem publisher externo.
- Coordenação pacotes paralelos: Comercial = candidata/#219/#221 + ledger; Legado = export/CADESP/staging; Cursor = revisão #221 + outbox/DAM nesta branch. Não editar router/STATUS da candidata daqui.

## Checkpoint Onda 15 - PG concorrencia + consumidor prepared (2026-10-04)
- Branch `cursor/comercial360-onda15-outbox-claim-392b`: alem de claim/lease/projecao, E2E PG cobre claim concorrente, lease/executor antigo, retry→DL, isolamento A/A2/B e rollback; consumidor prepared fail-closed para external.
- Meta `outboxConsumerPrepared`. Env: `ERP_OUTBOX_CONSUMER_MODE` / fake outcome / channel flags (sem segredo).
- Divisao Cursor vs Comercial: ver secao de coordenacao na branch #202 (`docs/HANDOFF_ATUAL.md`); Comercial nao edita midia/outbox deste pacote.
- Bloqueado: publisher real, cron VPS, Auth, tip-port.

## Checkpoint Onda 15 - claim/lease + projecao allowlisted (2026-10-02)
- Branch `cursor/comercial360-onda15-outbox-claim-392b`: claim/confirm/fail/reprocess/discard/list/metrics + UI prepared; projecao allowlisted no emit e no FakeCatalogPublisher (rejeita custo/margem/ncm/URL).
- Rotas: GET outbox (+produtoId) + outbox/metrics; POST claim/process/confirm/fail/reprocess/discard.
- Bloqueado externo: publisher real, Storage/Auth/VPS, reconciliacao de canal.

## Resposta Codex ao contrato Cursor do canario - PR #34 secao 4 (2026-09-24)
- Fonte: PR #33 branch codex/comercial-360 em bfdfe834; PR #34 branch cursor/vps-hml-gate-c-legado-392b em e40a8a61. Main ainda ca417160. O Gate C foi marcado aprovado pelo Cursor com evidencias sanitizadas; isso NAO autoriza D/E/F, migration ou Auth novo.
- 1. EXPECTED_RUNTIME=ERP-RUNTIME-08B. `server/src/api/router.ts` fixa esse valor em `/api/v1/meta`. O default `COMERCIAL-360-V1` de `scripts/deploy/comercial360-canary.sh` esta incorreto para este candidato; antes do Gate D passar EXPECTED_RUNTIME explicitamente e ajustar o default em checkpoint validado. Revalidar meta na imagem da MAIN, nao confiar em branch.
- 2. `auth.mode=supabase_user` e requisito de aceitaçao, nao fato do DEV. `server/src/config/env.ts` permite configurar ERP_AUTH_MODE=supabase_user e exige SUPABASE_URL+SUPABASE_ANON_KEY; producao usa este modo por padrao e rejeita dev_headers. `requestContext.ts` valida Bearer no Supabase Auth e resolve `profiles.auth_user_id` ativo e escopado. O canario deve iniciar com configuracao local segura e o smoke deve verificar `/meta` + requisiçao autenticada real. Nao exibir env, token ou chave.
- 3. Gate E: aplicar somente migrations faltantes 016-024 da MAIN ja revisada, em ordem numerica pelo migrator canonico, numa janela autorizada com backup NOVO e rollback preparado. Dividir o controle em 016-017 (Orcamento/Pedido) e 018-024 (Produto/PIM/DAM/canais), conferindo contagens e invariantes apos cada fatia; falha interrompe e bloqueia Gate D. Nao usar API de todo o Comercial 360 sobre esquema parcial; `test:postgres` real (>0, 0 fail/skip) ao final, sem reaplicar 001-015. Nenhuma fatia esta autorizada ou aplicada agora.
- 4. Tag futura `erp-zuccaro-erp-api:comercial360-main-<MERGE_SHA8>` construida somente do SHA efetivamente mesclado na MAIN. Registrar MERGE_SHA, image ID/digest obtidos do build/inspect e prova do canario usando a mesma imagem; nao reutilizar SHA da branch. Digest/tag finais INDETERMINADOS ate merge e build; nao alegar imagem imutavel existente.
- 5. `auth.users=0` e dois profiles ativos sem `auth_user_id` tornam smoke Bearer impossivel hoje. Em gate Auth separado e autorizado, provisionar identidade de teste exclusivamente sintética no Supabase Auth self-hosted, vincular seu UUID a profile ERP sintetico ativo no Grupo/Empresa sinteticos autorizados, com permissoes minimas Orcamento/Pedido. Validar scope positivo e RBAC/tenant negativos. Token, senha, email e chaves somente no ambiente seguro; nenhum valor no Git/log/handoff. Depois revogar sessao/desabilitar identidade de teste conforme procedimento auditavel. Nao reutilizar automaticamente os dois profiles existentes sem provar que sao sinteticos.
- Coordenacao: Cursor revisa este contrato e as verificacoes Gate D/E na PR #34; Codex revisa requisitos da PR #33. Ordem sugerida: fechar/revisar PR #34 documental-operacional primeiro; revisar PR #33 e seu default de runtime; so entao decidir merges por revisao humana e atualizar SHA da MAIN. PR #33 segue draft, sem merge; 3080 continua R07B.
- Frente independente Cliente 360 esta somente no workspace local, sem push e sem CI deste codigo; testes focados passaram, suite completa e build local sofreram OOM. Nao apresentar o endpoint como disponivel no remoto ou na VPS.

## Contrato Cursor/deploy - preco por ClienteEmpresa (2026-09-24)
- API read-only: GET /api/v1/tabelas-preco/preco-cliente?clienteEmpresaId=<uuid>&produtoId=<uuid>&unidadeMedidaId=<uuid>&businessDate=YYYY-MM-DD. Resposta {data: ResolvedPrice|null}; 422 para query/campo invalido, 403 para RBAC negado/ator ausente, 404 seguro para vinculo ClienteEmpresa fora do tenant. Nao enviar tabelaPrecoId, groupId ou empresaId na query; estes ultimos vem do contexto autenticado.
- Backend: TabelaPrecoService consulta ClienteRepository.getEmpresaLinkById no mesmo Grupo/Empresa e usa tabela_preco_id configurada no vinculo, com fallback para tabela padrao autorizada. Produto especifico de outra Empresa nao resolve; mestre compartilhado do Grupo pode resolver. RBAC exige Cadastros.tabela_preco.visualizar e Cadastros.cliente_empresa.visualizar.
- Nenhuma migration ou variavel nova. Frontend HTTP de TabelaPreco permanece nao ativado como piloto; nao ligar na 3080 R07B. Orcamento/Pedido e seus snapshots de itens nao foram alterados. Futuro consumo exige preco efetivo no servidor, regra comercial de alçada/desconto e teste de nao retroatividade antes de habilitar a captura em vendas.
- PR #33 continua draft. Migrations 023/024 somente codigo/CI; gate DEV real segue separado da CI efemera. Nenhuma aplicacao de migration, seed, Auth novo, canario ou promocao neste checkpoint.

## Contrato Cursor/deploy - resolucao de preco (2026-09-24)
- Onda 2: TabelaPrecoService.resolvePrice permanece contrato interno, sem rota nova, flag HTTP, migration ou configuracao. Requer contexto autenticado groupId/empresaId, TenantGuard e RBAC Cadastros.tabela_preco.visualizar; input estrito aceita produtoId, unidadeMedidaId, businessDate opcional YYYY-MM-DD real e clienteEmpresaTabelaId opcional. Nunca aceitar tenant/ator do payload.
- Repositories PostgreSQL e in-memory resolvem somente Produto ativo do Grupo, compartilhado (empresa_id NULL) ou proprietario da Empresa em contexto, e Unidade ativa do Grupo. Tabela e item continuam sujeitos a vinculo empresarial, vigencia e estado. ID de tabela especifica nao deve ser exposto como escolha livre ao frontend antes de validar o vinculo ClienteEmpresa.
- Orcamento/Pedido nao foram alterados. Ao integrar, escolher tabela autorizada pelo ClienteEmpresa/canal, calcular no servidor e persistir snapshot imutavel do preco por item; nao recalcular vendas historicas a partir da tabela atual. Requer teste tenant A/B, fallback, vigencia, concorrencia e RBAC antes de habilitar HTTP.
- Migrations 023/024 estao somente no codigo/CI; nenhuma aplicada na VPS. Gate C ainda exige restauracao isolada, backup novo e precheck de porta/canario. Preservar API 3080 R07B e PR #33 draft.

## Contrato Cursor/deploy - Produto por canal (2026-09-24)
- PR #33 segue draft, branch codex/comercial-360. A migration aditiva 024_produto_canais_rascunho.sql e o CRUD canonico de Produto/canais estao no codigo/CI; nao aplicar na VPS sem gate aprovado, novo backup, teste de restauracao e precheck da porta isolada. A migration 023 tambem nao foi aplicada na VPS.
- API: GET/POST /api/v1/produtos/:id/canais, PATCH/DELETE /api/v1/produtos/:id/canais/:canalId. POST aceita somente canal, sku?, nome?, descricao?; PATCH aceita somente subconjunto nao vazio de sku, nome, descricao. Canal exige slug minusculo; status permanece RASCUNHO. DELETE e inativacao logica. Respostas 201/200, erros 400/403/404/409.
- Contratos: escopo vem exclusivamente do contexto autenticado Grupo/Empresa; Produto deve estar ativo e pertencer a Empresa, RBAC Cadastros.produto.visualizar/editar, auditoria na mesma transacao. Nao enviar groupId, empresaId, actorId, status ou preco no body. SKU e unico por Grupo/Empresa/canal, inclusive soft-deleted. CRUD nao aciona catalogo, outbox de publicacao, preco, estoque, fiscal ou integracao externa.
- Configuracao: nenhuma variavel nova. Produto HTTP continua opt-in/desligado na 3080; sem Auth real homologado, nao ativar VITE_ERP_HTTP_PRODUTO nem associar IDs legados. StoragePort/scanner/publicacao permanecem gates separados.
- Testes: service/in-memory, HTTP e PostgreSQL sintetico na suite existente. CI do novo HEAD deve confirmar backend/frontend e E2E PostgreSQL sem fail/skip antes de handoff operacional.
- Proximo deploy autorizado deve inventariar migrations reais, aplicar somente faltantes da MAIN aprovada, validar RLS/FORCE e smoke autenticado no canario isolado; 3080 so muda em gate de promocao explicito.

## Checkpoint vigente - Comercial 360 / Gate C (2026-09-23)
- Branch `codex/comercial-360`, PR #33 draft e sem merge; ultimo HEAD funcional antes deste checkpoint documental `c3df0c3ca0f95a4c27e21de7b91cb002fb154f53`. CI `35919084889` frontend/backend SUCCESS, incluindo PostgreSQL efemero. A CI nao homologa o DEV real.
- Migrations 001-022 existem no repositorio/CI; a evidencia agregada fornecida pelo usuario da VPS mostrou somente 001-015 aplicadas uma vez. Nao executar 016-022, seed, Auth novo, scanner, Produto HTTP ou canario sem gate especifico.
- API oficial 3080 permanece R07B/`dev_headers` conforme capturas fornecidas; backup SQL de 21/09 tem tamanho, hash e marcador de dump completo, mas nao teve restauracao comprovada. Imagem/container de rollback R07B preservados; 3086 estava livre no momento da consulta, sem autorizar implantacao.
- Gate C PARCIAL: comparar em leitura somente a conexao efetiva da API com uma conexao direta ao `supabase-db` por identidade do servidor/migrations, sem imprimir URL ou credenciais; confirmar restaurabilidade e backup atualizado no gate autorizado. Comparar apenas IP nao e prova suficiente.
- Orientacoes R08 abaixo sao historicas. Nao usar a secao antiga "Passo historico R08B" como ordem de execucao atual. Preservar PR draft, main e 3080 ate gate separado.
## Checkpoint vigente - Gate C, evidencia Web Console (2026-09-24)
- Captura do usuario mostrou `conexao_api_vs_supabase_db=MATCH` ao comparar `current_database()` e identificador do cluster PostgreSQL da API e do `supabase-db`. A divergencia anterior de IP era inconclusiva e nao deve ser usada para negar este resultado.
- Backup SQL de 21/09: 486969 bytes, SHA-256 calculado, marcador de dump completo; restaurabilidade ainda nao testada. Rollback R07B: container preservado/exited e imagem presente. Porta 3086 livre no instante da consulta; 3080 preservada.
- PR #33 permanece draft e sem merge. HEAD anterior `38bb311709673e87fd00c00e9a81d0c660c0bf6b`, CI `35985748032` SUCCESS; migrations 001-024 no codigo/CI, somente 001-015 evidenciadas na VPS. Gate C nao autoriza canario/migration: falta restauracao isolada, backup novo pre-implantacao e precheck imediatamente antes do uso. Auth novo, scanner real e Produto HTTP nao homologados.
- As secoes de 23/09 abaixo sao historicas e nao substituem este checkpoint.

## Gate C - precheck Web Console adicional (2026-09-23)
- Backup SQL de 21/09/2026 encontrado com 486969 bytes, SHA-256 calculado e marcador de dump completo; restauracao nao testada e backup atualizado ainda pendente para o gate autorizado.
- API oficial `erp-api-dev` running na imagem R07B; container de rollback R07B exited e imagem preservada. Porta 3086 sem listener nem container ativo no instante da consulta; 3080 preservada.
- Gate C segue parcial ate comparacao read-only da conexao efetiva da API com `supabase-db`. Nao iniciar canario, Auth novo, migration ou promocao com base apenas nesse precheck.

## Gate C - Web Console complementar (2026-09-23)
- Evidencia fornecida pelo usuario: API oficial 3080 na imagem R07B, health/ready 200; Auth/DB healthy; API e DB na rede `supabase_default`. Conexao da API reportou banco `postgres` e 15 migrations.
- Comparacao de IP retornou `api_usa_supabase_db=NO`; resultado e inconclusivo para identidade fisica por possivel proxy/IPv6/traducao. Nao declarar banco divergente nem Gate C aprovado ate comparar conexao efetiva e conexao direta ao DB.
- Backups de 20/09 e containers antigos de rollback aparecem preservados, sem verificacao de integridade/restaurabilidade. Porta 3086 nao apareceu em `ss` entre os filtros; 3080 segue oficial. Nao houve escrita VPS ou ativacao.

## Gate C prioritario - checkpoint de 2026-09-23
- PR #33 draft/mergeable no HEAD `750a4ab14854e184d6fb2fc8afef7f6e2094b277`; CI `35910005796` frontend/backend e PostgreSQL efemero SUCCESS. A CI do commit funcional `52167840` (`35909747751`) tambem passou.
- Evidencia VPS nao avancou nesta sessao: Web Console falhou antes de abrir (`helper_unknown_error: apply deny-read ACLs`) e nao ha ferramenta VPS interna disponivel. Banco efetivo da API, rede, backup e rollback continuam sem precheck atual; nao inferir Gate C aprovado.
- O bloco unico de leitura sanitizada foi entregue ao usuario. Nao executar Auth, scanner, Produto HTTP, migration ou promocao na 3080 ate gates separados.

## Gate C DEV - evidencia SQL agregada (2026-09-23)
- Web Console informada pelo usuario: `schema_migrations` possui `id`/`applied_at`; 001-015 cada 1x, 016-022 ausentes nas 15 linhas. `auth.users=0`, `profiles=2`, `groups=2`, `empresas=3`; ambos os perfis ativos estao sem Auth. Sem vinculos de grupo/empresa invalidos nas contagens.
- Nome do banco da API e `current_database()` nao visiveis na captura; identidade do banco da API ainda pendente. Gate C nao aprovado para Auth/canario: API oficial 3080 permanece 07B/`dev_headers`.
- Nenhuma escrita VPS realizada. Continuar somente leitura para banco/rede/backup/rollback; identidade sintetica e perfil requerem gate autorizado separado.

## Gate DEV parcial - 2026-09-23
- Web Console, conforme evidencia informada pelo usuario: API oficial `erp-api-dev` em 3080, imagem `runtime07b-main-ca0bc5f3`; health/ready 200; meta `ERP-RUNTIME-07B`, `auth.mode=dev_headers`.
- MCP Hostinger confirmou VPS `srv1982741` running e Supabase Auth/DB/Storage healthy. Nao ha evidencia SQL de migrations nem dos vinculos de profiles nesta sessao.
- Gate C ainda nao aprovado. PR #33 segue draft; codigo Auth novo nao foi implantado/homologado. Nenhuma acao de escrita na VPS, 3080 preservada.
- Consultas agregadas e gates condicionais constam em `COMERCIAL_360_V1_DEPLOY.md`.


## Checkpoint Comercial 360 - 2026-09-23 (PR #33 draft)
- Branch `codex/comercial-360`; referencia comprovada antes deste checkpoint: `865e23d29ed72d6b00180fc52a4bde572f85c864`; CI `35873286965` verde com PostgreSQL efemero. A `main` e a VPS nao foram alteradas aqui.
- Migrations 001-021 existem no repositorio. Orcamento/Pedido iniciais e Produto/PIM/DAM/Auth estao preparados em codigo; Produto HTTP desligado e midias em QUARENTENA. Nenhuma aplicacao real das migrations 016-021 foi comprovada.
- Gate C DEV ainda sem auditoria VPS verificavel nesta sessao: MCP Hostinger nao expos ferramentas VPS e Web Console falhou antes de abrir. Nao assumir estado atual da API 3080, Auth, PostgreSQL ou buckets a partir do historico abaixo.
- Proximo gate: auditoria somente leitura via Web Console/Hostinger VPS, saida sanitizada; depois homologacao controlada de Auth/perfis. Sem SSH, migration, seed, restart, bucket, ClamAV na VPS, promocao ou merge neste checkpoint.

# ERP ZUCCARO — Handoff atual

## Atualizacao Comercial 360 V1 - 2026-09-21

- Branch de trabalho: `codex/comercial-360`; PR aberta: `#33`; nao mesclada.
- Checkpoint funcional do frontend: `0040e994a8d4c3c3cdd417cc9502fa332c6b3567`; preparação de deploy validada: `3c96bb677aef9c5498842005a6a4a2dd3bc36de3`.
- CI final comprovada antes do fechamento documental: workflow PR `35667460162`, frontend/backend `SUCCESS`; migrate, seed sintetico e PostgreSQL E2E passaram.
- Orçamento e Pedido usam backend HTTP canonico, tenant Grupo/Empresa, RBAC fail-closed e auditoria transacional. Migrations novas 016/017 foram validadas somente no PostgreSQL efemero da CI.
- Preparacao de deploy: `COMERCIAL_360_V1_DEPLOY.md` e `scripts/deploy/comercial360-{canary,smoke,rollback}.sh`. Os scripts nao foram executados; rollback e dry-run por padrao.
- VPS permanece intocada por esta versao: API oficial 3080, migrations aplicadas, imagens, containers e backups continuam no estado operacional descrito abaixo. Proximo gate exige merge e autorizacao VPS separados.
Atualizado em 2026-09-20 após o diagnóstico definitivo do gate do ERP-RUNTIME-08.

## Referências

- Repositório: `viniciuszuccaro-creator/ERP-Zuccaro-codeX`.
- SHA funcional 07B: `ca0bc5f3529b9071fe80e58dae6aa966a9d6c740`.
- Um commit documental posterior, quando existir, deve ser registrado separado
  desse SHA funcional.

## DEV

- VPS: `/opt/erp-zuccaro`.
- API oficial 3080: `ERP-RUNTIME-07B`.
- Imagem: `erp-zuccaro-erp-api:runtime07b-main-ca0bc5f3`.
- PostgreSQL: migrations 001–015 aplicadas exatamente uma vez. As migrations 014 e
  015 são imutáveis e não devem ser reaplicadas manualmente.
- `013_tabelas_preco.sql` permanece aplicada uma vez.

O pós-promoção 07B foi aprovado. A API oficial, banco e VPS não são alterados
por esta documentação.

## Último runtime e agregados canônicos

O ERP-RUNTIME-07B está fechado. Os agregados relevantes são Produto, Cliente,
ClienteEmpresa, ClienteLocal, Obra, TabelaPreco, TabelaPrecoEmpresa e
TabelaPrecoItem.

TabelaPreco tem origem por Empresa, autorização N:N, padrão por Empresa e
referência específica nullable em ClienteEmpresa. A resolução é específica,
depois padrão, depois sem preço. Itens usam Produto + Unidade, valores
`NUMERIC(18,6)`, vigência no cabeçalho, soft delete, RLS, RBAC e auditoria.

## Frontend e rollback

`TabelaPreco.frontendHttp=false`; esse cutover não ocorreu.

Os rollbacks 06B e 06A estão preservados e não devem ser apagados.

## Diagnóstico do gate R08

As constraint triggers reais da 015 estão `DEFERRABLE INITIALLY DEFERRED` e a
barreira rejeita, no `COMMIT`, condição ativa sem parcelas, total de 99%, remoção
da única parcela e reativação sem parcelas. Os testes locais também comprovam o
rollback após cada falha.

O gate que registrou `INVALID_INSERT_EXIT=0` usava `docker exec` sem `-i`. Sem
stdin interativo, o heredoc do Bash não é encaminhado ao `psql`; o processo pode
encerrar com sucesso sem executar o `BEGIN`/`INSERT`/`COMMIT`. A causa é, portanto,
o harness, não aceitação persistida da condição inválida. Com `ON_ERROR_STOP=1`,
um erro SQL em execução não interativa precisa resultar em status não zero.

## Hotfix de metadata R08B

O container temporário do R08B iniciou normalmente. O gate aguardava
`ERP-RUNTIME-08B`, mas `/api/v1/meta` respondia literalmente
`ERP-RUNTIME-07B`; o timeout do gate provocou o cleanup com `SIGTERM`. Não
houve crash nem OOM. O hotfix da branch altera somente a identidade de metadata
para `ERP-RUNTIME-08B` e declara `CondicaoPagamento` como preparado no backend,
mantendo `frontendHttp=false` e fora do piloto HTTP.

## Diagnóstico RBAC e E2E R08B

O `403` do smoke de Condição de Pagamento é causado por seed RBAC incompleto,
não por falha do canário: o actor usado no gate,
`a4a4a4a4-aaaa-4aaa-8aaa-a4a4a4a4a4a4`, pertence ao Grupo A e pode operar as
Empresas A/A2, mas não possuía `Cadastros.condicao_pagamento.visualizar`.
LIST e GET exigem essa mesma ação; as demais ações são `criar`, `editar`,
`inativar`, `restaurar`, `vincular-empresa`, `gerenciar-parcelas` e
`definir-padrao`. O seed idempotente foi corrigido somente para os dois actors
sintéticos A/B, com essas ações explícitas e sem wildcard.

A imagem runtime contém somente artefatos de produção, portanto `npm test`
dentro dela encontrar zero testes é esperado e não prova E2E. O mecanismo
canônico do próximo gate é `npm run test:postgres` no worktree exato do PR,
com dependências de teste efêmeras e `DATABASE_URL` fornecida apenas no
ambiente do gate. O runner falha sem `DATABASE_URL` ou se executar zero testes.

O primeiro E2E PostgreSQL real executou um teste e chegou ao banco. LIST/GET
autorizados passaram, e RBAC/cross-group permaneceram bloqueados. A falha
`SQLSTATE 23514` veio exclusivamente do payload de teste: ele enviava
`E2E-...` para `codigo`, enquanto a constraint exige seis dígitos. A constraint
funcionou corretamente. O hotfix reserva, dentro da transação rollbackável, um
código numérico livre entre `900000` e `999999`; API e schema já eram coerentes.

## Passo historico R08B (nao executar como proximo gate)

Registro de 20/09, superado pelo checkpoint vigente acima. No Gate VPS autorizado, repetir somente o E2E PostgreSQL real e concluir o
canário. O seed RBAC já foi aplicado e não deve ser reaplicado por este hotfix;
não reaplicar migrations. A API oficial 3080 continua R07B. Não
criar migration 016, não promover a API R08 e não fazer merge neste gate.

## CODEX — contencao dos snapshots publicos (2026-10-07)

- O proprietario autorizou retirar da versao atual os dois snapshots reais do ERP novo servidos por `public/` e preparar a limpeza do historico. O repositorio e publico; remover arquivos na HEAD nao elimina blobs de commits anteriores, caches, clones nem artefatos ja implantados.
- Branch `codex/remove-public-erp-snapshots`, baseada na main atual: remove os dois assets reais, desliga hidratacao automatica por URL publica, exige arquivo privado escolhido pelo usuario para recuperar somente em localhost e adiciona guardas contra reintroducao. Copias originais privadas foram preservadas fora desta worktree.
- A limpeza do historico NAO foi executada: inventariar refs/PRs afetados, congelar pushes, preparar copia recuperavel e janela coordenada; reescrita/force-push exigem decisao operacional separada antes de executar. Nao publicar dados, IDs, hashes ou credenciais no PR.
- Implantacao na VPS tambem e separada: antes de trocar imagem/build, conferir gates, backup, rollback e eliminar assets antigos da distribuicao/CDN. Nao presumir que merge remove arquivos ja servidos.
- Runbook separado: `docs/LIMPEZA_HISTORICA_SNAPSHOTS_PUBLICOS.md`. CI tip SUCCESS. Coordenacao Cadastros #226 tip `7bfd3f93` (port #229 completo).

## CODEX — divisao atual autorizada (2026-10-10)

O proprietario autorizou executar Comercial 360 neste chat em workspace/branch
separados, mantendo Cursor revisor. Retomar #265 sobre base atual #261,
preservando #264. Legado segue em `legado-piloto-20261010`, branch #266;
Comercial tera workspace proprio. Nao editar branches Cursor.
Complemento #266 revalida origem/Grupo, contrato e classificacao antes de retry;
25 testes focados PASS. Fonte `04_REPORTS` segue negada pelo SO mesmo com
permissoes amplas da sessao; piloto real/importacao ainda nao executados.

Checkpoint base: db89aa45 incorporada; runtime legado idêntico ao 661f3ef3 testado, revisao/CI do merge requeridas. Comercial ja executa aqui em workspace separado com autorizacao do proprietario.

Checkpoint posterior: 03_STAGING legivel; 04_REPORTS permanece negada. Somente
dry-run privado de transformacao (20 Clientes/20 Fornecedores mapeados;
20 Produtos em quarentena), sem carga/persistencia. Recuperados/importados 0.
Aliases SQL incorporados ao mapper existente, 27 focados PASS. Origem/destino,
classe/unidade e vinculo juridico exigem revisao/validacao antes do piloto real.
Dados e arquivos privados nao acompanham commit; evidencias somente agregadas.

Checkpoint corretivo da revisao Cursor 6100174767: operacao exige codigo legado
juridico e empresa identica ao crosswalk; opcoes nao substituem empresa de origem.
Produto grava tipo_item canonico (chave/rotulo explicitos normalizados sem default).
Duplicata em quarentena recebe auditoria. 30 focados PASS, lint/audit/build/diff PASS.
Suite Windows completa com Git Bash foi interrompida apos travar no teste
vps-gate-precheck; nenhum teste removido/skip. CI Linux final e revisao exigidas.
## CODEX — catálogo classe/unidade e continuidade (2026-10-11)
Workspace legado separado, responsável Codex, branch codex/legado-catalogo-classe-unidade-20261011 sobre a PR #266, HEAD cb3af26e. Reutiliza mapper e policy existentes: catálogo agregado de classe/unidade preserva códigos, diferencia pares ambíguos, reconcilia contagens, exige mapa explícito/tipo canônico e unidade ativa no mesmo Grupo. Não libera uso empresarial de Produto nem interpreta catálogo como importação. 32 testes focados PASS/0FAIL/0SKIP; lint/auditbaseline/build PASS. Testes de inventário Bash foram executados e falharam antes do script: NtCreateDirectoryObject/BaseNamedObjects/msys 0xC0000022; teste e asserts preservados, validação Linux CI obrigatória. Item inventário local BLOCKED somente por ambiente, não escondido como skip.
Fonte04_REPORTS: Get-ChildItem e Get-Acl retornam UnauthorizedAccessException; caminho original preservado. Nenhum dado real recuperado, nenhum piloto/importação operacional nesta rodada. Próximo: adapter/importador persistido canônico no destino isolado, procedência/idempotência/reversão, preservando Grupo/empresa fiscal; resolver fonte somente por acesso autorizado ou cópia equivalente comprovada.
Comercial em workspace próprio: #280 HEAD0a54be4a42b603e32717c4bf7db956388a5c9911 CI3738/run38137626838 SUCCESS frontend/backend; PostgreSQL real Marca2PASS/0FAIL/0SKIP e TENANT_CONTEXT4PASS/0FAIL/0SKIP, backend345/0/18 semURL. HTTP persistente/Auth/RBAC/rollback/concorrência implementados; Cursor solicitado6108793026, seloCI6108818394, revisão final pendente. Sem merge/implantação/grants operacionais; continuação do legado iniciou durante revisão, não apenas monitoramento.
## CODEX — piloto Cliente persistido em ambiente isolado (2026-10-11)
Responsável Codex, workspace legado, branch codex/legado-piloto-cliente-persistido-20261011 sobre catálogo #281. Adapter no consumidor existente chama ClienteService canônico, exige Grupo, procedência/lote/tipo explícitos e RBAC importar. Não implementa repositório/SQL paralelo, não concede empresa por default. Retry só reutiliza identidade/conteúdo/procedência equivalentes; divergência exige reconciliação sem sobrescrita.
Prova PGlite persistida com migrations canônicas e audit Postgres: carga no Grupo, código numérico separado do legado, consulta, repetição sem duplicar, edição/reabertura conservando campos/IDs, reversão por inativação preservando rastro, usuário restrito bloqueado e falha audit revertendo registro/sequência. 15 runtime04 PASS/0FAIL/0SKIP; 32 mapper/consumidor PASS; backend306PASS/0FAIL/18PGskips semURL, typecheck/build/lint/auditbaseline PASS. Lock de dependências idêntico ao workspace Comercial, reutilizadas cópias locais; junction negada, nenhuma credencial/config alterada.
Esta prova usa dados sintéticos e proprietário fixture do motor local, não homologa papel operacional, importação real ou PostgreSQL externo. Recuperados/importados reais continuam zero. Fonte04_REPORTS bloqueada por ACL; carga real exige procedência/equivalência/destino/backup/reversão comprovados. Próximo: completar piloto de Produto com catálogo/mapeamentos explícitos, adapter idempotente concorrente e PostgreSQL real isolado antes qualquer carga operacional.
Catálogo #281 HEAD2e8ef5bd: CI3750/run38137945017 SUCCESS; Cursor6108875441 confirmou36testesLinuxincluindo inventárioBash, sem alterações. Comercial#280 HEAD612c2055: CI3756/run38138199300 SUCCESS; revisão final do ajuste de filtros solicitada6108871480. Versão anterior0a54be4a revisada6108833920/CI3738/PG2zeroSkip. Sem merge/deploy/grants/migration/dados reais.
## CODEX — retry concorrente e PostgreSQL isolado do piloto Cliente (2026-10-11)
Responsável Codex; continuação do pacote #282, sem novo módulo. Consumidor resolve somente conflito DUPLICATE_DOCUMENT por leitura do vencedor equivalente, incluindo tipo, sem repetir escrita. Identidade inativa exige LEGACY_RECONCILIATION_REQUIRED e não é restaurada automaticamente. Prova comportamental adiciona duas importações concorrentes, identidade única e um único criador, divergência de tipo/lote e inativo preservado. Mesmo fluxo persistente executa em PostgreSQL real pelo runner obrigatório LEGACY_CLIENT, somente localhost/erp_test e schema isolado descartável; destino externo é rejeitado antes da conexão. Auth/RBAC nesta fixture continuam em memória e proprietário SQL: não homologa RLS/papel operacional.
Validação local: runtime04 16PASS/0FAIL/0SKIP, mapper/consumidor32PASS; backend307PASS/0FAIL/18skips preexistentes sem DATABASE_URL; typecheck/build/lint/auditbaseline/diff PASS. CI do novo SHA e parecer final obrigatórios. #280 HEAD612c2055 CI3756 SUCCESS, Cursor6108890985 sem bloqueio de código; #281 HEAD2e8ef5bd CI3750 SUCCESS/Cursor6108875441.
Bloqueio reproduzível do item identidade legado: codigo_legado repetido com documento diferente ainda não tem unicidade persistente canônica, conforme Cursor6108903880; não liberar carga real nem copiar contrato incompleto para Produto. Coordenação #2616108941232 solicita contrato canônico de mapa/procedência Produto (tipos/repositório atuais não possuem campos legado) e divisão de arquivos antes da extensão. Próximo pacote: identidade persistente por Grupo/fonte/código e reconciliação, preservando documentos e IDs; depois piloto Produto. Fonte04_REPORTS continua UnauthorizedAccessException em leitura e ACL; original preservado, recuperados/importados reais zero. Nenhum merge/DEV/grant/importação.

## CODEX — inventário único e equivalência privada de cópia (2026-10-11)
Responsável Codex, branch codex/legado-inventario-equivalencia-20261011 sobre #282 HEADd972179a. Extraído somente o motor Python inline do inventário Bash existente para inventario-backup-erp-antigo.mjs: Bash conserva descoberta, markers, classificações, agregados e relatório; Node permite mesma implementação em Windows. Não há segundo inventário/módulo. Corrigida leitura indevida antes da classificação: candidatos de credencial nunca são abertos/hasheados; sha256 nulo impede equivalência plena. ACL/arquivo alterado/symlink/arquivo especial falham fechados, sem manifesto completo parcial. Relatórios fora do original e criados sem sobrescrever, inclusive verificação de diretório canônico.
Comparação disponível via node scripts/legado/inventario-backup-erp-antigo.mjs --compare manifest-origem.json manifest-copia.json. Manifesta versão2, caminho relativo hasheado+bytes+SHA256: nomes iguais/contagem igual não substituem equivalência; alteração, falta, extra, segredo ou manifesto inválido bloqueiam. Não comprova significado/referências nem autoriza carga. Manifestos reais permanecem privados, nunca no GitHub. Diretamente em Windows, BACKUP_DIR/REPORT privados podem usar o mesmo motor Node sem Bash; não contorna ACL.
6 testes sintéticos PASS/0FAIL/0SKIP, lint/auditbaseline/build/diff PASS. Quatro testes Bash existentes preservados e exigidos na CI Linux; limitação MSYS local já reproduzida, nenhum skip artificial. #282 HEADd972179a CI3768/run38139225275 SUCCESS, PG LEGACY_CLIENT17/0/0; Cursor6109000425 confirmou correções. #280612c e #2812e8 continuam código revisado/CI verde, não integrados/implantados.
Próximos itens: contrato canônico de unicidade por Grupo/fonte/código legado (mesmo código com documento diferente continua bloqueio de importação) e extensão coordenada de procedência Produto; aplicar comparação somente a cópia privada cuja origem possa ser inventariada. Fonte04_REPORTS ACL negada, recuperados/importados reais zero. Nenhuma migration/DEV/segredo/dado privado neste pacote.

## CODEX — fechamento de resíduos do inventário #283 (2026-10-11)
Cursor6109059651 revisou HEAD6d9f8823/CI3773 SUCCESS, 10testesLinux/905frontendzeroSkip, sem bloqueio; resíduos tratados: hard links agora bloqueiam antes de hash, inclusive alias de candidato secreto; preservado marker NOTEblocked_secret_candidate, extensão final vazia vira sem_extensao e tamanho divergente de segredo conta changed e blocked sem abrir conteúdo. Novo teste exige hard link real, sem mock/skip. Windows negou fs.link EPERM tanto TMP quanto workspace autorizado: 7PASS/1falha de infraestrutura/0SKIP; asserts preservados, CI Linux final obrigatória. Lint/auditbaseline/diff PASS. Nenhuma leitura real além diagnósticoEPERM, fonte/backup original inalterados, recuperados/importados zero. Próximo independente já implementado: impedir escolha da primeira variante quando identidade de staging diverge dentro do lote; unicidade persistente entre lotes segue dependência canônica coordenada #2616109077892.

## CODEX — identidade divergente de staging sem escolher primeira variante (2026-10-11)
Responsável Codex, branch codex/legado-conflito-identidade-lote-20261011 sobre #283. Consumidor existente bloqueia todas as variantes da chave quando o mapper detecta conteúdo/documento/classe divergentes; fingerprint anterior não libera uma raiz contestada. Referências anteriores duplicadas com fingerprints diferentes também não escolhem a última referência. Reusos dependentes seguem em quarentena, sem sobrescrever ou mudar fonte; identidades independentes continuam comprovadas. Preservado teste Produto: prova positiva de classe/unidade/retry separada da prova negativa de lote divergente, sem eliminar asserts nem testes.
35mapper/consumidorPASS/0FAIL/0SKIP; pilotoCliente16PASS/0FAIL/0SKIP, lint/auditbaseline/diff PASS. Não substitui unicidade persistente entre lotes, não importa dados. Próximo contrato liberado pelo Cursor #2616109078451: identidade (group_id,source_system,codigo_legado) nos serviços/repos canônicos Cliente/Produto, migration043 somente sobre base038–042, índices parciais fail-closed, sem alterar001–042/ProdutoEmpresa/fiscal. Fornecedor sem módulo canônico server permanece quarentena, sem duplicação. Próximo pacote Codex inicia composição em branch própria após publicação deste lote; nenhuma carga/migrationDEV/deploy liberada. Fonte04_REPORTS segueEPERM; recuperação/importação realzero.


## CODEX — pacote CRM HTTP 040 (2026-10-10)

Workspace/branch próprios `comercial360-crm-http-20261010` / `codex/crm-http-canonico-20261010`.
Base c125c4db, descendente da candidata Cursor #261; main conferida baba91a6 ainda sem #261.
Numeração/ownership 040 reservados em6100290423; policy única extraída pelo Cursor em c125c4db,
importada do domínio server e reexportada pelo wrapper frontend. UI/store/C360 permanecem intactos.
Implementado: Oportunidade HTTP create/get/list/patch/inativar/restaurar, busca por ID legado,
vínculo de Orçamento existente (sem documento paralelo), códigos via reserveEntityCodigo,
idempotência, CAS/versionamento, histórico e auditoria no executor compartilhado.
Campos existentes preservados: descrição, responsável textual (não identidade de autorização),
previsão, próxima ação, interesse em produtos e orçamento informado pelo cliente. PATCH omitido/
undefined não limpa campos; null explícito limpa somente campo autorizado. Decimais como strings.
IDs legados e referências de Interacao/documentos não viram UUID fictício; legacy_store_id TEXT
é único por Grupo/Empresa. Sem backfill/importação/dual-write ou corte automático.
040: RLS/FORCE company-scoped, FKs compostas, sem grants PUBLIC. Grants das provas são fixtures,
não homologação DEV. ENABLE_CRM_HTTP=false por padrão; habilitação/corte exigem revisão, CI,
migration/grants/runtime homologados, backup/reconciliação/rollback e mapa de IDs/códigos.
10 testes locais focados PASS (inclui PGlite com papel NOSUPERUSER/NOBYPASSRLS).
Suite PostgreSQL real adicionada ao runner obrigatório com gate de banco isolado, sem skip flag;
prova concorrência/retry/CAS/rollback de auditoria/RLS e Cliente→Orçamento server-priced→CRM.
Migrations aplicadas/025–037/026 e branches Cursor não alterados. Nenhum deploy/VPS/canal neste lote.
Revisão do HEAD final e CI ainda requeridas. Não declarar CRM/onda implantados por esta preparação.

CRM 040 — evidencia de fechamento do runtime 0481e940: CI push3585/run38078234619 e
PR3586/run38078299051 SUCCESS frontend/backend. Runner nativo PostgreSQL R40CRM:
2 PASS/0 FAIL/0 SKIP, papel NOSUPERUSER/NOBYPASSRLS/NOLOGIN em schema isolado.
Backend local completo 317 PASS/0 FAIL/18 skips existentes sem URL; R40 real nao
adiciona skip e foi executado obrigatoriamente na CI. Evidencia sanitizada em
`docs/evidence/crm-http-040-pg-ci-20261010.txt`. Codigo permanece desligado por
padrao e sem cutover/deploy/migration operacional. Revisao final ainda requerida.
### CRM 040 — correção das ressalvas da revisão 6101234545
- A sequência de Grupo avança em INSERT/alteração de código mediante trigger SECURITY INVOKER, na mesma transação. Não lê oportunidades de outra empresa, não adiciona BYPASSRLS nem grants operacionais. A reserva existente permanece canônica; importações devem manter triggers habilitados e reconciliação/backup.
- Vínculo Orçamento preserva a referência anterior em legacy_orcamento_id, somente pelo serviço/contrato persistente; cliente HTTP não pode fabricar esse campo. Replay mantém referência e versão.
- Provas ampliadas: código fora da reserva na empresa A seguido de criação na A2; referência textual → vínculo UUID → replay. Runner PostgreSQL real obrigatório mantido, sem remoção de testes/skip.
- Flag, UI/store, migration DEV, importação e canais continuam desligados/pendentes. Novo HEAD requer revisão independente e CI próprias.

### Codex — CRM → Pedido canônico (2026-10-10)
Base #267 e3194fb1, branch codex/crm-pedido-integrado-20261010; coordenação de arquivos liberada por Cursor em6101860020. Reutiliza montagem/repositórios/serviços atuais, executor terceiro argumento e lock opcional quarto/default false. Sem UI/store/C360/policy paralela.
Vínculo de Pedido existente valida ClienteEmpresa, estado ativo EM_ABERTO, tenant/RBAC/audit, CAS e replay. Avança CRM já vinculado a Orçamento somente se Pedido aponta exatamente ao mesmo Orçamento; Ganho manual não permite contornar fechamento. Mantém orçamento e referências legadas separadas; não cria/edita documento, preço, produção ou estoque no endpoint CRM.
Migration040 continua candidata não aplicada; inclui legacy_pedido_id readonly HTTP. Nenhuma025–039 alterada, 026 permanece fail-closed. CI real R40 ampliada Cliente→Orçamento→Pedido pelos serviços atuais, preço snapshotado, replay concorrente e cancelamento sob lock; prova local SQL de auditoria/rollback/escopo. Fixture não homologa grants DEV.
ENABLE_CRM_HTTP permanece OFF. Merge/deploy/importação/corte dependem de revisão/CI/backup/reconciliação/runtime e grants. Sem carga de dados reais ou ativação de canais neste lote.

Decisão do proprietário: Pedido exclusivo por oportunidade e orçamento de origem obrigatório quando presente (2026-10-10). Implementação: oportunidade aberta não pode capturar Pedido vindo de Orçamento; avanço somente pela oportunidade vinculada ao mesmo orçamento. Lock canônico serializa disputa; consulta scoped e índice único de convertido_em_id impedem dupla associação inclusive após inativação. Não renumera referências legadas, não remove registros. Provas memória/PGlite/HTTP 11PASS; R40 real amplia disputa simultânea e rejeição SQL do segundo vínculo. CI/revisão novas exigidas, flag OFF.

### Codex — preflight estrutural CRM somente leitura
Branch codex/crm-preflight-operacional-20261010, base de conteúdo #2685a38a94e/local15c33065 (tree53fee243 igual). inspectCrmPreflight e crm:preflight reutilizam cliente DB atual; exigem destino explícito privado, transação READ ONLY no comando, não imprimem URL/nome/IDs/erros brutos. Verificam schema/ledger040, RLS/FORCE/policy única PUBLIC tenant exata, colunas legadas, trigger invoker ativo, índice exclusivo Pedido, grants mínimos e ausência de DML PUBLIC. Sem GRANT/ALTER/INSERT/cópia do store.
ready é apenas estrutural; activationAuthorized=false sempre. Não substitui backup, reconciliação/mapa legado, grants/RBAC operacionais completos, revisão, teste real e aprovação do corte. Flag/UI/store/C360 inalterados; nenhuma migration, implantação, importação ou canal executado. Provas PGlite adversariais e R40 PostgreSQL real no runner existente. Fixture registra ledger sintético de040 após aplicação no schema isolado; não cria evidência DEV.

CRM preflight agora cobre os dois estágios do handoff6102513877: CRM_PREFLIGHT_STAGE=before_migration confirma039 no ledger, ausência de040/objetos chamados oportunidades e recusa ledger posterior; after_migration (default) mantém verificação estrutural completa. Stage inválido é recusado antes da conexão. Nenhuma escrita ou ativação; quatro testes focados PASS/0FAIL/0SKIP. R40 real verifica que banco já com040 não passa pelo gate anterior. Antes de usar no DEV permanecem revisão/CI/destino privado e login Hostinger; não alterar dados enquanto isso.

Reprodução própria de falso positivo no preflight269: trocar trigger código por AFTER UPDATE mantinha gate verde. Corrigido para exigir nome, função invoker no schema esperado, BEFORE ROW INSERT+UPDATE, colunas codigo/group_id, sem WHEN ou argumentos e ativo. Provas PGlite e R40 real alteram só o schema sintético e restauram o trigger canônico; nenhum objeto DEV alterado. Quatro focados PASS; CI e revisão novas exigidas antes de uso operacional.

### Codex — Produto Grupo→Empresa→Orçamento/Pedido (migration041)
Ownership e numeração liberados por Cursor6102648260. Branch codex/produtos-grupo-empresa-20261010, base de conteúdo2698d806/local5a4bc9b4 com árvore igual. Reutiliza ProdutoRepository/ProdutoService e facade backend existentes; nenhuma implementação paralela ou edição de UI/store/facades reservadas.
041 cria apenas vínculo operacional explícito, com IDs/FKs Grupo+Empresa, RLS/FORCE, REVOKE PUBLIC, CAS/versionamento e auditoria. Sem backfill/default de habilitação. getById mantém filtro de empresa; getForOperation usa executor da venda, aceita mestre somente com vínculo ativo/habilitado e empresa Ativa, mantém locks compartilhados até commit. Produtos já pertencentes à empresa preservam comportamento anterior. Habilitação não modifica preço/estoque/master nem documentos gravados.
API GET/PUT empresa-operacao exige contexto empresa/RBAC explícito, nega wildcard/campos de tenant fabricados e valida payload. Flags ENABLE_PRODUTO_EMPRESA/CRM seguem OFF por default; dados apenas sintéticos. 326 backend PASS/0FAIL/18DB skips preexistentes sem URL; typecheck/build/lint/audit PASS. R41 preparado no runner PG obrigatório (execução CI pendente) para provar fluxo pelos serviços Cliente→Orçamento→Pedido, preço servidor/snapshot, replay, isolamento no papel sem bypass e revogação concorrente aguardando commit da venda.
Nenhuma001–040 alterada, 025–037/026 preservadas; 041 candidata não aplicada. Sem deploy/importação/ativação/canais/grants DEV. Gates/revisão/CI/backup/rollback/reconciliação operacionais ainda exigidos. Leitura inicial do console confirmou somente containers esperados; isso não equivale a identidade completa/homologação do banco.

Composição041: CI3617/3618 de362e6aed falhou em R41 com TENANT_FK_MISMATCH: produto outside scope. A validação de serviço havia sido ampliada, mas guards SQL016/017 ainda exigiam empresa_id no master. Corrigido somente na041 candidata: funções canônicas existentes preservam checks pai/unidade/produto próprio, adicionam ramo explícito master Grupo ativo + vínculo empresa ativo/habilitado + empresa Ativa, com FOR SHARE. Sem alterar001–040/026, ampliar policy, GRANT ou revalidar/regravar históricos. Reprodução PGlite via repositórios Orçamento/Pedido passou antes/depois de habilitação e bloqueou revogação/unidade incompatível. Nova CI/revisão do HEAD exigidas; falha anterior não ocultada, nenhum teste removido/skip adicionado.

### R41 — fluxo inteiro no papel restrito
Revisão Cursor6103117150 confirma composição041 no HEAD473608, mas teste de venda ainda usava conexão administrativa. Corrigido o harness R41: createApp recebe exclusivamente executor de dados com SET LOCAL ROLE NOSUPERUSER/NOBYPASSRLS e GUCs sintéticas por transação; afirma papel em toda query/transação do serviço. Setup e inspeção final permanecem administrativos, separados da venda. Grants/policies adicionais só no schema/role descartáveis da fixture, nunca DEV. Mantidos concorrência de revogação, preço servidor e preservação de snapshots, sem skip/remoção. Typecheck e 2focados PASS; PostgreSQL real/CI do novo HEAD pendentes. Nenhuma migration/grant/flag/implantação/importação operacional.

R41 amplia a mesma prova real restrita: falha sintética no INSERT de auditoria de Orçamento é injetada depois da persistência de cabeçalho/itens, e a transação deve devolver contagens de documentos/itens/audits exatamente ao baseline. Após retirar o trigger descartável, o mesmo fluxo deve criar/converter normalmente. Sem policy/grant/migration/código operacional novo. Typecheck/diff PASS; CI do novo HEAD requerida. UI Produto/facade continuam reservadas; coordenação6103195052 solicita divisão para ligar os contratos às telas existentes com provas de sessão/empresa/CAS/respostas tardias. Sem implantação/importação/ativação.

### Produto operacional — seleção canônica dos mestres habilitados
Lacuna reproduzível no pacote270: getForOperation autoriza mestre vinculado na venda, mas listagem cadastral da empresa o omite. Lote próprio codex/produtos-lista-operacional-20261010, baseado no conteúdo2700ea56046 (tree12c31319), evolui GET /api/v1/produtos?operacao=true sem módulo/facade paralelos. Reutiliza listPage/count/search/paginação; visão explícita exige empresa, flag ENABLE_PRODUTO_EMPRESA e RBAC visualizar sem wildcard, GUCs e executor. Só mestres ativos com vínculo alvo ativo/habilitado e empresa Ativa; produtos próprios ativos preservados. Cadastro sem operacao e getById permanecem restritos. Não oferece saldo físico, preço de canal nem habilitação implícita.
HTTP/PGlite focados2PASS, typecheck/build/diffPASS; R41 real ampliado para busca/código/total/página vazia/cross-company/revogação no papel restrito. Full backend/CI pendentes; nenhum skip removido/criado. UI/facade reservadas seguem intactas, coordenação2616103195052. Sem migrations, grants operacionais, backfill, implantação/importação/flags/canais. Rollback mantém visão padrão anterior; não altera vínculos/dados/snapshots.

Seleção operacional agora inclui detalhe por ID no mesmo GET existente: /produtos/:id?operacao=true usa getForOperation/executor/locks/RBAC sem wildcard, empresa/flag obrigatórias, 404 antes de habilitação/em outra empresa/após revogação; no-store. GET cadastral sem opção continua restrito, não amplia PATCH/edição nem estoque físico. Parse operacao reutilizado entre lista/detalhe, valores inválidos422. HTTP/PGlite2PASS/typecheck/diffPASS; R41 obrigatório amplia prova de detalhe no papel restrito junto com venda/lista/rollback. Novo HEAD/CI/revisão exigidos; UI reservada e DEV intactos.

### UI Produto — vínculo operacional empresarial no formulário existente
Ownership Cursor2616103195676 liberou somente ProdutoFormV22_Completo, extração sob produto/, GET/PUT empresa-operacao na facade preparada e testes existentes. Código Codex em branch própria, base2713260696e/tree78d46a8f. Não houve corte CRM/C360/store/seletores/Auth/policies nem ativação de Produto em HTTP_PILOT_ENTITIES/entities.Produto.
Formulário atual ganhou seção de mestre Grupo→empresa selecionada, com permissão visualizar/vincular-empresa separadas da edição do mestre. Reutiliza useCadastroFormScopeGuard/getHttpProdutoApi; flag Produto existente continua OFF. Grupo sem empresa não consulta/grava. GET404 específico admite vínculo inexistente/version0; PUT usa CAS/flags, sem dados de tenant no body. 409/503/ACK inválido bloqueiam gravação até consulta explícita, sem retry automático. Duplo envio, resposta tardia de empresa/sessão e callback de rascunho antigo não substituem estado atual; AbortSignal não é promessa de rollback de servidor.
Extração de seção/hook se justifica porque formulário existente excede600 linhas; nenhum módulo/rota paralelo. 89focadosPASS/0FAIL/0SKIP (facade, carga Produto, guards e sessão reais via harness existente), build/lint/diffPASS. Frontendtypecheck baseline1658 erros conhecidos, novas extrações sem diagnósticos; não dizer typecheckglobalverde. CI/revisão do SHA novo pendentes. Nenhuma migration/grant/VPS/flag/provider/importação/dado real alterado. Rollback retira seção/metodos aditivos, preserva cadastros/vínculos e API. Experiência DEV ainda requer bases/041/role, revisão/CI/backup/rollback e homologação.

### CRM preflight — falsos positivos de policy e ACL de coluna
Dois defeitos reproduzidos no gate próprio: GRANT SELECT(codigo)/UPDATE(status) TO PUBLIC sem grant de tabela passava; policy apenas RESTRICTIVE com mesmo predicado também passava. Ambos testes ficaram vermelhos antes da correção. inspectCrmPreflight agora exige polpermissive=true e inspeciona ACL de coluna além da tabela, sem escrever em DB. 5focadosPASS/0FAIL/0SKIP, backendtypecheck/build/diffPASS; R40 real ampliado no schema isolado com adulteração/restauração das duas condições. Sem remoção/skip de teste. CI/revisão do novo SHA exigidas.
Mudança restrita ao preflight e testes próprios, sem client/app/Auth/guard/policy/migration/grants operacionais. Restantes gates continuam: corpo de função/outros triggers/session_user/ledger/fonteSHA/cluster/grants/runtime não homologados; ready estrutural não autoriza ativação. UI272f2fda9c1 revisada6103389497/CIsverdes, semmerge/deploy. Ownershipruntime2616103431766 confirma arquivos livres para proposta; desenho coeso/revisão ainda necessários, não retirar BYPASSRLS às cegas. Nenhuma importação/dadosreais/VPS/flags/canais.

### Executor comercial — preço e referências na transação da venda
Ownership/proposta2616103480734 confirma lote próprio a partir2738d1d7242. Branch codex/comercial-executor-preco-20261010; mainbaba confirmado. Teste vermelho antes da correção comprovou SALE_PRICE_ESCAPED_EXECUTOR: TenantGuard do preço consultava pool mesmo recebendo transação.
TenantGuard/ProdutoRelationGuard e portas resolveSalePrice agora aceitam executor final opcional. TabelaPrecoService encaminha-o ao tenant, ClienteEmpresa e resolvePrice; Orçamento/Pedido encaminham o executor do callback ao preço e à unidade. Callback inicializa GUC com scope já validado por prepare antes de consultas. Getters PG genéricos respeitam terceiro argumento compatível (WHERE/mapeamentos/defaultpool preservados); não cria módulo/client/montagem paralela.
Prova local no papel restrito impede qualquer fallback ao pool, valida unidade/relação, vê habilitado_operacao=false ainda não commitado e rollback restaura vínculo. Fixture inicial de bloqueio foi ajustada para usar habilitação, mantendo intacto chk_cliente_empresas_bloqueio e migrations. Backend final328PASS/0FAIL/18DBskips existentes semURL, typecheck/build/diffPASS. R41 real ampliado bloqueia no pool queries de cliente_empresas/tabelas/itens/unidades; cria Pedido direto e Orçamento→Pedido com preço servidor, rollback auditoria/revogação/snapshots preservados. Fixture não injeta GUC no início de withTransaction: callback real da venda deve fazê-lo. CI/revisão do novoHEAD pendentes, sem skip/remover testes.
prepare/RBAC anterior à transação, Auth/policies/CRM/store/C360/client.ts/App/role bridge/custos configurados permanecem separados e não homologados por este lote. Sem grants/migrations/flag/VPS/importação/provedores/canais/dados reais. Não equivale a NOSUPERUSER/NOBYPASSRLS do login DEV. Rollback de código reintroduz leituras fora do executor; preservar snapshots e gates fechados. Reservas026/025–037 e IDs/códigos inalterados.


## CODEX — contexto transacional de tenant no runtime (2026-10-11)
Ownership2616103944107 e contrato2616104051728; base2743ec26ad8/tree0ec3fc05, mainbaba91a6 confirmado. Branch própria codex/runtime-contexto-tenant-20261011, client.ts/createApp existentes reutilizados, sem montagem/serviço paralelo.
Opt-in tenantContextEnabled defaultfalse, fronteira somente após Auth verificado e scopeMiddleware; headers de dev/public/session não instalam contexto. Auth/bootstrap continuam pool sem GUC. AsyncLocalStorage por DbClient/tenant congelado, query scoped em transação curta; withTransaction scoped única conexão/reuso aninhado/rollback-only inclusive erro capturado. Tenant diferente/vida HTTP encerrada/executor expirado rejeitados; ROLLBACK que falha descarta conexão. Sem contexto mantém pool.query e transações independentes anteriores.
5focados PASS; backend final/checks registrados na PR; runner PostgreSQL obrigatório ampliado com papel descartável NOSUPERUSER/NOBYPASSRLS, concorrência A/B/rollback/ausência GUC residual, sem remover R40/R41 ou aceitar skip. PostgreSQL real pendente CI deste HEAD. Config/Auth/policies/services/CRM/store/C360/migrations/grants operacionais intactos. Sem merge/implantação/roleDEV/flags/importação/providers/canais; não homologa bootstrap Auth com role restrito nem destino/grants operacionais. Próximo: reviewCursor SHA final, provar CI real e completar autorização operacional antes corte.


### CODEX — compatibilidade SAVEPOINT sem contexto (#275)
CI3652/run38101935170 expôs regressão real em R10C/R10: wrapper marcava rollback-only em erro SQL também fora do opt-in, impedindo ROLLBACK TO SAVEPOINT dos testes existentes. Corrigido somente executor: marca em erro SQL apenas no contexto tenant; bootstrap/default preserva recuperação SAVEPOINT. Não removeu/alterou R10, nem aceitou skip. Novo teste comportamental focused6PASS/0FAIL/0SKIP; PG tenant anterior2PASS/0FAIL/0SKIP, R40/R41 verdes na run falha mas não CI integral aprovada. Novo SHA/CI exigidos. Sem merge/DEV/role/grant/migration/flags.


## CODEX — bootstrap Auth separado do executor de dados (2026-10-11)
Ownership2616104480326, branch própria codex/runtime-auth-dados-20261011, base275f6fa8a8a/tree7ffb8998; mainbaba91a6 confirmado. Reutiliza createDbClient/createApp/index e somente dependency/3 encaminhamentos Auth na montagem existente; não extrai/reimplementa handlers reservados nem cria serviço/policy paralelo.
authDb opcional query-only, defaultdb compatível, segue exclusivamente middlewareAuth e GET/POSTauth/session. Repos/guards/readiness/dados continuam db. AUTH_DATABASE_URL opcional para conexão explícita separada; ENABLE_TENANT_CONTEXT defaultfalse exige splitAuth/supabase_user. Startup split verifica flags efetivas e session_user NOSUPERUSER/NOBYPASSRLS do dataDb e fingerprint database/schema/server address/port concordante, antes listen; falha sanitizada fecha ambas. Sem split preserva papel/default anteriores; shutdown encerra ambas.
4focados comportamentais PASS: config sem segredo/publicview, default/mismatch/roles/cleanup, headerfabricado401/bootstrapfora/dadosreadiness, GET/POSTsessão/enriquecimento somenteauthDb. ProvaPGreal no runner anterior ampliada com loginrole descartável NOBYPASS/NOSUPER e duasconexões/destino/rejeiçãoadmin; CI novoSHA obrigatória. GrantsAuth mínimos/RLSoperacionais/fingerprintcompleto/backupreal/credenciais externas ainda gates, não homologados pelo fixture. Não define nomes/credenciais/grants operacionais, não configuraDEV/retiraBYPASS/migra/ativa flags/providers/canais/importa. Próximo: reviewCursor SHAfinal/CI e homologação operacional separada.


## CODEX — Auth bootstrap RLS por identidade verificada (2026-10-11)
Ownership2616104786892 reservou042 e liberou intervenções pósprovider em requestContext/authSession/client. Branch codex/auth-bootstrap-rls-20261011 a partir2769dedeafb/tree2a2643b5, mainbaba confirmado. 001–041 imutáveis; 025–037 preservadas na outra linha, sem backfill/GRANT/role operacional.
042 adiciona somente policies SELECT por app.auth_user_id, profilesativosdoAuth, groups autorizados e empresas Ativas dentroprofileGrupo/filial; não usa true, não concede privilégios. Fixtures mínimos compartilhados só entre testes, reutilizando queries/serviços/montagem existentes; não cria serviço Auth paralelo.
withAuthIdentity no clienteAuth separado: UUIDvalidado pósprovider, transaçãoREADONLY/set_configtrue, semGUCGrupo nemtenantData. GET/POSTsessão e middleware preservam filtrosSQL/contrato e usamcontexto obrigatório apenas comAuthURLsplit; defaultúnico compatível. Startup split agora exigeAuthcurrent+sessionrole tambémNOSUPER/NOBYPASS, ambasconexões/destino básico conferidos. Papel/grantsreais externos não inventados nemaplicados.
Provas locais PGlite0422x/semgrantnega/owner2empresas/filial1/estrangeiro0/inativaomitida/updateAuthnega; contextoREADONLY/UUID/sem misturaData, suítessessãocompatíveis. PGreal obrigatório amplia runner com doisloginsrestritos, grantsSELECTcolunafixture, login/restore/provider/headerfake/filial/outrogrupo/inativa/RBACfailclosed/readonly/GUCresidual, R40/R41 preservados. Não equivale a grants/RLSoperacionais completos de vendas/auditoria; fixturescomerciais separados permanecem gates de homologaçãoDEV. CI/reviewSHAfinalobrigatórios antes qualquerintegration. Sem merge/migrationDEV/grant/role/flag/deploy/importação/providers/canais.

Validação deste lote: 12focados (042/contexto/split) preservados; full359testes/341PASS/0FAIL/18DBskips preexistentes semURL com --test-concurrency=4, typecheck/build/lint/audit/diffPASS. Primeira execução encontrou assert última migration041, atualizado adicionando042 e preservando ordem/assert041. Segunda npmtest padrão encerrou processo runtime05 sem diagnóstico; runtime05 isolado3/0/0 e suíte integral concorrência4 passou, sem alterar teste/script/skip. CI padrão no SHA final e PGreal obrigatórios, não afirmar aprovação do corte por prova local.


### CODEX — prova RBAC canônica na #277
CI3664/run38107896861 falhou na última assert nova: MarcaService.list legado verifica escopo e retorna200, não chama RBAC. Corrigida prova sem remover casos: Marca200 passa a controle positivo de Auth; Orçamento canônico exige403/PERMISSION_DENIED com mesmas identidade/empresa e permissões ausentes. Runtime/migration042 intactos. 12focadosPASS/0FAIL/0SKIP, typecheck/build/diffPASS; novoPG/CI/SHA/reviewobrigatórios. Lacuna granular da listagem Marca é baseline verificada e permanece para coordenação própria, não declarada resolvida por042 nem alterada neste lote. Sem merge/deploy/grants/flags.


## CODEX — RBAC granular de Marca (2026-10-11)
Instrução direta do proprietário substitui espera por parecer para implementar; branch própria codex/marca-rbac-20261011, base2778bc4fef2/tree39030847, mainbaba91a6 confirmado. Coordenação2616107615388; sem editar branch Cursor/TenantCrud genérico. MarcaService existente agora prepara tenant e exige Cadastros/marca visualizar/criar/editar/inativar com wildcard global negado, guard obrigatório na montagem e default ausente fechado. Mesmo repo/IDs/CRUD/soft-delete/auditoria; perfil owner já contém essas ações, nenhum grant aplicado.
Harness antigo passa a fornecer perfis explícitos por ação sem remover asserts de payload/CRUD/audit/isolamento/Auth. Novo teste bloqueia cinco operações sem permissões e com wildcard, filial no Grupo/outro tenant, sem persistência/auditoria indevida. Prova PG Auth existente mantém negativos e agora exige Marca403/PERMISSION_DENIED, Orçamento403 preservado. Focados13PASS/0FAIL/2skipsPGpreexistentes semURL; typecheckPASS; suíte integral/build/CI e reviewSHAfinal exigidos. Sem migration/grant/role/flag/DEV/merge/importação/canais. Próximo: composição real de papéis/Auth/dados/RBAC e autorização operacional, mantendo bloqueio de deploy somente correspondente; legado em ambiente separado.

Validação final local Marca: backend342PASS/0FAIL/18skipsPGpreexistentes(360), concorrência4; typecheck/buildPASS. CI padrão/PG obrigatório e revisão final ainda pendentes.


### Marca — alvo empresarial do payload
Review2786107672506 confirmou o corte e apontou ressalva reproduzível: empresa_id do body redirecionava escrita após RBAC apenas no contexto. Corrigido: contexto Empresa não muda alvo nem promove mestre Grupo; contexto Grupo revalida tenant e permissão no alvo. Preserva criação compartilhada Grupo/empresa_idNULL, IDs/campos/audit; teste troca mesmaGrupo/null sem escrita/audit adicional. 14focadosPASS/0FAIL/2PGskips preexistentes, typecheck/buildPASS; novoHEAD/CI/review exigidos. CI3670 verde aplica somente b30e32ea anterior. Sem merge/grant/migration/DEV/canais.



## CODEX — Marca persistência atômica (2026-10-11)
Responsável Codex, workspace Comercial separado, branch codex/marca-persistencia-atomica-20261011 baseada279a0ee2f19; coordenação2616108289838. Reutiliza MarcaService/PostgresMarcaRepository/marcaTypes/app/audit/sequence existentes; TenantCrud/migrations/branchesCursor intactos. create/update/softDelete com db.withTransaction, GUCs locais e executor compartilhado por tenant/RBAC/sequence/registro/audit; memória preservada semdb. Teste detectou INSERT/UPDATE foraexecutor (deadlockPGlite), corrigidos antes entrega. Prova persistente PGlitePASS1/0/0: falhaaudit reverte registro+sequência+edição, preserva campos/inativação. RunnerPG obrigatório inclui mesma prova em schema isolado/papel restrito; CI deve confirmar, fixture nãohomologaDEV. Auth/RBAC real composição279confirmadaCursor6108070467/CI3710, reposmemória apenasnaquelaprova. Novopacote semdeploy/migration/grants/flags/canais/importação. Próximo: integraçãoHTTPpersistente/concorrência/isolation e papeloperacional/destino/backup/reversão; legado separado,04_REPORTS ACLnegada e03_EXPORT_STAGINGconteúdonegadoconfirmados, nãoimportado.


### Marca — fechamento da prova persistente e HTTP
PR280 ampliada no workspace Comercial: list/get compartilham executor e contexto RLS com as permissões; leitura de escrita usa FOR UPDATE para proteger snapshot/auditoria e preservar campos concorrentes. Teste persistente cobre rollback de inativação/auditoria, reabertura com mesmo ID/código/campos, contagem de auditoria e edições concorrentes de campos diferentes. Aplicação HTTP canônica usa repos persistentes, provider sintético verificado, Auth separado SELECT-only NOSUPERUSER/NOBYPASSRLS e usuário visualizar sem editar; criação/consulta/edição/inativação/reabertura, token inválido e troca empresarial negada. Fixture usa SET LOCAL ROLE; prova de LOGIN real/identidade de startup permanece em TENANT_CONTEXT. PGlite local passa, mesma prova obrigatória no runner PostgreSQL real; CI/revisão do novo SHA exigidas. Nenhum grant operacional, merge, migration ou implantação.
Próximo responsável Codex: conferir PG real e parecer exato, corrigir achados; avançar importador/piloto legado separado enquanto revisão. 04_REPORTS permanece BLOCKED: Get-ChildItem e Get-Acl retornam UnauthorizedAccessException em 2026-10-11; original intacto, nenhuma recuperação/importação real declarada.

## CODEX — Identidade canônica do legado sobre Comercial 038–042 (2026-10-11)
Responsável Codex, workspace legado separado, branch codex/legado-identidade-canonica-20261011. Recebimento e primeira ação comprovados: Cursor2616109078451 liberou contrato/arquivos; composição local integra pais PR284 c13238605976b26b1635a1384fc1d8087812ec20 e PR280 612c2055aa9e1371ac902a8957205023655759fa, sem main/branch Cursor. Main baba91a6b0d5d626edd607b8cd3522927e1904ab revalidada. Preserva integração264 e migrations001–042; somente043 aditiva nova.
Cliente e Produto usam identidade (group_id,source_system,codigo_legado), índices únicos parciais, código numérico interno separado e metadados originais. Serviços/repositórios canônicos existentes: leitura por chave antes criar, permissão importar explícita sem wildcard, mestre Grupo, procedência imutável, divergência documento/chave ou identidade ambígua exige reconciliação. Memória preservada com mesma unicidade. Produto adiciona apenas metadados nulos, sem backfill, habilitação ProdutoEmpresa, classificação histórica, saldo ou grant. Fornecedor continua sem contrato persistente canônico; não criar módulo paralelo.
Provas sintéticas: identidade/retry Cliente, documento diferente com mesma chave, chave diferente com mesmo documento, concorrência Cliente e Produto, isolamento entre Grupos, papel SQL NOSUPERUSER/NOBYPASSRLS com policies somente fixture, RBAC importar negado, empresa não ganha uso automático, edição preserva código/procedência, falha de auditoria Produto reverte registro+sequência, migration idempotente e histórico duplicado preservado/DDL bloqueado. PGlite é prova local; runner LEGACY_IDENTITY exige PostgreSQL real isolado no CI e zero skip. Auth LOGIN real permanece prova da composição279; fixture não homologa privilégios/grants/destino VPS.
PR283 4f1e8e0/CI3779 SUCCESS/review6109194757 e PR284 c1323860/CI3782 SUCCESS/review6109219552 sem bloqueio de código. Fonte04_REPORTS continua EPERM por leitura .NET e Node autorizadas; original preservado. Nenhuma recuperação/importação real, merge main, migration DEV ou deploy neste lote. Rollback de código mantém colunas/metadados aditivos; não excluir dados para reverter.
Próximo pacote executável: adaptador persistente Produto no consumidor existente, classe/unidade comprovadas, consulta/edição/reabertura/reconciliação/idempotência/reversão em destino sintético isolado. Revisão do SHA final bloqueia apenas integração/implantação. Fonte privada e fornecedor bloqueiam somente os respectivos itens; históricos sem empresa continuam separados dos saldos.

Validação local final identidade043: backend348PASS/0FAIL/18skipsPGpreexistentes, typecheck/build/rootbuild/lint/auditbaseline/diffPASS; mapper+consumer35PASS/0FAIL/0SKIP. Asserts de ordem das migrations estendidos041→042→043 sem remover cobertura. Código ainda candidato, CI PG real e parecer do SHA publicado obrigatórios.

### Identidade043 — correção do parecer2856109470368
Fonte/código vazios ou somente espaços agora falham nos schemas canônicos de create/update antes de RBAC de importação, reserva, INSERT ou auditoria. null/ausente continuam compatíveis para cadastro não importado; códigos originais preenchidos preservados. Teste usa CPF sintético válido para provar o campo correto, não uma falha incidental de documento. PG/PGlite cobre Grupo/Empresa; memória cobre ausência de escrita/audit, unicidade create/update, consulta por chave e identidade ambígua. 34focadosPASS/0FAIL/0SKIP, typecheckPASS; CI3788 SUCCESS pertence somente407b04fe anterior, novo SHA/CI/revisão exigidos. Próximo piloto Produto preservado em branch própria durante correção.
## CODEX — Produto legado: piloto persistido e ciclo completo (2026-10-11)
Responsável Codex, workspace legado separado, branch codex/legado-produto-piloto-persistente-20261011 sobre PR285 HEAD1be11f748408288186e5c48a7a97916bbc1a8d5a/tree25a9231358a5e4e865eaf9c32977f0321d3749b0. Base285 CI3794/run38143891259 SUCCESS; LEGACY_IDENTITY3PASS/0FAIL/0SKIP PostgreSQL real+PGlite+memória, Cursor6109602523 confirmou fechamento das chaves brancas. Ownership/primeiraação2616109479716, sem editar branch Cursor.
Reutiliza consumidor legado, mapper/catálogo classe/unidade, ProdutoService/repos canônicos e UnidadeMedidaService existente. Adaptador exige mestre Grupo, importar e visualizar unidade explícitos, mapa revisado e unidade viva ativa no mesmo Grupo; mantém código original/ID legado/fonte/lote, código numérico interno e não habilita ProdutoEmpresa. Retry equivalente reaproveita ID; divergência, inativo, unidade inválida ou mapping fabricado exigem reconciliação, sem writeretry de falha audit.
Relação de unidade importada revalidada sob FOR SHARE e mesmo executor da criação/edição/audit; alteração empresarial continua isolada. Privilégio fixture mínimo SELECT + UPDATE(updated_at) somente para lock; teste comprova ausência UPDATE amplo/de nome. Nenhum grant operacional. PATCH existente permite reabertura exclusivamente ativo:true sobre inativo com editar+restaurar sem wildcard; campos preservados. PATCH ativo:false exige inativar; auditoria restore/soft_delete corresponde à transição. Sem endpoint/módulo/TenantCrud/migration nova.
36focados e35mapper/consumer PASS/0FAIL/0SKIP; backend completo351PASS/0FAIL/18skipsPGpreexistentes(369), typecheck/build/lint/audit/diffPASS. Provas: carga/consulta/edit/reabertura/reversão, idempotência/concorrência, mapa explícito, unidade inativa e snapshot obsoleto, RBAC/tenant HTTP, rollback de criação+sequência/inativação/restauração quando audit falha, procedência preservada, origem intocada e sem vínculos empresariais automáticos. RunnerLEGACY_PRODUCT obrigatório PostgreSQL real isolado com zero skip; CI/revisão do SHA publicado ainda exigidos, não reutilizar selo285.
Implementado/testado sintético; não integrado em main, implantado, homologado na VPS, recuperado ou importado real. Fonte04_REPORTS EPERM permanece somente seu bloqueio. Reversão por inativação mantém ID/código/referências/metadados; rollback de código não remove colunas/dados.
Próximo pacote executável: atomicidade de edição/inativação/restauração de Cliente existente, fechando ressalva285 de audit após escrita, mantendo executor/lock/RBAC e memória; provas de falha audit/concorrência/isolamento. Autorização contínua não libera merge/deploy sem gates/review/CI/backup/reversão.


Revisão Cursor do HEAD 32dd1355: mapa vivo, FOR SHARE, retry sem nova escrita e rollback de audit confirmados. Correção no ProdutoService: mestre importado não muda para empresa_id; reabertura exige editar+restaurar sem curinga global. ClienteService mantém o mesmo guarda antigo e segue no pacote separado. Sem DEV, grant operacional, endpoint ou migration.


## CODEX — Cliente: ciclo persistente atômico (2026-10-11)
Responsável Codex, workspace legado separado, branch codex/legado-cliente-lifecycle-atomico-20261011. Recebimento e primeira ação: contrato/arquivos liberados por Cursor2616109648417; base28632dd1355109fc18494cb13b648ce4e26755f224d, correção Cursor169b8e9174544ac8159cd0289b54153315e81fd3 preservada na composição sem sobrescrever a branch dele. PR286 CI3796/run38144210227 SUCCESS, LEGACY_PRODUCT2PASS/0FAIL/0SKIP no PostgreSQL real isolado do HEAD32dd; selo não cobre automaticamente a correção169b.
ClienteService e repositórios existentes compartilham executor, lock FOR UPDATE, mutação e auditoria na edição/inativação/restauração; falha audit reverte registro, campos e estado. Memória serializa transações e mantém rollback sem apagar operação concorrente bem-sucedida. Contratos opcionais compatíveis, endpoints e TenantCrud preservados. RBAC revalidado após preparo e dentro da transação; mestre importado permanece no Grupo mesmo com empresa válida. Auditoria negativa de documento duplicado continua fora da mutação e persiste após rejeição. Identidade/procedência/código/IDs e campos não editados preservados.
23focados PASS/0FAIL/0SKIP após composição da correção Cursor; backend anterior354PASS/0FAIL/18skipsPGpreexistentes, nova suíte completa em validação após delta. TypecheckPASS; build/lint/audit/diff obrigatórios antes publicação. Provas SQL isoladas no runner LEGACY_IDENTITY obrigatório incluem concorrência de campos, rollback audit em todas transições, isolamento/RBAC, lock sem executor rejeitado e nenhuma query de mutação fora do executor. CI/revisão do HEAD final ainda exigidos.
Implementado/testado sintético; não integrado em main, implantado, homologado na VPS, recuperado/importado real. Fonte04_REPORTS EPERM e Fornecedor sem contrato persistente canônico bloqueiam somente seus itens; nenhum dado privado publicado. Próximo pacote independente: reconciliação do piloto persistido Cliente/Produto por identidade, IDs/código/metadados e estado, sem considerar contagens equivalência, com relatórios sanitizados e testes de retry/reversão/divergência. Gates de merge/migration/VPS e backup/reversão mantidos.

Validação final após composição169b: backend355PASS/0FAIL/18skipsPGpreexistentes(373), 23focadosPASS/0FAIL/0SKIP, typecheck/build/lint/audit/diffPASS. Não remover skips locais nem aceitar skip na suíte PostgreSQL obrigatória de CI; publicação/revisão no SHA final pendentes.


## CODEX — Reconciliação do piloto persistido por conteúdo (2026-10-11)
Responsável Codex, branch codex/legado-reconciliacao-persistida-20261011, base PR287 HEADef4b14f2c8aa94ceed07a867905b50ef378c7e38/treeb9eacef0fe4cc65498f4a5de5bd86f989b225db6. Primeira ação: implementação no consumidor existente, ownership2616109905476; mainbaba91a6b0d5d626edd607b8cd3522927e1904ab revalidada. PR287CI3806/run38145720927SUCCESS frontend/backend; PostgreSQL real LEGACY_IDENTITY6PASS/0FAIL/0SKIP e LEGACY_PRODUCT3PASS/0FAIL/0SKIP. Revisão2876109845963 em andamento, não é autorização de integração.
Snapshot privado de Cliente/Produto preserva identidade, ID/código numérico, conteúdo canônico e ativo/inativo; reconciliação usa serviços canônicos existentes, Group-only e visualizar explícito sem wildcard. Chave duplicada/ID repetido/snapshot inválido bloqueiam antes leitura; erros de permissão não viram ausência. Identidade ambígua fica divergência explícita. Relatório público contém somente índice/entidade/resultado/campos e totais, nenhum valor/ID/nome/documento/fonte/lote; nunca autoriza importação por equivalência/contagem. Leituras por registro não são snapshot global, declarado no contrato. Campos opcionais ausentes e null são semanticamente equivalentes, compatível memória/PostgreSQL.
Provas em fixtures existentes: carga/consulta/idempotência/reabertura/reversão, alteração de campo com contagem igual, estado inativo, isolamento/identidade, RBAC, ambiguidades/ausências/entrada adulterada, origem imutável e relatório sem PII. LEGACY_IDENTITY/PRODUCT no runner real isolado permanecem obrigatórios sem skip. Não altera serviços/repos/TenantCrud/router/schema, não cria módulo paralelo. CI/revisão exigidos no SHA publicado.
Implementado/testado sintético; nenhuma recuperação/importação real, merge main, implantação ou homologação VPS. Fonte04_REPORTS EPERM permanece bloqueada; Fornecedor/históricos/saldos aguardam contratos/fonte/mapa comprovados. Próximo item liberado após revisão da composição: preparar preflight canônico de destino/privilégios/backup/reversão para piloto real privado; gates de acesso/dados não são liberados por testes de CI. Frente Comercial preservada, sem editar branches Cursor.

Validação final: backend356PASS/0FAIL/18skipsPGlocaispreexistentes(374), reconciliação6focadosPASS/0FAIL/0SKIP, typecheck/build/lint/audit/diffPASS. Cursor2876109845963/6109891677 aceitou HEADef4b14f2 com CI3806 e provas reais isoladas6/3/17 sem skip; revisão deste novo lote e CI próprio obrigatórias.


## CODEX — Preflight operacional: identidade do LOGIN (2026-10-11)
Responsável Codex, workspace Comercial separado, branch codex/runtime-preflight-login-20261011. Base PR280HEAD612c2055aa9e1371ac902a8957205023655759fa/tree82e8a17ad3d5fa2d3a9e3206e372cce2fad8530b, local4dfaf086; mainbaba91a6 preservada. Coordenação de arquivos2616109939369/6109949623 e primeira ação comprovada: teste vermelho reproduziu sessão privilegiada escondida por SET ROLE restrito que passava current_user isolado. Sem editar branch Cursor/serviços/TenantCrud/Auth handlers.
Preflight CRM existente consulta session_user/current_user e flags dos dois papéis sem devolver nomes/IDs. Gate requireRestrictedLogin explícito, obrigatório no CLI operacional, exige login efetivo igual à sessão e ambos NOSUPERUSER/NOBYPASSRLS. Falha identidade aborta antes de catálogo. Modo estrutural existente sem opção continua compatível e não homologa LOGIN. Nunca autoriza ativação: CLI mantém activationAuthorized=false e transação read-only. Nenhuma migration/grant/policy/credencial operacional.
Provas: teste vermelho→verde6focadosPGlite0FAIL0SKIP; fixture PostgreSQL real existente TENANT_CONTEXT ampliada com LOGIN real restrito e rejeição de sessão admin+SETROLE restrito. Não retira provas nem aceita skip na CI. Suite/checks locais em conclusão; CI/revisão do SHA final obrigatórias, não reutilizar aprovação280. Cluster/fonte/backup recuperável/grants/RLS/fluxo funcional VPS continuam gates separados; zero leitura de dados reais.
Frente Legado independente: #287 ef4b14f2 aceita Cursor6109845963/6109891677, CI3806SUCCESS, SQL real6/3/17 sem skip; #288 a25b4a27 reconciliação conteúdo/estado com CI3808SUCCESS, SQL real7/3 sem skip, revisão pendente. Fonte04_REPORTS EPERM e contratos/fonte fiscal faltantes bloqueiam somente recuperação/importação real. Nenhum merge main/deploy/carga nesta execução.
Próximo item: incorporar parecer exato da288 e deste preflight, preparar composição/inventário canônico e backup/reversão sob gates; não homologar VPS por CI. Pacote Código Marca/identidade/Cliente/Produto/reconciliação implementado em branches próprias, IDs/registros/azul/isolamento preservados.

Validação preflight local346PASS/0FAIL/18skipsPGpreexistentes,6focadosPASS/0FAIL/0SKIP/typecheck/build/lint/audit/diffPASS; CI3814 do289 em andamento.


## CODEX — Composição Comercial + piloto legado (2026-10-11)
Responsável Codex, workspace Comercial, branch codex/comercial-legado-composicao-validada-20261011. Primeira ação comprovada: merge de branches próprias preflight LOGIN b79d0d2d/remote289a88b70b8 e reconciliação36ca6cc1/remote288a25b4a27. Ambos ancestrais mantidos, não reintroduz integração254/261 antiga, não altera mainbaba91a6/branchesCursor. Conflitos somente STATUS/HANDOFF resolvidos preservando ambas frentes e capacidades; código compôs sem conflito.
Pacote reúne Marca atômica/RBAC granular, CRM canônico, Produto compartilhado, preço transacional, Auth/tenant 038–042, identidade043 e pilotos Cliente/Produto com reconciliação. Migrations001–042 imutáveis;043 candidata aditiva, nunca aplicada naDEV. Produto mestre não libera uso empresarial/estoque; grupo e empresa fiscal preservados. Fonte04_REPORTS EPERM bloqueia recuperação real, histórico sem empresa não vira saldo. Código/registro/ID/vínculo/audit e azul existentes preservados.
Prova integrada local/CI obrigatória no conjunto, sem remover testes/aceitar skips no PG real. Revisões285/287 jáaceitas;288/289 aguardam parecerexato, revisão desta composição também obrigatória. Sem merge main, implantação, grant, dados reais, providers/canais. Antes aplicação: destino e papel mínimos reais, backup recuperável, reversão, usuário proprietário/restrito e gates históricos026/estoque/fonte. CI não homologaVPS.

Validação integrada local: backend357PASS/0FAIL/18skipsPGpreexistentes(375), mapper/consumidor35PASS/0FAIL/0SKIP, typecheck/build/lint/audit/diffPASS. #288 a25b4a27 aceita Cursor6109927582 eCI3808SUCCESS, PGreal7/3sem skip. #289 a88b70b8 CI3814/run38146755162SUCCESS frontend/backend, parecer6109980852 ainda pendente. Apenas043 difere de migrations001–042 da base280; nenhuma aplicadaVPS. Próxima ação: revisar/validar CI do SHA composto e só então preparar gates de destino/backup/reversão com fonte privada comprovada. Nenhuma autorização por contagem nem remoção de capacidades.


## CODEX — Central Cliente 360 / CRM canônico (2026-10-11)
Responsável: Codex, workspace Comercial separado, branch codex/cliente360-crm-canonico-20261011. Base composição #290 HEAD e5b7bd7bb51c6c7486e48328fb5d35bbd4bd5e2a (CI3816/run38147017927 SUCCESS), main baba91a6 preservada; ownership anunciado a Cursor em #261 comentário6110035519. Não há confirmação de recebimento específica deste delta ainda; revisão independente do SHA final obrigatória.
Pacote implementado: Central existente recebe OportunidadeService canônico já montado pelo app quando ENABLE_CRM_HTTP=true; consulta somente oportunidades ativas do ClienteEmpresa da empresa atual, pelo serviço/RBAC/repositório existentes. Flag desligada mantém skipped/CRM_CANONICAL_HTTP_PENDING. 403 e falha parcial mantêm forbidden/unavailable/meta null, sem fallback para store legado. Projeção explícita exclui contatos, notas livres, atores e chaves de replay. crm_limit/crm_offset atravessam router/facade; painel azul existente mostra código numérico separado do ID técnico, etapa/status/valor e carregar mais. Paginação reinicia por cliente/grupo/empresa/ator/sessão; queryKey/AbortSignal/sem placeholder impedem reutilização tardia entre contextos.
Extração auxiliar clienteCentral360CrmProjection necessária à refatoração do agregador grande; não havia projeção CRM equivalente segura. Reutiliza OportunidadeService/list e o painel atual; nenhum módulo, endpoint, persistência ou TenantCrud paralelo. Serviços/policies CRM e Auth do Cursor não editados; app apenas injeta dependência existente.
Validação local: 6 testes HTTP backend e 26 frontend PASS/0FAIL/0SKIP; suite backend358PASS/0FAIL/18skips PG preexistentes antes da adição do teste persistido; teste persistido compartilhado PGlite2PASS/0FAIL/0SKIP; typecheck/build backend, build SPA/lint/audit/diff PASS. Mesmo contrato persistido executa também no R40 PostgreSQL real isolado obrigatório da CI, com repositório CRM sob NOSUPERUSER/NOBYPASSRLS, paginação/projeção/RBAC negado; fixture SET ROLE não homologa LOGIN operacional. CI do novo SHA e revisão pendentes até publicação/resultado.
Próximo pacote autorizado: prova de respostas tardias/revogação de contexto nos formulários próprios CRM, conforme inventário dos consumidores existentes; continuar em branch própria após este lote, sem alterar serviços CRM do Cursor. Legado: fonte04_REPORTS EPERM bloqueia apenas recuperação real; contratos/importador/pilotos/reconciliação sintéticos #288 já entregues. Nenhum merge main, implantação, grants, migração DEV, provider/canal, recuperação/importação real. Antes operacional: revisão exata, CI, identidade/privilégios do destino, backup recuperável, reversão e gates históricos026/estoque.
