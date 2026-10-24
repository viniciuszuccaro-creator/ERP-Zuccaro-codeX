import React, { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap, Upload, CheckCircle, AlertTriangle, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";
import ExtratoBancarioImportDialog from './ExtratoBancarioImportDialog';
import {
  buildFinanceiroQueryScopeKey,
  cancelFinanceiroQueriesOnScopeSwitch,
} from "@/components/financeiro/financeiroLaunchpadAccess";

export default function ConciliacaoBancariaTab() {
  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { user } = useUser();
  const [periodo, setPeriodo] = useState({
    inicio: new Date(new Date().setDate(1)).toISOString().split('T')[0],
    fim: new Date().toISOString().split('T')[0]
  });
  const [contaSelecionadaId, setContaSelecionadaId] = useState("");
  const [sourceOpen,setSourceOpen]=useState(false);
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const sourceScope=typeof groupId==='string'&&typeof empresaId==='string'&&typeof user?.id==='string'
    ?{groupId,empresaId,actorId:user.id}:null;
  const podeLerFonte=hasPermission('Financeiro','ContaBancariaEmpresa','visualizar')
    &&hasPermission('Financeiro','ContaBancariaEmpresa','dados-sensiveis.visualizar')
    &&hasPermission('Financeiro','conciliacao','visualizar')
    &&hasPermission('Financeiro','conciliacao','dados-sensiveis.visualizar');
  const podeImportarFonte=hasPermission('Financeiro','conciliacao','importar');
  const podeLerMovimentos=podeLerFonte&&hasPermission('Financeiro','Caixa','visualizar')
    &&hasPermission('Financeiro','Caixa','dados-sensiveis.visualizar');
  const podeVincularFonte=podeLerMovimentos&&hasPermission('Financeiro','conciliacao','conciliar');
  const podeDesfazerVinculo=podeLerMovimentos&&hasPermission('Financeiro','conciliacao','estornar');
  const contextKey = buildFinanceiroQueryScopeKey({ groupId, empresaId });
  const contextoValido = contextKey !== "sem-contexto";
  const previousScopeRef = useRef(contextKey);
  useEffect(() => {
    if (previousScopeRef.current === contextKey) return;
    const previousScopeKey = previousScopeRef.current;
    previousScopeRef.current = contextKey;
    cancelFinanceiroQueriesOnScopeSwitch(queryClient, previousScopeKey);
    setContaSelecionadaId("");
    setSourceOpen(false);
  }, [contextKey, queryClient]);
  const podeConciliar = hasPermission('Financeiro', 'ConciliacaoBancaria', 'conciliar')
    || hasPermission('Financeiro', 'Conciliação Bancária', 'conciliar')
    || hasPermission('Financeiro', 'Conciliacao', 'conciliar')
    || hasPermission('Financeiro', 'ContaReceber', 'conciliar');
  const controlesBloqueados = !contextoValido || !podeConciliar;



  const { data: conciliacoes = [], isLoading } = useQuery({
    queryKey: ["conciliacao-bancaria", contextKey],
    queryFn: () => filterInContext('ConciliacaoBancaria', {}, '-data_conciliacao', 100),
    enabled: contextoValido,
  });

  const { data: contas = [] } = useQuery({
    queryKey: ["conta-bancaria-empresa", contextKey],
    queryFn: () => filterInContext('ContaBancariaEmpresa', {}, 'banco', 100),
    enabled: contextoValido,
  });

  const podeAnalisarFonte = podeLerMovimentos && hasPermission('IA','financeiro_conciliacao','visualizar');
  const controlesDesabilitados = controlesBloqueados;

  if (isLoading) return <div className="p-6">Carregando conciliações...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Nova Conciliação Bancária</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Conta Bancária</Label>
              <select
                className="w-full px-3 py-2 border rounded-lg"
                value={contaSelecionadaId}
                onChange={(e) => setContaSelecionadaId(e.target.value)}
                disabled={controlesDesabilitados}
              >
                <option value="">Selecione...</option>
                {contas.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.banco} - {c.agencia}/{c.conta}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>Período Início</Label>
              <Input
                type="date"
                value={periodo.inicio}
                onChange={(e) => setPeriodo({ ...periodo, inicio: e.target.value })}
                disabled={controlesDesabilitados}
              />
            </div>

            <div>
              <Label>Período Fim</Label>
              <Input
                type="date"
                value={periodo.fim}
                onChange={(e) => setPeriodo({ ...periodo, fim: e.target.value })}
                disabled={controlesDesabilitados}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button 
              onClick={() => setSourceOpen(true)}
              disabled={!sourceScope || !podeAnalisarFonte}
              data-action="ConciliacaoBancaria.gerar_ia"
              data-permission="IA.financeiro_conciliacao.visualizar"
              data-context-required="true"
              data-sensitive
            >
              <Zap className="w-4 h-4 mr-2" />
              Gerar Conciliação com IA
            </Button>

            <Button variant="outline" onClick={()=>setSourceOpen(true)} disabled={!sourceScope||!podeLerFonte} data-action="ConciliacaoBancaria.importar_ofx" data-permission="Financeiro.conciliacao.importar" data-context-required="true" data-sensitive>
              <Upload className="w-4 h-4 mr-2" />
              Importar Extrato OFX
            </Button>
          </div>
        </CardContent>
      </Card>

      {sourceOpen&&sourceScope&&podeLerFonte&&<ExtratoBancarioImportDialog
        key={`${sourceScope.actorId}:${sourceScope.groupId}:${sourceScope.empresaId}`}
        scope={sourceScope} canImport={podeImportarFonte} canReadMovements={podeLerMovimentos}
        canReconcile={podeVincularFonte} canReverseLink={podeDesfazerVinculo} canAnalyze={podeAnalisarFonte} onClose={()=>setSourceOpen(false)}/>}

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Conciliações</p>
                <p className="text-2xl font-bold">{conciliacoes.length}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Totalmente Conciliadas</p>
                <p className="text-2xl font-bold text-green-600">
                  {conciliacoes.filter(c => c.status === "Conciliada Totalmente").length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Com Divergências</p>
                <p className="text-2xl font-bold text-red-600">
                  {conciliacoes.filter(c => c.status === "Com Divergências").length}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Conciliações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-3 text-sm font-semibold">Data</th>
                  <th className="text-left p-3 text-sm font-semibold">Período</th>
                  <th className="text-left p-3 text-sm font-semibold">Conta</th>
                  <th className="text-right p-3 text-sm font-semibold">Saldo Extrato</th>
                  <th className="text-right p-3 text-sm font-semibold">Saldo Sistema</th>
                  <th className="text-right p-3 text-sm font-semibold">Divergência</th>
                  <th className="text-left p-3 text-sm font-semibold">Status</th>
                  <th className="text-center p-3 text-sm font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {conciliacoes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center p-6 text-slate-500">
                      Nenhuma conciliação encontrada
                    </td>
                  </tr>
                ) : (
                  conciliacoes.map((conc) => (
                    <tr key={conc.id} className="border-b hover:bg-slate-50">
                      <td className="p-3 text-sm">
                        {new Date(conc.data_conciliacao).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="p-3 text-sm">
                        {new Date(conc.periodo_inicio).toLocaleDateString('pt-BR')} até{' '}
                        {new Date(conc.periodo_fim).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="p-3 text-sm">{conc.conta_bancaria_id}</td>
                      <td className="p-3 text-sm text-right">
                        R$ {(conc.saldo_final_extrato || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-sm text-right">
                        R$ {(conc.saldo_final_sistema || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-sm text-right font-semibold">
                        <span className={conc.divergencia_total !== 0 ? "text-red-600" : "text-green-600"}>
                          R$ {Math.abs(conc.divergencia_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="p-3">
                        <Badge 
                          className={
                            conc.status === "Conciliada Totalmente" ? "bg-green-100 text-green-800" :
                            conc.status === "Com Divergências" ? "bg-red-100 text-red-800" :
                            "bg-yellow-100 text-yellow-800"
                          }
                        >
                          {conc.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <Button size="sm" variant="outline">
                          Detalhes
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
