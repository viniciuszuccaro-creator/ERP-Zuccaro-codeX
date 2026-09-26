import React from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Send, Wallet } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { assertTitulosProntosParaCaixa } from "@/components/lib/financeiroTituloPolicy";

/**
 * ETAPA 4 - Enviar Para Caixa (Contas a Receber / Pagar).
 * Onda 6: fail-closed multiempresa + bloqueio de título já liquidado.
 */
export default function EnviarParaCaixa({
  titulosSelecionados = [],
  tipo = 'receber',
  groupId = null,
  empresaId = null,
  onEnviado,
}) {
  const queryClient = useQueryClient();

  const enviarMutation = useMutation({
    mutationFn: async () => {
      const scope = assertTitulosProntosParaCaixa({
        titulos: titulosSelecionados,
        groupId,
        empresaId,
      });
      const ordens = await Promise.all(titulosSelecionados.map(async (titulo) => {
        return await base44.entities.CaixaOrdemLiquidacao.create({
          group_id: scope.groupId,
          empresa_id: scope.empresaId,
          tipo_operacao: tipo === 'receber' ? 'Recebimento' : 'Pagamento',
          origem: tipo === 'receber' ? 'Contas a Receber' : 'Contas a Pagar',
          valor_total: titulo.valor,
          forma_pagamento_pretendida: tipo === 'receber' ? 'PIX' : 'Transferência',
          status: 'Pendente',
          pedido_id: titulo.pedido_id || null,
          titulos_vinculados: [{
            titulo_id: titulo.id,
            tipo_titulo: tipo === 'receber' ? 'ContaReceber' : 'ContaPagar',
            numero_titulo: titulo.numero_documento || titulo.descricao,
            cliente_fornecedor_nome: tipo === 'receber' ? titulo.cliente : titulo.fornecedor,
            valor_titulo: titulo.valor,
            data_vencimento: titulo.data_vencimento,
            pedido_id: titulo.pedido_id || null,
          }],
          data_ordem: new Date().toISOString(),
        });
      }));
      return ordens;
    },
    onSuccess: (ordens) => {
      queryClient.invalidateQueries({ queryKey: ['caixa-ordens-liquidacao', groupId, empresaId] });
      toast.success(`${ordens.length} título(s) enviado(s) para o Caixa.`);
      if (onEnviado) onEnviado();
    },
    onError: (error) => {
      toast.error(error?.message || 'Erro ao enviar para o caixa');
    },
  });

  if (titulosSelecionados.length === 0) {
    return null;
  }

  let bloqueio = null;
  try {
    assertTitulosProntosParaCaixa({ titulos: titulosSelecionados, groupId, empresaId });
  } catch (error) {
    bloqueio = error?.message || 'Envio ao caixa bloqueado';
  }

  const totalValor = titulosSelecionados.reduce((sum, t) => sum + (t.valor || 0), 0);
  const cor = tipo === 'receber' ? 'emerald' : 'red';

  return (
    <Alert
      className={`border-${cor}-300 bg-${cor}-50 w-full`}
      data-context-required="true"
      data-permission={tipo === 'receber' ? 'Financeiro.ContaReceber.receber' : 'Financeiro.ContaPagar.pagar'}
      data-action="enviar-para-caixa"
    >
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={`font-semibold text-${cor}-900 flex items-center gap-2`}>
            <Wallet className="w-5 h-5" />
            {titulosSelecionados.length} título(s) selecionado(s)
          </p>
          <p className={`text-xs text-${cor}-700 mt-1`}>
            Total: R$ {totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          {bloqueio && (
            <p className="text-xs text-red-700 mt-1" role="alert">{bloqueio}</p>
          )}
        </div>
        <Button
          onClick={() => enviarMutation.mutate()}
          disabled={Boolean(bloqueio) || enviarMutation.isPending}
          className={`bg-${cor}-600 hover:bg-${cor}-700`}
          data-permission={tipo === 'receber' ? 'Financeiro.ContaReceber.receber' : 'Financeiro.ContaPagar.pagar'}
          data-sensitive
        >
          {enviarMutation.isPending ? (
            <>Enviando...</>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Enviar para Caixa
            </>
          )}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
