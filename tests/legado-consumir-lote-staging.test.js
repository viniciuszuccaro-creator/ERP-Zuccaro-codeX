import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAuditoriaConsumoLegado,
  consumirLoteStagingIdempotente,
  consumirLoteStagingLegado,
  validarDependenciasLegado,
} from '../scripts/legado/consumir-lote-staging.mjs';

const CONTRATO_SINTETICO = {
  coorte: 'sintetico-teste',
  crosswalkEmpresas: { 1: 'e1', 2: 'e1', 3: 'e1', 5: 'e1' },
};
test('conflito classe/tipo quarentena somente seu registro e preserva lote parcial e retry',()=>{
 const rows=[{sku:'0001',descricao:'Synthetic good',classe:'GOOD',unidade:'KG',group_id:'g1'},
  {sku:'0002',descricao:'Synthetic conflict',classe:'BAD',unidade:'KG',group_id:'g1'}];
 const opts={entidade:'produto',groupId:'g1',contratoEntrada:{coorte:'synthetic'},produtoClassUnitMap:{
  'GOOD|KG':{tipo_item:'MATERIA_PRIMA',tipo_produto:'Matéria-Prima Produção',unidade_medida_id:'unit'},
  'BAD|KG':{tipo_item:'MATERIA_PRIMA',tipo_produto:'REVENDA',unidade_medida_id:'unit'}}};
 const before=JSON.stringify({rows,opts}),{primeiro,segundo}=consumirLoteStagingIdempotente(rows,opts);
 assert.equal(primeiro.comprovados.length,1);assert.equal(primeiro.comprovados[0].codigo_legado,'0001');
 assert.equal(primeiro.quarentena.length,1);assert.equal(primeiro.quarentena[0].codigo_legado,'0002');
 assert.equal(segundo.comprovados.length,0);assert.equal(segundo.reusos.length,1);assert.equal(segundo.quarentena.length,1);
 assert.equal(JSON.stringify({rows,opts}),before);
});

test('identidade divergente bloqueia todas as variantes, independente da ordem e do retry anterior',()=>{
  const left={cod_cliente:'C-CONFLICT',nome:'Synthetic',documento:'00000000000191',group_id:'g1'};
  const right={...left,documento:'00000000000272'};
  const clean=consumirLoteStagingLegado([left],{entidade:'cliente',contratoEntrada:CONTRATO_SINTETICO}).comprovados[0];
  for(const rows of [[left,right,left],[right,left,right]]) {
    const out=consumirLoteStagingLegado(rows,{entidade:'cliente',contratoEntrada:CONTRATO_SINTETICO,
      chavesJaGravadas:[{chave:clean.chave_idempotente_migracao,fingerprint:clean.fingerprint_migracao}]});
    assert.equal(out.comprovados.length,0);assert.equal(out.reusos.length,0);
    assert.ok(out.quarentena.some(item=>item.motivos.includes('identidade_legado_divergente_no_lote')));
    assert.ok(out.quarentena.some(item=>item.motivos.includes('reuso_origem_nao_validada')));
    assert.equal(out.rejeicoes.length,1);assert.equal(out.totais.origem,3);
    assert.equal(out.auditoria.filter(item=>item.resultado==='quarentena_identidade').length,1);
    assert.equal(out.importado_operacional,false);
  }
});

test('conflito compartilhado nao bloqueia identidade independente nem muda registros de origem',()=>{
  const left={cod_cliente:'C-CONFLICT',nome:'Synthetic',documento:'00000000000191',group_id:'g1'};
  const right={...left,nome:'Different synthetic'};
  const other={...left,cod_cliente:'C-OTHER',documento:'00000000000353'};
  const rows=[left,right,other],before=JSON.stringify(rows);
  const out=consumirLoteStagingLegado(rows,{entidade:'cliente',contratoEntrada:CONTRATO_SINTETICO});
  assert.deepEqual(out.comprovados.map(item=>item.codigo_legado),['C-OTHER']);
  assert.equal(JSON.stringify(rows),before);assert.equal(out.reusos.length,0);
});

