/**
 * Lacuna integra: Empresa + PerfilAcesso sky windowMode + ID técnico.
 * Empilha sobre #459 (CentroResultado). Não toca pin ID-only
 * (CadastroFiscal/CentroOperacao/GrupoEmpresarial/Usuario/Boletos/Webhook).
 * Sem count+1; sem rollback visual amplo.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

test('Empresa: sky windowMode + ID técnico (sem count+1)', () => {
  const source = fs.readFileSync('src/components/cadastros/EmpresaForm.jsx', 'utf8');
  assert.match(source, /from-sky-50/);
  assert.match(source, /to-sky-100/);
  assert.match(source, /ID técnico/);
  assert.match(source, /useCadastroRecordState/);
  assert.match(source, /text-sky-600/);
  assert.doesNotMatch(source, /count\s*\+\s*1/);
  assert.doesNotMatch(source, /from-purple-50/);
  // Header windowMode deixa de usar azul genérico no ícone.
  assert.doesNotMatch(source, /windowMode[\s\S]*text-blue-600/);
});

test('PerfilAcesso: sky windowMode + ID técnico (sem count+1)', () => {
  const source = fs.readFileSync('src/components/cadastros/PerfilAcessoForm.jsx', 'utf8');
  assert.match(source, /from-sky-50/);
  assert.match(source, /to-sky-100/);
  assert.match(source, /ID técnico/);
  assert.match(source, /useCadastroRecordState/);
  assert.match(source, /text-sky-600/);
  assert.doesNotMatch(source, /count\s*\+\s*1/);
  assert.doesNotMatch(source, /from-purple-50/);
  assert.doesNotMatch(source, /windowMode[\s\S]*text-blue-600/);
});

test('pin ID-only intacto neste lote (Usuario/GrupoEmpresarial)', () => {
  for (const file of [
    'src/components/cadastros/UsuarioForm.jsx',
    'src/components/cadastros/GrupoEmpresarialForm.jsx',
  ]) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /from-sky-50 to-sky-100/);
    assert.match(source, /CadastroCodigoRegistroField/);
    assert.match(source, /idOnly/);
  }
});
