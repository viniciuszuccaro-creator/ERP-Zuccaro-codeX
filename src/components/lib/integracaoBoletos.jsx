/**
 * Biblioteca de Integração Boletos e PIX Real
 * Suporta: Asaas, Juno, Mercado Pago
 */

import { base44 } from '@/api/base44Client';
import { normalizeIdentifier, recordMatchesEmpresaScope } from '@/components/lib/contextoMultiempresaPolicy';

/**
 * Verifica configuração do gateway
 */
async function verificarConfiguracao(empresaId) {
  const scopedEmpresaId = normalizeIdentifier(empresaId);
  if (!scopedEmpresaId) {
    return { configurado: false, erro: 'Empresa obrigatoria para configuracao de integracoes' };
  }

  const chave = `integracoes_${scopedEmpresaId}`;
  const registros = await base44.entities.ConfiguracaoSistema.filter({ chave, categoria: 'Integracoes', empresa_id: scopedEmpresaId }, undefined, 1);

  if (!registros || registros.length === 0) {
    return { configurado: false, erro: 'Configuração de integrações não encontrada' };
  }

  const cfg = registros[0];
  const integracao = cfg.integracao_boletos || {};

  if (!integracao.ativo) {
    return { configurado: false, erro: 'Integração não está ativa', config: cfg };
  }

  if (!integracao.api_key) {
    return { configurado: false, erro: 'API Key não configurada', config: cfg };
  }

  return { configurado: true, config: cfg, integracao };
}

/**
 * Gerar Boleto via Asaas
 */
async function buscarClienteDaEmpresa(clienteId, empresaId) {
  const scopedClienteId = normalizeIdentifier(clienteId);
  const scopedEmpresaId = normalizeIdentifier(empresaId);

  if (!scopedClienteId || !scopedEmpresaId) {
    throw new Error('Cliente e empresa obrigatorios para integracao de cobranca');
  }

  const clientesDiretos = await base44.entities.Cliente.filter({ id: scopedClienteId, empresa_id: scopedEmpresaId }, undefined, 1);
  const clienteDireto = clientesDiretos?.[0];
  if (clienteDireto) return clienteDireto;

  const clientesDono = await base44.entities.Cliente.filter({ id: scopedClienteId, empresa_dona_id: scopedEmpresaId }, undefined, 1);
  const clienteDono = clientesDono?.[0];
  if (clienteDono) return clienteDono;

  const clientes = await base44.entities.Cliente.filter({ id: scopedClienteId }, undefined, 1);
  const cliente = clientes?.[0];
  if (recordMatchesEmpresaScope(cliente, scopedEmpresaId)) return cliente;

  throw new Error('Cliente nao pertence a empresa da cobranca');
}

