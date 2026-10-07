# Parecer Cursor — implantado vs candidata (2026-10-07)

## Autorização vs acesso efetivo

| Canal | Autorização | Acesso efetivo nesta sessão |
|---|---|---|
| GitHub | válida | OK (gh/PR/CI) |
| Hostinger VPS MCP | válida | **TIMEOUT** em `vps_virtual-machines_list` — leitura Docker/imagem **não** confirmada |
| Web Console / SSH | válida | não exercitada neste lote (MCP sem shell; sem inventário VM id) |

Autorização **não** equivale a conexão funcionando. Comparação commit/imagem/flags na VPS fica **BLOCKED** até listar VM + containers com sucesso.

## Candidatas prontas (código/CI)

| PR | SHA | CI | Nota |
|---|---|---|---|
| #225 Financeiro | `1f1f8cf6` | PASS | mergeável em `main` |
| #226 Cadastros | `f9b926e2` (+docs) | PASS | consolidar com #227 antes do merge final |
| #227 Cadastros tip | `5e50e6b1` | PASS | base Expedição — portar para #226 |

## Gates para aplicar na VPS (quando acesso efetivo)

1. Backup novo + prova de restore (OPERACAO_DEV_VPS).
2. Build da `main` pós-merge — não promover tip de branch.
3. Canário isolado → smoke `/meta` + navegação Financeiro/Cadastros no browser.
4. Promoção 3080 só com gate explícito; rollback imagem R07B preservada.
5. Flags: não ligar HTTP Empresa/Produto sem Auth homologado.

## HUMAN_NEXT / Cursor next

Reexecutar inventário VPS (MCP ou Web Console): `docker ps`, image ID da API/SPA, `GIT_REF`/digest, flags env sanitizadas — sem secrets no GitHub.
