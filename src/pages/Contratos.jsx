import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useWindow } from "@/components/lib/useWindow";
import usePermissions from "@/components/lib/usePermissions";
import ContratoForm from "@/components/contratos/ContratoForm";
import ContratoDialogs from "@/components/contratos/ContratoDialogs";
import ContratosOverview from "@/components/contratos/ContratosOverview";
import { FileText, Plus } from "lucide-react";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { filtrarContratos, mensagemErro, requireContratoId, resumirContratos } from "@/components/contratos/contratosPagePolicy";

/** @typedef {import('@/components/contratos/contratosPagePolicy.js').Contrato} Contrato */
/** @typedef {import('@/components/contratos/contratosPagePolicy.js').ParteContrato} ParteContrato */
/** @typedef {import('@/components/contratos/contratosPagePolicy.js').UsuarioContrato} UsuarioContrato */

export default function ContratosPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [viewingContrato, setViewingContrato] = useState(/** @type {Contrato|null} */ (null));
  const [assinaturaModalOpen, setAssinaturaModalOpen] = useState(false);
  const [contratoParaAssinar, setContratoParaAssinar] = useState(/** @type {Contrato|null} */ (null));
  const [historicoDialogOpen, setHistoricoDialogOpen] = useState(false);
  const [contratoHistorico, setContratoHistorico] = useState(/** @type {Contrato|null} */ (null));
  const [activeTab, setActiveTab] = useState("todos");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let initial = params.get('tab');
    if (!initial) { try { initial = localStorage.getItem('Contratos_tab'); } catch (error) { console.warn('[Contratos] Falha ao restaurar aba', error); } }
    if (initial) setActiveTab(initial);
  }, []);

  /** @param {string} value */
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
  const { empresaAtual, contextoCanonico, contextoValido, getFiltroContexto, createInContext, updateInContext } = useContextoVisual();
  const { hasPermissionKey, isAdmin, isLoading: permissionsLoading } = usePermissions();
  const admin = isAdmin();
  const canView = admin || hasPermissionKey('Contratos.contratos.visualizar');
  const canCreate = admin || hasPermissionKey('Contratos.contratos.criar');
  const canEdit = admin || hasPermissionKey('Contratos.contratos.editar');
  const canSign = admin || hasPermissionKey('Contratos.contratos.assinar');
  const canCharge = admin || hasPermissionKey('Contratos.contratos.executar');
  const canRenew = admin || hasPermissionKey('Contratos.contratos.renovar');
  const canDeactivate = admin || hasPermissionKey('Contratos.contratos.inativar');
  const queryScope = [contextoCanonico.groupId, contextoCanonico.scopeType, contextoCanonico.empresaId];
  const contratosQueryKey = ['contratos', ...queryScope];

  const { data: contratos = [] } = useQuery({
    queryKey: contratosQueryKey,
    queryFn: () => /** @type {Promise<Contrato[]>} */ (base44.entities.Contrato.filter(getFiltroContexto('empresa_id', true), '-created_date')),
    enabled: contextoValido && canView && !permissionsLoading,
    staleTime: 60000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes', ...queryScope],
    queryFn: () => /** @type {Promise<ParteContrato[]>} */ (base44.entities.Cliente.filter({ group_id: contextoCanonico.groupId })),
    enabled: contextoValido && canView && !permissionsLoading,
    staleTime: 60000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ['fornecedores', ...queryScope],
    queryFn: () => /** @type {Promise<ParteContrato[]>} */ (base44.entities.Fornecedor.filter({ group_id: contextoCanonico.groupId })),
    enabled: contextoValido && canView && !permissionsLoading,
    staleTime: 60000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });

  const { data: user } = useQuery({
    queryKey: ['user', ...queryScope],
    queryFn: () => /** @type {Promise<UsuarioContrato>} */ (base44.auth.me()),
    enabled: contextoValido && canView && !permissionsLoading,
  });

  // Helper functions for alerts - defined here to have access to user and toast
  /** @param {Contrato} contrato @param {string} tipo @param {number} dias */
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
        registro_id: contrato.id,
        group_id: contrato.group_id,
        empresa_id: contrato.empresa_id
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

      await updateInContext('Contrato', requireContratoId(contrato), updatedContrato, 'empresa_id');
      // Manually update the cache to reflect changes immediately without full re-fetch
      queryClient.setQueryData(contratosQueryKey, (/** @type {Contrato[]|undefined} */ oldContratos = []) =>
        oldContratos.map((c) => c.id === contrato.id ? updatedContrato : c)
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

  /** @param {Contrato} contrato @param {number} dias */
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
        registro_id: contrato.id,
        group_id: contrato.group_id,
        empresa_id: contrato.empresa_id
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

      await updateInContext('Contrato', requireContratoId(contrato), updatedContrato, 'empresa_id');
      // Manually update the cache to reflect changes immediately without full re-fetch
      queryClient.setQueryData(contratosQueryKey, (/** @type {Contrato[]|undefined} */ oldContratos = []) =>
        oldContratos.map((c) => c.id === contrato.id ? updatedContrato : c)
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
    if (!user || !canEdit || contratos.length === 0) return;

    const verificarAlertas = async () => {
      const hoje = new Date();
      
      for (const contrato of contratos) {
        if (contrato.status !== 'Vigente') continue;

        // Alerta de Vencimento
        if (contrato.data_fim) {
          const dataFim = new Date(contrato.data_fim);
          const diasParaVencimento = Math.floor((dataFim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
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
          const diasParaReajuste = Math.floor((dataReajuste.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

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
    mutationFn: async (/** @type {Contrato} */ contrato) => {
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

      const empresaId = contrato.empresa_id || empresaAtual?.id;
      const groupId = contrato.group_id || contextoCanonico.groupId;
      if (!empresaId || !groupId) {
        throw new Error('Grupo e empresa são obrigatórios para gerar a cobrança.');
      }

      // Criar conta a receber
      const contaReceber = await createInContext('ContaReceber', {
        descricao: `Mensalidade ${contrato.objeto} - ${contrato.numero_contrato}`,
        cliente: contrato.parte_contratante,
        empresa_id: empresaId,
        group_id: groupId,
        // Assuming parte_contratante_id exists or can be derived from clients/fornecedores
        // For now, it's missing in formData, should be added if needed for relation
        valor: contrato.valor_mensal,
        data_emissao: hoje.toISOString().split('T')[0],
        data_vencimento: currentMonthDueDate.toISOString().split('T')[0],
        status: 'Pendente',
        forma_recebimento: contrato.forma_pagamento,
        numero_documento: `BOL-${contrato.numero_contrato}-${hoje.getMonth() + 1}${hoje.getFullYear()}`,
        observacoes: `Gerado automaticamente do contrato ${contrato.numero_contrato}`
      }, 'empresa_id');

      // Update contract
      const proximaCobrancaCalculated = new Date(hoje.getFullYear(), hoje.getMonth() + 1, contrato.dia_vencimento || 1);

      const updatedContrato = {
        ...contrato,
        ultima_cobranca_gerada: hoje.toISOString().split('T')[0],
        proxima_cobranca: proximaCobrancaCalculated.toISOString().split('T')[0],
        contas_geradas_ids: [...(contrato.contas_geradas_ids || []), contaReceber.id]
      };

      await updateInContext('Contrato', requireContratoId(contrato), updatedContrato, 'empresa_id');

      // Manually update the cache to reflect changes immediately without full re-fetch
      queryClient.setQueryData(contratosQueryKey, (/** @type {Contrato[]|undefined} */ oldContratos = []) =>
        oldContratos.map((c) => c.id === contrato.id ? updatedContrato : c)
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
          group_id: result.conta?.group_id,
          empresa_id: result.conta?.empresa_id,
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
    onError: (/** @type {unknown} */ error) => {
      toast({
        title: "❌ Erro ao Gerar Cobrança",
        description: mensagemErro(error) || "Não foi possível gerar a cobrança.",
        variant: "destructive",
      });
    }
  });

  // Renovação Automática
  const renovarContratoMutation = useMutation({
    mutationFn: async (/** @type {Contrato} */ contrato) => {
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

      await updateInContext('Contrato', requireContratoId(contrato), updatedContrato, 'empresa_id');
      queryClient.setQueryData(contratosQueryKey, (/** @type {Contrato[]|undefined} */ oldContratos = []) =>
        oldContratos.map((c) => c.id === contrato.id ? updatedContrato : c)
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
        group_id: contrato?.group_id,
        empresa_id: contrato?.empresa_id,
      });
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      
      toast({
        title: "✅ Contrato Renovado!",
        description: `${contrato.numero_contrato} renovado ${percentualReajusteAplicado > 0 ? `com reajuste de ${percentualReajusteAplicado}%` : 'sem reajuste'}`
      });
    },
    onError: (/** @type {unknown} */ error) => {
      toast({
        title: "❌ Erro ao Renovar Contrato",
        description: mensagemErro(error) || "Não foi possível renovar o contrato.",
        variant: "destructive",
      });
    }
  });

  const createMutation = useMutation({
    mutationFn: (/** @type {Contrato} */ data) => {
      // Calculate data de próximo reajuste (1 ano após início)
      const dataProximoReajuste = new Date(data.data_inicio);
      dataProximoReajuste.setFullYear(dataProximoReajuste.getFullYear() + 1);

      // Calculate próxima cobrança (one month after data_inicio, based on dia_vencimento)
      const proximaCobranca = new Date(data.data_inicio);
      proximaCobranca.setMonth(proximaCobranca.getMonth() + 1);
      proximaCobranca.setDate(data.dia_vencimento || 1); // Set to day of vencimento

      if (!contextoCanonico.groupId || !empresaAtual?.id) {
        throw new Error('Selecione uma empresa válida antes de criar o contrato.');
      }
      return createInContext('Contrato', {
        ...data,
        empresa_id: empresaAtual.id,
        group_id: contextoCanonico.groupId,
        data_proximo_reajuste: dataProximoReajuste.toISOString().split('T')[0],
        proxima_cobranca: proximaCobranca.toISOString().split('T')[0],
        historico_renovacoes: [],
        alertas_enviados: [],
        contas_geradas_ids: []
      }, 'empresa_id');
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
        group_id: created?.group_id,
        empresa_id: created?.empresa_id,
      });
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      toast({
        title: "✅ Contrato Criado!",
        description: "O contrato foi adicionado ao sistema"
      });
    },
    onError: (/** @type {unknown} */ error) => {
      toast({
        title: "❌ Erro ao Criar Contrato",
        description: mensagemErro(error) || "Não foi possível criar o contrato.",
        variant: "destructive",
      });
    }
  });

  const deactivateMutation = useMutation({
    mutationFn: (/** @type {Contrato} */ contrato) => {
      return updateInContext('Contrato', requireContratoId(contrato), { ...contrato, status: 'Rescindido' }, 'empresa_id');
    },
    onSuccess: async (_res, contrato) => {
      await base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || 'Usuário',
        usuario_id: user?.id,
        acao: 'Inativação',
        modulo: 'Contratos',
        entidade: 'Contrato',
        registro_id: contrato.id,
        descricao: `Contrato ${contrato.numero_contrato || ''} rescindido`,
        group_id: contrato.group_id,
        empresa_id: contrato.empresa_id,
      });
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      setViewingContrato(null);
      toast({
        title: "✅ Contrato Rescindido",
        description: "O histórico foi preservado e o contrato ficou inativo"
      });
    },
    onError: (/** @type {unknown} */ error) => {
      toast({
        title: "❌ Erro ao Rescindir Contrato",
        description: mensagemErro(error),
        variant: "destructive",
      });
    }
  });

  /** @param {Contrato} contrato */
  const handleDelete = (contrato) => {
    if (window.confirm(`Deseja realmente rescindir o contrato ${contrato.numero_contrato}? O histórico será preservado.`)) {
      deactivateMutation.mutate(contrato);
    }
  };

  /** @param {Contrato} contrato */
  const abrirAssinatura = (contrato) => {
    setContratoParaAssinar(contrato);
    setAssinaturaModalOpen(true);
  };

  const filteredContratos = filtrarContratos(contratos, searchTerm, activeTab);
  const contratosPorStatus = resumirContratos(contratos);

  const abrirNovoContrato = () => openWindow(ContratoForm, {
    windowMode: true,
    clientes,
    fornecedores,
    onSubmit: (/** @type {Contrato} */ data) => createMutation.mutateAsync(data)
  }, { title: '📄 Novo Contrato', width: 1100, height: 700 });

  /** @param {Contrato} contrato */
  const abrirEdicaoContrato = (contrato) => openWindow(ContratoForm, {
    contrato,
    windowMode: true,
    clientes,
    fornecedores,
    onSubmit: async (/** @type {Contrato} */ data) => {
      await updateInContext('Contrato', requireContratoId(contrato), data, 'empresa_id');
      await queryClient.invalidateQueries({ queryKey: ['contratos'] });
      toast({ title: '✅ Contrato atualizado!' });
    }
  }, { title: `✏️ Editar: ${contrato.numero_contrato}`, width: 1100, height: 700 });

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

        {canCreate && contextoCanonico.scopeType === 'empresa' && empresaAtual?.id && (
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={abrirNovoContrato}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Contrato
          </Button>
        )}

      </div>

      <ContratosOverview
        contratos={contratos}
        filtrados={filteredContratos}
        resumo={contratosPorStatus}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onView={setViewingContrato}
        onEdit={abrirEdicaoContrato}
        onSign={abrirAssinatura}
        onCharge={(contrato) => gerarCobrancasMutation.mutate(contrato)}
        onRenew={(contrato) => renovarContratoMutation.mutate(contrato)}
        onHistory={(contrato) => {
          setContratoHistorico(contrato);
          setHistoricoDialogOpen(true);
        }}
        onDeactivate={handleDelete}
        canEdit={canEdit}
        canSign={canSign}
        canCharge={canCharge}
        canRenew={canRenew}
        canDeactivate={canDeactivate}
        charging={gerarCobrancasMutation.isPending}
        renewing={renovarContratoMutation.isPending}
      />

      <ContratoDialogs
        viewing={viewingContrato}
        onCloseViewing={() => setViewingContrato(null)}
        historyOpen={historicoDialogOpen}
        onHistoryOpenChange={setHistoricoDialogOpen}
        history={contratoHistorico}
        signatureOpen={assinaturaModalOpen}
        signatureContract={contratoParaAssinar}
        onCloseSignature={() => {
          setAssinaturaModalOpen(false);
          setContratoParaAssinar(null);
          queryClient.invalidateQueries({ queryKey: ['contratos'] });
        }}
      />
    </div>
  );
}
