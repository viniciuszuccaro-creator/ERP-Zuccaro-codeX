import assert from 'node:assert/strict';

export const componentContractHunks = {
  'src/components/lib/usePermissions.jsx': [[
    'from "../../../base44/functions/_lib/security/entityGuardPolicy/entry";',
    'from "../../../base44/functions/_lib/security/entityGuardPolicy/entry.ts";', 1,
  ], [
    "      organizacional: 'organizacional',\n      // Bloco2 Produtos — evita Cadastros.SetorAtividade.* sem nó na árvore owner.\n      produto: 'produtos',\n      produtos: 'produtos',\n      servico: 'produtos',\n      servicos: 'produtos',\n      setoratividade: 'produtos',\n      setoresatividade: 'produtos',\n      grupoproduto: 'produtos',\n      gruposproduto: 'produtos',\n      marca: 'produtos',\n      marcas: 'produtos',\n      tabelapreco: 'produtos',\n      tabelaspreco: 'produtos',\n      kitproduto: 'produtos',\n      kitsproduto: 'produtos',\n      catalogoweb: 'produtos',\n      unidademedida: 'produtos',\n      unidadesmedida: 'produtos',\n      // Bloco3 Financeiro — seção owner Cadastros.Financeiro (não sobrescrever planodecontas→tabelas_fiscais).\n      financeiro: 'financeiro',\n      banco: 'financeiro',\n      bancos: 'financeiro',\n      formapagamento: 'financeiro',\n      formaspagamento: 'financeiro',\n      centrocusto: 'financeiro',\n      centroscusto: 'financeiro',\n      centroresultado: 'financeiro',\n      tipodespesa: 'financeiro',\n      tipodespesas: 'financeiro',\n      moedaindice: 'financeiro',\n      operadorcaixa: 'financeiro',\n      configuracaodespesarecorrente: 'financeiro',\n      tabelafiscal: 'financeiro',\n      condicaocomercial: 'financeiro',\n      // Bloco4 Logística\n      logistica: 'logistica',\n      veiculo: 'logistica',\n      veiculos: 'logistica',\n      motorista: 'logistica',\n      motoristas: 'logistica',\n      tipofrete: 'logistica',\n      localestoque: 'logistica',\n      locaisestoque: 'logistica',\n      rotapadrao: 'logistica',\n      modelodocumento: 'logistica',\n      // Bloco6 Tecnologia\n      tecnologia: 'tecnologia',\n      apiexterna: 'tecnologia',\n      chatbotcanal: 'tecnologia',\n      chatbotintent: 'tecnologia',\n      gatewaypagamento: 'tecnologia',\n      jobagendado: 'tecnologia',\n      webhook: 'tecnologia',\n      configuracaonfe: 'tecnologia',\n      eventonotificacao: 'tecnologia',\n      // Fiscal UI ↔ árvore owner (nfe / tabelas_fiscais / sped / obrigacoes).\n",
    "      organizacional: 'organizacional',\n      // Fiscal UI ↔ árvore owner (nfe / tabelas_fiscais / sped / obrigacoes).\n", 1,
  ], [
    // ownOnly: entidade aliasada não herda grant de irmãos (Bugbot/Security).
    `    /**
     * Resolve path na árvore de permissões.
     * Entidade aliasada → seção owner: preferir filho com o nome da entidade;
     * sem filho, só ações do próprio nó seção (ownOnly) — não herda grant de irmãos via DFS.
     * @returns {{ node: unknown, ownOnly: boolean }}
     */
    const getNodeByPath = (root, pathArr) => {
      let cursor = root;
      let ownOnly = false;
      for (let i = 0; i < pathArr.length; i++) {
        if (!cursor || typeof cursor !== 'object') return { node: undefined, ownOnly: false };
        const rawKey = pathArr[i];
        const normRaw = normalizeSimple(rawKey);
        const alias = SECTION_ALIASES[normRaw];
        const keys = Object.keys(cursor || {});

        // 1) Chave exata (entidade/seção) — prioridade sobre alias.
        const exact = keys.find((k) => normalizeSimple(k) === normRaw);
        if (exact) {
          cursor = cursor[exact];
          ownOnly = false;
          continue;
        }

        // 2) Alias entidade → seção owner (ou seção→seção identidade).
        if (alias) {
          const sectionHit = keys.find((k) => normalizeSimple(k) === normalizeSimple(alias));
          if (!sectionHit) {
            cursor = undefined;
            ownOnly = false;
            continue;
          }
          const sectionNode = cursor[sectionHit];
          // Alias identidade (produtos→produtos): checagem de seção intencional → DFS ok.
          if (normalizeSimple(alias) === normRaw) {
            cursor = sectionNode;
            ownOnly = false;
            continue;
          }
          // Preferir filho com o nome da entidade sob a seção owner.
          if (sectionNode && typeof sectionNode === 'object' && !Array.isArray(sectionNode)) {
            const entityChild = Object.keys(sectionNode).find((k) => normalizeSimple(k) === normRaw);
            if (entityChild) {
              cursor = sectionNode[entityChild];
              ownOnly = false;
              continue;
            }
          }
          // Sem nó da entidade: só grants do próprio nó seção (não DFS em Marca/Motorista/…).
          cursor = sectionNode;
          ownOnly = true;
          continue;
        }

        // 3) resolveModule / candidatos legados.
        const candidates = [rawKey, resolveModule(rawKey)].filter(Boolean);
        const found = keys.find((k) => candidates.some((candidate) => normalizeSimple(k) === normalizeSimple(candidate)));
        cursor = found ? cursor[found] : undefined;
        ownOnly = false;
      }
      return { node: cursor, ownOnly };
    };

    const getRootNode = (root, module) => {
      if (!root || typeof root !== 'object') return undefined;
      const candidates = [module, resolveModule(module)].filter(Boolean);
      const keys = Object.keys(root || {});
      for (const candidate of candidates) {
        const found = keys.find((k) => normalizeSimple(k) === normalizeSimple(candidate));
        if (found) return root[found];
      }
      return undefined;
    };

    const actionMatches = (list, desired) => (
      Array.isArray(list)
      && (list.includes(desired) || (desired === 'visualizar' && list.includes('ver')))
    );

    /**
     * Grant de seção: o próprio nó como array OU chave canônica _acoes.
     * Nunca Object.values — arrays em marca/motorista/… são entidades irmãs.
     */
    const nodeHasOwnAction = (node, desired) => {
      if (actionMatches(node, desired)) return true;
      if (!node || typeof node !== 'object' || Array.isArray(node)) return false;
      return actionMatches(node._acoes, desired);
    };

    const nodeHasAction = (node, desired) => {
      if (actionMatches(node, desired)) return true;
      if (!node || typeof node !== 'object') return false;
      const stack = [node];
      while (stack.length) {
        const current = stack.pop();
        if (actionMatches(current, desired)) return true;
        if (current && typeof current === 'object' && !Array.isArray(current)) {
          Object.values(current).forEach((value) => stack.push(value));
        }
      }
      return false;
    };
`,
    `    const getNodeByPath = (root, pathArr) => {
      let cursor = root;
      for (let i = 0; i < pathArr.length; i++) {
        if (!cursor || typeof cursor !== 'object') return undefined;
        const rawKey = pathArr[i];
        const key = SECTION_ALIASES[normalizeSimple(rawKey)] || rawKey;
        const candidates = [rawKey, key, resolveModule(rawKey)].filter(Boolean);
        const keys = Object.keys(cursor || {});
        const found = keys.find((k) => candidates.some((candidate) => normalizeSimple(k) === normalizeSimple(candidate)));
        cursor = found ? cursor[found] : undefined;
      }
      return cursor;
    };

    const getRootNode = (root, module) => {
      if (!root || typeof root !== 'object') return undefined;
      const candidates = [module, resolveModule(module)].filter(Boolean);
      const keys = Object.keys(root || {});
      for (const candidate of candidates) {
        const found = keys.find((k) => normalizeSimple(k) === normalizeSimple(candidate));
        if (found) return root[found];
      }
      return undefined;
    };

    const nodeHasAction = (node, desired) => {
      if (Array.isArray(node)) return node.includes(desired) || (desired === 'visualizar' && node.includes('ver'));
      if (!node || typeof node !== 'object') return false;
      const stack = [node];
      while (stack.length) {
        const current = stack.pop();
        if (Array.isArray(current)) {
          if (current.includes(desired) || (desired === 'visualizar' && current.includes('ver'))) return true;
        } else if (current && typeof current === 'object') {
          Object.values(current).forEach((value) => stack.push(value));
        }
      }
      return false;
    };
`, 1,
  ], [
    '    const resolved = getNodeByPath(modNode, path);\n'
    + '    if (resolved.node == null) return false;\n'
    + '    return resolved.ownOnly\n'
    + '      ? nodeHasOwnAction(resolved.node, desired)\n'
    + '      : nodeHasAction(resolved.node, desired);\n',
    '    let cursor = getNodeByPath(modNode, path);\n'
    + '    if (cursor == null) return false;\n'
    + '    return nodeHasAction(cursor, desired);\n', 1,
  ]],
  'src/components/estoque/estoque-launchpad/KPIsEstoque.jsx': [[
    'submodule="KPIs" tab={null} field="valores"', 'submodule="KPIs" field="valores"', 2,
  ]],
  'src/components/estoque/RelatoriosEstoque.jsx': [
    ...['valor_estoque', 'valor_imobilizado'].map(field => [`submodule="Relatorios" tab={null} field="${field}"`, `submodule="Relatorios" field="${field}"`, 1]),
  ],
  'src/components/layout/ModuleHeader.jsx': [[
    '/** @param {{title?: React.ReactNode, subtitle?: React.ReactNode, actions?: React.ReactNode,\n * children?: React.ReactNode, className?: string}} props */\n', '', 1,
  ]],
  'src/components/lib/GuardRails.jsx': [['/** @param {{hint?: React.ReactNode}} props */\nfunction SessionEscapeActions', 'function SessionEscapeActions', 1]],
  'src/components/expedicao/RoteirizacaoMapa.jsx': [
    ...[['motorista', 'motoristaSelecionado', 'setMotoristaSelecionado'], ['veiculo', 'veiculoSelecionado', 'setVeiculoSelecionado']].map(([id, value, setter]) => [
      `<Select value={${value}} onValueChange={${setter}}>\n                  <SelectTrigger id="${id}-select">`,
      `<Select value={${value}} onValueChange={${setter}} id="${id}-select">\n                  <SelectTrigger>`, 1,
    ]),
  ],
  'src/components/comercial/pedidoUiPolicy.js': [
    // Reabertura de Pedido convertido: preservar somente a origem canônica.
    ["  return {\n    orcamento_id: row.orcamento_id || '',\n    cliente_empresa_id: row.cliente_empresa_id || '',", "  return {\n    cliente_empresa_id: row.cliente_empresa_id || '',", 1],
    [
      'subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },',
      'subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },', 1,
    ],
    // #353 entrada-em-uso: explainPedidoPersistenceError (044 + código público) — delta autorizado; remainder histórico preservado.
    ["\n/**\n * Traduz falhas de persistência de Pedido (ex.: destino sem migration 044)\n * para mensagem explícita. Não mascara ausência de schema como “salvo”.\n * Coordenação Codex — Cursor não aplica DDL neste lote.\n *\n * @param {unknown} error\n * @returns {string|null}\n */\nexport function explainPedidoPersistenceError(error) {\n  if (!error || typeof error !== 'object') return null;\n  const err = /** @type {Record<string, unknown>} */ (error);\n  const body = err.body && typeof err.body === 'object'\n    ? /** @type {Record<string, unknown>} */ (err.body)\n    : null;\n  const nested = body?.error && typeof body.error === 'object'\n    ? /** @type {Record<string, unknown>} */ (body.error)\n    : null;\n  const publicCode = String(nested?.code || body?.code || err.code || '');\n  // Contrato público estável (produção): sem SQL/42703 no envelope.\n  if (publicCode === 'PEDIDO_SCHEMA_IDEMPOTENCY_MISSING') {\n    return 'Persistência de Pedido indisponível neste destino: faltam colunas de idempotência (migration 044). '\n      + 'Não declare vendas prontas. Coordene aplicação autorizada com Codex; o rascunho não foi confirmado como salvo.';\n  }\n  const chunks = [\n    err.message,\n    err.code,\n    nested?.message,\n    nested?.code,\n    body?.message,\n    body?.code,\n  ].filter((v) => v != null && String(v).trim() !== '').map((v) => String(v));\n  const raw = chunks.join(' ').toLowerCase();\n  if (!raw) return null;\n\n  // INTERNAL_ERROR genérico de produção NÃO é 044 (Codex P2 #4378431315).\n  if (publicCode === 'INTERNAL_ERROR' && !raw.includes('idempotency_key') && !raw.includes('payload_fingerprint')) {\n    return null;\n  }\n\n  const mentionsIdempotency = raw.includes('idempotency_key') || raw.includes('payload_fingerprint');\n  const missingColumn = (\n    (raw.includes('column') && (raw.includes('does not exist') || raw.includes('undefined_column')))\n    || raw.includes('42703')\n  );\n  if (mentionsIdempotency || (missingColumn && (raw.includes('pedido') || mentionsIdempotency))) {\n    return 'Persistência de Pedido indisponível neste destino: faltam colunas de idempotência (migration 044). '\n      + 'Não declare vendas prontas. Coordene aplicação autorizada com Codex; o rascunho não foi confirmado como salvo.';\n  }\n  return null;\n}\n", '', 1],
  ],
};
export function componentContractRemainder(file, text) {
  const hunks = componentContractHunks[file];
  if (!hunks) return text;
  let source = text.replace(/\r\n/g, '\n');
  for (const [current, previous, count] of hunks) {
    assert.equal(source.split(current).length - 1, count, `${file}: exact component contract hunk`);
    source = source.split(current).join(previous);
  }
  if (file === 'src/components/layout/ModuleHeader.jsx') {
    assert.ok(source.endsWith('    </div>\n  );\n}\n'), 'one final LF at ModuleHeader end');
    source = source.slice(0, -1);
  }
  return source;
}
