import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { setorRbacRemainder } from './setorRbacRemainder.js';

const entries = {
  'tests/legado-importador-consolidacao.test.js': {
    hash: 'eeada2ef1745f67b8d5629b8d2088bf3fe66a7c04b521ef797a9385c77862cbb',
    hunks: [[
      "  assert.equal(clienteConferenciaRemainder('server/src/app.ts',fs.readFileSync('server/src/app.ts','utf8')).replaceAll('\\r\\n','\\n'),readHead('server/src/app.ts'));\n  assert.equal(execFileSync('git',['diff',\"e36231b3a7e546aa9fd2529abb8d5edb61d8189c\",'--','server/migrations'],{encoding:'utf8'}),'');\n",
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
    hash: '5def3d35858d988e050b36b3edca22d7b8d4feebc5d9f788e72aefbf6f1bdff7',
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
