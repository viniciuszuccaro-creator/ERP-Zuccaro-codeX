import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import useContextoVisual from '@/components/lib/useContextoVisual';
import { mockCancelarNFe, mockEmitirNFe } from '@/components/integracoes/MockIntegracoes';
import { cancelarNFe, emitirNFe } from '@/components/lib/integracaoNFe';
import {
  assertCancelamentoNFe,
  assertEmissaoNFe,
  isProducaoAutorizada,
  isProvedorFiscalConfigurado,
  stampNotaFiscalSimulacao,
} from '@/components/lib/notaFiscalEmissaoPolicy';
import { isUsuarioPiloto } from '@/components/lib/pilotoOperacaoPolicy';
import usePermissions from '@/components/lib/usePermissions';
import { ImprimirDANFESimplificado } from '@/components/lib/impressao';
import usePersistedSort from '@/components/lib/usePersistedSort';
import useEntityListSorted from '@/components/lib/useEntityListSorted';
import useBackendPagination from '@/components/lib/useBackendPagination';
import { sanitizeOnWrite } from '@/components/lib/sanitizeOnWrite';
import { useUser } from '@/components/lib/UserContext';
import { assertFaturamentoDentroDoPedido } from '@/components/lib/pedidoFaturamentoPolicy';
import NotasFiscaisTabView from './notas-fiscais/NotasFiscaisTabView';
import {
  buildNotaFiscalScope,
  createInitialNotaFiscalForm,
  filterNotasFiscais,
  notaMatchesFiscalScope,
  resolveEmpresaEmitente,
  resolveSafeFiscalUrl,
  sanitizeFiscalText,
  stampFiscalContext,
  summarizeFiscalProviderResult,
  summarizeNotasFiscais,
} from './notas-fiscais/notasFiscaisTabPolicy';

/** @typedef {import('./notas-fiscais/notasFiscaisTabPolicy').NotaFiscalTabRecord} NotaFiscalTabRecord */
/** @typedef {import('./notas-fiscais/notasFiscaisTabPolicy').EmpresaFiscal} EmpresaFiscal */

/** @param {unknown} value @returns {Record<string, any>} */
function asRecord(value) {
  return value && typeof value === 'object' ? value : {};
}

/**
 * @param {{
 *  notasFiscais?: NotaFiscalTabRecord[], pedidos?: Array<Record<string, any>>,
 *  onCreateNFe?: (() => void)|null
 * }} props
 */
