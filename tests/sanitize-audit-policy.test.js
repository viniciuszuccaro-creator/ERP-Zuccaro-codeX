import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  normalizeSecurityConfig,
  validateSecurityConfig,
} from '../src/components/sistema/configuracao-seguranca/configuracaoSegurancaPolicy.js';

test('security configuration keeps safe defaults and rejects weak policies', () => {
  const defaults = normalizeSecurityConfig({});
  assert.equal(defaults.jwt_ativo, true);
  assert.equal(defaults.politica_senha.tamanho_minimo, 8);
  assert.deepEqual(validateSecurityConfig(defaults), []);

  const weak = normalizeSecurityConfig({
    jwt_validade_access_minutos: 1,
    tentativas_login_max: 1,
    politica_senha: { tamanho_minimo: 4 },
  });
  assert.equal(validateSecurityConfig(weak).length, 3);
});

test('operational audit call sites no longer swallow AuditLog failures', async () => {
  const sanitizer = await readFile(new URL('../src/components/lib/sanitizeOnWrite.jsx', import.meta.url), 'utf8');
  const ui = await readFile(new URL('../src/components/lib/uiAudit.jsx', import.meta.url), 'utf8');
  const local = await readFile(new URL('../src/api/localBase44Client.js', import.meta.url), 'utf8');
  const caixa = await readFile(new URL('../src/components/financeiro/CaixaCentralLiquidacao.jsx', import.meta.url), 'utf8');
  const cobranca = await readFile(new URL('../src/components/financeiro/GerarCobrancaModal.jsx', import.meta.url), 'utf8');
  const link = await readFile(new URL('../src/components/financeiro/GeradorLinkPagamento.jsx', import.meta.url), 'utf8');
  const liquidar = await readFile(new URL('../src/components/financeiro/caixa-central/LiquidarReceberPagar.jsx', import.meta.url), 'utf8');
  const seguranca = await readFile(new URL('../src/components/sistema/ConfiguracaoSeguranca.jsx', import.meta.url), 'utf8');
  const senhaTab = await readFile(new URL('../src/components/sistema/configuracao-seguranca/PasswordSecurityTab.jsx', import.meta.url), 'utf8');
  const pedido = await readFile(new URL('../src/components/comercial/pedido/PedidoTabsContainer.jsx', import.meta.url), 'utf8');
  const events = await readFile(new URL('../base44/functions/auditEntityEvents/entry.ts', import.meta.url), 'utf8');
  const invite = await readFile(new URL('../base44/functions/adminInviteUser/entry.ts', import.meta.url), 'utf8');
  const exportAco = await readFile(new URL('../base44/functions/exportEstoqueAco/entry.ts', import.meta.url), 'utf8');
  const emitirBoleto = await readFile(new URL('../base44/functions/emitirBoleto/entry.ts', import.meta.url), 'utf8');
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const stock = await readFile(new URL('../base44/functions/applyOrderStockMovements/entry.ts', import.meta.url), 'utf8');
  const upsert = await readFile(new URL('../base44/functions/upsertConfig/entry.ts', import.meta.url), 'utf8');
  const cnpj = await readFile(new URL('../base44/functions/ConsultarCNPJ/entry.ts', import.meta.url), 'utf8');
  const portal = await readFile(new URL('../base44/functions/portalToken/entry.ts', import.meta.url), 'utf8');
  const whatsapp = await readFile(new URL('../base44/functions/onEntityWhatsappNotify/entry.ts', import.meta.url), 'utf8');
  const security = await readFile(new URL('../base44/functions/securityAlerts/entry.ts', import.meta.url), 'utf8');
  const layout = await readFile(new URL('../src/Layout.jsx', import.meta.url), 'utf8');
  const liqUi = await readFile(new URL('../src/components/financeiro/AuditoriaLiquidacoes.jsx', import.meta.url), 'utf8');
  const formasUi = await readFile(new URL('../src/components/financeiro/AuditoriaFormasPagamento.jsx', import.meta.url), 'utf8');

  assert.match(sanitizer, /SENSITIVE_AUDIT_KEY/);
  assert.match(sanitizer, /protegido: true/);
  assert.match(sanitizer, /linha_digitavel/);
  assert.match(ui, /persistOperationalAudit/);
  assert.match(ui, /Falha ao persistir auditoria operacional/);
  assert.match(local, /sanitizeAuditPayload\(before\)/);
  assert.match(local, /correlacao_id/);
  assert.match(caixa, /persistOperationalAudit/);
  assert.match(cobranca, /persistOperationalAudit/);
  assert.match(link, /persistOperationalAudit/);
  assert.match(liquidar, /persistOperationalAudit/);
  assert.match(seguranca, /persistOperationalAudit/);
  assert.match(seguranca, /<PasswordSecurityTab/);
  assert.match(senhaTab, /Seguranca\.bruteforce\.bloquearIpSuspeito/);
  assert.doesNotMatch(caixa, /catch \{\}/);
  assert.doesNotMatch(cobranca, /catch \{\}/);
  assert.doesNotMatch(link, /catch \{\}/);
  assert.doesNotMatch(liquidar, /catch \{\}/);
  assert.doesNotMatch(seguranca, /catch \{\}/);
  assert.match(pedido, /Nao foi possivel validar credito/);
  assert.match(events, /protegido: true/);
  assert.match(events, /Falha ao registrar auditoria/);
  assert.match(events, /ok: false, skipped: true/);
  assert.match(events, /group_id: group_id \|\| null/);
  assert.doesNotMatch(invite, /catch \{\}/);
  assert.match(invite, /group_id: groupId/);
  assert.match(invite, /Falha ao registrar auditoria de convite/);
  assert.doesNotMatch(exportAco, /catch \{\}/);
  assert.match(exportAco, /group_id: groupId/);
  assert.match(exportAco, /Falha ao registrar auditoria da exportacao/);
  assert.equal(packageJson.dependencies.jspdf, '^4.2.1');
  assert.match(exportAco, /npm:jspdf@4\.2\.1/);
  assert.match(emitirBoleto, /npm:jspdf@4\.2\.1/);
  assert.doesNotMatch(stock, /catch \(_\) \{\}/);
  assert.match(stock, /Falha ao auditar bloqueio RBAC/);
  assert.match(upsert, /Falha ao auditar update por ID/);
  assert.match(upsert, /Falha ao auditar update por chave/);
  assert.match(upsert, /Falha ao auditar criacao de config/);
  assert.doesNotMatch(cnpj, /catch \(_\) \{\}/);
  assert.match(cnpj, /group_id: groupIdCtx/);
  assert.doesNotMatch(portal, /catch \{\}/);
  assert.match(portal, /Falha ao auditar/);
  assert.doesNotMatch(whatsapp, /\}\s*catch \{\}/);
  assert.match(security, /if \(!gid \|\| gid !== groupId\) return false/);
  assert.match(security, /adminInGroup/);
  assert.match(layout, /filterInContext\('AuditLog'/);
  assert.match(layout, /group_id: grupoAtual\?\.id \|\| empresaAtual\?\.group_id/);
  assert.match(liqUi, /filterInContext\('AuditLog'/);
  assert.doesNotMatch(liqUi, /base44\.entities\.AuditLog\.filter/);
  assert.match(formasUi, /filterInContext\('AuditLog'/);
  assert.doesNotMatch(formasUi, /FormaPagamento\.list\(\)/);
});

test('layout audits React Query v5 cache failures without exposing request payloads', async () => {
  const layout = await readFile(new URL('../src/Layout.jsx', import.meta.url), 'utf8');
  const shell = await readFile(new URL('../src/components/layout/AppLayoutShell.jsx', import.meta.url), 'utf8');

  assert.match(layout, /getQueryCache\(\)\.subscribe/);
  assert.match(layout, /getMutationCache\(\)\.subscribe/);
  assert.match(layout, /event\.query\.queryHash/);
  assert.match(layout, /event\.mutation\.mutationId/);
  assert.match(layout, /AppLayoutShell/);
  assert.doesNotMatch(layout, /auditCacheError\([^\n]+queryKey/);
  assert.match(shell, /section=\{null\}/);
  assert.match(shell, /className="min-h-screen h-full flex w-full/);
});

test('sidebar keeps its public controls typed after internal decomposition', async () => {
  const sidebar = await readFile(new URL('../src/components/ui/sidebar.jsx', import.meta.url), 'utf8');
  const context = await readFile(new URL('../src/components/ui/sidebar-context.jsx', import.meta.url), 'utf8');
  const menu = await readFile(new URL('../src/components/ui/sidebar-menu.jsx', import.meta.url), 'utf8');
  const shell = await readFile(new URL('../src/components/layout/AppLayoutShell.jsx', import.meta.url), 'utf8');

  assert.match(sidebar, /SIDEBAR_COOKIE_NAME/);
  assert.match(sidebar, /SIDEBAR_KEYBOARD_SHORTCUT/);
  assert.match(sidebar, /SidebarMenuButton,/);
  assert.match(context, /useSidebar must be used within a SidebarProvider/);
  assert.match(menu, /sidebarMenuButtonVariants/);
  assert.match(menu, /TooltipContent/);
  assert.match(shell, /<SidebarProvider>/);
  assert.doesNotMatch(shell, /ComponentType<any>/);
});
