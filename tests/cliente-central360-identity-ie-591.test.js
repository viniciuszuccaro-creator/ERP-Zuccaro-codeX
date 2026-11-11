/**
 * #591 — IE/IM/obs no identity Central360 (API→UI).
 * Campos já no row Cliente; não inventar; obs só com sensível.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const service = readFileSync('server/src/services/clienteCentral360Service.ts', 'utf8');
const panel = readFileSync('src/components/comercial/CentralCliente360Panel.jsx', 'utf8');

test('projectIdentity tipa e projeta IE/IM; obs gated por canViewSensitive', () => {
  assert.match(service, /inscricao_estadual: string \| null;/);
  assert.match(service, /inscricao_municipal: string \| null;/);
  assert.match(service, /observacoes: string \| null;/);
  assert.match(service, /inscricao_estadual: row\.inscricao_estadual/);
  assert.match(service, /inscricao_municipal: row\.inscricao_municipal/);
  assert.match(service, /observacoes: canViewSensitive \? row\.observacoes : null/);
});

test('Cliente360 painel exibe IE/IM/obs com classificação não autorizado', () => {
  assert.match(panel, /data-campo="inscricao_estadual"/);
  assert.match(panel, /data-campo="inscricao_municipal"/);
  assert.match(panel, /data-campo="observacoes"/);
  assert.match(panel, /Não autorizado ao perfil/);
});

test('projectLocal e painel: endereço incompleto ≠ completo', () => {
  assert.match(service, /endereco_incompleto: incompleto/);
  assert.match(service, /logradouro: incompleto \? null/);
  assert.match(panel, /data-campo="endereco_incompleto"/);
  assert.match(panel, /Endereço incompleto/);
  assert.match(panel, /data-campo="localidade"/);
});
