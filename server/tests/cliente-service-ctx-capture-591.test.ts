/**
 * Contraprovas #591 / pareceres 6779707769 + 6780153153:
 * GET reautoriza após leitura; UPDATE captura ctx+payload antes do 1º await.
 * Fronteiras repo/audit/RBAC sintéticas — sem HTTP/PG real.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { AppError } from '../src/api/errors.ts';
import type { AuditRepository, RequestContext } from '../src/audit/types.ts';
import type { RbacAction, RbacGuard } from '../src/db/rbacGuard.ts';
import type { TenantGuard } from '../src/db/tenantGuard.ts';
import { InMemoryClienteRepository } from '../src/repositories/inMemoryClienteRepository.ts';
import { ClienteService } from '../src/services/clienteService.ts';

const GROUP = '11111111-1111-4111-8111-111111111111';
const EMPRESA = '33333333-3333-4333-8333-333333333333';
const ACTOR_A = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const ACTOR_B = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';

function baseCtx(actorId: string): RequestContext {
  return {
    groupId: GROUP,
    empresaId: EMPRESA,
    actorId,
    actorEmail: `${actorId}@test.dev`,
    requestId: `req-${actorId}`,
    ipAddress: '127.0.0.1',
  };
}

class MutatingRbac implements RbacGuard {
  allowed = true;
  calls = 0;
  onAfterFirst?: () => void;
  async assertAllowed(
    _ctx: RequestContext,
    _module: string,
    _resource: string,
    _action: RbacAction,
  ): Promise<void> {
    this.calls += 1;
    if (!this.allowed) throw new AppError(403, 'PERMISSION_DENIED', 'Permission denied');
    // Revoga só depois da checagem atual — simula await entre get e reauth.
    if (this.calls === 1 && this.onAfterFirst) this.onAfterFirst();
  }
}

class CapturingAudit implements AuditRepository {
  entries: Array<{ actorId: string; afterData: unknown }> = [];
  async append(entry: any) {
    this.entries.push({ actorId: entry.actorId, afterData: entry.afterData });
    return entry;
  }
  async listByEntity() { return []; }
}

class StaticTenant implements TenantGuard {
  async assertEmpresaInGroup() { /* ok */ }
}

test('GET: revogação durante leitura nega na reautorização (captura ctx)', async () => {
  const repo = new InMemoryClienteRepository();
  const rbac = new MutatingRbac();
  const service = new ClienteService(repo, new CapturingAudit() as any, new StaticTenant() as any, rbac);
  const created = await service.create(baseCtx(ACTOR_A), {
    tipo: 'Pessoa Física',
    documento: '529.982.247-25',
    nome: 'SYNTHETIC capture get',
  });
  rbac.calls = 0;
  rbac.onAfterFirst = () => { rbac.allowed = false; };
  await assert.rejects(
    () => service.get(baseCtx(ACTOR_A), created.id),
    (err: any) => err?.statusCode === 403 && err?.code === 'PERMISSION_DENIED',
  );
  assert.ok(rbac.calls >= 2, 'reautorização após getById');
});

test('UPDATE: ctx.actorId+payload adulterados no 1º await usam intenção/ator capturados', async () => {
  const repo = new InMemoryClienteRepository();
  const audit = new CapturingAudit();
  const rbac = new MutatingRbac();
  const service = new ClienteService(repo, audit as any, new StaticTenant() as any, rbac);
  const created = await service.create(baseCtx(ACTOR_A), {
    tipo: 'Pessoa Física',
    documento: '390.533.447-05',
    nome: 'SYNTHETIC capture update',
  });

  const ctx = baseCtx(ACTOR_A);
  const payload: Record<string, unknown> = { nome: 'NOME_A' };
  rbac.calls = 0;
  rbac.onAfterFirst = () => {
    ctx.actorId = ACTOR_B;
    payload.nome = 'NOME_ADULTERADO_B';
  };

  const updated = await service.update(ctx, created.id, payload);
  assert.equal(updated.nome, 'NOME_A');
  const last = audit.entries.at(-1);
  assert.equal(last?.actorId, ACTOR_A);
  assert.equal((last?.afterData as any)?.nome, 'NOME_A');
});

test('serviço: enrichLegacyContacts permanece delegado publicamente', () => {
  const service = new ClienteService(
    new InMemoryClienteRepository(),
    new CapturingAudit() as any,
    new StaticTenant() as any,
    new MutatingRbac(),
  );
  assert.equal(typeof service.enrichLegacyContacts, 'function');
});
