import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, TrendingDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

/**
 * Controle de Refugo/Perdas
 */
export default function ControleRefugo({ ops }) {
  // Agregar refugos de todas as OPs
  const todosRefugos = ops.flatMap(op => 
    (op.refugos || []).map(r => ({
      ...r,
      op_numero: op.numero_op,
      cliente: op.cliente_nome
    }))
  );

  // Por motivo
  const porMotivo = {};
  todosRefugos.forEach(r => {
    const motivo = r.motivo || "Não informado";
    if (!porMotivo[motivo]) {
      porMotivo[motivo] = { quantidade: 0, peso: 0, custo: 0 };
    }
    porMotivo[motivo].quantidade += r.quantidade_refugada || 0;
    porMotivo[motivo].peso += r.peso_refugado_kg || 0;
    porMotivo[motivo].custo += r.custo_perdido || 0;
  });

  const dadosMotivos = Object.entries(porMotivo)
    .map(([motivo, dados]) => ({
      motivo,
      ...dados
    }))
    .sort((a, b) => b.peso - a.peso);

  const pesoTotalRefugo = todosRefugos.reduce((sum, r) => sum + (r.peso_refugado_kg || 0), 0);
  const custoTotalRefugo = todosRefugos.reduce((sum, r) => sum + (r.custo_perdido || 0), 0);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-md bg-red-50">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-red-700">Total Ocorrências</p>
                <p className="text-2xl font-bold text-red-900">{todosRefugos.length}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-orange-50">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-orange-700">Peso Refugado</p>
                <p className="text-2xl font-bold text-orange-900">{pesoTotalRefugo.toFixed(0)} kg</p>
              </div>
              <TrendingDown className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-purple-50">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-purple-700">Custo Perdido</p>
                <p className="text-2xl font-bold text-purple-900">
                  R$ {custoTotalRefugo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico por Motivo */}
      <Card className="border-0 shadow-md">
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle className="text-base">Refugo por Motivo</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dadosMotivos}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="motivo" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="peso" fill="#ef4444" name="Peso (kg)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabela Detalhada */}
      <Card className="border-0 shadow-md">
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle className="text-base">Detalhamento de Refugos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Data</TableHead>
                <TableHead>OP</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Peso (kg)</TableHead>
                <TableHead className="text-right">Custo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {todosRefugos
                .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
                .slice(0, 50)
                .map((r, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-sm">
                      {new Date(r.data).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="font-medium">{r.op_numero}</TableCell>
                    <TableCell>{r.cliente}</TableCell>
                    <TableCell>{r.item_elemento}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {r.motivo}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{r.quantidade_refugada}</TableCell>
                    <TableCell className="text-right font-semibold text-red-600">
                      {r.peso_refugado_kg?.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-red-600">
                      R$ {r.custo_perdido?.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>

          {todosRefugos.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <AlertTriangle className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>Nenhum refugo registrado</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
