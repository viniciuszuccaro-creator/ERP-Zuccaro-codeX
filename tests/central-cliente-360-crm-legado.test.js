import assert from 'node:assert/strict';
import test from 'node:test';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { readFile } from 'node:fs/promises';
import { formatCentral360Money } from '../src/components/comercial/centralCliente360Money.js';
import {
  CRM_CANONICAL_HTTP_PENDING,
  centralCrmLegadoQueryKey,
  loadCentralCrmLegado,
  filterOportunidadesDoCliente,
  resumirOportunidadeCrm,
  shouldUseCrmLegadoAdapter,
} from '../src/components/comercial/centralCliente360CrmLegado.js';

test('CRM legado: resposta atrasada não cruza ator/sessão/empresa nem revogação', async () => {
  const base={clienteId:'client',groupId:'group',empresaId:'company',actorId:'actor',sessionKey:'hash-a',canView:true};
  for(const field of ['clienteId','groupId','empresaId','actorId','sessionKey','canView']) {
    const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});
    let finish;const pending=new Promise(resolve=>{finish=resolve;});
    const key=centralCrmLegadoQueryKey(base);
    const observer=new QueryObserver(client,{queryKey:key,queryFn:({signal})=>loadCentralCrmLegado({
      signal,clienteId:'client',readRows:()=>pending}),retry:false});
    const seen=[];const unsubscribe=observer.subscribe(result=>{if(result.data)seen.push(result.data);});
    const changed={...base,[field]:field==='canView'?false:'different'};
    const nextKey=centralCrmLegadoQueryKey(changed);
    assert.notDeepEqual(key,nextKey);
    observer.setOptions({queryKey:nextKey,enabled:false,retry:false});
    await client.cancelQueries({queryKey:key,exact:true});
    finish([{id:'old',cliente_id:'client',titulo:'obsolete'}]);
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(observer.getCurrentResult().data,undefined);
    assert.deepEqual(seen,[]);
    assert.equal(client.getQueryData(key),undefined);
    const fresh=await client.fetchQuery({queryKey:nextKey,queryFn:()=>loadCentralCrmLegado({
      clienteId:'client',readRows:async()=>[{id:'fresh',cliente_id:'client',titulo:'current'}]})});
    assert.equal(fresh[0].id,'fresh');
    unsubscribe();observer.destroy();client.clear();
  }
});

test('leitura CRM cancelada antes/depois do store não projeta resultado',async()=>{
  const before=new AbortController();before.abort();let reads=0;
  await assert.rejects(loadCentralCrmLegado({clienteId:'client',signal:before.signal,readRows:async()=>{reads++;return [];}}),{name:'AbortError'});
  assert.equal(reads,0);
  const after=new AbortController();
  await assert.rejects(loadCentralCrmLegado({clienteId:'client',signal:after.signal,readRows:async()=>{
    after.abort();return [{id:'old',cliente_id:'client'}];}}),{name:'AbortError'});
});

test('shouldUseCrmLegadoAdapter só quando HTTP CRM está skipped pendente', () => {
  assert.equal(shouldUseCrmLegadoAdapter({ status: 'skipped', code: CRM_CANONICAL_HTTP_PENDING }), true);
  assert.equal(shouldUseCrmLegadoAdapter({ status: 'ok', data: [] }), false);
  assert.equal(shouldUseCrmLegadoAdapter({ status: 'forbidden' }), false);
  assert.equal(shouldUseCrmLegadoAdapter({ status: 'unavailable', code: CRM_CANONICAL_HTTP_PENDING }), false);
  assert.equal(shouldUseCrmLegadoAdapter({ status: 'skipped', code: 'CRM_CANONICAL_AUTH_DENIED' }), false);
  assert.equal(shouldUseCrmLegadoAdapter(null), false);
});

test('filterOportunidadesDoCliente isola cliente sem misturar outro id', () => {
  const rows = [
    { id: 'o1', cliente_id: 'c-a', titulo: 'A' },
    { id: 'o2', cliente_id: 'c-b', titulo: 'B' },
    { id: 'o3', clienteId: 'c-a', titulo: 'A2' },
  ];
  assert.deepEqual(filterOportunidadesDoCliente(rows, 'c-a').map((r) => r.id), ['o1', 'o3']);
  assert.deepEqual(filterOportunidadesDoCliente(rows, 'c-x'), []);
});

test('resumirOportunidadeCrm preserva id técnico e etapa', () => {
  const r = resumirOportunidadeCrm({
    id: 'opp-1',
    titulo: 'Obra X',
    etapa_funil: 'Proposta',
    valor_estimado: 1500,
    codigo_oportunidade: 'OP-9',
  });
  assert.equal(r.id, 'opp-1');
  assert.equal(r.etapa, 'Proposta');
  assert.equal(r.valor, 1500);
  assert.equal(r.codigo, 'OP-9');
});

test('CRM legado mantém valor desconhecido distinto de zero até a Central', async () => {
  const rows = [
    { id: 'ausente', cliente_id: 'c-a', valor_estimado: null },
    { id: 'vazio', cliente_id: 'c-a', valor_estimado: '' },
    { id: 'invalido', cliente_id: 'c-a', valor_estimado: 'não informado' },
    { id: 'zero', cliente_id: 'c-a', valor_estimado: 0 },
    { id: 'outro', cliente_id: 'c-b', valor_estimado: 100 },
  ];
  const result = await loadCentralCrmLegado({ clienteId: 'c-a', readRows: async () => rows });
  assert.deepEqual(result.map((row) => row.id), ['ausente', 'vazio', 'invalido', 'zero']);
  assert.deepEqual(result.map((row) => formatCentral360Money(row.valor)), [
    'Valor não informado', 'Valor não informado', 'Valor não informado', 'R$ 0,00',
  ]);
});

test('CentralCliente360Panel usa adaptador legado sem criar CRM HTTP paralelo', async () => {
  const panel = await readFile(new URL('../src/components/comercial/CentralCliente360Panel.jsx', import.meta.url), 'utf8');
  assert.match(panel, /shouldUseCrmLegadoAdapter/);
  assert.match(panel, /CrmLegadoAdapterBlock/);
  assert.match(panel, /data-crm-source="legado"/);
  assert.match(panel, /central360-crm-abrir/);
  assert.doesNotMatch(panel, /OportunidadeService|crm\/v1|createTable.*Oportunidade/);
});
