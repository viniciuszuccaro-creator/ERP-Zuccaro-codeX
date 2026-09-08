import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { MASTER_CODE_SPECS, applyCodigoOnCreate } from '../src/api/localCadastroMasterPolicy.js';
import {
  applyCrmCreate,
  assertConversaoOportunidade,
  assertOportunidadeOnCreate,
  assertOportunidadeOnUpdate,
  buildDocumentoFromOportunidade,
  normalizeEtapaCrm,
  stampOportunidadeConvertida,
} from '../src/components/lib/crmOportunidadePolicy.js';

test('crm codes are reserved by master sequence specs', () => {
  assert.equal(MASTER_CODE_SPECS.Oportunidade.prefix, 'OPP-');
  assert.equal(MASTER_CODE_SPECS.Interacao.prefix, 'INT-');
  assert.equal(MASTER_CODE_SPECS.Campanha.prefix, 'CAMP-');
  const opp = applyCodigoOnCreate({
    entityName: 'Oportunidade',
    record: { empresa_id: 'e1', group_id: 'g1', titulo: 'Lead' },
    records: [{ codigo_oportunidade: 'OPP-000003', group_id: 'g1' }],
    sequenceValue: 3,
  });
  assert.equal(opp.codigo_oportunidade, 'OPP-000004');
});

test('oportunidade exige contexto, cliente e reusa lead aberto', () => {
  assert.throws(
    () => assertOportunidadeOnCreate({ record: { titulo: 'X', cliente_nome: 'Ana' }, oportunidades: [] }),
    /Grupo ou empresa/,
  );
  const first = applyCrmCreate('Oportunidade', {
    empresa_id: 'e1',
    group_id: 'g1',
    titulo: 'Portao industrial',
    cliente_email: 'ana@test.com',
    cliente_nome: 'Ana',
  }, { oportunidades: [] });
  assert.equal(first.reuse, null);
  assert.equal(first.record.etapa, 'Prospecção');
  assert.equal(first.record.etapa_funil, 'Prospecção');

  const retry = applyCrmCreate('Oportunidade', first.record, {
    oportunidades: [{ id: 'o1', ...first.record, status: 'Aberto' }],
  });
  assert.equal(retry.reuse.id, 'o1');
});

test('interacao e campanha exigem contexto e normalizam campos', () => {
  assert.throws(
    () => applyCrmCreate('Interacao', { titulo: 'Call' }, {}),
    /Grupo ou empresa/,
  );
  const interacao = applyCrmCreate('Interacao', {
    empresa_id: 'e1',
    titulo: 'Call',
    cliente_nome: 'Ana',
  }, {});
  assert.equal(interacao.record.tipo, 'Ligação');

  const campanha = applyCrmCreate('Campanha', {
    group_id: 'g1',
    empresa_id: 'e1',
    nome: 'Reativacao',
  }, {});
  assert.equal(campanha.record.empresa_dona_id, 'e1');
  assert.equal(campanha.record.status, 'Planejamento');
});

test('update sincroniza etapa e conversao gera pedido/orcamento', () => {
  assert.equal(normalizeEtapaCrm('negociação'), 'Negociação');
  const updated = assertOportunidadeOnUpdate({
    before: { id: 'o1', empresa_id: 'e1', group_id: 'g1', titulo: 'X', etapa: 'Prospecção', status: 'Aberto' },
    patch: { etapa_funil: 'proposta' },
  });
  assert.equal(updated.record.etapa, 'Proposta');
  assert.equal(updated.record.etapa_funil, 'Proposta');
  assert.equal(updated.action, 'mover_etapa');

  assert.throws(
    () => assertOportunidadeOnUpdate({
      before: { id: 'o1', empresa_id: 'e1', status: 'Ganho', titulo: 'X' },
      patch: { etapa: 'Proposta' },
    }),
    /fechada ou convertida/,
  );

  assert.throws(
    () => assertConversaoOportunidade({ oportunidade: { status: 'Aberto', titulo: 'X' }, tipo: 'pedido' }),
    /Empresa obrigatoria/,
  );

  const doc = buildDocumentoFromOportunidade({
    id: 'o1',
    empresa_id: 'e1',
    group_id: 'g1',
    titulo: 'Portao',
    cliente_nome: 'Ana',
    valor_estimado: 1500,
    status: 'Aberto',
    origem: 'site',
  }, 'pedido');
  assert.equal(doc.tipo, 'Pedido');
  assert.equal(doc.oportunidade_id, 'o1');
  assert.equal(doc.origem, 'site');

  const closed = stampOportunidadeConvertida({ id: 'o1', status: 'Aberto' }, { id: 'p1' }, 'pedido');
  assert.equal(closed.status, 'Ganho');
  assert.equal(closed.pedido_id, 'p1');
});

test('CRM deixa de usar placeholders, funis usam updateInContext e client aplica policy', async () => {
  const page = await readFile(new URL('../src/pages/CRM.jsx', import.meta.url), 'utf8');
  const funilIa = await readFile(new URL('../src/components/crm/FunilComercialInteligente.jsx', import.meta.url), 'utf8');
  const funilAv = await readFile(new URL('../src/components/crm/FunilVendasAvancado.jsx', import.meta.url), 'utf8');
  const lista = await readFile(new URL('../src/components/crm/OportunidadesLista.jsx', import.meta.url), 'utf8');
  const client = await readFile(new URL('../src/api/localBase44Client.js', import.meta.url), 'utf8');
  assert.match(page, /OportunidadesLista/);
  assert.match(page, /InteracoesLista/);
  assert.match(page, /CampanhasLista/);
  assert.match(page, /onMoverEtapa/);
  assert.doesNotMatch(page, /em desenvolvimento/);
  assert.doesNotMatch(page, /return \[\]/);
  assert.match(funilIa, /filtrarPorContexto\('Oportunidade'/);
  assert.match(funilIa, /updateInContext\('Oportunidade'/);
  assert.doesNotMatch(funilIa, /entities\.Oportunidade\.update/);
  assert.match(funilAv, /filtrarPorContexto\('Oportunidade'/);
  assert.match(funilAv, /updateInContext\('Oportunidade'/);
  assert.match(funilAv, /Contato Inicial/);
  assert.match(lista, /canConvert/);
  assert.match(client, /assertOportunidadeOnUpdate/);
  assert.match(client, /oportunidadeStatusPermissionActions/);
  assert.match(client, /Oportunidade: \{ module: 'CRM', section: 'Oportunidade' \}/);
});
