import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
  assert.throws(() => verificarMapeadorParaStaging([{ ...row, group_id: 'g-sint', grupo_id: 'g-outro' }], opcoes));
  assert.throws(() => verificarMapeadorParaStaging([{ ...row, groupId: 'g-outro' }], opcoes));
});

test('codigo de empresa legado e aliases exigem prova antes do mapeador mestre', () => {
  for (const legado of ['1', '2', '3', '5', '001', '003']) {
    for (const alias of ['codigo_empresa', 'empresa_codigo', 'empresaCodigo', 'codEmpresa',
      'empresa-codigo', 'cod-empresa', 'codigo-empresa', 'CODIGO-EMPRESA']) {
      assert.throws(() => verificarMapeadorParaStaging([{
        cod_cliente: 'C-200', nome: 'Sintetico', group_id: 'g-sint', [alias]: legado,
      }], opcoes), /vinculo empresarial legado nao comprovado/);
    }
  }
});

test('alias empresarial na segunda linha bloqueia o lote inteiro', () => {
  assert.throws(() => verificarMapeadorParaStaging([
    { cod_cliente: 'C-201', nome: 'Primeiro', group_id: 'g-sint' },
    { cod_cliente: 'C-202', nome: 'Segundo', 'empresa-codigo': '001', group_id: 'g-sint' },
  ], opcoes), /vinculo empresarial legado nao comprovado/);
  assert.throws(() => verificarMapeadorParaStaging([
    { cod_cliente: 'C-201', nome: 'Primeiro', 'group-id': 'outro' },
  ], opcoes), /Grupo da linha diverge/);
});

test('campos de escopo com espaco ou ponto e estruturas aninhadas bloqueiam antes do mapeador', () => {
  for (const alias of ['empresa codigo', 'empresa.codigo', 'codigo empresa', 'cod.empresa']) {
    assert.throws(() => verificarMapeadorParaStaging([{
      cod_cliente: 'C-203', nome: 'Sintetico', [alias]: '001',
    }], opcoes), /vinculo empresarial legado nao comprovado/);
  }
  assert.throws(() => verificarMapeadorParaStaging([{
    cod_cliente: 'C-204', nome: 'Sintetico', 'group.id': 'outro',
  }], opcoes), /Grupo da linha diverge/);
  assert.throws(() => verificarMapeadorParaStaging([
    { cod_cliente: 'C-205', nome: 'Primeiro' },
    { cod_cliente: 'C-206', nome: 'Segundo', dados: { 'empresa-codigo': '001' } },
  ], opcoes), /aninhado nao permitido/);
});

test('pedido, fornecedor e produto fora de revenda aguardam mapeador validado', () => {
  for (const entidade of ['pedido', 'fornecedor', 'produto']) {
    assert.throws(() => verificarMapeadorParaStaging([{ codigo: '1' }], { ...opcoes, entidade }),
      /Entidade sem mapeador/);
  }
});