test('referencias anteriores conflitantes nao escolhem o ultimo fingerprint',()=>{
  const row={cod_cliente:'C-PRIOR',nome:'Synthetic',group_id:'g1'};
  const opts={entidade:'cliente',contratoEntrada:CONTRATO_SINTETICO};
  const previous=consumirLoteStagingLegado([row],opts).comprovados[0];
  const correct={chave:previous.chave_idempotente_migracao,fingerprint:previous.fingerprint_migracao};
  const wrong={...correct,fingerprint:'different'};
  for(const references of [[wrong,correct],[correct,wrong]]) {
    const out=consumirLoteStagingLegado([row],{...opts,chavesJaGravadas:references});
    assert.equal(out.comprovados.length,0);assert.equal(out.reusos.length,0);
    assert.equal(out.quarentena.length,1);
    assert.ok(out.quarentena[0].motivos.includes('identidade_legado_divergente_no_lote'));
  }
});

test('consumidor staging separa comprovados, quarentena, reuso e rejeicao', () => {
  const out = consumirLoteStagingLegado([
    {
      cod_cliente: 'C-1',
      razao_social: 'Ok Sintetico',
      cnpj: '00000000000191',
      group_id: 'g1',
      empresa_id: 'e1',
      codigo_empresa: '1',
      valor: 10,
    },
    {
      cod_cliente: 'C-1',
      razao_social: 'Ok Sintetico',
      cnpj: '00000000000191',
      group_id: 'g1',
      empresa_id: 'e1',
      codigo_empresa: '1',
      valor: 10,
    },
    {
      cod_cliente: 'C-0',
      nome: 'Quarentena',
      group_id: 'g1',
      empresa_id: 'e1',
      codigo_empresa: '0',
      valor: 1,
    },
  ], { entidade: 'cliente', contratoEntrada: CONTRATO_SINTETICO });

  assert.equal(out.importado_operacional, false);
  assert.equal(out.destino_migracao, 'staging');
  assert.equal(out.contrato_entrada, true);
  assert.equal(out.comprovados.length, 1);
  assert.equal(out.comprovados[0].scopeType, 'group');
  assert.equal(out.comprovados[0].empresa_id, undefined);
  assert.equal(out.reusos.length, 1);
  assert.equal(out.quarentena.length, 1);
  assert.equal(out.auditoria.length >= 2, true);
  assert.equal(out.reconciliacao.quantidade_origem, 3);
});

test('sem contrato de entrada nao comprova (quarentena)', () => {
  const out = consumirLoteStagingLegado([{
    cod_cliente: 'C-1',
    razao_social: 'Sem contrato',
    cnpj: '00000000000191',
    group_id: 'g1',
    empresa_id: 'e1',
    codigo_empresa: '1',
  }], { entidade: 'cliente' });
  assert.equal(out.comprovados.length, 0);
  assert.equal(out.quarentena.length >= 1, true);
  assert.ok(out.quarentena.some((q) => (q.motivos || []).includes('contrato_entrada_ausente')));
});

test('consumidor staging e idempotente na segunda passagem', () => {
  const rows = [{
    cod_fornecedor: 'F-1',
    razao_social: 'Forn Sintetico',
    cnpj: '00000000000191',
    group_id: 'g1',
    empresa_id: 'e1',
    codigo_empresa: '2',
  }];
  const { primeiro, segundo } = consumirLoteStagingIdempotente(rows, {
    entidade: 'fornecedor',
    contratoEntrada: CONTRATO_SINTETICO,
  });
  assert.equal(primeiro.comprovados.length, 1);
  assert.equal(segundo.comprovados.length, 0);
  assert.equal(segundo.reusos.some((r) => r.motivo === 'idempotente_ja_consumido'), true);
});

