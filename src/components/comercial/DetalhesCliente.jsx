import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { X, TrendingUp, Package, FileText, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";
import HistoricoOrigemCliente from "./HistoricoOrigemCliente";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

/**
 * V21.1.2 - WINDOW MODE READY
 */
export default function DetalhesCliente({ cliente, onClose, windowMode = false }) {
  const [activeTab, setActiveTab] = useState("historico");
  const { filterInContext, empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const { hasPermission } = usePermissions();

  const groupId = cliente.group_id || cliente.grupo_id || grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = cliente.empresa_id || cliente.empresa_dona_id || (contexto === "empresa" ? empresaAtual?.id : null);
  const contextoValido = Boolean(groupId || empresaId);
  const podeVisualizarDetalhes =
    hasPermission("Comercial.Pedido.visualizar") ||
    hasPermission("CRM.Cliente.visualizar") ||
    hasPermission("Cadastros.Cliente.visualizar") ||
    hasPermission("comercial", "visualizar_pedido");
  const consultaHabilitada = Boolean(cliente.id && contextoValido && podeVisualizarDetalhes);

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos-cliente-contexto", cliente.id, groupId, empresaId, contexto],
    queryFn: () => filterInContext("Pedido", { cliente_id: cliente.id }, "-data_pedido", 50),
    enabled: consultaHabilitada
  });

  const totalCompras = pedidos
    .filter(p => p.status !== "Cancelado")
    .reduce((sum, p) => sum + (p.valor_total || 0), 0);

  const ticketMedio = pedidos.length > 0 ? totalCompras / pedidos.length : 0;

  const statusColors = {
    Ativo: "bg-green-100 text-green-700",
    Inativo: "bg-red-100 text-red-700",
    Prospect: "bg-blue-100 text-blue-700",
    Bloqueado: "bg-orange-100 text-orange-700"
  };

  const content = (
    <div className={windowMode ? "w-full h-full overflow-auto bg-white p-4" : "w-full h-full"} data-context-required="true" data-permission="Comercial.Pedido.visualizar">
      {(!contextoValido || !podeVisualizarDetalhes) && (
        <Alert className="mb-4 border-amber-200 bg-amber-50" data-context-required="true" data-permission="Comercial.Pedido.visualizar">
          <ShieldAlert className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            Detalhes do cliente exigem contexto de grupo/empresa e permissão para visualizar pedidos ou clientes.
          </AlertDescription>
        </Alert>
      )}

      <Card className={windowMode ? "border shadow-sm" : "border-0 shadow-none m-4"}>
        <CardHeader className="border-b bg-white">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle className="text-xl">{cliente.nome || cliente.razao_social}</CardTitle>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-sm text-slate-600">{cliente.tipo}</p>
                <Badge className={statusColors[cliente.status]}>{cliente.status}</Badge>
              </div>
            </div>
            {!windowMode && (
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Package className="w-5 h-5 text-blue-600" />
                  </div>
                  <p className="text-xs text-slate-600">Total Compras</p>
                  <p className="text-2xl font-bold text-blue-600">
                    R$ {totalCompras.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <FileText className="w-5 h-5 text-green-600" />
                  </div>
                  <p className="text-xs text-slate-600">Pedidos</p>
                  <p className="text-2xl font-bold text-green-600">{pedidos.length}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <TrendingUp className="w-5 h-5 text-purple-600" />
                  </div>
                  <p className="text-xs text-slate-600">Ticket Médio</p>
                  <p className="text-2xl font-bold text-purple-600">
                    R$ {ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <HistoricoOrigemCliente clienteId={cliente.id} compact={false} />

              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Últimos Pedidos</h3>
                {pedidos.slice(0, 5).map(pedido => (
                  <div key={pedido.id} className="flex items-center justify-between py-2 border-b">
                    <div>
                      <p className="font-medium">{pedido.numero_pedido}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(pedido.data_pedido).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        R$ {(pedido.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                      <Badge variant="outline" className="text-xs">{pedido.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );

  if (windowMode) return content;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="border-t-2 border-blue-200 bg-gradient-to-r from-blue-50 to-slate-50"
    >
      {content}
    </motion.div>
  );
}
