# Comercial 360 - Contrato da Onda 9: Engenharia e Arquivos Técnicos

## Decisão

Evoluir `ArquivosProjetosTab`, uploads do Comercial/Portal, leitura assistida, formulários de Armado/Corte e Dobra e componentes de Produção. Não criar segunda Engenharia nem permitir que upload/IA grave Pedido, OP, estoque ou audit diretamente em Base44 como arquitetura final.

## Agregado técnico

- Projeto: Grupo, Empresa proprietária quando operacional, ClienteEmpresa, Obra, código, título, tipo, estado e responsável.
- Revisão imutável: número (`Rev. 00` etc.), origem, arquivo/evidência, hash, autor, aprovação e timestamps.
- Documento técnico: metadados DAM, categoria, versão, MIME, tamanho e estado de quarentena; binário em storage privado.
- Elemento/peça extraída: origem página/camada, medidas, material, bitola, posição, quantidade, peso, confiança e evidência.
- BOM/roteiro preliminares são propostas até revisão técnica; a versão aprovada é congelada no Orçamento/Pedido/OP.

Estados mínimos: `RECEBIDO`, `EM_EXTRACAO`, `AGUARDANDO_CLIENTE`, `EM_REVISAO_TECNICA`, `APROVADO`, `REJEITADO`, `CANCELADO`. Aprovação técnica e aprovação do cliente são decisões distintas quando ambas forem exigidas.

## Ingestão e IA

- Upload segue o contrato DAM: allowlist PDF/DWG/DXF/JPG/PNG inicialmente, hash, MIME real, tamanho, antivírus/quarentena e URL assinada curta.
- Parser/IA nunca executa arquivo nem segue instruções embutidas. Saída inclui evidência e confiança por campo.
- Baixa confiança, variável, referência cruzada ou medida derivada exige conferência explícita.
- Nenhum resultado segue para orçamento/produção sem revisão humana autorizada.
- Nova versão não altera revisão aprovada; comparação produz divergências auditáveis.

## Integrações canônicas

- Cliente/Obra: referências aos mestres existentes.
- Produto: reutilizar mestre/equivalentes; criação de produto novo segue workflow da Onda 1.
- Orçamento/Pedido: guardar `projeto_id` e `revisao_id` congelados; não copiar arquivo inteiro.
- Produção: OP nasce somente de Pedido/projeto aprovado pela API de Produção.
- Estoque: reserva/consumo somente pela API de Estoque.
- Auditoria: backend transacional; componentes deixam de gravar `AuditLog` diretamente.

Chamadas diretas encontradas em uploads, apontamentos e geração de OP entram na fila de migração por consumidor. O fallback legado permanece até equivalência e E2E; não será removido neste contrato.

## API e RBAC

Recursos futuros versionados: projetos, revisões, documentos, extrações e aprovações. Operações de processamento são assíncronas, idempotentes por hash + projeto + revisão e expõem estado, não segredo do provider.

Permissões: visualizar, criar, editar-metadados, enviar-arquivo, processar, revisar-tecnicamente, solicitar-cliente, aprovar-cliente, rejeitar, comparar-revisoes, exportar e liberar-producao. Arquivo, custo técnico e aprovação têm permissões separadas.

## Auditoria e retenção

Auditar upload confirmado, hash, mudança de estado, extração, correção humana, aprovação/rejeição, comparação, exportação e liberação. Não registrar conteúdo binário, URL assinada, desenho completo ou texto sensível desnecessário. Retenção e exclusão física obedecem vínculos legais/operacionais.

## Primeiro checkpoint de implementação

1. Inventariar entidades Base44 realmente usadas por cada tela e definir adapters temporários.
2. Implementar storage/DAM da Onda 1 antes do upload canônico.
3. Criar Projeto/Revisão de forma aditiva, com tenant e RLS, somente após reconferir migrations.
4. Migrar primeiro upload + consulta, mantendo análise manual; IA entra depois com fixtures sintéticas.
5. Bloquear produção automática e cobrir gate humano, cross-tenant, hash/idempotência e audit rollback.

## Aceite

Revisão aprovada imutável e congelada; origem/evidência/confiança preservadas; nenhum arquivo real no GitHub; storage privado; IA não libera produção; APIs de Pedido/Produção/Estoque proprietárias; fallback legado somente durante migração testada.