async function gerarBoletoAsaas(conta, config) {
  const apiKey = config.api_key;
  const urlBase = config.api_url || 'https://www.asaas.com/api/v3';
  const multaPercent = (config.multa_percentual ?? config.multa_pos_vencimento_percent ?? 0);
  const jurosPercent = (config.juros_diario_percentual ?? config.juros_ao_dia_percent ?? 0);
  const descontoPercent = (config.desconto_antecipacao_percentual ?? config.desconto_antecipacao_percent ?? 0);

  const payload = {
    customer: conta.cliente_asaas_id || await criarClienteAsaas(conta, config),
    billingType: 'BOLETO',
    dueDate: conta.data_vencimento,
    value: conta.valor,
    description: conta.descricao || 'Pagamento de Serviços',
    externalReference: conta.id,
    postalService: false,
    fine: {
      value: conta.valor * (multaPercent / 100)
    },
    interest: {
      value: conta.valor * (jurosPercent / 100)
    },
    discount: conta.valor * (descontoPercent / 100)
  };

  const response = await fetch(`${urlBase}/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'access_token': apiKey
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const erro = await response.json();
    throw new Error(erro.errors?.[0]?.description || 'Erro ao gerar boleto');
  }

  const resultado = await response.json();
  
  return {
    sucesso: true,
    id: resultado.id,
    status: resultado.status,
    linha_digitavel: resultado.bankSlipUrl ? resultado.identificationField : null,
    url_boleto: resultado.bankSlipUrl,
    url_fatura: resultado.invoiceUrl,
    nossoNumero: resultado.nossoNumero
  };
}

/**
 * Gerar PIX via Asaas
 */
async function gerarPixAsaas(conta, config) {
  const apiKey = config.api_key;
  const urlBase = config.api_url || 'https://www.asaas.com/api/v3';

  const payload = {
    customer: conta.cliente_asaas_id || await criarClienteAsaas(conta, config),
    billingType: 'PIX',
    dueDate: conta.data_vencimento,
    value: conta.valor,
    description: conta.descricao || 'Pagamento via PIX',
    externalReference: conta.id
  };

  const response = await fetch(`${urlBase}/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'access_token': apiKey
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const erro = await response.json();
    throw new Error(erro.errors?.[0]?.description || 'Erro ao gerar PIX');
  }

  const resultado = await response.json();

  // Buscar QR Code
  const qrResponse = await fetch(`${urlBase}/payments/${resultado.id}/pixQrCode`, {
    headers: { 'access_token': apiKey }
  });

  const qrData = await qrResponse.json();
  
  return {
    sucesso: true,
    id: resultado.id,
    status: resultado.status,
    pix_copia_cola: qrData.payload,
    pix_qrcode: qrData.encodedImage,
    url_fatura: resultado.invoiceUrl,
    expiracao: qrData.expirationDate
  };
}

/**
 * Criar Cliente no Asaas (se não existir)
 */
