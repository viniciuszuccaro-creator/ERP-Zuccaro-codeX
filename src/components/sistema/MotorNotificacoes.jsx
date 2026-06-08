/**
 * Motor de Notificações Automáticas
 * Dispara notificações baseadas em regras e gatilhos
 */

import { base44 } from '@/api/base44Client';
import { enviarEmail } from '../lib/integracaoEmail';
import { enviarWhatsApp, enviarBoletoWhatsApp } from '../lib/integracaoWhatsApp';

const getEscopoNotificacao = (dados = {}, empresaId = null) => {
  const resolvedEmpresaId = empresaId || dados.empresa_id || dados.empresaId || null;
  const resolvedGrupoId = dados.group_id || dados.grupo_id || dados.groupId || dados.grupoId || null;
  return {
    empresa_id: resolvedEmpresaId,
    group_id: resolvedGrupoId,
    grupo_id: resolvedGrupoId,
  };
};

async function criarNotificacaoContextual(payload, dados = {}, empresaId = null) {
  return base44.entities.Notificacao.create({
    ...payload,
    ...getEscopoNotificacao(dados, empresaId),
    data_hora: payload.data_hora || new Date().toISOString(),
  });
}

/**
 * Regras de Notificação Padrão
 */
export const REGRAS_PADRAO = {
  // COMERCIAL
  pedido_aprovado: {
    id: 'pedido_aprovado',
    nome: 'Pedido Aprovado',
    descricao: 'Notifica cliente quando pedido é aprovado',
    modulo: 'Comercial',
    gatilho: 'status_changed',
    condicao: { campo: 'status', valor_novo: 'Aprovado' },
    canais: ['email', 'whatsapp'],
    ativo: true,
    prioridade: 'Alta'
  },
  
  pedido_em_producao: {
    id: 'pedido_em_producao',
    nome: 'Pedido em Produção',
    descricao: 'Notifica quando pedido entra em produção',
    modulo: 'Comercial',
    gatilho: 'status_changed',
    condicao: { campo: 'status', valor_novo: 'Em Produção' },
    canais: ['email'],
    ativo: true,
    prioridade: 'Normal'
  },
  
  pedido_pronto: {
    id: 'pedido_pronto',
    nome: 'Pedido Pronto',
    descricao: 'Notifica quando pedido está pronto',
    modulo: 'Comercial',
    gatilho: 'status_changed',
    condicao: { campo: 'status', valor_novo: 'Pronto para Faturar' },
    canais: ['email', 'whatsapp'],
    ativo: true,
    prioridade: 'Alta'
  },
  
  // EXPEDIÇÃO
  entrega_saiu: {
    id: 'entrega_saiu',
    nome: 'Entrega Saiu para Rota',
    descricao: 'Notifica quando entrega sai para rota',
    modulo: 'Expedição',
    gatilho: 'status_changed',
    condicao: { campo: 'status', valor_novo: 'Saiu para Entrega' },
    canais: ['email', 'whatsapp'],
    ativo: true,
    prioridade: 'Alta'
  },
  
  entrega_realizada: {
    id: 'entrega_realizada',
    nome: 'Entrega Realizada',
    descricao: 'Notifica quando entrega é concluída',
    modulo: 'Expedição',
    gatilho: 'status_changed',
    condicao: { campo: 'status', valor_novo: 'Entregue' },
    canais: ['email'],
    ativo: true,
    prioridade: 'Normal'
  },
  
  // FINANCEIRO
  boleto_gerado: {
    id: 'boleto_gerado',
    nome: 'Boleto Gerado',
    descricao: 'Envia boleto/PIX quando gerado',
    modulo: 'Financeiro',
    gatilho: 'field_changed',
    condicao: { campo: 'status_cobranca', valor_novo: 'gerada' },
    canais: ['email', 'whatsapp'],
    ativo: true,
    prioridade: 'Alta'
  },
  
  titulo_vencendo: {
    id: 'titulo_vencendo',
    nome: 'Título Vencendo',
    descricao: 'Lembrete 3 dias antes do vencimento',
    modulo: 'Financeiro',
    gatilho: 'data_proxima',
    condicao: { campo: 'data_vencimento', dias_antes: 3 },
    canais: ['email', 'whatsapp'],
    ativo: true,
    prioridade: 'Alta'
  },
  
  titulo_vencido: {
    id: 'titulo_vencido',
    nome: 'Título Vencido',
    descricao: 'Notifica cliente sobre título vencido',
    modulo: 'Financeiro',
    gatilho: 'status_changed',
    condicao: { campo: 'status', valor_novo: 'Atrasado' },
    canais: ['email', 'whatsapp'],
    ativo: true,
    prioridade: 'Urgente'
  },
  
  // FISCAL
  nfe_autorizada: {
    id: 'nfe_autorizada',
    nome: 'NF-e Autorizada',
    descricao: 'Envia NF-e e DANFE quando autorizada',
    modulo: 'Fiscal',
    gatilho: 'status_changed',
    condicao: { campo: 'status', valor_novo: 'Autorizada' },
    canais: ['email'],
    ativo: true,
    prioridade: 'Alta'
  },
  
  nfe_rejeitada: {
    id: 'nfe_rejeitada',
    nome: 'NF-e Rejeitada',
    descricao: 'Alerta equipe quando NF-e é rejeitada',
    modulo: 'Fiscal',
    gatilho: 'status_changed',
    condicao: { campo: 'status', valor_novo: 'Rejeitada' },
    canais: ['sistema'],
    ativo: true,
    prioridade: 'Urgente',
    destinatarios_fixos: ['fiscal@empresa.com']
  }
};

