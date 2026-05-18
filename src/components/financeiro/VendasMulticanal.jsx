import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ShoppingBag, 
  Globe, 
  Store, 
  Smartphone, 
  MessageCircle,
  TrendingUp,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  Truck,
  FileText
} from "lucide-react";
import { toast } from "sonner";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

export default function VendasMulticanal({ windowMode = false }) {
  const [canalFiltro, setCanalFiltro] = useState("todos");
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const { empresaAtual, grupoAtual, estaNoGrupo, filtrarPorContexto, createInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const contextoValido = Boolean(empresaAtual?.id || grupoAtual?.id || estaNoGrupo);
  const canView = hasPermission('Financeiro', 'Vendas Multicanal', 'ver') || hasPermission('Financeiro', 'Vendas Multicanal', 'visualizar');
  const canSyncPayment = hasPermission('Financeiro', 'Vendas Multicanal', 'editar') || hasPermission('Financeiro', null, 'editar') || hasPermission('Financeiro', null, 'baixar');

  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos-multicanal', empresaAtual?.id, grupoAtual?.id, estaNoGrupo],
    queryFn: () => filtrarPorContexto('Pedido', {}, '-created_date', 9999),
    enabled: Boolean(contextoValido && canView),
  });

  const { data: pagamentosOmnichannel = [] } = useQuery({
    queryKey: ['pagamentos-omnichannel', empresaAtual?.id, grupoAtual?.id, estaNoGrupo],
    queryFn: () => filtrarPorContexto('PagamentoOmnichannel', {}, '-created_date', 9999),
    enabled: Boolean(contextoValido && canView),
  });

  const pedidosFiltrados = pedidos;

  const pedidosMulticanal = pedidosFiltrados.filter(p => 
    ['E-commerce', 'Site', 'Marketplace', 'Portal', 'WhatsApp', 'Chatbot', 'App'].includes(p.origem_pedido)
  );

  const pedidosPorCanal = pedidosMulticanal.reduce((acc, p) => {
    const canal = p.origem_pedido || 'Outros';
    if (!acc[canal]) acc[canal] = { total: 0, quantidade: 0, valor: 0 };
    acc[canal].quantidade += 1;
    acc[canal].valor += p.valor_total || 0;
    return acc;
  }, {});

  const pedidosFinal = pedidosMulticanal.filter(p => {
    const canalMatch = canalFiltro === "todos" || p.origem_pedido === canalFiltro;
    const statusMatch = statusFiltro === "todos" || p.status === statusFiltro;
    const buscaMatch = !busca || 
      p.numero_pedido?.toLowerCase().includes(busca.toLowerCase()) ||
      p.cliente_nome?.toLowerCase().includes(busca.toLowerCase());
    return canalMatch && statusMatch && buscaMatch;
  });

  const totalPedidos = pedidosMulticanal.length;
  const totalValor = pedidosMulticanal.reduce((s, p) => s + (p.valor_total || 0), 0);
  const pedidosPendentes = pedidosMulticanal.filter(p => 
    ['Aguardando Aprovação', 'Aprovado', 'Pronto para Faturar'].includes(p.status)
  ).length;

  const iconeCanal = (canal) => {
    const icones = {
      'E-commerce': <ShoppingBag className="w-4 h-4" />,
      'Site': <Globe className="w-4 h-4" />,
      'Marketplace': <Store className="w-4 h-4" />,
      'Portal': <Globe className="w-4 h-4" />,
      'WhatsApp': <MessageCircle className="w-4 h-4" />,
      'App': <Smartphone className="w-4 h-4" />,
      'Chatbot': <MessageCircle className="w-4 h-4" />
    };
    return icones[canal] || <ShoppingBag className="w-4 h-4" />;
  };

  const corCanal = (canal) => {
    const cores = {
      'E-commerce': 'bg-blue-100 text-blue-700',
      'Site': 'bg-green-100 text-green-700',
      'Marketplace': 'bg-purple-100 text-purple-700',
      'Portal': 'bg-indigo-100 text-indigo-700',
      'WhatsApp': 'bg-emerald-100 text-emerald-700',
      'App': 'bg-orange-100 text-orange-700',
      'Chatbot': 'bg-pink-100 text-pink-700'
    };
    return cores[canal] || 'bg-slate-100 text-slate-700';
  };

  const sincronizarPagamentoMutation = useMutation({
    mutationFn: async (pedidoId) => {
      if (!contextoValido || !canSyncPayment) {
        await base44.entities.AuditLog.create({
          acao: 'Sincronizacao bloqueada',
          modulo: 'Financeiro',
          entidade: 'PagamentoOmnichannel',
          tipo_auditoria: 'seguranca',
          descricao: 'Bloqueio ao sincronizar pagamento multicanal',
          group_id: grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null,
          grupo_id: grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null,
          empresa_id: empresaAtual?.id || null,
          data_hora: new Date().toISOString()
        });
        throw new Error('Sem permissao ou contexto para sincronizar pagamento.');
      }
      const pedido = pedidos.find(p => p.id === pedidoId);
      await createInContext('PagamentoOmnichannel', {
        empresa_id: pedido.empresa_id,
        group_id: pedido.group_id || pedido.grupo_id || grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id,
        origem_canal: pedido.origem_pedido,
        pedido_id: pedido.id,
        numero_pedido: pedido.numero_pedido,
        cliente_nome: pedido.cliente_nome,
        valor_total: pedido.valor_total,
        forma_pagamento: pedido.forma_pagamento,
        status_conferencia: 'Pendente',
        data_venda: pedido.data_pedido
      });
      await base44.entities.AuditLog.create({
        acao: 'Sincronizar pagamento',
        modulo: 'Financeiro',
        entidade: 'PagamentoOmnichannel',
        tipo_auditoria: 'sensivel',
        descricao: `Pagamento multicanal sincronizado: ${pedido.numero_pedido || pedido.id}`,
        group_id: pedido.group_id || pedido.grupo_id || grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null,
        grupo_id: pedido.group_id || pedido.grupo_id || grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null,
        empresa_id: pedido.empresa_id || empresaAtual?.id || null,
        data_hora: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pagamentos-omnichannel'] });
      toast.success("✅ Pagamento sincronizado!");
    }
  });

  const content = (
    <div className="space-y-1.5" data-permission="Financeiro.Vendas Multicanal.visualizar">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="w-6 h-6 text-blue-600" />
            Vendas Multicanal
          </h2>
          <p className="text-sm text-slate-600">Portal • Site • Marketplace • WhatsApp • E-commerce</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md bg-blue-50">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-blue-700">Total de Pedidos</p>
                <p className="text-2xl font-bold text-blue-900">{totalPedidos}</p>
              </div>
              <ShoppingBag className="w-6 h-6 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-green-50">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-green-700">Valor Total</p>
                <p className="text-2xl font-bold text-green-900">R$ {totalValor.toFixed(2)}</p>
              </div>
              <TrendingUp className="w-6 h-6 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-orange-50">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-orange-700">Pendentes</p>
                <p className="text-2xl font-bold text-orange-900">{pedidosPendentes}</p>
              </div>
              <Clock className="w-6 h-6 text-orange-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-purple-50">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-purple-700">Canais Ativos</p>
                <p className="text-2xl font-bold text-purple-900">{Object.keys(pedidosPorCanal).length}</p>
              </div>
              <Globe className="w-6 h-6 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-md">
        <CardHeader className="border-b bg-slate-50">
          <CardTitle>📊 Desempenho por Canal</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(pedidosPorCanal).map(([canal, dados]) => (
              <Card key={canal} className="border-2">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {iconeCanal(canal)}
                    <p className="font-semibold text-sm">{canal}</p>
                  </div>
                  <p className="text-xl font-bold text-slate-900">{dados.quantidade}</p>
                  <p className="text-sm text-green-600 font-semibold">R$ {dados.valor.toFixed(2)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md">
        <CardHeader className="border-b bg-slate-50">
          <div className="flex justify-between items-center">
            <CardTitle>📦 Pedidos por Canal</CardTitle>
            <div className="flex gap-2">
              <Input
                placeholder="🔍 Buscar pedido ou cliente..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                data-permission="Financeiro.Vendas Multicanal.visualizar"
                data-action="Financeiro.VendasMulticanal.buscar"
                className="w-64"
              />
              <Select value={canalFiltro} onValueChange={setCanalFiltro}>
                <SelectTrigger className="w-40" data-permission="Financeiro.Vendas Multicanal.visualizar" data-action="Financeiro.VendasMulticanal.filtrar">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Canais</SelectItem>
                  <SelectItem value="E-commerce">E-commerce</SelectItem>
                  <SelectItem value="Site">Site</SelectItem>
                  <SelectItem value="Marketplace">Marketplace</SelectItem>
                  <SelectItem value="Portal">Portal</SelectItem>
                  <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                  <SelectItem value="App">App</SelectItem>
                  <SelectItem value="Chatbot">Chatbot</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                <SelectTrigger className="w-40" data-permission="Financeiro.Vendas Multicanal.visualizar" data-action="Financeiro.VendasMulticanal.filtrar">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Status</SelectItem>
                  <SelectItem value="Aguardando Aprovação">Aguardando</SelectItem>
                  <SelectItem value="Aprovado">Aprovado</SelectItem>
                  <SelectItem value="Pronto para Faturar">Pronto Faturar</SelectItem>
                  <SelectItem value="Faturado">Faturado</SelectItem>
                  <SelectItem value="Em Expedição">Em Expedição</SelectItem>
                  <SelectItem value="Entregue">Entregue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Pedido</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pedidosFinal.map(pedido => (
                <TableRow key={pedido.id}>
                  <TableCell className="font-mono font-semibold">{pedido.numero_pedido}</TableCell>
                  <TableCell>
                    <Badge className={corCanal(pedido.origem_pedido)}>
                      {iconeCanal(pedido.origem_pedido)}
                      <span className="ml-1">{pedido.origem_pedido}</span>
                    </Badge>
                  </TableCell>
                  <TableCell>{pedido.cliente_nome}</TableCell>
                  <TableCell className="text-sm">
                    {new Date(pedido.data_pedido).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell className="font-bold">R$ {(pedido.valor_total || 0).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{pedido.forma_pagamento || '-'}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={
                      ['Entregue', 'Faturado'].includes(pedido.status) ? 'bg-green-100 text-green-700' :
                      ['Aguardando Aprovação', 'Aprovado'].includes(pedido.status) ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }>
                      {pedido.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" data-permission="Financeiro.Vendas Multicanal.visualizar" data-action="Financeiro.VendasMulticanal.ver" title="Ver Detalhes">
                        <Eye className="w-4 h-4" />
                      </Button>
                      {['Aprovado', 'Pronto para Faturar'].includes(pedido.status) && (
                        <Button 
                          size="sm" 
                          className="bg-green-600"
                          data-permission="Financeiro.Vendas Multicanal.editar"
                          data-action="Financeiro.VendasMulticanal.sincronizar_pagamento"
                          disabled={!canSyncPayment || sincronizarPagamentoMutation.isPending}
                          onClick={() => sincronizarPagamentoMutation.mutate(pedido.id)}
                          title="Sincronizar Pagamento"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {pedidosFinal.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Globe className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>Nenhum pedido de canais digitais encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md">
        <CardHeader className="border-b bg-slate-50">
          <CardTitle>💳 Pagamentos Omnichannel - Conferência</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Canal</TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Forma Pagto</TableHead>
                <TableHead>Status Conferência</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagamentosOmnichannel.map(pag => (
                <TableRow key={pag.id}>
                  <TableCell>
                    <Badge className={corCanal(pag.origem_canal)}>
                      {pag.origem_canal}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono">{pag.numero_pedido}</TableCell>
                  <TableCell>{pag.cliente_nome}</TableCell>
                  <TableCell className="font-bold">R$ {(pag.valor_total || 0).toFixed(2)}</TableCell>
                  <TableCell><Badge variant="outline">{pag.forma_pagamento}</Badge></TableCell>
                  <TableCell>
                    <Badge className={
                      pag.status_conferencia === 'Conferido' ? 'bg-green-100 text-green-700' :
                      pag.status_conferencia === 'Divergência' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }>
                      {pag.status_conferencia}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(pag.data_venda).toLocaleDateString('pt-BR')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {pagamentosOmnichannel.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>Nenhum pagamento omnichannel registrado</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  if (windowMode) {
    return <div className="w-full h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50 overflow-auto p-1.5">{content}</div>;
  }

  return content;
}
