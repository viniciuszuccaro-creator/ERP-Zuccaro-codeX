
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Sparkles, AlertTriangle, TrendingUp, User, Package } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

/**
 * Dashboard de Refugo com Análise IA
 * Analisa padrões de refugo e sugere melhorias
 */
export default function DashboardRefugoIA({ empresaId }) {
  const { data: ops = [] } = useQuery({
    queryKey: ['ordens-producao'],
    queryFn: () => base44.entities.OrdemProducao.list('-created_date', 200),
  });

  // Análise de Refugo por Operador
  const refugoPorOperador = ops.reduce((acc, op) => {
    (op.apontamentos || []).forEach(apo => {
      if (apo.quantidade_refugada > 0) {
        const operador = apo.operador || 'Não Identificado';
        if (!acc[operador]) {
          acc[operador] = {
            operador,
            total_refugo_kg: 0,
            total_produzido_kg: 0,
            percentual: 0
          };
        }
        acc[operador].total_refugo_kg += apo.peso_refugado_kg || 0;
        acc[operador].total_produzido_kg += apo.peso_produzido_kg || 0;
      }
    });
    return acc;
  }, {});

  // Calcular percentuais
  Object.values(refugoPorOperador).forEach(op => {
    op.percentual = op.total_produzido_kg > 0 
      ? (op.total_refugo_kg / op.total_produzido_kg) * 100 
      : 0;
  });

  const dadosOperadores = Object.values(refugoPorOperador)
    .sort((a, b) => b.percentual - a.percentual)
    .slice(0, 10);

  // Análise de Refugo por Bitola
  const refugoPorBitola = ops.reduce((acc, op) => {
    (op.refugos || []).forEach(ref => {
      const bitola = ref.bitola || 'Não Especificado';
      if (!acc[bitola]) {
        acc[bitola] = {
          bitola,
          total_kg: 0,
          ocorrencias: 0
        };
      }
      acc[bitola].total_kg += ref.peso_refugado_kg || 0;
      acc[bitola].ocorrencias++;
    });
    return acc;
  }, {});

  const dadosBitolas = Object.values(refugoPorBitola)
    .sort((a, b) => b.total_kg - a.total_kg)
    .slice(0, 5);

  // Alertas IA
  const alertasIA = [];

  // Alerta: Operador com refugo acima da média
  const mediaRefugo = dadosOperadores.reduce((sum, op) => sum + op.percentual, 0) / (dadosOperadores.length || 1);
  dadosOperadores.forEach(op => {
    if (op.percentual > mediaRefugo * 1.5) {
      alertasIA.push({
        tipo: 'operador',
        severidade: 'alta',
        titulo: `Operador ${op.operador} com refugo elevado`,
        descricao: `${op.percentual.toFixed(1)}% de refugo (média: ${mediaRefugo.toFixed(1)}%)`,
        acao: 'Revisar treinamento e procedimentos'
      });
    }
  });

  // Alerta: Bitola problemática
  if (dadosBitolas[0]?.total_kg > 100) {
    alertasIA.push({
      tipo: 'material',
      severidade: 'media',
      titulo: `Bitola ${dadosBitolas[0].bitola} com desperdício anormal`,
      descricao: `${dadosBitolas[0].total_kg.toFixed(1)} kg de refugo em ${dadosBitolas[0].ocorrencias} ocorrências`,
      acao: 'Verificar qualidade do material e ajustar otimizador de corte'
    });
  }

  return (
    <div className="space-y-6">
      {/* Alertas IA */}
      {alertasIA.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            Análise Inteligente de Refugo
          </h3>
          {alertasIA.map((alerta, idx) => (
            <Alert key={idx} className={
              alerta.severidade === 'alta' ? 'border-red-300 bg-red-50' :
              alerta.severidade === 'media' ? 'border-orange-300 bg-orange-50' :
              'border-blue-300 bg-blue-50'
            }>
              <AlertTriangle className={`w-4 h-4 ${
                alerta.severidade === 'alta' ? 'text-red-600' :
                alerta.severidade === 'media' ? 'text-orange-600' :
                'text-blue-600'
              }`} />
              <AlertDescription>
                <p className="font-semibold">{alerta.titulo}</p>
                <p className="text-sm mt-1">{alerta.descricao}</p>
                <p className="text-xs text-slate-600 mt-2 italic">
                  💡 Sugestão: {alerta.acao}
                </p>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Gráficos */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Refugo por Operador */}
        <Card>
          <CardHeader className="border-b bg-slate-50">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              Refugo por Operador
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {dadosOperadores.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dadosOperadores}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="operador" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={100} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value) => `${typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : '-'}%`}
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  />
                  <Bar dataKey="percentual" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <User className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Sem dados de refugo por operador</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Refugo por Bitola */}
        <Card>
          <CardHeader className="border-b bg-slate-50">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="w-5 h-5 text-orange-600" />
              Refugo por Bitola (Top 5)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {dadosBitolas.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dadosBitolas} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="bitola" type="category" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip 
                    formatter={(value) => `${typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : '-'} kg`}
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  />
                  <Bar dataKey="total_kg" fill="#f97316" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Sem dados de refugo por bitola</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
