import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Shield, Award } from "lucide-react";
import { PAPEIS_PILOTO, papeisPilotoCobertos } from "@/components/lib/pilotoOperacaoPolicy";

export default function StatusControleAcesso({ usuarios = [] }) {
  const cobertos = papeisPilotoCobertos(usuarios);
  const completo = cobertos.length === PAPEIS_PILOTO.length;

  return (
    <Card className={`w-full border-2 ${completo ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'}`}>
      <CardContent className="p-6">
        <div className="text-center mb-4">
          <Award className={`w-12 h-12 mx-auto mb-3 ${completo ? 'text-green-600' : 'text-amber-600'}`} />
          <h3 className="text-xl font-bold mb-1">
            Piloto de operacao
          </h3>
          <Badge className={completo ? 'bg-green-600 text-white' : 'bg-amber-600 text-white'}>
            <CheckCircle className="w-4 h-4 mr-2" />
            {cobertos.length}/{PAPEIS_PILOTO.length} papeis designados
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
          {PAPEIS_PILOTO.map((papel) => (
            <div key={papel} className="flex items-center gap-1 text-xs bg-white/70 p-2 rounded">
              <span>{cobertos.includes(papel) ? '✅' : '⏳'}</span>
              <span className="text-slate-700">{papel}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Badge variant="outline" className="border-blue-500 text-blue-700">
            <Shield className="w-3 h-3 mr-1" />
            NF producao so com usuario piloto
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
