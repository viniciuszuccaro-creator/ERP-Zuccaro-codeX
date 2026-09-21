# Descoberta legada segura

`Discover-LegacyBackup.ps1` localiza a pasta configurada em volumes removiveis ou fixos e produz somente inventario agregado por extensao, tamanho e volume. Ele nao modifica, copia, executa, abre conteudo ou grava o backup no repositorio.

Execute fora da pasta do backup. Use um destino local ignorado pelo Git para o relatorio. Nunca envie o relatorio se ele tiver caminhos internos ou dados reais.
