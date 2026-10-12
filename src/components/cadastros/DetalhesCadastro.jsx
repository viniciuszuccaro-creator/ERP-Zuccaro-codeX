import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Clock,
  ShoppingBag,
  DollarSign,
  Truck,
  FileText,
  MessageSquare,
  X,
  Eye,
  MapPin,
  Phone,
  Mail,
  TrendingUp,
  AlertCircle
} from "lucide-react";
import TimelineCliente, { ResumoHistorico } from "../cliente/TimelineCliente";

/**
 * V21.1.2 - WINDOW MODE READY
 * Convertido para suportar modo janela independente
 */
export default function DetalhesCadastro({ tipo, registro, onClose, onUpdate, windowMode = false }) {
  const [activeTab, setActiveTab] = useState("historico");

  // Buscar dados relacionados
  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos-cliente', registro.id],
    queryFn: () => base44.entities.Pedido.filter({ cliente_id: registro.id }, '-data_pedido', 20),
    enabled: tipo === 'cliente'
  });

  const { data: contasReceber = [] } = useQuery({
    queryKey: ['contas-cliente', registro.id],
    queryFn: () => base44.entities.ContaReceber.filter({ cliente_id: registro.id }, '-data_vencimento', 20),
    enabled: tipo === 'cliente'
  });

  const { data: entregas = [] } = useQuery({
    queryKey: ['entregas-cliente', registro.id],
    queryFn: () => base44.entities.Entrega.filter({ cliente_id: registro.id }, '-created_date', 20),
    enabled: tipo === 'cliente'
  });

  const { data: notasFiscais = [] } = useQuery({
    queryKey: ['notas-cliente', registro.id],
    queryFn: () => base44.entities.NotaFiscal.filter({ cliente_fornecedor_id: registro.id }, '-data_emissao', 20),
    enabled: tipo === 'cliente'
  });

  const totalVendas = pedidos.reduce((sum, p) => sum + (p.valor_total || 0), 0);
  const totalReceber = contasReceber.filter(c => c.status === 'Pendente').reduce((sum, c) => sum + (c.valor || 0), 0);
  const contasAtrasadas = contasReceber.filter(c => 
    c.status === 'Pendente' && new Date(c.data_vencimento) < new Date()
  ).length;

  const content = (
    <div className={windowMode ? 'w-full h-full overflow-auto bg-white p-6' : ''}>
      <div className={windowMode ? '' : 'p-6'}>
        {!windowMode && (
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-slate-900">
              {tipo === 'cliente' ? 'Histórico Completo do Cliente' : 'Detalhes'}
            </h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6 mb-6">
            <TabsTrigger value="historico" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Clock className="w-4 h-4 mr-2" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="pedidos" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <ShoppingBag className="w-4 h-4 mr-2" />
              Pedidos ({pedidos.length})
            </TabsTrigger>
            <TabsTrigger value="financeiro" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <DollarSign className="w-4 h-4 mr-2" />
              Financeiro
            </TabsTrigger>
            <TabsTrigger value="entregas" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Truck className="w-4 h-4 mr-2" />
              Entregas ({entregas.length})
            </TabsTrigger>
            <TabsTrigger value="documentos" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <FileText className="w-4 h-4 mr-2" />
              Documentos
            </TabsTrigger>
            <TabsTrigger value="comunicacao" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <MessageSquare className="w-4 h-4 mr-2" />
              Comunicação
            </TabsTrigger>
          </TabsList>

          {/* ABA: TIMELINE UNIFICADA */}
          <TabsContent value="historico" className="space-y-4">
            <ResumoHistorico clienteId={registro.id} />
            <TimelineCliente clienteId={registro.id} showFilters={true} />
          </TabsContent>

          {/* ABA: PEDIDOS */}
          <TabsContent value="pedidos" className="space-y-4">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <p className="text-sm text-blue-700">Total de Pedidos</p>
                  <p className="text-2xl font-bold text-blue-900">{pedidos.length}</p>
                </CardContent>
              </Card>
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4">
                  <p className="text-sm text-green-700">Total em Vendas</p>
                  <p className="text-2xl font-bold text-green-900">
                    R$ {totalVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-sky-50 border-sky-200">
                <CardContent className="p-4">
                  <p className="text-sm text-sky-700">Ticket Médio</p>
                  <p className="text-2xl font-bold text-sky-900">
                    R$ {pedidos.length > 0 ? (totalVendas / pedidos.length).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Número</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pedidos.map(pedido => (
                    <TableRow key={pedido.id}>
                      <TableCell className="font-medium">{pedido.numero_pedido}</TableCell>
                      <TableCell>{new Date(pedido.data_pedido).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{pedido.status}</Badge>
                      </TableCell>
                      <TableCell className="font-semibold text-green-600">
                        R$ {pedido.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {pedidos.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <ShoppingBag className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>Nenhum pedido encontrado</p>
              </div>
            )}
          </TabsContent>

          {/* ABA: FINANCEIRO */}
          <TabsContent value="financeiro" className="space-y-4">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4">
                  <p className="text-sm text-green-700">A Receber</p>
                  <p className="text-2xl font-bold text-green-900">
                    R$ {totalReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-red-50 border-red-200">
                <CardContent className="p-4">
                  <p className="text-sm text-red-700">Contas Atrasadas</p>
                  <p className="text-2xl font-bold text-red-900">{contasAtrasadas}</p>
                </CardContent>
              </Card>
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <p className="text-sm text-blue-700">Score de Pagamento</p>
                  <p className="text-2xl font-bold text-blue-900">{registro.score_pagamento || 100}</p>
                </CardContent>
              </Card>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Descrição</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contasReceber.map(conta => (
                    <TableRow key={conta.id}>
                      <TableCell>{conta.descricao}</TableCell>
                      <TableCell>
                        {new Date(conta.data_vencimento).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="font-semibold">
                        R$ {conta.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{conta.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {contasReceber.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <DollarSign className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>Nenhuma conta a receber</p>
              </div>
            )}
          </TabsContent>

          {/* ABA: ENTREGAS */}
          <TabsContent value="entregas" className="space-y-4">
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Pedido</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>Data Previsão</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entregas.map(entrega => (
                    <TableRow key={entrega.id}>
                      <TableCell className="font-medium">{entrega.numero_pedido || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="w-3 h-3" />
                          {entrega.endereco_entrega_completo?.cidade}, {entrega.endereco_entrega_completo?.estado}
                        </div>
                      </TableCell>
                      <TableCell>
                        {entrega.data_previsao 
                          ? new Date(entrega.data_previsao).toLocaleDateString('pt-BR')
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{entrega.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {entregas.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <Truck className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>Nenhuma entrega encontrada</p>
              </div>
            )}
          </TabsContent>

          {/* ABA: DOCUMENTOS */}
          <TabsContent value="documentos" className="space-y-4">
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Tipo</TableHead>
                    <TableHead>Número</TableHead>
                    <TableHead>Data Emissão</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notasFiscais.map(nf => (
                    <TableRow key={nf.id}>
                      <TableCell>
                        <Badge variant="outline">{nf.tipo}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{nf.numero}/{nf.serie}</TableCell>
                      <TableCell>
                        {new Date(nf.data_emissao).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="font-semibold">
                        R$ {nf.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{nf.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {notasFiscais.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>Nenhuma nota fiscal encontrada</p>
              </div>
            )}
          </TabsContent>

          {/* ABA: COMUNICAÇÃO */}
          <TabsContent value="comunicacao" className="space-y-4">
            <div className="text-center py-12 text-slate-500">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>Histórico de comunicações</p>
              <p className="text-sm mt-2">WhatsApp, E-mails e Mensagens do sistema</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );

  if (windowMode) {
    return content;
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="bg-gradient-to-br from-slate-50 to-blue-50 border-t border-slate-200"
    >
      {content}
    </motion.div>
  );
}