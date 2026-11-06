/**
 * Pacote B — ChatbotIntent + JobAgendado: chrome sky windowMode + ID técnico.
 * Reutiliza padrão Filial/WhatsApp; não cria formulário paralelo.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const FORMS = [
  {
    file: 'ChatbotIntentForm.jsx',
    idNeedle: /ID técnico:[\s\S]*chatbotIntent\.id/,
  },
  {
    file: 'JobAgendadoForm.jsx',
    idNeedle: /ID técnico:[\s\S]*jobBoundId/,
  },
];

for (const { file, idNeedle } of FORMS) {
  test(`${file}: windowMode usa gradient sky + ID técnico na edição`, async () => {
    const src = await readFile(new URL(`../src/components/cadastros/${file}`, import.meta.url), 'utf8');
    assert.match(src, /if\s*\(\s*windowMode\s*\)/);
    assert.match(src, /from-sky-50\s+to-sky-100/);
    assert.match(src, /bg-sky-600/);
    assert.match(src, idNeedle);
    assert.match(src, /data-permission/);
    assert.doesNotMatch(src, /from-amber-50|text-amber-600/);
  });
}
