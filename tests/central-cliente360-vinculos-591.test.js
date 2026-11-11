/**
 * #591 — Vínculos comerciais Central360 (estados; sem inventar FK).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { classifyCentral360Vinculos } from '../src/components/comercial/centralCliente360Vinculos.js';

const panel = readFileSync('src/components/comercial/CentralCliente360Panel.jsx', 'utf8');

test('vinculos: absent / empty / present_bff / forbidden', () => {
  assert.equal(classifyCentral360Vinculos({}, { forbidden: true }).status, 'forbidden');
  assert.equal(classifyCentral360Vinculos({ id: 'x' }).status, 'absent');
  assert.equal(classifyCentral360Vinculos({
    vendedor_responsavel_id: '',
    indicador_id: '',
    regiao_atendimento_id: '',
  }).status, 'empty');
  const present = classifyCentral360Vinculos({
    vendedor_responsavel_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    vendedor_responsavel: 'Ana',
    indicador_id: '',
    regiao_atendimento_id: null,
  });
  assert.equal(present.status, 'present_bff_pending');
  assert.equal(present.fields.find((f) => f.key === 'vendedor_responsavel_id').text, 'Ana');
  assert.equal(present.fields.find((f) => f.key === 'regiao_atendimento_id').status, 'unknown');
});

test('CentralCliente360Panel: bloco vínculos reutiliza GET MASTER', () => {
  assert.match(panel, /data-block="central360-vinculos-master"/);
  assert.match(panel, /classifyCentral360Vinculos/);
  assert.match(panel, /data-vinculo-estado=/);
  assert.equal((panel.match(/entities\?\.Cliente/g) || []).length, 1);
});
