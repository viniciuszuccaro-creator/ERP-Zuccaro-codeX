import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { CheckCircle, Link as LinkIcon, Search } from "lucide-react";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { readErpHttpSession } from "@/api/erpHttpSession";
import { central360SessionKey } from "@/api/httpApiClient";
import {
  resolvePainelConciliacaoKpiState,
  isPainelConciliacaoScopeCurrent,
  assertPainelConciliacaoEmpresaMatch,
  buildPainelConciliacaoTituloUpdate,
  buildPainelConciliacaoExtratoUpdate,
} from "./painelConciliacaoScope";

export default function PainelConciliacao({ empresaId, windowMode = false }) {
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, filterInContext, updateInContext } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const resolvedEmpresaId = empresaAtual?.id || null;
  let effectiveEmpresaId = null;
  let empresaMismatch = false;
  let scopeBlocked = false;
  try {
    effectiveEmpresaId = assertPainelConciliacaoEmpresaMatch(empresaId, resolvedEmpresaId);
  } catch (err) {
    if (err?.code === 'PAINEL_CONCILIACAO_EMPRESA_MISMATCH') empresaMismatch = true;
    else scopeBlocked = true;
  }
  const contextoValido = Boolean(effectiveEmpresaId) && !empresaMismatch && !scopeBlocked;

  const sessionSnapshot = readErpHttpSession();
  const actorId = typeof sessionSnapshot?.actorId === "string" && sessionSnapshot.actorId.trim()
    ? sessionSnapshot.actorId.trim()
    : null;
  const sessionKey = central360SessionKey(sessionSnapshot?.token);
  const scopeExpected = { actorId, sessionKey };
  const readActorAndSession = () => {
    const session = readErpHttpSession();
    const nextActor = typeof session?.actorId === "string" && session.actorId.trim()
      ? session.actorId.trim()
      : null;
    return { actorId: nextActor, sessionKey: central360SessionKey(session?.token) };
  };

  const extratosQuery = useQuery({
    queryKey: ['extratos', groupId, effectiveEmpresaId, actorId, sessionKey],
    queryFn: async ({ signal }) => {
      const rows = await filterInContext('ExtratoBancario', { empresa_id: effectiveEmpresaId }, '-data_movimento');
      if (signal?.aborted) {
        const err = new Error('PAINEL_CONCILIACAO_ABORTED');
        err.name = 'AbortError';
        throw err;
      }
      if (!isPainelConciliacaoScopeCurrent(scopeExpected, readActorAndSession())) {
        throw new Error('PAINEL_CONCILIACAO_EXTRATOS_STALE_SCOPE');
      }
      return rows;
    },
    enabled: contextoValido,
  });

  const receberQuery = useQuery({
    queryKey: ['contas-receber', groupId, effectiveEmpresaId, actorId, sessionKey],
    queryFn: async ({ signal }) => {
      const rows = await filterInContext('ContaReceber', { empresa_id: effectiveEmpresaId }, '-data_vencimento');
      if (signal?.aborted) {
        const err = new Error('PAINEL_CONCILIACAO_ABORTED');
        err.name = 'AbortError';
        throw err;
      }
      if (!isPainelConciliacaoScopeCurrent(scopeExpected, readActorAndSession())) {
        throw new Error('PAINEL_CONCILIACAO_RECEBER_STALE_SCOPE');
      }
      return rows;
    },
    enabled: contextoValido,
  });

  const pagarQuery = useQuery({
    queryKey: ['contas-pagar', groupId, effectiveEmpresaId, actorId, sessionKey],
    queryFn: async ({ signal }) => {
      const rows = await filterInContext('ContaPagar', { empresa_id: effectiveEmpresaId }, '-data_vencimento');
      if (signal?.aborted) {
        const err = new Error('PAINEL_CONCILIACAO_ABORTED');
        err.name = 'AbortError';
        throw err;
      }
      if (!isPainelConciliacaoScopeCurrent(scopeExpected, readActorAndSession())) {
        throw new Error('PAINEL_CONCILIACAO_PAGAR_STALE_SCOPE');
      }
      return rows;
    },
    enabled: contextoValido,
  });

  const extratosKpi = resolvePainelConciliacaoKpiState({
    contextoValido,
    isLoading: extratosQuery.isLoading,
    isError: extratosQuery.isError || empresaMismatch || scopeBlocked,
    isFetching: extratosQuery.isFetching,
    dataDefined: extratosQuery.data !== undefined,
  });
  const receberKpi = resolvePainelConciliacaoKpiState({
    contextoValido,
    isLoading: receberQuery.isLoading,
    isError: receberQuery.isError || empresaMismatch || scopeBlocked,
    isFetching: receberQuery.isFetching,
    dataDefined: receberQuery.data !== undefined,
  });
  const pagarKpi = resolvePainelConciliacaoKpiState({
    contextoValido,
    isLoading: pagarQuery.isLoading,
    isError: pagarQuery.isError || empresaMismatch || scopeBlocked,
    isFetching: pagarQuery.isFetching,
    dataDefined: pagarQuery.data !== undefined,
  });

  const listaKpi = [extratosKpi, receberKpi, pagarKpi].includes('error')
    ? 'error'
    : [extratosKpi, receberKpi, pagarKpi].includes('unavailable')
      ? 'unavailable'
      : [extratosKpi, receberKpi, pagarKpi].includes('loading')
        ? 'loading'
        : extratosKpi === 'ready' && receberKpi === 'ready' && pagarKpi === 'ready'
          ? 'ready'
          : 'loading';

  const extratos = listaKpi === 'ready' && Array.isArray(extratosQuery.data) ? extratosQuery.data : [];
  const contasReceber = listaKpi === 'ready' && Array.isArray(receberQuery.data) ? receberQuery.data : [];
  const contasPagar = listaKpi === 'ready' && Array.isArray(pagarQuery.data) ? pagarQuery.data : [];

  const conciliarMutation = useMutation({
    mutationFn: async ({ extratoId, tituloId, tipo }) => {
      assertPainelConciliacaoEmpresaMatch(empresaId, resolvedEmpresaId);
      const scopeAtStart = readActorAndSession();
      const extrato = extratos.find(e => e.id === extratoId);
      if (!extrato) {
        throw Object.assign(new Error('PAINEL_CONCILIACAO_EXTRATO_NOT_FOUND'), {
          code: 'PAINEL_CONCILIACAO_EXTRATO_NOT_FOUND',
        });
      }

      await updateInContext('ExtratoBancario', extratoId, buildPainelConciliacaoExtratoUpdate(tipo, tituloId));
      const tituloEntity = tipo === 'receber' ? 'ContaReceber' : 'ContaPagar';
      await updateInContext(tituloEntity, tituloId, buildPainelConciliacaoTituloUpdate(tipo, extrato));

      if (!isPainelConciliacaoScopeCurrent(scopeAtStart, readActorAndSession())) {
        throw Object.assign(new Error('PAINEL_CONCILIACAO_MUTATE_STALE_SCOPE'), {
          code: 'PAINEL_CONCILIACAO_MUTATE_STALE_SCOPE',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extratos', groupId, effectiveEmpresaId] });
      queryClient.invalidateQueries({ queryKey: ['contas-receber', groupId, effectiveEmpresaId] });
      queryClient.invalidateQueries({ queryKey: ['contas-pagar', groupId, effectiveEmpresaId] });
      toast({ title: "✅ Conciliação realizada!" });
    },
  });

  const conciliarAutomaticoMutation = useMutation({
    mutationFn: async () => {
      assertPainelConciliacaoEmpresaMatch(empresaId, resolvedEmpresaId);
      let conciliados = 0;

      for (const extrato of extratos.filter(e => !e.conciliado)) {
        const toleranciaDias = 3;
        const dataExtrato = new Date(extrato.data_movimento);

        let tituloMatch = null;
        let tipoMatch = null;

        if (extrato.tipo === 'credito') {
          tituloMatch = contasReceber.find(t => {
            const dataTitulo = new Date(t.data_vencimento);
            const diffDias = Math.abs((dataExtrato - dataTitulo) / (1000 * 60 * 60 * 24));
            return t.status === 'Pendente' &&
                   Math.abs(t.valor - extrato.valor) < 0.01 &&
                   diffDias <= toleranciaDias;
          });
          tipoMatch = 'receber';
        } else {
          tituloMatch = contasPagar.find(t => {
            const dataTitulo = new Date(t.data_vencimento);
            const diffDias = Math.abs((dataExtrato - dataTitulo) / (1000 * 60 * 60 * 24));
            return t.status === 'Pendente' &&
                   Math.abs(t.valor - extrato.valor) < 0.01 &&
                   diffDias <= toleranciaDias;
          });
          tipoMatch = 'pagar';
        }

        if (tituloMatch) {
          await conciliarMutation.mutateAsync({
            extratoId: extrato.id,
            tituloId: tituloMatch.id,
            tipo: tipoMatch
          });
          conciliados++;
        }
      }

      return conciliados;
    },
    onSuccess: (conciliados) => {
      toast({
        title: "✅ Conciliação Automática Concluída!",
        description: `${conciliados} movimento(s) conciliado(s) automaticamente.`
      });
    },
  });

  const extratosFiltrados = extratos.filter(e =>
    e.historico?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.documento?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const extratosPendentes = listaKpi === 'ready' ? extratosFiltrados.filter(e => !e.conciliado) : [];
  const extratosConciliados = listaKpi === 'ready' ? extratosFiltrados.filter(e => e.conciliado) : [];

  return (
    <div className={windowMode ? "w-full h-full flex flex-col overflow-auto" : "space-y-6"}>
      <div className={windowMode ? "p-6 space-y-6 flex-1" : "space-y-6"}>
      {/* Header com Ações */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Conciliação Bancária</h2>
          {listaKpi === 'ready' ? (
            <p className="text-sm text-slate-600">
              {extratosPendentes.length} movimentos pendentes • {extratosConciliados.length} conciliados
            </p>
          ) : listaKpi === 'loading' ? (
            <p className="text-sm text-slate-500 animate-pulse">Carregando movimentos…</p>
          ) : listaKpi === 'error' || empresaMismatch ? (
            <p className="text-sm text-red-600">Erro ≠ 0 pendentes / tudo conciliado</p>
          ) : (
            <p className="text-sm text-amber-700">Selecione a Empresa para conciliar.</p>
          )}
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => conciliarAutomaticoMutation.mutate()}
            disabled={listaKpi !== 'ready' || conciliarAutomaticoMutation.isPending || extratosPendentes.length === 0}
            className="bg-green-600 hover:bg-green-700"
          >
            {conciliarAutomaticoMutation.isPending ? 'Conciliando...' : '🤖 Conciliar Automaticamente'}
          </Button>
        </div>
      </div>

      {/* Busca */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <Input
              placeholder="Buscar por histórico ou documento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              disabled={listaKpi !== 'ready'}
            />
          </div>
        </CardContent>
      </Card>

      {/* Movimentos Pendentes */}
      <Card className="border-0 shadow-md">
        <CardHeader className="bg-yellow-50 border-b">
          <CardTitle className="text-base">Movimentos Pendentes de Conciliação</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {listaKpi === 'loading' && (
            <div className="text-center py-12 text-slate-500 animate-pulse">Carregando…</div>
          )}
          {listaKpi === 'error' && (
            <div className="text-center py-12 text-red-600">Erro ≠ lista vazia / tudo conciliado</div>
          )}
          {listaKpi === 'unavailable' && (
            <div className="text-center py-12 text-amber-700">Contexto de Empresa necessário</div>
          )}
          {listaKpi === 'ready' && (
          <>
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Data</TableHead>
                <TableHead>Histórico</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Sugestões</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {extratosPendentes.map(extrato => {
                const sugestoes = extrato.tipo === 'credito'
                  ? contasReceber.filter(t =>
                      t.status === 'Pendente' &&
                      Math.abs(t.valor - extrato.valor) < 0.01
                    ).slice(0, 3)
                  : contasPagar.filter(t =>
                      t.status === 'Pendente' &&
                      Math.abs(t.valor - extrato.valor) < 0.01
                    ).slice(0, 3);

                return (
                  <TableRow key={extrato.id} className="hover:bg-slate-50">
                    <TableCell className="text-sm">
                      {new Date(extrato.data_movimento).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-sm">{extrato.historico}</TableCell>
                    <TableCell className="text-sm">{extrato.documento || '-'}</TableCell>
                    <TableCell>
                      <Badge className={extrato.tipo === 'credito' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                        {extrato.tipo === 'credito' ? 'Crédito' : 'Débito'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      R$ {extrato.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      {sugestoes.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {sugestoes.map(sug => (
                            <Button
                              key={sug.id}
                              size="sm"
                              variant="outline"
                              className="text-xs justify-start"
                              onClick={() => conciliarMutation.mutate({
                                extratoId: extrato.id,
                                tituloId: sug.id,
                                tipo: extrato.tipo === 'credito' ? 'receber' : 'pagar'
                              })}
                              disabled={conciliarMutation.isPending}
                            >
                              <LinkIcon className="w-3 h-3 mr-1" />
                              {sug.descricao} - R$ {sug.valor.toFixed(2)}
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">Nenhuma sugestão</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {sugestoes.length === 0 && (
                        <Button size="sm" variant="ghost" disabled>
                          Manual
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {extratosPendentes.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 opacity-30 text-green-500" />
              <p className="font-semibold">Tudo conciliado!</p>
              <p className="text-sm mt-2">Não há movimentos pendentes de conciliação</p>
            </div>
          )}
          </>
          )}
        </CardContent>
      </Card>

      {/* Movimentos Conciliados */}
      {listaKpi === 'ready' && extratosConciliados.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardHeader className="bg-green-50 border-b">
            <CardTitle className="text-base">Movimentos Conciliados</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Data</TableHead>
                  <TableHead>Histórico</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Conciliado com</TableHead>
                  <TableHead>Data Conciliação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {extratosConciliados.slice(0, 10).map(extrato => (
                  <TableRow key={extrato.id}>
                    <TableCell className="text-sm">
                      {new Date(extrato.data_movimento).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-sm">{extrato.historico}</TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-700">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Conciliado
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      R$ {extrato.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-sm">
                      {extrato.conciliado_com_tipo || '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {extrato.data_conciliacao ? new Date(extrato.data_conciliacao).toLocaleDateString('pt-BR') : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div></div>
  );
}
