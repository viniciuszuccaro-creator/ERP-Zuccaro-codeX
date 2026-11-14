/**
 * Continuity/PR595 — Completo fiscal allowReviewEdit; Seletor snapshotLocais.
 * ENTREGA onOpenDraft vive na PR596 (não duplicar nesta tip).
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

test('Completo: FISCAL allowReviewEdit; ENTREGA sem onOpenDraft (port 596)', () => {
  assert.match(completo, /finalidade="FISCAL" allowReviewEdit/);
  assert.doesNotMatch(completo, /finalidade="FISCAL"[^>]*onOpenDraft/);
  assert.match(completo, /finalidade="ENTREGA"/);
  assert.doesNotMatch(completo, /openLocalDraftFromReview/);
  assert.doesNotMatch(completo, /onOpenDraft=\{/);
  assert.match(revisao, /hasPermission\('Cadastros', 'cliente_local', 'visualizar'\)/);
  assert.match(completo, /api\.clientes\.listLocais/);
});

test('Revisão: FISCAL in-place; sem Ativar/Excluir; leitura fail-closed', () => {
  assert.match(revisao, /allowReviewEdit/);
  assert.match(revisao, /Salvar revisao fiscal sem ativar/);
  assert.match(revisao, /Leitura indisponivel neste contexto ou sem permissao/);
  assert.doesNotMatch(revisao, /\bAtivar\b|\bExcluir\b/);
});

test('Seletor: snapshotLocais + ENTREGA ativa + id canônico; sem zero falso', () => {
  assert.match(seletor, /snapshotLocais/);
  assert.match(seletor, /renderedSnapshot/);
  assert.match(seletor, /isClienteLocalCanonicalId/);
  assert.match(seletor, /fins\.includes\("ENTREGA"\)/);
  assert.match(seletor, /cliente_local_id/);
  assert.match(seletor, /Falha ao carregar locais\. Contagem não confirmada/);
  assert.match(seletor, /contextTick/);
  assert.match(seletor, /sessionActorId/);
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
