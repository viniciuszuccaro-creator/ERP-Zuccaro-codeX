import { randomUUID } from 'node:crypto';
import type { AuditRepository, RequestContext } from '../audit/types.js';
import { AppError } from '../api/errors.js';
import type { TenantGuard } from '../db/tenantGuard.js';
import type { RbacGuard } from '../db/rbacGuard.js';
import type { ProdutoRepository } from '../repositories/inMemoryProdutoRepository.js';
import {
  produtoEquivalenteCreateSchema, produtoMidiaCreateSchema,
  type ProdutoMidia, type ProdutoMidiaCreate,
} from '../repositories/produtoTypes.js';
import { NotImplementedStorage, type StoragePort, type StorageUploadRequest } from './storagePort.js';

type Dependencies = {
  repo: ProdutoRepository;
  audit: AuditRepository;
  tenantGuard: TenantGuard;
  rbacGuard: RbacGuard;
  storage: StoragePort;
};

const FOLDER: Partial<Record<ProdutoMidia['categoria'], string>> = {
  IMAGEM: 'images', VIDEO: 'videos', DESENHO: 'documents',
  MANUAL: 'manuals', CERTIFICADO: 'certificates',
};

function assertId(id: string): void {
  if (!produtoEquivalenteCreateSchema.shape.produto_equivalente_id.safeParse(id).success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid media or product id');
  }
}

async function authorize(deps: Dependencies, ctx: RequestContext, produtoId: string) {
  if (!ctx.groupId) throw new AppError(400, 'GROUP_ID_REQUIRED', 'groupId is required');
  if (!ctx.empresaId) throw new AppError(400, 'EMPRESA_ID_REQUIRED', 'empresaId is required for media');
  if (!ctx.actorId) throw new AppError(403, 'PERMISSION_DENIED', 'Actor is required for media');
  if (!ctx.requestId) throw new AppError(400, 'REQUEST_ID_REQUIRED', 'requestId is required');
  assertId(produtoId);
  await deps.rbacGuard.assertAllowed(ctx, 'Cadastros', 'produto', 'editar');
  await deps.tenantGuard.assertEmpresaInGroup(ctx.groupId, ctx.empresaId);
  if (deps.storage instanceof NotImplementedStorage) {
    throw new AppError(503, 'STORAGE_ADAPTER_NOT_CONFIGURED', 'Storage is not configured');
  }
  return { groupId: ctx.groupId, empresaId: ctx.empresaId };
}

export function checkProdutoMidiaPath(ctx: RequestContext, produtoId: string, data: ProdutoMidiaCreate): void {
  const prefix = `groups/${ctx.groupId}/companies/${ctx.empresaId}/products/${produtoId}/`;
  if (!data.storage_key.startsWith(prefix)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Media path outside tenant scope');
  }
  const folder = FOLDER[data.categoria];
  if (!folder) throw new AppError(409, 'MEDIA_CATEGORY_NOT_CONFIGURED', 'Media category is not supported by Storage');
  if (!data.storage_key.startsWith(`${prefix}${folder}/`)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Media category does not match storage path');
  }
}

function storageRequest(ctx: RequestContext, produtoId: string, data: ProdutoMidiaCreate): StorageUploadRequest {
  return {
    groupId: ctx.groupId, empresaId: ctx.empresaId, actorId: ctx.actorId!,
    entity: 'Produto', entityId: produtoId,
    storageKey: data.storage_key, fileName: data.nome_arquivo,
    mimeType: data.mime_type, sizeBytes: data.tamanho_bytes, sha256: data.sha256,
  };
}
export async function listProdutoMidias(deps: Dependencies, ctx: RequestContext, produtoId: string) {
  if (!ctx.groupId) throw new AppError(400, 'GROUP_ID_REQUIRED', 'groupId is required');
  assertId(produtoId);
  await deps.rbacGuard.assertAllowed(ctx, 'Cadastros', 'produto', 'visualizar');
  await deps.tenantGuard.assertEmpresaInGroup(ctx.groupId, ctx.empresaId);
  const scope = { groupId: ctx.groupId, empresaId: ctx.empresaId };
  const produto = await deps.repo.getById(scope, produtoId);
  if (!produto || !produto.ativo) {
    throw new AppError(404, 'PRODUTO_NOT_FOUND', 'Produto not found in tenant scope');
  }
  return deps.repo.listMidias(scope, produtoId);
}


