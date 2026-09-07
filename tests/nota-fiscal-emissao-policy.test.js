import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  applyNumeroNfeOnCreate,
  assertEmissaoNFe,
  assertNotaFiscalOnDelete,
  resolveNextNumeroNfe,
} from '../src/components/lib/notaFiscalEmissaoPolicy.js';

test('production emit without explicit authorization is blocked', () => {
  assert.throws(
    () => assertEmissaoNFe({
      empresaId: 'cpa-aco',
      ambiente: 'Producao',
      producaoAutorizada: false,
      provedorConfigurado: true,
      nfe: { cfop: '5102' },
    }),
    /autorizacao explicita/,
  );
});

test('production emit without fiscal provider is blocked even when authorized', () => {
  assert.throws(
    () => assertEmissaoNFe({
      empresaId: 'cpa-aco',
      ambiente: 'Producao',
      producaoAutorizada: true,
      provedorConfigurado: false,
      nfe: { cfop: '5102' },
    }),
    /provedor fiscal/,
  );
});

test('production emit in piloto without designated user is blocked', () => {
  assert.throws(
    () => assertEmissaoNFe({
      empresaId: 'cpa-aco',
      ambiente: 'Producao',
      producaoAutorizada: true,
      provedorConfigurado: true,
      nfe: { cfop: '5102' },
    }),
    /usuario piloto/,
  );
});

test('homologation emit is allowed as simulation when company and CFOP exist', () => {
  const check = assertEmissaoNFe({
    empresaId: 'cpa-aco',
    ambiente: 'Homologacao',
    nfe: { cfop: '5102' },
  });
  assert.equal(check.permiteSimulacao, true);
});

test('NF numbers increment per company and series', () => {
  assert.equal(resolveNextNumeroNfe({
    empresaId: 'cpa-aco',
    serie: '1',
    currentMax: 8,
    records: [{ empresa_id: 'cpa-aco', serie: '1', numero: '7' }, { empresa_id: '3z', serie: '1', numero: '99' }],
  }), '9');
  const created = applyNumeroNfeOnCreate({
    record: { empresa_id: 'cpa-aco', serie: '1' },
    records: [{ empresa_id: 'cpa-aco', serie: '1', numero: '3' }],
    sequenceValue: 3,
  });
  assert.equal(created.numero, '4');
});

test('authorized NF cannot be deleted', () => {
  assert.throws(() => assertNotaFiscalOnDelete({ status: 'Autorizada' }), /Exclusao de NF autorizada/);
  assert.doesNotThrow(() => assertNotaFiscalOnDelete({ status: 'Pendente' }));
});

test('commercial send no longer authorizes production through the mock', async () => {
  const tab = await readFile(new URL('../src/components/comercial/NotasFiscaisTab.jsx', import.meta.url), 'utf8');
  const mock = await readFile(new URL('../src/components/integracoes/MockIntegracoes.jsx', import.meta.url), 'utf8');
  const actions = await readFile(new URL('../base44/functions/nfeActions/entry.ts', import.meta.url), 'utf8');
  assert.match(tab, /assertEmissaoNFe/);
  assert.match(mock, /Emissao em producao exige autorizacao explicita/);
  assert.match(actions, /Emissao em producao exige autorizacao explicita/);
});
