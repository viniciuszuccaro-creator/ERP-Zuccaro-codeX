/**
 * Pacote C — probes comportamentais: contagem/contexto/Contatos órfão.
 * Sem seed; não altera pins publication; não apaga órfão.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('src');

test('useCadastrosAllCounts: filtro via buildContextFilter; erro≠vazio', () => {
  const src = fs.readFileSync(
    path.join(ROOT, 'components/cadastros/hooks/useCadastrosAllCounts.jsx'),
    'utf8',
  );
  assert.match(src, /buildContextFilter/);
  assert.match(src, /countsUnavailable/);
  assert.doesNotMatch(src, /if \(empresaId\) return \{ empresa_id: empresaId \}/);
  // queryKey inclui empresa+grupo (+ empresas do grupo) — troca de contexto invalida
  assert.match(src, /\["cadastros-all-counts-v5", empresaId, groupId/);
  assert.match(src, /invalidateQueries\(\{ queryKey: \["cadastros-all-counts-v5"\] \}\)/);
});

test('VisualizadorV24: scopeKey fecha form ao trocar grupo/empresa', () => {
  const src = fs.readFileSync(
    path.join(ROOT, 'components/cadastros/VisualizadorUniversalEntidadeV24.jsx'),
    'utf8',
  );
  assert.match(src, /scopeKey = ENTITY \+ ":" \+ \(groupId \|\| ""\) \+ ":" \+ \(empresaId \|\| ""\)/);
  assert.match(src, /previousScopeRef\.current === scopeKey/);
});

test('Contatos canônico tem RBAC; comercial órfão não é importado pelo Painel', () => {
  const form = fs.readFileSync(
    path.join(ROOT, 'components/cadastros/GerenciarContatosClienteForm.jsx'),
    'utf8',
  );
  assert.match(form, /canEdit\("Cadastros", "Cliente"\)/);
  assert.match(form, /assertScopeCurrent/);

  const orphan = fs.readFileSync(
    path.join(ROOT, 'components/comercial/GerenciarContatosCliente.jsx'),
    'utf8',
  );
  assert.match(orphan, /Pacote E \/ D — keep both|Pacote E — keep both/);
  assert.match(orphan, /GerenciarContatosClienteForm/);
  assert.match(orphan, /canEdit\("Cadastros", "Cliente"\)/);
  assert.match(orphan, /assertScopeCurrent/);

  const painel = fs.readFileSync(
    path.join(ROOT, 'components/cadastros/PainelDinamicoCliente.jsx'),
    'utf8',
  );
  assert.match(painel, /GerenciarContatosClienteForm/);
  assert.doesNotMatch(painel, /GerenciarContatosCliente[^F]/);
});

test('mestres sky com CodigoField já expõem ID técnico via entityId (falso gap)', () => {
  const sample = ['Marca', 'Cargo', 'Departamento', 'SetorAtividade', 'UnidadeMedida'];
  for (const name of sample) {
    const src = fs.readFileSync(
      path.join(ROOT, `components/cadastros/${name}Form.jsx`),
      'utf8',
    );
    assert.match(src, /from-sky-50/, name);
    assert.match(src, /entityId=\{/, name);
  }
  const field = fs.readFileSync(
    path.join(ROOT, 'components/cadastros/CadastroCodigoRegistroField.jsx'),
    'utf8',
  );
  assert.match(field, /ID técnico/);
});
