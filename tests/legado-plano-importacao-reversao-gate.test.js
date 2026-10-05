import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const planPath = path.join(root, 'docs/LEGADO_PLANO_IMPORTACAO_REVERSAO_GATE.md');

test('plano de importacao/reversao existe e declara gate fail-closed', () => {
  const text = fs.readFileSync(planPath, 'utf8');
  assert.match(text, /importAuthorized[\s\S]*?\*\*false\*\*/i);
  assert.match(text, /operationalLoadAuthorized[\s\S]*?\*\*false\*\*/i);
  assert.match(text, /Promoção staging → operacional[\s\S]*?\*\*proibida\*\*/i);
  assert.match(text, /somente leitura/i);
  assert.match(text, /Aguardar gate humano/i);
  assert.doesNotMatch(text, /operationalLoadAuthorized\s*=\s*true/i);
  assert.doesNotMatch(text, /importAuthorized\s*=\s*true/i);
});

test('plano cobre pre-requisitos, ordem, reconciliacao, rollback e aceite', () => {
  const text = fs.readFileSync(planPath, 'utf8');
  for (const heading of [
    '## 1. Pré-requisitos',
    '## 2. Ordem de execução',
    '## 3. Reconciliação',
    '## 4. Critérios de aceite',
    '## 5. Plano de reversão',
  ]) {
    assert.ok(text.includes(heading), `faltando secao: ${heading}`);
  }
  assert.match(text, /centavos/i);
  assert.match(text, /CPA Ferro e Aço/);
  assert.match(text, /3Z LTDA/);
  assert.match(text, /Grupo CPA/);
  assert.match(text, /EMP03/);
  assert.match(text, /carregar-staging-isolado-legado\.mjs/);
  assert.match(text, /resolver-vinculo-juridico-legado\.mjs/);
  assert.match(text, /validar-origem-relatorios-privados\.mjs/);
});

test('plano nao contem PII tipica nem autoriza mapper Cursor', () => {
  const text = fs.readFileSync(planPath, 'utf8');
  assert.match(text, /Mapper Cursor #48[\s\S]{0,20}não alterar/i);
  assert.doesNotMatch(text, /@cpa|password|Bearer |DELL-VINI|\d{14}/i);
});

test('flags do loader de staging permanecem negadas no codigo', () => {
  const loader = fs.readFileSync(
    path.join(root, 'scripts/legado/carregar-staging-isolado-legado.mjs'),
    'utf8',
  );
  assert.match(loader, /importAuthorized:\s*false/);
  assert.match(loader, /operationalLoadAuthorized:\s*false/);
  assert.doesNotMatch(loader, /operationalLoadAuthorized:\s*true/);
});
