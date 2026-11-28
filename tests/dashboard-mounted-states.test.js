import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

function resolveChromeBinary() {
  const cache = join(homedir(), ".cache", "ms-playwright");
  const installed = existsSync(cache)
    ? readdirSync(cache)
      .filter((name) => /^chromium-\d+$/.test(name))
      .flatMap((name) => ["chrome-linux/chrome", "chrome-linux64/chrome"].map((file) => join(cache, name, file)))
    : [];
  return (
    process.env.CHROME_BIN
    || (process.platform === "win32"
      ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
      : ["/usr/local/bin/google-chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser", ...installed].find(existsSync))
  );
}

test("Dashboard montado no Chrome: Grupo, troca CPA -> 3Z, perfil restrito, erro, zero confirmado, agregado sintético e drill-down", { timeout: 30000 }, async (t) => {
  const binary = resolveChromeBinary();
  assert.ok(binary && existsSync(binary), "Chrome existente necessario; nenhum browser sera instalado");

  const bundle = await build({
    stdin: {
      loader: "jsx",
      resolveDir: process.cwd(),
      contents: `
        import React, { useState } from 'react';
        import { createRoot } from 'react-dom/client';
        import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
        import { MemoryRouter, useLocation } from 'react-router-dom';
        import Dashboard from './src/pages/Dashboard.jsx';
        import { __setDashboardTestScenario } from '@/components/lib/useContextoVisual';

        window.addEventListener('error', (event) => {
          fetch('/result', { method: 'POST', body: JSON.stringify({ error: event.message }) });
        });

        function LocationTracker() {
          const loc = useLocation();
          window.__lastLocation = loc.pathname + loc.search;
          return null;
        }

        class CatchBoundary extends React.Component {
          constructor(props) { super(props); this.state = { err: null }; }
          static getDerivedStateFromError(err) { return { err }; }
          componentDidCatch(err) { window.__renderError = String(err && err.stack || err); }
          render() { return this.state.err ? <pre>{String(this.state.err)}</pre> : this.props.children; }
        }

        function TestHarness() {
          const [version, setVersion] = useState(0);
          const [aggregate, setAggregate] = useState(null);
          window.__rerender = (scenario, agg = null) => {
            __setDashboardTestScenario(scenario);
            setAggregate(agg);
            setVersion((v) => v + 1);
          };
          const client = React.useMemo(() => new QueryClient({
            defaultOptions: { queries: { retry: false, gcTime: 0 } },
          }), [version]);
          return (
            <CatchBoundary>
              <QueryClientProvider client={client}>
                <MemoryRouter initialEntries={['/Dashboard']}>
                  <LocationTracker />
                  <Dashboard key={version} aggregateOverride={aggregate} />
                </MemoryRouter>
              </QueryClientProvider>
            </CatchBoundary>
          );
        }

        const rootEl = document.querySelector('#root');
        createRoot(rootEl).render(<TestHarness />);

        const wait = async (predicate, label) => {
          for (let i = 0; i < 80; i++) {
            if (predicate()) return;
            await new Promise((r) => setTimeout(r, 25));
          }
          const chip = rootEl.querySelector('[data-kpi-key="vendas_periodo"]');
          const state = chip ? chip.getAttribute('data-indicator-state') : 'NO_CHIP';
          throw new Error('Timeout waiting for: ' + label + ' | chipState=' + state + ' | text=' + (rootEl.textContent || '').slice(0, 300));
        };

        async function run() {
          await wait(() => typeof window.__rerender === 'function', 'harness ready');
          const results = {};

          // 1) Grupo CPA Consolidado
          window.__rerender({
            contexto: 'grupo',
            grupoAtual: { id: 'grp-cpa', nome_do_grupo: 'Grupo CPA Sintetico' },
            empresaAtual: null,
            empresasDoGrupo: [
              { id: 'emp-cpa', group_id: 'grp-cpa', nome_fantasia: 'CPA Matriz' },
              { id: 'emp-3z', group_id: 'grp-cpa', nome_fantasia: '3Z Filial' },
            ],
            permissions: { all: true },
            counts: { Cliente: 142, Produto: 512, Colaborador: 28 },
            failEntities: [],
            data: {
              Pedido: [
                { id: 'p1', status: 'Faturado', valor_total: 15000, data_pedido: new Date().toISOString() },
                { id: 'p2', status: 'Aprovado', valor_total: 10000, data_pedido: new Date().toISOString() },
                { id: 'p3', status: 'Cancelado', valor_total: 90000, data_pedido: new Date().toISOString() },
              ],
              ContaReceber: [
                { id: 'cr1', status: 'Pendente', valor: 8000 },
                { id: 'cr2', status: 'Vencido', valor: 2000 },
              ],
              ContaPagar: [{ id: 'cp1', status: 'Pendente', valor: 3000 }],
              Produto: [{ id: 'pr1', estoque_atual: 1, estoque_minimo: 10 }],
              Entrega: [{ id: 'e1', status: 'Em Trânsito' }],
              OrdemProducao: [{ id: 'op1', status: 'Em Produção' }],
              Oportunidade: [{ id: 'o1', status: 'Aberto', valor_estimado: 20000 }],
            },
          });

          await wait(() => {
            const chip = rootEl.querySelector('[data-kpi-key="vendas_periodo"]');
            return chip && chip.getAttribute('data-indicator-state') === 'ok';
          }, 'grupo faturamento ok');

          const bannerGrupo = rootEl.querySelector('[data-block="dashboard-multiempresa-banner"]');
          const stripFatGrupo = rootEl.querySelector('[data-kpi-key="vendas_periodo"]');
          const stripCliGrupo = rootEl.querySelector('[data-kpi-key="clientes_canonico"]');
          results.grupo = {
            bannerScope: bannerGrupo?.getAttribute('data-scope-type'),
            bannerText: bannerGrupo?.textContent || '',
            faturamentoState: stripFatGrupo?.getAttribute('data-indicator-state'),
            faturamentoDrillDown: stripFatGrupo?.getAttribute('data-drilldown-url'),
            clientesState: stripCliGrupo?.getAttribute('data-indicator-state'),
            clientesText: stripCliGrupo?.textContent || '',
          };

          // Clique de drill-down deve navegar para /Relatorios com filtros iguais
          stripFatGrupo.click();
          await wait(() => String(window.__lastLocation || '').startsWith('/Relatorios?'), 'drilldown navigation');
          results.drillDownLocation = window.__lastLocation;

          // 2) Troca de contexto para Empresa CPA
          window.__rerender({
            contexto: 'empresa',
            grupoAtual: { id: 'grp-cpa', nome_do_grupo: 'Grupo CPA Sintetico' },
            empresaAtual: { id: 'emp-cpa', group_id: 'grp-cpa', nome_fantasia: 'CPA Matriz' },
            empresasDoGrupo: [
              { id: 'emp-cpa', group_id: 'grp-cpa', nome_fantasia: 'CPA Matriz' },
              { id: 'emp-3z', group_id: 'grp-cpa', nome_fantasia: '3Z Filial' },
            ],
            permissions: { all: true },
            counts: { Cliente: 90, Produto: 300, Colaborador: 18 },
            failEntities: [],
            data: {
              Pedido: [{ id: 'p1', status: 'Faturado', valor_total: 12000, data_pedido: new Date().toISOString() }],
              ContaReceber: [], ContaPagar: [], Produto: [], Entrega: [], OrdemProducao: [], Oportunidade: [],
            },
          });

          await wait(() => {
            const b = rootEl.querySelector('[data-block="dashboard-multiempresa-banner"]');
            return b && b.getAttribute('data-scope-type') === 'empresa' && b.textContent.includes('CPA Matriz');
          }, 'empresa CPA');

          results.cpa = {
            bannerScope: rootEl.querySelector('[data-block="dashboard-multiempresa-banner"]')?.getAttribute('data-scope-type'),
            drillDown: rootEl.querySelector('[data-kpi-key="vendas_periodo"]')?.getAttribute('data-drilldown-url'),
          };

          // 3) Troca de contexto para Empresa 3Z com zero confirmado em vendas e clientes
          window.__rerender({
            contexto: 'empresa',
            grupoAtual: { id: 'grp-cpa', nome_do_grupo: 'Grupo CPA Sintetico' },
            empresaAtual: { id: 'emp-3z', group_id: 'grp-cpa', nome_fantasia: '3Z Filial' },
            empresasDoGrupo: [
              { id: 'emp-cpa', group_id: 'grp-cpa', nome_fantasia: 'CPA Matriz' },
              { id: 'emp-3z', group_id: 'grp-cpa', nome_fantasia: '3Z Filial' },
            ],
            permissions: { all: true },
            counts: { Cliente: 0, Produto: 212, Colaborador: 10 },
            failEntities: [],
            data: {
              Pedido: [], ContaReceber: [], ContaPagar: [], Produto: [], Entrega: [], OrdemProducao: [], Oportunidade: [],
            },
          });

          await wait(() => {
            const b = rootEl.querySelector('[data-block="dashboard-multiempresa-banner"]');
            const c = rootEl.querySelector('[data-kpi-key="clientes_canonico"]');
            return b && b.textContent.includes('3Z Filial') && c && c.getAttribute('data-indicator-state') === 'zero_confirmado';
          }, 'empresa 3Z zero confirmado');

          results.empresa3z = {
            bannerText: rootEl.querySelector('[data-block="dashboard-multiempresa-banner"]')?.textContent || '',
            faturamentoState: rootEl.querySelector('[data-kpi-key="vendas_periodo"]')?.getAttribute('data-indicator-state'),
            clientesState: rootEl.querySelector('[data-kpi-key="clientes_canonico"]')?.getAttribute('data-indicator-state'),
            drillDown: rootEl.querySelector('[data-kpi-key="vendas_periodo"]')?.getAttribute('data-drilldown-url'),
          };

          // 4) Perfil restrito (sem permissão Comercial/Financeiro)
          window.__rerender({
            contexto: 'empresa',
            grupoAtual: { id: 'grp-cpa', nome_do_grupo: 'Grupo CPA Sintetico' },
            empresaAtual: { id: 'emp-3z', group_id: 'grp-cpa', nome_fantasia: '3Z Filial' },
            empresasDoGrupo: [{ id: 'emp-3z', group_id: 'grp-cpa', nome_fantasia: '3Z Filial' }],
            permissions: { all: false, allowed: ['Dashboard', 'Estoque', 'Cadastros', 'Relatorios'] },
            counts: { Cliente: 5, Produto: 15, Colaborador: 2 },
            failEntities: [],
            data: { Pedido: [], ContaReceber: [], ContaPagar: [], Produto: [], Entrega: [], OrdemProducao: [], Oportunidade: [] },
          });

          await wait(() => {
            const fat = rootEl.querySelector('[data-kpi-key="vendas_periodo"]');
            return fat && fat.getAttribute('data-indicator-state') === 'sem_acesso';
          }, 'perfil restrito');

          results.restrito = {
            faturamentoState: rootEl.querySelector('[data-kpi-key="vendas_periodo"]')?.getAttribute('data-indicator-state'),
            saldoState: rootEl.querySelector('[data-kpi-key="contas_receber"]')?.getAttribute('data-indicator-state'),
            produtosState: rootEl.querySelector('[data-kpi-key="produtos_canonico"]')?.getAttribute('data-indicator-state'),
          };

          // 5) Erro de consulta nunca mascara como zero
          window.__rerender({
            contexto: 'empresa',
            grupoAtual: { id: 'grp-cpa', nome_do_grupo: 'Grupo CPA Sintetico' },
            empresaAtual: { id: 'emp-cpa', group_id: 'grp-cpa', nome_fantasia: 'CPA Matriz' },
            empresasDoGrupo: [{ id: 'emp-cpa', group_id: 'grp-cpa', nome_fantasia: 'CPA Matriz' }],
            permissions: { all: true },
            counts: { Cliente: 10, Produto: 20, Colaborador: 5 },
            failEntities: ['Pedido', 'Cliente'],
            data: { Pedido: [], ContaReceber: [], ContaPagar: [], Produto: [], Entrega: [], OrdemProducao: [], Oportunidade: [] },
          });

          await wait(() => {
            const fat = rootEl.querySelector('[data-kpi-key="vendas_periodo"]');
            const cli = rootEl.querySelector('[data-kpi-key="clientes_canonico"]');
            const errBanner = rootEl.querySelector('[data-block="dashboard-error-banner"]');
            return (
              fat && fat.getAttribute('data-indicator-state') === 'erro' &&
              cli && cli.getAttribute('data-indicator-state') === 'erro' &&
              Boolean(errBanner)
            );
          }, 'erro consulta', 8000);

          results.erro = {
            faturamentoState: rootEl.querySelector('[data-kpi-key="vendas_periodo"]')?.getAttribute('data-indicator-state'),
            clientesState: rootEl.querySelector('[data-kpi-key="clientes_canonico"]')?.getAttribute('data-indicator-state'),
            hasErrorBanner: Boolean(rootEl.querySelector('[data-block="dashboard-error-banner"]')),
          };

          // 6) Contrato oficial de agregado (sintético)
          window.__rerender({
            contexto: 'grupo',
            grupoAtual: { id: 'grp-cpa', nome_do_grupo: 'Grupo CPA Sintetico' },
            empresaAtual: null,
            empresasDoGrupo: [{ id: 'emp-cpa', group_id: 'grp-cpa', nome_fantasia: 'CPA Matriz' }],
            permissions: { all: true },
            counts: { Cliente: 50, Produto: 100, Colaborador: 10 },
            failEntities: [],
            data: { Pedido: [], ContaReceber: [], ContaPagar: [], Produto: [], Entrega: [], OrdemProducao: [], Oportunidade: [] },
          }, {
            contractVersion: 'v1',
            counts: { Cliente: 50, Produto: 100, Colaborador: 10 },
            operational: { totalVendas: 98765, pedidosPeriodoCount: 12, ticketMedio: 8230.42, otd: 97.5 },
          });

          await wait(() => {
            const banner = rootEl.querySelector('[data-block="dashboard-multiempresa-banner"]');
            return banner && banner.textContent.includes('Agregados oficiais');
          }, 'agregados oficiais');

          results.agregado = {
            bannerText: rootEl.querySelector('[data-block="dashboard-multiempresa-banner"]')?.textContent || '',
            faturamentoText: rootEl.querySelector('[data-kpi-key="vendas_periodo"]')?.textContent || '',
          };

          return results;
        }

        run()
          .then((res) => fetch('/result', { method: 'POST', body: JSON.stringify(res) }))
          .catch((err) => fetch('/result', { method: 'POST', body: JSON.stringify({ error: String(err && err.stack || err) }) }));
      `,
    },
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    define: { "import.meta.env": "{}" },
    plugins: [
      {
        name: "dashboard-synthetic-mocks",
        setup(b) {
          const modules = {
            context: `
              let current = {
                contexto: 'grupo',
                grupoAtual: { id: 'grp-cpa', nome_do_grupo: 'Grupo CPA Sintetico' },
                empresaAtual: null,
                empresasDoGrupo: [],
                permissions: { all: true },
                counts: { Cliente: 0, Produto: 0, Colaborador: 0 },
                failEntities: [],
                data: {},
              };
              export const __setDashboardTestScenario = (next) => { current = { ...current, ...next }; };
              export const __getDashboardTestScenario = () => current;
              export const useContextoVisual = () => ({
                contexto: current.contexto,
                grupoAtual: current.grupoAtual,
                empresaAtual: current.empresaAtual,
                empresasDoGrupo: current.empresasDoGrupo || [],
                estaNoGrupo: current.contexto === 'grupo',
                alternarContexto: () => {},
                getFiltroContexto: () => (current.contexto === 'grupo' ? { group_id: current.grupoAtual?.id } : { group_id: current.grupoAtual?.id, empresa_id: current.empresaAtual?.id }),
                filterInContext: async (entityName) => {
                  if ((current.failEntities || []).includes(entityName)) {
                    throw new Error('Synthetic query error for ' + entityName);
                  }
                  return current.data?.[entityName] || [];
                },
                createInContext: async () => ({}),
              });
              export default useContextoVisual;
            `,
            permissions: `
              import { __getDashboardTestScenario } from '@/components/lib/useContextoVisual';
              export default function usePermissions() {
                const s = __getDashboardTestScenario();
                const all = s.permissions?.all !== false;
                const allowed = new Set(s.permissions?.allowed || []);
                return {
                  user: { id: 'synthetic-user' },
                  isLoading: false,
                  isAdmin: () => all,
                  hasPermission: (mod) => all || allowed.has(mod),
                };
              }
            `,
            base44: `
              import { __getDashboardTestScenario } from '@/components/lib/useContextoVisual';
              export const isHttpBackendMode = false;
              export const isApiKeyMode = false;
              export const isLocalOnlyMode = false;
              export const localApiUser = null;
              export const base44 = {
                functions: {
                  invoke: async (fn, payload) => {
                    const s = __getDashboardTestScenario();
                    if (fn === 'entityGuard') {
                      const all = s.permissions?.all !== false;
                      const allowedSet = new Set(s.permissions?.allowed || []);
                      const ok = all || allowedSet.has(payload?.module);
                      return { data: { allowed: ok } };
                    }
                    if (fn === 'countEntities') {
                      if ((s.failEntities || []).includes(payload?.entityName)) {
                        throw new Error('Synthetic count failure');
                      }
                      return { data: { count: s.counts?.[payload?.entityName] ?? 0 } };
                    }
                    return { data: {} };
                  },
                },
                entities: {},
              };
            `,
            widget: `import React from 'react'; export default function WidgetStub() { return <div data-testid="widget-stub" />; }`,
            recharts: `
              import React from 'react';
              const Box = ({ children }) => <div>{children}</div>;
              export const ResponsiveContainer = Box;
              export const BarChart = Box;
              export const Bar = () => null;
              export const AreaChart = Box;
              export const Area = () => null;
              export const LineChart = Box;
              export const Line = () => null;
              export const PieChart = Box;
              export const Pie = () => null;
              export const Cell = () => null;
              export const XAxis = () => null;
              export const YAxis = () => null;
              export const CartesianGrid = () => null;
              export const Tooltip = () => null;
              export const Legend = () => null;
            `,
            toast: `export const useToast = () => ({ toast: () => {} });`,
            user: `export const useUser = () => ({ user: { id: 'synthetic-user', full_name: 'Operador Sintetico', email: 'sintetico@exemplo.local' } });`,
            emptyCss: `export default {};`,
          };

          b.onResolve({ filter: /\.css$/ }, () => ({ namespace: "dash-mock", path: "emptyCss" }));
          b.onResolve({ filter: /^recharts$/ }, () => ({ namespace: "dash-mock", path: "recharts" }));
          b.onResolve(
            { filter: /(?:^|\/)(useContextoVisual|usePermissions|UserContext|base44Client|use-toast|WidgetFechamentoPedidos|CentralAcoesRapidas|PainelOperacoes3D|DashboardFinanceiroMestre|DashboardBI|DashboardVendas|DashboardLogistico|DashboardProducao|DashboardOperacionalBI|DashboardExecutivo)(?:\.[\w]+)?$/ },
            ({ path }) => {
              const name = path.split("/").pop().split(".")[0];
              const map = {
                useContextoVisual: "context",
                usePermissions: "permissions",
                UserContext: "user",
                base44Client: "base44",
                "use-toast": "toast",
                WidgetFechamentoPedidos: "widget",
                CentralAcoesRapidas: "widget",
                PainelOperacoes3D: "widget",
                DashboardFinanceiroMestre: "widget",
                DashboardBI: "widget",
                DashboardVendas: "widget",
                DashboardLogistico: "widget",
                DashboardProducao: "widget",
                DashboardOperacionalBI: "widget",
                DashboardExecutivo: "widget",
              };
              return { namespace: "dash-mock", path: map[name] };
            },
          );
          b.onLoad({ filter: /.*/, namespace: "dash-mock" }, ({ path }) => ({
            contents: modules[path],
            loader: "jsx",
            resolveDir: process.cwd(),
          }));
        },
      },
    ],
  });

  let finish;
  const report = new Promise((resolve) => { finish = resolve; });
  const server = createServer((req, res) => {
    if (req.url === "/result") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => { res.end("ok"); finish(JSON.parse(body)); });
    } else if (req.url === "/bundle.js") {
      res.setHeader("Content-Type", "application/javascript");
      res.end(bundle.outputFiles[0].contents);
    } else {
      res.end('<!doctype html><div id="root"></div><script src="/bundle.js"></script>');
    }
  });

  const profile = await mkdtemp(join(tmpdir(), "erp-dashboard-browser-"));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const child = spawn(
    binary,
    ["--headless", "--disable-gpu", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${profile}`, `http://127.0.0.1:${server.address().port}`],
    { stdio: "ignore", windowsHide: true },
  );
  child.on("error", (error) => finish({ error: error.code }));
  const timer = setTimeout(() => finish({ error: "DASHBOARD_BROWSER_TIMEOUT" }), 25000);

  try {
    const res = await report;
    assert.equal(res.error, undefined, JSON.stringify(res));

    // Grupo CPA
    assert.equal(res.grupo.bannerScope, "grupo");
    assert.match(res.grupo.bannerText, /Grupo CPA Sintetico/);
    assert.equal(res.grupo.faturamentoState, "ok");
    assert.equal(res.grupo.clientesState, "ok");
    assert.match(res.grupo.clientesText, /142/);
    assert.match(res.grupo.faturamentoDrillDown, /tab=vendas/);
    assert.match(res.grupo.faturamentoDrillDown, /scopeType=grupo/);
    assert.match(res.drillDownLocation, /^\/Relatorios\?.*tab=vendas.*group_id=grp-cpa/);

    // Troca para Empresa CPA
    assert.equal(res.cpa.bannerScope, "empresa");
    assert.match(res.cpa.drillDown, /empresa_id=emp-cpa/);

    // Troca para Empresa 3Z + zero confirmado
    assert.match(res.empresa3z.bannerText, /3Z Filial/);
    assert.equal(res.empresa3z.faturamentoState, "zero_confirmado");
    assert.equal(res.empresa3z.clientesState, "zero_confirmado");
    assert.match(res.empresa3z.drillDown, /empresa_id=emp-3z/);

    // Perfil restrito
    assert.equal(res.restrito.faturamentoState, "sem_acesso");
    assert.equal(res.restrito.saldoState, "sem_acesso");
    assert.equal(res.restrito.produtosState, "ok");

    // Erro de consulta != zero
    assert.equal(res.erro.faturamentoState, "erro");
    assert.equal(res.erro.clientesState, "erro");
    assert.equal(res.erro.hasErrorBanner, true);

    // Contrato agregado oficial sintético
    assert.match(res.agregado.bannerText, /Agregados oficiais/);
    assert.match(res.agregado.faturamentoText, /98\.765/);

    t.diagnostic("Mounted Dashboard browser scenarios passed: Grupo, CPA, 3Z, restrito, erro, zero_confirmado, agregado, drill-down");
  } finally {
    clearTimeout(timer);
    if (child.pid && child.exitCode === null && child.signalCode === null) {
      const exited = new Promise((resolve) => child.once("exit", resolve));
      child.kill();
      await exited;
    }
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  }
});
