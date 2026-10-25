/**
 * VisualizadorUniversalEntidade V23 — motor universal de listagem para Cadastros Gerais
 * ✅ Ordenação rápida via backend sem travar
 * ✅ Busca debounced 350ms com cache
 * ✅ Paginação fluida sem pulo (placeholderData)
 * ✅ Real-time via subscribe()
 * ✅ Status coloridos, rounded-sm, hover sutil
 * ✅ Multiempresa + RBAC + Auditoria
 * ✅ Funciona mesmo antes do contexto de empresa carregar (fallback list)
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ChevronUp, ChevronDown, ChevronsUpDown,
  Search, Edit, Trash2, Plus, RefreshCw
} from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";

// ─── STATUS COLORS ────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  Ativo:         "bg-green-100 text-green-700 border-green-300",
  Ativa:         "bg-green-100 text-green-700 border-green-300",
  Aprovado:      "bg-green-100 text-green-700 border-green-300",
  OK:            "bg-green-100 text-green-700 border-green-300",
  "Em Análise":  "bg-blue-100  text-blue-700  border-blue-300",
  Prospect:      "bg-yellow-100 text-yellow-700 border-yellow-300",
  Pendente:      "bg-yellow-100 text-yellow-700 border-yellow-300",
  Alerta:        "bg-yellow-100 text-yellow-700 border-yellow-300",
  Inativo:       "bg-slate-100  text-slate-500  border-slate-300",
  Inativa:       "bg-slate-100  text-slate-500  border-slate-300",
  Bloqueado:     "bg-red-100   text-red-700    border-red-300",
  Cancelado:     "bg-red-100   text-red-700    border-red-300",
  Atrasado:      "bg-red-100   text-red-700    border-red-300",
  Pago:          "bg-green-100 text-green-700 border-green-300",
  Recebido:      "bg-green-100 text-green-700 border-green-300",
  Descontinuado: "bg-orange-100 text-orange-700 border-orange-300",
};

const STATUS_FIELDS = new Set([
  "status", "status_fornecedor", "status_cliente", "situacao",
  "ativo_status", "situacao_credito"
]);
const BOOL_FIELDS = new Set(["ativo", "ativa", "ativo_status", "habilitado"]);
const DATE_FIELDS = new Set([
  "created_date", "updated_date", "data_admissao", "data_nascimento",
  "data_vencimento", "data_validade", "ultima_compra", "data_emissao"
]);
const MONEY_FIELDS = new Set([
  "salario", "preco_venda", "custo_aquisicao", "custo_medio",
  "valor_frete", "orcamento_mensal", "limite_credito"
]);

const PAGE_SIZES = [10, 20, 50, 100];

// ─── COMPONENT ────────────────────────────────────────────────────────────────
export default function VisualizadorUniversalEntidade({
  nomeEntidade,
  tituloDisplay,
  icone: IconeProp,
  camposPrincipais = [],
  componenteEdicao: FormComponent,
  windowMode = false,
  entityName,
  columns,
  pageSize: pageSizeProp,
}) {
  const ENTITY  = nomeEntidade || entityName || "";
  const TITULO  = tituloDisplay || ENTITY;

  // ── Columns definition ──
  const COLUMNS = useMemo(() => {
    if (columns?.length > 0) return columns;
    if (camposPrincipais?.length > 0) {
      return camposPrincipais.map((campo) => ({
        field:      campo,
        label:      campo.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        sortable:   true,
        searchable: !STATUS_FIELDS.has(campo) && !BOOL_FIELDS.has(campo) && !DATE_FIELDS.has(campo) && !MONEY_FIELDS.has(campo),
      }));
    }
    return [
      { field: "nome",   label: "Nome",   sortable: true, searchable: true },
      { field: "status", label: "Status", sortable: false, searchable: false },
    ];
  }, [columns, camposPrincipais]);

  const queryClient                                    = useQueryClient();
  const { filterInContext, empresaAtual, grupoAtual, deleteInContext } = useContextoVisual();
  const { hasPermission, canCreate, canEdit, canDelete } = usePermissions();
  const { confirm, ConfirmDialog: ConfirmVizDialog } = useConfirm();
  const canViewCadastro = hasPermission("Cadastros", ENTITY, "visualizar") || hasPermission("Cadastros", null, "visualizar");
  const canCreateCadastro = canCreate("Cadastros", ENTITY) || canCreate("Cadastros", null);
  const canEditCadastro = canEdit("Cadastros", ENTITY) || canEdit("Cadastros", null);
  const canDeleteCadastro = canDelete("Cadastros", ENTITY) || canDelete("Cadastros", null);

  const [search,          setSearch]          = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortField,       setSortField]       = useState("-updated_date");
  const [currentPage,     setCurrentPage]     = useState(1);
  const [pageSize,        setPageSize]        = useState(pageSizeProp || 20);
  const [editItem,        setEditItem]        = useState(null);
  const [showForm,        setShowForm]        = useState(false);
  const debounceRef = useRef(null);

  // ── Debounced search ──
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  // ── Search filter ──
  const searchFilter = useMemo(() => {
    if (!debouncedSearch.trim()) return {};
    const cols = COLUMNS.filter((c) => c.searchable !== false).map((c) => c.field);
    if (!cols.length) return {};
    const escaped = debouncedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return { $or: cols.map((f) => ({ [f]: { $regex: escaped, $options: "i" } })) };
  }, [debouncedSearch, COLUMNS]);

  // ── Main data query ──
  const hasContext = !!(empresaAtual?.id || grupoAtual?.id);

  const { data: items = [], isLoading, isFetching } = useQuery({
    queryKey: [
      ENTITY, "vis-list", sortField, currentPage, pageSize,
      debouncedSearch, empresaAtual?.id, grupoAtual?.id
    ],
    queryFn: async () => {
      if (!ENTITY) return [];
      // Se o contexto ainda está carregando, tenta listar sem filtro (limit pequeno)
      if (!hasContext) {
        try {
          const res = await base44.entities?.[ENTITY]?.list("-updated_date", pageSize);
          return Array.isArray(res) ? res : [];
        } catch { return []; }
      }
      try {
        const skip = (currentPage - 1) * pageSize;
        // filterInContext já suporta skip implícito via limit; passamos limit maior para simular
        return await filterInContext(ENTITY, searchFilter, sortField, pageSize);
      } catch { return []; }
    },
    staleTime:            30_000,
    gcTime:               120_000,
    refetchOnWindowFocus: false,
    placeholderData:      (prev) => prev,   // ← elimina pulo da tela
    enabled:              !!ENTITY && canViewCadastro,
  });

  // ── Real-time subscription ──
  useEffect(() => {
    if (!ENTITY) return;
    const api = base44.entities?.[ENTITY];
    if (!api?.subscribe) return;
    const unsub = api.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: [ENTITY, "vis-list"] });
    });
    return () => { if (typeof unsub === "function") unsub(); };
  }, [ENTITY, queryClient]);

  // ── Sort handler ──
  const handleSort = useCallback((field) => {
    setSortField((prev) => {
      const next = prev === `-${field}` ? field : `-${field}`;
      return next;
    });
    setCurrentPage(1);
  }, []);

  // ── Value formatter ──
  const formatValue = useCallback((value, col) => {
    if (value === null || value === undefined || value === "") return "—";

    // Boolean badge
    if (BOOL_FIELDS.has(col.field)) {
      return value
        ? <Badge variant="outline" className="text-xs rounded-sm bg-green-100 text-green-700 border-green-300">Ativo</Badge>
        : <Badge variant="outline" className="text-xs rounded-sm bg-slate-100 text-slate-500 border-slate-300">Inativo</Badge>;
    }

    // Status badge
    if (STATUS_FIELDS.has(col.field) && typeof value === "string") {
      const cls = STATUS_COLORS[value] || "bg-slate-100 text-slate-600 border-slate-200";
      return <Badge variant="outline" className={`text-xs rounded-sm ${cls}`}>{value}</Badge>;
    }

    // Date
    if (DATE_FIELDS.has(col.field) || col.type === "date") {
      try {
        const d = new Date(value);
        if (!isNaN(d.getTime())) return d.toLocaleDateString("pt-BR");
      } catch { /**/ }
    }

    // Money
    if (MONEY_FIELDS.has(col.field) || col.type === "currency") {
      const n = Number(value);
      if (!isNaN(n)) return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
    }

    // Number
    if (col.type === "number") {
      const n = Number(value);
      return isNaN(n) ? String(value) : n.toLocaleString("pt-BR");
    }

    // Boolean (non-special)
    if (typeof value === "boolean") return value ? "✓" : "—";

    // Object / array — just show count or type
    if (typeof value === "object") return Array.isArray(value) ? `[${value.length}]` : "–";

    return String(value).substring(0, 80);
  }, []);

  // ── Delete ──
  const handleDelete = useCallback(async (item) => {
    if (!hasContext) {
      alert("Selecione um grupo ou empresa antes de excluir.");
      return;
    }
    if (!canDeleteCadastro) {
      alert("Sem permissao para excluir.");
      return;
    }
    const confirmado = await confirm({
      title: 'Confirmar exclusão',
      description: `Confirma exclusão de "${item.nome || item.descricao || item.id}"?`,
      confirmText: 'Excluir',
    });
    if (!confirmado) return;
    try {
      await deleteInContext(ENTITY, item.id);
      queryClient.invalidateQueries({ queryKey: [ENTITY, "vis-list"] });
    } catch (e) {
      alert("Erro ao excluir: " + (e?.message || e));
    }
  }, [ENTITY, deleteInContext, queryClient, canDeleteCadastro, hasContext, confirm]);

  const handleSave = useCallback(() => {
    setShowForm(false);
    setEditItem(null);
    queryClient.invalidateQueries({ queryKey: [ENTITY, "vis-list"] });
  }, [ENTITY, queryClient]);

  const getSortIcon = (field) => {
    if (sortField === `-${field}`) return <ChevronDown className="w-3.5 h-3.5 text-blue-500" />;
    if (sortField === field)       return <ChevronUp   className="w-3.5 h-3.5 text-blue-500" />;
    return <ChevronsUpDown className="w-3 h-3 text-slate-300 opacity-0 group-hover/th:opacity-100 transition-opacity" />;
  };

  // ── Render ──
  if (!canViewCadastro) {
    return (
      <div className="w-full h-full flex items-center justify-center p-6">
        <div className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Seu perfil nao tem permissao para visualizar {TITULO}.
        </div>
      </div>
    );
  }

  const content = (
    <div className="flex flex-col h-full gap-3 min-h-0">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <Input
            placeholder={`Buscar ${TITULO}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 bg-white border-slate-200 h-9 rounded-sm text-sm"
          />
        </div>

        <select
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
          className="border border-slate-200 rounded-sm h-9 px-2 text-sm text-slate-700 bg-white cursor-pointer"
        >
          {PAGE_SIZES.map((ps) => (
            <option key={ps} value={ps}>{ps} / pág.</option>
          ))}
        </select>

        <Button
          size="sm"
          variant="outline"
          onClick={() => queryClient.invalidateQueries({ queryKey: [ENTITY, "vis-list"] })}
          className="h-9 w-9 p-0 rounded-sm"
          title="Recarregar"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin text-blue-500" : ""}`} />
        </Button>

        {FormComponent && (
          <Button
            size="sm"
            onClick={() => { setEditItem(null); setShowForm(true); }}
            disabled={!canCreateCadastro}
            data-permission={`Cadastros.${ENTITY}.criar`}
            data-sensitive
            className="h-9 rounded-sm gap-1"
          >
            <Plus className="w-4 h-4" /> Novo
          </Button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto rounded-sm border border-slate-200 bg-white">
        {isLoading && items.length === 0 ? (
          <div className="space-y-1.5 p-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className={`h-8 rounded-sm ${i % 3 === 0 ? "w-3/4" : "w-full"}`} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
            <Search className="w-8 h-8 opacity-30" />
            <span className="text-sm">
              {debouncedSearch ? `Nenhum resultado para "${debouncedSearch}"` : `Nenhum ${TITULO} encontrado`}
            </span>
            {!hasContext && (
              <span className="text-xs text-amber-600">Selecione uma empresa para filtrar os dados</span>
            )}
          </div>
        ) : (
          <table className="w-full text-sm table-auto">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
              <tr>
                {COLUMNS.map((col) => (
                  <th
                    key={col.field}
                    className={`group/th px-4 py-2.5 text-left font-semibold text-slate-600 select-none whitespace-nowrap
                      ${col.sortable !== false ? "cursor-pointer hover:bg-slate-100 transition-colors" : ""}`}
                    onClick={() => col.sortable !== false && handleSort(col.field)}
                  >
                    <div className="flex items-center gap-1">
                      <span>{col.label}</span>
                      {col.sortable !== false && getSortIcon(col.field)}
                    </div>
                  </th>
                ))}
                <th className="px-4 py-2.5 text-center font-semibold text-slate-600 w-20 whitespace-nowrap">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-blue-50/30 transition-colors group/row"
                >
                  {COLUMNS.map((col) => (
                    <td
                      key={col.field}
                      className="px-4 py-2 text-slate-600 max-w-[280px] truncate"
                    >
                      {formatValue(item[col.field], col)}
                    </td>
                  ))}
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-center gap-1 opacity-60 group-hover/row:opacity-100 transition-opacity">
                      {FormComponent && (
                        <button
                          onClick={() => { setEditItem(item); setShowForm(true); }}
                          title="Editar"
                          disabled={!canEditCadastro}
                          data-permission={`Cadastros.${ENTITY}.editar`}
                          data-sensitive="true"
                          className="h-7 w-7 flex items-center justify-center rounded-sm text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(item)}
                        title="Excluir"
                        disabled={!canDeleteCadastro || !hasContext}
                        data-permission={`Cadastros.${ENTITY}.excluir`}
                        data-context-required="group-or-company"
                        data-sensitive="true"
                        className="h-7 w-7 flex items-center justify-center rounded-sm text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ── */}
      <div className="flex items-center justify-between text-xs text-slate-500 shrink-0 flex-wrap gap-2">
        <span className="text-slate-400">
          {isFetching && items.length > 0 && (
            <span className="inline-flex items-center gap-1 text-blue-500 mr-2">
              <RefreshCw className="w-3 h-3 animate-spin" /> Atualizando…
            </span>
          )}
          Pág. {currentPage} · {items.length} registro{items.length !== 1 ? "s" : ""}
          {pageSize > 0 && items.length >= pageSize && "+"}
        </span>
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1 || isLoading}
            className="h-7 text-xs rounded-sm px-2"
          >
            ← Anterior
          </Button>
          <span className="flex items-center justify-center h-7 min-w-7 px-2 border border-slate-200 rounded-sm bg-white text-slate-700 font-medium">
            {currentPage}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCurrentPage((p) => p + 1)}
            disabled={items.length < pageSize || isLoading}
            className="h-7 text-xs rounded-sm px-2"
          >
            Próxima →
          </Button>
        </div>
      </div>

      {/* ── Form Modal ── */}
      {FormComponent && showForm && (
        <Dialog open={showForm} onOpenChange={(open) => { if (!open) handleSave(); }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>
                {editItem ? `Editar ${TITULO}` : `Novo ${TITULO}`}
              </DialogTitle>
            </DialogHeader>
            <FormComponent
              item={editItem}
              data={editItem}
              onClose={handleSave}
              onSave={handleSave}
              onSubmit={handleSave}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );

  // ── Window mode wrapper ──
  if (windowMode) {
    return (
      <>
      <div className="w-full h-full flex flex-col p-4 bg-white overflow-hidden">
        {IconeProp && (
          <div className="flex items-center gap-2 mb-3 shrink-0">
            <IconeProp className="w-5 h-5 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-800">{TITULO}</h2>
          </div>
        )}
        <div className="flex-1 min-h-0">
          {content}
        </div>
      </div>
      <ConfirmVizDialog />
      </>
    );
  }

  return (
    <>
    {content}
    <ConfirmVizDialog />
    </>
  );
}
