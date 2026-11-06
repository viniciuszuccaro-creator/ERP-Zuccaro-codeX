# Legado — descoberta somente leitura do backup do ERP antigo

## Acesso VPS e agendamento: procedimento executavel existente (2026-10-22)

Resultado atual: nenhuma ferramenta VPS_* carregada, configuracao MCP do worker
ro, sem SSH config/identidade/agente nem acesso automatico ao HD da estacao.
Portanto nenhum df/stat/mkdir/chmod/criptografia/transferencia REAL foi executado
nesta retomada. Nao e falta de autorizacao do proprietario. O diagnostico e o
caminho suportado estao em [ABRIR_NO_OUTRO_COMPUTADOR](../ABRIR_NO_OUTRO_COMPUTADOR.md).

No cliente com Hostinger MCP efetivamente exposto, concluir o OAuth Allow do
conector e ler identidade/estado da VPS existente antes de qualquer escrita. Aqui
nao houve tela de OAuth e o registro MCP nao pode ser escrito em filesystem ro.
Nao substituir ferramenta ausente por API/token improvisado. Alternativa concreta:
um executor no console/SSH JA configurado da VPS, na estacao autorizada, fornece
recibo abaixo; nao copiar identidade/chave da estacao para Codespace ou Git.

### Precheck somente metadados no SHELL comprovadamente da VPS

Receita nao executada neste sandbox; confirmar hostname/ID contra o recurso
existente e origem da conexao antes de usa-la. Nao abrir env, backup, registros,
certificados, chaves, logs operacionais ou banco. Capacidade e pontual/compartilhada.

```sh
hostname
id -u
id -g
findmnt -T /srv -no FSTYPE
df -B1 --output=size,used,avail /srv
df -i --output=itotal,iused,iavail /srv
for caminho in /srv /srv/erp-legado-privado /var/lib/erp-legado-privado; do
  if [ -e "$caminho" ] || [ -L "$caminho" ]; then
    stat -c '%n uid=%u gid=%g mode=%a type=%F' -- "$caminho"
    if [ -L "$caminho" ]; then echo 'BLOCKED: destino/ancestral simbolico exige revisao'; fi
  else
    echo "$caminho AUSENTE"
  fi
done
for ferramenta in gpg cryptsetup age getfacl; do
  command -v "$ferramenta" || true
done
```

Depois do recibo, escolher destino PRIVADO fora build/publico/operacao e principal
existente de menor privilegio comprovado; verificar todos os ancestrais/mounts/
symlinks/ACL antes de criar ou alterar diretorio. Se candidato ja existir,
inventariar metadados e preservar seu estado, sem sobrescrever/alterar permissoes
silenciosamente. Nao usar backups operacionais junto ao build como novo staging.

Configuracao autorizada so pode avancar com esse acesso REAL: diretorio restrito
nao publico, transporte autenticado existente, criptografia em repouso comprovada
com recuperacao em canal privado do proprietario, manifesto privado SHA256/bytes,
retomada sem sobrescrever divergencias e politica de retencao/limite de copias.
Disponibilidade de gpg/cryptsetup ou ext4 nao prova criptografia configurada nem
recuperacao. Nao gerar chave/senha no chat; nao atribuir prazo de descarte como se
aprovado sem decisao do responsavel. Original RO nunca entra no descarte.
Espaco novo/budget/ACL/protecao/retencao continuam NAO COMPROVADOS neste executor.
Nenhum destino foi criado e nenhum primeiro byte real deve ser transferido ainda.

### Agendamento EXISTENTE: instrucoes substitutas para o novo fluxo

Nome recebido: **Continuar legado ERP Zuccaro**; identificador recebido:
`continuar-comercial-360`; estado recebido **PAUSED**. Nao existe tool de scheduler
nem diretorio local de automacoes nesta sessao. Abaixo esta o prompt pronto para
substituir as instrucoes DA MESMA automacao quando seu host estiver acessivel;
NAO e alegacao de que o prompt real ja foi alterado. Nao criar outra automacao.

