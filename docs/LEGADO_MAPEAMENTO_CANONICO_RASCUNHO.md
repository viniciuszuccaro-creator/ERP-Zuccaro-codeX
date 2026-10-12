# Legado → canônico — rascunho de mapeamento (somente sintético)

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

## CODEX — Preflight canônico do piloto Legado (2026-10-11)
Responsável Codex, workspace Legado separado, branch codex/legado-preflight-destino-20261011. Base #304 HEAD5e693bac35bf9406962898df6b944b0a89d72d34 CI3971SUCCESS/R40CRM7PASS/0FAIL/0SKIP; #264 ancestralidade preservada; mainbaba91a6 revalidada. Branch288 e Cursor preservados. Ownership261/6115757083 anunciado, recebimento não presumido.
Consumidor staging existente recebe inspecionarDestinoPilotoLegado, somente catálogos. Identidade restrita extraída do preflight CRM existente e reutilizada por ambos, sem duplicação nem exigir grants de CRM ao importador. Exige destino explícito, session_user=current_user e ausência literal de SUPERUSER/BYPASSRLS em LOGIN/papel efetivo; sessão administrativa disfarçada por SET ROLE bloqueia antes das relações. Checa Clientes/Produtos como tabelas reais, group_id obrigatório/empresa_id nullable, metadados de procedência, índice único parcial canônico Group/source/code, RLS/FORCE, grants SELECT/INSERT/UPDATE e ausência de PUBLIC em tabela/coluna. Não lê registros privados nem muda DDL/grants/migration.
Relatório apenas booleans/bloqueios, scope=grupo_schema_only, somente_leitura=true e aprovacao_importacao_operacional=false. Identidade do GrupoCPA, RBAC do ator, policies comportamentais, fonte equivalente, mapa classe/unidade e backup/restauração permanecem gates não homologados. Nullable não libera produto a empresa nem transforma histórico sem fiscal em saldo; persistência continua nos serviços existentes.
Local17focadosPASS/0FAIL/0SKIP e typecheckPASS; CI real LEGACY_IDENTITY obrigatório ampliado com LOGIN real, grants ausentes, PUBLIC em coluna, NO FORCE, índice/coluna ausente e destino divergente. Prova retira grants de Oportunidade na fixture e preserva readiness estrutural dos mestres, sem ampliar privilégios. CI/revisão SHAfinal ainda exigidas. Fonte04_REPORTS EPERM afeta só recuperação real; nenhum dado original/importação/VPS ou autorização operacional. Próximo: validar preflight privado do destino autorizado, fonte/equivalência e mapa comprovado; revisão bloqueia integração, não desenvolvimento independente.

## CODEX — Verificação privada de extrações disponíveis (2026-10-11)
Responsável Codex, workspace Legado separado, branch codex/legado-verificacao-extracao-20261011. Base #30569d64adbabe185a5fc4e822b370a87080ba76f92 CI3975SUCCESS/LEGACY_IDENTITY9/0/0; mainbaba91a6 e #264 ancestralidade preservadas. Ownership261/6115924363 anunciado, recebimento não presumido.
Diagnóstico real somente leitura: HD/pasta original localizados sem fixar letra,03_STAGING legível e04_REPORTS aindaEPERM. Manifestos existentes inspecionados apenas por estrutura/flags, sem valores/paths/identificadores publicados. A API assíncrona native de canonicalização retornouEPERM numa pasta autorizada; Node realpathSync resolve os mesmos paths e arquivos, com lstat/containment/link/ACL preservados, sem alterar permissões ou originais. Somente o novo verificador usa a canonicalização suportada; inventário original não foi afrouxado.
Engine de inventário existente recebe verifyPrivateExtractionFiles: contrato files[fileName,fileSha256,bytes], basename obrigatório, limite1000, duplicações/paths inválidos rejeitados pré-leitura; flags privadas e nenhum toque/import operacional obrigatoriamente explícitos. Bloqueia segredo/env/key/token, link/hardlink/tipo especial; mede estabilidade inode/tamanho/mtime/nlink durante hash; relata só índice/estado e detecta divergência/ausência/negação/race. Não expõe nomes, paths, hashes ou valores privados.
Execução privada sobre extração disponível: três arquivos verificados pelos bytes/hashes declarados, sem escrita. Isso NÃO comprova linhagem MDF/original, equivalência semântica, mapa classe/unidade, Grupo/fiscal/destino, recuperação ou importação. Relatório conserva sourceLineageVerified=false, originalBackupEquivalent=false, importAuthorized=false, imported=false. Não reconstrói por contagem.
Local2novosfocadosPASS/0FAIL/0SKIP; suíte inventário completa encontra restrições Windows/sandbox para Bash e hardlink (inclusive casos preexistentes), não retiradas/não transformadas em skip. CI Linux obrigatória executará todos os casos reais de links/Bash/byte comparison, além regressões frontend/backend/PG. Próximo: fechar CI/revisão e confirmar procedência/crosswalk/mapa privado antes do piloto canônico real; fonte04 bloqueia somente seu item. Nenhum backup original/dado privado no GitHub, nem mudança de ACL/VPS/importação/provider/canal.

