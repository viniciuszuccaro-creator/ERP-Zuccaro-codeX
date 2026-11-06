import React from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";

export default function HistoricoTab({ cliente, formData }) {
  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm">Classificação ABC</Label>
            {formData.classificacao_abc === "A" && <Badge className="bg-green-500">Classe A</Badge>}
            {formData.classificacao_abc === "B" && <Badge className="bg-blue-500">Classe B</Badge>}
            {formData.classificacao_abc === "C" && <Badge className="bg-orange-500">Classe C</Badge>}
            {formData.classificacao_abc === "Novo" && <Badge variant="outline">Novo</Badge>}
          </div>
          <p className="text-2xl font-bold text-green-600">R$ {(formData.valor_compras_12meses || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-slate-500 mt-1">Compras nos últimos 12 meses</p>
        </Card>

        <Card className="p-4">
          <Label className="text-sm">Total de Pedidos</Label>
          <p className="text-2xl font-bold text-blue-600">{formData.quantidade_pedidos || 0}</p>
          <p className="text-xs text-slate-500 mt-1">Pedidos realizados</p>
        </Card>

        <Card className="p-4">
          <Label className="text-sm">Ticket Médio</Label>
          <p className="text-2xl font-bold text-sky-600">R$ {(formData.ticket_medio || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-slate-500 mt-1">Valor médio por pedido</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <Label>Próxima Ação Agendada (CRM)</Label>
          {formData.proxima_acao?.data && (
            <Badge
              className={
                new Date(formData.proxima_acao.data) < new Date() ? "bg-red-500" : "bg-green-500"
              }
            >
              {new Date(formData.proxima_acao.data) < new Date() ? "ATRASADA" : "Agendada"}
            </Badge>
          )}
        </div>
        {formData.proxima_acao?.data ? (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Data</Label>
              <p className="font-medium">{new Date(formData.proxima_acao.data).toLocaleDateString("pt-BR")}</p>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Descrição</Label>
              <p className="text-sm">{formData.proxima_acao.descricao}</p>
            </div>
          </div>
        ) : (
          <p className="text-slate-500 text-center py-4">Nenhuma ação agendada no CRM</p>
        )}
      </Card>

      <Card className="p-4 bg-slate-50">
        <div className="flex items-center gap-2 mb-3">
          <History className="w-5 h-5" />
          <h4 className="font-semibold">Log de Auditoria</h4>
        </div>
        {cliente ? (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            <div className="text-sm p-2 bg-white rounded">
              <div className="flex justify-between">
                <span className="font-medium">Criado em:</span>
                <span>{new Date(cliente.created_date).toLocaleString("pt-BR")}</span>
              </div>
            </div>
            <div className="text-sm p-2 bg-white rounded">
              <div className="flex justify-between">
                <span className="font-medium">Última atualização:</span>
                <span>{new Date(cliente.updated_date).toLocaleString("pt-BR")}</span>
              </div>
            </div>
            <div className="text-sm p-2 bg-white rounded">
              <div className="flex justify-between">
                <span className="font-medium">Criado por:</span>
                <span>{cliente.created_by}</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 text-center mt-4">📝 Alterações em campos críticos (CNPJ, Limite de Crédito, Condição) são registradas automaticamente</p>
          </div>
        ) : (
          <p className="text-slate-500 text-center py-4">Disponível após o primeiro salvamento</p>
        )}
      </Card>
    </>
  );
}
