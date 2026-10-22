# Legado → canônico — rascunho de mapeamento (somente sintético)

## Precedencia atual - 22/10/2026

A autorizacao posterior do proprietario permite staging privado remoto protegido
e lotes minimos fora do checkout no Codespace/Cursor. Gates/evidencias e bloqueios
atuais em [descoberta existente](LEGADO_BACKUP_DESCOBERTA_SOMENTE_LEITURA.md#preparacao-privada-vigente---22102026).
Nao ha transferencia ou importacao operacional autorizada automaticamente por
este documento. Reutilizar o mapeador e persistencia existentes; dados reais/
mapas/manifestos privados foraGit. Piloto PREPARED_NOT_AUTHORIZED e PAUSED.
Faixas de migrations/main/PR33 abaixo sao historicas e precisam revalidacao no
destino antes de operacao;045-049 nao devem executar automaticamente.

## Contrato e referencia historica preservados

**Status:** `CONTRATO DE STAGING SINTÉTICO / SEM IMPORTAÇÃO REAL`
**Onda:** 25 (bloqueada)
**Política existente (não duplicar):** `src/components/lib/migracaoErpPolicy.js`
**Inventário:** `scripts/legado/inventario-backup-erp-antigo.sh`

Este documento **não** autoriza importação. Serve para alinhar Cursor ↔ Codex
quando o inventário do HD externo existir.

---

## 1. Princípios

1. Cadastros Gerais / agregados PostgreSQL já canônicos são a fonte de destino.
2. Preservar `codigo_legado` / `legacy_id` / `legacy_code` / `lote_migracao`.
3. Destino inicial = `staging` (`MIGRACAO_DESTINO_STAGING`).
4. Conflito → reservar código interno novo + mapeamento; nunca sobrescrita silenciosa.
5. Strip de segredos via `stripSegredosMigracao` / `SECRET_MIGRACAO_KEYS`.
6. Dados reais fora do GitHub; testes só sintéticos.
7. Cliente, Fornecedor e Produto são mestres compartilhados no Grupo: `empresa_id`
   não é exigido nem preenchido por inferência da empresa legada. O código de
   empresa da origem permanece como procedência, não como autorização de uso.
   Operações e vínculos fiscais continuam exigindo empresa comprovada.
8. Produto exige mapa explícito `classe|unidade` para tipo e unidade canônicos;
   sem mapa fica em quarentena. Código legado igual com conteúdo divergente é
   conflito, não reuso nem sobrescrita.

---

## 2. Matriz origem → destino (hipótese até inventário)

Preencher a coluna “Formato/origem observada” **somente** após o inventário
somente leitura. Valores abaixo são **candidatos** do ERP canônico atual.

| Domínio legado (rótulo) | Destino canônico | Pré-requisito PG | Notas |
|---|---|---|---|
| Empresa / filial | `empresas` + `groups` | 001 | tenant raiz = group |
| Cliente / pessoa | `clientes` | 009 | documento único no grupo |
| Cliente×empresa | `cliente_empresas` | 009–010 | elegibilidade; sem crédito/preço improvisado |
| Endereço / local | `cliente_locais` + finalidades | 011 | sem finalidade OBRA |
| Obra / obra cliente | `obras` + `obra_empresas` + `obra_locais` | 012 | sem endereço duplicado |
| Produto / item | `produtos` (+ PIM/DAM na PR #33) | 006–008 (+018–024 na PR) | sem preço no master |
| Tabela de preço | `tabelas_preco` / itens / empresas | 013 | `codigo_tabela_legado` já existe no legado UI |
| Condição pagamento | `condicoes_pagamento` | 014–015 | |
| Orçamento | agregado 016 (PR #33) | 016 | só após Gate E |
| Pedido / venda | agregado 017 (PR #33) | 017 | snapshot preço/endereço |
| Conta pagar/receber | entidades financeiras existentes | staging + reconciliação | `PENDING_MANUAL_RECONCILIATION` |
| NF | NotaFiscal + reconciliação fiscal | staging | permissões `Fiscal.Migracao.*` |
| Código empresa legado `0` | **quarentena** (não propaga) | — | `avaliarQuarentenaLegado` |
| Vendedor | **não** criar `Vendedor` paralelo | Colaborador/Pessoa | bloqueado até identidade canônica |
| Contato / telefone | **não** inventar Contato2 | Pessoa canônica futura | PII |

---

## 3. Migrations e destino DEV (evidência atual)

| Faixa | Repo `main` | PR #33 | VPS (evidência Gate C histórica) |
|---|---|---|---|
| 001–015 | sim | sim | aplicadas 1× |
| 016–024 | não (ainda) | sim | **ausentes** |

Gate E (futuro, autorizado): aplicar **somente** faltantes da **main** pós-merge,
nunca da branch feature. CI efêmera ≠ DEV.

---

## 4. Campos de rastreio obrigatórios no destino

Reutilizar `stampMigracaoRecord`:

- `origem_migracao` = `erp_antigo` (ou lote_csv/planilha/nfe_xml)
- `lote_migracao` / `migration_batch`
- `codigo_legado`
- `destino_migracao` = `staging` até homologação
- `status_migracao` = `PENDING_MANUAL_RECONCILIATION` quando exigir conciliação

---

## 5. Chave idempotente (sintético)

Composição (alinhada ao Gate 18 / `migracaoErpPolicy`):

```text
group_id|empresa_id|origem_migracao|entidade|codigo_legado
```

Implementação local (sem HD/import): `buildChaveIdempotenteMigracaoLegado` e
`mapLegadoLoteSintetico` em `scripts/legado/mapear-registro-sintetico.mjs`.
Duplicata no lote → reuso; reconciliação via `buildReconciliacaoMigracao`.

## 6. Estado do piloto e próximos passos

Em 10/10/2026, a `main` do GitHub estava em `baba91a6` e o merge `861513cd`
da #264 era descendente dela em branch Cursor, ainda não ancestral da `main`.
Este lote parte de `861513cd` em branch Codex isolada, preservando #254/#261.
O HD foi detectado neste computador, mas a leitura de `04_REPORTS` foi negada
pelo sistema de arquivos. Nenhum relatório real foi extraído, carregado ou
publicado. A PR #211 mantém o verificador e staging isolado existentes; este
lote ajusta apenas o mapeador/consumidor canônicos já presentes no repositório.

Checkpoint posterior no mesmo dia: `03_STAGING` e legivel. Headers SQL
CODIGOCLIENTE/RAZAOSOCIAL/NOMEGUERRA, CODIGOFORNEC/CGCFORNEC e
CODIGOMATERIAL/CODIGOCLASSE/UNIDADE foram incorporados ao mapper existente,
com testes inteiramente sinteticos; codigo original e fantasia entram no
fingerprint. Os arquivos de origem privados permanecem completos e intocados;
o stub de transformacao nao representa carga completa de todos os campos.
Dry-run privado examinou 20 registros de cada entidade: Cliente 20 mapeados,
Fornecedor 20 mapeados, Produto 20 em quarentena por mapa classe/unidade ausente.
Nao houve persistencia isolada nem operacional: recuperados/importados = 0.
Referencia de destino existe no manifesto privado, mas nao foi revalidada nesta
rodada. Manifestos indicam extracao nova/hash verificados e origem SQL read-only;
linhagem historica, crosswalk de Grupo/Empresa e equivalencia de unidades seguem
nao comprovados. Nao tratar presenca de classe/unidade como autorizacao de uso.

1. Liberar leitura somente de `04_REPORTS` no host do HD e executar o verificador
   da #211 sem tocar na origem; manter `importAuthorized=false`.
2. Validar manifesto/procedência e mapa jurídico privado; conferir destino e
   backup restauro-testado antes de qualquer carga isolada de entidades reais.
3. Ensaio isolado: extração → transformação → deduplicação → carga → consulta →
   edição/reabertura → reconciliação → retry → reversão, com evidência sanitizada.
4. Separar históricos sem empresa identificada dos saldos operacionais e exigir
   validação fiscal/financeira para notas, títulos, parcelas, cartões e recebimentos.
4. Staging isolado só com gate Onda 25.

Revisao Cursor 6100174767: os tres bloqueios foram reproduzidos/corrigidos.
Operacoes rejeitam empresa divergente nas opcoes, exigem codigo juridico e
destino identico ao crosswalk (nao basta a chave existir). Tipo de Produto e
persistido em `tipo_item` com rotulo canonico; mapas explicitos aceitam chave ou
rotulo conhecidos via policy existente, sem default de Revenda. Toda duplicata
em quarentena recebe auditoria. 30 focados PASS; novo SHA/CI/revisao obrigatorios.

## CODEX — Identidade canônica do legado sobre Comercial 038–042 (2026-10-11)
Responsável Codex, workspace legado separado, branch codex/legado-identidade-canonica-20261011. Recebimento e primeira ação comprovados: Cursor2616109078451 liberou contrato/arquivos; composição local integra pais PR284 c13238605976b26b1635a1384fc1d8087812ec20 e PR280 612c2055aa9e1371ac902a8957205023655759fa, sem main/branch Cursor. Main baba91a6b0d5d626edd607b8cd3522927e1904ab revalidada. Preserva integração264 e migrations001–042; somente043 aditiva nova.
Cliente e Produto usam identidade (group_id,source_system,codigo_legado), índices únicos parciais, código numérico interno separado e metadados originais. Serviços/repositórios canônicos existentes: leitura por chave antes criar, permissão importar explícita sem wildcard, mestre Grupo, procedência imutável, divergência documento/chave ou identidade ambígua exige reconciliação. Memória preservada com mesma unicidade. Produto adiciona apenas metadados nulos, sem backfill, habilitação ProdutoEmpresa, classificação histórica, saldo ou grant. Fornecedor continua sem contrato persistente canônico; não criar módulo paralelo.
Provas sintéticas: identidade/retry Cliente, documento diferente com mesma chave, chave diferente com mesmo documento, concorrência Cliente e Produto, isolamento entre Grupos, papel SQL NOSUPERUSER/NOBYPASSRLS com policies somente fixture, RBAC importar negado, empresa não ganha uso automático, edição preserva código/procedência, falha de auditoria Produto reverte registro+sequência, migration idempotente e histórico duplicado preservado/DDL bloqueado. PGlite é prova local; runner LEGACY_IDENTITY exige PostgreSQL real isolado no CI e zero skip. Auth LOGIN real permanece prova da composição279; fixture não homologa privilégios/grants/destino VPS.
PR283 4f1e8e0/CI3779 SUCCESS/review6109194757 e PR284 c1323860/CI3782 SUCCESS/review6109219552 sem bloqueio de código. Fonte04_REPORTS continua EPERM por leitura .NET e Node autorizadas; original preservado. Nenhuma recuperação/importação real, merge main, migration DEV ou deploy neste lote. Rollback de código mantém colunas/metadados aditivos; não excluir dados para reverter.
Próximo pacote executável: adaptador persistente Produto no consumidor existente, classe/unidade comprovadas, consulta/edição/reabertura/reconciliação/idempotência/reversão em destino sintético isolado. Revisão do SHA final bloqueia apenas integração/implantação. Fonte privada e fornecedor bloqueiam somente os respectivos itens; históricos sem empresa continuam separados dos saldos.
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
