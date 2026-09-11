import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Entidades de catálogo global que NÃO precisam de escopo empresa/grupo
const SIMPLE_CATALOG = new Set([
  'Banco','FormaPagamento','TipoDespesa','MoedaIndice','TipoFrete',
  'UnidadeMedida','Departamento','Cargo','Turno','GrupoProduto','Marca',
  'SetorAtividade','LocalEstoque','TabelaFiscal','CentroResultado',
  'OperadorCaixa','RotaPadrao','ModeloDocumento','KitProduto','CatalogoWeb',
  'Servico','CondicaoComercial','PerfilAcesso',
  'ConfiguracaoNFe','ConfiguracaoBoletos','ConfiguracaoWhatsApp',
  'GatewayPagamento','ApiExterna','Webhook','ChatbotIntent','ChatbotCanal',
  'JobAgendado','EventoNotificacao','SegmentoCliente','RegiaoAtendimento',
  'ContatoB2B','CentroCusto','PlanoDeContas','PlanoContas',
  'Veiculo','Motorista','Representante','GrupoEmpresarial','Empresa',
  'TabelaPrecoItem','CentroOperacao','ConfiguracaoDespesaRecorrente',
  'AuditLog','Notificacao','ConfiguracaoSistema',
]);

const LEGACY_REFERENCE_FIELDS = {
  TabelaPreco: 'codigo_tabela_legado',
  Colaborador: 'codigo_vendedor_legado',
};

const normalizeLegacyReferenceCode = (value) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) return '';
  if (normalized.length > 64 || !/^[A-Za-z0-9._/-]+$/.test(normalized)) {
    throw new Error('codigo_legado_referencia_invalido');
  }
  return normalized;
};

