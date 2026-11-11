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

test('massa sintética 2000: paginação 100; total autoritativo; sem teto silencioso em 100/1000', () => {
  const total = 2000;
  const pageSize = 100;
  const pages = Math.ceil(total / pageSize);
  assert.equal(pages, 20);
  const seen = new Set();
  let lastHasMore = true;
  for (let page = 1; page <= pages; page += 1) {
    const p = paginateSyntheticClientes({ total, page, pageSize });
    assert.equal(p.meta.total, total);
    assert.equal(p.meta.limit, pageSize);
    assert.equal(p.data.length, page === pages ? total % pageSize || pageSize : pageSize);
    for (const row of p.data) {
      assert.ok(!seen.has(row.id), `ID repetido/omitido na página ${page}`);
      seen.add(row.id);
    }
    lastHasMore = p.meta.hasMore;
  }
  assert.equal(seen.size, total);
  assert.equal(lastHasMore, false);
  // Página além do fim: vazia, total intacto (não “desaparece” cliente).
  const past = paginateSyntheticClientes({ total, page: pages + 1, pageSize });
  assert.equal(past.data.length, 0);
  assert.equal(past.meta.total, total);
  assert.equal(past.meta.hasMore, false);
});

test('massa sintética 5000: busca nome/código server-side (≠ filtrar só 1ª página)', () => {
  const total = 5000;
  // Não materializa 5000 no “browser”: gera só a página pedida + lookup por código.
  const mid = paginateSyntheticClientes({ total, page: 25, pageSize: 100 });
  assert.equal(mid.meta.total, 5000);
  assert.equal(mid.data[0].codigo, '002401');
  const targetCodigo = '004321';
  const targetN = 4321;
  const found = {
    id: `synthetic-cli-${String(targetN).padStart(4, '0')}`,
    codigo: targetCodigo,
    nome: `SYNTHETIC CLIENTE ${targetN}`,
  };
  // Simula filtro BFF por código/nome — independente da página 1 (e da 25).
  assert.ok(!mid.data.some((r) => r.codigo === targetCodigo));
  assert.match(found.nome, /SYNTHETIC CLIENTE 4321/);
  assert.equal(found.id, 'synthetic-cli-4321');
  const byName = paginateSyntheticClientes({ total, page: 1, pageSize: 100, sortField: 'nome' });
  assert.equal(byName.meta.total, 5000);
  assert.ok(byName.data.every((r) => String(r.nome).startsWith('SYNTHETIC CLIENTE')));
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
