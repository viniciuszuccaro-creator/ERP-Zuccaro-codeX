/**
 * Pacote C: auditoria residual cadastros — count+1, pins sem sky, embeds.
 * Não altera pins; não inventa registros.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'src/components/cadastros';

test('nenhum Form.jsx usa count+1 para código (Bloco2 tiles permitido)', () => {
  const forms = fs.readdirSync(ROOT).filter((f) => f.endsWith('Form.jsx'));
  for (const f of forms) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.doesNotMatch(src, /count\s*\+\s*1/, f);
  }
  const bloco2 = fs.readFileSync(path.join(ROOT, 'blocks/Bloco2Produtos.jsx'), 'utf8');
  assert.match(bloco2, /total_itens_bloco:\s*tiles\.length\s*\+\s*1/);
});

test('pins ID-only / date-arith permanecem sem sky estrutural to-sky-100', () => {
  for (const f of [
    'CadastroFiscalForm.jsx',
    'CentroOperacaoForm.jsx',
    'ConfiguracaoBoletosForm.jsx',
    'EmpresaForm.jsx',
    'GrupoEmpresarialForm.jsx',
    'UsuarioForm.jsx',
  ]) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.doesNotMatch(src, /from-sky-50 to-sky-100/, f);
  }
});

test('embeds Gerenciar* preservam RBAC fail-closed e não fabricam código', () => {
  for (const f of ['GerenciarContatosClienteForm.jsx', 'GerenciarEnderecosClienteForm.jsx']) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.match(src, /canEdit\("Cadastros", "Cliente"\)/);
    assert.match(src, /assertScopeCurrent/);
    assert.doesNotMatch(src, /count\s*\+\s*1/);
    assert.doesNotMatch(src, /CodigoField|reserve.*codigo/i);
  }
});

test('PerfilAcesso (#418) mantém sky+ID; ChatbotIntents propaga windowMode', () => {
  const perfil = fs.readFileSync(path.join(ROOT, 'PerfilAcessoForm.jsx'), 'utf8');
  assert.match(perfil, /from-sky-50 to-sky-100/);
  assert.match(perfil, /ID técnico/);
  const intents = fs.readFileSync(path.join(ROOT, 'ChatbotIntentsForm.jsx'), 'utf8');
  assert.match(intents, /windowMode=\{windowMode\}/);
});
