import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertClienteEmpresaNoContexto,
  buildClienteEmpresaDisplayLabel,
  canLoadClienteEmpresasHttp,
  normalizeClienteEmpresasListPayload,
} from '../src/components/comercial/comercialClienteEmpresaHttpUiPolicy.js';

const GROUP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EMPRESA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const LINK = '11111111-1111-4111-8111-111111111111';

test('canLoadClienteEmpresasHttp fail-closed sem hasPermission', () => {
  assert.equal(canLoadClienteEmpresasHttp(undefined), false);
  assert.equal(canLoadClienteEmpresasHttp(() => false), false);
});

test('canLoadClienteEmpresasHttp libera Cadastros ou Comercial visualizar', () => {
  assert.equal(
    canLoadClienteEmpresasHttp((module, section, action) => (
      module === 'Cadastros' && section === 'cliente_empresa' && action === 'visualizar'
    )),
    true,
  );
  assert.equal(
    canLoadClienteEmpresasHttp((module, section, action) => (
      module === 'Comercial' && section === 'orcamento' && action === 'visualizar'
    )),
    true,
  );
});

test('normalizeClienteEmpresasListPayload filtra inelegíveis', () => {
  assert.deepEqual(
    normalizeClienteEmpresasListPayload({
      data: [
        { id: 'a', ativo: true, habilitado_operacao: true, bloqueado: false },
        { id: 'b', ativo: false, habilitado_operacao: true, bloqueado: false },
        { id: 'c', ativo: true, habilitado_operacao: false, bloqueado: false },
        { id: 'd', ativo: true, habilitado_operacao: true, bloqueado: true },
      ],
    }).map((row) => row.id),
    ['a'],
  );
  assert.deepEqual(
    normalizeClienteEmpresasListPayload([{ id: 'e', ativo: true, habilitado_operacao: true }]).map((r) => r.id),
    ['e'],
  );
  assert.deepEqual(normalizeClienteEmpresasListPayload(null), []);
});

test('assertClienteEmpresaNoContexto falha cross-tenant e exige escopo', () => {
  assert.throws(
    () => assertClienteEmpresaNoContexto({ id: LINK, group_id: GROUP }, {}),
    /grupo\/empresa/,
  );
  assert.throws(
    () => assertClienteEmpresaNoContexto(
      { id: LINK, group_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', empresa_id: EMPRESA },
      { groupId: GROUP, empresaId: EMPRESA },
    ),
    /grupo ativo/,
  );
  assert.throws(
    () => assertClienteEmpresaNoContexto(
      { id: LINK, group_id: GROUP, empresa_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' },
      { groupId: GROUP, empresaId: EMPRESA },
    ),
    /empresa ativa/,
  );
  const ok = assertClienteEmpresaNoContexto(
    { id: LINK, group_id: GROUP, empresa_id: EMPRESA },
    { groupId: GROUP, empresaId: EMPRESA },
  );
  assert.equal(ok.id, LINK);
});

test('buildClienteEmpresaDisplayLabel prioriza nome do Cliente', () => {
  assert.equal(
    buildClienteEmpresaDisplayLabel({ id: LINK, cliente_id: 'x' }, 'CPA Ferro'),
    'CPA Ferro',
  );
  assert.equal(
    buildClienteEmpresaDisplayLabel({ id: LINK, legacy_code: 'LEG-1' }, ''),
    'LEG-1',
  );
});
