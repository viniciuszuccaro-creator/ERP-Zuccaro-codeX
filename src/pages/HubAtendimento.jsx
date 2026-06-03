import React, { useState, useEffect, useRef, Suspense } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import {
  MessageCircle,
  User,
  Bot,
  Send,
  Phone,
  Clock,
  CheckCircle,
  AlertCircle,
  Filter,
  Search,
  Paperclip,
  MoreVertical,
  Archive,
  UserPlus,
  TrendingUp,
  Activity,
  BarChart3,
  Settings,
  FileText,
  Timer,
  Tag,
  ArrowRightLeft,
  RefreshCw,
  Download,
  Brain,
  Smile,
  Star,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Maximize2,
  Minimize2,
  Users,
  Building,
  Mic,
  Image as ImageIcon
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import ErrorBoundary from "@/components/lib/ErrorBoundary";

const ChatbotDashboard = React.lazy(() => import("@/components/chatbot/ChatbotDashboard"));
const ConfiguracaoCanais = React.lazy(() => import("@/components/chatbot/ConfiguracaoCanais"));
const GerenciadorTemplates = React.lazy(() => import("@/components/chatbot/GerenciadorTemplates"));
const AnalyticsAtendimento = React.lazy(() => import("@/components/chatbot/AnalyticsAtendimento"));
const HistoricoClienteChat = React.lazy(() => import("@/components/chatbot/HistoricoClienteChat"));
const MonitorSLA = React.lazy(() => import("@/components/chatbot/MonitorSLA"));
const ChatbotFilaEspera = React.lazy(() => import("@/components/chatbot/ChatbotFilaEspera"));
const RespostasRapidas = React.lazy(() => import("@/components/chatbot/RespostasRapidas"));
const TagsCategorizacao = React.lazy(() => import("@/components/chatbot/TagsCategorizacao"));
const SugestoesIA = React.lazy(() => import("@/components/chatbot/SugestoesIA"));
const ExportarConversas = React.lazy(() => import("@/components/chatbot/ExportarConversas"));
const IAConversacional = React.lazy(() => import("@/components/chatbot/IAConversacional"));
const CriarPedidoChat = React.lazy(() => import("@/components/chatbot/CriarPedidoChat"));
const GerarBoletoChat = React.lazy(() => import("@/components/chatbot/GerarBoletoChat"));
const ConsultarEntregaChat = React.lazy(() => import("@/components/chatbot/ConsultarEntregaChat"));
const DashboardAtendente = React.lazy(() => import("@/components/chatbot/DashboardAtendente"));
const TransferirConversa = React.lazy(() => import("@/components/chatbot/TransferirConversa"));
const RelatoriosAtendimento = React.lazy(() => import("@/components/chatbot/RelatoriosAtendimento"));
const ChatbotMulticanal = React.lazy(() => import("@/components/chatbot/ChatbotMulticanal"));
const BaseConhecimento = React.lazy(() => import("@/components/chatbot/BaseConhecimento"));

const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
const sanitizeAttachmentText = (value, max = 180) => String(value || "")
  .replace(/[<>]/g, "")
  .replace(/javascript:/gi, "")
  .trim()
  .slice(0, max);

/**
 * V21.5 - HUB DE ATENDIMENTO OMNICANAL
 * 
 * Central unificada de atendimento para todos os canais:
 * ✅ Visualização em tempo real de todas as conversas
 * ✅ Categorização por status (Em Progresso, Aguardando, Não Atribuída)
 * ✅ Interface de chat para atendentes
 * ✅ Histórico completo de cada conversa
 * ✅ Métricas e analytics
 * ✅ Atribuição de conversas
 * ✅ Multi-canal (WhatsApp, Instagram, Telegram, Email, WebChat, Portal)
 * ✅ Integração com ERP (criar pedidos, consultar dados, etc)
 * ✅ Controle de acesso por perfil
 */
export default function HubAtendimento() {
  const [abaAtiva, setAbaAtiva] = useState("atendimento");
  const [filtroStatus, setFiltroStatus] = useState("Em Progresso");
  const [filtroCanal, setFiltroCanal] = useState("Todos");
  const [filtroPrioridade, setFiltroPrioridade] = useState("Todas");
  const [buscaTexto, setBuscaTexto] = useState("");
  const [conversaSelecionada, setConversaSelecionada] = useState(null);
  const [mensagemAtendente, setMensagemAtendente] = useState("");
  const [exibirPainelLateral, setExibirPainelLateral] = useState(true);
  const [painelLateralConteudo, setPainelLateralConteudo] = useState('info');
  const [layoutExpandido, setLayoutExpandido] = useState(false);
  const [exibirTransferir, setExibirTransferir] = useState(false);
  const [arquivoAnexo, setArquivoAnexo] = useState(null);
  const [notificacoesAudio, setNotificacoesAudio] = useState(true);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const queryClient = useQueryClient();
  const { hasPermission, user, isAdmin } = usePermissions();
  const { empresaAtual, grupoAtual, filterInContext, createInContext, updateInContext } = useContextoVisual();
  const contextKey = empresaAtual?.id || grupoAtual?.id || 'sem-contexto';
  const contextoValido = contextKey !== 'sem-contexto';

  // Auto-scroll para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversaSelecionada]);

  // Notificação sonora para novas mensagens
  useEffect(() => {
    if (notificacoesAudio && typeof window !== 'undefined') {
      // Implementar som de notificação
    }
  }, []);

  // Verificar permissão
  const podeAtenderTransbordo = isAdmin() || hasPermission('chatbot', null, 'ver') || hasPermission('CRM', null, 'ver') || hasPermission('CRM', 'Atendimento', 'visualizar');
  const podeVerTodasConversas = isAdmin() || hasPermission('chatbot', 'ver_todas_conversas') || hasPermission('CRM', 'Atendimento', 'visualizar_todas');
  const podeEditarAtendimento = isAdmin() || hasPermission('chatbot', null, 'editar') || hasPermission('CRM', 'Atendimento', 'editar');
  const podeUsarAnexos = podeEditarAtendimento || hasPermission('CRM', 'Atendimento', 'anexar');

  // Buscar conversas
  const { data: conversas = [], isLoading } = useQuery({
    queryKey: ['conversas-omnicanal', filtroStatus, filtroCanal, contextKey, user?.id, podeVerTodasConversas],
    queryFn: async () => {
      let filtros = {};
      
      if (filtroStatus !== "Todas") {
        filtros.status = filtroStatus;
      }
      
      if (filtroCanal !== "Todos") {
        filtros.canal = filtroCanal;
      }

      // Apenas conversas atribuídas ao usuário ou não atribuídas
      const conversasContextuais = await filterInContext(
        'ConversaOmnicanal',
        filtros,
        '-data_ultima_mensagem',
        50
      );

      if (podeVerTodasConversas) return conversasContextuais;

      return conversasContextuais.filter((conversa) =>
        conversa.atendente_id === user?.id ||
        !conversa.atendente_id
      );
    },
    enabled: contextoValido && podeAtenderTransbordo,
    refetchInterval: 5000 // Atualizar a cada 5 segundos
  });

  // Buscar mensagens da conversa selecionada
  const { data: mensagens = [] } = useQuery({
    queryKey: ['mensagens-conversa', conversaSelecionada?.id, contextKey],
    queryFn: async () => {
      if (!conversaSelecionada) return [];
      return await filterInContext(
        'MensagemOmnicanal',
        { conversa_id: conversaSelecionada.id },
        'data_envio',
        200
      );
    },
    enabled: !!conversaSelecionada && contextoValido && podeAtenderTransbordo,
    refetchInterval: 3000
  });

  // Buscar métricas
  const { data: metricas } = useQuery({
    queryKey: ['metricas-atendimento', contextKey],
    queryFn: async () => {
      const todasConversas = await filterInContext('ConversaOmnicanal', {}, '-data_ultima_mensagem', 500);

      return {
        total: todasConversas.length,
        emProgresso: todasConversas.filter(c => c.status === 'Em Progresso').length,
        aguardando: todasConversas.filter(c => c.status === 'Aguardando').length,
        naoAtribuidas: todasConversas.filter(c => c.status === 'Não Atribuída').length,
        resolvidasHoje: todasConversas.filter(c => {
          if (!c.data_finalizacao) return false;
          const hoje = new Date().toDateString();
          return new Date(c.data_finalizacao).toDateString() === hoje;
        }).length,
        tempoMedioResposta: 2.5, // TODO: calcular real
        taxaResolucaoBot: 78 // TODO: calcular real
      };
    },
    enabled: contextoValido && podeAtenderTransbordo,
    refetchInterval: 10000
  });

  // KPIs SLA 24h (Chatbot)
  const { data: botSla = { chats: 0, sla_ok: 0, sla_total: 0 } } = useQuery({
    queryKey: ['bot-sla-24h', contextKey],
    queryFn: async () => {
      const since = Date.now() - 24 * 60 * 60 * 1000;
      const items = await filterInContext('ChatbotInteracao', {}, '-created_date', 500);
      const within = (items || []).filter(i => new Date(i?.created_date || Date.now()).getTime() >= since);
      const acc = within.reduce((a,i)=>{ const ms=Number(i?.tempo_primeira_resposta_ms||0); if(!isNaN(ms)){a.total++; if(ms<=60000) a.ok++;} return a; }, {ok:0,total:0});
      return { chats: within.length, sla_ok: acc.ok, sla_total: acc.total };
    },
    enabled: contextoValido && podeAtenderTransbordo,
    staleTime: 60000,
  });

  // Enviar mensagem do atendente
  const enviarMensagemMutation = useMutation({
    mutationFn: async ({ mensagem, arquivo }) => {
      if (!conversaSelecionada) return;
      if (!contextoValido || !podeEditarAtendimento) {
        throw new Error('Selecione grupo/empresa e confirme permissao de atendimento antes de enviar mensagem.');
      }

      let arquivoUrl = null;
      let arquivoTipo = null;
      let arquivoTamanho = null;
      let arquivoNome = null;
      if (arquivo) {
        if (!podeUsarAnexos) {
          throw new Error('Seu perfil nao tem permissao para anexar arquivos no atendimento.');
        }
        if (arquivo.size > MAX_ATTACHMENT_SIZE_BYTES) {
          throw new Error('Arquivo muito grande. O limite para anexos no atendimento e 10MB.');
        }
        const result = await base44.integrations.Core.UploadFile({ file: arquivo });
        arquivoUrl = result.file_url;
        arquivoTipo = sanitizeAttachmentText(arquivo.type || 'application/octet-stream', 120);
        arquivoTamanho = Math.round(arquivo.size / 1024);
        arquivoNome = sanitizeAttachmentText(arquivo.name, 180);
      }

      // Criar mensagem
      const novaMensagem = await createInContext('MensagemOmnicanal', {
        conversa_id: conversaSelecionada.id,
        empresa_id: conversaSelecionada.empresa_id || empresaAtual?.id,
        group_id: conversaSelecionada.group_id || grupoAtual?.id || empresaAtual?.group_id || null,
        grupo_id: conversaSelecionada.grupo_id || grupoAtual?.id || empresaAtual?.group_id || null,
        sessao_id: conversaSelecionada.sessao_id,
        canal: conversaSelecionada.canal,
        tipo_remetente: 'Atendente',
        remetente_id: user.id,
        remetente_nome: user.full_name,
        mensagem,
        tipo_conteudo: arquivo ? 'documento' : 'texto',
        midia_url: arquivoUrl,
        midia_tipo: arquivoTipo,
        midia_tamanho_kb: arquivoTamanho,
        nome_arquivo: arquivoNome,
        data_envio: new Date().toISOString(),
        resposta_automatica: false
      });

      if (arquivo) {
        await createInContext('AuditLog', {
          empresa_id: conversaSelecionada.empresa_id || empresaAtual?.id,
          group_id: conversaSelecionada.group_id || grupoAtual?.id || empresaAtual?.group_id || null,
          grupo_id: conversaSelecionada.grupo_id || grupoAtual?.id || empresaAtual?.group_id || null,
          usuario: user?.full_name || user?.email || 'Atendente',
          usuario_id: user?.id || null,
          acao: 'Upload Anexo',
          modulo: 'CRM',
          entidade: 'MensagemOmnicanal',
          registro_id: novaMensagem.id,
          descricao: 'Anexo enviado pelo atendente no Hub de Atendimento',
          dados_anteriores: null,
          dados_novos: {
            conversa_id: conversaSelecionada.id,
            arquivo_nome: arquivoNome,
            arquivo_tipo: arquivoTipo,
            arquivo_tamanho_kb: arquivoTamanho
          },
          data_hora: new Date().toISOString()
        }).catch(() => null);
      }

      // Atualizar conversa
      await updateInContext('ConversaOmnicanal', conversaSelecionada.id, {
        data_ultima_mensagem: new Date().toISOString(),
        total_mensagens: (conversaSelecionada.total_mensagens || 0) + 1,
        mensagens_humano: (conversaSelecionada.mensagens_humano || 0) + 1,
        tipo_atendimento: 'Humano'
      });

      return novaMensagem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mensagens-conversa'] });
      queryClient.invalidateQueries({ queryKey: ['conversas-omnicanal'] });
      setMensagemAtendente("");
      setArquivoAnexo(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success("Mensagem enviada!");
    },
    onError: (error) => {
      toast.error(error?.message || "Nao foi possivel enviar a mensagem.");
    }
  });

  // Assumir conversa
  const assumirConversaMutation = useMutation({
    mutationFn: async (conversaId) => {
      if (!contextoValido || !podeEditarAtendimento) {
        throw new Error('Selecione grupo/empresa e confirme permissao antes de assumir conversa.');
      }
      await updateInContext('ConversaOmnicanal', conversaId, {
        atendente_id: user.id,
        atendente_nome: user.full_name,
        status: 'Em Progresso',
        tipo_atendimento: 'Humano',
        transferido_em: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversas-omnicanal'] });
      toast.success("Conversa assumida!");
    },
    onError: (error) => {
      toast.error(error?.message || "Nao foi possivel assumir a conversa.");
    }
  });

  // Resolver conversa
  const resolverConversaMutation = useMutation({
    mutationFn: async (conversaId) => {
      if (!contextoValido || !podeEditarAtendimento) {
        throw new Error('Selecione grupo/empresa e confirme permissao antes de resolver conversa.');
      }
      await updateInContext('ConversaOmnicanal', conversaId, {
        status: 'Resolvida',
        resolvido: true,
        data_finalizacao: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversas-omnicanal'] });
      setConversaSelecionada(null);
      toast.success("Conversa resolvida!");
    },
    onError: (error) => {
      toast.error(error?.message || "Nao foi possivel resolver a conversa.");
    }
  });

  const atendimentoBloqueado = !contextoValido || !podeEditarAtendimento;

  if (!podeAtenderTransbordo) {
    return (
      <div className="p-6">
        <Alert className="border-red-300 bg-red-50">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <AlertDescription className="text-red-900">
            Você não tem permissão para acessar o Hub de Atendimento.
            Entre em contato com o administrador.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!contextoValido) {
    return (
      <div className="w-full h-full min-h-screen p-6">
        <Alert className="border-amber-300 bg-amber-50">
          <AlertCircle className="w-5 h-5 text-amber-600" />
          <AlertDescription className="text-amber-900">
            Selecione um grupo ou empresa antes de acessar o Hub de Atendimento.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const conversasFiltradas = conversas.filter(c => {
    // Filtro por texto
    if (buscaTexto) {
      const texto = buscaTexto.toLowerCase();
      const matchTexto = (
        c.cliente_nome?.toLowerCase().includes(texto) ||
        c.cliente_email?.toLowerCase().includes(texto) ||
        c.cliente_telefone?.includes(texto) ||
        c.sessao_id?.toLowerCase().includes(texto) ||
        c.intent_principal?.toLowerCase().includes(texto) ||
        c.assuntos_detectados?.some(a => a.toLowerCase().includes(texto)) ||
        c.tags?.some(t => t.toLowerCase().includes(texto))
      );
      if (!matchTexto) return false;
    }
    
    // Filtro por prioridade
    if (filtroPrioridade !== "Todas" && c.prioridade !== filtroPrioridade) {
      return false;
    }
    
    return true;
  });

  return (
    <div className="w-full h-full min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 lg:p-6 overflow-auto">
      <div className={`${layoutExpandido ? 'max-w-full' : 'max-w-7xl'} mx-auto space-y-4`}>
        <ErrorBoundary>
        {/* Header Responsivo */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 flex items-center gap-3">
              <MessageCircle className="w-7 h-7 lg:w-8 lg:h-8 text-blue-600" />
              Hub de Atendimento Omnicanal
            </h1>
            <p className="text-slate-600 text-sm lg:text-base mt-1">
              Central unificada • Multi-empresa • IA Avançada • V21.6
            </p>
          </div>
          
          {/* Navegação entre abas - Responsiva */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={abaAtiva === "atendimento" ? "default" : "outline"}
              onClick={() => setAbaAtiva("atendimento")}
              size="sm"
              className={abaAtiva === "atendimento" ? "bg-blue-600" : ""}
            >
              <MessageCircle className="w-4 h-4 lg:mr-2" />
              <span className="hidden lg:inline">Atendimento</span>
            </Button>
            <Button
              variant={abaAtiva === "meupainel" ? "default" : "outline"}
              onClick={() => setAbaAtiva("meupainel")}
              size="sm"
              className={abaAtiva === "meupainel" ? "bg-purple-600" : ""}
            >
              <User className="w-4 h-4 lg:mr-2" />
              <span className="hidden lg:inline">Meu Painel</span>
            </Button>
            <Button
              variant={abaAtiva === "analytics" ? "default" : "outline"}
              onClick={() => setAbaAtiva("analytics")}
              size="sm"
              className={abaAtiva === "analytics" ? "bg-blue-600" : ""}
            >
              <BarChart3 className="w-4 h-4 lg:mr-2" />
              <span className="hidden lg:inline">Analytics</span>
            </Button>
            <Button
              variant={abaAtiva === "templates" ? "default" : "outline"}
              onClick={() => setAbaAtiva("templates")}
              size="sm"
              className={abaAtiva === "templates" ? "bg-blue-600" : ""}
            >
              <FileText className="w-4 h-4 lg:mr-2" />
              <span className="hidden lg:inline">Templates</span>
            </Button>
            <Button
              variant={abaAtiva === "config" ? "default" : "outline"}
              onClick={() => setAbaAtiva("config")}
              size="sm"
              className={abaAtiva === "config" ? "bg-blue-600" : ""}
            >
              <Settings className="w-4 h-4 lg:mr-2" />
              <span className="hidden lg:inline">Canais</span>
            </Button>
            <Button
              variant={abaAtiva === "sla" ? "default" : "outline"}
              onClick={() => setAbaAtiva("sla")}
              size="sm"
              className={abaAtiva === "sla" ? "bg-blue-600" : ""}
            >
              <Timer className="w-4 h-4 lg:mr-2" />
              <span className="hidden lg:inline">SLA</span>
            </Button>
            <Button
              variant={abaAtiva === "fila" ? "default" : "outline"}
              onClick={() => setAbaAtiva("fila")}
              size="sm"
              className={abaAtiva === "fila" ? "bg-blue-600" : ""}
            >
              <Users className="w-4 h-4 lg:mr-2" />
              <span className="hidden lg:inline">Fila</span>
            </Button>
            <Button
              variant={abaAtiva === "relatorios" ? "default" : "outline"}
              onClick={() => setAbaAtiva("relatorios")}
              size="sm"
              className={abaAtiva === "relatorios" ? "bg-blue-600" : ""}
            >
              <BarChart3 className="w-4 h-4 lg:mr-2" />
              <span className="hidden lg:inline">Relatórios</span>
            </Button>
            <Button
              variant={abaAtiva === "multicanal" ? "default" : "outline"}
              onClick={() => setAbaAtiva("multicanal")}
              size="sm"
              className={abaAtiva === "multicanal" ? "bg-blue-600" : ""}
            >
              <MessageCircle className="w-4 h-4 lg:mr-2" />
              <span className="hidden lg:inline">Multi</span>
            </Button>
            <Button
              variant={abaAtiva === "base" ? "default" : "outline"}
              onClick={() => setAbaAtiva("base")}
              size="sm"
              className={abaAtiva === "base" ? "bg-blue-600" : ""}
            >
              <Brain className="w-4 h-4 lg:mr-2" />
              <span className="hidden lg:inline">Base IA</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLayoutExpandido(!layoutExpandido)}
              title={layoutExpandido ? "Reduzir" : "Expandir"}
            >
              {layoutExpandido ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Renderizar aba ativa */}
        {abaAtiva === "meupainel" && (
          <div className="grid lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1">
              <Suspense fallback={<div className="h-40 rounded-md bg-slate-100 animate-pulse" />}><DashboardAtendente /></Suspense>
            </div>
            <div className="lg:col-span-3">
              <Suspense fallback={<div className="h-40 rounded-md bg-slate-100 animate-pulse" />}><ChatbotDashboard /></Suspense>
            </div>
          </div>
        )}
        {abaAtiva === "analytics" && (
          <div className="grid lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              <Suspense fallback={<div className="h-40 rounded-md bg-slate-100 animate-pulse" />}><ChatbotDashboard /></Suspense>
            </div>
            <div className="lg:col-span-1 space-y-4">
              <Suspense fallback={<div className="h-32 rounded-md bg-slate-100 animate-pulse" />}><ExportarConversas /></Suspense>
              <Suspense fallback={<div className="h-32 rounded-md bg-slate-100 animate-pulse" />}><AnalyticsAtendimento /></Suspense>
            </div>
          </div>
        )}
        {abaAtiva === "templates" && (<Suspense fallback={<div className="h-40 rounded-md bg-slate-100 animate-pulse" />}><GerenciadorTemplates /></Suspense>)}
        {abaAtiva === "config" && (<Suspense fallback={<div className="h-40 rounded-md bg-slate-100 animate-pulse" />}><ConfiguracaoCanais /></Suspense>)}
        {abaAtiva === "sla" && (<Suspense fallback={<div className="h-40 rounded-md bg-slate-100 animate-pulse" />}><MonitorSLA /></Suspense>)}
        {abaAtiva === "fila" && (<Suspense fallback={<div className="h-40 rounded-md bg-slate-100 animate-pulse" />}><ChatbotFilaEspera /></Suspense>)}
        {abaAtiva === "relatorios" && (<Suspense fallback={<div className="h-40 rounded-md bg-slate-100 animate-pulse" />}><RelatoriosAtendimento /></Suspense>)}
        {abaAtiva === "multicanal" && (<Suspense fallback={<div className="h-40 rounded-md bg-slate-100 animate-pulse" />}><ChatbotMulticanal /></Suspense>)}
        {abaAtiva === "base" && (<Suspense fallback={<div className="h-40 rounded-md bg-slate-100 animate-pulse" />}><BaseConhecimento /></Suspense>)}
        
        {/* Aba de Atendimento */}
        {abaAtiva === "atendimento" && (
          <>
            {/* Métricas */}
            {metricas && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-slate-600 text-sm mb-1">
                  <Activity className="w-4 h-4" />
                  Total
                </div>
                <p className="text-2xl font-bold">{metricas.total}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-blue-600 text-sm mb-1">
                  <MessageCircle className="w-4 h-4" />
                  Em Progresso
                </div>
                <p className="text-2xl font-bold text-blue-600">{metricas.emProgresso}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-orange-600 text-sm mb-1">
                  <Clock className="w-4 h-4" />
                  Aguardando
                </div>
                <p className="text-2xl font-bold text-orange-600">{metricas.aguardando}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-red-600 text-sm mb-1">
                  <AlertCircle className="w-4 h-4" />
                  Não Atribuídas
                </div>
                <p className="text-2xl font-bold text-red-600">{metricas.naoAtribuidas}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-green-600 text-sm mb-1">
                  <CheckCircle className="w-4 h-4" />
                  Resolvidas Hoje
                </div>
                <p className="text-2xl font-bold text-green-600">{metricas.resolvidasHoje}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-purple-600 text-sm mb-1">
                  <TrendingUp className="w-4 h-4" />
                  Tempo Médio
                </div>
                <p className="text-2xl font-bold text-purple-600">{metricas.tempoMedioResposta}min</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-indigo-600 text-sm mb-1">
                  <Bot className="w-4 h-4" />
                  Resolução Bot
                </div>
                <p className="text-2xl font-bold text-indigo-600">{metricas.taxaResolucaoBot}%</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Card className="mt-4">
          <CardContent className="p-3 lg:p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="text-sm text-slate-600">Conversas 24h:</div>
              <Badge variant="outline" className="text-xs">{botSla.chats}</Badge>
              <div className="text-sm text-slate-600 ml-4">SLA 1ª resp ≤ 60s:</div>
              <Badge className={(botSla.sla_total ? Math.round(100*(botSla.sla_ok/(botSla.sla_total||1))) : 0) >= 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                {botSla.sla_total ? Math.round(100*(botSla.sla_ok/(botSla.sla_total||1))) : 0}%
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Filtros Avançados */}
        <Card>
          <CardContent className="p-3 lg:p-4">
            <div className="flex flex-wrap items-center gap-2 lg:gap-3">
              <div className="flex-1 min-w-[180px] relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Buscar cliente, assunto..."
                  value={buscaTexto}
                  onChange={(e) => setBuscaTexto(e.target.value)}
                  className="pl-9 w-full"
                />
              </div>

              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm bg-white"
              >
                <option value="Todas">Todos Status</option>
                <option value="Em Progresso">Em Progresso</option>
                <option value="Aguardando">Aguardando</option>
                <option value="Não Atribuída">Não Atribuída</option>
                <option value="Resolvida">Resolvidas</option>
              </select>

              <select
                value={filtroCanal}
                onChange={(e) => setFiltroCanal(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm bg-white"
              >
                <option value="Todos">Todos Canais</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Instagram">Instagram</option>
                <option value="Facebook">Facebook</option>
                <option value="Telegram">Telegram</option>
                <option value="Email">Email</option>
                <option value="WebChat">WebChat</option>
                <option value="Portal">Portal</option>
                <option value="SMS">SMS</option>
              </select>

              <select
                value={filtroPrioridade}
                onChange={(e) => setFiltroPrioridade(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm bg-white"
              >
                <option value="Todas">Todas Prioridades</option>
                <option value="Urgente">🔴 Urgente</option>
                <option value="Alta">🟠 Alta</option>
                <option value="Normal">🟢 Normal</option>
                <option value="Baixa">⚪ Baixa</option>
              </select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['conversas-omnicanal'] })}
                title="Atualizar"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Layout Principal - Responsivo e Redimensionável */}
        <div className={`grid gap-4 lg:gap-6 ${
          exibirPainelLateral && conversaSelecionada 
            ? 'grid-cols-1 lg:grid-cols-4' 
            : 'grid-cols-1 lg:grid-cols-3'
        }`}>
          {/* Lista de Conversas */}
          <Card className="lg:col-span-1 flex flex-col">
            <CardHeader className="border-b p-3 lg:p-4">
              <CardTitle className="text-base lg:text-lg flex items-center justify-between">
                <span>Conversas ({conversasFiltradas.length})</span>
                <Badge variant="outline" className="text-xs">
                  {metricas?.naoAtribuidas || 0} novas
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1">
              <div className="h-[500px] lg:h-[600px] overflow-y-auto">
                {isLoading ? (
                  <div className="p-4 text-center text-slate-500">Carregando...</div>
                ) : conversasFiltradas.length === 0 ? (
                  <div className="p-4 text-center text-slate-500">Nenhuma conversa encontrada</div>
                ) : (
                  conversasFiltradas.map((conversa) => (
                    <motion.button
                      key={conversa.id}
                      onClick={() => setConversaSelecionada(conversa)}
                      whileHover={{ scale: 1.02 }}
                      className={`w-full text-left p-4 border-b hover:bg-slate-50 transition-colors ${
                        conversaSelecionada?.id === conversa.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-sm truncate">
                              {conversa.cliente_nome || 'Cliente Anônimo'}
                            </p>
                            <Badge className={`text-xs ${
                              conversa.canal === 'WhatsApp' ? 'bg-green-600' :
                              conversa.canal === 'Instagram' ? 'bg-pink-600' :
                              conversa.canal === 'Telegram' ? 'bg-blue-600' :
                              'bg-slate-600'
                            }`}>
                              {conversa.canal}
                            </Badge>
                          </div>
                          
                          <p className="text-xs text-slate-600 truncate mb-2">
                            {conversa.intent_principal || 'Sem assunto'}
                          </p>

                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {conversa.status}
                            </Badge>
                            {conversa.tipo_atendimento && (
                              <Badge variant="outline" className="text-xs">
                                {conversa.tipo_atendimento === 'Bot' ? <Bot className="w-3 h-3 mr-1" /> : <User className="w-3 h-3 mr-1" />}
                                {conversa.tipo_atendimento}
                              </Badge>
                            )}
                            {conversa.prioridade === 'Urgente' && (
                              <Badge className="bg-red-600 text-xs">Urgente</Badge>
                            )}
                          </div>
                        </div>

                        <div className="text-xs text-slate-500 flex-shrink-0">
                          {new Date(conversa.data_ultima_mensagem).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                    </motion.button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Área de Chat - Responsiva */}
          <Card className={`${exibirPainelLateral && conversaSelecionada ? 'lg:col-span-2' : 'lg:col-span-2'} flex flex-col h-[500px] lg:h-[700px]`}>
            {conversaSelecionada ? (
              <>
                {/* Header da Conversa */}
                <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-purple-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        {conversaSelecionada.cliente_nome || 'Cliente Anônimo'}
                        <Badge className="ml-2 bg-blue-600">
                          {conversaSelecionada.canal}
                        </Badge>
                        {conversaSelecionada.prioridade === 'Urgente' && (
                          <Badge className="bg-red-600">Urgente</Badge>
                        )}
                      </CardTitle>
                      <div className="flex items-center gap-3 mt-2">
                        <p className="text-xs text-slate-600">
                          Sessão: {conversaSelecionada.sessao_id.substring(0, 16)}...
                        </p>
                        {conversaSelecionada.intent_principal && (
                          <Badge variant="outline" className="text-xs">
                            {conversaSelecionada.intent_principal}
                          </Badge>
                        )}
                      </div>
                      
                      {/* Tags da conversa */}
                      {conversaSelecionada.tags && conversaSelecionada.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {conversaSelecionada.tags.slice(0, 3).map((tag, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              <Tag className="w-3 h-3 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 lg:gap-2">
                      {conversaSelecionada.atendente_id !== user.id && (
                        <Button
                          size="sm"
                          onClick={() => assumirConversaMutation.mutate(conversaSelecionada.id)}
                          disabled={assumirConversaMutation.isPending || atendimentoBloqueado}
                          className="bg-green-600 hover:bg-green-700"
                          data-action="HubAtendimento.assumirConversa"
                          data-permission="CRM.Atendimento.editar"
                          data-context-required="group-or-company"
                          data-sensitive="true"
                        >
                          <UserPlus className="w-4 h-4 lg:mr-2" />
                          <span className="hidden lg:inline">Assumir</span>
                        </Button>
                      )}
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setExibirTransferir(true)}
                        disabled={atendimentoBloqueado}
                        title="Transferir"
                        data-action="HubAtendimento.transferirConversa"
                        data-permission="CRM.Atendimento.editar"
                        data-context-required="group-or-company"
                        data-sensitive="true"
                      >
                        <ArrowRightLeft className="w-4 h-4" />
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resolverConversaMutation.mutate(conversaSelecionada.id)}
                        disabled={resolverConversaMutation.isPending || atendimentoBloqueado}
                        className="text-green-600 hover:text-green-700"
                        data-action="HubAtendimento.resolverConversa"
                        data-permission="CRM.Atendimento.editar"
                        data-context-required="group-or-company"
                        data-sensitive="true"
                      >
                        <CheckCircle className="w-4 h-4 lg:mr-2" />
                        <span className="hidden lg:inline">Resolver</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setExibirPainelLateral(!exibirPainelLateral)}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {/* Mensagens */}
                <CardContent className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                  {mensagens.map((msg) => {
                    const isCliente = msg.tipo_remetente === 'Cliente';
                    
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isCliente ? 'justify-start' : 'justify-end'}`}
                      >
                        <div className={`max-w-[70%] rounded-lg p-3 ${
                          isCliente
                            ? 'bg-white border'
                            : msg.tipo_remetente === 'Bot'
                            ? 'bg-purple-100 border border-purple-200'
                            : 'bg-blue-600 text-white'
                        }`}>
                          <div className="flex items-center gap-2 mb-1">
                            {msg.tipo_remetente === 'Bot' ? (
                              <Bot className="w-4 h-4 text-purple-600" />
                            ) : isCliente ? (
                              <User className="w-4 h-4 text-slate-600" />
                            ) : (
                              <User className="w-4 h-4" />
                            )}
                            <span className="text-xs font-semibold">
                              {msg.remetente_nome}
                            </span>
                          </div>
                          
                          <p className="text-sm whitespace-pre-wrap">{msg.mensagem}</p>
                          
                          {msg.midia_url && (
                            <a
                              href={msg.midia_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 flex items-center gap-2 text-xs underline"
                            >
                              <Paperclip className="w-3 h-3" />
                              Arquivo
                            </a>
                          )}

                          <p className="text-xs opacity-60 mt-1">
                            {new Date(msg.data_envio).toLocaleTimeString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>

                {/* Input de Mensagem Avançado */}
                <div className="border-t p-3 lg:p-4 bg-slate-50">
                  {/* Arquivo anexado */}
                  {arquivoAnexo && (
                    <div className="mb-2 flex items-center gap-2 text-sm bg-blue-50 border border-blue-200 p-2 rounded-lg">
                      <Paperclip className="w-4 h-4 text-blue-600" />
                      <span className="flex-1 truncate">{arquivoAnexo.name}</span>
                      <button
                        onClick={() => setArquivoAnexo(null)}
                        className="text-red-600 hover:text-red-700"
                      >
                        ×
                      </button>
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    {/* Botão anexar */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && !podeUsarAnexos) {
                          toast.error('Seu perfil nao tem permissao para anexar arquivos.');
                          e.target.value = '';
                          return;
                        }
                        if (file && file.size > MAX_ATTACHMENT_SIZE_BYTES) {
                          toast.error('Arquivo muito grande. O limite para anexos no atendimento e 10MB.');
                          e.target.value = '';
                          return;
                        }
                        if (file) {
                          setArquivoAnexo(file);
                          toast.success('Arquivo anexado!');
                        }
                      }}
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={!podeUsarAnexos || atendimentoBloqueado}
                      title="Anexar arquivo"
                      data-action="HubAtendimento.anexarArquivo"
                      data-permission="CRM.Atendimento.anexar"
                      data-context-required="group-or-company"
                      data-sensitive="true"
                    >
                      <Paperclip className="w-4 h-4" />
                    </Button>
                    
                    <Input
                      value={mensagemAtendente}
                      onChange={(e) => setMensagemAtendente(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (mensagemAtendente.trim() || arquivoAnexo) {
                            enviarMensagemMutation.mutate({ mensagem: mensagemAtendente, arquivo: arquivoAnexo });
                            setArquivoAnexo(null);
                          }
                        }
                      }}
                      placeholder="Digite sua mensagem... (Enter para enviar)"
                      disabled={enviarMensagemMutation.isPending || atendimentoBloqueado}
                      className="flex-1"
                    />
                    
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setExibirPainelLateral(true);
                        setPainelLateralConteudo('respostas');
                      }}
                      title="Respostas Rápidas"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </Button>
                    
                    <Button
                      onClick={() => {
                        if (mensagemAtendente.trim() || arquivoAnexo) {
                          enviarMensagemMutation.mutate({ mensagem: mensagemAtendente, arquivo: arquivoAnexo });
                          setArquivoAnexo(null);
                        }
                      }}
                      disabled={(!mensagemAtendente.trim() && !arquivoAnexo) || enviarMensagemMutation.isPending || atendimentoBloqueado}
                      className="bg-blue-600 hover:bg-blue-700"
                      data-action="HubAtendimento.enviarMensagem"
                      data-permission="CRM.Atendimento.editar"
                      data-context-required="group-or-company"
                      data-sensitive="true"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                <div ref={messagesEndRef} />
              </>
            ) : (
              <CardContent className="flex-1 flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>Selecione uma conversa para iniciar o atendimento</p>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Painel Lateral Contextual - Responsivo */}
          {exibirPainelLateral && conversaSelecionada && (
            <Card className="lg:col-span-1 flex flex-col">
              <CardHeader className="border-b p-2 lg:p-3">
                <div className="flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant={painelLateralConteudo === 'info' ? 'default' : 'outline'}
                    onClick={() => setPainelLateralConteudo('info')}
                  >
                    Info
                  </Button>
                  <Button
                    size="sm"
                    variant={painelLateralConteudo === 'respostas' ? 'default' : 'outline'}
                    onClick={() => setPainelLateralConteudo('respostas')}
                  >
                    Rápidas
                  </Button>
                  <Button
                    size="sm"
                    variant={painelLateralConteudo === 'acoes' ? 'default' : 'outline'}
                    onClick={() => setPainelLateralConteudo('acoes')}
                  >
                    Ações
                  </Button>
                  <Button
                    size="sm"
                    variant={painelLateralConteudo === 'ia' ? 'default' : 'outline'}
                    onClick={() => setPainelLateralConteudo('ia')}
                  >
                    IA
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-3 lg:p-4 h-[400px] lg:h-[600px] overflow-y-auto flex-1">
                {painelLateralConteudo === 'info' && (
                  <div className="space-y-4">
                    {/* Informações do Cliente */}
                    <div>
                      <h3 className="font-semibold text-sm text-slate-900 mb-2">Dados do Cliente</h3>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-slate-600">Email:</span>
                          <p className="font-medium">{conversaSelecionada.cliente_email || '-'}</p>
                        </div>
                        <div>
                          <span className="text-slate-600">Telefone:</span>
                          <p className="font-medium">{conversaSelecionada.cliente_telefone || '-'}</p>
                        </div>
                        <div>
                          <span className="text-slate-600">Canal Origem:</span>
                          <p className="font-medium">{conversaSelecionada.canal_id_externo || '-'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Métricas da Conversa */}
                    <div className="border-t pt-4">
                      <h3 className="font-semibold text-sm text-slate-900 mb-2">Métricas</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Total Mensagens:</span>
                          <span className="font-bold">{conversaSelecionada.total_mensagens || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Bot:</span>
                          <span className="font-bold text-purple-600">{conversaSelecionada.mensagens_bot || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Cliente:</span>
                          <span className="font-bold text-blue-600">{conversaSelecionada.mensagens_cliente || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Sentimento:</span>
                          <Badge className={`${
                            conversaSelecionada.sentimento_geral === 'Positivo' ? 'bg-green-600' :
                            conversaSelecionada.sentimento_geral === 'Negativo' ? 'bg-red-600' :
                            'bg-slate-600'
                          }`}>
                            {conversaSelecionada.sentimento_geral || 'Neutro'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="border-t pt-4">
                      <Suspense fallback={<div className="h-24 rounded-md bg-slate-100 animate-pulse" />}><TagsCategorizacao conversa={conversaSelecionada} /></Suspense>
                    </div>

                    {/* Sugestões da IA */}
                    <div className="border-t pt-4">
                      <Suspense fallback={<div className="h-24 rounded-md bg-slate-100 animate-pulse" />}><SugestoesIA conversa={conversaSelecionada} mensagens={mensagens} /></Suspense>
                    </div>

                    {/* Histórico Cliente */}
                    {conversaSelecionada.cliente_id && (
                      <div className="border-t pt-4">
                        <Suspense fallback={<div className="h-32 rounded-md bg-slate-100 animate-pulse" />}><HistoricoClienteChat clienteId={conversaSelecionada.cliente_id} /></Suspense>
                      </div>
                    )}
                  </div>
                )}

                {painelLateralConteudo === 'respostas' && (
                  <Suspense fallback={<div className="h-32 rounded-md bg-slate-100 animate-pulse" />}><RespostasRapidas
                    onSelecionarResposta={(texto) => {
                      setMensagemAtendente(texto);
                      setPainelLateralConteudo('info');
                    }}
                    contextoConversa={{
                      pedido: conversaSelecionada.pedido_gerado_id || 'PED-XXX',
                      status: 'Em Processamento',
                      data_entrega: 'DD/MM/AAAA',
                      endereco: 'Endereço do cliente',
                      link: '#',
                      linha_digitavel: 'XXXXX.XXXXX',
                      vencimento: 'DD/MM/AAAA',
                      quantidade: '3',
                      valor_total: 'R$ 5.000,00',
                      valor: 'R$ 5.000,00',
                      prazo: '5',
                      forma_pagamento: 'Boleto'
                    }}
                  /></Suspense>
                )}

                {painelLateralConteudo === 'acoes' && (
                  <div className="space-y-4">
                    <Suspense fallback={<div className="h-32 rounded-md bg-slate-100 animate-pulse" />}><CriarPedidoChat 
                      conversa={conversaSelecionada}
                      clienteId={conversaSelecionada.cliente_id}
                      onPedidoCriado={(pedido) => {
                        setMensagemAtendente(`✅ Pedido ${pedido.numero_pedido} criado com sucesso! Valor: R$ ${pedido.valor_total?.toLocaleString('pt-BR')}`);
                        setPainelLateralConteudo('info');
                      }}
                    /></Suspense>
                    <Suspense fallback={<div className="h-32 rounded-md bg-slate-100 animate-pulse" />}><GerarBoletoChat 
                      conversa={conversaSelecionada}
                      clienteId={conversaSelecionada.cliente_id}
                      onBoletoEnviado={(boleto) => {
                        setMensagemAtendente(`📄 Boleto gerado!\n\nValor: R$ ${boleto.valor?.toLocaleString('pt-BR')}\nVencimento: ${new Date(boleto.data_vencimento).toLocaleDateString('pt-BR')}\n\nLinha digitável:\n${boleto.linha_digitavel || 'Disponível no link'}`);
                        setPainelLateralConteudo('info');
                      }}
                    /></Suspense>
                    <Suspense fallback={<div className="h-32 rounded-md bg-slate-100 animate-pulse" />}><ConsultarEntregaChat 
                      clienteId={conversaSelecionada.cliente_id}
                      conversa={conversaSelecionada}
                    /></Suspense>
                  </div>
                )}

                {painelLateralConteudo === 'ia' && (
                  <div className="space-y-4">
                    <Suspense fallback={<div className="h-32 rounded-md bg-slate-100 animate-pulse" />}><IAConversacional 
                      conversa={conversaSelecionada}
                      mensagens={mensagens}
                      clienteId={conversaSelecionada.cliente_id}
                    /></Suspense>
                    <Suspense fallback={<div className="h-24 rounded-md bg-slate-100 animate-pulse" />}><SugestoesIA conversa={conversaSelecionada} mensagens={mensagens} /></Suspense>
                  </div>
                )}

                {painelLateralConteudo === 'transferir' && (
                  <TransferirConversa 
                    conversa={conversaSelecionada}
                    onTransferido={() => {
                      setPainelLateralConteudo('info');
                      setConversaSelecionada(null);
                    }}
                  />
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Modal de Transferência */}
        <AnimatePresence>
          {exibirTransferir && conversaSelecionada && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              onClick={() => setExibirTransferir(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md"
              >
                <TransferirConversa 
                  conversa={conversaSelecionada}
                  onTransferido={() => {
                    setExibirTransferir(false);
                    setConversaSelecionada(null);
                    queryClient.invalidateQueries({ queryKey: ['conversas-omnicanal'] });
                  }}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
          </>
        )}
        </ErrorBoundary>
      </div>
    </div>
  );
}
