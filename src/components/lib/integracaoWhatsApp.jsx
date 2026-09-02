/**
 * Biblioteca de Integração WhatsApp Business Real
 * Suporta: Evolution API, Baileys, WPPCONNECT
 */

import { base44 } from '@/api/base44Client';
import { normalizeIdentifier } from '@/components/lib/contextoMultiempresaPolicy';

/**
 * Verifica configuração do WhatsApp
 */
async function verificarConfiguracao(empresaId) {
  const scopedEmpresaId = normalizeIdentifier(empresaId);
  if (!scopedEmpresaId) {
    return { configurado: false, erro: 'Empresa obrigatoria para configuracao de integracoes' };
  }

  const chave = `integracoes_${scopedEmpresaId}`;
  const registros = await base44.entities.ConfiguracaoSistema.filter({ chave, categoria: 'Integracoes', empresa_id: scopedEmpresaId }, undefined, 1);
  
  if (!registros || registros.length === 0) {
    return { configurado: false, erro: 'Configuração WhatsApp não encontrada' };
  }
  
  const cfg = registros[0];
  const whatsapp = cfg.integracao_whatsapp || {};
  
  if (!whatsapp.ativo) {
    return { configurado: false, erro: 'WhatsApp não está ativo', config: cfg };
  }
  
  if (!whatsapp.api_key || !whatsapp.instance_id) {
    return { configurado: false, erro: 'API Key ou Instance não configurados', config: cfg };
  }
  
  return { configurado: true, config: cfg, whatsapp };
}

/**
 * Enviar Mensagem via Evolution API
 */
async function enviarMensagemEvolution(numero, mensagem, config) {
  const { data } = await base44.functions.invoke('whatsappSend', { action: 'sendText', numero, mensagem });
  return data;
}

/**
 * Enviar Arquivo via WhatsApp
 */
async function enviarArquivoEvolution(numero, arquivoUrl, legenda, config) {
  const { data } = await base44.functions.invoke('whatsappSend', { action: 'sendMedia', numero, arquivoUrl, legenda });
  return data;
}

/**
 * Verificar Status da Conexão
 */
async function verificarConexao(empresaId) {
  const { data } = await base44.functions.invoke('whatsappSend', { action: 'status', empresaId });
  return data;
}

/**
 * Função principal: Enviar WhatsApp
 */
export async function enviarWhatsApp(dados) {
  const { numero, mensagem, empresaId, tipo = 'texto', arquivoUrl = null, legenda = null } = dados;

  const action = tipo === 'arquivo' && arquivoUrl ? 'sendMedia' : 'sendText';
  const { data } = await base44.functions.invoke('whatsappSend', {
    action,
    numero,
    mensagem,
    empresaId,
    arquivoUrl,
    legenda,
  });
  return data;
  }

/**
 * Enviar Boleto por WhatsApp
 */
export async function enviarBoletoWhatsApp(conta, empresaId) {
  const clientes = await base44.entities.Cliente.filter({ id: conta.cliente_id });
  const cliente = clientes[0];
  
  if (!cliente) {
    throw new Error('Cliente não encontrado');
  }

  const whatsapp = cliente.contatos?.find(c => c.tipo === 'WhatsApp')?.valor;
  
  if (!whatsapp) {
    throw new Error('Cliente não possui WhatsApp cadastrado');
  }

  const mensagem = `
🔔 *Novo Boleto Disponível*

Olá, ${cliente.nome}!

📄 *Descrição:* ${conta.descricao}
💰 *Valor:* R$ ${conta.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
📅 *Vencimento:* ${new Date(conta.data_vencimento).toLocaleDateString('pt-BR')}

${conta.url_boleto_pdf ? `📎 *Boleto:* ${conta.url_boleto_pdf}` : ''}
${conta.pix_copia_cola ? `\n💳 *PIX Copia e Cola:* ${conta.pix_copia_cola}` : ''}

Qualquer dúvida, estamos à disposição! 😊
  `.trim();

  return await enviarWhatsApp({
    numero: whatsapp,
    mensagem,
    empresaId,
    tipo: 'texto'
  });
}

/**
 * Enviar Atualização de Pedido por WhatsApp
 */
export async function notificarPedidoWhatsApp(pedido, mensagemPersonalizada, empresaId) {
  const whatsapp = pedido.contatos_cliente?.find(c => c.tipo === 'WhatsApp')?.valor;
  
  if (!whatsapp) {
    throw new Error('Cliente não possui WhatsApp no pedido');
  }

  const mensagem = mensagemPersonalizada || `
🛒 *Atualização do Pedido ${pedido.numero_pedido}*

Status: *${pedido.status}*

${pedido.data_prevista_entrega ? `📅 Previsão de entrega: ${new Date(pedido.data_prevista_entrega).toLocaleDateString('pt-BR')}` : ''}

Acompanhe seu pedido em tempo real! 📦
  `.trim();

  return await enviarWhatsApp({
    numero: whatsapp,
    mensagem,
    empresaId,
    tipo: 'texto'
  });
}

export default {
  enviarWhatsApp,
  enviarBoletoWhatsApp,
  notificarPedidoWhatsApp,
  verificarConexao,
  verificarConfiguracao
};