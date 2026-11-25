import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createHttpApiClient } from '@/api/httpApiClient';
import { HTTP_CONTEXT_CHANGED, readErpHttpSession } from '@/api/erpHttpSession';
import usePermissions from '@/components/lib/usePermissions';

const money = value => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const sameScope = (a, b) => a?.token === b?.token && a?.actorId === b?.actorId && a?.groupId === b?.groupId && a?.empresaId === b?.empresaId;
const blank = { centro_custo_id: '', plano_contas_id: '' };

export default function PedidoTitulosHttp({ pedido }) {
  const { hasPermission, isLoading } = usePermissions();
  const [rows, setRows] = useState(null);
  const [vinculos, setVinculos] = useState(blank);
  const [catalog, setCatalog] = useState(null);
  const [payment, setPayment] = useState({ parcela: '', valor: '' });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const active = useRef(null);
  const pending = useRef(null);
  const session = readErpHttpSession();
  const groupId = pedido.group_id || pedido.grupo_id;
  const allowed = !isLoading && session?.token && session?.empresaId === pedido.empresa_id && session?.groupId === groupId;
  const canBill = allowed && hasPermission('Comercial', 'pedidos', 'faturar');
  const canView = allowed && hasPermission('Financeiro', 'contas_receber', 'visualizar');
  const canPay = allowed && hasPermission('Financeiro', 'contas_receber', 'baixar');
  useEffect(() => {
    const clear = () => {
      active.current?.abort();
      active.current = null;
      pending.current = null;
      setRows(null);
      setCatalog(null);
      setVinculos(blank);
      setPayment({ parcela: '', valor: '' });
      setBusy(false);
      setMessage('');
    };
    clear();
    window.addEventListener(HTTP_CONTEXT_CHANGED, clear);
    return () => { window.removeEventListener(HTTP_CONTEXT_CHANGED, clear); active.current?.abort(); active.current = null; };
  }, [pedido.id, groupId, pedido.empresa_id, session?.token, session?.actorId, session?.groupId, session?.empresaId]);

  const run = async (execute, accept) => {
    if (!allowed || active.current || !sameScope(session, readErpHttpSession())) return;
    const controller = new AbortController();
    active.current = controller;
    const api = createHttpApiClient({ getScope: () => session }).pedidos;
    setBusy(true);
    setMessage('');
    try {
      const result = await execute(api, { signal: controller.signal });
      if (!controller.signal.aborted && sameScope(session, readErpHttpSession())) accept(result);
    } catch (error) {
      if (!controller.signal.aborted && sameScope(session, readErpHttpSession())) {
        if (error?.code === 'TITULO_NAO_ENCONTRADO') setRows([]);
        else setMessage(error?.status === 403 ? 'Operação não autorizada.' : 'Operação financeira indisponível ou recusada.');
      }
    } finally {
      if (active.current === controller) { active.current = null; setBusy(false); }
    }
  };
  const loadCatalog = () => run((api, options) => api.vinculosContabeis(pedido.id, options),
    result => setCatalog([result.centros, result.planos]));
  const settle = () => {
    const valor = payment.valor.trim().replace(',', '.');
    if (!/^(?:0|[1-9]\d{0,13})\.\d{2}$/.test(valor) || valor === '0.00') {
      setMessage('Informe um valor positivo com duas casas decimais.');
      return;
    }
    const parcela = Number(payment.parcela);
    if (!rows?.some(row => row.parcela === parcela && row.saldo !== '0.00')) return;
    const key = JSON.stringify([parcela, valor]);
    if (pending.current?.key !== key) pending.current = { key, evento: crypto.randomUUID() };
    run((api, options) => api.baixarTitulo(pedido.id, { parcela, valor, evento: pending.current.evento }, options), result => {
      pending.current = null;
      setPayment({ parcela: '', valor: '' });
      setRows(result.titulos);
    });
  };
  return <section className="space-y-3 border-b pb-4" aria-label="Títulos do pedido">
    <div className="flex flex-wrap items-center gap-2">
      <h3 className="mr-auto font-semibold">Títulos do pedido</h3>
      {canView && <Button type="button" variant="outline" disabled={busy} onClick={() => run((api, options) => api.titulos(pedido.id, options), setRows)}>Consultar títulos</Button>}
      {canBill && !rows?.length && <Button type="button" variant="outline" disabled={busy} onClick={loadCatalog}>Selecionar vínculos</Button>}
    </div>
    {canBill && catalog && !rows?.length && <div className="flex flex-wrap items-end gap-2">
      {[['centro_custo_id', 'Centro de custo'], ['plano_contas_id', 'Plano de contas']].map(([key, label], index) =>
        <label key={key} className="grid gap-1 text-sm">{label}
          <select className="rounded border p-2" value={vinculos[key]} disabled={busy} onChange={e => setVinculos({ ...vinculos, [key]: e.target.value })}>
            <option value="">Selecione</option>
            {catalog[index].map(row => <option key={row.id} value={row.id}>{row.descricao || row.nome || row.codigo}</option>)}
          </select>
        </label>)}
      <Button type="button" disabled={busy || !vinculos.centro_custo_id || !vinculos.plano_contas_id}
        onClick={() => run((api, options) => api.faturar(pedido.id, vinculos, options), result => setRows(result.titulos))}>Gerar títulos</Button>
    </div>}
    {canView && rows && (rows.length ? <table className="w-full text-left text-sm">
      <thead><tr><th>Parcela</th><th>Vencimento</th><th>Valor</th><th>Recebido</th><th>Saldo</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.parcela}><td>{row.parcela}</td><td>{row.data_vencimento}</td><td>{money(row.valor)}</td><td>{money(row.valor_recebido)}</td><td>{money(row.saldo)}</td></tr>)}</tbody>
    </table> : <p role="status">Nenhum título encontrado.</p>)}
    {canView && canPay && rows?.some(row => row.saldo !== '0.00') && <div className="flex flex-wrap items-end gap-2">
      <label className="grid gap-1 text-sm">Parcela<select className="rounded border p-2" disabled={busy} value={payment.parcela}
        onChange={e => setPayment({ ...payment, parcela: e.target.value })}>
        <option value="">Selecione</option>
        {rows.filter(row => row.saldo !== '0.00').map(row => <option key={row.parcela} value={row.parcela}>{row.parcela}</option>)}
      </select></label>
      <label className="grid gap-1 text-sm">Valor recebido<Input inputMode="decimal" disabled={busy} value={payment.valor}
        onChange={e => setPayment({ ...payment, valor: e.target.value })} /></label>
      <Button type="button" disabled={busy || !payment.parcela || !payment.valor} onClick={settle}>Registrar baixa</Button>
    </div>}
    {message && <p role="alert">{message}</p>}
  </section>;
}
