import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import PedidoTabsNav from './PedidoTabsNav';
import ProtectedSection from '@/components/security/ProtectedSection';
import HistoricoProdutosCliente from '@/components/comercial/HistoricoProdutosCliente';
import HistoricoComprasCliente from '@/components/comercial/HistoricoComprasCliente';
import SugestoesProdutos from '@/components/comercial/SugestoesProdutos';
import Top10ProdutosCliente from '@/components/comercial/Top10ProdutosCliente';
import AdicionarItemRevendaModal from '@/components/comercial/AdicionarItemRevendaModal';
import {
  buildHistoricoModalGeracao,
  buildSessionFingerprint,
  bumpSessionEpoch,
  pedidoItensBloqueadosPorStatus,
  pedidoVisualCompativel,
  pickTabelaPrecoExata,
  seedProdutoFromHistorico,
} from '@/components/comercial/historicoComprasClientePolicy';
import { base44 } from '@/api/base44Client';
import { readErpHttpSession } from '@/api/erpHttpSession';
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
  /** Propagado de PedidoFormCompleto — eleva modal Adicionar acima da janela WindowManager. */
  windowMode = false,
}) {
  const { user } = useUser();
  const { createInContext, filterInContext, empresaAtual, grupoAtual } = useContextoVisual();
  // filterInContext é recriado a cada render no contexto — ref evita ciclo no effect de tabela.
  const filterInContextRef = useRef(filterInContext);
  filterInContextRef.current = filterInContext;
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
  const [modalRevendaAberto, setModalRevendaAberto] = useState(false);
  const [produtoSeedHistorico, setProdutoSeedHistorico] = useState(null);
  const [modalHistoricoGeracao, setModalHistoricoGeracao] = useState(null);
  // Wizard preenche só tabela_preco_id/nome — resolve objeto+itens no contexto (≠ inventar preço).
  const [tabelaPrecoResolvida, setTabelaPrecoResolvida] = useState(null);
  const [tabelaPrecoItensResolvidos, setTabelaPrecoItensResolvidos] = useState([]);
  const confirmandoHistoricoRef = useRef(false);
  const sessionEpochRef = useRef(0);
  const sessionFpRef = useRef(null);
  /** Token da resolução em voo — PedidoA→B / ator / sessão descartam resposta tardia. */
  const tabelaResolveTokenRef = useRef('');

  // bloquearEdicao = trava de origem (sempre true); itens usam status do pedido.
  const itensBloqueados = pedidoItensBloqueadosPorStatus(formData);
  const onAdicionarHistorico = itensBloqueados ? undefined : abrirAdicionarDoHistorico;

  const clientePedido =
    (Array.isArray(clientes) ? clientes.find((c) => c?.id === formData?.cliente_id) : null)
    || (formData?.cliente_id ? { id: formData.cliente_id } : null);

  function idsContextoAtual() {
    return {
      pedidoId: formData?.id || pedido?.id || null,
      clienteId: formData?.cliente_id || null,
      pedidoEmpresaId: formData?.empresa_id || null,
      pedidoGroupId: formData?.group_id || formData?.grupo_id || null,
      visualEmpresaId: empresaAtual?.id || null,
      visualGroupId: grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null,
      actorId: user?.id || null,
    };
  }

  function readSessionFingerprintCanonical() {
    try {
      return buildSessionFingerprint(readErpHttpSession()?.token || null);
    } catch {
      return null;
    }
  }

  // Fingerprint no render — effect observa renew (deps). Abertura/confirm releem a sessão canônica.
  const sessionFingerprintObservado = readSessionFingerprintCanonical();

  // Resolve TabelaPreco + itens pelo ID exato do pedido (wizard só id/nome).
  // PedidoA→B / ator / contexto / sessão: deps + token — limpa sync; late de A não grava em B.
  useEffect(() => {
    let cancel = false;
    const pedidoId = formData?.id || pedido?.id || null;
    const tabelaId = formData?.tabela_preco_id || null;
    const actorId = user?.id || null;
    const resolveToken = [
      pedidoId || '',
      tabelaId || '',
      formData?.empresa_id || '',
      formData?.group_id || formData?.grupo_id || '',
      formData?.cliente_id || '',
      empresaAtual?.id || '',
      grupoAtual?.id || '',
      actorId || '',
      sessionFingerprintObservado || '',
    ].join('|');
    tabelaResolveTokenRef.current = resolveToken;

    const embutida = formData?.tabela_preco || null;
    const itensEmbutidos = Array.isArray(formData?.tabela_preco_itens) ? formData.tabela_preco_itens : null;
    const embutidaExata = pickTabelaPrecoExata(embutida ? [embutida] : [], tabelaId);

    // Fail-closed imediato: troca Pedido/ID/contexto não deixa tabela anterior confirmável.
    // Bail-out Object.is: null/[] já vazios não reagendam render (Codex P1 ciclo filterInContext).
    setTabelaPrecoResolvida((prev) => (prev == null ? prev : null));
    setTabelaPrecoItensResolvidos((prev) => (Array.isArray(prev) && prev.length === 0 ? prev : []));

    const aindaVigente = () => !cancel && tabelaResolveTokenRef.current === resolveToken;

    if (!tabelaId) {
      return () => { cancel = true; };
    }
    if (embutidaExata && itensEmbutidos && itensEmbutidos.length > 0) {
      const itensExatos = itensEmbutidos.filter(
        (i) => !i?.tabela_preco_id || String(i.tabela_preco_id) === String(tabelaId),
      );
      if (itensExatos.length > 0 && aindaVigente()) {
        setTabelaPrecoResolvida(embutidaExata);
        setTabelaPrecoItensResolvidos(itensExatos);
        return () => { cancel = true; };
      }
    }

    (async () => {
      try {
        const tabelas = await filterInContextRef.current('TabelaPreco', { id: tabelaId }, 'nome', 5);
        // Nunca tabelas[0]: resposta WRONG ≠ EXPECTED → null (não vira tabela escolhida).
        const tabela = pickTabelaPrecoExata(tabelas, tabelaId);
        if (!aindaVigente()) return;
        if (!tabela) {
          setTabelaPrecoResolvida((prev) => (prev == null ? prev : null));
          setTabelaPrecoItensResolvidos((prev) => (Array.isArray(prev) && prev.length === 0 ? prev : []));
          return;
        }
        const itens = await filterInContextRef.current(
          'TabelaPrecoItem',
          { tabela_preco_id: tabela.id },
          'produto_descricao',
          1000,
        );
        if (!aindaVigente()) return;
        const itensExatos = Array.isArray(itens)
          ? itens.filter((i) => !i?.tabela_preco_id || String(i.tabela_preco_id) === String(tabelaId))
          : [];
        setTabelaPrecoResolvida(tabela);
        setTabelaPrecoItensResolvidos(itensExatos);
      } catch (error) {
        console.error('[PedidoTabsContainer] Falha ao resolver tabela_preco_id', error);
        if (aindaVigente()) {
          setTabelaPrecoResolvida((prev) => (prev == null ? prev : null));
          setTabelaPrecoItensResolvidos((prev) => (Array.isArray(prev) && prev.length === 0 ? prev : []));
        }
      }
    })();
    return () => { cancel = true; };
  }, [
    formData?.id,
    pedido?.id,
    formData?.tabela_preco_id,
    formData?.tabela_preco,
    formData?.tabela_preco_itens,
    formData?.empresa_id,
    formData?.group_id,
    formData?.grupo_id,
    formData?.cliente_id,
    empresaAtual?.id,
    grupoAtual?.id,
    user?.id,
    sessionFingerprintObservado,
    // filterInContext NÃO entra nas deps — identidade instável (useContextoVisual); usa filterInContextRef.
  ]);

  function sessionEpochAtual() {
    // Sempre releia: filho (modal) pode mutar sem re-render do pai; sessão pode expirar.
    const fp = readSessionFingerprintCanonical();
    const next = bumpSessionEpoch(sessionEpochRef.current, sessionFpRef.current, fp);
    sessionEpochRef.current = next.epoch;
    sessionFpRef.current = next.fingerprint;
    return { epoch: next.epoch, fingerprint: next.fingerprint };
  }

  function geracaoHistoricoAtual() {
    const ids = idsContextoAtual();
    const sess = sessionEpochAtual();
    return buildHistoricoModalGeracao({
      ...ids,
      sessionKey: sess.fingerprint,
      sessionEpoch: sess.epoch,
    });
  }

  function fecharModalHistoricoObsoleto() {
    setModalRevendaAberto(false);
    setProdutoSeedHistorico(null);
    setModalHistoricoGeracao(null);
  }

  // Troca pedido/cliente/empresa/grupo/ator/visual/sessão com modal aberto → descarta seleção; preserva rascunho.
  // sessionFingerprintObservado nas deps: RenderB com token B captura B (epoch↑); volta A não rematch.
  useEffect(() => {
    if (!modalRevendaAberto || !modalHistoricoGeracao) return;
    if (geracaoHistoricoAtual() === modalHistoricoGeracao) return;
    fecharModalHistoricoObsoleto();
    toast.message('Contexto alterado — confirmação do histórico anterior cancelada.');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- geracao lida no corpo; fp de sessão nas deps
  }, [
    modalRevendaAberto,
    modalHistoricoGeracao,
    formData?.id,
    formData?.cliente_id,
    formData?.empresa_id,
    formData?.group_id,
    formData?.grupo_id,
    pedido?.id,
    empresaAtual?.id,
    grupoAtual?.id,
    user?.id,
    sessionFingerprintObservado,
  ]);

  function abrirAdicionarDoHistorico(produto) {
    if (pedidoItensBloqueadosPorStatus(formData)) {
      toast.error('Pedido bloqueado para edição de itens.');
      return;
    }
    const ids = idsContextoAtual();
    // Pedido e visual divergentes → não abrir (não misturar catálogo B no rascunho A).
    if (!pedidoVisualCompativel(ids)) {
      toast.error('Contexto visual diverge do pedido — alinhe empresa/grupo antes de adicionar.');
      return;
    }
    const seed = seedProdutoFromHistorico(produto);
    if (!seed) {
      toast.error('Produto sem identificação comprovada.');
      return;
    }
    const jaNoRascunho = (formData?.itens_revenda || []).some(
      (it) => String(it?.produto_id) === String(seed.id),
    );
    if (jaNoRascunho) {
      // Duplicidade legítima: avisa e reabre modal (não funde linhas automaticamente).
      toast.message('Produto já está no rascunho — confirme quantidade no modal.');
    }
    // Clique repetido: reabre o mesmo modal (não append direto).
    setModalHistoricoGeracao(geracaoHistoricoAtual());
    setProdutoSeedHistorico(seed);
    setModalRevendaAberto(true);
  }

  function confirmarItemRevendaDoHistorico(item) {
    if (confirmandoHistoricoRef.current) return;
    if (pedidoItensBloqueadosPorStatus(formData)) {
      toast.error('Pedido bloqueado para edição de itens.');
      return;
    }
    if (!pedidoVisualCompativel(idsContextoAtual())) {
      fecharModalHistoricoObsoleto();
      toast.error('Contexto visual diverge do pedido — item não foi inserido.');
      return;
    }
    // Modal obsoleto após troca de contexto/pedido/sessão: não inserir no rascunho novo.
    if (!modalHistoricoGeracao || geracaoHistoricoAtual() !== modalHistoricoGeracao) {
      fecharModalHistoricoObsoleto();
      toast.error('Contexto alterado — item do histórico anterior não foi inserido.');
      return;
    }
    if (!item?.produto_id) {
      toast.error('Item rejeitado: sem produto_id.');
      return;
    }
    // Preço ausente ≠ inventar 0 (zero comprovado chega como Number finito).
    if (item.preco_unitario == null || !Number.isFinite(Number(item.preco_unitario))) {
      toast.error('Item rejeitado: preço unitário não comprovado.');
      return;
    }
    confirmandoHistoricoRef.current = true;
    try {
      setFormData((prev) => {
        const atuais = Array.isArray(prev?.itens_revenda) ? prev.itens_revenda : [];
        return {
          ...prev,
          itens_revenda: [...atuais, item],
        };
      });
      fecharModalHistoricoObsoleto();
      // Sucesso = rascunho em memória aceito (≠ persistência banco).
      toast.success(`Produto ${item.descricao || item.produto_id} no rascunho`);
      setActiveTab('revenda');
    } finally {
      Promise.resolve().then(() => {
        confirmandoHistoricoRef.current = false;
      });
    }
  }

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
            const groupId = formData?.group_id || formData?.grupo_id || grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id;
            const empresaId = empresaAtual?.id || formData?.empresa_id;
            const res = await base44.functions.invoke('iaFinanceAnomalyScan', {
              agente: 'financeiro',
              filtros: {
                group_id: groupId,
                empresa_id: empresaId,
              },
              group_id: groupId,
              empresa_id: empresaId,
              pedido_id: pedido.id,
            });
            const details = res?.data?.details || [];
            const hasAnomaly = res?.data?.anomaly === true || (Array.isArray(details) && details.length > 0);
            if (hasAnomaly) {
              ok = false;
              motivos.push('Anomalia financeira sugerida pela IA (revisar antes de liberar)');
            }
          }
        } catch (error) {
          console.error('[PedidoTabsContainer] Falha no scan de anomalia financeira', error);
        }
      } catch (error) {
        ok = false;
        motivos.push('Nao foi possivel validar credito');
        console.error('[PedidoTabsContainer] Falha ao validar conformidade financeira', error);
      }
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

        <TabsContent value="historico" className="h-full overflow-y-auto p-6 m-0 space-y-4">
          {/* Capacidades #441/#442 montadas no consumidor Pedido — Adicionar muta itens_revenda. */}
          {formData?.cliente_id ? (
            <>
              <div data-action="pedido-historico-produtos" data-permission="Comercial.Pedido.visualizar">
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Histórico de Produtos</h3>
                <HistoricoProdutosCliente clienteId={formData.cliente_id} />
              </div>
              <div data-action="pedido-historico-compras" data-permission="Comercial.Pedido.visualizar">
                <HistoricoComprasCliente
                  clienteId={formData.cliente_id}
                  onAdicionarProduto={onAdicionarHistorico}
                />
              </div>
              <div data-action="pedido-sugestoes-historico" data-permission="Comercial.Pedido.visualizar">
                <SugestoesProdutos
                  clienteId={formData.cliente_id}
                  itensAtuais={formData?.itens_revenda || []}
                  onAdicionarProduto={onAdicionarHistorico}
                />
              </div>
              <div data-action="pedido-top10-produtos" data-permission="Comercial.Pedido.visualizar">
                <Top10ProdutosCliente
                  clienteId={formData.cliente_id}
                  onSelecionarProduto={onAdicionarHistorico}
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500" data-action="pedido-historico-produtos-sem-cliente">
              Selecione o cliente na Identificação para consultar o histórico de produtos.
            </p>
          )}
          <Suspense fallback={<div className='h-40 rounded-md bg-slate-100 animate-pulse' />}>
            <HistoricoClienteTab
              formData={formData}
              setFormData={setFormData}
              onAdicionarItemAoPedido={onAdicionarHistorico}
            />
          </Suspense>
          {modalRevendaAberto ? (
            <AdicionarItemRevendaModal
              isOpen={modalRevendaAberto}
              onClose={fecharModalHistoricoObsoleto}
              onAddItem={confirmarItemRevendaDoHistorico}
              cliente={clientePedido}
              tabelaPreco={tabelaPrecoResolvida}
              tabelaPrecoItens={tabelaPrecoItensResolvidos}
              produtoInicial={produtoSeedHistorico}
              hostWindowMode={Boolean(windowMode)}
            />
          ) : null}
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
