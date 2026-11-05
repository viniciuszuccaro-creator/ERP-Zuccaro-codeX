import assert from 'node:assert/strict';

/**
 * #552 — uniqueKey WindowManager em PedidosTab (aprovações + automação).
 * Remainder inverte exatamente estes hunks antes do pin e36231b3 / hash audit.
 * Comportamento novo coberto por tests/comercial-pedidos-tab-uniquekey.test.js.
 */
const FILE = 'src/components/comercial/PedidosTab.jsx';

const hunks = [
  [
    `    openWindow(
      CentralAprovacoesManager,
      { windowMode: true, initialTab: 'descontos' },
      {
        title: 'Central de Aprovações',
        width: 1200,
        height: 700,
        // Clique repetido / mesmo escopo → reusa a mesma janela (WindowManager).
        uniqueKey: \`comercial-pedidos-aprovacoes-\${JSON.stringify([groupId || null, empresaContextoId || null])}\`,
      },
    );`,
    `    openWindow(CentralAprovacoesManager, { windowMode: true, initialTab: 'descontos' }, { title: 'Central de Aprovações', width: 1200, height: 700 });`,
  ],
  [
    `      {
        title: \`Automacao - Pedido \${pedido.numero_pedido}\`,
        width: 1200,
        height: 700,
        // Pedidos distintos → janelas distintas; mesmo pedido → reusa (não une contextos).
        uniqueKey: \`comercial-pedidos-automacao-\${String(pedido?.id || pedido?.numero_pedido || '')}\`,
      }`,
    `      { title: \`Automacao - Pedido \${pedido.numero_pedido}\`, width: 1200, height: 700 }`,
  ],
];

export function pedidosTabUniqueKeyRemainder(file, text) {
  if (file !== FILE) return text;
  let source = String(text).replace(/\r\n/g, '\n');
  for (const [after, before] of hunks) {
    assert.equal(source.split(after).length, 2, `${FILE}: exact #552 uniqueKey hunk`);
    source = source.replace(after, before);
  }
  return text.includes('\r\n') ? source.replace(/\n/g, '\r\n') : source;
}
