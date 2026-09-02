import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import XLSX from 'npm:xlsx@0.18.5';
import { getUserAndPerfil, assertPermission, audit } from './_lib/guard';
import { completeGuardCallScope } from './_lib/security/guardCallPolicy.js';

const MAX_SPREADSHEET_BYTES = 10 * 1024 * 1024;

const getSpreadsheetMetadata = (fileUrl, sheetName) => {
  const url = new URL(fileUrl);
  const extension = url.pathname.split('.').pop()?.toLowerCase() || 'desconhecida';
  return {
    origem: url.hostname,
    tipo_arquivo: extension,
    planilha: String(sheetName || '').slice(0, 120),
  };
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const fileUrl = body?.file_url;

    const ctx = await getUserAndPerfil(base44);
    const permErr = await assertPermission(base44, ctx, 'Sistema', 'Importacao', 'visualizar');
    if (permErr) return permErr;
    if (!fileUrl) {
      return Response.json({ error: 'file_url is required' }, { status: 400 });
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(fileUrl);
      if (parsedUrl.protocol !== 'https:' || parsedUrl.username || parsedUrl.password) {
        return Response.json({ error: 'file_url must be a secure URL without credentials' }, { status: 400 });
      }
    } catch {
      return Response.json({ error: 'file_url is invalid' }, { status: 400 });
    }

    const scope = await completeGuardCallScope(base44, body || {});
    if (!scope.groupId) {
      return Response.json({ error: 'Contexto de grupo obrigatorio para importacao' }, { status: 400 });
    }

    const resp = await fetch(parsedUrl.toString(), { redirect: 'error' });
    if (!resp.ok) {
      return Response.json({ error: `Failed to fetch file: ${resp.status}` }, { status: 400 });
    }
    const contentLength = Number(resp.headers.get('content-length') || 0);
    if (contentLength > MAX_SPREADSHEET_BYTES) {
      return Response.json({ error: 'Spreadsheet exceeds the 10 MB limit' }, { status: 413 });
    }
    const arrayBuffer = await resp.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_SPREADSHEET_BYTES) {
      return Response.json({ error: 'Spreadsheet exceeds the 10 MB limit' }, { status: 413 });
    }

    const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      return Response.json({ rows: [] });
    }
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    await audit(base44, user, {
      acao: 'Visualização', modulo: 'Sistema', entidade: 'Importacao',
      descricao: `Planilha lida (${sheetName})`, empresa_id: scope.empresaId, group_id: scope.groupId,
      dados_novos: { ...getSpreadsheetMetadata(parsedUrl.toString(), sheetName), linhas: rows.length },
    });
    return Response.json({ rows });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
