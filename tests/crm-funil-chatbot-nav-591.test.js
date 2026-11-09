/**
 * #591 — Funil×3 RBAC/persist + Chatbot titleToModule fail-closed.
 * Sem dados reais.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

test('CRM launchpad: filtra módulos por sectionKey e bloqueia clique sem permissão', () => {
  const src = read('src/pages/CRM.jsx');
  assert.match(src, /canViewCrmModule/);
  assert.match(src, /allowedModules = modules\.filter\(canViewCrmModule\)/);
  assert.match(src, /ModulosGridCRM modules=\{allowedModules\}/);
  assert.match(src, /hasPermission\('CRM', key, 'ver'\)/);
  assert.match(src, /Acesso bloqueado/);
  assert.match(src, /invalidateQueries\(\{ queryKey: \['oportunidades'\] \}\)/);
  assert.match(src, /toast\.error/);
  // Mantém os três funis existentes (sem 4º)
  assert.match(src, /FunilVisual/);
  assert.match(src, /FunilComercialInteligente/);
  assert.match(src, /FunilVendasAvancado/);
});

test('Funil Avançado: queryKey inclui groupId + escopo (paridade Funil IA)', () => {
  const src = read('src/components/crm/FunilVendasAvancado.jsx');
  assert.match(src, /queryKey: \['oportunidades', groupId, empresaAtual\?\.id, estaNoGrupo \? 'grupo' : 'empresa'\]/);
});

test('Layout titleToModule: Chatbot/Hub e módulos operacionais fail-closed', () => {
  const layout = read('src/Layout.jsx');
  assert.match(layout, /"Chatbot de Atendimento": "CRM"/);
  assert.match(layout, /"Hub de Atendimento": "CRM"/);
  assert.match(layout, /"Cadastros Gerais": "Cadastros"/);
  assert.match(layout, /"Expedição e Logística": "Expedição"/);
  assert.match(layout, /"Produção e Manufatura": "Produção"/);
  assert.match(layout, /if \(!mod\) return true/);
});

test('V24 Cliente HTTP: sem piloto ≠ lista local; estados distintos', () => {
  const src = read('src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx');
  assert.match(src, /clienteHttpSemPiloto/);
  assert.match(src, /!clienteHttpSemPiloto/);
  assert.match(src, /data-fonte-estado="http-piloto-cliente-off"/);
  assert.match(src, /data-fonte-estado="sem-permissao"/);
  assert.match(src, /data-fonte-estado="erro-api"/);
  assert.match(src, /data-fonte-estado=\{debouncedSearch \? "busca-vazia" : "lista-vazia"\}/);
  assert.match(src, /sem fallback local\/sintético/);
});
