import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Calculator, ArrowRightLeft, CheckCircle2 } from "lucide-react";
import { converterUnidade } from "@/components/lib/CalculadoraUnidades";

/**
 * V21.1.2-R2 - Aba de Conversões Avançadas
 * ✅ Conversões bidirecionais automáticas
 * ✅ Preview de equivalências
 * ✅ Validação de fatores
 */
export default function AbaConversoesProduto({ formData = {} }) {
  // Normalize persisted legacy decimals for display without changing the record.
  const positiveFactor = value => {
    if (typeof value !== "number" && typeof value !== "string") return 0;
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
  };
  const fatores_conversao = Object.fromEntries(
    Object.entries(formData.fatores_conversao || {}).map(([key, value]) => [key, positiveFactor(value)])
  );
  const produtoConversao = {
    ...formData,
    fatores_conversao,
    peso_teorico_kg_m: positiveFactor(formData.peso_teorico_kg_m),
  };

  return (
    <div className="space-y-6">
      <Alert className="border-sky-300 bg-sky-50">
        <Calculator className="w-5 h-5 text-sky-600" />
        <AlertDescription className="text-sm text-sky-900">
          <p className="font-semibold mb-2">🔧 Fatores de Conversão Automáticos</p>
          <p>Esses fatores são calculados automaticamente quando você preenche peso teórico e comprimento da barra.</p>
        </AlertDescription>
      </Alert>

      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-6 space-y-4">
          <h3 className="font-bold text-blue-900 flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5" />
            Fatores de Conversão
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>KG por Metro (kg/m)</Label>
              <Input
                type="number"
                step="0.001"
                value={fatores_conversao?.kg_por_metro || 0}
                disabled
                className="bg-white"
              />
            </div>

            <div>
              <Label>KG por Peça</Label>
              <Input
                type="number"
                step="0.01"
                value={fatores_conversao?.kg_por_peca?.toFixed(2) || 0}
                disabled
                className="bg-white"
              />
            </div>

            <div>
              <Label>Metros por Peça</Label>
              <Input
                type="number"
                value={fatores_conversao?.metros_por_peca || 0}
                disabled
                className="bg-white"
              />
            </div>

            <div>
              <Label>Peças por Tonelada</Label>
              <Input
                type="number"
                value={fatores_conversao?.peca_por_ton?.toFixed(1) || 0}
                disabled
                className="bg-white"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Simulador de Conversão */}
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-6 space-y-4">
          <h3 className="font-bold text-green-900">🧮 Simulador de Conversão</h3>

          <div className="grid grid-cols-3 gap-4">
            {[
              { de: 'KG', para: 'MT', valor: 100 },
              { de: 'KG', para: 'PÇ', valor: 100 },
              { de: 'MT', para: 'KG', valor: 10 },
              { de: 'PÇ', para: 'KG', valor: 5 },
              { de: 'TON', para: 'KG', valor: 1 },
              { de: 'TON', para: 'PÇ', valor: 1 }
            ].map((sim, idx) => {
              const resultado = converterUnidade(sim.valor, sim.de, sim.para, produtoConversao);
              return (
                <div key={idx} className="p-3 bg-white rounded border">
                  <p className="text-xs text-slate-600 mb-1">
                    {sim.valor} {sim.de} = 
                  </p>
                  <p className="font-bold text-green-700">
                    {Number.isFinite(resultado) && resultado > 0
                      ? `${resultado.toFixed(3)} ${sim.para}`
                      : "Não disponível"}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Unidades Habilitadas */}
      <Card className="border-sky-200 bg-sky-50">
        <CardContent className="p-6">
          <h3 className="font-bold text-sky-900 mb-4">✅ Unidades Habilitadas para Este Produto</h3>
          
          <div className="flex flex-wrap gap-2">
            {(formData.unidades_secundarias || []).map(unidade => (
              <Badge key={unidade} className="bg-sky-600 text-white px-4 py-2">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {unidade}
              </Badge>
            ))}
          </div>

          <p className="text-xs text-slate-600 mt-4">
            💡 Essas unidades estarão disponíveis nos dropdowns de Vendas, Compras e Movimentações
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
