import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const MAX_MESSAGE_LENGTH = 500;
const SENSITIVE_METADATA_KEY = /(token|senha|password|secret|api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|authorization|cookie|cpf|cnpj|email|telefone|whatsapp)/i;

function summarizeText(value, maxLength = MAX_MESSAGE_LENGTH) {
  if (!value) return null;
  const text = String(value);
  return { tamanho: text.length, amostra: text.slice(0, maxLength) };
}

function summarizeStack(stack) {
  if (!stack) return null;
  const lines = String(stack).split('\n').filter(Boolean);
  return {
    tamanho: String(stack).length,
    linhas: lines.length,
    topo: lines.slice(0, 3).map((line) => line.slice(0, 240)),
  };
}

function summarizeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return metadata ? { tipo: typeof metadata, tamanho: String(metadata).length } : null;
  const keys = Object.keys(metadata);
  return {
    chaves: keys,
    campos_sensiveis: keys.filter((key) => SENSITIVE_METADATA_KEY.test(key)),
    total_chaves: keys.length,
  };
}
// Centraliza auditoria de erros do frontend/backend
// Espera payload: { module, message, stack, page, empresa_id, group_id, metadata }
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const moduleName = body?.module || 'Sistema';
    const page = body?.page || null;
    const empresa_id = body?.empresa_id || null;
    const group_id = body?.group_id || null;
    const message = body?.message || 'Erro desconhecido';
    const stack = body?.stack || null;
    const metadata = body?.metadata || null;

    await base44.asServiceRole.entities.AuditLog.create({
      usuario: user.full_name || user.email || 'Usuário',
      usuario_id: user.id,
      empresa_id: empresa_id || undefined,
      group_id: group_id || undefined,
      acao: 'Erro',
      modulo: moduleName,
      tipo_auditoria: 'sistema',
      entidade: page || 'ReactQuery/UI',
      descricao: String(message).slice(0, MAX_MESSAGE_LENGTH),
      dados_novos: { page, message: summarizeText(message), stack: summarizeStack(stack), metadata: summarizeMetadata(metadata) },
      data_hora: new Date().toISOString(),
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});