import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Token simples: payloadBase64.signatureBase64
// Assinatura = HMAC-SHA256(payloadBase64 bytes) com PORTAL_TOKEN_SECRET
// payload esperado: { sub, subject, scopes?: string[], exp: epoch_seconds, group_id?: string, empresa_id?: string, cliente_id?: string }

async function hmacSign(messageBase64, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(messageBase64));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

function safeB64Decode(b64) {
  try {
    const json = atob(b64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isExpired(expSeconds) {
  if (!expSeconds) return true;
  const now = Math.floor(Date.now() / 1000);
  return now >= Number(expSeconds);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);

    if (req.method !== 'POST') {
      return Response.json({ error: 'Method Not Allowed' }, { status: 405 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    const secret = Deno.env.get('PORTAL_TOKEN_SECRET');
    if (!secret) {
      return Response.json({ error: 'PORTAL_TOKEN_SECRET ausente' }, { status: 500 });
    }

    // Validar token (público, pois é para acesso externo via link seguro)
    if (action === 'validate') {
      const token = body?.token;
      if (!token || typeof token !== 'string' || !token.includes('.')) {
        return Response.json({ valid: false, reason: 'token_invalido' }, { status: 200 });
      }
      const [payloadB64, signatureB64] = token.split('.', 2);
      const expectedSig = await hmacSign(payloadB64, secret);
      const ok = signatureB64 === expectedSig;
      if (!ok) return Response.json({ valid: false, reason: 'assinatura_invalida' }, { status: 200 });

      const payload = safeB64Decode(payloadB64);
      if (!payload) return Response.json({ valid: false, reason: 'payload_invalido' }, { status: 200 });
      if (isExpired(payload.exp)) return Response.json({ valid: false, reason: 'expirado', exp: payload.exp }, { status: 200 });

      try {
        await base44.entities.AuditLog.create({
          acao: 'Visualização', modulo: 'Sistema', tipo_auditoria: 'seguranca', entidade: 'PortalToken',
          descricao: `Token validado para ${payload.subject || payload.sub || 'desconhecido'}`,
          data_hora: new Date().toISOString(), group_id: payload.group_id || null, empresa_id: payload.empresa_id || null,
        });
      } catch (error) {
        console.error('[portalToken] Falha ao auditar validacao de token', error?.message || error);
      }

      return Response.json({ valid: true, ...payload }, { status: 200 });
    }

    // Gerar token (somente admin autenticado)
    if (action === 'issue') {
      const user = await base44.auth.me();
      if (user?.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }

      const {
        subject,
        cliente_id,
        group_id,
        empresa_id,
        scopes = ['portal:read'],
        ttl_minutes = 60
      } = body || {};

      if (!subject && !cliente_id) {
        return Response.json({ error: 'subject ou cliente_id é obrigatório' }, { status: 400 });
      }

      const now = Math.floor(Date.now() / 1000);
      const exp = now + Math.max(5, Number(ttl_minutes) || 60) * 60;

      const payload = {
        sub: subject || `cliente:${cliente_id}`,
        subject: subject || `cliente:${cliente_id}`,
        cliente_id: cliente_id || null,
        group_id: group_id || null,
        empresa_id: empresa_id || null,
        scopes,
        iat: now,
        exp
      };

      const payloadB64 = btoa(JSON.stringify(payload));
      const signatureB64 = await hmacSign(payloadB64, secret);
      const token = `${payloadB64}.${signatureB64}`;

      try {
        await base44.entities.AuditLog.create({
          usuario: user.full_name || user.email,
          usuario_id: user.id,
          acao: 'Criação', modulo: 'Sistema', tipo_auditoria: 'seguranca', entidade: 'PortalToken',
          descricao: `Token emitido para ${payload.subject}`,
          data_hora: new Date().toISOString(), group_id: group_id || null, empresa_id: empresa_id || null,
        });
      } catch (error) {
        console.error('[portalToken] Falha ao auditar emissao de token', error?.message || error);
      }

      return Response.json({ token, exp });
    }

    return Response.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
});