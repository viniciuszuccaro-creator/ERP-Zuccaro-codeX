/**
 * CadastrosTableUniversal — tabela super otimizada para cadastros
 * Paginação server-side, ordenação rápida, busca debounced, real-time updates
 * Sem travamento, sem pulos, UI moderna com status colors
 */
import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronUp, ChevronDown, Search, Edit, Trash2, Eye } from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";

const STATUS_COLORS = {
  Ativo: "bg-green-100 text-green-700 border-green-300",
  "Em Análise": "bg-blue-100 text-blue-700 border-blue-300",
  Inativo: "bg-slate-100 text-slate-700 border-slate-300",
  Prospect: "bg-yellow-100 text-yellow-700 border-yellow-300",
  Bloqueado: "bg-red-100 text-red-700 border-red-300",
};

export default function CadastrosTableUniversal({
  entityName,
  columns = [],
  pageSize = 20,
  onEdit = null,
  onDelete = null,
  onView = null,
}) {
  const queryClient = useQueryClient();
  const { filterInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const { canEdit, canDelete, hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId);
  const podeVisualizar = hasPermission("Cadastros", entityName, "visualizar") || hasPermission("Cadastros", null, "visualizar");
  const podeEditar = canEdit("Cadastros", entityName) || canEdit("Cadastros", null);
  const podeExcluir = canDelete("Cadastros", entityName) || canDelete("Cadastros", null);
  const { confirm, ConfirmDialog: ConfirmExcluirDialog } = useConfirm();

  const handleExcluir = async (item) => {
    if (!podeExcluir || !contextoValido || !onDelete) return;
    const ok = await confirm({
      title: 'Confirmar Exclusão',
      description: `Regra-Mae: confirma excluir este registro de ${entityName}? Esta acao sera auditada.`,
      confirmText: 'Excluir',
    });
    if (!ok) return;
    onDelete(item);
  };
  const permissaoVisualizar = `Cadastros.${entityName}.visualizar`;
  const permissaoEditar = `Cadastros.${entityName}.editar`;
  const permissaoExcluir = `Cadastros.${entityName}.excluir`;
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortField, setSortField] = useState("-updated_date");
  const [currentPage, setCurrentPage] = useState(1);

  // Debounce search 350ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Build search filter
  const searchFilter = useMemo(() => {
    if (!debouncedSearch) return {};
    const term = debouncedSearch.toLowerCase();
    const searchableColumns = columns.filter(c => c.searchable !== false).map(c => c.field);
    if (searchableColumns.length === 0) return {};
    return { $or: searchableColumns.map(f => ({ [f]: { $regex: term, $options: "i" } })) };
  }, [debouncedSearch, columns]);

  // Fetch data server-side
  const { data: items = [], isLoading } = useQuery({
    queryKey: [entityName, sortField, currentPage, debouncedSearch, empresaAtual?.id, grupoAtual?.id],
    queryFn: async () => {
      const skip = (currentPage - 1) * pageSize;
      return await filterInContext(entityName, searchFilter, sortField, pageSize);
    },
    enabled: podeVisualizar,
    staleTime: 45_000,
    gcTime: 120_000,
    refetchOnWindowFocus: false,
  });

  // Real-time updates
  useEffect(() => {
    const api = base44.entities?.[entityName];
    if (!api?.subscribe) return;
    const unsub = api.subscribe((evt) => {
      queryClient.invalidateQueries({ queryKey: [entityName] });
    });
    return unsub;
  }, [entityName, queryClient]);

  const handleSort = (field) => {
    const isCurrentSort = sortField.replace(/^-/, "") === field;
    setSortField(isCurrentSort && sortField.startsWith("-") ? field : `-${field}`);
    setCurrentPage(1);
  };

  const formatValue = (value, column) => {
    if (value === null || value === undefined) return "—";
    if (column.type === "date") return new Date(value).toLocaleDateString("pt-BR");
    if (column.type === "boolean") return value ? "✓" : "—";
    if (column.type === "number") return Number(value).toLocaleString("pt-BR");
    return String(value).substring(0, 60);
  };

  const getStatusColor = (value) => {
    return STATUS_COLORS[value] || "bg-slate-50 text-slate-600 border-slate-200";
  };

  const renderLoading = () => (
    <div className="space-y-3 p-6">
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} className="h-10" />
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Buscar..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCurrentPage(1);
          }}
          className="pl-10 bg-white border-slate-200"
          data-permission={permissaoVisualizar}
          data-action={`Cadastros.${entityName}.buscar`}
        />
      </div>

      {/* Table */}
      <Card className="rounded-sm border-slate-200 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            renderLoading()
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Nenhum registro encontrado</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col.field}
                        className="px-4 py-3 text-left font-medium text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => col.sortable !== false && handleSort(col.field)}
                      >
                        <div className="flex items-center gap-2 w-full justify-between">
                          <span>{col.label}</span>
                          {col.sortable !== false && (
                            <span className="text-xs">
                              {sortField.replace(/^-/, "") === col.field ? (
                                sortField.startsWith("-") ? (
                                  <ChevronDown className="w-4 h-4 inline" />
                                ) : (
                                  <ChevronUp className="w-4 h-4 inline" />
                                )
                              ) : (
                                <span className="w-4 h-4 inline opacity-20">⟨⟩</span>
                              )}
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center font-medium text-slate-700 w-24">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      {columns.map((col) => (
                        <td key={col.field} className="px-4 py-3 text-slate-600">
                          {col.field === "status" ? (
                            <Badge
                              variant="outline"
                              className={`text-xs rounded-sm ${getStatusColor(item[col.field])}`}
                            >
                              {formatValue(item[col.field], col)}
                            </Badge>
                          ) : (
                            formatValue(item[col.field], col)
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {onView && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onView(item)}
                              className="h-8 w-8 p-0 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-sm"
                              title="Visualizar"
                              data-permission={permissaoVisualizar}
                              data-action={`Cadastros.${entityName}.visualizar`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                          {onEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onEdit(item)}
                              disabled={!podeEditar}
                              className="h-8 w-8 p-0 text-slate-600 hover:text-green-600 hover:bg-green-50 rounded-sm"
                              title="Editar"
                              data-permission={permissaoEditar}
                              data-action={`Cadastros.${entityName}.editar`}
                              data-sensitive="true"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          )}
                          {onDelete && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleExcluir(item)}
                              disabled={!podeExcluir || !contextoValido}
                              className="h-8 w-8 p-0 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-sm"
                              title="Deletar"
                              data-permission={permissaoExcluir}
                              data-action={`Cadastros.${entityName}.excluir`}
                              data-sensitive="true"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {items.length > 0 && (
        <div className="flex items-center justify-between px-2">
          <span className="text-xs text-slate-500">
            Página {currentPage} • {items.length} registro(s)
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-8 text-xs rounded-sm"
            >
              ← Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={items.length < pageSize}
              className="h-8 text-xs rounded-sm"
            >
              Próxima →
            </Button>
          </div>
        </div>
      )}
      <ConfirmExcluirDialog />
    </div>
  );
}
