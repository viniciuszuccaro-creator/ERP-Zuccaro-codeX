import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';
import { useUser } from '@/components/lib/UserContext';
import { useToast } from '@/components/ui/use-toast';
import { toast as sonnerToast } from 'sonner';
import EntregaFormSections from './formulario-entrega/EntregaFormSections';
import {
  normalizeEntregaFormData,
  resolveEntregaContext,
  sanitizeEntregaPayload,
  sanitizePromptValue,
  summarizeGeolocationAudit,
  summarizePredictionAudit,
} from './formulario-entrega/entregaFormPolicy';

/** @typedef {import('./formulario-entrega/entregaFormPolicy').EntregaFormData} EntregaFormData */
/** @typedef {(next: EntregaFormData|((previous: EntregaFormData) => EntregaFormData)) => void} SetEntregaFormData */

/** @param {unknown} value @returns {Record<string, any>} */
function asRecord(value) {
  return value && typeof value === 'object' ? value : {};
}
/**
 * @param {{
 *  formData?: Partial<EntregaFormData>, setFormData?: SetEntregaFormData,
 *  onCancel?: () => void, clientes?: Array<Record<string, any>>,
 *  pedidos?: Array<Record<string, any>>, empresasDoGrupo?: Array<Record<string, any>>,
 *  estaNoGrupo?: boolean, isEditing?: boolean, isLoading?: boolean, windowMode?: boolean
 * }} props
 */