> Continuar o programa existente do ERP Zuccaro, coordenado no chat Nuvem
> ERP-Zuccaro-codeX. Usar somente o Codespace
> potential-xylophone-5gj7r9v9qqg637vxp e checkout
> /workspaces/ERP-Zuccaro-codeX, branch codex/consolidacao-infra-20261017/PR342
> draft sobre334. Antes de escrever, provar pelo proprio agente identidade,
> repositorio, branch/SHA/status e write/read/delete de arquivo sintetico FORA
> checkout conforme ABRIR_NO_OUTRO_COMPUTADOR. Publicacao/URL/API nao provam shell.
> Ler AGENTS, HANDOFF/status atuais e programa Comercial360. Confirmar reserva
> efetiva de UM escritor; se outro Codex/Cursor estiver ativo, nao iniciar frente.
> Preservar dirty e novos arquivos de codigo privadamente antes do sync; nenhum
> reset/clean/stash silencioso/force/main antiga. Sincronizar somente SHA publicado
> conferido e testar exatamente essa versao com fixtures; nao repetir suites
> inalteradas nem enfraquecer gates. Publicar somente codigo/docs sanitizados e
> resultados reais na mesma branch/PR, confirmar SHA remoto e CI.
> Para legado, usar os scripts e mapeamento canonicos existentes. HD/SSH/dados nao
> sao herdados da estacao: exigir canal autenticado comprovado antes de qualquer
> precheck VPS/descoberta real. Antes de transferir, comprovar origem RO+tamanho/
> folga, destino isolado, UID/GID/ACL menor privilegio, criptografia e recuperacao,
> SHA256/bytes e retomada autenticada, retencao. Dados reais/PII/mapas/backups/env/
> certificados/chaves foraGit/CI/log/chat. Sem importacao operacional/migrations
> privadas045-049/deploy/merge. Manter piloto PREPARED_NOT_AUTHORIZED. Nao criar
> recursos/credenciais/portas ou API paga; confirmar budget zero sem altera-lo.
> Ao faltar executor, autenticacao, reserva unica ou qualquer gate, encerrar a
> tentativa com bloqueio sanitizado e manter a MESMA automacao PAUSED; nao entrar
> em loop, criar tarefa substituta ou reativar outro fluxo. Stop do MESMO Codespace
> apos uso e nenhuma conexao/servico de teste iniciado pode ficar solto.

**Gate de retomada:** agente conectado com prova completa + canal necessario VPS/
origem comprovado para esse escopo + nenhuma outra frente ativa + protecoes e
budget zero atuais + prompt real conferido no host. Somente entao mudar PAUSED
para ativo NA MESMA automacao, dentro da autorizacao ja dada. Hoje isso nao foi
feito, pois esses prerequisitos nao estao comprovados e o scheduler nao e exposto.
A ausencia de tool nao autoriza editar arquivos internos/credenciais do scheduler.


## Preparacao privada vigente - 22/10/2026

Decisao do proprietario recebida neste chat: copia/transferencia privada do legado
para destino protegido existente na VPS e lotes minimos no Codespace/Cursor FORA
do checkout sao autorizados sob os gates abaixo. Isso supera a restricao historica
somente-local; NAO autoriza importacao operacional nem publica dados. Origem
`BACKUP ERP ANTIGO - CODEX` permanece RO/intocada, unidade descoberta na estacao.

Esta retomada executa no sandbox /workspace, nao na estacao com HD nem na VPS/
Codespace. Nao ha canal comprovado aqui para HD ou alias SSH existente. Nenhuma
busca em backup, conexao de banco, transferencia, instalacao ou recurso foi criado.
O precheck de disco/diretorios recebido e pontual/historico e nao reserva espaco
nem comprova protecao atual. O candidato privado ainda depende de configuracao
administrativa autorizada e de evidencia pelo executor com acesso existente.

| Gate antes do primeiro byte real | Evidencia privada necessaria | Estado nesta retomada |
| --- | --- | --- |
| Origem e capacidade | inventario ja existente, bytes totais, origem RO e folga atual do destino | acesso de origem nao disponivel aqui |
| Destino isolado | caminho exato fora publico/build/operacao, identidade do host, inexistencia de links para area publica | nao comprovado aqui |
| Menor privilegio | UID/GID/modos/ACL dos pais e destino, identidades autorizadas, sem acesso publico | nao comprovado |
| Criptografia e recuperacao | protecao em repouso e transporte autenticado, responsavel/canal privado de recuperacao, prova de leitura controlada | nao comprovado; disponibilidade de gpg nao prova criptografia |
| Integridade e retomada | manifesto privado origem/destino por SHA256/bytes, lote minimo, retomada autenticada sem sobrescrever divergencias | contrato existente; nenhum lote real transferido |
| Retencao | prazo/responsavel, limite de copias, descarte autorizado so de copias e recuperacao preservada | politica especifica pendente |

