import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Wallet,
  CheckCircle2,
  Clock,
  DollarSign,
  CreditCard,
  Building2,
  User,
  Calendar,
  ArrowDownCircle,
  ArrowUpCircle,
  Filter
} from "lucide-react";
import { useUser } from "@/components/lib/UserContext";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { toast } from "sonner";

/**
 * ETAPA 4 - Caixa como Central de Liquidação
 * Módulo central para liquidação de todos os recebimentos e pagamentos
 */
export default function CaixaCentral({ windowMode = false }) {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, filterInContext, updateInContext } = useContextoVisual();
  const { canEdit, hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const contextKey = empresaAtual?.id || groupId || "sem-contexto";
  const contextoValido = contextKey !== "sem-contexto";
  const podeLiquidar = canEdit("Financeiro", "Caixa") ||
    canEdit("Financeiro", "Caixa Central") ||
    hasPermission("Financeiro", null, "baixar");
  const [filtros, setFiltros] = useState({
    tipo: "todos", // 'todos', 'Recebimento', 'Pagamento'
    origem: "todos",
    status: "Pendente"
  });
  const [ordensSelecionadas, setOrdensSelecionadas] = useState([]);
  const [modalLiquidacao, setModalLiquidacao] = useState(false);
  const [dadosLiquidacao, setDadosLiquidacao] = useState({
    forma_pagamento: "",
    valor_recebido: 0,
    acrescimo: 0,
    desconto: 0,
    observacoes: ""
  });

  // Buscar ordens de liquidação pendentes
  const { data: ordensLiquidacao = [], isLoading } = useQuery({
    queryKey: ['caixa-ordens', filtros, contextKey],
    queryFn: async () => {
      const ordens = await filterInContext('CaixaOrdemLiquidacao', {}, '-created_date', 200);
      return ordens.filter(o => {
        if (filtros.status !== "todos" && o.status !== filtros.status) return false;
        if (filtros.tipo !== "todos" && o.tipo_operacao !== filtros.tipo) return false;
        if (filtros.origem !== "todos" && o.origem !== filtros.origem) return false;
        return true;
      });
    },
    enabled: contextoValido
  });

  // Mutation para liquidar ordens
  const liquidarOrdens = useMutation({
    mutationFn: async ({ ordensIds, dados }) => {
      const resultados = [];
      if (!contextoValido || !podeLiquidar) throw new Error("Sem contexto ou permissão para liquidar.");
      
      for (const ordemId of ordensIds) {
        const ordem = ordensLiquidacao.find(o => o.id === ordemId);
        
        // Calcular valor líquido
        const valorLiquido = dados.valor_recebido + dados.acrescimo - dados.desconto;
        
        // Atualizar ordem
        await updateInContext('CaixaOrdemLiquidacao', ordemId, {
          status: "Liquidado",
          usuario_liquidacao_id: user.id,
          data_liquidacao: new Date().toISOString()
        });

        // Baixar títulos vinculados
        for (const titulo of ordem.titulos_vinculados) {
          if (titulo.tipo_titulo === "ContaReceber") {
            await updateInContext('ContaReceber', titulo.titulo_id, {
              status: "Pago",
              data_pagamento: new Date().toISOString(),
              valor_pago: valorLiquido,
              forma_pagamento: dados.forma_pagamento,
              usuario_baixa_id: user.id
            });
          } else if (titulo.tipo_titulo === "ContaPagar") {
            await updateInContext('ContaPagar', titulo.titulo_id, {
              status: "Pago",
              data_pagamento: new Date().toISOString(),
              valor_pago: valorLiquido,
              forma_pagamento: dados.forma_pagamento,
              usuario_baixa_id: user.id
            });
          }
        }

        // Registrar auditoria
        await base44.entities.AuditLog.create({
          group_id: ordem.group_id,
          empresa_id: ordem.empresa_id,
          usuario_id: user.id,
          usuario_nome: user.full_name,
          acao: `Liquidação no Caixa - ${ordem.tipo_operacao}`,
          modulo: "Caixa",
          entidade: "CaixaOrdemLiquidacao",
          entidade_id: ordemId,
          detalhes: {
            tipo_operacao: ordem.tipo_operacao,
            valor_total: ordem.valor_total,
            valor_liquido: valorLiquido,
            forma_pagamento: dados.forma_pagamento,
            titulos: ordem.titulos_vinculados.length
          }
        });

        resultados.push({ ordemId, success: true });
      }

      return resultados;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['caixa-ordens']);
      setOrdensSelecionadas([]);
      setModalLiquidacao(false);
      setDadosLiquidacao({
        forma_pagamento: "",
        valor_recebido: 0,
        acrescimo: 0,
        desconto: 0,
        observacoes: ""
      });
      toast.success("Liquidação realizada com sucesso!");
    }
  });

  const toggleOrdemSelecionada = (ordemId) => {
    if (ordensSelecionadas.includes(ordemId)) {
      setOrdensSelecionadas(ordensSelecionadas.filter(id => id !== ordemId));
    } else {
      setOrdensSelecionadas([...ordensSelecionadas, ordemId]);
    }
  };

  const iniciarLiquidacao = () => {
    if (ordensSelecionadas.length === 0) {
      toast.error("Selecione ao menos uma ordem para liquidar");
      return;
    }
    
    const ordens = ordensLiquidacao.filter(o => ordensSelecionadas.includes(o.id));
    const valorTotal = ordens.reduce((sum, o) => sum + o.valor_total, 0);
    
    setDadosLiquidacao({
      forma_pagamento: "",
      valor_recebido: valorTotal,
      acrescimo: 0,
      desconto: 0,
      observacoes: ""
    });
    setModalLiquidacao(true);
  };

  const confirmarLiquidacao = () => {
    if (!dadosLiquidacao.forma_pagamento) {
      toast.error("Selecione a forma de pagamento");
      return;
    }
    if (dadosLiquidacao.valor_recebido <= 0) {
      toast.error("Valor recebido deve ser maior que zero");
      return;
    }
    
    liquidarOrdens.mutate({
      ordensIds: ordensSelecionadas,
      dados: dadosLiquidacao
    });
  };

  const content = (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Wallet className="w-6 h-6 text-green-600" />
            Caixa - Central de Liquidação
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Módulo central de liquidação financeira • ETAPA 4
          </p>
        </div>
        <div className="flex gap-2">
          <Badge className="bg-green-100 text-green-800">
            <ArrowDownCircle className="w-3 h-3 mr-1" />
            {ordensLiquidacao.filter(o => o.tipo_operacao === "Recebimento" && o.status === "Pendente").length} recebimentos
          </Badge>
          <Badge className="bg-red-100 text-red-800">
            <ArrowUpCircle className="w-3 h-3 mr-1" />
            {ordensLiquidacao.filter(o => o.tipo_operacao === "Pagamento" && o.status === "Pendente").length} pagamentos
          </Badge>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Tipo</Label>
              <Select value={filtros.tipo} onValueChange={(v) => setFiltros({...filtros, tipo: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="Recebimento">Recebimentos</SelectItem>
                  <SelectItem value="Pagamento">Pagamentos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Origem</Label>
              <Select value={filtros.origem} onValueChange={(v) => setFiltros({...filtros, origem: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="Contas a Receber">Contas a Receber</SelectItem>
                  <SelectItem value="Contas a Pagar">Contas a Pagar</SelectItem>
                  <SelectItem value="Venda Direta">Venda Direta</SelectItem>
                  <SelectItem value="Omnichannel">Omnichannel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={filtros.status} onValueChange={(v) => setFiltros({...filtros, status: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                  <SelectItem value="Em Processamento">Em Processamento</SelectItem>
                  <SelectItem value="Liquidado">Liquidado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botão de Liquidação em Lote */}
      {ordensSelecionadas.length > 0 && (
        <Card className="bg-blue-50 border-2 border-blue-500">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-blue-900">
                  {ordensSelecionadas.length} ordem(ns) selecionada(s)
                </p>
                <p className="text-sm text-blue-700">
                  Valor total: R$ {ordensLiquidacao
                    .filter(o => ordensSelecionadas.includes(o.id))
                    .reduce((sum, o) => sum + o.valor_total, 0)
                    .toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                </p>
              </div>
              <Button onClick={iniciarLiquidacao} disabled={!contextoValido || !podeLiquidar} className="bg-blue-600 hover:bg-blue-700">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Liquidar Selecionadas
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Ordens */}
      <div className="space-y-3">
        {ordensLiquidacao.map(ordem => (
          <Card 
            key={ordem.id}
            className={`cursor-pointer transition-all hover:shadow-lg ${
              ordensSelecionadas.includes(ordem.id) ? 'ring-2 ring-blue-500 bg-blue-50' : ''
            } ${
              ordem.status === "Liquidado" ? 'opacity-60' : ''
            }`}
            onClick={() => ordem.status === "Pendente" && podeLiquidar && toggleOrdemSelecionada(ordem.id)}
          >
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    ordem.tipo_operacao === "Recebimento" 
                      ? 'bg-green-100' 
                      : 'bg-red-100'
                  }`}>
                    {ordem.tipo_operacao === "Recebimento" ? (
                      <ArrowDownCircle className="w-6 h-6 text-green-600" />
                    ) : (
                      <ArrowUpCircle className="w-6 h-6 text-red-600" />
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-slate-900">
                        {ordem.tipo_operacao}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {ordem.origem}
                      </Badge>
                      {ordem.status === "Pendente" && (
                        <Badge className="bg-orange-100 text-orange-800 text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          Pendente
                        </Badge>
                      )}
                      {ordem.status === "Liquidado" && (
                        <Badge className="bg-green-100 text-green-800 text-xs">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Liquidado
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-slate-600">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {ordem.titulos_vinculados?.[0]?.cliente_fornecedor_nome || "N/A"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(ordem.data_ordem).toLocaleDateString('pt-BR')}
                      </span>
                      <span className="flex items-center gap-1">
                        <CreditCard className="w-3 h-3" />
                        {ordem.forma_pagamento_pretendida}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-900">
                    R$ {ordem.valor_total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                  </p>
                  <p className="text-xs text-slate-500">
                    {ordem.titulos_vinculados?.length || 0} título(s)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {ordensLiquidacao.length === 0 && !isLoading && (
        <Card className="p-8">
          <div className="text-center text-slate-500">
            <Wallet className="w-12 h-12 mx-auto mb-3 text-slate-400" />
            <p className="text-lg font-medium">Nenhuma ordem encontrada</p>
            <p className="text-sm">Altere os filtros ou aguarde novas movimentações</p>
          </div>
        </Card>
      )}

      {/* Modal de Liquidação */}
      {modalLiquidacao && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader className="bg-green-50">
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                Liquidar Ordens Selecionadas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Forma de Pagamento *</Label>
                  <Select 
                    value={dadosLiquidacao.forma_pagamento}
                    onValueChange={(v) => setDadosLiquidacao({...dadosLiquidacao, forma_pagamento: v})}
                    disabled={!contextoValido || !podeLiquidar || liquidarOrdens.isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="Cartão Crédito">Cartão Crédito</SelectItem>
                      <SelectItem value="Cartão Débito">Cartão Débito</SelectItem>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="Boleto">Boleto</SelectItem>
                      <SelectItem value="Transferência">Transferência</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Valor Recebido/Pago *</Label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={dadosLiquidacao.valor_recebido}
                    onChange={(e) => setDadosLiquidacao({...dadosLiquidacao, valor_recebido: parseFloat(e.target.value) || 0})}
                    disabled={!contextoValido || !podeLiquidar || liquidarOrdens.isPending}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Acréscimo (Juros/Multa)</Label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={dadosLiquidacao.acrescimo}
                    onChange={(e) => setDadosLiquidacao({...dadosLiquidacao, acrescimo: parseFloat(e.target.value) || 0})}
                    disabled={!contextoValido || !podeLiquidar || liquidarOrdens.isPending}
                  />
                </div>
                
                <div>
                  <Label>Desconto</Label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={dadosLiquidacao.desconto}
                    onChange={(e) => setDadosLiquidacao({...dadosLiquidacao, desconto: parseFloat(e.target.value) || 0})}
                    disabled={!contextoValido || !podeLiquidar || liquidarOrdens.isPending}
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded">
                <div className="flex justify-between text-sm mb-2">
                  <span>Valor Original:</span>
                  <span className="font-medium">
                    R$ {ordensLiquidacao
                      .filter(o => ordensSelecionadas.includes(o.id))
                      .reduce((sum, o) => sum + o.valor_total, 0)
                      .toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                  </span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Acréscimo:</span>
                  <span className="font-medium text-green-600">
                    + R$ {dadosLiquidacao.acrescimo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                  </span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Desconto:</span>
                  <span className="font-medium text-red-600">
                    - R$ {dadosLiquidacao.desconto.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                  </span>
                </div>
                <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                  <span>Valor Líquido:</span>
                  <span className="text-lg text-green-600">
                    R$ {(dadosLiquidacao.valor_recebido + dadosLiquidacao.acrescimo - dadosLiquidacao.desconto)
                      .toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                  </span>
                </div>
              </div>

              <div>
                <Label>Observações</Label>
                <Textarea 
                  placeholder="Informações adicionais..."
                  value={dadosLiquidacao.observacoes}
                  onChange={(e) => setDadosLiquidacao({...dadosLiquidacao, observacoes: e.target.value})}
                  rows={3}
                  disabled={!contextoValido || !podeLiquidar || liquidarOrdens.isPending}
                />
              </div>

              <div className="flex gap-3">
                <Button 
                  onClick={() => setModalLiquidacao(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={confirmarLiquidacao}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={!contextoValido || !podeLiquidar || liquidarOrdens.isPending}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Confirmar Liquidação
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="flex-1 overflow-auto p-6">
          {content}
        </div>
      </div>
    );
  }

  return content;
}