## CODEX — Classe/unidade: ambiguidades sem first-winner (2026-10-11)
Responsável Codex, workspace Legado, branch codex/legado-classe-unidade-ambiguidades-20261011 sobre #3067ff3b87f CI3979SUCCESS. Mapeador/catalogo existentes reutilizados; nenhum módulo ou mapa paralelo. Pares contendo delimitador não consultam chave ambígua e ficam em quarentena, mapa herdado por prototype não é contrato explícito. Snapshot de unidades com ID duplicado não escolhe primeira ocorrência, bloqueia independentemente da ordem e preserva todas entradas. Sigla igual em unidade ativa do Grupo não infere identidade/conversão/quantidade ou mapeamento.
Provas sintéticas: colisão de duas tuplas na mesma chave, mapa herdado, duplicatas conflitantes/reordenação, ausência de mapa com sigla coincidente e entrada imutável. Contratos válidos próprios continuam tipando produtos; classe/unidade/código original preservados, nenhuma inferência REVENDA nem disponibilidade empresarial automática. Fonte real privada já revalidada #306: três arquivos conferem hashes declarados,04REPORTS EPERM, equivalência/linhagem original/mapa aprovado não comprovados. Não atribuir targets privados por contagem/sigla/ordem.
Local37focadosPASS/0FAIL/0SKIP antes do teste adicional de sigla; fechamento requer testes do pacote/CI própria/revisão. Nenhuma carga, recuperação/importação operacional, schema/grant/VPS/provider/canal ou alteração de originais. Próximo: comprovação privada de cruzamento classe/unidade com conteúdo/significado/referências e revisão do destino/backup, mantendo empresa fiscal comprovada e históricos sem empresa fora de saldos. Bot desabilitado não é aprovação; frentes/branches Cursor preservadas.


## CODEX — Procedência das referências da revisão de unidades (2026-10-11)
Responsável Codex, workspace Legado separado, branch codex/legado-referencias-revisao-unidades-20261011 sobre #307 afb4903f9c04057bdc3ed24982e9bdc72528733c CI3985SUCCESS. Main baba91a6 e ancestralidade #264 preservadas; ownership261/6116257960 anunciado, recebimento não presumido. Engine existente reutilizado, sem importador/mapa/módulo paralelo.
verifyPrivateUnitReviewReferences valida o manifesto existente sourceFile/apiSnapshotFile/reviewFile e hashes explícitos, import operacional=false e sigla não prova identidade. Busca privada limitada exige completude, não segue links, rejeita referências inválidas/repetidas e mais de uma ocorrência do basename (inclusive bytes iguais); nunca escolhe primeira. Cada referência única reutiliza verifyPrivateExtractionFiles: segredo/link/hardlink/tipo, hash e estabilidade durante leitura. Manifesto não declara tamanho: tamanho observado serve somente ao guard de estabilidade, não vira prova de extração. Saída exclusivamente índice/estado/booleans, sem paths/nomes/hashes/dados privados.
Diagnóstico privado reproduzível: source/apiSnapshot não estavam no diretório do manifesto, mas foram localizados unicamente em subpastas de03_STAGING. Nova rotina executada: scanComplete=true e três referências verified. Revisão CSV tem os campos de decisão; nenhuma aprovação explícita completa comprovada e import operacional continua false. Não inferir unidade por sigla/contagem, atribuir IDs ou transformar candidatos em mapa aprovado.04_REPORTS continua EPERM; nenhuma alteração de ACL/backup original. Bytes conferidos não homologam semântica/linhagem MDF/original, Grupo/fiscal/destino, recuperação ou importação.
Local quatro testes novos PASS/0FAIL/0SKIP: subpastas, hash divergente, duplicata idêntica, ausência, declarações inválidas, limites incompletos, segredo e mudança durante leitura. Checks de fechamento/CI/revisão do SHA final registrados na PR; restrições Windows/Bash/hardlinks e baseline typecheck não serão mascarados nem convertidos em skip. Nenhum schema/grant/VPS/dado operacional/provider/canal alterado. Próximo pacote: contrato de decisões classe/unidade sobre referências verificadas, significado e escopo explícitos; piloto real somente com mapa/identidade/RBAC/backup comprovados. Revisão pendente bloqueia integração, não implementação independente.


