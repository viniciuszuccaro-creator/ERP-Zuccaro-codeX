import React from "react";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

/**
 * Botão de Exportação Universal - V19.1
 * CSV e JSON nativos (sem dependências externas)
 */
const sanitizeExportValue = (value) => {
  const text = String(value ?? '');
  const sanitized = text.replace(/[\r\n]+/g, ' ').trim();
  return /^[=+\-@]/.test(sanitized) ? `'${sanitized}` : sanitized;
};

const normalizeExportRows = (rows = [], columns = null) => {
  const source = columns
    ? rows.map(row => {
        const obj = {};
        columns.forEach(col => {
          obj[col.header || col.key] = row[col.key];
        });
        return obj;
      })
    : rows;

  return source.map(row => Object.fromEntries(
    Object.entries(row || {}).map(([key, value]) => [key, sanitizeExportValue(value)])
  ));
};

export default function ExportButton({ data = [], filename = "export", columns = null, disabled = false, onBeforeExport, ...buttonProps }) {
  
  const exportToCSV = async () => {
    if (disabled) {
      toast.error('Exportacao bloqueada por permissao ou contexto');
      return;
    }

    if (onBeforeExport) {
      const permitido = await onBeforeExport('csv');
      if (permitido === false) return;
    }

    if (!data || data.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    const dadosExport = normalizeExportRows(data, columns);

    const headers = Object.keys(dadosExport[0]);
    const csvContent = [
      headers.join(';'),
      ...dadosExport.map(row => 
        headers.map(h => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(';')
      )
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    toast.success(`✅ ${data.length} registros exportados para CSV!`);
  };

  const exportToJSON = async () => {
    if (disabled) {
      toast.error('Exportacao bloqueada por permissao ou contexto');
      return;
    }

    if (onBeforeExport) {
      const permitido = await onBeforeExport('json');
      if (permitido === false) return;
    }

    if (!data || data.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    const dadosExport = normalizeExportRows(data, columns);

    const jsonContent = JSON.stringify(dadosExport, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(link.href);

    toast.success(`✅ ${data.length} registros exportados para JSON!`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} {...buttonProps}>
          <Download className="w-4 h-4 mr-2" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportToCSV}>
          <FileText className="w-4 h-4 mr-2 text-green-600" />
          CSV (Excel)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToJSON}>
          <FileText className="w-4 h-4 mr-2 text-blue-600" />
          JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