// Sanitização genérica de entradas para entidades críticas (previne XSS e payloads suspeitos)
// Acionado por automações de entidade em events: create/update
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let payload = {};
    try { payload = await req.json(); } catch { payload = {}; }

    const event = payload?.event;
    const data = payload?.data;
    const oldData = payload?.old_data;

    if (!event || !event.entity_name || !event.entity_id || !data) {
      return Response.json({ ok: true, skipped: true, reason: 'Payload incompleto' });
    }

    // Função de sanitização simples: remove tags <script>, eventos inline e URLs javascript:
    const sanitizeString = (s) => {
      let out = String(s);
      out = out.replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '');
      out = out.replace(/on[a-z]+\s*=\s*"[^"]*"/gi, '');
      out = out.replace(/on[a-z]+\s*=\s*'[^']*'/gi, '');
      out = out.replace(/javascript:\s*/gi, '');
      return out;
    };

    const sanitizeValue = (v) => {
      if (typeof v === 'string') return sanitizeString(v);
      if (Array.isArray(v)) return v.map((x) => sanitizeValue(x));
      if (v && typeof v === 'object') {
        const o = {};
        for (const [k, val] of Object.entries(v)) o[k] = sanitizeValue(val);
        return o;
      }
      return v;
    };

    const sanitized = sanitizeValue(data);

    // Enriquecimento de contexto: se faltar group_id mas houver empresa_id, obtém do cadastro da empresa
    let enriched = sanitized;
    const isCatalog = SIMPLE_CATALOG.has(event.entity_name);

    if (!isCatalog) {
      try {
        if (!enriched?.group_id && data?.empresa_id) {
          const empresas = await base44.asServiceRole.entities.Empresa.filter({ id: data.empresa_id });
          const emp = Array.isArray(empresas) ? empresas[0] : null;
          if (emp?.group_id) {
            enriched = { ...enriched, group_id: emp.group_id };
          }
        }
      } catch {}

      // Enforce multiempresa apenas para entidades não-catálogo
      if (!enriched?.empresa_id && !enriched?.group_id) {
        try {
          await base44.asServiceRole.entities.AuditLog.create({
            usuario: 'Sistema',
            acao: 'Bloqueio',
            modulo: 'Sistema',
            tipo_auditoria: 'seguranca',
            entidade: event.entity_name,
            registro_id: event.entity_id,
            descricao: 'Registro sem escopo multiempresa (bloqueado pela sanitização)',
            dados_novos: { entity_id: event.entity_id },
            data_hora: new Date().toISOString(),
          });
        } catch {}
        return Response.json({ error: 'escopo_multiempresa_obrigatorio' }, { status: 400 });
      }
    }

    const legacyField = LEGACY_REFERENCE_FIELDS[event.entity_name];
    if (legacyField && Object.prototype.hasOwnProperty.call(enriched, legacyField)) {
      let legacyCode = '';
      try {
        legacyCode = normalizeLegacyReferenceCode(enriched[legacyField]);
      } catch {
        return Response.json({ error: 'legacy_reference_invalid' }, { status: 400 });
      }
      if (legacyCode || oldData?.[legacyField]) {
        const groupId = enriched?.group_id || enriched?.grupo_id || null;
        if (!groupId) {
          return Response.json({ error: 'group_id_required_for_legacy_reference' }, { status: 400 });
        }

        const empresaId = event.entity_name === 'Colaborador'
          ? (enriched?.empresa_alocada_id || enriched?.empresa_id || null)
          : (enriched?.empresa_id || null);
        if (empresaId) {
          const empresas = await base44.asServiceRole.entities.Empresa.filter({ id: empresaId });
          const empresa = Array.isArray(empresas) ? empresas[0] : null;
          const empresaGroupId = empresa?.group_id || empresa?.grupo_id || empresa?.grupo_empresarial_id || null;
          if (!empresa || String(empresaGroupId || '') !== String(groupId)) {
            return Response.json({ error: 'empresa_outside_group' }, { status: 403 });
          }
        }

        if (legacyCode) {
          const matches = await base44.asServiceRole.entities[event.entity_name].filter({ group_id: groupId });
          const normalizedCode = legacyCode.toLocaleUpperCase('pt-BR');
          const duplicate = (Array.isArray(matches) ? matches : []).some((item) => (
            String(item?.id) !== String(event.entity_id)
            && String(item?.[legacyField] || '').trim().toLocaleUpperCase('pt-BR') === normalizedCode
          ));
          if (duplicate) {
            return Response.json({ error: 'legacy_reference_duplicate_in_group' }, { status: 409 });
          }
        }
      }
      enriched = { ...enriched, [legacyField]: legacyCode };
    }

    // Criptografia de campos sensíveis (AES-GCM com BACKUP_ENCRYPTION_KEY)
    async function getCryptoKey() {
      const secret = Deno.env.get('BACKUP_ENCRYPTION_KEY');
      if (!secret) return null;
      const enc = new TextEncoder();
      const raw = await crypto.subtle.digest('SHA-256', enc.encode(secret));
      return await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt']);
    }
    const b64 = (buf) => {
      const bytes = new Uint8Array(buf);
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return btoa(bin);
    };
    async function encryptValue(plain, key) {
      const enc = new TextEncoder();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(String(plain)));
      return { enc: 'gcm/v1', iv: b64(iv), data: b64(cipher) };
    }
    async function encryptSensitive(obj, entity) {
      const key = await getCryptoKey();
      if (!key) return obj;
      const SENSITIVE_EXACT = new Set(['numero_autorizacao','pix_chave','conta','agencia','cartao','linha_digitavel','codigo_barras','pix_qrcode','pix_copia_cola','cpf','cnpj','rg','inscricao_estadual','inscricao_municipal','cliente_cpf_cnpj','favorecido_cpf_cnpj']);
      const isPIIKey = (k) => {
        const s = String(k || '').toLowerCase();
        return SENSITIVE_EXACT.has(s) || s.includes('email') || s.includes('telefone') || s.includes('whatsapp');
      };
      const walk = async (val, parentKey = '') => {
        if (Array.isArray(val)) {
          const out = [];
          for (const item of val) out.push(await walk(item, parentKey));
          return out;
        }
        if (val && typeof val === 'object') {
          const out = {};
          for (const [k, v] of Object.entries(val)) {
            if ((typeof v === 'string' || typeof v === 'number') && isPIIKey(k)) {
              out[k] = await encryptValue(v, key);
            } else {
              out[k] = await walk(v, k);
            }
          }
          return out;
        }
        return val;
      };
      // Escopos conhecidos: detalhes_pagamento, dados_bancarios, contatos/emails/telefones e campos de cobrança (ContaReceber)
      let out = { ...obj };
      if (out?.detalhes_pagamento) {
        out = { ...out, detalhes_pagamento: await walk(out.detalhes_pagamento) };
      }
      if (Array.isArray(out?.dados_bancarios)) {
        out = { ...out, dados_bancarios: await walk(out.dados_bancarios) };
      }
      // PII comuns por entidade
      if (entity === 'Cliente' || entity === 'Fornecedor' || entity === 'Transportadora' || entity === 'Colaborador') {
        out = await walk(out);
      }
      if (entity === 'ContaReceber') {
        const topKeys = ['linha_digitavel','codigo_barras','pix_qrcode','pix_copia_cola'];
        for (const k of topKeys) {
          if (typeof out[k] === 'string' || typeof out[k] === 'number') {
            out[k] = await encryptValue(out[k], key);
          }
        }
      }
      return out;
    }

    const secured = await encryptSensitive(enriched, event.entity_name);

    // Construir patch somente com campos alterados (ignorar built-ins)
    const BUILT_INS = new Set(['id', 'created_date', 'updated_date', 'created_by']);

    const diffPatch = (orig, clean) => {
      const patch = {};
      for (const [k, v] of Object.entries(clean)) {
        if (BUILT_INS.has(k)) continue;
        const ov = orig?.[k];
        const same = JSON.stringify(ov) === JSON.stringify(v);
        if (!same) patch[k] = v;
      }
      return patch;
    };

    const patch = diffPatch(data, secured);

    if (Object.keys(patch).length > 0) {
      await base44.asServiceRole.entities[event.entity_name].update(event.entity_id, patch);

      // Auditoria
      try {
        await base44.asServiceRole.entities.AuditLog.create({
          usuario: 'Sistema',
          acao: 'Edição',
          modulo: 'Sistema',
          entidade: event.entity_name,
          registro_id: event.entity_id,
          descricao: 'Sanitização automática aplicada (prevenção XSS/injeções).',
          empresa_id: enriched?.empresa_id || data?.empresa_id || null,
          dados_anteriores: oldData || null,
          dados_novos: { ...patch, group_id: enriched?.group_id || data?.group_id || null },
          data_hora: new Date().toISOString(),
        });
      } catch {}
    }

    return Response.json({ ok: true, changed: Object.keys(patch).length });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});
