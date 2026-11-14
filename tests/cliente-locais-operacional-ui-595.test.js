/**
 * Cursor pós-595 — mensagens operacional vs revisão; seletor exige id canônico.
 * Fixtures sintéticas; sem HML/dados reais.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const completo = readFileSync('src/components/cadastros/CadastroClienteCompleto.jsx', 'utf8');
const gerenciar = readFileSync('src/components/cadastros/GerenciarEnderecosClienteForm.jsx', 'utf8');
const revisao = readFileSync('src/components/cadastros/ClienteLocaisRevisao.jsx', 'utf8');
const seletor = readFileSync('src/components/comercial/SeletorEnderecoEntregaPedido.jsx', 'utf8');

test('mensagens: não usa "Nenhum endereço cadastrado" ambíguo no Gerenciar', () => {
  assert.equal(gerenciar.includes('Nenhum endereço cadastrado'), false);
  assert.match(gerenciar, /Nenhum endereço operacional disponível/);
  assert.match(gerenciar, /Falha ao carregar endereços operacionais/);
  assert.match(gerenciar, /Leitura de endereços negada/);
  assert.match(gerenciar, /contagem não confirmada/);
  assert.match(gerenciar, /Cliente\.editar NÃO autoriza locais/);
});

test('Completo: rascunho de revisão + loadStatus + cliente_local', () => {
  assert.match(completo, /openLocalDraftFromReview/);
  assert.match(completo, /locaisLoadStatus/);
  assert.match(completo, /loadStatus=\{Array\.isArray\(formData\.locais_entrega\) \? 'loaded' : locaisLoadStatus\}/);
  assert.match(completo, /onOpenDraft=\{openLocalDraftFromReview\}/);
  assert.match(completo, /hasPermission\('Cadastros', 'cliente_local', 'visualizar'\)/);
  // Bugbot: deps estáveis + reset do hint só no reviewClienteId (não em permissionsLoading).
  assert.match(completo, /const canViewLocais = hasPermission\('Cadastros', 'cliente_local', 'visualizar'\) === true/);
  assert.match(completo, /const reviewClienteId = clienteBoundId \|\| cliente\?\.id \|\| null/);
  assert.match(completo, /setRevisaoEntregaTotal\(null\);\n  \}, \[reviewClienteId\]/);
  assert.match(completo, /\[reviewClienteId, permissionsLoading, canViewLocais\]/);
  // Não sobrescreve fiscal manual: fill só se empty.
  assert.match(completo, /const empty = current === undefined \|\| current === null \|\| String\(current\)\.trim\(\) === ''/);
});

test('Revisão: abrir rascunho não é Salvar/Ativar; mensagens de negação distintas', () => {
  assert.match(revisao, /Abrir rascunho/);
  assert.match(revisao, /nao grava nem ativa/i);
  assert.match(revisao, /Leitura negada: falta Cadastros\.cliente_local\.visualizar/);
  assert.match(revisao, /onReviewMeta\(\{ finalidade, total: null, error: false \}\)/);
  assert.equal(/Salvar|Ativar|Excluir/.test(revisao.replace(/\/\*[\s\S]*?\*\//g, '')), false);
});

test('Seletor: HTTP ativo+ENTREGA+id canônico; mensagens sem zero falso', () => {
  assert.match(seletor, /listLocais/);
  assert.match(seletor, /isClienteLocalCanonicalId/);
  assert.match(seletor, /fins\.includes\("ENTREGA"\)/);
  assert.match(seletor, /cliente_local_id/);
  assert.match(seletor, /Falha ao carregar locais\. Contagem não confirmada/);
  assert.match(seletor, /contextTick/);
  assert.match(seletor, /sessionGroupId/);
  assert.match(seletor, /endereco_incompleto === false/);
  assert.match(seletor, /bindingAllowsSelect/);
  assert.equal(seletor.includes('Nenhum endereço cadastrado para este cliente'), false);
});

test('Gerenciar empty states render with synthetic loadStatus', async () => {
  const source = gerenciar;
  const code = transformSync(source, { loader: 'jsx', format: 'cjs', jsx: 'transform' }).code;
  const module = { exports: {} };
  const ui = new Proxy({}, {
    get: (_t, key) => (props) => React.createElement('div', props, props.children),
  });
  runInNewContext(code, {
    module,
    exports: module.exports,
    require: (path) => {
      if (path === 'react') return require('react');
      if (path === 'sonner') return { toast: { error: () => {}, success: () => {} } };
      if (path.includes('usePermissions')) {
        return { __esModule: true, default: () => ({ hasPermission: () => true, canEdit: () => false }) };
      }
      if (path.includes('BuscaCEP')) return { __esModule: true, default: () => null };
      if (path.includes('react-router')) return { Link: (p) => React.createElement('a', p, p.children) };
      if (path.includes('@/utils') || path.endsWith('/utils')) return { createPageUrl: (p) => `/${p}` };
      if (path.includes('lucide-react')) return new Proxy({}, { get: () => () => null });
      return ui;
    },
  });
  const Form = module.exports.default;
  const htmlFailed = renderToStaticMarkup(React.createElement(Form, {
    enderecos: [], loadStatus: 'failed', onChange: () => {},
  }));
  assert.match(htmlFailed, /Falha ao carregar/);
  assert.equal(htmlFailed.includes('(0)'), false);
  const htmlReview = renderToStaticMarkup(React.createElement(Form, {
    enderecos: [], loadStatus: 'loaded', reviewPendingHint: 5, onChange: () => {},
  }));
  assert.match(htmlReview, /5 local\(is\) recuperado/);
  assert.match(htmlReview, /Endereços de Entrega \(0\)/);
});
