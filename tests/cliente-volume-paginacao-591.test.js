/**
 * #591 — listagem Cliente >100: paginação server-side estável (massa sintética).
 * Sem PII / sem dados reais no GitHub.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

/** Simula entityListSorted: total conhecido + página por skip/limit. */
export function paginateSyntheticClientes({ total, page, pageSize, sortField = 'codigo', sortDir = 'asc' }) {
  const safeSize = Math.min(Math.max(pageSize || 20, 1), 200);
  const safePage = Math.max(page || 1, 1);
  const skip = (safePage - 1) * safeSize;
  const rows = [];
  for (let i = 0; i < total; i += 1) {
    const n = sortDir === 'desc' ? total - i : i + 1;
    rows.push({
      id: `synthetic-cli-${String(n).padStart(4, '0')}`,
      codigo: String(n).padStart(6, '0'),
      nome: `SYNTHETIC CLIENTE ${n}`,
      documento: null,
    });
  }
  if (sortField === 'nome') {
    rows.sort((a, b) => (sortDir === 'desc'
      ? String(b.nome).localeCompare(String(a.nome))
      : String(a.nome).localeCompare(String(b.nome))));
  } else {
    rows.sort((a, b) => (sortDir === 'desc'
      ? String(b.codigo).localeCompare(String(a.codigo))
      : String(a.codigo).localeCompare(String(b.codigo))));
  }
  const pageRows = rows.slice(skip, skip + safeSize);
  return {
    data: pageRows,
    meta: {
      total,
      limit: safeSize,
      skip,
      page: safePage,
      hasMore: skip + pageRows.length < total,
    },
  };
}

test('massa sintética 150: páginas 100 + resto; total coerente; sem omitir IDs', () => {
  const total = 150;
  const p1 = paginateSyntheticClientes({ total, page: 1, pageSize: 100 });
  const p2 = paginateSyntheticClientes({ total, page: 2, pageSize: 100 });
  assert.equal(p1.data.length, 100);
  assert.equal(p2.data.length, 50);
  assert.equal(p1.meta.total, 150);
  assert.equal(p2.meta.total, 150);
  assert.equal(p1.meta.hasMore, true);
  assert.equal(p2.meta.hasMore, false);
  const ids = new Set([...p1.data, ...p2.data].map((r) => r.id));
  assert.equal(ids.size, 150);
  assert.equal(p1.data[0].codigo, '000001');
  assert.equal(p2.data[0].codigo, '000101');
});

test('busca por código/documento: abertura direta não depende da 1ª página', () => {
  const total = 120;
  const all = paginateSyntheticClientes({ total, page: 1, pageSize: 200 });
  const target = all.data.find((r) => r.codigo === '000117');
  assert.ok(target);
  // Simula filtro server-side por código (não slice local da página 1).
  const filtered = all.data.filter((r) => r.codigo === '000117' || r.id === target.id);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 'synthetic-cli-0117');
});

test('ordenação estável: mesma chave + direção reproduz a mesma sequência', () => {
  const a = paginateSyntheticClientes({ total: 110, page: 2, pageSize: 50, sortField: 'codigo', sortDir: 'asc' });
  const b = paginateSyntheticClientes({ total: 110, page: 2, pageSize: 50, sortField: 'codigo', sortDir: 'asc' });
  assert.deepEqual(a.data.map((r) => r.id), b.data.map((r) => r.id));
  const desc = paginateSyntheticClientes({ total: 110, page: 1, pageSize: 5, sortDir: 'desc' });
  assert.equal(desc.data[0].codigo, '000110');
});

test('V24: limit/skip server-side + PAGE_SIZES sem teto oculto <100', () => {
  const src = read('src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx');
  assert.match(src, /limit:\s*pageSize/);
  assert.match(src, /skip:\s*skip/);
  assert.match(src, /entityListSorted/);
  assert.match(src, /const PAGE_SIZES = \[10, 20, 50, 100\]/);
  assert.match(src, /\["viz-v33", ENTITY,.*empresaId, groupId\]/);
  assert.match(src, /totalCount/);
  // Exportação cross-page pagina em lotes — não carrega tudo de uma vez silenciosamente omitindo.
  assert.match(src, /limit:\s*500,\s*skip:\s*skipAcc/);
});
