import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

import {
  CRM_ETAPAS,
  filterOportunidadesPorEtapaFunil,
  listFunilColunasUi,
  normalizeEtapaCrm,
} from '../src/components/lib/crmOportunidadePolicy.js';

test('listFunilColunasUi: 3 variantes alinhadas a CRM_ETAPAS (sem lista paralela)', () => {
  for (const variant of ['visual', 'ia', 'avancado']) {
    const cols = listFunilColunasUi(variant);
    assert.equal(cols.length, CRM_ETAPAS.length);
    assert.deepEqual(cols.map((c) => c.id), [...CRM_ETAPAS]);
  }
  assert.equal(listFunilColunasUi('ia')[1].nome, 'Contato');
});

test('filterOportunidadesPorEtapaFunil: normaliza etapa_funil/etapa e modes keep-both', () => {
  const rows = [
    { id: '1', etapa: 'prospeccao', status: 'Aberto' },
    { id: '2', etapa_funil: 'Proposta', status: 'Em Andamento' },
    { id: '3', etapa: 'Proposta', status: 'Ganho' },
    { id: '4', etapa: 'Negociação', status: 'Perdido' },
    { id: '5', etapa: 'Fechamento', status: 'Aberto' },
  ];
  assert.deepEqual(
    filterOportunidadesPorEtapaFunil(rows, 'Prospecção', { mode: 'visual' }).map((r) => r.id),
    ['1'],
  );
  assert.deepEqual(
    filterOportunidadesPorEtapaFunil(rows, 'Proposta', { mode: 'visual' }).map((r) => r.id),
    ['2'],
  );
  assert.deepEqual(
    filterOportunidadesPorEtapaFunil(rows, 'Proposta', { mode: 'ia' }).map((r) => r.id),
    ['2'],
  );
  assert.deepEqual(
    filterOportunidadesPorEtapaFunil(rows, 'Proposta', { mode: 'avancado' }).map((r) => r.id),
    ['2', '3'],
  );
  assert.equal(normalizeEtapaCrm('qualificacao'), 'Qualificação');
});

test('Funil×3 reusam listFunilColunasUi / filterOportunidadesPorEtapaFunil (keep both curto)', () => {
  for (const file of [
    'src/components/crm/FunilVisual.jsx',
    'src/components/crm/FunilComercialInteligente.jsx',
    'src/components/crm/FunilVendasAvancado.jsx',
  ]) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /listFunilColunasUi/);
    assert.match(source, /filterOportunidadesPorEtapaFunil/);
    assert.doesNotMatch(source, /const etapas(Funil)? = \[/);
  }
  const crm = fs.readFileSync('src/pages/CRM.jsx', 'utf8');
  assert.match(crm, /FunilVisual/);
  assert.match(crm, /FunilComercialInteligente/);
  assert.match(crm, /FunilVendasAvancado/);
});

test('Separacao×IA keep both: hub Expedicao + Entregas clássico', () => {
  const expedicao = fs.readFileSync('src/pages/Expedicao.jsx', 'utf8');
  const entregas = fs.readFileSync('src/components/expedicao/EntregasListagem.jsx', 'utf8');
  assert.match(expedicao, /SeparacaoConferenciaIA/);
  assert.match(expedicao, /component: SeparacaoConferencia[^I]/);
  assert.match(expedicao, /title: 'Separação IA'/);
  assert.match(expedicao, /title: 'Separação'/);
  assert.match(entregas, /SeparacaoConferencia/);
  assert.match(entregas, /openWindow\(\s*SeparacaoConferencia/);
  const classic = fs.readFileSync('src/components/expedicao/SeparacaoConferencia.jsx', 'utf8');
  const ia = fs.readFileSync('src/components/expedicao/SeparacaoConferenciaIA.jsx', 'utf8');
  assert.match(classic, /assertSeparacaoOnCreate/);
  assert.match(ia, /assertSeparacaoOnCreate/);
  assert.match(ia, /validarRespostaConferenciaIA|avaliarScanConferencia/);
});
