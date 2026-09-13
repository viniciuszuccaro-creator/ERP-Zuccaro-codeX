import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AssinaturaEletronicaModal from "@/components/AssinaturaEletronicaModal";
import { useToast } from "@/components/ui/use-toast";
import { useWindow } from "@/components/lib/useWindow";
import ContratoForm from "@/components/contratos/ContratoForm";
import {
  FileText,
  Plus,
  Search,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  Edit,
  Trash2,
  TrendingUp,
  PenTool,
  Bell,
  RefreshCw,
  Receipt,
  History,
  Zap
} from "lucide-react";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

export default function ContratosPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewingContrato, setViewingContrato] = useState(null);
  const [editingContrato, setEditingContrato] = useState(null);
  const [assinaturaModalOpen, setAssinaturaModalOpen] = useState(false);
  const [contratoParaAssinar, setContratoParaAssinar] = useState(null);
  const [historicoDialogOpen, setHistoricoDialogOpen] = useState(false);
  const [contratoHistorico, setContratoHistorico] = useState(null);
  const [activeTab, setActiveTab] = useState("todos");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let initial = params.get('tab');
    if (!initial) { try { initial = localStorage.getItem('Contratos_tab'); } catch (error) { console.warn('[Contratos] Falha ao restaurar aba', error); } }
    if (initial) setActiveTab(initial);
  }, []);

  const handleTabChange = (value) => {
    setActiveTab(value);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', value);
    window.history.replaceState({}, '', url.toString());
    try { localStorage.setItem('Contratos_tab', value); } catch (error) { console.warn('[Contratos] Falha ao persistir aba', error); }
  };

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { openWindow } = useWindow();
  const { empresaAtual, filtrarPorContexto } = useContextoVisual();

  const [formData, setFormData] = useState({
    numero_contrato: "",
    tipo: "Cliente",
    parte_contratante: "",
    objeto: "",
    descricao: "",
    valor_mensal: 0,
    valor_total: 0,
    data_inicio: "",
    data_fim: "",
    data_assinatura: "",
    vigencia_meses: 12,
    renovacao_automatica: false,
    prazo_aviso_renovacao: 30,
    indice_reajuste: "IGPM",
    percentual_reajuste: 0,
    forma_pagamento: "Boleto",
    dia_vencimento: 10,
    responsavel_empresa: "",
    status: "Rascunho",
    observacoes: "",
    gerar_cobranca_automatica: true
  });

  const { data: contratos = [] } = useQuery({
    queryKey: ['contratos'],
    queryFn: () => base44.entities.Contrato.list('-created_date'),
    staleTime: 60000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list(),
    staleTime: 60000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ['fornecedores'],
    queryFn: () => base44.entities.Fornecedor.list(),
    staleTime: 60000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });

  // Multiempresa: aplicar contexto
  const contratosContexto = (() => { const ctx = filtrarPorContexto(contratos, 'empresa_id'); return (ctx && ctx.length > 0) ? ctx : contratos; })();
  const clientesFiltrados = (() => { const ctx = filtrarPorContexto(clientes, 'empresa_id'); return (ctx && ctx.length > 0) ? ctx : clientes; })();
  const fornecedoresFiltrados = (() => { const ctx = filtrarPorContexto(fornecedores, 'empresa_dona_id'); return (ctx && ctx.length > 0) ? ctx : fornecedores; })();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
  });

  // Helper functions for alerts - defined here to have access to user and toast
  const enviarAlerta = async (contrato, tipo, dias) => {
    try {
      await base44.entities.Notificacao.create({
        titulo: `⚠️ Contrato Vencendo: ${contrato.numero_contrato}`,
        mensagem: `O contrato "${contrato.objeto}" com ${contrato.parte_contratante} vence em ${dias} dias.\n\nData de vencimento: ${new Date(contrato.data_fim).toLocaleDateString('pt-BR')}\n\n${contrato.renovacao_automatica ? '✓ Renovação automática ativada' : '⚠️ Renovação manual necessária'}`,
        tipo: dias <= 7 ? 'urgente' : 'aviso',
        categoria: 'Sistema',
        prioridade: dias <= 7 ? 'Urgente' : 'Alta',
        destinatario_email: user?.email,
        link_acao: window.location.href,
        entidade_relacionada: 'Contrato',
        registro_id: contrato.id
      });

      const novaDataAlerta = new Date();
      novaDataAlerta.setDate(novaDataAlerta.getDate() + 7);

      // Create a copy of the contract object to avoid direct mutation of cached data
      const updatedContrato = {
        ...contrato,
        proximo_alerta_vencimento: novaDataAlerta.toISOString().split('T')[0],
        alertas_enviados: [
          ...(contrato.alertas_enviados || []),
          {
            tipo,
            data_envio: new Date().toISOString(),
            destinatario: user?.email,
            enviado: true
          }
        ]
      };

      await base44.entities.Contrato.update(contrato.id, updatedContrato);
      // Manually update the cache to reflect changes immediately without full re-fetch
      queryClient.setQueryData(['contratos'], (oldContratos) => 
        oldContratos.map(c => c.id === contrato.id ? updatedContrato : c)
      );

      toast({
        title: "🔔 Alerta Automático",
        description: `Contrato ${contrato.numero_contrato} vence em ${dias} dias`
      });
    } catch (error) {
      console.error('Erro ao enviar alerta:', error);
      toast({
        title: "❌ Erro ao enviar alerta",
        description: `Não foi possível enviar alerta para ${contrato.numero_contrato}.`,
        variant: "destructive",
      });
    }
  };

  const enviarAlertaReajuste = async (contrato, dias) => {
    try {
      await base44.entities.Notificacao.create({
        titulo: `📈 Reajuste de Contrato: ${contrato.numero_contrato}`,
        mensagem: `O contrato "${contrato.objeto}" com ${contrato.parte_contratante} tem reajuste programado em ${dias} dias.\n\nData do reajuste: ${new Date(contrato.data_proximo_reajuste).toLocaleDateString('pt-BR')}\nÍndice: ${contrato.indice_reajuste}\nValor atual: R$ ${contrato.valor_mensal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        tipo: 'info',
        categoria: 'Sistema',
        prioridade: 'Normal',
        destinatario_email: user?.email,
        link_acao: window.location.href,
        entidade_relacionada: 'Contrato',
        registro_id: contrato.id
      });

      const novaDataAlerta = new Date();
      novaDataAlerta.setDate(novaDataAlerta.getDate() + 7);

      // Create a copy of the contract object to avoid direct mutation of cached data
      const updatedContrato = {
        ...contrato,
        proximo_alerta_reajuste: novaDataAlerta.toISOString().split('T')[0],
        alertas_enviados: [
          ...(contrato.alertas_enviados || []),
          {
            tipo: 'Reajuste',
            data_envio: new Date().toISOString(),
            destinatario: user?.email,
            enviado: true
          }
        ]
      };

      await base44.entities.Contrato.update(contrato.id, updatedContrato);
      // Manually update the cache to reflect changes immediately without full re-fetch
      queryClient.setQueryData(['contratos'], (oldContratos) => 
        oldContratos.map(c => c.id === contrato.id ? updatedContrato : c)
      );
      
      toast({
        title: "🔔 Alerta de Reajuste",
        description: `Contrato ${contrato.numero_contrato} terá reajuste em ${dias} dias`
      });
    } catch (error) {
      console.error('Erro ao enviar alerta de reajuste:', error);
      toast({
        title: "❌ Erro ao enviar alerta de reajuste",
        description: `Não foi possível enviar alerta de reajuste para ${contrato.numero_contrato}.`,
        variant: "destructive",
      });
    }
  };

  // Sistema de Alertas Automáticos
  useEffect(() => {
    if (!user || contratos.length === 0) return;

    const verificarAlertas = async () => {
      const hoje = new Date();
      
      for (const contrato of contratos) {
        if (contrato.status !== 'Vigente') continue;

        // Alerta de Vencimento
        if (contrato.data_fim) {
          const dataFim = new Date(contrato.data_fim);
          const diasParaVencimento = Math.floor((dataFim - hoje) / (1000 * 60 * 60 * 24));
          const diasAvisoVencimento = contrato.prazo_aviso_renovacao || 30;

          if (diasParaVencimento <= diasAvisoVencimento && diasParaVencimento > 0) {
            const proximoAlerta = contrato.proximo_alerta_vencimento 
              ? new Date(contrato.proximo_alerta_vencimento)
              : null;

            if (!proximoAlerta || (hoje.getTime() - proximoAlerta.getTime()) >= 7 * 24 * 60 * 60 * 1000) {
              await enviarAlerta(contrato, 'Vencimento', diasParaVencimento);
            }
          }
        }

        // Alerta de Reajuste
        if (contrato.data_proximo_reajuste) {
          const dataReajuste = new Date(contrato.data_proximo_reajuste);
          const diasParaReajuste = Math.floor((dataReajuste - hoje) / (1000 * 60 * 60 * 24));

          if (diasParaReajuste <= 30 && diasParaReajuste > 0) {
            const proximoAlerteReajuste = contrato.proximo_alerta_reajuste
              ? new Date(contrato.proximo_alerta_reajuste)
              : null;

            if (!proximoAlerteReajuste || (hoje.getTime() - proximoAlerteReajuste.getTime()) >= 7 * 24 * 60 * 60 * 1000) {
              await enviarAlertaReajuste(contrato, diasParaReajuste);
            }
          }
        }
      }
    };

    const interval = setInterval(verificarAlertas, 3600000); // Checks every hour (3.6 million ms)
    verificarAlertas(); // Checks immediately upon component load/user/contratos changes

    return () => clearInterval(interval);
  }, [contratos, user, toast]);

  // Geração Automática de Cobranças
  const gerarCobrancasMutation = useMutation({
    mutationFn: async (contrato) => {
      if (!contrato.gerar_cobranca_automatica || contrato.status !== 'Vigente') {
        throw new Error('Cobranca automática não ativa ou contrato não vigente.');
      }
      
      const hoje = new Date();
      let ultimaCobrancaData = contrato.ultima_cobranca_gerada 
        ? new Date(contrato.ultima_cobranca_gerada)
        : new Date(contrato.data_inicio);
      
      // If data_inicio is in the future, don't generate yet.
      if (new Date(contrato.data_inicio) > hoje) {
        return { gerado: false, motivo: 'Contrato ainda não iniciou' };
      }

      // Adjust ultimaCobrancaData to be within the last month for comparison
      // If ultimaCobrancaData is too old, we consider the current month's potential charge
      const tempUltimaCobranca = new Date(ultimaCobrancaData);
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      
      if (tempUltimaCobranca < oneMonthAgo) {
          ultimaCobrancaData = new Date(hoje.getFullYear(), hoje.getMonth() -1, contrato.dia_vencimento || 1);
      }

      // Calculate the intended due date for the current month
      const currentMonthDueDate = new Date(hoje.getFullYear(), hoje.getMonth(), contrato.dia_vencimento || 1);
      
      // If a charge has already been generated for this month, skip
      if (ultimaCobrancaData.getMonth() === hoje.getMonth() && ultimaCobrancaData.getFullYear() === hoje.getFullYear()) {
          return { gerado: false, motivo: 'Cobrança para o mês atual já gerada' };
      }

      // Check if current date is past the due date for this month to generate
      if (hoje < currentMonthDueDate) {
          return { gerado: false, motivo: 'Ainda não é o dia de vencimento para gerar a cobrança' };
      }

      // Criar conta a receber
      const contaReceber = await base44.entities.ContaReceber.create({
        descricao: `Mensalidade ${contrato.objeto} - ${contrato.numero_contrato}`,
        cliente: contrato.parte_contratante,
        empresa_id: contrato.empresa_id || empresaAtual?.id,
        group_id: contrato.group_id || null,
        // Assuming parte_contratante_id exists or can be derived from clients/fornecedores
        // For now, it's missing in formData, should be added if needed for relation
        valor: contrato.valor_mensal,
        data_emissao: hoje.toISOString().split('T')[0],
        data_vencimento: currentMonthDueDate.toISOString().split('T')[0],
        status: 'Pendente',
        forma_recebimento: contrato.forma_pagamento,
        numero_documento: `BOL-${contrato.numero_contrato}-${hoje.getMonth() + 1}${hoje.getFullYear()}`,
        observacoes: `Gerado automaticamente do contrato ${contrato.numero_contrato}`
      });

      // Update contract
      const proximaCobrancaCalculated = new Date(hoje.getFullYear(), hoje.getMonth() + 1, contrato.dia_vencimento || 1);

      const updatedContrato = {
        ...contrato,
        ultima_cobranca_gerada: hoje.toISOString().split('T')[0],
        proxima_cobranca: proximaCobrancaCalculated.toISOString().split('T')[0],
        contas_geradas_ids: [...(contrato.contas_geradas_ids || []), contaReceber.id]
      };

      await base44.entities.Contrato.update(contrato.id, updatedContrato);

      // Manually update the cache to reflect changes immediately without full re-fetch
      queryClient.setQueryData(['contratos'], (oldContratos) => 
        oldContratos.map(c => c.id === contrato.id ? updatedContrato : c)
      );

      return { gerado: true, conta: contaReceber };
    },
    onSuccess: async (result) => {
      // Invalidate specific queries only if an actual charge was generated
      if (result.gerado) {
        await base44.entities.AuditLog.create({
          usuario: user?.full_name || user?.email || 'Usuário',
          usuario_id: user?.id,
          acao: 'Criação',
          modulo: 'Contratos',
          entidade: 'ContaReceber',
          registro_id: result.conta?.id,
          descricao: `Cobrança gerada do contrato ${result.conta?.numero_documento || ''}`,
        });
        queryClient.invalidateQueries({ queryKey: ['contratos'] });
        queryClient.invalidateQueries({ queryKey: ['contasReceber'] });
        toast({
          title: "✅ Cobrança Gerada!",
          description: `Boleto ${result.conta.numero_documento} criado automaticamente`
        });
      } else {
        toast({
          title: "ℹ️ Geração de Cobrança",
          description: result.motivo,
          variant: "default",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "❌ Erro ao Gerar Cobrança",
        description: error.message || "Não foi possível gerar a cobrança.",
        variant: "destructive",
      });
    }
  });

  // Renovação Automática
  const renovarContratoMutation = useMutation({
    mutationFn: async (contrato) => {
      const hoje = new Date();
      // Ensure data_fim is always after data_inicio for calculation
      const dataFimAtual = new Date(contrato.data_fim);
      if (dataFimAtual > hoje && !window.confirm(`O contrato ${contrato.numero_contrato} ainda está vigente (até ${dataFimAtual.toLocaleDateString('pt-BR')}). Deseja renovar manualmente agora?`)) {
        throw new Error('Renovação manual cancelada.');
      }


      const novaDataInicio = new Date(contrato.data_fim);
      novaDataInicio.setDate(novaDataInicio.getDate() + 1); // Day after current end date
      
      const novaDataFim = new Date(novaDataInicio);
      novaDataFim.setMonth(novaDataFim.getMonth() + contrato.vigencia_meses); // Add vigencia_meses

      // Calcular reajuste se houver
      let novoValorMensal = contrato.valor_mensal;
      let percentualReajusteAplicado = 0;

      if (contrato.percentual_reajuste && contrato.percentual_reajuste > 0) {
        percentualReajusteAplicado = contrato.percentual_reajuste;
        novoValorMensal = contrato.valor_mensal * (1 + percentualReajusteAplicado / 100);
      }

      const novoValorTotal = novoValorMensal * contrato.vigencia_meses;

      // Registrar no histórico
      const historicoRenovacao = {
        data_renovacao: hoje.toISOString().split('T')[0],
        valor_anterior: contrato.valor_mensal,
        valor_novo: novoValorMensal,
        percentual_reajuste: percentualReajusteAplicado,
        indice_utilizado: contrato.indice_reajuste,
        usuario: user?.full_name || 'Sistema',
        observacao: contrato.renovacao_automatica ? 'Renovação automática' : 'Renovação manual'
      };

      // Calcular próximo reajuste (1 ano após a nova data de início)
      const proximoReajuste = new Date(novaDataInicio);
      proximoReajuste.setFullYear(proximoReajuste.getFullYear() + 1);

      const updatedContrato = {
        ...contrato,
        data_inicio: novaDataInicio.toISOString().split('T')[0],
        data_fim: novaDataFim.toISOString().split('T')[0],
        valor_mensal: novoValorMensal,
        valor_total: novoValorTotal,
        data_proximo_reajuste: proximoReajuste.toISOString().split('T')[0],
        status: 'Vigente', // Reset status to Vigente upon renewal
        historico_renovacoes: [...(contrato.historico_renovacoes || []), historicoRenovacao],
        proximo_alerta_vencimento: null, // Reset alert date
        proximo_alerta_reajuste: null,   // Reset alert date
        ultima_cobranca_gerada: null,    // Reset last charge date if needed for new cycle
        proxima_cobranca: null,          // Recalculate based on new data_inicio
      };

      await base44.entities.Contrato.update(contrato.id, updatedContrato);
      queryClient.setQueryData(['contratos'], (oldContratos) => 
        oldContratos.map(c => c.id === contrato.id ? updatedContrato : c)
      );

      return { contrato, novoValorMensal, percentualReajusteAplicado };
    },
    onSuccess: async ({ contrato, novoValorMensal, percentualReajusteAplicado }) => {
      await base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || 'Usuário',
        usuario_id: user?.id,
        acao: 'Renovação',
        modulo: 'Contratos',
        entidade: 'Contrato',
        registro_id: contrato?.id,
        descricao: `Contrato ${contrato?.numero_contrato || ''} renovado`,
      });
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      
      toast({
        title: "✅ Contrato Renovado!",
        description: `${contrato.numero_contrato} renovado ${percentualReajusteAplicado > 0 ? `com reajuste de ${percentualReajusteAplicado}%` : 'sem reajuste'}`
      });
    },
    onError: (error) => {
      toast({
        title: "❌ Erro ao Renovar Contrato",
        description: error.message || "Não foi possível renovar o contrato.",
        variant: "destructive",
      });
    }
  });

  const createMutation = useMutation({
    mutationFn: (data) => {
      // Calculate data de próximo reajuste (1 ano após início)
      const dataProximoReajuste = new Date(data.data_inicio);
      dataProximoReajuste.setFullYear(dataProximoReajuste.getFullYear() + 1);

      // Calculate próxima cobrança (one month after data_inicio, based on dia_vencimento)
      const proximaCobranca = new Date(data.data_inicio);
      proximaCobranca.setMonth(proximaCobranca.getMonth() + 1);
      proximaCobranca.setDate(data.dia_vencimento || 1); // Set to day of vencimento

      return base44.entities.Contrato.create({
        ...data,
        empresa_id: data.empresa_id || empresaAtual?.id,
        group_id: data.group_id || null,
        data_proximo_reajuste: dataProximoReajuste.toISOString().split('T')[0],
        proxima_cobranca: proximaCobranca.toISOString().split('T')[0],
        historico_renovacoes: [],
        alertas_enviados: [],
        contas_geradas_ids: []
      });
    },
    onSuccess: async (created) => {
      await base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || 'Usuário',
        usuario_id: user?.id,
        acao: 'Criação',
        modulo: 'Contratos',
        entidade: 'Contrato',
        registro_id: created?.id,
        descricao: `Contrato ${created?.numero_contrato || ''} criado`,
      });
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "✅ Contrato Criado!",
        description: "O contrato foi adicionado ao sistema"
      });
    },
    onError: (error) => {
      toast({
        title: "❌ Erro ao Criar Contrato",
        description: error.message || "Não foi possível criar o contrato.",
        variant: "destructive",
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Contrato.update(id, data),
    onSuccess: async (_res, { id, data }) => {
      await base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || 'Usuário',
        usuario_id: user?.id,
        acao: 'Edição',
        modulo: 'Contratos',
        entidade: 'Contrato',
        registro_id: id,
        descricao: `Contrato ${data?.numero_contrato || ''} atualizado`,
      });
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      setIsDialogOpen(false);
      setEditingContrato(null);
      resetForm();
      toast({
        title: "✅ Contrato Atualizado!",
        description: "As alterações foram salvas"
      });
    },
    onError: (error) => {
      toast({
        title: "❌ Erro ao Atualizar Contrato",
        description: error.message || "Não foi possível atualizar o contrato.",
        variant: "destructive",
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Contrato.delete(id),
    onSuccess: async (_res, id) => {
      await base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || 'Usuário',
        usuario_id: user?.id,
        acao: 'Exclusão',
        modulo: 'Contratos',
        entidade: 'Contrato',
        registro_id: id,
        descricao: `Contrato excluído`,
      });
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      setViewingContrato(null);
      toast({
        title: "✅ Contrato Excluído",
        description: "O contrato foi removido"
      });
    },
    onError: (error) => {
      toast({
        title: "❌ Erro ao Excluir Contrato",
        description: error.message || "Não foi possível excluir o contrato.",
        variant: "destructive",
      });
    }
  });

  const resetForm = () => {
    setFormData({
      numero_contrato: "",
      tipo: "Cliente",
      parte_contratante: "",
      objeto: "",
      descricao: "",
      valor_mensal: 0,
      valor_total: 0,
      data_inicio: "",
      data_fim: "",
      data_assinatura: "",
      vigencia_meses: 12,
      renovacao_automatica: false,
      prazo_aviso_renovacao: 30,
      indice_reajuste: "IGPM",
      percentual_reajuste: 0,
      forma_pagamento: "Boleto",
      dia_vencimento: 10,
      responsavel_empresa: "",
      status: "Rascunho",
      observacoes: "",
      gerar_cobranca_automatica: true
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingContrato) {
      updateMutation.mutate({ id: editingContrato.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (contrato) => {
    setEditingContrato(contrato);
    setFormData(contrato); // Directly set contract data to form
    setIsDialogOpen(true);
  };

  const handleDelete = (contrato) => {
    if (window.confirm(`Deseja realmente excluir o contrato ${contrato.numero_contrato}?`)) {
      deleteMutation.mutate(contrato.id);
    }
  };

  const abrirAssinatura = (contrato) => {
    setContratoParaAssinar(contrato);
    setAssinaturaModalOpen(true);
  };

  const podeAssinar = (contrato) => {
    return contrato.status === 'Aguardando Assinatura' || 
           (contrato.status === 'Vigente' && !contrato.assinado);
  };

  const calcularDiasParaVencimento = (dataFim) => {
    const hoje = new Date();
    const vencimento = new Date(dataFim);
    const diff = Math.floor((vencimento - hoje) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const filteredContratos = contratosContexto.filter(c => {
    const searchLower = searchTerm.toLowerCase();
    const searchMatch = (
      c.numero_contrato?.toLowerCase().includes(searchLower) ||
      c.parte_contratante?.toLowerCase().includes(searchLower) ||
      c.objeto?.toLowerCase().includes(searchLower) ||
      c.titulo?.toLowerCase().includes(searchLower) ||
      c.descricao?.toLowerCase().includes(searchLower) ||
      c.tipo?.toLowerCase().includes(searchLower) ||
      c.status?.toLowerCase().includes(searchLower) ||
      c.responsavel_empresa?.toLowerCase().includes(searchLower) ||
      c.forma_pagamento?.toLowerCase().includes(searchLower) ||
      c.indice_reajuste?.toLowerCase().includes(searchLower) ||
      c.observacoes?.toLowerCase().includes(searchLower)
    );

    if (!searchMatch) return false;

    if (activeTab === "todos") return true;
    if (activeTab === "proximos") {
      const diasVencer = c.data_fim ? calcularDiasParaVencimento(c.data_fim) : -1;
      return diasVencer > 0 && diasVencer <= 60 && c.status === 'Vigente';
    }
    return c.status === activeTab;
  });

  const contratosPorStatus = {
    vigentes: contratosContexto.filter(c => c.status === 'Vigente'),
    aguardando: contratosContexto.filter(c => c.status === 'Aguardando Assinatura'),
    vencidos: contratosContexto.filter(c => c.status === 'Vencido'),
    proximosVencer: contratosContexto.filter(c => {
      if (c.status !== 'Vigente' || !c.data_fim) return false;
      const dias = calcularDiasParaVencimento(c.data_fim);
      return dias <= 60 && dias > 0;
    })
  };

  const valorTotalContratos = contratosContexto
    .filter(c => c.status === 'Vigente')
    .reduce((sum, c) => sum + (c.valor_mensal || 0), 0);

  const statusColors = {
    'Rascunho': 'bg-gray-100 text-gray-700',
    'Aguardando Assinatura': 'bg-yellow-100 text-yellow-700',
    'Vigente': 'bg-green-100 text-green-700',
    'Vencido': 'bg-red-100 text-red-700',
    'Rescindido': 'bg-orange-100 text-orange-700',
    'Renovado': 'bg-blue-100 text-blue-700'
  };

  const tipoColors = {
    'Cliente': 'bg-blue-50 text-blue-700',
    'Fornecedor': 'bg-purple-50 text-purple-700',
    'Prestação de Serviço': 'bg-indigo-50 text-indigo-700',
    'Locação': 'bg-orange-50 text-orange-700',
    'Parceria': 'bg-green-50 text-green-700',
    'Outro': 'bg-gray-50 text-gray-700'
  };

  return (
    <div className="h-full w-full p-6 lg:p-8 space-y-6 overflow-auto">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-lg">
              <FileText className="w-8 h-8 text-white" />
            </div>
            Gestão de Contratos
          </h1>
          <p className="text-slate-600 mt-1">Contratos inteligentes com alertas, assinatura eletrônica e cobrança automática</p>
        </div>

        <Button 
          className="bg-emerald-600 hover:bg-emerald-700"
          onClick={() => openWindow(ContratoForm, {
            windowMode: true,
            clientes,
            fornecedores,
            onSubmit: async (data) => {
              try {
                const dataProximoReajuste = new Date(data.data_inicio);
                dataProximoReajuste.setFullYear(dataProximoReajuste.getFullYear() + 1);
                const proximaCobranca = new Date(data.data_inicio);
                proximaCobranca.setMonth(proximaCobranca.getMonth() + 1);
                proximaCobranca.setDate(data.dia_vencimento || 1);
                await base44.entities.Contrato.create({
                  ...data,
                  empresa_id: data.empresa_id || empresaAtual?.id,
                  group_id: data.group_id || null,
                  data_proximo_reajuste: dataProximoReajuste.toISOString().split('T')[0],
                  proxima_cobranca: proximaCobranca.toISOString().split('T')[0],
                  historico_renovacoes: [],
                  alertas_enviados: [],
                  contas_geradas_ids: []
                });
                queryClient.invalidateQueries({ queryKey: ['contratos'] });
                toast({ title: "✅ Contrato criado!" });
              } catch (error) {
                toast({ title: "❌ Erro", description: error.message, variant: "destructive" });
              }
            }
          }, {
            title: '📄 Novo Contrato',
            width: 1100,
            height: 700
          })}
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Contrato
        </Button>

        <Dialog open={false}>
          <DialogTrigger asChild>
            <Button className="hidden">Removido</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingContrato ? 'Editar Contrato' : 'Novo Contrato'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="numero_contrato">Número do Contrato *</Label>
                  <Input
                    id="numero_contrato"
                    value={formData.numero_contrato}
                    onChange={(e) => setFormData({ ...formData, numero_contrato: e.target.value })}
                    placeholder="CONT-2025-001"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="tipo">Tipo *</Label>
                  <Select
                    value={formData.tipo}
                    onValueChange={(value) => setFormData({ ...formData, tipo: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cliente">Cliente</SelectItem>
                      <SelectItem value="Fornecedor">Fornecedor</SelectItem>
                      <SelectItem value="Prestação de Serviço">Prestação de Serviço</SelectItem>
                      <SelectItem value="Locação">Locação</SelectItem>
                      <SelectItem value="Parceria">Parceria</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <Label htmlFor="parte_contratante">Parte Contratante *</Label>
                  <Input
                    id="parte_contratante"
                    value={formData.parte_contratante}
                    onChange={(e) => setFormData({ ...formData, parte_contratante: e.target.value })}
                    list="partes-list"
                    required
                  />
                  <datalist id="partes-list">
                    {clientesFiltrados.map(c => <option key={c.id} value={c.nome} />)}
                    {fornecedoresFiltrados.map(f => <option key={f.id} value={f.nome} />)}
                  </datalist>
                </div>

                <div className="col-span-2">
                  <Label htmlFor="objeto">Objeto do Contrato *</Label>
                  <Input
                    id="objeto"
                    value={formData.objeto}
                    onChange={(e) => setFormData({ ...formData, objeto: e.target.value })}
                    placeholder="Ex: Fornecimento mensal de produtos"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="descricao">Descrição</Label>
                  <Textarea
                    id="descricao"
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="valor_mensal">Valor Mensal</Label>
                  <Input
                    id="valor_mensal"
                    type="number"
                    step="0.01"
                    value={formData.valor_mensal}
                    onChange={(e) => setFormData({ ...formData, valor_mensal: parseFloat(e.target.value) })}
                  />
                </div>

                <div>
                  <Label htmlFor="valor_total">Valor Total</Label>
                  <Input
                    id="valor_total"
                    type="number"
                    step="0.01"
                    value={formData.valor_total}
                    onChange={(e) => setFormData({ ...formData, valor_total: parseFloat(e.target.value) })}
                  />
                </div>

                <div>
                  <Label htmlFor="data_inicio">Data Início *</Label>
                  <Input
                    id="data_inicio"
                    type="date"
                    value={formData.data_inicio}
                    onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="data_fim">Data Fim</Label>
                  <Input
                    id="data_fim"
                    type="date"
                    value={formData.data_fim}
                    onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="vigencia_meses">Vigência (meses)</Label>
                  <Input
                    id="vigencia_meses"
                    type="number"
                    value={formData.vigencia_meses}
                    onChange={(e) => setFormData({ ...formData, vigencia_meses: parseInt(e.target.value) })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="indice_reajuste">Índice de Reajuste</Label>
                  <Select
                    value={formData.indice_reajuste}
                    onValueChange={(value) => setFormData({ ...formData, indice_reajuste: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IPCA">IPCA</SelectItem>
                      <SelectItem value="IGPM">IGPM</SelectItem>
                      <SelectItem value="INPC">INPC</SelectItem>
                      <SelectItem value="CDI">CDI</SelectItem>
                      <SelectItem value="Fixo">Fixo</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="percentual_reajuste">Reajuste Anual (%)</Label>
                  <Input
                    id="percentual_reajuste"
                    type="number"
                    step="0.01"
                    value={formData.percentual_reajuste}
                    onChange={(e) => setFormData({ ...formData, percentual_reajuste: parseFloat(e.target.value) })}
                  />
                </div>

                <div>
                  <Label htmlFor="forma_pagamento">Forma de Pagamento</Label>
                  <Select
                    value={formData.forma_pagamento}
                    onValueChange={(value) => setFormData({ ...formData, forma_pagamento: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Boleto">Boleto</SelectItem>
                      <SelectItem value="Transferência">Transferência</SelectItem>
                      <SelectItem value="Cartão">Cartão</SelectItem>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="dia_vencimento">Dia Vencimento</Label>
                  <Input
                    id="dia_vencimento"
                    type="number"
                    min="1"
                    max="31"
                    value={formData.dia_vencimento}
                    onChange={(e) => setFormData({ ...formData, dia_vencimento: parseInt(e.target.value) })}
                  />
                </div>

                <div>
                  <Label htmlFor="data_assinatura">Data Assinatura</Label>
                  <Input
                    id="data_assinatura"
                    type="date"
                    value={formData.data_assinatura}
                    onChange={(e) => setFormData({ ...formData, data_assinatura: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="responsavel_empresa">Responsável da Empresa</Label>
                  <Input
                    id="responsavel_empresa"
                    value={formData.responsavel_empresa}
                    onChange={(e) => setFormData({ ...formData, responsavel_empresa: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Rascunho">Rascunho</SelectItem>
                      <SelectItem value="Aguardando Assinatura">Aguardando Assinatura</SelectItem>
                      <SelectItem value="Vigente">Vigente</SelectItem>
                      <SelectItem value="Vencido">Vencido</SelectItem>
                      <SelectItem value="Rescindido">Rescindido</SelectItem>
                      <SelectItem value="Renovado">Renovado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2 space-y-3 border-t pt-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-600" />
                    Automações
                  </h4>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="renovacao_automatica"
                      checked={formData.renovacao_automatica}
                      onCheckedChange={(checked) => setFormData({ ...formData, renovacao_automatica: checked })}
                    />
                    <Label htmlFor="renovacao_automatica" className="font-normal cursor-pointer">
                      Renovação automática ao vencer
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="gerar_cobranca_automatica"
                      checked={formData.gerar_cobranca_automatica}
                      onCheckedChange={(checked) => setFormData({ ...formData, gerar_cobranca_automatica: checked })}
                    />
                    <Label htmlFor="gerar_cobranca_automatica" className="font-normal cursor-pointer">
                      Gerar boletos/cobranças automaticamente
                    </Label>
                  </div>

                  <div>
                    <Label htmlFor="prazo_aviso_renovacao">Alertar renovação com (dias de antecedência)</Label>
                    <Input
                      id="prazo_aviso_renovacao"
                      type="number"
                      value={formData.prazo_aviso_renovacao}
                      onChange={(e) => setFormData({ ...formData, prazo_aviso_renovacao: parseInt(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="col-span-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    id="observacoes"
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    rows={2}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
                  {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : editingContrato ? 'Atualizar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-slate-600">Contratos Vigentes</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{contratosPorStatus.vigentes.length}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-slate-600">Receita Mensal Recorrente</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">
                  R$ {valorTotalContratos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-slate-600">Próximos a Vencer</p>
                <p className="text-3xl font-bold text-orange-600 mt-1">{contratosPorStatus.proximosVencer.length}</p>
                <p className="text-xs text-slate-500 mt-1">60 dias</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-slate-600">Aguardando Assinatura</p>
                <p className="text-3xl font-bold text-yellow-600 mt-1">{contratosPorStatus.aguardando.length}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <AlertCircle className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Abas de Navegação */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-5 mb-4">
          <TabsTrigger value="todos">Todos ({contratosContexto.length})</TabsTrigger>
          <TabsTrigger value="Vigente">Vigentes ({contratosPorStatus.vigentes.length})</TabsTrigger>
          <TabsTrigger value="Aguardando Assinatura">Aguardando Assinatura ({contratosPorStatus.aguardando.length})</TabsTrigger>
          <TabsTrigger value="proximos">Próximos a Vencer ({contratosPorStatus.proximosVencer.length})</TabsTrigger>
          <TabsTrigger value="Vencido">Vencidos ({contratosPorStatus.vencidos.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Busca */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <Input
              placeholder="Buscar por número, contratante, objeto, tipo, status, responsável, forma pagamento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Contratos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Parte Contratante</TableHead>
                  <TableHead>Objeto</TableHead>
                  <TableHead>Vigência</TableHead>
                  <TableHead>Valor Mensal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContratos.map((contrato) => {
                  const diasVencer = contrato.data_fim ? calcularDiasParaVencimento(contrato.data_fim) : -1;
                  return (
                    <TableRow key={contrato.id}>
                      <TableCell className="font-medium">{contrato.numero_contrato}</TableCell>
                      <TableCell>
                        <Badge className={tipoColors[contrato.tipo]}>{contrato.tipo}</Badge>
                      </TableCell>
                      <TableCell>{contrato.parte_contratante}</TableCell>
                      <TableCell className="max-w-xs truncate">{contrato.objeto}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {contrato.data_inicio && new Date(contrato.data_inicio).toLocaleDateString('pt-BR')} até{' '}
                          {contrato.data_fim && new Date(contrato.data_fim).toLocaleDateString('pt-BR')}
                          {diasVencer > 0 && diasVencer <= 60 && contrato.status === 'Vigente' && (
                            <div className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                              <Bell className="w-3 h-3" />
                              Vence em {diasVencer} dias
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold text-emerald-600">
                        R$ {contrato.valor_mensal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge className={statusColors[contrato.status]}>{contrato.status}</Badge>
                          {contrato.assinado && (
                            <Badge className="bg-green-100 text-green-700 text-xs">
                              ✓ Assinado
                            </Badge>
                          )}
                          {contrato.renovacao_automatica && (
                            <Badge className="bg-blue-100 text-blue-700 text-xs">
                              🔄 Auto-renova
                            </Badge>
                          )}
                          {contrato.gerar_cobranca_automatica && (
                            <Badge className="bg-purple-100 text-purple-700 text-xs">
                              💳 Auto-cobrança
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          <Button variant="ghost" size="icon" onClick={() => setViewingContrato(contrato)} title="Ver detalhes">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => openWindow(ContratoForm, {
                              contrato,
                              windowMode: true,
                              clientes,
                              fornecedores,
                              onSubmit: async (data) => {
                                try {
                                  await base44.entities.Contrato.update(contrato.id, data);
                                  queryClient.invalidateQueries({ queryKey: ['contratos'] });
                                  toast({ title: "✅ Contrato atualizado!" });
                                } catch (error) {
                                  toast({ title: "❌ Erro", description: error.message, variant: "destructive" });
                                }
                              }
                            }, {
                              title: `✏️ Editar: ${contrato.numero_contrato}`,
                              width: 1100,
                              height: 700
                            })}
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          {podeAssinar(contrato) && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => abrirAssinatura(contrato)}
                              title="Assinar Eletronicamente"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <PenTool className="w-4 h-4" />
                            </Button>
                          )}
                          {contrato.gerar_cobranca_automatica && contrato.status === 'Vigente' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => gerarCobrancasMutation.mutate(contrato)}
                              title="Gerar Cobrança Manualmente"
                              className="text-purple-600 hover:text-purple-700"
                              disabled={gerarCobrancasMutation.isPending}
                            >
                              <Receipt className="w-4 h-4" />
                            </Button>
                          )}
                          {(contrato.status === 'Vigente' && diasVencer <= 0) || (contrato.status === 'Vencido' && contrato.renovacao_automatica) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => renovarContratoMutation.mutate(contrato)}
                              title="Renovar Contrato"
                              className="text-green-600 hover:text-green-700"
                              disabled={renovarContratoMutation.isPending}
                            >
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                          )}
                          {(contrato.historico_renovacoes?.length > 0 || contrato.alertas_enviados?.length > 0) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setContratoHistorico(contrato);
                                setHistoricoDialogOpen(true);
                              }}
                              title="Ver Histórico"
                              className="text-indigo-600"
                            >
                              <History className="w-4 h-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(contrato)} className="text-red-600 hover:text-red-700" title="Excluir">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {filteredContratos.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-500">Nenhum contrato encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Visualização */}
      {viewingContrato && (
        <Dialog open={!!viewingContrato} onOpenChange={() => setViewingContrato(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhes do Contrato</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-600">Número</Label>
                  <p className="font-bold text-lg">{viewingContrato.numero_contrato}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Status</Label>
                  <Badge className={statusColors[viewingContrato.status]}>{viewingContrato.status}</Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-600">Tipo</Label>
                  <p className="font-medium">{viewingContrato.tipo}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Parte Contratante</Label>
                  <p className="font-medium">{viewingContrato.parte_contratante}</p>
                </div>
              </div>

              <div>
                <Label className="text-slate-600">Objeto</Label>
                <p className="font-medium">{viewingContrato.objeto}</p>
              </div>

              {viewingContrato.descricao && (
                <div>
                  <Label className="text-slate-600">Descrição</Label>
                  <p className="text-sm">{viewingContrato.descricao}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-600">Valor Mensal</Label>
                  <p className="text-xl font-bold text-emerald-600">
                    R$ {viewingContrato.valor_mensal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <Label className="text-slate-600">Valor Total</Label>
                  <p className="text-xl font-bold text-slate-900">
                    R$ {viewingContrato.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-slate-600">Data Início</Label>
                  <p className="font-medium">{viewingContrato.data_inicio && new Date(viewingContrato.data_inicio).toLocaleDateString('pt-BR')}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Data Fim</Label>
                  <p className="font-medium">{viewingContrato.data_fim && new Date(viewingContrato.data_fim).toLocaleDateString('pt-BR')}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Vigência</Label>
                  <p className="font-medium">{viewingContrato.vigencia_meses} meses</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-600">Forma de Pagamento</Label>
                  <p className="font-medium">{viewingContrato.forma_pagamento}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Dia Vencimento</Label>
                  <p className="font-medium">Dia {viewingContrato.dia_vencimento}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-600">Índice de Reajuste</Label>
                  <p className="font-medium">{viewingContrato.indice_reajuste}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Reajuste Anual</Label>
                  <p className="font-medium">{viewingContrato.percentual_reajuste}%</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-600">Renovação Automática</Label>
                  <p className="font-medium">{viewingContrato.renovacao_automatica ? 'Sim' : 'Não'}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Alertar Renovação</Label>
                  <p className="font-medium">{viewingContrato.prazo_aviso_renovacao} dias antes</p>
                </div>
              </div>

              {viewingContrato.gerar_cobranca_automatica && (
                <Card className="bg-purple-50 border-purple-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-5 h-5 text-purple-600" />
                      <p className="font-semibold text-purple-900">Cobrança Automática Ativa</p>
                    </div>
                    <div className="text-sm text-purple-800 space-y-1">
                      <p>Última cobrança: {viewingContrato.ultima_cobranca_gerada ? new Date(viewingContrato.ultima_cobranca_gerada).toLocaleDateString('pt-BR') : 'Nenhuma'}</p>
                      <p>Próxima cobrança: {viewingContrato.proxima_cobranca ? new Date(viewingContrato.proxima_cobranca).toLocaleDateString('pt-BR') : 'Pendente'}</p>
                      <p>Total de cobranças geradas: {viewingContrato.contas_geradas_ids?.length || 0}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {viewingContrato.responsavel_empresa && (
                <div>
                  <Label className="text-slate-600">Responsável</Label>
                  <p className="font-medium">{viewingContrato.responsavel_empresa}</p>
                </div>
              )}

              {viewingContrato.assinado && viewingContrato.assinatura_digital && (
                <div className="border-t pt-4">
                  <Label className="text-slate-600 mb-2 block">Assinatura Digital</Label>
                  <Card className="p-4 bg-green-50 border-green-200">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-green-900">
                        <p className="font-semibold mb-1">Documento Assinado Digitalmente</p>
                        <p>Por: <strong>{viewingContrato.assinatura_digital.nome_completo}</strong></p>
                        <p>Em: <strong>{viewingContrato.data_assinatura && new Date(viewingContrato.data_assinatura).toLocaleString('pt-BR')}</strong></p>
                        <p className="text-xs text-green-700 mt-1">
                          IP: {viewingContrato.assinatura_digital.ip_address} | 
                          {viewingContrato.assinatura_digital.dispositivo} - {viewingContrato.assinatura_digital.navegador}
                        </p>
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {viewingContrato.observacoes && (
                <div>
                  <Label className="text-slate-600">Observações</Label>
                  <p className="text-sm">{viewingContrato.observacoes}</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog Histórico */}
      <Dialog open={historicoDialogOpen} onOpenChange={setHistoricoDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico do Contrato {contratoHistorico?.numero_contrato}</DialogTitle>
          </DialogHeader>
          {contratoHistorico && (
            <div className="space-y-6">
              {/* Histórico de Renovações */}
              {contratoHistorico.historico_renovacoes && contratoHistorico.historico_renovacoes.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-blue-600" />
                    Renovações e Reajustes
                  </h4>
                  <div className="space-y-2">
                    {contratoHistorico.historico_renovacoes.map((renovacao, idx) => (
                      <Card key={idx} className="p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold">{renovacao.observacao}</p>
                            <p className="text-sm text-slate-600">
                              {new Date(renovacao.data_renovacao).toLocaleDateString('pt-BR')} - Por {renovacao.usuario}
                            </p>
                            <div className="text-sm mt-2">
                              <p>Valor anterior: <span className="font-semibold">R$ {renovacao.valor_anterior?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></p>
                              <p>Valor novo: <span className="font-semibold text-green-600">R$ {renovacao.valor_novo?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></p>
                              {renovacao.percentual_reajuste > 0 && (
                                <p>Reajuste: <Badge className="bg-blue-100 text-blue-700">{renovacao.percentual_reajuste}% ({renovacao.indice_utilizado})</Badge></p>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Histórico de Alertas */}
              {contratoHistorico.alertas_enviados && contratoHistorico.alertas_enviados.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-orange-600" />
                    Alertas Enviados
                  </h4>
                  <div className="space-y-2">
                    {contratoHistorico.alertas_enviados.map((alerta, idx) => (
                      <Card key={idx} className="p-3 bg-orange-50 border-orange-200">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-semibold text-orange-900">{alerta.tipo}</p>
                            <p className="text-sm text-orange-700">
                              Enviado em {new Date(alerta.data_envio).toLocaleString('pt-BR')}
                            </p>
                            <p className="text-xs text-orange-600">Para: {alerta.destinatario}</p>
                          </div>
                          {alerta.enviado && (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Assinatura */}
      {contratoParaAssinar && (
        <AssinaturaEletronicaModal
          isOpen={assinaturaModalOpen}
          onClose={() => {
            setAssinaturaModalOpen(false);
            setContratoParaAssinar(null);
            queryClient.invalidateQueries({ queryKey: ['contratos'] });
          }}
          documento={contratoParaAssinar}
          tipo="contrato"
          onAssinado={(assinatura) => {
            console.log('Contrato assinado:', assinatura);
            // The invalidateQueries above will handle re-fetching and updating UI
          }}
        />
      )}
    </div>
  );
}
