# Parecer Cursor — #230 local ≠ Auth Supabase VPS

**Data:** 2026-10-07

| Ambiente | Mecanismo | Escopo da #230 |
|---|---|---|
| Vite / `VITE_ERP_BACKEND=local` | `localBase44` + `localAuthSessionPolicy` + mestre local | **Sim** — recupera `session_access_changed` pós-snapshot |
| erp-dev (`supabase_user`) | Bearer Supabase Auth → `profiles` → tenant/RBAC | **Não** — #230 não altera login VPS |

## Implicações

1. Validação browser em `localhost:5174` **não** prova login em `https://erp-dev.cpaferroeaco.com.br/`.
2. Deploy VPS continua exigindo identidade Auth real, permissões Organizacional/Financeiro no perfil, e contexto CPA/3Z.
3. Merge #230 é útil para DEV local / recover; promoção VPS depende de #226/#225/#231 + gates de imagem.

## Validação VPS pendente

Login Supabase → seleção CPA/3Z → edição cadastro → submódulos Financeiro — só após merge+deploy; evidências sanitizadas.