## CODEX — Decisões de unidade no piloto Produto canônico (2026-10-11)
Responsável Codex, workspace Legado separado, branch codex/legado-decisao-unidade-piloto-20261011 sobre #30825f0f830 CI3989SUCCESS, ownership261/6116295026. mainbaba91a6 e ancestralidade #264 preservadas. Reutiliza catalogarProdutoClasseUnidadeLegado e persistirProdutoGrupoLegado, sem outro módulo/mapa/importador, sem tocar TenantCrud ou branches Cursor.
Contrato de revisão existente integrado por revisoesUnidades opcional: source_unit_code textual exato preserva zeros, uma única decisão; approved_target_unit_id deve coincidir com mapa explícito, scope_verified/semantic_equivalence_verified/import_authorized exigem boolean true literal. Ausência de linha, duplicata mesmo idêntica, destino divergente, revogação, string/number truthy ou formato inválido bloqueiam comprovação. Catálogo continua exigindo unidade canônica única/ativa do Grupo; sigla/candidatos/contagens não autorizam. Nenhuma conversão de CSV truthy em aprovação. Caller sem revisão conserva contrato anterior, não vira homologação operacional.
Piloto recebe snapshot imutável da revisão antes de awaits e revalida criação e retry antes de consultar/reutilizar/gravar produto. Mutação tardia para liberar decisão não passa; RBAC granular importação/unidade e serviço canônico mantidos. Dados Grupo não ganham empresa/estoque por flag; mapa classe/tipo e disponibilidade empresarial continuam independentes. Flags de revisão representam decisão privada fornecida, não provam identidade Auth/RBAC/linhagem por si.
Local39focados frontend PASS/0FAIL/0SKIP e dois testes Produto persistido PGlite PASS/0FAIL/0SKIP; suíte canônica mantém carga/consulta/edição/reabertura/idempotência/concorrrência/inativação/reversão e rollback audit+sequência. Runner PostgreSQL real obrigatório ampliado: conexão LOGIN restrita própria com session_user=current_user, NOSUPERUSER/NOBYPASSRLS; negativas de revisão com snapshots de produto/seq/audit inalterados, retry revogado e resposta tardia. Nenhum teste removido ou skip artificial. Backend typecheck/build/lint e fechamento/CI final registrados na PR; infraestrutura local Windows/Bash e baseline FE typecheck preservados.
#308 comprova três referências privadas pelos hashes; ainda nenhuma decisão completa aprovada na fonte real.04REPORTS EPERM permanece só naquele item. Sem importação/recuperação operacional, migração/grant/VPS/provider/canal, ou alteração do backup original. Próximo: comprovar semântica/escopo das decisões reais e fonte original/crosswalk/destino/backup antes da carga operacional; aguardar revisão apenas para integração/implantação. Handoff final SHA/PR/CI na evidência da PR, sem loops de commit documental.


## CODEX — Unidade revisada: semântica na transação Produto (2026-10-11)
Responsável Codex, workspace Legado separado, branch codex/legado-unidade-semantica-transacional-20261011 sobre #309f96b03021c54f1f466dce42cdaac24baade70149 CI3995SUCCESS. Mainbaba91a6 revalidada, ancestralidade #264 preservada; ownership261/6116408992 anunciado, recebimento/revisão não presumidos.
Reutiliza catálogo, consumidor staging, ProdutoService, relation guard e repos existentes. Pequena policy domain/unidadeSemanticaPolicy.js necessária para compartilhar uma única comparação FE/BE (não havia equivalente; não é módulo paralelo). SnapshotUnidades usa wrapper de snapshot já existente: readOnlyTransaction=true, operationalImportAuthorized=false e records. Opcional e compatível; quando fornecido exige decisão explícita de unidade, uma referência única e significado atual igual ao revisado: ID/Grupo/empresa/sigla/nome/grandeza/base/fator/atividade/conversão/usos. Fator positivo comparado lexicalmente sem Number/rounding: 1 e1.000000 equivalentes, diferenças decimais mínimas rejeitadas; nenhuma quantidade transformada. Datas/códigos auxiliares não substituem semântica. Snapshot/decisão não provam linhagem ou autorização operacional por si.
Piloto captura snapshot antes de awaits. FindByLegacyIdentity recebe executor opcional compatível e, com snapshot esperado, usa transação e guard para revalidar retry. Create revalida significado sobre unidade FOR SHARE com o mesmo executor do código/registro/auditoria; lock permanece até commit/rollback. RBAC granular criar/importar (e visualizar no retry) é revalidado com executor no novo caminho semântico; revogação tardia bloqueia antes do registro/sequência/auditoria. Mudança após leitura ou entre retry ausente e create retorna LEGACY_UNIT_SEMANTICS_CHANGED sem registro/seq/audit parcial. Guard memória preserva comportamento anterior e aceita metadados semânticos explicitamente registrados; não inventa equivalência quando ausentes. Não modifica TenantCrud, migrações/grants/HTTP payloads, isolamento ou branches Cursor.
Local40frontend focados PASS/0FAIL/0SKIP e3Produto PGlite PASS/0FAIL/0SKIP; typecheck/build backend e empacotamento da policy em dist/domain verificados. Provas adicionadas preservam carga/consulta/edição/reabertura/idempotência/concorrrência/reversão/rollback existentes e verificam snapshot divergente, fator/grandeza/base/empresa/usos, mudança entre read/create, retry obsoleto e compatibilidade memória. CI PostgreSQL LOGIN restrito obrigatório prova bloqueio concorrente de alteração da unidade durante auditoria com lock_timeout e rollback, sem usar SET ROLE administrativo como LOGIN.
Fechamento/CI/revisão final na PR; baseline frontend typecheck e restrições locais Windows/Bash/hardlinks não mascaradas. Fonte real: três referências/hash conferidos #308; nenhuma aprovação semântica completa comprovada.04REPORTS EPERM sync/async persiste, backup original intacto. Implementação não é recuperação/importação ou homologação VPS/Auth. Próximo: equivalência semântica classe/tipo e procedência do mapa privado, destino/RBAC/backup antes do piloto operacional; integração aguarda Cursor SHA exato e gates, implementação independente continua liberada.


