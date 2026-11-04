import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("AssinaturaEletronicaForm: não fabrica IP 192.168.1.x aleatório", async () => {
  const source = await readFile(
    new URL("../src/components/AssinaturaEletronicaForm.jsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /192\.168\.1\./);
  assert.doesNotMatch(source, /Math\.floor\(Math\.random\(\)/);
  assert.match(source, /ip_address = null/);
  assert.match(source, /DESCONHECIDO/);
  assert.match(source, /data-action="assinatura-ip-desconhecido"/);
});