/**
 * Processar gatilho de notificação
 */
export async function processarGatilho(entidade, tipo, dadosAnteriores, dadosNovos, empresaId) {
  // Buscar regras ativas para este tipo de entidade
  const regrasAtivas = Object.values(REGRAS_PADRAO).filter(regra => {
    // Mapear entidade para módulo
    const moduloMap = {
      'Pedido': 'Comercial',
      'Entrega': 'Expedição',
      'ContaReceber': 'Financeiro',
      'NotaFiscal': 'Fiscal'
    };
    
    return regra.ativo && moduloMap[entidade] === regra.modulo;
  });

  // Verificar cada regra
  for (const regra of regrasAtivas) {
    let devereDisparar = false;
    
    // Verificar tipo de gatilho
    if (regra.gatilho === 'status_changed' && tipo === 'update') {
      const campo = regra.condicao.campo;
      if (dadosAnteriores?.[campo] !== dadosNovos[campo] && 
          dadosNovos[campo] === regra.condicao.valor_novo) {
        devereDisparar = true;
      }
    }
    
    if (regra.gatilho === 'field_changed' && tipo === 'update') {
      const campo = regra.condicao.campo;
      if (dadosAnteriores?.[campo] !== dadosNovos[campo] && 
          dadosNovos[campo] === regra.condicao.valor_novo) {
        devereDisparar = true;
      }
    }
    
    if (regra.gatilho === 'created' && tipo === 'create') {
      devereDisparar = true;
    }
    
    // Disparar notificação
    if (devereDisparar) {
      await dispararNotificacao(regra, entidade, dadosNovos, empresaId);
    }
  }
}

/**
 * Disparar Notificação
 */
