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
      + '          <div><span className="text-slate-500">IE</span><p data-campo="inscricao_estadual">{identity.inscricao_estadual || \'—\'}</p></div>\n'
      + '          <div><span className="text-slate-500">IM</span><p data-campo="inscricao_municipal">{identity.inscricao_municipal || \'—\'}</p></div>\n'
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
      + '          <div className="md:col-span-3">\n'
      + '            <span className="text-slate-500">Observações</span>\n'
      + '            <p data-campo="observacoes" className="whitespace-pre-wrap break-words">\n'
      + '              {meta.sensitiveFields === \'revealed\'\n'
      + '                ? (identity.observacoes || \'—\')\n'
      + '                : \'Não autorizado ao perfil\'}\n'
      + '            </p>\n'
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
    // #591: imports Contatos MASTER.
    [
      "import { AlertCircle, Building2, MapPin, FileText, ShoppingCart, HardHat, Target, FilePlus2, Plus, Users, Truck } from 'lucide-react';\nimport {\n  canalClassificacaoAttr,\n  classifyCentral360Contatos,\n  isWhatsAppClassificado,\n  labelContatoCanal,\n} from '@/components/comercial/centralCliente360Contatos';\nimport {\n  classifyCentral360Documentos,\n  classifyCentral360Rg,\n} from '@/components/comercial/centralCliente360Documentos';\nimport { classifyCentral360Vinculos } from '@/components/comercial/centralCliente360Vinculos';\nimport {\n  canViewCentral360Entregas,\n  classifyCentral360Entregas,\n} from '@/components/comercial/centralCliente360Entregas';\nimport {\n  canViewCentral360Financeiro,\n  classifyCentral360Financeiro,\n} from '@/components/comercial/centralCliente360Financeiro';\nimport {\n  classifyClienteMasterExtras,\n  CLIENTE_MASTER_EXTRA_LABELS,\n} from '@/api/clienteMasterExtrasUi';\n",
      "import { AlertCircle, Building2, MapPin, FileText, ShoppingCart, HardHat, Target, FilePlus2, Plus } from 'lucide-react';\n",
      1,
    ],
    // #591: query Contatos MASTER (ctx pós-await).
    [
      "  // Contatos MASTER (GET Cliente via entities) — separado do central-360; omit ≠ limpar; ctx pós-await.\n  const canViewContatosMaster = enabled && !permissionsLoading\n    && hasCadastroEntityPermission('Cliente', 'visualizar', { hasPermission, canEdit });\n  const contatosQuery = useQuery({\n    queryKey: ['cliente-central-360-contatos', groupId, empresaId, actorId, clienteId, sessionKey],\n    queryFn: async () => {\n      const openedScope = { groupId, empresaId, actorId, token: sessionToken };\n      const clienteEntity = httpApi.entities?.Cliente;\n      if (!clienteEntity || typeof clienteEntity.get !== 'function') {\n        throw Object.assign(new Error('Cliente HTTP MASTER indisponível para contatos.'), {\n          code: 'CLIENTE_HTTP_UNAVAILABLE',\n        });\n      }\n      const row = await clienteEntity.get(clienteId);\n      if (!isCrmConversionScopeCurrent(openedScope, renderedScope.current, readErpHttpSession())) {\n        throw Object.assign(new Error('Contexto alterado. Reabra a Central antes de consultar contatos.'), {\n          code: 'CONTEXT_CHANGED',\n        });\n      }\n      return row;\n    },\n    enabled: Boolean(canViewContatosMaster && clienteId && sessionToken),\n    retry: 1,\n    staleTime: 0,\n    gcTime: 0,\n    refetchOnMount: 'always',\n    placeholderData: undefined,\n  });\n  const masterFlags = {\n    forbidden: !canViewContatosMaster && !permissionsLoading,\n    loadError: Boolean(contatosQuery.isError),\n  };\n  const contatosClassified = (() => {\n    const raw = classifyCentral360Contatos(contatosQuery.data, masterFlags);\n    return {\n      status: raw?.status || 'unavailable',\n      message: raw?.message || 'Contatos indisponíveis',\n      validos: Array.isArray(raw?.validos) ? raw.validos : [],\n      quarentena: Array.isArray(raw?.quarentena) ? raw.quarentena : [],\n    };\n  })();\n  const rgClassified = (() => {\n    const raw = classifyCentral360Rg(contatosQuery.data, masterFlags);\n    return {\n      status: raw?.status || 'unavailable',\n      message: raw?.message || 'RG indisponível',\n      value: raw?.value == null ? null : String(raw.value),\n    };\n  })();\n  const documentosClassified = (() => {\n    const raw = classifyCentral360Documentos(contatosQuery.data, masterFlags);\n    return {\n      status: raw?.status || 'unavailable',\n      message: raw?.message || 'Documentos indisponíveis',\n      items: Array.isArray(raw?.items) ? raw.items : [],\n      quarentena: Array.isArray(raw?.quarentena) ? raw.quarentena : [],\n    };\n  })();\n  const vinculosClassified = (() => {\n    const raw = classifyCentral360Vinculos(contatosQuery.data, masterFlags);\n    return {\n      status: raw?.status || 'unavailable',\n      message: raw?.message || 'Vínculos indisponíveis',\n      fields: Array.isArray(raw?.fields) ? raw.fields : [],\n    };\n  })();\n\n  // Entregas canônicas HTTP (≠ inventar contagem; RBAC Expedicao; ctx pós-await).\n  const canViewEntregas = enabled && !permissionsLoading && canViewCentral360Entregas(hasPermission);\n  const entregasQuery = useQuery({\n    queryKey: ['cliente-central-360-entregas', groupId, empresaId, actorId, clienteId, sessionKey],\n    queryFn: async () => {\n      const openedScope = { groupId, empresaId, actorId, token: sessionToken };\n      if (!httpApi.expedicao || typeof httpApi.expedicao.listEntregas !== 'function') {\n        throw Object.assign(new Error('API de entregas indisponível.'), { code: 'ENTREGAS_HTTP_UNAVAILABLE' });\n      }\n      const page = await httpApi.expedicao.listEntregas({\n        clienteId,\n        limit: 20,\n        offset: 0,\n      });\n      if (!isCrmConversionScopeCurrent(openedScope, renderedScope.current, readErpHttpSession())) {\n        throw Object.assign(new Error('Contexto alterado. Reabra a Central antes de consultar entregas.'), {\n          code: 'CONTEXT_CHANGED',\n        });\n      }\n      return page;\n    },\n    enabled: Boolean(canViewEntregas && clienteId && sessionToken),\n    retry: 1,\n    staleTime: 0,\n    gcTime: 0,\n    refetchOnMount: 'always',\n    placeholderData: undefined,\n  });\n  const entregasClassified = (() => {\n    const raw = classifyCentral360Entregas(entregasQuery.data, {\n      forbidden: !canViewEntregas && !permissionsLoading,\n      loadError: Boolean(entregasQuery.isError),\n    });\n    return {\n      status: raw?.status || 'unavailable',\n      message: raw?.message || 'Entregas indisponíveis',\n      rows: Array.isArray(raw?.rows) ? raw.rows : [],\n      total: raw?.total == null ? null : raw.total,\n    };\n  })();\n  const canViewFinanceiro = enabled && !permissionsLoading && canViewCentral360Financeiro(hasPermission);\n  const financeiroClassified = classifyCentral360Financeiro({\n    forbidden: !canViewFinanceiro && !permissionsLoading,\n    httpPending: true,\n  });\n  const masterExtrasClassified = classifyClienteMasterExtras(contatosQuery.data, masterFlags);\n\n",
      '',
      1,
    ],
    // #591: contatos MASTER na Central360 (GET Cliente + classificação).
    [
      "      <div\n        className=\"border rounded-md bg-white p-3 text-sm space-y-2\"\n        data-block=\"central360-contatos-master\"\n        data-contatos-status={contatosClassified.status}\n      >\n        <div className=\"flex items-center justify-between gap-2\">\n          <h4 className=\"font-medium text-slate-800 flex items-center gap-2\">\n            <Users className=\"h-4 w-4\" /> Contatos\n          </h4>\n          <span className=\"text-xs text-slate-500\">{contatosClassified.message}</span>\n        </div>\n        {contatosQuery.isLoading ? (\n          <p className=\"text-xs text-slate-500\">Carregando contatos…</p>\n        ) : null}\n        {contatosClassified.status === 'ok' || contatosClassified.quarentena.length > 0 ? (\n          <ul className=\"space-y-1.5\" data-fonte=\"contatos-jsonb-master\">\n            {contatosClassified.validos.map((c, idx) => (\n              <li\n                key={String(c.id || `${c.tipo}-${c.valor}-${idx}`)}\n                className=\"flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-slate-100 pb-1\"\n                data-campo=\"contato-valido\"\n                data-canal={canalClassificacaoAttr(c.tipo)}\n              >\n                <Badge variant=\"outline\">{labelContatoCanal(c.tipo)}</Badge>\n                {isWhatsAppClassificado(c.tipo) ? (\n                  <Badge className=\"bg-emerald-100 text-emerald-900\" data-campo=\"whatsapp-classificado\">\n                    WhatsApp classificado\n                  </Badge>\n                ) : null}\n                <span className=\"font-mono text-xs\">{String(c.valor || '—')}</span>\n                {c.nome ? <span className=\"text-slate-700\">{String(c.nome)}</span> : null}\n                {c.cargo ? <span className=\"text-xs text-slate-500\" data-campo=\"cargo\">{String(c.cargo)}</span> : null}\n                {c.principal ? <Badge className=\"bg-sky-100 text-sky-800\">Principal</Badge> : null}\n                {c.observacao ? (\n                  <span className=\"w-full text-xs italic text-slate-500\" data-campo=\"contato-observacao\">{String(c.observacao)}</span>\n                ) : null}\n              </li>\n            ))}\n            {contatosClassified.quarentena.map((c, idx) => (\n              <li\n                key={`q-${String(c.id || idx)}`}\n                className=\"flex flex-wrap items-baseline gap-x-2 text-amber-900\"\n                data-campo=\"contato-quarentena\"\n              >\n                <Badge variant=\"outline\" className=\"border-amber-300\">Quarentena</Badge>\n                <span className=\"text-xs\">{labelContatoCanal(c.tipo)} · {String(c.valor || '—')}</span>\n                <span className=\"text-[10px] text-amber-700\">canal inválido — não confundir com Celular/WhatsApp válido</span>\n              </li>\n            ))}\n          </ul>\n        ) : (\n          <p className=\"text-xs text-slate-600\" role=\"status\">{contatosClassified.message}</p>\n        )}\n        <p className=\"text-[10px] text-slate-400\">Celular ≠ WhatsApp · edição no Cadastro Completo (CAS contatos[]).</p>\n      </div>\n\n",
      '',
      1,
    ],
    // #591: RG + documentos[] estados (mesma GET MASTER).
    [
      "      <div\n        className=\"border rounded-md bg-white p-3 text-sm space-y-2\"\n        data-block=\"central360-docs-rg-master\"\n        data-rg-status={rgClassified.status}\n        data-documentos-status={documentosClassified.status}\n      >\n        <div className=\"flex items-center justify-between gap-2\">\n          <h4 className=\"font-medium text-slate-800 flex items-center gap-2\">\n            <FileText className=\"h-4 w-4\" /> RG e anexos\n          </h4>\n          <span className=\"text-xs text-slate-500\">≠ cadastro completo só por nome/documento</span>\n        </div>\n        {contatosQuery.isLoading ? (\n          <p className=\"text-xs text-slate-500\">Carregando RG/documentos…</p>\n        ) : null}\n        <div className=\"grid grid-cols-1 md:grid-cols-2 gap-2\" data-fonte=\"rg-master\">\n          <div>\n            <span className=\"text-slate-500 text-xs\">RG</span>\n            <p data-campo=\"rg\" data-rg-estado={rgClassified.status} className=\"font-mono text-xs\">\n              {rgClassified.status === 'present_bff_pending' ? (rgClassified.value || '—') : '—'}\n            </p>\n            <p className=\"text-[10px] text-slate-500\" role=\"status\">{rgClassified.message}</p>\n          </div>\n          <div>\n            <span className=\"text-slate-500 text-xs\">documentos[]</span>\n            <p className=\"text-[10px] text-slate-500\" data-campo=\"documentos-estado\" role=\"status\">\n              {documentosClassified.message}\n            </p>\n          </div>\n        </div>\n        {documentosClassified.items.length > 0 ? (\n          <ul className=\"space-y-1\" data-fonte=\"documentos-jsonb-master\">\n            {documentosClassified.items.map((doc, idx) => (\n              <li\n                key={String(doc.id || doc.nome_arquivo || idx)}\n                className=\"flex flex-wrap items-baseline gap-x-2 border-b border-slate-100 pb-1\"\n                data-campo=\"documento-anexo\"\n              >\n                <Badge variant=\"outline\">{String(doc.tipo || 'anexo')}</Badge>\n                <span className=\"text-xs\">{String(doc.nome_arquivo || doc.nome || 'sem nome')}</span>\n                <span className=\"text-[10px] text-amber-700\">leitura · escrita BFF pendente</span>\n              </li>\n            ))}\n          </ul>\n        ) : null}\n        {documentosClassified.quarentena.length > 0 ? (\n          <p className=\"text-[10px] text-amber-800\" data-campo=\"documentos-quarentena\">\n            {documentosClassified.quarentena.length} item(ns) em quarentena (inválido/incompleto)\n          </p>\n        ) : null}\n        <p className=\"text-[10px] text-slate-400\">\n          CPF/CNPJ = Documento MASTER · RG/anexos ≠ ModeloDocumento · omit ≠ limpar.\n        </p>\n        <div\n          className=\"border-t border-slate-100 pt-2 space-y-1\"\n          data-block=\"central360-master-extras\"\n          data-extras-present={masterExtrasClassified.present}\n        >\n          <p className=\"text-xs text-slate-500\">{masterExtrasClassified.message}</p>\n          <ul className=\"grid grid-cols-1 md:grid-cols-2 gap-1\">\n            {Object.entries(masterExtrasClassified.fields).map(([key, field]) => (\n              <li key={key} data-campo={key} data-extra-estado={field.status} className=\"text-xs\">\n                <span className=\"text-slate-500\">{CLIENTE_MASTER_EXTRA_LABELS[key] || key}</span>\n                <p className=\"font-mono truncate\">\n                  {field.status === 'present' ? (field.value || '—') : '—'}\n                </p>\n                <span className=\"text-[10px] text-slate-400\">{field.status}</span>\n              </li>\n            ))}\n          </ul>\n          <p className=\"text-[10px] text-slate-400\">\n            Extensões no mesmo Cliente · schema antigo pode omitir chaves · sem inventar defaults.\n          </p>\n        </div>\n      </div>\n\n",
      '',
      1,
    ],
    // #591: vínculos comerciais (vendedor/indicador/região).
    [
      "      <div\n        className=\"border rounded-md bg-white p-3 text-sm space-y-2\"\n        data-block=\"central360-vinculos-master\"\n        data-vinculos-status={vinculosClassified.status}\n      >\n        <div className=\"flex items-center justify-between gap-2\">\n          <h4 className=\"font-medium text-slate-800 flex items-center gap-2\">\n            <HardHat className=\"h-4 w-4\" /> Vínculos comerciais\n          </h4>\n          <span className=\"text-xs text-slate-500\">{vinculosClassified.message}</span>\n        </div>\n        <ul className=\"grid grid-cols-1 md:grid-cols-3 gap-2\" data-fonte=\"vinculos-master\">\n          {vinculosClassified.fields.map((f) => (\n            <li key={f.key} data-campo={f.key} data-vinculo-estado={f.status}>\n              <span className=\"text-slate-500 text-xs\">{f.label}</span>\n              <p className=\"text-xs font-mono truncate\" title={f.text || f.value || undefined}>\n                {f.status === 'present_bff_pending'\n                  ? (f.text || f.value || '—')\n                  : '—'}\n              </p>\n              <p className=\"text-[10px] text-slate-400\">{f.status}</p>\n            </li>\n          ))}\n        </ul>\n        <p className=\"text-[10px] text-slate-400\">\n          Vendedor/indicador/região: leitura se recuperados · escrita HTTP fail-closed até BFF · omit ≠ limpar.\n        </p>\n      </div>\n\n",
      '',
      1,
    ],
    // #591: entregas canônicas Cliente360.
    [
      "        <div\n          className=\"border rounded-md bg-white p-3 text-sm space-y-2 md:col-span-2\"\n          data-block=\"central360-entregas-cliente\"\n          data-entregas-status={entregasClassified.status}\n          data-permission=\"Expedicao.Entregas.visualizar\"\n        >\n          <div className=\"flex items-center justify-between gap-2\">\n            <h4 className=\"font-medium text-slate-800 flex items-center gap-2\">\n              <Truck className=\"h-4 w-4\" /> Entregas do cliente\n            </h4>\n            <span className=\"text-xs text-slate-500\">{entregasClassified.message}</span>\n          </div>\n          {entregasQuery.isLoading ? (\n            <p className=\"text-xs text-slate-500\">Carregando entregas…</p>\n          ) : null}\n          {entregasClassified.status === 'ok' ? (\n            <ul className=\"space-y-1.5\" data-fonte=\"entregas-http-canonico\">\n              {entregasClassified.rows.map((row, idx) => (\n                <li\n                  key={String(row.id || idx)}\n                  className=\"flex flex-wrap items-baseline gap-x-2 border-b border-slate-100 pb-1\"\n                  data-campo=\"entrega-row\"\n                >\n                  <span className=\"font-mono text-xs\" data-action=\"central360-entrega-id\">\n                    {String(row.id || '—').slice(0, 8)}\n                  </span>\n                  {row.status ? <Badge variant=\"outline\">{String(row.status)}</Badge> : null}\n                  {row.pedido_id || row.pedidoId ? (\n                    <span className=\"text-xs text-slate-600\" data-campo=\"entrega-pedido\">\n                      Pedido {String(row.pedido_id || row.pedidoId).slice(0, 8)}\n                    </span>\n                  ) : null}\n                  {row.cidade || row.uf ? (\n                    <span className=\"text-xs text-slate-500\">\n                      {[row.cidade, row.uf].filter(Boolean).join('/')}\n                    </span>\n                  ) : null}\n                </li>\n              ))}\n            </ul>\n          ) : (\n            <p className=\"text-xs text-slate-600\" role=\"status\">{entregasClassified.message}</p>\n          )}\n          <p className=\"text-[10px] text-slate-400\">\n            Fonte canônica `/api/v1/entregas` · sem sucesso fictício · envio externo depende de config/autorização.\n          </p>\n        </div>\n",
      '',
      1,
    ],
    // #591: financeiro soft-land Cliente360.
    [
      "        <div\n          className=\"border rounded-md bg-white p-3 text-sm space-y-2 md:col-span-2\"\n          data-block=\"central360-financeiro-cliente\"\n          data-financeiro-status={financeiroClassified.status}\n          data-permission=\"Financeiro.ContasReceber.visualizar\"\n        >\n          <div className=\"flex items-center justify-between gap-2\">\n            <h4 className=\"font-medium text-slate-800\">Financeiro autorizado</h4>\n            <span className=\"text-xs text-slate-500\">{financeiroClassified.status}</span>\n          </div>\n          <p className=\"text-xs text-slate-600\" role=\"status\">{financeiroClassified.message}</p>\n          <p className=\"text-[10px] text-slate-400\">\n            Sem inventar títulos/saldos · cobrança/NF dependem de módulo Fiscal/Financeiro e autorização na empresa.\n          </p>\n        </div>\n",
      '',
      1,
    ],
    // #591: locais — parcial ≠ completo (endereco_incompleto / resumo).
    [
      '          renderRow={(row) => (\n'
      + '            <>\n'
      + '              <span>{row.nome}</span>\n'
      + '              {row.endereco_incompleto ? (\n'
      + '                <Badge variant="outline" data-campo="endereco_incompleto" title="Localidade disponível; não tratar como endereço completo">\n'
      + '                  Endereço incompleto\n'
      + '                </Badge>\n'
      + '              ) : (\n'
      + '                <span className="text-xs text-slate-600" data-campo="endereco_resumo">\n'
      + '                  {[row.logradouro, row.numero].filter(Boolean).join(\', \')\n'
      + '                    || [row.bairro, row.cep].filter(Boolean).join(\' · \')\n'
      + '                    || \'Endereço sem logradouro\'}\n'
      + '                </span>\n'
      + '              )}\n'
      + '              <span className="text-xs text-slate-500" data-campo="localidade">\n'
      + '                {[row.cidade, row.uf].filter(Boolean).join(\'/\') || \'—\'}\n'
      + '              </span>\n'
      + '            </>\n'
      + '          )}\n'
      + '        />\n'
      + '        <BlockCard\n'
      + '          title="Obras"',
      '          renderRow={(row) => (\n'
      + '            <>\n'
      + '              <span>{row.nome}</span>\n'
      + '              <span className="text-xs text-slate-500">{row.cidade}/{row.uf}</span>\n'
      + '            </>\n'
      + '          )}\n'
      + '        />\n'
      + '        <BlockCard\n'
      + '          title="Obras"',
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
