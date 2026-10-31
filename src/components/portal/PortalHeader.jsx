import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Users, Lock, Star } from 'lucide-react';

/** @param {{cliente: {nome_fantasia?: string, razao_social?: string, nome?: string,
 * classificacao_abc?: string, status?: string, cnpj?: string, tipo?: string, score_saude_cliente?: number} | null,
 * spotlight?: {raw?: string, exp_minutes_remaining?: string | number}}} props */
export default function PortalHeader({ cliente, spotlight }) {
  const nome = cliente?.nome_fantasia || cliente?.razao_social || cliente?.nome || 'Cliente';
  const iniciais = nome.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  const classABC = cliente?.classificacao_abc;
  const abcColor = { A: 'bg-green-100 text-green-800', B: 'bg-blue-100 text-blue-800', C: 'bg-slate-100 text-slate-700' }[classABC] || 'bg-slate-100 text-slate-700';

  return (
    <Card className="w-full border-0 shadow-md bg-gradient-to-r from-blue-600 to-blue-700 text-white">
      <CardContent className="p-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
            {iniciais || <Building2 className="w-6 h-6" />}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold truncate">{nome}</h2>
              {classABC && (
                <Badge className={`${abcColor} border-0 text-[10px] font-bold px-1.5`}>
                  <Star className="w-2.5 h-2.5 mr-0.5" /> {classABC}
                </Badge>
              )}
              {cliente?.status && (
                <Badge className="bg-white/20 text-white border-0 text-[10px]">{cliente.status}</Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-blue-100 text-xs flex-wrap">
              {cliente?.cnpj && <span>CNPJ: {cliente.cnpj}</span>}
              {cliente?.tipo && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{cliente.tipo}</span>}
              {spotlight?.raw && (
                <span className="flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Link seguro · expira em {spotlight.exp_minutes_remaining} min
                </span>
              )}
            </div>
          </div>

          {/* Score de saúde */}
          {typeof cliente?.score_saude_cliente === 'number' && (
            <div className="text-center flex-shrink-0">
              <div className="text-2xl font-bold">{cliente.score_saude_cliente}</div>
              <div className="text-[10px] text-blue-200">Score Saúde</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