Reutilizar `scripts/legado/inventario-backup-erp-antigo.sh` somente na estacao com
origem autorizada; revisar o relatorio privadamente antes de qualquer resumo.
Reutilizar `consumir-lote-staging.mjs`, `persistencia-endereco-legado.mjs` e o mapa
canonico para lotes ja reconciliados, sem novo importador nem correspondencia por
palpite. Nao executar seus modos persistentes por causa desta preparacao.
Manifestos com caminhos reais/IDs/PII e mapas ficam privados; Git recebe apenas
contratos e agregado sanitizado. Historico financeiro/comercial preserva origem;
extrato nao cria titulo/baixa e regras fiscais continuam separadas.

Acao minima externa: executor autorizado com HD/SSH existente comprova os seis
gates e registra recibo sanitizado no HANDOFF antes de transferir lote minimo.
Nao e pedido de novo ambiente/chave/token nem de relatar historico novamente.
Piloto PREPARED_NOT_AUTHORIZED, agendamento PAUSED,045-049 nao executadas.

## Historico da ferramenta e descoberta (nao e estado atual)

**Status:** `FERRAMENTA PREPARADA / INVENTÁRIO REAL PENDENTE`
**Onda:** 25 (bloqueada até autorização + staging isolado)
**Programa:** seção Onda 25 de
`docs/PROGRAMA_COMERCIAL_360_OMNICANAL_EXECUCAO_AUTONOMA.md` (PR #33)
**Política existente:** `src/components/lib/migracaoErpPolicy.js` (não duplicar)

---

## Regras absolutas

1. O backup real fica em HD externo, pasta **`BACKUP ERP ANTIGO - CODEX`**.
2. A letra da unidade **muda** (D:, E:, …). Descobrir; **não fixar** `D:`.
3. Somente leitura na origem. Nunca alterar, renomear, compactar no lugar ou
   apagar o original.
4. **Nunca** commitár o backup, cópia, dump, PII, senhas ou `.env` no GitHub.
5. No GitHub: apenas scripts, esquema, mapeamento, testes **sintéticos** e
   relatórios **agregados sanitizados**.
6. Importação real → staging isolado + reconciliação + gate próprio da Onda 25.

---

## Ferramenta neste repositório

- Script: `scripts/legado/inventario-backup-erp-antigo.sh`
- Teste sintético: `tests/legado-inventario-backup.test.js`

O script:

1. procura a pasta pelo nome em unidades candidatas (`/mnt`, `/media`,
   `/run/media`, e em ambientes Windows/WSL caminhos montados);
2. lista arquivos (extensão, bytes, mtime);
3. calcula SHA-256;
4. classifica formato provável por extensão/assinatura leve (zip, sql, bak,
   mdf/ldf, dump, csv, xlsx) **sem** extrair conteúdo sensível;
5. emite JSON/texto agregado **sem** abrir registros de clientes.

---

## Inventário inicial (quando o HD estiver montado)

```bash
# Exemplo — ajustar somente o ponto de montagem se necessário
./scripts/legado/inventario-backup-erp-antigo.sh \
  --report /tmp/legado-inventario-sanitizado.json
```

Revisar o relatório. Se aprovado para versionar um **resumo**, copiar apenas
contagens/extensões/hashes para `docs/` em lote futuro — nunca os arquivos.

---

## Mapeamento canônico (próximo lote, sem dados reais)

Reutilizar Cadastros Gerais / agregados já canônicos (Cliente, Produto,
TabelaPreco, etc.). Não criar cadastro paralelo. Campos de migração já
previstos em `migracaoErpPolicy.js` (`origem_migracao`, `lote_migracao`,
`status_migracao`, strip de segredos).

---

## Estado historico da sessao Cloud

| Item | Estado |
|---|---|
| HD externo montado no cloud agent | **não detectado** (`/mnt` sem a pasta) |
| Inventário real | **pendente** (máquina com o HD ou montagem autorizada) |
| Staging / importação | **bloqueado** (Onda 25) |
