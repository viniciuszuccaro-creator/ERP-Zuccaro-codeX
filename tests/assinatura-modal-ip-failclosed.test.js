import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("AssinaturaEletronicaModal: não fabrica IP 192.168.1.x aleatório", async () => {
  const source = await readFile(
    new URL("../src/components/AssinaturaEletronicaModal.jsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /192\.168\.1\.\s*"\s*\+/);
  assert.doesNotMatch(source, /"192\.168\.1\." \+/);
  assert.doesNotMatch(source, /Math\.floor\(Math\.random\(\) \* 255\)/);
  assert.match(source, /ip_address = null/);
  assert.match(source, /DESCONHECIDO/);
  assert.match(source, /assinatura-modal-ip-desconhecido/);
  assert.match(source, /data-action="assinatura-modal-ip"/);
});