## CODEX — Classe/tipo explícitos sem primeira escolha (2026-10-11)
Responsável Codex, workspace Legado separado, branch codex/legado-classe-tipo-consistencia-20261011 sobre #310303d8230c72ce7ff128a889cfc46579bc01cdb57 CI3999SUCCESS. Mainbaba91a6 revalidada, #264 preservada; ownership261/6116548997 anunciado, recebimento/revisão não presumidos. Lote completa consistência da declaração classe/unidade até catálogo, persistência e retry.
Defeito reproduzido: map próprio tipo_item=MATERIA_PRIMA e tipo_produto=REVENDA selecionava primeiro campo e aprovava significado contraditório. ProdutoTipoPolicy existente recebe resolver de aliases explícitos, reutilizando normalização/resolução canônicas. Todos valores presentes precisam ser strings conhecidos e resolver ao mesmo tipo; ausência completa nunca usa default Revenda. Null/undefined/branco continuam representando alias ausente quando há outro explícito válido, preservando contrato anterior. Defaults de formulário/resolver antigo não alterados. Desconhecido/contradição não é descartado por precedência.
Mapper exige registro de classificação não-array, declaração de tipo e unidade próprios; campos herdados não viram decisão. Contradição vai a quarentena com produto_tipo_mapeamento_conflitante e tipo/unit canônicos omitidos; classe/unidade/código original preservados. Catálogo permanece sem mapeamento comprovado. Consumidor piloto congela mapa com structuredClone antes de awaits, como revisão/snapshot de unidade: mutação tardia de conflito para permitido não libera carga. Nenhuma inferência pelo tipo da linha ou classes vistas em Revenda, sem mudança da trava histórica026 ou do isolamento.
Local53focados frontend PASS/0FAIL/0SKIP e3piloto Produto PGlite PASS/0FAIL/0SKIP; matriz de ordem/aliases equivalentes/tipo_produto antigo/null/blank/prototype/array/não-string/desconhecido/sem-default/immutabilidade. Prova adicional de lote parcial: conflito tipado quarentena somente o registro afetado, válido processado/reutilizado no retry e entradas imutáveis. Runner PG LOGIN restrito existente ampliado: mapas contraditórios e mudança tardia recusados com produto/seq/audit inalterados, retry conflitante bloqueado e retry com aliases equivalentes conserva ID. Fluxos de edição/reabertura/concorrrência/reversão/rollback, unidade semântica/TX e RBAC existentes preservados. Checks/CI/revisão final na PR; sem remover testes/skip artificial ou mascarar baseline/infra Windows.
Fonte privada/mapa real continuam não aprovados. Diagnóstico310/6116527059: extração/refclasse/revisão com hash declarado conferente, referência de unidade ainda não comprovada;45candidatos por hash sem cópia equivalente, busca limitada incompleta não prova ausência global.04REPORTS EPERM; alternativa nativa PowerShell confirmou UnauthorizedAccessException/HResult-2147024891, original intocado. Sem migração/grant/VPS/provider/canal/importação/recuperação operacional. Próximo: procedência referência de unidade e equivalência semântica das decisões reais classe/tipo/Grupo/fiscal/destino/RBAC/backup; integração depende revisão Cursor do SHA exato e CI, demais implementação independente liberada.
