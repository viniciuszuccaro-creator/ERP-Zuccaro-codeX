import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { MapPin, Truck, DollarSign, TrendingUp, X, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

const ESTADOS_BRASIL = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export default function RegiaoAtendimentoForm({ regiaoId, regiaoAtendimento, item, data, open, onOpenChange, onSubmit, onSave, onClose, windowMode = false }) {
  const { filterInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const contextoValido = Boolean(empresaAtual?.id || grupoAtual?.id);
  const dadosIniciaisProps = regiaoAtendimento || item || data;
  const [formData, setFormData] = useState(dadosIniciaisProps || {
    nome_regiao: "",
    codigo_regiao: "",
    descricao: "",
    tipo_regiao: "Personalizada",
    estados_abrangidos: [],
    cidades_abrangidas: [],
    cor_identificacao: "#3B82F6",
    vendedores_ids: [],
    transportadoras_preferenciais_ids: [],
    logistica: {
      prazo_entrega_padrao_dias: 0,
      custo_frete_base: 0,
      permite_entrega_expressa: false,
      prazo_entrega_expressa_dias: 0,
      acrescimo_frete_expresso_percentual: 0,
      distancia_centro_distribuicao_km: 0,
      dificuldade_acesso: "Fácil"
    },
    comercial: {
      meta_vendas_mensal: 0,
      comissao_extra_percentual: 0,
      desconto_maximo_permitido_percentual: 0,
      exige_aprovacao_acima_valor: 0,
      prioridade_atendimento: "Normal"
    },
    ativo: true,
    observacoes: ""
  });

  const [novaCidade, setNovaCidade] = useState({ cidade: "", estado: "", cep_inicial: "", cep_final: "" });

  const { data: vendedores = [] } = useQuery({
    queryKey: ['colaboradores-vendedores', empresaAtual?.id || grupoAtual?.id || 'sem-contexto'],
    queryFn: () => filterInContext('Colaborador', {}, 'nome_completo', 500, 'empresa_alocada_id'),
    enabled: contextoValido,
  });

  const { data: transportadoras = [] } = useQuery({
    queryKey: ['transportadoras', empresaAtual?.id || grupoAtual?.id || 'sem-contexto'],
    queryFn: () => filterInContext('Transportadora', {}, 'razao_social', 500, 'empresa_dona_id'),
    enabled: contextoValido,
  });

  useEffect(() => {
    if (dadosIniciaisProps && (open || windowMode)) {
      setFormData(dadosIniciaisProps);
    } else if (regiaoId && open && !dadosIniciaisProps) {
      base44.entities.RegiaoAtendimento.list().then(regioes => {
        const regiao = regioes.find(r => r.id === regiaoId);
        if (regiao) {
          setFormData(regiao);
        }
      });
    } else if (!regiaoId && !dadosIniciaisProps && open) {
      setFormData({
        nome_regiao: "",
        codigo_regiao: "",
        descricao: "",
        tipo_regiao: "Personalizada",
        estados_abrangidos: [],
        cidades_abrangidas: [],
        cor_identificacao: "#3B82F6",
        vendedores_ids: [],
        transportadoras_preferenciais_ids: [],
        logistica: {
          prazo_entrega_padrao_dias: 0,
          custo_frete_base: 0,
          permite_entrega_expressa: false,
          prazo_entrega_expressa_dias: 0,
          acrescimo_frete_expresso_percentual: 0,
          distancia_centro_distribuicao_km: 0,
          dificuldade_acesso: "Fácil"
        },
        comercial: {
          meta_vendas_mensal: 0,
          comissao_extra_percentual: 0,
          desconto_maximo_permitido_percentual: 0,
          exige_aprovacao_acima_valor: 0,
          prioridade_atendimento: "Normal"
        },
        ativo: true,
        observacoes: ""
      });
    }
  }, [regiaoId, open]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!contextoValido) {
      toast.error("Selecione um grupo ou empresa antes de salvar a regiÃ£o.");
      return;
    }
    if (!formData.nome_regiao) {
      toast.error("Nome da região é obrigatório");
      return;
    }
    if (onSubmit) {
      onSubmit(formData);
      if (onOpenChange) onOpenChange(false);
    } else {
      if (onOpenChange) onOpenChange(false);
      if (onSave) onSave();
      if (onClose) onClose();
    }
  };

  const handleExcluir = () => {
    if (window.confirm("Tem certeza que deseja excluir esta região?")) {
      onSubmit({ ...formData, _delete: true });
      onOpenChange(false);
    }
  };

  const handleAlternarStatus = () => {
    setFormData({ ...formData, ativo: !formData.ativo });
  };

  const adicionarCidade = () => {
    if (!novaCidade.cidade || !novaCidade.estado) {
      toast.error("Preencha cidade e estado");
      return;
    }
    setFormData({
      ...formData,
      cidades_abrangidas: [...formData.cidades_abrangidas, { ...novaCidade }]
    });
    setNovaCidade({ cidade: "", estado: "", cep_inicial: "", cep_final: "" });
  };

  const removerCidade = (index) => {
    setFormData({
      ...formData,
      cidades_abrangidas: formData.cidades_abrangidas.filter((_, i) => i !== index)
    });
  };

  const toggleEstado = (estado) => {
    const estados = formData.estados_abrangidos.includes(estado)
      ? formData.estados_abrangidos.filter(e => e !== estado)
      : [...formData.estados_abrangidos, estado];
    setFormData({ ...formData, estados_abrangidos: estados });
  };

  const FormContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Tabs defaultValue="geral" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="geral" data-permission="Cadastros.RegiaoAtendimento.visualizar" data-action="Cadastros.RegiaoAtendimento.tab.geral">
            <MapPin className="w-4 h-4 mr-2" />
            Geral
          </TabsTrigger>
          <TabsTrigger value="logistica" data-permission="Cadastros.RegiaoAtendimento.visualizar" data-action="Cadastros.RegiaoAtendimento.tab.logistica">
            <Truck className="w-4 h-4 mr-2" />
            Logística
          </TabsTrigger>
          <TabsTrigger value="comercial" data-permission="Cadastros.RegiaoAtendimento.visualizar" data-action="Cadastros.RegiaoAtendimento.tab.comercial">
            <DollarSign className="w-4 h-4 mr-2" />
            Comercial
          </TabsTrigger>
          <TabsTrigger value="metricas" data-permission="Cadastros.RegiaoAtendimento.visualizar" data-action="Cadastros.RegiaoAtendimento.tab.metricas">
            <TrendingUp className="w-4 h-4 mr-2" />
            Métricas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nome_regiao">Nome da Região *</Label>
              <Input
                id="nome_regiao"
                value={formData.nome_regiao}
                onChange={(e) => setFormData({ ...formData, nome_regiao: e.target.value })}
                placeholder="Ex: Grande São Paulo"
              />
            </div>

            <div>
              <Label htmlFor="codigo_regiao">Código</Label>
              <Input
                id="codigo_regiao"
                value={formData.codigo_regiao}
                onChange={(e) => setFormData({ ...formData, codigo_regiao: e.target.value })}
                placeholder="Ex: GSP"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tipo_regiao">Tipo de Região</Label>
              <Select value={formData.tipo_regiao} onValueChange={(value) => setFormData({ ...formData, tipo_regiao: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Macro Região">Macro Região</SelectItem>
                  <SelectItem value="Estado">Estado</SelectItem>
                  <SelectItem value="Região Metropolitana">Região Metropolitana</SelectItem>
                  <SelectItem value="Microrregião">Microrregião</SelectItem>
                  <SelectItem value="Personalizada">Personalizada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="cor_identificacao">Cor de Identificação</Label>
              <div className="flex gap-2">
                <Input
                  id="cor_identificacao"
                  type="color"
                  value={formData.cor_identificacao}
                  onChange={(e) => setFormData({ ...formData, cor_identificacao: e.target.value })}
                  className="w-20"
                />
                <Input
                  value={formData.cor_identificacao}
                  onChange={(e) => setFormData({ ...formData, cor_identificacao: e.target.value })}
                  placeholder="#3B82F6"
                />
              </div>
            </div>
          </div>

          <div>
            <Label>Estados Abrangidos</Label>
            <div className="border rounded-lg p-3 max-h-40 overflow-y-auto">
              <div className="grid grid-cols-7 gap-2">
                {ESTADOS_BRASIL.map(estado => (
                  <Badge
                    key={estado}
                    variant={formData.estados_abrangidos.includes(estado) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleEstado(estado)}
                  >
                    {estado}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <div>
            <Label>Cidades Específicas</Label>
            <div className="border rounded-lg p-3 space-y-2">
              <div className="grid grid-cols-5 gap-2">
                <Input
                  placeholder="Cidade"
                  value={novaCidade.cidade}
                  onChange={(e) => setNovaCidade({ ...novaCidade, cidade: e.target.value })}
                />
                <Select value={novaCidade.estado} onValueChange={(value) => setNovaCidade({ ...novaCidade, estado: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent className="z-[99999]">
                    {ESTADOS_BRASIL.map(estado => (
                      <SelectItem key={estado} value={estado}>{estado}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="CEP Inicial"
                  value={novaCidade.cep_inicial}
                  onChange={(e) => setNovaCidade({ ...novaCidade, cep_inicial: e.target.value })}
                />
                <Input
                  placeholder="CEP Final"
                  value={novaCidade.cep_final}
                  onChange={(e) => setNovaCidade({ ...novaCidade, cep_final: e.target.value })}
                />
                <Button type="button" onClick={adicionarCidade} size="sm">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {formData.cidades_abrangidas.length > 0 && (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {formData.cidades_abrangidas.map((cidade, index) => (
                    <div key={index} className="flex items-center justify-between bg-slate-50 p-2 rounded">
                      <span className="text-sm">
                        {cidade.cidade} - {cidade.estado}
                        {cidade.cep_inicial && ` (${cidade.cep_inicial} - ${cidade.cep_final})`}
                      </span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removerCidade(index)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              rows={3}
            />
          </div>
        </TabsContent>

        <TabsContent value="logistica" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="prazo_entrega_padrao_dias">Prazo Entrega Padrão (dias)</Label>
              <Input
                id="prazo_entrega_padrao_dias"
                type="number"
                value={formData.logistica.prazo_entrega_padrao_dias}
                onChange={(e) => setFormData({
                  ...formData,
                  logistica: { ...formData.logistica, prazo_entrega_padrao_dias: parseFloat(e.target.value) || 0 }
                })}
              />
            </div>

            <div>
              <Label htmlFor="custo_frete_base">Custo Frete Base (R$)</Label>
              <Input
                id="custo_frete_base"
                type="number"
                step="0.01"
                value={formData.logistica.custo_frete_base}
                onChange={(e) => setFormData({
                  ...formData,
                  logistica: { ...formData.logistica, custo_frete_base: parseFloat(e.target.value) || 0 }
                })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <Label htmlFor="permite_entrega_expressa">Permite Entrega Expressa</Label>
            <Switch
              id="permite_entrega_expressa"
              checked={formData.logistica.permite_entrega_expressa}
              onCheckedChange={(checked) => setFormData({
                ...formData,
                logistica: { ...formData.logistica, permite_entrega_expressa: checked }
              })}
            />
          </div>

          {formData.logistica.permite_entrega_expressa && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="prazo_entrega_expressa_dias">Prazo Expressa (dias)</Label>
                <Input
                  id="prazo_entrega_expressa_dias"
                  type="number"
                  value={formData.logistica.prazo_entrega_expressa_dias}
                  onChange={(e) => setFormData({
                    ...formData,
                    logistica: { ...formData.logistica, prazo_entrega_expressa_dias: parseFloat(e.target.value) || 0 }
                  })}
                />
              </div>

              <div>
                <Label htmlFor="acrescimo_frete_expresso_percentual">Acréscimo Expresso (%)</Label>
                <Input
                  id="acrescimo_frete_expresso_percentual"
                  type="number"
                  step="0.01"
                  value={formData.logistica.acrescimo_frete_expresso_percentual}
                  onChange={(e) => setFormData({
                    ...formData,
                    logistica: { ...formData.logistica, acrescimo_frete_expresso_percentual: parseFloat(e.target.value) || 0 }
                  })}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="distancia_centro_distribuicao_km">Distância Centro Distribuição (km)</Label>
              <Input
                id="distancia_centro_distribuicao_km"
                type="number"
                value={formData.logistica.distancia_centro_distribuicao_km}
                onChange={(e) => setFormData({
                  ...formData,
                  logistica: { ...formData.logistica, distancia_centro_distribuicao_km: parseFloat(e.target.value) || 0 }
                })}
              />
            </div>

            <div>
              <Label htmlFor="dificuldade_acesso">Dificuldade de Acesso</Label>
              <Select
                value={formData.logistica.dificuldade_acesso}
                onValueChange={(value) => setFormData({
                  ...formData,
                  logistica: { ...formData.logistica, dificuldade_acesso: value }
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[99999]">
                  <SelectItem value="Fácil">Fácil</SelectItem>
                  <SelectItem value="Moderado">Moderado</SelectItem>
                  <SelectItem value="Difícil">Difícil</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="comercial" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="meta_vendas_mensal">Meta de Vendas Mensal (R$)</Label>
              <Input
                id="meta_vendas_mensal"
                type="number"
                step="0.01"
                value={formData.comercial.meta_vendas_mensal}
                onChange={(e) => setFormData({
                  ...formData,
                  comercial: { ...formData.comercial, meta_vendas_mensal: parseFloat(e.target.value) || 0 }
                })}
              />
            </div>

            <div>
              <Label htmlFor="comissao_extra_percentual">Comissão Extra (%)</Label>
              <Input
                id="comissao_extra_percentual"
                type="number"
                step="0.01"
                value={formData.comercial.comissao_extra_percentual}
                onChange={(e) => setFormData({
                  ...formData,
                  comercial: { ...formData.comercial, comissao_extra_percentual: parseFloat(e.target.value) || 0 }
                })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="desconto_maximo_permitido_percentual">Desconto Máximo (%)</Label>
              <Input
                id="desconto_maximo_permitido_percentual"
                type="number"
                step="0.01"
                value={formData.comercial.desconto_maximo_permitido_percentual}
                onChange={(e) => setFormData({
                  ...formData,
                  comercial: { ...formData.comercial, desconto_maximo_permitido_percentual: parseFloat(e.target.value) || 0 }
                })}
              />
            </div>

            <div>
              <Label htmlFor="exige_aprovacao_acima_valor">Exige Aprovação Acima de (R$)</Label>
              <Input
                id="exige_aprovacao_acima_valor"
                type="number"
                step="0.01"
                value={formData.comercial.exige_aprovacao_acima_valor}
                onChange={(e) => setFormData({
                  ...formData,
                  comercial: { ...formData.comercial, exige_aprovacao_acima_valor: parseFloat(e.target.value) || 0 }
                })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="prioridade_atendimento">Prioridade de Atendimento</Label>
            <Select
              value={formData.comercial.prioridade_atendimento}
              onValueChange={(value) => setFormData({
                ...formData,
                comercial: { ...formData.comercial, prioridade_atendimento: value }
              })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[99999]">
                <SelectItem value="Baixa">Baixa</SelectItem>
                <SelectItem value="Normal">Normal</SelectItem>
                <SelectItem value="Alta">Alta</SelectItem>
                <SelectItem value="Urgente">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TabsContent>

        <TabsContent value="metricas" className="space-y-4 mt-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <TrendingUp className="w-4 h-4 inline mr-2" />
              As métricas são calculadas automaticamente pela IA com base nas vendas e entregas realizadas nesta região.
            </p>
          </div>

          {formData.metricas && (
            <div className="grid grid-cols-2 gap-4">
              <div className="border rounded-lg p-3">
                <Label className="text-xs text-slate-500">Total de Clientes</Label>
                <p className="text-2xl font-bold">{formData.metricas.total_clientes || 0}</p>
              </div>

              <div className="border rounded-lg p-3">
                <Label className="text-xs text-slate-500">Pedidos/Mês</Label>
                <p className="text-2xl font-bold">{formData.metricas.total_pedidos_mes || 0}</p>
              </div>

              <div className="border rounded-lg p-3">
                <Label className="text-xs text-slate-500">Vendido/Mês</Label>
                <p className="text-2xl font-bold">R$ {(formData.metricas.valor_vendido_mes || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>

              <div className="border rounded-lg p-3">
                <Label className="text-xs text-slate-500">Ticket Médio</Label>
                <p className="text-2xl font-bold">R$ {(formData.metricas.ticket_medio || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>

              <div className="border rounded-lg p-3">
                <Label className="text-xs text-slate-500">Tempo Médio Entrega</Label>
                <p className="text-2xl font-bold">{formData.metricas.tempo_medio_entrega_dias || 0} dias</p>
              </div>

              <div className="border rounded-lg p-3">
                <Label className="text-xs text-slate-500">Taxa Sucesso Entregas</Label>
                <p className="text-2xl font-bold">{formData.metricas.taxa_sucesso_entregas_percentual || 0}%</p>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="flex justify-between pt-4 border-t">
        <div className="flex gap-2">
          {regiaoId && (
            <>
              <Button
                type="button"
                variant={formData.ativo ? "outline" : "default"}
                onClick={handleAlternarStatus}
                data-permission="Cadastros.RegiaoAtendimento.editar"
                data-action="Cadastros.RegiaoAtendimento.alternar-status"
                data-sensitive="true"
              >
                {formData.ativo ? "Inativar" : "Ativar"}
              </Button>
              <Button type="button" variant="destructive" onClick={handleExcluir} data-permission="Cadastros.RegiaoAtendimento.excluir" data-action="Cadastros.RegiaoAtendimento.excluir" data-sensitive="true">
                Excluir
              </Button>
            </>
          )}
        </div>
        <Button type="submit" disabled={!contextoValido} data-permission="Cadastros.RegiaoAtendimento.editar" data-action="Cadastros.RegiaoAtendimento.salvar" data-sensitive="true">
          {regiaoId || dadosIniciaisProps ? "Atualizar" : "Criar"} Região
        </Button>
      </div>
    </form>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full bg-white rounded-lg border border-slate-200 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">
            {regiaoId ? "Editar" : "Nova"} Região de Atendimento
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {FormContent}
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{regiaoId ? "Editar" : "Nova"} Região de Atendimento</DialogTitle>
        </DialogHeader>
        {FormContent}
      </DialogContent>
    </Dialog>
  );
}
