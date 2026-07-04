import React, { useState, useEffect, Suspense } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PedidoHeader from './pedido/PedidoHeader';
import PedidoTabsNav from './pedido/PedidoTabsNav';
import PedidoValidationAlerts from './pedido/PedidoValidationAlerts';
import {
  User,
  Package,
  Factory,
  Scissors,
  Truck,
  DollarSign,
  FileText,
  Shield,
  Check,
  AlertTriangle,
  ChevronRight,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useOrigemPedido } from '@/components/lib/useOrigemPedido';
import ProtectedSection from '@/components/security/ProtectedSection';
import useContextoVisual from '@/components/lib/useContextoVisual';
import { useUser } from '@/components/lib/UserContext';

// Validações avançadas movidas para ./pedido/pedidoSchema

// Componentes das Etapas
const WizardEtapa1Cliente = React.lazy(() => import('./wizard/WizardEtapa1Cliente'));
const ItensRevendaTab = React.lazy(() => import('./ItensRevendaTab'));
const ArmadoPadraoTab = React.lazy(() => import('./ArmadoPadraoTab'));
const CorteDobraIATab = React.lazy(() => import('./CorteDobraIATab'));
const HistoricoClienteTab = React.lazy(() => import('./HistoricoClienteTab')); // NOVO V21.1
const LogisticaEntregaTab = React.lazy(() => import('./LogisticaEntregaTab'));
const FechamentoFinanceiroTab = React.lazy(() => import('./FechamentoFinanceiroTab'));
const ArquivosProjetosTab = React.lazy(() => import('./ArquivosProjetosTab'));
const AuditoriaAprovacaoTab = React.lazy(() => import('./AuditoriaAprovacaoTab'));
import AutomacaoFluxoPedido from './AutomacaoFluxoPedido';
import PedidoFooterAcoes from './pedido/PedidoFooterAcoes';
import { pedidoCompletoSchema } from './pedido/pedidoSchema';
import { getDefaultPedidoValues } from './pedido/pedidoDefaults';
import useTotais from './pedido/hooks/useTotais';
import usePedidoValidacoes from './pedido/hooks/usePedidoValidacoes';
import FormWrapper from "@/components/common/FormWrapper";
import PedidoTabsContainer from './pedido/PedidoTabsContainer';

/**
 * V21.1.2-R1 - Pedido Form Completo - PATCH OFICIAL
 * Modal agora SEMPRE max-w-[90vw] max-h-[95vh]
 * Todas as abas com scroll funcionando
 * Aba Histórico expandida com Top 20 produtos + Auditoria
 * Suporte multi-instância (múltiplos modais abertos)
 * 
 * REGRA-MÃE: NUNCA APAGAR - APENAS ACRESCENTAR
 */
