import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw, CheckCircle2, XCircle, Upload } from "lucide-react";
import useContextoVisual from "@/components/lib/useContextoVisual";
import { useUser } from "@/components/lib/UserContext";
import usePermissions from "@/components/lib/usePermissions";
import { ProtectedAction } from "@/components/ProtectedAction";
import { toast } from "sonner";

export default function ValidarPedidosExternos({ windowMode = true }) {
  const queryClient = useQueryClient();
  const { createInContext, updateInContext, deleteInContext, filterInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { user } = useUser();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaContextoId = empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaContextoId);
  const canViewPedidosExternos = hasPermission("Comercial", "PedidoExterno", "visualizar") || hasPermission("Comercial", "Pedido", "visualizar") || hasPermission("Comercial", null, "visualizar");
  const canImportPedidoExterno = hasPermission("Comercial", "PedidoExterno", "importar") || hasPermission("Comercial", "Pedido", "criar") || hasPermission("Comercial", null, "criar");
  const canValidatePedidoExterno = hasPermission("Comercial", "PedidoExterno", "validar") || hasPermission("Comercial", "Pedido", "editar") || hasPermission("Comercial", null, "editar");
  const canDeletePedidoExterno = hasPermission("Comercial", "PedidoExterno", "excluir") || hasPermission("Comercial", "Pedido", "excluir") || hasPermission("Comercial", null, "excluir");

  const auditPedidoExterno = async ({ acao, ext = null, descricao, sucesso = true, detalhes = {} }) => {
    try {
      await createInContext("AuditLog", {
        usuario: user?.full_name || user?.email || "Sistema",
        usuario_id: user?.id || null,
        acao,
        modulo: "Comercial",
        entidade: "PedidoExterno",
        registro_id: ext?.id || detalhes?.pedido_externo_id || null,
        descricao,
        empresa_id: ext?.empresa_id || empresaContextoId,
        group_id: ext?.group_id || ext?.grupo_id || groupId,
        grupo_id: ext?.grupo_id || ext?.group_id || groupId,
        tipo_auditoria: sucesso ? "operacional" : "seguranca",
        sucesso,
        detalhes: {
          origem: "ValidarPedidosExternos",
          numero_pedido_externo: ext?.numero_pedido_externo,
          status_importacao_anterior: ext?.status_importacao,
          ...detalhes
        },
        data_hora: new Date().toISOString()
      });
    } catch (_) {}
  };

  const { data: externos = [], isFetching, refetch } = useQuery({
    queryKey: ["pedidos-externos", groupId, empresaContextoId, canViewPedidosExternos],
    queryFn: async () => {
      if (!contextoValido || !canViewPedidosExternos) return [];
      // Buscar pendentes primeiro; se não houver, traz os mais recentes
      const pendentes = await filterInContext("PedidoExterno", { status_importacao: "A Validar" }, "-created_date", 50);
      if (pendentes && pendentes.length > 0) return pendentes;
      return await filterInContext("PedidoExterno", {}, "-created_date", 50);
    },
    initialData: [],
    refetchOnWindowFocus: false,
  });

  const marcarValidado = useMutation({
    mutationFn: async (ext) => {
      if (!contextoValido || !canValidatePedidoExterno) {
        await auditPedidoExterno({ acao: "Validacao bloqueada", ext, descricao: "Bloqueio ao validar pedido externo", sucesso: false, detalhes: { motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada" } });
        throw new Error(!contextoValido ? "Selecione grupo ou empresa antes de validar." : "Sem permissao para validar pedido externo.");
      }
      const updated = await updateInContext("PedidoExterno", ext.id, { status_importacao: "Validado" });
      await auditPedidoExterno({ acao: "Validacao", ext: updated || ext, descricao: "Pedido externo marcado como validado", detalhes: { status_anterior: ext.status_importacao, status_novo: "Validado" } });
      return updated;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pedidos-externos"] }),
      ]);
      toast.success("Pedido externo validado.");
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao validar pedido externo.");
    },
  });

  const excluirExterno = useMutation({
    mutationFn: async (ext) => {
      if (!contextoValido || !canDeletePedidoExterno) {
        await auditPedidoExterno({ acao: "Exclusao bloqueada", ext, descricao: "Bloqueio ao excluir pedido externo", sucesso: false, detalhes: { motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada" } });
        throw new Error(!contextoValido ? "Selecione grupo ou empresa antes de excluir." : "Sem permissao para excluir pedido externo.");
      }
      const deleted = await deleteInContext("PedidoExterno", ext.id);
      await auditPedidoExterno({ acao: "Exclusao", ext, descricao: "Pedido externo excluido", detalhes: { status_anterior: ext.status_importacao } });
      return deleted;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pedidos-externos"] });
      toast.success("Pedido externo excluido.");
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao excluir pedido externo.");
    },
  });

  const importarComoPedido = useMutation({
    mutationFn: async (ext) => {
      if (!contextoValido || !canImportPedidoExterno) {
        await auditPedidoExterno({ acao: "Importacao bloqueada", ext, descricao: "Bloqueio ao importar pedido externo", sucesso: false, detalhes: { motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada" } });
        throw new Error(!contextoValido ? "Selecione grupo ou empresa antes de importar." : "Sem permissao para importar pedido externo.");
      }
      // Map mínimo para Pedido
      const numero = ext.numero_pedido_externo || `EXT-${(ext.id || "").toString().slice(-6) || Date.now()}`;
      const cliente_nome = ext.cliente_nome || "Cliente Externo";
      const data_pedido = (ext.data_pedido || new Date().toISOString()).split("T")[0];

      const valor_total = (() => {
        if (typeof ext.valor_total === "number") return ext.valor_total;
        if (Array.isArray(ext.itens)) {
          return ext.itens.reduce((s, i) => {
            const v = typeof i?.valor_total === "number"
              ? i.valor_total
              : (Number(i?.preco_unitario) || 0) * (Number(i?.quantidade) || 0);
            return s + v;
          }, 0);
        }
        return 0;
      })();

      const payload = {
        numero_pedido: numero,
        tipo: "Pedido",
        origem_pedido: ext.origem || ext.canal || "API",
        cliente_nome,
        cliente_id: ext.cliente_id || undefined,
        data_pedido,
        valor_total,
        status: "Rascunho",
      };

      const created = await createInContext("Pedido", payload, "empresa_id");
      await updateInContext("PedidoExterno", ext.id, { status_importacao: "Importado", pedido_id: created.id });
      await auditPedidoExterno({ acao: "Importacao", ext, descricao: "Pedido externo importado como pedido comercial", detalhes: { pedido_id: created.id, numero_pedido: numero } });
      return created;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pedidos-externos"] }),
        queryClient.invalidateQueries({ queryKey: ["pedidos"] }),
      ]);
      toast.success("Pedido externo importado.");
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao importar pedido externo.");
    },
  });

  const atualizarPedidosExternosSeguro = async () => {
    if (!contextoValido || !canViewPedidosExternos) {
      await auditPedidoExterno({ acao: "Consulta bloqueada", descricao: "Bloqueio ao atualizar pedidos externos", sucesso: false, detalhes: { motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada" } });
      toast.error(!contextoValido ? "Selecione grupo ou empresa antes de atualizar." : "Sem permissao para visualizar pedidos externos.");
      return;
    }
    await auditPedidoExterno({ acao: "Consulta", descricao: "Atualizacao manual de pedidos externos" });
    refetch();
  };

  return (
    <div className={windowMode ? "w-full h-full flex flex-col" : "w-full h-full space-y-4"} data-context-required="true" data-permission="Comercial.PedidoExterno.visualizar">
      <Card className="border-2 border-indigo-300 bg-indigo-50/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Validar Pedidos Externos</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-2">
          <div className="text-sm text-slate-600">
            {externos.filter(e => e.status_importacao === "A Validar").length} pendente(s) para validar
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={atualizarPedidosExternosSeguro} disabled={isFetching || !contextoValido || !canViewPedidosExternos} data-action="Comercial.PedidoExterno.visualizar" data-permission="Comercial.PedidoExterno.visualizar" data-context-required="true">
              <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} /> Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className={windowMode ? "flex-1 overflow-hidden" : ""}>
        <CardContent className={`p-0 ${windowMode ? 'h-full overflow-auto' : ''}`}>
          {!contextoValido || !canViewPedidosExternos ? (
            <div className="p-8">
              <Alert>
                <AlertDescription>{!contextoValido ? "Selecione grupo ou empresa para visualizar pedidos externos." : "Sem permissao para visualizar pedidos externos."}</AlertDescription>
              </Alert>
            </div>
          ) : externos.length === 0 ? (
            <div className="p-8">
              <Alert>
                <AlertDescription>Nenhum pedido externo encontrado.</AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table data-action="Comercial.PedidoExterno.visualizar" data-permission="Comercial.PedidoExterno.visualizar" data-context-required="true">
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Status</TableHead>
                    <TableHead>Nº Externo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead className="min-w-[320px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {externos.map((ext) => (
                    <TableRow key={ext.id} className="hover:bg-slate-50">
                      <TableCell>
                        <Badge className={
                          ext.status_importacao === 'A Validar' ? 'bg-orange-100 text-orange-700' :
                          ext.status_importacao === 'Importado' ? 'bg-green-100 text-green-700' :
                          'bg-slate-100 text-slate-700'
                        }>
                          {ext.status_importacao || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold">{ext.numero_pedido_externo || ext.id}</TableCell>
                      <TableCell>{ext.cliente_nome || '-'}</TableCell>
                      <TableCell>{ext.canal || ext.origem || '-'}</TableCell>
                      <TableCell>{ext.data_pedido ? new Date(ext.data_pedido).toLocaleDateString('pt-BR') : '-'}</TableCell>
                      <TableCell className="font-bold text-green-600">R$ {(ext.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <ProtectedAction module="Comercial" section="PedidoExterno" action="importar" mode="disable">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => importarComoPedido.mutate(ext)}
                              disabled={importarComoPedido.isPending || !contextoValido || !canImportPedidoExterno}
                              className="h-8 px-2 bg-green-50 text-green-700 border border-green-200"
                              title="Importar como Pedido"
                              data-action="Comercial.PedidoExterno.importar"
                              data-permission="Comercial.PedidoExterno.importar"
                              data-context-required="true"
                              data-sensitive="true"
                            >
                              <Upload className="w-4 h-4 mr-1" />
                              <span className="text-xs">Importar</span>
                            </Button>
                          </ProtectedAction>
                          <ProtectedAction module="Comercial" section="PedidoExterno" action="editar" mode="disable">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => marcarValidado.mutate(ext)}
                              disabled={marcarValidado.isPending || !contextoValido || !canValidatePedidoExterno}
                              className="h-8 px-2 text-blue-700"
                              title="Marcar como Validado"
                              data-action="Comercial.PedidoExterno.validar"
                              data-permission="Comercial.PedidoExterno.validar"
                              data-context-required="true"
                              data-sensitive="true"
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              <span className="text-xs">Validar</span>
                            </Button>
                          </ProtectedAction>
                          <ProtectedAction module="Comercial" section="PedidoExterno" action="excluir" mode="disable">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm('Excluir pedido externo?')) excluirExterno.mutate(ext);
                              }}
                              disabled={excluirExterno.isPending || !contextoValido || !canDeletePedidoExterno}
                              className="h-8 px-2 text-red-600"
                              title="Excluir Registro Externo"
                              data-action="Comercial.PedidoExterno.excluir"
                              data-permission="Comercial.PedidoExterno.excluir"
                              data-context-required="true"
                              data-sensitive="true"
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              <span className="text-xs">Excluir</span>
                            </Button>
                          </ProtectedAction>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
