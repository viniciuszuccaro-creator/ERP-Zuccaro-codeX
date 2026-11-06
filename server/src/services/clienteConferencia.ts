import { z } from 'zod';
import { AppError } from '../api/errors.js';
import { isValidCpf, isValidCnpj, normalizeDocumento } from '../db/documentoValidators.js';
import type { RequestContext } from '../audit/types.js';
import type { RbacGuard } from '../db/rbacGuard.js';
import type { ClienteRepository } from '../repositories/inMemoryClienteRepository.js';
import type { Cliente } from '../repositories/clienteTypes.js';
const identity = z.object({
 documento: z.string().max(32).regex(/^[0-9.\/\- ]+$/).optional(),
 sourceSystem: z.string().min(1).max(80).refine(v => v === v.trim()).optional(),
 codigoLegado: z.string().min(1).max(80).refine(v => v === v.trim()).optional(),
}).strict().refine(v => Boolean(v.documento || (v.sourceSystem && v.codigoLegado)))
 .refine(v => Boolean(v.sourceSystem) === Boolean(v.codigoLegado))
 .refine(v => !v.documento || isValidCpf(v.documento) || isValidCnpj(v.documento));
const schema = z.object({ identidades: z.array(identity).min(1).max(100) }).strict();
/** Read-only, bounded reconciliation in the existing Cliente service, never a bulk import. */
export async function conferirClientesLegado(repo: ClienteRepository, rbac: RbacGuard, original: RequestContext, input: unknown) {
 const ctx = Object.freeze({ ...original });
 const group = z.string().uuid().safeParse(ctx.groupId);
 const actor = z.string().uuid().safeParse(ctx.actorId);
 if (!group.success || !actor.success || ctx.empresaId) throw new AppError(403,'LEGACY_GROUP_SCOPE_REQUIRED','Authenticated Group profile required');
 const parsed = schema.safeParse(input);
 if (!parsed.success) throw new AppError(422,'VALIDATION_ERROR','Explicit bounded identities required');
 const authorize = async () => {
  if (original.groupId !== ctx.groupId || original.empresaId !== ctx.empresaId || original.actorId !== ctx.actorId) throw new AppError(409,'CONTEXT_CHANGED','Context changed');
  await rbac.assertAllowed(ctx,'Cadastros','cliente','visualizar',{allowGlobalWildcard:false});
  await rbac.assertAllowed(ctx,'Cadastros','cliente','importar',{allowGlobalWildcard:false});
  if (original.groupId !== ctx.groupId || original.empresaId !== ctx.empresaId || original.actorId !== ctx.actorId) throw new AppError(409,'CONTEXT_CHANGED','Context changed');
 };
 const minimal = (row: Cliente | null) => {
  if (!row) return null;
  if (row.group_id !== ctx.groupId || row.empresa_id != null) throw new AppError(409,'LEGACY_RECONCILIATION_REQUIRED','Unexpected master scope');
  return { id: row.id, codigo: row.codigo, ativo: row.ativo };
 };
 await authorize();
 const results = [];
 for (const [indice, item] of parsed.data.identidades.entries()) {
  let documento = null, legado = null;
  if (item.documento) {
   await authorize();
   documento = minimal(await repo.findByDocumento(ctx.groupId,normalizeDocumento(item.documento)));
   await authorize();
  }
  if (item.sourceSystem && item.codigoLegado) {
   await authorize();
   legado = minimal(await repo.findByLegacyIdentity(ctx.groupId,item.sourceSystem,item.codigoLegado));
   await authorize();
  }
  results.push({ indice, documento, legado });
 }
 await authorize();
 return results;
}
