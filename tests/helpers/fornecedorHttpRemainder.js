import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { setorRbacRemainder } from './setorRbacRemainder.js';

const entries = {
  'server/tests/infra-consolidacao.test.ts': {
    hash: '7315aa4db98657cac6d70ee2685a9dee492fa34711af4839dcc5f07b36069211',
    hunks: [
      ["  assert.equal(files.length, 34);\n", "  assert.equal(files.length, 33);\n"],
      ["  assert.deepEqual(files.slice(-10), [\n    '036_expedicao_entregas_romaneios.sql', '037_expedicao_estoque_movimentos.sql',\n    '038_cadastros_codigo_registro.sql', '039_orcamentos_tabela_preco.sql',\n    '040_crm_oportunidades.sql', '041_produto_empresas_operacao.sql',\n    '042_auth_bootstrap_select.sql', '043_legado_identidade_compartilhada.sql',\n    '044_pedidos_idempotencia_direta.sql', '045_clientes_contatos_jsonb.sql',\n  ]);\n  assert.equal(files.some(file => /^(046|047|048|049)_/.test(file)), false);\n", "  assert.deepEqual(files.slice(-9), [\n    '036_expedicao_entregas_romaneios.sql', '037_expedicao_estoque_movimentos.sql',\n    '038_cadastros_codigo_registro.sql', '039_orcamentos_tabela_preco.sql',\n    '040_crm_oportunidades.sql', '041_produto_empresas_operacao.sql',\n    '042_auth_bootstrap_select.sql', '043_legado_identidade_compartilhada.sql',\n    '044_pedidos_idempotencia_direta.sql',\n  ]);\n  assert.equal(files.some(file => /^(045|046|047|048|049)_/.test(file)), false);\n"],
    ],
  },
  'tests/legado-importador-consolidacao.test.js': {
    hash: 'eeada2ef1745f67b8d5629b8d2088bf3fe66a7c04b521ef797a9385c77862cbb',
    hunks: [[
      "  assert.equal(clienteConferenciaRemainder('server/src/app.ts',fs.readFileSync('server/src/app.ts','utf8')).replaceAll('\\r\\n','\\n'),readHead('server/src/app.ts'));\n  // Baseline pós-045 contatos[] jsonb (#591 decisão a). Tip migrations bump; publication base e36231b3a7e546aa9fd2529abb8d5edb61d8189c permanece (2ª ref do canal).\n  assert.equal(execFileSync('git',['diff',\"cc7c71f5e913b8f0c19d90927bb94f51ba15de89\",'--','server/migrations'],{encoding:'utf8'}),'');\n",
      "  assert.equal(execFileSync('git',['diff',\"e36231b3a7e546aa9fd2529abb8d5edb61d8189c\",'--','server/migrations','server/src/app.ts'],{encoding:'utf8'}),'');\n",
    ]],
  },
  'server/src/app.ts': {
    hash: '759a408077509a7b543a533db319dc92d43b7092b1a63a1f15f8d418d26ddf50',
    hunks: [
      ["import { FornecedorService } from './services/fornecedorService.js';\nimport { PostgresFornecedorRepository } from './repositories/postgresFornecedorRepository.js';\n", ''],
      ['  const fornecedorService = config.fornecedorHttpEnabled === true && !useMemory\n    ? new FornecedorService(new PostgresFornecedorRepository(db), auditRepo, rbacGuard) : null;\n', ''],
      ['  app.use(createApiRouter({\n    fornecedorService,\n', '  app.use(createApiRouter({\n'],
    ],
  },
  'server/src/api/router.ts': {
    // Pre-supplier baseline on composition tip #401 `5d9a7e37c` (≠ codex 50b60e46).
    hash: '91097f69b764cb24934e69396b2201d802e7b53d9c6ecaf8ce032945cf626bd4',
    hunks: [
      ["import { mountFornecedorRoutes } from './fornecedorRoutes.js';\nimport type { FornecedorService } from '../services/fornecedorService.js';\n", ''],
      ['  fornecedorService?: FornecedorService | null;\n', ''],
      ['  mountFornecedorRoutes(router, deps.fornecedorService, ctxFromReq);\n', ''],
    ],
  },
};

/** Remove only this opt-in wiring; verify every byte of the previous source. */
export function fornecedorHttpRemainder(file, text) {
  text = setorRbacRemainder(file, text);
  const entry = entries[file];
  if (!entry) return text;
  let source = text.replace(/\r\n/g, '\n');
  if (!entry.hunks.some(([after]) => source.includes(after))
    && !/fornecedorService|FornecedorService|mountFornecedorRoutes/.test(source)
    && !source.includes("clienteConferenciaRemainder('server/src/app.ts'")) return text;
  for (const [after, before] of entry.hunks) {
    assert.equal(source.split(after).length, 2, `${file}: exact supplier wiring count`);
    source = source.replace(after, () => before);
  }
  assert.equal(createHash('sha256').update(source).digest('hex'), entry.hash, `${file}: entire pre-supplier source`);
  return text.includes('\r\n') ? source.replace(/\n/g, '\r\n') : source;
}
