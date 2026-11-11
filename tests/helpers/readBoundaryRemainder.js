import assert from 'node:assert/strict';

const scalarFunction = "/** @param {unknown} value */\nexport function displayScalar(value) {\n  return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value)) ? value : null;\n}\n";
const userBefore = "      const err = new Error('Authentication required');\n      err.status = 401;\n      err.authType = 'auth_required';";
const userAfter = "      const err = Object.assign(new Error('Authentication required'), { status: 401, authType: 'auth_required' });";
export const readBoundaryHunks = {
  'src/lib/utils.js': [[scalarFunction, '', 1]],
  'src/components/chatbot/ChatbotFilaEspera.jsx': [
    ["import { displayScalar } from '@/lib/utils';\n", '', 1],
    ...['cliente_nome', 'prioridade', 'canal', 'status', 'sentimento_geral'].map(field => [`displayScalar(conversa.${field})`, `conversa.${field}`, 1]),
  ],
  'src/pages/OrcamentoSite.jsx': [
    ['import { displayScalar } from "@/lib/utils";\n', '', 1],
    ['displayScalar(p.descricao)', 'p.descricao', 1],
    ['displayScalar(p.codigo) || displayScalar(p.slug_site) || ""', 'p.codigo || p.slug_site || ""', 1],
  ],
  'src/components/lib/UserContext.jsx': [[userAfter, userBefore, 2]],
  'src/components/comercial/CentralCliente360Panel.jsx': [
    ['  isHttpApiError,\n  readHttpErrorBodyCode,\n', '', 1],
    ['const status = isHttpApiError(query.error) ? query.error.status : undefined;', 'const status = query.error?.status;', 1],
    ['const code = isHttpApiError(query.error) ? query.error.code || readHttpErrorBodyCode(query.error.body) : undefined;', 'const code = query.error?.code || query.error?.body?.error?.code;', 1],
    // #591: abrir cadastro com visualizar; editar permanece no Completo.
    [
      '  // Abrir cadastro mestre: visualizar basta. Editar/salvar permanece no Completo (fail-closed).\n'
      + '  // Não exigir Cliente.editar aqui — evita esconder leitura autorizada.\n'
      + '  const cadastroAllowed = enabled && !permissionsLoading\n'
      + "    && hasCadastroEntityPermission('Cliente', 'visualizar', { hasPermission, canEdit });\n",
      '  const cadastroAllowed = enabled && !permissionsLoading\n'
      + "    && hasCadastroEntityPermission('Cliente', 'visualizar', { hasPermission, canEdit })\n"
      + "    && hasCadastroEntityPermission('Cliente', 'editar', { hasPermission, canEdit });\n",
      1,
    ],
    // #591: identity rica — campos já no BFF (fantasia/social/origem) deixam de ficar ocultos na UI.
    [
      '      {identity && (\n'
      + '        <div\n'
      + '          className="border rounded-md bg-slate-50 p-3 text-sm grid grid-cols-1 md:grid-cols-3 gap-2"\n'
      + '          data-block="central360-identity-rica"\n'
      + '        >\n'
      + '          <div><span className="text-slate-500">Código</span><p className="font-mono" data-action="codigo-registro-central360">{identity.codigo ?? \'—\'}</p></div>\n'
      + '          <div>\n'
      + '            <span className="text-slate-500">ID técnico</span>\n'
      + '            <p className="font-mono text-xs" data-action="id-tecnico-central360" title="Identificador técnico imutável; distinto do código de registro">\n'
      + '              {identity.id || clienteId || \'—\'}\n'
      + '            </p>\n'
      + '          </div>\n'
      + '          <div><span className="text-slate-500">Tipo</span><p data-campo="tipo">{identity.tipo || \'—\'}</p></div>\n'
      + '          <div><span className="text-slate-500">Nome</span><p data-campo="nome">{identity.nome || \'—\'}</p></div>\n'
      + '          <div><span className="text-slate-500">Razão social</span><p data-campo="razao_social">{identity.razao_social || \'—\'}</p></div>\n'
      + '          <div><span className="text-slate-500">Nome fantasia</span><p data-campo="nome_fantasia">{identity.nome_fantasia || \'—\'}</p></div>\n'
      + '          <div><span className="text-slate-500">Nome social</span><p data-campo="nome_social">{identity.nome_social || \'—\'}</p></div>\n'
      + '          <div><span className="text-slate-500">Documento</span><p data-campo="documento">{identity.documento || \'—\'}</p></div>\n'
      + '          <div><span className="text-slate-500">E-mail</span><p data-campo="email">{identity.email || \'—\'}</p></div>\n'
      + '          <div><span className="text-slate-500">Telefone</span><p data-campo="telefone">{identity.telefone || \'—\'}</p></div>\n'
      + '          <div>\n'
      + '            <span className="text-slate-500">Celular</span>\n'
      + '            <p data-campo="celular">{identity.celular || \'—\'}</p>\n'
      + '            <p className="text-[10px] text-slate-400">Celular ≠ WhatsApp</p>\n'
      + '          </div>\n'
      + '          <div><span className="text-slate-500">Origem</span><p data-campo="origem">{identity.origem || \'—\'}</p></div>\n'
      + '          <div><span className="text-slate-500">Status</span><p data-campo="status">{identity.status || \'—\'}</p></div>\n'
      + '          <div>\n'
      + '            <span className="text-slate-500">Ativo</span>\n'
      + '            <p data-campo="ativo">{identity.ativo === true ? \'Sim\' : identity.ativo === false ? \'Não\' : \'—\'}</p>\n'
      + '          </div>\n'
      + '        </div>\n'
      + '      )}',
      '      {identity && (\n'
      + '        <div className="border rounded-md bg-slate-50 p-3 text-sm grid grid-cols-1 md:grid-cols-3 gap-2">\n'
      + '          <div><span className="text-slate-500">Código</span><p className="font-mono" data-action="codigo-registro-central360">{identity.codigo ?? \'—\'}</p></div>\n'
      + '          <div>\n'
      + '            <span className="text-slate-500">ID técnico</span>\n'
      + '            <p className="font-mono text-xs" data-action="id-tecnico-central360" title="Identificador técnico imutável; distinto do código de registro">\n'
      + '              {identity.id || clienteId || \'—\'}\n'
      + '            </p>\n'
      + '          </div>\n'
      + '          <div><span className="text-slate-500">Documento</span><p>{identity.documento || \'—\'}</p></div>\n'
      + '          <div><span className="text-slate-500">E-mail</span><p>{identity.email || \'—\'}</p></div>\n'
      + '          <div><span className="text-slate-500">Telefone</span><p>{identity.telefone || \'—\'}</p></div>\n'
      + '          <div><span className="text-slate-500">Celular</span><p>{identity.celular || \'—\'}</p></div>\n'
      + '          <div><span className="text-slate-500">Status</span><p>{identity.status}</p></div>\n'
      + '        </div>\n'
      + '      )}',
      1,
    ],
  ],
  'src/components/comercial/centralCliente360Pagination.js': [
    [' * @template {Record<string, number>} T\n * @param {T} limits', ' * @param {Record<string, number>} limits', 1],
    [' * @returns {{[K in keyof T]: number} & Record<string, number>}\n', '', 1],
  ],
  'src/components/lib/useOrigemPedido.jsx': [['gcTime: 10 * 60 * 1000, // 10 minutos', 'cacheTime: 10 * 60 * 1000, // 10 minutos', 1]],
  // Recuperação #401: remontar WidgetFechamentoPedidos no Dashboard (RBAC Comercial).
  'src/pages/Dashboard.jsx': [
    [
      'const WidgetFechamentoPedidos = React.lazy(() => import("@/components/comercial/WidgetFechamentoPedidos"));\n',
      '',
      1,
    ],
    [
      '          {/* Fechamento de pedidos — recurso existente reconectado ao Dashboard */}\n' +
        '          {canSeeComercial && (\n' +
        '            <ErrorBoundary fallback={<div className="text-sm text-slate-500 p-3">Widget de fechamento indisponível.</div>}>\n' +
        '              <Suspense fallback={<div className="h-24 rounded-md bg-slate-100 animate-pulse" />}>\n' +
        '                <WidgetFechamentoPedidos empresaId={empresaAtual?.id || null} />\n' +
        '              </Suspense>\n' +
        '            </ErrorBoundary>\n' +
        '          )}\n\n',
      '',
      1,
    ],
  ],
};
export function readBoundaryRemainder(file, text) {
  const hunks = readBoundaryHunks[file];
  if (!hunks) return text;
  let source = text.replace(/\r\n/g, '\n');
  for (const [current, previous, count] of hunks) {
    assert.equal(source.split(current).length - 1, count, `${file}: exact read boundary hunk`);
    source = source.split(current).join(previous);
  }
  if (file === 'src/components/lib/useOrigemPedido.jsx') {
    assert.ok(source.endsWith('export default useOrigemPedido;\n'), 'one final LF at existing export');
    source = source.slice(0, -1);
  }
  return source;
}