export async function reserveProdutoMidia(deps: Dependencies, ctx: RequestContext, produtoId: string, payload: unknown) {
  const scope = await authorize(deps, ctx, produtoId);
  const parsed = produtoMidiaCreateSchema.safeParse(payload);
  if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid Produto media payload', parsed.error.flatten());
  const data = parsed.data;
  checkProdutoMidiaPath(ctx, produtoId, data);
  const attempt = {
    id: randomUUID(), actorId: ctx.actorId!, requestId: ctx.requestId,
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000 + 5 * 60 * 1000).toISOString(),
  };
  const reserved = await deps.repo.withTransaction(async (executor) => {
    const produto = await deps.repo.getById(scope, produtoId, executor, { forUpdate: true });
    if (!produto || !produto.ativo || produto.empresa_id !== scope.empresaId) {
      throw new AppError(404, 'PRODUTO_NOT_FOUND', 'Produto not found in tenant scope');
    }
    let row: ProdutoMidia | null;
    try {
      row = await deps.repo.reserveMidia(scope, produtoId, data, attempt, executor);
    } catch (error) {
      if (/unique|duplicate/i.test(error instanceof Error ? error.message : String(error))) {
        throw new AppError(409, 'MEDIA_RESERVATION_CONFLICT', 'Media key is already reserved');
      }
      throw error;
    }
    if (!row) throw new AppError(404, 'PRODUTO_NOT_FOUND', 'Produto not found in tenant scope');
    await deps.audit.append({
      groupId: ctx.groupId, empresaId: ctx.empresaId, actorId: ctx.actorId,
      actorEmail: ctx.actorEmail, entity: 'ProdutoMidia', entityId: row.id, action: 'create',
      afterData: { categoria: row.categoria, versao: row.versao, status: row.status, tamanho_bytes: row.tamanho_bytes },
      requestId: ctx.requestId, ipAddress: ctx.ipAddress,
    }, executor);
    return row;
  });
  const signed = await deps.storage.createSignedUploadUrl(storageRequest(ctx, produtoId, data));
  return { mediaId: reserved.id, attemptId: attempt.id, ...signed };
}

export async function confirmProdutoMidia(
  deps: Dependencies, ctx: RequestContext, produtoId: string, mediaId: string, attemptId: string,
) {
  const scope = await authorize(deps, ctx, produtoId);
  assertId(mediaId);
  assertId(attemptId);
  return deps.repo.withTransaction(async (executor) => {
    const produto = await deps.repo.getById(scope, produtoId, executor, { forUpdate: true });
    if (!produto || !produto.ativo || produto.empresa_id !== scope.empresaId) {
      throw new AppError(404, 'PRODUTO_NOT_FOUND', 'Produto not found in tenant scope');
    }
    const before = await deps.repo.getReservedMidia(scope, produtoId, mediaId, attemptId, ctx.actorId!, executor);
    if (!before) throw new AppError(404, 'MEDIA_RESERVATION_NOT_FOUND', 'Media reservation not found in tenant scope');
    if (!before.upload_expires_at || new Date(before.upload_expires_at).getTime() <= Date.now()) {
      throw new AppError(409, 'MEDIA_RESERVATION_EXPIRED', 'Media reservation expired');
    }
    const data = {
      storage_key: before.storage_key, categoria: before.categoria, nome_arquivo: before.nome_arquivo,
      mime_type: before.mime_type, tamanho_bytes: before.tamanho_bytes,
      sha256: before.sha256, versao: before.versao,
    };
    checkProdutoMidiaPath(ctx, produtoId, data);
    const verified = await deps.storage.confirmUpload(storageRequest(ctx, produtoId, data));
    if (verified.storageKey !== data.storage_key || verified.fileName !== data.nome_arquivo
      || verified.mimeType !== data.mime_type || verified.sizeBytes !== data.tamanho_bytes
      || verified.sha256 !== data.sha256 || verified.version !== data.versao) {
      throw new AppError(409, 'STORAGE_METADATA_MISMATCH', 'Media metadata differs from verified object');
    }
    const after = await deps.repo.confirmReservedMidia(scope, produtoId, mediaId, attemptId, ctx.actorId!, executor);
    if (!after) throw new AppError(409, 'MEDIA_RESERVATION_CONFLICT', 'Media reservation cannot be confirmed');
    await deps.audit.append({
      groupId: ctx.groupId, empresaId: ctx.empresaId, actorId: ctx.actorId,
      actorEmail: ctx.actorEmail, entity: 'ProdutoMidia', entityId: mediaId, action: 'change_status',
      beforeData: { categoria: before.categoria, versao: before.versao, status: before.status },
      afterData: { categoria: after.categoria, versao: after.versao, status: after.status },
      requestId: ctx.requestId, ipAddress: ctx.ipAddress,
    }, executor);
    return after;
  });
}