async function criarClienteAsaas(conta, config) {
  const apiKey = config.api_key;
  const urlBase = config.api_url || 'https://www.asaas.com/api/v3';

  // Buscar dados do cliente com escopo da conta
  const cliente = await buscarClienteDaEmpresa(conta.cliente_id, conta.empresa_id);

  const payload = {
    name: cliente.nome || cliente.razao_social,
    cpfCnpj: cliente.cpf || cliente.cnpj,
    email: cliente.contatos?.find(c => c.tipo === 'E-mail')?.valor || '',
    phone: cliente.contatos?.find(c => c.tipo === 'Telefone')?.valor?.replace(/\D/g, '') || '',
    mobilePhone: cliente.contatos?.find(c => c.tipo === 'WhatsApp')?.valor?.replace(/\D/g, '') || '',
    postalCode: cliente.endereco_principal?.cep?.replace(/\D/g, '') || '',
    address: cliente.endereco_principal?.logradouro || '',
    addressNumber: cliente.endereco_principal?.numero || '',
    complement: cliente.endereco_principal?.complemento || '',
    province: cliente.endereco_principal?.bairro || '',
    externalReference: cliente.id
  };

  const response = await fetch(`${urlBase}/customers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'access_token': apiKey
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const erro = await response.json();
    throw new Error(erro.errors?.[0]?.description || 'Erro ao criar cliente');
  }

  const resultado = await response.json();
  
  // Salvar ID do cliente no sistema
  await base44.entities.Cliente.update(cliente.id, {
    cliente_asaas_id: resultado.id
  });
  
  return resultado.id;
}

/**
 * Consultar Status de Pagamento
 */
async function consultarStatusPagamento(cobrancaId, empresaId) {
  const verificacao = await verificarConfiguracao(empresaId);

  if (!verificacao.configurado) {
    return {
      sucesso: false,
      modo: 'simulado',
      status: 'PENDING'
    };
  }

  const { integracao } = verificacao;
  const apiKey = integracao.api_key;
  const urlBase = integracao.api_url || 'https://www.asaas.com/api/v3';

  const response = await fetch(`${urlBase}/payments/${cobrancaId}`, {
    headers: { 'access_token': apiKey }
  });

  if (!response.ok) {
    throw new Error('Erro ao consultar pagamento');
  }

  const resultado = await response.json();
  
  return {
    sucesso: true,
    status: resultado.status, // PENDING, CONFIRMED, RECEIVED, etc.
    dataRecebimento: resultado.paymentDate,
    valorRecebido: resultado.value,
    formaPagamento: resultado.billingType
  };
}

/**
 * Função principal: Gerar Cobrança
 */
export async function gerarCobranca(contaReceber, tipo = 'BOLETO') {
  // 1. Verificar configuração
  const verificacao = await verificarConfiguracao(contaReceber.empresa_id);
  
  // 2. Modo simulado se não configurado
  if (!verificacao.configurado) {
    console.warn('⚠️ Gateway de pagamento não configurado. Usando modo simulado.');
    
    const cobrancaSimulada = {
      sucesso: true,
      modo: 'simulado',
      id: `SIM_${Date.now()}`,
      status: 'PENDING',
      mensagem: 'Cobrança gerada em modo simulado. Configure o gateway para gerar cobrança real.'
    };

    if (tipo === 'BOLETO') {
      cobrancaSimulada.linha_digitavel = '23790.12345 67890.123456 78901.234567 8 12340000012345';
      cobrancaSimulada.url_boleto = 'https://exemplo.com/boleto-simulado.pdf';
      cobrancaSimulada.nossoNumero = String(Math.floor(Math.random() * 999999999));
    } else if (tipo === 'PIX') {
      cobrancaSimulada.pix_copia_cola = '00020126580014br.gov.bcb.pix0136' + crypto.randomUUID();
      cobrancaSimulada.pix_qrcode = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    }

    return cobrancaSimulada;
  }

  // 3. Log da tentativa
  const logId = await base44.entities.LogCobranca.create({
    empresa_id: contaReceber.empresa_id,
    conta_receber_id: contaReceber.id,
    tipo_operacao: tipo === 'BOLETO' ? 'gerar_boleto' : 'gerar_pix',
    provedor: verificacao.integracao.provedor,
    data_hora: new Date().toISOString(),
    payload_enviado: { conta: contaReceber, tipo },
    status_operacao: 'pendente'
  });

  // 4. Gerar conforme provedor
  try {
    let resultado;
    
    if (verificacao.integracao.provedor === 'Asaas') {
      if (tipo === 'BOLETO') {
        resultado = await gerarBoletoAsaas(contaReceber, verificacao.integracao);
      } else if (tipo === 'PIX') {
        resultado = await gerarPixAsaas(contaReceber, verificacao.integracao);
      }
    } else {
      throw new Error('Provedor não implementado: ' + verificacao.integracao.provedor);
    }

    // 5. Atualizar log de sucesso
    await base44.entities.LogCobranca.update(logId.id, {
      retorno_recebido: resultado,
      status_operacao: 'sucesso',
      id_cobranca_externa: resultado.id,
      linha_digitavel: resultado.linha_digitavel,
      pix_copia_cola: resultado.pix_copia_cola,
      url_boleto: resultado.url_boleto
    });

    return {
      ...resultado,
      modo: 'real'
    };
    
  } catch (error) {
    // 6. Atualizar log de erro
    await base44.entities.LogCobranca.update(logId.id, {
      status_operacao: 'erro',
      mensagem: error.message
    });

    throw error;
  }
}

/**
 * Cancelar Cobrança
 */
export async function cancelarCobranca(cobrancaId, empresaId) {
  const verificacao = await verificarConfiguracao(empresaId);

  if (!verificacao.configurado) {
    return { sucesso: true, modo: 'simulado', mensagem: 'Cancelado localmente' };
  }

  const { integracao } = verificacao;
  const apiKey = integracao.api_key;
  const urlBase = integracao.api_url || 'https://www.asaas.com/api/v3';

  const response = await fetch(`${urlBase}/payments/${cobrancaId}`, {
    method: 'DELETE',
    headers: { 'access_token': apiKey }
  });

  if (!response.ok) {
    const erro = await response.json();
    throw new Error(erro.errors?.[0]?.description || 'Erro ao cancelar cobrança');
  }

  const resultado = await response.json();
  
  return {
    sucesso: true,
    status: resultado.status,
    deletado: resultado.deleted
  };
}

export default {
  gerarCobranca,
  consultarStatusPagamento,
  cancelarCobranca,
  verificarConfiguracao
};