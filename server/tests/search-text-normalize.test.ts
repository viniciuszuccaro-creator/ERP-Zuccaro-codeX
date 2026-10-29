import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { foldSearchText, sqlFoldAccentExpr } from '../src/domain/searchTextNormalize.js';

test('foldSearchText: paridade com picker (Aço / São José)', () => {
  assert.equal(foldSearchText('Aço CA-50'), 'aco ca-50');
  assert.equal(foldSearchText('  São José  '), 'sao jose');
  assert.equal(foldSearchText('aco'), 'aco');
  assert.ok(foldSearchText('Aço CA-50').includes(foldSearchText('aco')));
  assert.ok(foldSearchText('São José').includes(foldSearchText('sao jose')));
});

test('sqlFoldAccentExpr: translate(lower(...)) sem interpolar aspas', () => {
  const expr = sqlFoldAccentExpr("coalesce(nome,'')");
  assert.match(expr, /^translate\(lower\(coalesce\(nome,''\)\), '/);
  assert.throws(() => sqlFoldAccentExpr("nome'; drop table"), /inválida/);
  assert.throws(() => sqlFoldAccentExpr(''), /inválida/);
});

test('Postgres produto/cliente listPage dobra acentos na busca', () => {
  const produto = readFileSync('src/repositories/postgresProdutoRepository.ts', 'utf8');
  const cliente = readFileSync('src/repositories/postgresClienteRepository.ts', 'utf8');
  assert.match(produto, /foldSearchText\(filter\.search\)/);
  assert.match(produto, /sqlFoldAccentExpr\('descricao'\)/);
  assert.match(cliente, /foldSearchText\(filter\.search\)/);
  assert.match(cliente, /sqlFoldAccentExpr\("coalesce\(nome,''\)"\)/);
});
