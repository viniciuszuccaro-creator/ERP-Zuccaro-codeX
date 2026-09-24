
export async function assertProdutoMediaContract(
  repo: ProdutoRepository, scope: Scope, produtoId: string, otherEmpresaId: string,
) {
  if (!scope.empresaId) throw new Error('TEST_REQUIRES_COMPANY');
  const storageKey = `groups/${scope.groupId}/companies/${scope.empresaId}/products/${produtoId}/images/${randomUUID()}-media.png`;
  const data = {
    storage_key: storageKey, categoria: 'IMAGEM' as const, nome_arquivo: 'media.png',
    mime_type: 'image/png', tamanho_bytes: 123, sha256: 'a'.repeat(64), versao: 1,
  };
  const created = await repo.withTransaction((tx) => repo.createMidia(scope, produtoId, data, tx));
  assert.ok(created);
  assert.equal(created.status, 'QUARENTENA');
  assert.equal(created.principal, false);
  assert.equal(created.empresa_id, scope.empresaId);
  assert.equal(created.tamanho_bytes, 123);
  assert.deepEqual((await repo.listMidias(scope, produtoId)).map((row) => row.id), [created.id]);
  const second = await repo.withTransaction((tx) => repo.createMidia(scope, produtoId, {
    ...data, storage_key: `${storageKey}-second`, versao: 2,
  }, tx));
  assert.ok(second);
  assert.deepEqual((await repo.listMidias(scope, produtoId, undefined, { limit: 1, offset: 0 })).map((row) => row.id), [created.id]);
  assert.deepEqual((await repo.listMidias(scope, produtoId, undefined, { limit: 1, offset: 1 })).map((row) => row.id), [second.id]);
  assert.deepEqual(await repo.listMidias(scope, produtoId, undefined, { limit: 1, offset: 2 }), []);
  assert.deepEqual(await repo.listMidias({ ...scope, empresaId: otherEmpresaId }, produtoId, undefined, { limit: 1, offset: 0 }), []);
  await repo.withTransaction((tx) => repo.deactivateMidia(scope, produtoId, second.id, tx));
  const foreign = { ...scope, empresaId: otherEmpresaId };
  assert.deepEqual(await repo.listMidias(foreign, produtoId), []);
  const foreignData = { ...data, storage_key: storageKey.replace(
    `/companies/${scope.empresaId}/`, `/companies/${otherEmpresaId}/`,
  ) };
  assert.equal(await repo.withTransaction((tx) => repo.createMidia(foreign, produtoId, foreignData, tx)), null);
  assert.equal(await repo.withTransaction((tx) => repo.deactivateMidia(foreign, produtoId, created.id, tx)), null);
  await assert.rejects(repo.withTransaction((tx) => repo.createMidia(scope, produtoId, data, tx)), /unique|duplicate/i);
  await assert.rejects(repo.withTransaction((tx) => repo.createMidia(scope, produtoId,
    { ...data, versao: 2 }, tx)), /unique|duplicate/i);
  await assert.rejects(repo.withTransaction((tx) => repo.createMidia(scope, produtoId, {
    ...data, storage_key: `groups/${randomUUID()}/companies/${scope.empresaId}/products/${produtoId}/images/bad.png`,
  }, tx)), /TENANT_FK_MISMATCH/);
  const rollbackData = { ...data, storage_key: `${storageKey}-rollback` };
  await assert.rejects(repo.withTransaction(async (tx) => {
    await repo.createMidia(scope, produtoId, rollbackData, tx);
    throw new Error('MEDIA_ROLLBACK');
  }), /MEDIA_ROLLBACK/);
  assert.equal((await repo.listMidias(scope, produtoId)).some((row) => row.storage_key === rollbackData.storage_key), false);
  await assert.rejects(repo.withTransaction(async (tx) => {
    await repo.deactivateMidia(scope, produtoId, created.id, tx);
    throw new Error('MEDIA_ROLLBACK');
  }), /MEDIA_ROLLBACK/);
  assert.equal((await repo.listMidias(scope, produtoId))[0]?.id, created.id);
  const inactive = await repo.withTransaction((tx) => repo.deactivateMidia(scope, produtoId, created.id, tx));
  assert.equal(inactive?.status, 'INATIVO');
  assert.equal(inactive?.ativo, false);
  const reservedData = { ...data, storage_key: `${storageKey}-reserved` };
  const attempt = {
    id: randomUUID(), actorId: randomUUID(), requestId: 'synthetic-media-reservation',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
  const reserved = await repo.withTransaction((tx) => repo.reserveMidia(scope, produtoId, reservedData, attempt, tx));
  assert.ok(reserved);
  assert.equal(reserved.status, 'PENDENTE_UPLOAD');
  assert.equal(reserved.upload_attempt_id, attempt.id);
  assert.deepEqual(await repo.listMidias(scope, produtoId), []);
  assert.equal(await repo.withTransaction((tx) => repo.getReservedMidia(
    foreign, produtoId, reserved.id, attempt.id, attempt.actorId, tx)), null);
  assert.equal(await repo.withTransaction((tx) => repo.getReservedMidia(
    scope, produtoId, reserved.id, attempt.id, randomUUID(), tx)), null);
  assert.equal((await repo.withTransaction((tx) => repo.getReservedMidia(
    scope, produtoId, reserved.id, attempt.id, attempt.actorId, tx)))?.id, reserved.id);
  await assert.rejects(repo.withTransaction((tx) => repo.reserveMidia(
    scope, produtoId, reservedData, { ...attempt, id: randomUUID() }, tx)), /unique|duplicate/i);
  await assert.rejects(repo.withTransaction((tx) => repo.reserveMidia(
    scope, produtoId, { ...data, storage_key: `${storageKey}-expired` },
    { ...attempt, id: randomUUID(), expiresAt: new Date(Date.now() - 60_000).toISOString() }, tx,
  )), /MEDIA_ATTEMPT_INVALID/);
  await assert.rejects(repo.withTransaction((tx) => repo.reserveMidia(
    scope, produtoId, { ...data, storage_key: `${storageKey}-same-attempt` },
    attempt, tx,
  )), /unique|duplicate/i);
  assert.deepEqual(await repo.listMidias(foreign, produtoId), []);
  assert.equal(await repo.withTransaction((tx) => repo.confirmReservedMidia(
    scope, produtoId, reserved.id, attempt.id, randomUUID(), tx)), null);
  await assert.rejects(repo.withTransaction(async (tx) => {
    await repo.confirmReservedMidia(scope, produtoId, reserved.id, attempt.id, attempt.actorId, tx);
    throw new Error('MEDIA_RESERVATION_ROLLBACK');
  }), /MEDIA_RESERVATION_ROLLBACK/);
  assert.equal((await repo.withTransaction((tx) => repo.getReservedMidia(
    scope, produtoId, reserved.id, attempt.id, attempt.actorId, tx)))?.status, 'PENDENTE_UPLOAD');
  const confirmed = await repo.withTransaction((tx) => repo.confirmReservedMidia(
    scope, produtoId, reserved.id, attempt.id, attempt.actorId, tx));
  assert.equal(confirmed?.status, 'QUARENTENA');
  assert.equal(await repo.withTransaction((tx) => repo.confirmReservedMidia(
    scope, produtoId, reserved.id, attempt.id, attempt.actorId, tx)), null);
  assert.deepEqual((await repo.listMidias(scope, produtoId)).map((row) => row.id), [reserved.id]);
  await repo.withTransaction((tx) => repo.deactivateMidia(scope, produtoId, reserved.id, tx));
  assert.deepEqual(await repo.listMidias(scope, produtoId), []);
  await assert.rejects(repo.withTransaction((tx) => repo.createMidia(scope, produtoId,
    { ...data, versao: 3 }, tx)), /unique|duplicate/i);
  assert.equal(await repo.withTransaction((tx) => repo.deactivateMidia(scope, produtoId, created.id, tx)), null);
}
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