function PedidoFormCompleto({ pedido, clientes = [], onSubmit, onCancel, windowMode = false, contexto = 'erp', criacaoManual = true }) {
  const [activeTab, setActiveTab] = useState('identificacao');
  const [salvando, setSalvando] = useState(false); // V21.5: Anti-duplicação
  
  // V21.6 FINAL: Hook de detecção AUTOMÁTICA OBRIGATÓRIA
  const { origemPedido, bloquearEdicao } = useOrigemPedido();
  const { user } = useUser();
  const { carimbarContexto, createInContext, empresaAtual, grupoAtual } = useContextoVisual();
  
  const defaultValues = { ...getDefaultPedidoValues(pedido), ...(pedido || {}) };

  const [formData, setFormData] = useState(defaultValues);

  // RHF + Zod (Etapa 2)
  const { handleSubmit: rhfHandleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(pedidoCompletoSchema),
    defaultValues
  });

  useEffect(() => { reset(formData); }, [formData, reset]);
  
  // V21.6 FINAL: SEMPRE aplicar origem detectada automaticamente
  useEffect(() => {
    if (origemPedido) {
      setFormData(prev => ({ ...prev, origem_pedido: origemPedido }));
      console.log('Origem automatica aplicada:', origemPedido, '| Bloqueado:', bloquearEdicao);
    }
  }, [origemPedido, bloquearEdicao]);

  const [validacoes, setValidacoes] = useState({
    identificacao: false,
    itens: false,
    logistica: false,
    financeiro: false
  });

  // Calcular progresso
  useEffect(() => {
    const etapasCompletas = Object.values(validacoes).filter(Boolean).length;
    const progresso = (etapasCompletas / 4) * 100;
    setFormData(prev => ({ ...prev, percentual_conclusao_wizard: progresso }));
  }, [validacoes]);

  usePedidoValidacoes(formData, setValidacoes);

  useTotais(formData, setFormData);

    const auditPedidoForm = async (acao, detalhes = {}, sucesso = true) => {
      const empresaId = formData?.empresa_id || empresaAtual?.id || null;
      const groupId = formData?.group_id || formData?.grupo_id || grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
      try {
        await createInContext("AuditLog", {
          usuario_id: user?.id || null,
          usuario: user?.full_name || user?.email || 'Sistema',
          acao,
          modulo: 'Comercial/PedidoFormCompleto',
          tipo_auditoria: sucesso ? 'operacional' : 'seguranca',
          entidade: detalhes.entidade || 'Pedido',
          registro_id: formData?.id || null,
          descricao: detalhes.descricao || acao,
          empresa_id: empresaId,
          group_id: groupId,
          grupo_id: groupId,
          sucesso,
          detalhes: { origem: 'PedidoFormCompleto', pedido_id: formData?.id || null, numero_pedido: formData?.numero_pedido || null, ...detalhes },
          data_hora: new Date().toISOString(),
        });
      } catch (error) {
        console.warn('Falha ao auditar pedido completo:', error);
      }
    };

    const canSolicitarAprovacao = (formData?.status_aprovacao !== 'aprovado') && (validacoes.identificacao && validacoes.itens);

    const solicitarAprovacao = async () => {
      try {
        const { data: solicitacao } = await base44.functions.invoke('solicitacoesAprovacao', {
          action: 'create',
          group_id: formData.group_id || null,
          empresa_id: formData.empresa_id || null,
          tipo_solicitacao: 'pedido_aprovacao',
          entidade_alvo: 'Pedido',
          entidade_alvo_id: formData.id || `temp_${Date.now()}`,
          dados_propostos: { status_aprovacao: 'pendente', status: 'Aguardando Aprovação' },
          justificativa: formData.justificativa_desconto || 'Solicitação de aprovação do pedido'
        });
        await auditPedidoForm('pedido_aprovacao_solicitada', { solicitacao_id: solicitacao?.id || null, status_aprovacao: 'pendente' }, true);
      } catch (e) {
        await auditPedidoForm('pedido_aprovacao_solicitacao_falhou', { erro: e?.message || 'falha_ao_solicitar_aprovacao' }, false);
      }
    };

    const handleSubmit = async () => {
    if (!formData || salvando) return;
    
    if (!validacoes.identificacao) {
      toast.error('Erro: Complete os dados de identificação');
      setActiveTab('identificacao');
      return;
    }

    if (!validacoes.itens) {
      toast.error('Erro: Adicione pelo menos um item ao pedido');
      setActiveTab('revenda');
      return;
    }

    // Validação avançada (Etapa 2) + carimbo multiempresa
    const stamped = carimbarContexto(formData, 'empresa_id');
    const parsed = pedidoCompletoSchema.safeParse(stamped);
    if (!parsed.success) {
      const msg = parsed.error.issues.map(i => `• ${i.message}`).join('\n');
      toast.error('Erro: Erros de validação', { description: msg });
      return;
    }
    const empresaId = parsed.data.empresa_id || formData.empresa_id;

    setSalvando(true);

    try {
      // V21.5: BAIXAR ESTOQUE SE STATUS FOR APROVADO (migrado para função backend)
      if (formData.status === 'Aprovado' && formData.itens_revenda?.length > 0) {
        await base44.functions.invoke('applyOrderStockMovements', {
          pedido: carimbarContexto(formData, 'empresa_id')
        });
        toast.success('Pedido salvo e estoque baixado!');
      }
      
      // ETAPA 4: Validar aprovação de desconto
      if (formData.desconto_geral_pedido_percentual > 0) {
        const custoTotal = formData.valor_produtos * 0.7;
        const valorComDesconto = formData.valor_produtos * (1 - formData.desconto_geral_pedido_percentual / 100);
        const margemAposDesconto = ((valorComDesconto - custoTotal) / custoTotal) * 100;
        const margemMinima = 10;

        if (margemAposDesconto < margemMinima && formData.status !== 'Aprovado') {
          // Cria solicitação de aprovação de desconto (backend)
          try {
            const { data: solicitacao } = await base44.functions.invoke('solicitacoesAprovacao', {
              action: 'create',
              group_id: formData.group_id || null,
              empresa_id: formData.empresa_id || null,
              tipo_solicitacao: 'desconto_pedido',
              entidade_alvo: 'Pedido',
              entidade_alvo_id: formData.id || `temp_${Date.now()}`,
              dados_propostos: {
                desconto_geral_pedido_percentual: formData.desconto_geral_pedido_percentual,
                desconto_geral_pedido_valor: formData.desconto_geral_pedido_valor || 0,
                margem_aplicada_vendedor: margemAposDesconto,
                margem_minima_produto: margemMinima
              },
              justificativa: formData.justificativa_desconto || 'Ajuste comercial abaixo da margem mínima'
            });
            toast.info('Aviso: Solicitação de aprovação enviada', { description: `#${solicitacao?.id || ''}` });
          } catch (e) {
            toast.error('Não foi possível abrir a solicitação de aprovação');
          }

          // Mantém o pedido aguardando aprovação e salva rascunho
          await onSubmit(carimbarContexto({
            ...formData,
            status_aprovacao: 'pendente',
            margem_minima_produto: margemMinima,
            margem_aplicada_vendedor: margemAposDesconto,
            desconto_solicitado_percentual: formData.desconto_geral_pedido_percentual,
            status: 'Aguardando Aprovação'
          }, 'empresa_id'));
          return;
        }
      }

      await onSubmit(carimbarContexto(formData, 'empresa_id'));
    } finally {
      setSalvando(false);
    }
  };


  const abas = [
    { 
      id: 'identificacao', 
      label: 'Identificação', 
      icon: User, 
      valido: validacoes.identificacao 
    },
    { 
      id: 'revenda', 
      label: 'Itens Revenda', 
      icon: Package, 
      count: formData?.itens_revenda?.length || 0 
    },
    { 
      id: 'armado', 
      label: 'Armado Padrão', 
      icon: Factory, 
      count: formData?.itens_armado_padrao?.length || 0 
    },
    { 
      id: 'corte', 
      label: 'Corte e Dobra', 
      icon: Scissors, 
      count: formData?.itens_corte_dobra?.length || 0 
    },
    { 
      id: 'historico', // NOVO V21.1
      label: 'Histórico', 
      icon: Clock,
      novo: true
    },
    { 
      id: 'logistica', 
      label: 'Logística', 
      icon: Truck, 
      valido: validacoes.logistica,
      count: formData?.etapas_entrega?.length || 0
    },
    { 
      id: 'financeiro', 
      label: 'Financeiro', 
      icon: DollarSign, 
      valido: validacoes.financeiro 
    },
    { 
      id: 'arquivos', 
      label: 'Arquivos', 
      icon: FileText, 
      count: formData?.projetos_ia?.length || 0 
    },
    { 
      id: 'auditoria', 
      label: 'Auditoria', 
      icon: Shield 
    }
  ];

  // Proteção adicional: não renderizar até formData estar pronto
  if (!formData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const statusTransferFooter = ['Pronto para Faturar','Em Expedição','Em Trânsito'];
  const isFaturadoFooter = formData?.status === 'Faturado';
  const isTransferidoFooter = statusTransferFooter.includes(formData?.status);
  const isLockedFooter = isFaturadoFooter || (isTransferidoFooter && !formData?.__liberado_gerencia);

  const content = (
    <FormWrapper schema={pedidoCompletoSchema} defaultValues={formData} externalData={formData} onSubmit={rhfHandleSubmit(handleSubmit)} className="w-full h-full">
      <div className="w-full h-full flex flex-col bg-white">
      {/* Header - FIXO */}
      <PedidoHeader formData={formData} pedido={pedido} />

      {/* Tabs - FIXO (extraído para componente) */}
      <PedidoTabsContainer
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        formData={formData}
        setFormData={setFormData}
        clientes={clientes}
        bloquearEdicao={bloquearEdicao}
        validacoes={validacoes}
        errors={errors}
        pedido={pedido}
      />

      {/* Footer com Ações - FIXO */}
      <PedidoFooterAcoes
          valorTotal={formData?.valor_total || 0}
          pesoTotalKg={formData?.peso_total_kg || 0}
          etapasCount={formData?.etapas_entrega?.length || 0}
          salvando={salvando}
          canSalvarRascunho={!isLockedFooter && (validacoes.identificacao && validacoes.itens)}
          canFecharCompleto={!isLockedFooter && (validacoes.identificacao && validacoes.itens)}
          canFecharEnviarEntrega={!isLockedFooter && (validacoes.identificacao && validacoes.itens)}
          canSalvarAlteracoes={!isLockedFooter && (validacoes.identificacao && validacoes.itens)}
          canCriarPedido={!isLockedFooter && (validacoes.identificacao && validacoes.itens)}
          canSolicitarAprovacao={!isLockedFooter && canSolicitarAprovacao}
          onSolicitarAprovacao={solicitarAprovacao}
          onCancelar={onCancel}
          onSalvarRascunho={async () => {
           if (salvando) return;
           setSalvando(true);
           try {
             const stamped = carimbarContexto({ ...formData, status: 'Rascunho' }, 'empresa_id');
             const parsed = pedidoCompletoSchema.safeParse(stamped);
             if (!parsed.success) {
               const msg = parsed.error.issues.map(i => `• ${i.message}`).join('\n');
               toast.error('Erro: Erros de validação', { description: msg });
               return;
             }
             await onSubmit(parsed.data);
             toast.success('Rascunho salvo!');
             onCancel();
           } finally { setSalvando(false); }
         }}
         onFecharCompleto={async () => {
           if (salvando) return;
           setSalvando(true);
           try {
             const stamped = carimbarContexto({ ...formData, status: 'Aprovado' }, 'empresa_id');
             const parsed = pedidoCompletoSchema.safeParse(stamped);
             if (!parsed.success) {
               const msg = parsed.error.issues.map(i => `• ${i.message}`).join('\n');
               toast.error('Erro: Erros de validação', { description: msg });
               setSalvando(false);
               return;
             }
             const pedidoSalvo = await onSubmit(parsed.data);
             setSalvando(false);
             onCancel();
             setTimeout(() => {
               if (window.__currentOpenWindow) {
                 window.__currentOpenWindow(
                   AutomacaoFluxoPedido,
                   { pedido: pedidoSalvo || { ...formData, id: formData.id, status: 'Aprovado' }, windowMode: true },
                   { title: `Automação - Pedido ${formData.numero_pedido}`, width: 1200, height: 700 }
                 );
               }
             }, 150);
           } catch (e) { setSalvando(false); toast.error('Erro: Erro ao salvar pedido'); }
         }}
         onFecharEnviarEntrega={async () => {
           if (salvando) return;
           setSalvando(true);
           try {
             const stamped = carimbarContexto({ ...formData, status: 'Pronto para Faturar' }, 'empresa_id');
             const parsed = pedidoCompletoSchema.safeParse(stamped);
             if (!parsed.success) {
               const msg = parsed.error.issues.map(i => `• ${i.message}`).join('\n');
               toast.error('Erro: Erros de validação', { description: msg });
             } else {
               await onSubmit(parsed.data);
               toast.success('Pedido fechado e pronto para faturar!');
             }
           } finally { setSalvando(false); }
         }}
         onSalvarAlteracoes={async () => {
           if (salvando) return;
           setSalvando(true);
           try { await onSubmit(carimbarContexto(formData, 'empresa_id')); toast.success('Alterações salvas!'); onCancel(); }
           finally { setSalvando(false); }
         }}
         onCriarPedido={rhfHandleSubmit(handleSubmit)}
       />

      {/* Legacy footer removed and replaced by component */}
      <div className="hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <p className="text-slate-600">Valor Total</p>
              <p className="text-2xl font-bold text-green-600">
                R$ {(formData?.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-sm">
              <p className="text-slate-600">Peso Total</p>
              <p className="text-xl font-bold text-blue-600">
                {(formData?.peso_total_kg || 0).toFixed(2)} kg
              </p>
            </div>
            {/* NOVO V21.1: Etapas */}
            {formData?.etapas_entrega?.length > 0 && (
              <div className="text-sm">
                <p className="text-slate-600">Etapas de Faturamento</p>
                <p className="text-xl font-bold text-purple-600">
                  {formData.etapas_entrega.length}
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onCancel}
            >
              Cancelar
            </Button>
            
            {/* V21.6: SALVAR COMO RASCUNHO */}
            {(!pedido || pedido.status === 'Rascunho') && (
              <Button
                variant="outline"
                onClick={async () => {
                  if (salvando) return;
                  setSalvando(true);
                  try {
                    const stamped = carimbarContexto({ ...formData, status: 'Rascunho' }, 'empresa_id');
                    const parsed = pedidoCompletoSchema.safeParse(stamped);
                    if (!parsed.success) {
                      const msg = parsed.error.issues.map(i => `• ${i.message}`).join('\n');
                      toast.error('Erro: Erros de validação', { description: msg });
                      return;
                    }
                    await onSubmit(parsed.data);
                    toast.success('Rascunho salvo!');
                    onCancel();
                  } catch (error) {
                    toast.error('Erro: Erro ao salvar');
                  } finally {
                    setSalvando(false);
                  }
                }}
                disabled={salvando || !validacoes.identificacao || !validacoes.itens}
              >
                {salvando ? 'Salvando...' : 'Salvar Rascunho'}
              </Button>
            )}

            {/* V21.6: FECHAR PEDIDO COM AUTOMAÇÃO COMPLETA */}
            {(!pedido || pedido.status === 'Rascunho') && (
              <Button
                onClick={async () => {
                  if (salvando) return;

                  setSalvando(true);
                  try {
                    // 1. Validar e salvar pedido como Aprovado
                    const stamped = carimbarContexto({ ...formData, status: 'Aprovado' }, 'empresa_id');
                    const parsed = pedidoCompletoSchema.safeParse(stamped);
                    if (!parsed.success) {
                      const msg = parsed.error.issues.map(i => `• ${i.message}`).join('\n');
                      toast.error('Erro: Erros de validação', { description: msg });
                      setSalvando(false);
                      return;
                    }
                    const pedidoSalvo = await onSubmit(parsed.data);

                    setSalvando(false);

                    // 2. Fechar modal atual
                    onCancel();

                    // 3. Aguardar modal fechar e abrir automação
                    setTimeout(() => {
                      if (window.__currentOpenWindow) {
                        window.__currentOpenWindow(
                          AutomacaoFluxoPedido,
                          { 
                            pedido: pedidoSalvo || { ...formData, id: formData.id, status: 'Aprovado' },
                            windowMode: true,
                            onComplete: () => {
                              toast.success('Pedido fechado com sucesso!');
                            }
                          },
                          {
                            title: `Automação - Pedido ${formData.numero_pedido}`,
                            width: 1200,
                            height: 700
                          }
                        );
                      }
                    }, 150);
                  } catch (error) {
                    setSalvando(false);
                    toast.error('Erro: Erro ao salvar pedido');
                  }
                }}
                className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 shadow-lg"
                disabled={salvando || !validacoes.identificacao || !validacoes.itens}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {salvando ? 'Salvando...' : 'Fechar Pedido Completo'}
              </Button>
            )}
            
            {/* V21.5: FECHAR PEDIDO E ENVIAR PARA ENTREGA */}
            {pedido && pedido.status === 'Aprovado' && (
              <Button
                onClick={async () => {
                  if (salvando) return;
                  setSalvando(true);
                  try {
                    const stamped = carimbarContexto({ ...formData, status: 'Pronto para Faturar' }, 'empresa_id');
                    const parsed = pedidoCompletoSchema.safeParse(stamped);
                    if (!parsed.success) {
                      const msg = parsed.error.issues.map(i => `• ${i.message}`).join('\n');
                      toast.error('Erro: Erros de validação', { description: msg });
                    } else {
                      await onSubmit(parsed.data);
                      toast.success('Pedido fechado e pronto para faturar!');
                    }
                  } catch (error) {
                    toast.error('Erro: Erro ao fechar pedido');
                  } finally {
                    setSalvando(false);
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 shadow-lg"
                disabled={salvando || !validacoes.identificacao || !validacoes.itens}
              >
                <Truck className="w-4 h-4 mr-2" />
                {salvando ? 'Fechando...' : 'Fechar e Enviar para Entrega'}
              </Button>
            )}
            
            {(pedido && pedido.status !== 'Rascunho' && pedido.status !== 'Aprovado') && (
              <Button
                onClick={async () => {
                  if (salvando) return;
                  setSalvando(true);
                  try {
                    await onSubmit(carimbarContexto(formData, 'empresa_id'));
                    toast.success('Alterações salvas!');
                    onCancel();
                  } catch (error) {
                    toast.error('Erro: Erro ao salvar');
                  } finally {
                    setSalvando(false);
                  }
                }}
                className="bg-slate-600 hover:bg-slate-700"
                disabled={salvando || !validacoes.identificacao || !validacoes.itens}
              >
                <Check className="w-4 h-4 mr-2" />
                {salvando ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            )}
            
            {!pedido && (
              <Button
                onClick={rhfHandleSubmit(handleSubmit)}
                className="bg-blue-600 hover:bg-blue-700"
                disabled={salvando || !validacoes.identificacao || !validacoes.itens}
              >
                <Check className="w-4 h-4 mr-2" />
                {salvando ? 'Salvando...' : 'Criar Pedido'}
              </Button>
            )}
          </div>
        </div>

        <PedidoValidationAlerts errors={errors} validacoes={validacoes} />
      </div>
    </div>
  </FormWrapper>
  );

  if (windowMode) {
    return content;
  }

  return content;
}
export default React.memo(PedidoFormCompleto);
