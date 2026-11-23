import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2, Wallet, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { isHttpPedidoFinanceiroEnabled } from '@/api/base44Client';
import { createHttpApiClient, isHttpApiError } from '@/api/httpApiClient';
import { readErpHttpSession } from '@/api/erpHttpSession';
import usePermissions from '@/components/lib/usePermissions';
import {
  classifyTituloSituacao,
  formatContratoDecimal,
  buildPedidoTituloBaixaEvento,
  mapPedidoFinanceiroHttpError,
} from '@/components/lib/pedidoFaturamentoPolicy';

/**
 * Painel do contrato §7 dentro do Fechamento Financeiro existente.
 * Opt-in via VITE_ERP_HTTP_PEDIDO_FINANCEIRO=true. HML permanece desligado.
 *
 * @param {{ formData?: { id?: string, status?: string, empresa_id?: string, group_id?: string, grupo_id?: string }, onTitulosChange?: (titulos: unknown[]) => void }} props
 */
export default function FechamentoPedidoFinanceiroHttp({ formData, onTitulosChange }) {
  const { hasPermission, permissionsLoading } = usePermissions();
  const pedidoId = formData?.id ? String(formData.id) : '';
  const formEmpresaId = formData?.empresa_id ? String(formData.empresa_id) : '';
  const formGroupId = formData?.group_id || formData?.grupo_id
    ? String(formData.group_id || formData.grupo_id)
    : '';
  const canFaturar = !permissionsLoading && (
    hasPermission('Comercial', 'pedidos', 'faturar')
    || hasPermission('Comercial', 'Pedido', 'faturar')
  );
  const canVerTitulos = !permissionsLoading && (
    hasPermission('Financeiro', 'contas_receber', 'visualizar')
    || hasPermission('Financeiro', 'ContaReceber', 'visualizar')
  );
  const canBaixar = !permissionsLoading && (
    hasPermission('Financeiro', 'contas_receber', 'baixar')
    || hasPermission('Financeiro', 'ContaReceber', 'baixar')
    || hasPermission('Financeiro', 'ContaReceber', 'receber')
  );

  const [centros, setCentros] = useState(/** @type {Array<{ id: string, descricao?: string }>} */ ([]));
  const [planos, setPlanos] = useState(/** @type {Array<{ id: string, descricao?: string }>} */ ([]));
  const [centroId, setCentroId] = useState('');
  const [planoId, setPlanoId] = useState('');
  const [titulos, setTitulos] = useState(/** @type {ReadonlyArray<unknown> | unknown[]} */ ([]));
  const [loadingVinculos, setLoadingVinculos] = useState(false);
  const [loadingTitulos, setLoadingTitulos] = useState(false);
  const [faturando, setFaturando] = useState(false);
  const [baixandoParcela, setBaixandoParcela] = useState(/** @type {number | null} */ (null));
  const [aviso, setAviso] = useState('');
  const [baixaValor, setBaixaValor] = useState(/** @type {Record<number, string>} */ ({}));
  /** @type {React.MutableRefObject<Record<number, { key: string, valor: string }>>} */
  const tentativaBaixaRef = useRef({});
  const operacaoGeracaoRef = useRef(0);
  const pedidoIdRef = useRef(pedidoId);
  /** Escopo no momento da geração atual — resposta stale de outro grupo/empresa não publica. */
  const scopeAtGeracaoRef = useRef({ groupId: formGroupId || '', empresaId: formEmpresaId || '' });
  /** Abort do GET /titulos em voo — faturar/baixar não pode ser sobrescrito por 404/lista stale. */
  const titulosAbortRef = useRef(/** @type {AbortController | null} */ (null));
  /** Trava síncrona: evita dois POSTs antes do re-render (state sozinho não serializa). */
  const mutacaoLockRef = useRef(false);
  const reactId = useId();
  const onTitulosChangeRef = useRef(onTitulosChange);
  onTitulosChangeRef.current = onTitulosChange;

  const client = useMemo(() => createHttpApiClient({
    getScope: () => {
      /** @type {{ token?: string, actorId?: string, actorEmail?: string, groupId?: string, empresaId?: string }} */
      const session = readErpHttpSession() || {};
      return {
        token: session.token,
        actorId: session.actorId,
        actorEmail: session.actorEmail,
        groupId: formGroupId || session.groupId,
        empresaId: formEmpresaId || session.empresaId,
      };
    },
  }), [formEmpresaId, formGroupId]);

  const publicarTitulos = (rows, geracao) => {
    if (geracao != null && geracao !== operacaoGeracaoRef.current) return;
    if (pedidoIdRef.current !== pedidoId) return;
    // Escopo do formulário: resposta de outro grupo/empresa não publica.
    if ((formGroupId || '') !== (scopeAtGeracaoRef.current.groupId || '')
      || (formEmpresaId || '') !== (scopeAtGeracaoRef.current.empresaId || '')) {
      return;
    }
    const next = Array.isArray(rows) ? rows : [];
    setTitulos(next);
    if (typeof onTitulosChangeRef.current === 'function') onTitulosChangeRef.current(next);
  };

  /**
   * Publica títulos do POST e invalida GET em voo (nova geração).
   * @returns {boolean} false se o escopo mudou — não aborta o GET novo nem publica.
   */
  const publicarTitulosAposMutacao = (rows, scopeAtStart) => {
    const g = scopeAtStart?.groupId || '';
    const e = scopeAtStart?.empresaId || '';
    if ((scopeAtGeracaoRef.current.groupId || '') !== g
      || (scopeAtGeracaoRef.current.empresaId || '') !== e) {
      return false;
    }
    titulosAbortRef.current?.abort();
    titulosAbortRef.current = null;
    operacaoGeracaoRef.current += 1;
    setLoadingTitulos(false);
    publicarTitulos(Array.isArray(rows) ? rows : [], operacaoGeracaoRef.current);
    return true;
  };

  // Troca de pedido OU escopo grupo/empresa: invalidar geração e limpar UI (fail-closed).
  useEffect(() => {
    pedidoIdRef.current = pedidoId;
    scopeAtGeracaoRef.current = { groupId: formGroupId || '', empresaId: formEmpresaId || '' };
    operacaoGeracaoRef.current += 1;
    setCentros([]);
    setPlanos([]);
    setCentroId('');
    setPlanoId('');
    setTitulos([]);
    setBaixaValor({});
    setAviso('');
    setBaixandoParcela(null);
    setFaturando(false);
    setLoadingVinculos(false);
    setLoadingTitulos(false);
    tentativaBaixaRef.current = {};
    mutacaoLockRef.current = false;
    if (typeof onTitulosChangeRef.current === 'function') onTitulosChangeRef.current([]);
  }, [pedidoId, formGroupId, formEmpresaId]);

  useEffect(() => {
    if (!isHttpPedidoFinanceiroEnabled || !pedidoId || !canFaturar) {
      setCentros([]);
      setPlanos([]);
      return undefined;
    }
    const geracao = operacaoGeracaoRef.current;
    const scopedPedidoId = pedidoId;
    const ac = new AbortController();
    setLoadingVinculos(true);
    setAviso('');
    client.pedidos.vinculosContabeis(scopedPedidoId, { signal: ac.signal })
      .then((data) => {
        if (ac.signal.aborted || geracao !== operacaoGeracaoRef.current || pedidoIdRef.current !== scopedPedidoId) return;
        const payload = data && typeof data === 'object' ? data : {};
        const nextCentros = Array.isArray(payload.centros) ? payload.centros : [];
        const nextPlanos = Array.isArray(payload.planos) ? payload.planos : [];
        setCentros(nextCentros);
        setPlanos(nextPlanos);
        if (!nextCentros.length && !nextPlanos.length) {
          setAviso('Nenhum centro/plano retornado para esta empresa.');
        }
      })
      .catch((error) => {
        if (ac.signal.aborted || geracao !== operacaoGeracaoRef.current || pedidoIdRef.current !== scopedPedidoId) return;
        const mapped = mapPedidoFinanceiroHttpError(error);
        setCentros([]);
        setPlanos([]);
        // Só sugere contrato não publicado em 404 genérico (HTTP_ERROR), não em PEDIDO_NAO_ENCONTRADO etc.
        const unpublishedHint = mapped.code === 'HTTP_ERROR' && mapped.status === 404
          ? ' (GET /vinculos-contabeis ainda pendente no servidor — Codex.)'
          : '';
        setAviso(mapped.message + unpublishedHint);
      })
      .finally(() => {
        if (!ac.signal.aborted && geracao === operacaoGeracaoRef.current) setLoadingVinculos(false);
      });
    return () => ac.abort();
  }, [client, pedidoId, canFaturar]);

  useEffect(() => {
    if (!isHttpPedidoFinanceiroEnabled || !pedidoId || !canVerTitulos) {
      publicarTitulos([], operacaoGeracaoRef.current);
      return undefined;
    }
    const geracao = operacaoGeracaoRef.current;
    const scopedPedidoId = pedidoId;
    const ac = new AbortController();
    titulosAbortRef.current = ac;
    setLoadingTitulos(true);
    client.pedidos.titulos(scopedPedidoId, { signal: ac.signal })
      .then((rows) => {
        if (ac.signal.aborted || geracao !== operacaoGeracaoRef.current || pedidoIdRef.current !== scopedPedidoId) return;
        publicarTitulos(Array.isArray(rows) ? rows : [], geracao);
      })
      .catch((error) => {
        if (ac.signal.aborted || geracao !== operacaoGeracaoRef.current || pedidoIdRef.current !== scopedPedidoId) return;
        if (isHttpApiError(error) && error.status === 404) {
          publicarTitulos([], geracao);
          return;
        }
        const mapped = mapPedidoFinanceiroHttpError(error);
        setAviso((prev) => prev || mapped.message);
        // Fail-closed: erro de GET títulos → lista vazia (sem fixture na UI de Baixar).
        publicarTitulos([], geracao);
      })
      .finally(() => {
        if (!ac.signal.aborted && geracao === operacaoGeracaoRef.current) setLoadingTitulos(false);
      });
    return () => {
      ac.abort();
      if (titulosAbortRef.current === ac) titulosAbortRef.current = null;
    };
  }, [client, pedidoId, canVerTitulos]);

  if (!isHttpPedidoFinanceiroEnabled) return null;

  const situacaoBadge = (titulo) => {
    const sit = classifyTituloSituacao(titulo);
    if (sit === 'quitado') return <Badge className="bg-green-100 text-green-800" data-sit="quitado">Quitado</Badge>;
    if (sit === 'parcial') return <Badge className="bg-amber-100 text-amber-900" data-sit="parcial">Parcial</Badge>;
    if (sit === 'pendente') return <Badge variant="outline" data-sit="pendente">Pendente</Badge>;
    return <Badge variant="outline" className="text-slate-400" data-sit="indisponivel">—</Badge>;
  };

  const mutacaoEmCurso = faturando || baixandoParcela != null;

  const handleFaturar = async () => {
    if (!pedidoId) {
      toast.error('Salve o pedido antes de faturar.');
      return;
    }
    if (!canFaturar) {
      toast.error('Sem permissão Comercial.pedidos.faturar.');
      return;
    }
    if (mutacaoEmCurso || mutacaoLockRef.current) return;
    if (!centroId || !planoId) {
      toast.error('Selecione centro de custo e plano de contas.');
      return;
    }
    const geracao = operacaoGeracaoRef.current;
    const scopedPedidoId = pedidoId;
    const scopeAtStart = { groupId: formGroupId || '', empresaId: formEmpresaId || '' };
    mutacaoLockRef.current = true;
    setFaturando(true);
    setAviso('');
    try {
      const result = await client.pedidos.faturar(scopedPedidoId, {
        centro_custo_id: centroId,
        plano_contas_id: planoId,
      });
      // Sucesso: pedido + escopo atuais (troca grupo/empresa não aborta o GET novo).
      if (pedidoIdRef.current !== scopedPedidoId) return;
      const rows = Array.isArray(result?.titulos) ? result.titulos : [];
      if (!publicarTitulosAposMutacao(rows, scopeAtStart)) return;
      toast.success(result?.replay
        ? 'Faturamento já existente (replay).'
        : 'Títulos gerados pelo servidor.');
    } catch (error) {
      if (geracao !== operacaoGeracaoRef.current || pedidoIdRef.current !== scopedPedidoId) return;
      const mapped = mapPedidoFinanceiroHttpError(error);
      setAviso(mapped.message);
      toast.error(mapped.message);
    } finally {
      mutacaoLockRef.current = false;
      // Após mutação a geração sobe — limpar loading se o pedido ainda é o atual.
      if (pedidoIdRef.current === scopedPedidoId) setFaturando(false);
    }
  };

  const handleBaixar = async (titulo) => {
    const parcela = Number(titulo?.parcela);
    if (!Number.isInteger(parcela) || parcela < 1) {
      toast.error('Parcela inválida.');
      return;
    }
    if (!canBaixar) {
      toast.error('Sem permissão Financeiro.contas_receber.baixar.');
      return;
    }
    // Uma mutação por vez: evita POST paralelo cujo resultado seria descartado pelo bump de geração.
    if (mutacaoEmCurso || mutacaoLockRef.current) return;
    const sit = classifyTituloSituacao(titulo);
    if (sit === 'quitado') {
      toast.message('Título já quitado (saldo zero).');
      return;
    }
    const saldoStr = titulo?.saldo != null && titulo.saldo !== ''
      ? String(titulo.saldo)
      : null;
    const valorInformado = (baixaValor[parcela] || '').trim() || saldoStr || '';
    if (!/^(?:0|[1-9]\d{0,13})\.\d{2}$/.test(valorInformado) || valorInformado === '0.00') {
      toast.error('Informe valor positivo com 2 casas (ex.: 10.00).');
      return;
    }
    const pending = tentativaBaixaRef.current[parcela];
    // Mesmo evento só no retry do mesmo valor; parcial→quitação gera novo evento.
    if (!pending || pending.valor !== valorInformado) {
      tentativaBaixaRef.current[parcela] = {
        key: `${reactId.replace(/:/g, '')}.${Date.now()}`,
        valor: valorInformado,
      };
    }
    const evento = buildPedidoTituloBaixaEvento({
      pedidoId,
      parcela,
      attemptKey: tentativaBaixaRef.current[parcela].key,
    });
    const geracao = operacaoGeracaoRef.current;
    const scopedPedidoId = pedidoId;
    const scopeAtStart = { groupId: formGroupId || '', empresaId: formEmpresaId || '' };
    mutacaoLockRef.current = true;
    setBaixandoParcela(parcela);
    setAviso('');
    try {
      const result = await client.pedidos.baixarTitulo(scopedPedidoId, {
        parcela,
        evento,
        valor: valorInformado,
      });
      // Sucesso: pedido + escopo (não exigir geração; troca de escopo não aborta GET novo).
      if (pedidoIdRef.current !== scopedPedidoId) return;
      delete tentativaBaixaRef.current[parcela];
      const rows = Array.isArray(result?.titulos) ? result.titulos : [];
      if (!publicarTitulosAposMutacao(rows, scopeAtStart)) return;
      toast.success(result?.replay
        ? 'Baixa reenviada (mesmo evento — replay).'
        : 'Baixa registrada.');
      const quitados = rows.filter((row) => classifyTituloSituacao(row) === 'quitado');
      if (quitados.length && quitados.length === rows.length) {
        toast.message('Venda reaberta: saldo zero em todos os títulos.');
      }
    } catch (error) {
      if (geracao !== operacaoGeracaoRef.current || pedidoIdRef.current !== scopedPedidoId) return;
      const mapped = mapPedidoFinanceiroHttpError(error);
      // Divergência: não reutilizar o evento com outro valor na próxima tentativa.
      if (mapped.code === 'RECEBIMENTO_EVENTO_DIVERGENTE') {
        delete tentativaBaixaRef.current[parcela];
      }
      setAviso(mapped.message);
      toast.error(mapped.message);
    } finally {
      mutacaoLockRef.current = false;
      if (pedidoIdRef.current === scopedPedidoId) {
        setBaixandoParcela((cur) => (cur === parcela ? null : cur));
      }
    }
  };

  return (
    <Card className="w-full border-2 border-emerald-300 bg-emerald-50/40" data-block="pedido-financeiro-http-panel" role="region" aria-label="Faturamento e títulos do pedido">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Wallet className="w-5 h-5 text-emerald-700" />
          Faturamento e títulos (contrato HTTP)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!pedidoId && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertDescription className="text-sm text-amber-950">
              Salve o pedido para carregar vínculos e títulos.
            </AlertDescription>
          </Alert>
        )}

        {aviso ? (
          <Alert className="border-amber-300 bg-amber-50" data-block="pedido-financeiro-http-aviso">
            <AlertTriangle className="w-4 h-4 text-amber-700" />
            <AlertDescription className="text-sm text-amber-950 ml-6">{aviso}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="pf-centro">Centro de custo</Label>
            <Select value={centroId || undefined} onValueChange={setCentroId} disabled={!canFaturar || loadingVinculos || !centros.length}>
              <SelectTrigger id="pf-centro" data-action="Comercial.pedidos.faturar.centro">
                <SelectValue placeholder={loadingVinculos ? 'Carregando…' : (centros.length ? 'Selecione' : 'Indisponível')} />
              </SelectTrigger>
              <SelectContent>
                {centros.map((c) => (
                  <SelectItem key={String(c.id)} value={String(c.id)}>{c.descricao || c.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="pf-plano">Plano de contas</Label>
            <Select value={planoId || undefined} onValueChange={setPlanoId} disabled={!canFaturar || loadingVinculos || !planos.length}>
              <SelectTrigger id="pf-plano" data-action="Comercial.pedidos.faturar.plano">
                <SelectValue placeholder={loadingVinculos ? 'Carregando…' : (planos.length ? 'Selecione' : 'Indisponível')} />
              </SelectTrigger>
              <SelectContent>
                {planos.map((p) => (
                  <SelectItem key={String(p.id)} value={String(p.id)}>{p.descricao || p.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          type="button"
          className="w-full bg-emerald-700 hover:bg-emerald-800"
          disabled={!canFaturar || !pedidoId || !centroId || !planoId || mutacaoEmCurso}
          onClick={handleFaturar}
          data-action="Comercial.pedidos.faturar"
          data-permission="Comercial.pedidos.faturar"
          data-context-required="true"
          data-sensitive="true"
        >
          {faturando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wallet className="w-4 h-4 mr-2" />}
          Gerar títulos (servidor calcula parcelas)
        </Button>

        <div className="space-y-2" data-block="pedido-financeiro-titulos">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-emerald-950">Títulos do pedido</p>
            {loadingTitulos ? <Loader2 className="w-4 h-4 animate-spin text-emerald-700" /> : null}
          </div>
          {!loadingTitulos && !titulos.length ? (
            <p className="text-xs text-slate-600">Nenhum título. Fature o pedido ou aguarde publicação HML.</p>
          ) : null}
          <ul className="space-y-2">
            {titulos.map((titulo) => {
              const parcela = Number(titulo?.parcela);
              const sit = classifyTituloSituacao(titulo);
              return (
                <li
                  key={`parcela-${parcela}`}
                  className="rounded-lg border border-emerald-200 bg-white p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                  data-parcela={parcela}
                  data-situacao={sit}
                >
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">Parcela {parcela}</span>
                      {situacaoBadge(titulo)}
                      {sit === 'quitado' ? <CheckCircle className="w-4 h-4 text-green-600" aria-hidden /> : null}
                    </div>
                    <p className="text-xs text-slate-600">
                      Venc. {titulo?.data_vencimento
                        ? new Date(String(titulo.data_vencimento) + 'T12:00:00').toLocaleDateString('pt-BR')
                        : '—'}
                      {' · '}Valor R$ {formatContratoDecimal(titulo?.valor)}
                      {' · '}Recebido R$ {formatContratoDecimal(titulo?.valor_recebido)}
                      {' · '}Saldo R$ {formatContratoDecimal(titulo?.saldo)}
                    </p>
                  </div>
                  {sit !== 'quitado' && sit !== 'indisponivel' ? (
                    <div className="flex items-center gap-2">
                      <Input
                        className="w-28 h-8 text-sm"
                        inputMode="decimal"
                        placeholder={String(titulo?.saldo || '0.00')}
                        value={baixaValor[parcela] || ''}
                        onChange={(e) => setBaixaValor((prev) => ({ ...prev, [parcela]: e.target.value.replace(/[^0-9.]/g, '') }))}
                        aria-label={`Valor da baixa parcela ${parcela}`}
                        disabled={!canBaixar || mutacaoEmCurso}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!canBaixar || mutacaoEmCurso}
                        onClick={() => handleBaixar(titulo)}
                        data-action="Financeiro.contas_receber.baixar"
                        data-permission="Financeiro.contas_receber.baixar"
                        data-sensitive="true"
                      >
                        {baixandoParcela === parcela ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Baixar'}
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