test('erro, empresa legada e duplicata bloqueiam lote integral sem entrega parcial', () => {
  const rows = [
    { cod_cliente: 'C-1', nome: 'Um', group_id: 'g-sint' },
    { cod_cliente: 'C-1', nome: 'Duplicado', group_id: 'g-sint' },
  ];
  const dup = verificarMapeadorParaStaging(rows, opcoes);
  assert.equal(dup.bloqueado, true);
  assert.deepEqual(dup.privados, []);
  assert.equal(dup.relatorio.reusos, 1);
  assert.throws(() => verificarMapeadorParaStaging([
    rows[0], { cod_cliente: 'C-0', nome: 'Zero', codigo_empresa: '0', group_id: 'g-sint' },
  ], opcoes), /vinculo empresarial legado nao comprovado/);
  const erro = verificarMapeadorParaStaging([rows[0], { cod_cliente: '', nome: '' }], opcoes);
  assert.equal(erro.bloqueado, true);
  assert.deepEqual(erro.privados, []);
  assert.equal(erro.relatorio.erros, 1);
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

test('Proxy na origem e recusado antes de executar trap', () => {
  let leituras = 0;
  const row = new Proxy({ cod_cliente: 'C-3', nome: 'Tres' }, {
    get(target, key) { leituras += 1; return target[key]; },
  });
  assert.throws(() => verificarMapeadorParaStaging([row], opcoes), /dinamico nao permitido/);
  assert.equal(leituras, 0);
});

test('retry entre lotes reutiliza codigo antigo sem reenviar registro ao staging', () => {
  const row = { cod_cliente: 'C-501', nome: 'Sintetico', group_id: 'g-sint' };
  const first = verificarMapeadorParaStaging([row], opcoes);
  const mapped = first.privados[0];
  const assinaturaOrigem = createHash('sha256').update(JSON.stringify({
    codigo: mapped.codigo_legado, nome: mapped.nome, descricao: mapped.descricao,
    documento: mapped.documento,
  })).digest('hex');
  const existentes = [{ entidade: 'cliente', groupId: 'g-sint', empresaId: '',
    codigoLegado: 'C-501', assinaturaOrigem }];
  const retry = verificarMapeadorParaStaging([row], { ...opcoes, existentes });
  assert.equal(retry.bloqueado, false);
  assert.deepEqual(retry.privados, []);
  assert.equal(retry.relatorio.aptos, 0);
  assert.equal(retry.relatorio.reusos, 1);

  const next = verificarMapeadorParaStaging([row, {
    cod_cliente: 'C-502', nome: 'Outro Sintetico', group_id: 'g-sint',
  }], { ...opcoes, existentes });
  assert.deepEqual(next.privados.map((item) => item.codigo_legado), ['C-502']);
  assert.equal(next.relatorio.aptos, 1);
  assert.equal(next.relatorio.reusos, 1);
});

test('mudanca no mesmo codigo legado bloqueia lote completo sem vazamento no relatorio', () => {
  const existentes = [{ entidade: 'cliente', groupId: 'g-sint', empresaId: '',
    codigoLegado: 'C-501', assinaturaOrigem: 'a'.repeat(64) }];
  const result = verificarMapeadorParaStaging([
    { cod_cliente: 'C-501', nome: 'Nome Privado Sintetico', group_id: 'g-sint' },
    { cod_cliente: 'C-502', nome: 'Outro Privado Sintetico', group_id: 'g-sint' },
  ], { ...opcoes, existentes });
  assert.equal(result.bloqueado, true);
  assert.deepEqual(result.privados, []);
  assert.equal(result.relatorio.conflitos, 1);
  assert.equal(JSON.stringify(result.relatorio).includes('Privado'), false);
  assert.equal(JSON.stringify(result.relatorio).includes('C-501'), false);
});

test('cliente mestre percorre mapper e plano de contagens sem copiar empresa', () => {
  const rows = [
    { cod_cliente: 'C-601', nome: 'Pessoa Sintetica Um', group_id: 'g-sint' },
    { cod_cliente: 'C-602', nome: 'Pessoa Sintetica Dois', group_id: 'g-sint' },
  ];
  const result = verificarMapeadorParaStaging(rows, { ...opcoes,
    contagensEsperadas: [{ entidade: 'cliente', codigoEmpresaLegado: 'grupo', quantidade: 2 }],
  });
  assert.equal(result.bloqueado, false);
  assert.equal(result.privados.length, 2);
  assert.ok(result.privados.every((item) => item.group_id === 'g-sint' && !item.empresa_id));
  assert.equal(result.relatorio.divergencias, 0);
  assert.deepEqual(result.relatorio.porEntidadeEmpresaOrigem, { 'cliente|grupo': 2 });
  assert.equal(JSON.stringify(result.relatorio).includes('Pessoa Sintetica'), false);
});

test('contagem divergente bloqueia lote inteiro depois do mapeamento', () => {
  const result = verificarMapeadorParaStaging([
    { sku: 'SKU-601', descricao: 'Produto Sintetico', group_id: 'g-sint' },
  ], { ...opcoes, entidade: 'produto_revenda',
    contagensEsperadas: [{ entidade: 'produto_revenda', codigoEmpresaLegado: 'grupo', quantidade: 2 }],
  });
  assert.equal(result.bloqueado, true);
  assert.deepEqual(result.privados, []);
  assert.equal(result.relatorio.divergencias, 1);
});

test('indice de outro Grupo nao pode participar do plano de mestres', () => {
  const rows = [{ cod_cliente: 'C-603', nome: 'Sintetico', group_id: 'g-sint' }];
  const existentes = [{ entidade: 'cliente', groupId: 'outro', empresaId: '',
    codigoLegado: 'C-601', assinaturaOrigem: 'a'.repeat(64) }];
  assert.throws(() => verificarMapeadorParaStaging(rows, { ...opcoes, existentes }), /mistura Grupos/);
  assert.throws(() => verificarMapeadorParaStaging(rows, { ...opcoes, existentes,
    contagensEsperadas: [{ entidade: 'cliente', codigoEmpresaLegado: 'grupo', quantidade: 1 }],
  }), /mistura Grupos/);
});

test('indice dinamico e recusado sem executar getters de tenant', () => {
  let leituras = 0;
  const indice = new Proxy({ groupId: 'g-sint' }, {
    get(target, key) { leituras += 1; return target[key]; },
  });
  assert.throws(() => verificarMapeadorParaStaging([
    { cod_cliente: 'C-604', nome: 'Sintetico', group_id: 'g-sint' },
  ], { ...opcoes, existentes: [indice] }), /dinamico nao permitido/);
  assert.equal(leituras, 0);
});
