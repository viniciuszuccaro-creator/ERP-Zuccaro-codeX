/**
 * Biblioteca de Exportação para Excel (CSV)
 * Gera arquivos CSV que podem ser abertos no Excel
 */
import { base44 } from "@/api/base44Client";

/**
 * Converte array de objetos para CSV
 * @param {array} dados - Array de objetos
 * @param {array} colunas - Array de {key, label}
 * @returns {string} - String CSV
 */
function converterParaCSV(dados, colunas) {
  if (!dados || dados.length === 0) return '';
  
  // Cabeçalho
  const cabecalho = colunas.map(col => `"${col.label}"`).join(',');
  
  // Linhas
  const linhas = dados.map(row => {
    return colunas.map(col => {
      let valor = row[col.key];
      
      // Formatação especial
      if (valor === null || valor === undefined) {
        return '"-"';
      }
      
      // Datas
      if (col.tipo === 'date' && valor) {
        valor = new Date(valor).toLocaleDateString('pt-BR');
      }
      
      // Números/Moeda
      if (col.tipo === 'moeda' && typeof valor === 'number') {
        valor = `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      }
      
      if (col.tipo === 'numero' && typeof valor === 'number') {
        valor = valor.toLocaleString('pt-BR');
      }
      
      // Escapar aspas
      const valorString = String(valor).replace(/"/g, '""');
      return `"${valorString}"`;
    }).join(',');
  }).join('\n');
  
  return `${cabecalho}\n${linhas}`;
}

/**
 * Faz download do CSV
 */
function baixarCSV(nomeArquivo, conteudoCSV) {
  // BOM para UTF-8 (Excel reconhecer acentos)
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + conteudoCSV], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', nomeArquivo);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

/**
 * Exporta Pedidos para Excel
 */
export function exportarPedidosExcel(pedidos, contexto = {}) {
  if (contexto?.enforce && contexto?.allowed === false) {
    base44.entities.AuditLog.create({ acao: 'Bloqueio', modulo: contexto.module || 'Sistema', tipo_auditoria: 'seguranca', entidade: 'Exportacao', descricao: 'Sem permissão - Pedidos', empresa_id: contexto.empresa_id || null, group_id: contexto.group_id || null, data_hora: new Date().toISOString(), sucesso: false });
    throw new Error('Sem permissão para exportar');
  }
  base44.entities.AuditLog.create({ acao: 'Exportação', modulo: contexto.module || 'Sistema', tipo_auditoria: 'ui', entidade: 'Exportacao', descricao: 'Pedidos → Excel', empresa_id: contexto.empresa_id || null, group_id: contexto.group_id || null, data_hora: new Date().toISOString(), sucesso: true });
  const colunas = [
    { key: 'numero_pedido', label: 'Nº Pedido' },
    { key: 'data_pedido', label: 'Data', tipo: 'date' },
    { key: 'cliente_nome', label: 'Cliente' },
    { key: 'vendedor', label: 'Vendedor' },
    { key: 'status', label: 'Status' },
    { key: 'valor_produtos', label: 'Valor Produtos', tipo: 'moeda' },
    { key: 'valor_desconto', label: 'Desconto', tipo: 'moeda' },
    { key: 'valor_frete', label: 'Frete', tipo: 'moeda' },
    { key: 'valor_total', label: 'Valor Total', tipo: 'moeda' },
    { key: 'forma_pagamento', label: 'Forma Pagamento' },
    { key: 'condicao_pagamento', label: 'Condição' },
    { key: 'nfe_numero', label: 'NF-e' },
  ];
  
  const csv = converterParaCSV(pedidos, colunas);
  const nomeArquivo = `pedidos_${new Date().toISOString().split('T')[0]}.csv`;
  baixarCSV(nomeArquivo, csv);
}

/**
 * Exporta Clientes para Excel
 */
export function exportarClientesExcel(clientes, contexto = {}) {
  if (contexto?.enforce && contexto?.allowed === false) { base44.entities.AuditLog.create({ acao: 'Bloqueio', modulo: contexto.module || 'Sistema', tipo_auditoria: 'seguranca', entidade: 'Exportacao', descricao: 'Sem permissão - Clientes', empresa_id: contexto.empresa_id || null, group_id: contexto.group_id || null, data_hora: new Date().toISOString(), sucesso: false }); throw new Error('Sem permissão para exportar'); }
  base44.entities.AuditLog.create({ acao: 'Exportação', modulo: contexto.module || 'Sistema', tipo_auditoria: 'ui', entidade: 'Exportacao', descricao: 'Clientes → Excel', empresa_id: contexto.empresa_id || null, group_id: contexto.group_id || null, data_hora: new Date().toISOString(), sucesso: true });
  const colunas = [
    { key: 'nome', label: 'Nome/Razão Social' },
    { key: 'tipo', label: 'Tipo' },
    { key: 'cpf', label: 'CPF' },
    { key: 'cnpj', label: 'CNPJ' },
    { key: 'inscricao_estadual', label: 'IE' },
    { key: 'email', label: 'E-mail' },
    { key: 'telefone', label: 'Telefone' },
    { key: 'cidade', label: 'Cidade' },
    { key: 'estado', label: 'UF' },
    { key: 'vendedor_responsavel', label: 'Vendedor' },
    { key: 'status', label: 'Status' },
    { key: 'classificacao_abc', label: 'Classe ABC' },
    { key: 'valor_compras_12meses', label: 'Compras 12m', tipo: 'moeda' },
  ];
  
  const dadosFormatados = clientes.map(c => ({
    ...c,
    email: c.contatos?.find(ct => ct.tipo === 'E-mail')?.valor || c.email || '-',
    telefone: c.contatos?.find(ct => ct.tipo === 'Telefone')?.valor || c.telefone || '-',
    cidade: c.endereco_principal?.cidade || '-',
    estado: c.endereco_principal?.estado || '-',
  }));
  
  const csv = converterParaCSV(dadosFormatados, colunas);
  const nomeArquivo = `clientes_${new Date().toISOString().split('T')[0]}.csv`;
  baixarCSV(nomeArquivo, csv);
}

/**
 * Exporta Contas a Receber para Excel
 */
export function exportarContasReceberExcel(contas, contexto = {}) {
  if (contexto?.enforce && contexto?.allowed === false) { base44.entities.AuditLog.create({ acao: 'Bloqueio', modulo: contexto.module || 'Sistema', tipo_auditoria: 'seguranca', entidade: 'Exportacao', descricao: 'Sem permissão - CR', empresa_id: contexto.empresa_id || null, group_id: contexto.group_id || null, data_hora: new Date().toISOString(), sucesso: false }); throw new Error('Sem permissão para exportar'); }
  base44.entities.AuditLog.create({ acao: 'Exportação', modulo: contexto.module || 'Sistema', tipo_auditoria: 'ui', entidade: 'Exportacao', descricao: 'ContasReceber → Excel', empresa_id: contexto.empresa_id || null, group_id: contexto.group_id || null, data_hora: new Date().toISOString(), sucesso: true });
  const colunas = [
    { key: 'descricao', label: 'Descrição' },
    { key: 'cliente', label: 'Cliente' },
    { key: 'numero_documento', label: 'Documento' },
    { key: 'data_emissao', label: 'Emissão', tipo: 'date' },
    { key: 'data_vencimento', label: 'Vencimento', tipo: 'date' },
    { key: 'valor', label: 'Valor', tipo: 'moeda' },
    { key: 'valor_recebido', label: 'Recebido', tipo: 'moeda' },
    { key: 'status', label: 'Status' },
    { key: 'forma_recebimento', label: 'Forma' },
    { key: 'data_recebimento', label: 'Data Receb.', tipo: 'date' },
  ];
  
  const csv = converterParaCSV(contas, colunas);
  const nomeArquivo = `contas_receber_${new Date().toISOString().split('T')[0]}.csv`;
  baixarCSV(nomeArquivo, csv);
}

/**
 * Exporta Contas a Pagar para Excel
 */
export function exportarContasPagarExcel(contas, contexto = {}) {
  if (contexto?.enforce && contexto?.allowed === false) { base44.entities.AuditLog.create({ acao: 'Bloqueio', modulo: contexto.module || 'Sistema', tipo_auditoria: 'seguranca', entidade: 'Exportacao', descricao: 'Sem permissão - CP', empresa_id: contexto.empresa_id || null, group_id: contexto.group_id || null, data_hora: new Date().toISOString(), sucesso: false }); throw new Error('Sem permissão para exportar'); }
  base44.entities.AuditLog.create({ acao: 'Exportação', modulo: contexto.module || 'Sistema', tipo_auditoria: 'ui', entidade: 'Exportacao', descricao: 'ContasPagar → Excel', empresa_id: contexto.empresa_id || null, group_id: contexto.group_id || null, data_hora: new Date().toISOString(), sucesso: true });
  const colunas = [
    { key: 'descricao', label: 'Descrição' },
    { key: 'fornecedor', label: 'Fornecedor' },
    { key: 'categoria', label: 'Categoria' },
    { key: 'numero_documento', label: 'Documento' },
    { key: 'data_emissao', label: 'Emissão', tipo: 'date' },
    { key: 'data_vencimento', label: 'Vencimento', tipo: 'date' },
    { key: 'valor', label: 'Valor', tipo: 'moeda' },
    { key: 'valor_pago', label: 'Pago', tipo: 'moeda' },
    { key: 'status', label: 'Status' },
    { key: 'forma_pagamento', label: 'Forma' },
    { key: 'data_pagamento', label: 'Data Pag.', tipo: 'date' },
  ];
  
  const csv = converterParaCSV(contas, colunas);
  const nomeArquivo = `contas_pagar_${new Date().toISOString().split('T')[0]}.csv`;
  baixarCSV(nomeArquivo, csv);
}

/**
 * Exporta Estoque para Excel
 */
export function exportarEstoqueExcel(produtos, contexto = {}) {
  if (contexto?.enforce && contexto?.allowed === false) { base44.entities.AuditLog.create({ acao: 'Bloqueio', modulo: contexto.module || 'Sistema', tipo_auditoria: 'seguranca', entidade: 'Exportacao', descricao: 'Sem permissão - Estoque', empresa_id: contexto.empresa_id || null, group_id: contexto.group_id || null, data_hora: new Date().toISOString(), sucesso: false }); throw new Error('Sem permissão para exportar'); }
  base44.entities.AuditLog.create({ acao: 'Exportação', modulo: contexto.module || 'Sistema', tipo_auditoria: 'ui', entidade: 'Exportacao', descricao: 'Estoque → Excel', empresa_id: contexto.empresa_id || null, group_id: contexto.group_id || null, data_hora: new Date().toISOString(), sucesso: true });
  const colunas = [
    { key: 'codigo', label: 'Código' },
    { key: 'descricao', label: 'Descrição' },
    { key: 'grupo', label: 'Grupo' },
    { key: 'unidade_medida', label: 'Unidade' },
    { key: 'estoque_atual', label: 'Estoque Atual', tipo: 'numero' },
    { key: 'estoque_reservado', label: 'Reservado', tipo: 'numero' },
    { key: 'estoque_disponivel', label: 'Disponível', tipo: 'numero' },
    { key: 'estoque_minimo', label: 'Mínimo', tipo: 'numero' },
    { key: 'custo_medio', label: 'Custo Médio', tipo: 'moeda' },
    { key: 'preco_venda', label: 'Preço Venda', tipo: 'moeda' },
    { key: 'localizacao', label: 'Localização' },
    { key: 'status', label: 'Status' },
  ];
  
  const csv = converterParaCSV(produtos, colunas);
  const nomeArquivo = `estoque_${new Date().toISOString().split('T')[0]}.csv`;
  baixarCSV(nomeArquivo, csv);
}

/**
 * Exporta Movimentações de Estoque para Excel
 */
export function exportarMovimentacoesExcel(movimentacoes, contexto = {}) {
  if (contexto?.enforce && contexto?.allowed === false) { base44.entities.AuditLog.create({ acao: 'Bloqueio', modulo: contexto.module || 'Sistema', tipo_auditoria: 'seguranca', entidade: 'Exportacao', descricao: 'Sem permissão - Movimentações', empresa_id: contexto.empresa_id || null, group_id: contexto.group_id || null, data_hora: new Date().toISOString(), sucesso: false }); throw new Error('Sem permissão para exportar'); }
  base44.entities.AuditLog.create({ acao: 'Exportação', modulo: contexto.module || 'Sistema', tipo_auditoria: 'ui', entidade: 'Exportacao', descricao: 'Movimentações → Excel', empresa_id: contexto.empresa_id || null, group_id: contexto.group_id || null, data_hora: new Date().toISOString(), sucesso: true });
  const colunas = [
    { key: 'data_movimentacao', label: 'Data/Hora', tipo: 'date' },
    { key: 'tipo_movimento', label: 'Tipo' },
    { key: 'produto_descricao', label: 'Produto' },
    { key: 'quantidade', label: 'Quantidade', tipo: 'numero' },
    { key: 'unidade_medida', label: 'Unidade' },
    { key: 'estoque_anterior', label: 'Estoque Anterior', tipo: 'numero' },
    { key: 'estoque_atual', label: 'Estoque Atual', tipo: 'numero' },
    { key: 'documento', label: 'Documento' },
    { key: 'responsavel', label: 'Responsável' },
    { key: 'motivo', label: 'Motivo' },
  ];
  
  const csv = converterParaCSV(movimentacoes, colunas);
  const nomeArquivo = `movimentacoes_estoque_${new Date().toISOString().split('T')[0]}.csv`;
  baixarCSV(nomeArquivo, csv);
}

/**
 * Exporta DRE para Excel
 */
export function exportarDREExcel(dre, contexto = {}) {
  if (contexto?.enforce && contexto?.allowed === false) { base44.entities.AuditLog.create({ acao: 'Bloqueio', modulo: contexto.module || 'Sistema', tipo_auditoria: 'seguranca', entidade: 'Exportacao', descricao: 'Sem permissão - DRE', empresa_id: contexto.empresa_id || null, group_id: contexto.group_id || null, data_hora: new Date().toISOString(), sucesso: false }); throw new Error('Sem permissão para exportar'); }
  base44.entities.AuditLog.create({ acao: 'Exportação', modulo: contexto.module || 'Sistema', tipo_auditoria: 'ui', entidade: 'Exportacao', descricao: 'DRE → Excel', empresa_id: contexto.empresa_id || null, group_id: contexto.group_id || null, data_hora: new Date().toISOString(), sucesso: true });
  const dados = [
    { conta: 'RECEITA BRUTA', valor: dre.receita_bruta },
    { conta: '(-) Deduções e Impostos', valor: -dre.deducoes_impostos },
    { conta: '= RECEITA LÍQUIDA', valor: dre.receita_liquida },
    { conta: '(-) CPV', valor: -dre.cpv },
    { conta: '= LUCRO BRUTO', valor: dre.lucro_bruto },
    { conta: '(-) Despesas Administrativas', valor: -dre.despesas_administrativas },
    { conta: '(-) Despesas Comerciais', valor: -dre.despesas_comerciais },
    { conta: '(-) Despesas Financeiras', valor: -dre.despesas_financeiras },
    { conta: '= LUCRO OPERACIONAL', valor: dre.lucro_operacional },
    { conta: '(+/-) Resultado Não Operacional', valor: dre.resultado_nao_operacional },
    { conta: '= LUCRO ANTES DOS TRIBUTOS', valor: dre.lucro_antes_tributos },
    { conta: '(-) IR e CSLL', valor: -dre.ir_csll },
    { conta: '= LUCRO LÍQUIDO', valor: dre.lucro_liquido },
  ];
  
  const colunas = [
    { key: 'conta', label: 'Conta' },
    { key: 'valor', label: 'Valor', tipo: 'moeda' },
  ];
  
  const csv = converterParaCSV(dados, colunas);
  const nomeArquivo = `DRE_${dre.periodo}_${new Date().toISOString().split('T')[0]}.csv`;
  baixarCSV(nomeArquivo, csv);
}

/**
 * Exporta Ordens de Produção para Excel
 */
export function exportarOrdensProducaoExcel(ops, contexto = {}) {
  if (contexto?.enforce && contexto?.allowed === false) { base44.entities.AuditLog.create({ acao: 'Bloqueio', modulo: contexto.module || 'Sistema', tipo_auditoria: 'seguranca', entidade: 'Exportacao', descricao: 'Sem permissão - OPs', empresa_id: contexto.empresa_id || null, group_id: contexto.group_id || null, data_hora: new Date().toISOString(), sucesso: false }); throw new Error('Sem permissão para exportar'); }
  base44.entities.AuditLog.create({ acao: 'Exportação', modulo: contexto.module || 'Sistema', tipo_auditoria: 'ui', entidade: 'Exportacao', descricao: 'OPs → Excel', empresa_id: contexto.empresa_id || null, group_id: contexto.group_id || null, data_hora: new Date().toISOString(), sucesso: true });
  const colunas = [
    { key: 'numero_op', label: 'Nº OP' },
    { key: 'numero_pedido', label: 'Pedido' },
    { key: 'cliente_nome', label: 'Cliente' },
    { key: 'data_emissao', label: 'Emissão', tipo: 'date' },
    { key: 'data_prevista_conclusao', label: 'Prev. Conclusão', tipo: 'date' },
    { key: 'setor_responsavel', label: 'Setor' },
    { key: 'operador_responsavel', label: 'Operador' },
    { key: 'status', label: 'Status' },
    { key: 'peso_teorico_total_kg', label: 'Peso Teórico (kg)', tipo: 'numero' },
    { key: 'peso_real_total_kg', label: 'Peso Real (kg)', tipo: 'numero' },
    { key: 'percentual_conclusao', label: '% Conclusão', tipo: 'numero' },
  ];
  
  const csv = converterParaCSV(ops, colunas);
  const nomeArquivo = `ordens_producao_${new Date().toISOString().split('T')[0]}.csv`;
  baixarCSV(nomeArquivo, csv);
}

/**
 * Exporta Entregas para Excel
 */
export function exportarEntregasExcel(entregas, contexto = {}) {
  if (contexto?.enforce && contexto?.allowed === false) { base44.entities.AuditLog.create({ acao: 'Bloqueio', modulo: contexto.module || 'Sistema', tipo_auditoria: 'seguranca', entidade: 'Exportacao', descricao: 'Sem permissão - Entregas', empresa_id: contexto.empresa_id || null, group_id: contexto.group_id || null, data_hora: new Date().toISOString(), sucesso: false }); throw new Error('Sem permissão para exportar'); }
  base44.entities.AuditLog.create({ acao: 'Exportação', modulo: contexto.module || 'Sistema', tipo_auditoria: 'ui', entidade: 'Exportacao', descricao: 'Entregas → Excel', empresa_id: contexto.empresa_id || null, group_id: contexto.group_id || null, data_hora: new Date().toISOString(), sucesso: true });
  const colunas = [
    { key: 'numero_pedido', label: 'Pedido' },
    { key: 'cliente_nome', label: 'Cliente' },
    { key: 'cidade', label: 'Cidade' },
    { key: 'data_previsao', label: 'Previsão', tipo: 'date' },
    { key: 'data_entrega', label: 'Entrega Real', tipo: 'date' },
    { key: 'motorista', label: 'Motorista' },
    { key: 'placa', label: 'Placa' },
    { key: 'status', label: 'Status' },
    { key: 'volumes', label: 'Volumes', tipo: 'numero' },
    { key: 'peso_total_kg', label: 'Peso (kg)', tipo: 'numero' },
  ];
  
  const dadosFormatados = entregas.map(e => ({
    ...e,
    cidade: e.endereco_entrega_completo?.cidade || '-',
  }));
  
  const csv = converterParaCSV(dadosFormatados, colunas);
  const nomeArquivo = `entregas_${new Date().toISOString().split('T')[0]}.csv`;
  baixarCSV(nomeArquivo, csv);
}

/**
 * Exporta Notas Fiscais para Excel
 */
export function exportarNotasFiscaisExcel(notas, contexto = {}) {
  if (contexto?.enforce && contexto?.allowed === false) { base44.entities.AuditLog.create({ acao: 'Bloqueio', modulo: contexto.module || 'Sistema', tipo_auditoria: 'seguranca', entidade: 'Exportacao', descricao: 'Sem permissão - NF-e', empresa_id: contexto.empresa_id || null, group_id: contexto.group_id || null, data_hora: new Date().toISOString(), sucesso: false }); throw new Error('Sem permissão para exportar'); }
  base44.entities.AuditLog.create({ acao: 'Exportação', modulo: contexto.module || 'Sistema', tipo_auditoria: 'ui', entidade: 'Exportacao', descricao: 'NF-e → Excel', empresa_id: contexto.empresa_id || null, group_id: contexto.group_id || null, data_hora: new Date().toISOString(), sucesso: true });
  const colunas = [
    { key: 'numero', label: 'Número' },
    { key: 'serie', label: 'Série' },
    { key: 'tipo', label: 'Tipo' },
    { key: 'cliente_fornecedor', label: 'Cliente/Fornecedor' },
    { key: 'data_emissao', label: 'Emissão', tipo: 'date' },
    { key: 'chave_acesso', label: 'Chave de Acesso' },
    { key: 'valor_produtos', label: 'Valor Produtos', tipo: 'moeda' },
    { key: 'valor_icms', label: 'ICMS', tipo: 'moeda' },
    { key: 'valor_ipi', label: 'IPI', tipo: 'moeda' },
    { key: 'valor_total', label: 'Valor Total', tipo: 'moeda' },
    { key: 'status', label: 'Status' },
    { key: 'protocolo_autorizacao', label: 'Protocolo' },
  ];
  
  const csv = converterParaCSV(notas, colunas);
  const nomeArquivo = `notas_fiscais_${new Date().toISOString().split('T')[0]}.csv`;
  baixarCSV(nomeArquivo, csv);
}

/**
 * Exporta Fornecedores para Excel
 */
export function exportarFornecedoresExcel(fornecedores, contexto = {}) {
  if (contexto?.enforce && contexto?.allowed === false) { base44.entities.AuditLog.create({ acao: 'Bloqueio', modulo: contexto.module || 'Sistema', tipo_auditoria: 'seguranca', entidade: 'Exportacao', descricao: 'Sem permissão - Fornecedores', empresa_id: contexto.empresa_id || null, group_id: contexto.group_id || null, data_hora: new Date().toISOString(), sucesso: false }); throw new Error('Sem permissão para exportar'); }
  base44.entities.AuditLog.create({ acao: 'Exportação', modulo: contexto.module || 'Sistema', tipo_auditoria: 'ui', entidade: 'Exportacao', descricao: 'Fornecedores → Excel', empresa_id: contexto.empresa_id || null, group_id: contexto.group_id || null, data_hora: new Date().toISOString(), sucesso: true });
  const colunas = [
    { key: 'nome', label: 'Nome' },
    { key: 'cnpj', label: 'CNPJ' },
    { key: 'categoria', label: 'Categoria' },
    { key: 'email', label: 'E-mail' },
    { key: 'telefone', label: 'Telefone' },
    { key: 'cidade', label: 'Cidade' },
    { key: 'estado', label: 'UF' },
    { key: 'quantidade_compras', label: 'Qtd Compras', tipo: 'numero' },
    { key: 'valor_total_compras', label: 'Valor Total', tipo: 'moeda' },
    { key: 'nota_media', label: 'Nota Média', tipo: 'numero' },
    { key: 'status', label: 'Status' },
  ];
  
  const csv = converterParaCSV(fornecedores, colunas);
  const nomeArquivo = `fornecedores_${new Date().toISOString().split('T')[0]}.csv`;
  baixarCSV(nomeArquivo, csv);
}

/**
 * Exporta Colaboradores para Excel
 */
export function exportarColaboradoresExcel(colaboradores, contexto = {}) {
  if (contexto?.enforce && contexto?.allowed === false) { base44.entities.AuditLog.create({ acao: 'Bloqueio', modulo: contexto.module || 'Sistema', tipo_auditoria: 'seguranca', entidade: 'Exportacao', descricao: 'Sem permissão - Colaboradores', empresa_id: contexto.empresa_id || null, group_id: contexto.group_id || null, data_hora: new Date().toISOString(), sucesso: false }); throw new Error('Sem permissão para exportar'); }
  base44.entities.AuditLog.create({ acao: 'Exportação', modulo: contexto.module || 'Sistema', tipo_auditoria: 'ui', entidade: 'Exportacao', descricao: 'Colaboradores → Excel', empresa_id: contexto.empresa_id || null, group_id: contexto.group_id || null, data_hora: new Date().toISOString(), sucesso: true });
  const colunas = [
    { key: 'nome_completo', label: 'Nome' },
    { key: 'cpf', label: 'CPF' },
    { key: 'cargo', label: 'Cargo' },
    { key: 'departamento', label: 'Departamento' },
    { key: 'data_admissao', label: 'Admissão', tipo: 'date' },
    { key: 'salario', label: 'Salário', tipo: 'moeda' },
    { key: 'tipo_contrato', label: 'Contrato' },
    { key: 'email', label: 'E-mail' },
    { key: 'telefone', label: 'Telefone' },
    { key: 'status', label: 'Status' },
  ];
  
  const csv = converterParaCSV(colaboradores, colunas);
  const nomeArquivo = `colaboradores_${new Date().toISOString().split('T')[0]}.csv`;
  baixarCSV(nomeArquivo, csv);
}

/**
 * Exporta Genérico para Excel
 */
export function exportarGenericoExcel(dados, colunas, nomeArquivo, contexto = {}) {
  if (contexto?.enforce && contexto?.allowed === false) { base44.entities.AuditLog.create({ acao: 'Bloqueio', modulo: contexto.module || 'Sistema', tipo_auditoria: 'seguranca', entidade: 'Exportacao', descricao: `Sem permissão - ${nomeArquivo || 'Genérico'}`, empresa_id: contexto.empresa_id || null, group_id: contexto.group_id || null, data_hora: new Date().toISOString(), sucesso: false }); throw new Error('Sem permissão para exportar'); }
  base44.entities.AuditLog.create({ acao: 'Exportação', modulo: contexto.module || 'Sistema', tipo_auditoria: 'ui', entidade: 'Exportacao', descricao: `${nomeArquivo || 'Genérico'} → Excel`, empresa_id: contexto.empresa_id || null, group_id: contexto.group_id || null, data_hora: new Date().toISOString(), sucesso: true });
  const csv = converterParaCSV(dados, colunas);
  const arquivo = nomeArquivo || `exportacao_${new Date().toISOString().split('T')[0]}.csv`;
  baixarCSV(arquivo, csv);
}

export default {
  exportarPedidosExcel,
  exportarClientesExcel,
  exportarContasReceberExcel,
  exportarContasPagarExcel,
  exportarEstoqueExcel,
  exportarMovimentacoesExcel,
  exportarDREExcel,
  exportarOrdensProducaoExcel,
  exportarEntregasExcel,
  exportarNotasFiscaisExcel,
  exportarFornecedoresExcel,
  exportarColaboradoresExcel,
  exportarGenericoExcel
};
