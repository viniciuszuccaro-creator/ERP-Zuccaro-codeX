import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Send, Eye, CheckCircle2, TrendingUp, Award, FileText, ShoppingCart, AlertCircle, Building2, Package } from "lucide-react";
import CotacaoForm from "./CotacaoForm";
import { useWindow } from "@/components/lib/useWindow";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { toast as sonnerToast } from "sonner";

export default function CotacoesTab({ windowMode = false }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cotacaoSelecionada, setCotacaoSelecionada] = useState(null);
  const [comparativoModal, setComparativoModal] = useState(null);
  const { openWindow } = useWindow();
  const { hasPermission } = usePermissions();
  const { empresaAtual, grupoAtual, contexto, filterInContext, createInContext } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const canViewCotacao = hasPermission('Compras', 'Cotacao', 'visualizar') || hasPermission('Compras', null, 'visualizar');
  const canCreateCotacao = hasPermission('Compras', 'Cotacao', 'criar') || hasPermission('Compras', null, 'criar');
  const canGerarOC = hasPermission('Compras', 'Cotacao', 'gerar_oc') || hasPermission('Compras', 'OrdemCompra', 'criar') || hasPermission('Compras', null, 'criar');

  const auditCotacao = async ({ acao, sucesso = true, motivo = null, dados = {} }) => {
    try {
      await createInContext('AuditLog', {
        acao,
        modulo: 'Compras',
        entidade: 'Cotacao',
        tipo_auditoria: sucesso ? 'entidade' : 'seguranca',
        descricao: motivo || 'Auditoria de cotacoes de compras.',
        dados_novos: dados,
        group_id: groupId,
        grupo_id: groupId,
        empresa_id: empresaId,
        sucesso,
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('Falha ao auditar cotacao:', error);
    }
  };
  const [formCotacao, setFormCotacao] = useState({
    descricao: "",
    data_limite_resposta: "",
    itens: [{ produto_descricao: "", quantidade: 0, unidade: "UN", observacoes: "" }],
    fornecedores_selecionados: [],
    observacoes_gerais: ""
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: fornecedores = [] } = useQuery({
    queryKey: ['fornecedores-cotacao', groupId, empresaId, contexto],
    queryFn: () => filterInContext('Fornecedor', {}, 'nome', 9999),
    enabled: contextoValido && canViewCotacao,
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos-cotacao', groupId, empresaId, contexto],
    queryFn: () => filterInContext('Produto', {}, 'descricao', 9999),
    enabled: contextoValido && canViewCotacao,
  });

  // Criar entidade Cotacao (mock local)
  const [cotacoes, setCotacoes] = useState([
    {
      id: "1",
      numero_cotacao: "COT-001",
      descricao: "Cotação de Bitolas - Lote Janeiro",
      data_criacao: "2025-01-15",
      data_limite: "2025-01-20",
      status: "Aguardando Propostas",
      fornecedores_convidados: 3,
      propostas_recebidas: 2,
      itens: [
        { produto_descricao: "Barra 12.5mm CA-50", quantidade: 500, unidade: "KG" },
        { produto_descricao: "Barra 10.0mm CA-50", quantidade: 300, unidade: "KG" }
      ],
      propostas: [
        {
          fornecedor_id: "f1",
          fornecedor_nome: "Aços Fortes Ltda",
          data_proposta: "2025-01-16",
          valor_total: 15500.00,
          prazo_entrega: 7,
          forma_pagamento: "30 dias",
          itens: [
            { produto_descricao: "Barra 12.5mm CA-50", preco_unitario: 25.00, valor_total: 12500.00 },
            { produto_descricao: "Barra 10.0mm CA-50", preco_unitario: 10.00, valor_total: 3000.00 }
          ],
          observacoes: "Entrega em 3 lotes"
        },
        {
          fornecedor_id: "f2",
          fornecedor_nome: "Metalúrgica São Paulo",
          data_proposta: "2025-01-17",
          valor_total: 14800.00,
          prazo_entrega: 10,
          forma_pagamento: "À Vista",
          itens: [
            { produto_descricao: "Barra 12.5mm CA-50", preco_unitario: 24.00, valor_total: 12000.00 },
            { produto_descricao: "Barra 10.0mm CA-50", preco_unitario: 9.33, valor_total: 2800.00 }
          ],
          observacoes: "Entrega única, frete incluso"
        }
      ]
    }
  ]);

  const criarCotacaoMutation = useMutation({
    mutationFn: async (data) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (!contextoValido || !canCreateCotacao) {
        await auditCotacao({
          acao: 'Cotacao.criar_bloqueada',
          sucesso: false,
          motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada',
          dados: { descricao: data.descricao }
        });
        throw new Error(!contextoValido ? 'Selecione grupo ou empresa antes de criar cotacao.' : 'Sem permissao para criar cotacao.');
      }

      const novaCotacao = {
        id: Date.now().toString(),
        numero_cotacao: `COT-${String(cotacoes.length + 1).padStart(3, '0')}`,
        descricao: data.descricao,
        data_criacao: new Date().toISOString().split('T')[0],
        data_limite: data.data_limite_resposta,
        status: "Aguardando Propostas",
        fornecedores_convidados: data.fornecedores_selecionados.length,
        propostas_recebidas: 0,
        itens: data.itens,
        propostas: [],
        group_id: groupId,
        grupo_id: groupId,
        empresa_id: empresaId
      };

      setCotacoes([novaCotacao, ...cotacoes]);
      await auditCotacao({ acao: 'Cotacao.criada', dados: { cotacao_id: novaCotacao.id, fornecedores: novaCotacao.fornecedores_convidados, itens: novaCotacao.itens.length } });
      return novaCotacao;
    },
    onSuccess: () => {
      setDialogOpen(false);
      resetForm();
      toast({
        title: "Cotacao criada",
        description: "Cotacao criada e enviada aos fornecedores"
      });
    },
    onError: (error) => {
      toast({ title: "Cotacao nao criada", description: error?.message || "Erro ao criar cotacao", variant: "destructive" });
    },
  });

  const gerarOrdemCompraMutation = useMutation({
    mutationFn: async (proposta) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (!contextoValido || !canGerarOC) {
        await auditCotacao({
          acao: 'Cotacao.gerar_oc_bloqueada',
          sucesso: false,
          motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada',
          dados: { fornecedor_id: proposta.fornecedor_id, valor_total: proposta.valor_total }
        });
        throw new Error(!contextoValido ? 'Selecione grupo ou empresa antes de gerar OC.' : 'Sem permissao para gerar ordem de compra.');
      }

      const confirmado = window.confirm(`Confirma gerar uma ordem de compra para ${proposta.fornecedor_nome} no valor de R$ ${Number(proposta.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}?`);
      if (!confirmado) {
        await auditCotacao({ acao: 'Cotacao.gerar_oc_cancelada', sucesso: false, motivo: 'confirmacao_cancelada', dados: { fornecedor_id: proposta.fornecedor_id, valor_total: proposta.valor_total } });
        throw new Error('Geracao de OC cancelada pelo usuario.');
      }

      const ordemCompra = {
        fornecedor_id: proposta.fornecedor_id,
        fornecedor_nome: proposta.fornecedor_nome,
        data_solicitacao: new Date().toISOString().split('T')[0],
        valor_total: proposta.valor_total,
        status: "Aprovada",
        itens: proposta.itens.map(item => ({
          descricao: item.produto_descricao,
          quantidade_solicitada: item.quantidade || 1,
          valor_unitario: item.preco_unitario,
          valor_total: item.valor_total
        })),
        condicao_pagamento: proposta.forma_pagamento,
        prazo_entrega_acordado: proposta.prazo_entrega,
        origem: 'cotacao',
        group_id: groupId,
        grupo_id: groupId,
        empresa_id: empresaId
      };

      const criada = await createInContext('OrdemCompra', ordemCompra);
      await auditCotacao({ acao: 'Cotacao.gerar_oc', dados: { ordem_compra_id: criada?.id, fornecedor_id: proposta.fornecedor_id, valor_total: proposta.valor_total } });
      return criada;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordensCompra'] });
      setComparativoModal(null);
      toast({
        title: "Ordem de compra gerada",
        description: "OC criada com sucesso a partir da cotacao"
      });
    },
    onError: (error) => {
      toast({ title: "OC nao gerada", description: error?.message || "Erro ao gerar ordem de compra", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormCotacao({
      descricao: "",
      data_limite_resposta: "",
      itens: [{ produto_descricao: "", quantidade: 0, unidade: "UN", observacoes: "" }],
      fornecedores_selecionados: [],
      observacoes_gerais: ""
    });
  };

  const adicionarItem = () => {
    setFormCotacao({
      ...formCotacao,
      itens: [...formCotacao.itens, { produto_descricao: "", quantidade: 0, unidade: "UN", observacoes: "" }]
    });
  };

  const removerItem = (index) => {
    setFormCotacao({
      ...formCotacao,
      itens: formCotacao.itens.filter((_, i) => i !== index)
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    criarCotacaoMutation.mutate(formCotacao);
  };

  const toggleFornecedor = (fornecedorId) => {
    const selecionados = formCotacao.fornecedores_selecionados.includes(fornecedorId)
      ? formCotacao.fornecedores_selecionados.filter(id => id !== fornecedorId)
      : [...formCotacao.fornecedores_selecionados, fornecedorId];
    
    setFormCotacao({ ...formCotacao, fornecedores_selecionados: selecionados });
  };

  const getStatusColor = (status) => {
    const cores = {
      'Aguardando Propostas': 'bg-yellow-100 text-yellow-700 border-yellow-300',
      'Em Análise': 'bg-blue-100 text-blue-700 border-blue-300',
      'Aprovada': 'bg-green-100 text-green-700 border-green-300',
      'OC Gerada': 'bg-purple-100 text-purple-700 border-purple-300',
      'Cancelada': 'bg-red-100 text-red-700 border-red-300',
    };
    return cores[status] || 'bg-slate-100 text-slate-700';
  };

  const content = (
    <div className="space-y-2 w-full h-full" data-permission="Compras.Cotacao.visualizar" data-context-required="group-or-company" data-context-mode={contexto}>
      {(!contextoValido || !canViewCotacao) && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-900">
            Selecione grupo ou empresa e confirme permissão para visualizar cotações.
          </CardContent>
        </Card>
      )}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Sistema de Cotações</h2>
          <p className="text-sm text-slate-600">Cote com múltiplos fornecedores e escolha a melhor proposta</p>
        </div>
        {canCreateCotacao && (
          <Button
            className="bg-cyan-600 hover:bg-cyan-700"
            disabled={!contextoValido || !canCreateCotacao}
            data-permission="Compras.Cotacao.criar"
            data-action="Compras.Cotacao.abrirJanela"
            data-context-required="group-or-company"
            onClick={() => openWindow(CotacaoForm, {
              windowMode: true,
              onSubmit: async (data) => {
                try {
                  await criarCotacaoMutation.mutateAsync(data);
                  sonnerToast.success("✅ Cotação criada e enviada!");
                } catch (error) {
                  sonnerToast.error("Erro ao criar cotação");
                }
              }
            }, {
              title: '📊 Nova Cotação de Compras',
              width: 1100,
              height: 700
            })}
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Cotação
          </Button>
        )}

        <Dialog open={false}>
          <DialogTrigger asChild>
            <Button
              className="hidden"
              data-permission="Compras.Cotacao.criar"
              data-action="Compras.Cotacao.dialogLegado"
              data-context-required="group-or-company"
            >
              Removido
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nova Cotação de Compras</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={handleSubmit}
              className="space-y-6"
              data-permission="Compras.Cotacao.criar"
              data-action="Compras.Cotacao.formularioLegado"
              data-context-required="group-or-company"
            >
              <div>
                <Label>Descrição da Cotação *</Label>
                <Input
                  value={formCotacao.descricao}
                  onChange={(e) => setFormCotacao({ ...formCotacao, descricao: e.target.value })}
                  data-permission="Compras.Cotacao.criar"
                  data-action="Compras.Cotacao.descricao"
                  data-context-required="group-or-company"
                  placeholder="Ex: Cotação de Bitolas - Lote Fevereiro"
                  required
                />
              </div>

              <div>
                <Label>Data Limite para Respostas *</Label>
                <Input
                  type="date"
                  value={formCotacao.data_limite_resposta}
                  onChange={(e) => setFormCotacao({ ...formCotacao, data_limite_resposta: e.target.value })}
                  data-permission="Compras.Cotacao.criar"
                  data-action="Compras.Cotacao.dataLimite"
                  data-context-required="group-or-company"
                  required
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-3">
                  <Label>Itens para Cotação *</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={adicionarItem}
                    data-permission="Compras.Cotacao.criar"
                    data-action="Compras.Cotacao.adicionarItem"
                    data-context-required="group-or-company"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Item
                  </Button>
                </div>
                <div className="space-y-3">
                  {formCotacao.itens.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-3 items-start p-3 bg-slate-50 rounded-lg">
                      <div className="col-span-5">
                        <Select
                          value={item.produto_descricao}
                          onValueChange={(value) => {
                            const novosItens = [...formCotacao.itens];
                            novosItens[idx].produto_descricao = value;
                            setFormCotacao({ ...formCotacao, itens: novosItens });
                          }}
                        >
                          <SelectTrigger
                            data-permission="Compras.Cotacao.criar"
                            data-action="Compras.Cotacao.itemProduto"
                            data-context-required="group-or-company"
                          >
                            <SelectValue placeholder="Selecione o produto" />
                          </SelectTrigger>
                          <SelectContent>
                            {produtos.map(p => (
                              <SelectItem key={p.id} value={p.descricao}>
                                {p.codigo} - {p.descricao}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          value={item.quantidade}
                          onChange={(e) => {
                            const novosItens = [...formCotacao.itens];
                            novosItens[idx].quantidade = parseFloat(e.target.value);
                            setFormCotacao({ ...formCotacao, itens: novosItens });
                          }}
                          placeholder="Qtd"
                          data-permission="Compras.Cotacao.criar"
                          data-action="Compras.Cotacao.itemQuantidade"
                          data-context-required="group-or-company"
                          data-sensitive="true"
                        />
                      </div>
                      <div className="col-span-2">
                        <Select
                          value={item.unidade}
                          onValueChange={(value) => {
                            const novosItens = [...formCotacao.itens];
                            novosItens[idx].unidade = value;
                            setFormCotacao({ ...formCotacao, itens: novosItens });
                          }}
                        >
                          <SelectTrigger
                            data-permission="Compras.Cotacao.criar"
                            data-action="Compras.Cotacao.itemUnidade"
                            data-context-required="group-or-company"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="UN">UN</SelectItem>
                            <SelectItem value="KG">KG</SelectItem>
                            <SelectItem value="MT">MT</SelectItem>
                            <SelectItem value="LT">LT</SelectItem>
                            <SelectItem value="CX">CX</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Input
                          value={item.observacoes}
                          onChange={(e) => {
                            const novosItens = [...formCotacao.itens];
                            novosItens[idx].observacoes = e.target.value;
                            setFormCotacao({ ...formCotacao, itens: novosItens });
                          }}
                          placeholder="Obs"
                          data-permission="Compras.Cotacao.criar"
                          data-action="Compras.Cotacao.itemObservacoes"
                          data-context-required="group-or-company"
                        />
                      </div>
                      <div className="col-span-1 flex items-center justify-center">
                        {formCotacao.itens.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removerItem(idx)}
                            className="text-red-600"
                            data-permission="Compras.Cotacao.criar"
                            data-action="Compras.Cotacao.removerItem"
                            data-context-required="group-or-company"
                          >
                            ×
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label className="mb-3 block">Fornecedores Convidados * (selecione ao menos 2)</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto border rounded-lg p-3">
                  {fornecedores.filter(f => f.status === 'Ativo').map(fornecedor => (
                    <div key={fornecedor.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer">
                      <Checkbox
                        checked={formCotacao.fornecedores_selecionados.includes(fornecedor.id)}
                        onCheckedChange={() => toggleFornecedor(fornecedor.id)}
                        data-permission="Compras.Cotacao.criar"
                        data-action="Compras.Cotacao.selecionarFornecedor"
                        data-context-required="group-or-company"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{fornecedor.nome}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Badge variant="outline" className="text-xs">
                            {fornecedor.categoria}
                          </Badge>
                          {fornecedor.nota_media > 0 && (
                            <span className="flex items-center gap-1">
                              <Award className="w-3 h-3 text-amber-500" />
                              {fornecedor.nota_media.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {formCotacao.fornecedores_selecionados.length < 2 && (
                  <p className="text-xs text-orange-600 mt-2">
                    <AlertCircle className="w-3 h-3 inline mr-1" />
                    Selecione ao menos 2 fornecedores para cotação
                  </p>
                )}
              </div>

              <div>
                <Label>Observações Gerais</Label>
                <Textarea
                  value={formCotacao.observacoes_gerais}
                  onChange={(e) => setFormCotacao({ ...formCotacao, observacoes_gerais: e.target.value })}
                  placeholder="Condições especiais, prazos, formas de pagamento..."
                  rows={3}
                  data-permission="Compras.Cotacao.criar"
                  data-action="Compras.Cotacao.observacoesGerais"
                  data-context-required="group-or-company"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  data-permission="Compras.Cotacao.criar"
                  data-action="Compras.Cotacao.cancelar"
                  data-context-required="group-or-company"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={criarCotacaoMutation.isPending || formCotacao.fornecedores_selecionados.length < 2}
                  className="bg-cyan-600 hover:bg-cyan-700"
                  data-permission="Compras.Cotacao.criar"
                  data-action="Compras.Cotacao.confirmar"
                  data-context-required="group-or-company"
                  data-sensitive="true"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {criarCotacaoMutation.isPending ? 'Enviando...' : 'Criar e Enviar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de Cotações */}
      <div className="grid gap-2">
        {cotacoes.map(cotacao => (
          <Card key={cotacao.id} className="border-0 shadow-sm">
            <CardHeader className="bg-slate-50 border-b py-2 px-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <FileText className="w-4 h-4 text-cyan-600" />
                    {cotacao.numero_cotacao} - {cotacao.descricao}
                  </CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={getStatusColor(cotacao.status)}>
                      {cotacao.status}
                    </Badge>
                    <span className="text-xs text-slate-600">
                      Criada: {new Date(cotacao.data_criacao).toLocaleDateString('pt-BR')}
                    </span>
                    <span className="text-xs text-slate-600">
                      Limite: {new Date(cotacao.data_limite).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setComparativoModal(cotacao)}
                  data-permission="Compras.Cotacao.visualizar"
                  data-action="Compras.Cotacao.verPropostas"
                  data-context-required="group-or-company"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Ver Propostas ({cotacao.propostas_recebidas}/{cotacao.fornecedores_convidados})
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-600 mb-2">Itens Cotados:</p>
                  <ul className="space-y-1">
                    {cotacao.itens.slice(0, 3).map((item, idx) => (
                      <li key={idx} className="text-sm flex items-center gap-2">
                        <Package className="w-3 h-3 text-slate-400" />
                        {item.quantidade} {item.unidade} - {item.produto_descricao}
                      </li>
                    ))}
                    {cotacao.itens.length > 3 && (
                      <li className="text-xs text-slate-500">+ {cotacao.itens.length - 3} itens...</li>
                    )}
                  </ul>
                </div>
                <div>
                  <p className="text-sm text-slate-600 mb-2">Status das Propostas:</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-cyan-600 h-2 rounded-full transition-all"
                        style={{ width: `${(cotacao.propostas_recebidas / cotacao.fornecedores_convidados) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold">
                      {cotacao.propostas_recebidas}/{cotacao.fornecedores_convidados}
                    </span>
                  </div>
                  {cotacao.propostas_recebidas === cotacao.fornecedores_convidados && (
                    <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Todas as propostas recebidas
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {cotacoes.length === 0 && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-8 text-center">
              <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-700 mb-2">Nenhuma Cotação</h3>
              <p className="text-xs text-slate-500 mb-3">
                Compare propostas de fornecedores
              </p>
              <Button
                size="sm"
                onClick={() => setDialogOpen(true)}
                className="bg-cyan-600 hover:bg-cyan-700"
                data-permission="Compras.Cotacao.criar"
                data-action="Compras.Cotacao.criarVazio"
                data-context-required="group-or-company"
              >
                <Plus className="w-3 h-3 mr-1" />
                Criar Cotação
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal Comparativo de Propostas */}
      {comparativoModal && (
        <Dialog open={!!comparativoModal} onOpenChange={() => setComparativoModal(null)}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-cyan-600" />
                Comparativo de Propostas - {comparativoModal.numero_cotacao}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Resumo da Cotação */}
              <Card className="bg-slate-50 border-slate-200">
                <CardContent className="p-4">
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-slate-600">Itens Cotados</p>
                      <p className="text-lg font-bold">{comparativoModal.itens.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">Propostas Recebidas</p>
                      <p className="text-lg font-bold text-cyan-600">
                        {comparativoModal.propostas_recebidas}/{comparativoModal.fornecedores_convidados}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">Data Limite</p>
                      <p className="text-lg font-bold">
                        {new Date(comparativoModal.data_limite).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Comparativo de Propostas */}
              {comparativoModal.propostas.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Comparativo de Propostas</h3>
                  
                  {/* Melhor Proposta Destacada */}
                  {(() => {
                    const melhorProposta = [...comparativoModal.propostas].sort((a, b) => a.valor_total - b.valor_total)[0];
                    
                    return comparativoModal.propostas.map((proposta, idx) => {
                      const ehMelhor = proposta.fornecedor_id === melhorProposta.fornecedor_id;
                      
                      return (
                        <Card 
                          key={idx} 
                          className={`border-2 ${ehMelhor ? 'border-green-400 bg-green-50/50' : 'border-slate-200'}`}
                        >
                          <CardHeader className={ehMelhor ? 'bg-green-50 border-b border-green-200' : 'bg-slate-50 border-b'}>
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <Building2 className="w-5 h-5 text-cyan-600" />
                                  <CardTitle className="text-lg">{proposta.fornecedor_nome}</CardTitle>
                                  {ehMelhor && (
                                    <Badge className="bg-green-600 text-white">
                                      <Award className="w-3 h-3 mr-1" />
                                      Melhor Oferta
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                  <span className="text-slate-600">
                                    Enviada em {new Date(proposta.data_proposta).toLocaleDateString('pt-BR')}
                                  </span>
                                  <Badge variant="outline">
                                    Prazo: {proposta.prazo_entrega} dias
                                  </Badge>
                                  <Badge variant="outline">
                                    {proposta.forma_pagamento}
                                  </Badge>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-slate-600">Valor Total</p>
                                <p className={`text-2xl font-bold ${ehMelhor ? 'text-green-600' : 'text-slate-900'}`}>
                                  R$ {proposta.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="p-4">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-slate-50">
                                  <TableHead>Produto</TableHead>
                                  <TableHead className="text-right">Preço Unit.</TableHead>
                                  <TableHead className="text-right">Valor Total</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {proposta.itens.map((item, itemIdx) => (
                                  <TableRow key={itemIdx}>
                                    <TableCell className="font-medium">{item.produto_descricao}</TableCell>
                                    <TableCell className="text-right">
                                      R$ {item.preco_unitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold">
                                      R$ {item.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>

                            {proposta.observacoes && (
                              <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
                                <p className="text-xs text-blue-700 font-medium mb-1">Observações:</p>
                                <p className="text-sm text-blue-900">{proposta.observacoes}</p>
                              </div>
                            )}

                            <div className="flex justify-end gap-3 mt-4">
                              <Button
                                variant="outline"
                                size="sm"
                                data-permission="Compras.Cotacao.solicitar_esclarecimento"
                                data-action="Compras.Cotacao.solicitarEsclarecimentos"
                                data-context-required="group-or-company"
                                onClick={() => {
                                  toast({
                                    title: "📧 E-mail Enviado",
                                    description: `Solicitação de esclarecimentos enviada para ${proposta.fornecedor_nome}`
                                  });
                                }}
                              >
                                <Send className="w-4 h-4 mr-2" />
                                Solicitar Esclarecimentos
                              </Button>
                              {canGerarOC && (
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => gerarOrdemCompraMutation.mutate(proposta)}
                                  disabled={gerarOrdemCompraMutation.isPending || !contextoValido || !canGerarOC}
                                  data-permission="Compras.Cotacao.gerar_oc"
                                  data-action="Compras.Cotacao.gerarOrdemCompra"
                                  data-context-required="group-or-company"
                                  data-sensitive="true"
                                >
                                  <ShoppingCart className="w-4 h-4 mr-2" />
                                  {gerarOrdemCompraMutation.isPending ? 'Gerando...' : 'Gerar Ordem de Compra'}
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    });
                  })()}

                  {/* Análise Comparativa */}
                  <Card className="border-0 shadow-md bg-gradient-to-r from-slate-50 to-blue-50">
                    <CardHeader>
                      <CardTitle className="text-base">📊 Análise Comparativa</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm text-slate-600">Menor Preço</p>
                          <p className="text-xl font-bold text-green-600">
                            R$ {Math.min(...comparativoModal.propostas.map(p => p.valor_total)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {comparativoModal.propostas.find(p => p.valor_total === Math.min(...comparativoModal.propostas.map(pr => pr.valor_total)))?.fornecedor_nome}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-600">Menor Prazo</p>
                          <p className="text-xl font-bold text-blue-600">
                            {Math.min(...comparativoModal.propostas.map(p => p.prazo_entrega))} dias
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {comparativoModal.propostas.find(p => p.prazo_entrega === Math.min(...comparativoModal.propostas.map(pr => pr.prazo_entrega)))?.fornecedor_nome}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-600">Economia vs Maior</p>
                          <p className="text-xl font-bold text-purple-600">
                            R$ {(Math.max(...comparativoModal.propostas.map(p => p.valor_total)) - Math.min(...comparativoModal.propostas.map(p => p.valor_total))).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {(((Math.max(...comparativoModal.propostas.map(p => p.valor_total)) - Math.min(...comparativoModal.propostas.map(p => p.valor_total))) / Math.max(...comparativoModal.propostas.map(p => p.valor_total))) * 100).toFixed(1)}% de diferença
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card className="border-0 shadow-md">
                  <CardContent className="p-12 text-center">
                    <Send className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">Aguardando Propostas</h3>
                    <p className="text-slate-500">
                      Cotação enviada para {comparativoModal.fornecedores_convidados} fornecedores
                    </p>
                    <p className="text-sm text-slate-400 mt-2">
                      As propostas aparecerão aqui conforme forem recebidas
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );

  if (windowMode) {
    return <div className="w-full h-full flex flex-col bg-gradient-to-br from-slate-50 to-indigo-50 overflow-auto p-1.5">{content}</div>;
  }

  return content;
}
