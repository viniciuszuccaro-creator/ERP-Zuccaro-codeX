# Comercial 360 - Contrato da Onda 1: Produto, PIM e DAM

## Decisão

`Produto` permanece o único mestre. A Onda 1 amplia `produtoTypes`, `ProdutoService`, repositories, rotas `/api/v1/produtos` e formulários de Cadastros. Não criar `ProdutoOmnicanal`, catálogo mestre separado nem armazenamento de mídia em Base44/localStorage.

## Baseline e lacunas

O Produto atual já possui código, código de barras, descrição/nome, tipo, aço/bitola, unidades/conversões, marca/grupo/setor, peso/dimensões, NCM/CEST/origem e uma URL de foto. Faltam taxonomia controlada, conteúdo por canal, galeria/arquivos versionados, variações/equivalentes, embalagem/múltiplos, política de fracionamento e workflow de aprovação/publicação. Estoque, custo e preço continuam fora do payload de Produto.

## Modelo alvo

- `produtos`: identidade e atributos universais; manter compatibilidade dos campos atuais.
- Classificação controlada: `REVENDA`, `MATERIA_PRIMA`, `COMPONENTE`, `INTERMEDIARIO`, `FABRICADO`, `KIT`, `SERVICO`, `RETALHO`, `SUCATA`. Valores legados são mapeados, nunca reclassificados silenciosamente.
- Extensão aditiva futura para descrição técnica/comercial/SEO, material/liga/norma, embalagem, múltiplo, mínimo e política de fracionamento.
- `produto_variantes`: SKU/código de barras/atributos e vínculo ao Produto mestre; não duplica ficha inteira.
- `produto_canais`: autorização, SKU/nome/descrição/publicação por canal; preço e disponibilidade são referências aos módulos donos.
- `produto_midias`: metadados e versão de imagem, vídeo, desenho, manual, certificado ou CAD; binário fica em storage privado.
- `produto_equivalentes`: relação explícita, direcionalidade e aprovação; substituição nunca automática no Pedido.
- Kit/BOM industrial pertence às Ondas 12–14; Onda 1 guarda apenas classificação e vínculo, sem explodir produção.

Todas as tabelas novas exigem `group_id`; `empresa_id` somente quando o registro for específico. FKs tenant-aware, RLS+FORCE, soft delete, `created_by/updated_by` e timestamps. Migration futura será a próxima numeração disponível após reconferir `origin/main`; não reservar número neste contrato.

## DAM e segurança

- Implementar adapter real do `StoragePort`; nunca persistir URL temporária como identidade do arquivo.
- Upload em duas fases: autorização backend → upload privado → confirmação com hash SHA-256, MIME detectado, tamanho e metadados.
- Allowlist por categoria; antivírus/quarentena antes de liberar; limite de tamanho/quantidade configurável.
- Download usa URL assinada curta após RBAC/tenant. Audit registra metadados resumidos, nunca token, URL assinada ou conteúdo.
- Versão publicada é imutável; nova revisão cria versão. Exclusão lógica não apaga arquivo histórico ainda referenciado.

## API e RBAC

Preservar `/api/v1/produtos`. Recursos subordinados futuros:

- `/api/v1/produtos/:id/variantes`
- `/api/v1/produtos/:id/canais`
- `/api/v1/produtos/:id/midias`
- `/api/v1/produtos/:id/equivalentes`

Ações mínimas: `visualizar`, `criar`, `editar`, `inativar`, `restaurar`, `gerenciar-variantes`, `gerenciar-canais`, `gerenciar-midias`, `aprovar-conteudo`, `publicar`. Custo/margem/preço/estoque permanecem em permissões e APIs próprias.

## Compatibilidade e consumidores

Cadastros continua a UI mestre. Comercial, TabelaPreco, Estoque, Produção, Site, Portal, Chatbot e marketplace leem o mesmo Produto. `foto_produto_url` permanece durante transição como projeção da mídia principal; só será retirado após migração de consumidores e homologação. Importação legado preserva código/origem e quarentena conflitos.

## Primeiro checkpoint de implementação

1. Criar testes de contrato para classificação, tenant e mass assignment.
2. Normalizar tipos legados no domínio sem quebrar payloads existentes.
3. Adicionar apenas campos universais comprovadamente necessários ao Produto existente.
4. Adiar tabelas DAM/canais até o adapter de storage e contrato de outbox estarem implementados.
5. Validar frontend/backend/PostgreSQL efêmero antes de qualquer cutover.

## Estado após a consolidação da classificação

- Concluído: policy frontend única para classificação, aliases inequívocos, preservação de valores legados, formulários existentes, importadores e consumidores ativos de Estoque, Comercial e Produção.
- Preservado: tipos operacionais de item de pedido, separação e produção não foram confundidos com `Produto.tipo_item`.
- Fora do runtime: `StatusProdutosProducaoV21_6` não possui consumidor e permanece inventariado como artefato histórico; não foi conectado nem removido.
- Concluído: backend canônico normaliza aliases, bloqueia novas classificações desconhecidas, preserva valor legado já persistido, rejeita mass assignment operacional e aplica tenant/RBAC fail-closed em visualizar, criar, editar e inativar.
- Concluído: o núcleo PIM universal reutiliza os campos existentes de código de barras, unidades/conversões, pesos e dimensões; o backend rejeita números/fatores negativos ou não finitos e normaliza unidades secundárias repetidas sem alterar sua grafia canônica.
- Aberto: conteúdo técnico/comercial/SEO, variantes/equivalentes, embalagem/fracionamento, aprovação/publicação e DAM seguro dependente de `StoragePort`/outbox.
- Bloqueado por dependência: DAM e conteúdo por canal aguardam adapter privado de `StoragePort`, antivírus/quarentena e contrato de outbox; nenhuma URL temporária ou binário será incorporado ao Produto.

Próximo checkpoint: inventariar no formulário existente os campos de conteúdo técnico/comercial já consumidos e definir o menor contrato aditivo, sem iniciar DAM ou canais antes de `StoragePort`/outbox.

## Aceite

Nenhum cadastro paralelo; estoque/preço/custo não entram em Produto; cross-tenant e empresa externa bloqueados; upload privado e audit sanitizado; variações/canais/mídias versionados; consumidores atuais preservados; dados e arquivos reais fora do GitHub.
