import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";

/**
 * Resumo financeiro: valores já formatados (ou "—").
 * Não inventa R$ 0,00 a partir de amostra vazia/erro — o Dashboard decide fail-closed.
 */
export default function FinancialSummary({
  receitasPendentesDisplay = '—',
  despesasPendentesDisplay = '—',
  fluxoCaixaDisplay = '—',
  fluxoCaixa = null,
}) {
  const fluxoOk = typeof fluxoCaixa === 'number' && Number.isFinite(fluxoCaixa);
  const fluxoPositive = fluxoOk && fluxoCaixa >= 0;

  return (
    <Card className="border-0 shadow-md" data-block="dashboard-financial-summary">
      <CardHeader className="border-b bg-slate-50">
        <CardTitle>Resumo Financeiro do Período</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-6 bg-green-50 rounded-lg">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-600" />
            <p className="text-sm text-slate-600 mb-1">Receitas Pendentes</p>
            <p className="text-2xl font-bold text-green-600" data-fin-kpi="receitas">
              {receitasPendentesDisplay}
            </p>
          </div>
          <div className="text-center p-6 bg-red-50 rounded-lg">
            <TrendingDown className="w-8 h-8 mx-auto mb-2 text-red-600" />
            <p className="text-sm text-slate-600 mb-1">Despesas Pendentes</p>
            <p className="text-2xl font-bold text-red-600" data-fin-kpi="despesas">
              {despesasPendentesDisplay}
            </p>
          </div>
          <div className={`text-center p-6 ${fluxoOk ? (fluxoPositive ? 'bg-blue-50' : 'bg-orange-50') : 'bg-slate-50'} rounded-lg`}>
            <DollarSign className={`w-8 h-8 mx-auto mb-2 ${fluxoOk ? (fluxoPositive ? 'text-blue-600' : 'text-orange-600') : 'text-slate-600'}`} />
            <p className="text-sm text-slate-600 mb-1">Saldo Projetado</p>
            <p className={`text-2xl font-bold ${fluxoOk ? (fluxoPositive ? 'text-blue-600' : 'text-orange-600') : 'text-slate-600'}`} data-fin-kpi="fluxo">
              {fluxoCaixaDisplay}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
