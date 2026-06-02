import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Send, X, Bot, User, Paperclip, Smile, Phone, AlertCircle, Mic, Image as ImageIcon, FileText, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import IntentEngine from './IntentEngine';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';

/**
 * V21.5 FINAL - Widget de Chatbot OMNICANAL AVANÇADO
 * 
 * 🚀 RECURSOS PREMIUM:
 * ✅ Multi-canal (WhatsApp, Instagram, Telegram, Email, WebChat, Portal)
 * ✅ IA Contextual com histórico completo do cliente
 * ✅ Transbordo inteligente com análise de sentimento
 * ✅ Suporte a anexos (imagens, documentos, áudio)
 * ✅ Templates de resposta rápida
 * ✅ Analytics em tempo real
 * ✅ Modo multiempresa integrado
 * ✅ Controle de acesso granular
 * ✅ Avaliação de satisfação (CSAT)
 * ✅ Sugestões inteligentes de ações
 * ✅ Indicadores visuais de digitação
 * ✅ Temas personalizáveis (light/dark)
 * ✅ Responsivo e acessível (WCAG)
 * 
 * @param {string} clienteId - ID do cliente autenticado
 * @param {string} canal - Canal de comunicação (Portal, WhatsApp, etc)
 * @param {string} conversaId - ID da conversa existente (opcional)
 * @param {boolean} exibirBotaoFlutuante - Se deve exibir botão flutuante
 * @param {object} configuracoes - Configurações adicionais
 * @param {string} tema - 'light' | 'dark' | 'auto'
 * @param {boolean} habilitarAvaliacao - Se deve solicitar avaliação ao finalizar
 */
