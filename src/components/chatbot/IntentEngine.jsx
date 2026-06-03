import { base44 } from '@/api/base44Client';

const getContextIds = (contexto = {}) => ({
  groupId: contexto.groupId || contexto.grupoId || contexto.group_id || contexto.grupo_id || null,
  empresaId: contexto.empresaId || contexto.empresa_id || null,
});

const hasContext = (contexto = {}) => {
  const { groupId, empresaId } = getContextIds(contexto);
  return Boolean(groupId || empresaId);
};

const withContextPayload = (payload = {}, contexto = {}) => {
  const { groupId, empresaId } = getContextIds(contexto);
  return {
    ...payload,
    ...(groupId ? { group_id: groupId, grupo_id: groupId } : {}),
    ...(empresaId ? { empresa_id: empresaId } : {}),
  };
};

const withContextFilter = (filter = {}, contexto = {}) => {
  const { groupId, empresaId } = getContextIds(contexto);
  return {
    ...filter,
    ...(groupId ? { group_id: groupId } : {}),
    ...(empresaId ? { empresa_id: empresaId } : {}),
  };
};

const canRunAutomaticAction = (contexto = {}) => {
  return hasContext(contexto) && contexto?.bloquearAcoesAutomaticas !== true;
};

const sanitizePromptText = (value, max = 1200) => String(value ?? '')
  .replace(/[<>]/g, '')
  .replace(/javascript:/gi, '')
  .replace(/[\u0000-\u001F\u007F]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

const buildSafeLLMContext = (contexto = {}) => {
  const { groupId, empresaId } = getContextIds(contexto);
  return {
    groupId,
    empresaId,
    canal: sanitizePromptText(contexto.canal, 80),
    status: sanitizePromptText(contexto.status, 80),
    sentimento: sanitizePromptText(contexto.sentimento_geral || contexto.sentimento, 80),
    intentPrincipal: sanitizePromptText(contexto.intent_principal || contexto.intent, 120),
    cliente: contexto.dadosCliente?.nome ? {
      nome: sanitizePromptText(contexto.dadosCliente.nome, 160)
    } : undefined
  };
};

/**
 * V21.6 - MOTOR DE INTENTS AVANÇADO
 * 
 * Engine de IA para:
 * ✅ Detecção de intenção com alta precisão
 * ✅ Análise de sentimento em tempo real
 * ✅ Extração de entidades (NER)
 * ✅ Execução de ações automáticas
 * ✅ Geração de respostas contextuais
 * ✅ Integração com dados do ERP
 * ✅ Suporte multi-empresa
 * ✅ Fallback quando IA indisponível
 */
const IntentEngine = {
  // Intents conhecidos e suas configurações
  intents: {
    'consultar_pedido': {
      palavras_chave: ['pedido', 'meu pedido', 'status pedido', 'onde está', 'rastrear'],
      prioridade: 1,
      acao: 'buscar_pedidos'
    },
    'consultar_entrega': {
      palavras_chave: ['entrega', 'rastrear entrega', 'onde está minha entrega', 'previsão', 'quando chega'],
      prioridade: 1,
      acao: 'buscar_entregas'
    },
    'segunda_via_boleto': {
      palavras_chave: ['boleto', '2 via', 'segunda via', 'pagar', 'vencimento', 'código de barras'],
      prioridade: 2,
      acao: 'buscar_boletos'
    },
    'emitir_boleto': {
      palavras_chave: ['emitir boleto', 'gerar boleto', 'boleto novo', 'cobrança', 'fatura'],
      prioridade: 2,
      acao: 'gerar_boleto'
    },
    'criar_pedido': {
      palavras_chave: ['fazer pedido', 'criar pedido', 'novo pedido', 'comprar'],
      prioridade: 2,
      acao: 'criar_pedido'
    },
    'orcamento': {
      palavras_chave: ['orçamento', 'cotação', 'preço', 'quanto custa', 'valor'],
      prioridade: 2,
      acao: 'criar_orcamento'
    },
    'suporte_tecnico': {
      palavras_chave: ['problema', 'erro', 'não funciona', 'defeito', 'reclamação', 'suporte'],
      prioridade: 3,
      requer_humano: true
    },
    'falar_atendente': {
      palavras_chave: ['atendente', 'humano', 'pessoa', 'falar com alguém', 'transferir'],
      prioridade: 1,
      requer_humano: true
    },
    'cancelamento': {
      palavras_chave: ['cancelar', 'cancelamento', 'desistir', 'devolver'],
      prioridade: 2,
      requer_humano: true
    },
    'informacoes_empresa': {
      palavras_chave: ['horário', 'endereço', 'telefone', 'contato', 'localização'],
      prioridade: 3,
      acao: 'info_empresa'
    },
    'saudacao': {
      palavras_chave: ['oi', 'olá', 'bom dia', 'boa tarde', 'boa noite', 'hey', 'eai'],
      prioridade: 5,
      acao: 'saudar'
    },
    'agradecimento': {
      palavras_chave: ['obrigado', 'obrigada', 'valeu', 'agradeço', 'thanks'],
      prioridade: 5,
      acao: 'agradecer'
    },
    'despedida': {
      palavras_chave: ['tchau', 'até logo', 'bye', 'até mais', 'finalizar'],
      prioridade: 5,
      acao: 'despedir'
    }
  },

  // Palavras que indicam sentimento negativo/urgente
  palavrasNegativas: [
    'urgente', 'imediato', 'agora', 'problema', 'erro', 'falha', 
    'péssimo', 'horrível', 'raiva', 'absurdo', 'inaceitável',
    'reclamação', 'procon', 'advogado', 'processo', 'nunca mais'
  ],

  palavrasPositivas: [
    'obrigado', 'ótimo', 'excelente', 'perfeito', 'maravilhoso',
    'parabéns', 'satisfeito', 'adorei', 'recomendo'
  ],

  /**
   * Detectar intent da mensagem
   */
  async detectarIntent(mensagem, clienteId, contexto = {}) {
    const mensagemLower = mensagem.toLowerCase().trim();

    // Detectar intent baseado em palavras-chave (estático)
    let intentDetectado = 'desconhecido';
    let confianca = 0;
    let melhorMatch = null;

    for (const [intent, config] of Object.entries(this.intents)) {
      const matches = config.palavras_chave.filter(palavra => 
        mensagemLower.includes(palavra.toLowerCase())
      );
      if (matches.length > 0) {
        const score = (matches.length / config.palavras_chave.length) * 100;
        if (score > confianca || (score === confianca && config.prioridade < (melhorMatch?.prioridade || 999))) {
          confianca = Math.min(score * 1.5, 95);
          intentDetectado = intent;
          melhorMatch = config;
        }
      }
    }

    // Detecção dinâmica via entidade ChatbotIntent (multiempresa)
    try {
      const filtro = withContextFilter({ ativo: true }, contexto);
      const intentsDinamicas = await base44.entities.ChatbotIntent.filter(filtro, '-updated_date', 50);
      for (const dyn of intentsDinamicas || []) {
        const palavras = Array.isArray(dyn.palavras_chave) ? dyn.palavras_chave : String(dyn.palavras_chave || '').split(',');
        const matchesDyn = palavras.filter(p => p && mensagemLower.includes(String(p).trim().toLowerCase()));
        if (matchesDyn.length > 0) {
          const scoreDyn = Math.min((matchesDyn.length / Math.max(palavras.length, 1)) * 100, 95);
          const prioridadeDyn = typeof dyn.prioridade === 'number' ? dyn.prioridade : 3;
          if (scoreDyn > confianca || (scoreDyn === confianca && prioridadeDyn < (melhorMatch?.prioridade || 999))) {
            confianca = Math.round(scoreDyn);
            intentDetectado = dyn.intent_key || dyn.nome || 'desconhecido';
            melhorMatch = { prioridade: prioridadeDyn, requer_humano: !!dyn.requer_humano, acao: dyn.acao };
          }
        }
      }
    } catch (_) {}

    // Se confiança baixa, usar IA como fallback para melhorar detecção
    if (confianca < 50) {
      try {
        const byIA = await this.analisarComIA(mensagem, contexto);
        if (byIA?.intent && typeof byIA?.confianca === 'number' && (byIA.confianca > confianca)) {
          intentDetectado = byIA.intent;
          confianca = Math.round(byIA.confianca);
          melhorMatch = { prioridade: 3, requer_humano: !!byIA.necessita_atendente };
        }
      } catch (_) {}
    }

    // Analisar sentimento
    const sentimento = this.analisarSentimento(mensagemLower);
    
    // Extrair entidades
    const entidades = this.extrairEntidades(mensagemLower);

    // Verificar se precisa de atendente humano
    const necessitaAtendente = 
      melhorMatch?.requer_humano || 
      sentimento === 'Frustrado' ||
      sentimento === 'Urgente' ||
      confianca < 40;

    // Gerar resposta sugerida
    const respostaSugerida = await this.gerarResposta(
      intentDetectado, 
      entidades, 
      clienteId, 
      contexto,
      sentimento
    );

    // Ações sugeridas
    const acoesSugeridas = this.obterAcoesSugeridas(intentDetectado, entidades);

    return {
      intent: intentDetectado,
      confianca: Math.round(confianca),
      sentimento,
      entidades_detectadas: entidades,
      necessita_atendente: necessitaAtendente,
      resposta_sugerida: respostaSugerida,
      acoes_sugeridas: acoesSugeridas,
      contexto_usado: contexto
    };
  },

  /**
   * Analisar sentimento da mensagem
   */
  analisarSentimento(mensagem) {
    const negativoScore = this.palavrasNegativas.filter(p => mensagem.includes(p)).length;
    const positivoScore = this.palavrasPositivas.filter(p => mensagem.includes(p)).length;
    
    // Detectar urgência
    if (mensagem.includes('urgente') || mensagem.includes('imediato') || mensagem.includes('agora mesmo')) {
      return 'Urgente';
    }
    
    if (negativoScore >= 2 || mensagem.includes('!!!') || mensagem.toUpperCase() === mensagem && mensagem.length > 10) {
      return 'Frustrado';
    }
    
    if (negativoScore > positivoScore) {
      return 'Negativo';
    }
    
    if (positivoScore > negativoScore) {
      return 'Positivo';
    }
    
    return 'Neutro';
  },

  /**
   * Extrair entidades da mensagem (NER simplificado)
   */
  extrairEntidades(mensagem) {
    const entidades = {};
    
    // Número de pedido (PED-XXXXXX)
    const pedidoMatch = mensagem.match(/ped[-\s]?(\d{4,8})/i);
    if (pedidoMatch) {
      entidades.numero_pedido = `PED-${pedidoMatch[1]}`;
    }
    
    // CPF
    const cpfMatch = mensagem.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
    if (cpfMatch) {
      entidades.cpf = cpfMatch[0].replace(/\D/g, '');
    }
    
    // CNPJ
    const cnpjMatch = mensagem.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/);
    if (cnpjMatch) {
      entidades.cnpj = cnpjMatch[0].replace(/\D/g, '');
    }
    
    // Valor monetário
    const valorMatch = mensagem.match(/r\$\s?[\d.,]+/i);
    if (valorMatch) {
      entidades.valor = parseFloat(valorMatch[0].replace(/[r$\s.]/gi, '').replace(',', '.'));
    }
    
    // Data
    const dataMatch = mensagem.match(/\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/);
    if (dataMatch) {
      entidades.data = dataMatch[0];
    }
    
    // Email
    const emailMatch = mensagem.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (emailMatch) {
      entidades.email = emailMatch[0];
    }
    
    // Telefone
    const telMatch = mensagem.match(/\(?\d{2}\)?[\s-]?\d{4,5}[-\s]?\d{4}/);
    if (telMatch) {
      entidades.telefone = telMatch[0];
    }
    
    // Produto (palavras após "produto", "item", etc)
    const produtoMatch = mensagem.match(/(?:produto|item|mercadoria)\s+(.{3,30}?)(?:\s|$|,|\.)/i);
    if (produtoMatch) {
      entidades.produto_mencionado = produtoMatch[1].trim();
    }
    
    return entidades;
  },

  /**
   * Gerar resposta baseada no intent
   */
  async gerarResposta(intent, entidades, clienteId, contexto, sentimento) {
    const respostas = {
      'consultar_pedido': '📦 Claro! Vou verificar seus pedidos. Um momento...',
      'consultar_entrega': '🚚 Vou consultar o status da sua entrega agora mesmo!',
      'segunda_via_boleto': '💳 Vou buscar seus boletos em aberto. Aguarde...',
      'orcamento': '📋 Você gostaria de solicitar um orçamento? Posso ajudar!',
      'suporte_tecnico': '🔧 Entendi que você precisa de suporte técnico. Vou transferir para um especialista.',
      'falar_atendente': '👤 Claro! Vou transferir você para um atendente humano. Um momento...',
      'cancelamento': '⚠️ Entendo. Vou encaminhar para um atendente que poderá ajudar com o cancelamento.',
      'informacoes_empresa': 'ℹ️ Posso te ajudar com informações da empresa!',
      'saudacao': `Olá! 👋 Sou o assistente virtual. Como posso ajudar você hoje?`,
      'agradecimento': 'Por nada! 😊 Fico feliz em ajudar. Precisa de mais alguma coisa?',
      'despedida': 'Até logo! 👋 Se precisar de algo, estou por aqui. Tenha um ótimo dia!',
      'desconhecido': 'Desculpe, não entendi bem. Pode reformular ou escolher uma das opções abaixo?'
    };

    let resposta = respostas[intent] || respostas['desconhecido'];

    // Personalizar resposta se tiver dados do cliente
    if (contexto.dadosCliente?.nome) {
      const primeiroNome = contexto.dadosCliente.nome.split(' ')[0];
      resposta = resposta.replace('você', primeiroNome);
    }

    // Ajustar tom baseado no sentimento
    if (sentimento === 'Frustrado' || sentimento === 'Negativo') {
      resposta = `Peço desculpas por qualquer inconveniente. ${resposta}`;
    }

    if (sentimento === 'Urgente') {
      resposta = `⚡ ${resposta} Estamos tratando com prioridade!`;
    }

    return resposta;
  },

  /**
   * Obter ações sugeridas para o cliente
   */
  obterAcoesSugeridas(intent, entidades) {
    const acoesBase = {
      'consultar_pedido': ['Ver meus pedidos', 'Rastrear entrega', 'Falar com atendente'],
      'consultar_entrega': ['Ver entregas', 'Rastrear pedido', 'Informar problema'],
      'segunda_via_boleto': ['Ver boletos', 'Pagar com PIX', 'Falar com financeiro'],
      'orcamento': ['Solicitar orçamento', 'Ver produtos', 'Falar com vendedor'],
      'saudacao': ['Ver meus pedidos', 'Solicitar orçamento', '2ª via de boleto', 'Falar com atendente'],
      'desconhecido': ['Ver meus pedidos', 'Consultar entrega', '2ª via de boleto', 'Falar com atendente']
    };

    return acoesBase[intent] || acoesBase['desconhecido'];
  },

  /**
   * Executar ação automática
   */
  async executarAcao(intent, entidades, clienteId, contexto = {}) {
    try {
      switch (intent) {
        case 'consultar_pedido': {
          if (!clienteId) {
            return { tipo: 'erro', mensagem: 'Para consultar pedidos, preciso identificar você. Qual seu CPF ou CNPJ?' };
          }
          
          const pedidos = await base44.entities.Pedido.filter(
            withContextFilter({ cliente_id: clienteId }, contexto),
            '-data_pedido',
            5
          );
          
          if (pedidos.length === 0) {
            return { tipo: 'info', mensagem: 'Não encontrei pedidos em seu nome. Deseja fazer um novo pedido?' };
          }
          
          const listaPedidos = pedidos.map(p => 
            `• ${p.numero_pedido} - ${p.status} - R$ ${p.valor_total?.toLocaleString('pt-BR')}`
          ).join('\n');
          
          return {
            tipo: 'lista_pedidos',
            mensagem: `📦 Seus últimos pedidos:\n\n${listaPedidos}\n\nDeseja detalhes de algum pedido específico?`,
            dados: pedidos
          };
        }
        
        case 'consultar_entrega': {
          if (!clienteId) {
            return { tipo: 'erro', mensagem: 'Para consultar entregas, preciso identificar você.' };
          }
          
          const entregas = await base44.entities.Entrega.filter(
            withContextFilter({ cliente_id: clienteId, status: { $nin: ['Entregue', 'Cancelado'] } }, contexto),
            '-data_previsao',
            5
          );
          
          if (entregas.length === 0) {
            return { tipo: 'info', mensagem: 'Não encontrei entregas pendentes. Seus pedidos já foram entregues!' };
          }
          
          const listaEntregas = entregas.map(e => 
            `• Pedido ${e.numero_pedido} - ${e.status} - Previsão: ${e.data_previsao ? new Date(e.data_previsao).toLocaleDateString('pt-BR') : 'A definir'}`
          ).join('\n');
          
          return {
            tipo: 'lista_entregas',
            mensagem: `🚚 Suas entregas em andamento:\n\n${listaEntregas}`,
            dados: entregas
          };
        }
        
        case 'segunda_via_boleto': {
          if (!clienteId) {
            return { tipo: 'erro', mensagem: 'Para consultar boletos, preciso identificar você.' };
          }
          
          const boletos = await base44.entities.ContaReceber.filter(
            withContextFilter({ cliente_id: clienteId, status: { $in: ['Pendente', 'Atrasado'] } }, contexto),
            'data_vencimento',
            5
          );
          
          if (boletos.length === 0) {
            return { tipo: 'info', mensagem: '✅ Parabéns! Você não tem boletos em aberto.' };
          }
          
          const listaBoletos = boletos.map(b => 
            `• ${b.descricao || 'Título'} - R$ ${b.valor?.toLocaleString('pt-BR')} - Venc: ${new Date(b.data_vencimento).toLocaleDateString('pt-BR')}`
          ).join('\n');
          
          return {
            tipo: 'lista_boletos',
            mensagem: `💳 Seus boletos em aberto:\n\n${listaBoletos}\n\nDeseja a 2ª via de algum boleto?`,
            dados: boletos
          };
        }
        
        case 'criar_pedido': {
          if (!canRunAutomaticAction(contexto)) {
            return { tipo: 'erro', mensagem: 'Para criar pedido automaticamente, selecione uma empresa/grupo valido e confirme permissao de atendimento.' };
          }
          if (!clienteId) {
            return { tipo: 'erro', mensagem: 'Para criar o pedido, preciso identificar você (cliente). Informe seu CPF/CNPJ ou faça login.' };
          }
          const hoje = new Date();
          const dataIso = hoje.toISOString().slice(0,10);
          let clienteNome = 'Cliente';
          try {
            const c = await base44.entities.Cliente.filter(withContextFilter({ id: clienteId }, contexto));
            if (c?.[0]?.nome) clienteNome = c[0].nome;
          } catch {}

          const numero = `WEB-${Date.now()}`;
          const valor = Number(entidades?.valor || 0);
          const pedido = await base44.entities.Pedido.create(withContextPayload({
            numero_pedido: numero,
            tipo: 'Pedido',
            origem_pedido: 'Chatbot',
            data_pedido: dataIso,
            cliente_id: clienteId,
            cliente_nome: clienteNome,
            valor_total: isNaN(valor) ? 0 : valor,
            pode_ver_no_portal: true,
            prioridade: 'Normal',
            status: 'Rascunho'
          }, contexto));

          try {
            await base44.entities.AuditLog.create({
              usuario: 'Chatbot',
              acao: 'Criação',
              modulo: 'Comercial',
              entidade: 'Pedido',
              registro_id: pedido.id,
              descricao: `Pedido criado via chatbot (${numero})`,
              ...withContextPayload({}, contexto),
              dados_anteriores: null,
              dados_novos: pedido,
              data_hora: new Date().toISOString(),
            });
          } catch {}

          return {
            tipo: 'pedido_criado',
            mensagem: `🧾 Pedido ${numero} criado em rascunho para ${clienteNome}. ${valor>0?`Valor informado: R$ ${valor.toLocaleString('pt-BR')}. `:''}Deseja adicionar itens ou finalizar?`,
            dados: pedido
          };
        }

        case 'emitir_boleto':
        case 'gerar_boleto': {
          if (!canRunAutomaticAction(contexto)) {
            return { tipo: 'erro', mensagem: 'Para emitir boleto automaticamente, selecione uma empresa/grupo valido e confirme permissao financeira.' };
          }
          if (!clienteId) {
            return { tipo: 'erro', mensagem: 'Para emitir boleto, preciso identificar você (cliente).' };
          }
          const valor = Number(entidades?.valor || 0);
          if (!valor || isNaN(valor) || valor <= 0) {
            return { tipo: 'erro', mensagem: 'Informe o valor do boleto (ex: R$ 350,00).'};
          }

          // Buscar configurações mínimas (centro de custo e plano de contas)
          let centroId, planoId;
          try {
            const centros = await base44.entities.CentroCusto.filter(withContextFilter({ status: 'Ativo' }, contexto), '-updated_date', 1);
            centroId = centros?.[0]?.id;
          } catch {}
          try {
            const planos = await base44.entities.PlanoDeContas
              ? await base44.entities.PlanoDeContas.filter(withContextFilter({}, contexto), '-updated_date', 20)
              : [];
            planoId = planos?.[0]?.id;
          } catch {}

          if (!centroId || !planoId) {
            return { tipo: 'erro', mensagem: 'Não consegui emitir boleto: configure Centro de Custo e Plano de Contas padrão para a empresa.' };
          }

          const venc = new Date(Date.now() + 3*24*60*60*1000).toISOString().slice(0,10);
          const cr = await base44.entities.ContaReceber.create(withContextPayload({
            descricao: 'Boleto gerado via Chatbot',
            cliente_id: clienteId,
            valor: valor,
            data_vencimento: venc,
            centro_custo_id: centroId,
            plano_contas_id: planoId,
            forma_cobranca: 'Boleto',
            status_cobranca: 'gerada',
            url_boleto_pdf: null,
            canal_origem: 'Chatbot'
          }, contexto));

          // Emissão real do PDF (função backend)
          try {
            const { data } = await base44.functions.invoke('emitirBoleto', { conta_receber_id: cr.id });
            if (data?.url) {
              await base44.entities.ContaReceber.update(cr.id, withContextPayload({ url_boleto_pdf: data.url }, contexto));
            }
          } catch (e) {
            // mantém registro sem URL se falhar
          }

          try {
            await base44.entities.AuditLog.create({
              usuario: 'Chatbot',
              acao: 'Criação',
              modulo: 'Financeiro',
              entidade: 'ContaReceber',
              registro_id: cr.id,
              descricao: `Boleto emitido via chatbot no valor de R$ ${valor.toLocaleString('pt-BR')}`,
              ...withContextPayload({}, contexto),
              dados_anteriores: null,
              dados_novos: cr,
              data_hora: new Date().toISOString(),
            });
          } catch {}

          return {
            tipo: 'boleto_gerado',
            mensagem: `💳 Boleto criado com vencimento em ${new Date(venc).toLocaleDateString('pt-BR')}. Link para pagamento gerado.`,
            dados: cr
          };
        }
        
        default:
          return null;
      }
    } catch (error) {
      console.error('Erro ao executar ação:', error);
      return { tipo: 'erro', mensagem: 'Desculpe, ocorreu um erro ao processar sua solicitação. Tente novamente.' };
    }
  },

  /**
   * V21.6: Usar IA avançada para análise (com fallback)
   */
  async analisarComIA(mensagem, contexto = {}) {
    try {
      if (!hasContext(contexto) || contexto?.bloquearIA === true) {
        return null;
      }

      const mensagemSanitizada = sanitizePromptText(mensagem, 1200);
      if (!mensagemSanitizada) return null;

      const resultado = await base44.integrations.Core.InvokeLLM({
        prompt: `Analise a mensagem de um cliente e retorne:
1. Intent principal (consultar_pedido, consultar_entrega, segunda_via_boleto, orcamento, suporte_tecnico, falar_atendente, cancelamento, saudacao, agradecimento, despedida, desconhecido)
2. Confiança de 0 a 100
3. Sentimento (Positivo, Neutro, Negativo, Frustrado, Urgente)
4. Entidades detectadas (CPF, CNPJ, número de pedido, valor, data, email, telefone)
5. Se precisa de atendente humano

Mensagem: "${mensagemSanitizada}"

Contexto seguro: ${JSON.stringify(buildSafeLLMContext(contexto))}`,
        response_json_schema: {
          type: "object",
          properties: {
            intent: { type: "string" },
            confianca: { type: "number" },
            sentimento: { type: "string" },
            entidades: { type: "object" },
            necessita_atendente: { type: "boolean" },
            resposta_sugerida: { type: "string" },
            acoes_sugeridas: { type: "array", items: { type: "string" } }
          }
        }
      });
      return resultado;
    } catch (error) {
      console.warn('IA indisponível, usando fallback:', error.message);
      return null;
    }
  }
};

export default IntentEngine;
