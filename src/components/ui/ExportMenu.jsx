import React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileText, FileSpreadsheet } from "lucide-react";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { base44 } from "@/api/base44Client";

const sanitizeCell = (value) => String(value ?? "")
  .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "")
  .replace(/javascript:\s*/gi, "")
  .trim();

const escapeHtml = (value) => sanitizeCell(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

/**
 * Menu de exportacao reutilizavel.
 * Exporta dados em CSV ou PDF/impressao com RBAC, contexto e auditoria opcional.
 */
export default function ExportMenu({
  data,
  fileName = "relatorio",
  title = "Relatorio",
  module = "Sistema",
  section = "Exportacao",
  disabled = false,
  columns = null,
  onBeforeExport,
  onExport,
}) {
  const { hasPermission } = usePermissions();
  const { empresaAtual, grupoAtual } = useContextoVisual();
  const empresaId = empresaAtual?.id || null;
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const allowed = hasPermission(module, section, "exportar") || hasPermission(module, null, "exportar");
  const blocked = disabled || !allowed || !contextoValido;
  const safeData = Array.isArray(data) ? data : [];
  const resolvedColumns = Array.isArray(columns) && columns.length > 0
    ? columns
    : Object.keys(safeData[0] || {}).map((key) => ({ header: key, accessor: key }));

  const audit = async ({ acao, descricao, formato, sucesso = true }) => {
    try {
      await base44.entities.AuditLog.create({
        usuario: "UI",
        acao,
        modulo: module,
        tipo_auditoria: sucesso ? "ui" : "seguranca",
        entidade: "Exportacao",
        descricao,
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId,
        dados_novos: { section, formato, quantidade: safeData.length },
        data_hora: new Date().toISOString(),
        sucesso
      });
    } catch (error) {
      console.warn("Falha ao auditar exportacao:", error);
    }
  };

  const ensureCanExport = async (formato) => {
    if (blocked) {
      await audit({
        acao: "Bloqueio",
        descricao: `Tentativa de exportacao bloqueada (${section})`,
        formato,
        sucesso: false
      });
      alert("Selecione grupo/empresa e confirme permissao para exportar.");
      return false;
    }
    if (!safeData.length) {
      alert("Nao ha dados para exportar");
      return false;
    }
    if (typeof onBeforeExport === "function") {
      const result = await onBeforeExport({ formato, quantidade: safeData.length });
      if (result === false) return false;
    } else if (!window.confirm(`Exportar ${safeData.length} registro(s) de ${title}?`)) {
      await audit({
        acao: "Cancelamento",
        descricao: `Exportacao cancelada (${section})`,
        formato,
        sucesso: false
      });
      return false;
    }
    return true;
  };

  const exportToExcel = async () => {
    if (!(await ensureCanExport("CSV"))) return;
    const csvContent = [
      resolvedColumns.map((column) => sanitizeCell(column.header || column.accessor)).join(";"),
      ...safeData.map((row) => resolvedColumns
        .map((column) => JSON.stringify(sanitizeCell(row[column.accessor] ?? "")))
        .join(";"))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `${fileName}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    await audit({ acao: "Exportacao", descricao: `Exportar CSV (${section})`, formato: "CSV" });
    if (typeof onExport === "function") await onExport({ formato: "CSV", quantidade: safeData.length });
  };

  const exportToPDF = async () => {
    if (!(await ensureCanExport("PDF"))) return;
    const htmlTable = `
      <html>
        <head>
          <title>${escapeHtml(title)}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #1e293b; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #f1f5f9; padding: 10px; text-align: left; border: 1px solid #e2e8f0; font-weight: 600; }
            td { padding: 8px; border: 1px solid #e2e8f0; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .footer { margin-top: 30px; text-align: center; color: #64748b; font-size: 12px; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(title)}</h1>
          <p><strong>Data:</strong> ${new Date().toLocaleDateString("pt-BR")}</p>
          <table>
            <thead>
              <tr>${resolvedColumns.map((column) => `<th>${escapeHtml(column.header || column.accessor)}</th>`).join("")}</tr>
            </thead>
            <tbody>
              ${safeData.map((row) => `
                <tr>${resolvedColumns.map((column) => `<td>${escapeHtml(row[column.accessor] || "-")}</td>`).join("")}</tr>
              `).join("")}
            </tbody>
          </table>
          <div class="footer">
            <p>Gerado em ${new Date().toLocaleString("pt-BR")} - ERP Integra</p>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open("", "", "height=600,width=800");
    if (!printWindow) {
      alert("Nao foi possivel abrir a janela de impressao.");
      return;
    }
    printWindow.document.write(htmlTable);
    printWindow.document.close();
    printWindow.print();
    await audit({ acao: "Exportacao", descricao: `Exportar PDF (${section})`, formato: "PDF" });
    if (typeof onExport === "function") await onExport({ formato: "PDF", quantidade: safeData.length });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={blocked} data-action={`${section}.exportar`} data-context-required="group-or-company" data-sensitive="true">
          <Download className="w-4 h-4 mr-2" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={exportToExcel} disabled={blocked}>
          <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
          Exportar Excel (CSV)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToPDF} disabled={blocked}>
          <FileText className="w-4 h-4 mr-2 text-red-600" />
          Exportar PDF (Imprimir)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}