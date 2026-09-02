/**
 * Biblioteca de Integração WhatsApp Business Real
 * Suporta: Evolution API, Baileys, WPPCONNECT
 */

import { base44 } from '@/api/base44Client';
import { normalizeIdentifier, recordMatchesEmpresaScope } from '@/components/lib/contextoMultiempresaPolicy';

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
async function buscarClienteDaEmpresa(clienteId, empresaId) {
  const scopedClienteId = normalizeIdentifier(clienteId);
  const scopedEmpresaId = normalizeIdentifier(empresaId);

  if (!scopedClienteId || !scopedEmpresaId) {
    throw new Error('Cliente e empresa obrigatorios para integracao WhatsApp');
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

  throw new Error('Cliente nao pertence a empresa da mensagem');
}

const buildWhatsAppAuditPayload = (dados = {}, retorno = {}) => ({
  action: dados.tipo === 'arquivo' && dados.arquivoUrl ? 'sendMedia' : 'sendText',
  numero_destino: dados.numero ? String(dados.numero).replace(/\d(?=\d{4})/g, '*') : null,
  tipo: dados.tipo || 'texto',
  tem_arquivo: Boolean(dados.arquivoUrl),
  tem_legenda: Boolean(dados.legenda),
  tamanho_mensagem: dados.mensagem ? String(dados.mensagem).length : 0,
  retorno: {
    sucesso: retorno?.sucesso ?? retorno?.success ?? null,
    id: retorno?.id || retorno?.messageId || null,
    status: retorno?.status || null,
  },
});

async function auditarEnvioWhatsApp(dados, retorno) {
  try {
    const usuario = await base44.auth.me().catch(() => null);
    await base44.entities.AuditLog.create({
      usuario: usuario?.full_name || usuario?.email || 'Sistema',
      usuario_id: usuario?.id || null,
      acao: 'Envio',
      modulo: 'Comercial',
      tipo_auditoria: 'integracao',
      entidade: 'WhatsApp',
      descricao: 'Mensagem WhatsApp enviada pela integracao',
      empresa_id: normalizeIdentifier(dados?.empresaId) || normalizeIdentifier(dados?.empresa_id) || null,
      group_id: normalizeIdentifier(dados?.groupId) || normalizeIdentifier(dados?.group_id) || normalizeIdentifier(dados?.grupo_id) || null,
      dados_novos: buildWhatsAppAuditPayload(dados, retorno),
      data_hora: new Date().toISOString(),
      sucesso: true,
    });
  } catch (error) {
    console.warn('Falha ao auditar envio WhatsApp', error);
  }
}

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
  await auditarEnvioWhatsApp(dados, data);
  return data;
  }

/**
 * Enviar Boleto por WhatsApp
 */
export async function enviarBoletoWhatsApp(conta, empresaId) {
  const cliente = await buscarClienteDaEmpresa(conta.cliente_id, empresaId || conta.empresa_id);

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
    empresaId: empresaId || conta.empresa_id,
    groupId: conta.group_id || conta.grupo_id || null,
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
    empresaId: empresaId || pedido.empresa_id,
    groupId: pedido.group_id || pedido.grupo_id || null,
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