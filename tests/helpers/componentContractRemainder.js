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
  'src/components/comercial/pedidoUiPolicy.js': [[
    'subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },',
    'subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },', 1,
  ]],
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
