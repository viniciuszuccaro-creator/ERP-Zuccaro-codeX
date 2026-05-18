import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export default function SelectedOperationalReport({ selectedReport, filtros, onExport, onClose, renderChart }) {
  if (!selectedReport || selectedReport.component) return null;

  return (
    <Card className="border-0 shadow-md mt-4" data-permission="Relatorios.visualizar">
      <CardHeader className="border-b bg-slate-50">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2">
              {selectedReport.icone ? <selectedReport.icone className={`w-5 h-5 ${selectedReport.cor || ''}`} /> : null}
              {selectedReport.titulo}
            </CardTitle>
            <p className="text-sm text-slate-600 mt-1">{selectedReport.descricao}</p>
            <p className="text-xs text-slate-500 mt-1">
              Período: {new Date(filtros.data_inicio).toLocaleDateString('pt-BR')} a {new Date(filtros.data_fim).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              data-permission="Relatorios.exportar"
              data-action="Relatorios.exportar_csv"
              onClick={() => {
                const dados = selectedReport.getData ? selectedReport.getData() : [];
                if (Array.isArray(dados)) onExport(dados, selectedReport.titulo);
              }}
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
