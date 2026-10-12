import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Repeat, DollarSign, Calendar, Bell, Users } from "lucide-react";
import { toast } from "sonner";
import CadastroCodigoRegistroField from "@/components/cadastros/CadastroCodigoRegistroField";

export default function ConfiguracaoDespesaRecorrenteForm({ config, item, data, initialData, defaultValues, windowMode = false, onSubmit }) {
  const registro = item || data || initialData || defaultValues || config;
  const [formData, setFormData] = useState(registro || {
    tipo_despesa_id: "",
    tipo_despesa_nome: "",
    descricao: "",
    categoria: "",
    fornecedor_id: "",
    fornecedor_nome: "",
    conta_contabil_id: "",
    conta_contabil_nome: "",
    centro_resultado_id: "",
    centro_resultado_nome: "",
    valor_base: 0,
    ajuste_inflacao: false,
    indice_ajuste: "Nenhum",
    percentual_ajuste_anual: 0,
    periodicidade: "Mensal",
    dia_vencimento: 5,
    meses_aplicacao: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    data_inicio: new Date().toISOString().split('T')[0],
    data_fim: "",
    forma_pagamento_id: "",
    forma_pagamento_nome: "",
    centro_custo_id: "",
    centro_custo_nome: "",
    gerar_automaticamente: true,
    antecedencia_dias: 5,
    notificar_criacao: true,
    usuarios_notificacao: [],
    rateio_automatico: false,
    empresas_rateio: [],
    ativa: true,
    empresa_id: "",
    origem: "empresa"
  });

  const prevIdRef = useRef(registro?.id);
  useEffect(() => {
    if (registro?.id && registro.id !== prevIdRef.current) {
      prevIdRef.current = registro.id;
      setFormData({ ...(registro || {}) });
    }
  }, [registro?.id]);


  const { data: fornecedores = [] } = useQuery({
    queryKey: ['fornecedores'],
    queryFn: () => base44.entities.Fornecedor.list(),
  });

  const { data: centrosCusto = [] } = useQuery({
    queryKey: ['centros-custo'],
    queryFn: () => base44.entities.CentroCusto.list(),
  });

  const { data: formasPagamento = [] } = useQuery({
    queryKey: ['formas-pagamento'],
    queryFn: () => base44.entities.FormaPagamento.list(),
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => base44.entities.Empresa.list(),
  });

  const { data: tiposDespesa = [] } = useQuery({
    queryKey: ['tipos-despesa'],
    queryFn: () => base44.entities.TipoDespesa.filter({ pode_ser_recorrente: true, ativo: true }),
  });

  const { data: planoContas = [] } = useQuery({
    queryKey: ['plano-contas'],
    queryFn: () => base44.entities.PlanoDeContas.list(),
  });

  const { data: centrosResultado = [] } = useQuery({
    queryKey: ['centros-resultado'],
    queryFn: () => base44.entities.CentroResultado.list(),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.tipo_despesa_id) {
      toast.error("Selecione um Tipo de Despesa.");
      return;
    }
    if (!formData.descricao) {
      toast.error("Preencha a descrição da despesa.");
      return;
    }
    if (!formData.valor_base || formData.valor_base <= 0) {
      toast.error("O valor base deve ser maior que zero.");
      return;
    }
    if (!formData.periodicidade) {
      toast.error("Selecione a periodicidade da despesa.");
      return;
    }
    if (!formData.empresa_id && formData.origem === 'empresa' && !formData.rateio_automatico) {
      toast.error("Selecione a empresa para a despesa ou configure o rateio.");
      return;
    }
    onSubmit?.({ ...formData, nome: formData.descricao || formData.tipo_despesa_nome || '' });
  };

  const mesesAno = [
    { value: 1, label: "Janeiro" },
    { value: 2, label: "Fevereiro" },
    { value: 3, label: "Março" },
    { value: 4, label: "Abril" },
    { value: 5, label: "Maio" },
    { value: 6, label: "Junho" },
    { value: 7, label: "Julho" },
    { value: 8, label: "Agosto" },
    { value: 9, label: "Setembro" },
    { value: 10, label: "Outubro" },
    { value: 11, label: "Novembro" },
    { value: 12, label: "Dezembro" }
  ];

  return (
    <div className={windowMode ? "w-full h-full flex flex-col" : ""}>
      <form onSubmit={handleSubmit} className={windowMode ? "flex-1 flex flex-col overflow-hidden" : ""}>
      <CadastroCodigoRegistroField
        idOnly
        hasId={Boolean(registro?.id)}
        entityId={registro?.id}
        action="id-tecnico-despesa-recorrente"
      />
        <div className={windowMode ? "flex-1 overflow-auto p-6" : ""}>
          <Tabs defaultValue="geral" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="geral">
                <DollarSign className="w-4 h-4 mr-2" />
                Geral
              </TabsTrigger>
              <TabsTrigger value="recorrencia">
                <Calendar className="w-4 h-4 mr-2" />
                Recorrência
              </TabsTrigger>
              <TabsTrigger value="automacao">
                <Repeat className="w-4 h-4 mr-2" />
                Automação
              </TabsTrigger>
              <TabsTrigger value="rateio">
                <Users className="w-4 h-4 mr-2" />
                Rateio
              </TabsTrigger>
            </TabsList>

            <TabsContent value="geral" className="space-y-4 mt-4">
              <div>
                <Label>Tipo de Despesa *</Label>
                <Select
                  value={formData.tipo_despesa_id}
                  onValueChange={(v) => {
                    const tipo = tiposDespesa.find(td => td.id === v);
                    setFormData({
                      ...formData,
                      tipo_despesa_id: v,
                      tipo_despesa_nome: tipo?.nome || '',
                      categoria: tipo?.categoria || '',
                      conta_contabil_id: tipo?.conta_contabil_padrao_id || '',
                      conta_contabil_nome: tipo?.conta_contabil_padrao_nome || '',
                      centro_resultado_id: tipo?.centro_resultado_padrao_id || '',
                      centro_resultado_nome: tipo?.centro_resultado_padrao_nome || '',
                    });
                  }}
                  required
                >
                  <SelectTrigger><SelectValue placeholder="Selecione um tipo..." /></SelectTrigger>
                  <SelectContent>
                    {tiposDespesa.map(td => (
                      <SelectItem key={td.id} value={td.id}>{td.nome} ({td.categoria})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 mt-1">
                  A categoria e contas contábeis serão herdadas do Tipo de Despesa
                </p>
              </div>

              <div>
                <Label>Descrição da Despesa *</Label>
                <Input
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Ex: Aluguel Loja Centro"
                  required
                />
              </div>

              <div>
                <Label>Empresa Proprietária *</Label>
                <Select
                  value={formData.empresa_id || ''}
                  onValueChange={(v) => setFormData({ ...formData, empresa_id: v, origem: 'empresa' })}
                  required={!formData.rateio_automatico}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione a empresa..." /></SelectTrigger>
                  <SelectContent>
                    {empresas.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.nome_fantasia || emp.razao_social}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 mt-1">
                  Se usar rateio automático, selecione a empresa-mãe do grupo
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Fornecedor</Label>
                  <Select
                    value={formData.fornecedor_id || ''}
                    onValueChange={(v) => {
                      const fornecedor = fornecedores.find(f => f.id === v);
                      setFormData({
                        ...formData,
                        fornecedor_id: v,
                        fornecedor_nome: fornecedor?.nome || ''
                      });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {fornecedores.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Centro de Custo</Label>
                  <Select
                    value={formData.centro_custo_id || ''}
                    onValueChange={(v) => {
                      const cc = centrosCusto.find(c => c.id === v);
                      setFormData({
                        ...formData,
                        centro_custo_id: v,
                        centro_custo_nome: cc?.descricao || ''
                      });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {centrosCusto.map(cc => (
                        <SelectItem key={cc.id} value={cc.id}>{cc.descricao}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Conta Contábil (Opcional)</Label>
                  <Select
                    value={formData.conta_contabil_id || ''}
                    onValueChange={(v) => {
                      const conta = planoContas.find(pc => pc.id === v);
                      setFormData({
                        ...formData,
                        conta_contabil_id: v,
                        conta_contabil_nome: conta?.nome || ''
                      });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Herda do Tipo ou selecione..." /></SelectTrigger>
                    <SelectContent>
                      {planoContas.map(pc => (
                        <SelectItem key={pc.id} value={pc.id}>{pc.codigo} - {pc.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500 mt-1">
                    Deixe vazio para usar a conta contábil padrão do Tipo de Despesa
                  </p>
                </div>
                <div>
                  <Label>Centro de Resultado (Opcional)</Label>
                  <Select
                    value={formData.centro_resultado_id || ''}
                    onValueChange={(v) => {
                      const centro = centrosResultado.find(cr => cr.id === v);
                      setFormData({
                        ...formData,
                        centro_resultado_id: v,
                        centro_resultado_nome: centro?.nome || ''
                      });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Herda do Tipo ou selecione..." /></SelectTrigger>
                    <SelectContent>
                      {centrosResultado.map(cr => (
                        <SelectItem key={cr.id} value={cr.id}>{cr.codigo} - {cr.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500 mt-1">
                    Deixe vazio para usar o centro de resultado padrão do Tipo de Despesa
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Valor Base *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.valor_base}
                    onChange={(e) => setFormData({ ...formData, valor_base: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div>
                  <Label>Forma de Pagamento Padrão</Label>
                  <Select
                    value={formData.forma_pagamento_id || ''}
                    onValueChange={(v) => {
                      const forma = formasPagamento.find(f => f.id === v);
                      setFormData({
                        ...formData,
                        forma_pagamento_id: v,
                        forma_pagamento_nome: forma?.descricao || ''
                      });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {formasPagamento.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.descricao}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="recorrencia" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Periodicidade *</Label>
                  <Select
                    value={formData.periodicidade}
                    onValueChange={(v) => setFormData({ ...formData, periodicidade: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Semanal">Semanal</SelectItem>
                      <SelectItem value="Quinzenal">Quinzenal</SelectItem>
                      <SelectItem value="Mensal">Mensal</SelectItem>
                      <SelectItem value="Bimestral">Bimestral</SelectItem>
                      <SelectItem value="Trimestral">Trimestral</SelectItem>
                      <SelectItem value="Semestral">Semestral</SelectItem>
                      <SelectItem value="Anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Dia do Vencimento</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.dia_vencimento}
                    onChange={(e) => setFormData({ ...formData, dia_vencimento: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data Início *</Label>
                  <Input
                    type="date"
                    value={formData.data_inicio}
                    onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Data Fim (Opcional)</Label>
                  <Input
                    type="date"
                    value={formData.data_fim}
                    onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Meses de Aplicação</Label>
                <div className="grid grid-cols-4 gap-2">
                  {mesesAno.map((mes) => (
                    <div key={mes.value} className="flex items-center space-x-2">
                      <Checkbox
                        checked={formData.meses_aplicacao?.includes(mes.value)}
                        onCheckedChange={(checked) => {
                          const novos = checked
                            ? [...(formData.meses_aplicacao || []), mes.value]
                            : (formData.meses_aplicacao || []).filter(m => m !== mes.value);
                          setFormData({ ...formData, meses_aplicacao: novos });
                        }}
                      />
                      <label className="text-xs">{mes.label}</label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Ajustar por Inflação</Label>
                  <p className="text-xs text-slate-500">Aplicar reajuste anual automático</p>
                </div>
                <Switch
                  checked={formData.ajuste_inflacao}
                  onCheckedChange={(checked) => setFormData({ ...formData, ajuste_inflacao: checked })}
                />
              </div>

              {formData.ajuste_inflacao && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Índice de Ajuste</Label>
                    <Select
                      value={formData.indice_ajuste}
                      onValueChange={(v) => setFormData({ ...formData, indice_ajuste: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IPCA">IPCA</SelectItem>
                        <SelectItem value="IGP-M">IGP-M</SelectItem>
                        <SelectItem value="INPC">INPC</SelectItem>
                        <SelectItem value="CDI">CDI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>% Ajuste Anual Previsto</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.percentual_ajuste_anual}
                      onChange={(e) => setFormData({ ...formData, percentual_ajuste_anual: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="automacao" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Gerar Automaticamente</Label>
                  <p className="text-xs text-slate-500">Criar títulos automaticamente</p>
                </div>
                <Switch
                  checked={formData.gerar_automaticamente}
                  onCheckedChange={(checked) => setFormData({ ...formData, gerar_automaticamente: checked })}
                />
              </div>

              {formData.gerar_automaticamente && (
                <>
                  <div>
                    <Label>Antecedência (Dias)</Label>
                    <Input
                      type="number"
                      value={formData.antecedencia_dias}
                      onChange={(e) => setFormData({ ...formData, antecedencia_dias: parseInt(e.target.value) })}
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Quantos dias antes do vencimento gerar o título
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Notificar na Criação</Label>
                      <p className="text-xs text-slate-500">Enviar notificação ao criar título</p>
                    </div>
                    <Switch
                      checked={formData.notificar_criacao}
                      onCheckedChange={(checked) => setFormData({ ...formData, notificar_criacao: checked })}
                    />
                  </div>
                </>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <Label>Configuração Ativa</Label>
                  <p className="text-xs text-slate-500">Ativar/desativar esta despesa recorrente</p>
                </div>
                <Switch
                  checked={formData.ativa}
                  onCheckedChange={(checked) => setFormData({ ...formData, ativa: checked })}
                />
              </div>
            </TabsContent>

            <TabsContent value="rateio" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Rateio Automático entre Empresas</Label>
                  <p className="text-xs text-slate-500">Distribuir despesa entre filiais</p>
                </div>
                <Switch
                  checked={formData.rateio_automatico}
                  onCheckedChange={(checked) => setFormData({ ...formData, rateio_automatico: checked })}
                />
              </div>

              {formData.rateio_automatico && (
                <div className="space-y-2">
                  <Label>Empresas para Rateio</Label>
                  {empresas.map((empresa) => {
                    const rateio = formData.empresas_rateio?.find(e => e.empresa_id === empresa.id);
                    return (
                      <div key={empresa.id} className="flex items-center gap-3 p-2 border rounded">
                        <Checkbox
                          checked={!!rateio}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFormData({
                                ...formData,
                                empresas_rateio: [
                                  ...(formData.empresas_rateio || []),
                                  { empresa_id: empresa.id, empresa_nome: empresa.nome_fantasia, percentual: 0 }
                                ]
                              });
                            } else {
                              setFormData({
                                ...formData,
                                empresas_rateio: (formData.empresas_rateio || []).filter(e => e.empresa_id !== empresa.id)
                              });
                            }
                          }}
                        />
                        <span className="flex-1 text-sm">{empresa.nome_fantasia}</span>
                        {rateio && (
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="%"
                            className="w-20"
                            value={rateio.percentual}
                            onChange={(e) => {
                              setFormData({
                                ...formData,
                                empresas_rateio: formData.empresas_rateio.map(er =>
                                  er.empresa_id === empresa.id
                                    ? { ...er, percentual: parseFloat(e.target.value) }
                                    : er
                                )
                              });
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <div className={windowMode ? "border-t bg-slate-50 p-4" : "mt-6"}>
          <div className="flex justify-end gap-3">
            <Button type="submit" className="bg-purple-600 hover:bg-purple-700">
              <Repeat className="w-4 h-4 mr-2" />
              {config ? 'Atualizar Configuração' : 'Criar Configuração'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}