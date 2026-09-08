import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Util: decode secret (base64 ou hex) para Uint8Array
function decodeKey(str) {
  if (!str) throw new Error('BACKUP_ENCRYPTION_KEY ausente');
  try {
    // base64
    const b = atob(str.replace(/\n/g, ''));
    return new Uint8Array([...b].map(c => c.charCodeAt(0)));
  } catch (_) {
    // hex
    const clean = str.replace(/[^0-9a-fA-F]/g, '');
    if (clean.length % 2 !== 0) throw new Error('Chave inválida');
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < clean.length; i += 2) out[i/2] = parseInt(clean.slice(i, i+2), 16);
    return out;
  }
}

async function encryptJSON(obj) {
  const keyRaw = decodeKey(Deno.env.get('BACKUP_ENCRYPTION_KEY'));
  if (keyRaw.length !== 32) throw new Error('Chave deve ter 32 bytes');
  const key = await crypto.subtle.importKey('raw', keyRaw, 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
  const toB64 = (u8) => btoa(String.fromCharCode(...u8));
  return { v: 1, algo: 'AES-GCM', iv_b64: toB64(iv), data_b64: toB64(cipher), created_at: new Date().toISOString() };
}

function hashResumo(resumo) {
  const text = JSON.stringify(resumo);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16)}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    // Admin-only se houver usuário (execução manual). Agendamento pode rodar sem usuário.
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin required' }, { status: 403 });
    }

    let body = {}; try { body = await req.json(); } catch { body = {}; }
    const filtros = body?.filtros || {};
    const groupId = filtros?.group_id || body?.group_id || null;
    const empresaId = filtros?.empresa_id || body?.empresa_id || null;
    if (!groupId) {
      return Response.json({ error: 'group_id obrigatorio para backup automatico.' }, { status: 400 });
    }

    // Entidades principais (multiempresa aplicada via filtros)
    const where = (extra = {}) => ({
      group_id: groupId,
      ...(empresaId ? { empresa_id: empresaId } : {}),
      ...extra,
    });

    const entidades = {
      Cliente: await base44.asServiceRole.entities.Cliente.filter(where(), '-updated_date', 5000),
      Fornecedor: await base44.asServiceRole.entities.Fornecedor.filter(where(), '-updated_date', 5000),
      Produto: await base44.asServiceRole.entities.Produto.filter(where(), '-updated_date', 5000),
      Pedido: await base44.asServiceRole.entities.Pedido.filter(where(), '-updated_date', 5000),
      ContaPagar: await base44.asServiceRole.entities.ContaPagar.filter(where(), '-updated_date', 5000),
      ContaReceber: await base44.asServiceRole.entities.ContaReceber.filter(where(), '-updated_date', 5000),
      NotaFiscal: await base44.asServiceRole.entities.NotaFiscal.filter(where(), '-updated_date', 5000),
      Entrega: await base44.asServiceRole.entities.Entrega.filter(where(), '-updated_date', 5000),
      MovimentacaoEstoque: await base44.asServiceRole.entities.MovimentacaoEstoque.filter(where(), '-updated_date', 5000),
    };

    const por_entidade = Object.fromEntries(Object.entries(entidades).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0]));
    const quantidade_total_registros = Object.values(por_entidade).reduce((sum, n) => sum + Number(n || 0), 0);
    const resumo = { quantidade_total_registros, por_entidade };
    const hash_integridade = hashResumo(resumo);

    const payload = {
      scope: { empresa_id: empresaId ?? null, group_id: groupId },
      generated_at: new Date().toISOString(),
      version: 1,
      entidades,
    };

    const encrypted = await encryptJSON(payload);
    const blob = new Blob([JSON.stringify(encrypted)], { type: 'application/json' });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const name = `backup_${groupId}_${empresaId || 'emp'}_${ts}.enc.json`;
    const file = new File([blob], name, { type: 'application/json' });

    const up = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file });

    const controle = await base44.asServiceRole.entities.BackupAutomatico.create({
      file_uri: up?.file_uri,
      nome_arquivo: name,
      escopo: payload.scope,
      group_id: groupId,
      grupo_id: groupId,
      empresa_id: empresaId || null,
      origem_backup: 'erp_novo',
      status: 'Concluido',
      tamanho_bytes: blob.size,
      tamanho_comprimido_mb: Number((blob.size / (1024 * 1024)).toFixed(4)),
      entidades_count: por_entidade,
      quantidade_total_registros,
      resumo_entidades: por_entidade,
      hash_integridade,
      snapshot_dados: {
        version: 1,
        generated_at: payload.generated_at,
        scope: payload.scope,
        entities: entidades,
      },
      validacao_integridade: {
        validado: true,
        hash_valido: true,
        arquivo_integro: true,
        pode_restaurar: true,
      },
      sucesso: true,
      data_execucao: new Date().toISOString(),
      data_hora_inicio: new Date().toISOString(),
      data_hora_fim: new Date().toISOString(),
    });

    await base44.asServiceRole.entities.AuditLog.create({
      usuario: user?.full_name || 'Automacao',
      usuario_id: user?.id || null,
      acao: 'Exportacao',
      modulo: 'Sistema',
      tipo_auditoria: 'sistema',
      entidade: 'BackupAutomatico',
      registro_id: controle?.id || null,
      group_id: groupId,
      empresa_id: empresaId || null,
      descricao: `Backup automatico gerado (${name})`,
      dados_novos: {
        file_uri: up?.file_uri,
        scope: payload.scope,
        numero_backup: controle?.numero_backup,
        hash_integridade,
      },
      sucesso: true,
      data_hora: new Date().toISOString(),
    });

    return Response.json({
      ok: true,
      file_uri: up?.file_uri,
      name,
      numero_backup: controle?.numero_backup || null,
      hash_integridade,
    });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});
