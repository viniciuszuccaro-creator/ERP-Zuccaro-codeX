import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { ProdutoRepository } from '../src/repositories/inMemoryProdutoRepository.js';
import type { Scope } from '../src/services/tenantCrudService.js';

export async function assertProdutoRelationsContract(
  repo: ProdutoRepository,
  scope: Scope,
  produtoId: string,
  targetId: string,
  otherEmpresaId: string,
) {
  const sku = `R10-${randomUUID()}`;
  const variant = await repo.withTransaction((tx) => repo.createVariant(
    scope, produtoId, { sku, nome: 'Variacao sintetica', atributos: { cor: 'Azul' } }, tx,
  ));
  assert.equal(variant.nome, 'Variacao sintetica');
  assert.equal((await repo.listVariants(scope, produtoId))[0]?.nome, 'Variacao sintetica');
  const updatedVariant = await repo.withTransaction((tx) => repo.updateVariant(
    scope, produtoId, variant.id, { nome: 'Revisada', atributos: { cor: 'Verde' } }, tx,
  ));
  assert.equal(updatedVariant?.sku, sku);
  assert.equal(updatedVariant?.atributos.cor, 'Verde');
  await assert.rejects(
    repo.withTransaction((tx) => repo.createVariant(scope, produtoId, {
      sku: sku.toLowerCase(), atributos: {},
    }, tx)),
    /unique|duplicate/i,
  );
  const foreign = { ...scope, empresaId: otherEmpresaId };
  assert.deepEqual(await repo.listVariants(foreign, produtoId), []);
  assert.equal(await repo.withTransaction((tx) => repo.updateVariant(
    foreign, produtoId, variant.id, { nome: 'Intruso' }, tx)), null);

  const equivalent = await repo.withTransaction((tx) => repo.createEquivalent(scope, produtoId, {
    produto_equivalente_id: targetId, tipo: 'SUBSTITUTO', direcional: true, aprovado: false,
  }, tx));
  assert.equal((await repo.listEquivalents(scope, produtoId))[0]?.id, equivalent.id);
  assert.deepEqual(await repo.listEquivalents(foreign, produtoId), []);
  assert.equal(await repo.withTransaction((tx) => repo.updateEquivalent(
    foreign, produtoId, equivalent.id, { aprovado: true }, tx)), null);
  const updatedEquivalent = await repo.withTransaction((tx) => repo.updateEquivalent(
    scope, produtoId, equivalent.id, { aprovado: true }, tx,
  ));
  assert.equal(updatedEquivalent?.aprovado, true);
  assert.equal(updatedEquivalent?.produto_equivalente_id, targetId);
  await assert.rejects(repo.withTransaction((tx) => repo.createEquivalent(scope, produtoId, {
    produto_equivalente_id: targetId, tipo: 'SUBSTITUTO', direcional: false, aprovado: false,
  }, tx)), /unique|duplicate/i);
  await assert.rejects(repo.withTransaction((tx) => repo.createEquivalent(scope, produtoId, {
    produto_equivalente_id: produtoId, tipo: 'EQUIVALENTE', direcional: false, aprovado: false,
  }, tx)), /check constraint|self/i);

  const rollbackSku = `RB-${randomUUID()}`;
  await assert.rejects(repo.withTransaction(async (tx) => {
    await repo.createVariant(scope, produtoId, { sku: rollbackSku, atributos: {} }, tx);
    throw new Error('ROLLBACK_CONTRACT');
  }), /ROLLBACK_CONTRACT/);
  assert.equal((await repo.listVariants(scope, produtoId)).some((row) => row.sku === rollbackSku), false);

  const inactiveVariant = await repo.withTransaction((tx) => repo.deactivateVariant(scope, produtoId, variant.id, tx));
  assert.equal(inactiveVariant?.ativo, false);
  assert.equal(await repo.withTransaction((tx) => repo.updateVariant(
    scope, produtoId, variant.id, { nome: 'Reativada' }, tx)), null);
  assert.equal(await repo.withTransaction((tx) => repo.deactivateVariant(
    scope, produtoId, variant.id, tx)), null);
  const inactiveEquivalent = await repo.withTransaction((tx) => repo.deactivateEquivalent(scope, produtoId, equivalent.id, tx));
  assert.equal(inactiveEquivalent?.ativo, false);
  assert.equal(await repo.withTransaction((tx) => repo.updateEquivalent(
    scope, produtoId, equivalent.id, { aprovado: false }, tx)), null);
  assert.equal(await repo.withTransaction((tx) => repo.deactivateEquivalent(
    scope, produtoId, equivalent.id, tx)), null);
  assert.deepEqual(await repo.listVariants(scope, produtoId), []);
  assert.deepEqual(await repo.listEquivalents(scope, produtoId), []);
}
