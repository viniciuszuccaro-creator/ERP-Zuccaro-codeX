# Execução paralela do ERP Zuccaro — Codex e Cursor

> Diretriz operacional do proprietário em 29/09/2026. Complementa `AGENTS.md` e `docs/PROGRAMA_COMERCIAL_360_OMNICANAL_EXECUCAO_AUTONOMA.md`. Antes de trabalhar, confirme os HEADs atuais no GitHub; os números abaixo são checkpoints, não instruções para usar SHA antigo.

## Objetivo

Codex e Cursor implementam frentes independentes em paralelo, com lotes funcionais grandes e completos. A revisão cruzada ocorre no HEAD final de cada PR pronta para integração, não depois de cada commit. Nenhum agente fica reduzido a monitor de PR, e nenhum aguarda a palavra “próximo” dentro da execução ativa se houver item autorizado e independente disponível.

Esta diretriz não mantém uma sessão de IA viva depois que ela termina. Uma tarefa agendada só produz código se tiver workspace gravável, dependências, ferramentas de teste, GitHub e instrução explícita de implementar naquela execução. Verificar HEADs por segundos e responder “sem mudanças” não é implementação.

## Responsabilidades e arquivos

| Frente | Implementador | Revisão cruzada | Contrato de exclusividade |
| --- | --- | --- | --- |
| Integração da #104 já homologada | Codex | Cursor valida eventual diff de integração | Congelar o código da #104; conferir SHA, CI, base, conflitos e gates. Não acrescentar funções à PR. |
| Migração legada: inventário, staging e reconciliação | Codex, no computador com o HD | Cursor no HEAD final | Evoluir #106 e #107 em branches próprias; não editar o mapeador da #48. Backup original apenas leitura. |
| Mapeador legado e aliases da #48 | Cursor | Codex no HEAD final | Cursor é dono de `scripts/legado/mapear-registro-sintetico.mjs` e `docs/LEGADO_MAPEAMENTO_CANONICO_RASCUNHO.md`. Não importar dados reais. |
| Próxima onda independente do Comercial 360 | Cursor | Codex no HEAD final | Escolher item ainda aberto no programa, fora dos arquivos da #104 e da frente legada. Branch/PR próprias. |

Se uma frente estiver bloqueada por arquivo ocupado, permissão ou CI, o agente executa outro item independente de sua responsabilidade. Antes de alterar arquivo compartilhado, confira HEAD e avise a outra frente na PR. `STATUS_DO_PROJETO.md` deve preservar ambos os históricos; prefira checkpoint na PR durante trabalho paralelo e atualização coordenada do STATUS ao integrar.

## Modo de execução de cada agente

1. Confirmar repositório, branch, HEAD, `git status`, permissões de escrita, testes e PRs atuais. Não tocar em mudanças desconhecidas do clone principal; usar worktree/branch isolada.
2. Escolher conjunto funcional de uma onda ou gate com dependências, critérios de aceite e casos de falha explícitos. Trabalhar até fechar vários incrementos relacionados na mesma execução, não um microajuste seguido de “próximo”.
3. Exercitar o caminho real (entrada, Grupo/Empresa, RBAC, persistência, efeitos posteriores, auditoria, retry e rollback/compensação). Testes que só procuram strings no fonte não substituem testes de comportamento.
4. Fazer commits e push de checkpoints úteis na própria branch; verificar SHA remoto, CI do HEAD final e corrigir falhas. GitHub é fonte oficial; não deixar entrega somente no computador.
5. Ao fechar PR grande, pedir revisão cruzada única do HEAD exato. Revisor aponta defeitos verificáveis e risco; implementador corrige achados bloqueantes, revalida e pede revisão do novo HEAD. Itens independentes continuam enquanto se aguarda parecer.
6. Entregar no chat principal links de PR, SHAs, CI, testes, estado de merge/implantação, próximo conjunto e bloqueios reproduzíveis. “Tarefa ativa” ou “PR sem mudanças” não contam como entrega.

## Próximos conjuntos concretos

- #104: Cursor homologou `87101b4dd184326ce7cdb915d4b2d8947e028244` com CI verde. Codex congela essa branch e prepara integração verificável contra a main atual; merge e deploy obedecem gates próprios.
- #106 → #107: inventário seguro e preflight/staging sintético com revisão/CI. Codex avança reconciliação e contrato de empresa proprietária sem repetir varredura do backup e sem alterar #48.
- #48: Cursor finaliza mapeamento/aliases. Grupo legado `003` não prova empresa emissora; empresas `001`, `002` e `005` exigem vínculo por registro. Cadastros mestres compartilhados no Grupo preservam código legado; operações pertencem à empresa comprovada e aparecem consolidadas no Grupo.
- Cursor seleciona a próxima onda Comercial 360 independente diretamente do documento mestre e registra na PR os arquivos reservados antes de implementá-la.

## Gates de dados e implantação

O backup original fica em `BACKUP ERP ANTIGO - CODEX` no HD externo, letra variável, preservado. Nunca publicar MDF/LDF/TPS, registros, PII, credenciais, dumps, amostras reais ou manifestos detalhados no GitHub. Código, contratos, fixtures sintéticas e evidências agregadas/sanitizadas podem ser versionados.

Staging real exige mapa Grupo/Empresa por registro, extração controlada, contagens e conflitos, isolamento do destino e reconciliação. Carga no ERP operacional requer backup restaurável do destino, rollback, autorização/gate e relatório pós-carga. Não inferir empresa por pasta ou pelo Grupo `003`; não importar usuários, senhas ou permissões legadas. Merge, migration, deploy VPS, alteração da 3080 e ativação de canais seguem seus gates específicos.

## Critério de parada e automação

Dentro da execução ativa, continuar o próximo item independente até concluir o conjunto autorizado, atingir limite real da ferramenta ou encontrar bloqueio reproduzível que impeça todas as frentes disponíveis. Registrar erro concreto e próximo item. Depois que a sessão encerrar, somente uma nova execução iniciada pela interface/automação configurada pode retomar o trabalho; este arquivo não cria gatilho nem executa código sozinho.
