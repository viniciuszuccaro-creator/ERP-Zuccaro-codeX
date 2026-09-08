import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { MASTER_CODE_SPECS, applyCodigoOnCreate } from '../src/api/localCadastroMasterPolicy.js';
import {
  applyRoteirizacaoCreate,
  assertCapacidadeRota,
  assertRotaOnCreate,
  assertRoteirizacaoInteligenteOnCreate,
  otimizarRotaAvancada,
  reordenarPontosRota,
  resolveCoordenadas,
  stampEntregaAtribuicaoRota,
} from '../src/components/lib/roteirizacaoPolicy.js';

test('rota code is reserved by master sequence', () => {
  assert.equal(MASTER_CODE_SPECS.Rota.prefix, 'ROT-');
  const coded = applyCodigoOnCreate({
    entityName: 'Rota',
    record: { empresa_id: 'e1', group_id: 'g1' },
    records: [{ codigo_rota: 'ROT-000002', group_id: 'g1' }],
    sequenceValue: 2,
  });
  assert.equal(coded.codigo_rota, 'ROT-000003');
});

test('otimizacao considera coordenadas, prioridade e capacidade', () => {
  assert.deepEqual(resolveCoordenadas({
    endereco_entrega_completo: { latitude: -23.55, longitude: -46.63 },
  }), { latitude: -23.55, longitude: -46.63 });

  const result = otimizarRotaAvancada({
    origem: { latitude: -23.55, longitude: -46.63 },
    veiculo: { capacidade_kg: 100, capacidade_m3: 2 },
    parametros: { priorizar_urgencia: true, considerar_janela_horario: true },
    entregas: [
      {
        id: 'a',
        prioridade: 'Baixa',
        peso_total_kg: 40,
        volume_m3: 0.5,
        janela_entrega_inicio: '14:00',
        endereco_entrega_completo: { latitude: -23.56, longitude: -46.64 },
      },
      {
        id: 'b',
        prioridade: 'Urgente',
        peso_total_kg: 40,
        volume_m3: 0.5,
        janela_entrega_inicio: '09:00',
        endereco_entrega_completo: { latitude: -23.57, longitude: -46.65 },
      },
    ],
  });

  assert.equal(result.pontos.length, 2);
  assert.equal(result.pontos[0].id, 'b');
  assert.ok(result.distancia_total_km > 0);
  assert.equal(result.capacidade.ok, true);

  const excesso = assertCapacidadeRota({
    entregas: [{ peso_total_kg: 200 }],
    veiculo: { capacidade_kg: 100 },
  });
  assert.equal(excesso.ok, false);
});

test('rota exige empresa/motorista/veiculo e reusa o mesmo conjunto', () => {
  assert.throws(
    () => assertRotaOnCreate({ record: { motorista_id: 'm1', veiculo_id: 'v1', entregas_ids: ['a'] }, rotas: [] }),
    /Empresa obrigatoria/,
  );

  const first = applyRoteirizacaoCreate('Rota', {
    empresa_id: 'e1',
    data_rota: '2026-09-08',
    motorista_id: 'm1',
    veiculo_id: 'v1',
    entregas_ids: ['b', 'a'],
    pontos_entrega: [{ entrega_id: 'a' }, { entrega_id: 'b' }],
  }, { rotas: [] });
  assert.equal(first.reuse, null);
  assert.equal(first.record.pontos_entrega[0].sequencia, 1);

  const retry = applyRoteirizacaoCreate('Rota', first.record, {
    rotas: [{ id: 'r1', ...first.record }],
  });
  assert.equal(retry.reuse.id, 'r1');
});

test('ajuste manual reordena sequencia', () => {
  const reordered = reordenarPontosRota([
    { id: 'a', sequencia: 1 },
    { id: 'b', sequencia: 2 },
    { id: 'c', sequencia: 3 },
  ], 2, 0);
  assert.equal(reordered[0].id, 'c');
  assert.equal(reordered[0].sequencia, 1);
  assert.equal(reordered[1].id, 'a');
});

test('roteirizacao inteligente exige grupo, motorista e veiculo', () => {
  assert.throws(
    () => assertRoteirizacaoInteligenteOnCreate({
      record: { empresa_id: 'e1', entregas_ids: ['a'] },
      rotas: [],
    }),
    /Grupo obrigatorio/,
  );
  assert.throws(
    () => assertRoteirizacaoInteligenteOnCreate({
      record: { empresa_id: 'e1', group_id: 'g1', entregas_ids: ['a'] },
      rotas: [],
    }),
    /Motorista obrigatorio/,
  );
  assert.throws(
    () => assertRoteirizacaoInteligenteOnCreate({
      record: {
        empresa_id: 'e1',
        group_id: 'g1',
        motorista_id: 'm1',
        entregas_ids: ['a'],
      },
      rotas: [],
    }),
    /Veiculo obrigatorio/,
  );

  const ok = assertRoteirizacaoInteligenteOnCreate({
    record: {
      empresa_id: 'e1',
      group_id: 'g1',
      motorista_id: 'm1',
      veiculo_id: 'v1',
      entregas_ids: ['a', 'b'],
      entregas_vinculadas: [{ entrega_id: 'a' }, { entrega_id: 'b' }],
    },
    rotas: [],
  });
  assert.equal(ok.reuse, null);
  assert.equal(ok.record.entregas_vinculadas[0].ordem_sequencia, 1);
});

test('stampEntregaAtribuicaoRota propaga motorista e sequencia', () => {
  const patch = stampEntregaAtribuicaoRota({
    entrega: { id: 'ent1', status: 'Aguardando Separação' },
    rota: {
      id: 'rot1',
      group_id: 'g1',
      empresa_id: 'e1',
      motorista_id: 'm1',
      motorista_nome: 'Joao',
      veiculo_placa: 'ABC1D23',
    },
    motorista: { id: 'm1', nome_completo: 'Joao' },
    veiculo: { id: 'v1', placa: 'ABC1D23' },
    sequencia: 3,
  });
  assert.equal(patch.motorista_id, 'm1');
  assert.equal(patch.sequencia_rota, 3);
  assert.equal(patch.rota_id, 'rot1');
  assert.equal(patch.group_id, 'g1');
});

test('mapa e cliente usam a policy do roteirizador', async () => {
  const mapa = await readFile(new URL('../src/components/expedicao/RoteirizacaoMapa.jsx', import.meta.url), 'utf8');
  const ia = await readFile(new URL('../src/components/expedicao/RoteirizacaoInteligente.jsx', import.meta.url), 'utf8');
  const mapaIa = await readFile(new URL('../src/components/logistica/MapaRoteirizacaoIA.jsx', import.meta.url), 'utf8');
  const client = await readFile(new URL('../src/api/localBase44Client.js', import.meta.url), 'utf8');
  const master = await readFile(new URL('../src/api/localCadastroMasterPolicy.js', import.meta.url), 'utf8');
  assert.match(mapa, /otimizarRotaAvancada/);
  assert.match(mapa, /buildRotaRecord/);
  assert.match(mapa, /reordenarPontosRota/);
  assert.match(ia, /stampEntregaAtribuicaoRota/);
  assert.match(ia, /motoristaSelecionado/);
  assert.match(mapaIa, /filterInContext/);
  assert.match(mapaIa, /otimizarRotaAvancada/);
  assert.match(client, /applyRoteirizacaoCreate/);
  assert.match(client, /RoteirizacaoInteligente: \{ module: 'Expedicao'/);
  assert.match(master, /prefix: 'ROT-'/);
});
