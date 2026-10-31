INBOX — depósito HTTPS no repositório público (NÃO é canal privado)
===================================================================
Path GitHub público após negação de fileURL. Conteúdo fica visível no remoto.

O que pode ser depositado
-------------------------
Somente artefatos sanitizados e autorizados para publicação:
- patch/diff de código sem segredos
- MANIFEST.txt (HEAD base, paths, finalidade)
- sha256.txt (hash do patch + lista de arquivos)

Proibido neste path
-------------------
- dados reais / PII / relatórios privados
- credenciais, tokens, chaves, dumps
- patches sem revisão de conteúdo
- apply automático na candidata #401

Depósito
--------
1. Branch: cursor/codex-wip-inbox-392b (ou PR derivado)
2. Path: docs/evidence/codex-wip-inbox/<sha256-do-patch>/
   - wip.patch (ou .diff)
   - MANIFEST.txt
   - sha256.txt
3. Base preferencial: cursor/composicao-397-342-prep-392b

Recebimento
-----------
Cursor NÃO afirma recebimento até validar bytes/hashes localmente
(sha256sum == manifesto). Sem apply automático · ≠ merge candidata
· ≠ reset worktree composição · ≠ VPS/DDL/carga
