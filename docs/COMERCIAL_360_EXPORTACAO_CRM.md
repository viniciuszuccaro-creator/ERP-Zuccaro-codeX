# Onda 3 — Exportação canônica de oportunidades

## Escopo e origem (17/10/2026)

Requisito já existente em `COMERCIAL_360_ONDA_3_CLIENTE_CRM.md`: exportação
server-side completa dos registros filtrados, permissão própria, limite e audit.
Inventário encontrou somente a listagem paginada de Oportunidade, sem exportação
HTTP equivalente. Reutiliza `OportunidadeService`, `repo.list` e seu SQL único
de total/página/ordem. `oportunidadeCsv.ts` é extração de serialização ausente,
não outro CRM, tabela, repositório ou fonte de dados.

Branch `codex/crm-exportacao-20261017`, base #331
`b3a683bba1bdd8dc3870ce4ba4eeb87430b3e561`. Independente das candidatas #334/#335;
não incorpora migration045 nem os deltas de Expedição. Reservado na #261,
comentário6232123021. UI/Central/policies/stores e branches Cursor preservados.

## Contrato HTTP

`GET /api/v1/oportunidades/exportar.csv` usa Auth/contexto e `ENABLE_CRM_HTTP`
existentes. Flag continua OFF por padrão. Não ativa consumidor ou exportação
legada automaticamente. Não expõe arquivo público nem guarda cópia no servidor.

Filtros iguais à listagem: `search`, `status`, `ativo`, `clienteEmpresaId`.
`limit`/`offset`, campos tenant e filtros desconhecidos são rejeitados (422):
download não representa uma página. Ordem `updated_at DESC,id DESC`, igual à
consulta existente. Uma única consulta fornece total e todas as linhas do
snapshot; não percorre páginas mutáveis. Limite máximo 2.000: acima dele retorna
413 `OPORTUNIDADE_EXPORT_LIMIT`, sem download parcial. Filtros permitem reduzir
o conjunto. Inconsistência total/linhas retorna503, nunca sucesso truncado.

Resposta UTF-8 com BOM, separador ponto e vírgula, CRLF, todas as células entre
aspas e aspas internas duplicadas; quebras/delimitadores preservados. Texto com
prefixo de fórmula, inclusive após espaço/controle, recebe apóstrofo de proteção.
Conteúdo textual protegido pode diferir por esse prefixo; valores persistidos
permanecem intactos. Importadores de planilha devem tratar códigos como texto
para preservar zeros à esquerda. Valores monetários saem da representação
decimal canônica de seis casas, sem conversão para Number.

Projeção explícita: ID técnico, códigos, título, etapa/status, ClienteEmpresa,
valor estimado, probabilidade, datas abertura/previsão/próxima ação, referências
Orçamento/Pedido, ativo e versão. Exclui contatos, nomes livres de clientes,
notas, descrição, necessidade, responsável, atores, legado e chaves de replay.
Não é exportação LGPD integral nem arquivo financeiro/fiscal/operacional.

Headers: `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`,
`Content-Disposition: attachment; filename="oportunidades.csv"`,
`X-Total-Count` real. Nenhum header de download antes da conclusão transacional.

## Segurança e auditoria

Requer `CRM.oportunidades.exportar` e `visualizar`, sem wildcard global.
Contexto/filtros capturados antes de await. Tenant/RBAC no executor SQL antes
da consulta e novamente antes da auditoria/resposta. RLS/FORCE e filtros de
Grupo/Empresa existentes continuam aplicados. Nenhum grant operacional novo.

Audit `entity=Oportunidade`, `action=read`, `operation=export_csv` registra
ator/tenant/request ID, quantidade, colunas, filtros estruturados e hash SHA256
do arquivo. Não registra CSV, busca livre, notas ou contatos. Falha no audit
reverte a transação e impede o retorno do arquivo. Repetir download autorizado
registra outra leitura; não modifica oportunidades, códigos ou documentos.
Teste de revogação altera perfil somente na fixture e comprova rollback da
alteração e ausência de liberação do arquivo; não amplia permissões do runtime.

## Aceite e retomada

- Fluxo persistido com206 linhas, mais que a página máxima de200, mesma ordem,
  todos os filtros, vazio, moeda exata, projeção e proteção de fórmula CSV.
- Negação de visualizar/exportar/wildcard, Grupo/Empresa/ator, opções adulteradas,
  mutação tardia de contexto/filtro, revogação, audit failure e limite2001.
- GET HTTP persistido e headers, erro sem download parcial, documento inalterado.
- Mesmo percurso em PGlite e PostgreSQL real isolado com LOGIN sem superuser ou
  bypass de RLS; runner obrigatório rejeita skips e URL ausente como antes.
- Checks locais e CI final registrados na PR. Typecheck global frontend mantém
  baseline1660 da base #331; nenhum arquivo src/ alterado.

Revisão independente do SHA final obrigatória, mesmo enquanto Cursor sem crédito.
Preparado/testado/publicado não significa integrado/implantado/homologado.
Sem migration, importação, VPS ou dados reais. Rollback de código: reverter o
commit/restaurar imagem anterior; nenhuma alteração de dados a reverter. Ativar
consumidor exige revisão e gates canônicos de destino/backup/retorno existentes.
