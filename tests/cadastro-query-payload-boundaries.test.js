test('Cliente contatos/locais: remainder rejeita omissao repeticao e efeito colateral nos hunks', () => {
  const source = read('src/components/cadastros/CadastroClienteCompleto.jsx');
  const payload = [
    '      // null = desconhecido (não comando público); [] = limpeza explícita; omit = não tocar.',
    '      ...(data.contatos === undefined || data.contatos === null',
    '        ? {}',
    '        : {',
    '            contatos: sanitizeContatos(data.contatos),',
    '            ...(data.expectedVersion !== undefined',
    '              ? { expectedVersion: data.expectedVersion }',
    '              : (data.contatos_version !== undefined',
    '                ? { expectedVersion: data.contatos_version }',
    '                : {})),',
    '          }),',
  ].join('\n');
  const mapper = [
    '        // Ausência/null ≠ [] : omitir evita wipe; [] hidratado = limpeza explícita prévia.',
    '        ...(record.contatos === undefined || record.contatos === null',
    '          ? {}',
    '          : { contatos: record.contatos }),',
    '        ...(record.contatos_version !== undefined',
    '          ? { contatos_version: record.contatos_version, expectedVersion: record.contatos_version }',
    '          : {}),',
  ].join('\n');
  const locaisPayload = [
    '      ...(data.locais_entrega === undefined',
    '        ? {}',
    '        : {',
    '            locais_entrega: Array.isArray(data.locais_entrega)',
    '              ? data.locais_entrega.slice(0, 50).map(sanitizeEndereco)',
    '              : [],',
    '          }),',
  ].join('\n');
  const locaisMapper = [
    '        ...(record.locais_entrega === undefined',
    '          ? {}',
    '          : { locais_entrega: record.locais_entrega || [] }),',
  ].join('\n');
  const docsPayload = '      ...(data.documentos === undefined ? {} : { documentos: sanitizeDocumentos(data.documentos) }),';
  const docsMapper = '        ...(record.documentos === undefined ? {} : { documentos: record.documentos || [] }),';
  for (const hunk of [payload, mapper, locaisPayload, locaisMapper, docsPayload, docsMapper]) {
    assert.equal(source.split(hunk).length - 1, 1);
    assert.throws(() => clienteContactPresenceRemainder(source.replace(hunk, '')));
    assert.throws(() => clienteContactPresenceRemainder(source.replace(hunk, hunk + '\n' + hunk)));
  }
  for (const [hunk, variable, field] of [
    [payload, 'data', 'contatos'],
    [mapper, 'record', 'contatos'],
    [locaisPayload, 'data', 'locais_entrega'],
    [locaisMapper, 'record', 'locais_entrega'],
    [docsPayload, 'data', 'documentos'],
    [docsMapper, 'record', 'documentos'],
  ]) {
    const forged = hunk.replace(
      `${variable}.${field} ===`,
      `Object.assign(${variable},{nome:'FORGED'}).${field} ===`,
    );
    assert.throws(() => clienteContactPresenceRemainder(source.replace(hunk, forged)));
  }
});

