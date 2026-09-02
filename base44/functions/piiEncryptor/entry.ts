import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { requireEntityGuard } from './_lib/security/guardCallPolicy.js';

// Encrypt/decrypt PII fields for selected entities using AES-GCM with BACKUP_ENCRYPTION_KEY
// Payload: { entity_name: 'Cliente'|'Colaborador', id: string, action?: 'encrypt'|'decrypt', fields?: string[] }
// Notes: Admin-safe by default; user-scoped allowed but updates run as service role after auth.

function b64encode(buf) { return btoa(String.fromCharCode(...new Uint8Array(buf))); }
function b64decode(str) { const bin = atob(str); const arr = new Uint8Array(bin.length); for (let i=0;i<bin.length;i++) arr[i] = bin.charCodeAt(i); return arr.buffer; }

async function getKey() {
  const secret = Deno.env.get('BACKUP_ENCRYPTION_KEY');
  if (!secret) throw new Error('BACKUP_ENCRYPTION_KEY not set');
  const enc = new TextEncoder();
  const raw = await crypto.subtle.digest('SHA-256', enc.encode(secret));
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt','decrypt']);
}

async function encryptJson(obj, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(typeof obj === 'string' ? obj : JSON.stringify(obj));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return `enc:gcm:${b64encode(iv)}:${b64encode(ct)}`;
}

async function decryptJson(str, key) {
  if (typeof str !== 'string') return str;
  if (!str.startsWith('enc:gcm:')) return str;
  const [, , ivb64, ctb64] = str.split(':');
  const iv = new Uint8Array(b64decode(ivb64));
  const ct = b64decode(ctb64);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  const txt = new TextDecoder().decode(pt);
  try { return JSON.parse(txt); } catch { return txt; }
}

function isEncrypted(val) { return typeof val === 'string' && val.startsWith('enc:gcm:'); }

function set(obj, path, value) { const parts = path.split('.'); let cur = obj; for (let i=0;i<parts.length-1;i++){ if (!cur[parts[i]]) cur[parts[i]] = {}; cur = cur[parts[i]]; } cur[parts[parts.length-1]] = value; }
function get(obj, path) { return path.split('.').reduce((o,k)=> (o==null?undefined:o[k]), obj); }

const DEFAULT_FIELDS = {
  Cliente: ['cpf','rg','email_principal','telefone_principal','endereco_principal','contatos','documentos'],
  Colaborador: ['cpf','rg','email','telefone','whatsapp','endereco','dados_bancarios','data_nascimento']
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(()=>({}));
    const entity = body.entity_name; const id = body.id; const action = body.action || 'encrypt';
    if (!entity || !id) return Response.json({ error: 'Missing entity_name/id' }, { status: 400 });

    const rec = await base44.asServiceRole.entities[entity].get(id);
    if (!rec) return Response.json({ error: 'Record not found' }, { status: 404 });

    const guardFailure = await requireEntityGuard(base44, {
      module: 'Sistema', section: 'Seguranca', action: 'executar', function_name: 'piiEncryptor',
      empresa_id: body?.empresa_id || rec?.empresa_id || rec?.empresa_dona_id || null,
      group_id: body?.group_id || rec?.group_id || rec?.grupo_id || null,
    });
    if (guardFailure) return guardFailure;

    const key = await getKey();

    const fields = Array.isArray(body.fields) && body.fields.length ? body.fields : (DEFAULT_FIELDS[entity] || []);
    if (!fields.length) return Response.json({ ok: true, skipped: 'no-fields' });

    const updated = { };

    for (const path of fields) {
      const val = get(rec, path);
      if (val == null) continue;
      if (action === 'encrypt') {
        // Skip already encrypted
        if (typeof val === 'string' && isEncrypted(val)) continue;
        if (Array.isArray(val)) {
          const encArr = await Promise.all(val.map(v => encryptJson(v, key)));
          set(updated, path, encArr);
        } else {
          const enc = await encryptJson(val, key);
          set(updated, path, enc);
        }
      } else if (action === 'decrypt') {
        if (Array.isArray(val)) {
          const decArr = await Promise.all(val.map(v => isEncrypted(v) ? decryptJson(v, key) : v));
          set(updated, path, decArr);
        } else if (isEncrypted(val)) {
          const dec = await decryptJson(val, key);
          set(updated, path, dec);
        }
      }
    }

    if (Object.keys(updated).length === 0) return Response.json({ ok: true, note: 'no-changes' });

    const res = await base44.asServiceRole.entities[entity].update(id, updated);

    const auditEmpresaId = body?.empresa_id || rec?.empresa_id || rec?.empresa_dona_id || null;
    const auditGroupId = body?.group_id || rec?.group_id || rec?.grupo_id || null;
    const changedFields = Object.keys(updated);

    try { await base44.asServiceRole.entities.AuditLog.create({
      usuario: user.full_name || user.email || 'Usuário', usuario_id: user.id,
      empresa_id: auditEmpresaId,
      group_id: auditGroupId,
      acao: 'Edicao', modulo: 'Sistema', tipo_auditoria: 'seguranca', entidade: entity, registro_id: id,
      descricao: `PII ${action} aplicada em ${entity}`,
      dados_novos: { action, campos: changedFields, quantidade_campos: changedFields.length },
      data_hora: new Date().toISOString()
    }); } catch {}

    return Response.json({ ok: true, updated: changedFields, data: res });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