export default function NotasFiscaisTab({ notasFiscais = [], pedidos = [], onCreateNFe = null }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todas');
  const [tipoFilter, setTipoFilter] = useState('todas');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedNF, setSelectedNF] = useState(/** @type {NotaFiscalTabRecord|null} */ (null));
  const [viewingDetails, setViewingDetails] = useState(/** @type {NotaFiscalTabRecord|null} */ (null));
  const [selectedNotas, setSelectedNotas] = useState(/** @type {string[]} */ ([]));
  const [formData, setFormData] = useState(createInitialNotaFiscalForm);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const { empresaAtual, empresasDoGrupo = [], grupoAtual, contexto, createInContext, updateInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const fiscalScope = buildNotaFiscalScope({ groupId, empresaId, contexto });
  const contextoValido = fiscalScope.valid;
  const scopeInput = { groupId, empresaId, contexto, empresasDoGrupo };

  const hasFiscalPermission = (action) => hasPermission('Fiscal', 'NotaFiscal', action) || hasPermission('Fiscal', 'Notas Fiscais', action) || hasPermission('Fiscal', null, action);
  const canViewNota = hasFiscalPermission('visualizar');
  const canCreateNota = hasFiscalPermission('criar');
  const canEditNota = hasFiscalPermission('editar');
  const canCancelNota = hasFiscalPermission('cancelar');
  const canExportNota = hasFiscalPermission('exportar');
  const canPrintNota = hasFiscalPermission('imprimir') || canExportNota;
  const canDownloadDanfe = hasFiscalPermission('baixar_pdf') || canPrintNota;
  const canSendNota = hasFiscalPermission('emitir') || hasFiscalPermission('enviar');

  const { page, setPage, pageSize, setPageSize } = useBackendPagination('NotaFiscal', 20);
  const sortState = /** @type {[string, (value: string) => void, string, (value: string) => void]} */ (usePersistedSort('NotaFiscal', 'data_emissao', 'desc'));
  const [sortField, setSortField, sortDirection, setSortDirection] = sortState;
  const { data: notasBackend = [] } = useEntityListSorted('NotaFiscal', fiscalScope.filter, {
    sortField, sortDirection, page, pageSize, limit: pageSize, enabled: contextoValido && canViewNota,
  });
  const notasSource = notasFiscais.length ? notasFiscais : notasBackend;
  const notasList = /** @type {NotaFiscalTabRecord[]} */ (notasSource).filter((nota) => notaMatchesFiscalScope(nota, scopeInput));
  const filteredNotas = filterNotasFiscais(notasList, { searchTerm, statusFilter, tipoFilter });
  const totals = summarizeNotasFiscais(notasList);

  /** @param {string} actionEmpresaId @param {Record<string, any>} payload */
  const withFiscalContext = (actionEmpresaId, payload = {}) => stampFiscalContext(payload, groupId, actionEmpresaId);

  /** @param {string} acao @param {Record<string, any>} detalhes @param {boolean} sucesso */
  const auditFiscalComercial = async (acao, detalhes = {}, sucesso = true) => {
    try {
      const auditEmpresaId = detalhes.empresa_id || empresaId || null;
      await createInContext('AuditLog', {
        usuario_id: user?.id || null,
        usuario: user?.full_name || user?.email || 'Sistema',
        acao,
        modulo: 'Comercial/Fiscal',
        tipo_auditoria: sucesso ? 'operacional' : 'seguranca',
        entidade: detalhes.entidade || 'NotaFiscal',
        descricao: detalhes.descricao || acao,
        empresa_id: auditEmpresaId,
        group_id: groupId,
        grupo_id: groupId,
        sucesso,
        detalhes: { origem: 'NotasFiscaisTab', ...detalhes },
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Falha ao auditar nota fiscal comercial:', error);
      throw new Error('Auditoria obrigatoria falhou para nota fiscal.');
    }
  };

  /** @param {NotaFiscalTabRecord} nota */
  const assertNotaNoEscopo = (nota) => {
    if (!notaMatchesFiscalScope(nota, scopeInput)) throw new Error('NF-e fora do Grupo/Empresa autorizado.');
    return nota.empresa_id || nota.empresa_faturamento_id || '';
  };

  /** @param {NotaFiscalTabRecord} nota */
  const visualizarNotaSeguro = async (nota) => {
    if (!contextoValido || !canViewNota || !notaMatchesFiscalScope(nota, scopeInput)) {
      await auditFiscalComercial('nota_fiscal_visualizar_bloqueada', { motivo: !contextoValido ? 'contexto_obrigatorio' : 'escopo_ou_permissao', nota_id: nota?.id }, false);
      toast({ title: 'Sem contexto, escopo ou permissao para visualizar NF-e', variant: 'destructive' });
      return;
    }
    await auditFiscalComercial('nota_fiscal_visualizada', { nota_id: nota.id, empresa_id: nota.empresa_id });
    setViewingDetails(nota);
  };

  /** @param {NotaFiscalTabRecord} nota */
  const imprimirDanfeSeguro = async (nota) => {
    if (!contextoValido || !canPrintNota || !notaMatchesFiscalScope(nota, scopeInput)) {
      await auditFiscalComercial('nota_fiscal_imprimir_bloqueada', { motivo: 'contexto_escopo_ou_permissao', nota_id: nota?.id }, false);
      toast({ title: 'Sem contexto, escopo ou permissao para imprimir DANFE', variant: 'destructive' });
      return;
    }
    const empresa = resolveEmpresaEmitente(nota, scopeInput);
    await auditFiscalComercial('nota_fiscal_danfe_impressa', { nota_id: nota.id, empresa_id: empresa.id });
    ImprimirDANFESimplificado({ nfe: nota, empresa });
  };

  /** @param {NotaFiscalTabRecord} nota */
  const baixarDanfeSeguro = async (nota) => {
    const danfeUrl = resolveSafeFiscalUrl(nota?.danfe_url);
    const notaNoEscopo = notaMatchesFiscalScope(nota, scopeInput);
    if (!danfeUrl || !contextoValido || !canDownloadDanfe || !notaNoEscopo) {
      await auditFiscalComercial('nota_fiscal_danfe_bloqueada', { motivo: !danfeUrl ? 'url_invalida' : 'contexto_escopo_ou_permissao', nota_id: nota?.id }, false);
      toast({ title: !danfeUrl ? 'DANFE indisponivel' : 'Sem contexto, escopo ou permissao para baixar DANFE', variant: 'destructive' });
      return;
    }
    const notaEmpresaId = nota.empresa_id || nota.empresa_faturamento_id || '';
    await auditFiscalComercial('nota_fiscal_danfe_baixada', { nota_id: nota.id, empresa_id: notaEmpresaId });
    window.open(danfeUrl, '_blank', 'noopener,noreferrer');
  };

  /** @param {NotaFiscalTabRecord[]} lista */
  const exportarNotasSeguro = async (lista) => {
    const scoped = lista.filter((nota) => notaMatchesFiscalScope(nota, scopeInput));
    if (!contextoValido || !canExportNota || scoped.length !== lista.length) {
      await auditFiscalComercial('nota_fiscal_exportar_bloqueada', { motivo: 'contexto_escopo_ou_permissao', total: lista.length }, false);
      toast({ title: 'Sem contexto, escopo ou permissao para exportar NF-e', variant: 'destructive' });
      return;
    }
    if (!scoped.length) {
      toast({ title: 'Nenhuma NF-e selecionada para exportar' });
      return;
    }
    if (!window.confirm('Confirmar exportacao das NF-e selecionadas?')) {
      await auditFiscalComercial('nota_fiscal_exportacao_cancelada', { motivo: 'confirmacao_cancelada', total: scoped.length }, false);
      return;
    }
    const headers = ['numero', 'serie', 'tipo', 'cliente_fornecedor', 'empresa_id', 'data_emissao', 'valor_total', 'status'];
    const csv = [headers.join(','), ...scoped.map((nota) => headers.map((header) => JSON.stringify(nota[header] ?? '')).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `notas_fiscais_${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    await auditFiscalComercial('nota_fiscal_exportada', { total: scoped.length });
  };

  const criarNFeExternaSeguro = async () => {
    if (!contextoValido || !canCreateNota || !empresaId) {
      await auditFiscalComercial('nota_fiscal_criacao_externa_bloqueada', { motivo: !empresaId ? 'empresa_faturadora_obrigatoria' : 'contexto_ou_permissao' }, false);
      toast({ title: !empresaId ? 'Selecione a empresa faturadora' : 'Sem permissao para criar NF-e', variant: 'destructive' });
      return;
    }
    await auditFiscalComercial('nota_fiscal_criacao_externa_aberta', { empresa_id: empresaId, origem_fluxo: 'onCreateNFe' });
    onCreateNFe?.();
  };

  const invalidateNotas = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['notasfiscais'] }),
    queryClient.invalidateQueries({ queryKey: ['notasFiscais'] }),
    queryClient.invalidateQueries({ queryKey: ['entityListSorted', 'NotaFiscal'] }),
  ]);

  const createMutation = useMutation({
    /** @param {NotaFiscalTabRecord} data */
    mutationFn: async (data) => {
      if (!contextoValido || !canCreateNota || !empresaId) throw new Error('Selecione uma empresa faturadora e confirme permissao para criar NF-e.');
      if (data.pedido_id) {
        const pedido = pedidos.find((item) => String(item.id) === String(data.pedido_id));
        if (!pedido) throw new Error('Pedido obrigatorio para faturar.');
        assertFaturamentoDentroDoPedido({ pedido, notasExistentes: notasList.filter((nota) => String(nota.pedido_id) === String(data.pedido_id)), notaNova: data });
      }
      return createInContext('NotaFiscal', withFiscalContext(empresaId, data));
    },
    onError: (error) => toast({ title: error instanceof Error ? error.message : 'Falha ao criar Nota Fiscal', variant: 'destructive' }),
    onSuccess: async (result) => {
      const nota = asRecord(result);
      await auditFiscalComercial('nota_fiscal_criada', { nota_id: nota.id || null, empresa_id: empresaId });
      await invalidateNotas();
      closeForm();
      toast({ title: 'Nota Fiscal criada!' });
    },
  });

  const updateMutation = useMutation({
    /** @param {{id: string, data: NotaFiscalTabRecord}} input */
    mutationFn: async ({ id, data }) => {
      if (!contextoValido || !canEditNota || !selectedNF) throw new Error('Sem contexto ou permissao para editar NF-e.');
      const actionEmpresaId = assertNotaNoEscopo(selectedNF);
      return updateInContext('NotaFiscal', id, withFiscalContext(actionEmpresaId, data));
    },
    onError: (error) => toast({ title: error instanceof Error ? error.message : 'Falha ao atualizar Nota Fiscal', variant: 'destructive' }),
    onSuccess: async () => {
      await auditFiscalComercial('nota_fiscal_atualizada', { nota_id: selectedNF?.id || null, empresa_id: selectedNF?.empresa_id || null });
      await invalidateNotas();
      closeForm();
      toast({ title: 'Nota Fiscal atualizada!' });
    },
  });

  const enviarNFeMutation = useMutation({
    /** @param {NotaFiscalTabRecord} nfe */
    mutationFn: async (nfe) => {
      if (!contextoValido || !canSendNota) throw new Error('Sem contexto ou permissao para enviar NF-e.');
      if (nfe.status !== 'Pendente') throw new Error('Somente NF-e pendente pode ser enviada.');
      const empresaEmitente = resolveEmpresaEmitente(nfe, scopeInput);
      const emitenteId = String(empresaEmitente.id);
      const ambiente = nfe.ambiente || empresaEmitente.configuracao_fiscal?.ambiente_nfe || 'Homologacao';
      const check = assertEmissaoNFe({
        empresaId: emitenteId,
        ambiente,
        producaoAutorizada: isProducaoAutorizada(empresaEmitente.configuracao_fiscal?.autoriza_emissao_producao, empresaEmitente.integracao_nfe?.autoriza_emissao_producao),
        provedorConfigurado: isProvedorFiscalConfigurado(empresaEmitente.integracao_nfe || {}),
        nfe,
        usuarioPiloto: isUsuarioPiloto(user),
      });
      await auditFiscalComercial('nota_fiscal_envio_iniciado', { nota_id: nfe.id, empresa_id: emitenteId, ambiente: check.ambiente });
      let resultado;
      try {
        resultado = asRecord(check.permiteSimulacao
          ? await mockEmitirNFe({ empresa_id: emitenteId, pedido: nfe, ambiente: 'Homologacao' })
          : await emitirNFe({ ...nfe, ambiente: 'Producao' }, emitenteId));
      } catch (error) {
        await updateInContext('NotaFiscal', nfe.id, withFiscalContext(emitenteId, { status: 'Rejeitada', historico: [...(nfe.historico || []), { data_hora: new Date().toISOString(), evento: 'NF-e rejeitada', detalhes: error instanceof Error ? error.message : 'falha_emissao' }] }));
        throw error;
      }
      if (resultado.sucesso === false || resultado.success === false || resultado.error) {
        await updateInContext('NotaFiscal', nfe.id, withFiscalContext(emitenteId, { status: 'Rejeitada' }));
        throw new Error(String(resultado.error || 'Falha ao emitir NF-e.'));
      }
      const basePayload = withFiscalContext(emitenteId, {
        status: resultado.status || 'Autorizada', numero: nfe.numero || resultado.numero_nfe, serie: nfe.serie || resultado.serie,
        chave_acesso: resultado.chave_acesso, protocolo_autorizacao: resultado.protocolo, data_autorizacao: resultado.data_autorizacao,
        xml_url: resultado.xml_url, danfe_url: resultado.pdf_url,
        ambiente: check.permiteSimulacao ? 'Homologacao' : (resultado.ambiente || nfe.ambiente || 'Producao'),
        historico: [...(nfe.historico || []), { data_hora: new Date().toISOString(), evento: check.permiteSimulacao ? 'NF-e Enviada (Simulacao)' : 'NF-e Autorizada', usuario: user?.full_name || user?.email || 'Sistema' }],
      });
      const payloadAtualizacao = /** @type {Record<string, any>} */ (check.permiteSimulacao ? stampNotaFiscalSimulacao(basePayload, { origem_simulacao: 'nfe_homologacao' }) : { ...basePayload, simulacao: false, __simulado__: false });
      await updateInContext('NotaFiscal', nfe.id, payloadAtualizacao);
      await createInContext('LogFiscal', withFiscalContext(emitenteId, {
        nfe_id: nfe.id, numero_nfe: payloadAtualizacao.numero, data_hora: new Date().toISOString(), acao: 'enviar',
        provedor: check.permiteSimulacao ? 'Mock/Simulacao' : (resultado.provedor || 'IntegracaoNFe'), ambiente: payloadAtualizacao.ambiente,
        status: 'sucesso', retorno_recebido: summarizeFiscalProviderResult(resultado, check.permiteSimulacao), usuario_nome: user?.full_name || user?.email || 'Sistema',
      }));
      return /** @type {Record<string, any>} */ ({ ...resultado, permiteSimulacao: check.permiteSimulacao });
    },
    onError: (error) => toast({ title: error instanceof Error ? error.message : 'Falha ao enviar NF-e', variant: 'destructive' }),
    onSuccess: async (resultado, nfe) => {
      await auditFiscalComercial('nota_fiscal_enviada', { nota_id: nfe.id, empresa_id: nfe.empresa_id, simulacao: Boolean(resultado?.permiteSimulacao), possui_protocolo: Boolean(resultado?.protocolo) });
      await invalidateNotas();
      toast({ title: resultado?.permiteSimulacao ? 'NF-e enviada e autorizada (Simulacao)' : 'NF-e enviada e autorizada' });
    },
  });

  const cancelarNFeMutation = useMutation({
    /** @param {{nfe: NotaFiscalTabRecord, motivo: string}} input */
    mutationFn: async ({ nfe, motivo }) => {
      if (!contextoValido || !canCancelNota) throw new Error('Sem contexto ou permissao para cancelar NF-e.');
      const motivoSanitizado = sanitizeFiscalText(motivo);
      if (motivoSanitizado.length < 15) throw new Error('Justificativa de cancelamento deve ter ao menos 15 caracteres.');
      const empresaEmitente = resolveEmpresaEmitente(nfe, scopeInput);
      const emitenteId = String(empresaEmitente.id);
      const ambiente = nfe.ambiente || empresaEmitente.configuracao_fiscal?.ambiente_nfe || 'Homologacao';
      const check = assertCancelamentoNFe({
        empresaId: emitenteId, ambiente,
        producaoAutorizada: isProducaoAutorizada(empresaEmitente.configuracao_fiscal?.autoriza_emissao_producao, empresaEmitente.integracao_nfe?.autoriza_emissao_producao),
        provedorConfigurado: isProvedorFiscalConfigurado(empresaEmitente.integracao_nfe || {}), nfe,
      });
      await auditFiscalComercial('nota_fiscal_cancelamento_iniciado', { nota_id: nfe.id, empresa_id: emitenteId, ambiente: check.ambiente, simulacao: check.permiteSimulacao });
      const resultado = asRecord(check.permiteSimulacao
        ? await mockCancelarNFe({ nfe_id: nfe.id, chave_acesso: nfe.chave_acesso, motivo: motivoSanitizado })
        : await cancelarNFe(nfe.id, emitenteId, motivoSanitizado));
      if (resultado.sucesso === false || resultado.success === false || resultado.error) throw new Error(String(resultado.error || 'Falha ao cancelar NF-e.'));
      const baseCancelamento = withFiscalContext(emitenteId, {
        status: 'Cancelada',
        cancelamento: { data_cancelamento: resultado.data_cancelamento || new Date().toISOString(), protocolo_cancelamento: resultado.protocolo_cancelamento || resultado.protocolo, motivo: motivoSanitizado, justificativa: motivoSanitizado, usuario: user?.full_name || user?.email || 'Sistema' },
        xml_cancelamento: resultado.xml_cancelamento_url,
        historico: [...(nfe.historico || []), { data_hora: new Date().toISOString(), evento: check.permiteSimulacao ? 'NF-e Cancelada (Simulacao)' : 'NF-e Cancelada', usuario: user?.full_name || user?.email || 'Sistema', detalhes: motivoSanitizado }],
      });
      const payloadCancelamento = check.permiteSimulacao ? stampNotaFiscalSimulacao(baseCancelamento, { origem_simulacao: nfe.origem_simulacao || 'nfe_homologacao' }) : { ...baseCancelamento, simulacao: false, __simulado__: false };
      await updateInContext('NotaFiscal', nfe.id, payloadCancelamento);
      await createInContext('LogFiscal', withFiscalContext(emitenteId, {
        nfe_id: nfe.id, numero_nfe: nfe.numero, data_hora: new Date().toISOString(), acao: 'cancelar',
        provedor: check.permiteSimulacao ? 'Mock/Simulacao' : (resultado.provedor || 'IntegracaoNFe'), ambiente: check.ambiente,
        status: 'sucesso', retorno_recebido: summarizeFiscalProviderResult(resultado, check.permiteSimulacao), usuario_nome: user?.full_name || user?.email || 'Sistema',
      }));
      return { ...resultado, permiteSimulacao: check.permiteSimulacao };
    },
    onError: (error) => toast({ title: error instanceof Error ? error.message : 'Falha ao cancelar NF-e', variant: 'destructive' }),
    onSuccess: async (resultado, { nfe }) => {
      await auditFiscalComercial('nota_fiscal_cancelada', { nota_id: nfe.id, empresa_id: nfe.empresa_id, simulacao: Boolean(resultado?.permiteSimulacao) });
      await invalidateNotas();
      toast({ title: resultado?.permiteSimulacao ? 'NF-e Cancelada (Simulacao)' : 'NF-e Cancelada' });
    },
  });

  /** @param {import('react').FormEvent<HTMLFormElement>} event */
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!window.confirm(`Confirmar ${selectedNF ? 'atualizar' : 'criar'} esta Nota Fiscal?`)) {
      await auditFiscalComercial('nota_fiscal_salvar_cancelado', { motivo: 'confirmacao_cancelada', nota_id: selectedNF?.id || null }, false);
      return;
    }
    const payload = /** @type {NotaFiscalTabRecord} */ (sanitizeOnWrite({ ...formData, cliente_fornecedor: sanitizeFiscalText(formData.cliente_fornecedor), numero: sanitizeFiscalText(formData.numero), serie: sanitizeFiscalText(formData.serie), observacoes: sanitizeFiscalText(formData.observacoes) }));
    if (selectedNF?.id) updateMutation.mutate({ id: selectedNF.id, data: payload });
    else createMutation.mutate(payload);
  };

  /** @param {NotaFiscalTabRecord} nota */
  const handleEdit = async (nota) => {
    if (!contextoValido || !canEditNota || !notaMatchesFiscalScope(nota, scopeInput)) {
      await auditFiscalComercial('nota_fiscal_editar_bloqueada', { motivo: 'contexto_escopo_ou_permissao', nota_id: nota?.id }, false);
      toast({ title: 'Sem contexto, escopo ou permissao para editar NF-e', variant: 'destructive' });
      return;
    }
    await auditFiscalComercial('nota_fiscal_edicao_aberta', { nota_id: nota.id, empresa_id: nota.empresa_id });
    setSelectedNF(nota);
    setFormData(nota);
    setIsDialogOpen(true);
  };

  const closeForm = () => {
    setIsDialogOpen(false);
    setSelectedNF(null);
    setFormData(createInitialNotaFiscalForm());
  };

  /** @param {NotaFiscalTabRecord} nfe */
  const handleCancelarNFe = (nfe) => {
    const motivo = window.prompt('Digite o motivo do cancelamento:');
    if (!motivo) return;
    if (motivo.length < 15) {
      toast({ title: 'Motivo muito curto', description: 'O motivo deve ter pelo menos 15 caracteres', variant: 'destructive' });
      return;
    }
    if (window.confirm(`Confirmar cancelamento da NF-e ${nfe.numero || ''}?`)) cancelarNFeMutation.mutate({ nfe, motivo });
    else void auditFiscalComercial('nota_fiscal_cancelamento_cancelado', { motivo: 'confirmacao_cancelada', nota_id: nfe.id, empresa_id: nfe.empresa_id }, false);
  };

  /** @param {NotaFiscalTabRecord} nfe */
  const handleEnviarNFe = (nfe) => {
    if (window.confirm(`Confirmar envio da NF-e ${nfe.numero || ''}?`)) enviarNFeMutation.mutate(nfe);
    else void auditFiscalComercial('nota_fiscal_envio_cancelado', { motivo: 'confirmacao_cancelada', nota_id: nfe.id, empresa_id: nfe.empresa_id }, false);
  };

  const fecharDetalhesSeguro = async () => {
    await auditFiscalComercial('nota_fiscal_detalhes_fechados', { nota_id: viewingDetails?.id, empresa_id: viewingDetails?.empresa_id });
    setViewingDetails(null);
  };

  return <NotasFiscaisTabView
    notas={filteredNotas} totals={totals} searchTerm={searchTerm} statusFilter={statusFilter} tipoFilter={tipoFilter}
    setSearchTerm={setSearchTerm} setStatusFilter={setStatusFilter} setTipoFilter={setTipoFilter}
    contextoValido={contextoValido} empresaId={empresaId} canViewNota={canViewNota} canCreateNota={canCreateNota}
    canEditNota={canEditNota} canCancelNota={canCancelNota} canExportNota={canExportNota} canPrintNota={canPrintNota}
    canDownloadDanfe={canDownloadDanfe} canSendNota={canSendNota} onCreateNFe={onCreateNFe ? criarNFeExternaSeguro : null}
    isDialogOpen={isDialogOpen} onDialogOpenChange={(open) => open ? setIsDialogOpen(true) : closeForm()}
    selectedNF={selectedNF} formData={formData} setFormData={setFormData} onSubmit={handleSubmit}
    isSaving={createMutation.isPending || updateMutation.isPending} selectedNotas={selectedNotas} setSelectedNotas={setSelectedNotas}
    onExport={exportarNotasSeguro} onView={visualizarNotaSeguro} onEdit={handleEdit} onPrint={imprimirDanfeSeguro}
    onDownload={baixarDanfeSeguro} onSend={handleEnviarNFe} onCancelNFe={handleCancelarNFe}
    sending={enviarNFeMutation.isPending} cancelling={cancelarNFeMutation.isPending}
    viewingDetails={viewingDetails} onCloseDetails={fecharDetalhesSeguro}
    sortField={sortField} sortDirection={sortDirection} onSortChange={(field, direction) => { setSortField(field); setSortDirection(direction); }}
    page={page} pageSize={pageSize} totalItems={page * pageSize + (notasBackend.length < pageSize ? 0 : 1)}
    onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
  />;
}
