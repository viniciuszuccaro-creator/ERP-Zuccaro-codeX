import assert from 'node:assert/strict';
import test from 'node:test';
import { verificarMapeadorParaStaging } from '../scripts/legado/verificar-mapeador-staging.mjs';

const opcoes = { entidade: 'cliente', groupId: 'g-sint', grupoComprovado: true };

test('cliente mestre sintetico usa apenas Grupo e codigo antigo', () => {
  const result = verificarMapeadorParaStaging([
    { cod_cliente: 'C-101', nome: 'Cliente Sintetico', group_id: 'g-sint' },
  ], opcoes);
  assert.equal(result.bloqueado, false);
  assert.equal(result.relatorio.aptos, 1);
  assert.equal(result.privados[0].codigo_legado, 'C-101');
  assert.equal(result.privados[0].group_id, 'g-sint');
  assert.equal(result.privados[0].empresa_id, '');
});

test('produto de revenda reutiliza mapper de Produto e fica no Grupo', () => {
  const result = verificarMapeadorParaStaging([
    { sku: 'SKU-1', descricao: 'Produto Sintetico', group_id: 'g-sint' },
  ], { ...opcoes, entidade: 'produto_revenda' });
  assert.equal(result.bloqueado, false);
  assert.equal(result.privados[0].descricao, 'Produto Sintetico');
});

test('Grupo sem prova, outro Grupo e empresa proprietaria sao recusados', () => {
  const row = { cod_cliente: 'C-102', nome: 'Teste' };
  assert.throws(() => verificarMapeadorParaStaging([row], { ...opcoes, grupoComprovado: false }));
  assert.throws(() => verificarMapeadorParaStaging([{ ...row, group_id: 'g-outro' }], opcoes));
  assert.throws(() => verificarMapeadorParaStaging([{ ...row, empresa_id: 'e1' }], opcoes));
});

test('pedido, fornecedor e produto fora de revenda aguardam mapeador validado', () => {
  for (const entidade of ['pedido', 'fornecedor', 'produto']) {
    assert.throws(() => verificarMapeadorParaStaging([{ codigo: '1' }], { ...opcoes, entidade }),
      /Entidade sem mapeador/);
  }
});

test('erro, quarentena ou duplicata bloqueiam lote integral sem entrega parcial', () => {
  const rows = [
    { cod_cliente: 'C-1', nome: 'Um', group_id: 'g-sint' },
    { cod_cliente: 'C-1', nome: 'Duplicado', group_id: 'g-sint' },
  ];
  const dup = verificarMapeadorParaStaging(rows, opcoes);
  assert.equal(dup.bloqueado, true);
  assert.deepEqual(dup.privados, []);
  assert.equal(dup.relatorio.reusos, 1);
  const quarentena = verificarMapeadorParaStaging([
    rows[0], { cod_cliente: 'C-0', nome: 'Zero', codigo_empresa: '0', group_id: 'g-sint' },
  ], opcoes);
  assert.equal(quarentena.bloqueado, true);
  assert.deepEqual(quarentena.privados, []);
  assert.equal(quarentena.relatorio.quarentena, 1);
});

test('relatorio nao publica nome, documento ou segredo sintetico', () => {
  const result = verificarMapeadorParaStaging([{
    cod_cliente: 'C-103', nome: 'NomePrivadoSintetico', documento: 'DocPrivadoSintetico',
    senha: 'SegredoSintetico', group_id: 'g-sint',
  }], opcoes);
  const report = JSON.stringify(result.relatorio);
  for (const marker of ['NomePrivadoSintetico', 'DocPrivadoSintetico', 'SegredoSintetico', 'C-103']) {
    assert.equal(report.includes(marker), false);
  }
  assert.equal('senha' in result.privados[0], false);
});

test('getter no segundo item falha antes do mapeador e sem leitura de segredo', () => {
  let leituras = 0;
  const adversarial = { cod_cliente: 'C-2', nome: 'Dois' };
  Object.defineProperty(adversarial, 'group_id', {
    enumerable: true,
    get() { leituras += 1; return 'SEGREDO_SINTETICO'; },
  });
  assert.throws(() => verificarMapeadorParaStaging([
    { cod_cliente: 'C-1', nome: 'Um', group_id: 'g-sint' },
    adversarial,
  ], opcoes), /registros JSON simples/);
  assert.equal(leituras, 0);
});
