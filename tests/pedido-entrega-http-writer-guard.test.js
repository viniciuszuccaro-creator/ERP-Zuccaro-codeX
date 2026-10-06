import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { isHttpExpedicaoEnabled } from '../src/api/runtimeBackend.js';

test('modo HTTP de Expedição só ativa com backend HTTP e flag explícita', () => {
  assert.equal(isHttpExpedicaoEnabled({ VITE_ERP_BACKEND: 'http', VITE_ERP_HTTP_EXPEDICAO: 'true' }), true);
  assert.equal(isHttpExpedicaoEnabled({ VITE_ERP_BACKEND: 'local', VITE_ERP_HTTP_EXPEDICAO: 'true' }), false);
  assert.equal(isHttpExpedicaoEnabled({ VITE_ERP_BACKEND: 'http' }), false);
});

test('tela de Pedido não oferece writer local no modo HTTP e revalida antes da baixa', async () => {
  const source = await readFile(new URL('../src/components/comercial/PedidosEntregaTab.jsx', import.meta.url), 'utf8');
  assert.match(source, /status === 'Em Trânsito' && !modoHttpExpedicao/);
  assert.match(source, /onClick=\{async \(\) => \{\s*if \(isHttpExpedicaoEnabled\(\)\) \{/);
  assert.match(source, /modoHttpExpedicao \? \([\s\S]*role="alert"/);
});

test('retirada não oferece writer local no modo HTTP e bloqueia mutation antes do primeiro efeito', async () => {
  const source = await readFile(new URL('../src/components/comercial/PedidosRetiradaTab.jsx', import.meta.url), 'utf8');
  assert.match(source, /mutationFn: async \(\{ pedido \}\) => \{\s*if \(isHttpExpedicaoEnabled\(\)\) \{/);
  assert.match(source, /const handleConfirmarRetirada = \(\) => \{\s*if \(isHttpExpedicaoEnabled\(\)\) \{/);
  assert.match(source, /modoHttpExpedicao \? \([\s\S]*role="alert"/);
});

test('automação não executa fechamento local automático nem manual com ledger HTTP', async () => {
  const source = await readFile(new URL('../src/components/comercial/AutomacaoFluxoPedido.jsx', import.meta.url), 'utf8');
  assert.match(source, /autoExecute && !executando && progresso === 0 && permitido && !modoHttpExpedicao/);
  assert.match(source, /const executarFluxoCompleto = async \(\) => \{\s*if \(isHttpExpedicaoEnabled\(\)\) \{/);
  assert.match(source, /disabled=\{executando \|\| progresso === 100 \|\| !permitido \|\| modoHttpExpedicao\}/);
});
