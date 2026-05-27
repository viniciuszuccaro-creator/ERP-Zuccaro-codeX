import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Receipt, FileText, Layers, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

/**
 * V21.1.2 - Modal/Window de Emissão de NF-e com Escolha de Escopo
 * Permite: Pedido Inteiro OU Etapa Específica
 * WINDOW MODE READY
 */
export default function GerarNFeModal({ open, onClose, pedidoData, onEmitir, windowMode = false, contextoValido = true, canEmitir = true, empresaId = null, groupId = null, onAudit }) {
  const [escopo, setEscopo] = useState('pedido_inteiro'); // ou 'etapa_especifica'
  const [etapaSelecionada, setEtapaSelecionada] = useState(null);

  const etapas = pedidoData?.etapas_entrega || [];
  const etapasPendentes = etapas.filter(e => !e.faturada);
  const sanitizeFiscalText = (value) => String(value || '').replace(/[<>]/g, '').replace(/javascript:/gi, '').trim();
  const contextoEmissaoValido = contextoValido && canEmitir && Boolean(empresaId);
  const registrarAuditoria = async (acao, detalhes = {}, sucesso = true) => {
    if (typeof onAudit === 'function') {
      await onAudit(acao, { origem: 'GerarNFeModal', ...detalhes }, sucesso);
    }
  };

  const handleEmitir = async () => {
    if (!contextoEmissaoValido) {
      await registrarAuditoria('nfe_modal_emitir_bloqueada', { motivo: !empresaId ? 'empresa_faturadora_obrigatoria' : 'contexto_ou_permissao', pedido_id: pedidoData?.id }, false);
      toast.error('Selecione uma empresa faturadora e confirme permissao para emitir NF-e.');
      return;
    }

    if (escopo === 'etapa_especifica' && !etapaSelecionada) {
      toast.error('Selecione uma etapa');
      return;
    }

    const etapaEscolhidaLocal = etapas.find(e => e.id === etapaSelecionada);
    const dadosNFe = {
      escopo,
      pedido_id: pedidoData?.id,
      numero_pedido: sanitizeFiscalText(pedidoData?.numero_pedido),
      cliente_id: pedidoData?.cliente_id,
      cliente_nome: sanitizeFiscalText(pedidoData?.cliente_nome),
      etapa_id: escopo === 'etapa_especifica' ? etapaSelecionada : null,
      itens: escopo === 'pedido_inteiro'
        ? [...(pedidoData?.itens_revenda || []), ...(pedidoData?.itens_armado_padrao || []), ...(pedidoData?.itens_corte_dobra || [])]
        : (etapaEscolhidaLocal?.itens_etapa || []),
      valor_total: escopo === 'pedido_inteiro'
        ? (pedidoData?.valor_total || 0)
        : (etapaEscolhidaLocal?.valor_total_etapa || 0),
      observacoes_nfe: sanitizeFiscalText(pedidoData?.observacoes_nfe),
      cfop: sanitizeFiscalText(pedidoData?.cfop_pedido || '5102'),
      natureza_operacao: sanitizeFiscalText(pedidoData?.natureza_operacao || 'Venda de mercadoria'),
      empresa_id: empresaId,
      empresa_faturamento_id: empresaId,
      group_id: groupId,
      grupo_id: groupId
    };

    if (!window.confirm('Confirmar emissao da NF-e com este escopo?')) {
      await registrarAuditoria('nfe_modal_emitir_cancelada', { motivo: 'confirmacao_cancelada', pedido_id: pedidoData?.id, escopo }, false);
      return;
    }

    await Promise.resolve(onEmitir?.(dadosNFe));
    await registrarAuditoria('nfe_modal_emitida', { pedido_id: pedidoData?.id, escopo, etapa_id: dadosNFe.etapa_id }, true);
    toast.success('NF-e sera gerada com os dados informados');
  };

  const etapaEscolhida = etapas.find(e => e.id === etapaSelecionada);

  const content = (
    <div className={`space-y-4 ${windowMode ? 'p-6 h-full overflow-auto' : ''}`}>
      {!windowMode && (
        <div className="flex items-center gap-2 mb-4">
          <Receipt className="w-6 h-6 text-purple-600" />
          <h2 className="text-xl font-bold">Emitir NF-e - Escolha o Escopo</h2>
        </div>
      )}

      {!contextoEmissaoValido && (
        <Alert className="border-red-300 bg-red-50">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <AlertDescription className="text-sm text-red-700 ml-6">
            Para emitir NF-e, selecione uma empresa faturadora e confirme permissao fiscal no contexto atual.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
          <RadioGroup value={escopo} onValueChange={setEscopo}>
            {/* Opção 1: Pedido Inteiro */}
            <div className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
              escopo === 'pedido_inteiro' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
            }`}
            onClick={() => setEscopo('pedido_inteiro')}>
              <div className="flex items-start gap-3">
                <RadioGroupItem value="pedido_inteiro" id="pedido_inteiro" />
                <div className="flex-1">
                  <Label htmlFor="pedido_inteiro" className="cursor-pointer">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <span className="font-bold text-slate-900">Faturar Pedido Inteiro</span>
                    </div>
                    <p className="text-sm text-slate-600">
                      Emite NF-e com todos os itens do pedido de uma vez
                    </p>
                  </Label>
                  
                  {escopo === 'pedido_inteiro' && (
                    <div className="mt-3 p-3 bg-white rounded border">
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-slate-600">Itens Revenda</p>
                          <p className="font-bold text-blue-600">{pedidoData?.itens_revenda?.length || 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600">Armado</p>
                          <p className="font-bold text-purple-600">{pedidoData?.itens_armado_padrao?.length || 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600">Corte/Dobra</p>
                          <p className="font-bold text-orange-600">{pedidoData?.itens_corte_dobra?.length || 0}</p>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t">
                        <p className="text-xs text-slate-600">Valor Total da NF-e</p>
                        <p className="text-xl font-bold text-green-600">
                          R$ {(pedidoData?.valor_total || 0).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Opção 2: Etapa Específica */}
            <div className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
              escopo === 'etapa_especifica' ? 'border-purple-600 bg-purple-50' : 'border-slate-200 hover:bg-slate-50'
            }`}
            onClick={() => setEscopo('etapa_especifica')}>
              <div className="flex items-start gap-3">
                <RadioGroupItem value="etapa_especifica" id="etapa_especifica" />
                <div className="flex-1">
                  <Label htmlFor="etapa_especifica" className="cursor-pointer">
                    <div className="flex items-center gap-2 mb-1">
                      <Layers className="w-5 h-5 text-purple-600" />
                      <span className="font-bold text-slate-900">Faturar por Etapa</span>
                    </div>
                    <p className="text-sm text-slate-600">
                      Emite NF-e apenas com os itens de uma etapa específica
                    </p>
                  </Label>

                  {escopo === 'etapa_especifica' && (
                    <div className="mt-3 space-y-2">
                      {etapasPendentes.length === 0 ? (
                        <Alert className="border-orange-300 bg-orange-50">
                          <AlertDescription className="text-sm">
                            ⚠️ Todas as etapas já foram faturadas ou não há etapas criadas
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <div className="space-y-2">
                          {etapasPendentes.map((etapa) => (
                            <div
                              key={etapa.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setEtapaSelecionada(etapa.id);
                              }}
                              className={`p-3 bg-white rounded border-2 cursor-pointer transition-all ${
                                etapaSelecionada === etapa.id ? 'border-purple-600' : 'border-slate-200 hover:border-purple-300'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Badge className="bg-purple-600">Etapa {etapa.sequencia}</Badge>
                                  <span className="font-semibold text-sm">{etapa.nome_etapa}</span>
                                </div>
                                {etapaSelecionada === etapa.id && (
                                  <CheckCircle className="w-5 h-5 text-purple-600" />
                                )}
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-xs">
                                <div>
                                  <p className="text-slate-600">Itens</p>
                                  <p className="font-bold">{etapa.quantidade_total_itens}</p>
                                </div>
                                <div>
                                  <p className="text-slate-600">Peso</p>
                                  <p className="font-bold">{etapa.peso_total_etapa_kg?.toFixed(2)} kg</p>
                                </div>
                                <div>
                                  <p className="text-slate-600">Valor</p>
                                  <p className="font-bold text-green-600">
                                    R$ {(etapa.valor_total_etapa || 0).toLocaleString('pt-BR')}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </RadioGroup>

          {/* Resumo da Emissão */}
          {(escopo === 'pedido_inteiro' || etapaEscolhida) && (
            <Alert className="border-blue-300 bg-blue-50 mt-4">
              <AlertDescription>
                <p className="font-semibold text-blue-900 mb-2">📋 NF-e será emitida com:</p>
                <div className="text-sm text-blue-800 space-y-1">
                  {escopo === 'pedido_inteiro' ? (
                    <>
                      <p>• Todos os itens do pedido</p>
                      <p>• Valor: R$ {(pedidoData?.valor_total || 0).toLocaleString('pt-BR')}</p>
                    </>
                  ) : etapaEscolhida ? (
                    <>
                      <p>• Apenas itens da "{etapaEscolhida.nome_etapa}"</p>
                      <p>• {etapaEscolhida.quantidade_total_itens} item(ns)</p>
                      <p>• Valor: R$ {(etapaEscolhida.valor_total_etapa || 0).toLocaleString('pt-BR')}</p>
                    </>
                  ) : null}
                  <p>• Cliente: {pedidoData?.cliente_nome}</p>
                  <p>• CFOP: {pedidoData?.cfop_pedido || '5102'}</p>
                </div>
              </AlertDescription>
            </Alert>
          )}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-white">
        {!windowMode && (
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        )}
        <Button 
          onClick={handleEmitir}
          className="bg-purple-600 hover:bg-purple-700"
          disabled={!contextoEmissaoValido || (escopo === 'etapa_especifica' && !etapaSelecionada)}
          data-action="Fiscal.NotaFiscal.emitir"
          data-permission="Fiscal.NotaFiscal.emitir"
          data-context-required="true"
          data-sensitive="true"
        >
          <Receipt className="w-4 h-4 mr-2" />
          Gerar NF-e
        </Button>
      </div>
    </div>
  );

  if (windowMode) {
    return <div className="w-full h-full bg-white">{content}</div>;
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[90vw] max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-6 h-6 text-purple-600" />
            Emitir NF-e - Escolha o Escopo
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-1">
          {content}
        </div>
      </DialogContent>
    </Dialog>
  );
}