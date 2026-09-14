import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  calcularDiasParaVencimento,
  filtrarContratos,
  requireContratoId,
  resumirContratos
} from '../src/components/contratos/contratosPagePolicy.js';

test('filtra contratos pela busca e pela aba sem ampliar a lista', () => {
  const contratos = [
    { id: 'c1', numero_contrato: 'CPA-001', parte_contratante: 'Cliente A', status: 'Vigente' },
    { id: 'c2', numero_contrato: '3Z-002', parte_contratante: 'Fornecedor B', status: 'Vencido' }
  ];

  assert.deepEqual(filtrarContratos(contratos, 'cliente', 'todos').map(({ id }) => id), ['c1']);
  assert.deepEqual(filtrarContratos(contratos, '', 'Vencido').map(({ id }) => id), ['c2']);
});

test('resume somente contratos vigentes no valor mensal', () => {
  const futuro = new Date();
  futuro.setDate(futuro.getDate() + 30);
  const resumo = resumirContratos([
    { status: 'Vigente', valor_mensal: 100, data_fim: futuro.toISOString() },
    { status: 'Vencido', valor_mensal: 900 }
  ]);

  assert.equal(resumo.vigentes.length, 1);
  assert.equal(resumo.vencidos.length, 1);
  assert.equal(resumo.proximosVencer.length, 1);
  assert.equal(resumo.valorMensalVigente, 100);
  assert.equal(calcularDiasParaVencimento('2026-02-01', new Date('2026-01-01T00:00:00Z')), 31);
});

test('exige identificador antes de atualizar um contrato', () => {
  assert.equal(requireContratoId({ id: 'contrato-1' }), 'contrato-1');
  assert.throws(() => requireContratoId({}), /sem identificador válido/);
});

test('pagina consulta por contexto e preserva historico na inativacao', async () => {
  const source = await readFile(new URL('../src/pages/Contratos.jsx', import.meta.url), 'utf8');

  assert.match(source, /Contrato\.filter\(getFiltroContexto\('empresa_id', true\)/);
  assert.match(source, /Cliente\.filter\(\{ group_id: contextoCanonico\.groupId \}\)/);
  assert.match(source, /Fornecedor\.filter\(\{ group_id: contextoCanonico\.groupId \}\)/);
  assert.match(source, /status: 'Rescindido'/);
  assert.doesNotMatch(source, /Contrato\.list\(/);
  assert.doesNotMatch(source, /Contrato\.delete\(/);
  assert.doesNotMatch(source, /return \(ctx && ctx\.length > 0\) \? ctx : contratos/);
});
