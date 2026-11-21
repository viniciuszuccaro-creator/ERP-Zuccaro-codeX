import type { Express } from 'express';
import type { DbClient } from '../db/client.js';
import type { RbacGuard } from '../db/rbacGuard.js';
import { requireTenantScope } from '../middleware/requestContext.js';
import { reopenAssistedClientReview } from '../services/legacyClientReviewRead.js';
import { saveAssistedClientDocumentCorrection } from '../services/legacyClientReviewCorrection.js';
import { prepareAssistedReviewProposal } from '../services/legacyClientReviewProposal.js';
import { PostgresAuditRepository } from '../audit/auditRepository.js';
import { isValidCnpj, isValidCpf } from '../db/documentoValidators.js';
import { z } from 'zod';
import { AppError } from './errors.js';

const identityPart = /^[a-z0-9_.:-]{1,80}$/i;
const fingerprint = z.string().regex(/^[a-f0-9]{64}$/);
const draftSchema = z.object({
  operationId: z.string().uuid(),
  expectedSourceFingerprint: fingerprint,
  field: z.enum(['cpf', 'cnpj']),
  proposedValue: z.string().regex(/^\d{11}(?:\d{3})?$/),
  reason: z.string().min(1).max(500).refine(value => value.trim().length > 0),
  evidenceRefs: z.array(z.object({ ref: z.string().regex(/^[a-zA-Z0-9:_-]{1,120}$/), sha256: fingerprint }).strict()).min(1).max(32),
}).strict();
const correctionErrors = new Map([
  ['REVIEW_CORRECTION_NOT_AVAILABLE', 404], ['REVIEW_CORRECTION_CONFLICT', 409], ['REVIEW_SOURCE_CHANGED', 409],
  ['REVIEW_CANONICAL_DOCUMENT_REQUIRED', 422], ['REVIEW_NO_CHANGE', 422],
  ['REVIEW_FIELD_DENIED', 422], ['REVIEW_MEANING_CHANGE_EVIDENCE_REQUIRED', 422],
]);

export function mountLegacyClientReviewRead(app: Express, db: DbClient, rbac: RbacGuard) {
  const audit = new PostgresAuditRepository(db);
  app.post('/api/v1/clientes/revisao-legado/:sourceSystem/:nativeKey/correcao', requireTenantScope, async (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, private');
    try {
      if (req.authVerified !== true || !req.actorId) throw new AppError(401, 'AUTH_REQUIRED', 'Verified session required');
      if (req.scopeType !== 'grupo' || req.empresaId != null)
        throw new AppError(403, 'REVIEW_GROUP_SCOPE_REQUIRED', 'Group scope required');
      const { sourceSystem, nativeKey } = req.params;
      if (!identityPart.test(sourceSystem) || !identityPart.test(nativeKey))
        throw new AppError(422, 'REVIEW_IDENTITY_REQUIRED', 'Invalid review identity');
      const parsed = draftSchema.safeParse(req.body);
      if (!parsed.success) throw new AppError(422, 'REVIEW_INVALID_DRAFT', 'Invalid correction draft');
      const result = await saveAssistedClientDocumentCorrection({ sourceSystem, nativeKey }, parsed.data, {
        groupId: req.groupId, actorId: req.actorId, requestId: req.requestId, scopeType: 'grupo',
      }, { db, rbac, audit, isValidCpf, isValidCnpj,
        prepareAssistedReviewProposal: (record: unknown, command: unknown, options: { context: unknown; rbacGuard: unknown }) =>
          prepareAssistedReviewProposal(record, command, { ...options,
            isAllowedField: (field: string) => field === 'cpf' || field === 'cnpj',
          }),
      });
      res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) {
      if (error instanceof AppError) return next(error);
      const code = error instanceof Error ? error.message : '';
      const status = correctionErrors.get(code);
      next(status ? new AppError(status, code, 'Correction rejected') : new AppError(503, 'REVIEW_UNAVAILABLE', 'Review unavailable'));
    }
  });
  app.get('/api/v1/clientes/revisao-legado/:sourceSystem/:nativeKey', requireTenantScope, async (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, private');
    try {
      if (req.authVerified !== true || !req.actorId) throw new AppError(401, 'AUTH_REQUIRED', 'Verified session required');
      if (req.scopeType !== 'grupo' || req.empresaId != null)
        throw new AppError(403, 'REVIEW_GROUP_SCOPE_REQUIRED', 'Group scope required');
      const { sourceSystem, nativeKey } = req.params;
      if (!identityPart.test(sourceSystem) || !identityPart.test(nativeKey))
        throw new AppError(422, 'REVIEW_IDENTITY_REQUIRED', 'Invalid review identity');
      const entry = await reopenAssistedClientReview({ sourceSystem, nativeKey }, {
        groupId: req.groupId, actorId: req.actorId, requestId: req.requestId, scopeType: 'grupo',
      }, { db, rbac });
      if (!entry) throw new AppError(404, 'REVIEW_NOT_FOUND', 'Review entry not found');
      res.json(entry);
    } catch (error) {
      next(error instanceof AppError ? error : new AppError(503, 'REVIEW_UNAVAILABLE', 'Review unavailable'));
    }
  });
}
