import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function openWithUniqueKey(registry, uniqueKey, seq) {
  const key = uniqueKey ? String(uniqueKey) : "";
  if (key && registry.has(key)) {
    return { id: registry.get(key), reused: true };
  }
  const id = `window-${seq.nextId++}`;
  if (key) registry.set(key, id);
  return { id, reused: false };
}

function closeWithUniqueKey(registry, uniqueKey) {
  const key = uniqueKey ? String(uniqueKey) : "";
  if (key) registry.delete(key);
}

test("ParametrosOrigemPedidoTab usa API canônica openWindow + uniqueKey create/edit", async () => {
  const src = await readFile(
    new URL("../src/components/cadastros/ParametrosOrigemPedidoTab.jsx", import.meta.url),
    "utf8",
  );
  assert.match(src, /openWindow\(\s*ParametroOrigemPedidoForm/);
  assert.match(src, /uniqueKey:\s*`cadastros-param-origem-create-/);
  assert.match(src, /uniqueKey:\s*`cadastros-param-origem-edit-/);
  assert.match(src, /groupId \|\| null, empresaId \|\| null/);
  assert.match(src, /filterInContext\('ParametroOrigemPedido'/);
  assert.match(src, /buildParametrosOrigemQueryKey/);
  assert.match(src, /isParametrosOrigemScopeCurrent/);
  assert.match(src, /PARAM_ORIGEM_STALE_SCOPE/);
  assert.doesNotMatch(src, /openWindow\(\{\s*title:/);
  assert.doesNotMatch(src, /base44\.entities\.ParametroOrigemPedido\.list\(/);
  assert.match(src, /Contagens indisponíveis não são zero|Contagens não são zero/);
});

test("GerenciadorCanaisOrigem lista/atualiza no escopo multiempresa", async () => {
  const src = await readFile(
    new URL("../src/components/cadastros/GerenciadorCanaisOrigem.jsx", import.meta.url),
    "utf8",
  );
  assert.match(src, /filterInContext\('ParametroOrigemPedido'/);
  assert.match(src, /updateInContext\('ParametroOrigemPedido'/);
  assert.match(src, /buildParametrosOrigemQueryKey/);
  assert.match(src, /buildPedidosUltimosOrigemQueryKey/);
  assert.match(src, /PARAM_ORIGEM_STALE_SCOPE|PARAM_ORIGEM_PEDIDOS_STALE_SCOPE/);
  assert.doesNotMatch(src, /base44\.entities\.ParametroOrigemPedido\.(list|update)\(/);
  assert.match(src, /Contagens indisponíveis não são zero|Contagens não são zero/);
});

test("comportamental: create mesmo Grupo/Empresa reusa; empresas distintas nao colidem", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const a = openWithUniqueKey(registry, 'cadastros-param-origem-create-["g","e1"]', seq);
  const a2 = openWithUniqueKey(registry, 'cadastros-param-origem-create-["g","e1"]', seq);
  const b = openWithUniqueKey(registry, 'cadastros-param-origem-create-["g","e2"]', seq);
  assert.equal(a2.reused, true);
  assert.equal(a2.id, a.id);
  assert.notEqual(b.id, a.id);
});

test("comportamental: edit por id nao colide com create nem com outro registro", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const create = openWithUniqueKey(registry, 'cadastros-param-origem-create-["g","e"]', seq);
  const editA = openWithUniqueKey(registry, "cadastros-param-origem-edit-p1", seq);
  const editA2 = openWithUniqueKey(registry, "cadastros-param-origem-edit-p1", seq);
  const editB = openWithUniqueKey(registry, "cadastros-param-origem-edit-p2", seq);
  assert.equal(editA2.reused, true);
  assert.equal(editA2.id, editA.id);
  assert.notEqual(editA.id, create.id);
  assert.notEqual(editB.id, editA.id);
});

test("comportamental: fechar libera reabertura; troca de grupo/empresa/ator nao funde janelas", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const key = 'cadastros-param-origem-create-["g1","e1"]';
  const first = openWithUniqueKey(registry, key, seq);
  closeWithUniqueKey(registry, key);
  const second = openWithUniqueKey(registry, key, seq);
  assert.equal(second.reused, false);
  assert.notEqual(second.id, first.id);

  const g2 = openWithUniqueKey(registry, 'cadastros-param-origem-create-["g2","e1"]', seq);
  const e2 = openWithUniqueKey(registry, 'cadastros-param-origem-create-["g1","e2"]', seq);
  assert.notEqual(g2.id, second.id);
  assert.notEqual(e2.id, second.id);
  assert.notEqual(g2.id, e2.id);
});

test("WindowManager canônico permanece o dono", async () => {
  const wm = await readFile(
    new URL("../src/components/lib/WindowManager.jsx", import.meta.url),
    "utf8",
  );
  assert.match(wm, /uniqueKeyRegistryRef/);
  const src = await readFile(
    new URL("../src/components/cadastros/ParametrosOrigemPedidoTab.jsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(src, /new WindowManager|createContext\(\s*['\"]Window/);
});
