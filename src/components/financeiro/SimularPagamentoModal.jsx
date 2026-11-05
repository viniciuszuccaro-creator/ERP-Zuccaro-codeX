import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, CheckCircle2, X, CreditCard, QrCode } from "lucide-react";
import { useUser } from "@/components/lib/UserContext";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import useContextoVisual from "@/components/lib/useContextoVisual";
import { readErpHttpSession } from "@/api/erpHttpSession";
import { central360SessionKey } from "@/api/httpApiClient";
import {
  isSimularPagamentoScopeCurrent,
  resolveSimularPagamentoScopeIds,
  buildSimularPagamentoPayload,
} from "./simularPagamentoScope";

function readSimularPagamentoActorAndSession() {
  const session = readErpHttpSession();
  const actorId = typeof session?.actorId === 'string' ? session.actorId.trim() : '';
  return {
    actorId: actorId || null,
    sessionKey: central360SessionKey(session?.token),
  };
}

/**
 * ETAPA 4 - Simulador de Pagamento
 * Simula webhook de gateway para testar fluxo completo.
 * Mutações via createInContext/updateInContext (sem entities.*.create/update unscoped).
 * Fail-closed sem Grupo/Empresa; STALE_SCOPE se ator/sessão mudar no meio.
 */
export default function SimularPagamentoModal({ isOpen, onClose, contaReceber }) {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, createInContext, updateInContext } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const scopeResolved = resolveSimularPagamentoScopeIds({
    groupId, empresaId, conta: contaReceber,
  });
  const { actorId, sessionKey } = readSimularPagamentoActorAndSession();
  const scopeExpected = { actorId, sessionKey };

  const [processando, setProcessando] = useState(false);
  const [pago, setPago] = useState(false);
  const [dadosSimulacao, setDadosSimulacao] = useState({
    forma_pagamento: contaReceber?.forma_cobranca || 'PIX',
    valor_pago: contaReceber?.valor || 0,
    data_pagamento: new Date().toISOString().split('T')[0]
  });

  const simularPagamentoMutation = useMutation({
    mutationFn: async () => {
      setProcessando(true);

      if (!scopeResolved.ok) {
        throw Object.assign(new Error(
          scopeResolved.reason === 'GROUP_MISMATCH' || scopeResolved.reason === 'EMPRESA_MISMATCH'
            ? 'Conta fora do contexto de Grupo/Empresa atual'
            : 'Contexto de Grupo/Empresa necessário para simular pagamento',
        ), { code: 'SIMULAR_PAGAMENTO_SCOPE_BLOCKED' });
      }
      if (!isSimularPagamentoScopeCurrent(scopeExpected, readSimularPagamentoActorAndSession())) {
        throw new Error('SIMULAR_PAGAMENTO_STALE_SCOPE');
      }

      const { pagamento: pagamentoPayload, contaUpdate, ordemLiquidacao, historico, logCobranca } =
        buildSimularPagamentoPayload({
          groupId: scopeResolved.groupId,
          empresaId: scopeResolved.empresaId,
          contaReceber,
          dadosSimulacao,
          user,
          pagamentoId: null,
        });

      // 1. Criar Pagamento Omnichannel
      const pagamento = await createInContext('PagamentoOmnichannel', pagamentoPayload);

      if (!isSimularPagamentoScopeCurrent(scopeExpected, readSimularPagamentoActorAndSession())) {
        throw new Error('SIMULAR_PAGAMENTO_STALE_SCOPE');
      }

      // 2. Baixar Conta a Receber
      await updateInContext('ContaReceber', contaReceber.id, contaUpdate);

      // 3. Criar Ordem de Liquidação para Caixa
      await createInContext('CaixaOrdemLiquidacao', {
        ...ordemLiquidacao,
        pagamento_omnichannel_id: pagamento.id,
      });

      // 4. Criar Histórico Cliente
      if (historico) {
        await createInContext('HistoricoCliente', historico);
      }

      // 5. Log de Cobrança
      await createInContext('LogCobranca', logCobranca);

      if (!isSimularPagamentoScopeCurrent(scopeExpected, readSimularPagamentoActorAndSession())) {
        throw new Error('SIMULAR_PAGAMENTO_STALE_SCOPE');
      }

      return pagamento;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contasReceber'] });
      queryClient.invalidateQueries({ queryKey: ['pagamentos-omnichannel'] });
      queryClient.invalidateQueries({ queryKey: ['caixa-ordens-liquidacao'] });
      queryClient.invalidateQueries({ queryKey: ['historico-cliente'] });
      setPago(true);
      setProcessando(false);
      toast.success("✅ Pagamento simulado com sucesso!");
    },
    onError: (error) => {
      setProcessando(false);
      toast.error("Erro ao simular pagamento: " + error.message);
    }
  });

  if (!isOpen) return null;

  if (!scopeResolved.ok) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-md border-amber-200">
          <CardHeader className="bg-amber-50 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-amber-900 text-base">Simular Pagamento</CardTitle>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4 text-sm text-amber-900">
            {scopeResolved.reason === 'GROUP_MISMATCH' || scopeResolved.reason === 'EMPRESA_MISMATCH'
              ? 'Conta fora do contexto de Grupo/Empresa atual.'
              : 'Contexto de Grupo/Empresa necessário para simular pagamento.'}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-green-600" />
              Simular Pagamento (Webhook Gateway)
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {!pago ? (
            <>
              {/* INFO CONTA */}
              <Card className="bg-slate-50 border-slate-200">
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-slate-600">Cliente</Label>
                      <p className="font-semibold">{contaReceber?.cliente}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Vencimento</Label>
                      <p className="font-semibold">
                        {new Date(contaReceber?.data_vencimento).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Valor Original</Label>
                      <p className="text-xl font-bold text-green-600">
                        R$ {(contaReceber?.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Cobrança</Label>
                      <Badge className="bg-blue-100 text-blue-700">
                        {contaReceber?.forma_cobranca === 'PIX' ? (
                          <QrCode className="w-3 h-3 mr-1" />
                        ) : (
                          <CreditCard className="w-3 h-3 mr-1" />
                        )}
                        {contaReceber?.forma_cobranca}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* FORMULÁRIO SIMULAÇÃO */}
              <Alert className="border-blue-300 bg-blue-50">
                <AlertDescription className="text-sm text-blue-900">
                  <strong>ℹ️ Modo Simulação:</strong> Esta ação simula um webhook do gateway de pagamento,
                  criando todo o fluxo: PagamentoOmnichannel → Baixa CR → Ordem Caixa → Histórico Cliente
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Forma de Pagamento *</Label>
                    <Select 
                      value={dadosSimulacao.forma_pagamento}
                      onValueChange={(v) => setDadosSimulacao({...dadosSimulacao, forma_pagamento: v})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PIX">PIX</SelectItem>
                        <SelectItem value="Boleto">Boleto</SelectItem>
                        <SelectItem value="Cartão Crédito">Cartão Crédito</SelectItem>
                        <SelectItem value="Cartão Débito">Cartão Débito</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Valor Pago *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={dadosSimulacao.valor_pago}
                      onChange={(e) => setDadosSimulacao({
                        ...dadosSimulacao, 
                        valor_pago: parseFloat(e.target.value) || 0
                      })}
                    />
                  </div>
                </div>

                <div>
                  <Label>Data do Pagamento *</Label>
                  <Input
                    type="date"
                    value={dadosSimulacao.data_pagamento}
                    onChange={(e) => setDadosSimulacao({
                      ...dadosSimulacao, 
                      data_pagamento: e.target.value
                    })}
                  />
                </div>
              </div>

              {/* AÇÕES */}
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => simularPagamentoMutation.mutate()}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={processando}
                >
                  <Zap className="w-4 h-4 mr-2" />
                  {processando ? "Processando..." : "Simular Pagamento"}
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <Alert className="border-green-400 bg-green-50">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <AlertDescription className="text-green-900">
                  <strong className="text-base">✅ Pagamento Simulado com Sucesso!</strong>
                  <div className="mt-3 space-y-2 text-sm">
                    <p>✓ PagamentoOmnichannel criado</p>
                    <p>✓ Conta a Receber baixada (status: Recebido)</p>
                    <p>✓ Ordem de Liquidação criada para Caixa</p>
                    <p>✓ Histórico do Cliente atualizado</p>
                    <p>✓ Log de Cobrança registrado</p>
                  </div>
                </AlertDescription>
              </Alert>

              <Card className="bg-slate-50">
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <Label className="text-xs text-slate-600">Forma Pagamento</Label>
                      <p className="font-semibold">{dadosSimulacao.forma_pagamento}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Valor Pago</Label>
                      <p className="text-lg font-bold text-green-600">
                        R$ {dadosSimulacao.valor_pago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs text-slate-600">Data Pagamento</Label>
                      <p className="font-semibold">
                        {new Date(dadosSimulacao.data_pagamento).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button
                onClick={onClose}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Fechar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
