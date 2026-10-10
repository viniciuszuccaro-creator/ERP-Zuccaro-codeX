# Limpeza histórica — snapshots públicos (SEPARADA da #231)

**NÃO executar a reescrita neste lote.** A PR [#231](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/231) foi mesclada e removeu os assets da árvore atual. Blobs em commits antigos, branches, caches, clones e builds já implantados **permanecem** até uma janela coordenada.

## Já feito (#231)

- Removidos `public/base44-local-core-snapshot.json` e `public/base44-local-snapshot.json` da árvore
- `.gitignore` + `.gitattributes` + guard `tests/public-snapshot-exposure-guard.test.js`
- Hidratação automática por URL pública desligada (`main.jsx` / `recover.html`)
- Cópia privada preservada fora do git no staging do proprietário; verificar integridade e restauração antes da janela

## Inventário somente leitura (2026-10-08)

- Após `git fetch origin --prune`, 249 refs locais de `refs/remotes/origin` foram inspecionadas. Em 237 tips, **ambos** os caminhos ainda existem: 86 branches `codex/` e 151 `cursor/`. A `origin/main` não tem esses assets na árvore atual. Nenhuma tag local foi encontrada.
- Esta contagem cobre as refs remotas que o clone conseguiu buscar naquele instante. Não comprova inventário completo de forks, refs de PR do GitHub, caches, clones privados ou artefatos de deploy. Atualizar a contagem imediatamente antes de qualquer janela.
- O inventário não abriu nem publicou o conteúdo dos arquivos. Nenhuma branch foi apagada, reescrita ou enviada por force-push.
- Foi criado um bundle **privado, fora do GitHub** com as refs locais após o fetch (~19 MB). `git bundle verify` confirmou história completa; um clone bare independente do bundle abriu 268 refs. Checksum integral e metadados de recuperação ficaram somente no diretório privado do proprietário. Essa prova não cobre forks ou refs internas do GitHub e deve ser refeita após novo fetch imediatamente antes da janela.
- Em nova consulta pública de PRs e novo fetch, 176/178 PRs abertas apontavam para branches cujo tip ainda continha o snapshot; 2 não continham. O clone passou a conhecer 251 refs remotas, 237 afetadas. O bundle anterior permanece um checkpoint recuperável, **não** o backup final para uma janela futura. Não publicar a lista de PRs/refs afetadas em massa antes da coordenação com os responsáveis.
- Um espelho fresco do remoto enumerou 663 refs: 237/250 branches e 400/413 refs internas de PR ainda continham os dois caminhos no tip. Essas refs de PR incluem histórico além das PRs abertas; a contagem não equivale a 400 PRs abertas. A limpeza de refs internas/caches requer coordenação com o GitHub, não apenas force-push das branches.
- O ensaio de `git-filter-repo` em dois clones bare **privados e descartáveis** falhou no `git fast-import` com `OSError: [Errno 22] Invalid argument`. Nenhuma ref remota foi modificada. Os clones parcialmente processados não são backups nem candidatos de promoção. Os bundles privados verificados permanecem preservados. Resolver e repetir o ensaio, com inspeção sanitizada do erro, antes de pedir janela de rewrite.

## Ensaio tecnico posterior (2026-10-08)

- O erro anterior foi localizado em um caminho historico invalido para Windows no `git fast-import`. Em processo isolado, com `core.protectNTFS=false` **somente nesse processo** e o `PYTHONPATH` da instalacao privada de `git-filter-repo`, o filtro concluiu. Nenhuma configuracao global foi alterada.
- Um espelho fresco do GitHub, com o remoto imediatamente redirecionado para um bundle privado para impedir push acidental, continha 250 branches e 413 refs de PR. O filtro removeu os dois caminhos de toda a historia alcancavel nessas 663 refs: contagem de caminhos alcançaveis `0`; `git fsck --full --no-reflogs --strict` passou. O espelho e **descartavel**, nao e o backup nem uma candidata autorizada a push.
- O bundle local mais amplo contem tres refs auxiliares `refs/codex/turn-diffs/*` apontando diretamente para arvores, nao commits. `git-filter-repo` as ignora; elas nao apareceram no espelho fresco do GitHub. Nao usar a contagem dessas refs locais como prova de exposicao publica; preservar o bundle privado e excluir essas refs do escopo de qualquer promocao.
- Este ensaio prova apenas que a transformacao e a integridade Git sao reproduziveis. Ainda faltam janela coordenada, backup final de todas as refs, preservacao de revisoes de PR, autorizacao especifica para force-push/delecao de refs, tratamento pelo GitHub das refs internas/caches, reinstalacao segura dos clones e verificacao independente de deploy/CDN. **Nenhuma dessas etapas foi executada.**

## Inventário antes de qualquer rewrite (humano)

1. Fechar o inventário de branches, PRs abertos, forks, tags, releases e artefatos de CI/deploy; avisar os responsáveis pelas 176 PRs abertas afetadas e definir como preservar revisões/comentários antes de rebase ou recriação.
2. Congelar pushes e merges por uma janela definida. Registrar os tips e aprovações; novos commits baseados no histórico antigo reintroduziriam os blobs.
3. Confirmar uma cópia privada recuperável, com checksum e teste de restauração, fora do GitHub. O backup não deve ser usado para repor os arquivos no repositório público.
4. Repetir em clone espelho descartável e isolado o ensaio de `git filter-repo` para remover **somente** os dois caminhos de todas as refs a preservar. Não executar em worktree ativo. No Windows, isolar `core.protectNTFS=false` ao processo; não mudar a configuração global. Guardar mapeamento antigo->novo e relatório de refs em canal privado.
5. Provar no espelho: nenhum tip contém os caminhos; nenhum blob correspondente é alcançável pelas refs reescritas; árvore funcional, testes e CI da candidata limpa passam. Conferir PRs que precisarão ser recriados/rebaseados.
6. Obter aprovação operacional específica para a janela de reescrita/force-push e para o plano de recuperação dos colaboradores. Só então atualizar refs coordenadamente, invalidar clones/worktrees antigos e impedir push de histórico contaminado.
7. Solicitar tratamento de caches/refs internas ao provedor GitHub e verificar URL bruta, builds, CDN e VPS por leitura independente. Merge e rewrite não removem automaticamente assets já publicados.
8. Se a validação falhar, interromper a promoção e corrigir o clone isolado. Não restaurar blobs sensíveis ao repositório público como rollback.

## Proibições

- A autorização para **preparar** a limpeza não equivale a autorização para executar force-push, apagar branches ou afetar PRs em aberto
- Não reescrever `main`/branches compartilhadas de surpresa
- Não publicar hashes de conteúdo sensível, IDs reais ou credenciais no PR
- Não confundir merge #231 com purge histórico