async function dispararNotificacao(regra, entidade, dados, empresaId) {
  console.log(`🔔 Disparando notificação: ${regra.nome}`);
  
  try {
    // Email
    if (regra.canais.includes('email')) {
      await enviarNotificacaoEmail(regra, entidade, dados, empresaId);
    }
    
    // WhatsApp
    if (regra.canais.includes('whatsapp')) {
      await enviarNotificacaoWhatsApp(regra, entidade, dados, empresaId);
    }
    
    // Sistema
    if (regra.canais.includes('sistema')) {
      await enviarNotificacaoSistema(regra, entidade, dados, empresaId);
    }
    
    // Registrar disparo
    await criarNotificacaoContextual({
      titulo: `✅ ${regra.nome} - Disparada`,
      mensagem: `Regra "${regra.nome}" disparada para ${entidade} #${dados.id}`,
      tipo: 'sucesso',
      categoria: regra.modulo,
      prioridade: regra.prioridade,
      entidade_relacionada: entidade,
      registro_id: dados.id
    }, dados, empresaId);
    
  } catch (error) {
    console.error(`Erro ao disparar notificação ${regra.nome}:`, error);
    
    await criarNotificacaoContextual({
      titulo: `❌ Erro: ${regra.nome}`,
      mensagem: `Falha ao enviar notificação: ${error.message}`,
      tipo: 'erro',
      categoria: 'Sistema',
      prioridade: 'Alta'
    }, dados, empresaId);
  }
}

/**
 * Enviar notificação por Email
 */
async function enviarNotificacaoEmail(regra, entidade, dados, empresaId) {
  // Buscar destinatário
  let email = null;
  
  if (entidade === 'Pedido' || entidade === 'Entrega') {
    const cliente = await base44.entities.Cliente.filter({ id: dados.cliente_id });
    if (cliente[0]) {
      email = cliente[0].contatos?.find(c => c.tipo === 'E-mail')?.valor || cliente[0].email;
    }
  } else if (entidade === 'ContaReceber') {
    const cliente = await base44.entities.Cliente.filter({ id: dados.cliente_id });
    if (cliente[0]) {
      email = cliente[0].contatos?.find(c => c.tipo === 'E-mail')?.valor || cliente[0].email;
    }
  } else if (entidade === 'NotaFiscal') {
    email = dados.cliente_endereco?.email;
  }
  
  // Destinatários fixos (equipe interna)
  if (regra.destinatarios_fixos) {
    email = regra.destinatarios_fixos[0];
  }
  
  if (!email) {
    console.warn(`Nenhum email encontrado para ${entidade} #${dados.id}`);
    return;
  }
  
  // Montar mensagem
  const assunto = `${regra.nome} - ${dados.numero_pedido || dados.numero || dados.id}`;
  const mensagem = `
    <h2>${regra.nome}</h2>
    <p>${regra.descricao}</p>
    <p><strong>Número:</strong> ${dados.numero_pedido || dados.numero || dados.id}</p>
    <p><strong>Status:</strong> ${dados.status}</p>
    <p><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</p>
  `;
  
  await enviarEmail({
    empresaId,
    destinatario: email,
    assunto,
    mensagem,
    tipo_conteudo: 'html'
  });
}

/**
 * Enviar notificação por WhatsApp
 */
async function enviarNotificacaoWhatsApp(regra, entidade, dados, empresaId) {
  // Buscar telefone
  let telefone = null;
  
  if (entidade === 'Pedido' || entidade === 'Entrega') {
    const whatsappContato = dados.contatos_cliente?.find(c => c.tipo === 'WhatsApp');
    if (whatsappContato) {
      telefone = whatsappContato.valor;
    }
  } else if (entidade === 'ContaReceber') {
    const cliente = await base44.entities.Cliente.filter({ id: dados.cliente_id });
    if (cliente[0]) {
      telefone = cliente[0].contatos?.find(c => c.tipo === 'WhatsApp')?.valor;
    }
  }
  
  if (!telefone) {
    console.warn(`Nenhum WhatsApp encontrado para ${entidade} #${dados.id}`);
    return;
  }
  
  // Mensagem
  const mensagem = `
🔔 *${regra.nome}*

${regra.descricao}

📄 Número: ${dados.numero_pedido || dados.numero || dados.id}
📊 Status: ${dados.status}

_Mensagem automática do ERP Zuccaro_
  `.trim();
  
  await enviarWhatsApp({
    numero: telefone,
    mensagem,
    empresaId,
    tipo: 'texto'
  });
}

