import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

import {
  buildComprovanteRecebedorPayload,
  resolveRegistroEntregaFinal,
} from '../src/components/lib/expedicaoFluxoOperacionalPolicy.js';

test('buildComprovanteRecebedorPayload: sanitiza e normaliza contrato compartilhado', () => {
  const agora = '2026-10-29T12:00:00.000Z';
  const payload = buildComprovanteRecebedorPayload({
    nome_recebedor: '  Maria <script>x</script> Silva  ',
    documento_recebedor: '123.456.789-00',
    cargo_recebedor: 'Porteiro',
    observacoes_recebimento: 'ok javascript:alert(1)',
    foto_comprovante: 'https://cdn.example/prova.jpg',
    latitude_entrega: '-23.5',
    longitude_entrega: '-46.6',
    now: agora,
  });
  assert.equal(payload.nome_recebedor, 'Maria  Silva');
  assert.equal(payload.documento_recebedor, '123.456.789-00');
  assert.equal(payload.cargo_recebedor, 'Porteiro');
  assert.equal(payload.observacoes_recebimento, 'ok alert(1)');
  assert.equal(payload.foto_comprovante, 'https://cdn.example/prova.jpg');
  assert.equal(payload.latitude_entrega, -23.5);
  assert.equal(payload.longitude_entrega, -46.6);
  assert.equal(payload.data_hora_recebimento, agora);
});

test('buildComprovanteRecebedorPayload: GPS/foto ausentes ≠ zero inventado', () => {
  const payload = buildComprovanteRecebedorPayload({
    nome_recebedor: 'João',
    latitude_entrega: '',
    longitude_entrega: undefined,
    foto_comprovante: '',
    now: '2026-10-29T12:00:00.000Z',
  });
  assert.equal(payload.latitude_entrega, null);
  assert.equal(payload.longitude_entrega, null);
  assert.equal(payload.foto_comprovante, null);
  assert.equal(payload.nome_recebedor, 'João');
});


test('parecer 6498241434: nome 190 chars preservado; >200 rejeita sem truncar', () => {
  const nome190 = 'N' + 'a'.repeat(189);
  assert.equal(nome190.length, 190);
  const ok = buildComprovanteRecebedorPayload({
    nome_recebedor: nome190,
    now: '2026-10-29T12:00:00.000Z',
  });
  assert.equal(ok.nome_recebedor, nome190, '190 ≤ max(200) preservado integralmente');

  const nome200 = 'X'.repeat(200);
  const ok200 = buildComprovanteRecebedorPayload({
    nome_recebedor: nome200,
    now: '2026-10-29T12:00:00.000Z',
  });
  assert.equal(ok200.nome_recebedor.length, 200);

  const nome201 = 'Y'.repeat(201);
  assert.throws(
    () => buildComprovanteRecebedorPayload({ nome_recebedor: nome201 }),
    (err) => err?.code === 'VALIDATION_ERROR' && err?.field === 'nome_recebedor',
  );
});

test('buildComprovanteRecebedorPayload: GPS zero numérico preservado (não vira null)', () => {
  const payload = buildComprovanteRecebedorPayload({
    nome_recebedor: 'Zero',
    latitude_entrega: 0,
    longitude_entrega: 0,
    now: '2026-10-29T12:00:00.000Z',
  });
  assert.equal(payload.latitude_entrega, 0);
  assert.equal(payload.longitude_entrega, 0);
});

test('resolveRegistroEntregaFinal consome payload canônico do comprovante', () => {
  const agora = '2026-10-29T12:00:00.000Z';
  const comprovante = buildComprovanteRecebedorPayload({
    nome_recebedor: 'Ana',
    documento_recebedor: '11',
    foto_comprovante: 'blob:1',
    now: agora,
  });
  const resolved = resolveRegistroEntregaFinal({
    before: { id: 'ent-1', status: 'Em Rota', historico_status: [] },
    modo: 'total',
    comprovante,
    groupId: 'g1',
    empresaId: 'e1',
    confirmed: true,
    now: agora,
    usuario: 'tester',
  });
  assert.equal(resolved.patch.status, 'Entregue');
  assert.equal(resolved.patch.comprovante_entrega.nome_recebedor, 'Ana');
  assert.equal(resolved.patch.comprovante_entrega.foto_comprovante, 'blob:1');
});

test('ComprovanteDigital e ComprovanteEntregaDigital reusam buildComprovanteRecebedorPayload', () => {
  const digital = fs.readFileSync('src/components/expedicao/ComprovanteDigital.jsx', 'utf8');
  const entrega = fs.readFileSync('src/components/logistica/ComprovanteEntregaDigital.jsx', 'utf8');
  assert.match(digital, /buildComprovanteRecebedorPayload/);
  assert.match(entrega, /buildComprovanteRecebedorPayload/);
  // Capacidades distintas preservadas (keep both curto — matriz Pacote 5)
  assert.match(entrega, /isHttpExpedicaoMode/);
  assert.match(entrega, /capturarGeolocalizacao|geolocalizacao/);
  assert.match(digital, /windowMode/);
  assert.match(digital, /navigator\.geolocation/);
});

for (const [file, label] of [
  ['src/components/cadastros/ConfiguracaoWhatsAppForm.jsx', 'WhatsApp'],
  ['src/components/cadastros/ConfiguracaoIntegracaoForm.jsx', 'Integracao'],
  ['src/components/cadastros/ConfiguracaoDespesaRecorrenteForm.jsx', 'DespesaRecorrente'],
  ['src/components/cadastros/FilialForm.jsx', 'Filial'],
]) {
  test(`${label}: sky windowMode + ID técnico residual (sem CodigoField/count+1)`, () => {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /from-sky-50 to-sky-100/);
    assert.match(source, /ID técnico/);
    assert.doesNotMatch(source, /count\s*\+\s*1/);
    assert.doesNotMatch(source, /CadastroCodigoRegistroField/);
    // Preserva pin RecordState onde já existia
    if (label === 'WhatsApp' || label === 'Integracao' || label === 'DespesaRecorrente') {
      assert.match(source, /useCadastroRecordState/);
    }
    if (label === 'Filial') {
      assert.match(source, /useCadastroReopenOnIdentity/);
      assert.match(source, /filialBoundId/);
    }
  });
}
