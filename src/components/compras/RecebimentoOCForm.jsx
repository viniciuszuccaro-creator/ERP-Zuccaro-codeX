import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, Package } from "lucide-react";
import FormWrapper from "@/components/common/FormWrapper";
import { useToast } from "@/components/ui/use-toast";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

/**
 * V21.1.2: Recebimento OC - Window Mode
 */
export default function RecebimentoOCForm({ ordemCompra, onSubmit, windowMode = false }) {
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const { empresaAtual, grupoAtual, contexto, createInContext } = useContextoVisual();
  const groupId = ordemCompra?.group_id || ordemCompra?.grupo_id || grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = ordemCompra?.empresa_id || empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const canReceiveOC = hasPermission('Compras', 'OrdemCompra', 'receber') ||
    hasPermission('Estoque', 'Movimentacoes', 'criar') ||
    hasPermission('Compras', null, 'criar');
  const controlesBloqueados = !contextoValido || !canReceiveOC;

  const schema = z.object({
    data_entrega_real: z.string().min(8, 'Data obrigatória'),
    nota_fiscal_entrada: z.string().optional(),
    observacoes: z.string().optional(),
  });

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      data_entrega_real: new Date().toISOString().split('T')[0],
      nota_fiscal_entrada: '',
      observacoes: ''
    }
  });

  const auditRecebimentoOC = async ({ acao, sucesso = true, motivo = null, dados = {} }) => {
    try {
      await createInContext('AuditLog', {
        acao,
        modulo: 'Compras',
        entidade: 'OrdemCompra',
        tipo_auditoria: sucesso ? 'entidade' : 'seguranca',
        descricao: motivo || 'Auditoria do formulario de recebimento de OC.',
        dados_novos: dados,
        group_id: groupId,
        grupo_id: groupId,
        empresa_id: empresaId,
        sucesso,
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('Falha ao auditar formulario de recebimento de OC:', error);
    }
  };

  const onValid = async (data) => {
    if (controlesBloqueados) {
      await auditRecebimentoOC({
        acao: 'OrdemCompra.recebimento_formulario_bloqueado',
        sucesso: false,
        motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada',
        dados: { ordem_compra_id: ordemCompra?.id, numero_oc: ordemCompra?.numero_oc }
      });
      toast({
        title: "Recebimento bloqueado",
        description: !contextoValido ? "Selecione grupo ou empresa antes de receber." : "Sem permissao para receber ordem de compra.",
        variant: "destructive"
      });
      return;
    }
    onSubmit(data);
  };
  const unifiedSubmit = React.useCallback(() => handleSubmit(onValid)(), [handleSubmit, onValid]);

  const content = (
    <FormWrapper
      onSubmit={unifiedSubmit}
      externalData={{ empresa_id: empresaId, group_id: groupId, grupo_id: groupId }}
      className={`space-y-6 ${windowMode ? 'p-6 h-full overflow-auto' : ''}`}
      data-permission="Compras.OrdemCompra.receber"
      data-context-required="group-or-company"
      data-context-mode={empresaId ? 'empresa' : contexto}
    >
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="p-4 bg-slate-50 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              <p className="font-semibold text-lg">{ordemCompra?.numero_oc}</p>
            </div>
            <p className="text-sm text-slate-600">Fornecedor: {ordemCompra?.fornecedor_nome}</p>
            <p className="text-sm text-slate-600">Valor: R$ {ordemCompra?.valor_total?.toFixed(2)}</p>
            <p className="text-sm text-slate-600">
              Itens: {ordemCompra?.itens?.length || 0} produto(s)
            </p>
          </div>

          <div>
            <Label>Data de Recebimento *</Label>
            <Input
              type="date"
              {...register('data_entrega_real')}
              className="mt-1"
              disabled={controlesBloqueados}
              data-permission="Compras.OrdemCompra.receber"
              data-context-required="group-or-company"
              data-sensitive="true"
            />
            {errors.data_entrega_real && <p className="text-red-600 text-xs mt-1">{errors.data_entrega_real.message}</p>}
          </div>

          <div>
            <Label>Nota Fiscal de Entrada</Label>
            <Input
              {...register('nota_fiscal_entrada')}
              disabled={controlesBloqueados}
              data-permission="Compras.OrdemCompra.receber"
              data-context-required="group-or-company"
              data-sensitive="true"
              placeholder="Número da NF-e de entrada"
              className="mt-1"
            />
          </div>

          <div>
            <Label>Observações do Recebimento</Label>
            <Textarea
              {...register('observacoes')}
              disabled={controlesBloqueados}
              data-permission="Compras.OrdemCompra.receber"
              data-context-required="group-or-company"
              data-sensitive="true"
              rows={4}
              placeholder="Condições da mercadoria, divergências, observações..."
              className="mt-1"
            />
          </div>

          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-900 font-semibold mb-2">✓ Ao confirmar:</p>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• OC será marcada como "Recebida"</li>
              <li>• Estoque será atualizado automaticamente</li>
              <li>• Lead time será calculado</li>
              <li>• Estatísticas do fornecedor serão atualizadas</li>
              <li>• Você poderá avaliar o fornecedor em seguida</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-white">
        <Button
          type="submit"
          className="bg-green-600 hover:bg-green-700"
          disabled={controlesBloqueados}
          data-permission="Compras.OrdemCompra.receber"
          data-context-required="group-or-company"
        >
          <Save className="w-4 h-4 mr-2" />
          Confirmar Recebimento
        </Button>
      </div>
    </FormWrapper>
  );

  if (windowMode) {
    return (
      <div
        className="w-full h-full bg-white"
        data-permission="Compras.OrdemCompra.receber"
        data-context-required="group-or-company"
        data-context-mode={empresaId ? 'empresa' : contexto}
      >
        {content}
      </div>
    );
  }

  return content;
}
