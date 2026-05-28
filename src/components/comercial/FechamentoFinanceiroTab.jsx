import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DollarSign, Percent, FileText, Receipt, CheckCircle, AlertTriangle } from 'lucide-react';
import GerarNFeModal from './GerarNFeModal';
import { useFormasPagamento } from '@/components/lib/useFormasPagamento';
import useContextoVisual from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * V21.1 - Aba 7: Fechamento Financeiro
 * AGORA COM: Emissão de NF-e por Etapa + Barra de Progresso
 */
export default function FechamentoFinanceiroTab({ formData, setFormData, onNext }) {
  const [modalNFeOpen, setModalNFeOpen] = useState(false);
  const { empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const empresaId = formData?.empresa_id || empresaAtual?.id || null;
  const groupId = formData?.group_id || formData?.grupo_id || grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const canEmitirNFe = hasPermission('Fiscal', 'NotaFiscal', 'emitir') || hasPermission('Fiscal', 'NotaFiscal', 'criar') || hasPermission('Fiscal', null, 'criar');
  const sanitizeText = (value) => String(value || '').replace(/[<>]/g, '').replace(/javascript:/gi, '').trim();
  const sanitizePercentual = (value) => Math.min(100, Math.max(0, Number.parseFloat(value) || 0));
  const sanitizeInteiro = (value, fallback = 0) => Math.max(0, Number.parseInt(value, 10) || fallback);
  const auditFechamento = async (acao, detalhes = {}, sucesso = true) => {
    try {
      const usuario = await base44.auth.me().catch(() => null);
      await base44.entities.AuditLog.create({
        usuario_id: usuario?.id || null,
        usuario: usuario?.full_name || usuario?.email || 'Sistema',
        acao,
        modulo: 'Comercial/FechamentoFinanceiro',
        tipo_auditoria: sucesso ? 'operacional' : 'seguranca',
        entidade: detalhes.entidade || 'Pedido',
        descricao: detalhes.descricao || acao,
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId,
        sucesso,
        detalhes: { origem: 'FechamentoFinanceiroTab', pedido_id: formData?.id || null, ...detalhes },
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('Falha ao auditar fechamento financeiro:', error);
    }
  };
  const abrirModalNFe = async () => {
    if (!contextoValido || !empresaId || !canEmitirNFe) {
      await auditFechamento('nfe_fechamento_abrir_bloqueada', { motivo: !empresaId ? 'empresa_faturadora_obrigatoria' : 'contexto_ou_permissao' }, false);
      return;
    }
    setModalNFeOpen(true);
  };

  const { formasPagamento, obterConfiguracao } = useFormasPagamento({ empresa_id: empresaId });

  const valorProdutos = formData?.valor_produtos || 0;
  const descontoPercentual = formData?.desconto_geral_pedido_percentual || 0;
  const descontoValor = (valorProdutos * descontoPercentual) / 100;
  const valorFrete = formData?.valor_frete || 0;
  const valorTotal = valorProdutos - descontoValor + valorFrete;

  // V21.1: Calcular Progresso de Faturamento
  const etapas = formData?.etapas_entrega || [];
  const valorFaturado = etapas
    .filter(e => e.faturada)
    .reduce((sum, e) => sum + (e.valor_total_etapa || 0), 0);
  const percentualFaturado = valorTotal > 0 ? (valorFaturado / valorTotal) * 100 : 0;

  return (
    <div className="space-y-6" role="region" aria-label="Fechamento Financeiro do Pedido">
      {/* V21.1: Barra de Progresso do Faturamento */}
      {etapas.length > 0 && (
        <Card className="border-2 border-purple-300 bg-purple-50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="w-5 h-5 text-purple-600" />
              Progresso de Faturamento por Etapas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-700">Valor Faturado</span>
              <span className="font-bold text-purple-900">
                R$ {valorFaturado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <Progress value={percentualFaturado} className="h-3" />
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">
                {etapas.filter(e => e.faturada).length} de {etapas.length} etapa(s) faturada(s)
              </span>
              <span className="font-bold text-purple-600">
                {percentualFaturado.toFixed(1)}%
              </span>
            </div>

            {percentualFaturado === 100 && (
              <Alert className="border-green-300 bg-green-50 p-3">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <AlertDescription className="text-sm text-green-700 ml-6">
                  ✅ Pedido 100% faturado
                </AlertDescription>
              </Alert>
            )}

            {(!contextoValido || !empresaId || !canEmitirNFe) && (
              <Alert className="border-red-300 bg-red-50 p-3">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <AlertDescription className="text-sm text-red-700 ml-6">
                  Para emitir NF-e, selecione empresa faturadora e confirme permissao fiscal no contexto atual.
                </AlertDescription>
              </Alert>
            )}

            {/* V21.1: Botao Emitir NF-e com Escopo */}
            <Button
              onClick={abrirModalNFe}
              className="w-full bg-purple-600 hover:bg-purple-700"
              size="lg"
              disabled={!contextoValido || !empresaId || !canEmitirNFe}
              data-action="Fiscal.NotaFiscal.emitir"
              data-permission="Fiscal.NotaFiscal.emitir"
              data-context-required="true"
              data-sensitive="true"
            >
              <Receipt className="w-5 h-5 mr-2" />
              Emitir NF-e (Pedido Completo ou por Etapa)
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Desconto Global */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Percent className="w-5 h-5 text-orange-600" />
            Desconto Global do Pedido
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Desconto (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={descontoPercentual}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  desconto_geral_pedido_percentual: sanitizePercentual(e.target.value),
                  desconto_geral_pedido_valor: (valorProdutos * sanitizePercentual(e.target.value)) / 100
                }))}
              />
            </div>
            <div>
              <Label>Desconto (R$)</Label>
              <Input
                value={`R$ ${descontoValor.toFixed(2)}`}
                disabled
                className="font-bold text-orange-600"
              />
            </div>
          </div>

          {descontoPercentual > 0 && (
            <div>
              <Label>Justificativa do Desconto</Label>
              <textarea
                value={formData?.justificativa_desconto || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  justificativa_desconto: sanitizeText(e.target.value)
                }))}
                className="w-full p-3 border rounded-lg"
                rows="2"
                placeholder="Ex: Cliente especial, campanha promocional..."
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Forma de Pagamento */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Forma de Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Forma de Pagamento</Label>
            <Select
              value={formData?.forma_pagamento_id || formData?.forma_pagamento || ''}
              onValueChange={(formaId) => {
                const forma = formasPagamento.find(f => f.id === formaId);
                const config = obterConfiguracao(formaId);
                setFormData(prev => ({ 
                  ...prev, 
                  forma_pagamento_id: formaId,
                  forma_pagamento: forma?.descricao || '',
                  numero_parcelas: config?.permite_parcelar ? (prev.numero_parcelas || 2) : 1
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a forma de pagamento..." />
              </SelectTrigger>
              <SelectContent>
                {formasPagamento.map(forma => {
                  const config = obterConfiguracao(forma.id);
                  return (
                    <SelectItem key={forma.id} value={forma.id}>
                      {forma.icone && `${forma.icone} `}{forma.descricao}
                      {config?.percentual_desconto_padrao > 0 && ` (-${config.percentual_desconto_padrao}%)`}
                      {config?.percentual_acrescimo_padrao > 0 && ` (+${config.percentual_acrescimo_padrao}%)`}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {formData?.forma_pagamento_id && obterConfiguracao(formData.forma_pagamento_id)?.permite_parcelar && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Número de Parcelas</Label>
                <Input
                  type="number"
                  min="2"
                  max={obterConfiguracao(formData.forma_pagamento_id)?.max_parcelas || 12}
                  value={formData?.numero_parcelas || 2}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    numero_parcelas: sanitizeInteiro(e.target.value, 2)
                  }))}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Máximo: {obterConfiguracao(formData.forma_pagamento_id)?.max_parcelas || 12}x
                </p>
              </div>
              <div>
                <Label>Intervalo (dias)</Label>
                <Input
                  type="number"
                  value={formData?.intervalo_parcelas || obterConfiguracao(formData.forma_pagamento_id)?.intervalo_parcelas_dias || 30}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    intervalo_parcelas: sanitizeInteiro(e.target.value, obterConfiguracao(formData.forma_pagamento_id)?.intervalo_parcelas_dias || 30)
                  }))}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Informações Fiscais */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-600" />
            Informações Fiscais (NF-e)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Observações da NF-e (Dados Adicionais)</Label>
            <p className="text-xs text-slate-500 mb-2">
              Estas informações aparecerão no campo "Informações Complementares" da NF-e
            </p>
            <textarea
              value={formData?.observacoes_nfe || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                observacoes_nfe: sanitizeText(e.target.value)
              }))}
              className="w-full p-3 border rounded-lg"
              rows="3"
              placeholder="Ex: Mercadoria sujeita à substituição tributária, Nota Fiscal emitida nos termos da Lei..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>CFOP Padrão</Label>
              <Input
                value={formData?.cfop_pedido || '5102'}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  cfop_pedido: sanitizeText(e.target.value)
                }))}
                placeholder="5102"
              />
              <p className="text-xs text-slate-500 mt-1">
                5102 - Venda de mercadoria (dentro do estado)
              </p>
            </div>

            <div>
              <Label>Natureza da Operação</Label>
              <Input
                value={formData?.natureza_operacao || 'Venda de mercadoria'}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  natureza_operacao: sanitizeText(e.target.value)
                }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo Financeiro */}
      <Card className="border-2 border-green-300 bg-green-50">
        <CardHeader className="bg-green-100 border-b">
          <CardTitle className="text-base">💰 Resumo Financeiro</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-2">
              <span className="text-slate-700">Valor dos Produtos</span>
              <span className="font-semibold">
                R$ {valorProdutos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {descontoValor > 0 && (
              <div className="flex justify-between items-center pb-2 text-orange-600">
                <span>Desconto ({descontoPercentual}%)</span>
                <span className="font-semibold">
                  - R$ {descontoValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {valorFrete > 0 && (
              <div className="flex justify-between items-center pb-2 text-blue-600">
                <span>Frete</span>
                <span className="font-semibold">
                  + R$ {valorFrete.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center pt-3 border-t-2 border-green-600">
              <span className="text-lg font-bold text-green-900">VALOR TOTAL</span>
              <span className="text-2xl font-bold text-green-600">
                R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Observações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Observações do Pedido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Observações Públicas (visíveis ao cliente)</Label>
            <textarea
              value={formData?.observacoes_publicas || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                observacoes_publicas: sanitizeText(e.target.value)
              }))}
              className="w-full p-3 border rounded-lg"
              rows="3"
              placeholder="Observações que aparecerão no orçamento/pedido..."
            />
          </div>

          <div>
            <Label>Observações Internas (uso interno)</Label>
            <textarea
              value={formData?.observacoes_internas || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                observacoes_internas: sanitizeText(e.target.value)
              }))}
              className="w-full p-3 border rounded-lg"
              rows="3"
              placeholder="Anotações internas que não aparecem para o cliente..."
            />
          </div>
        </CardContent>
      </Card>

      {/* V21.1: Modal de Emissão de NF-e */}
      <GerarNFeModal
        open={modalNFeOpen}
        onClose={() => setModalNFeOpen(false)}
        pedidoData={formData}
        contextoValido={contextoValido}
        canEmitir={canEmitirNFe}
        empresaId={empresaId}
        groupId={groupId}
        onAudit={auditFechamento}
        onEmitir={async (dadosNFe) => {
          await auditFechamento('nfe_fechamento_emitida', { entidade: 'NotaFiscal', escopo: dadosNFe?.escopo, etapa_id: dadosNFe?.etapa_id }, true);
          console.log('Emitir NF-e:', dadosNFe);
          setModalNFeOpen(false);
        }}
      />
    </div>
  );
}