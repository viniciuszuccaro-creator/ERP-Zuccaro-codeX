# Limpeza histórica — snapshots públicos (SEPARADA da #231)

**NÃO executar neste lote.** A PR [#231](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/231) (`47d3a148`) só remove os assets da HEAD atual e impede reintrodução. Blobs em commits antigos **permanecem** até uma janela coordenada.

## Já feito (#231)

- Removidos `public/base44-local-core-snapshot.json` e `public/base44-local-snapshot.json` da árvore
- `.gitignore` + `.gitattributes` + guard `tests/public-snapshot-exposure-guard.test.js`
- Hidratação automática por URL pública desligada (`main.jsx` / `recover.html`)
- Cópia privada preservada fora do git (ex.: backup operacional local; neste Cloud: `/tmp/erp-private-snapshots-backup`)

## Inventário antes de qualquer rewrite (humano)

1. Listar refs/PRs/forks que ainda apontam para commits com os JSON
2. Congelar pushes na janela
3. Confirmar cópia recuperável privada (checksum) fora do GitHub
4. Escolher ferramenta (BFG / `git filter-repo`) **somente** com autorização explícita
5. Force-push coordenado + re-clone de agentes/VPS
6. Verificar CDN/artefatos implantados sem os assets

## Proibições

- Não reescrever `main`/branches compartilhadas de surpresa
- Não publicar hashes de conteúdo sensível, IDs reais ou credenciais no PR
- Não confundir merge #231 com purge histórico
