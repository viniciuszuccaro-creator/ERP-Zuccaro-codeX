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
import { isProdutoVendavel } from "@/components/cadastros/produto/produtoTipoPolicy";
import {
  numeroComprovado,
  produtoElegivelRevendaNoCatalogo,
} from "@/components/comercial/historicoComprasClientePolicy";

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
  windowMode = false,
  /** Seed do histórico/sugestão — qty sempre 1 (frequência ≠ demanda). */
  produtoInicial = null,
}) {
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [quantidade, setQuantidade] = useState(1);
  const [descontoPercentual, setDescontoPercentual] = useState(0);
  const [descontoValor, setDescontoValor] = useState(0);
  const [justificativaDesconto, setJustificativaDesconto] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [mostrarSugestoes, setMostrarSugestoes] = useState(true);

  // Prefill canônico: produto comprovado; quantidade = 1 (não usar frequência histórica).
  useEffect(() => {
    if (!isOpen) return;
    if (produtoInicial?.id) {
      setProdutoSelecionado(produtoInicial);
      setSearchTerm(produtoInicial.descricao || produtoInicial.codigo || "");
      setQuantidade(1);
      setMostrarSugestoes(false);
      return;
    }
    setProdutoSelecionado(null);
    setQuantidade(1);
    setSearchTerm("");
    setMostrarSugestoes(true);
  }, [isOpen, produtoInicial]);

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

  const { data: produtos = [], isFetched: catalogoFetched } = useQuery({
    queryKey: ["produtos-revenda-contexto", groupId, empresaId, contexto],
    queryFn: () => filterInContext("Produto", {}, "descricao", 500),
    enabled: consultaHabilitada,
  });

  // Enriquecer seed com catálogo no escopo (custo/estoque só se vierem do catálogo; sem inventar).
  // Inelegível (inativo / não vendável) comprovado pelo catálogo → limpa seleção (≠ inserir).
  useEffect(() => {
    if (!isOpen || !produtoInicial?.id || !Array.isArray(produtos) || produtos.length === 0) return;
    const cat = produtos.find((p) => String(p?.id) === String(produtoInicial.id));
    if (!cat) return;
    const elegivel = produtoElegivelRevendaNoCatalogo(produtos, produtoInicial.id, isProdutoVendavel);
    if (elegivel === false) {
      setProdutoSelecionado(null);
      setMostrarSugestoes(true);
      return;
    }
    setProdutoSelecionado((prev) => {
      if (!prev || String(prev.id) !== String(produtoInicial.id)) return prev;
      const merged = { ...prev, ...cat, id: prev.id };
      // Seed histórico manda em unidade/preço já comprovados se catálogo omitir.
      if (prev.unidade_medida && !cat.unidade_medida) merged.unidade_medida = prev.unidade_medida;
      if (prev.unidade_sigla && !cat.unidade_sigla) merged.unidade_sigla = prev.unidade_sigla;
      if (numeroComprovado(prev.preco_venda) != null && numeroComprovado(cat.preco_venda) == null) {
        merged.preco_venda = prev.preco_venda;
      }
      return merged;
    });
  }, [isOpen, produtoInicial, produtos]);

  const produtosAtivos = consultaHabilitada ? produtos.filter(p =>
    p.status === 'Ativo' && 
    isProdutoVendavel(p.tipo_item)
  ) : [];

  const produtosFiltrados = produtosAtivos.filter(p =>
    p.descricao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.codigo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.codigo_barras?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const precoBaseComprovado = produtoSelecionado
    ? numeroComprovado(produtoSelecionado.preco_venda)
    : null;
  const itemTabelaComprovado = (() => {
    if (!produtoSelecionado?.id || !tabelaPreco || !Array.isArray(tabelaPrecoItens)) return null;
    const row = tabelaPrecoItens.find((i) => String(i?.produto_id) === String(produtoSelecionado.id));
    return row ? numeroComprovado(row.preco_com_desconto) : null;
  })();
  const precoComprovadoDisponivel = itemTabelaComprovado != null || precoBaseComprovado != null;

  // Custo/estoque comprovados no escopo do produto selecionado — ausente ≠ 0 fabricado.
  const custoComprovado = produtoSelecionado
    ? numeroComprovado(produtoSelecionado.custo_medio ?? produtoSelecionado.custo_aquisicao)
    : null;
  const estoqueComprovado = produtoSelecionado
    ? numeroComprovado(produtoSelecionado.estoque_disponivel ?? produtoSelecionado.estoque_atual)
    : null;
  const margemConhecida = custoComprovado != null;

  const calculo = produtoSelecionado && precoComprovadoDisponivel ? calcularPrecoItem({
    produto: {
      ...produtoSelecionado,
      // Evita `preco_venda || 0` inventado no calculador quando só tabela comprova.
      preco_venda: precoBaseComprovado != null ? precoBaseComprovado : (itemTabelaComprovado ?? undefined),
      // Mesma fonte de custo comprovado (inclui zero) no cálculo e no payload.
      ...(margemConhecida
        ? { custo_medio: custoComprovado, custo_aquisicao: undefined }
        : {}),
    },
    tabelaPreco: tabelaPreco,
    tabelaPrecoItens: tabelaPrecoItens,
    descontoPadraoCliente: cliente?.condicao_comercial?.percentual_desconto || 0,
    descontoItemPercentual: descontoPercentual,
    descontoItemValor: descontoValor,
    quantidade: quantidade,
    margemMinimaCliente: cliente?.condicao_comercial?.margem_minima || null,
    margemMinimaSistema: margemMinimaSistema
  }) : null;

  // Calculador pode devolver margem_violada com custo 0 inventado — só efetiva se custo comprovado.
  const margemVioladaEfetiva = Boolean(margemConhecida && calculo?.margem_violada);
  // Preço ausente: botão e handler compartilham o mesmo estado efetivo (rascunho incompleto ≠ inventar 0).
  const podeConfirmarPreco = Boolean(precoComprovadoDisponivel && calculo);

  const handleAdicionarItem = () => {
    if (!acaoHabilitada) {
      alert("Selecione um contexto de grupo/empresa e confirme permissao para alterar pedido comercial.");
      return;
    }

    if (!produtoSelecionado) return;

    if (!podeConfirmarPreco) {
      alert("Preço unitário não comprovado — não inventar zero. Informe preço na tabela/cadastro ou selecione produto com preço.");
      return;
    }

    // Só rejeita inelegível comprovado (encontrado inativo/não vendável).
    // Ausente na página limitada do catálogo ≠ classificar como inativo.
    if (consultaHabilitada && catalogoFetched) {
      const elegivel = produtoElegivelRevendaNoCatalogo(
        produtos,
        produtoSelecionado.id,
        isProdutoVendavel,
      );
      if (elegivel === false) {
        alert("Produto inativo ou não vendável no contexto atual — não inserir no rascunho.");
        return;
      }
    }

    // Margem só com custo comprovado; ausente ≠ margem 0 / violação fabricada.
    if (margemVioladaEfetiva && !justificativaDesconto.trim()) {
      alert("Margem mínima violada! É necessário informar uma justificativa para o desconto.");
      return;
    }
    // Justificativa de margem NÃO autoriza fabricar preço — preço já validado acima.

    const unidadeComprovada = produtoSelecionado.unidade_medida || produtoSelecionado.unidade_sigla || null;
    const detalhesCalculo = {
      preco_inicial: calculo.detalhes_calculo?.preco_inicial,
      desconto_padrao_cliente_valor: calculo.detalhes_calculo?.desconto_padrao_cliente_valor,
      desconto_item_valor: calculo.detalhes_calculo?.desconto_item_valor,
      preco_final: calculo.detalhes_calculo?.preco_final,
    };
    if (margemConhecida) {
      detalhesCalculo.custo = custoComprovado;
      detalhesCalculo.margem_valor = calculo.margem_valor;
      detalhesCalculo.margem_percentual = calculo.margem_percentual;
    }
    const novoItem = {
      produto_id: produtoSelecionado.id,
      codigo_sku: produtoSelecionado.codigo,
      descricao: produtoSelecionado.descricao,
      quantidade: quantidade,
      desconto_padrao_cliente_percentual: cliente?.condicao_comercial?.percentual_desconto || 0,
      desconto_item_percentual: descontoPercentual,
      desconto_item_valor: descontoValor,
      preco_unitario_bruto: calculo.preco_unitario_bruto,
      preco_unitario: calculo.preco_unitario,
      valor_item: calculo.valor_item,
      aprovacao_margem_concedida: false,
      justificativa_desconto: justificativaDesconto,
      ncm: produtoSelecionado.ncm,
      observacoes: observacoes,
      _calculo_detalhado: detalhesCalculo,
    };
    if (precoBaseComprovado != null) novoItem.preco_base_produto = precoBaseComprovado;
    if (calculo.origem_preco === "tabela_preco") novoItem.preco_tabela = calculo.preco_unitario_bruto;
    // Unidade só se comprovada — ausente ≠ inventar UN.
    if (unidadeComprovada) {
      novoItem.unidade = unidadeComprovada;
      novoItem.unidade_medida = unidadeComprovada;
    }
    // Custo/estoque/margem/Sob Encomenda só com fonte — ausente ≠ zero / rótulo inventado.
    if (custoComprovado != null) {
      novoItem.custo_unitario = custoComprovado;
      novoItem.margem_percentual = calculo.margem_percentual;
      novoItem.margem_valor = calculo.margem_valor;
      novoItem.margem_violada = calculo.margem_violada;
      novoItem.aprovacao_margem_necessaria = calculo.margem_violada;
    }
    if (numeroComprovado(produtoSelecionado.margem_minima_percentual) != null) {
      novoItem.margem_minima_produto = Number(produtoSelecionado.margem_minima_percentual);
    }
    if (estoqueComprovado != null) {
      novoItem.estoque_disponivel = estoqueComprovado;
      novoItem.situacao_item = estoqueComprovado >= quantidade ? "Em Estoque" : "Sob Encomenda";
    }

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
                            Estoque:{" "}
                            {numeroComprovado(produto.estoque_disponivel ?? produto.estoque_atual) == null
                              ? "—"
                              : numeroComprovado(produto.estoque_disponivel ?? produto.estoque_atual)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">
                          {numeroComprovado(produto.preco_venda) == null
                            ? "—"
                            : `R$ ${numeroComprovado(produto.preco_venda).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                        </p>
                        <p className="text-xs text-slate-500">
                          Custo:{" "}
                          {numeroComprovado(produto.custo_medio ?? produto.custo_aquisicao) == null
                            ? "—"
                            : `R$ ${numeroComprovado(produto.custo_medio ?? produto.custo_aquisicao).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
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
                          <span className="font-semibold">
                            {margemConhecida
                              ? `R$ ${custoComprovado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                              : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Margem:</span>
                          <span className={`font-bold ${
                            !margemConhecida ? 'text-slate-500' : margemVioladaEfetiva ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {margemConhecida ? `${calculo.margem_percentual.toFixed(2)}%` : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Lucro Unitário:</span>
                          <span className={`font-semibold ${
                            !margemConhecida ? 'text-slate-500' : margemVioladaEfetiva ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {margemConhecida
                              ? `R$ ${((calculo.preco_unitario - custoComprovado)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                              : '—'}
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

                    {margemVioladaEfetiva && (
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

                    {estoqueComprovado != null && quantidade > estoqueComprovado && (
                      <Card className="border-orange-300 bg-orange-50">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-orange-600" />
                            <div>
                              <p className="font-semibold text-orange-900">Atenção: Estoque Insuficiente</p>
                              <p className="text-sm text-orange-700">
                                Disponível: {estoqueComprovado} | 
                                Solicitado: {quantidade} | 
                                Falta: {quantidade - estoqueComprovado}
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

              {margemVioladaEfetiva && (
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
          disabled={!acaoHabilitada || !produtoSelecionado || quantidade <= 0 || !podeConfirmarPreco || (margemVioladaEfetiva && !justificativaDesconto.trim())}
          data-permission="Comercial.Pedido.criar"
          data-action="adicionar-item-revenda"
          data-sensitive="true"
          className={margemVioladaEfetiva ? "bg-orange-600 hover:bg-orange-700" : "bg-blue-600 hover:bg-blue-700"}
        >
          {margemVioladaEfetiva ? "Adicionar (Aguardando Aprovação)" : "Adicionar Item"}
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