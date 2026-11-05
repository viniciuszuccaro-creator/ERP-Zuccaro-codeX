import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Percent, Calendar } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import useContextoVisual from "@/components/lib/useContextoVisual";
import { readErpHttpSession } from "@/api/erpHttpSession";
import { central360SessionKey } from "@/api/httpApiClient";
import {
  buildFormasPagamentoPedidoQueryKey,
  isFormasPagamentoPedidoScopeCurrent,
  resolveFormasPagamentoPedidoKpiState,
  pickFormasPagamentoAtivas,
} from "./formasPagamentoPedidoScope";

function readFormasActorAndSession() {
  const session = readErpHttpSession();
  const actorId = typeof session?.actorId === 'string' ? session.actorId.trim() : '';
  return {
    actorId: actorId || null,
    sessionKey: central360SessionKey(session?.token),
  };
}

/**
 * Formas de pagamento do pedido — cadastro real via filterInContext.
 * Sem mock/list unscoped; loading/erro ≠ zero formas; STALE_SCOPE.
 */
export default function FormasPagamentoPedido({
  valorTotal,
  formaPagamento,
  condicaoPagamento,
  parcelas = [],
  acrescimo = 0,
  onFormaPagamentoChange,
  onCondicaoPagamentoChange,
  onParcelasChange,
  onAcrescimoChange
}) {
  const [numeroParcelas, setNumeroParcelas] = useState(1);
  const [percentualAcrescimo, setPercentualAcrescimo] = useState(acrescimo || 0);

  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const { actorId, sessionKey } = readFormasActorAndSession();
  const contextoValido = Boolean(groupId || empresaId);
  const scopeExpected = { actorId, sessionKey };

  const {
    data: formasPagamento,
    isLoading,
    isError,
    isFetching,
  } = useQuery({
    queryKey: buildFormasPagamentoPedidoQueryKey({
      groupId, empresaId, actorId, sessionKey,
    }),
    queryFn: async ({ signal }) => {
      const rows = await filterInContext('FormaPagamento', {}, 'ordem_exibicao', 200);
      if (signal?.aborted) {
        const err = new Error('FORMAS_PAGAMENTO_PEDIDO_ABORTED');
        err.name = 'AbortError';
        throw err;
      }
      if (!isFormasPagamentoPedidoScopeCurrent(scopeExpected, readFormasActorAndSession())) {
        throw new Error('FORMAS_PAGAMENTO_PEDIDO_STALE_SCOPE');
      }
      return rows;
    },
    enabled: contextoValido,
  });

  const kpiState = resolveFormasPagamentoPedidoKpiState({
    contextoValido,
    isLoading,
    isError,
    isFetching,
    dataDefined: formasPagamento !== undefined,
  });
  const formasAtivas = kpiState === 'ready'
    ? pickFormasPagamentoAtivas(formasPagamento)
    : [];
  const contagemIndisponivel = kpiState !== 'ready';

  useEffect(() => {
    if (formaPagamento === 'Parcelado' && numeroParcelas > 0 && onParcelasChange) {
      gerarParcelas();
    } else if (formaPagamento !== 'Parcelado' && parcelas.length > 0) {
      onParcelasChange([]);
    }
  }, [numeroParcelas, valorTotal, percentualAcrescimo, formaPagamento]);

  useEffect(() => {
    if (acrescimo !== percentualAcrescimo) {
      setPercentualAcrescimo(acrescimo);
    }
  }, [acrescimo]);

  const gerarParcelas = () => {
    const valorComAcrescimo = valorTotal * (1 + percentualAcrescimo / 100);
    const valorParcela = valorComAcrescimo / numeroParcelas;
    const novasParcelas = [];

    for (let i = 1; i <= numeroParcelas; i++) {
      const dataVencimento = new Date();
      dataVencimento.setDate(dataVencimento.getDate() + (i * 30));

      novasParcelas.push({
        numero_parcela: i,
        data_vencimento: dataVencimento.toISOString().split('T')[0],
        valor: valorParcela,
        status: 'Pendente',
        forma_cobranca: formaPagamento
      });
    }

    if (onParcelasChange) {
      onParcelasChange(novasParcelas);
    }
  };

  const handleAcrescimoChange = (valor) => {
    setPercentualAcrescimo(valor);
    if (onAcrescimoChange) {
      onAcrescimoChange(valor);
    }
  };

  const optionLabel = (forma) => {
    const icon = forma.icone ? `${forma.icone} ` : '';
    return `${icon}${forma.descricao || forma.tipo || forma.id}`;
  };
  const optionValue = (forma) => forma.tipo || forma.descricao || forma.id;

  return (
    <Card className="border-sky-200">
      <CardHeader className="bg-gradient-to-r from-sky-50 to-blue-50">
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-sky-600" />
          Formas de Pagamento
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {!contextoValido && (
          <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Selecione grupo ou empresa para carregar formas de pagamento do cadastro.
          </div>
        )}
        {kpiState === 'error' && (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">
            Não foi possível carregar formas de pagamento (erro ≠ zero opções).
          </div>
        )}
        {kpiState === 'loading' && (
          <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            Carregando formas de pagamento…
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="forma-pagamento-select">Forma de Pagamento *</Label>
            <Select
              value={formaPagamento}
              onValueChange={onFormaPagamentoChange}
              disabled={contagemIndisponivel || formasAtivas.length === 0}
            >
              <SelectTrigger id="forma-pagamento-select">
                <SelectValue placeholder={contagemIndisponivel ? "Aguardando cadastro…" : "Selecione..."} />
              </SelectTrigger>
              <SelectContent>
                {formasAtivas.map((forma) => (
                  <SelectItem key={forma.id || optionValue(forma)} value={optionValue(forma)}>
                    {optionLabel(forma)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="condicao-pagamento-select">Condição de Pagamento</Label>
            <Select
              value={condicaoPagamento}
              onValueChange={onCondicaoPagamentoChange}
            >
              <SelectTrigger id="condicao-pagamento-select">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="À Vista">À Vista</SelectItem>
                <SelectItem value="7 dias">7 dias</SelectItem>
                <SelectItem value="15 dias">15 dias</SelectItem>
                <SelectItem value="30 dias">30 dias</SelectItem>
                <SelectItem value="45 dias">45 dias</SelectItem>
                <SelectItem value="60 dias">60 dias</SelectItem>
                <SelectItem value="Parcelado">Parcelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {(formaPagamento === 'Parcelado' || formaPagamento === 'Cartão de Crédito') && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Label className="text-orange-900" htmlFor="percentual-acrescimo-input">Acréscimo/Juros (%)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="percentual-acrescimo-input"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={percentualAcrescimo}
                    onChange={(e) => handleAcrescimoChange(parseFloat(e.target.value) || 0)}
                    className="w-24"
                  />
                  <Percent className="w-4 h-4 text-orange-600" />
                </div>
              </div>
              {percentualAcrescimo > 0 && (
                <div className="mt-2 p-2 bg-white rounded">
                  <p className="text-sm text-orange-700">
                    Valor Original: <span className="font-bold">R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </p>
                  <p className="text-sm text-orange-900 font-bold">
                    Valor com Acréscimo: R$ {(valorTotal * (1 + percentualAcrescimo / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {formaPagamento === 'Parcelado' && (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <Label htmlFor="numero-parcelas-select">Número de Parcelas:</Label>
              <Select
                value={numeroParcelas.toString()}
                onValueChange={(v) => setNumeroParcelas(parseInt(v))}
              >
                <SelectTrigger id="numero-parcelas-select" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                    <SelectItem key={n} value={n.toString()}>
                      {n}x
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {numeroParcelas > 0 && (
                <span className="text-sm text-slate-600">
                  de R$ {((valorTotal * (1 + percentualAcrescimo / 100)) / numeroParcelas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              )}
            </div>

            {parcelas.length > 0 && (
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-sky-600" />
                    Parcelas Geradas
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {parcelas.map((parcela, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                        <span className="text-sm font-medium">Parcela {parcela.numero_parcela}/{numeroParcelas}</span>
                        <span className="text-sm text-slate-700">
                          Vencimento: {new Date(parcela.data_vencimento).toLocaleDateString('pt-BR')}
                        </span>
                        <span className="font-semibold text-sm">
                          R$ {parcela.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {!contagemIndisponivel && formaPagamento === undefined && formasAtivas.length > 0 && (
          <>
            <Separator />
            <h4 className="font-semibold text-base mb-2">Selecione uma Forma de Pagamento</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {formasAtivas.slice(0, 8).map(forma => (
                <Button
                  key={forma.id}
                  type="button"
                  variant="outline"
                  onClick={() => onFormaPagamentoChange(optionValue(forma))}
                  className="h-auto py-3 flex flex-col items-center gap-1 text-center"
                >
                  <span className="text-lg">{forma.icone || '💰'}</span>
                  <span className="text-xs font-medium">{forma.descricao || forma.tipo}</span>
                </Button>
              ))}
            </div>
          </>
        )}

        {!contagemIndisponivel && formasAtivas.length === 0 && (
          <div className="text-sm text-slate-500">
            Nenhuma forma de pagamento ativa no cadastro deste contexto.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
