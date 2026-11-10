import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

// Only the reviewed contacts delta; no equivalent historical layer exists.
export const clienteContatosBaseline = '0bb7313c605d0cb97ca10e7ee91094623e5407df';
export const clienteContatosHunks = {
  "server/src/services/clienteService.ts": {
    "hash": "f63695e10a83bf902ee1f9061fa267866f6fb3417e416bad419fdf86749be99c",
    "hunks": [
      [
        "import type { AuditRepository, RequestContext } from '../audit/types.js';\nimport { sanitizeClienteAudit } from '../audit/clienteAuditSnapshot.js';\nimport { restoreClienteBulkSnapshot } from './clienteBulkLifecycle.js';\nimport { correctInactiveLegacyName, enrichLegacyContacts } from './clienteLegacyNameCorrection.js';\nimport { assertClienteContatosVersion, assertContactReferences, withClienteContatosVersion } from './clienteContatos.js';\nimport { exportClientes } from './clienteExport.js';\nimport type { AppliedBulkItem } from './cadastroBulkPolicy.js';\nimport { AppError } from '../api/errors.js';\n",
        "import type { AuditRepository, RequestContext } from '../audit/types.js';\nimport { sanitizeClienteAudit } from '../audit/clienteAuditSnapshot.js';\nimport { restoreClienteBulkSnapshot } from './clienteBulkLifecycle.js';\nimport { correctInactiveLegacyName } from './clienteLegacyNameCorrection.js';\nimport { exportClientes } from './clienteExport.js';\nimport type { AppliedBulkItem } from './cadastroBulkPolicy.js';\nimport { AppError } from '../api/errors.js';\n"
      ],
      [
        "    return correctInactiveLegacyName({ repo: this.repo, audit: this.audit, rbac: this.rbacGuard }, ctx, input);\n  }\n\n  enrichLegacyContacts(ctx: RequestContext, input: unknown) {\n    return enrichLegacyContacts({ repo: this.repo, audit: this.audit, rbac: this.rbacGuard }, ctx, input);\n  }\n\n  async get(ctx: RequestContext, id: string) {\n    ctx = { ...ctx };\n    this.assertScope(ctx);\n    await this.assertPermission(ctx, 'visualizar');\n    const row = await this.repo.getById({ groupId: ctx.groupId, empresaId: ctx.empresaId }, id);\n",
        "    return correctInactiveLegacyName({ repo: this.repo, audit: this.audit, rbac: this.rbacGuard }, ctx, input);\n  }\n\n  async get(ctx: RequestContext, id: string) {\n    this.assertScope(ctx);\n    await this.assertPermission(ctx, 'visualizar');\n    const row = await this.repo.getById({ groupId: ctx.groupId, empresaId: ctx.empresaId }, id);\n"
      ],
      [
        "    if (!row || row.ativo === false) {\n      throw new AppError(404, 'CLIENTE_NOT_FOUND', 'Cliente not found in tenant scope');\n    }\n    await this.assertPermission(ctx, 'visualizar');\n    return withClienteContatosVersion(ctx, row);\n  }\n\n  /**\n",
        "    if (!row || row.ativo === false) {\n      throw new AppError(404, 'CLIENTE_NOT_FOUND', 'Cliente not found in tenant scope');\n    }\n    return row;\n  }\n\n  /**\n"
      ],
      [
        "  }\n\n  async update(ctx: RequestContext, id: string, payload: unknown) {\n    ctx = { ...ctx };\n    const parsed = clienteUpdateSchema.safeParse(payload);\n    this.assertScope(ctx);\n    await this.assertPermission(ctx, 'editar');\n    this.rejectForbiddenFields(payload);\n    if (!parsed.success) {\n      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid Cliente payload', parsed.error.flatten());\n    }\n",
        "  }\n\n  async update(ctx: RequestContext, id: string, payload: unknown) {\n    this.assertScope(ctx);\n    await this.assertPermission(ctx, 'editar');\n    this.rejectForbiddenFields(payload);\n    const parsed = clienteUpdateSchema.safeParse(payload);\n    if (!parsed.success) {\n      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid Cliente payload', parsed.error.flatten());\n    }\n"
      ],
      [
        "      if (!before || before.ativo === false) {\n        throw new AppError(404, 'CLIENTE_NOT_FOUND', 'Cliente not found in tenant scope');\n      }\n      if (parsed.data.contatos !== undefined) {\n        assertClienteContatosVersion(ctx, before, parsed.data.expectedVersion);\n        assertContactReferences(parsed.data.contatos);\n        await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, ctx.empresaId, executor);\n      }\n      if (before.source_system && before.codigo_legado && (['origem','source_system','codigo_legado','legacy_id','migration_batch'] as const)\n        .some(field => parsed.data[field] !== undefined && parsed.data[field] !== before[field])) {\n        throw new AppError(409,'LEGACY_RECONCILIATION_REQUIRED','Imported provenance is immutable');\n",
        "      if (!before || before.ativo === false) {\n        throw new AppError(404, 'CLIENTE_NOT_FOUND', 'Cliente not found in tenant scope');\n      }\n      if (before.source_system && before.codigo_legado && (['origem','source_system','codigo_legado','legacy_id','migration_batch'] as const)\n        .some(field => parsed.data[field] !== undefined && parsed.data[field] !== before[field])) {\n        throw new AppError(409,'LEGACY_RECONCILIATION_REQUIRED','Imported provenance is immutable');\n"
      ],
      [
        "\n      let updated: Cliente | null;\n      try {\n        const { expectedVersion: _version, ...fields } = parsed.data;\n        updated = await this.repo.update(scope, id, fields,executor);\n      } catch (error) {\n        this.rethrowConflict(error);\n        throw error;\n",
        "\n      let updated: Cliente | null;\n      try {\n        updated = await this.repo.update(scope, id, parsed.data,executor);\n      } catch (error) {\n        this.rethrowConflict(error);\n        throw error;\n"
      ],
      [
        "        requestId: ctx.requestId,\n        ipAddress: ctx.ipAddress,\n      },executor);\n      await this.assertPermission(ctx, 'editar', executor);\n      return withClienteContatosVersion(ctx, updated);\n    });\n  }\n\n",
        "        requestId: ctx.requestId,\n        ipAddress: ctx.ipAddress,\n      },executor);\n      return updated;\n    });\n  }\n\n"
      ]
    ]
  },
  "server/src/repositories/inMemoryClienteRepository.ts": {
    "hash": "6acb9ee581970b573048a8c296103afc9d23daa67fae187304052936fe7945a9",
    "hunks": [
      [
        "  const docNorm = normalizeDocumento(raw) || null;\n  return {\n    id,\n    contatos: null,\n    group_id: scope.groupId,\n    empresa_id: data.empresa_id ?? scope.empresaId ?? null,\n    codigo,\n",
        "  const docNorm = normalizeDocumento(raw) || null;\n  return {\n    id,\n    group_id: scope.groupId,\n    empresa_id: data.empresa_id ?? scope.empresaId ?? null,\n    codigo,\n"
      ],
      [
        "  async getById(scope: Scope, id: string,_executor?:DbQueryExecutor,_options?:{forUpdate?:boolean}): Promise<Cliente | null> {\n    const row = this.rows.get(id);\n    if (!row || row.group_id !== scope.groupId) return null;\n    return structuredClone(row);\n  }\n\n  async findByDocumento(groupId: string, documentoNormalizado: string,_executor?:DbQueryExecutor): Promise<Cliente | null> {\n",
        "  async getById(scope: Scope, id: string,_executor?:DbQueryExecutor,_options?:{forUpdate?:boolean}): Promise<Cliente | null> {\n    const row = this.rows.get(id);\n    if (!row || row.group_id !== scope.groupId) return null;\n    return row;\n  }\n\n  async findByDocumento(groupId: string, documentoNormalizado: string,_executor?:DbQueryExecutor): Promise<Cliente | null> {\n"
      ],
      [
        "    const next: Cliente = {\n      ...current,\n      ...Object.fromEntries(\n        Object.entries(data).filter(([k, v]) => k !== 'cpf_cnpj' && k !== 'documento' && v !== undefined)\n          .map(([k, v]) => [k, structuredClone(v)]),\n      ),\n      updated_at: new Date(Math.max(Date.now(), Date.parse(current.updated_at) + 1)).toISOString(),\n    } as Cliente;\n    if (data.documento !== undefined || data.cpf_cnpj !== undefined) {\n      const raw = data.documento ?? data.cpf_cnpj ?? '';\n",
        "    const next: Cliente = {\n      ...current,\n      ...Object.fromEntries(\n        Object.entries(data).filter(([k]) => k !== 'cpf_cnpj' && k !== 'documento'),\n      ),\n      updated_at: nowIso(),\n    } as Cliente;\n    if (data.documento !== undefined || data.cpf_cnpj !== undefined) {\n      const raw = data.documento ?? data.cpf_cnpj ?? '';\n"
      ],
      [
        "      throw new Error('unique constraint clientes_legacy_identity_uidx');\n    }\n    this.rows.set(id, next);\n    return structuredClone(next);\n  }\n\n  softDelete(scope: Scope, id: string,executor?:DbQueryExecutor) {\n",
        "      throw new Error('unique constraint clientes_legacy_identity_uidx');\n    }\n    this.rows.set(id, next);\n    return next;\n  }\n\n  softDelete(scope: Scope, id: string,executor?:DbQueryExecutor) {\n"
      ]
    ]
  },
  "server/src/repositories/postgresClienteRepository.ts": {
    "hash": "0d5f97cbacf2293599064f551263de5a4e24015722822f92a97d5bb2c3f0249e",
    "hunks": [
      [
        "} from './inMemoryClienteRepository.js';\nimport { reserveEntityCodigo } from './reserveEntityCodigo.js';\nimport { clienteBulkSnapshotSchema } from '../services/clienteBulkLifecycle.js';\nimport { clienteOperacaoLinksSchema, clienteContatosReplaceSchema } from './clienteTypes.js';\n\nfunction mapCliente(row: Record<string, unknown>): Cliente {\n  return {\n    ...(Object.hasOwn(row, 'contatos') ? { contatos: row.contatos === null ? null\n      : clienteContatosReplaceSchema.parse({ contatos: row.contatos, expectedVersion: '0'.repeat(64) }).contatos } : {}),\n    id: String(row.id),\n    group_id: String(row.group_id),\n    empresa_id: row.empresa_id == null ? null : String(row.empresa_id),\n",
        "} from './inMemoryClienteRepository.js';\nimport { reserveEntityCodigo } from './reserveEntityCodigo.js';\nimport { clienteBulkSnapshotSchema } from '../services/clienteBulkLifecycle.js';\nimport { clienteOperacaoLinksSchema } from './clienteTypes.js';\n\nfunction mapCliente(row: Record<string, unknown>): Cliente {\n  return {\n    id: String(row.id),\n    group_id: String(row.group_id),\n    empresa_id: row.empresa_id == null ? null : String(row.empresa_id),\n"
      ],
      [
        "    created_by: row.created_by == null ? null : String(row.created_by),\n    updated_by: row.updated_by == null ? null : String(row.updated_by),\n    created_at: String(row.created_at),\n    updated_at: String(row.contatos === undefined ? row.updated_at : row.cliente_updated_at_canonical ?? row.updated_at),\n  };\n}\n\n",
        "    created_by: row.created_by == null ? null : String(row.created_by),\n    updated_by: row.updated_by == null ? null : String(row.updated_by),\n    created_at: String(row.created_at),\n    updated_at: String(row.updated_at),\n  };\n}\n\n"
      ],
      [
        "  async getById(scope: Scope, id: string,executor?:DbQueryExecutor,options?:{forUpdate?:boolean}): Promise<Cliente | null> {\n    if(options?.forUpdate&&!executor)throw new Error('CLIENTE_ROW_LOCK_REQUIRES_TRANSACTION');\n    const result = await (executor??this.db).query(\n      `SELECT c.*, to_char(c.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS cliente_updated_at_canonical\n       FROM clientes c WHERE group_id = $1 AND id = $2${options?.forUpdate?' FOR UPDATE':''}`,\n      [scope.groupId, id],\n    );\n    const row = result.rows[0] as Record<string, unknown> | undefined;\n",
        "  async getById(scope: Scope, id: string,executor?:DbQueryExecutor,options?:{forUpdate?:boolean}): Promise<Cliente | null> {\n    if(options?.forUpdate&&!executor)throw new Error('CLIENTE_ROW_LOCK_REQUIRES_TRANSACTION');\n    const result = await (executor??this.db).query(\n      `SELECT * FROM clientes WHERE group_id = $1 AND id = $2${options?.forUpdate?' FOR UPDATE':''}`,\n      [scope.groupId, id],\n    );\n    const row = result.rows[0] as Record<string, unknown> | undefined;\n"
      ],
      [
        "    if(!executor)return this.db.withTransaction(q=>this.update(scope,id,data,q));\n    const current = await this.getById(scope, id,executor,{forUpdate:true});\n    if (!current) return null;\n    if (data.contatos !== undefined && current.contatos === undefined) {\n      throw new AppError(503, 'CLIENTE_CONTATOS_STORAGE_REQUIRED', 'Reviewed contacts schema required');\n    }\n    const rawDoc = data.documento !== undefined || data.cpf_cnpj !== undefined\n      ? (data.documento ?? data.cpf_cnpj ?? '')\n      : undefined;\n",
        "    if(!executor)return this.db.withTransaction(q=>this.update(scope,id,data,q));\n    const current = await this.getById(scope, id,executor,{forUpdate:true});\n    if (!current) return null;\n    const rawDoc = data.documento !== undefined || data.cpf_cnpj !== undefined\n      ? (data.documento ?? data.cpf_cnpj ?? '')\n      : undefined;\n"
      ],
      [
        "        nome=$5, razao_social=$6, nome_fantasia=$7, nome_social=$8,\n        inscricao_estadual=$9, inscricao_municipal=$10, email=$11, telefone=$12, celular=$13,\n        status=$14, origem=$15, codigo_legado=$16, legacy_id=$17, source_system=$18,\n        migration_batch=$19, observacoes=$20, ativo=$21${data.contatos === undefined ? '' : ', contatos=$24::jsonb'}\n       WHERE group_id=$22 AND id=$23\n       RETURNING *, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS cliente_updated_at_canonical`,\n      [\n        next.empresa_id, next.tipo, next.documento, next.documento_normalizado,\n        next.nome, next.razao_social, next.nome_fantasia, next.nome_social,\n",
        "        nome=$5, razao_social=$6, nome_fantasia=$7, nome_social=$8,\n        inscricao_estadual=$9, inscricao_municipal=$10, email=$11, telefone=$12, celular=$13,\n        status=$14, origem=$15, codigo_legado=$16, legacy_id=$17, source_system=$18,\n        migration_batch=$19, observacoes=$20, ativo=$21\n       WHERE group_id=$22 AND id=$23\n       RETURNING *`,\n      [\n        next.empresa_id, next.tipo, next.documento, next.documento_normalizado,\n        next.nome, next.razao_social, next.nome_fantasia, next.nome_social,\n"
      ],
      [
        "        next.status, next.origem, next.codigo_legado, next.legacy_id, next.source_system,\n        next.migration_batch, next.observacoes, next.ativo,\n        scope.groupId, id,\n        ...(data.contatos === undefined ? [] : [data.contatos === null ? null : JSON.stringify(data.contatos)]),\n      ],\n    );\n    const row = result.rows[0] as Record<string, unknown> | undefined;\n",
        "        next.status, next.origem, next.codigo_legado, next.legacy_id, next.source_system,\n        next.migration_batch, next.observacoes, next.ativo,\n        scope.groupId, id,\n      ],\n    );\n    const row = result.rows[0] as Record<string, unknown> | undefined;\n"
      ]
    ]
  }
};
const hash = text => createHash('sha256').update(text).digest('hex');

