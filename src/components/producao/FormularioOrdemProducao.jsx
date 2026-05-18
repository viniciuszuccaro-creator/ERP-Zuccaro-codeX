import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Save, Zap, Package, AlertTriangle, Factory, CheckCircle2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SeletorProdutosProducao from "./SeletorProdutosProducao";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";

/**
 * V21.6 - FORMULÁRIO DE ORDEM DE PRODUÇÃO COMPLETO
 * ✅ Integração com seletor de produtos de produção
 * ✅ Validação de estoque de matéria-prima
 * ✅ IA para sugestões de produção
 * ✅ Alerta de produtos insuficientes
 */
export default function FormularioOrdemProducao({ op, onClose }) {
  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, filterInContext, createInContext, updateInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { user } = useUser();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || op?.group_id || null;
  const empresaId = op?.empresa_id || empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const contextKey = groupId ? `grupo:${groupId}` : `empresa:${empresaId || "sem-empresa"}`;
  const canCreateOP = hasPermission("Produção", "Ordens Produção", "criar") || hasPermission("Produção", "OrdemProducao", "criar");
  const canEditOP = hasPermission("Produção", "Ordens Produção", "editar") || hasPermission("Produção", "OrdemProducao", "editar");
  const canUseIA = hasPermission("Produção", "IA", "executar") || hasPermission("Produção", "Ordens Produção", "ia");
  const [formData, setFormData] = useState(op || {
    numero_op: "",
    tipo_producao: "Armado Padrão",
    pedido_id: "",
    cliente_nome: "",
    peso_total_kg: 0,
    prioridade: "Normal",
    status: "Planejada",
    observacoes: "",
    itens: []
  });

  const [seletorProdutoAberto, setSeletorProdutoAberto] = useState(false);
  const [produtosInsuficientes, setProdutosInsuficientes] = useState([]);

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos-producao-form", contextKey],
    queryFn: () => filterInContext("Pedido", {}, "-created_date", 500),
    enabled: contextoValido,
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas-producao-form", contextKey],
    queryFn: () => filterInContext("Empresa", {}, "nome_fantasia", 500, "id"),
    enabled: contextoValido,
  });

  const { data: produtosProducao = [] } = useQuery({
    queryKey: ['produtos-producao', contextKey],
    queryFn: async () => {
      const all = await filterInContext("Produto", {}, "descricao", 1000);
      return all.filter(p => 
        p.tipo_item === 'Matéria-Prima Produção' && 
        p.status === 'Ativo'
      );
    },
    enabled: contextoValido,
  });

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (!contextoValido) throw new Error("Contexto multiempresa obrigatório.");
      if (!data.empresa_id) throw new Error("Empresa de produção obrigatória.");
      if (op?.id && !canEditOP) throw new Error("Seu perfil não pode editar OP.");
      if (!op?.id && !canCreateOP) throw new Error("Seu perfil não pode criar OP.");
      if (op?.id) {
        return updateInContext('OrdemProducao', op.id, data);
      }
      return createInContext('OrdemProducao', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordens-producao"] });
      toast.success(op?.id ? "OP atualizada!" : "OP criada!");
      if (onClose) onClose();
    },
  });

  const handleGerarIA = async () => {
    if (!canUseIA) {
      toast.error("Seu perfil não pode usar IA em Produção.");
      return;
    }
    toast.info("🤖 IA analisando pedido...");
    
    try {
      const pedido = pedidos.find(p => p.id === formData.pedido_id);
      if (!pedido) {
        toast.error("Selecione um pedido primeiro");
        return;
      }

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analise este pedido e sugira otimização de produção:
        
Pedido: ${pedido.numero_pedido}
Cliente: ${pedido.cliente_nome}
Itens Armado: ${JSON.stringify(pedido.itens_armado_padrao || [])}
Itens Corte/Dobra: ${JSON.stringify(pedido.itens_corte_dobra || [])}

Retorne sugestões de:
1. Sequenciamento de produção
2. Otimização de corte
3. Previsão de tempo
4. Riscos e gargalos`,
        response_json_schema: {
          type: "object",
          properties: {
            sequenciamento_sugerido: { type: "string" },
            otimizacao_corte: { type: "string" },
            tempo_previsto_horas: { type: "number" },
            riscos_identificados: { type: "array", items: { type: "string" } },
            gargalos: { type: "array", items: { type: "string" } }
          }
        }
      });

      setFormData(prev => ({
        ...prev,
        gargalos_detectados: result.gargalos?.map(g => ({
          tipo: "Gargalo Produtivo",
          descricao: g,
          impacto: "Médio",
          sugestao_ia: result.otimizacao_corte
        })) || [],
        observacoes: prev.observacoes + `\n\n🤖 Análise IA:\n${result.sequenciamento_sugerido}\n\nOtimização: ${result.otimizacao_corte}`
      }));

      toast.success("✅ IA gerou sugestões!");
    } catch (error) {
      toast.error("Erro ao gerar sugestões IA");
    }
  };

  // V21.6: Validar estoque de matéria-prima
  const validarEstoque = () => {
    const insuficientes = [];
    
    (formData.itens || []).forEach(item => {
      const produto = produtosProducao.find(p => p.id === item.produto_id);
      if (produto) {
        const estoqueDisponivel = produto.estoque_disponivel || produto.estoque_atual || 0;
        if (estoqueDisponivel < item.quantidade) {
          insuficientes.push({
            produto: produto.descricao,
            necessario: item.quantidade,
            disponivel: estoqueDisponivel,
            faltante: item.quantidade - estoqueDisponivel
          });
        }
      }
    });

    setProdutosInsuficientes(insuficientes);
    return insuficientes.length === 0;
  };

  const adicionarProduto = (produto) => {
    const itemExistente = formData.itens?.find(i => i.produto_id === produto.id);
    
    if (itemExistente) {
      toast.info("Produto já adicionado. Ajuste a quantidade.");
      return;
    }

    setFormData(prev => ({
      ...prev,
      itens: [
        ...(prev.itens || []),
        {
          produto_id: produto.id,
          descricao: produto.descricao,
          codigo: produto.codigo,
          quantidade: 0,
          unidade: produto.unidade_principal,
          peso_teorico_kg_m: produto.peso_teorico_kg_m || 0,
          estoque_disponivel: produto.estoque_disponivel || produto.estoque_atual || 0
        }
      ]
    }));
    
    setSeletorProdutoAberto(false);
    toast.success(`✅ ${produto.descricao} adicionado`);
  };

  const atualizarQuantidadeItem = (index, quantidade) => {
    const novosItens = [...(formData.itens || [])];
    novosItens[index].quantidade = parseFloat(quantidade) || 0;
    setFormData(prev => ({ ...prev, itens: novosItens }));
  };

  const removerItem = (index) => {
    setFormData(prev => ({
      ...prev,
      itens: (prev.itens || []).filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!contextoValido) {
      toast.error("Selecione o Grupo CPA ou uma empresa antes de salvar OP.");
      return;
    }

    if (!formData.numero_op?.trim()) {
      toast.error("Informe o número da OP.");
      return;
    }

    if (!formData.empresa_id) {
      toast.error("Informe a empresa de produção.");
      return;
    }
    
    if (!validarEstoque()) {
      toast.error("❌ Estoque insuficiente de matéria-prima!");
      return;
    }
    
    saveMutation.mutate({
      ...formData,
      empresa_id: formData.empresa_id || empresaId,
      group_id: formData.group_id || groupId,
      usuario_responsavel: formData.usuario_responsavel || user?.full_name || user?.email,
      usuario_responsavel_id: formData.usuario_responsavel_id || user?.id,
    });
  };

  return (
    <div className="h-full flex flex-col bg-white w-full">
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
        <div className="flex-1 overflow-auto p-6">
          <Tabs defaultValue="geral" className="h-full">
            <TabsList>
              <TabsTrigger value="geral">Geral</TabsTrigger>
              <TabsTrigger value="materiaprima">
                <Factory className="w-4 h-4 mr-2" />
                Matéria-Prima
              </TabsTrigger>
              <TabsTrigger value="engenharia">Engenharia</TabsTrigger>
              <TabsTrigger value="apontamentos">Apontamentos</TabsTrigger>
            </TabsList>

            <TabsContent value="geral" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Número OP *</Label>
                  <Input
                    value={formData.numero_op}
                    onChange={(e) => setFormData({ ...formData, numero_op: e.target.value })}
                    placeholder="OP-2025-001"
                    required
                  />
                </div>

                <div>
                  <Label>Tipo de Produção *</Label>
                  <select
                    value={formData.tipo_producao}
                    onChange={(e) => setFormData({ ...formData, tipo_producao: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option>Armado Padrão</option>
                    <option>Corte e Dobra</option>
                    <option>Produção Sob Medida</option>
                    <option>Misto</option>
                  </select>
                </div>

                <div>
                  <Label>Pedido Origem</Label>
                  <select
                    value={formData.pedido_id}
                    onChange={(e) => {
                      const pedido = pedidos.find(p => p.id === e.target.value);
                      setFormData({
                        ...formData,
                        pedido_id: e.target.value,
                        numero_pedido: pedido?.numero_pedido,
                        cliente_id: pedido?.cliente_id,
                        cliente_nome: pedido?.cliente_nome,
                      });
                    }}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">Selecione...</option>
                    {pedidos.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.numero_pedido} - {p.cliente_nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label>Cliente</Label>
                  <Input
                    value={formData.cliente_nome}
                    onChange={(e) => setFormData({ ...formData, cliente_nome: e.target.value })}
                    placeholder="Nome do cliente"
                  />
                </div>

                <div>
                  <Label>Empresa Produção</Label>
                  <select
                    value={formData.empresa_id}
                    onChange={(e) => setFormData({ ...formData, empresa_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">Selecione...</option>
                    {empresas.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.nome_fantasia || emp.razao_social}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label>Peso Total (KG)</Label>
                  <Input
                    type="number"
                    value={formData.peso_total_kg}
                    onChange={(e) => setFormData({ ...formData, peso_total_kg: parseFloat(e.target.value) })}
                  />
                </div>

                <div>
                  <Label>Prioridade</Label>
                  <select
                    value={formData.prioridade}
                    onChange={(e) => setFormData({ ...formData, prioridade: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option>Baixa</option>
                    <option>Normal</option>
                    <option>Alta</option>
                    <option>Urgente</option>
                  </select>
                </div>

                <div>
                  <Label>Status</Label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option>Planejada</option>
                    <option>Aguardando Matéria-Prima</option>
                    <option>Em Corte</option>
                    <option>Em Dobra</option>
                    <option>Em Montagem</option>
                    <option>Inspeção</option>
                    <option>Pronto para Expedição</option>
                    <option>Concluída</option>
                  </select>
                </div>
              </div>

              <div>
                <Label>Observações</Label>
                <Textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  rows={4}
                  placeholder="Observações sobre a ordem de produção..."
                />
              </div>

              {formData.pedido_id && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      Otimização com IA
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button
                      type="button"
                      onClick={handleGerarIA}
                      variant="outline"
                      className="w-full"
                      disabled={!canUseIA}
                      data-permission="Produção.Ordens Produção.ia"
                      data-action="gerar-sugestoes-producao-ia"
                    >
                      🤖 Gerar Sugestões de Produção com IA
                    </Button>
                  </CardContent>
                </Card>
              )}

              {formData.gargalos_detectados?.length > 0 && (
                <Card className="border-orange-200 bg-orange-50">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2 text-orange-700">
                      <AlertTriangle className="w-4 h-4" />
                      Gargalos Detectados pela IA
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {formData.gargalos_detectados.map((g, idx) => (
                      <div key={idx} className="p-3 bg-white rounded border">
                        <p className="font-semibold text-sm">{g.descricao}</p>
                        <p className="text-xs text-slate-600 mt-1">💡 {g.sugestao_ia}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* V21.6: NOVA ABA - Matéria-Prima */}
            <TabsContent value="materiaprima" className="space-y-4 mt-4">
              <Alert className="border-orange-300 bg-orange-50">
                <Factory className="w-5 h-5 text-orange-600" />
                <AlertDescription>
                  <p className="font-semibold text-orange-900 mb-1">🏭 Seleção de Matéria-Prima</p>
                  <p className="text-sm text-orange-700">
                    Apenas produtos configurados como "Matéria-Prima Produção" aparecem aqui
                  </p>
                </AlertDescription>
              </Alert>

              {/* Estatísticas */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="p-4">
                    <p className="text-xs text-blue-700 mb-1">Produtos Disponíveis</p>
                    <p className="text-2xl font-bold text-blue-900">{produtosProducao.length}</p>
                  </CardContent>
                </Card>

                <Card className="border-purple-200 bg-purple-50">
                  <CardContent className="p-4">
                    <p className="text-xs text-purple-700 mb-1">Itens na OP</p>
                    <p className="text-2xl font-bold text-purple-900">{formData.itens?.length || 0}</p>
                  </CardContent>
                </Card>

                <Card className={`${
                  produtosInsuficientes.length > 0 
                    ? 'border-red-300 bg-red-50' 
                    : 'border-green-300 bg-green-50'
                }`}>
                  <CardContent className="p-4">
                    <p className={`text-xs mb-1 ${
                      produtosInsuficientes.length > 0 ? 'text-red-700' : 'text-green-700'
                    }`}>
                      Status Estoque
                    </p>
                    <p className={`text-2xl font-bold ${
                      produtosInsuficientes.length > 0 ? 'text-red-900' : 'text-green-900'
                    }`}>
                      {produtosInsuficientes.length > 0 ? '⚠️ Crítico' : '✅ OK'}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Alertas de Estoque Insuficiente */}
              {produtosInsuficientes.length > 0 && (
                <Alert className="border-red-300 bg-red-50">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <AlertDescription>
                    <p className="font-semibold text-red-900 mb-2">
                      ⚠️ {produtosInsuficientes.length} produto(s) com estoque insuficiente:
                    </p>
                    <div className="space-y-2">
                      {produtosInsuficientes.map((item, idx) => (
                        <div key={idx} className="text-sm text-red-800 p-2 bg-white rounded border border-red-200">
                          <p className="font-semibold">{item.produto}</p>
                          <div className="flex gap-4 text-xs mt-1">
                            <span>Necessário: {item.necessario}</span>
                            <span>Disponível: {item.disponivel}</span>
                            <span className="text-red-600 font-bold">Faltam: {item.faltante.toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Botão Adicionar Produto */}
              <Button
                type="button"
                onClick={() => setSeletorProdutoAberto(true)}
                variant="outline"
                className="w-full border-dashed border-2 border-blue-300 hover:bg-blue-50"
                disabled={op?.id ? !canEditOP : !canCreateOP}
                data-permission="Produção.Ordens Produção.editar"
                data-action="adicionar-materia-prima-op"
              >
                <Package className="w-4 h-4 mr-2" />
                Adicionar Matéria-Prima
              </Button>

              {/* Lista de Produtos Adicionados */}
              {formData.itens && formData.itens.length > 0 && (
                <Card className="border-slate-200">
                  <CardHeader className="bg-slate-50 border-b">
                    <CardTitle className="text-base">
                      Matéria-Prima Selecionada ({formData.itens.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {formData.itens.map((item, idx) => {
                        const estoqueInsuficiente = item.quantidade > item.estoque_disponivel;
                        
                        return (
                          <div 
                            key={idx} 
                            className={`p-4 ${estoqueInsuficiente ? 'bg-red-50' : 'hover:bg-slate-50'}`}
                          >
                            <div className="flex items-center gap-4">
                              <div className="flex-1">
                                <p className="font-semibold text-slate-900">{item.descricao}</p>
                                <p className="text-xs text-slate-600">SKU: {item.codigo}</p>
                              </div>

                              <div className="w-32">
                                <Label className="text-xs">Quantidade</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={item.quantidade}
                                  onChange={(e) => atualizarQuantidadeItem(idx, e.target.value)}
                                  className="text-sm"
                                />
                              </div>

                              <div className="text-right min-w-[100px]">
                                <p className="text-xs text-slate-600">Disponível</p>
                                <p className={`font-bold ${
                                  estoqueInsuficiente ? 'text-red-600' : 'text-green-600'
                                }`}>
                                  {item.estoque_disponivel} {item.unidade}
                                </p>
                              </div>

                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removerItem(idx)}
                                className="text-red-600 hover:bg-red-50"
                              >
                                ✕
                              </Button>
                            </div>

                            {estoqueInsuficiente && (
                              <Alert className="border-red-300 bg-red-100 mt-2">
                                <AlertDescription className="text-xs text-red-800">
                                  ⚠️ Estoque insuficiente! Faltam: {(item.quantidade - item.estoque_disponivel).toFixed(2)} {item.unidade}
                                </AlertDescription>
                              </Alert>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Seletor de Produtos (Modal/Dialog) */}
              {seletorProdutoAberto && (
                <Card className="border-blue-300 bg-blue-50">
                  <CardHeader className="border-b bg-blue-100">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-base">Selecionar Produtos de Produção</CardTitle>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSeletorProdutoAberto(false)}
                      >
                        Fechar
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <SeletorProdutosProducao 
                      onSelecionarProduto={adicionarProduto}
                    />
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="engenharia">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Detalhamento de Peças</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">
                    Detalhamento de engenharia, mapas de corte e sequenciamento serão gerenciados aqui.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="apontamentos">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Apontamentos de Produção</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">
                    Histórico de apontamentos, operadores, máquinas e progresso físico.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="border-t p-4 bg-slate-50 flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            type="submit" 
            disabled={saveMutation.isPending || !contextoValido || !formData.empresa_id || (op?.id ? !canEditOP : !canCreateOP)}
            className="bg-purple-600 hover:bg-purple-700"
            data-permission={op?.id ? "Produção.Ordens Produção.editar" : "Produção.Ordens Produção.criar"}
            data-action={op?.id ? "atualizar-ordem-producao" : "criar-ordem-producao"}
          >
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? "Salvando..." : "Salvar OP"}
          </Button>
        </div>
      </form>
    </div>
  );
}
