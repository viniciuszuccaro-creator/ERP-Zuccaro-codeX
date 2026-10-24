import React from "react";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

export default function PedidoHeader({ formData, pedido }) {
  return (
    <div className="flex-shrink-0 p-6 border-b bg-gradient-to-r from-blue-50 to-sky-50 w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-slate-900">
              {pedido ? 'Editar Pedido' : 'Novo Pedido'}
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={
            formData.status === 'Aprovado' ? 'bg-green-600' :
            formData.status === 'Aguardando Aprovação' ? 'bg-orange-600' :
            'bg-slate-600'
          }>
            {formData.status}
          </Badge>
          {formData.prioridade === 'Urgente' && (
            <Badge className="bg-red-600">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Urgente
            </Badge>
          )}
          <Badge className={`${formData.origem_pedido === 'Manual' ? 'bg-slate-600' : 'bg-gradient-to-r from-sky-600 to-blue-600'}`}>
            🎯 {formData.origem_pedido}
          </Badge>
        </div>
      </div>

    </div>
  );
}
