/**
 * Recuperação RH Férias — capacidade existia na referência (erp-integra-novo FeriasTab)
 * e no Form local; o card RH montava stub "em desenvolvimento".
 * Reutiliza FeriasForm + createInContext/updateInContext (carimbo + sanitização + auditoria).
 * Sem módulo paralelo; UX ≠ seed de registros.
 */
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, CheckCircle, XCircle, Clock, Plus, Search, Users } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";
import FeriasForm from "@/components/rh/FeriasForm";

const STATUS_COLORS = {
  Solicitada: "bg-yellow-100 text-yellow-700",
  Aprovada: "bg-green-100 text-green-700",
  Rejeitada: "bg-red-100 text-red-700",
  Cancelada: "bg-gray-100 text-gray-600",
};

export default function FeriasTab({ windowMode = false }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    filterInContext,
    createInContext,
    updateInContext,
    grupoAtual,
    empresaAtual,
    contextoValido,
  } = useContextoVisual();
  const { canCreate, canEdit, canApprove, isLoading: permissionsLoading } = usePermissions();
  const { user } = useUser();
  const canAprovar = !permissionsLoading && canApprove("RH", "Férias");
  const podeCriar = !permissionsLoading && canCreate("RH", "Férias");
  const podeEditar = !permissionsLoading && canEdit("RH", "Férias");
  const groupId = grupoAtual?.id || null;
  const empresaId = empresaAtual?.id || null;
  const scopeKey = `${groupId || ""}:${empresaId || ""}`;

  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [formOpen, setFormOpen] = useState(false);
  const [editingFerias, setEditingFerias] = useState(null);

  const { data: ferias = [], isLoading } = useQuery({
    queryKey: ["ferias-tab", scopeKey],
    queryFn: () => filterInContext("Ferias", {}, "-created_date", 200),
    staleTime: 30000,
    enabled: Boolean(contextoValido && groupId),
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ["colaboradores-ferias", scopeKey],
    queryFn: () => filterInContext("Colaborador", { status: "Ativo" }, "nome_completo", 500, "empresa_alocada_id"),
    staleTime: 60000,
    enabled: Boolean(contextoValido && groupId),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      if (!podeCriar) throw new Error("Sem permissão para solicitar férias.");
      if (!groupId) throw new Error("Sem contexto de grupo ativo — operação bloqueada.");
      return createInContext("Ferias", data, "empresa_id");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ferias-tab", scopeKey] });
      await queryClient.invalidateQueries({ queryKey: ["ferias"] });
      setFormOpen(false);
      setEditingFerias(null);
      toast({ title: "Férias solicitadas." });
    },
    onError: (error) => {
      toast({ title: "Erro ao salvar férias", description: error?.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, antes }) => {
      const mudancaStatus = data.status && antes?.status && data.status !== antes.status;
      if (mudancaStatus && !canAprovar) throw new Error("Sem permissão para aprovar/rejeitar férias.");
      if (!mudancaStatus && !podeEditar) throw new Error("Sem permissão para editar férias.");
      if (antes && !antes.group_id && !groupId) {
        throw new Error("Registro sem contexto de grupo — operação bloqueada.");
      }
      return updateInContext("Ferias", id, data, "empresa_id");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ferias-tab", scopeKey] });
      await queryClient.invalidateQueries({ queryKey: ["ferias"] });
      setFormOpen(false);
      setEditingFerias(null);
      toast({ title: "Férias atualizadas." });
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar férias", description: error?.message, variant: "destructive" });
    },
  });

  const handleSubmit = (data) => {
    if (editingFerias) {
      updateMutation.mutate({ id: editingFerias.id, data, antes: editingFerias });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleAprovar = (f) =>
    updateMutation.mutate({
      id: f.id,
      data: { ...f, status: "Aprovada", aprovado_por: user?.full_name || user?.email || "Usuário" },
      antes: f,
    });
  const handleRejeitar = (f) =>
    updateMutation.mutate({ id: f.id, data: { ...f, status: "Rejeitada" }, antes: f });

  const filtered = ferias.filter((f) => {
    const matchSearch = !search || (f.colaborador_nome || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = filtroStatus === "todos" || f.status === filtroStatus;
    return matchSearch && matchStatus;
  });

  const totais = {
    solicitadas: ferias.filter((f) => f.status === "Solicitada").length,
    aprovadas: ferias.filter((f) => f.status === "Aprovada").length,
    rejeitadas: ferias.filter((f) => f.status === "Rejeitada").length,
  };

  const body = (
    <div className="w-full h-full flex flex-col gap-4 p-4 overflow-auto" data-action="rh-ferias-tab">
      {!contextoValido || !groupId ? (
        <p className="text-sm text-amber-700" role="status">
          Contexto de grupo/empresa obrigatório para listar e gravar férias.
        </p>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" data-action="rh-ferias-kpis">
        {[
          { label: "Solicitadas", value: totais.solicitadas, icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50" },
          { label: "Aprovadas", value: totais.aprovadas, icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
          { label: "Rejeitadas", value: totais.rejeitadas, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="border border-sky-100 shadow-sm bg-white/90">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${bg}`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
                <div className="text-xs text-slate-500">{label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar colaborador..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
            data-action="rh-ferias-busca"
          />
        </div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-36 h-9" data-action="rh-ferias-filtro-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="Solicitada">Solicitadas</SelectItem>
            <SelectItem value="Aprovada">Aprovadas</SelectItem>
            <SelectItem value="Rejeitada">Rejeitadas</SelectItem>
            <SelectItem value="Cancelada">Canceladas</SelectItem>
          </SelectContent>
        </Select>
        {podeCriar && (
          <Button
            size="sm"
            className="bg-sky-600 hover:bg-sky-700 h-9"
            data-permission="RH.Férias.criar"
            data-action="rh-ferias-nova"
            disabled={!contextoValido || !groupId}
            onClick={() => {
              setEditingFerias(null);
              setFormOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1" /> Nova Solicitação
          </Button>
        )}
      </div>

      <Card className="border border-sky-100 shadow-sm flex-1 bg-white/90">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4 text-sky-600" />
            Solicitações de Férias ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Dias</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aprovado por</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      Nenhuma solicitação encontrada neste contexto
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((f) => (
                    <TableRow key={f.id} className="text-sm">
                      <TableCell className="font-medium">{f.colaborador_nome || "—"}</TableCell>
                      <TableCell>{f.tipo || "Férias"}</TableCell>
                      <TableCell className="text-xs">
                        {f.data_inicio && new Date(f.data_inicio).toLocaleDateString("pt-BR")} →{" "}
                        {f.data_fim && new Date(f.data_fim).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>{f.dias_solicitados || "—"}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[f.status] || "bg-gray-100 text-gray-700"}>{f.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">{f.aprovado_por || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {canAprovar && f.status === "Solicitada" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-green-600 hover:bg-green-50 text-xs"
                                data-permission="RH.Férias.aprovar"
                                data-action="rh-ferias-aprovar"
                                onClick={() => handleAprovar(f)}
                                disabled={updateMutation.isPending}
                              >
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Aprovar
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-red-600 hover:bg-red-50 text-xs"
                                data-permission="RH.Férias.aprovar"
                                data-action="rh-ferias-rejeitar"
                                onClick={() => handleRejeitar(f)}
                                disabled={updateMutation.isPending}
                              >
                                <XCircle className="w-3 h-3 mr-1" />
                                Rejeitar
                              </Button>
                            </>
                          )}
                          {podeEditar && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              data-permission="RH.Férias.editar"
                              data-action="rh-ferias-editar"
                              onClick={() => {
                                setEditingFerias(f);
                                setFormOpen(true);
                              }}
                            >
                              Editar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent
          style={windowMode ? { zIndex: 1000000000 } : undefined}
          overlayStyle={windowMode ? { zIndex: 999999999 } : undefined}
          className="max-w-xl border-sky-200 bg-sky-50/40"
        >
          <DialogHeader>
            <DialogTitle>{editingFerias ? "Editar Férias" : "Nova Solicitação de Férias"}</DialogTitle>
          </DialogHeader>
          <FeriasForm
            ferias={editingFerias}
            colaboradores={colaboradores}
            onSubmit={handleSubmit}
            windowMode={false}
          />
        </DialogContent>
      </Dialog>
    </div>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full flex flex-col bg-gradient-to-b from-sky-50 to-white">
        <div className="flex items-center gap-3 p-4 border-b bg-gradient-to-r from-sky-50 to-sky-100">
          <Calendar className="w-5 h-5 text-sky-700" />
          <div>
            <p className="font-semibold text-slate-900">Férias</p>
            <p className="text-xs text-slate-600">Solicitações, aprovações e reabertura no contexto atual</p>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-auto">{body}</div>
      </div>
    );
  }

  return body;
}
