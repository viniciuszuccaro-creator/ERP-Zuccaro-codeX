import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Package, ShieldAlert } from "lucide-react";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

export default function HistoricoProdutosCliente({ clienteId }) {
  const { filterInContext, empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const { hasPermission } = usePermissions();

  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = contexto === "empresa" ? empresaAtual?.id : null;
  const contextoValido = Boolean(groupId || empresaId);
  const podeVisualizarHistorico =
    hasPermission("Comercial.Pedido.visualizar") ||
    hasPermission("CRM.Cliente.visualizar") ||
    hasPermission("comercial", "visualizar_pedido");
  const consultaHabilitada = Boolean(clienteId && contextoValido && podeVisualizarHistorico);

  const { data: pedidos = [] } = useQuery({
    queryKey: ["historico-produtos-cliente-contexto", clienteId, groupId, empresaId, contexto],
    queryFn: () => filterInContext("Pedido", { cliente_id: clienteId }, "-data_pedido", 200),
    enabled: consultaHabilitada,
    staleTime: 60_000,
  });

  const linhas = useMemo(() => {
    const rows = [];
    pedidos.forEach((p) => {
      const data = p.data_pedido ? new Date(p.data_pedido) : null;
      (p.itens_revenda || []).forEach((it) => {
        rows.push({
          tipo: "Revenda",
          descricao: it.descricao || it.produto_descricao || "-",
          quantidade: it.quantidade,
          unidade: it.unidade,
          valor: it.valor_total,
          data,
          numero_pedido: p.numero_pedido,
        });
      });
      (p.itens_armado_padrao || []).forEach((it) => {
        rows.push({
          tipo: "Armado",
          descricao: it.descricao || it.produto_descricao || `${it.elemento || ""}`,
          quantidade: it.quantidade || it.quantidade_barras_principais || 0,
          unidade: "PC",
          valor: it.valor_total,
          data,
          numero_pedido: p.numero_pedido,
        });
      });
      (p.itens_corte_dobra || []).forEach((it) => {
        rows.push({
          tipo: "Corte/Dobra",
          descricao: it.descricao || it.descricao_automatica || "-",
          quantidade: it.quantidade || it.quantidade_pecas || 0,
          unidade: "PC",
          valor: it.valor_total,
          data,
          numero_pedido: p.numero_pedido,
        });
      });
    });
    return rows.sort((a, b) => (b.data?.getTime() || 0) - (a.data?.getTime() || 0));
  }, [pedidos]);

  if (clienteId && (!contextoValido || !podeVisualizarHistorico)) {
    return (
      <Alert className="w-full h-full border-amber-200 bg-amber-50" data-context-required="true" data-permission="Comercial.Pedido.visualizar">
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          Histórico de produtos exige contexto de grupo/empresa e permissão para visualizar pedidos.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="w-full h-full border-0 shadow-sm" data-context-required="true" data-permission="Comercial.Pedido.visualizar">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Package className="w-4 h-4 text-blue-600" />
          Histórico de Produtos ({linhas.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Data</TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-center">Qtd</TableHead>
                <TableHead>Unid</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.slice(0, 100).map((l, idx) => (
                <TableRow key={idx}>
                  <TableCell className="text-sm">
                    {l.data ? l.data.toLocaleDateString("pt-BR") : "-"}
                  </TableCell>
                  <TableCell className="text-sm">{l.numero_pedido || "-"}</TableCell>
                  <TableCell>
                    <Badge className={
                      l.tipo === "Revenda" ? "bg-purple-100 text-purple-700" :
                      l.tipo === "Armado" ? "bg-amber-100 text-amber-700" :
                      "bg-blue-100 text-blue-700"
                    }>
                      {l.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{l.descricao}</TableCell>
                  <TableCell className="text-center text-sm">{l.quantidade}</TableCell>
                  <TableCell className="text-sm">{l.unidade || "-"}</TableCell>
                  <TableCell className="text-right text-sm">
                    {typeof l.valor === "number" ? `R$ ${l.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "-"}
                  </TableCell>
                </TableRow>
              ))}
              {linhas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                    Nenhum histórico de produtos encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}