import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

import { normalizeMasterQuery } from '../src/components/comercial/comercialMasterPicker.js';

test('normalizeMasterQuery frontend: aco encontra Aço; sao jose encontra São José', () => {
  assert.equal(normalizeMasterQuery('Aço CA-50').includes(normalizeMasterQuery('aco')), true);
  assert.equal(normalizeMasterQuery('São José').includes(normalizeMasterQuery('sao jose')), true);
});

test('server searchTextNormalize alinhado ao picker e consumido nos repositórios', () => {
  const domain = fs.readFileSync('server/src/domain/searchTextNormalize.ts', 'utf8');
  assert.match(domain, /export function foldSearchText/);
  assert.match(domain, /export function sqlFoldAccentExpr/);
  const produto = fs.readFileSync('server/src/repositories/postgresProdutoRepository.ts', 'utf8');
  const cliente = fs.readFileSync('server/src/repositories/postgresClienteRepository.ts', 'utf8');
  assert.match(produto, /foldSearchText/);
  assert.match(produto, /sqlFoldAccentExpr/);
  assert.match(cliente, /foldSearchText/);
  assert.match(cliente, /sqlFoldAccentExpr/);
  // Clientes/produtos HTTP usam search no list — server dobra acentos no repositório
  const http = fs.readFileSync('src/api/httpApiClient.js', 'utf8');
  assert.ok(http.includes("/api/v1/clientes"));
  assert.ok(http.includes("/api/v1/produtos"));
});
