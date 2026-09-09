import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  applyNumeroNfeOnCreate,
  assertCancelamentoNFe,
  assertEmissaoNFe,
  assertNotaFiscalOnDelete,
  assertNotaFiscalOnUpdate,
  isNotaFiscalSimulada,
  resolveNextNumeroNfe,
  stampNotaFiscalSimulacao,
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

test('simulated NF cancel stays on mock path and production cancel requires provider', () => {
  const simulado = assertCancelamentoNFe({
    empresaId: 'cpa-aco',
    ambiente: 'Homologacao',
    nfe: { status: 'Autorizada', simulacao: true },
  });
  assert.equal(simulado.permiteSimulacao, true);
  assert.equal(isNotaFiscalSimulada({ origem_simulacao: 'nfe_homologacao' }), true);
  assert.equal(stampNotaFiscalSimulacao({ status: 'Autorizada' }).simulacao, true);
  assert.throws(
    () => assertCancelamentoNFe({
      empresaId: 'cpa-aco',
      ambiente: 'Producao',
      producaoAutorizada: true,
      provedorConfigurado: false,
      nfe: { status: 'Autorizada' },
    }),
    /provedor fiscal/,
  );
  const real = assertCancelamentoNFe({
    empresaId: 'cpa-aco',
    ambiente: 'Producao',
    producaoAutorizada: true,
    provedorConfigurado: true,
    nfe: { status: 'Autorizada' },
  });
  assert.equal(real.permiteSimulacao, false);
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

test('authorize and cancel transitions are explicit and freeze company or amount', () => {
  const before = {
    id: 'nf-1',
    status: 'Pendente',
    empresa_id: 'cpa-aco',
    pedido_id: 'ped-1',
    numero: '10',
    serie: '1',
    valor_total: '100',
  };
  const emit = assertNotaFiscalOnUpdate({ before, patch: { status: 'Autorizada' } });
  assert.equal(emit.emit, true);
  assert.throws(
    () => assertNotaFiscalOnUpdate({
      before: { ...before, status: 'Autorizada' },
      patch: { valor_total: '50' },
    }),
    /nao pode ser recalculada/,
  );
  assert.throws(
    () => assertNotaFiscalOnUpdate({
      before: { ...before, status: 'Autorizada' },
      patch: { empresa_id: '3z' },
    }),
    /empresa emitente correta/,
  );
  const cancel = assertNotaFiscalOnUpdate({
    before: { ...before, status: 'Autorizada', chave_acesso: 'chave' },
    patch: { status: 'Cancelada' },
  });
  assert.equal(cancel.cancel, true);
  assert.equal(cancel.record.chave_acesso, 'chave');
});

test('commercial send no longer forges production auth and EventosNFe requires cancelar', async () => {
  const tab = await readFile(new URL('../src/components/comercial/NotasFiscaisTab.jsx', import.meta.url), 'utf8');
  const mock = await readFile(new URL('../src/components/integracoes/MockIntegracoes.jsx', import.meta.url), 'utf8');
  const actions = await readFile(new URL('../base44/functions/nfeActions/entry.ts', import.meta.url), 'utf8');
  const client = await readFile(new URL('../src/api/localBase44Client.js', import.meta.url), 'utf8');
  const eventos = await readFile(new URL('../src/components/fiscal/EventosNFe.jsx', import.meta.url), 'utf8');
  const config = await readFile(new URL('../src/components/cadastros/ConfiguracaoNFeForm.jsx', import.meta.url), 'utf8');
  const fechamento = await readFile(new URL('../src/components/comercial/FechamentoFinanceiroTab.jsx', import.meta.url), 'utf8');
  const pedidos = await readFile(new URL('../src/components/comercial/PedidosTab.jsx', import.meta.url), 'utf8');
  const pdv = await readFile(new URL('../src/components/financeiro/CaixaPDVCompleto.jsx', import.meta.url), 'utf8');

  assert.match(tab, /assertEmissaoNFe/);
  assert.match(tab, /assertCancelamentoNFe/);
  assert.match(tab, /stampNotaFiscalSimulacao/);
  assert.match(tab, /cancelarNFe/);
  assert.match(tab, /Auditoria obrigatoria falhou para nota fiscal/);
  assert.match(tab, /groupId && \(contexto === 'grupo' \|\| empresaId\)/);
  assert.doesNotMatch(tab, /autoriza_emissao_producao: true/);
  assert.doesNotMatch(tab, /nfe\.autoriza_emissao_producao/);
  assert.match(mock, /Emissao em producao exige autorizacao explicita/);
  assert.match(actions, /Emissao em producao exige autorizacao explicita/);
  assert.match(actions, /section: 'NotaFiscal'/);
  assert.match(actions, /persistNfeCancelamento/);
  assert.doesNotMatch(actions, /nfe\?\.autoriza_emissao_producao === true/);
  assert.match(client, /NotaFiscal: \{ module: 'Fiscal'/);
  assert.match(client, /assertNotaFiscalOnUpdate/);
  assert.match(eventos, /podeCancelar/);
  assert.match(eventos, /cancelarNFe/);
  assert.match(eventos, /Sem permissao para cancelar NF-e/);
  assert.doesNotMatch(config, /canEdit\("Cadastros", null\)/);
  assert.match(config, /empresa_id: empresaIdAtual/);
  assert.doesNotMatch(fechamento, /NotaFiscal', 'criar'/);
  assert.doesNotMatch(pedidos, /NotaFiscal', 'criar'/);
  assert.match(pedidos, /Auditoria obrigatoria falhou para pedido/);
  assert.match(pedidos, /groupId && \(contexto === 'grupo' \|\| empresaContextoId\)/);
  assert.doesNotMatch(pedidos, /catch \(_\) \{\}/);
  assert.doesNotMatch(pdv, /Notas Fiscais', 'criar'/);
});
