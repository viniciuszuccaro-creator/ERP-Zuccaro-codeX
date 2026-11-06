import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, Package, Truck, CheckCircle2 } from 'lucide-react';

function KpiValue({ value, unavailable }) {
  if (unavailable || value == null) {
    return (
      <span aria-label="Contagem indisponível" className="text-2xl font-bold tabular-nums text-amber-800">
        —
      </span>
    );
  }
  return <span className="text-2xl font-bold tabular-nums">{value}</span>;
}

export default function KPIsExpedicao({ statusCounts }) {
  const unavailable = Boolean(statusCounts?.unavailable);

  const items = [
    { key: 'aguardando', label: 'Aguardando', tone: 'text-yellow-600', valueTone: 'text-yellow-700', Icon: Clock, iconTone: 'text-yellow-500' },
    { key: 'separacao', label: 'Separando', tone: 'text-blue-600', valueTone: 'text-blue-700', Icon: Package, iconTone: 'text-blue-500' },
    { key: 'pronto', label: 'Pronto', tone: 'text-sky-600', valueTone: 'text-sky-700', Icon: CheckCircle2, iconTone: 'text-sky-500' },
    { key: 'transito', label: 'Trânsito', tone: 'text-orange-600', valueTone: 'text-orange-700', Icon: Truck, iconTone: 'text-orange-500' },
    { key: 'entregue', label: 'Entregue', tone: 'text-green-600', valueTone: 'text-green-700', Icon: CheckCircle2, iconTone: 'text-green-500' },
  ];

  return (
    <div
      className="grid grid-cols-5 gap-2 min-h-[90px] max-h-[90px]"
      data-kpis-unavailable={unavailable ? 'true' : 'false'}
      role="status"
    >
      {items.map(({ key, label, tone, valueTone, Icon, iconTone }) => (
        <Card key={key} className="border-0 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs ${tone}`}>{label}</p>
                <p className={valueTone}>
                  <KpiValue value={statusCounts?.[key]} unavailable={unavailable} />
                </p>
              </div>
              <Icon className={`w-7 h-7 ${iconTone} opacity-30`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
