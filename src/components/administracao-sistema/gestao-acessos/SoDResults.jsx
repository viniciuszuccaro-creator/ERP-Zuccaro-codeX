import React from "react";
import { Card, CardContent } from "@/components/ui/card";

export default function SoDResults({ resultado }) {
  if (!resultado) return null;

  // Normaliza resultados esperados: { conflicts: [{perfil_id, perfil_nome, tipo_conflito, descricao, severidade}] }
  const conflicts = Array.isArray(resultado?.conflicts) ? resultado.conflicts : [];

  if (conflicts.length === 0) {
    return (
      <Card className="w-full">
        <CardContent className="p-4 text-sm text-slate-600">Nenhum conflito encontrado.</CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full h-full flex flex-col gap-3">
      <div className="text-sm text-slate-700">Conflitos detectados: {conflicts.length}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {conflicts.map((c, idx) => (
          <Card key={idx} className="w-full">
            <CardContent className="p-4 space-y-1">
              <div className="text-sm font-medium text-slate-800">{c?.perfil_nome || c?.perfil_id || 'Perfil'}</div>
              <div className="text-xs text-slate-600">Tipo: {c?.tipo_conflito || 'Indefinido'}</div>
              <div className="text-xs text-slate-600">Severidade: {c?.severidade || 'Media'}</div>
              {c?.descricao && <div className="text-xs text-slate-500">{c.descricao}</div>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