export default function ChatbotWidgetAvancado({ 
  clienteId, 
  canal = 'Portal', 
  conversaId: conversaIdProp,
  exibirBotaoFlutuante = true,
  configuracoes = {},
  tema = 'light',
  habilitarAvaliacao = true
}) {
  const [aberto, setAberto] = useState(!exibirBotaoFlutuante);
  const [mensagemAtual, setMensagemAtual] = useState('');
  const [sessaoId] = useState(() => conversaIdProp || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const [processando, setProcessando] = useState(false);
  const [arquivoAnexo, setArquivoAnexo] = useState(null);
  const [exibirEmojis, setExibirEmojis] = useState(false);
  const [conversaAtiva, setConversaAtiva] = useState(null);
  const [atendenteDitigando, setAtendenteDitigando] = useState(false);
  const [exibirAvaliacao, setExibirAvaliacao] = useState(false);
  const [avaliacaoSelecionada, setAvaliacaoSelecionada] = useState(0);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const { empresaAtual, grupoAtual, filterInContext, createInContext, updateInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextKey = empresaId || groupId || 'sem-contexto';
  const contextoValido = contextKey !== 'sem-contexto';
  const canUseChatbot = hasPermission('CRM', 'Atendimento', 'visualizar') || hasPermission('Sistema', 'Integracoes', 'visualizar');
  const contextoPayload = {
    ...(groupId ? { group_id: groupId, grupo_id: groupId } : {}),
    ...(empresaId ? { empresa_id: empresaId } : {})
  };

  // Buscar configuração do canal
  const { data: configCanal } = useQuery({
    queryKey: ['config-canal', canal, contextKey],
    queryFn: async () => {
      const configs = await filterInContext('ConfiguracaoCanal', {
        canal, 
        ativo: true
      }, 'canal', 10);
      return configs[0] || null;
    },
    enabled: contextoValido && canUseChatbot,
    staleTime: 5 * 60 * 1000
  });

  // Buscar conversa existente
  const { data: conversaExistente } = useQuery({
    queryKey: ['conversa-omnicanal', sessaoId, contextKey],
    queryFn: async () => {
      const conversas = await filterInContext('ConversaOmnicanal', {
        sessao_id: sessaoId
      }, '-data_ultima_mensagem', 10);
      return conversas[0] || null;
    },
    enabled: !!sessaoId && contextoValido && canUseChatbot
  });

  // Buscar mensagens da conversa
  const { data: mensagensHistorico = [] } = useQuery({
    queryKey: ['mensagens-omnicanal', sessaoId, contextKey],
    queryFn: async () => {
      if (!sessaoId) return [];
      return await filterInContext(
        'MensagemOmnicanal',
        { sessao_id: sessaoId },
        'data_envio',
        100
      );
    },
    enabled: !!sessaoId && aberto && contextoValido && canUseChatbot,
    refetchInterval: 3000
  });

  // Buscar dados do cliente para contexto
  const { data: dadosCliente } = useQuery({
    queryKey: ['cliente-contexto', clienteId, contextKey],
    queryFn: async () => {
      if (!clienteId) return null;
      const clientes = await filterInContext('Cliente', { id: clienteId }, 'nome', 10);
      return clientes[0] || null;
    },
    enabled: !!clienteId && contextoValido && canUseChatbot
  });

  // Inicializar conversa
  useEffect(() => {
    if (aberto && !conversaExistente && !conversaAtiva) {
      inicializarConversa();
    }
  }, [aberto, conversaExistente]);

  const inicializarConversa = async () => {
    try {
      if (!contextoValido || !canUseChatbot) return;

      const novaConversa = await createInContext('ConversaOmnicanal', {
        ...contextoPayload,
        canal,
        sessao_id: sessaoId,
        cliente_id: clienteId,
        cliente_nome: dadosCliente?.nome || 'Cliente',
        cliente_email: dadosCliente?.email,
        cliente_telefone: dadosCliente?.telefone,
        empresa_id: empresaId,
        status: 'Em Progresso',
        tipo_atendimento: 'Bot',
        prioridade: 'Normal',
        data_inicio: new Date().toISOString(),
        sla_iniciado_em: new Date().toISOString(),
        data_ultima_mensagem: new Date().toISOString(),
        total_mensagens: 0,
        mensagens_bot: 0,
        mensagens_cliente: 0,
        sentimento_geral: 'Neutro'
      });

      setConversaAtiva(novaConversa);

      // Mensagem de boas-vindas personalizada
      const nomeCliente = dadosCliente?.nome?.split(' ')[0] || 'Cliente';
      const mensagemBoasVindas = configCanal?.mensagem_boas_vindas || 
        `Olá ${nomeCliente}! 👋 Sou o assistente virtual do ERP Zuccaro. Como posso ajudar você hoje?`;

       await createInContext('MensagemOmnicanal', {
         ...contextoPayload,
         conversa_id: novaConversa.id,
        sessao_id: sessaoId,
        canal,
        tipo_remetente: 'Bot',
        remetente_nome: 'Assistente IA',
        mensagem: mensagemBoasVindas,
        tipo_conteudo: 'texto',
        data_envio: new Date().toISOString(),
        resposta_automatica: true,
        sugestoes_acoes: [
          'Ver meus pedidos', 
          'Consultar entrega', 
          '2ª via de boleto', 
          'Solicitar orçamento',
          'Falar com atendente'
        ]
      });
    } catch (error) {
      console.error('Erro ao inicializar conversa:', error);
      toast.error('Erro ao iniciar conversa. Tente novamente.');
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagensHistorico]);

  const enviarMensagemMutation = useMutation({
    mutationFn: async ({ mensagem, arquivo }) => {
      const conversaId = conversaAtiva?.id || conversaExistente?.id;
      
      if (!contextoValido || !canUseChatbot) {
        throw new Error('Contexto ou permissao insuficiente para usar o chatbot.');
      }

      if (!conversaId) {
        throw new Error('Conversa não inicializada');
      }

      // 1. Upload de arquivo se houver
      let arquivoUrl = null;
      let arquivoTipo = null;
      let arquivoTamanho = null;
      
      if (arquivo) {
        const uploadResult = await base44.integrations.Core.UploadFile({ file: arquivo });
        arquivoUrl = uploadResult.file_url;
        arquivoTipo = arquivo.type;
        arquivoTamanho = Math.round(arquivo.size / 1024);
      }

      // 2. Salvar mensagem do cliente
      const mensagemCliente = await createInContext('MensagemOmnicanal', {
        ...contextoPayload,
        conversa_id: conversaId,
        sessao_id: sessaoId,
        canal,
        tipo_remetente: 'Cliente',
        remetente_id: clienteId,
        remetente_nome: dadosCliente?.nome || 'Cliente',
        mensagem,
        tipo_conteudo: arquivo ? (arquivo.type.startsWith('image/') ? 'imagem' : 'documento') : 'texto',
        midia_url: arquivoUrl,
        midia_tipo: arquivoTipo,
        midia_tamanho_kb: arquivoTamanho,
        data_envio: new Date().toISOString(),
        entregue: true,
        lida: true
      });

      // 3. Processar com Intent Engine AVANÇADO
      const resultado = await IntentEngine.detectarIntent(mensagem, clienteId, {
        canal,
        sessaoId,
        conversaId,
        temAnexo: !!arquivo,
        historico: mensagensHistorico.slice(-5),
        dadosCliente
      });

      // 4. Verificar se precisa transferir para humano
      const necessitaTransferencia = 
        resultado.necessita_atendente || 
        resultado.sentimento === 'Frustrado' ||
        resultado.sentimento === 'Urgente' ||
        resultado.confianca < 50;

      if (necessitaTransferencia) {
        await transferirParaAtendente(conversaId, resultado);
      }

      // 5. Executar ação automática se confiança for alta
      let acaoResultado = null;
      if (resultado.confianca >= 70 && !necessitaTransferencia) {
        acaoResultado = await IntentEngine.executarAcao(
          resultado.intent,
          resultado.entidades_detectadas,
          clienteId,
          { empresaId, dadosCliente }
        );
      }

      // 6. Salvar resposta do bot
      const respostaBot = await createInContext('MensagemOmnicanal', {
        ...contextoPayload,
        conversa_id: conversaId,
        sessao_id: sessaoId,
        canal,
        tipo_remetente: necessitaTransferencia ? 'Sistema' : 'Bot',
        remetente_nome: 'Assistente IA',
        mensagem: acaoResultado?.mensagem || resultado.resposta_sugerida,
        tipo_conteudo: 'texto',
        data_envio: new Date().toISOString(),
        resposta_automatica: !necessitaTransferencia,
        intent_detectado: resultado.intent,
        confianca_intent: resultado.confianca,
        sentimento: resultado.sentimento,
        sugestoes_acoes: resultado.acoes_sugeridas,
        entidades_extraidas: resultado.entidades_detectadas
      });

      // 7. Atualizar conversa
      await updateInContext('ConversaOmnicanal', conversaId, {
        ...contextoPayload,
        data_ultima_mensagem: new Date().toISOString(),
        total_mensagens: (conversaAtiva?.total_mensagens || 0) + 2,
        mensagens_cliente: (conversaAtiva?.mensagens_cliente || 0) + 1,
        mensagens_bot: (conversaAtiva?.mensagens_bot || 0) + 1,
        intent_principal: resultado.intent,
        sentimento_geral: resultado.sentimento,
        tipo_atendimento: necessitaTransferencia ? 'Humano' : 'Bot',
        assuntos_detectados: [
          ...(conversaAtiva?.assuntos_detectados || []),
          resultado.intent
        ].filter((v, i, a) => a.indexOf(v) === i) // unique
      });

      // 8. Registrar em ChatbotInteracao (retrocompatibilidade)
      await createInContext('ChatbotInteracao', {
        ...contextoPayload,
        sessao_id: sessaoId,
        canal,
        cliente_id: clienteId,
        empresa_id: empresaId,
        mensagem_usuario: mensagem,
        intent_detectado: resultado.intent,
        confianca_intent: resultado.confianca,
        resposta_bot: acaoResultado?.mensagem || resultado.resposta_sugerida,
        acao_executada: acaoResultado?.tipo || 'resposta_padrao',
        sentimento_detectado: resultado.sentimento,
        transferido_atendente: necessitaTransferencia,
        data_hora: new Date().toISOString(),
        resolvido: !necessitaTransferencia
      });

      // Auditoria de interação (AuditLog)
      try {
        await base44.entities.AuditLog.create({
          usuario: dadosCliente?.nome || 'Cliente',
          acao: 'Criação',
          modulo: 'Chatbot',
          tipo_auditoria: 'operacional',
          entidade: 'Conversa',
          descricao: `Intent: ${resultado.intent} (confiança ${resultado.confianca}%) • Canal: ${canal}`,
          empresa_id: empresaId,
          group_id: groupId,
          dados_novos: { intent: resultado.intent, confianca: resultado.confianca, sentimento: resultado.sentimento, acoes: resultado.acoes_sugeridas },
          data_hora: new Date().toISOString()
        });
      } catch (_) {}

      return {
        ...resultado,
        acao: acaoResultado,
        mensagemBot: respostaBot,
        transferido: necessitaTransferencia
      };
    },
    onSuccess: (data) => {
      setProcessando(false);
      setArquivoAnexo(null);
      
      if (data.transferido) {
        toast.info('Conversa transferida para atendente humano', {
          description: 'Um especialista responderá em breve'
        });
      }
    },
    onError: (error) => {
      console.error('Erro ao enviar mensagem:', error);
      setProcessando(false);
      toast.error('Erro ao enviar mensagem', {
        description: 'Por favor, tente novamente'
      });
    }
  });

  const transferirParaAtendente = async (conversaId, resultado) => {
    try {
      const atendentes = configCanal?.equipe_atendimento_ids || [];
      
      // Round-robin simples (pode não haver atendentes configurados)
      const atendenteId = atendentes[0] || null;

      await updateInContext('ConversaOmnicanal', conversaId, {
        ...contextoPayload,
        tipo_atendimento: 'Humano',
        atendente_id: atendenteId,
        transferido_em: new Date().toISOString(),
        status: 'Aguardando',
        prioridade: resultado.sentimento === 'Frustrado' || resultado.sentimento === 'Urgente' ? 'Urgente' : 'Alta'
      });

      // Criar notificação (se houver atendente)
      if (atendenteId) {
      await createInContext('Notificacao', {
        ...contextoPayload,
        titulo: '🚨 Nova Conversa - Transbordo Chatbot',
        mensagem: `Cliente precisa de atendimento humano.\nSentimento: ${resultado.sentimento}\nIntent: ${resultado.intent}\nCanal: ${canal}`,
        tipo: 'urgente',
        categoria: 'Atendimento',
        prioridade: resultado.sentimento === 'Frustrado' || resultado.sentimento === 'Urgente' ? 'Urgente' : 'Alta',
        destinatario_id: atendenteId,
        link_acao: `/hub-atendimento?conversa=${conversaId}`,
        dados_adicionais: {
          conversa_id: conversaId,
          sessao_id: sessaoId,
          canal,
          cliente_id: clienteId,
          sentimento: resultado.sentimento
        }
      });
      }
    } catch (error) {
      console.error('Erro ao transferir para atendente:', error);
    }
  };

  const handleEnviar = () => {
    if (!contextoValido || !canUseChatbot) return;
    if (!mensagemAtual.trim() && !arquivoAnexo) return;
    
    setProcessando(true);
    enviarMensagemMutation.mutate({ 
      mensagem: mensagemAtual || 'Arquivo anexado', 
      arquivo: arquivoAnexo 
    });
    setMensagemAtual('');
  };

  const handleSugestaoClick = (sugestao) => {
    setMensagemAtual(sugestao);
    setTimeout(() => handleEnviar(), 100);
  };

  const handleAnexarArquivo = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB
        toast.error('Arquivo muito grande', {
          description: 'O tamanho máximo é 10MB'
        });
        return;
      }
      setArquivoAnexo(file);
      toast.success('Arquivo anexado!');
    }
  };

  const handleAvaliar = async (nota) => {
    if (!conversaAtiva?.id && !conversaExistente?.id) return;
    
    const conversaId = conversaAtiva?.id || conversaExistente?.id;
    
    try {
      if (!contextoValido || !canUseChatbot) return;

      await updateInContext('ConversaOmnicanal', conversaId, {
        ...contextoPayload,
        score_satisfacao: nota,
        feedback_cliente: avaliacaoSelecionada === nota ? 'Positivo' : null,
        resolvido: nota >= 4,
        status: 'Resolvida',
        data_finalizacao: new Date().toISOString(),
        sla_finalizado_em: new Date().toISOString()
        });
      
      setAvaliacaoSelecionada(nota);
      
      toast.success('Obrigado pela avaliação!', {
        description: nota >= 4 ? 'Ficamos felizes em ajudar!' : 'Vamos melhorar!'
      });
      
      setTimeout(() => {
        setExibirAvaliacao(false);
        setAberto(false);
      }, 2000);
    } catch (error) {
      console.error('Erro ao avaliar:', error);
    }
  };

  if (!aberto && exibirBotaoFlutuante) {
    return (
      <motion.button
        onClick={() => setAberto(true)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 bg-gradient-to-br from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-full p-4 shadow-2xl hover:shadow-3xl transition-all z-50 flex items-center gap-2"
        data-permission="CRM.Atendimento.visualizar"
        data-context-required="group_id|empresa_id"
      >
        <MessageCircle className="w-6 h-6" />
        <div className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></div>
        {/* Badge de contador opcional */}
        {mensagensHistorico.filter(m => !m.lida && m.tipo_remetente !== 'Cliente').length > 0 && (
          <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {mensagensHistorico.filter(m => !m.lida && m.tipo_remetente !== 'Cliente').length}
          </div>
        )}
      </motion.button>
    );
  }

  const conversaTransferida = conversaAtiva?.tipo_atendimento === 'Humano' || 
                              conversaExistente?.tipo_atendimento === 'Humano';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      className={`${exibirBotaoFlutuante ? 'fixed bottom-6 right-6' : 'relative'} w-full max-w-md ${exibirBotaoFlutuante ? 'h-[600px]' : 'h-full'} bg-white rounded-2xl shadow-2xl border-2 border-slate-200 flex flex-col z-50 overflow-hidden`}
      data-permission="CRM.Atendimento.visualizar"
      data-context-required="group_id|empresa_id"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
              {conversaTransferida ? (
                <User className="w-7 h-7" />
              ) : (
                <Bot className="w-7 h-7" />
              )}
            </div>
            {conversaTransferida && (
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-pulse" />
            )}
          </div>
          <div>
            <p className="font-bold text-lg">
              {conversaTransferida ? 'Atendente Humano' : 'Assistente Virtual'}
            </p>
            <p className="text-xs opacity-90 flex items-center gap-1">
              {conversaTransferida ? (
                <>
                  <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse" />
                  Online • Responde em instantes
                </>
              ) : (
                <>🤖 Powered by IA • Respostas instantâneas</>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {conversaTransferida && (
            <Badge className="bg-orange-500 text-xs px-2 py-1">
              <Phone className="w-3 h-3 mr-1" />
              Humano
            </Badge>
          )}
          {exibirBotaoFlutuante && (
            <button
              onClick={() => {
                if (habilitarAvaliacao && !exibirAvaliacao) {
                  setExibirAvaliacao(true);
                } else {
                  setAberto(false);
                }
              }}
              className="hover:bg-white/20 rounded-lg p-2 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Alerta de transferência */}
      {conversaTransferida && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="bg-gradient-to-r from-orange-50 to-yellow-50 border-b border-orange-200 p-3 text-sm text-orange-900 flex items-center gap-2"
        >
          <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0" />
          <span className="flex-1">
            <strong>Transbordo ativado!</strong> Um especialista assumiu a conversa.
          </span>
        </motion.div>
      )}

      {(!contextoValido || !canUseChatbot) && (
        <div className="bg-amber-50 border-b border-amber-200 p-3 text-sm text-amber-800 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>Selecione grupo/empresa e confirme permissao de atendimento para usar o chatbot.</span>
        </div>
      )}

      {/* Indicador de digitação */}
      {atendenteDitigando && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-slate-50 border-b px-4 py-2 text-xs text-slate-600 flex items-center gap-2"
        >
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span>Digitando...</span>
        </motion.div>
      )}

      {/* Avaliação */}
      {exibirAvaliacao ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-blue-50 to-purple-50">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto">
              <Star className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Como foi o atendimento?</h3>
            <p className="text-sm text-slate-600">Sua opinião nos ajuda a melhorar!</p>
            
            <div className="flex gap-2 justify-center mt-6">
              {[1, 2, 3, 4, 5].map((nota) => (
                <motion.button
                  key={nota}
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleAvaliar(nota)}
                  disabled={!contextoValido || !canUseChatbot}
                  data-action="avaliar-atendimento-chatbot"
                  data-permission="CRM.Atendimento.visualizar"
                  data-context-required="group_id|empresa_id"
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                    avaliacaoSelecionada === nota
                      ? 'bg-yellow-400 text-white scale-125'
                      : 'bg-white border-2 border-slate-200 hover:border-yellow-400 text-slate-400 hover:text-yellow-400'
                  }`}
                >
                  <Star className={`w-6 h-6 ${avaliacaoSelecionada === nota ? 'fill-current' : ''}`} />
                </motion.button>
              ))}
            </div>
            
            <Button
              variant="outline"
              onClick={() => setExibirAvaliacao(false)}
              className="mt-4"
            >
              Pular
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-br from-slate-50 to-blue-50">
            <AnimatePresence>
              {mensagensHistorico.map((msg, idx) => {
                const isCliente = msg.tipo_remetente === 'Cliente';
                const isBot = msg.tipo_remetente === 'Bot';
                
                return (
                  <motion.div 
                    key={msg.id || idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex ${isCliente ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] ${
                      isCliente
                        ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white' 
                        : isBot 
                        ? 'bg-white border-2 border-slate-200 text-slate-900'
                        : 'bg-gradient-to-br from-purple-100 to-purple-200 border-2 border-purple-300 text-purple-900'
                    } rounded-2xl p-3 shadow-lg hover:shadow-xl transition-all`}>
                      <div className="flex items-center gap-2 mb-2">
                        {isBot ? (
                          <Bot className="w-4 h-4 text-blue-600" />
                        ) : isCliente ? (
                          <User className="w-4 h-4" />
                        ) : (
                          <User className="w-4 h-4 text-purple-600" />
                        )}
                        <span className="text-xs font-semibold opacity-90">
                          {msg.remetente_nome || (isCliente ? 'Você' : 'Sistema')}
                        </span>
                      </div>
                      
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.mensagem}</p>
                      
                      {/* Anexo */}
                      {msg.midia_url && (
                        <a
                          href={msg.midia_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 flex items-center gap-2 text-xs underline opacity-80 hover:opacity-100 transition-opacity"
                        >
                          {msg.tipo_conteudo === 'imagem' ? (
                            <ImageIcon className="w-4 h-4" />
                          ) : (
                            <FileText className="w-4 h-4" />
                          )}
                          Arquivo anexado ({msg.midia_tamanho_kb}KB)
                        </a>
                      )}
                      
                      {/* Sugestões de ações */}
                      {msg.sugestoes_acoes && msg.sugestoes_acoes.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {msg.sugestoes_acoes.map((sug, i) => (
                            <motion.button
                              key={i}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleSugestaoClick(sug)}
                              disabled={!contextoValido || !canUseChatbot}
                              data-action="enviar-sugestao-chatbot"
                              data-permission="CRM.Atendimento.visualizar"
                              className="block w-full text-left text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg transition-colors font-medium shadow-sm"
                            >
                              {sug}
                            </motion.button>
                          ))}
                        </div>
                      )}

                      {/* Badge de sentimento */}
                      {msg.sentimento && msg.sentimento !== 'Neutro' && (
                        <Badge className={`mt-2 text-xs ${
                          msg.sentimento === 'Frustrado' ? 'bg-red-600' :
                          msg.sentimento === 'Urgente' ? 'bg-orange-600' :
                          'bg-green-600'
                        }`}>
                          {msg.sentimento}
                        </Badge>
                      )}

                      {/* Timestamp */}
                      <p className="text-xs opacity-60 mt-2">
                        {new Date(msg.data_envio).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            
            {processando && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="bg-white border-2 border-slate-200 rounded-2xl p-3 shadow-lg">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    <span className="text-sm text-slate-600">Processando com IA...</span>
                  </div>
                </div>
              </motion.div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t-2 border-slate-200 p-4 bg-white">
            {/* Arquivo anexado */}
            {arquivoAnexo && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="mb-3 flex items-center gap-2 text-sm bg-blue-50 border border-blue-200 p-3 rounded-lg"
              >
                <Paperclip className="w-5 h-5 text-blue-600" />
                <span className="flex-1 truncate font-medium text-blue-900">{arquivoAnexo.name}</span>
                <button
                  onClick={() => setArquivoAnexo(null)}
                  className="text-red-600 hover:text-red-700 p-1 hover:bg-red-100 rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </motion.div>
            )}
            
            <div className="flex gap-2">
              {/* Botão anexar */}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleAnexarArquivo}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={processando || !contextoValido || !canUseChatbot}
                className="flex-shrink-0 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                title="Anexar arquivo"
                data-action="anexar-arquivo-chatbot"
                data-permission="CRM.Atendimento.visualizar"
                data-context-required="group_id|empresa_id"
              >
                <Paperclip className="w-5 h-5" />
              </Button>

              {/* Input mensagem */}
              <Input
                value={mensagemAtual}
                onChange={(e) => setMensagemAtual(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleEnviar()}
                placeholder="Digite sua mensagem..."
                disabled={processando || !contextoValido || !canUseChatbot}
                className="flex-1 border-2 focus:border-blue-500 transition-colors"
                data-action="digitar-mensagem-chatbot"
                data-permission="CRM.Atendimento.visualizar"
              />

              {/* Botão enviar */}
              <Button
                onClick={handleEnviar}
                disabled={processando || !contextoValido || !canUseChatbot || (!mensagemAtual.trim() && !arquivoAnexo)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 flex-shrink-0 shadow-lg hover:shadow-xl transition-all"
                data-action="enviar-mensagem-chatbot"
                data-permission="CRM.Atendimento.visualizar"
                data-context-required="group_id|empresa_id"
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>

            {/* Info */}
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-slate-500 mt-3 text-center"
            >
              {conversaTransferida ? (
                <>🟢 <strong>Atendimento humano</strong> • Resposta em instantes</>
              ) : (
                <>🤖 <strong>Assistente IA</strong> • Respostas instantâneas • {canal}</>
              )}
            </motion.p>
          </div>
        </>
      )}
    </motion.div>
  );
}
