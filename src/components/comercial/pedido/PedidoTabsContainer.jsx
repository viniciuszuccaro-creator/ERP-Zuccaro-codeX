import React, { Suspense, useEffect, useState } from 'react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import PedidoTabsNav from './PedidoTabsNav';
import ProtectedSection from '@/components/security/ProtectedSection';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import useContextoVisual from '@/components/lib/useContextoVisual';
import { useUser } from '@/components/lib/UserContext';

// Lazy-loaded tabs (keep same split as original)
const WizardEtapa1Cliente = React.lazy(() => import('../wizard/WizardEtapa1Cliente'));
const ItensRevendaTab = React.lazy(() => import('../ItensRevendaTab'));
const ArmadoPadraoTab = React.lazy(() => import('../ArmadoPadraoTab'));
const CorteDobraIATab = React.lazy(() => import('../CorteDobraIATab'));
const HistoricoClienteTab = React.lazy(() => import('../HistoricoClienteTab'));
const LogisticaEntregaTab = React.lazy(() => import('../LogisticaEntregaTab'));
const FechamentoFinanceiroTab = React.lazy(() => import('../FechamentoFinanceiroTab'));
const ArquivosProjetosTab = React.lazy(() => import('../ArquivosProjetosTab'));
const AuditoriaAprovacaoTab = React.lazy(() => import('../AuditoriaAprovacaoTab'));

