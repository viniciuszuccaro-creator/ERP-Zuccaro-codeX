# Programa ERP CPA - Go-Live

## Fonte e regras

Repositorio canonico: `viniciuszuccaro-creator/ERP-Zuccaro-codeX`. GitHub guarda apenas codigo, testes, contratos e relatorios sanitizados. Backups reais, PII, credenciais, dumps e arquivos de banco permanecem fora do repositorio.

Toda frente usa branch e worktree exclusivos, atualiza `STATUS_DO_PROJETO.md`, executa checks aplicaveis, faz commit/push e abre PR ao ficar revisavel. Nao ha push direto na `main`.

## Estado operacional

- MAIN aprovada: `ca4171600cc30f9922c2f8b2ccb8b22d06aa6888`.
- API oficial VPS: `ERP-RUNTIME-07B` em `erp-api-dev`; rollback R07B deve ser preservado.
- PostgreSQL DEV: migrations 001-015, com 014 e 015 aplicadas uma vez; nao criar/reaplicar migration.
- R08B Gates C/D: branch `codex/r08b-ca417-gate-cd`, commits `4ac52073`, `eb69e31b`, `ee1dc992`; script pronto para revisao e execucao controlada pela Web Console. Nenhuma VPS foi alterada por essa frente.

## Frentes e ownership

| Frente | Branch | Responsavel | Estado | Dependencia/Gate |
| --- | --- | --- | --- | --- |
| Runtime/VPS R08B C/D | `codex/r08b-ca417-gate-cd` | Codex | pronta para revisao | execucao Web Console, sem merge previo |
| Runtime/VPS R08B E/F | `codex/r08b-ca417-gate-ef` | Codex | bloqueada | C/D aprovado na VPS |
| Comercial 360 | `codex/comercial-360` | Cursor frontend / Codex backend | nao iniciada | inventario e especificacao |
| Backup legado | `codex/legacy-backup-discovery` | Codex | nao iniciada | HD externo conectado; somente leitura |
| Pipeline migracao | `codex/legacy-migration-pipeline` | Codex | nao iniciada | descoberta sanitizada |
| Web/HML | `codex/vps-web-hml` | Cursor/Codex | nao iniciada | sem dominio/DNS nao publicar |

## Ordem de integracao

1. Revisar e executar R08B C/D pela Web Console.
2. Com C/D aprovado, preparar E/F em branch propria; promocao so apos gate explicito.
3. Inventariar Comercial 360 existente e publicar especificacao antes de implementar.
4. Descobrir backup em todas as unidades Windows, sem registrar caminho real, dados ou hashes de arquivos sensiveis no GitHub.
5. Preparar pipeline dry-run e HML sem importar dados reais ou publicar sem DNS, HTTPS, login e rollback.

## Bloqueios e rollback

- A execucao C/D exige acesso humano autorizado a Web Console; o script preserva backup, logs, worktree e container canario parado.
- E/F, seed, migrations, promocao da 3080 e importacao real exigem gates e autorizacao especificos.
- Falha de CI, SHA divergente, credencial ausente ou regra fiscal indefinida bloqueia a frente no gate atual.

## Definicao de pronto por frente

Codigo e documentacao sanitizada versionados, checks aplicaveis aprovados, commit/push confirmados, PR aberta quando revisavel, sem dados reais no GitHub e sem arquivos permanentes apenas no worktree.