/** Always verify the entire previous file, even when ancestor checks disable their own hash. */
export function clienteContatosRemainder(file, text) {
  const entry = clienteContatosHunks[file];
  if (!entry) return text;
  let source = text.replace(/\r\n/g, '\n');
  if (hash(source) === entry.hash) return text;
  for (const [after, before] of entry.hunks) {
    assert.equal(source.split(after).length, 2, file + ': exact contacts hunk');
    source = source.replace(after, () => before);
  }
  assert.equal(hash(source), entry.hash, file + ': entire pre-contacts source at ' + clienteContatosBaseline);
  return text.includes('\r\n') ? source.replace(/\n/g, '\r\n') : source;
}

/** Historical callers may already have peeled selected-reference hunks. Their own pins still apply. */
const historicalInputHashes = {"server/src/services/clienteService.ts":"2c711fb1d47d5ba53e2c0e0099ec75d816a3746bcc583b77df6d0d0d0517578f","server/src/repositories/inMemoryClienteRepository.ts":"cb2811d0bcb37f4f5f114955d4de9ff5766fdddfe3e3a92aca1a55bda9fc0db5","server/src/repositories/postgresClienteRepository.ts":"f0b68691a479dc10758c2680ff4e2c0a40b0142ffcdaa02af19a1a9e038ab348"};
export function clienteContatosHistoricalInput(file, text, selectedReference) {
  const entry = clienteContatosHunks[file];
  if (!entry) return text;
  const source = text.replace(/\r\n/g, '\n');
  if (hash(source) === historicalInputHashes[file]) return text;
  return selectedReference(clienteContatosRemainder(file, text));
}