/**
 * Enviar notificação no Sistema
 */
async function enviarNotificacaoSistema(regra, entidade, dados, empresaId) {
  await criarNotificacaoContextual({
    titulo: `🔔 ${regra.nome}`,
    mensagem: `${regra.descricao}\n\nNúmero: ${dados.numero_pedido || dados.numero || dados.id}\nStatus: ${dados.status}`,
    tipo: regra.prioridade === 'Urgente' ? 'urgente' : 'info',
    categoria: regra.modulo,
    prioridade: regra.prioridade,
    entidade_relacionada: entidade,
    registro_id: dados.id
  }, dados, empresaId);
}

/**
 * Verificar notificações agendadas (cron)
 * Executar diariamente para verificar títulos vencendo, etc.
 */
export async function verificarNotificacoesAgendadas() {
  const hoje = new Date();
  const em3Dias = new Date(hoje.getTime() + 3 * 24 * 60 * 60 * 1000);
  
  // Títulos vencendo em 3 dias
  const titulosVencendo = await base44.entities.ContaReceber.filter({
    status: 'Pendente'
  });
  
  for (const titulo of titulosVencendo) {
    const dataVencimento = new Date(titulo.data_vencimento);
    const diasRestantes = Math.ceil((dataVencimento - hoje) / (1000 * 60 * 60 * 24));
    
    if (diasRestantes === 3) {
      // Disparar notificação de vencimento
      const cliente = await base44.entities.Cliente.filter({ id: titulo.cliente_id });
      if (cliente[0]) {
        const email = cliente[0].contatos?.find(c => c.tipo === 'E-mail')?.valor;
        const whatsapp = cliente[0].contatos?.find(c => c.tipo === 'WhatsApp')?.valor;
        
        // Email
        if (email) {
          await enviarEmail({
            empresaId: titulo.empresa_id,
            destinatario: email,
            destinatario_nome: cliente[0].nome,
            assunto: `Lembrete: Título Vencendo em 3 Dias`,
            mensagem: `
              <h2>Olá, ${cliente[0].nome}!</h2>
              <p>Este é um lembrete de que você possui um título com vencimento em <strong>3 dias</strong>.</p>
              
              <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>💰 Valor:</strong> R$ ${titulo.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                <p><strong>📅 Vencimento:</strong> ${dataVencimento.toLocaleDateString('pt-BR')}</p>
                <p><strong>📄 Descrição:</strong> ${titulo.descricao}</p>
              </div>
              
              ${titulo.url_boleto_pdf ? `<p><a href="${titulo.url_boleto_pdf}">📥 Baixar Boleto</a></p>` : ''}
              ${titulo.pix_copia_cola ? `<p>💳 PIX: ${titulo.pix_copia_cola}</p>` : ''}
              
              <p>Evite juros e multas pagando até o vencimento! 😊</p>
            `,
            tipo_conteudo: 'html'
          });
        }
        
        // WhatsApp
        if (whatsapp) {
          await enviarWhatsApp({
            numero: whatsapp,
            mensagem: `
🔔 *Lembrete de Vencimento*

Olá, ${cliente[0].nome}!

Você possui um título vencendo em *3 dias*:

💰 *Valor:* R$ ${titulo.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
📅 *Vencimento:* ${dataVencimento.toLocaleDateString('pt-BR')}
📄 *Descrição:* ${titulo.descricao}

${titulo.pix_copia_cola ? `\n💳 *PIX:* ${titulo.pix_copia_cola}` : ''}

Evite juros e multas! 😊
            `.trim(),
            empresaId: titulo.empresa_id,
            tipo: 'texto'
          });
        }
      }
    }
  }
}

export default {
  processarGatilho,
  verificarNotificacoesAgendadas,
  REGRAS_PADRAO
};
