import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DollarSign, CreditCard, Settings, Zap, CheckCircle2, Percent, Calendar, Landmark, Building2, Globe } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from "@/components/lib/usePermissions";
import FormWrapper from "@/components/common/FormWrapper";
import { toast } from 'sonner';

export default function FormaPagamentoFormCompleto({ formaPagamento, item, data, onSubmit, onSave, onClose, windowMode = false }) {
  const formaPagamentoNorm = formaPagamento || item || data;
  const [abaAtiva, setAbaAtiva] = useState('geral');
  const { empresaAtual, grupoAtual, contexto, filterInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || formaPagamentoNorm?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || formaPagamentoNorm?.empresa_id || formaPagamentoNorm?.group_id);
  const podeCriar = hasPermission?.("Cadastros.FormaPagamento.criar") || hasPermission?.("Financeiro.FormaPagamento.criar");
  const podeEditar = hasPermission?.("Cadastros.FormaPagamento.editar") || hasPermission?.("Financeiro.FormaPagamento.editar");
  const podeSalvar = formaPagamentoNorm?.id ? podeEditar : podeCriar;
  
  const { data: bancos = [] } = useQuery({
    queryKey: ['bancos', groupId, empresaAtual?.id],
    queryFn: () => filterInContext('Banco', {}, 'nome_banco', 200),
    enabled: contextoValido,
  });

  const { data: gateways = [] } = useQuery({
    queryKey: ['gateways-pagamento', groupId, empresaAtual?.id],
    queryFn: () => filterInContext('GatewayPagamento', { ativo: true }, 'nome', 200),
    enabled: contextoValido,
  });

  const [formData, setFormData] = useState(() => formaPagamentoNorm || {
    group_id: groupId || undefined,
    empresa_id: contexto === 'empresa' ? empresaAtual?.id : undefined,
    codigo: '',
    descricao: '',
    tipo: 'Dinheiro',
    ativa: true,
    aceita_desconto: true,
    percentual_desconto_padrao: 0,
    aplicar_acrescimo: false,
    percentual_acrescimo_padrao: 0,
    prazo_compensacao_dias: 0,
    gerar_cobranca_online: false,
    integracao_obrigatoria: false,
    permite_parcelamento: false,
    maximo_parcelas: 1,
    intervalo_parcelas_dias: 30,
    taxa_por_parcela: 0,
    configuracao_parcelas_cartao: [],
    icone: '💵',
    cor: '#10b981',
    ordem_exibicao: 0,
    disponivel_ecommerce: false,
    disponivel_pdv: true,
    observacoes: ''
  });

  // Gerar configuração de parcelas quando tipo é Cartão Crédito
  const gerarConfiguracaoParcelas = (maxParcelas) => {
    const config = [];
    for (let i = 1; i <= maxParcelas; i++) {
      config.push({
        numero_parcela: i,
        dias_vencimento: 30 * i,
        taxa_percentual: i === 1 ? 0 : 1.99
      });
    }
    return config;
  };

  const handleMaxParcelasChange = (novoMax) => {
    setFormData({
      ...formData, 
      maximo_parcelas: novoMax,
      configuracao_parcelas_cartao: formData.tipo === 'Cartão Crédito' 
        ? gerarConfiguracaoParcelas(novoMax)
        : formData.configuracao_parcelas_cartao
    });
  };

  const atualizarParcelaIndividual = (numeroParcela, campo, valor) => {
    const novaConfig = [...(formData.configuracao_parcelas_cartao || [])];
    const index = novaConfig.findIndex(p => p.numero_parcela === numeroParcela);
    
    if (index >= 0) {
      novaConfig[index] = {
        ...novaConfig[index],
        [campo]: parseFloat(valor) || 0
      };
    }
    
    setFormData({...formData, configuracao_parcelas_cartao: novaConfig});
  };

  useEffect(() => {
    if (formaPagamentoNorm?.id) setFormData({ ...formaPagamentoNorm });
  }, [formaPagamentoNorm?.id]);

  const handleSubmit = async () => {
    if (!formData.codigo || !formData.descricao) {
      toast.error('Preencha código e descrição');
      return;
    }
    if (!contextoValido) {
      toast.error('Selecione um grupo ou empresa antes de salvar.');
      return;
    }
    if (!podeSalvar) {
      toast.error('Sem permissão para salvar forma de pagamento.');
      return;
    }
    const payload = {
      ...formData,
      group_id: groupId || formData.group_id,
      empresa_id: contexto === 'empresa' ? empresaAtual?.id : formData.empresa_id,
    };
    if (onSubmit) onSubmit(payload);
    if (onSave) onSave();
    if (onClose) onClose();
  };

  const tiposPagamento = [
    'Dinheiro', 'PIX', 'Boleto', 'Cartão Crédito', 'Cartão Débito', 
    'Transferência', 'Cheque', 'Crédito em Conta', 'Fidelidade/Cashback', 'Outro'
  ];

  const iconesDisponiveis = [
    { icon: '💵', label: 'Dinheiro' },
    { icon: '⚡', label: 'PIX' },
    { icon: '📄', label: 'Boleto' },
    { icon: '💳', label: 'Cartão' },
    { icon: '🏦', label: 'Banco' },
    { icon: '📝', label: 'Cheque' },
    { icon: '🎁', label: 'Crédito' },
    { icon: '🏆', label: 'Fidelidade' }
  ];

  const content = (
    <FormWrapper onSubmit={handleSubmit} externalData={formData} className={`${windowMode ? 'h-full overflow-auto p-6' : 'p-6'}`}>
      <Alert className="mb-6 border-blue-300 bg-blue-50">
        <AlertDescription className="text-sm text-blue-900">
          <strong>🏦 Forma de Pagamento:</strong> Configure métodos aceitos em PDV, Pedidos, E-commerce e Portal
        </AlertDescription>
      </Alert>

      <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
        <TabsList className="grid grid-cols-4 w-full bg-slate-100">
          <TabsTrigger value="geral">
            <CreditCard className="w-4 h-4 mr-1" />
            Geral
          </TabsTrigger>
          <TabsTrigger value="financeiro">
            <DollarSign className="w-4 h-4 mr-1" />
            Financeiro
          </TabsTrigger>
          <TabsTrigger value="parcelamento">
            <Calendar className="w-4 h-4 mr-1" />
            Parcelamento
          </TabsTrigger>
          <TabsTrigger value="config">
            <Settings className="w-4 h-4 mr-1" />
            Config
          </TabsTrigger>
        </TabsList>

        {/* ABA 1: GERAL */}
        <TabsContent value="geral" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Código *</Label>
              <Input
                value={formData.codigo}
                onChange={(e) => setFormData({...formData, codigo: e.target.value})}
                placeholder="Ex: FP001"
                required
              />
            </div>

            <div>
              <Label>Descrição *</Label>
              <Input
                value={formData.descricao}
                onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                placeholder="Ex: PIX"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tipo Base *</Label>
              <Select
                value={formData.tipo}
                onValueChange={(v) => setFormData({...formData, tipo: v})}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {tiposPagamento.map(tipo => (
                    <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Ícone</Label>
              <Select
                value={formData.icone}
                onValueChange={(v) => setFormData({...formData, icone: v})}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {iconesDisponiveis.map(({ icon, label }) => (
                    <SelectItem key={icon} value={icon}>
                      {icon} {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Cor (Hex)</Label>
              <Input
                value={formData.cor}
                onChange={(e) => setFormData({...formData, cor: e.target.value})}
                placeholder="#10b981"
              />
            </div>

            <div>
              <Label>Ordem Exibição</Label>
              <Input
                type="number"
                value={formData.ordem_exibicao}
                onChange={(e) => setFormData({...formData, ordem_exibicao: parseInt(e.target.value) || 0})}
              />
            </div>

            <div className="flex items-center gap-2 pt-6">
              <Switch
                checked={formData.ativa}
                onCheckedChange={(v) => setFormData({...formData, ativa: v})}
                disabled={!podeSalvar}
                data-permission="Cadastros.FormaPagamento.alterarStatus"
                data-sensitive="true"
              />
              <Label>Ativa</Label>
            </div>
          </div>
        </TabsContent>

        {/* ABA 2: FINANCEIRO */}
        <TabsContent value="financeiro" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <Label className="font-semibold">Permite Desconto</Label>
                  <Switch
                    checked={formData.aceita_desconto}
                    onCheckedChange={(v) => setFormData({...formData, aceita_desconto: v})}
                  />
                </div>
                {formData.aceita_desconto && (
                  <div>
                    <Label className="text-xs">% Desconto Padrão</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={formData.percentual_desconto_padrao}
                        onChange={(e) => setFormData({...formData, percentual_desconto_padrao: parseFloat(e.target.value) || 0})}
                      />
                      <Percent className="w-4 h-4 text-green-600" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <Label className="font-semibold">Aplicar Acréscimo</Label>
                  <Switch
                    checked={formData.aplicar_acrescimo}
                    onCheckedChange={(v) => setFormData({...formData, aplicar_acrescimo: v})}
                  />
                </div>
                {formData.aplicar_acrescimo && (
                  <div>
                    <Label className="text-xs">% Acréscimo Padrão (Taxa)</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={formData.percentual_acrescimo_padrao}
                        onChange={(e) => setFormData({...formData, percentual_acrescimo_padrao: parseFloat(e.target.value) || 0})}
                      />
                      <Percent className="w-4 h-4 text-orange-600" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <Label>Prazo de Compensação (dias)</Label>
            <Input
              type="number"
              min="0"
              value={formData.prazo_compensacao_dias}
              onChange={(e) => setFormData({...formData, prazo_compensacao_dias: parseInt(e.target.value) || 0})}
            />
            <p className="text-xs text-slate-500 mt-1">Dias até o dinheiro entrar na conta</p>
          </div>
        </TabsContent>

        {/* ABA 3: PARCELAMENTO */}
        <TabsContent value="parcelamento" className="space-y-4 mt-4">
          <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div>
              <Label className="font-semibold">Permite Parcelamento</Label>
              <p className="text-xs text-slate-500">Habilitar pagamento em múltiplas parcelas</p>
            </div>
            <Switch
              checked={formData.permite_parcelamento}
              onCheckedChange={(v) => {
                const novoValor = v;
                setFormData({
                  ...formData, 
                  permite_parcelamento: novoValor,
                  configuracao_parcelas_cartao: (novoValor && formData.tipo === 'Cartão Crédito') 
                    ? gerarConfiguracaoParcelas(formData.maximo_parcelas)
                    : formData.configuracao_parcelas_cartao
                });
              }}
            />
          </div>

          {formData.permite_parcelamento && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Máximo de Parcelas</Label>
                  <Input
                    type="number"
                    min="2"
                    max="36"
                    value={formData.maximo_parcelas}
                    onChange={(e) => handleMaxParcelasChange(parseInt(e.target.value) || 1)}
                  />
                </div>

                {formData.tipo !== 'Cartão Crédito' && (
                  <>
                    <div>
                      <Label>Intervalo (dias) - Genérico</Label>
                      <Input
                        type="number"
                        min="7"
                        max="90"
                        value={formData.intervalo_parcelas_dias}
                        onChange={(e) => setFormData({...formData, intervalo_parcelas_dias: parseInt(e.target.value) || 30})}
                      />
                    </div>

                    <div>
                      <Label>Taxa por Parcela (%) - Genérica</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="10"
                        value={formData.taxa_por_parcela}
                        onChange={(e) => setFormData({...formData, taxa_por_parcela: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* CONFIGURAÇÃO PERSONALIZADA PARA CARTÃO DE CRÉDITO */}
              {formData.tipo === 'Cartão Crédito' && (
                <Card className="border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-cyan-50">
                  <CardHeader className="bg-blue-100 border-b border-blue-200">
                    <CardTitle className="text-base flex items-center gap-2 text-blue-900">
                      <CreditCard className="w-5 h-5" />
                      💳 Configuração Individual por Parcela - Cartão de Crédito
                    </CardTitle>
                    <p className="text-xs text-blue-700 mt-1">
                      Configure dias de vencimento e taxa específica para cada parcela
                    </p>
                  </CardHeader>
                  <CardContent className="p-4">
                    {!formData.configuracao_parcelas_cartao?.length && (
                      <div className="text-center py-4">
                        <Button
                          onClick={() => setFormData({
                            ...formData,
                            configuracao_parcelas_cartao: gerarConfiguracaoParcelas(formData.maximo_parcelas)
                          })}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Zap className="w-4 h-4 mr-2" />
                          Gerar Configuração Padrão
                        </Button>
                      </div>
                    )}

                    {formData.configuracao_parcelas_cartao?.length > 0 && (
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {formData.configuracao_parcelas_cartao
                          .sort((a, b) => a.numero_parcela - b.numero_parcela)
                          .map((parcela) => (
                            <div key={parcela.numero_parcela} className="p-4 bg-white rounded-lg border-2 border-blue-200">
                              <div className="flex items-center gap-3 mb-3">
                                <Badge className="bg-blue-600 text-white px-3 py-1">
                                  {parcela.numero_parcela}x
                                </Badge>
                                <p className="font-semibold text-slate-900">Parcela {parcela.numero_parcela}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-xs">Dias até vencimento</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    max="365"
                                    value={parcela.dias_vencimento}
                                    onChange={(e) => atualizarParcelaIndividual(
                                      parcela.numero_parcela, 
                                      'dias_vencimento', 
                                      e.target.value
                                    )}
                                    placeholder="Ex: 30"
                                  />
                                  <p className="text-xs text-slate-500 mt-1">
                                    Vence em: {parcela.dias_vencimento} dias
                                  </p>
                                </div>
                                <div>
                                  <Label className="text-xs">Taxa desta parcela (%)</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="20"
                                    value={parcela.taxa_percentual}
                                    onChange={(e) => atualizarParcelaIndividual(
                                      parcela.numero_parcela, 
                                      'taxa_percentual', 
                                      e.target.value
                                    )}
                                    placeholder="Ex: 1.99"
                                  />
                                  <p className="text-xs text-slate-500 mt-1">
                                    Taxa: {parcela.taxa_percentual}%
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}

                    {formData.configuracao_parcelas_cartao?.length > 0 && (
                      <Alert className="mt-4 border-blue-300 bg-blue-50">
                        <AlertDescription className="text-xs text-blue-900">
                          <strong>📋 Exemplo de uso:</strong> Compra de R$ 1.200,00
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            {formData.configuracao_parcelas_cartao.slice(0, 6).map(p => {
                              const valorParcela = (1200 / p.numero_parcela) * (1 + (p.taxa_percentual / 100));
                              const valorTotal = valorParcela * p.numero_parcela;
                              return (
                                <div key={p.numero_parcela} className="text-xs">
                                  {p.numero_parcela}x de R$ {valorParcela.toFixed(2)} = R$ {valorTotal.toFixed(2)}
                                </div>
                              );
                            })}
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              )}

              {formData.tipo !== 'Cartão Crédito' && (
                <Alert className="border-purple-300 bg-purple-50">
                  <AlertDescription className="text-xs text-purple-900">
                    <strong>Exemplo:</strong> Valor de R$ 1.200,00 em {formData.maximo_parcelas}x = 
                    {formData.maximo_parcelas > 0 ? ` ${formData.maximo_parcelas}x de R$ ${(1200 / formData.maximo_parcelas).toFixed(2)}` : ' -'}
                    {formData.taxa_por_parcela > 0 && ` + ${formData.taxa_por_parcela}% taxa/parcela`}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </TabsContent>

        {/* ABA 4: CONFIGURAÇÕES */}
        <TabsContent value="config" className="space-y-4 mt-4">
          {/* ESCOPO MULTIEMPRESA */}
          <Card className="border-purple-200 bg-purple-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-purple-600" />
                <Label className="font-semibold">Escopo Multiempresa</Label>
              </div>
              <p className="text-xs text-slate-600 mb-3">
                Contexto: {contexto === 'grupo' ? '🏢 Grupo Empresarial' : '🏪 Empresa Individual'}
              </p>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div>
              <Label className="font-semibold">Gerar Cobrança Online</Label>
              <p className="text-xs text-slate-500">Requer integração com gateway (Boleto/PIX)</p>
            </div>
            <Switch
              checked={formData.gerar_cobranca_online}
              onCheckedChange={(v) => setFormData({...formData, gerar_cobranca_online: v})}
            />
          </div>

          {formData.gerar_cobranca_online && (
            <>
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border">
                <div>
                  <Label className="font-semibold">Usar Gateway de Pagamento</Label>
                  <p className="text-xs text-slate-500">Processador externo (Pagar.me, Stripe) ao invés de banco direto</p>
                </div>
                <Switch
                  checked={formData.usa_gateway || false}
                  onCheckedChange={(v) => setFormData({
                    ...formData,
                    usa_gateway: v,
                    banco_vinculado_id: v ? '' : formData.banco_vinculado_id,
                    gateway_pagamento_id: v ? formData.gateway_pagamento_id : ''
                  })}
                />
              </div>

              {formData.usa_gateway ? (
                <div>
                  <Label>Gateway de Pagamento *</Label>
                  <Select
                    value={formData.gateway_pagamento_id || ''}
                    onValueChange={(v) => {
                      const gateway = gateways.find(g => g.id === v);
                      setFormData({
                        ...formData,
                        gateway_pagamento_id: v,
                        gateway_pagamento_nome: gateway?.nome || ''
                      });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione o gateway..." /></SelectTrigger>
                    <SelectContent>
                      {gateways.map(g => (
                        <SelectItem key={g.id} value={g.id}>
                          <CreditCard className="w-4 h-4 inline mr-2" />
                          {g.nome} ({g.provedor}) - {g.ambiente}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500 mt-1">
                    Configure gateways em Cadastros → Financeiro → Gateways de Pagamento
                  </p>
                </div>
              ) : (
                bancos.length > 0 && (
                  <div>
                    <Label>Banco Vinculado (Boleto/PIX Bancário)</Label>
                    <Select
                      value={formData.banco_vinculado_id || ''}
                      onValueChange={(v) => setFormData({...formData, banco_vinculado_id: v})}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione o banco..." /></SelectTrigger>
                      <SelectContent>
                        {bancos.map(banco => (
                          <SelectItem key={banco.id} value={banco.id}>
                            <Landmark className="w-4 h-4 inline mr-2" />
                            {banco.nome_banco} - Ag: {banco.agencia} Conta: {banco.numero_conta}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )
              )}
            </>
          )}

          <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-200">
            <div>
              <Label className="font-semibold">Integração Obrigatória</Label>
              <p className="text-xs text-slate-500">Bloquear uso sem integração ativa</p>
            </div>
            <Switch
              checked={formData.integracao_obrigatoria}
              onCheckedChange={(v) => setFormData({...formData, integracao_obrigatoria: v})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border">
              <div>
                <Label className="font-semibold">Disponível no PDV</Label>
                <p className="text-xs text-slate-500">Aparece no Caixa PDV</p>
              </div>
              <Switch
                checked={formData.disponivel_pdv}
                onCheckedChange={(v) => setFormData({...formData, disponivel_pdv: v})}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border">
              <div>
                <Label className="font-semibold">Disponível no E-commerce</Label>
                <p className="text-xs text-slate-500">Aparece no Site/Portal</p>
              </div>
              <Switch
                checked={formData.disponivel_ecommerce}
                onCheckedChange={(v) => setFormData({...formData, disponivel_ecommerce: v})}
              />
            </div>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea
              value={formData.observacoes}
              onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
              placeholder="Observações sobre uso desta forma de pagamento..."
              rows={3}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* PREVIEW */}
      <Card className="mt-6 border-2" style={{ borderColor: formData.cor }}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                style={{ backgroundColor: formData.cor + '20' }}
              >
                {formData.icone}
              </div>
              <div>
                <p className="font-bold text-lg">{formData.descricao || 'Nome da Forma'}</p>
                <div className="flex gap-2 mt-1">
                  <Badge className="text-xs">{formData.tipo}</Badge>
                  {formData.aceita_desconto && formData.percentual_desconto_padrao > 0 && (
                    <Badge className="bg-green-100 text-green-700 text-xs">
                      -{formData.percentual_desconto_padrao}%
                    </Badge>
                  )}
                  {formData.aplicar_acrescimo && formData.percentual_acrescimo_padrao > 0 && (
                    <Badge className="bg-orange-100 text-orange-700 text-xs">
                      +{formData.percentual_acrescimo_padrao}%
                    </Badge>
                  )}
                  {formData.permite_parcelamento && (
                    <Badge className="bg-purple-100 text-purple-700 text-xs">
                      Até {formData.maximo_parcelas}x
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <Badge className={formData.ativa ? 'bg-green-600' : 'bg-red-600'}>
              {formData.ativa ? 'Ativa' : 'Inativa'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* BOTÃO SUBMIT */}
      <div className="flex justify-end gap-3 pt-6 border-t mt-6">
        <Button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 px-8"
          disabled={!contextoValido || !podeSalvar}
          data-permission="Cadastros.FormaPagamento.salvar"
          data-sensitive="true"
        >
          <CheckCircle2 className="w-4 h-4 mr-2" />
          {formaPagamentoNorm ? 'Atualizar Forma' : 'Criar Forma'}
        </Button>
      </div>
    </FormWrapper>
  );

  if (windowMode) {
    return <div className="w-full h-full bg-white">{content}</div>;
  }

  return content;
}
