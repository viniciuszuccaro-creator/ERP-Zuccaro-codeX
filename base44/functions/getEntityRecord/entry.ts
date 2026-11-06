/** Scoped lookup retains the public record/data shape; no unscoped service-role get. */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { authorizeEntityRead, safeReadError, EntityReadError } from '../_lib/security/entityReadPolicy/entry.ts';
Deno.serve(async req => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error:'Unauthorized' },{ status:401 });
    const body = await req.json();
    const access = await authorizeEntityRead(base44,user,body);
    if (body.report) throw new EntityReadError('REPORT_USE_LIST_CONTRACT',400);
    if (body.id != null && (typeof body.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(body.id))) throw new EntityReadError('READ_INVALID_ID',400);
    const filter = body.id ? { $and:[access.filter,{ id:body.id }] } : access.filter;
    const limit = body.id ? 1 : Math.max(1,Math.min(Number(body.limit) || 50,500));
    const rows = await base44.asServiceRole.entities[body.entityName].filter(filter,'-updated_date',limit,0);
    if (!Array.isArray(rows)) throw new EntityReadError('READ_UNAVAILABLE',503);
    if (body.id) return rows.length ? Response.json({ record:access.project(rows[0]),_ts:Date.now() }) : Response.json({ error:'Registro não encontrado' },{ status:404 });
    return Response.json({ data:rows.map(access.project),_ts:Date.now() });
  } catch (error) { return safeReadError(error); }
});
