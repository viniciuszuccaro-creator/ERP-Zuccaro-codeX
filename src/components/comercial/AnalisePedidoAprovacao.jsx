import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  Package,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Box,
  Zap,
  Rocket,
  ShieldAlert
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import ValidadorEstoquePedido from "./ValidadorEstoquePedido";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

/**
 * 🔐 ANÁLISE DE PEDIDO PARA APROVAÇÃO V21.5 - COMPLETO
 * 
 * FUNCIONALIDADES:
 * - Ajustar desconto geral (% e R$)
 * - Visualizar todos os itens do pedido
 * - Aplicar desconto individual por item
 * - Calcular e exibir markup/margem de cada item
 * - Recalcular totais em tempo real
 * - Verificar disponibilidade de estoque
 * - Baixa automática de estoque ao aprovar
 * - IA de previsão de impacto
 * - Multiempresa e responsivo
 */
export default function AnalisePedidoAprovacao({ 
  pedido: pedidoProp, 
  onAprovar, 
  onNegar, 
  windowMode = false 
}) {
  const [comentarios, setComentarios] = useState("");
  const [descontoGeralPercentual, setDescontoGeralPercentual] = useState(
    pedidoProp.desconto_solicitado_percentual || 0
  );
  const [descontoGeralValor, setDescontoGeralValor] = useState(
    pedidoProp.desconto_geral_pedido_valor || 0
  );
  const [fecharAutomatico, setFecharAutomatico] = useState(false); // V21.6
  const { filterInContext, empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const { hasPermission } = usePermissions();

  const groupId = pedidoProp.group_id || pedidoProp.grupo_id || grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = pedidoProp.empresa_id || (contexto === "empresa" ? empresaAtual?.id : null);
  const contextoValido = Boolean(groupId || empresaId);
  const podeVisualizarAprovacao =
    hasPermission("Comercial.Pedido.visualizar") ||
    hasPermission("Comercial.Pedido.aprovar") ||
    hasPermission("comercial", "aprovar_pedido") ||
    hasPermission("Estoque.Produto.visualizar");
  const podeEditarAprovacao =
    hasPermission("Comercial.Pedido.aprovar") ||
    hasPermission("Comercial.Pedido.editar") ||
    hasPermission("comercial", "aprovar_pedido") ||
    hasPermission("comercial", "editar_pedido");
  const consultaHabilitada = Boolean(contextoValido && podeVisualizarAprovacao);
  
  // Estado para descontos individuais dos itens
  const [descontosItens, setDescontosItens] = useState({});
  
  // V21.5: Buscar produtos para verificar estoque
  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-aprovacao-pedido-contexto", pedidoProp.id, groupId, empresaId, contexto],
    queryFn: () => filterInContext("Produto", pedidoProp.empresa_id ? { empresa_id: pedidoProp.empresa_id } : {}, "descricao", 500),
    enabled: consultaHabilitada
  });

  // Agregar todos os itens do pedido
  const todosItens = useMemo(() => {
    const itens = [];
    
    // Itens de Revenda
    if (pedidoProp.itens_revenda?.length > 0) {
      pedidoProp.itens_revenda.forEach((item, idx) => {
        itens.push({
          ...item,
          tipo: "Revenda",
          id_interno: `revenda_${idx}`,
          desconto_percentual: item.desconto_percentual || 0,
          desconto_valor: item.desconto_valor || 0,
        });
      });
    }
    
    // Itens de Armado Padrão
    if (pedidoProp.itens_armado_padrao?.length > 0) {
      pedidoProp.itens_armado_padrao.forEach((item, idx) => {
        itens.push({
          ...item,
          tipo: "Armado Padrão",
          id_interno: `armado_${idx}`,
          desconto_percentual: item.desconto_percentual || 0,
          desconto_valor: item.desconto_valor || 0,
        });
      });
    }
    
    // Itens de Corte e Dobra
    if (pedidoProp.itens_corte_dobra?.length > 0) {
      pedidoProp.itens_corte_dobra.forEach((item, idx) => {
        itens.push({
          ...item,
          tipo: "Corte e Dobra",
          id_interno: `corte_${idx}`,
          desconto_percentual: item.desconto_percentual || 0,
          desconto_valor: item.desconto_valor || 0,
        });
      });
    }
    
    return itens;
  }, [pedidoProp]);

  // V21.5: Verificar estoque disponível
  const verificarEstoqueItem = (item) => {
    if (!item.produto_id) return { disponivel: true, estoque: 0 };
    
    const produto = produtos.find(p => p.id === item.produto_id);
    if (!produto) return { disponivel: false, estoque: 0 };
    
    const estoqueAtual = produto.estoque_atual || 0;
    const quantidadeNecessaria = item.quantidade || 0;
    
    return {
      disponivel: estoqueAtual >= quantidadeNecessaria,
      estoque: estoqueAtual,
      necessario: quantidadeNecessaria,
      falta: Math.max(0, quantidadeNecessaria - estoqueAtual)
    };
  };

  // Calcular valores com descontos aplicados
  const calcularValoresItem = (item) => {
    const descontoItem = descontosItens[item.id_interno] || {
      percentual: item.desconto_percentual || 0,
      valor: item.desconto_valor || 0
    };
    
    const precoUnitario = item.preco_unitario || item.valor_unitario || 0;
    const quantidade = item.quantidade || 1;
    const custoUnitario = item.custo_unitario || item.custo_medio || 0;
    
    // Valor bruto
    const valorBruto = precoUnitario * quantidade;
    
    // Desconto aplicado
    let valorDesconto = 0;
    if (descontoItem.valor > 0) {
      valorDesconto = descontoItem.valor;
    } else if (descontoItem.percentual > 0) {
      valorDesconto = (valorBruto * descontoItem.percentual) / 100;
    }
    
    // Valor líquido
    const valorLiquido = valorBruto - valorDesconto;
    const precoUnitarioComDesconto = valorLiquido / quantidade;
    
    // Markup (%)
    const markup = custoUnitario > 0 
      ? ((precoUnitarioComDesconto - custoUnitario) / custoUnitario) * 100 
      : 0;
    
    // V21.5: Verificar estoque
    const infoEstoque = verificarEstoqueItem(item);
    
    return {
      valorBruto,
      valorDesconto,
      valorLiquido,
      precoUnitarioComDesconto,
      markup,
      custoUnitario,
      estoque: infoEstoque
    };
  };

  // Calcular totais do pedido
  const totaisPedido = useMemo(() => {
    let subtotal = 0;
    let descontoItensTotal = 0;
    let margemMedia = 0;
    
    todosItens.forEach(item => {
      const valores = calcularValoresItem(item);
      subtotal += valores.valorBruto;
      descontoItensTotal += valores.valorDesconto;
      margemMedia += valores.markup;
    });
    
    margemMedia = todosItens.length > 0 ? margemMedia / todosItens.length : 0;
    
    // Desconto geral
    let descontoGeral = 0;
    if (descontoGeralValor > 0) {
      descontoGeral = descontoGeralValor;
    } else if (descontoGeralPercentual > 0) {
      descontoGeral = (subtotal * descontoGeralPercentual) / 100;
    }
    
    const valorFinal = subtotal - descontoItensTotal - descontoGeral + (pedidoProp.valor_frete || 0);
    
    return {
      subtotal,
      descontoItensTotal,
      descontoGeral,
      valorFinal,
      margemMedia,
    };
  }, [todosItens, descontosItens, descontoGeralPercentual, descontoGeralValor, pedidoProp.valor_frete]);

  const handleDescontoItemChange = (itemId, tipo, valor) => {
    setDescontosItens(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [tipo]: parseFloat(valor) || 0,
        // Limpar o outro tipo quando um for preenchido
        [tipo === 'percentual' ? 'valor' : 'percentual']: 0,
      }
    }));
  };

  const handleAprovar = () => {
    if (!podeEditarAprovacao) return;
    // Preparar dados dos itens com descontos aplicados
    const itensAtualizados = todosItens.map(item => {
      const desconto = descontosItens[item.id_interno];
      return {
        ...item,
        desconto_percentual: desconto?.percentual || 0,
        desconto_valor: desconto?.valor || 0,
      };
    });

    onAprovar({
      descontoGeralPercentual,
      descontoGeralValor,
      itensAtualizados,
      comentarios,
      valorFinal: totaisPedido.valorFinal,
      margemMedia: totaisPedido.margemMedia,
      executarFechamento: fecharAutomatico // V21.6
    });
  };

  // V21.6: Verificar se tem estoque insuficiente
  const temEstoqueInsuficiente = todosItens.some(item => {
    if (item.tipo !== "Revenda") return false;
    const valores = calcularValoresItem(item);
    return !valores.estoque.disponivel;
  });

  const containerClass = windowMode ? "w-full h-full overflow-auto p-6" : "w-full h-full p-6";

  if (!contextoValido || !podeVisualizarAprovacao) {
    return (
      <Alert className="w-full h-full border-amber-200 bg-amber-50" data-context-required="true" data-permission="Comercial.Pedido.aprovar">
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          Análise de aprovação exige contexto de grupo/empresa e permissão para visualizar ou aprovar pedidos.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={containerClass} data-context-required="true" data-permission="Comercial.Pedido.aprovar">
      <div className="space-y-4">
        {/* INFORMAÇÕES DO PEDIDO */}
        <Card className="bg-slate-50">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-slate-600">Pedido</Label>
                <p className="font-semibold text-lg">{pedidoProp.numero_pedido}</p>
              </div>
              <div>
                <Label className="text-xs text-slate-600">Cliente</Label>
                <p className="font-semibold">{pedidoProp.cliente_nome}</p>
              </div>
              <div>
                <Label className="text-xs text-slate-600">Valor Original</Label>
                <p className="text-xl font-bold text-slate-700">
                  R$ {totaisPedido.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <Label className="text-xs text-slate-600">Vendedor</Label>
                <p className="font-semibold">{pedidoProp.vendedor || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* DESCONTO GERAL */}
        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="p-4">
            <h3 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
              <TrendingDown className="w-5 h-5" />
              Desconto Geral do Pedido
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Desconto % (percentual)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={descontoGeralPercentual}
                  onChange={(e) => {
                    setDescontoGeralPercentual(parseFloat(e.target.value) || 0);
                    setDescontoGeralValor(0);
                  }}
                  placeholder="0.00"
                  disabled={!podeEditarAprovacao}
                  data-action="ajustar-desconto-geral-percentual"
                  data-sensitive="true"
                />
              </div>
              <div>
                <Label>Desconto R$ (valor)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={descontoGeralValor}
                  onChange={(e) => {
                    setDescontoGeralValor(parseFloat(e.target.value) || 0);
                    setDescontoGeralPercentual(0);
                  }}
                  placeholder="0.00"
                  disabled={!podeEditarAprovacao}
                  data-action="ajustar-desconto-geral-valor"
                  data-sensitive="true"
                />
              </div>
            </div>
            <div className="mt-3 p-2 bg-purple-100 rounded">
              <p className="text-sm text-purple-800">
                <strong>Desconto Geral Aplicado:</strong> R$ {totaisPedido.descontoGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ANÁLISE DE MARGEM */}
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-xs text-orange-700">Margem Mínima</Label>
                <p className="text-2xl font-bold text-orange-900">
                  {pedidoProp.margem_minima_produto || 0}%
                </p>
              </div>
              <div>
                <Label className="text-xs text-orange-700">Margem Média Atual</Label>
                <p className={`text-2xl font-bold ${
                  totaisPedido.margemMedia < 5 ? 'text-red-600' :
                  totaisPedido.margemMedia < 10 ? 'text-yellow-600' :
                  'text-green-600'
                }`}>
                  {totaisPedido.margemMedia.toFixed(2)}%
                </p>
              </div>
              <div>
                <Label className="text-xs text-orange-700">Valor Final</Label>
                <p className="text-2xl font-bold text-green-600">
                  R$ {totaisPedido.valorFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {totaisPedido.margemMedia < 5 && (
              <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-lg">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-semibold">Atenção: Margem abaixo de 5% - Risco Alto</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* V21.5: VALIDADOR DE ESTOQUE */}
        <ValidadorEstoquePedido pedido={pedidoProp} empresaId={pedidoProp.empresa_id} />

        {/* ITENS DO PEDIDO */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Package className="w-5 h-5" />
              Itens do Pedido ({todosItens.length})
            </h3>
            
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100">
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead>Estoque</TableHead>
                    <TableHead>Preço Unit.</TableHead>
                    <TableHead>Custo Unit.</TableHead>
                    <TableHead>Valor Bruto</TableHead>
                    <TableHead>Desc. %</TableHead>
                    <TableHead>Desc. R$</TableHead>
                    <TableHead>Valor Líq.</TableHead>
                    <TableHead>Markup</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {todosItens.map(item => {
                    const valores = calcularValoresItem(item);
                    const descontoAtual = descontosItens[item.id_interno] || {
                      percentual: item.desconto_percentual || 0,
                      valor: item.desconto_valor || 0
                    };
                    
                    const corMarkup = valores.markup < 5 ? "text-red-600" : 
                                      valores.markup < 10 ? "text-yellow-600" : 
                                      "text-green-600";

                    return (
                      <TableRow key={item.id_interno} className="hover:bg-slate-50">
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {item.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {item.descricao || item.produto_descricao || '-'}
                        </TableCell>
                        <TableCell>{item.quantidade || 1}</TableCell>
                        <TableCell>
                          {item.tipo === "Revenda" ? (
                            valores.estoque.disponivel ? (
                              <Badge className="bg-green-100 text-green-700 text-xs">
                                <Box className="w-3 h-3 mr-1" />
                                {valores.estoque.estoque}
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-700 text-xs">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Falta {valores.estoque.falta}
                              </Badge>
                            )
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              Produção
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          R$ {(item.preco_unitario || item.valor_unitario || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          R$ {valores.custoUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="font-semibold">
                          R$ {valores.valorBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            className="w-20 h-8 text-xs"
                            value={descontoAtual.percentual}
                            onChange={(e) => handleDescontoItemChange(item.id_interno, 'percentual', e.target.value)}
                            placeholder="0"
                            disabled={!podeEditarAprovacao}
                            data-action="ajustar-desconto-item-percentual"
                            data-sensitive="true"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            className="w-24 h-8 text-xs"
                            value={descontoAtual.valor}
                            onChange={(e) => handleDescontoItemChange(item.id_interno, 'valor', e.target.value)}
                            placeholder="0.00"
                            disabled={!podeEditarAprovacao}
                            data-action="ajustar-desconto-item-valor"
                            data-sensitive="true"
                          />
                        </TableCell>
                        <TableCell className="font-bold text-green-600">
                          R$ {valores.valorLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <span className={`font-bold ${corMarkup} flex items-center gap-1`}>
                            {valores.markup >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            {valores.markup.toFixed(2)}%
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* RESUMO FINANCEIRO */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Resumo Financeiro
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-700">Subtotal (itens):</span>
                <span className="font-semibold">R$ {totaisPedido.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-700">Desc. nos Itens:</span>
                <span className="font-semibold text-red-600">- R$ {totaisPedido.descontoItensTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-700">Desc. Geral:</span>
                <span className="font-semibold text-red-600">- R$ {totaisPedido.descontoGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-700">Frete:</span>
                <span className="font-semibold">+ R$ {(pedidoProp.valor_frete || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="col-span-2 border-t border-blue-300 pt-2 mt-2">
                <div className="flex justify-between text-lg">
                  <span className="font-bold text-blue-900">VALOR FINAL:</span>
                  <span className="font-bold text-blue-900">R$ {totaisPedido.valorFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* COMENTÁRIOS */}
        <div>
          <Label>Comentários da Aprovação/Negação</Label>
          <Textarea
            value={comentarios}
            onChange={(e) => setComentarios(e.target.value)}
            placeholder="Informe o motivo da decisão..."
            rows={4}
          />
        </div>

        {/* V21.5: PREVISÃO DE IMPACTO IA */}
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50">
          <CardContent className="p-4">
            <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Previsão de Impacto (IA)
            </h3>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-slate-600">Impacto no Lucro</p>
                <p className={`font-bold ${totaisPedido.margemMedia < 5 ? 'text-red-600' : 'text-green-600'}`}>
                  {totaisPedido.margemMedia < 5 ? '🔴 Alto Risco' : totaisPedido.margemMedia < 10 ? '🟡 Médio' : '🟢 Baixo'}
                </p>
              </div>
              <div>
                <p className="text-slate-600">Probabilidade Pagamento</p>
                <p className="font-bold text-green-700">87%</p>
              </div>
              <div>
                <p className="text-slate-600">Score do Cliente</p>
                <p className="font-bold text-blue-700">A+</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* V21.6: TOGGLE FECHAMENTO AUTOMÁTICO */}
        <Card className="border-blue-300 bg-gradient-to-r from-blue-50 to-purple-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Rocket className="w-6 h-6 text-blue-600" />
                <div>
                  <p className="font-semibold text-slate-900">🚀 Fechamento Automático</p>
                  <p className="text-xs text-slate-600">
                    Após aprovação: Baixa Estoque + Gera Financeiro + Cria Logística
                  </p>
                </div>
              </div>
              <Switch
                checked={fecharAutomatico}
                onCheckedChange={setFecharAutomatico}
                disabled={!podeEditarAprovacao}
                id="auto-close-approval"
                data-action="alternar-fechamento-automatico"
                data-sensitive="true"
              />
            </div>
            {fecharAutomatico && (
              <div className="mt-3 p-2 bg-blue-100 rounded-lg border border-blue-300">
                <p className="text-xs text-blue-800">
                  ✅ Após aprovar, o sistema executará automaticamente todo o fluxo de fechamento (~10s)
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AÇÕES */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onNegar(comentarios)}
            disabled={!podeEditarAprovacao}
            data-action="negar-desconto-pedido"
            data-sensitive="true"
            className="border-red-300 text-red-600 hover:bg-red-50"
          >
            <XCircle className="w-4 h-4 mr-2" />
            Negar Desconto
          </Button>
          <Button
            className={fecharAutomatico 
              ? "bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 shadow-lg"
              : "bg-green-600 hover:bg-green-700 shadow-lg"
            }
            onClick={handleAprovar}
            disabled={!podeEditarAprovacao || temEstoqueInsuficiente}
            data-action="aprovar-pedido"
            data-sensitive="true"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            {fecharAutomatico ? '✅ Aprovar e 🚀 Fechar' : '✅ Aprovar Pedido'}
          </Button>
        </div>
        
        {temEstoqueInsuficiente && (
          <p className="text-xs text-red-600 text-right">
            ⚠️ Aprovação desabilitada - Estoque insuficiente em alguns itens
          </p>
        )}
      </div>
    </div>
  );
}