export default function PedidoTabsContainer({
  activeTab,
  setActiveTab,
  formData,
  setFormData,
  clientes,
  bloquearEdicao,
  validacoes,
  errors,
  pedido,
}) {
  const { user } = useUser();
  const { createInContext, filterInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const abas = [
    { id: 'identificacao', label: 'Identificação', icon: null, valido: validacoes?.identificacao },
    { id: 'revenda', label: 'Itens Revenda', icon: null, count: formData?.itens_revenda?.length || 0 },
    { id: 'armado', label: 'Armado Padrão', icon: null, count: formData?.itens_armado_padrao?.length || 0 },
    { id: 'corte', label: 'Corte e Dobra', icon: null, count: formData?.itens_corte_dobra?.length || 0 },
    { id: 'historico', label: 'Histórico', icon: null, novo: true },
    { id: 'logistica', label: 'Logística', icon: null, valido: validacoes?.logistica, count: formData?.etapas_entrega?.length || 0 },
    { id: 'financeiro', label: 'Financeiro', icon: null, valido: validacoes?.financeiro },
    { id: 'arquivos', label: 'Arquivos', icon: null, count: formData?.projetos_ia?.length || 0 },
    { id: 'auditoria', label: 'Auditoria', icon: null },
  ];

  const [conformidade, setConformidade] = useState({ ok: false, motivos: [] });

  const auditTabsPedido = async (acao, detalhes = {}, sucesso = true) => {
    const empresaId = formData?.empresa_id || empresaAtual?.id || null;
    const groupId = formData?.group_id || formData?.grupo_id || grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
    try {
      await createInContext("AuditLog", {
        usuario_id: user?.id || null,
        usuario: user?.full_name || user?.email || 'Sistema',
        acao,
        modulo: 'Comercial/PedidoTabsContainer',
        tipo_auditoria: sucesso ? 'operacional' : 'seguranca',
        entidade: detalhes.entidade || 'Pedido',
        registro_id: pedido?.id || formData?.id || null,
        descricao: detalhes.descricao || acao,
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId,
        sucesso,
        detalhes: { origem: 'PedidoTabsContainer', pedido_id: pedido?.id || formData?.id || null, numero_pedido: formData?.numero_pedido || null, ...detalhes },
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('Falha ao auditar abas do pedido:', error);
    }
  };

  useEffect(() => {
    let cancel = false;
    const run = async () => {
      let ok = true;
      const motivos = [];
      try {
        if (formData?.cliente_id) {
          const cli = await filterInContext('Cliente', { id: formData.cliente_id });
          const c = Array.isArray(cli) ? cli[0] : null;
          const limite = c?.condicao_comercial?.limite_credito || 0;
          if (limite > 0 && (Number(formData?.valor_total) || 0) > limite) {
            ok = false; motivos.push('Estouro de limite de crédito');
          }
          const atrasados = await filterInContext('ContaReceber', { cliente_id: formData.cliente_id, status: 'Atrasado' });
          if (Array.isArray(atrasados) && atrasados.length > 0) {
            ok = false; motivos.push('Cliente com títulos em atraso');
          }
        }
        try {
          if (pedido?.id) {
            const res = await base44.functions.invoke('iaFinanceAnomalyScan', { pedido_id: pedido.id });
            if (res?.data?.anomaly === true) { ok = false; motivos.push('Anomalia financeira (IA)'); }
          }
        } catch {}
      } catch {}
      if (!cancel) setConformidade({ ok, motivos });
    };
    run();
    return () => { cancel = true; };
  }, [formData?.cliente_id, formData?.valor_total, formData?.forma_pagamento, pedido?.id]);

  const statusTransfer = ['Pronto para Faturar','Em Expedição','Em Trânsito'];
  const isFaturado = formData?.status === 'Faturado';
  const isTransferido = statusTransfer.includes(formData?.status);
  const isStatusBloqueado = isFaturado || isTransferido;
  const precisaBloqueioFinanceiro = !conformidade.ok;

  const podeLiberarVendedor = !isStatusBloqueado && conformidade.ok && formData?.forma_pagamento === 'À Vista';

  const liberarEdicaoVendedor = async () => {
    setFormData(prev => ({ ...prev, __liberado_vendedor: true }));
    await auditTabsPedido('pedido_edicao_liberada_vendedor', { motivo: 'conformidade_e_pagamento_a_vista' }, true);
    toast.success('Edição liberada (vendedor)');
  };

  const isLocked = isFaturado
    ? true
    : isTransferido
      ? !formData?.__liberado_gerencia
      : (precisaBloqueioFinanceiro && !(formData?.__liberado_gerencia || formData?.__liberado_vendedor));

  const solicitarLiberacao = async () => {
    try {
      await base44.functions.invoke('solicitacoesAprovacao', { tipo: 'pedido_edicao_em_transito', entidade: 'Pedido', entidade_id: pedido?.id });
      await auditTabsPedido('pedido_edicao_liberacao_solicitada', { motivo: 'status_bloqueado', status: formData?.status }, true);
      toast.success('Solicitação enviada ao gerente');
    } catch (e) {
      await auditTabsPedido('pedido_edicao_liberacao_falhou', { motivo: 'falha_solicitacao', erro: e?.message || 'erro_desconhecido' }, false);
      toast.error('Falha ao solicitar liberação');
    }
  };

  const liberarEdicaoLocal = async () => {
    setFormData(prev => ({ ...prev, __liberado_gerencia: true }));
    await auditTabsPedido('pedido_edicao_liberada_gerencia', { motivo: 'liberacao_local_gerente', status: formData?.status }, true);
  };

   return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
      <PedidoTabsNav abas={abas} activeTab={activeTab} setActiveTab={setActiveTab} />

      {isLocked && (
        <div className="mx-6 mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 flex items-center justify-between">
          <span>
            {isFaturado ? 'Edição bloqueada (pedido faturado).' : isTransferido ? `Edição bloqueada para pedidos em ${formData?.status}.` : 'Edição bloqueada por restrição de crédito/pagamento.'}
          </span>
          <div className="flex gap-2">
            {isTransferido && (
              <button className="px-3 py-1 rounded bg-amber-600 text-white" onClick={solicitarLiberacao}>Pedir liberação</button>
            )}
            {isTransferido && (
              <ProtectedSection module="Comercial" action="aprovar" hideInstead>
                <button className="px-3 py-1 rounded bg-green-600 text-white" onClick={liberarEdicaoLocal}>Liberar Edição (Gerente)</button>
              </ProtectedSection>
            )}
            {!isStatusBloqueado && podeLiberarVendedor && (
              <ProtectedSection module="Comercial" action="editar" hideInstead>
                <button className="px-3 py-1 rounded bg-blue-600 text-white" onClick={liberarEdicaoVendedor}>Liberar Edição (Vendedor)</button>
              </ProtectedSection>
            )}
          </div>
        </div>
      )}

      <div className={`flex-1 overflow-hidden ${isLocked ? 'pointer-events-none opacity-60' : ''}`}>
        <TabsContent value="identificacao" className="h-full overflow-y-auto p-6 m-0">
          <Suspense fallback={<div className='h-40 rounded-md bg-slate-100 animate-pulse' />}>
            <WizardEtapa1Cliente
              formData={formData}
              setFormData={setFormData}
              clientes={clientes}
              onNext={() => setActiveTab('revenda')}
              bloquearOrigemEdicao={bloquearEdicao}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="revenda" className="h-full overflow-y-auto p-6 m-0">
          <Suspense fallback={<div className='h-40 rounded-md bg-slate-100 animate-pulse' />}>
            <ItensRevendaTab
              formData={formData}
              setFormData={setFormData}
              onNext={() => setActiveTab('armado')}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="armado" className="h-full overflow-y-auto p-6 m-0">
          <Suspense fallback={<div className='h-40 rounded-md bg-slate-100 animate-pulse' />}>
            <ArmadoPadraoTab
              formData={formData}
              setFormData={setFormData}
              empresaId={formData?.empresa_id}
              onNext={() => setActiveTab('corte')}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="corte" className="h-full overflow-y-auto p-6 m-0">
          <Suspense fallback={<div className='h-40 rounded-md bg-slate-100 animate-pulse' />}>
            <CorteDobraIATab
              formData={formData}
              setFormData={setFormData}
              empresaId={formData?.empresa_id}
              onNext={() => setActiveTab('historico')}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="historico" className="h-full overflow-y-auto p-6 m-0">
          <Suspense fallback={<div className='h-40 rounded-md bg-slate-100 animate-pulse' />}>
            <HistoricoClienteTab
              formData={formData}
              setFormData={setFormData}
              onAdicionarItemAoPedido={(produto) => {
                toast.success(`Produto ${produto.descricao} adicionado!`);
                setActiveTab('revenda');
              }}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="logistica" className="h-full overflow-y-auto p-6 m-0">
          <Suspense fallback={<div className='h-40 rounded-md bg-slate-100 animate-pulse' />}>
            <LogisticaEntregaTab
              formData={formData}
              setFormData={setFormData}
              clientes={clientes}
              onNext={() => setActiveTab('financeiro')}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="financeiro" className="h-full overflow-y-auto p-6 m-0">
          <ProtectedSection module="Comercial" section={"Pedido.Financeiro"} action="visualizar" fallback={<div className="text-sm text-slate-500">Acesso restrito ao financeiro.</div>}>
            <Suspense fallback={<div className='h-40 rounded-md bg-slate-100 animate-pulse' />}>
              <FechamentoFinanceiroTab
                formData={formData}
                setFormData={setFormData}
                onNext={() => setActiveTab('arquivos')}
              />
            </Suspense>
          </ProtectedSection>
        </TabsContent>

        <TabsContent value="arquivos" className="h-full overflow-y-auto p-6 m-0">
          <Suspense fallback={<div className='h-40 rounded-md bg-slate-100 animate-pulse' />}>
            <ArquivosProjetosTab
              formData={formData}
              setFormData={setFormData}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="auditoria" className="h-full overflow-y-auto p-6 m-0">
          <Suspense fallback={<div className='h-40 rounded-md bg-slate-100 animate-pulse' />}>
            <AuditoriaAprovacaoTab
              formData={formData}
              pedido={pedido}
            />
          </Suspense>
        </TabsContent>
      </div>
    </Tabs>
  );
}
