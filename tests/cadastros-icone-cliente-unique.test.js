import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import vm from 'node:vm';

async function loadIcon() {
  const source = await readFile(new URL('../src/components/cadastros/IconeAcessoCliente.jsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText;
  const opens = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
  };
  const modules = {
    react: { __esModule: true, default: react, ...react },
    '@/components/ui/button': { Button: 'Button' },
    '@/components/ui/badge': { Badge: 'Badge' },
    'lucide-react': { Users: 'Users', Eye: 'Eye' },
    './PainelDinamicoCliente': { __esModule: true, default: 'PainelDinamicoCliente' },
    '@/components/lib/useWindow': {
      useWindow: () => ({
        openWindow: (Comp, props, opts) => { opens.push({ Comp, props, opts }); },
      }),
    },
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (id) => modules[id] || { __esModule: true, default: id },
  });
  return { Icon: exports.default, opens };
}

test('IconeAcessoCliente: uniqueKey por cliente impede abertura duplicada; sem modal morto', async () => {
  const { Icon, opens } = await loadIcon();
  const cliente = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', nome: 'Cliente A' };

  for (const variant of ['default', 'inline', 'badge']) {
    opens.length = 0;
    const tree = Icon({ cliente, variant });
    const clickable = tree.type === 'button' || tree.type === 'Button' || tree.type === 'Badge'
      ? tree
      : null;
    assert.ok(clickable?.props?.onClick, `variant ${variant} precisa onClick`);
    assert.equal(clickable.props['data-action'], 'cadastros-icone-cliente-abrir');
    clickable.props.onClick();
    clickable.props.onClick();
    assert.equal(opens.length, 2);
    assert.equal(opens[0].opts.uniqueKey, 'painel-cliente-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    assert.equal(opens[1].opts.uniqueKey, opens[0].opts.uniqueKey);
    assert.equal(opens[0].props.windowMode, true);
    assert.equal(opens[0].Comp, 'PainelDinamicoCliente');
  }

  const src = await readFile(new URL('../src/components/cadastros/IconeAcessoCliente.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /painelAberto/);
  assert.doesNotMatch(src, /isOpen=\{painelAberto\}/);
});

test('IconeAcessoCliente: sem cliente não renderiza', async () => {
  const { Icon } = await loadIcon();
  assert.equal(Icon({ cliente: null }), null);
});