test('validarDependencias e auditoria sanitizada', () => {
  const bad = validarDependenciasLegado({ entidade_migracao: 'cliente', codigo_legado: 'X' });
  assert.equal(bad.ok, false);
  assert.ok(bad.rejeicoes.includes('group_id_obrigatorio'));
  assert.ok(bad.rejeicoes.includes('empresa_destino_obrigatoria'));
  assert.ok(bad.rejeicoes.includes('contrato_entrada_ausente'));

  const ok = validarDependenciasLegado({
    entidade_migracao: 'cliente',
    codigo_legado: 'C-1',
    group_id: 'g1',
    empresa_id: 'e1',
    codigo_empresa_legado: '1',
  }, {
    crosswalkEmpresas: CONTRATO_SINTETICO.crosswalkEmpresas,
    chavesEmpresa: new Set(['1', '2', '3', '5']),
    requireContratoEntrada: true,
    contratoEntradaPresente: true,
  });
  assert.equal(ok.ok, true);

  const audit = buildAuditoriaConsumoLegado({
    entidade_migracao: 'cliente',
    group_id: 'g1',
    codigo_legado: 'C-1',
    chave_idempotente_migracao: 'g1|e1|erp_antigo|cliente|C-1',
    documento: 'NAO_DEVE_APARECER_COMO_CAMPO_SENSIVEL_EXTRA',
  }, { acao: 'consumir', resultado: 'ok' });
  assert.equal(audit.importacao_erp, true);
  assert.equal(audit.codigo_legado, 'C-1');
  assert.equal('documento' in audit, false);
  assert.equal('senha' in audit, false);
});

test('mestres de Grupo dispensam empresa exclusiva, mas operacao sem empresa falha', () => {
  const master = consumirLoteStagingLegado([{
    cod_cliente: 'C-G', nome: 'Cliente Grupo', group_id: 'g1', codigo_empresa: '1',
  }], { entidade: 'cliente', contratoEntrada: { coorte: 'piloto-sintetico' } });
  assert.equal(master.comprovados.length, 1);
  assert.equal(master.comprovados[0].chave_idempotente_migracao, 'g1|grupo|erp_antigo|cliente|C-G');

  const operation = validarDependenciasLegado({
    entidade_migracao: 'obra', codigo_legado: 'O-1', group_id: 'g1', scopeType: 'empresa',
  }, { contratoEntradaPresente: true, requireContratoEntrada: true });
  assert.equal(operation.ok, false);
  assert.ok(operation.rejeicoes.includes('empresa_destino_obrigatoria'));
});

test('produto tipado conserva classe/unidade e retry; conflito sem sobrescrita', () => {
  const rows = [
    { sku: 'P-1', descricao: 'Chapa', classe: 'CHAPA', unidade: 'KG', group_id: 'g1', codigo_empresa: '1' },
    { sku: 'P-1', descricao: 'Chapa', classe: 'CHAPA', unidade: 'KG', group_id: 'g1', codigo_empresa: '2' },
    { sku: 'P-1', descricao: 'Tubo', classe: 'TUBO', unidade: 'M', group_id: 'g1', codigo_empresa: '2' },
  ];
  const opts = { entidade: 'produto', contratoEntrada: { coorte: 'piloto-sintetico' },
    produtoClassUnitMap: { 'CHAPA|KG': { tipo_produto: 'MATERIA_PRIMA', unidade_medida_id: 'u-kg' },
      'TUBO|M': { tipo_produto: 'MATERIA_PRIMA', unidade_medida_id: 'u-m' } } };
  const { primeiro, segundo } = consumirLoteStagingIdempotente(rows.slice(0, 2), opts);
  assert.equal(primeiro.comprovados.length, 1);
  assert.equal(primeiro.reusos.length, 1);
  assert.equal(primeiro.rejeicoes.length, 0);
  assert.equal(segundo.comprovados.length, 0);
  assert.equal(segundo.rejeicoes.length, 0);
  assert.equal(primeiro.comprovados[0].unidade_medida_id, 'u-kg');
  const conflitante = consumirLoteStagingIdempotente(rows, opts);
  for (const rodada of [conflitante.primeiro, conflitante.segundo]) {
    assert.equal(rodada.comprovados.length, 0);
    assert.equal(rodada.reusos.length, 0);
    assert.equal(rodada.rejeicoes.length, 1);
    assert.equal(rodada.quarentena.length, 2);
  }
});

