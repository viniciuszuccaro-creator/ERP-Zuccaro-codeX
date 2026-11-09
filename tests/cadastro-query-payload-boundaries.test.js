test('Cliente contatos/locais: remainder rejeita omissao repeticao e efeito colateral nos hunks', () => {
  const source = read('src/components/cadastros/CadastroClienteCompleto.jsx');
  const payload = '    ...(data.contatos === undefined ? {} : { contatos: sanitizeContatos(data.contatos) }),';
  const mapper = '        ...(record.contatos === undefined ? {} : { contatos: record.contatos || [] }),';
  const locaisPayload = [
    '    ...(data.locais_entrega === undefined',
    '      ? {}',
    '      : {',
    '          locais_entrega: Array.isArray(data.locais_entrega)',
    '            ? data.locais_entrega.slice(0, 50).map(sanitizeEndereco)',
    '            : [],',
    '        }),',
  ].join('\n');
  const locaisMapper = [
    '        ...(record.locais_entrega === undefined',
    '          ? {}',
    '          : { locais_entrega: record.locais_entrega || [] }),',
  ].join('\n');
  const docsPayload = '    ...(data.documentos === undefined ? {} : { documentos: sanitizeDocumentos(data.documentos) }),';
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
  const target = '    nome_fantasia: sanitizeText(data.nome_fantasia, 180),';
  assert.equal(source.split(target).length - 1, 1);
  const forged = source.replace(target, "    nome_fantasia: 'FORGED',");
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
    "import { mapClienteLocalToUiEndereco } from \"@/api/clienteHttpPayload\";\n",
    '');
  // #591: mapToForm com espelho documento→cpf/cnpj → forma omit anterior.
  source = once(source,
    '    mapToForm: (record) => {\n'
    + '      // HTTP MASTER: documento unificado → cpf/cnpj da UI (zeros preservados; não inventa).\n'
    + '      const blank = (v) => v === undefined || v === null || (typeof v === \'string\' && v.trim() === \'\');\n'
    + '      const docRaw = record?.documento ?? record?.cpf_cnpj ?? \'\';\n'
    + '      const doc = String(docRaw ?? \'\').trim();\n'
    + '      const digits = doc.replace(/\\D/g, \'\');\n'
    + '      let cpf = record?.cpf;\n'
    + '      let cnpj = record?.cnpj;\n'
    + '      if (digits && !/^0+$/.test(digits)) {\n'
    + '        if (blank(cpf) && digits.length === 11) cpf = doc;\n'
    + '        if (blank(cnpj) && digits.length === 14) cnpj = doc;\n'
    + '      }\n'
    + '      return {\n'
    + '        ...record,\n'
    + '        ...(cpf !== undefined ? { cpf } : {}),\n'
    + '        ...(cnpj !== undefined ? { cnpj } : {}),\n'
    + '        // Ausência ≠ [] : omitir evita wipe no save (contrato HTTP parcial).\n'
    + '        ...(record.contatos === undefined ? {} : { contatos: record.contatos || [] }),\n'
    + '        ...(record.locais_entrega === undefined\n'
    + '          ? {}\n'
    + '          : { locais_entrega: record.locais_entrega || [] }),\n'
    + '        condicao_comercial: record.condicao_comercial || {\n'
    + '          tabela_preco_id: "",\n'
    + '          forma_pagamento_padrao_id: "",\n'
    + '          percentual_desconto: 0,\n'
    + '          condicao_pagamento: "À Vista",\n'
    + '          limite_credito: 0,\n'
    + '          limite_credito_utilizado: 0,\n'
    + '          situacao_credito: "OK",\n'
    + '        },\n'
    + '        configuracao_fiscal: record.configuracao_fiscal || {\n'
    + '          regime_tributario: "Simples Nacional",\n'
    + '          cfop_padrao_venda: "5102",\n'
    + '          contribuinte_icms: true,\n'
    + '          tipo_contribuinte: "1 - Contribuinte",\n'
    + '          isento_ipi: false,\n'
    + '          isento_icms: false,\n'
    + '        },\n'
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
    '      {Boolean(cliente?.id) && (formData.contatos === undefined || formData.locais_entrega === undefined || formData.documentos === undefined) && (\n'
    + '        <div\n'
    + '          className="mx-6 mt-3 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 shrink-0"\n'
    + '          data-pendencia="cliente-parcial"\n'
    + '          role="status"\n'
    + '        >\n'
    + '          {[\n'
    + '            formData.contatos === undefined ? "contatos" : null,\n'
    + '            formData.locais_entrega === undefined ? "endereços de entrega/cobrança" : null,\n'
    + '            formData.documentos === undefined ? "documentos" : null,\n'
    + '          ].filter(Boolean).join(", ")\n'
    + '            + " ainda não recuperados nesta carga — o salvamento omite esses campos (sem apagar a fonte)."}\n'
    + '          {" "}Endereço cadastral/fiscal permanece em Dados Gerais; não presumir entrega = cadastral. Celular ≠ WhatsApp.\n'
    + '        </div>\n'
    + '      )}\n'
    + '\n'
    + '      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">\n',
    '      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">\n');
  source = once(source,
    '  /** Rascunho de contatos/endereços — NÃO grava no backend; só `handleSave`/`saveMutation` persistem. */\n'
    + '  /**\n'
    + '   * Exibição Contatos quando HTTP só trouxe escalares (sem contatos[]).\n'
    + '   * NÃO grava em formData.contatos até o operador editar — omit-if-unknown no save.\n'
    + '   * Celular ≠ WhatsApp automático (mesmo contrato do Painel).\n'
    + '   */\n'
    + '  const contatosViewForUi = (() => {\n'
    + '    if (Array.isArray(formData.contatos)) return formData.contatos;\n'
    + '    const items = formData.contatos_escalares?.items;\n'
    + '    if (Array.isArray(items) && items.length > 0) {\n'
    + '      return items.map((item) => ({\n'
    + '        nome: "",\n'
    + '        tipo: item.tipo || item.canal || "Telefone",\n'
    + '        valor: item.valor || "",\n'
    + '        principal: false,\n'
    + '      }));\n'
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
    + '  /** Locais canônicos BFF — leitura; save MASTER ainda omit/fail-closed até write via /locais. */\n'
    + '  const [locaisHttpView, setLocaisHttpView] = useState(/** @type {unknown[]|undefined} */ (undefined));\n'
    + '  useEffect(() => {\n'
    + '    const id = clienteBoundId || cliente?.id || null;\n'
    + '    if (!id || !isHttpBackendMode) {\n'
    + '      setLocaisHttpView(undefined);\n'
    + '      return undefined;\n'
    + '    }\n'
    + '    let cancelled = false;\n'
    + '    const session = readErpHttpSession();\n'
    + '    if (!session?.token || !session?.groupId) {\n'
    + '      setLocaisHttpView(undefined);\n'
    + '      return undefined;\n'
    + '    }\n'
    + '    (async () => {\n'
    + '      try {\n'
    + '        const api = createHttpApiClient({ getScope: () => readErpHttpSession() || {} });\n'
    + '        const rows = await api.clientes.listLocais(id, { limit: 50, ativo: true });\n'
    + '        if (cancelled) return;\n'
    + '        setLocaisHttpView(\n'
    + '          (Array.isArray(rows) ? rows : []).map((row) => mapClienteLocalToUiEndereco(\n'
    + '            /** @type {Record<string, unknown>} */ (row),\n'
    + '          )),\n'
    + '        );\n'
    + '      } catch {\n'
    + '        if (!cancelled) setLocaisHttpView(undefined);\n'
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
    + '    setFormData((prev) => ({ ...prev, contatos: novosContatos }));\n'
    + '  };\n'
    + '  const applyEnderecosDraft = (novosEnderecos) => {\n'
    + '    setFormData((prev) => ({ ...prev, locais_entrega: novosEnderecos }));\n'
    + '  };\n'
    + '\n'
    + '  /** Gravação efetiva no backend (proprietário canônico de persistência deste cadastro). */\n'
    + '  const handleSave = () => {\n',
    '  const handleSave = () => {\n');
  source = once(source,
    '            <TabsContent value="contatos" className="m-0 mt-4" data-cadastro-commit="draft">\n'
    + '              {formData.contatos === undefined && contatosViewForUi.length > 0 && (\n'
    + '                <p className="mb-2 text-xs text-slate-600" data-fonte="contatos-escalares-http" role="status">\n'
    + '                  Contatos escalares do MASTER (e-mail/telefone/celular). Editar assume a lista no rascunho;\n'
    + '                  Celular não vira WhatsApp automaticamente.\n'
    + '                </p>\n'
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
    + '                  salvamento MASTER com locais_entrega não vazios permanece fail-closed até write via /locais.\n'
    + '                  Entrega ≠ cadastral.\n'
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
  source = once(source, '    ...(data.contatos === undefined ? {} : { contatos: sanitizeContatos(data.contatos) }),',
    '    contatos: sanitizeContatos(data.contatos),');
  source = once(source, '      ...(record.contatos === undefined ? {} : { contatos: record.contatos || [] }),',
    '      contatos: record.contatos || [],');
  source = once(source,
    '    ...(data.locais_entrega === undefined\n'
    + '      ? {}\n'
    + '      : {\n'
    + '          locais_entrega: Array.isArray(data.locais_entrega)\n'
    + '            ? data.locais_entrega.slice(0, 50).map(sanitizeEndereco)\n'
    + '            : [],\n'
    + '        }),',
    '    locais_entrega: Array.isArray(data.locais_entrega) ? data.locais_entrega.slice(0, 50).map(sanitizeEndereco) : [],');
  source = once(source,
    '      ...(record.locais_entrega === undefined\n'
    + '        ? {}\n'
    + '        : { locais_entrega: record.locais_entrega || [] }),',
    '      locais_entrega: record.locais_entrega || [],');
  source = once(source, '    ...(data.documentos === undefined ? {} : { documentos: sanitizeDocumentos(data.documentos) }),',
    '    documentos: sanitizeDocumentos(data.documentos),');
  return once(source, '      ...(record.documentos === undefined ? {} : { documentos: record.documentos || [] }),',
    '      documentos: record.documentos || [],');
}

// previousHash: stage48 + P1 reopen + boundId coorte (#353 Banco/Cargo/+; switch-reject).
const forms = [
  ['CadastroClienteCompleto', 'cliente', 'Cliente', '4edac36448aeb24c521716a90ac4ef4bcf0b7fd73bf48e7866a50284ec2a1df9'], // #353 azul-claro sky no roteiro
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
