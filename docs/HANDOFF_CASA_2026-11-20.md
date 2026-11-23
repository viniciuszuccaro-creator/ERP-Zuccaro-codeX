# ERP CPA — retomada de Casa em 20/11/2026

> **Atualização 23/11/2026 (America/Sao_Paulo):** o lote privado de **5.423 já foi persistido**
> no tip Casa (`bf2f02810` / topo de `docs/HANDOFF_ATUAL.md`): **5.384 em revisão + 39 no
> histórico**, 17.472 mestres preservados, **não reaplicar**. Os itens 2–4 da ordem Casa
> abaixo, no trecho que mandava gravar/ensaiar/transferir esse volume, estão **supersedidos**.
> Próximo Casa: backup agendado + margem de disco; preflight/promote faturamento; Obras/Preços
> quando houver lote apto. Escopo Cursor (seção final) permanece válido. Detalhe canônico:
> `HANDOFF.md` na raiz.

## Estado confirmado em 19/11 (histórico; supersedido parcialmente em 23/11)

Base registrada: `467612bdedfa384f70f12a5c080c08b7abfae10b`. Confira se há sucessor na branch `codex/casa-fechamento-hml-20261114`. A HML registrou API `a305a143`; reconfirme web e API no ambiente. A rodada de 10.871 registros fechou em 22 grupos. O manifesto unitário 849ba70c também foi aplicado, relido no banco e conciliado. HML com 17.472 clientes; falta conferir o cadastro novo na sessão autenticada. Preserve ambos os recibos e pule as cargas concluídas.

**Pacote 5.423 — estado em 23/11 (substitui o parágrafo de “falta persistência” de 19/11):**
rodada encerrada com 5.384 em revisão e 39 no histórico; recibos privados preservados;
**não reaplicar**. A leitura do HD externo já foi validada na Empresa. Recalcule a folga de
disco no dia. Original da VPS e HD preservados.

## Ordem de execução — Codex Casa

1. Conecte o HD. Confira o checkout, trabalho local, sessão e acessos existentes. Execute git fetch origin e leia AGENTS.md, STATUS_DO_PROJETO.md, docs/HANDOFF_ATUAL.md e `HANDOFF.md` na branch de continuidade. Esta branch é documental; comece o código a partir do HEAD de continuidade verificado, em worktree Codex se houver mudanças locais. Preserve as branches Cursor. Consulte índice e recibos privados centrais — **reaproveitar recibos do 5.423 já aplicado; não extrair nem regravar esse volume**. Descubra o volume do HD pelo conteúdo e verifique tamanho e SHA da cópia conforme os recibos. Use cópia de trabalho em leitor SQL isolado. Mantenha o original intacto. A presença do HD em Casa permite ler a fonte. Qualquer rotina de backup externo que exija o destino Empresa continua usando o destino autorizado.
2. ~~Primeira gravação / ensaio / transferência do volume 5.423~~ — **CONCLUÍDO** (5.384 revisão + 39 histórico). Não repetir. Se precisar de novas identidades em revisão, trate como lote **novo** com manifesto e autorização próprios, sem reabrir o recibo encerrado.
3. Feche a prova de backup agendado (timeout de snapshot, publicação autorizada do serviço, restauração e cópia externa) e a margem de disco vs reserva antes de qualquer escrita HML nova.
4. Preflight/promote do faturamento/baixa HTTP (clone → HML) com DDL/ACL, dependências Pedido/centros/planos e aceite browser — informe ao Cursor quando o contrato §7 de `HANDOFF.md` estiver na HML.
5. Siga com endereços, catálogo/unidades/preços, condições de pagamento e financeiro histórico em rodadas independentes. Preserve empresa e identidade de origem, revalide os vínculos das Obras após cada carga e confirme vigência de preço e saldo de títulos pela fonte. Obras/Preços hoje **sem lote apto** (falta prova de empresa / calendário / vínculos).
6. Feche o backend da jornada de venda. Reuse o cálculo de parcelas e a regressão até Pedido/Expedição. Faça faturar via HTTP no clone, persistir título, registrar recebimento e confirmar saldo zero, auditoria e ausência de duplicatas. Prove rollback e isolamento por empresa. Informe ao Cursor o contrato confirmado. Teste frontend integrado na HML publicada quando autorizado, com emissão externa, cobrança e mensagens sem efeitos reais. Produção tem aceite próprio.
7. Faça commit/push de cada pacote validado, atualize o handoff sanitizado e continue a próxima etapa liberada enquanto CI/ensaio/transferência roda. Feche com SHA, testes, versões servidas, contagens ensaiadas/transferidas/gravadas/conciliadas, espaço e próximo comando executável.

## Ordem de execução — Cursor | somente frontend e visual

1. Leia AGENTS.md, `HANDOFF.md` e este handoff. Trabalhe em branch frontend própria, a partir do HEAD validado mais recente do seu trabalho. Confira as PRs #595 e #596 antes de portar trechos. Preserve as proteções de troca de cliente/empresa e revogação de acesso já presentes no candidato. Combine com Codex a divisão quando houver arquivos compartilhados.
2. Priorize a Central de Vendas 360° no layout v6 aprovado. Melhore navegação, consistência visual, responsividade, pesquisa e estados de carregamento/vazio/erro. Valide orçamento salvo e reaberto, seletor de entrega, totais e navegação para financeiro. Reaproveite Cadastro e Dashboard existentes e a referência Base44 para recuperar capacidades úteis. Preserve campos, permissões e funções vigentes.
3. Consuma somente contratos de API comprovados e disponibilizados pelo Codex. Enquanto faltar faturamento/baixa na HML, preserve o estado indisponível informado ao operador e use fixtures sintéticas para desenvolvimento e teste. Evite simular sucesso na HML.
4. Escopo Cursor: componentes, páginas, estilos, acessibilidade, adaptação de cliente HTTP a contrato confirmado e testes de frontend. Encaminhe ao Codex requisitos de API, banco, migrations, importação, VPS e deploy. Use fixtures e evidências sanitizadas.
5. Entregue diff, testes, build e prova de navegador em desktop e telas menores. Publique na própria branch/PR, registre o SHA e informe ao Codex precisamente quais deltas devem ser integrados. O Codex compõe e testa a jornada inteira.