export default function FormularioEntrega({
  formData: formDataProp = {}, setFormData: setFormDataProp, onCancel = () => {},
  clientes = [], pedidos = [], empresasDoGrupo = [], estaNoGrupo = false,
  isEditing = false, isLoading = false, windowMode = false,
}) {
  const [formDataState, setFormDataState] = useState(() => normalizeEntregaFormData(formDataProp));
  const formData = normalizeEntregaFormData(setFormDataProp ? formDataProp : formDataState);
  /** @type {SetEntregaFormData} */
  const setFormData = (next) => {
    const setter = setFormDataProp || setFormDataState;
    if (typeof next === 'function') {
      setter((previous) => normalizeEntregaFormData(next(normalizeEntregaFormData(previous))));
    } else {
      setter(normalizeEntregaFormData(next));
    }
  };
  const [previsaoIA, setPrevisaoIA] = useState(/** @type {Record<string, any>|null} */ (null));
  const [calculandoPrevisao, setCalculandoPrevisao] = useState(false);
  const queryClient = useQueryClient();
  const { toast: toastHook } = useToast();
  const { user: authUser } = useUser();
  const { empresaAtual, grupoAtual, createInContext, updateInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();

  const { groupId, empresaId, empresaPertence, contextoValido } = resolveEntregaContext({
    grupoAtual, empresaAtual, empresaSelecionadaId: formData.empresa_id, empresasDoGrupo, estaNoGrupo,
  });
  const canCreateEntrega = hasPermission('Expedicao', 'Entrega', 'criar') || hasPermission('Expedicao', 'Entregas', 'criar');
  const canEditEntrega = hasPermission('Expedicao', 'Entrega', 'editar') || hasPermission('Expedicao', 'Entregas', 'editar');
  const canSaveEntrega = isEditing ? canEditEntrega : canCreateEntrega;

  /** @param {{acao: string, sucesso?: boolean, motivo?: string|null, dadosAnteriores?: object|null, dadosNovos?: object|null, registroId?: string|null}} input */
  const auditEntrega = async ({ acao, sucesso = true, motivo = null, dadosAnteriores = null, dadosNovos = null, registroId = null }) => {
    try {
      await base44.entities.AuditLog.create({
        acao, modulo: 'Expedicao', entidade: 'Entrega', registro_id: registroId,
        tipo_auditoria: sucesso ? 'operacional' : 'seguranca',
        usuario_id: authUser?.id || authUser?.email || null,
        usuario_nome: authUser?.full_name || authUser?.email || 'Sistema',
        group_id: groupId, grupo_id: groupId, empresa_id: empresaId,
        dados_anteriores: dadosAnteriores, dados_novos: dadosNovos,
        resultado: sucesso ? 'sucesso' : 'bloqueado', motivo, data_hora: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      console.error('[FormularioEntrega] Falha ao auditar operacao', error);
      sonnerToast.error('Nao foi possivel registrar a auditoria; verifique o servico.');
      return false;
    }
  };

  /** @param {string} acao @param {string} motivo @param {string} mensagem */
  const rejectAction = async (acao, motivo, mensagem) => {
    await auditEntrega({ acao, sucesso: false, motivo });
    sonnerToast.error(mensagem);
  };

  const calcularPrevisaoEntrega = async () => {
    if (!contextoValido || !canSaveEntrega) {
      await rejectAction('Entrega.previsao_ia.bloqueado', !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada', 'Contexto e permissao sao obrigatorios para calcular a previsao.');
      return;
    }
    if (!formData.endereco_entrega_completo.cidade) {
      sonnerToast.error('Preencha o endereco primeiro.');
      return;
    }
    setCalculandoPrevisao(true);
    try {
      const endereco = formData.endereco_entrega_completo;
      const resultado = asRecord(await base44.integrations.Core.InvokeLLM({
        prompt: `Calcule a previsao de entrega para:\nCidade: ${sanitizePromptValue(endereco.cidade)}\nEstado: ${sanitizePromptValue(endereco.estado)}\nPeso: ${Number(formData.peso_total_kg || 0)} kg\nPrioridade: ${sanitizePromptValue(formData.prioridade)}\nTipo Frete: ${sanitizePromptValue(formData.tipo_frete)}\n\nRetorne apenas uma sugestao em JSON com data_prevista, prazo_dias, horario_previsto e confianca_percentual.`,
        response_json_schema: { type: 'object', properties: { data_prevista: { type: 'string' }, prazo_dias: { type: 'number' }, horario_previsto: { type: 'string' }, confianca_percentual: { type: 'number' } } },
      }));
      await auditEntrega({ acao: 'Entrega.previsao_ia', dadosNovos: summarizePredictionAudit(resultado) });
      setPrevisaoIA(resultado);
      sonnerToast.success('Previsao sugerida pela IA. Confirme para aplicar no formulario.');
    } catch (error) {
      await auditEntrega({ acao: 'Entrega.previsao_ia.erro', sucesso: false, motivo: error instanceof Error ? error.message : 'erro_ia' });
      sonnerToast.error('Erro ao calcular previsao.');
    } finally {
      setCalculandoPrevisao(false);
    }
  };

  const aplicarPrevisaoIA = async () => {
    if (!previsaoIA?.data_prevista || !window.confirm('Aplicar a data prevista sugerida pela IA no formulario de entrega?')) return;
    setFormData((previous) => ({ ...previous, data_previsao: String(previsaoIA.data_prevista) }));
    await auditEntrega({ acao: 'Entrega.previsao_ia.aplicar', dadosNovos: { data_previsao_aplicada: true } });
    sonnerToast.success('Data prevista aplicada apos confirmacao.');
  };

  /** @param {EntregaFormData} data */
  const stampPayload = (data) => ({
    ...data, group_id: groupId, grupo_id: groupId, empresa_id: empresaId,
    usuario_responsavel: data.usuario_responsavel || authUser?.full_name || authUser?.email,
    usuario_responsavel_id: data.usuario_responsavel_id || authUser?.id,
  });

  const invalidateLists = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['entregas', authUser?.id, groupId, empresaId] }),
    queryClient.invalidateQueries({ queryKey: ['pedidos', authUser?.id, groupId, empresaId] }),
  ]);

  const createMutation = useMutation({
    /** @param {EntregaFormData} data */
    mutationFn: (data) => createInContext('Entrega', stampPayload(data)),
    onSuccess: async (result) => {
      const entrega = asRecord(result);
      await invalidateLists();
      await auditEntrega({ acao: 'Entrega.criar', registroId: entrega.id || null, dadosNovos: { criada: true, status: entrega.status || formData.status || null } });
      toastHook({ title: 'Entrega criada!' });
      onCancel();
    },
    onError: (error) => toastHook({ title: 'Erro ao criar entrega', description: error instanceof Error ? error.message : 'Falha desconhecida', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    /** @param {{id: string, data: EntregaFormData}} input */
    mutationFn: ({ id, data }) => updateInContext('Entrega', id, stampPayload(data)),
    onSuccess: async (result, variables) => {
      const entrega = asRecord(result);
      await invalidateLists();
      await auditEntrega({ acao: 'Entrega.editar', registroId: entrega.id || variables.id, dadosAnteriores: { id: variables.id }, dadosNovos: { atualizada: true, status: entrega.status || formData.status || null } });
      toastHook({ title: 'Entrega atualizada!' });
      onCancel();
    },
    onError: (error) => toastHook({ title: 'Erro ao atualizar entrega', description: error instanceof Error ? error.message : 'Falha desconhecida', variant: 'destructive' }),
  });

  /** @param {string} clienteId */
  const handleClienteChange = (clienteId) => {
    const cliente = clientes.find((item) => item.id === clienteId);
    if (!cliente) return;
    const enderecoPrincipal = cliente.locais_entrega?.find((item) => item.principal) || cliente.locais_entrega?.[0];
    const contatoPrincipal = cliente.contatos?.find((item) => item.principal) || cliente.contatos?.[0];
    setFormData((previous) => ({
      ...previous, cliente_id: clienteId, cliente_nome: cliente.nome || cliente.razao_social,
      endereco_entrega_completo: enderecoPrincipal ? {
        cep: enderecoPrincipal.cep || '', logradouro: enderecoPrincipal.logradouro || '', numero: enderecoPrincipal.numero || '', complemento: enderecoPrincipal.complemento || '', bairro: enderecoPrincipal.bairro || '', cidade: enderecoPrincipal.cidade || '', estado: enderecoPrincipal.estado || '', latitude: enderecoPrincipal.latitude || null, longitude: enderecoPrincipal.longitude || null, referencia: enderecoPrincipal.referencia || '', link_google_maps: enderecoPrincipal.link_google_maps || '',
      } : previous.endereco_entrega_completo,
      contato_entrega: { nome: contatoPrincipal?.observacao || '', telefone: contatoPrincipal?.tipo === 'Telefone' ? contatoPrincipal.valor : '', whatsapp: ['WhatsApp', 'Telefone'].includes(contatoPrincipal?.tipo) ? contatoPrincipal.valor : '', email: '', instrucoes_especiais: '' },
    }));
  };

  /** @param {string} pedidoId */
  const handlePedidoChange = (pedidoId) => {
    const pedido = pedidos.find((item) => item.id === pedidoId);
    if (!pedido) return;
    setFormData((previous) => ({ ...previous, pedido_id: pedidoId, numero_pedido: pedido.numero_pedido, cliente_id: pedido.cliente_id, cliente_nome: pedido.cliente_nome, valor_mercadoria: pedido.valor_total, endereco_entrega_completo: pedido.endereco_entrega_principal || previous.endereco_entrega_completo }));
    if (pedido.cliente_id) handleClienteChange(pedido.cliente_id);
  };

  const handleSubmitForm = async () => {
    if (!contextoValido) {
      const motivo = estaNoGrupo && formData.empresa_id && !empresaPertence ? 'empresa_fora_do_grupo' : 'contexto_obrigatorio';
      await rejectAction('Entrega.salvar.bloqueado', motivo, motivo === 'empresa_fora_do_grupo' ? 'A empresa selecionada nao pertence ao Grupo.' : 'Selecione Grupo e uma empresa autorizada.');
      return;
    }
    if (!canSaveEntrega) {
      await rejectAction(isEditing ? 'Entrega.editar.bloqueado' : 'Entrega.criar.bloqueado', 'permissao_negada', 'Seu perfil nao pode salvar entregas.');
      return;
    }
    if (!formData.cliente_id) {
      await rejectAction('Entrega.salvar.bloqueado', 'cliente_obrigatorio', 'Selecione o cliente da entrega.');
      return;
    }
    if (!window.confirm(isEditing ? 'Confirmar atualizacao desta entrega?' : 'Confirmar inclusao desta entrega?')) {
      await auditEntrega({ acao: isEditing ? 'Entrega.editar.cancelado' : 'Entrega.criar.cancelado', sucesso: false, motivo: 'confirmacao_cancelada', dadosNovos: { entrega_id: formData.id || null } });
      return;
    }
    const payload = /** @type {EntregaFormData} */ (sanitizeEntregaPayload(stampPayload(formData)));
    if (isEditing && formData.id) updateMutation.mutate({ id: formData.id, data: payload });
    else createMutation.mutate(payload);
  };

  const buscarDadosGoogleMaps = async () => {
    if (!contextoValido || !canSaveEntrega) {
      await rejectAction('Entrega.geolocalizacao.bloqueado', !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada', 'Contexto e permissao sao obrigatorios para buscar geolocalizacao.');
      return;
    }
    const endereco = formData.endereco_entrega_completo;
    const enderecoPrompt = `${sanitizePromptValue(endereco.logradouro)}, ${sanitizePromptValue(endereco.numero)}, ${sanitizePromptValue(endereco.cidade)}, ${sanitizePromptValue(endereco.estado)}`;
    try {
      const resultado = asRecord(await base44.integrations.Core.InvokeLLM({
        prompt: `Gere um link do Google Maps e coordenadas aproximadas para o endereco: ${enderecoPrompt}. Retorne JSON com link_google_maps, latitude e longitude.`,
        response_json_schema: { type: 'object', properties: { link_google_maps: { type: 'string' }, latitude: { type: 'number' }, longitude: { type: 'number' } } },
      }));
      await auditEntrega({ acao: 'Entrega.geolocalizacao', dadosNovos: summarizeGeolocationAudit(resultado) });
      setFormData((previous) => ({ ...previous, endereco_entrega_completo: { ...previous.endereco_entrega_completo, link_google_maps: String(resultado.link_google_maps || ''), latitude: Number(resultado.latitude) || null, longitude: Number(resultado.longitude) || null } }));
      sonnerToast.success('Geolocalizacao obtida!');
    } catch (error) {
      await auditEntrega({ acao: 'Entrega.geolocalizacao.erro', sucesso: false, motivo: error instanceof Error ? error.message : 'erro_geolocalizacao' });
      sonnerToast.error('Erro ao buscar coordenadas.');
    }
  };

  return <EntregaFormSections
    formData={formData} setFormData={setFormData} clientes={clientes} pedidos={pedidos}
    empresasDoGrupo={empresasDoGrupo} estaNoGrupo={estaNoGrupo} isEditing={isEditing}
    windowMode={windowMode} contextoValido={contextoValido} canSaveEntrega={canSaveEntrega}
    isSubmitting={isLoading || createMutation.isPending || updateMutation.isPending}
    calculandoPrevisao={calculandoPrevisao} previsaoIA={previsaoIA}
    onClienteChange={handleClienteChange} onPedidoChange={handlePedidoChange}
    onCalcularPrevisao={calcularPrevisaoEntrega} onAplicarPrevisao={aplicarPrevisaoIA}
    onBuscarGeolocalizacao={buscarDadosGoogleMaps} onSubmit={handleSubmitForm} onCancel={onCancel}
  />;
}
