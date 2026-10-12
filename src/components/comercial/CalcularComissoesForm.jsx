import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calculator, Calendar } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';
import { useUser } from '@/components/lib/UserContext';
import { sanitizeOnWrite } from '@/components/lib/sanitizeOnWrite';

const sanitizeText = (value, max = 500) => String(value ?? '').replace(/[<>]/g, '').slice(0, max).trim();
const toNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const PERCENTUAL_PADRAO = 5;

/**
 * Cálculo em lote de comissões — multiempresa + RBAC fail-closed + sky.
 * Persistência via createInContext (nunca base44.entities direto sem escopo).
 */
export default function CalcularComissoesForm({ onSubmit, onCancel, pedidos = [] }) {
  const [periodo, setPeriodo] = useState('mes');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const { empresaAtual, grupoAtual, contexto, createInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();

  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = contexto === 'empresa' ? (empresaAtual?.id || null) : null;
  const contextoValido = Boolean(groupId || empresaAtual?.id);
  const canCalculate = hasPermission('Comercial', 'Comissao', 'calcular')
    || hasPermission('Comercial', 'Comissões', 'calcular')
    || hasPermission('Comercial', 'Comissao', 'criar')
    || hasPermission('Comercial', null, 'calcular');

  const pedidosNoEscopo = (pedidos || []).filter((p) => {
    if (!contextoValido) return false;
    if (empresaId && p.empresa_id && String(p.empresa_id) !== String(empresaId)) return false;
    if (groupId && p.group_id && String(p.group_id) !== String(groupId) && String(p.grupo_id) !== String(groupId)) {
      // pedido sem group_id ainda pode ser do escopo empresa
      if (!empresaId || String(p.empresa_id) !== String(empresaId)) return false;
    }
    return true;
  });

  const withComissaoContext = (payload = {}, pedidoRef = null) => ({
    ...payload,
    group_id: pedidoRef?.group_id || groupId || payload.group_id || undefined,
    grupo_id: pedidoRef?.grupo_id || groupId || payload.grupo_id || undefined,
    empresa_id: pedidoRef?.empresa_id || empresaId || empresaAtual?.id || payload.empresa_id || undefined,
  });

  const auditCalculo = async (acao, detalhes = {}, sucesso = true) => {
    try {
      await createInContext('AuditLog', {
        usuario_id: user?.id || null,
        usuario: user?.full_name || user?.email || 'Sistema',
        acao,
        modulo: 'Comercial/Comissoes',
        tipo_auditoria: sucesso ? 'operacional' : 'seguranca',
        entidade: 'Comissao',
        descricao: detalhes.descricao || acao,
        empresa_id: empresaId || empresaAtual?.id || null,
        group_id: groupId,
        grupo_id: groupId,
        sucesso,
        detalhes: { origem: 'CalcularComissoesForm', periodo, ...detalhes },
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[CalcularComissoesForm] Falha ao auditar', error);
    }
  };

  const handleCalcularComissoes = async () => {
    if (!contextoValido) {
      await auditCalculo('comissao_calculo_bloqueado', { motivo: 'contexto_obrigatorio' }, false);
      toast({ title: 'Selecione um grupo ou empresa antes de calcular', variant: 'destructive' });
      return;
    }
    if (!canCalculate) {
      await auditCalculo('comissao_calculo_bloqueado', { motivo: 'permissao_negada' }, false);
      toast({ title: 'Sem permissão para calcular comissões', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const hoje = new Date();
      let dataInicioCalculo = new Date();
      let dataFimCalculo = hoje;

      if (periodo === 'mes') {
        dataInicioCalculo = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      } else if (periodo === 'trimestre') {
        const trimestre = Math.floor(hoje.getMonth() / 3);
        dataInicioCalculo = new Date(hoje.getFullYear(), trimestre * 3, 1);
      } else if (periodo === 'ano') {
        dataInicioCalculo = new Date(hoje.getFullYear(), 0, 1);
      } else if (periodo === 'personalizado' && dataInicio && dataFim) {
        dataInicioCalculo = new Date(dataInicio);
        dataFimCalculo = new Date(dataFim);
      } else if (periodo === 'personalizado') {
        toast({ title: 'Informe data início e fim', variant: 'destructive' });
        setSaving(false);
        return;
      }

      const pedidosPeriodo = pedidosNoEscopo.filter((p) => {
        if (p.status !== 'Aprovado' && p.status !== 'Faturado' && p.status !== 'Entregue') return false;
        const dataPedido = new Date(p.data_pedido);
        return dataPedido >= dataInicioCalculo && dataPedido <= dataFimCalculo;
      });

      if (pedidosPeriodo.length === 0) {
        toast({ title: 'Nenhum pedido no período/escopo selecionado', variant: 'destructive' });
        await auditCalculo('comissao_calculo_vazio', { total_pedidos: 0 }, false);
        setSaving(false);
        return;
      }

      const comissoesPorVendedor = {};
      pedidosPeriodo.forEach((pedido) => {
        const vendedor = sanitizeText(pedido.vendedor || 'Sem Vendedor', 160);
        if (!comissoesPorVendedor[vendedor]) {
          comissoesPorVendedor[vendedor] = {
            vendedor,
            vendedor_id: pedido.vendedor_id,
            pedidos: [],
            total_vendas: 0,
            empresa_id: pedido.empresa_id,
            group_id: pedido.group_id || pedido.grupo_id,
          };
        }
        comissoesPorVendedor[vendedor].pedidos.push(pedido);
        comissoesPorVendedor[vendedor].total_vendas += toNumber(pedido.valor_total, 0);
      });

      let contador = 0;
      for (const vendedor of Object.keys(comissoesPorVendedor)) {
        const dados = comissoesPorVendedor[vendedor];
        const valorComissao = dados.total_vendas * (PERCENTUAL_PADRAO / 100);
        const pedidoRef = dados.pedidos[0];
        const payload = withComissaoContext(sanitizeOnWrite({
          vendedor: dados.vendedor,
          vendedor_id: dados.vendedor_id,
          pedido_id: pedidoRef?.id,
          numero_pedido: sanitizeText(`Período: ${periodo}`, 80),
          cliente: sanitizeText(`${dados.pedidos.length} vendas`, 240),
          data_venda: new Date().toISOString().split('T')[0],
          valor_venda: dados.total_vendas,
          percentual_comissao: PERCENTUAL_PADRAO,
          valor_comissao: valorComissao,
          status: 'Pendente',
          observacoes: sanitizeText(
            `Comissão calculada automaticamente para ${dados.pedidos.length} vendas no período.`,
            1000,
          ),
        }), pedidoRef);

        await createInContext('Comissao', payload);
        contador += 1;
      }

      await auditCalculo('comissao_calculo_concluido', {
        total: contador,
        pedidos: pedidosPeriodo.length,
        vendedores: Object.keys(comissoesPorVendedor).length,
      });
      toast({ title: `${contador} comissão(ões) calculada(s) com sucesso` });
      queryClient.invalidateQueries({ queryKey: ['comissoes'] });
      onSubmit?.();
    } catch (error) {
      await auditCalculo('comissao_calculo_erro', { erro: error?.message || 'falha' }, false);
      toast({
        title: 'Erro ao calcular comissões',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const pedidosDisponiveis = pedidosNoEscopo.filter((p) =>
    p.status === 'Aprovado' || p.status === 'Faturado' || p.status === 'Entregue',
  );

  const vendedoresUnicos = [...new Set(pedidosDisponiveis.map((p) => p.vendedor).filter(Boolean))];
  const totalVendasDisponiveis = pedidosDisponiveis.reduce((sum, p) => sum + toNumber(p.valor_total, 0), 0);

  const breakdownVendedores = vendedoresUnicos.map((vendedor) => {
    const pedidosVendedor = pedidosDisponiveis.filter((p) => p.vendedor === vendedor);
    const totalVendas = pedidosVendedor.reduce((sum, p) => sum + toNumber(p.valor_total, 0), 0);
    return {
      vendedor,
      qtdPedidos: pedidosVendedor.length,
      totalVendas,
      comissao: totalVendas * (PERCENTUAL_PADRAO / 100),
    };
  }).sort((a, b) => b.totalVendas - a.totalVendas);

  const statusCount = pedidosDisponiveis.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  const podeSubmit = contextoValido && canCalculate && !saving;

  return (
    <div className="p-6 space-y-6 w-full h-full flex flex-col bg-white">
      <h2 className="text-2xl font-bold flex items-center gap-2 text-sky-900">
        <Calculator className="w-7 h-7 text-sky-600" />
        Calcular Comissões
      </h2>

      {!contextoValido && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertDescription className="text-sm text-amber-900">
            Selecione um grupo ou empresa para calcular comissões no escopo correto.
          </AlertDescription>
        </Alert>
      )}
      {contextoValido && !canCalculate && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-sm text-red-900">
            Sem permissão para calcular comissões.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto">
        <Card className="bg-gradient-to-r from-sky-50 to-blue-50 border-sky-200">
          <CardContent className="p-4 space-y-3">
            <h4 className="font-bold text-sky-900 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Dados no escopo ativo
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-3 rounded-lg border border-sky-100">
                <span className="text-xs text-slate-500 block mb-1">Pedidos no escopo</span>
                <span className="font-bold text-2xl text-sky-700">{pedidosNoEscopo.length}</span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-sky-100">
                <span className="text-xs text-slate-500 block mb-1">Aprovados/Faturados</span>
                <span className="font-bold text-2xl text-sky-800">{pedidosDisponiveis.length}</span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-sky-100">
                <span className="text-xs text-slate-500 block mb-1">Vendedores</span>
                <span className="font-bold text-2xl text-sky-700">{vendedoresUnicos.length}</span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-sky-100">
                <span className="text-xs text-slate-500 block mb-1">Total em vendas</span>
                <span className="font-bold text-xl text-sky-800">
                  R$ {(totalVendasDisponiveis / 1000).toFixed(1)}k
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div>
          <Label htmlFor="periodo">Período</Label>
          <Select value={periodo} onValueChange={setPeriodo} disabled={!podeSubmit && !contextoValido}>
            <SelectTrigger id="periodo" data-action="selecionar-periodo-comissao" data-permission="Comercial.Comissao.calcular">
              <SelectValue placeholder="Selecione o período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mes">Mês Atual</SelectItem>
              <SelectItem value="trimestre">Trimestre Atual</SelectItem>
              <SelectItem value="ano">Ano Atual</SelectItem>
              <SelectItem value="personalizado">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {periodo === 'personalizado' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dataInicio">Data Início</Label>
              <Input
                id="dataInicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                data-action="editar-data-inicio-comissao"
              />
            </div>
            <div>
              <Label htmlFor="dataFim">Data Fim</Label>
              <Input
                id="dataFim"
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                data-action="editar-data-fim-comissao"
              />
            </div>
          </div>
        )}

        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4 space-y-3">
            <h4 className="font-semibold text-slate-900">Estimativa de cálculo</h4>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Pedidos disponíveis:</span>
              <span className="font-bold text-lg text-sky-700">{pedidosDisponiveis.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Vendedores únicos:</span>
              <span className="font-bold text-lg text-sky-700">{vendedoresUnicos.length}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-sm text-slate-600">Total em vendas:</span>
              <span className="font-bold text-lg text-sky-800">
                R$ {totalVendasDisponiveis.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Comissões estimadas ({PERCENTUAL_PADRAO}%):</span>
              <span className="font-bold text-xl text-sky-900">
                R$ {(totalVendasDisponiveis * (PERCENTUAL_PADRAO / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-sky-50 border-sky-200">
          <CardContent className="p-4">
            <h4 className="font-semibold mb-2 text-sky-900">O sistema irá:</h4>
            <ul className="text-sm text-sky-800 space-y-1">
              <li>• Filtrar pedidos aprovados/faturados no período e no escopo grupo/empresa</li>
              <li>• Agrupar por vendedor</li>
              <li>• Calcular comissão de {PERCENTUAL_PADRAO}% sobre o total</li>
              <li>• Criar registros pendentes com group_id/empresa_id e auditoria</li>
            </ul>
          </CardContent>
        </Card>

        {breakdownVendedores.length > 0 && (
          <Card className="bg-sky-50/80 border-sky-200">
            <CardContent className="p-4">
              <h4 className="font-bold text-sky-900 mb-3">Breakdown por vendedor</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {breakdownVendedores.map((v) => (
                  <div key={v.vendedor} className="bg-white p-3 rounded-lg border border-sky-100">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold text-slate-900">{v.vendedor}</span>
                      <Badge className="bg-sky-600">{v.qtdPedidos} pedidos</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-slate-500">Total vendas:</span>
                        <span className="font-bold text-sky-800 ml-2">
                          R$ {v.totalVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Comissão:</span>
                        <span className="font-bold text-sky-900 ml-2">
                          R$ {v.comissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {Object.keys(statusCount).length > 0 && (
          <Card className="bg-sky-50 border-sky-200">
            <CardContent className="p-4">
              <h4 className="font-bold text-sky-900 mb-3">Status dos pedidos incluídos</h4>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(statusCount).map(([status, count]) => (
                  <div key={status} className="bg-white p-2 rounded-lg border border-sky-100 text-center">
                    <div className="text-2xl font-bold text-sky-700">{count}</div>
                    <div className="text-xs text-slate-500">{status}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {pedidosDisponiveis.length > 0 && (
          <Card className="bg-sky-50 border-sky-200">
            <CardContent className="p-4">
              <h4 className="font-bold text-sky-900 mb-3">Últimos pedidos a calcular</h4>
              <div className="space-y-1 max-h-48 overflow-y-auto text-xs">
                {pedidosDisponiveis.slice(0, 10).map((p) => (
                  <div key={p.id || p.numero_pedido} className="bg-white p-2 rounded border border-sky-100 flex justify-between items-center">
                    <div className="flex gap-2 items-center">
                      <span className="font-mono font-semibold text-sky-700">#{p.numero_pedido}</span>
                      <span className="text-slate-600">{p.cliente_nome}</span>
                      <Badge variant="outline" className="text-xs">{p.status}</Badge>
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="text-slate-500">{p.vendedor}</span>
                      <span className="font-bold text-sky-800">
                        R$ {toNumber(p.valor_total, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))}
                {pedidosDisponiveis.length > 10 && (
                  <div className="text-center text-slate-500 pt-2">
                    ... e mais {pedidosDisponiveis.length - 10} pedidos
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel} data-action="cancelar-calculo-comissao">
          Cancelar
        </Button>
        <Button
          onClick={handleCalcularComissoes}
          className="bg-sky-600 hover:bg-sky-700"
          disabled={!podeSubmit}
          data-action="calcular-comissoes-agora"
          data-permission="Comercial.Comissao.calcular"
          data-context-required="true"
          data-sensitive="true"
        >
          <Calculator className="w-4 h-4 mr-2" />
          {saving ? 'Calculando…' : 'Calcular Comissões Agora'}
        </Button>
      </div>
    </div>
  );
}
