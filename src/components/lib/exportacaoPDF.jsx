/**
 * Biblioteca de Exportação para PDF
 * Usa window.print() com CSS otimizado
 */

/**
 * Gera PDF de Pedido
 * @param {object} pedido - Dados do pedido
 * @param {object} empresa - Dados da empresa
 */
const escapeDocumentText = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const formatDocumentMoney = (value) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL',
}).format(Number(value || 0));

export function gerarPDFOrcamento(orcamento, { empresa = {}, clienteNome = '', condicaoPagamento = '' } = {}) {
  if (!orcamento) return false;
  const empresaNome = empresa.razao_social || empresa.nome_fantasia || empresa.nome || 'Empresa emissora';
  const documentoEmpresa = empresa.cnpj || empresa.cpf_cnpj || empresa.documento || '';
  const status = orcamento.status === 'EM_ABERTO' ? 'Em aberto' : 'Cancelado';
  const html = `<!doctype html><html><head><meta charset="UTF-8"><title>Orçamento ${escapeDocumentText(orcamento.numero)}</title><style>
    @media print{@page{size:A4;margin:12mm}.no-print{display:none}}body{font-family:Arial,sans-serif;color:#1f2937;font-size:11px;margin:0}.header{display:flex;justify-content:space-between;border-bottom:3px solid #1d4ed8;padding-bottom:12px}.brand{font-size:20px;font-weight:700}.muted{color:#64748b}.title{text-align:center;font-size:18px;font-weight:700;margin:18px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}.box{border:1px solid #cbd5e1;padding:10px;border-radius:4px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #cbd5e1;padding:7px}th{background:#f1f5f9;text-align:left}.right{text-align:right}.totals{margin:16px 0 0 auto;width:280px}.total{font-size:14px;font-weight:700;border-top:2px solid #1d4ed8;padding-top:6px}.notes{white-space:pre-wrap;margin-top:16px}.footer{margin-top:28px;padding-top:10px;border-top:1px solid #cbd5e1;text-align:center;color:#64748b}</style></head><body>
    <header class="header"><div><div class="brand">${escapeDocumentText(empresaNome)}</div><div class="muted">${escapeDocumentText(documentoEmpresa)}</div></div><div class="right"><strong>Orçamento ${escapeDocumentText(orcamento.numero)}</strong><br>${escapeDocumentText(status)}</div></header>
    <div class="title">PROPOSTA COMERCIAL</div><section class="grid"><div class="box"><strong>Cliente</strong><br>${escapeDocumentText(clienteNome)}</div><div class="box"><strong>Condição de pagamento</strong><br>${escapeDocumentText(condicaoPagamento)}<br><strong>Validade</strong>: ${escapeDocumentText(new Date(orcamento.validade_em).toLocaleDateString('pt-BR'))}</div></section>
    <table><thead><tr><th>Item</th><th>Descrição</th><th>Un.</th><th class="right">Quantidade</th><th class="right">Preço</th><th class="right">Desconto</th><th class="right">Total</th></tr></thead><tbody>${(orcamento.itens || []).map((item, index) => `<tr><td>${index + 1}</td><td>${escapeDocumentText(item.descricao)}</td><td>${escapeDocumentText(item.unidade_sigla)}</td><td class="right">${escapeDocumentText(item.quantidade)}</td><td class="right">${escapeDocumentText(formatDocumentMoney(item.preco_unitario))}</td><td class="right">${escapeDocumentText(formatDocumentMoney(item.desconto))}</td><td class="right">${escapeDocumentText(formatDocumentMoney(item.total))}</td></tr>`).join('')}</tbody></table>
    <div class="totals"><div>Subtotal: <span style="float:right">${escapeDocumentText(formatDocumentMoney(orcamento.subtotal))}</span></div><div>Desconto: <span style="float:right">${escapeDocumentText(formatDocumentMoney(orcamento.desconto))}</span></div><div class="total">Total: <span style="float:right">${escapeDocumentText(formatDocumentMoney(orcamento.total))}</span></div></div>
    <div class="notes"><strong>Observações</strong><br>${escapeDocumentText(orcamento.observacoes || 'Sem observações.')}</div><footer class="footer">Documento gerado em ${escapeDocumentText(new Date().toLocaleString('pt-BR'))} pelo ERP Zuccaro</footer></body></html>`;
  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;
  printWindow.opener = null;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => setTimeout(() => printWindow.print(), 250);
  return true;
}
export function gerarPDFPedido(pedido, empresa = {}) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Pedido ${pedido.numero_pedido}</title>
      <style>
        @media print {
          @page { margin: 1cm; size: A4; }
          body { margin: 0; padding: 0; }
        }
        
        body {
          font-family: Arial, sans-serif;
          font-size: 11pt;
          color: #333;
          line-height: 1.4;
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: start;
          border-bottom: 3px solid #2563eb;
          padding-bottom: 15px;
          margin-bottom: 20px;
        }
        
        .logo {
          font-size: 24pt;
          font-weight: bold;
          color: #2563eb;
        }
        
        .info-empresa {
          text-align: right;
          font-size: 9pt;
        }
        
        .titulo-documento {
          text-align: center;
          background: #2563eb;
          color: white;
          padding: 10px;
          font-size: 18pt;
          font-weight: bold;
          margin-bottom: 20px;
        }
        
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }
        
        .info-box {
          border: 1px solid #ddd;
          padding: 10px;
          border-radius: 5px;
        }
        
        .info-box h3 {
          margin: 0 0 10px 0;
          font-size: 12pt;
          color: #2563eb;
          border-bottom: 1px solid #ddd;
          padding-bottom: 5px;
        }
        
        .info-row {
          display: flex;
          margin-bottom: 5px;
        }
        
        .info-label {
          font-weight: bold;
          width: 140px;
          flex-shrink: 0;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
          font-size: 10pt;
        }
        
        table thead {
          background: #f1f5f9;
        }
        
        table th {
          border: 1px solid #cbd5e1;
          padding: 8px;
          text-align: left;
          font-weight: bold;
        }
        
        table td {
          border: 1px solid #cbd5e1;
          padding: 8px;
        }
        
        .text-right {
          text-align: right;
        }
        
        .totais {
          margin-top: 20px;
          display: flex;
          justify-content: flex-end;
        }
        
        .totais-box {
          border: 2px solid #2563eb;
          padding: 15px;
          width: 300px;
          background: #f8fafc;
        }
        
        .total-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        
        .total-final {
          font-size: 14pt;
          font-weight: bold;
          color: #2563eb;
          border-top: 2px solid #2563eb;
          margin-top: 8px;
          padding-top: 8px;
        }
        
        .footer {
          margin-top: 30px;
          border-top: 1px solid #ddd;
          padding-top: 15px;
          font-size: 9pt;
          text-align: center;
          color: #64748b;
        }
        
        .observacoes {
          margin-top: 20px;
          border: 1px solid #ddd;
          padding: 10px;
          background: #fef3c7;
        }
        
        .badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 3px;
          font-size: 9pt;
          font-weight: bold;
        }
        
        .badge-aprovado { background: #dcfce7; color: #166534; }
        .badge-rascunho { background: #f1f5f9; color: #475569; }
        .badge-urgente { background: #fee2e2; color: #991b1b; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="logo">${empresa.nome_fantasia || 'ERP Zuccaro'}</div>
          <div style="font-size: 9pt; color: #64748b; margin-top: 5px;">
            ${empresa.razao_social || ''}
          </div>
        </div>
        <div class="info-empresa">
          <div><strong>CNPJ:</strong> ${empresa.cnpj || '-'}</div>
          <div><strong>IE:</strong> ${empresa.inscricao_estadual || '-'}</div>
          <div>${empresa.endereco?.logradouro || ''}, ${empresa.endereco?.numero || ''}</div>
          <div>${empresa.endereco?.cidade || ''} - ${empresa.endereco?.estado || ''}</div>
          <div>${empresa.contato?.telefone || ''}</div>
        </div>
      </div>
      
      <div class="titulo-documento">
        PEDIDO Nº ${pedido.numero_pedido}
      </div>
      
      <div class="info-grid">
        <div class="info-box">
          <h3>Dados do Cliente</h3>
          <div class="info-row">
            <span class="info-label">Cliente:</span>
            <span>${pedido.cliente_nome}</span>
          </div>
          <div class="info-row">
            <span class="info-label">CPF/CNPJ:</span>
            <span>${pedido.cliente_cpf_cnpj || '-'}</span>
          </div>
          ${pedido.contatos_cliente?.[0] ? `
            <div class="info-row">
              <span class="info-label">Contato:</span>
              <span>${pedido.contatos_cliente[0].valor}</span>
            </div>
          ` : ''}
          <div class="info-row">
            <span class="info-label">Endereço:</span>
            <span>
              ${pedido.endereco_entrega_principal?.logradouro || ''}, 
              ${pedido.endereco_entrega_principal?.numero || ''} - 
              ${pedido.endereco_entrega_principal?.cidade || ''}/
              ${pedido.endereco_entrega_principal?.estado || ''}
            </span>
          </div>
        </div>
        
        <div class="info-box">
          <h3>Dados do Pedido</h3>
          <div class="info-row">
            <span class="info-label">Data:</span>
            <span>${new Date(pedido.data_pedido).toLocaleDateString('pt-BR')}</span>
          </div>
          ${pedido.vendedor ? `
            <div class="info-row">
              <span class="info-label">Vendedor:</span>
              <span>${pedido.vendedor}</span>
            </div>
          ` : ''}
          <div class="info-row">
            <span class="info-label">Status:</span>
            <span class="badge badge-${pedido.status === 'Aprovado' ? 'aprovado' : 'rascunho'}">
              ${pedido.status}
            </span>
          </div>
          ${pedido.prioridade === 'Urgente' ? `
            <div class="info-row">
              <span class="info-label">Prioridade:</span>
              <span class="badge badge-urgente">URGENTE</span>
            </div>
          ` : ''}
          <div class="info-row">
            <span class="info-label">Forma Pagamento:</span>
            <span>${pedido.forma_pagamento || '-'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Condição:</span>
            <span>${pedido.condicao_pagamento || '-'}</span>
          </div>
        </div>
      </div>
      
      ${pedido.itens_revenda?.length > 0 ? `
        <h3 style="margin-top: 25px; color: #2563eb;">Itens de Revenda</h3>
        <table>
          <thead>
            <tr>
              <th style="width: 50px;">Item</th>
              <th>Descrição</th>
              <th style="width: 80px;">Qtd</th>
              <th style="width: 100px;">Valor Unit.</th>
              <th style="width: 120px;">Valor Total</th>
            </tr>
          </thead>
          <tbody>
            ${pedido.itens_revenda.map((item, idx) => `
              <tr>
                <td class="text-right">${idx + 1}</td>
                <td>${item.descricao}</td>
                <td class="text-right">${item.quantidade} ${item.unidade || 'UN'}</td>
                <td class="text-right">R$ ${item.preco_unitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td class="text-right">R$ ${item.valor_item.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}
      
      ${pedido.itens_producao?.length > 0 ? `
        <h3 style="margin-top: 25px; color: #2563eb;">Itens de Produção</h3>
        <table>
          <thead>
            <tr>
              <th style="width: 50px;">Item</th>
              <th>Descrição</th>
              <th style="width: 80px;">Qtd</th>
              <th style="width: 100px;">Peso (kg)</th>
              <th style="width: 120px;">Valor Total</th>
            </tr>
          </thead>
          <tbody>
            ${pedido.itens_producao.map((item, idx) => `
              <tr>
                <td class="text-right">${idx + 1}</td>
                <td>
                  ${item.tipo_peca} - ${item.identificador || ''}<br/>
                  <small>${item.comprimento || 0}cm x ${item.largura || 0}cm - Bitola: ${item.ferro_principal_bitola || '-'}</small>
                </td>
                <td class="text-right">${item.quantidade}</td>
                <td class="text-right">${(item.peso_total_kg || 0).toFixed(2)}</td>
                <td class="text-right">R$ ${(item.preco_venda_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}
      
      <div class="totais">
        <div class="totais-box">
          <div class="total-row">
            <span>Subtotal:</span>
            <span>R$ ${(pedido.valor_produtos || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          ${pedido.valor_desconto > 0 ? `
            <div class="total-row" style="color: #dc2626;">
              <span>Desconto:</span>
              <span>- R$ ${pedido.valor_desconto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          ` : ''}
          ${pedido.valor_frete > 0 ? `
            <div class="total-row">
              <span>Frete:</span>
              <span>R$ ${pedido.valor_frete.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          ` : ''}
          <div class="total-row total-final">
            <span>TOTAL:</span>
            <span>R$ ${(pedido.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>
      
      ${pedido.observacoes_publicas ? `
        <div class="observacoes">
          <strong>Observações:</strong><br/>
          ${pedido.observacoes_publicas}
        </div>
      ` : ''}
      
      <div class="footer">
        <div>Documento gerado em ${new Date().toLocaleString('pt-BR')}</div>
        <div style="margin-top: 5px;">ERP Zuccaro - Sistema de Gestão Empresarial</div>
      </div>
    </body>
    </html>
  `;
  
  // Abrir em nova janela e imprimir
  const printWindow = window.open('', '_blank');
  printWindow.document.write(html);
  printWindow.document.close();
  
  // Aguardar carregamento e imprimir
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };
}

/**
 * Gera PDF de Romaneio
 */
export function gerarPDFRomaneio(romaneio, entregas = [], empresa = {}) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Romaneio ${romaneio.numero_romaneio}</title>
      <style>
        @media print {
          @page { margin: 1cm; size: A4 landscape; }
          body { margin: 0; padding: 0; }
        }
        
        body {
          font-family: Arial, sans-serif;
          font-size: 10pt;
          color: #333;
        }
        
        .header {
          background: #1e40af;
          color: white;
          padding: 15px;
          margin-bottom: 15px;
        }
        
        .header h1 {
          margin: 0;
          font-size: 20pt;
        }
        
        .info-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-bottom: 15px;
        }
        
        .info-item {
          background: #f1f5f9;
          padding: 8px;
          border-radius: 4px;
        }
        
        .info-label {
          font-weight: bold;
          font-size: 9pt;
          color: #64748b;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 9pt;
        }
        
        table thead {
          background: #334155;
          color: white;
        }
        
        table th {
          border: 1px solid #475569;
          padding: 6px;
          text-align: left;
        }
        
        table td {
          border: 1px solid #cbd5e1;
          padding: 6px;
        }
        
        .assinatura-box {
          margin-top: 40px;
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 30px;
        }
        
        .assinatura {
          text-align: center;
          padding-top: 50px;
          border-top: 1px solid #333;
        }
        
        .footer {
          margin-top: 20px;
          text-align: center;
          font-size: 8pt;
          color: #64748b;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>ROMANEIO DE ENTREGA</h1>
        <div>Nº ${romaneio.numero_romaneio} - ${new Date(romaneio.data_romaneio).toLocaleDateString('pt-BR')}</div>
      </div>
      
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">MOTORISTA</div>
          <div>${romaneio.motorista}</div>
          <div style="font-size: 8pt; color: #64748b;">${romaneio.motorista_telefone || ''}</div>
        </div>
        <div class="info-item">
          <div class="info-label">VEÍCULO</div>
          <div>${romaneio.veiculo || '-'}</div>
          <div style="font-size: 8pt; color: #64748b;">Placa: ${romaneio.placa || '-'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">RESUMO</div>
          <div>${romaneio.quantidade_entregas || 0} entregas</div>
          <div style="font-size: 8pt; color: #64748b;">${romaneio.quantidade_volumes || 0} volumes - ${(romaneio.peso_total_kg || 0).toFixed(0)} kg</div>
        </div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th style="width: 40px;">Seq</th>
            <th>Cliente</th>
            <th>Endereço</th>
            <th>Cidade</th>
            <th style="width: 100px;">Pedido</th>
            <th style="width: 80px;">Volumes</th>
            <th style="width: 120px;">Assinatura</th>
          </tr>
        </thead>
        <tbody>
          ${entregas.map((entrega, idx) => `
            <tr>
              <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
              <td>${entrega.cliente_nome}</td>
              <td>
                ${entrega.endereco_entrega_completo?.logradouro || ''}, 
                ${entrega.endereco_entrega_completo?.numero || ''}
              </td>
              <td>${entrega.endereco_entrega_completo?.cidade || ''}</td>
              <td>${entrega.numero_pedido}</td>
              <td style="text-align: center;">${entrega.volumes || 1}</td>
              <td style="height: 40px;"></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="assinatura-box">
        <div class="assinatura">
          <div>Motorista</div>
        </div>
        <div class="assinatura">
          <div>Conferente</div>
        </div>
        <div class="assinatura">
          <div>Responsável Expedição</div>
        </div>
      </div>
      
      <div class="footer">
        Emitido em ${new Date().toLocaleString('pt-BR')} - ERP Zuccaro
      </div>
    </body>
    </html>
  `;
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    setTimeout(() => printWindow.print(), 250);
  };
}

/**
 * Gera PDF de NF-e (DANFE Simplificado)
 */
export function gerarPDFNotaFiscal(nfe, empresa = {}) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>NF-e ${nfe.numero}</title>
      <style>
        @media print {
          @page { margin: 0.5cm; size: A4; }
        }
        
        body {
          font-family: 'Courier New', monospace;
          font-size: 9pt;
          margin: 0;
          padding: 10px;
        }
        
        .danfe-header {
          border: 2px solid #000;
          padding: 10px;
          margin-bottom: 10px;
        }
        
        .danfe-title {
          text-align: center;
          font-size: 14pt;
          font-weight: bold;
          margin-bottom: 10px;
        }
        
        .chave-acesso {
          text-align: center;
          font-size: 8pt;
          margin-top: 5px;
          word-break: break-all;
        }
        
        .section {
          border: 1px solid #000;
          padding: 5px;
          margin-bottom: 5px;
        }
        
        .section-title {
          background: #000;
          color: #fff;
          padding: 3px 5px;
          font-weight: bold;
          margin: -5px -5px 5px -5px;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 8pt;
        }
        
        table th, table td {
          border: 1px solid #000;
          padding: 3px;
        }
        
        table th {
          background: #e5e7eb;
          font-weight: bold;
        }
        
        .text-right { text-align: right; }
        .text-center { text-align: center; }
      </style>
    </head>
    <body>
      <div class="danfe-header">
        <div class="danfe-title">DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA</div>
        <div class="text-center" style="font-size: 11pt; margin: 10px 0;">
          NF-e Nº ${nfe.numero} - Série ${nfe.serie}
        </div>
        ${nfe.chave_acesso ? `
          <div class="chave-acesso">
            CHAVE DE ACESSO: ${nfe.chave_acesso.match(/.{1,4}/g)?.join(' ') || nfe.chave_acesso}
          </div>
        ` : ''}
      </div>
      
      <div class="section">
        <div class="section-title">EMITENTE</div>
        <div><strong>${empresa.razao_social || empresa.nome_fantasia}</strong></div>
        <div>CNPJ: ${empresa.cnpj} | IE: ${empresa.inscricao_estadual || '-'}</div>
        <div>${empresa.endereco?.logradouro}, ${empresa.endereco?.numero} - ${empresa.endereco?.cidade}/${empresa.endereco?.estado}</div>
      </div>
      
      <div class="section">
        <div class="section-title">DESTINATÁRIO</div>
        <div><strong>${nfe.cliente_fornecedor}</strong></div>
        <div>CPF/CNPJ: ${nfe.cliente_cpf_cnpj || '-'}</div>
        ${nfe.cliente_endereco ? `
          <div>
            ${nfe.cliente_endereco.logradouro}, ${nfe.cliente_endereco.numero} - 
            ${nfe.cliente_endereco.cidade}/${nfe.cliente_endereco.estado}
          </div>
        ` : ''}
      </div>
      
      <table style="margin-top: 10px;">
        <thead>
          <tr>
            <th style="width: 40px;">Item</th>
            <th>Descrição</th>
            <th style="width: 60px;">NCM</th>
            <th style="width: 50px;">Qtd</th>
            <th style="width: 80px;">Valor Unit.</th>
            <th style="width: 100px;">Valor Total</th>
          </tr>
        </thead>
        <tbody>
          ${nfe.itens?.map((item, idx) => `
            <tr>
              <td class="text-center">${idx + 1}</td>
              <td>${item.descricao}</td>
              <td class="text-center">${item.ncm || '-'}</td>
              <td class="text-right">${item.quantidade}</td>
              <td class="text-right">R$ ${(item.valor_unitario || 0).toFixed(2)}</td>
              <td class="text-right">R$ ${(item.valor_total || 0).toFixed(2)}</td>
            </tr>
          `).join('') || '<tr><td colspan="6" class="text-center">Nenhum item</td></tr>'}
        </tbody>
      </table>
      
      <div style="display: grid; grid-template-columns: 1fr 300px; gap: 10px; margin-top: 10px;">
        <div class="section">
          <div class="section-title">DADOS ADICIONAIS</div>
          <div style="font-size: 8pt;">
            ${nfe.observacoes || 'Sem observações'}
          </div>
        </div>
        
        <div class="section">
          <div class="section-title">CÁLCULO DO IMPOSTO</div>
          <div style="font-size: 8pt;">
            <div>Base ICMS: R$ ${(nfe.base_calculo_icms || 0).toFixed(2)}</div>
            <div>Valor ICMS: R$ ${(nfe.valor_icms || 0).toFixed(2)}</div>
            <div>Valor IPI: R$ ${(nfe.valor_ipi || 0).toFixed(2)}</div>
            <div style="margin-top: 5px; padding-top: 5px; border-top: 1px solid #000; font-weight: bold;">
              TOTAL: R$ ${(nfe.valor_total || 0).toFixed(2)}
            </div>
          </div>
        </div>
      </div>
      
      ${nfe.status === 'Autorizada' && nfe.protocolo_autorizacao ? `
        <div style="margin-top: 10px; text-align: center; font-size: 8pt; border: 1px solid #000; padding: 5px;">
          <strong>NF-e AUTORIZADA</strong> - Protocolo: ${nfe.protocolo_autorizacao} - 
          Data: ${new Date(nfe.data_autorizacao).toLocaleString('pt-BR')}
        </div>
      ` : ''}
      
      <div style="margin-top: 15px; text-align: center; font-size: 7pt; color: #666;">
        Este documento é uma representação gráfica simplificada da NF-e.
        Consulte a autenticidade em: www.nfe.fazenda.gov.br/portal
      </div>
    </body>
    </html>
  `;
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    setTimeout(() => printWindow.print(), 250);
  };
}

/**
 * Gera PDF de Ordem de Produção
 */
export function gerarPDFOrdemProducao(op, empresa = {}) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>OP ${op.numero_op}</title>
      <style>
        @media print {
          @page { margin: 1cm; size: A4; }
        }
        
        body { font-family: Arial, sans-serif; font-size: 10pt; }
        
        .header {
          background: #7c3aed;
          color: white;
          padding: 15px;
          margin-bottom: 15px;
        }
        
        .header h1 { margin: 0; font-size: 18pt; }
        
        .info-box {
          border: 1px solid #ddd;
          padding: 10px;
          margin-bottom: 10px;
          background: #fafafa;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 15px;
        }
        
        table th, table td {
          border: 1px solid #ccc;
          padding: 6px;
          font-size: 9pt;
        }
        
        table th {
          background: #e0e7ff;
          font-weight: bold;
        }
        
        .checklist {
          margin-top: 20px;
          border: 2px solid #7c3aed;
          padding: 10px;
        }
        
        .checkbox {
          display: inline-block;
          width: 15px;
          height: 15px;
          border: 2px solid #333;
          margin-right: 8px;
          vertical-align: middle;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>ORDEM DE PRODUÇÃO Nº ${op.numero_op}</h1>
        <div>Cliente: ${op.cliente_nome} | Pedido: ${op.numero_pedido}</div>
      </div>
      
      <div class="info-box">
        <strong>Data Emissão:</strong> ${new Date(op.data_emissao).toLocaleDateString('pt-BR')} | 
        <strong>Previsão Início:</strong> ${op.data_prevista_inicio ? new Date(op.data_prevista_inicio).toLocaleDateString('pt-BR') : '-'} | 
        <strong>Previsão Conclusão:</strong> ${op.data_prevista_conclusao ? new Date(op.data_prevista_conclusao).toLocaleDateString('pt-BR') : '-'}
      </div>
      
      <div class="info-box">
        <strong>Setor:</strong> ${op.setor_responsavel || '-'} | 
        <strong>Operador:</strong> ${op.operador_responsavel || '-'} | 
        <strong>Prioridade:</strong> ${op.prioridade || 'Normal'}
      </div>
      
      <h3 style="color: #7c3aed; margin-top: 20px;">ITENS A PRODUZIR</h3>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Tipo/Descrição</th>
            <th>Qtd</th>
            <th>Bitola Principal</th>
            <th>Comprimento</th>
            <th>Estribo</th>
            <th>Peso (kg)</th>
          </tr>
        </thead>
        <tbody>
          ${op.itens_producao?.map((item, idx) => `
            <tr>
              <td style="text-align: center;">${idx + 1}</td>
              <td>${item.tipo_peca} - ${item.elemento || ''}</td>
              <td style="text-align: center;">${item.quantidade_pecas}</td>
              <td>${item.bitola_principal} (${item.quantidade_barras_principal}x)</td>
              <td>${item.comprimento_barra || 0}cm</td>
              <td>${item.estribo_bitola || '-'} (${item.estribo_quantidade_calculada || 0}x)</td>
              <td style="text-align: right;">${(item.peso_teorico_total || 0).toFixed(2)}</td>
            </tr>
          `).join('') || '<tr><td colspan="7" style="text-align: center;">Nenhum item</td></tr>'}
        </tbody>
      </table>
      
      <div class="checklist">
        <h4 style="margin-top: 0;">CHECKLIST DE QUALIDADE</h4>
        <div><span class="checkbox"></span> Bitola principal conferida</div>
        <div><span class="checkbox"></span> Comprimento conferido</div>
        <div><span class="checkbox"></span> Dobras corretas</div>
        <div><span class="checkbox"></span> Estribos corretos</div>
        <div><span class="checkbox"></span> Peso bateu</div>
        <div><span class="checkbox"></span> Acabamento OK</div>
      </div>
      
      <div style="margin-top: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 50px;">
        <div style="text-align: center; padding-top: 50px; border-top: 1px solid #000;">
          Operador Responsável
        </div>
        <div style="text-align: center; padding-top: 50px; border-top: 1px solid #000;">
          Supervisor de Qualidade
        </div>
      </div>
    </body>
    </html>
  `;
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    setTimeout(() => printWindow.print(), 250);
  };
}

/**
 * Gera PDF de Relatório Genérico
 */
export function gerarPDFRelatorio(titulo, dados, colunas, empresa = {}) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${titulo}</title>
      <style>
        @media print {
          @page { margin: 1cm; size: A4 landscape; }
        }
        
        body {
          font-family: Arial, sans-serif;
          font-size: 9pt;
        }
        
        .header {
          text-align: center;
          margin-bottom: 20px;
        }
        
        .header h1 {
          margin: 0;
          font-size: 18pt;
          color: #1e40af;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
        }
        
        table th, table td {
          border: 1px solid #cbd5e1;
          padding: 6px;
          font-size: 9pt;
        }
        
        table th {
          background: #dbeafe;
          font-weight: bold;
        }
        
        .footer {
          margin-top: 20px;
          text-align: center;
          font-size: 8pt;
          color: #64748b;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${titulo}</h1>
        <div>Gerado em ${new Date().toLocaleString('pt-BR')}</div>
      </div>
      
      <table>
        <thead>
          <tr>
            ${colunas.map(col => `<th>${col.label}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${dados.map(row => `
            <tr>
              ${colunas.map(col => `<td>${row[col.key] || '-'}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="footer">
        ${empresa.nome_fantasia || 'ERP Zuccaro'} - Total de ${dados.length} registros
      </div>
    </body>
    </html>
  `;
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    setTimeout(() => printWindow.print(), 250);
  };
}

export default {
  gerarPDFPedido,
  gerarPDFRomaneio,
  gerarPDFNotaFiscal,
  gerarPDFOrdemProducao,
  gerarPDFRelatorio
};