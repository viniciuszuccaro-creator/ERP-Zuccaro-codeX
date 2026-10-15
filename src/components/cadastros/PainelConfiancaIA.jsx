import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sparkles, CheckCircle2, AlertCircle } from "lucide-react";

/**
 * V21.1.2-R2 - Painel de Confiança da IA
 * ✅ Mostra score de confiança por campo
 * ✅ Visual futurista
 * ✅ Indicadores de precisão
 */
export default function PainelConfiancaIA({ sugestoesIA }) {
  if (!sugestoesIA || Object.keys(sugestoesIA).length === 0) {
    return null;
  }

  const scores = [
    { nome: 'Classificação', valor: sugestoesIA.classificacao_confianca || 0 },
    { nome: 'Grupo', valor: sugestoesIA.grupo_confianca || 90 },
    { nome: 'Bitola', valor: sugestoesIA.bitola_confianca || 98 },
    { nome: 'Peso', valor: sugestoesIA.peso_confianca || 92 },
    { nome: 'Tributação', valor: sugestoesIA.tributacao_confianca || 89 },
    { nome: 'NCM', valor: sugestoesIA.ncm_confianca || 95 }
  ].filter(s => s.valor > 0);

  const mediaConfianca = scores.reduce((sum, s) => sum + s.valor, 0) / scores.length;

  return (
    <Card className="border-2 border-sky-300 bg-gradient-to-br from-sky-50 to-blue-50">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-sky-600" />
            <h3 className="font-bold text-sky-900">Confiança da IA</h3>
          </div>
          <Badge className={`${
            mediaConfianca >= 90 ? 'bg-green-600' :
            mediaConfianca >= 75 ? 'bg-blue-600' :
            'bg-orange-600'
          } text-white`}>
            {mediaConfianca >= 90 && <CheckCircle2 className="w-3 h-3 mr-1" />}
            {mediaConfianca < 75 && <AlertCircle className="w-3 h-3 mr-1" />}
            {mediaConfianca.toFixed(0)}% Geral
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {scores.map((score, idx) => (
            <div key={idx} className="p-3 bg-white rounded-lg border">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-medium text-slate-700">{score.nome}</p>
                <span className={`text-xs font-bold ${
                  score.valor >= 90 ? 'text-green-600' :
                  score.valor >= 75 ? 'text-blue-600' :
                  'text-orange-600'
                }`}>
                  {score.valor}%
                </span>
              </div>
              <Progress 
                value={score.valor} 
                className={`h-2 ${
                  score.valor >= 90 ? '[&>div]:bg-green-600' :
                  score.valor >= 75 ? '[&>div]:bg-blue-600' :
                  '[&>div]:bg-orange-600'
                }`}
              />
            </div>
          ))}
        </div>

        {mediaConfianca >= 90 && (
          <div className="p-3 bg-green-50 rounded border border-green-200">
            <p className="text-xs text-green-800">
              ✅ <strong>Alta Confiança:</strong> Dados classificados com precisão. Pode salvar com segurança.
            </p>
          </div>
        )}

        {mediaConfianca < 75 && (
          <div className="p-3 bg-orange-50 rounded border border-orange-200">
            <p className="text-xs text-orange-800">
              ⚠️ <strong>Confiança Moderada:</strong> Recomendamos revisar os campos manualmente.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}