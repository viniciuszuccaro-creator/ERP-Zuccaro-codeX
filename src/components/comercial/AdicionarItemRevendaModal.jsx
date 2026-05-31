import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
  Package, 
  DollarSign, 
  AlertCircle, 
  TrendingUp, 
  Calculator,
  Info,
  AlertTriangle,
  CheckCircle2,
  Percent
} from "lucide-react";
import { calcularPrecoItem } from "./CalculadorPrecoItem";
import Top10ProdutosCliente from "./Top10ProdutosCliente";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

/**
 * V21.1.2 - WINDOW MODE READY
 */
export default function AdicionarItemRevendaModal({ 
  isOpen, 
  onClose, 
  onAddItem,
  cliente,
  tabelaPreco,
  tabelaPrecoItens = [],
  margemMinimaSistema = 10,
  windowMode = false
}) {
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [quantidade, setQuantidade] = useState(1);
  const [descontoPercentual, setDescontoPercentual] = useState(0);
  const [descontoValor, setDescontoValor] = useState(0);
  const [justificativaDesconto, setJustificativaDesconto] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [mostrarSugestoes, setMostrarSugestoes] = useState(true);

  const { filterInContext, empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const { hasPermission } = usePermissions();

  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = contexto === "empresa" ? empresaAtual?.id : null;
  const contextoValido = Boolean(groupId || empresaId);
  const podeVisualizarProduto =
    hasPermission("Comercial.Pedido.criar") ||
    hasPermission("Comercial.Pedido.editar") ||
    hasPermission("Estoque.Produto.visualizar") ||
    hasPermission("Cadastros.Produto.visualizar");
  const podeAdicionarItem =
    hasPermission("Comercial.Pedido.criar") ||
    hasPermission("Comercial.Pedido.editar") ||
    hasPermission("comercial", "criar_pedido") ||
    hasPermission("comercial", "editar_pedido");
  const consultaHabilitada = Boolean(contextoValido && podeVisualizarProduto);
  const acaoHabilitada = Boolean(contextoValido && podeAdicionarItem);

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-revenda-contexto", groupId, empresaId, contexto],
    queryFn: () => filterInContext("Produto", {}, "descricao", 500),
    enabled: consultaHabilitada,
  });

  const produtosAtivos = consultaHabilitada ? produtos.filter(p =>
    p.status === 'Ativo' && 
    (p.tipo_item === 'Revenda' || p.tipo_item === 'Produto Acabado')
  ) : [];

  const produtosFiltrados = produtosAtivos.filter(p =>
    p.descricao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.codigo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.codigo_barras?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const calculo = produtoSelecionado ? calcularPrecoItem({
    produto: produtoSelecionado,
    tabelaPreco: tabelaPreco,
    tabelaPrecoItens: tabelaPrecoItens,
    descontoPadraoCliente: cliente?.condicao_comercial?.percentual_desconto || 0,
    descontoItemPercentual: descontoPercentual,
    descontoItemValor: descontoValor,
    quantidade: quantidade,
    margemMinimaCliente: cliente?.condicao_comercial?.margem_minima || null,
    margemMinimaSistema: margemMinimaSistema
  }) : null;

  const handleAdicionarItem = () => {
    if (!acaoHabilitada) {
      alert("Selecione um contexto de grupo/empresa e confirme permissao para alterar pedido comercial.");
      return;
    }

    if (!produtoSelecionado || !calculo) return;

    if (calculo.margem_violada && !justificativaDesconto.trim()) {
      alert("Margem mínima violada! É necessário informar uma justificativa para o desconto.");
      return;
    }

    const novoItem = {
      produto_id: produtoSelecionado.id,
      codigo_sku: produtoSelecionado.codigo,
      descricao: produtoSelecionado.descricao,
      unidade: produtoSelecionado.unidade_medida,
      quantidade: quantidade,
      custo_unitario: calculo.custo_unitario,
      preco_base_produto: produtoSelecionado.preco_venda,
      preco_tabela: calculo.origem_preco === "tabela_preco" ? calculo.preco_unitario_bruto : null,
      preco_unitario_bruto: calculo.preco_unitario_bruto,
      desconto_padrao_cliente_percentual: cliente?.condicao_comercial?.percentual_desconto || 0,
      desconto_item_percentual: descontoPercentual,
      desconto_item_valor: descontoValor,
      preco_unitario: calculo.preco_unitario,
      valor_item: calculo.valor_item,
      margem_percentual: calculo.margem_percentual,
      margem_valor: calculo.margem_valor,
      margem_minima_produto: produtoSelecionado.margem_minima_percentual,
      margem_violada: calculo.margem_violada,
      aprovacao_margem_necessaria: calculo.margem_violada,
      aprovacao_margem_concedida: false,
      justificativa_desconto: justificativaDesconto,
      estoque_disponivel: produtoSelecionado.estoque_disponivel || produtoSelecionado.estoque_atual || 0,
      situacao_item: (produtoSelecionado.estoque_disponivel || 0) >= quantidade ? "Em Estoque" : "Sob Encomenda",
      ncm: produtoSelecionado.ncm,
      observacoes: observacoes,
      _calculo_detalhado: calculo.detalhes_calculo
    };

    onAddItem(novoItem);
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setProdutoSelecionado(null);
    setQuantidade(1);
    setDescontoPercentual(0);
    setDescontoValor(0);
    setJustificativaDesconto("");
    setObservacoes("");
    setSearchTerm("");
    setMostrarSugestoes(true);
  };

  const handleSelecionarProdutoSugestao = (produto) => {
    setProdutoSelecionado(produto);
    setSearchTerm(produto.descricao);
    setMostrarSugestoes(false);
  };

  const content = (
    <div className={`w-full h-full space-y-6 ${windowMode ? 'p-6 overflow-auto' : ''}`} data-context-required="true" data-permission="Comercial.Pedido.criar">
          {(!contextoValido || !podeVisualizarProduto) && (
            <Alert className="border-amber-200 bg-amber-50" data-context-required="true" data-permission="Estoque.Produto.visualizar">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                Selecao de itens exige contexto de grupo/empresa e permissao para visualizar produtos.
              </AlertDescription>
            </Alert>
          )}

          {cliente && mostrarSugestoes && !produtoSelecionado && consultaHabilitada && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-blue-900">💡 Produtos Mais Comprados</h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setMostrarSugestoes(false)}
                    className="text-xs"
                  >
                    Ocultar
                  </Button>
                </div>
                <Top10ProdutosCliente
                  clienteId={cliente.id}
                  onSelecionarProduto={handleSelecionarProdutoSugestao}
                />
              </CardContent>
            </Card>
          )}

          <div>
            <Label>Buscar Produto *</Label>
            <Input
              placeholder="Digite código, descrição ou código de barras..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setMostrarSugestoes(false);
              }}
              className="mb-3"
            />

            {searchTerm && (
              <div className="max-h-48 overflow-y-auto border rounded-lg">
                {produtosFiltrados.slice(0, 10).map(produto => (
                  <button
                    key={produto.id}
                    onClick={() => {
                      setProdutoSelecionado(produto);
                      setSearchTerm(produto.descricao);
                    }}
                    className={`w-full p-3 text-left hover:bg-blue-50 transition-colors border-b ${
                      produtoSelecionado?.id === produto.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{produto.descricao}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <Badge variant="outline" className="text-xs">{produto.codigo}</Badge>
                          <span className="text-xs text-slate-600">{produto.unidade_medida}</span>
                          <span className="text-xs text-slate-600">
                            Estoque: {produto.estoque_disponivel || produto.estoque_atual || 0}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">
                          R$ {(produto.preco_venda || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-slate-500">
                          Custo: R$ {(produto.custo_medio || produto.custo_aquisicao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {produtoSelecionado && (
            <>
              <Card className="border-0 shadow-sm bg-blue-50">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="w-5 h-5 text-blue-600" />
                        <p className="font-bold text-blue-900">{produtoSelecionado.descricao}</p>
                      </div>
                      <div className="grid grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-blue-700">Código</p>
                          <p className="font-semibold text-blue-900">{produtoSelecionado.codigo}</p>
                        </div>
                        <div>
                          <p className="text-blue-700">Unidade</p>
                          <p className="font-semibold text-blue-900">{produtoSelecionado.unidade_medida}</p>
                        </div>
                        <div>
                          <p className="text-blue-700">Estoque</p>
                          <p className={`font-semibold ${
                            (produtoSelecionado.estoque_disponivel || 0) >= quantidade 
                              ? 'text-green-700' 
                              : 'text-red-700'
                          }`}>
                            {produtoSelecionado.estoque_disponivel || produtoSelecionado.estoque_atual || 0} {produtoSelecionado.unidade_medida}
                          </p>
                        </div>
                        <div>
                          <p className="text-blue-700">Margem Mínima</p>
                          <p className="font-semibold text-blue-900">
                            {produtoSelecionado.margem_minima_percentual || margemMinimaSistema}%
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Quantidade *</Label>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={quantidade}
                    onChange={(e) => setQuantidade(parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div>
                  <Label>Desconto (%) - Adicional</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={descontoPercentual}
                    onChange={(e) => {
                      setDescontoPercentual(parseFloat(e.target.value) || 0);
                      setDescontoValor(0);
                    }}
                  />
                </div>

                <div>
                  <Label>Desconto (R$) - Adicional</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={descontoValor}
                    onChange={(e) => {
                      setDescontoValor(parseFloat(e.target.value) || 0);
                      setDescontoPercentual(0);
                    }}
                  />
                </div>
              </div>

              {calculo && (
                <Card className="border-0 shadow-md">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-3">
                      <Calculator className="w-5 h-5 text-slate-600" />
                      <h4 className="font-semibold text-slate-900">Cálculo do Item</h4>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Preço Bruto:</span>
                          <span className="font-semibold">R$ {calculo.preco_unitario_bruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        {cliente?.condicao_comercial?.percentual_desconto > 0 && (
                          <div className="flex justify-between text-green-600">
                            <span>Desconto Padrão Cliente ({cliente.condicao_comercial.percentual_desconto}%):</span>
                            <span className="font-semibold">
                              - R$ {(calculo.preco_unitario_bruto - calculo.preco_apos_desconto_padrao).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        {(descontoPercentual > 0 || descontoValor > 0) && (
                          <div className="flex justify-between text-blue-600">
                            <span>Desconto Adicional:</span>
                            <span className="font-semibold">
                              - R$ {calculo.detalhes_calculo.desconto_item_valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between border-t pt-2">
                          <span className="text-slate-600">Preço Unitário Final:</span>
                          <span className="font-bold text-lg text-blue-600">
                            R$ {calculo.preco_unitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2 border-l pl-4">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Custo Unitário:</span>
                          <span className="font-semibold">R$ {calculo.custo_unitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Margem:</span>
                          <span className={`font-bold ${
                            calculo.margem_violada ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {calculo.margem_percentual.toFixed(2)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Lucro Unitário:</span>
                          <span className={`font-semibold ${
                            calculo.margem_violada ? 'text-red-600' : 'text-green-600'
                          }`}>
                            R$ {((calculo.preco_unitario - calculo.custo_unitario)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between border-t pt-2">
                          <span className="text-slate-600">Valor Total Item:</span>
                          <span className="font-bold text-lg text-blue-600">
                            R$ {calculo.valor_item.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {calculo.margem_violada && (
                      <Card className="border-red-300 bg-red-50">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                            <div className="flex-1">
                              <p className="font-semibold text-red-900">⚠️ Margem Mínima Violada!</p>
                              <p className="text-sm text-red-700">
                                Margem atual: {calculo.margem_percentual.toFixed(2)}% | 
                                Margem mínima: {calculo.margem_minima_aplicada}% 
                                (origem: {calculo.margem_minima_origem === 'produto' ? 'Produto' : calculo.margem_minima_origem === 'cliente' ? 'Cliente' : 'Sistema'})
                              </p>
                              <p className="text-xs text-red-600 mt-1">
                                Este item ficará com status "Aguardando Aprovação Comercial"
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {quantidade > (produtoSelecionado.estoque_disponivel || 0) && (
                      <Card className="border-orange-300 bg-orange-50">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-orange-600" />
                            <div>
                              <p className="font-semibold text-orange-900">Atenção: Estoque Insuficiente</p>
                              <p className="text-sm text-orange-700">
                                Disponível: {produtoSelecionado.estoque_disponivel || 0} | 
                                Solicitado: {quantidade} | 
                                Falta: {quantidade - (produtoSelecionado.estoque_disponivel || 0)}
                              </p>
                              <p className="text-xs text-orange-600 mt-1">
                                Item será marcado como "Sob Encomenda"
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {tabelaPreco && calculo.origem_preco === "tabela_preco" && (
                      <Card className="border-green-300 bg-green-50">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-green-600" />
                            <div>
                              <p className="font-semibold text-green-900">✅ Preço da Tabela: {tabelaPreco.nome}</p>
                              <p className="text-sm text-green-700">
                                Preço aplicado automaticamente da tabela de preço do cliente
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </CardContent>
                </Card>
              )}

              {calculo?.margem_violada && (
                <div>
                  <Label className="text-red-600">Justificativa do Desconto *</Label>
                  <Textarea
                    value={justificativaDesconto}
                    onChange={(e) => setJustificativaDesconto(e.target.value)}
                    placeholder="Explique o motivo do desconto acima do permitido..."
                    className="border-red-300"
                    rows={3}
                  />
                </div>
              )}

              <div>
                <Label>Observações do Item</Label>
                <Textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Observações adicionais..."
                  rows={2}
                />
              </div>

      <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-white">
        {!windowMode && (
          <Button
            type="button"
            variant="outline"
            onClick={() => { resetForm(); onClose(); }}
          >
            Cancelar
          </Button>
        )}
        <Button
          type="button"
          onClick={handleAdicionarItem}
          disabled={!acaoHabilitada || !produtoSelecionado || quantidade <= 0 || (calculo?.margem_violada && !justificativaDesconto.trim())}
          data-permission="Comercial.Pedido.criar"
          data-action="adicionar-item-revenda"
          data-sensitive="true"
          className={calculo?.margem_violada ? "bg-orange-600 hover:bg-orange-700" : "bg-blue-600 hover:bg-blue-700"}
        >
          {calculo?.margem_violada ? "Adicionar (Aguardando Aprovação)" : "Adicionar Item"}
        </Button>
      </div>
            </>
          )}
    </div>
  );

  if (windowMode) {
    return <div className="w-full h-full bg-white">{content}</div>;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { resetForm(); onClose(); } }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            Adicionar Item de Revenda
          </DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}