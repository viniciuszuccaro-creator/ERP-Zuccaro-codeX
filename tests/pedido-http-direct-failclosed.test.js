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

test('fechamento automático HTTP em duas tentativas sinaliza erro uma vez por tentativa e nenhum efeito', async () => {
  const name = 'executarFechamentoCompleto';
  const start = source.indexOf(`export async function ${name}(`);
  const end = source.indexOf('\n/**', start + 1);
  assert.ok(start >= 0 && end > start);
  const fn = runInNewContext(`${source.slice(start, end).replace(/^export /, '')}\n${name}`, {
    isHttpExpedicaoEnabled: () => true,
    HTTP_ESTOQUE_LOCAL_BLOQUEADO: 'HTTP_ESTOQUE_LOCAL_BLOQUEADO',
    normalizarContextoOperacao: () => { throw new Error('UNEXPECTED_CONTEXT_READ'); },
    filterScoped: async () => { throw new Error('UNEXPECTED_DB_READ'); },
    createScoped: async () => { throw new Error('UNEXPECTED_DB_WRITE'); },
    updateScoped: async () => { throw new Error('UNEXPECTED_DB_WRITE'); },
  });
  const errors = [];
  const logs = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await fn({ id: 'synthetic' }, 'empresa-sintetica', {
      onError: (error) => errors.push(error.message),
      onLog: (message) => logs.push(message),
    });
    assert.equal(result.estoque.sucesso, false);
    assert.equal(result.financeiro.sucesso, false);
    assert.equal(result.logistica.sucesso, false);
    assert.equal(result.status.sucesso, false);
  }
  assert.deepEqual(errors, ['HTTP_ESTOQUE_LOCAL_BLOQUEADO', 'HTTP_ESTOQUE_LOCAL_BLOQUEADO']);
  assert.equal(logs.length, 2);
});

test('emissão fiscal local HTTP em duas tentativas não cria NF pendente nem altera pedido', async () => {
  const page = await readFile(new URL('../src/components/comercial/FechamentoFinanceiroTab.jsx', import.meta.url), 'utf8');
  const start = page.indexOf('onEmitir={async (dadosNFe) => {');
  const end = page.indexOf('\n        }}', start);
  assert.ok(start >= 0 && end > start);
  const handlerSource = page.slice(start + 'onEmitir={'.length, end) + '\n}';
  const effects = [];
  const emitir = runInNewContext(`(${handlerSource})`, {
    isHttpExpedicaoEnabled: () => true,
    filterInContext: async () => { effects.push('read'); return []; },
    createInContext: async () => { effects.push('create'); return {}; },
    updateInContext: async () => { effects.push('update'); return {}; },
    auditFechamento: async () => { effects.push('audit'); },
    setFormData: () => { effects.push('state'); },
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    await assert.rejects(emitir({ escopo: 'pedido_inteiro' }), /modo HTTP/);
  }
  assert.deepEqual(effects, []);
});
