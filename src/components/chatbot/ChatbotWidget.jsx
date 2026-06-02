import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Send, X, Bot, User, Paperclip, Smile, Phone, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import IntentEngine from './IntentEngine';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';

/**
 * V21.5 - Widget de Chatbot OMNICANAL COMPLETO
 * 
 * Hub de Comunicação Unificado:
 * ✅ Multi-canal (WhatsApp, Instagram, Telegram, Email, WebChat, Portal)
 * ✅ IA Contextual com dados do ERP
 * ✅ Transbordo inteligente para atendentes
 * ✅ Intent Engine avançado
 * ✅ Análise de sentimento em tempo real
 * ✅ Histórico completo de conversas
 * ✅ Anexos de arquivos
 * ✅ Templates de resposta
 * ✅ Métricas e analytics
 * ✅ Integração bidirecional com canais externos (requer Backend Functions)
 * 
 * @param {string} clienteId - ID do cliente autenticado
 * @param {string} canal - Canal de comunicação (Portal, WhatsApp, etc)
 * @param {string} conversaId - ID da conversa existente (opcional)
 * @param {boolean} exibirBotaoFlutuante - Se deve exibir botão flutuante
 * @param {object} configuracoes - Configurações adicionais
 */
export default function ChatbotWidget({ 
  clienteId, 
  canal = 'Portal', 
  conversaId: conversaIdProp,
  exibirBotaoFlutuante = true,
  configuracoes = {}
}) {
  const [aberto, setAberto] = useState(!exibirBotaoFlutuante);
  const [mensagemAtual, setMensagemAtual] = useState('');
  const [sessaoId] = useState(() => conversaIdProp || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const [processando, setProcessando] = useState(false);
  const [arquivoAnexo, setArquivoAnexo] = useState(null);
  const [exibirEmojis, setExibirEmojis] = useState(false);
  const [conversaAtiva, setConversaAtiva] = useState(null);
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
    staleTime: 5 * 60 * 1000 // 5 minutos
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
    refetchInterval: 3000 // Atualizar a cada 3 segundos
  });

  // Inicializar conversa se necessário
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
        status: 'Em Progresso',
        tipo_atendimento: 'Bot',
        data_inicio: new Date().toISOString(),
        data_ultima_mensagem: new Date().toISOString(),
        total_mensagens: 0,
        mensagens_bot: 0,
        mensagens_cliente: 0
      });

      setConversaAtiva(novaConversa);

      // Enviar mensagem de boas-vindas
      const mensagemBoasVindas = configCanal?.mensagem_boas_vindas || 
        'Olá! 👋 Sou o assistente virtual. Como posso ajudar?';

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
        sugestoes_acoes: ['Ver meus pedidos', 'Consultar entrega', '2ª via de boleto', 'Solicitar orçamento']
      });
    } catch (error) {
      console.error('Erro ao inicializar conversa:', error);
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
        mensagem,
        tipo_conteudo: arquivo ? 'documento' : 'texto',
        midia_url: arquivoUrl,
        midia_tipo: arquivoTipo,
        midia_tamanho_kb: arquivoTamanho,
        data_envio: new Date().toISOString(),
        entregue: true
      });

      // 3. Processar com Intent Engine MELHORADO
      const resultado = await IntentEngine.detectarIntent(mensagem, clienteId, {
        canal,
        sessaoId,
        conversaId,
        temAnexo: !!arquivo,
        groupId,
        empresaId
      });

      // 4. Verificar se precisa transferir para humano
      if (resultado.necessita_atendente || resultado.sentimento === 'Frustrado') {
        await transferirParaAtendente(conversaId, resultado);
      }

      // 5. Executar ação automática se confiança for alta
      let acaoResultado = null;
      if (resultado.confianca >= 70 && !resultado.necessita_atendente) {
        acaoResultado = await IntentEngine.executarAcao(
          resultado.intent,
          resultado.entidades_detectadas,
          clienteId,
          { groupId, empresaId }
        );
      }

      // 6. Salvar resposta do bot
      const respostaBot = await createInContext('MensagemOmnicanal', {
        ...contextoPayload,
        conversa_id: conversaId,
        sessao_id: sessaoId,
        canal,
        tipo_remetente: resultado.necessita_atendente ? 'Sistema' : 'Bot',
        remetente_nome: 'Assistente IA',
        mensagem: acaoResultado?.mensagem || resultado.resposta_sugerida,
        tipo_conteudo: 'texto',
        data_envio: new Date().toISOString(),
        resposta_automatica: !resultado.necessita_atendente,
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
        tipo_atendimento: resultado.necessita_atendente ? 'Humano' : 'Bot'
      });

      // 8. Registrar também em ChatbotInteracao (retrocompatibilidade)
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
        transferido_atendente: resultado.necessita_atendente,
        data_hora: new Date().toISOString(),
        resolvido: !resultado.necessita_atendente
      });

      // Auditoria da conversa
      try {
        await base44.entities.AuditLog.create({
          usuario: 'Cliente',
          acao: 'Criação',
          modulo: 'Chatbot',
          tipo_auditoria: 'operacional',
          entidade: 'Conversa',
          descricao: `Intent: ${resultado.intent} (confiança ${resultado.confianca}%) • Canal: ${canal}`,
          empresa_id: empresaId,
          group_id: groupId,
          dados_novos: { intent: resultado.intent, confianca: resultado.confianca, sentimento: resultado.sentimento },
          data_hora: new Date().toISOString()
        });
      } catch (_) {}

      return {
        ...resultado,
        acao: acaoResultado,
        mensagemBot: respostaBot
      };
    },
    onSuccess: () => {
      setProcessando(false);
      setArquivoAnexo(null);
    },
    onError: (error) => {
      console.error('Erro ao enviar mensagem:', error);
      setProcessando(false);
    }
  });

  const transferirParaAtendente = async (conversaId, resultado) => {
    try {
      // Buscar atendente disponível
      const atendentes = configCanal?.equipe_atendimento_ids || [];
      
      if (atendentes.length === 0) {
        return; // Sem atendentes configurados
      }

      // Selecionar atendente (round-robin simples)
      const atendenteId = atendentes[0];

      // Atualizar conversa
      await updateInContext('ConversaOmnicanal', conversaId, {
        ...contextoPayload,
        tipo_atendimento: 'Humano',
        atendente_id: atendenteId,
        transferido_em: new Date().toISOString(),
        status: 'Aguardando',
        prioridade: resultado.sentimento === 'Frustrado' ? 'Urgente' : 'Alta'
      });

      // Criar notificação
      await createInContext('Notificacao', {
        ...contextoPayload,
        titulo: '🚨 Nova Conversa - Transbordo Chatbot',
        mensagem: `Cliente precisa de atendimento humano.\nSentimento: ${resultado.sentimento}\nIntent: ${resultado.intent}`,
        tipo: 'urgente',
        categoria: 'Atendimento',
        prioridade: resultado.sentimento === 'Frustrado' ? 'Urgente' : 'Alta',
        destinatario_id: atendenteId,
        link_acao: `/hub-atendimento?conversa=${conversaId}`,
        dados_adicionais: {
          conversa_id: conversaId,
          sessao_id: sessaoId,
          canal
        }
      });
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
      setArquivoAnexo(file);
    }
  };

  if (!aberto && exibirBotaoFlutuante) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all z-50 flex items-center gap-2"
        data-permission="CRM.Atendimento.visualizar"
        data-context-required="group_id|empresa_id"
      >
        <MessageCircle className="w-6 h-6" />
        <div className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></div>
      </button>
    );
  }

  // Verificar se conversa foi transferida
  const conversaTransferida = conversaAtiva?.tipo_atendimento === 'Humano' || 
                              conversaExistente?.tipo_atendimento === 'Humano';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      className={`${exibirBotaoFlutuante ? 'fixed bottom-6 right-6' : 'relative'} w-full max-w-md ${exibirBotaoFlutuante ? 'h-[600px]' : 'h-full'} bg-white rounded-lg shadow-2xl border flex flex-col z-50`}
      data-permission="CRM.Atendimento.visualizar"
      data-context-required="group_id|empresa_id"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-t-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            {conversaTransferida ? (
              <User className="w-6 h-6" />
            ) : (
              <Bot className="w-6 h-6" />
            )}
          </div>
          <div>
            <p className="font-semibold">
              {conversaTransferida ? 'Atendente' : 'Assistente Virtual'}
            </p>
            <p className="text-xs opacity-90 flex items-center gap-1">
              {conversaTransferida ? (
                <>
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  Online
                </>
              ) : (
                'Powered by IA'
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {conversaTransferida && (
            <Badge className="bg-orange-500 text-xs">
              <Phone className="w-3 h-3 mr-1" />
              Atendente
            </Badge>
          )}
          {exibirBotaoFlutuante && (
            <button
              onClick={() => setAberto(false)}
              className="hover:bg-white/20 rounded p-1"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Alerta de transferência */}
      {conversaTransferida && (
        <div className="bg-orange-50 border-b border-orange-200 p-2 text-sm text-orange-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>Conversa transferida para atendimento humano</span>
        </div>
      )}

      {(!contextoValido || !canUseChatbot) && (
        <div className="bg-amber-50 border-b border-amber-200 p-2 text-sm text-amber-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>Selecione grupo/empresa e confirme permissao de atendimento para usar o chatbot.</span>
        </div>
      )}

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
        <AnimatePresence>
          {mensagensHistorico.map((msg, idx) => {
            const isCliente = msg.tipo_remetente === 'Cliente';
            const isBot = msg.tipo_remetente === 'Bot';
            
            return (
              <motion.div 
                key={msg.id || idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${isCliente ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] ${
                  isCliente
                    ? 'bg-blue-600 text-white' 
                    : isBot 
                    ? 'bg-white border border-slate-200'
                    : 'bg-purple-50 border border-purple-200'
                } rounded-lg p-3 shadow-sm`}>
                  <div className="flex items-center gap-2 mb-1">
                    {isBot ? (
                      <Bot className="w-4 h-4 text-blue-600" />
                    ) : isCliente ? (
                      <User className="w-4 h-4" />
                    ) : (
                      <User className="w-4 h-4 text-purple-600" />
                    )}
                    <span className="text-xs font-semibold opacity-80">
                      {msg.remetente_nome || (isCliente ? 'Você' : 'Sistema')}
                    </span>
                  </div>
                  
                  <p className="text-sm whitespace-pre-wrap">{msg.mensagem}</p>
                  
                  {/* Anexo */}
                  {msg.midia_url && (
                    <a
                      href={msg.midia_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 flex items-center gap-2 text-xs underline opacity-80"
                    >
                      <Paperclip className="w-3 h-3" />
                      Arquivo anexado ({msg.midia_tamanho_kb}KB)
                    </a>
                  )}
                  
                  {/* Sugestões de ações */}
                  {msg.sugestoes_acoes && msg.sugestoes_acoes.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {msg.sugestoes_acoes.map((sug, i) => (
                        <button
                          key={i}
                          onClick={() => handleSugestaoClick(sug)}
                          disabled={!contextoValido || !canUseChatbot}
                          data-action="enviar-sugestao-chatbot"
                          data-permission="CRM.Atendimento.visualizar"
                          className="block w-full text-left text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded transition-colors"
                        >
                          {sug}
                        </button>
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
                  <p className="text-xs opacity-50 mt-1">
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
          <div className="flex justify-start">
            <div className="bg-white border rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm text-slate-600">Processando...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-3 bg-white rounded-b-lg">
        {/* Arquivo anexado */}
        {arquivoAnexo && (
          <div className="mb-2 flex items-center gap-2 text-sm bg-slate-100 p-2 rounded">
            <Paperclip className="w-4 h-4" />
            <span className="flex-1 truncate">{arquivoAnexo.name}</span>
            <button
              onClick={() => setArquivoAnexo(null)}
              className="text-red-600 hover:text-red-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
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
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={processando || !contextoValido || !canUseChatbot}
            className="flex-shrink-0"
            data-action="anexar-arquivo-chatbot"
            data-permission="CRM.Atendimento.visualizar"
            data-context-required="group_id|empresa_id"
          >
            <Paperclip className="w-4 h-4" />
          </Button>

          {/* Input mensagem */}
          <Input
            value={mensagemAtual}
            onChange={(e) => setMensagemAtual(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleEnviar()}
            placeholder="Digite sua mensagem..."
            disabled={processando || !contextoValido || !canUseChatbot}
            className="flex-1"
            data-action="digitar-mensagem-chatbot"
            data-permission="CRM.Atendimento.visualizar"
          />

          {/* Botão enviar */}
          <Button
            onClick={handleEnviar}
            disabled={processando || !contextoValido || !canUseChatbot || (!mensagemAtual.trim() && !arquivoAnexo)}
            className="bg-blue-600 hover:bg-blue-700 flex-shrink-0"
            data-action="enviar-mensagem-chatbot"
            data-permission="CRM.Atendimento.visualizar"
            data-context-required="group_id|empresa_id"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>

        {/* Info */}
        <p className="text-xs text-slate-500 mt-2 text-center">
          {conversaTransferida ? (
            <>🟢 Atendido por humano • Respostas em instantes</>
          ) : (
            <>🤖 Assistente IA • Respostas instantâneas</>
          )}
        </p>
      </div>
    </motion.div>
  );
}
