import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../src/components/lib/useFluxoPedido.jsx', import.meta.url), 'utf8');
const guardStart = source.indexOf('function assertEscritaEstoqueLocalPermitida()');
const guardSource = source.slice(guardStart, source.indexOf('// Auditoria helpers', guardStart));
assert.notEqual(guardStart, -1);

for (const name of ['aprovarPedidoCompleto', 'faturarPedidoCompleto', 'concluirOPCompleto', 'cancelarPedidoCompleto']) {
  test(`${name} bloqueia chamada direta HTTP antes de estoque, financeiro, entrega e status`, async () => {
    const start = source.indexOf(`export async function ${name}(`);
    assert.notEqual(start, -1);
    const end = source.indexOf('\n/**', start + 1);
    assert.notEqual(end, -1);
    const fnSource = source.slice(start, end).replace(/\bexport async function /g, 'async function ');
    const effects = [];
    const guard = runInNewContext(`${guardSource}; assertEscritaEstoqueLocalPermitida`, {
      isHttpExpedicaoEnabled: () => true,
      HTTP_ESTOQUE_LOCAL_BLOQUEADO: 'HTTP_ESTOQUE_LOCAL_BLOQUEADO',
    });
    const fn = runInNewContext(`${fnSource}\n${name}`, {
      assertEscritaEstoqueLocalPermitida: guard,
      normalizarContextoOperacao: () => { effects.push('contexto'); return {}; },
      filterScoped: async () => { effects.push('read'); return []; },
      createScoped: async () => { effects.push('write'); return {}; },
      updateScoped: async () => { effects.push('update'); return {}; },
      auditar: async () => { effects.push('audit'); },
    });
    for (let attempt = 0; attempt < 2; attempt++) {
      await assert.rejects(fn({ id: 'synthetic' }, 'empresa-sintetica'), /HTTP_ESTOQUE_LOCAL_BLOQUEADO/);
    }
    assert.deepEqual(effects, []);
  });
}
