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

test("RepresentantesTab usa API canônica openWindow + uniqueKey create/edit", async () => {
  const src = await readFile(
    new URL("../src/components/cadastros/RepresentantesTab.jsx", import.meta.url),
    "utf8",
  );
  assert.match(src, /openWindow\(\s*RepresentanteFormCompleto/);
  assert.match(src, /uniqueKey:\s*`cadastros-representante-create-/);
  assert.match(src, /uniqueKey:\s*`cadastros-representante-edit-/);
  assert.match(src, /groupId \|\| null, empresaId \|\| null/);
  assert.match(src, /filterInContext\('Representante'/);
  assert.match(src, /queryKey:\s*\['representantes',\s*contextKey\]/);
  assert.doesNotMatch(src, /openWindow\(\{\s*id:/);
  assert.doesNotMatch(src, /openWindow\(\{\s*title:/);
  assert.doesNotMatch(src, /base44\.entities\.Representante\.list\(/);
  assert.doesNotMatch(src, /component:\s*['\"]RepresentanteFormCompleto['\"]/);
  assert.match(src, /Contagens indisponíveis não são zero|Contagens não são zero/);
});

test("Editar e Detalhe do mesmo registro compartilham uniqueKey de edit", async () => {
  const src = await readFile(
    new URL("../src/components/cadastros/RepresentantesTab.jsx", import.meta.url),
    "utf8",
  );
  // Um único padrão de edit-key; dashboard reusa openEdit (mesmo registro)
  const editKeys = src.match(/cadastros-representante-edit-/g) || [];
  assert.ok(editKeys.length >= 1);
  assert.match(src, /openEdit\(rep,\s*\{\s*dashboard:\s*true\s*\}\)/);
});

test("comportamental: create mesmo Grupo/Empresa reusa; empresas distintas nao colidem", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const a = openWithUniqueKey(registry, 'cadastros-representante-create-["g","e1"]', seq);
  const a2 = openWithUniqueKey(registry, 'cadastros-representante-create-["g","e1"]', seq);
  const b = openWithUniqueKey(registry, 'cadastros-representante-create-["g","e2"]', seq);
  assert.equal(a2.reused, true);
  assert.equal(a2.id, a.id);
  assert.notEqual(b.id, a.id);
});

test("comportamental: edit por id nao colide com create nem com outro registro", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const create = openWithUniqueKey(registry, 'cadastros-representante-create-["g","e"]', seq);
  const editA = openWithUniqueKey(registry, "cadastros-representante-edit-r1", seq);
  const editA2 = openWithUniqueKey(registry, "cadastros-representante-edit-r1", seq);
  const editB = openWithUniqueKey(registry, "cadastros-representante-edit-r2", seq);
  assert.equal(editA2.reused, true);
  assert.equal(editA2.id, editA.id);
  assert.notEqual(editA.id, create.id);
  assert.notEqual(editB.id, editA.id);
});

test("comportamental: fechar libera reabertura; contextos distintos nao fundem", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const key = 'cadastros-representante-create-["g1","e1"]';
  const first = openWithUniqueKey(registry, key, seq);
  closeWithUniqueKey(registry, key);
  const second = openWithUniqueKey(registry, key, seq);
  assert.equal(second.reused, false);
  assert.notEqual(second.id, first.id);

  const otherGroup = openWithUniqueKey(registry, 'cadastros-representante-create-["g2","e1"]', seq);
  const otherEmpresa = openWithUniqueKey(registry, 'cadastros-representante-create-["g1","e2"]', seq);
  assert.notEqual(otherGroup.id, second.id);
  assert.notEqual(otherEmpresa.id, second.id);
});

test("WindowManager canônico permanece o dono", async () => {
  const wm = await readFile(
    new URL("../src/components/lib/WindowManager.jsx", import.meta.url),
    "utf8",
  );
  assert.match(wm, /uniqueKeyRegistryRef/);
  const src = await readFile(
    new URL("../src/components/cadastros/RepresentantesTab.jsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(src, /new WindowManager|createContext\(\s*['\"]Window/);
});
