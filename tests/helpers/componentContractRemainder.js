import assert from 'node:assert/strict';

export const componentContractHunks = {
  'src/components/lib/usePermissions.jsx': [[
    'from "../../../base44/functions/_lib/security/entityGuardPolicy/entry";',
    'from "../../../base44/functions/_lib/security/entityGuardPolicy/entry.ts";', 1,
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