test('Cliente contatos: remainder mantem alteracao externa visivel ao hash integral', () => {
  const source = read('src/components/cadastros/CadastroClienteCompleto.jsx');
  const original = clienteContactPresenceRemainder(source);
  const target = "      ...ownText('nome_fantasia', 180),";
  assert.equal(source.split(target).length - 1, 1);
  const forged = source.replace(target, "      ...ownText('FORGED_FANTASIA', 180),");
  assert.notEqual(createHash('sha256').update(clienteContactPresenceRemainder(forged)).digest('hex'),
    createHash('sha256').update(original).digest('hex'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const read = path => fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const parse = (path, source = read(path)) => ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
function nodes(tree, predicate) {
  const found = [];
  const visit = node => { if (predicate(node)) found.push(node); ts.forEachChild(node, visit); };
  visit(tree); return found;
}
function once(source, current, previous) {
  assert.equal(source.split(current).length - 1, 1, 'exact integration hunk');
  return source.replace(current, previous);
}
// Browser-proven absence is not an explicit empty list. Preserve the old golden;
// accept only these two exact hunks, never arbitrary spread expressions.
// #401 prep: peels Completo draft/commitMode/persistBusy from #431/#432 keep-both (sem pin cego).
function clienteContactPresenceRemainder(source) {
  source = once(source,
    'import {\n'
    + '  mapClienteLocalToUiEndereco,\n'
    + '  syncClienteLocaisViaHttp,\n'
    + '  CLIENTE_LOCAIS_SYNC_PARTIAL,\n'
    + '  isContatoCanalCanonico,\n'
    + '  partitionContatosByCanal,\n'
    + '} from "@/api/clienteHttpPayload";\n',
    '');
  // #591 CAS: sanitize rejeita truncamento → forma mínima anterior.
  source = once(source,
    "/** Preserva procedência/flags/null; rejeita acima do limite (200/2000) — sem truncar. */\n/** @param {string} message @param {string} code @param {number} [status] */\nconst contatosValidationError = (message, code, status = 422) => {\n  const err = /** @type {Error & { code: string, status: number }} */ (new Error(message));\n  err.code = code;\n  err.status = status;\n  return err;\n};\nconst assertContatoLen = (value, max, field) => {\n  if (value == null) return value;\n  const text = String(value);\n  if (text.length > max) {\n    throw contatosValidationError(\n      `Contato.${field} excede ${max} — rejeitado sem truncamento.`,\n      'CLIENTE_CONTATOS_VALIDATION',\n    );\n  }\n  return text;\n};\n/** Sanitiza sem truncar: rejeita acima do limite antes de qualquer slice. */\nconst sanitizeContatoField = (value, max, field) => {\n  if (value === undefined || value === null) return value;\n  assertContatoLen(value, max, field);\n  return sanitizeText(value, max);\n};\nconst sanitizeContatos = (contatos) => {\n  if (!Array.isArray(contatos)) {\n    throw contatosValidationError(\n      'contatos deve ser array — rejeitado sem converter em [].',\n      'CLIENTE_CONTATOS_VALIDATION',\n    );\n  }\n  if (contatos.length > 200) {\n    throw contatosValidationError(\n      'Contatos[] excede 200 itens — rejeitado sem truncamento.',\n      'CLIENTE_CONTATOS_VALIDATION',\n    );\n  }\n  const ids = new Set();\n  let principals = 0;\n  return contatos.map((contato) => {\n    const obsRaw = contato?.observacao !== undefined ? contato.observacao : contato?.obs;\n    const observacao = obsRaw === undefined ? undefined : (obsRaw === null ? null : sanitizeContatoField(obsRaw, 2000, 'observacao'));\n    const out = {\n      ...contato,\n      nome: contato?.nome === undefined ? undefined : (contato.nome === null ? null : sanitizeContatoField(contato.nome, 180, 'nome')),\n      cargo: contato?.cargo === undefined ? undefined : (contato.cargo === null ? null : sanitizeContatoField(contato.cargo, 120, 'cargo')),\n      departamento: contato?.departamento === undefined ? undefined : (contato.departamento === null ? null : sanitizeContatoField(contato.departamento, 120, 'departamento')),\n      tipo: sanitizeContatoField(contato?.tipo, 60, 'tipo'),\n      valor: contato?.valor === undefined ? undefined : (contato.valor === null ? null : sanitizeContatoField(contato.valor, 180, 'valor')),\n      ramal: contato?.ramal === undefined ? undefined : (contato.ramal === null ? null : sanitizeContatoField(contato.ramal, 40, 'ramal')),\n      ...(observacao !== undefined ? { observacao } : {}),\n    };\n    if (contato?.principal !== undefined) out.principal = contato.principal === true;\n    if (contato?.ativo !== undefined) out.ativo = contato.ativo === true;\n    if (contato?.id != null && String(contato.id).trim() !== '') {\n      const id = String(contato.id);\n      if (ids.has(id)) {\n        throw contatosValidationError('Contatos[] com id duplicado — rejeitado.', 'CLIENTE_CONTATOS_VALIDATION');\n      }\n      ids.add(id);\n      out.id = id;\n    }\n    if (out.principal === true) principals += 1;\n    if (principals > 1) {\n      throw contatosValidationError('Contatos[] com múltiplos principais — rejeitado.', 'CLIENTE_CONTATOS_VALIDATION');\n    }\n    if (contato?.contato_b2b_id != null && String(contato.contato_b2b_id).trim() !== '') {\n      throw contatosValidationError(\n        'contato_b2b_id sem resolução canônica — rejeitado.',\n        'CLIENTE_CONTATO_B2B_REVIEW_REQUIRED',\n        409,\n      );\n    }\n    return out;\n  });\n};\n",
    "const sanitizeContatos = (contatos) => Array.isArray(contatos) ? contatos.slice(0, 50).map((contato) => ({\n  ...contato,\n  tipo: sanitizeText(contato?.tipo, 60),\n  valor: sanitizeText(contato?.valor, 180),\n  principal: sanitizeBoolean(contato?.principal)\n})) : [];\n");
  // #591: mapToForm com espelho documento→cpf/cnpj → forma omit anterior.
  source = once(source,
    '    mapToForm: (record) => {\n'
    + '      // HTTP MASTER: documento(/_normalizado) → cpf/cnpj da UI (zeros preservados; não inventa).\n'
    + '      const blank = (v) => v === undefined || v === null || (typeof v === \'string\' && v.trim() === \'\');\n'
    + '      const docRaw = !blank(record?.documento)\n'
    + '        ? record.documento\n'
    + '        : (!blank(record?.cpf_cnpj)\n'
    + '          ? record.cpf_cnpj\n'
    + '          : (record?.documento_normalizado ?? \'\'));\n'
    + '      const doc = String(docRaw ?? \'\').trim();\n'
    + '      const digits = doc.replace(/\\D/g, \'\');\n'
    + '      let cpf = record?.cpf;\n'
    + '      let cnpj = record?.cnpj;\n'
    + '      if (digits && !/^0+$/.test(digits)) {\n'
    + '        if (blank(cpf) && digits.length === 11) cpf = doc;\n'
    + '        if (blank(cnpj) && digits.length === 14) cnpj = doc;\n'
    + '      }\n'
    + '      const nome = blank(record?.nome) && !blank(record?.razao_social)\n'
    + '        ? String(record.razao_social).trim()\n'
    + '        : record?.nome;\n'
    + '      return {\n'
    + '        ...record,\n'
    + '        ...(nome !== undefined ? { nome } : {}),\n'
    + '        ...(cpf !== undefined ? { cpf } : {}),\n'
    + '        ...(cnpj !== undefined ? { cnpj } : {}),\n'
    + '        // Alinha documento ao campo editável para pickDoc não reenviar residual antigo.\n'
    + '        ...(!blank(cnpj) ? { documento: cnpj } : (!blank(cpf) ? { documento: cpf } : {})),\n'
    + '        // Ausência/null ≠ [] : omitir evita wipe; [] hidratado = limpeza explícita prévia.\n'
    + '        ...(record.contatos === undefined || record.contatos === null\n'
    + '          ? {}\n'
    + '          : { contatos: record.contatos }),\n'
    + '        ...(record.contatos_version !== undefined\n'
    + '          ? { contatos_version: record.contatos_version, expectedVersion: record.contatos_version }\n'
    + '          : {}),\n'
    + '        ...(record.locais_entrega === undefined\n'
    + '          ? {}\n'
    + '          : { locais_entrega: record.locais_entrega || [] }),\n'
    + '        // Ausência ≠ inventar "OK"/R$0/"Simples Nacional" (desconhecido ≠ confirmado).\n'
    + '        ...(record.condicao_comercial === undefined || record.condicao_comercial === null\n'
    + '          ? {}\n'
    + '          : { condicao_comercial: record.condicao_comercial }),\n'
    + '        ...(record.configuracao_fiscal === undefined || record.configuracao_fiscal === null\n'
    + '          ? {}\n'
    + '          : { configuracao_fiscal: record.configuracao_fiscal }),\n'
    + '        ...(record.documentos === undefined ? {} : { documentos: record.documentos || [] }),\n'
    + '      };\n'
    + '    },\n',
    '    mapToForm: (record) => ({\n'
    + '      ...record,\n'
    + '      ...(record.contatos === undefined ? {} : { contatos: record.contatos || [] }),\n'
    + '      ...(record.locais_entrega === undefined\n'
    + '        ? {}\n'
    + '        : { locais_entrega: record.locais_entrega || [] }),\n'
    + '      condicao_comercial: record.condicao_comercial || {\n'
    + '        tabela_preco_id: "",\n'
    + '        forma_pagamento_padrao_id: "",\n'
    + '        percentual_desconto: 0,\n'
    + '        condicao_pagamento: "À Vista",\n'
    + '        limite_credito: 0,\n'
    + '        limite_credito_utilizado: 0,\n'
    + '        situacao_credito: "OK",\n'
    + '      },\n'
    + '      configuracao_fiscal: record.configuracao_fiscal || {\n'
    + '        regime_tributario: "Simples Nacional",\n'
    + '        cfop_padrao_venda: "5102",\n'
    + '        contribuinte_icms: true,\n'
    + '        tipo_contribuinte: "1 - Contribuinte",\n'
    + '        isento_ipi: false,\n'
    + '        isento_icms: false,\n'
    + '      },\n'
    + '      ...(record.documentos === undefined ? {} : { documentos: record.documentos || [] }),\n'
    + '    }),\n');
  source = once(source,
    '      {Boolean(cliente?.id) && (\n'
    + '        formData.contatos === undefined\n'
    + '        || formData.locais_entrega === undefined\n'
    + '        || formData.documentos === undefined\n'
    + '        || formData.condicao_comercial === undefined\n'
    + '        || formData.configuracao_fiscal === undefined\n'
    + '      ) && (\n'
    + '        <div\n'
    + '          className="mx-6 mt-3 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 shrink-0"\n'
    + '          data-pendencia="cliente-parcial"\n'
    + '          role="status"\n'
    + '        >\n'
    + '          {[\n'
    + '            formData.contatos === undefined ? "contatos" : null,\n'
    + '            formData.locais_entrega === undefined ? "endereços de entrega/cobrança" : null,\n'
    + '            formData.documentos === undefined ? "documentos" : null,\n'
    + '            formData.condicao_comercial === undefined ? "condição comercial/crédito" : null,\n'
    + '            formData.configuracao_fiscal === undefined ? "configuração fiscal" : null,\n'
    + '          ].filter(Boolean).join(", ")\n'
    + '            + " ainda não recuperados nesta carga — o salvamento omite esses campos (sem apagar a fonte)."}\n'
    + '          {" "}Endereço cadastral/fiscal permanece em Dados Gerais; não presumir entrega = cadastral. Celular ≠ WhatsApp.\n'
    + '          {" "}Desconhecido ≠ confirmado (crédito/regime).\n'
    + '        </div>\n'
    + '      )}\n'
    + '\n'
    + '      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">\n',
    '      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">\n');
  source = once(source,
    '  /** Rascunho de contatos/endereços — NÃO grava no backend; só `handleSave`/`saveMutation` persistem. */\n'
    + '  /**\n'
    + '   * Exibição Contatos: canais canônicos apenas (quarentena ≠ contato válido).\n'
    + '   * Sem contatos[] no transporte: resumo escalar (≠ lista completa); omit-if-unknown no save.\n'
    + '   * Celular ≠ WhatsApp automático (mesmo contrato do Painel).\n'
    + '   */\n'
    + '  const contatosQuarentena = Array.isArray(formData.contatos)\n'
    + '    ? partitionContatosByCanal(formData.contatos).quarentena\n'
    + '    : [];\n'
    + '  const contatosViewForUi = (() => {\n'
    + '    if (Array.isArray(formData.contatos)) {\n'
    + '      return formData.contatos.filter((c) => isContatoCanalCanonico(c?.tipo));\n'
    + '    }\n'
    + '    const items = formData.contatos_escalares?.items;\n'
    + '    if (Array.isArray(items) && items.length > 0) {\n'
    + '      return items\n'
    + '        .map((item) => ({\n'
    + '          nome: "",\n'
    + '          tipo: item.tipo || item.canal || "Telefone",\n'
    + '          valor: item.valor || "",\n'
    + '          principal: false,\n'
    + '        }))\n'
    + '        .filter((c) => isContatoCanalCanonico(c.tipo));\n'
    + '    }\n'
    + '    const seeded = [];\n'
    + '    const push = (tipo, valor) => {\n'
    + '      if (valor == null || String(valor).trim() === "") return;\n'
    + '      seeded.push({ nome: "", tipo, valor: String(valor).trim(), principal: false });\n'
    + '    };\n'
    + '    push("E-mail", formData.email);\n'
    + '    push("Telefone", formData.telefone);\n'
    + '    push("Celular", formData.celular);\n'
    + '    return seeded;\n'
    + '  })();\n'
    + '\n'
    + '  /** Locais canônicos BFF — leitura; write via `/locais` no save (não MASTER). */\n'
    + '  const [locaisHttpView, setLocaisHttpView] = useState(/** @type {unknown[]|undefined} */ (undefined));\n'
    + '  /** Baseline lido para soft-delete só quando a carga HTTP concluiu (ref evita stale no mutate). */\n'
    + '  const locaisHttpBaselineRef = useRef(/** @type {unknown[]|null|undefined} */ (undefined));\n'
    + '  /** Último summary de sync `/locais` — BATCH_ATOMIC=false nunca vira toast de salvamento integral. */\n'
    + '  const lastLocaisSyncSummaryRef = useRef(/** @type {{\n'
    + '    skipped?: boolean,\n'
    + '    batchAtomic?: boolean,\n'
    + '    created?: number,\n'
    + '    updated?: number,\n'
    + '    deleted?: number,\n'
    + '  }|null} */ (null));\n'
    + '  useEffect(() => {\n'
    + '    const id = clienteBoundId || cliente?.id || null;\n'
    + '    if (!id || !isHttpBackendMode) {\n'
    + '      setLocaisHttpView(undefined);\n'
    + '      locaisHttpBaselineRef.current = undefined;\n'
    + '      return undefined;\n'
    + '    }\n'
    + '    let cancelled = false;\n'
    + '    const session = readErpHttpSession();\n'
    + '    if (!session?.token || !session?.groupId) {\n'
    + '      setLocaisHttpView(undefined);\n'
    + '      locaisHttpBaselineRef.current = undefined;\n'
    + '      return undefined;\n'
    + '    }\n'
    + '    (async () => {\n'
    + '      try {\n'
    + '        const api = createHttpApiClient({ getScope: () => readErpHttpSession() || {} });\n'
    + '        const rows = await api.clientes.listLocais(id, { limit: 50, ativo: true });\n'
    + '        if (cancelled) return;\n'
    + '        const mapped = (Array.isArray(rows) ? rows : []).map((row) => mapClienteLocalToUiEndereco(\n'
    + '          /** @type {Record<string, unknown>} */ (row),\n'
    + '        ));\n'
    + '        setLocaisHttpView(mapped);\n'
    + '        locaisHttpBaselineRef.current = mapped;\n'
    + '      } catch {\n'
    + '        if (!cancelled) {\n'
    + '          setLocaisHttpView(undefined);\n'
    + '          // Carga falhou: não autoriza remoção por omissão.\n'
    + '          locaisHttpBaselineRef.current = null;\n'
    + '        }\n'
    + '      }\n'
    + '    })();\n'
    + '    return () => { cancelled = true; };\n'
    + '  }, [clienteBoundId, cliente?.id]);\n'
    + '\n'
    + '  const locaisViewForUi = Array.isArray(formData.locais_entrega)\n'
    + '    ? formData.locais_entrega\n'
    + '    : (Array.isArray(locaisHttpView) ? locaisHttpView : []);\n'
    + '\n'
    + '  const applyContatosDraft = (novosContatos) => {\n'
    + '    setFormData((prev) => {\n'
    + '      const quarantine = Array.isArray(prev.contatos)\n'
    + '        ? partitionContatosByCanal(prev.contatos).quarentena\n'
    + '        : [];\n'
    + '      const validos = Array.isArray(novosContatos) ? novosContatos : [];\n'
    + '      return { ...prev, contatos: [...validos, ...quarantine] };\n'
    + '    });\n'
    + '  };\n'
    + '  const applyEnderecosDraft = (novosEnderecos) => {\n'
    + '    setFormData((prev) => ({ ...prev, locais_entrega: novosEnderecos }));\n'
    + '  };\n'
    + '\n'
    + '  /** Gravação efetiva no backend (proprietário canônico de persistência deste cadastro). */\n'
    + '  const handleSave = () => {\n',
    '  const handleSave = () => {\n');
  source = once(source,
    "      const payload = buildPayload(data);\n      // Write canônico: locais via /clientes/:id/locais — não empurrar no MASTER.\n      const locaisDraft = Object.prototype.hasOwnProperty.call(payload, 'locais_entrega')\n        ? payload.locais_entrega\n        : undefined;\n      if (isHttpBackendMode && locaisDraft !== undefined) {\n        delete payload.locais_entrega;\n      }\n      // Anexos documentos[] ≠ CPF/CNPJ MASTER ≠ ModeloDocumento — sem DocumentosCliente paralelo.\n      // Não vazio: fail-closed antes do MASTER (erro HTTP ≠ sucesso local). Vazio/omit: não envia.\n      if (isHttpBackendMode) {\n        const docsDraft = Object.prototype.hasOwnProperty.call(payload, 'documentos')\n          ? payload.documentos\n          : undefined;\n        if (Array.isArray(docsDraft) && docsDraft.length > 0) {\n          const err = /** @type {Error & { code: string, status: number, fields: string[] }} */ (\n            new Error(\n              'Anexos documentos[] ainda sem contrato BFF. Rascunho preservado — '\n                + 'CPF/CNPJ e demais campos MASTER não foram enviados neste save.',\n            )\n          );\n          err.code = 'CLIENTE_HTTP_UNSUPPORTED_FIELDS';\n          err.status = 422;\n          err.fields = ['documentos'];\n          throw err;\n        }\n        delete payload.documentos;\n      }\n\n      // Identidade do rascunho (boundId), não props — evita salvar A em B após reject switch.\n      const targetId = clienteBoundId || formData?.id || null;\n      let saved;\n      if (targetId) {\n        if (!podeEditar) throw new Error(\"Seu perfil nao permite editar clientes.\");\n        saved = await updateInContext('Cliente', targetId, payload);\n      } else {\n        if (!podeCriar) throw new Error(\"Seu perfil nao permite criar clientes.\");\n        saved = await createInContext('Cliente', payload);\n      }\n\n      if (isHttpBackendMode && locaisDraft !== undefined) {\n        assertFormScopeCurrent();\n        const clienteId = String(\n          (saved && typeof saved === 'object' && /** @type {{ id?: unknown }} */ (saved).id)\n            || targetId\n            || '',\n        ).trim();\n        if (!clienteId) {\n          throw new Error(\n            'Cliente MASTER gravado, mas id ausente para sincronizar endereços canônicos. '\n              + 'Rascunho de locais preservado — reabra e salve novamente.',\n          );\n        }\n        const sessionBefore = readErpHttpSession();\n        if (!sessionBefore?.token || !sessionBefore?.groupId) {\n          throw new Error(\n            'Sessão HTTP indisponível após salvar MASTER — endereços não sincronizados. '\n              + 'Erro remoto ≠ sucesso local; reabra o cadastro.',\n          );\n        }\n        const frozenScope = Object.freeze({\n          token: String(sessionBefore.token || ''),\n          groupId: String(sessionBefore.groupId || ''),\n          empresaId: String(sessionBefore.empresaId || ''),\n          actorId: String(sessionBefore.actorId || ''),\n          clienteId,\n        });\n        const assertLocaisScope = () => {\n          assertFormScopeCurrent();\n          const now = /** @type {Record<string, unknown>} */ (readErpHttpSession() || {});\n          if (\n            String(now.token || '') !== frozenScope.token\n            || String(now.groupId || '') !== frozenScope.groupId\n            || String(now.empresaId || '') !== frozenScope.empresaId\n            || String(now.actorId || '') !== frozenScope.actorId\n          ) {\n            const err = /** @type {Error & { code: string, status: number }} */ (\n              new Error('Contexto/sessão mudou durante sync de endereços. Reabra o cadastro.')\n            );\n            err.code = 'CONTEXT_CHANGED';\n            err.status = 409;\n            throw err;\n          }\n        };\n        const api = createHttpApiClient({ getScope: () => readErpHttpSession() || {} });\n        // baselineIds null se carga falhou: campo não carregado não apaga persistido.\n        const baselineView = locaisHttpBaselineRef.current;\n        const baselineIds = Array.isArray(baselineView)\n          ? baselineView\n            .map((row) => (row && typeof row === 'object'\n              ? String(/** @type {{ id?: unknown }} */ (row).id || '').trim()\n              : ''))\n            .filter(Boolean)\n          : null;\n        try {\n          const locaisSummary = await syncClienteLocaisViaHttp({\n            clienteId: frozenScope.clienteId,\n            draft: locaisDraft,\n            baselineIds,\n            assertScope: assertLocaisScope,\n            api: api.clientes,\n          });\n          // Summary no ref: mutation continua retornando o MASTER (contrato AST/consumidores).\n          lastLocaisSyncSummaryRef.current = locaisSummary;\n        } catch (syncErr) {\n          lastLocaisSyncSummaryRef.current = null;\n          const code = /** @type {Error & { code?: string }} */ (syncErr)?.code;\n          if (code === CLIENTE_LOCAIS_SYNC_PARTIAL) {\n            // Estado real: reconcilia baseline/rascunho com listLocais (reexecução segura).\n            try {\n              assertLocaisScope();\n              const rows = await api.clientes.listLocais(frozenScope.clienteId, {\n                limit: 50, ativo: true,\n              });\n              const mapped = (Array.isArray(rows) ? rows : []).map((row) => mapClienteLocalToUiEndereco(\n                /** @type {Record<string, unknown>} */ (row),\n              ));\n              setLocaisHttpView(mapped);\n              locaisHttpBaselineRef.current = mapped;\n              setFormData((prev) => ({ ...prev, locais_entrega: mapped }));\n            } catch {\n              locaisHttpBaselineRef.current = null;\n            }\n          }\n          throw syncErr;\n        }\n      }\n\n      return saved;\n",
    "      const payload = buildPayload(data);\n\n      // Identidade do rascunho (boundId), não props — evita salvar A em B após reject switch.\n      const targetId = clienteBoundId || formData?.id || null;\n      if (targetId) {\n        if (!podeEditar) throw new Error(\"Seu perfil nao permite editar clientes.\");\n        return updateInContext('Cliente', targetId, payload);\n      }\n\n      if (!podeCriar) throw new Error(\"Seu perfil nao permite criar clientes.\");\n      return createInContext('Cliente', payload);\n");

  source = once(source,
    '    onError: (error) => {\n'
    + '      const sameScope = isFormScopeCurrent();\n'
    + '      const err = /** @type {Error & { code?: string, summary?: { reconcileRequired?: boolean } }} */ (error);\n'
    + '      const partial = err?.code === CLIENTE_LOCAIS_SYNC_PARTIAL;\n'
    + '      // MASTER pode ter gravado; sync parcial ≠ sucesso — invalida; UI já reconciliou se possível.\n'
    + '      if (partial) {\n'
    + '        queryClient.invalidateQueries({ queryKey: [\'clientes\'] });\n'
    + '      }\n'
    + '      toast({\n'
    + '        title: !sameScope\n'
    + '          ? "Contexto alterado"\n'
    + '          : (partial ? "❌ Endereços parcialmente sincronizados" : "❌ Erro ao salvar cliente"),\n'
    + '        description: sameScope\n'
    + '          ? (err?.message || String(error))\n'
    + '          : "A operação anterior falhou. Reabra o cadastro no contexto atual.",\n'
    + '        variant: "destructive"\n'
    + '      });\n'
    + '    }\n',
    '    onError: (error) => {\n'
    + '      const sameScope = isFormScopeCurrent();\n'
    + '      toast({\n'
    + '        title: sameScope ? "❌ Erro ao salvar cliente" : "Contexto alterado",\n'
    + '        description: sameScope ? (error?.message || String(error)) : "A operação anterior falhou. Reabra o cadastro no contexto atual.",\n'
    + '        variant: "destructive"\n'
    + '      });\n'
    + '    }\n');
  source = once(source,
    '            <TabsContent value="contatos" className="m-0 mt-4" data-cadastro-commit="draft">\n'
    + '              {isHttpBackendMode && (\n'
    + '                <p\n'
    + '                  className="mb-2 text-xs text-sky-900 bg-sky-50 border border-sky-200 rounded px-2 py-1.5"\n'
    + '                  data-fonte="contatos-jsonb-http"\n'
    + '                  data-contrato="contatos-array-master"\n'
    + '                  role="status"\n'
    + '                >\n'
    + '                  Contrato MASTER `contatos[]` (decisão a): leitura/gravação no cadastro canônico.\n'
    + '                  Escalares espelhados best-effort; Celular ≠ WhatsApp. Sem ContatoClienteV2; ContatoB2B FK\n'
    + '                  não destrava este fluxo. Omitir no save ≠ limpar; `[]` limpa. Salvar não duplica canais.\n'
    + '                </p>\n'
    + '              )}\n'
    + '              {formData.contatos === undefined && contatosViewForUi.length > 0 && (\n'
    + '                <p className="mb-2 text-xs text-slate-600" data-fonte="contatos-escalares-http" role="status">\n'
    + '                  Contatos escalares do MASTER (e-mail/telefone/celular). Editar assume a lista no rascunho;\n'
    + '                  Celular não vira WhatsApp automaticamente.\n'
    + '                </p>\n'
    + '              )}\n'
    + '              {contatosQuarentena.length > 0 && (\n'
    + '                <div\n'
    + '                  className="mb-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 space-y-1"\n'
    + '                  data-fonte="contatos-quarentena"\n'
    + '                  role="status"\n'
    + '                >\n'
    + '                  <p>\n'
    + '                    {contatosQuarentena.length} canal(is) em quarentena (tipo inválido) — preservados no save,\n'
    + '                    não confirmados como contato válido. Revisar/corrigir tipo canônico antes de tratar como válido.\n'
    + '                  </p>\n'
    + '                  <ul className="list-disc pl-4" data-quarentena-lista="contatos">\n'
    + '                    {contatosQuarentena.slice(0, 20).map((row, idx) => {\n'
    + '                      const tipo = String(row?.tipo ?? \'\').trim() || \'(sem tipo)\';\n'
    + '                      const valor = String(row?.valor ?? \'\').trim() || \'(sem valor)\';\n'
    + '                      const nome = String(row?.nome ?? \'\').trim();\n'
    + '                      return (\n'
    + '                        <li key={String(row?.id || `${tipo}-${valor}-${idx}`)}>\n'
    + '                          {nome ? `${nome}: ` : \'\'}{tipo} — {valor}\n'
    + '                        </li>\n'
    + '                      );\n'
    + '                    })}\n'
    + '                  </ul>\n'
    + '                </div>\n'
    + '              )}\n'
    + '              <GerenciarContatosClienteForm\n'
    + '                contatos={contatosViewForUi}\n'
    + '                onChange={applyContatosDraft}\n'
    + '                commitMode="draft"\n'
    + '                assertScopeCurrent={assertFormScopeCurrent}\n'
    + '                persistBusy={isSaving || saveMutation.isPending}\n'
    + '              />\n'
    + '            </TabsContent>\n',
    '            <TabsContent value="contatos" className="m-0 mt-4">\n'
    + '              <GerenciarContatosClienteForm\n'
    + '                contatos={formData.contatos || []}\n'
    + '                onChange={(novosContatos) => setFormData({ ...formData, contatos: novosContatos })}\n'
    + '                assertScopeCurrent={assertFormScopeCurrent}\n'
    + '              />\n'
    + '            </TabsContent>\n');
  source = once(source,
    '            <TabsContent value="enderecos" className="m-0 mt-4" data-cadastro-commit="draft">\n'
    + '              {formData.locais_entrega === undefined && Array.isArray(locaisHttpView) && locaisHttpView.length > 0 && (\n'
    + '                <p className="mb-2 text-xs text-slate-600" data-fonte="cliente-locais-http" role="status">\n'
    + '                  Endereços lidos de cliente_locais (canônico). Editar assume o rascunho;\n'
    + '                  ao Salvar, grava via `/locais` (não no MASTER). Entrega ≠ cadastral.\n'
    + '                </p>\n'
    + '              )}\n'
    + '              <GerenciarEnderecosClienteForm\n'
    + '                enderecos={locaisViewForUi}\n'
    + '                onChange={applyEnderecosDraft}\n'
    + '                commitMode="draft"\n'
    + '                assertScopeCurrent={assertFormScopeCurrent}\n'
    + '                persistBusy={isSaving || saveMutation.isPending}\n'
    + '              />\n'
    + '            </TabsContent>\n',
    '            <TabsContent value="enderecos" className="m-0 mt-4">\n'
    + '              <GerenciarEnderecosClienteForm\n'
    + '                enderecos={formData.locais_entrega || []}\n'
    + '                onChange={(novosEnderecos) => setFormData({ ...formData, locais_entrega: novosEnderecos })}\n'
    + '                assertScopeCurrent={assertFormScopeCurrent}\n'
    + '              />\n'
    + '            </TabsContent>\n');
  source = once(source,
    '      // null = desconhecido (não comando público); [] = limpeza explícita; omit = não tocar.\n'
    + '      ...(data.contatos === undefined || data.contatos === null\n'
    + '        ? {}\n'
    + '        : {\n'
    + '            contatos: sanitizeContatos(data.contatos),\n'
    + '            ...(data.expectedVersion !== undefined\n'
    + '              ? { expectedVersion: data.expectedVersion }\n'
    + '              : (data.contatos_version !== undefined\n'
    + '                ? { expectedVersion: data.contatos_version }\n'
    + '                : {})),\n'
    + '          }),',
    '      contatos: sanitizeContatos(data.contatos),');
  // mapToForm já foi peeleado à forma mínima; peel residual do omit→atributo.
  source = once(source, '      ...(record.contatos === undefined ? {} : { contatos: record.contatos || [] }),',
    '      contatos: record.contatos || [],');
  source = once(source,
    '      ...(data.locais_entrega === undefined\n'
    + '        ? {}\n'
    + '        : {\n'
    + '            locais_entrega: Array.isArray(data.locais_entrega)\n'
    + '              ? data.locais_entrega.slice(0, 50).map(sanitizeEndereco)\n'
    + '              : [],\n'
    + '          }),',
    '      locais_entrega: Array.isArray(data.locais_entrega) ? data.locais_entrega.slice(0, 50).map(sanitizeEndereco) : [],');
  // #591: omit crédito/fiscal não carregados → sempre enviar (forma anterior do Completo).
  source = once(source,
    '      // Campo não carregado: omitir (≠ limpar; ≠ inventar default comercial/fiscal).\n'
    + '      ...(data.condicao_comercial === undefined || data.condicao_comercial === null\n'
    + '        ? {}\n'
    + '        : {\n'
    + '            condicao_comercial: {\n'
    + '              ...(data.condicao_comercial || {}),\n'
    + '              tabela_preco_id: sanitizeCode(data.condicao_comercial?.tabela_preco_id, 120),\n'
    + '              forma_pagamento_padrao_id: sanitizeCode(data.condicao_comercial?.forma_pagamento_padrao_id, 120),\n'
    + '              percentual_desconto: toNumber(data.condicao_comercial?.percentual_desconto, 0),\n'
    + '              condicao_pagamento: sanitizeText(data.condicao_comercial?.condicao_pagamento || "A Vista", 80),\n'
    + '              limite_credito: toNumber(data.condicao_comercial?.limite_credito, 0),\n'
    + '              limite_credito_utilizado: toNumber(data.condicao_comercial?.limite_credito_utilizado, 0),\n'
    + '              situacao_credito: sanitizeText(\n'
    + '                data.condicao_comercial?.situacao_credito\n'
    + '                  || (typeof calcularSituacaoCredito === \'function\' ? calcularSituacaoCredito() : \'OK\'),\n'
    + '                40,\n'
    + '              ),\n'
    + '            },\n'
    + '          }),\n'
    + '      ...(data.configuracao_fiscal === undefined || data.configuracao_fiscal === null\n'
    + '        ? {}\n'
    + '        : {\n'
    + '            configuracao_fiscal: {\n'
    + '              ...(data.configuracao_fiscal || {}),\n'
    + '              regime_tributario: sanitizeText(data.configuracao_fiscal?.regime_tributario || "Simples Nacional", 80),\n'
    + '              cfop_padrao_venda: sanitizeCode(data.configuracao_fiscal?.cfop_padrao_venda || "5102", 12),\n'
    + '              contribuinte_icms: sanitizeBoolean(data.configuracao_fiscal?.contribuinte_icms),\n'
    + '              tipo_contribuinte: sanitizeText(data.configuracao_fiscal?.tipo_contribuinte || "1 - Contribuinte", 80),\n'
    + '              isento_ipi: sanitizeBoolean(data.configuracao_fiscal?.isento_ipi),\n'
    + '              isento_icms: sanitizeBoolean(data.configuracao_fiscal?.isento_icms),\n'
    + '              observacoes_fiscais: sanitizeText(data.configuracao_fiscal?.observacoes_fiscais, 1000),\n'
    + '            },\n'
    + '          }),',
    '      condicao_comercial: {\n'
    + '        ...(data.condicao_comercial || {}),\n'
    + '        tabela_preco_id: sanitizeCode(data.condicao_comercial?.tabela_preco_id, 120),\n'
    + '        forma_pagamento_padrao_id: sanitizeCode(data.condicao_comercial?.forma_pagamento_padrao_id, 120),\n'
    + '        percentual_desconto: toNumber(data.condicao_comercial?.percentual_desconto, 0),\n'
    + '        condicao_pagamento: sanitizeText(data.condicao_comercial?.condicao_pagamento || "A Vista", 80),\n'
    + '        limite_credito: toNumber(data.condicao_comercial?.limite_credito, 0),\n'
    + '        limite_credito_utilizado: toNumber(data.condicao_comercial?.limite_credito_utilizado, 0),\n'
    + '        situacao_credito: sanitizeText(data.condicao_comercial?.situacao_credito || calcularSituacaoCredito(), 40)\n'
    + '      },\n'
    + '      configuracao_fiscal: {\n'
    + '        ...(data.configuracao_fiscal || {}),\n'
    + '        regime_tributario: sanitizeText(data.configuracao_fiscal?.regime_tributario || "Simples Nacional", 80),\n'
    + '        cfop_padrao_venda: sanitizeCode(data.configuracao_fiscal?.cfop_padrao_venda || "5102", 12),\n'
    + '        contribuinte_icms: sanitizeBoolean(data.configuracao_fiscal?.contribuinte_icms),\n'
    + '        tipo_contribuinte: sanitizeText(data.configuracao_fiscal?.tipo_contribuinte || "1 - Contribuinte", 80),\n'
    + '        isento_ipi: sanitizeBoolean(data.configuracao_fiscal?.isento_ipi),\n'
    + '        isento_icms: sanitizeBoolean(data.configuracao_fiscal?.isento_icms),\n'
    + '        observacoes_fiscais: sanitizeText(data.configuracao_fiscal?.observacoes_fiscais, 1000)\n'
    + '      },');
  source = once(source,
    '      ...(record.locais_entrega === undefined\n'
    + '        ? {}\n'
    + '        : { locais_entrega: record.locais_entrega || [] }),',
    '      locais_entrega: record.locais_entrega || [],');
  source = once(source, '      ...(data.documentos === undefined ? {} : { documentos: sanitizeDocumentos(data.documentos) }),',
    '      documentos: sanitizeDocumentos(data.documentos),');
  return once(source, '      ...(record.documentos === undefined ? {} : { documentos: record.documentos || [] }),',
    '      documentos: record.documentos || [],');
}

// previousHash: stage48 + P1 reopen + boundId coorte (#353 Banco/Cargo/+; switch-reject).
const forms = [
  ['CadastroClienteCompleto', 'cliente', 'Cliente', '387761ffcdfa9ca6b55b8e4d5c9a2d6819eb328dd1eff464dbca415e65bb5e27'], // #591 piloto-cobertura: ownText omit + superfície ALLOWED_KEYS
  ['CadastroFornecedorCompleto', 'fornecedor', 'Fornecedor', 'b8def9d66502f8dba814f1ecf457e40b59215cbdc2d31866590fad491db587fb'],
  ['RepresentanteFormCompleto', 'representante', 'Representante', '961a1d5e46395bad4e738f9671c6a86051a27ed8076346a87457ead41a9dc910'],
];
for (const [name, recordKey, entity, previousHash] of forms) {
  const path = `src/components/cadastros/${name}.jsx`;
  test(`${name}: stage48 complete source retained except payload annotation and proven default export`, () => {
    let source = once(read(path), '    /** @param {Record<string, unknown>} data */\n    mutationFn: async (data) => {', '    mutationFn: async (data) => {');
    if (name === 'CadastroClienteCompleto') source = once(source, 'default: m.default }', 'default: m.default || m.TimelineCliente }');
    if (name === 'CadastroClienteCompleto') source = clienteContactPresenceRemainder(source);
    assert.match(source, /useCadastroReopenOnIdentity/);
    assert.equal(createHash('sha256').update(source).digest('hex'), previousHash);
  });
  const tree = parse(path);
  const declaration = nodes(tree, node => ts.isVariableDeclaration(node) && node.name.getText(tree) === 'saveMutation')[0];
  const options = declaration.initializer.arguments[0];
  const callback = key => options.properties.find(node => node.name?.getText(tree) === key).initializer.getText(tree);
  const make = (text, bindings) => new Function(...Object.keys(bindings), `return (${text});`)(...Object.values(bindings));
  test(`${name}: actual insert/update passes its canonical payload, existing company ownership and permission gates`, async () => {
    const input = { nome: 'Synthetic record', group_id: 'group-a', empresa_id: 'company-a' };
    for (const editing of [false, true]) {
      const calls = [];
      const canonical = { ...input, normalized: true };
      const boundId = editing ? 'synthetic-a' : null;
      const fn = make(callback('mutationFn'), {
        assertFormScopeCurrent() {}, contextoValido: true,
        podeEditar: true, podeCriar: true, [recordKey]: editing ? { id: 'synthetic-a' } : null,
        // P1 switch-reject: mutação usa identidade do rascunho (formData.id / *BoundId), não só props.
        formData: editing ? { id: 'synthetic-a' } : {},
        representanteBoundId: recordKey === 'representante' ? boundId : undefined,
        clienteBoundId: recordKey === 'cliente' ? boundId : undefined,
        fornecedorBoundId: recordKey === 'fornecedor' ? boundId : undefined,
        // Completo HTTP sync `/locais` só com modo HTTP; AST MASTER permanece no create/update.
        isHttpBackendMode: false,
        locaisHttpBaselineRef: { current: undefined },
        lastLocaisSyncSummaryRef: { current: null },
        readErpHttpSession: () => null,
        createHttpApiClient: () => ({ clientes: {} }),
        syncClienteLocaisViaHttp: async () => { throw new Error('sync não deve rodar neste AST'); },
        buildPayload(value) { assert.equal(value, input); return canonical; },
        updateInContext: (...args) => { calls.push(['update', ...args]); return Promise.resolve({ id: 'synthetic-a' }); },
        createInContext: (...args) => { calls.push(['create', ...args]); return Promise.resolve({ id: 'synthetic-a' }); },
      });
      assert.deepEqual(await fn(input), { id: 'synthetic-a' });
      const expected = editing ? ['update', entity, 'synthetic-a', canonical] : ['create', entity, canonical];
      if (entity === 'Fornecedor') expected.push('empresa_dona_id');
      assert.deepEqual(calls, [expected]);
    }
    for (const blocked of ['context', 'scope', 'create', 'update']) {
      let writes = 0;
      const boundId = blocked === 'update' ? 'synthetic-a' : null;
      const fn = make(callback('mutationFn'), {
        assertFormScopeCurrent() { if (blocked === 'scope') throw Error('Synthetic scope changed'); },
        contextoValido: blocked !== 'context', podeEditar: false, podeCriar: false,
        [recordKey]: blocked === 'update' ? { id: 'synthetic-a' } : null,
        formData: blocked === 'update' ? { id: 'synthetic-a' } : {},
        representanteBoundId: recordKey === 'representante' ? boundId : undefined,
        clienteBoundId: recordKey === 'cliente' ? boundId : undefined,
        fornecedorBoundId: recordKey === 'fornecedor' ? boundId : undefined,
        isHttpBackendMode: false,
        locaisHttpBaselineRef: { current: undefined },
        lastLocaisSyncSummaryRef: { current: null },
        readErpHttpSession: () => null,
        createHttpApiClient: () => ({ clientes: {} }),
        syncClienteLocaisViaHttp: async () => {},
        buildPayload: value => value,
        createInContext() { writes++; }, updateInContext() { writes++; },
      });
      await assert.rejects(fn(input)); assert.equal(writes, 0);
    }
  });
  test(`${name}: actual success callback retains submitted variables and ignores stale scope`, () => {
    for (const current of [true, false]) {
      const events = [], payload = { nome: 'Synthetic submitted' }, fallback = { nome: 'Synthetic fallback' };
      const fn = make(callback('onSuccess'), {
        isFormScopeCurrent: () => current,
        queryClient: { invalidateQueries: value => events.push(['invalidate', value]) },
        toast: value => events.push(['toast', value]), [recordKey]: null,
        representanteBoundId: null, clienteBoundId: null, fornecedorBoundId: null,
        lastLocaisSyncSummaryRef: { current: null },
        onSuccess: () => events.push(['success']), onSubmit: value => events.push(['submit', value]),
        onCloseNorm: () => events.push(['close']), buildPayload: () => fallback, formData: {},
      });
      fn({ id: 'synthetic-result' }, payload);
      if (!current) assert.deepEqual(events, []);
      else {
        assert.deepEqual(events.find(event => event[0] === 'submit'), ['submit', entity === 'Fornecedor' ? fallback : payload]);
        assert.equal(events.at(-1)[0], 'close');
      }
    }
  });
}

test('Timeline lazy loader uses the actual default export, retaining separate ResumoHistorico loader', async () => {
  const path = 'src/components/cadastros/CadastroClienteCompleto.jsx', tree = parse(path);
  const declaration = nodes(tree, node => ts.isVariableDeclaration(node) && node.name.getText(tree) === 'TimelineCliente')[0];
  const loader = declaration.initializer.arguments[0].getText(tree).replace('import("@/components/cliente/TimelineCliente")', 'Promise.resolve(module)');
  const component = () => null;
  assert.equal((await new Function('module', `return (${loader})();`)({ default: component })).default, component);
  const module = parse('src/components/cliente/TimelineCliente.jsx');
  assert.ok(module.statements.some(node => ts.isFunctionDeclaration(node) && node.name?.text === 'TimelineCliente'
    && node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword)));
  assert.ok(read(path).includes('default: m.ResumoHistorico'));
});

const dashboard = 'src/components/administracao-sistema/seguranca-governanca/SegurancaDashboard.jsx';
test('Dashboard stage48 source retained except five exact query-read hunks', () => {
  let source = once(read(dashboard), 'const { data } = useQuery({', 'const { data = {} } = useQuery({');
  for (const field of ['estatisticas', 'perfis', 'usuarios', 'auditoriaAcessos']) source = once(source, `data?.${field} ||`, `data.${field} ||`);
  assert.equal(createHash('sha256').update(source).digest('hex'), '59a7d00ec09641022de0d1703611ffed85391bc0588d9dd65f2f3d7e52ffea09');
});
test('Dashboard query absent/present data renders unchanged fallbacks without authorizing a query', () => {
  const tree = parse(dashboard);
  const fields = ['estatisticas', 'perfis', 'usuarios', 'auditoriaAcessos'];
  const attrs = nodes(tree, node => ts.isJsxAttribute(node) && fields.includes(node.name.getText(tree)));
  assert.equal(attrs.length, 4);
  const evaluate = data => attrs.map(attr => new Function('data', `return (${attr.initializer.expression.getText(tree)});`)(data));
  assert.deepEqual(evaluate(undefined), [{ cobertura: 0, totalUsuarios: 0, conflitosTotal: 0 }, [], [], []]);
  const data = { estatisticas: { cobertura: 50 }, perfis: [{ id: 'profile-a' }], usuarios: [{ id: 'user-a' }], auditoriaAcessos: [{ id: 'audit-a' }] };
  assert.deepEqual(evaluate(data), Object.values(data));
  const query = nodes(tree, node => ts.isCallExpression(node) && node.expression.getText(tree) === 'useQuery')[0];
  const enabled = query.arguments[0].properties.find(node => node.name?.getText(tree) === 'enabled').initializer.getText(tree);
  for (const canView of [false, true]) for (const contextoValido of [false, true]) {
    assert.equal(new Function('canView', 'contextoValido', `return (${enabled});`)(canView, contextoValido), canView && contextoValido);
  }
});
