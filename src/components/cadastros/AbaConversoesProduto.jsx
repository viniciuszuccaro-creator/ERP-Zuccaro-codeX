import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Calculator, ArrowRightLeft, CheckCircle2 } from "lucide-react";

/**
 * V21.1.2-R2 - Aba de Conversões Avançadas
 * ✅ Conversões bidirecionais automáticas
 * ✅ Preview de equivalências
 * ✅ Validação de fatores
 */
export default function AbaConversoesProduto({ formData, setFormData }) {
  const { fatores_conversao } = formData;

  const calcularConversao = (de, para, valor) => {
    if (valor <= 0) return 0;

    // KG → MT
    if (de === 'KG' && para === 'MT') {
      return fatores_conversao.kg_por_metro > 0 ? valor / fatores_conversao.kg_por_metro : 0;
    }
    // KG → PÇ
    if (de === 'KG' && para === 'PÇ') {
      return fatores_conversao.kg_por_peca > 0 ? valor / fatores_conversao.kg_por_peca : 0;
    }
    // MT → KG
    if (de === 'MT' && para === 'KG') {
      return valor * fatores_conversao.kg_por_metro;
    }
    // PÇ → KG
    if (de === 'PÇ' && para === 'KG') {
      return valor * fatores_conversao.kg_por_peca;
    }
    // TON → KG
    if (de === 'TON' && para === 'KG') {
      return valor * 1000;
    }
    
    return 0;
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
              const resultado = calcularConversao(sim.de, sim.para, sim.valor);
              return (
                <div key={idx} className="p-3 bg-white rounded border">
                  <p className="text-xs text-slate-600 mb-1">
                    {sim.valor} {sim.de} = 
                  </p>
                  <p className="font-bold text-green-700">
                    {resultado.toFixed(3)} {sim.para}
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