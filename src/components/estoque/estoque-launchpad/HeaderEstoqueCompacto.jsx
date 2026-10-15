import React from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Box } from 'lucide-react';

export default function HeaderEstoqueCompacto() {
  return (
    <Card className="border-2 border-sky-500 bg-gradient-to-br from-sky-50 to-sky-50 min-h-[70px] max-h-[70px]">
      <CardHeader className="pb-2 pt-2 px-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-sky-600 flex items-center justify-center flex-shrink-0">
            <Box className="w-5 h-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-base">Estoque e Almoxarifado V22.0</CardTitle>
            <p className="text-xs text-slate-600">Produtos e movimentações</p>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}