test('retry com mesma chave e conteúdo diferente não reutiliza venda/cadastro', () => {
  const rows = [{ cod_cliente: 'C-1', nome: 'Alterado', group_id: 'g1' }];
  const out = consumirLoteStagingLegado(rows, {
    entidade: 'cliente', contratoEntrada: { coorte: 'sintetico' },
    chavesJaGravadas: [{ chave: 'g1|grupo|erp_antigo|cliente|C-1', fingerprint: 'a'.repeat(64) }],
  });
  assert.equal(out.comprovados.length, 0);
  assert.equal(out.reusos.length, 0);
  assert.equal(out.quarentena.length, 1);
  assert.ok(out.quarentena[0].motivos.includes('reuso_sem_fingerprint_igual'));
});

test('retry e duplicatas revalidam contrato antes de confirmar reuso', () => {
  const row = { cod_cliente: 'C-1', nome: 'Mesmo', group_id: 'g1' };
  const primeiro = consumirLoteStagingLegado([row], {
    entidade: 'cliente', contratoEntrada: { coorte: 'sintetico' },
  });
  const anterior = primeiro.comprovados[0];
  const segundo = consumirLoteStagingLegado([row, row], {
    entidade: 'cliente', chavesJaGravadas: [{
      chave: anterior.chave_idempotente_migracao, fingerprint: anterior.fingerprint_migracao,
    }],
  });
  assert.equal(segundo.comprovados.length, 0);
  assert.equal(segundo.reusos.length, 0);
  assert.equal(segundo.quarentena.length, 2);
  assert.equal(segundo.auditoria.length, 2);
  assert.ok(segundo.quarentena.some((r) => r.motivos.includes('contrato_entrada_ausente')));
});

test('quarentena de origem nao vira retry aceito por fingerprint igual', () => {
  const good = { cod_cliente: 'C-1', nome: 'Mesmo', group_id: 'g1', codigo_empresa: '1' };
  const opts = { entidade: 'cliente', contratoEntrada: { coorte: 'sintetico' } };
  const anterior = consumirLoteStagingLegado([good], opts).comprovados[0];
  const retry = consumirLoteStagingLegado([{ ...good, codigo_empresa: '0' }], {
    ...opts, chavesJaGravadas: [{ chave: anterior.chave_idempotente_migracao,
      fingerprint: anterior.fingerprint_migracao }],
  });
  assert.equal(retry.reusos.length, 0);
  assert.equal(retry.quarentena.length, 1);
  assert.ok(retry.quarentena[0].motivos.includes('codigo_empresa_legado_0'));
});

test('operacao exige codigo juridico e destino exatamente ligado ao crosswalk', () => {
  const opts = { entidade: 'obra', groupId: 'g1',
    contratoEntrada: { coorte: 'sintetico', crosswalkEmpresas: { 1: 'empresa-provada' } } };
  const expected = opts.contratoEntrada.crosswalkEmpresas[1];
  const semCodigo = consumirLoteStagingLegado([{ cod_obra: 'O-1', nome: 'Obra', empresa_id: expected }], opts);
  assert.equal(semCodigo.comprovados.length, 0);
  assert.ok(semCodigo.rejeicoes[0].rejeicoes.includes('empresa_legado_comprovada_obrigatoria'));
  const wrong = consumirLoteStagingLegado([{ cod_obra: 'O-1', nome: 'Obra', codigo_empresa: '1' }], { ...opts, empresaId: 'outra' });
  assert.equal(wrong.comprovados.length, 0);
  assert.ok(wrong.rejeicoes[0].rejeicoes.includes('empresa_destino_divergente_do_crosswalk'));
  const ok = consumirLoteStagingLegado([{ cod_obra: 'O-1', nome: 'Obra', codigo_empresa: '1' }], { ...opts, empresaId: expected });
  assert.equal(ok.comprovados.length, 1);
  assert.equal(ok.comprovados[0].empresa_id, expected);
});
