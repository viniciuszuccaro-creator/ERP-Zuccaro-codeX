import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight } from 'lucide-react';
import { toast } from 'sonner';

import TransferenciaEntreEmpresasFields from '@/components/estoque/transferencia-empresas/TransferenciaEntreEmpresasFields';
import {
  createTransferenciaFormState,
  resolveTransferenciaEntreEmpresas,
  summarizeTransferenciaAudit,
} from '@/components/lib/estoqueMovimentoPolicy';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';

/** @typedef {import('@/components/lib/estoqueMovimentoPolicy').TransferFormState} TransferFormState */
/** @typedef {import('@/components/lib/estoqueMovimentoPolicy').TransferCompanyRecord} TransferCompanyRecord */
/** @typedef {import('@/components/lib/estoqueMovimentoPolicy').TransferProductRecord} TransferProductRecord */

/**
 * Formulario de transferencia entre empresas do Grupo.
 * @param {{ empresasDoGrupo?: TransferCompanyRecord[], produtos?: TransferProductRecord[], onSuccess?: () => void, windowMode?: boolean }} props
 */
export default function TransferenciaEntreEmpresasForm({
  empresasDoGrupo = [],
  produtos = [],
  onSuccess,
  windowMode = false,
}) {
  const queryClient = useQueryClient();
  const { canCreate } = usePermissions();
  const { empresaAtual, grupoAtual, contexto, createInContext, updateInContext } = useContextoVisual();
  const groupId = String(grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || '').trim();
  const authorizedCompanies = empresasDoGrupo.filter((empresa) => (
    String(empresa.group_id || empresa.grupo_id || '').trim() === groupId
  ));
  const authorizedCompanyIds = new Set(authorizedCompanies.map((empresa) => String(empresa.id || '')));
  const authorizedProducts = produtos.filter((produto) => {
    const productGroupId = String(produto.group_id || produto.grupo_id || '').trim();
    const productCompanyId = String(produto.empresa_id || produto.empresa_dona_id || '').trim();
    return productGroupId === groupId || authorizedCompanyIds.has(productCompanyId);
  });
  const contextoValido = Boolean(groupId && authorizedCompanies.length >= 2);
  const canCreateTransferencia = canCreate('Estoque', 'Transferencias');
  const [formData, setFormData] = useState(createTransferenciaFormState);

  /**
   * @param {{ acao: string, sucesso?: boolean, motivo?: string | null, dados?: Partial<TransferFormState> & { transferencia_id?: unknown, status?: unknown } }} input
   */
  const auditTransferencia = async ({ acao, sucesso = true, motivo = null, dados = {} }) => createInContext('AuditLog', {
    acao,
    modulo: 'Estoque',
    entidade: 'TransferenciaFilial',
    tipo_auditoria: sucesso ? 'entidade' : 'seguranca',
    descricao: motivo || 'Auditoria de transferencia entre empresas.',
    dados_novos: summarizeTransferenciaAudit(dados),
    group_id: groupId,
    grupo_id: groupId,
    empresa_id: authorizedCompanyIds.has(String(dados.empresa_origem_id || ''))
      ? dados.empresa_origem_id
      : null,
    sucesso,
    data_hora: new Date().toISOString(),
  });

  const createTransferenciaMutation = useMutation({
    mutationFn: async (/** @type {TransferFormState} */ submittedForm) => {
      const resolved = resolveTransferenciaEntreEmpresas({
        groupId,
        companies: authorizedCompanies,
        products: authorizedProducts,
        form: submittedForm,
      });
      const { form, origin, destination, product } = resolved;
      const unitCost = Number(product.custo_medio || product.custo_aquisicao || 0);
      const now = new Date().toISOString();
      const transfer = await createInContext('TransferenciaFilial', {
        group_id: resolved.groupId,
        grupo_id: resolved.groupId,
        empresa_id: form.empresa_origem_id,
        empresa_origem_id: form.empresa_origem_id,
        empresa_destino_id: form.empresa_destino_id,
        produto_id: form.produto_id,
        produto_descricao: String(product.descricao || ''),
        quantidade: form.quantidade,
        unidade_medida: form.unidade,
        motivo: form.motivo,
        observacoes: form.observacoes,
        valor_unitario: unitCost,
        valor_total: unitCost * form.quantidade,
        status: 'Processando',
        data_solicitacao: now,
        gerar_cobranca_interna: form.gerar_financeiro,
      });
      const transferId = String(transfer?.id || '');
      if (!transferId) throw new Error('Transferencia criada sem identificador.');

      const commonMovement = {
        group_id: resolved.groupId,
        grupo_id: resolved.groupId,
        produto_id: form.produto_id,
        origem_movimento: 'transferencia',
        origem_documento_id: transferId,
        quantidade: form.quantidade,
        documento: transferId,
        data_movimentacao: now,
      };

      try {
        await createInContext('MovimentacaoEstoque', {
          ...commonMovement,
          empresa_id: form.empresa_origem_id,
          tipo_movimento: 'transferencia_saida',
          idempotency_key: `transferencia|${transferId}|saida`,
          observacoes: `Transferência para ${String(destination.nome_fantasia || destination.razao_social || 'destino')}`,
        });
      } catch (originError) {
        await updateInContext('TransferenciaFilial', transferId, {
          group_id: resolved.groupId,
          empresa_id: form.empresa_origem_id,
          status: 'Falha',
        });
        await auditTransferencia({
          acao: 'TransferenciaEntreEmpresas.origem_falhou',
          sucesso: false,
          motivo: originError instanceof Error ? originError.message : 'Falha na perna de origem.',
          dados: { ...form, transferencia_id: transferId, status: 'Falha' },
        });
        throw originError;
      }

      try {
        await createInContext('MovimentacaoEstoque', {
          ...commonMovement,
          empresa_id: form.empresa_destino_id,
          tipo_movimento: 'transferencia_entrada',
          idempotency_key: `transferencia|${transferId}|entrada`,
          observacoes: `Transferência de ${String(origin.nome_fantasia || origin.razao_social || 'origem')}`,
        });
      } catch (destinationError) {
        let compensated = false;
        try {
          await createInContext('MovimentacaoEstoque', {
            ...commonMovement,
            empresa_id: form.empresa_origem_id,
            tipo_movimento: 'transferencia_entrada',
            idempotency_key: `transferencia|${transferId}|compensacao-origem`,
            observacoes: 'Compensação automática por falha na entrada do destino',
          });
          compensated = true;
        } catch (compensationError) {
          console.error('Falha critica ao compensar transferencia entre empresas.', compensationError);
        }
        const failureStatus = compensated ? 'Falha Compensada' : 'Falha Crítica';
        await updateInContext('TransferenciaFilial', transferId, {
          group_id: resolved.groupId,
          empresa_id: form.empresa_origem_id,
          status: failureStatus,
        });
        await auditTransferencia({
          acao: 'TransferenciaEntreEmpresas.destino_falhou',
          sucesso: false,
          motivo: destinationError instanceof Error ? destinationError.message : 'Falha na perna de destino.',
          dados: { ...form, transferencia_id: transferId, status: failureStatus },
        });
        throw new Error(compensated
          ? 'A entrada no destino falhou e a saída da origem foi compensada.'
          : 'Transferência incompleta: falha no destino e na compensação da origem.');
      }

      const completedTransfer = await updateInContext('TransferenciaFilial', transferId, {
        group_id: resolved.groupId,
        empresa_id: form.empresa_origem_id,
        status: 'Aprovada',
        data_conclusao: new Date().toISOString(),
      });
      await auditTransferencia({
        acao: 'TransferenciaEntreEmpresas.confirmada',
        dados: { ...form, transferencia_id: transferId, status: 'Aprovada' },
      });
      return completedTransfer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      queryClient.invalidateQueries({ queryKey: ['movimentacoes'] });
      queryClient.invalidateQueries({ queryKey: ['transferencias'] });
      toast.success('Transferência realizada com sucesso.');
      onSuccess?.();
      setFormData(createTransferenciaFormState());
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Não foi possível concluir a transferência.');
    },
  });

  const selectedProduct = authorizedProducts.find((product) => product.id === formData.produto_id);

  /** @param {React.FormEvent<HTMLFormElement>} event */
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!contextoValido || !canCreateTransferencia) {
      const reason = !contextoValido ? 'contexto_grupo_empresas_obrigatorio' : 'permissao_negada';
      try {
        await auditTransferencia({ acao: 'TransferenciaEntreEmpresas.bloqueada', sucesso: false, motivo: reason, dados: formData });
      } catch (auditError) {
        console.error('Falha ao auditar bloqueio de transferencia.', auditError);
      }
      toast.error(!contextoValido
        ? 'Selecione um Grupo com pelo menos duas empresas autorizadas.'
        : 'Sem permissão para transferir estoque entre empresas.');
      return;
    }

    let resolved;
    try {
      resolved = resolveTransferenciaEntreEmpresas({ groupId, companies: authorizedCompanies, products: authorizedProducts, form: formData });
    } catch (validationError) {
      const message = validationError instanceof Error ? validationError.message : 'Dados da transferência inválidos.';
      await auditTransferencia({ acao: 'TransferenciaEntreEmpresas.bloqueada', sucesso: false, motivo: message, dados: formData });
      toast.error(message);
      return;
    }
    const confirmed = window.confirm(
      `Confirma transferir ${resolved.form.quantidade} ${resolved.form.unidade} de ${String(resolved.product.descricao || 'produto')} de ${String(resolved.origin.nome_fantasia || resolved.origin.razao_social || 'origem')} para ${String(resolved.destination.nome_fantasia || resolved.destination.razao_social || 'destino')}?`,
    );
    if (!confirmed) {
      await auditTransferencia({ acao: 'TransferenciaEntreEmpresas.cancelada', sucesso: false, motivo: 'confirmacao_cancelada', dados: resolved.form });
      return;
    }
    createTransferenciaMutation.mutate(resolved.form);
  };

  const content = (
    <div className={`space-y-6 w-full h-full ${windowMode ? 'p-4 md:p-6 overflow-auto' : ''}`} data-permission="Estoque.Transferencias.criar" data-context-required="group-and-companies" data-context-mode={contexto}>
      {!windowMode && (
        <div className="flex items-center gap-2 mb-4">
          <ArrowLeftRight className="w-6 h-6 text-purple-600" />
          <h2 className="text-2xl font-bold">Transferência entre Empresas</h2>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4 w-full" data-permission="Estoque.Transferencias.criar" data-action="Estoque.Transferencias.formulario" data-context-required="group-and-companies">
        <TransferenciaEntreEmpresasFields
          formData={formData}
          setFormData={setFormData}
          companies={authorizedCompanies}
          products={authorizedProducts}
          selectedProduct={selectedProduct}
          disabled={!contextoValido || !canCreateTransferencia}
          isPending={createTransferenciaMutation.isPending}
        />
      </form>
    </div>
  );

  return windowMode
    ? <div className="w-full h-full bg-white" data-permission="Estoque.Transferencias.criar" data-context-required="group-and-companies">{content}</div>
    : content;
}
