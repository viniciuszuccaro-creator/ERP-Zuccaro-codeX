import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { base44 } from "@/api/base44Client";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";

export default function SelectedOperationalReport({ selectedReport, filtros, onExport, onClose, renderChart }) {
  const { empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { user } = useUser();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = Boolean(empresaId || groupId);
  const canExport = hasPermission("Relatorios", null, "exportar") || hasPermission("RelatÛrios", null, "exportar");

  const auditarExportacao = async (sucesso, detalhes = {}) => {
    try {
      await base44.entities.AuditLog.create({
        acao: sucesso ? "Exportacao" : "Bloqueio",
        modulo: "Relatorios",
        entidade: "SelectedOperationalReport",
        descricao: sucesso ? "Exportacao de relatorio operacional" : (detalhes.motivo || "Bloqueio de exportacao operacional"),
        usuario_id: user?.id || null,
        usuario: user?.full_name || user?.email || "Usuario local",
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId,
        tipo_auditoria: sucesso ? "operacional" : "seguranca",
        dados_novos: { titulo: selectedReport?.titulo, filtros, ...detalhes },
        sucesso,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn("Falha ao auditar relatorio operacional:", error);
    }
  };

  const handleExportar = async () => {
    const dados = selectedReport?.getData ? selectedReport.getData() : [];
    if (!contextoValido || !canExport || !Array.isArray(dados)) {
      await auditarExportacao(false, { motivo: "Tentativa de exportar relatorio operacional sem contexto, permissao ou dados validos.", quantidade: Array.isArray(dados) ? dados.length : 0 });
      return;
    }
    const confirmado = window.confirm(`Exportar ${dados.length} registros de ${selectedReport.titulo}?`);
    if (!confirmado) {
      await auditarExportacao(false, { motivo: "Exportacao operacional cancelada pelo usuario.", quantidade: dados.length });
      return;
    }
    const dadosComContexto = dados.map((item) => ({
      ...item,
      group_id: groupId,
      grupo_id: groupId,
      empresa_id: empresaId,
    }));
    onExport(dadosComContexto, selectedReport.titulo);
    await auditarExportacao(true, { quantidade: dadosComContexto.length });
  };

  if (!selectedReport || selectedReport.component) return null;

  return (
    <Card className="border-0 shadow-md mt-4" data-permission="Relatorios.visualizar" data-context-required="group-or-company">
      <CardHeader className="border-b bg-slate-50">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2">
              {selectedReport.icone ? <selectedReport.icone className={`w-5 h-5 ${selectedReport.cor || ''}`} /> : null}
              {selectedReport.titulo}
            </CardTitle>
            <p className="text-sm text-slate-600 mt-1">{selectedReport.descricao}</p>
            <p className="text-xs text-slate-500 mt-1">
              Per√≠odo: {new Date(filtros.data_inicio).toLocaleDateString('pt-BR')} a {new Date(filtros.data_fim).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              data-permission="Relatorios.exportar"
              data-action="Relatorios.exportar_csv"
              disabled={!contextoValido || !canExport}
              data-context-required="group-or-company"
              data-sensitive="true"
              onClick={handleExportar}
            >
              <Download className="w-4 h-4 mr-2" />
              Excel
            </Button>
            <Button variant="outline" size="sm" data-permission="Relatorios.visualizar" data-action="Relatorios.fechar" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {renderChart ? renderChart(selectedReport) : null}
      </CardContent>
    </Card>
  );
}