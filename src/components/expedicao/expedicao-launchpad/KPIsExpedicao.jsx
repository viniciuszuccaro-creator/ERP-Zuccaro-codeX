import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, Package, Truck, CheckCircle2, AlertCircle } from 'lucide-react';

export default function KPIsExpedicao({ statusCounts }) {
  return (
    <div className="grid grid-cols-5 gap-2 min-h-[90px] max-h-[90px]">
      <Card className="border-0 shadow-sm">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-yellow-600">Aguardando</p>
              <p className="text-2xl font-bold text-yellow-700">{statusCounts.aguardando}</p>
            </div>
            <Clock className="w-7 h-7 text-yellow-500 opacity-30" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-600">Separando</p>
              <p className="text-2xl font-bold text-blue-700">{statusCounts.separacao}</p>
            </div>
            <Package className="w-7 h-7 text-blue-500 opacity-30" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-sky-600">Pronto</p>
              <p className="text-2xl font-bold text-sky-700">{statusCounts.pronto}</p>
            </div>
            <CheckCircle2 className="w-7 h-7 text-sky-500 opacity-30" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-orange-600">Trânsito</p>
              <p className="text-2xl font-bold text-orange-700">{statusCounts.transito}</p>
            </div>
            <Truck className="w-7 h-7 text-orange-500 opacity-30" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-green-600">Entregue</p>
              <p className="text-2xl font-bold text-green-700">{statusCounts.entregue}</p>
            </div>
            <CheckCircle2 className="w-7 h-7 text-green-500 opacity-30" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}