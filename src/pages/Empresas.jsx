import React, { useState } from "react";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Plus,
  Search,
  Edit,
  MapPin,
  Phone,
  Mail,
  TrendingUp,
  Eye,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import EmpresaForm from "@/components/cadastros/EmpresaForm";

/**
 * Página Gestão de Empresas e Filiais.
 * Lista/KPIs/visão permanecem aqui; create/edit usam EmpresaForm canônico (Bloco5)
 * — sem formulário paralelo no dialog.
 */
export default function Empresas() {
  const { filterInContext, createInContext, updateInContext, deleteInContext, grupoAtual, empresaAtual } = useContextoVisual();
  const groupIdCadastro = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState(null);
  const [viewingEmpresa, setViewingEmpresa] = useState(null);

  const queryClient = useQueryClient();

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ["empresas-cadastro", groupIdCadastro],
    queryFn: () => filterInContext("Empresa", {}, "-created_date", undefined, "group_id"),
    enabled: Boolean(groupIdCadastro),
  });

  const invalidateEmpresasQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["empresas-cadastro"] });
    queryClient.invalidateQueries({ queryKey: ["empresas"] });
  };

  const closeFormDialog = () => {
    setIsDialogOpen(false);
    setEditingEmpresa(null);
  };

  const createMutation = useMutation({
    mutationFn: (data) => createInContext("Empresa", data, "group_id"),
    onSuccess: () => {
      invalidateEmpresasQueries();
      closeFormDialog();
      toast.success("Empresa cadastrada com sucesso!");
    },
    onError: (error) => {
      toast.error(error?.message || "Falha ao cadastrar empresa.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateInContext("Empresa", id, data, "group_id"),
    onSuccess: () => {
      invalidateEmpresasQueries();
      closeFormDialog();
      toast.success("Empresa atualizada com sucesso!");
    },
    onError: (error) => {
      toast.error(error?.message || "Falha ao atualizar empresa.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteInContext("Empresa", id),
    onSuccess: () => {
      invalidateEmpresasQueries();
      closeFormDialog();
      toast.success("Empresa excluída.");
    },
    onError: (error) => {
      toast.error(error?.message || "Falha ao excluir empresa.");
    },
  });

  const handleEmpresaSubmit = (payload) => {
    if (!payload || typeof payload !== "object") return;
    if (payload._action === "delete") {
      const id = payload.id || editingEmpresa?.id;
      if (!id) {
        toast.error("Empresa sem ID para exclusão.");
        return;
      }
      deleteMutation.mutate(id);
      return;
    }
    const groupId = payload.group_id
      || payload.grupo_id
      || editingEmpresa?.group_id
      || editingEmpresa?.grupo_id
      || groupIdCadastro;
    const data = {
      ...payload,
      ...(groupId ? { group_id: groupId, grupo_id: groupId } : {}),
    };
    delete data._action;
    if (editingEmpresa?.id || data.id) {
      updateMutation.mutate({ id: editingEmpresa?.id || data.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (empresa) => {
    setEditingEmpresa(empresa);
    setIsDialogOpen(true);
  };

  const filteredEmpresas = empresas.filter((e) =>
    e.razao_social?.toLowerCase().includes(searchTerm.toLowerCase())
    || e.nome_fantasia?.toLowerCase().includes(searchTerm.toLowerCase())
    || e.cnpj?.includes(searchTerm)
  );

  const statusColors = {
    Ativa: "bg-green-100 text-green-700 border-green-200",
    Inativa: "bg-gray-100 text-gray-700 border-gray-200",
    Suspensa: "bg-red-100 text-red-700 border-red-200",
  };

  const tipoColors = {
    Matriz: "bg-blue-500 text-white",
    Filial: "bg-sky-600 text-white",
  };

  const totalEmpresas = empresas.length;
  const empresasAtivas = empresas.filter((e) => e.status === "Ativa").length;
  const matrizes = empresas.filter((e) => e.tipo === "Matriz").length;
  const filiais = empresas.filter((e) => e.tipo === "Filial").length;
  const formBusy = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <div className="w-full h-full overflow-auto p-6 lg:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
            <Building2 className="w-8 h-8 text-blue-600" />
            Gestão de Empresas e Filiais
          </h1>
          <p className="text-slate-600">Controle multi-empresa e consolidação corporativa</p>
        </div>
      </div>

      {!groupIdCadastro && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" data-action="empresas-sem-contexto">
          Selecione um grupo ou empresa no contexto para listar e editar cadastros.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-600">Total de Empresas</p>
                <p className="text-2xl font-bold text-blue-600">{totalEmpresas}</p>
              </div>
              <Building2 className="w-8 h-8 text-blue-400 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-600">Empresas Ativas</p>
                <p className="text-2xl font-bold text-green-600">{empresasAtivas}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-400 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-600">Matrizes</p>
                <p className="text-2xl font-bold text-indigo-600">{matrizes}</p>
              </div>
              <Building2 className="w-8 h-8 text-indigo-400 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-600">Filiais</p>
                <p className="text-2xl font-bold text-blue-600">{filiais}</p>
              </div>
              <Building2 className="w-8 h-8 text-blue-400 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <Input
            placeholder="Buscar empresa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-action="empresa-buscar"
          />
        </div>

        <Button
          type="button"
          className="bg-blue-600 hover:bg-blue-700"
          data-action="empresa-nova"
          disabled={!groupIdCadastro}
          onClick={() => {
            setEditingEmpresa(null);
            setIsDialogOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Empresa
        </Button>

        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) setEditingEmpresa(null);
          }}
        >
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-action="empresa-form-dialog">
            <DialogHeader>
              <DialogTitle>{editingEmpresa ? "Editar Empresa" : "Nova Empresa"}</DialogTitle>
            </DialogHeader>
            <div key={editingEmpresa?.id || "nova-empresa"} className="w-full">
              <EmpresaForm
                empresa={editingEmpresa}
                item={editingEmpresa}
                onSubmit={handleEmpresaSubmit}
                isSubmitting={formBusy}
                windowMode={false}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-0 shadow-md">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Empresa</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Regime</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                    Carregando empresas...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filteredEmpresas.map((empresa) => (
                <TableRow key={empresa.id} className="hover:bg-slate-50">
                  <TableCell>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{empresa.nome_fantasia || empresa.razao_social}</p>
                        <p className="text-xs text-slate-500">{empresa.razao_social}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm">{empresa.cnpj}</span>
                  </TableCell>
                  <TableCell>
                    <Badge className={tipoColors[empresa.tipo] || tipoColors.Matriz}>
                      {empresa.tipo || "Matriz"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{empresa.regime_tributario}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span>{empresa.endereco?.cidade || "-"}/{empresa.endereco?.estado || "-"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[empresa.status] || statusColors.Inativa}>
                      {empresa.status || "-"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 px-2"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setViewingEmpresa(empresa);
                        }}
                        title="Ver detalhes"
                        data-action="empresa-view"
                        aria-label={`Ver detalhes ${empresa.nome_fantasia || empresa.razao_social || ""}`}
                      >
                        <Eye className="w-4 h-4 text-blue-600" />
                        <span className="text-xs hidden sm:inline">Ver</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 px-2"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleEdit(empresa);
                        }}
                        title="Editar"
                        data-action="empresa-edit"
                        aria-label={`Editar ${empresa.nome_fantasia || empresa.razao_social || ""}`}
                      >
                        <Edit className="w-4 h-4 text-slate-600" />
                        <span className="text-xs hidden sm:inline">Editar</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {!isLoading && filteredEmpresas.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Building2 className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>Nenhuma empresa encontrada</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewingEmpresa} onOpenChange={() => setViewingEmpresa(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              {viewingEmpresa?.nome_fantasia || viewingEmpresa?.razao_social}
            </DialogTitle>
          </DialogHeader>
          {viewingEmpresa && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Informações Cadastrais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-600">Razão Social</p>
                      <p className="font-medium">{viewingEmpresa.razao_social}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">Nome Fantasia</p>
                      <p className="font-medium">{viewingEmpresa.nome_fantasia || "-"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-600">CNPJ</p>
                      <p className="font-medium font-mono" data-field="empresa-cnpj">{viewingEmpresa.cnpj || "-"}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5" data-field="empresa-cnpj-origem">
                        Origem: {
                          viewingEmpresa._cnpj_origem === "sessao_http"
                            ? "sessão HTTP (API/perfil)"
                            : viewingEmpresa.cnpj
                              ? "cadastro local / banco espelhado"
                              : "ausente (sem cache de perfil)"
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">Inscrição Estadual</p>
                      <p className="font-medium">{viewingEmpresa.inscricao_estadual || "-"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-600">Regime Tributário</p>
                      <p className="font-medium">{viewingEmpresa.regime_tributario}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">Tipo</p>
                      <Badge className={tipoColors[viewingEmpresa.tipo] || tipoColors.Matriz}>
                        {viewingEmpresa.tipo || "Matriz"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-blue-600" />
                    Endereço
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">
                    {viewingEmpresa.endereco?.logradouro}, {viewingEmpresa.endereco?.numero}<br />
                    {viewingEmpresa.endereco?.bairro} - {viewingEmpresa.endereco?.cidade}/{viewingEmpresa.endereco?.estado}<br />
                    CEP: {viewingEmpresa.endereco?.cep}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Phone className="w-5 h-5 text-green-600" />
                    Contato
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span className="text-sm">{viewingEmpresa.contato?.telefone || "-"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span className="text-sm">{viewingEmpresa.contato?.email || "-"}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
