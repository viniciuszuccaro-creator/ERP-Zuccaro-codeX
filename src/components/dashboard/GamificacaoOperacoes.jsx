import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, TrendingUp, Star, Award } from 'lucide-react';
import useContextoVisual from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';

/**
 * Gamificação de Operações
 * Rankings de desempenho por função
 */
export default function GamificacaoOperacoes() {
  const { filterInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextKey = empresaId || groupId || "sem-contexto";
  const contextoValido = contextKey !== "sem-contexto";
  const canViewGamificacao = hasPermission("Dashboard", "Operacional", "visualizar") ||
    hasPermission("Sistema", "Gamificacao", "visualizar") ||
    hasPermission("Dashboard", null, "visualizar");

  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos-gamificacao', contextKey],
    queryFn: () => filterInContext('Pedido', {}, '-data_pedido', 100),
    enabled: contextoValido && canViewGamificacao,
  });

  const { data: apontamentos = [] } = useQuery({
    queryKey: ['apontamentos-gamificacao', contextKey],
    queryFn: async () => {
      const ops = await filterInContext('OrdemProducao', {}, '-data_emissao', 100);
      return ops.flatMap(op => op.apontamentos || []);
    },
    enabled: contextoValido && canViewGamificacao,
  });

  const { data: entregas = [] } = useQuery({
    queryKey: ['entregas-gamificacao', contextKey],
    queryFn: () => filterInContext('Entrega', {}, '-created_date', 100),
    enabled: contextoValido && canViewGamificacao,
  });

  // Top 5 Vendedores
  const rankingVendedores = pedidos
    .filter(p => p.vendedor && p.status !== 'Cancelado')
    .reduce((acc, p) => {
      const vendedor = p.vendedor;
      if (!acc[vendedor]) {
        acc[vendedor] = { nome: vendedor, total: 0, qtd: 0 };
      }
      acc[vendedor].total += p.valor_total || 0;
      acc[vendedor].qtd += 1;
      return acc;
    }, {});

  const topVendedores = Object.values(rankingVendedores)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Top 5 Operadores
  const rankingOperadores = apontamentos
    .filter(a => a.operador)
    .reduce((acc, a) => {
      const operador = a.operador;
      if (!acc[operador]) {
        acc[operador] = { nome: operador, pecas: 0, peso: 0 };
      }
      acc[operador].pecas += a.quantidade_produzida || 0;
      acc[operador].peso += a.peso_produzido_kg || 0;
      return acc;
    }, {});

  const topOperadores = Object.values(rankingOperadores)
    .sort((a, b) => b.peso - a.peso)
    .slice(0, 5);

  // Top 5 Motoristas (OTD)
  const rankingMotoristas = entregas
    .filter(e => e.motorista && e.status === 'Entregue')
    .reduce((acc, e) => {
      const motorista = e.motorista;
      if (!acc[motorista]) {
        acc[motorista] = { nome: motorista, total: 0, noPrazo: 0 };
      }
      acc[motorista].total += 1;
      if (e.data_entrega && e.data_previsao) {
        if (new Date(e.data_entrega) <= new Date(e.data_previsao)) {
          acc[motorista].noPrazo += 1;
        }
      }
      return acc;
    }, {});

  const topMotoristas = Object.values(rankingMotoristas)
    .map(m => ({
      ...m,
      otd: m.total > 0 ? ((m.noPrazo / m.total) * 100).toFixed(1) : 0
    }))
    .sort((a, b) => b.otd - a.otd)
    .slice(0, 5);

  const podios = {
    1: { cor: 'bg-yellow-100 text-yellow-700 border-yellow-300', icone: '🥇' },
    2: { cor: 'bg-slate-100 text-slate-700 border-slate-300', icone: '🥈' },
    3: { cor: 'bg-orange-100 text-orange-700 border-orange-300', icone: '🥉' },
    default: { cor: 'bg-slate-50 text-slate-600 border-slate-200', icone: '🏅' }
  };

  return (
    <div
      className="grid lg:grid-cols-3 gap-6 w-full h-full"
      data-permission="Dashboard.Operacional.visualizar"
      data-context-required="group-or-company"
    >
      {(!contextoValido || !canViewGamificacao) && (
        <Card className="lg:col-span-3 border-amber-300 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-900">
            Selecione grupo ou empresa e confirme permissao para visualizar gamificacao operacional.
          </CardContent>
        </Card>
      )}
      {/* Top Vendedores */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
        <CardHeader className="border-b bg-white/80">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="w-5 h-5 text-blue-600" />
            Top 5 Vendedores
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-2">
          {topVendedores.map((v, idx) => {
            const podio = podios[idx + 1] || podios.default;
            return (
              <div
                key={idx}
                className={`p-3 rounded-lg border-2 ${podio.cor} flex items-center gap-3`}
              >
                <span className="text-2xl">{podio.icone}</span>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{v.nome}</p>
                  <p className="text-xs text-slate-600">
                    {v.qtd} vendas
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">
                    R$ {v.total.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Top Operadores */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-50 to-orange-100">
        <CardHeader className="border-b bg-white/80">
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="w-5 h-5 text-orange-600" />
            Top 5 Operadores
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-2">
          {topOperadores.map((o, idx) => {
            const podio = podios[idx + 1] || podios.default;
            return (
              <div
                key={idx}
                className={`p-3 rounded-lg border-2 ${podio.cor} flex items-center gap-3`}
              >
                <span className="text-2xl">{podio.icone}</span>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{o.nome}</p>
                  <p className="text-xs text-slate-600">
                    {o.pecas} peças
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-orange-600">
                    {o.peso.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg
                  </p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Top Motoristas */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100">
        <CardHeader className="border-b bg-white/80">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="w-5 h-5 text-green-600" />
            Top 5 Motoristas (OTD)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-2">
          {topMotoristas.map((m, idx) => {
            const podio = podios[idx + 1] || podios.default;
            return (
              <div
                key={idx}
                className={`p-3 rounded-lg border-2 ${podio.cor} flex items-center gap-3`}
              >
                <span className="text-2xl">{podio.icone}</span>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{m.nome}</p>
                  <p className="text-xs text-slate-600">
                    {m.total} entregas
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">
                    {m.otd}% OTD
                  </p>
                  <p className="text-xs text-slate-500">
                    {m.noPrazo}/{m.total} no prazo
                  </p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
