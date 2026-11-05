import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award, Star, TrendingUp } from 'lucide-react';
import { useContextoVisual } from '@/components/lib/useContextoVisual';

/**
 * Gamificação e Ranking de Colaboradores
 * Top Operadores, Vendedores e Motoristas
 */
export default function GameficacaoProducao({ empresaId }) {
  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaScopeId = empresaId || empresaAtual?.id || null;
  const contextoValido = Boolean(empresaScopeId || groupId);

  // Escopo multiempresa: sem list unscoped; enabled exige contexto; erro ≠ zero KPI.
  const { data: ops = [], isError: isErrorOps } = useQuery({
    queryKey: ['ordens-producao-game', groupId, empresaScopeId],
    queryFn: () => filterInContext('OrdemProducao', {}, '-created_date', 200),
    enabled: contextoValido,
  });

  const { data: pedidos = [], isError: isErrorPedidos } = useQuery({
    queryKey: ['pedidos-game', groupId, empresaScopeId],
    queryFn: () => filterInContext('Pedido', {}, '-created_date', 200),
    enabled: contextoValido,
  });

  const { data: entregas = [], isError: isErrorEntregas } = useQuery({
    queryKey: ['entregas-game', groupId, empresaScopeId],
    queryFn: () => filterInContext('Entrega', {}, '-created_date', 200),
    enabled: contextoValido,
  });

  const cargaIndisponivel = isErrorOps || isErrorPedidos || isErrorEntregas;

  // Ranking de Operadores (menor refugo)
  const rankingOperadores = ops
    .flatMap(op => op.apontamentos || [])
    .reduce((acc, apo) => {
      const operador = apo.operador || 'Não Identificado';
      if (!acc[operador]) {
        acc[operador] = {
          operador,
          total_produzido_kg: 0,
          total_refugo_kg: 0,
          percentual_refugo: 0
        };
      }
      acc[operador].total_produzido_kg += apo.peso_produzido_kg || 0;
      acc[operador].total_refugo_kg += apo.peso_refugado_kg || 0;
      return acc;
    }, {});

  Object.values(rankingOperadores).forEach(op => {
    op.percentual_refugo = op.total_produzido_kg > 0
      ? (op.total_refugo_kg / op.total_produzido_kg) * 100
      : 0;
  });

  const topOperadores = Object.values(rankingOperadores)
    .sort((a, b) => a.percentual_refugo - b.percentual_refugo)
    .slice(0, 5);

  // Ranking de Vendedores (maior valor)
  const rankingVendedores = pedidos
    .filter(p => p.status !== 'Cancelado')
    .reduce((acc, ped) => {
      const vendedor = ped.vendedor || 'Sem Vendedor';
      if (!acc[vendedor]) {
        acc[vendedor] = {
          vendedor,
          total_vendas: 0,
          quantidade_pedidos: 0,
          ticket_medio: 0
        };
      }
      acc[vendedor].total_vendas += ped.valor_total || 0;
      acc[vendedor].quantidade_pedidos++;
      return acc;
    }, {});

  Object.values(rankingVendedores).forEach(v => {
    v.ticket_medio = v.quantidade_pedidos > 0
      ? v.total_vendas / v.quantidade_pedidos
      : 0;
  });

  const topVendedores = Object.values(rankingVendedores)
    .sort((a, b) => b.total_vendas - a.total_vendas)
    .slice(0, 5);

  // Ranking de Motoristas (mais entregas concluídas)
  const rankingMotoristas = entregas
    .filter(e => e.status === 'Entregue')
    .reduce((acc, ent) => {
      const motorista = ent.motorista || 'Não Identificado';
      if (!acc[motorista]) {
        acc[motorista] = {
          motorista,
          total_entregas: 0,
          km_rodado: 0
        };
      }
      acc[motorista].total_entregas++;
      acc[motorista].km_rodado += ent.km_rodado || 0;
      return acc;
    }, {});

  const topMotoristas = Object.values(rankingMotoristas)
    .sort((a, b) => b.total_entregas - a.total_entregas)
    .slice(0, 5);

  const podios = [
    { icone: Trophy, cor: 'yellow', classe: 'text-yellow-600' },
    { icone: Medal, cor: 'gray', classe: 'text-slate-500' },
    { icone: Award, cor: 'orange', classe: 'text-orange-600' }
  ];

  return (
    <div className="space-y-3">
      {(cargaIndisponivel || !contextoValido) && (
        <p className="text-xs text-slate-500">
          {!contextoValido
            ? 'Selecione um grupo ou empresa para carregar rankings.'
            : 'Ranking RH indisponível (erro de carga ≠ zero).'}
        </p>
      )}
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Ranking Operadores */}
      <Card className="border-0 shadow-md">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="w-5 h-5 text-blue-600" />
            🏆 Top Operadores
          </CardTitle>
          <p className="text-xs text-slate-600">Menor % de refugo</p>
        </CardHeader>
        <CardContent className="p-4 space-y-2">
          {topOperadores.map((op, idx) => {
            const Icone = podios[idx]?.icone || Star;
            return (
              <div key={idx} className="flex items-center gap-3 p-3 bg-white rounded-lg border shadow-sm">
                <Icone className={`w-6 h-6 ${podios[idx]?.classe || 'text-slate-400'}`} />
                <div className="flex-1">
                  <p className="font-semibold text-sm">{op.operador}</p>
                  <p className="text-xs text-slate-600">
                    {op.total_produzido_kg.toFixed(0)} kg produzidos
                  </p>
                </div>
                <Badge className={op.percentual_refugo < 3 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}>
                  {op.percentual_refugo.toFixed(1)}% refugo
                </Badge>
              </div>
            );
          })}
          {topOperadores.length === 0 && (
            <p className="text-center text-slate-500 py-8 text-sm">
              {cargaIndisponivel ? 'Produção indisponível (erro ≠ zero)' : 'Sem dados de produção'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Ranking Vendedores */}
      <Card className="border-0 shadow-md">
        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            💰 Top Vendedores
          </CardTitle>
          <p className="text-xs text-slate-600">Maior faturamento</p>
        </CardHeader>
        <CardContent className="p-4 space-y-2">
          {topVendedores.map((vend, idx) => {
            const Icone = podios[idx]?.icone || Star;
            return (
              <div key={idx} className="flex items-center gap-3 p-3 bg-white rounded-lg border shadow-sm">
                <Icone className={`w-6 h-6 ${podios[idx]?.classe || 'text-slate-400'}`} />
                <div className="flex-1">
                  <p className="font-semibold text-sm">{vend.vendedor}</p>
                  <p className="text-xs text-slate-600">
                    {vend.quantidade_pedidos} pedido(s)
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600 text-sm">
                    R$ {vend.total_vendas.toLocaleString('pt-BR')}
                  </p>
                  <p className="text-xs text-slate-500">
                    Ticket: R$ {vend.ticket_medio.toFixed(0)}
                  </p>
                </div>
              </div>
            );
          })}
          {topVendedores.length === 0 && (
            <p className="text-center text-slate-500 py-8 text-sm">
              {cargaIndisponivel ? 'Vendas indisponíveis (erro ≠ zero)' : 'Sem dados de vendas'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Ranking Motoristas */}
      <Card className="border-0 shadow-md">
        <CardHeader className="bg-gradient-to-r from-orange-50 to-yellow-50 border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="w-5 h-5 text-orange-600" />
            🚚 Top Motoristas
          </CardTitle>
          <p className="text-xs text-slate-600">Mais entregas concluídas</p>
        </CardHeader>
        <CardContent className="p-4 space-y-2">
          {topMotoristas.map((mot, idx) => {
            const Icone = podios[idx]?.icone || Star;
            return (
              <div key={idx} className="flex items-center gap-3 p-3 bg-white rounded-lg border shadow-sm">
                <Icone className={`w-6 h-6 ${podios[idx]?.classe || 'text-slate-400'}`} />
                <div className="flex-1">
                  <p className="font-semibold text-sm">{mot.motorista}</p>
                  <p className="text-xs text-slate-600">
                    {mot.km_rodado.toFixed(0)} km rodados
                  </p>
                </div>
                <Badge className="bg-orange-100 text-orange-700">
                  {mot.total_entregas} entregas
                </Badge>
              </div>
            );
          })}
          {topMotoristas.length === 0 && (
            <p className="text-center text-slate-500 py-8 text-sm">
              {cargaIndisponivel ? 'Entregas indisponíveis (erro ≠ zero)' : 'Sem dados de entregas'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
    </div>
  );
}