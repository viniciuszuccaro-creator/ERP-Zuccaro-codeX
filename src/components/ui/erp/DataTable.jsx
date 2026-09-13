import React, { useMemo, useRef, useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { ChevronDown, ArrowUp, ArrowDown, ArrowUpDown, MoreVertical, SlidersHorizontal } from "lucide-react";
import usePermissions from "@/components/lib/usePermissions";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { uiAuditWrap } from "@/components/lib/uiAudit";
import { Skeleton } from "@/components/ui/skeleton";

export default function ERPDataTable({
  columns = [], // [{ key, label, isNumeric, render?: (row) => ReactNode }]
  data = [],
  sortField,
  sortDirection = "asc",
  onSortChange,
  onToggleSelectAll,
  onToggleItem,
  allSelected = false,
  selectedIds = new Set(),
  enableColumnFilters = true,
  columnFilters = {},
  onColumnFiltersChange,
  hiddenColumns = new Set(),
  onHiddenColumnsChange,
  footerTotals = true,
  enableGlobalSearch = false,
  globalSearchValue = "",
  onGlobalSearchChange,
  // Fase 2: padronização opcional por entidade
  entityName, // para persistência de sort por entidade
  autoPersistSort = true,
  page = 1,
  pageSize = 20,
  totalItems = 0,
  isLoading = false,
  onPageChange,
  onPageSizeChange,
  // RBAC: permissão global opcional para visualizar a tabela
  permission,
  // Seleção granular por linha
  isRowSelectable = () => true,
  // Ações inline e menu de contexto por linha
  rowActionsRender,
  rowContextMenuItems,
  // Barra superior para operações em massa
  showBulkBar = false,
  onBulkDeleteSelected,
  onBulkExportSelected,
  // Densidade visual
  density = "comfortable",
}) {
  const [colWidths, setColWidths] = useState({});
  const headerRefs = useRef({});
  const lastSortClickAt = useRef(0);

  useEffect(() => {
    // init widths on first render
    if (Object.keys(colWidths).length === 0 && columns.length) {
      const init = {};
      columns.forEach((c) => { init[c.key] = undefined; });
      setColWidths(init);
    }
  }, [columns]);

  const { hasPermissionKey } = usePermissions();
  const visibleColumns = useMemo(() =>
    columns.filter(c => {
      if (hiddenColumns.has(c.key)) return false;
      if (c.permission) {
        try {
          if (!hasPermissionKey(c.permission)) return false;
        } catch (error) {
          console.error('[DataTable] Falha ao validar permissao da coluna', error);
          return false;
        }
      }
      return true;
    })
  , [columns, hiddenColumns]);

  // Densidade: controla paddings e alturas (confortável por padrão)
  const padX = density === 'compact' ? 'px-2' : density === 'spacious' ? 'px-4' : 'px-3';
  const padYHead = density === 'compact' ? 'py-1' : density === 'spacious' ? 'py-2.5' : 'py-1.5';
  const padYCell = density === 'compact' ? 'py-1.5' : density === 'spacious' ? 'py-3' : 'py-2';

  const wrapAudit = (label, fn, meta = { kind: 'datatable' }) => (typeof fn === 'function' ? uiAuditWrap(label, fn, meta) : undefined);

  const audited = useMemo(() => ({
    onSortChange: wrapAudit('ERPDataTable.onSortChange', onSortChange),
    onPageChange: wrapAudit('ERPDataTable.onPageChange', onPageChange),
    onPageSizeChange: wrapAudit('ERPDataTable.onPageSizeChange', onPageSizeChange),
    onColumnFiltersChange: wrapAudit('ERPDataTable.onColumnFiltersChange', onColumnFiltersChange),
    onHiddenColumnsChange: wrapAudit('ERPDataTable.onHiddenColumnsChange', onHiddenColumnsChange),
    onGlobalSearchChange: wrapAudit('ERPDataTable.onGlobalSearchChange', onGlobalSearchChange),
    onToggleSelectAll: wrapAudit('ERPDataTable.onToggleSelectAll', onToggleSelectAll),
    onToggleItem: wrapAudit('ERPDataTable.onToggleItem', onToggleItem),
  }), [onSortChange, onPageChange, onPageSizeChange, onColumnFiltersChange, onHiddenColumnsChange, onGlobalSearchChange, onToggleSelectAll, onToggleItem]);

  // Aceita Set ou Array para seleção
  const selectedSet = useMemo(() => {
    if (selectedIds instanceof Set) return selectedIds;
    if (Array.isArray(selectedIds)) return new Set(selectedIds);
    return new Set();
  }, [selectedIds]);

  // Debounce interno para filtros de coluna (reduz chamadas ao backend)
  const [localFilters, setLocalFilters] = useState(columnFilters || {});
  useEffect(() => { setLocalFilters(columnFilters || {}); }, [columnFilters]);
  useEffect(() => {
    const h = setTimeout(() => {
      if (audited.onColumnFiltersChange) audited.onColumnFiltersChange(localFilters);
    }, 350);
    return () => clearTimeout(h);
  }, [localFilters]);

   const handleResize = (key, e) => {
    e.preventDefault();
    const startX = e.clientX;
    const th = headerRefs.current[key];
    const startWidth = th ? th.offsetWidth : 0;
    const onMove = (ev) => {
      const newW = Math.max(80, startWidth + (ev.clientX - startX));
      setColWidths((prev) => ({ ...prev, [key]: newW }));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const totals = useMemo(() => {
    if (!footerTotals) return {};
    const t = {};
    visibleColumns.forEach((c) => {
      if (c.isNumeric) t[c.key] = data.reduce((acc, row) => acc + (Number(row[c.key]) || 0), 0);
    });
    return t;
  }, [data, visibleColumns, footerTotals]);

  const renderSortIcon = (key) => {
    if (sortField !== key) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />;
    return sortDirection === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-blue-600" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-600" />;
  };

  // Persistência de sort por entidade (frontend) – delega para caller aplicar no backend
  useEffect(() => {
    if (!autoPersistSort || !entityName) return;
    try {
      if (sortField) {
        // Persistência alinhada ao padrão global: { field, direction }
        localStorage.setItem(`sort_${entityName}`, JSON.stringify({ field: sortField, direction: sortDirection }));
      } else {
        localStorage.removeItem(`sort_${entityName}`);
      }
    } catch (error) {
      console.warn('[DataTable] Falha ao persistir ordenacao', error);
    }
  }, [autoPersistSort, entityName, sortField, sortDirection]);

  // Restaura sort salvo quando não vier definido
  useEffect(() => {
    if (!autoPersistSort || !entityName || sortField) return;
    try {
      const raw = localStorage.getItem(`sort_${entityName}`);
      if (raw && onSortChange) {
        const parsed = JSON.parse(raw);
        // Aceita tanto o formato antigo ({ sortField, sortDirection }) quanto o novo ({ field, direction })
        const sf = parsed.field || parsed.sortField;
        const sd = parsed.direction || parsed.sortDirection;
        if (sf && sd) onSortChange(sf, sd);
      }
    } catch (error) {
      console.warn('[DataTable] Falha ao restaurar ordenacao', error);
    }
  }, [autoPersistSort, entityName, sortField]);

  const totalPages = Math.max(1, Math.ceil((totalItems || 0) / (pageSize || 20)));

  // RBAC Visual Automático por prop permission
  if (permission) {
    const allowed = hasPermissionKey(permission);
    if (!allowed) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center border border-dashed rounded-lg text-slate-400 p-8">
          <div className="text-sm">Acesso negado</div>
        </div>
      );
    }
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-white/50 backdrop-blur-md rounded-sm">
      <div className="flex items-center justify-between pb-2 gap-2 rounded-sm border bg-white/80 backdrop-blur-sm shadow-sm px-2 py-1 sticky top-0 z-10">
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-sm" aria-label="Configurar colunas">
                  <SlidersHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Configurar colunas</TooltipContent>
          </Tooltip>
          <DropdownMenuContent>
            {columns.map((c) => (
              <DropdownMenuCheckboxItem
                key={c.key}
                checked={!hiddenColumns.has(c.key)}
                onCheckedChange={(checked) => {
                  const next = new Set(hiddenColumns);
                  if (!checked) next.add(c.key); else next.delete(c.key);
                  audited.onHiddenColumnsChange && audited.onHiddenColumnsChange(next);
                }}
              >
                {c.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {enableGlobalSearch && (
          <input
            value={globalSearchValue}
            onChange={(e) => audited.onGlobalSearchChange && audited.onGlobalSearchChange(e.target.value)}
            className="h-8 w-full sm:w-64 border rounded-sm px-2 text-sm"
            placeholder="Busca global..."
          />
        )}
      </div>

      {showBulkBar && selectedSet.size > 0 && (
        <div className="sticky top-0 z-10 mb-2 rounded-lg border bg-yellow-50 text-yellow-900 px-3 py-2 flex items-center justify-between">
          <div className="text-sm font-medium">{selectedSet.size} selecionado(s)</div>
          <div className="flex items-center gap-2">
            {audited.onBulkExportSelected && (
              <Button variant="outline" size="sm" onClick={() => audited.onBulkExportSelected && audited.onBulkExportSelected(Array.from(selectedSet))}>
                Exportar selecionados
              </Button>
            )}
            {audited.onBulkDeleteSelected && (
              <Button variant="destructive" size="sm" onClick={() => audited.onBulkDeleteSelected && audited.onBulkDeleteSelected(Array.from(selectedSet))}>
                Excluir selecionados
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto border rounded-sm w-full h-full bg-white/80 backdrop-blur-sm shadow-sm" style={{scrollBehavior:'smooth'}}>
        <div className="min-w-[900px]">{/* Evita quebra e corte em telas pequenas; rolagem horizontal controlada */}
        <Table className="w-full">
          <TableHeader className="sticky top-0 bg-white/70 backdrop-blur z-10 text-sm">
            <TableRow>
              <TableHead className={`w-10 ${padX} ${padYHead}`}>
                <Checkbox checked={allSelected} onCheckedChange={audited.onToggleSelectAll} />
              </TableHead>
              {visibleColumns.map((col) => (
                <TableHead
                  key={col.key}
                  ref={(el) => (headerRefs.current[col.key] = el)}
                  style={{ width: colWidths[col.key] ? `${colWidths[col.key]}px` : undefined }}
                  className={`${padX} ${padYHead} select-none`}
                  aria-sort={sortField === col.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isLoading}
                      className="flex items-center gap-1 hover:underline cursor-pointer disabled:opacity-50 select-none"
                      onClick={() => {
                        const now = Date.now();
                        if (now - (lastSortClickAt.current || 0) < 300) return; // debounce fast double-clicks
                        lastSortClickAt.current = now;
                        if (audited.onSortChange) {
                          audited.onSortChange(col.key, sortField === col.key && sortDirection === "asc" ? "desc" : "asc");
                        }
                      }}
                    >
                      <span className="font-semibold text-slate-700">{col.label}</span>
                      {renderSortIcon(col.key)}
                    </button>
                    <span
                      className="ml-auto w-1.5 h-5 cursor-col-resize opacity-40 hover:opacity-80"
                      onMouseDown={(e) => handleResize(col.key, e)}
                    />
                  </div>
                  {enableColumnFilters && (
                    <div className="mt-1">
                      <input
                        value={localFilters[col.key] || ""}
                        onChange={(e) => setLocalFilters({ ...localFilters, [col.key]: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            audited.onColumnFiltersChange && audited.onColumnFiltersChange({ ...localFilters, [col.key]: e.currentTarget.value });
                          }
                        }}
                        className="w-full h-7 px-2 text-xs border rounded-sm focus:ring-1 focus:ring-blue-500"
                        placeholder={`Filtrar ${col.label}`}
                      />
                    </div>
                  )}
                </TableHead>
              ))}
              {rowActionsRender && (
                <TableHead className={`w-28 ${padX} ${padYHead} text-right`}>
                  Ações
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody style={{minHeight: 420}}>
            {isLoading ? (
              Array.from({ length: 12 }).map((_, i) => (
                <TableRow key={`sk-${i}`} className="hover:bg-transparent">
                  <TableCell className={`${padX} ${padYCell}`}>
                    <Skeleton className="h-4 w-4 rounded" />
                  </TableCell>
                  {visibleColumns.map((c, idx) => (
                  <TableCell key={`skc-${idx}`} className={`${padX} ${padYCell} ${c.isNumeric ? 'text-right' : ''}`}>
                      <Skeleton className={`h-4 ${c.isNumeric ? 'ml-auto w-16' : 'w-3/4'}`} />
                    </TableCell>
                  ))}
                  {rowActionsRender && (
                    <TableCell className="px-3 text-right">
                      <Skeleton className="h-4 w-12 ml-auto" />
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : (
              data.map((row) => {
                const tr = (
                  <TableRow key={row.id} className="hover:bg-blue-50/40">
                    <TableCell className={`${padX} ${padYCell}`}>
                      {isRowSelectable(row) ? (
                        <Checkbox checked={selectedSet.has(row.id)} onCheckedChange={() => audited.onToggleItem && audited.onToggleItem(row.id)} />
                      ) : (
                        <span className="inline-block w-4 h-4 opacity-40" />
                      )}
                    </TableCell>
                    {visibleColumns.map((c) => (
                      <TableCell key={c.key} className={`${padX} ${padYCell} ${c.isNumeric ? 'text-right' : ''}`}>
                        {typeof c.render === 'function' ? c.render(row) : (row[c.key] != null ? String(row[c.key]) : '')}
                      </TableCell>
                    ))}
                    {rowActionsRender && (
                      <TableCell className={`${padX} ${padYCell} text-right`}>
                        <div className="inline-flex items-center gap-1">
                          {rowActionsRender(row)}
                          <DropdownMenu>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                              </TooltipTrigger>
                              <TooltipContent>Mais ações</TooltipContent>
                            </Tooltip>
                            <DropdownMenuContent align="end">
                              {Array.isArray(rowContextMenuItems?.(row)) && rowContextMenuItems(row).map((it) => (
                                <button key={it.key} className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent" onClick={it.action}>{it.label}</button>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
                if (rowContextMenuItems) {
                  return (
                    <ContextMenu key={`ctx-${row.id}`}>
                      <ContextMenuTrigger asChild>
                        {tr}
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        {rowContextMenuItems(row)?.map((it) => (
                          <ContextMenuItem key={`ctx-${row.id}-${it.key}`} onClick={it.action}>
                            {it.label}
                          </ContextMenuItem>
                        ))}
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                }
                return tr;
              })
            )}
          </TableBody>
        </Table>
        </div>
      </div>

      {footerTotals && Object.keys(totals).length > 0 && (
        <div className="mt-2 text-sm text-slate-600 flex flex-wrap gap-4">
          {Object.entries(totals).map(([k, v]) => (
            <div key={k}><span className="font-medium">Total {columns.find(c => c.key === k)?.label}:</span> {v.toLocaleString('pt-BR')}</div>
          ))}
        </div>
      )}

      {/* Paginação backend padronizada (renderiza apenas se controlada externamente) */}
      {onPageChange && (totalItems || 0) > 0 && (
        <div className="mt-3 flex items-center justify-between gap-2 text-sm">
          <div className="text-slate-600">
            Página {page} de {totalPages}{totalItems ? ` • ${totalItems} registros` : ''}
          </div>
          <div className="flex items-center gap-2">
            <select
              className="h-8 border rounded-sm px-2"
              value={pageSize}
              onChange={(e) => audited.onPageSizeChange && audited.onPageSizeChange(Number(e.target.value))}
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>{n}/página</option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => audited.onPageChange && audited.onPageChange(Math.max(1, page - 1))}
                disabled={page <= 1}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => audited.onPageChange && audited.onPageChange(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
              >
                Próxima
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
