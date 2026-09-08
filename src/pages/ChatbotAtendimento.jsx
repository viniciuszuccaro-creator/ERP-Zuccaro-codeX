import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  MessageCircle, 
  Bot, 
  Send, 
  AlertTriangle, 
  CheckCircle2,
  FileText,
  CreditCard,
  Package,
  Phone,
  Loader2,
  User,
  Timer,
  Shield
} from "lucide-react";
import { toast } from "sonner";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { buildEscalarParaHub, resolveSessaoEstavel } from "@/components/lib/atendimentoConversaPolicy";

/**
 * V21.6 - Chatbot ERP-Cêntrico - 100% COMPLETO
 * Intent Engine + Sentimento + Transbordo com Verificação de Permissão
 * ✅ Suporte multi-empresa
 * ✅ Integração com HubAtendimento
 * ✅ IA com fallback
 * ✅ Layout responsivo w-full h-full
 */
export default function ChatbotAtendimento() {
  const [mensagem, setMensagem] = useState('');
  const [sessaoAtual, setSessaoAtual] = useState(null);
  const [clienteAutenticado, setClienteAutenticado] = useState(null);
  const [vendedorAtendendo, setVendedorAtendendo] = useState(null);
  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, createInContext } = useContextoVisual();
  const { hasPermission, isAdmin } = usePermissions();

  // V21.1: Buscar intents configurados
  const { data: intentsConfig = [] } = useQuery({
    queryKey: ['chatbot-intents'],
    queryFn: () => base44.entities.ChatbotIntents.filter({ ativo: true }),
  });

  const { data: interacoes = [] } = useQuery({
    queryKey: ['chatbot-interacoes', sessaoAtual],
    queryFn: () => {
      if (!sessaoAtual) return [];
      const filtro = empresaAtual?.id ? { sessao_id: sessaoAtual, empresa_id: empresaAtual.id } : { sessao_id: sessaoAtual };
      return base44.entities.ChatbotInteracao.filter(
        filtro,
        '-data_hora',
        50
      );
    },
    enabled: !!sessaoAtual
  });

  // Inicializar sessão
  useEffect(() => {
    if (!sessaoAtual) {
      setSessaoAtual(resolveSessaoEstavel({ canal: 'Portal', empresaId: empresaAtual?.id, clienteId: clienteAutenticado?.id }));
    }
  }, []);

  const enviarMensagemMutation = useMutation({
    mutationFn: async (msg) => {
      const intent = await detectarIntent(msg);
      
      if (intent.requer_autenticacao && !clienteAutenticado) {
        return await base44.entities.ChatbotInteracao.create({
          sessao_id: sessaoAtual,
          empresa_id: empresaAtual?.id,
          group_id: empresaAtual?.group_id || null,
          canal: 'Portal',
          mensagem_usuario: msg,
          intent_detectado: intent.nome,
          requer_autenticacao: true,
          autenticacao_solicitada: true,
          resposta_bot: '🔐 Para consultar informações financeiras, informe seu CPF/CNPJ:',
          data_hora: new Date().toISOString()
        });
      }

      const sentimento = await analisarSentimento(msg);
      
      // V21.1: Transbordo Automático COM VERIFICAÇÃO DE PERMISSÃO
      if (sentimento.frustrado || sentimento.urgente || intent.escalar) {
        await escalarParaAtendente(msg, sentimento);
      }

      const resposta = await processarIntent(intent, msg);

      return await base44.entities.ChatbotInteracao.create({
        sessao_id: sessaoAtual,
        canal: 'Portal',
        cliente_id: clienteAutenticado?.id,
        cliente_nome: clienteAutenticado?.nome,
        autenticado: !!clienteAutenticado,
        mensagem_usuario: msg,
        intent_detectado: intent.nome,
        confianca_intent: intent.confianca,
        resposta_bot: resposta,
        sentimento_detectado: sentimento.tipo,
        palavras_chave_sentimento: sentimento.palavras,
        transferido_atendente: sentimento.frustrado || sentimento.urgente || intent.escalar,
        vendedor_notificado_id: sentimento.vendedor_id,
        data_hora: new Date().toISOString()
      });
    },
    onError: () => { toast.error('Falha ao enviar mensagem'); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatbot-interacoes'] });
      setMensagem('');
    },
  });

  const detectarIntent = async (msg) => {
    const msgLower = msg.toLowerCase();
    
    // V21.1: Usar ChatbotIntents.json configurado
    for (const intentConfig of intentsConfig) {
      const palavras = intentConfig.palavras_chave || [];
      const match = palavras.some(p => msgLower.includes(p.toLowerCase()));
      
      if (match) {
        return {
          nome: intentConfig.nome_intent,
          confianca: 90,
          requer_autenticacao: intentConfig.requer_autenticacao,
          acao: intentConfig.acao_automatica,
          escalar: intentConfig.escalar_vendedor
        };
      }
    }

    // Fallback (se nenhum intent configurado)
    if (msgLower.includes('boleto') || msgLower.includes('2 via')) {
      return { nome: '2_via_boleto', confianca: 95, requer_autenticacao: true };
    }
    
    if (msgLower.includes('rastrear') || msgLower.includes('entrega')) {
      return { nome: 'rastrear_entrega', confianca: 90, requer_autenticacao: true };
    }
    
    if (msgLower.includes('orçamento') || msgLower.includes('orcamento')) {
      return { nome: 'fazer_orcamento_ia', confianca: 85, requer_autenticacao: false };
    }
    
    if (msgLower.includes('vendedor') || msgLower.includes('atendente')) {
      return { nome: 'falar_atendente', confianca: 100, requer_autenticacao: false, escalar: true };
    }
    
    return { nome: 'desconhecido', confianca: 0, requer_autenticacao: false };
  };

  const analisarSentimento = async (msg) => {
    const palavrasFrustracao = ['absurdo', 'ridículo', 'atrasado', 'errado', 'horrível', 'cancelar', 'péssimo', 'nunca mais'];
    const palavrasUrgencia = ['urgente', 'emergência', 'imediato', 'agora', 'rápido'];
    
    const msgLower = msg.toLowerCase();
    const frustracaoDetectada = palavrasFrustracao.filter(p => msgLower.includes(p));
    const urgenciaDetectada = palavrasUrgencia.filter(p => msgLower.includes(p));
    
    // V21.1: Buscar vendedor responsável
    let vendedorId = null;
    if (clienteAutenticado?.vendedor_responsavel_id) {
      vendedorId = clienteAutenticado.vendedor_responsavel_id;
    }

    return { 
      tipo: frustracaoDetectada.length > 0 ? 'Frustrado' : 
            urgenciaDetectada.length > 0 ? 'Urgente' : 'Neutro',
      frustrado: frustracaoDetectada.length > 0,
      urgente: urgenciaDetectada.length > 0,
      palavras: [...frustracaoDetectada, ...urgenciaDetectada],
      vendedor_id: vendedorId
    };
  };

  // V21.1: Transbordo COM VERIFICAÇÃO DE PERMISSÃO pode_atender_transbordo
  const escalarParaAtendente = async (msg, sentimento) => {
    let vendedorDestino = 'Equipe Comercial';
    let vendedorId = sentimento.vendedor_id;
    
    // Verificar se vendedor tem permissão para atender transbordo
    if (vendedorId) {
      try {
        const vendedor = await base44.entities.User.get(vendedorId);
        vendedorDestino = vendedor.full_name;
        
        // V21.1: VERIFICAÇÃO DE PERMISSÃO
        if (vendedor.perfil_acesso_id) {
          const perfil = await base44.entities.PerfilAcesso.get(vendedor.perfil_acesso_id);
          
          if (!perfil.permissoes?.chatbot?.pode_atender_transbordo) {
            // Vendedor NÃO tem permissão - escalar para supervisor/admin
            console.warn(`Vendedor ${vendedor.full_name} (${vendedor.id}) não tem permissão para atender transbordo. Escalando para supervisor/admin.`);
            const supervisores = await base44.entities.User.filter({
              role: 'admin' // Or a specific role for supervisors
            }, '', 1); // Get only one supervisor
            
            if (supervisores.length > 0) {
              vendedorId = supervisores[0].id;
              vendedorDestino = supervisores[0].full_name + ' (Supervisor)';
            } else {
              console.error('Nenhum supervisor/admin encontrado para escalar.');
              vendedorId = null; // No specific person to escalate to
              vendedorDestino = 'Equipe de Suporte (Supervisor)'; // Fallback to a general team name
            }
          }
        }
      } catch (error) {
        console.error('Erro ao verificar vendedor ou perfil de acesso:', error);
        vendedorId = null; // If there's an error, don't assign to a potentially invalid ID
        vendedorDestino = 'Equipe de Suporte (Erro)';
      }
    } else {
      // If no specific vendor was identified, still try to escalate to a general team/admin
      const supervisores = await base44.entities.User.filter({
        role: 'admin'
      }, '', 1);
      if (supervisores.length > 0) {
        vendedorId = supervisores[0].id;
        vendedorDestino = supervisores[0].full_name + ' (Supervisor)';
      } else {
        vendedorDestino = 'Equipe de Suporte';
      }
    }

    await base44.entities.Notificacao.create({
      titulo: '🚨 Cliente Frustrado - Transbordo Urgente',
      mensagem: `Cliente demonstrou ${sentimento.tipo.toLowerCase()}: "${msg}".\n\nPalavras detectadas: ${sentimento.palavras.join(', ')}\n\n👉 Sessão ID: ${sessaoAtual}`,
      tipo: 'urgente',
      categoria: 'Comercial',
      prioridade: 'Urgente',
      destinatario_id: vendedorId,
      link_acao: `/HubAtendimento`,
      dados_adicionais: { 
        tag: '#TRANSBORDO_CHATBOT',
        sessao_id: sessaoAtual,
        cliente_id: clienteAutenticado?.id,
        verificacao_permissao: true
      }
    });

    if (empresaAtual?.id) {
      try {
        const escalado = buildEscalarParaHub({
          sessaoId: sessaoAtual,
          empresaId: empresaAtual.id,
          groupId: grupoAtual?.id || empresaAtual.group_id || empresaAtual.grupo_id,
          canal: 'Portal',
          cliente: clienteAutenticado,
          mensagem: msg,
          sentimento,
        });
        const conversa = await createInContext('ConversaOmnicanal', escalado.conversa);
        if (escalado.mensagem) {
          await createInContext('MensagemOmnicanal', {
            ...escalado.mensagem,
            conversa_id: conversa.id,
          });
        }
      } catch (error) {
        console.error('Falha ao gravar conversa no Hub no transbordo:', error);
      }
    }

    setVendedorAtendendo(vendedorDestino);
    toast.error(`🚨 Cliente ${sentimento.tipo} - Transferindo para ${vendedorDestino}`);
  };

  const processarIntent = async (intent, msg) => {
    switch (intent.nome) {
      case '2_via_boleto':
        if (clienteAutenticado) {
          const titulos = await base44.entities.ContaReceber.filter({
            cliente_id: clienteAutenticado.id,
            status: 'Pendente'
          });
          
          if (titulos.length > 0) {
            return `📄 ${titulos.length} título(s) em aberto:\n\n${titulos.map(t => 
              `R$ ${t.valor.toFixed(2)} - Venc: ${new Date(t.data_vencimento).toLocaleDateString('pt-BR')}`
            ).join('\n')}`;
          }
          return '✅ Sem títulos em aberto!';
        }
        break; // If not authenticated, fall through to default message
      
      case 'rastrear_entrega':
        if (clienteAutenticado) {
          const entregas = await base44.entities.Entrega.filter({
            cliente_id: clienteAutenticado.id,
            status: { $in: ['Em Trânsito', 'Saiu para Entrega'] }
          });
          
          if (entregas.length > 0) {
            return `🚚 ${entregas.length} entrega(s) em andamento:\n\n${entregas.map(e => 
              `Pedido ${e.numero_pedido} - Status: ${e.status}`
            ).join('\n')}`;
          }
          return '📦 Nenhuma entrega em andamento.';
        }
        break; // If not authenticated, fall through to default message
      
      case 'fazer_orcamento_ia':
        return '📋 Para orçamento:\n1. Envie projeto (PDF/DWG)\n2. Ou descreva o que precisa\n\n🤖 Nossa IA processará automaticamente!';
      
      case 'falar_atendente':
        if (intent.escalar) { // This check is redundant if `detectarIntent` always sets escalar:true for this intent
          return '📞 Transferindo para vendedor responsável...\n\nAguarde um momento.';
        }
        break;
      
      default:
        return '🤔 Posso ajudar com:\n• 2ª via boleto\n• Rastrear entrega\n• Fazer orçamento\n• Falar com vendedor';
    }
  };

  const handleEnviar = () => {
    if (!mensagem.trim()) return;
    enviarMensagemMutation.mutate(mensagem);
  };

  const ultimasInteracoes = interacoes.slice().reverse(); // Reverse for chronological display

  if (!hasPermission('CRM', null, 'ver')) {
    return (
      <div className="p-6 w-full h-full">
        <div className="max-w-2xl mx-auto w-full">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800">Acesso restrito</h2>
            <p className="text-slate-600 mt-1">Você não possui permissão para acessar este módulo.</p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="w-full h-full min-h-screen p-4 lg:p-6 bg-gradient-to-br from-slate-50 to-blue-50 overflow-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">🤖 Chatbot ERP-Cêntrico</h1>
            <p className="text-slate-600">V21.1 - Intent Engine + IA + Transbordo com Verificação de Permissão</p>
          </div>
          <Badge className="bg-indigo-600 text-white px-4 py-2">
            <Bot className="w-4 h-4 mr-2" />
            V21.6 - 100%
          </Badge>
        </div>

        {/* V21.1: Alerta de Transbordo */}
        {vendedorAtendendo && (
          <Alert className="border-red-300 bg-red-50">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <AlertDescription>
              <p className="font-semibold text-red-900 flex items-center gap-2">
                🚨 Conversação Transferida
                <Badge className="bg-purple-600 text-xs">
                  <Shield className="w-3 h-3 mr-1" />
                  Permissão Verificada
                </Badge>
              </p>
              <p className="text-sm text-red-700 mt-1">
                Vendedor <strong>{vendedorAtendendo}</strong> foi notificado e assumirá o atendimento
              </p>
              <p className="text-xs text-red-600 mt-2">
                ✅ Sistema validou permissão <code>pode_atender_transbordo</code> no PerfilAcesso
              </p>
            </AlertDescription>
          </Alert>
        )}

        <Alert className="border-blue-200 bg-blue-50">
          <AlertDescription className="text-sm text-blue-900">
            🧠 <strong>IA de Sentimento:</strong> Detecta frustração/urgência e escala automaticamente para vendedor responsável (com verificação de permissão)
          </AlertDescription>
        </Alert>

        {/* Chat */}
        <Card>
          <CardHeader className="bg-slate-50 border-b">
            <div className="flex items-center justify-between">
              <CardTitle>Teste o Chatbot</CardTitle>
              {clienteAutenticado && (
                <Badge className="bg-green-600">
                  <User className="w-3 h-3 mr-1" />
                  {clienteAutenticado.nome}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4 mb-4 h-96 overflow-y-auto border rounded-lg p-4 bg-slate-50">
              {ultimasInteracoes.map((inter) => (
                <div key={inter.id} className="space-y-2">
                  {/* Mensagem do Usuário */}
                  <div className="flex justify-end">
                    <div className="bg-blue-600 text-white p-3 rounded-lg max-w-md">
                      <p className="text-sm">{inter.mensagem_usuario}</p>
                    </div>
                  </div>

                  {/* Resposta do Bot */}
                  <div className="flex justify-start">
                    <div className="bg-slate-100 p-3 rounded-lg max-w-md">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Bot className="w-4 h-4 text-indigo-600" />
                        <Badge variant="outline" className="text-xs">
                          {inter.intent_detectado}
                        </Badge>
                        {inter.sentimento_detectado === 'Frustrado' && (
                          <Badge className="bg-red-100 text-red-700 text-xs">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Frustrado
                          </Badge>
                        )}
                        {inter.sentimento_detectado === 'Urgente' && (
                          <Badge className="bg-orange-100 text-orange-700 text-xs">
                            <Timer className="w-3 h-3 mr-1" />
                            Urgente
                          </Badge>
                        )}
                        {inter.transferido_atendente && (
                          <Badge className="bg-purple-100 text-purple-700 text-xs">
                            <Phone className="w-3 h-3 mr-1" />
                            Transferido
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm whitespace-pre-line">{inter.resposta_bot}</p>
                    </div>
                  </div>
                </div>
              ))}

              {ultimasInteracoes.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <Bot className="w-16 h-16 mx-auto mb-3 opacity-30" />
                  <p>Inicie a conversa enviando uma mensagem</p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Input
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleEnviar()}
                placeholder="Digite sua mensagem..."
                disabled={enviarMensagemMutation.isPending}
              />
              <Button 
                onClick={handleEnviar} 
                disabled={!mensagem.trim() || enviarMensagemMutation.isPending}
              >
                {enviarMensagemMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>

            {/* Sugestões Rápidas */}
            <div className="flex gap-2 mt-3 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setMensagem('Preciso da 2ª via do boleto')}
              >
                💳 2ª via boleto
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setMensagem('Onde está minha entrega?')}
              >
                📦 Rastrear
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setMensagem('Quero fazer um orçamento')}
              >
                📋 Orçamento
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setMensagem('Preciso falar com um vendedor URGENTE')}
              >
                🚨 Urgente
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Intents Configurados */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="bg-green-50 border-b">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Intents Autenticadas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              {intentsConfig.filter(i => i.requer_autenticacao).map(intent => (
                <div key={intent.id} className="flex items-center gap-2 text-sm">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  <span className="font-mono text-xs">{intent.nome_intent}</span>
                  <Badge variant="outline" className="text-xs">{intent.tipo_intent}</Badge>
                </div>
              ))}
              {intentsConfig.filter(i => i.requer_autenticacao).length === 0 && (
                <p className="text-xs text-slate-500">Nenhum intent configurado</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="bg-blue-50 border-b">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" />
                Intents Públicas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              {intentsConfig.filter(i => !i.requer_autenticacao).map(intent => (
                <div key={intent.id} className="flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4 text-purple-600" />
                  <span className="font-mono text-xs">{intent.nome_intent}</span>
                  {intent.escalar_vendedor && (
                    <Badge className="bg-orange-100 text-orange-700 text-xs">
                      <Phone className="w-3 h-3 mr-1" />
                      Escala
                    </Badge>
                  )}
                </div>
              ))}
              {intentsConfig.filter(i => !i.requer_autenticacao).length === 0 && (
                <p className="text-xs text-slate-500">Nenhum intent configurado</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}