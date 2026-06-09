import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Clock, CheckCircle, Search, Package } from "lucide-react";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

/**
 * Controle de Lotes e Validade
 * Alertas automáticos, FEFO, rastreabilidade
 */
export default function ControleLotesValidade({ empresaId }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroAlerta, setFiltroAlerta] = useState("todos");
  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const contextKey = empresaId || empresaAtual?.id || grupoAtual?.id || "sem-contexto";
  const contextoValido = contextKey !== "sem-contexto";

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos-lotes', contextKey],
    queryFn: async () => {
      const todos = await filterInContext('Produto', {}, '-updated_date', 1000);
      return todos.filter(p => 
        (empresaId ? p.empresa_id === empresaId : true) &&
        (p.controla_lote || p.controla_validade) &&
        p.status === "Ativo"
      );
    },
    enabled: contextoValido,
  });

  // Processar todos os lotes
  const todosLotes = [];
  produtos.forEach(produto => {
    if (produto.lotes?.length > 0) {
      produto.lotes.forEach(lote => {
        const hoje = new Date();
        const dataValidade = lote.data_validade ? new Date(lote.data_validade) : null;
        const diasRestantes = dataValidade ? Math.floor((dataValidade - hoje) / (1000 * 60 * 60 * 24)) : null;
        
        let alerta = "ok";
        if (diasRestantes !== null) {
          if (diasRestantes < 0) alerta = "vencido";
          else if (diasRestantes <= 7) alerta = "7dias";
          else if (diasRestantes <= 15) alerta = "15dias";
          else if (diasRestantes <= 30) alerta = "30dias";
        }

        todosLotes.push({
          produto_id: produto.id,
          produto_codigo: produto.codigo,
          produto_descricao: produto.descricao,
          empresa_id: produto.empresa_id,
          ...lote,
          dias_restantes: diasRestantes,
          alerta
        });
      });
    }
  });

  // Filtros
  const lotesFiltrados = todosLotes.filter(lote => {
    const matchBusca = searchTerm === "" ||
      lote.produto_descricao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lote.numero_lote?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchAlerta = filtroAlerta === "todos" || lote.alerta === filtroAlerta;
    
    return matchBusca && matchAlerta;
  });

  // Contadores
  const alertas = {
    vencido: todosLotes.filter(l => l.alerta === "vencido").length,
    em7dias: todosLotes.filter(l => l.alerta === "7dias").length,
    em15dias: todosLotes.filter(l => l.alerta === "15dias").length,
    em30dias: todosLotes.filter(l => l.alerta === "30dias").length
  };

  return (
    <div
      className="space-y-6 w-full h-full"
      data-permission="Estoque.Lotes.visualizar"
      data-context-required="group-or-company"
    >
      {/* Alertas Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card 
          className={`cursor-pointer ${alertas.vencido > 0 ? 'border-2 border-red-500 bg-red-50' : ''}`}
          onClick={() => setFiltroAlerta("vencido")}
          data-action="Estoque.Lotes.filtro.vencidos"
          data-permission="Estoque.Lotes.visualizar"
          data-context-required="group-or-company"
        >
          <CardContent className="p-4 text-center">
            <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-red-600" />
            <p className="text-xs text-red-700">Vencidos</p>
            <p className="text-3xl font-bold text-red-900">{alertas.vencido}</p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer ${alertas.em7dias > 0 ? 'border-2 border-orange-500 bg-orange-50' : ''}`}
          onClick={() => setFiltroAlerta("7dias")}
          data-action="Estoque.Lotes.filtro.7dias"
          data-permission="Estoque.Lotes.visualizar"
          data-context-required="group-or-company"
        >
          <CardContent className="p-4 text-center">
            <Clock className="w-6 h-6 mx-auto mb-2 text-orange-600" />
            <p className="text-xs text-orange-700">Vencem em 7 dias</p>
            <p className="text-3xl font-bold text-orange-900">{alertas.em7dias}</p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer ${alertas.em15dias > 0 ? 'border-2 border-yellow-500 bg-yellow-50' : ''}`}
          onClick={() => setFiltroAlerta("15dias")}
          data-action="Estoque.Lotes.filtro.15dias"
          data-permission="Estoque.Lotes.visualizar"
          data-context-required="group-or-company"
        >
          <CardContent className="p-4 text-center">
            <Clock className="w-6 h-6 mx-auto mb-2 text-yellow-600" />
            <p className="text-xs text-yellow-700">Vencem em 15 dias</p>
            <p className="text-3xl font-bold text-yellow-900">{alertas.em15dias}</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer"
          onClick={() => setFiltroAlerta("30dias")}
          data-action="Estoque.Lotes.filtro.30dias"
          data-permission="Estoque.Lotes.visualizar"
          data-context-required="group-or-company"
        >
          <CardContent className="p-4 text-center">
            <Clock className="w-6 h-6 mx-auto mb-2 text-blue-600" />
            <p className="text-xs text-blue-700">Vencem em 30 dias</p>
            <p className="text-3xl font-bold text-blue-900">{alertas.em30dias}</p>
          </CardContent>
        </Card>
      </div>

      {/* Busca e Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <Input
                placeholder="Buscar produto ou lote..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-action="Estoque.Lotes.buscar"
                data-permission="Estoque.Lotes.visualizar"
                data-context-required="group-or-company"
              />
            </div>
            <select
              value={filtroAlerta}
              onChange={(e) => setFiltroAlerta(e.target.value)}
              className="px-4 py-2 border rounded"
              data-action="Estoque.Lotes.filtro.alerta"
              data-permission="Estoque.Lotes.visualizar"
              data-context-required="group-or-company"
            >
              <option value="todos">Todos os Lotes</option>
              <option value="vencido">Vencidos</option>
              <option value="7dias">7 dias</option>
              <option value="15dias">15 dias</option>
              <option value="30dias">30 dias</option>
              <option value="ok">Sem Alertas</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Lotes */}
      <Card>
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle className="text-base">Lotes e Validade ({lotesFiltrados.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Produto</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead>Fabricação</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead className="text-right">Disponível</TableHead>
                  <TableHead className="text-right">Reservado</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lotesFiltrados.map((lote, idx) => (
                  <TableRow key={idx} className={
                    lote.alerta === "vencido" ? "bg-red-50" :
                    lote.alerta === "7dias" ? "bg-orange-50" :
                    lote.alerta === "15dias" ? "bg-yellow-50" :
                    ""
                  }>
                    <TableCell>
                      <div>
                        {lote.produto_codigo && (
                          <span className="text-xs font-mono text-slate-500 mr-2">
                            {lote.produto_codigo}
                          </span>
                        )}
                        <span className="font-medium">{lote.produto_descricao}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono font-semibold">{lote.numero_lote}</TableCell>
                    <TableCell className="text-sm">
                      {lote.data_fabricacao ? new Date(lote.data_fabricacao).toLocaleDateString('pt-BR') : '-'}
                    </TableCell>
                    <TableCell>
                      {lote.data_validade ? (
                        <div>
                          <p className="text-sm">{new Date(lote.data_validade).toLocaleDateString('pt-BR')}</p>
                          {lote.dias_restantes !== null && (
                            <p className={`text-xs ${
                              lote.dias_restantes < 0 ? 'text-red-600' :
                              lote.dias_restantes <= 7 ? 'text-orange-600' :
                              'text-slate-500'
                            }`}>
                              {lote.dias_restantes < 0 ? `Vencido há ${Math.abs(lote.dias_restantes)} dias` : 
                               `${lote.dias_restantes} dias restantes`}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {lote.quantidade_disponivel || lote.quantidade}
                    </TableCell>
                    <TableCell className="text-right">
                      {lote.quantidade_reservada > 0 ? (
                        <Badge className="bg-blue-100 text-blue-700">
                          {lote.quantidade_reservada}
                        </Badge>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{lote.fornecedor || '-'}</TableCell>
                    <TableCell className="text-sm">{lote.localizacao || '-'}</TableCell>
                    <TableCell>
                      {lote.alerta === "vencido" && (
                        <Badge className="bg-red-600 text-white">Vencido</Badge>
                      )}
                      {lote.alerta === "7dias" && (
                        <Badge className="bg-orange-600 text-white">7 dias</Badge>
                      )}
                      {lote.alerta === "15dias" && (
                        <Badge className="bg-yellow-600 text-white">15 dias</Badge>
                      )}
                      {lote.alerta === "30dias" && (
                        <Badge className="bg-blue-600 text-white">30 dias</Badge>
                      )}
                      {lote.alerta === "ok" && (
                        <Badge className="bg-green-100 text-green-700">OK</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {lotesFiltrados.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>Nenhum lote encontrado</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
