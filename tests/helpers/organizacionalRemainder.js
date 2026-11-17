import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

// Exact authorized organizational delta; all historical assertion hashes stay unchanged.
// Only historical comparisons use this projection; current behavior has separate tests.
const entries = {
  "server/src/app.ts": {
    "baseline": "696acc2f603c866168e904ee68c327874be84ddf973de488b0635666faa57fd2",
    "hunks": [
      {
        "before": "import { MarcaService } from './services/marcaService.js';\nimport { ProdutoService } from './services/produtoService.js';\nimport { TenantCrudService } from './services/tenantCrudService.js';\nimport { createApiRouter } from './api/router.js';\nimport { InMemoryTabelaPrecoRepository } from './repositories/inMemoryTabelaPrecoRepository.js';\nimport { PostgresTabelaPrecoRepository } from './repositories/postgresTabelaPrecoRepository.js';\n",
        "after": "import { MarcaService } from './services/marcaService.js';\nimport { ProdutoService } from './services/produtoService.js';\nimport { TenantCrudService } from './services/tenantCrudService.js';\nimport { OrganizacionalService } from './services/organizacionalService.js';\nimport type { A1VaultService } from './services/a1VaultService.js';\nimport { createApiRouter } from './api/router.js';\nimport { InMemoryTabelaPrecoRepository } from './repositories/inMemoryTabelaPrecoRepository.js';\nimport { PostgresTabelaPrecoRepository } from './repositories/postgresTabelaPrecoRepository.js';\n"
      },
      {
        "before": "import type { MalwareScanPort, StoragePort } from './services/storagePort.js';\n\nexport type CreateAppOptions = {\n  expedicaoPedidoPort?: ExpedicaoPedidoSideEffectPort;\n  expedicaoEstoquePort?: ExpedicaoEstoquePort;\n  expedicaoPedidoReader?: Pick<PedidoRepository, \"getForExpedicao\">;\n",
        "after": "import type { MalwareScanPort, StoragePort } from './services/storagePort.js';\n\nexport type CreateAppOptions = {\n  a1VaultService?: Pick<A1VaultService, 'upload' | 'metadata' | 'revoke' | 'rotate'>;\n  expedicaoPedidoPort?: ExpedicaoPedidoSideEffectPort;\n  expedicaoEstoquePort?: ExpedicaoEstoquePort;\n  expedicaoPedidoReader?: Pick<PedidoRepository, \"getForExpedicao\">;\n"
      },
      {
        "before": "    });\n  }\n  app.use(createApiRouter({\n    fornecedorService,\n    config,\n    db,\n",
        "after": "    });\n  }\n  app.use(createApiRouter({\n    a1VaultService: options.a1VaultService,\n    organizacionalService: useMemory ? undefined : new OrganizacionalService(db, auditRepo, rbacGuard, tenantGuard),\n    fornecedorService,\n    config,\n    db,\n"
      }
    ]
  },
  "server/src/api/router.ts": {
    "baseline": "217c6df91ec330e11987f0b90a571ef3870e922059a9af57b9f478a06cdbd2f5",
    "hunks": [
      {
        "before": "import { Router, type Request } from 'express';\nimport { z } from 'zod';\nimport { AppError } from './errors.js';\nimport type { AppConfig } from '../config/env.js';\n",
        "after": "import { Router, type Request } from 'express';\nimport { mountOrganizacionalRoutes } from './organizacionalRoutes.js';\nimport type { OrganizacionalService } from '../services/organizacionalService.js';\nimport type { A1VaultService } from '../services/a1VaultService.js';\nimport { mountA1VaultRoutes } from './a1VaultRoute.js';\nimport { z } from 'zod';\nimport { AppError } from './errors.js';\nimport type { AppConfig } from '../config/env.js';\n"
      },
      {
        "before": "};\n\nexport type ApiDeps = {\n  config: AppConfig;\n  db: DbClient;\n  authDb?: AuthDbClient;\n",
        "after": "};\n\nexport type ApiDeps = {\n  a1VaultService?: Pick<A1VaultService, 'upload' | 'metadata' | 'revoke' | 'rotate'>;\n  organizacionalService?: OrganizacionalService;\n  config: AppConfig;\n  db: DbClient;\n  authDb?: AuthDbClient;\n"
      },
      {
        "before": "}\nexport function createApiRouter(deps: ApiDeps) {\n  const router = Router();\n\n  router.get('/health', (_req, res) => {\n    res.json({\n",
        "after": "}\nexport function createApiRouter(deps: ApiDeps) {\n  const router = Router();\n  mountA1VaultRoutes(router, deps.a1VaultService, ctxFromReq);\n  if (deps.organizacionalService) mountOrganizacionalRoutes(router, deps.organizacionalService);\n\n  router.get('/health', (_req, res) => {\n    res.json({\n"
      }
    ]
  },
  "src/api/httpApiClient.js": {
    "baseline": "2d01bd57ba79ce0a0bbdfbcc527429fecc930c4b78450b51d67534239f9a62eb",
    "hunks": [
      {
        "before": "import { MAX_BANK_STATEMENT_BYTES } from './bankStatementContract.js';\nimport { createClienteLocalBatchHttpApi } from './clienteLocalBatchHttp.js';\n\n/**\n",
        "after": "import { MAX_BANK_STATEMENT_BYTES } from './bankStatementContract.js';\nimport { createClienteLocalBatchHttpApi } from './clienteLocalBatchHttp.js';\nimport { createOrganizacionalHttp } from './organizacionalHttp.js';\n\n/**\n"
      },
      {
        "before": "  /** @type {Record<string, ReturnType<typeof createCrudEntity>>} */\n  const entities = {};\n  for (const name of [\"Entrega\",\"Romaneio\",\"SeparacaoConferencia\"]) entities[name]=entityRoutes[name];\n  for (const name of HTTP_PILOT_ENTITIES) {\n",
        "after": "  /** @type {Record<string, ReturnType<typeof createCrudEntity>>} */\n  const entities = {};\n  for (const name of ['GrupoEmpresarial', 'Empresa']) entities[name] = createOrganizacionalHttp(name, request, getScope);\n  for (const name of [\"Entrega\",\"Romaneio\",\"SeparacaoConferencia\"]) entities[name]=entityRoutes[name];\n  for (const name of HTTP_PILOT_ENTITIES) {\n"
      }
    ]
  },
  "src/components/cadastros/GrupoEmpresarialForm.jsx": {
    "baseline": "73e2d8cf1de1a71cb888c703519e55a4c9db332f19e8f1c357b6de68e8f744d7",
    "hunks": [
      {
        "before": "import useCadastroRecordState from './useCadastroRecordState';\nimport React, { useMemo, useState } from \"react\";\nimport { Input } from \"@/components/ui/input\";\nimport { Label } from \"@/components/ui/label\";\nimport { Button } from \"@/components/ui/button\";\n",
        "after": "import useCadastroRecordState from './useCadastroRecordState';\nimport React, { useMemo, useState, useRef, useEffect, useId } from \"react\";\nimport { HTTP_CONTEXT_CHANGED } from '@/api/erpHttpSession';\nimport { isHttpBackendMode } from '@/api/base44Client';\nimport { hasCadastroEntityPermission } from './cadastroEditLoadPolicy';\nimport { Input } from \"@/components/ui/input\";\nimport { Label } from \"@/components/ui/label\";\nimport { Button } from \"@/components/ui/button\";\n"
      },
      {
        "before": "/**\n * V21.1.2 - WINDOW MODE READY\n */\nexport default function GrupoEmpresarialForm({ grupo, item, data, initialData, defaultValues, onSubmit, isSubmitting, windowMode = false }) {\n  const normalize = (registro) => {\n    if (!registro) return null;\n    return {\n",
        "after": "/**\n * V21.1.2 - WINDOW MODE READY\n */\nexport default function GrupoEmpresarialForm({ grupo, item, data, initialData, defaultValues, onSubmit, isSubmitting, windowMode = false, loadIncomplete = false, isLoadingRecord = false }) {\n  const normalize = (registro) => {\n    if (!registro) return null;\n    return {\n"
      },
      {
        "before": "  };\n\n  const dadosIniciais = normalize(item || data || initialData || defaultValues || grupo);\n  const { canCreate, canEdit, canDelete } = usePermissions();\n  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();\n  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || dadosIniciais?.id || null;\n  const contextoValido = Boolean(groupId || dadosIniciais?.id);\n  const podeCriar = canCreate(\"Cadastros\", \"GrupoEmpresarial\") || canCreate(\"Sistema\", \"Grupos\") || canCreate(\"Cadastros\", null);\n  const podeEditar = canEdit(\"Cadastros\", \"GrupoEmpresarial\") || canEdit(\"Sistema\", \"Grupos\") || canEdit(\"Cadastros\", null);\n  const podeExcluir = canDelete(\"Cadastros\", \"GrupoEmpresarial\") || canDelete(\"Sistema\", \"Grupos\") || canDelete(\"Cadastros\", null);\n  const podeSalvar = dadosIniciais?.id ? podeEditar : podeCriar;\n\n  const [formData, setFormData] = useCadastroRecordState(dadosIniciais || {\n    nome: \"\",\n",
        "after": "  };\n\n  const dadosIniciais = normalize(item || data || initialData || defaultValues || grupo);\n  const { canCreate, canEdit, canDelete, hasPermission, user, isLoading: permissionsLoading } = usePermissions();\n  const { empresaAtual, grupoAtual, filterInContext, contextoCanonico, isLoading: contextLoading } = useContextoVisual();\n  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || dadosIniciais?.id || null;\n  const contextoValido = Boolean(groupId || dadosIniciais?.id);\n  const empresasContextReady = !contextLoading && Boolean(contextoCanonico?.groupId && contextoCanonico.groupId === groupId);\n  const checkers = { canCreate, canEdit, canDelete, hasPermission };\n  const podeCriar = !permissionsLoading && !isHttpBackendMode && hasCadastroEntityPermission('GrupoEmpresarial', 'criar', checkers);\n  const podeEditar = !permissionsLoading && hasCadastroEntityPermission('GrupoEmpresarial', 'editar', checkers);\n  const podeExcluir = !isHttpBackendMode && hasCadastroEntityPermission('GrupoEmpresarial', 'excluir', checkers);\n  const podeSalvar = !loadIncomplete && !isLoadingRecord && (dadosIniciais?.id ? podeEditar : podeCriar);\n  const podeEditarIE = podeSalvar && (!isHttpBackendMode || (hasPermission('Fiscal', 'tabelas_fiscais', 'editar') && dadosIniciais?.supported_fields?.includes('inscricao_estadual')));\n  const busy = useRef(false);\n  const [sessionEpoch, setSessionEpoch] = useState(0);\n  const editorInstance = useId();\n  useEffect(() => {\n    const invalidate = () => setSessionEpoch(value => value + 1);\n    window.addEventListener(HTTP_CONTEXT_CHANGED, invalidate);\n    return () => window.removeEventListener(HTTP_CONTEXT_CHANGED, invalidate);\n  }, []);\n\n  const [formData, setFormData] = useCadastroRecordState(dadosIniciais || {\n    nome: \"\",\n"
      },
      {
        "before": "    status: \"Ativo\",\n    governanca_consolidada: false,\n    score_integracao_erp: 0\n  }, JSON.stringify([dadosIniciais?.id ?? null, dadosIniciais?.updated_at ?? dadosIniciais?.updated_date ?? null, grupoAtual?.id ?? null, empresaAtual?.id ?? null]));\n\n  // Escopo multiempresa: Empresa via filterInContext (group_id). Sem list unscoped.\n  // enabled exige contexto; erro ≠ zero KPI fabricado.\n  const { data: empresas = [], isError: isErrorEmpresas } = useQuery({\n    queryKey: [\"empresas\", groupId || \"sem-grupo\"],\n    queryFn: () => filterInContext('Empresa', groupId ? { group_id: groupId } : {}, 'razao_social', 500),\n    enabled: contextoValido,\n  });\n\n  const empresasDoGrupo = useMemo(() => empresas.filter((empresa) => {\n    if (!groupId) return true;\n    return empresa.group_id === groupId || empresa.grupo_id === groupId || (formData.empresas_ids || []).includes(empresa.id);\n  }), [empresas, formData.empresas_ids, groupId]);\n\n  const buildPayload = (extra = {}) => {\n    const empresasIds = Array.isArray(formData.empresas_ids) ? formData.empresas_ids.map((id) => sanitizeText(id, 120)).filter(Boolean) : [];\n",
        "after": "    status: \"Ativo\",\n    governanca_consolidada: false,\n    score_integracao_erp: 0\n  }, JSON.stringify([dadosIniciais?.id ?? null, dadosIniciais?.version ?? dadosIniciais?.updated_at ?? dadosIniciais?.updated_date ?? null, dadosIniciais?.inscricao_estadual, dadosIniciais?.supported_fields, grupoAtual?.id ?? null, empresaAtual?.id ?? null]));\n\n  // Escopo multiempresa: Empresa via filterInContext (group_id). Sem list unscoped.\n  // enabled exige contexto; erro ≠ zero KPI fabricado.\n  const { data: empresas = [], isError: isErrorEmpresas, isPending: empresasLoading } = useQuery({\n    queryKey: [\"grupo-empresas-vinculadas\", user?.id, user?.perfil_acesso_id, groupId, empresaAtual?.id, dadosIniciais?.version, sessionEpoch, editorInstance, contextoCanonico?.groupId],\n    gcTime: 0,\n    queryFn: () => filterInContext('Empresa', groupId ? { group_id: groupId } : {}, 'razao_social', 500),\n    enabled: contextoValido && empresasContextReady,\n  });\n\n  const empresasDoGrupo = useMemo(() => (empresasContextReady ? empresas : []).filter((empresa) => {\n    if (!groupId) return true;\n    return empresa.group_id === groupId || empresa.grupo_id === groupId || (formData.empresas_ids || []).includes(empresa.id);\n  }), [empresas, formData.empresas_ids, groupId, empresasContextReady]);\n\n  const buildPayload = (extra = {}) => {\n    const empresasIds = Array.isArray(formData.empresas_ids) ? formData.empresas_ids.map((id) => sanitizeText(id, 120)).filter(Boolean) : [];\n"
      },
      {
        "before": "      cnpj: sanitizeDocument(formData.cnpj, 32),\n      cnpj_opcional: sanitizeDocument(formData.cnpj, 32),\n      descricao: sanitizeText(formData.descricao, 1000),\n      inscricao_estadual: sanitizeDocument(formData.inscricao_estadual, 32),\n      empresas_ids: empresasIds,\n      status: sanitizeText(formData.status || \"Ativo\", 40),\n      score_integracao_erp: toNumber(formData.score_integracao_erp, 0),\n",
        "after": "      cnpj: sanitizeDocument(formData.cnpj, 32),\n      cnpj_opcional: sanitizeDocument(formData.cnpj, 32),\n      descricao: sanitizeText(formData.descricao, 1000),\n      inscricao_estadual: formData.inscricao_estadual === dadosIniciais?.inscricao_estadual\n        ? dadosIniciais?.inscricao_estadual : sanitizeDocument(formData.inscricao_estadual, 40),\n      empresas_ids: empresasIds,\n      status: sanitizeText(formData.status || \"Ativo\", 40),\n      score_integracao_erp: toNumber(formData.score_integracao_erp, 0),\n"
      },
      {
        "before": "    };\n  };\n\n  const handleSubmit = (e) => {\n    e.preventDefault();\n    if (!podeSalvar) {\n      alert(dadosIniciais?.id ? \"Sem permissao para editar grupo empresarial.\" : \"Sem permissao para criar grupo empresarial.\");\n      return;\n",
        "after": "    };\n  };\n\n  const handleSubmit = async (e) => {\n    e.preventDefault();\n    if (busy.current) return;\n    if (!podeSalvar) {\n      alert(dadosIniciais?.id ? \"Sem permissao para editar grupo empresarial.\" : \"Sem permissao para criar grupo empresarial.\");\n      return;\n"
      },
      {
        "before": "      alert(\"Preencha o nome do grupo\");\n      return;\n    }\n    onSubmit(payload);\n  };\n\n  const handleExcluir = () => {\n",
        "after": "      alert(\"Preencha o nome do grupo\");\n      return;\n    }\n    busy.current = true;\n    try { await onSubmit(payload); }\n    catch (error) { console.error('Falha ao salvar grupo', error); }\n    finally { busy.current = false; }\n  };\n\n  const handleExcluir = () => {\n"
      },
      {
        "before": "  };\n\n  const handleAlternarStatus = () => {\n    if (!podeEditar) {\n      alert(\"Sem permissao para alterar status do grupo empresarial.\");\n      return;\n",
        "after": "  };\n\n  const handleAlternarStatus = () => {\n    if (isHttpBackendMode) return;\n    if (!podeEditar) {\n      alert(\"Sem permissao para alterar status do grupo empresarial.\");\n      return;\n"
      },
      {
        "before": "  };\n\n  const toggleEmpresa = (empresaId) => {\n    if (!podeSalvar) return;\n    const ids = formData.empresas_ids || [];\n    if (ids.includes(empresaId)) {\n",
        "after": "  };\n\n  const toggleEmpresa = (empresaId) => {\n    if (isHttpBackendMode) return;\n    if (!podeSalvar) return;\n    const ids = formData.empresas_ids || [];\n    if (ids.includes(empresaId)) {\n"
      },
      {
        "before": "  const formContent = (\n    <form onSubmit={handleSubmit} className=\"space-y-4\">\n      <CadastroCodigoRegistroField\n        idOnly\n        hasId={Boolean(dadosIniciais?.id)}\n        entityId={dadosIniciais?.id}\n        action=\"id-tecnico-grupo-empresarial\"\n      />\n      <div>\n        <Label>Nome do Grupo *</Label>\n        <Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} placeholder=\"Ex: Grupo CPA\" disabled={!podeSalvar} data-permission=\"Cadastros.GrupoEmpresarial.editar\" data-action=\"editar-nome-grupo\" data-sensitive />\n      </div>\n\n      <div>\n        <Label>Descricao</Label>\n        <Textarea value={formData.descricao || \"\"} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} placeholder=\"Descricao do grupo empresarial...\" rows={2} disabled={!podeSalvar} data-permission=\"Cadastros.GrupoEmpresarial.editar\" data-action=\"editar-descricao-grupo\" data-sensitive />\n      </div>\n\n      <div className=\"grid grid-cols-2 gap-4\">\n        <div>\n          <Label>CNPJ do Grupo</Label>\n          <Input value={formData.cnpj || \"\"} onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })} placeholder=\"00.000.000/0001-00\" disabled={!podeSalvar} data-permission=\"Cadastros.GrupoEmpresarial.editar\" data-action=\"editar-cnpj-grupo\" data-sensitive />\n        </div>\n\n        <div>\n          <Label>Inscricao Estadual</Label>\n          <Input value={formData.inscricao_estadual} onChange={(e) => setFormData({ ...formData, inscricao_estadual: e.target.value })} disabled={!podeSalvar} data-permission=\"Cadastros.GrupoEmpresarial.editar\" data-action=\"editar-inscricao-grupo\" data-sensitive />\n        </div>\n      </div>\n\n",
        "after": "  const formContent = (\n    <form onSubmit={handleSubmit} className=\"space-y-4\">\n      <CadastroCodigoRegistroField\n        value={dadosIniciais?.codigo}\n        hasId={Boolean(dadosIniciais?.id)}\n        entityId={dadosIniciais?.id}\n        action=\"codigo-registro-grupo-empresarial\"\n      />\n      <div>\n        <Label>Nome do Grupo *</Label>\n        <Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} placeholder=\"Ex: Grupo CPA\" disabled={!podeSalvar} data-permission=\"Cadastros.Organizacional.editar\" data-action=\"editar-nome-grupo\" data-sensitive />\n      </div>\n\n      <div>\n        <Label>Descricao</Label>\n        <Textarea value={formData.descricao || \"\"} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} placeholder=\"Descricao do grupo empresarial...\" rows={2} disabled={!podeSalvar} data-permission=\"Cadastros.Organizacional.editar\" data-action=\"editar-descricao-grupo\" data-sensitive />\n      </div>\n\n      <div className=\"grid grid-cols-2 gap-4\">\n        <div>\n          <Label>CNPJ do Grupo</Label>\n          <Input value={formData.cnpj || \"\"} onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })} placeholder=\"00.000.000/0001-00\" disabled={!podeSalvar} data-permission=\"Cadastros.Organizacional.editar\" data-action=\"editar-cnpj-grupo\" data-sensitive />\n        </div>\n\n        <div>\n          <Label>Inscricao Estadual</Label>\n          <Input value={formData.inscricao_estadual || ''} onChange={(e) => setFormData({ ...formData, inscricao_estadual: e.target.value })} disabled={!podeEditarIE} data-permission={isHttpBackendMode ? 'Fiscal.tabelas_fiscais.editar' : 'Cadastros.Organizacional.editar'} data-action=\"editar-inscricao-grupo\" data-sensitive />\n        </div>\n      </div>\n\n"
      },
      {
        "before": "            {empresasDoGrupo.map((empresa) => (\n              <div key={empresa.id} className=\"flex items-center justify-between p-2 hover:bg-slate-50 rounded\">\n                <div className=\"flex items-center gap-2\">\n                  <input type=\"checkbox\" checked={(formData.empresas_ids || []).includes(empresa.id)} onChange={() => toggleEmpresa(empresa.id)} disabled={!podeSalvar} className=\"w-4 h-4\" data-permission=\"Cadastros.GrupoEmpresarial.vincularEmpresa\" data-action=\"vincular-empresa-grupo\" data-sensitive />\n                  <div>\n                    <p className=\"text-sm font-medium\">{empresa.razao_social}</p>\n                    <p className=\"text-xs text-slate-500\">{empresa.cnpj}</p>\n",
        "after": "            {empresasDoGrupo.map((empresa) => (\n              <div key={empresa.id} className=\"flex items-center justify-between p-2 hover:bg-slate-50 rounded\">\n                <div className=\"flex items-center gap-2\">\n                  <input type=\"checkbox\" checked={(formData.empresas_ids || []).includes(empresa.id)} onChange={() => toggleEmpresa(empresa.id)} disabled={!podeSalvar || isHttpBackendMode} className=\"w-4 h-4\" data-permission=\"Cadastros.GrupoEmpresarial.vincularEmpresa\" data-action=\"vincular-empresa-grupo\" data-sensitive />\n                  <div>\n                    <p className=\"text-sm font-medium\">{empresa.razao_social}</p>\n                    <p className=\"text-xs text-slate-500\">{empresa.cnpj}</p>\n"
      },
      {
        "before": "              </div>\n            ))}\n\n            {empresasDoGrupo.length === 0 && (\n              <p className=\"text-sm text-slate-500 text-center py-4\">\n                {isErrorEmpresas\n                  ? 'Contagem de empresas indisponível (erro de carga ≠ zero).'\n                  : 'Nenhuma empresa cadastrada'}\n              </p>\n",
        "after": "              </div>\n            ))}\n\n            {(empresasLoading || isErrorEmpresas || empresasDoGrupo.length === 0) && (\n              <p className=\"text-sm text-slate-500 text-center py-4\">\n                {!contextLoading && !empresasContextReady ? 'Contexto de Grupo indisponivel. Reabra o cadastro.' : empresasLoading ? 'Carregando empresas vinculadas...' : isErrorEmpresas\n                  ? 'Contagem de empresas indisponível (erro de carga ≠ zero).'\n                  : 'Nenhuma empresa cadastrada'}\n              </p>\n"
      },
      {
        "before": "          <Label>Governanca Consolidada</Label>\n          <p className=\"text-xs text-slate-500\">Sincroniza Plano de Contas entre empresas</p>\n        </div>\n        <Switch checked={formData.governanca_consolidada} onCheckedChange={(v) => setFormData({ ...formData, governanca_consolidada: v })} disabled={!podeSalvar} data-permission=\"Cadastros.GrupoEmpresarial.governanca\" data-action=\"alternar-governanca-grupo\" data-sensitive />\n      </div>\n\n      <Badge className=\"bg-blue-100 text-blue-700\">\n        <Network className=\"w-3 h-3 mr-1\" />\n        Score Integracao ERP: {formData.score_integracao_erp}% (calculado por IA)\n      </Badge>\n\n      <div className=\"flex justify-end gap-3 pt-4 border-t\">\n        {dadosIniciais && (\n          <>\n            <Button type=\"button\" variant=\"outline\" onClick={handleAlternarStatus} disabled={!podeEditar} data-permission=\"Cadastros.GrupoEmpresarial.alterarStatus\" data-sensitive className={formData.status === \"Ativo\" ? \"border-orange-300 text-orange-700\" : \"border-green-300 text-green-700\"}>\n              {formData.status === \"Ativo\" ? (\n                <><PowerOff className=\"w-4 h-4 mr-2\" />Inativar</>\n              ) : (\n",
        "after": "          <Label>Governanca Consolidada</Label>\n          <p className=\"text-xs text-slate-500\">Sincroniza Plano de Contas entre empresas</p>\n        </div>\n        <Switch checked={formData.governanca_consolidada} onCheckedChange={(v) => setFormData({ ...formData, governanca_consolidada: v })} disabled={!podeSalvar || isHttpBackendMode} data-permission=\"Cadastros.GrupoEmpresarial.governanca\" data-action=\"alternar-governanca-grupo\" data-sensitive />\n      </div>\n\n      {!isHttpBackendMode && <Badge className=\"bg-blue-100 text-blue-700\">\n        <Network className=\"w-3 h-3 mr-1\" />\n        Score Integracao ERP: {formData.score_integracao_erp}% (calculado por IA)\n      </Badge>}\n\n      <div className=\"flex justify-end gap-3 pt-4 border-t\">\n        {dadosIniciais && (\n          <>\n            <Button type=\"button\" variant=\"outline\" onClick={handleAlternarStatus} disabled={!podeEditar || isHttpBackendMode} data-permission=\"Cadastros.GrupoEmpresarial.alterarStatus\" data-sensitive className={formData.status === \"Ativo\" ? \"border-orange-300 text-orange-700\" : \"border-green-300 text-green-700\"}>\n              {formData.status === \"Ativo\" ? (\n                <><PowerOff className=\"w-4 h-4 mr-2\" />Inativar</>\n              ) : (\n"
      },
      {
        "before": "            </Button>\n          </>\n        )}\n        <Button type=\"submit\" disabled={isSubmitting || !podeSalvar} data-permission=\"Cadastros.GrupoEmpresarial.salvar\" data-action=\"salvar-grupo-empresarial\" data-sensitive>\n          {isSubmitting && <Loader2 className=\"w-4 h-4 mr-2 animate-spin\" />}\n          {dadosIniciais ? \"Atualizar Grupo\" : \"Criar Grupo\"}\n        </Button>\n",
        "after": "            </Button>\n          </>\n        )}\n        <Button type=\"submit\" disabled={isSubmitting || !podeSalvar} data-permission=\"Cadastros.Organizacional.editar\" data-action=\"salvar-grupo-empresarial\" data-sensitive>\n          {isSubmitting && <Loader2 className=\"w-4 h-4 mr-2 animate-spin\" />}\n          {dadosIniciais ? \"Atualizar Grupo\" : \"Criar Grupo\"}\n        </Button>\n"
      }
    ]
  },
  "src/components/cadastros/EmpresaForm.jsx": {
    "baseline": "259cfa15e5e4781a01c0df91c59b316e1ad69e7748db638300af861138d4e2fa",
    "hunks": [
      {
        "before": "﻿import React, { useEffect, useState } from \"react\";\nimport { Input } from \"@/components/ui/input\";\nimport useCadastroRecordState from './useCadastroRecordState';\nimport { Label } from \"@/components/ui/label\";\nimport { Button } from \"@/components/ui/button\";\nimport { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from \"@/components/ui/select\";\n",
        "after": "﻿import React, { useEffect, useState } from \"react\";\nimport { Input } from \"@/components/ui/input\";\nimport { useRef } from 'react';\nimport { isHttpBackendMode } from '@/api/base44Client';\nimport useCadastroRecordState from './useCadastroRecordState';\nimport CadastroCodigoRegistroField from './CadastroCodigoRegistroField';\nimport CertificadoA1Panel from '../fiscal/CertificadoA1Panel';\nimport useCertificadoA1 from '../fiscal/useCertificadoA1';\nimport { useQueryClient } from '@tanstack/react-query';\nimport { Label } from \"@/components/ui/label\";\nimport { Button } from \"@/components/ui/button\";\nimport { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from \"@/components/ui/select\";\n"
      },
      {
        "before": "  return {\n    ...EMPRESA_FORM_DEFAULTS,\n    ...src,\n    certificado_digital: {\n      ...EMPRESA_FORM_DEFAULTS.certificado_digital,\n      ...(src.certificado_digital && typeof src.certificado_digital === \"object\" ? src.certificado_digital : {}),\n",
        "after": "  return {\n    ...EMPRESA_FORM_DEFAULTS,\n    ...src,\n    regime_tributario: Array.isArray(src.supported_fields)\n      ? (src.regime_tributario ?? '') : (src.regime_tributario ?? EMPRESA_FORM_DEFAULTS.regime_tributario),\n    certificado_digital: {\n      ...EMPRESA_FORM_DEFAULTS.certificado_digital,\n      ...(src.certificado_digital && typeof src.certificado_digital === \"object\" ? src.certificado_digital : {}),\n"
      },
      {
        "before": "  const { canCreate, canEdit, hasPermission, hasPermissionKey } = usePermissions();\n  const { empresaAtual, grupoAtual } = useContextoVisual();\n  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;\n  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);\n  const permCheckers = { hasPermission, canCreate, canEdit };\n  const podeCriar = hasCadastroEntityPermission(\"Empresa\", \"criar\", permCheckers);\n",
        "after": "  const { canCreate, canEdit, hasPermission, hasPermissionKey } = usePermissions();\n  const { empresaAtual, grupoAtual } = useContextoVisual();\n  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;\n  const queryClient = useQueryClient();\n  const vault = useCertificadoA1({ groupId, empresaId: dadosIniciais?.id });\n  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);\n  const permCheckers = { hasPermission, canCreate, canEdit };\n  const podeCriar = hasCadastroEntityPermission(\"Empresa\", \"criar\", permCheckers);\n"
      },
      {
        "before": "    ? \"Cadastros.Organizacional.editar\"\n    : \"Cadastros.Organizacional.criar\";\n  const permissaoCertificado = \"Cadastros.Empresa.Certificado.editar\";\n  const podeEditarCertificado = podeSalvar && hasPermissionKey(permissaoCertificado);\n  const saveBlocked = Boolean(isLoadingRecord || loadIncomplete);\n  const [formData, setFormData] = useCadastroRecordState(mergeEmpresaFormData(dadosIniciais), JSON.stringify([\n    dadosIniciais?.id ?? null, dadosIniciais?.updated_date ?? null,\n    dadosIniciais?.razao_social, dadosIniciais?.cnpj, dadosIniciais?.nome_fantasia,\n    grupoAtual?.id ?? null, empresaAtual?.id ?? null,\n  ]));\n",
        "after": "    ? \"Cadastros.Organizacional.editar\"\n    : \"Cadastros.Organizacional.criar\";\n  const permissaoCertificado = \"Cadastros.Empresa.Certificado.editar\";\n  const podeEditarCertificado = !isHttpBackendMode && podeSalvar && hasPermissionKey(permissaoCertificado);\n  const saveBlocked = Boolean(isLoadingRecord || loadIncomplete);\n  const podeEditarFiscal = podeSalvar && (!isHttpBackendMode || hasPermission('Fiscal', 'tabelas_fiscais', 'editar'));\n  const fiscalPermission = isHttpBackendMode ? 'Fiscal.tabelas_fiscais.editar' : permissaoFormulario;\n  const supportsIE = !isHttpBackendMode || dadosIniciais?.supported_fields?.includes('inscricao_estadual');\n  const supportsRegime = !isHttpBackendMode || dadosIniciais?.supported_fields?.includes('regime_tributario');\n  const persistBusy = useRef(false);\n  const [formData, setFormData] = useCadastroRecordState(mergeEmpresaFormData(dadosIniciais), JSON.stringify([\n    dadosIniciais?.id ?? null, dadosIniciais?.version ?? dadosIniciais?.updated_at ?? dadosIniciais?.updated_date ?? null,\n    dadosIniciais?.inscricao_estadual, dadosIniciais?.regime_tributario, dadosIniciais?.supported_fields,\n    dadosIniciais?.razao_social, dadosIniciais?.cnpj, dadosIniciais?.nome_fantasia,\n    grupoAtual?.id ?? null, empresaAtual?.id ?? null,\n  ]));\n"
      },
      {
        "before": "      nome_fantasia: sanitizeText(formData.nome_fantasia, 180),\n      nome: sanitizeText(formData.nome_fantasia || formData.razao_social, 180),\n      cnpj: sanitizeDocument(formData.cnpj, 32),\n      inscricao_estadual: sanitizeDocument(formData.inscricao_estadual, 32),\n      regime_tributario: sanitizeText(formData.regime_tributario, 80),\n      tipo: sanitizeText(formData.tipo, 40),\n      status: sanitizeText(formData.status, 40),\n",
        "after": "      nome_fantasia: sanitizeText(formData.nome_fantasia, 180),\n      nome: sanitizeText(formData.nome_fantasia || formData.razao_social, 180),\n      cnpj: sanitizeDocument(formData.cnpj, 32),\n      inscricao_estadual: formData.inscricao_estadual === dadosIniciais?.inscricao_estadual\n        ? dadosIniciais?.inscricao_estadual : sanitizeDocument(formData.inscricao_estadual, 40),\n      regime_tributario: sanitizeText(formData.regime_tributario, 80),\n      tipo: sanitizeText(formData.tipo, 40),\n      status: sanitizeText(formData.status, 40),\n"
      },
      {
        "before": "  };\n\n  const handleSubmit = async () => {\n    if (saveBlocked) {\n      toast.error(\"Aguarde o carregamento completo do registro antes de salvar.\");\n      return;\n",
        "after": "  };\n\n  const handleSubmit = async () => {\n    if (persistBusy.current) return;\n    if (saveBlocked) {\n      toast.error(\"Aguarde o carregamento completo do registro antes de salvar.\");\n      return;\n"
      },
      {
        "before": "      toast.error(\"Razao Social e CNPJ sao obrigatorios.\");\n      return;\n    }\n    onSubmit(payload);\n  };\n\n  const formContent = (\n",
        "after": "      toast.error(\"Razao Social e CNPJ sao obrigatorios.\");\n      return;\n    }\n    persistBusy.current = true;\n    try { await onSubmit(payload); }\n    catch (error) { toast.error(error.message || 'Falha ao salvar empresa.'); }\n    finally { persistBusy.current = false; }\n  };\n\n  const formContent = (\n"
      },
      {
        "before": "          </AlertDescription>\n        </Alert>\n      )}\n      {dadosIniciais?.id && (\n        <div className=\"rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600\">\n          <span className=\"font-medium\">ID do cadastro (somente leitura): </span>\n          <code className=\"break-all select-text\">{dadosIniciais.id}</code>\n        </div>\n      )}\n      <div className=\"grid grid-cols-2 gap-4\">\n        <div>\n          <Label>Razao Social *</Label>\n",
        "after": "          </AlertDescription>\n        </Alert>\n      )}\n      <CadastroCodigoRegistroField value={dadosIniciais?.codigo} hasId={Boolean(dadosIniciais?.id)} entityId={dadosIniciais?.id} action=\"codigo-registro-empresa\" />\n      <div className=\"grid grid-cols-2 gap-4\">\n        <div>\n          <Label>Razao Social *</Label>\n"
      },
      {
        "before": "\n        <div>\n          <Label>Inscricao Estadual</Label>\n          <Input value={formData.inscricao_estadual} onChange={(e) => setFormData({ ...formData, inscricao_estadual: e.target.value })} disabled={!podeSalvar || saveBlocked} data-permission={permissaoFormulario} data-action=\"editar-inscricao-estadual-empresa\" data-sensitive />\n        </div>\n      </div>\n\n      <div>\n        <Label>Regime Tributario</Label>\n        <Select value={formData.regime_tributario} onValueChange={(v) => setFormData({ ...formData, regime_tributario: v })} disabled={!podeSalvar || saveBlocked}>\n          <SelectTrigger data-permission={permissaoFormulario} data-action=\"selecionar-regime-tributario-empresa\" data-sensitive>\n            <SelectValue />\n          </SelectTrigger>\n          <SelectContent>\n",
        "after": "\n        <div>\n          <Label>Inscricao Estadual</Label>\n          <Input value={formData.inscricao_estadual || ''} onChange={(e) => setFormData({ ...formData, inscricao_estadual: e.target.value })} disabled={!podeEditarFiscal || saveBlocked || !supportsIE} data-permission={fiscalPermission} data-action=\"editar-inscricao-estadual-empresa\" data-sensitive />\n        </div>\n      </div>\n\n      <div>\n        <Label>Regime Tributario</Label>\n        <Select value={formData.regime_tributario} onValueChange={(v) => setFormData({ ...formData, regime_tributario: v })} disabled={!podeEditarFiscal || saveBlocked || !supportsRegime}>\n          <SelectTrigger data-permission={fiscalPermission} data-action=\"selecionar-regime-tributario-empresa\" data-sensitive>\n            <SelectValue />\n          </SelectTrigger>\n          <SelectContent>\n"
      },
      {
        "before": "\n      <div className=\"p-4 bg-amber-50 rounded border border-amber-200\">\n        <h4 className=\"font-semibold mb-3\">Certificado Digital</h4>\n        {!podeEditarCertificado && (\n          <p className=\"text-xs text-amber-800 mb-3\">\n            Edicao de certificado exige permissao especifica. Alteracoes nesta secao estao bloqueadas.\n",
        "after": "\n      <div className=\"p-4 bg-amber-50 rounded border border-amber-200\">\n        <h4 className=\"font-semibold mb-3\">Certificado Digital</h4>\n        {isHttpBackendMode ? <>\n          <CertificadoA1Panel key={vault.panelKey} scope={vault.a1Scope} metadata={vault.certificate}\n            ready={vault.certificateQuery.isSuccess && !vault.certificateQuery.isFetching}\n            onUploaded={() => queryClient.invalidateQueries({ queryKey: vault.certificateQueryKey })} />\n          {!vault.scopeMatches && <p role=\"status\" className=\"text-xs text-amber-800\">Contexto da empresa indisponivel para o certificado.</p>}\n          {vault.scopeMatches && !vault.allowed && <p role=\"status\" className=\"text-xs text-amber-800\">Sem permissao para certificados.</p>}\n          {vault.scopeMatches && vault.allowed && vault.certificateQuery.isError && <p role=\"alert\" className=\"text-xs text-red-700\">Cofre A1 indisponivel. Nenhum envio confirmado.</p>}\n        </> : <>\n        {!podeEditarCertificado && (\n          <p className=\"text-xs text-amber-800 mb-3\">\n            Edicao de certificado exige permissao especifica. Alteracoes nesta secao estao bloqueadas.\n"
      },
      {
        "before": "            </AlertDescription>\n          </Alert>\n        )}\n      </div>\n\n      <div className=\"flex justify-end gap-3 pt-4 border-t\">\n",
        "after": "            </AlertDescription>\n          </Alert>\n        )}\n        </>}\n      </div>\n\n      <div className=\"flex justify-end gap-3 pt-4 border-t\">\n"
      }
    ]
  },
  "src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx": {
    "baseline": "41b81b733b08e16edd6d1a393ccbeb67e00670f8d8b77c597c882e64c8d85799",
    "hunks": [
      {
        "before": " */\nimport React, { useState, useEffect, useCallback, useMemo, useRef } from \"react\";\nimport { useQuery, useQueryClient } from \"@tanstack/react-query\";\nimport {\n",
        "after": " */\nimport React, { useState, useEffect, useCallback, useMemo, useRef } from \"react\";\nimport { buildOrganizacionalPatch } from '@/api/organizacionalHttp';\nimport { readErpHttpSession, HTTP_CONTEXT_CHANGED } from '@/api/erpHttpSession';\nimport { useQuery, useQueryClient } from \"@tanstack/react-query\";\nimport {\n"
      },
      {
        "before": "  const scopeKey = ENTITY + \":\" + (groupId || \"\") + \":\" + (empresaId || \"\");\n  const formScopeRef = useRef(scopeKey);\n  const activeScopeRef = useRef(scopeKey);\n  const previousScopeRef = useRef(scopeKey);\n",
        "after": "  const scopeKey = ENTITY + \":\" + (groupId || \"\") + \":\" + (empresaId || \"\");\n  const formScopeRef = useRef(scopeKey);\n  const organizacionalBusy = useRef(false);\n  const organizacionalEditor = useRef(null);\n  useEffect(() => {\n    const invalidate = () => {\n      if (!organizacionalEditor.current) return;\n      organizacionalEditor.current = null;\n      editRequestRef.current += 1;\n      setShowForm(false);\n      setEditItem(null);\n      setIsSaving(false);\n    };\n    window.addEventListener(HTTP_CONTEXT_CHANGED, invalidate);\n    return () => { window.removeEventListener(HTTP_CONTEXT_CHANGED, invalidate); invalidate(); };\n  }, []);\n  const activeScopeRef = useRef(scopeKey);\n  const previousScopeRef = useRef(scopeKey);\n"
      },
      {
        "before": "  // ── formulário ───────────────────────────────────────────────────────────────\n  const handleCloseForm = useCallback(function(wasSaved) {\n    editRequestRef.current += 1;\n    formScopeRef.current = null;\n",
        "after": "  // ── formulário ───────────────────────────────────────────────────────────────\n  const handleCloseForm = useCallback(function(wasSaved) {\n    organizacionalEditor.current = null;\n    editRequestRef.current += 1;\n    formScopeRef.current = null;\n"
      },
      {
        "before": "  }, [ENTITY, queryClient]);\n\n  const handlePersistSubmit = useCallback(async function(formData) {\n    if (!formData || !ENTITY) return;\n",
        "after": "  }, [ENTITY, queryClient]);\n\n  const organizacionalBinding = organizacionalEditor.current;\n  const handlePersistSubmit = useCallback(async function(formData) {\n    if (!formData || !ENTITY) return;\n"
      },
      {
        "before": "      throw error;\n    }\n    if (formData._action === \"delete\") {\n      if (!canDeleteCadastro) {\n",
        "after": "      throw error;\n    }\n    if (isHttpBackendMode && isTenantMasterEntity(ENTITY)) {\n      if (organizacionalBusy.current) return;\n      if (!editItem?.id || isLoadingEdit || editLoadBlocked || !canEditCadastro || formData._action) {\n        throw new Error('Edicao organizacional indisponivel para este registro/acao.');\n      }\n      const opened = readErpHttpSession();\n      if (!organizacionalBinding || organizacionalEditor.current !== organizacionalBinding\n          || organizacionalBinding.id !== editItem.id || !opened\n          || ['token', 'actorId', 'groupId', 'empresaId', 'scopeType'].some(k => opened[k] !== organizacionalBinding.session?.[k])) {\n        alert('Contexto alterado desde a abertura. Reabra o cadastro.');\n        throw new Error('Editor organizacional obsoleto.');\n      }\n      const generation = editRequestRef.current;\n      let changed = false;\n      const invalidate = () => { changed = true; };\n      const current = () => {\n        const active = readErpHttpSession();\n        return !changed && organizacionalEditor.current === organizacionalBinding && generation === editRequestRef.current && active && opened\n          && ['token', 'actorId', 'groupId', 'empresaId', 'scopeType'].every(k => active[k] === opened[k]);\n      };\n      if (!opened || opened.groupId !== groupId || (opened.empresaId || null) !== (empresaId || null)) throw new Error('Sessao/contexto alterado. Reabra o cadastro.');\n      organizacionalBusy.current = true;\n      window.addEventListener(HTTP_CONTEXT_CHANGED, invalidate);\n      setIsSaving(true);\n      try {\n        const payload = buildOrganizacionalPatch(ENTITY, editItem, formData);\n        if (!current()) throw new Error('Contexto alterado.');\n        await base44.entities[ENTITY].update(editItem.id, payload);\n        // Backend owns the transaction and audit. Never stamp a tenant-master company locally.\n        if (current()) { setIsSaving(false); handleCloseForm(true); }\n      } catch (error) {\n        if (current()) alert('Erro ao salvar: ' + error.message);\n        throw error;\n      } finally {\n        window.removeEventListener(HTTP_CONTEXT_CHANGED, invalidate);\n        organizacionalBusy.current = false;\n        if (current()) setIsSaving(false);\n      }\n      return;\n    }\n    if (formData._action === \"delete\") {\n      if (!canDeleteCadastro) {\n"
      },
      {
        "before": "      setIsSaving(false);\n    }\n  }, [ENTITY, editItem, empresaId, groupId, scopeKey, handleCloseForm, canCreateCadastro, canEditCadastro, canDeleteCadastro, createInContext, updateInContext, deleteInContext, auditCadastroEvent, isLoadingEdit, editLoadBlocked]);\n\n  const handleNewItem = useCallback(function() {\n",
        "after": "      setIsSaving(false);\n    }\n  }, [ENTITY, editItem, empresaId, groupId, scopeKey, handleCloseForm, canCreateCadastro, canEditCadastro, canDeleteCadastro, createInContext, updateInContext, deleteInContext, auditCadastroEvent, isLoadingEdit, editLoadBlocked, organizacionalBinding]);\n\n  const handleNewItem = useCallback(function() {\n"
      },
      {
        "before": "    formScopeRef.current = scopeKey;\n    const request = ++editRequestRef.current;\n    const requestedScope = scopeKey;\n    const stillCurrent = function() {\n",
        "after": "    formScopeRef.current = scopeKey;\n    const request = ++editRequestRef.current;\n    organizacionalEditor.current = isHttpBackendMode && isTenantMasterEntity(ENTITY)\n      ? Object.freeze({ id: item.id, session: Object.freeze({ ...readErpHttpSession() }) }) : null;\n    const requestedScope = scopeKey;\n    const stillCurrent = function() {\n"
      }
    ]
  },
  "tests/cursor-identidade-consolidacao.test.js": {
    "baseline": "cd057ca776052f3ebf282be3383b562ec1afb50440aa594ec08df2251b10d4bd",
    "hunks": [
      {
        "before": "import { perfilPolicyRemainder, perfilViewerRemainder } from './helpers/perfilGateRemainder.js';\nimport { scopeListCacheRemainder } from './helpers/scopeListCacheRemainder.js';\n\n// Coorte ID-only restante (golden e36231b3). Operador/Condicao/MoedaIndice/ContatoB2B\n",
        "after": "import { perfilPolicyRemainder, perfilViewerRemainder } from './helpers/perfilGateRemainder.js';\nimport { scopeListCacheRemainder } from './helpers/scopeListCacheRemainder.js';\nimport { organizacionalSourceForPath } from './helpers/organizacionalRemainder.js';\n\n// Coorte ID-only restante (golden e36231b3). Operador/Condicao/MoedaIndice/ContatoB2B\n"
      },
      {
        "before": "  ContatoB2B: 'contatoBoundId',\n};\nconst read = path => readFileSync(path, 'utf8').replace(/\\r\\n/g, '\\n');\nconst head = path => execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:${path}`], { encoding: 'utf8' }).replace(/\\r\\n/g, '\\n');\nconst tree = (path, source) => ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);\n",
        "after": "  ContatoB2B: 'contatoBoundId',\n};\nconst read = path => {\n  const source = readFileSync(path, 'utf8').replace(/\\r\\n/g, '\\n');\n  return organizacionalSourceForPath(path, source);\n};\nconst head = path => execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:${path}`], { encoding: 'utf8' }).replace(/\\r\\n/g, '\\n');\nconst tree = (path, source) => ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);\n"
      }
    ]
  },
  "tests/perfil-pedido-contract-reconciliation.test.js": {
    "baseline": "815c07900ca354437132fae6754486e7ae4ac5ad27b9c2743913dc4301aff278",
    "hunks": [
      {
        "before": "  const cadastroPerm = evaluate(vars.get('cadastroPerm').getText(ast), { ENTITY: 'PerfilAcesso', getCadastroEntityPermissionKey });\n  for (const action of ['criar', 'editar', 'excluir']) {\n    const events = [], env = { ENTITY: 'PerfilAcesso', formScopeRef: { current: 'scope' }, scopeKey: 'scope', activeScopeRef: { current: 'scope' },\n      assertCadastroFormScopeCurrent, canCreateCadastro: false, canEditCadastro: false, canDeleteCadastro: false,\n      editItem: action === 'editar' ? { id: 'synthetic-profile' } : null, cadastroPerm,\n",
        "after": "  const cadastroPerm = evaluate(vars.get('cadastroPerm').getText(ast), { ENTITY: 'PerfilAcesso', getCadastroEntityPermissionKey });\n  for (const action of ['criar', 'editar', 'excluir']) {\n    const events = [], env = { isHttpBackendMode: false, ENTITY: 'PerfilAcesso', formScopeRef: { current: 'scope' }, scopeKey: 'scope', activeScopeRef: { current: 'scope' },\n      assertCadastroFormScopeCurrent, canCreateCadastro: false, canEditCadastro: false, canDeleteCadastro: false,\n      editItem: action === 'editar' ? { id: 'synthetic-profile' } : null, cadastroPerm,\n"
      }
    ]
  },
  "tests/cliente-local-batch-preservation.test.js": {
    "baseline": "bc51aedcd15eede90329b6606b68a397f881757f7acb130a706229c74344fa45",
    "hunks": [
      {
        "before": "import assert from 'node:assert/strict';\nimport test from 'node:test';\n",
        "after": "import { organizacionalSourceForPath } from './helpers/organizacionalRemainder.js';\nconst readOrganizacionalSource = (file, ...args) => organizacionalSourceForPath(file, readFileSync(file, ...args));\nimport assert from 'node:assert/strict';\nimport test from 'node:test';\n"
      },
      {
        "before": "\ntest('address review PostgreSQL suite is wired to the required database and rejects skipped runs', () => {\n  const runner = readFileSync('server/scripts/runPostgresTests.mjs', 'utf8');\n  assert.match(runner, /\\['LEGACY_ADDRESS_REVIEW', 'tests\\/legacy-address-postgres\\.test\\.ts'\\]/);\n  assert.match(runner, /label === 'LEGACY_ADDRESS_REVIEW' \\? \\{ LEGACY_ADDRESS_PG_TEST_URL: process\\.env\\.DATABASE_URL \\}/);\n",
        "after": "\ntest('address review PostgreSQL suite is wired to the required database and rejects skipped runs', () => {\n  const runner = readOrganizacionalSource('server/scripts/runPostgresTests.mjs', 'utf8');\n  assert.match(runner, /\\['LEGACY_ADDRESS_REVIEW', 'tests\\/legacy-address-postgres\\.test\\.ts'\\]/);\n  assert.match(runner, /label === 'LEGACY_ADDRESS_REVIEW' \\? \\{ LEGACY_ADDRESS_PG_TEST_URL: process\\.env\\.DATABASE_URL \\}/);\n"
      },
      {
        "before": "test('local batch preserves entire prior router and historical guard comparisons', () => {\n  const file = 'server/src/api/router.ts';\n  const source = clienteLocalOperationalRemainder(file, readFileSync(file, 'utf8')).replace(/\\r\\n/g, '\\n');\n  const previous = execFileSync('git', ['show', `64f0dcf2:${file}`], { encoding: 'utf8' }).replace(/\\r\\n/g, '\\n');\n  assert.equal(clienteLocalBatchRemainder(file, source, true), previous);\n",
        "after": "test('local batch preserves entire prior router and historical guard comparisons', () => {\n  const file = 'server/src/api/router.ts';\n  const source = clienteLocalOperationalRemainder(file, readOrganizacionalSource(file, 'utf8')).replace(/\\r\\n/g, '\\n');\n  const previous = execFileSync('git', ['show', `64f0dcf2:${file}`], { encoding: 'utf8' }).replace(/\\r\\n/g, '\\n');\n  assert.equal(clienteLocalBatchRemainder(file, source, true), previous);\n"
      },
      {
        "before": "test('operational address wiring peels only exact additions and retains every ancestral byte', () => {\n  for (const file of ['server/src/api/router.ts', 'src/api/httpApiClient.js', 'src/components/cadastros/CadastroClienteCompleto.jsx']) {\n    const source = readFileSync(file, 'utf8').replace(/\\r\\n/g, '\\n');\n    const previous = execFileSync('git', ['show', `84f820d823e87499b0037b0ea2c75e508369afaf:${file}`], { encoding: 'utf8' }).replace(/\\r\\n/g, '\\n');\n    assert.equal(clienteLocalOperationalRemainder(file, source), previous);\n",
        "after": "test('operational address wiring peels only exact additions and retains every ancestral byte', () => {\n  for (const file of ['server/src/api/router.ts', 'src/api/httpApiClient.js', 'src/components/cadastros/CadastroClienteCompleto.jsx']) {\n    const source = readOrganizacionalSource(file, 'utf8').replace(/\\r\\n/g, '\\n');\n    const previous = execFileSync('git', ['show', `84f820d823e87499b0037b0ea2c75e508369afaf:${file}`], { encoding: 'utf8' }).replace(/\\r\\n/g, '\\n');\n    assert.equal(clienteLocalOperationalRemainder(file, source), previous);\n"
      }
    ]
  },
  "tests/cursor-callback-record-state.test.js": {
    "baseline": "e745dc7bdd022caeb9b444138870c1e6554822286610bc3b72633d797a4656d5",
    "hunks": [
      {
        "before": "import test from 'node:test';\nimport assert from 'node:assert/strict';\n",
        "after": "import { organizacionalSourceForPath } from './helpers/organizacionalRemainder.js';\nconst readOrganizacionalSource = (file, ...args) => organizacionalSourceForPath(file, fs.readFileSync(file, ...args));\nimport test from 'node:test';\nimport assert from 'node:assert/strict';\n"
      },
      {
        "before": "}\nconst path = 'src/components/cadastros/useCadastroRecordState.js';\nconst source = fs.readFileSync(path, 'utf8');\nconst ast = parse(path, source);\nconst fn = ast.statements.find(ts.isFunctionDeclaration);\n",
        "after": "}\nconst path = 'src/components/cadastros/useCadastroRecordState.js';\nconst source = readOrganizacionalSource(path, 'utf8');\nconst ast = parse(path, source);\nconst fn = ast.statements.find(ts.isFunctionDeclaration);\n"
      },
      {
        "before": "  const file = `src/components/cadastros/${name}Form.jsx`;\n  // #353: CodigoField autorizado em RotaPadrao/TabelaPreco — remainder restaura pin e36231b3.\n  const after = parse(file, cadastroCodigoRegistroRemainder(file, fs.readFileSync(file, 'utf8')));\n  const before = parse(file, execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:${file}`], { encoding: 'utf8' }));\n  const declarations = tree => find(tree, node => ts.isVariableDeclaration(node)\n",
        "after": "  const file = `src/components/cadastros/${name}Form.jsx`;\n  // #353: CodigoField autorizado em RotaPadrao/TabelaPreco — remainder restaura pin e36231b3.\n  const after = parse(file, cadastroCodigoRegistroRemainder(file, readOrganizacionalSource(file, 'utf8')));\n  const before = parse(file, execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:${file}`], { encoding: 'utf8' }));\n  const declarations = tree => find(tree, node => ts.isVariableDeclaration(node)\n"
      },
      {
        "before": "test('ContatoB2B graduou do pin RecordState para useCadastroReopenOnIdentity com contatoBoundId', () => {\n  const file = 'src/components/cadastros/ContatoB2BForm.jsx';\n  const source = fs.readFileSync(file, 'utf8');\n  assert.equal(names.includes('ContatoB2B'), false);\n  assert.match(source, /useCadastroReopenOnIdentity/);\n",
        "after": "test('ContatoB2B graduou do pin RecordState para useCadastroReopenOnIdentity com contatoBoundId', () => {\n  const file = 'src/components/cadastros/ContatoB2BForm.jsx';\n  const source = readOrganizacionalSource(file, 'utf8');\n  assert.equal(names.includes('ContatoB2B'), false);\n  assert.match(source, /useCadastroReopenOnIdentity/);\n"
      },
      {
        "before": "test('Servico graduou do pin RecordState para useCadastroReopenOnIdentity com servicoBoundId', () => {\n  const file = 'src/components/cadastros/ServicoForm.jsx';\n  const source = fs.readFileSync(file, 'utf8');\n  assert.equal(names.includes('Servico'), false);\n  assert.match(source, /useCadastroReopenOnIdentity/);\n",
        "after": "test('Servico graduou do pin RecordState para useCadastroReopenOnIdentity com servicoBoundId', () => {\n  const file = 'src/components/cadastros/ServicoForm.jsx';\n  const source = readOrganizacionalSource(file, 'utf8');\n  assert.equal(names.includes('Servico'), false);\n  assert.match(source, /useCadastroReopenOnIdentity/);\n"
      },
      {
        "before": "test('TipoFrete graduou do pin RecordState para useCadastroReopenOnIdentity com tipoFreteBoundId', () => {\n  const file = 'src/components/cadastros/TipoFreteForm.jsx';\n  const source = fs.readFileSync(file, 'utf8');\n  assert.equal(names.includes('TipoFrete'), false);\n  assert.match(source, /useCadastroReopenOnIdentity/);\n",
        "after": "test('TipoFrete graduou do pin RecordState para useCadastroReopenOnIdentity com tipoFreteBoundId', () => {\n  const file = 'src/components/cadastros/TipoFreteForm.jsx';\n  const source = readOrganizacionalSource(file, 'utf8');\n  assert.equal(names.includes('TipoFrete'), false);\n  assert.match(source, /useCadastroReopenOnIdentity/);\n"
      },
      {
        "before": "test('SegmentoCliente graduou do pin RecordState para useCadastroReopenOnIdentity com segmentoBoundId', () => {\n  const file = 'src/components/cadastros/SegmentoClienteForm.jsx';\n  const source = fs.readFileSync(file, 'utf8');\n  assert.equal(names.includes('SegmentoCliente'), false);\n  assert.match(source, /useCadastroReopenOnIdentity/);\n",
        "after": "test('SegmentoCliente graduou do pin RecordState para useCadastroReopenOnIdentity com segmentoBoundId', () => {\n  const file = 'src/components/cadastros/SegmentoClienteForm.jsx';\n  const source = readOrganizacionalSource(file, 'utf8');\n  assert.equal(names.includes('SegmentoCliente'), false);\n  assert.match(source, /useCadastroReopenOnIdentity/);\n"
      },
      {
        "before": "test('KitProduto graduou do pin RecordState para useCadastroReopenOnIdentity com kitBoundId', () => {\n  const file = 'src/components/cadastros/KitProdutoForm.jsx';\n  const source = fs.readFileSync(file, 'utf8');\n  assert.equal(names.includes('KitProduto'), false);\n  assert.match(source, /useCadastroReopenOnIdentity/);\n",
        "after": "test('KitProduto graduou do pin RecordState para useCadastroReopenOnIdentity com kitBoundId', () => {\n  const file = 'src/components/cadastros/KitProdutoForm.jsx';\n  const source = readOrganizacionalSource(file, 'utf8');\n  assert.equal(names.includes('KitProduto'), false);\n  assert.match(source, /useCadastroReopenOnIdentity/);\n"
      },
      {
        "before": "test('Filial graduou do pin RecordState para useCadastroReopenOnIdentity com filialBoundId', () => {\n  const file = 'src/components/cadastros/FilialForm.jsx';\n  const source = fs.readFileSync(file, 'utf8');\n  assert.equal(names.includes('Filial'), false);\n  assert.match(source, /useCadastroReopenOnIdentity/);\n",
        "after": "test('Filial graduou do pin RecordState para useCadastroReopenOnIdentity com filialBoundId', () => {\n  const file = 'src/components/cadastros/FilialForm.jsx';\n  const source = readOrganizacionalSource(file, 'utf8');\n  assert.equal(names.includes('Filial'), false);\n  assert.match(source, /useCadastroReopenOnIdentity/);\n"
      },
      {
        "before": "test('CentroResultado graduou do pin RecordState para useCadastroReopenOnIdentity com centroBoundId', () => {\n  const file = 'src/components/cadastros/CentroResultadoForm.jsx';\n  const source = fs.readFileSync(file, 'utf8');\n  assert.equal(names.includes('CentroResultado'), false);\n  assert.match(source, /useCadastroReopenOnIdentity/);\n",
        "after": "test('CentroResultado graduou do pin RecordState para useCadastroReopenOnIdentity com centroBoundId', () => {\n  const file = 'src/components/cadastros/CentroResultadoForm.jsx';\n  const source = readOrganizacionalSource(file, 'utf8');\n  assert.equal(names.includes('CentroResultado'), false);\n  assert.match(source, /useCadastroReopenOnIdentity/);\n"
      },
      {
        "before": "test('JobAgendado graduou do pin RecordState para useCadastroReopenOnIdentity com jobBoundId', () => {\n  const file = 'src/components/cadastros/JobAgendadoForm.jsx';\n  const source = fs.readFileSync(file, 'utf8');\n  assert.equal(names.includes('JobAgendado'), false);\n  assert.match(source, /useCadastroReopenOnIdentity/);\n",
        "after": "test('JobAgendado graduou do pin RecordState para useCadastroReopenOnIdentity com jobBoundId', () => {\n  const file = 'src/components/cadastros/JobAgendadoForm.jsx';\n  const source = readOrganizacionalSource(file, 'utf8');\n  assert.equal(names.includes('JobAgendado'), false);\n  assert.match(source, /useCadastroReopenOnIdentity/);\n"
      },
      {
        "before": "test('RotaPadrao graduou do pin RecordState para useCadastroReopenOnIdentity com rotaBoundId', () => {\n  const file = 'src/components/cadastros/RotaPadraoForm.jsx';\n  const source = fs.readFileSync(file, 'utf8');\n  assert.equal(names.includes('RotaPadrao'), false);\n  assert.match(source, /useCadastroReopenOnIdentity/);\n",
        "after": "test('RotaPadrao graduou do pin RecordState para useCadastroReopenOnIdentity com rotaBoundId', () => {\n  const file = 'src/components/cadastros/RotaPadraoForm.jsx';\n  const source = readOrganizacionalSource(file, 'utf8');\n  assert.equal(names.includes('RotaPadrao'), false);\n  assert.match(source, /useCadastroReopenOnIdentity/);\n"
      },
      {
        "before": "test('CatalogoWeb graduou do pin RecordState para useCadastroReopenOnIdentity com catalogoBoundId', () => {\n  const file = 'src/components/cadastros/CatalogoWebForm.jsx';\n  const source = fs.readFileSync(file, 'utf8');\n  assert.equal(names.includes('CatalogoWeb'), false);\n  assert.match(source, /useCadastroReopenOnIdentity/);\n",
        "after": "test('CatalogoWeb graduou do pin RecordState para useCadastroReopenOnIdentity com catalogoBoundId', () => {\n  const file = 'src/components/cadastros/CatalogoWebForm.jsx';\n  const source = readOrganizacionalSource(file, 'utf8');\n  assert.equal(names.includes('CatalogoWeb'), false);\n  assert.match(source, /useCadastroReopenOnIdentity/);\n"
      },
      {
        "before": "test('Produto keeps the complete initializer and HTTP GET contract; props version cannot overwrite a loaded HTTP draft', () => {\n  const file = 'src/components/cadastros/ProdutoFormV22_Completo.jsx';\n  const after = parse(file, fs.readFileSync(file, 'utf8'));\n  const before = parse(file, execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:${file}`], { encoding: 'utf8' }));\n  const declaration = (tree, name) => find(tree, node => ts.isVariableDeclaration(node) && node.name.getText(tree) === name)[0];\n",
        "after": "test('Produto keeps the complete initializer and HTTP GET contract; props version cannot overwrite a loaded HTTP draft', () => {\n  const file = 'src/components/cadastros/ProdutoFormV22_Completo.jsx';\n  const after = parse(file, readOrganizacionalSource(file, 'utf8'));\n  const before = parse(file, execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:${file}`], { encoding: 'utf8' }));\n  const declaration = (tree, name) => find(tree, node => ts.isVariableDeclaration(node) && node.name.getText(tree) === name)[0];\n"
      },
      {
        "before": "test('Colaborador retains legacy-code permission and all save/status/delete handlers', () => {\n  const file = 'src/components/rh/ColaboradorForm.jsx';\n  const after = parse(file, fs.readFileSync(file, 'utf8'));\n  const before = parse(file, execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:${file}`], { encoding: 'utf8' }));\n  const contracts = tree => find(tree, node => ts.isVariableDeclaration(node) && /^(handle|podeEditarCodigoLegado)/.test(node.name.getText(tree))).map(node => node.getText(tree));\n",
        "after": "test('Colaborador retains legacy-code permission and all save/status/delete handlers', () => {\n  const file = 'src/components/rh/ColaboradorForm.jsx';\n  const after = parse(file, readOrganizacionalSource(file, 'utf8'));\n  const before = parse(file, execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:${file}`], { encoding: 'utf8' }));\n  const contracts = tree => find(tree, node => ts.isVariableDeclaration(node) && /^(handle|podeEditarCodigoLegado)/.test(node.name.getText(tree))).map(node => node.getText(tree));\n"
      },
      {
        "before": "  test(`${file}: retained payload owner, validators, complete initializer and permissions`, () => {\n    const path = 'src/components/' + file;\n    const after = parse(path, iaResponseValidationRemainder(path, fs.readFileSync(path, 'utf8')));\n    const before = parse(path, execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:${path}`], { encoding: 'utf8' }));\n    const contract = tree => find(tree, node => ts.isVariableDeclaration(node)\n",
        "after": "  test(`${file}: retained payload owner, validators, complete initializer and permissions`, () => {\n    const path = 'src/components/' + file;\n    const after = parse(path, iaResponseValidationRemainder(path, readOrganizacionalSource(path, 'utf8')));\n    const before = parse(path, execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:${path}`], { encoding: 'utf8' }));\n    const contract = tree => find(tree, node => ts.isVariableDeclaration(node)\n"
      },
      {
        "before": "test('Cliente RHF actual reset effect changes records, clears transient validation and preserves same-identity edits', () => {\n  const path = 'src/components/comercial/ClienteForm.jsx';\n  const tree = parse(path, fs.readFileSync(path, 'utf8'));\n  const effect = find(tree, node => ts.isCallExpression(node) && node.expression.getText(tree) === 'useEffect'\n    && node.arguments[0].getText(tree).includes('hydratedIdentity'))[0];\n",
        "after": "test('Cliente RHF actual reset effect changes records, clears transient validation and preserves same-identity edits', () => {\n  const path = 'src/components/comercial/ClienteForm.jsx';\n  const tree = parse(path, readOrganizacionalSource(path, 'utf8'));\n  const effect = find(tree, node => ts.isCallExpression(node) && node.expression.getText(tree) === 'useEffect'\n    && node.arguments[0].getText(tree).includes('hydratedIdentity'))[0];\n"
      },
      {
        "before": "test('TabelaPreco complete resets item draft by ID/scope without changing its persistence owner', () => {\n  const path = 'src/components/cadastros/TabelaPrecoFormCompleto.jsx';\n  const tree = parse(path, fs.readFileSync(path, 'utf8'));\n  const state = find(tree, node => ts.isVariableDeclaration(node) && node.name.getText(tree) === '[itensTabela, setItensTabela]')[0];\n  assert.equal(state.initializer.expression.getText(tree), 'useCadastroRecordState');\n",
        "after": "test('TabelaPreco complete resets item draft by ID/scope without changing its persistence owner', () => {\n  const path = 'src/components/cadastros/TabelaPrecoFormCompleto.jsx';\n  const tree = parse(path, readOrganizacionalSource(path, 'utf8'));\n  const state = find(tree, node => ts.isVariableDeclaration(node) && node.name.getText(tree) === '[itensTabela, setItensTabela]')[0];\n  assert.equal(state.initializer.expression.getText(tree), 'useCadastroRecordState');\n"
      },
      {
        "before": "  for (const name of ['ClienteForm', 'ClienteFormCompleto']) {\n    const path = `src/components/comercial/${name}.jsx`;\n    const tree = parse(path, fs.readFileSync(path, 'utf8'));\n    const declaration = find(tree, node => ts.isVariableDeclaration(node) && node.name.getText(tree) === 'cliente')[0];\n    const names = ['clienteProp', 'item', 'data', 'initialData', name === 'ClienteForm' ? 'defaultValuesProp' : 'defaultValues'];\n",
        "after": "  for (const name of ['ClienteForm', 'ClienteFormCompleto']) {\n    const path = `src/components/comercial/${name}.jsx`;\n    const tree = parse(path, readOrganizacionalSource(path, 'utf8'));\n    const declaration = find(tree, node => ts.isVariableDeclaration(node) && node.name.getText(tree) === 'cliente')[0];\n    const names = ['clienteProp', 'item', 'data', 'initialData', name === 'ClienteForm' ? 'defaultValuesProp' : 'defaultValues'];\n"
      },
      {
        "before": "test('Empresa reopen without validity metadata clears the previous expiry warning without a certificate fixture', () => {\n  const path = 'src/components/cadastros/EmpresaForm.jsx';\n  const tree = parse(path, fs.readFileSync(path, 'utf8'));\n  const effect = find(tree, node => ts.isCallExpression(node) && node.expression.getText(tree) === 'useEffect'\n    && node.arguments[0].getText(tree).includes('setAlertaCertificado'))[0];\n",
        "after": "test('Empresa reopen without validity metadata clears the previous expiry warning without a certificate fixture', () => {\n  const path = 'src/components/cadastros/EmpresaForm.jsx';\n  const tree = parse(path, readOrganizacionalSource(path, 'utf8'));\n  const effect = find(tree, node => ts.isCallExpression(node) && node.expression.getText(tree) === 'useEffect'\n    && node.arguments[0].getText(tree).includes('setAlertaCertificado'))[0];\n"
      }
    ]
  },
  "tests/date-arithmetic-contracts.test.js": {
    "baseline": "0fb38c71c7a859390ebd84ea930db1856b46d18c95c2653bc9cfdbb1ee5af435",
    "hunks": [
      {
        "before": "import { portalReadRemainder } from './helpers/portalReadRemainder.js';\nimport {runtimeProofSource} from './helpers/runtimeProofSource.js';\n",
        "after": "import { organizacionalSourceForPath } from './helpers/organizacionalRemainder.js';\nconst readOrganizacionalSource = (file, ...args) => organizacionalSourceForPath(file, fs.readFileSync(file, ...args));\nimport { portalReadRemainder } from './helpers/portalReadRemainder.js';\nimport {runtimeProofSource} from './helpers/runtimeProofSource.js';\n"
      },
      {
        "before": "import {componentContractRemainder} from './helpers/componentContractRemainder.js';\n\nconst fixtures=JSON.parse(fs.readFileSync('tests/fixtures/date-arithmetic-stage21.json','utf8'));\ntest('date arithmetic cohort is fixed at 28 modules and 79 proven native Date operands',()=>{\n  assert.equal(fixtures.length,28);\n",
        "after": "import {componentContractRemainder} from './helpers/componentContractRemainder.js';\n\nconst fixtures=JSON.parse(readOrganizacionalSource('tests/fixtures/date-arithmetic-stage21.json','utf8'));\ntest('date arithmetic cohort is fixed at 28 modules and 79 proven native Date operands',()=>{\n  assert.equal(fixtures.length,28);\n"
      },
      {
        "before": "});\nfor(const fixture of fixtures) test(`${fixture.file}: exact timestamp edits preserve all remaining executable code`,()=>{\n  let source=queryKeyMigrationRemainder(fixture.file,primitiveUiBoundaryRemainder(fixture.file,iaResponseValidationRemainder(fixture.file,readBoundaryRemainder(fixture.file,componentContractRemainder(fixture.file,portalReadRemainder(fixture.file,runtimeProofSource(fixture.file)))))));\n  source=metricReportRemainder(fixture.file,boletoSourceRemainder(fixture.file,source));\n  if(fixture.file==='src/components/rh/PontoTab.jsx')source=partialInputRemainder(fixture.file,source);\n",
        "after": "});\nfor(const fixture of fixtures) test(`${fixture.file}: exact timestamp edits preserve all remaining executable code`,()=>{\n  let source=queryKeyMigrationRemainder(fixture.file,primitiveUiBoundaryRemainder(fixture.file,iaResponseValidationRemainder(fixture.file,readBoundaryRemainder(fixture.file,componentContractRemainder(fixture.file,portalReadRemainder(fixture.file,organizacionalSourceForPath(fixture.file,runtimeProofSource(fixture.file))))))));\n  source=metricReportRemainder(fixture.file,boletoSourceRemainder(fixture.file,source));\n  if(fixture.file==='src/components/rh/PontoTab.jsx')source=partialInputRemainder(fixture.file,source);\n"
      }
    ]
  },
  "tests/fornecedor-http-preservation.test.js": {
    "baseline": "a9e09883d2fe5c4f081503c5363484971877f42f91904e352f9a8e7d031de293",
    "hunks": [
      {
        "before": "import test from 'node:test';\nimport assert from 'node:assert/strict';\n",
        "after": "import { organizacionalSourceForPath } from './helpers/organizacionalRemainder.js';\nconst readOrganizacionalSource = (file, ...args) => organizacionalSourceForPath(file, fs.readFileSync(file, ...args));\nimport test from 'node:test';\nimport assert from 'node:assert/strict';\n"
      },
      {
        "before": "for (const file of ['server/src/app.ts', 'server/src/api/router.ts']) {\n  test(`supplier wiring preserves entire prior ${file} and rejects outside edits`, () => {\n    const source = fs.readFileSync(file, 'utf8');\n    // Baseline composição #401 tip — adapter portado sem reescrever o restante.\n    const previous = execFileSync('git', ['show', `5d9a7e37c:${file}`], { encoding: 'utf8' });\n",
        "after": "for (const file of ['server/src/app.ts', 'server/src/api/router.ts']) {\n  test(`supplier wiring preserves entire prior ${file} and rejects outside edits`, () => {\n    const source = readOrganizacionalSource(file, 'utf8');\n    // Baseline composição #401 tip — adapter portado sem reescrever o restante.\n    const previous = execFileSync('git', ['show', `5d9a7e37c:${file}`], { encoding: 'utf8' });\n"
      },
      {
        "before": "test('legacy test retains whole-source equality and zero migration delta', () => {\n  const file = 'tests/legado-importador-consolidacao.test.js';\n  const source = fs.readFileSync(file, 'utf8');\n  const previous = execFileSync('git', ['show', `5d9a7e37c:${file}`], { encoding: 'utf8' });\n  assert.equal(fornecedorHttpRemainder(file, source).replace(/\\r\\n/g, '\\n'), previous.replace(/\\r\\n/g, '\\n'));\n",
        "after": "test('legacy test retains whole-source equality and zero migration delta', () => {\n  const file = 'tests/legado-importador-consolidacao.test.js';\n  const source = readOrganizacionalSource(file, 'utf8');\n  const previous = execFileSync('git', ['show', `5d9a7e37c:${file}`], { encoding: 'utf8' });\n  assert.equal(fornecedorHttpRemainder(file, source).replace(/\\r\\n/g, '\\n'), previous.replace(/\\r\\n/g, '\\n'));\n"
      }
    ]
  },
  "tests/setor-rbac-preservation.test.js": {
    "baseline": "9e9c0191a50216f5d09249490ad6429bb1b48697461b9407e8765391261726e5",
    "hunks": [
      {
        "before": "import test from 'node:test';\nimport assert from 'node:assert/strict';\n",
        "after": "import { organizacionalSourceForPath } from './helpers/organizacionalRemainder.js';\nconst readOrganizacionalSource = (file, ...args) => organizacionalSourceForPath(file, fs.readFileSync(file, ...args));\nimport test from 'node:test';\nimport assert from 'node:assert/strict';\n"
      },
      {
        "before": "\nconst file = 'server/src/app.ts';\nconst source = fs.readFileSync(file, 'utf8').replace(/\\r\\n/g, '\\n');\nconst wiring = \"    authorization: { guard: rbacGuard, moduleName: 'Cadastros', section: 'setor_atividade' },\\n\";\ntest('Setor wiring preserves the complete published app, including supplier wiring', () => {\n",
        "after": "\nconst file = 'server/src/app.ts';\nconst source = readOrganizacionalSource(file, 'utf8').replace(/\\r\\n/g, '\\n');\nconst wiring = \"    authorization: { guard: rbacGuard, moduleName: 'Cadastros', section: 'setor_atividade' },\\n\";\ntest('Setor wiring preserves the complete published app, including supplier wiring', () => {\n"
      }
    ]
  },
  "tests/cadastro-query-payload-boundaries.test.js": {
    "baseline": "893c634f31fca9b887508ae05a3bc99961544c89e4dc0969f5a253c65931b9bd",
    "hunks": [
      {
        "before": "test('Cliente contatos/locais: remainder rejeita omissao repeticao e efeito colateral nos hunks', () => {\n  const source = read('src/components/cadastros/CadastroClienteCompleto.jsx');\n",
        "after": "import { organizacionalSourceForPath } from './helpers/organizacionalRemainder.js';\nconst readOrganizacionalSource = (file, ...args) => organizacionalSourceForPath(file, fs.readFileSync(file, ...args));\ntest('Cliente contatos/locais: remainder rejeita omissao repeticao e efeito colateral nos hunks', () => {\n  const source = read('src/components/cadastros/CadastroClienteCompleto.jsx');\n"
      },
      {
        "before": "});\n\nconst read = path => fs.readFileSync(path, 'utf8').replace(/\\r\\n/g, '\\n');\nconst parse = (path, source = read(path)) => ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);\nfunction nodes(tree, predicate) {\n",
        "after": "});\n\nconst read = path => readOrganizacionalSource(path, 'utf8').replace(/\\r\\n/g, '\\n');\nconst parse = (path, source = read(path)) => ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);\nfunction nodes(tree, predicate) {\n"
      }
    ]
  },
  "tests/publication-baseline-contracts.test.js": {
    "baseline": "e3e364fcc87c04cdd0a5c2f309fd889e209d4183c304386afed6026b983a23c5",
    "hunks": [
      {
        "before": "import { clienteConferenciaRemainder } from './helpers/consolidation81Remainder.js';\nimport {\n",
        "after": "import { organizacionalSourceForPath } from './helpers/organizacionalRemainder.js';\nconst readOrganizacionalSource = (file, ...args) => organizacionalSourceForPath(file, fs.readFileSync(file, ...args));\nimport { clienteConferenciaRemainder } from './helpers/consolidation81Remainder.js';\nimport {\n"
      },
      {
        "before": "import {execFileSync} from 'node:child_process';\n\nconst manifest=JSON.parse(fs.readFileSync(new URL('./helpers/publicationBaselineManifest.json',import.meta.url),'utf8'));\nconst base=PUBLICATION_BASE;\ntest('publication baseline is the verified composition commit and is available in Git history',()=>{\n",
        "after": "import {execFileSync} from 'node:child_process';\n\nconst manifest=JSON.parse(readOrganizacionalSource(new URL('./helpers/publicationBaselineManifest.json',import.meta.url),'utf8'));\nconst base=PUBLICATION_BASE;\ntest('publication baseline is the verified composition commit and is available in Git history',()=>{\n"
      },
      {
        "before": "}\ntest('bulk lifecycle evolution retains the original hash and rejects changed or repeated delegation assertions',()=>{\n const source=fs.readFileSync('server/tests/bulk-consolidacao.test.ts','utf8').replace(/\\r\\n/g,'\\n');\n const restored=restoreApprovedBulkDelta(source);\n assert.equal(restored.includes(approvedBulkDelta),false);\n",
        "after": "}\ntest('bulk lifecycle evolution retains the original hash and rejects changed or repeated delegation assertions',()=>{\n const source=readOrganizacionalSource('server/tests/bulk-consolidacao.test.ts','utf8').replace(/\\r\\n/g,'\\n');\n const restored=restoreApprovedBulkDelta(source);\n assert.equal(restored.includes(approvedBulkDelta),false);\n"
      },
      {
        "before": "});\ntest('ContatoB2B callback graduation retains beforeSha and rejects omission, repetition or out-of-scope edit',()=>{\n const source=fs.readFileSync('tests/cursor-callback-record-state.test.js','utf8').replace(/\\r\\n/g,'\\n');\n const afterCat=restoreApprovedCatalogoWebCallbackDelta(source);\n const afterRota=restoreApprovedRotaPadraoCallbackDelta(afterCat);\n",
        "after": "});\ntest('ContatoB2B callback graduation retains beforeSha and rejects omission, repetition or out-of-scope edit',()=>{\n const source=readOrganizacionalSource('tests/cursor-callback-record-state.test.js','utf8').replace(/\\r\\n/g,'\\n');\n const afterCat=restoreApprovedCatalogoWebCallbackDelta(source);\n const afterRota=restoreApprovedRotaPadraoCallbackDelta(afterCat);\n"
      },
      {
        "before": "});\ntest('Servico/TipoFrete callback graduation rejects omission, repetition or out-of-scope edit',()=>{\n const source=fs.readFileSync('tests/cursor-callback-record-state.test.js','utf8').replace(/\\r\\n/g,'\\n');\n const afterCat=restoreApprovedCatalogoWebCallbackDelta(source);\n const afterRota=restoreApprovedRotaPadraoCallbackDelta(afterCat);\n",
        "after": "});\ntest('Servico/TipoFrete callback graduation rejects omission, repetition or out-of-scope edit',()=>{\n const source=readOrganizacionalSource('tests/cursor-callback-record-state.test.js','utf8').replace(/\\r\\n/g,'\\n');\n const afterCat=restoreApprovedCatalogoWebCallbackDelta(source);\n const afterRota=restoreApprovedRotaPadraoCallbackDelta(afterCat);\n"
      },
      {
        "before": "});\ntest('SegmentoCliente callback graduation rejects omission, repetition or out-of-scope edit',()=>{\n const source=fs.readFileSync('tests/cursor-callback-record-state.test.js','utf8').replace(/\\r\\n/g,'\\n');\n const afterCat=restoreApprovedCatalogoWebCallbackDelta(source);\n const afterRota=restoreApprovedRotaPadraoCallbackDelta(afterCat);\n",
        "after": "});\ntest('SegmentoCliente callback graduation rejects omission, repetition or out-of-scope edit',()=>{\n const source=readOrganizacionalSource('tests/cursor-callback-record-state.test.js','utf8').replace(/\\r\\n/g,'\\n');\n const afterCat=restoreApprovedCatalogoWebCallbackDelta(source);\n const afterRota=restoreApprovedRotaPadraoCallbackDelta(afterCat);\n"
      },
      {
        "before": "});\ntest('KitProduto callback graduation rejects omission, repetition or out-of-scope edit',()=>{\n const source=fs.readFileSync('tests/cursor-callback-record-state.test.js','utf8').replace(/\\r\\n/g,'\\n');\n const afterCat=restoreApprovedCatalogoWebCallbackDelta(source);\n const afterRota=restoreApprovedRotaPadraoCallbackDelta(afterCat);\n",
        "after": "});\ntest('KitProduto callback graduation rejects omission, repetition or out-of-scope edit',()=>{\n const source=readOrganizacionalSource('tests/cursor-callback-record-state.test.js','utf8').replace(/\\r\\n/g,'\\n');\n const afterCat=restoreApprovedCatalogoWebCallbackDelta(source);\n const afterRota=restoreApprovedRotaPadraoCallbackDelta(afterCat);\n"
      },
      {
        "before": "});\ntest('Filial callback graduation rejects omission, repetition or out-of-scope edit',()=>{\n const source=fs.readFileSync('tests/cursor-callback-record-state.test.js','utf8').replace(/\\r\\n/g,'\\n');\n const afterCat=restoreApprovedCatalogoWebCallbackDelta(source);\n const afterRota=restoreApprovedRotaPadraoCallbackDelta(afterCat);\n",
        "after": "});\ntest('Filial callback graduation rejects omission, repetition or out-of-scope edit',()=>{\n const source=readOrganizacionalSource('tests/cursor-callback-record-state.test.js','utf8').replace(/\\r\\n/g,'\\n');\n const afterCat=restoreApprovedCatalogoWebCallbackDelta(source);\n const afterRota=restoreApprovedRotaPadraoCallbackDelta(afterCat);\n"
      },
      {
        "before": "});\ntest('CentroResultado callback graduation rejects omission, repetition or out-of-scope edit',()=>{\n const source=fs.readFileSync('tests/cursor-callback-record-state.test.js','utf8').replace(/\\r\\n/g,'\\n');\n const afterCat=restoreApprovedCatalogoWebCallbackDelta(source);\n const afterRota=restoreApprovedRotaPadraoCallbackDelta(afterCat);\n",
        "after": "});\ntest('CentroResultado callback graduation rejects omission, repetition or out-of-scope edit',()=>{\n const source=readOrganizacionalSource('tests/cursor-callback-record-state.test.js','utf8').replace(/\\r\\n/g,'\\n');\n const afterCat=restoreApprovedCatalogoWebCallbackDelta(source);\n const afterRota=restoreApprovedRotaPadraoCallbackDelta(afterCat);\n"
      },
      {
        "before": "});\ntest('JobAgendado callback graduation rejects omission, repetition or out-of-scope edit',()=>{\n const source=fs.readFileSync('tests/cursor-callback-record-state.test.js','utf8').replace(/\\r\\n/g,'\\n');\n const afterCat=restoreApprovedCatalogoWebCallbackDelta(source);\n const afterRota=restoreApprovedRotaPadraoCallbackDelta(afterCat);\n",
        "after": "});\ntest('JobAgendado callback graduation rejects omission, repetition or out-of-scope edit',()=>{\n const source=readOrganizacionalSource('tests/cursor-callback-record-state.test.js','utf8').replace(/\\r\\n/g,'\\n');\n const afterCat=restoreApprovedCatalogoWebCallbackDelta(source);\n const afterRota=restoreApprovedRotaPadraoCallbackDelta(afterCat);\n"
      },
      {
        "before": "});\ntest('RotaPadrao callback graduation rejects omission, repetition or out-of-scope edit',()=>{\n const source=fs.readFileSync('tests/cursor-callback-record-state.test.js','utf8').replace(/\\r\\n/g,'\\n');\n const afterCat=restoreApprovedCatalogoWebCallbackDelta(source);\n const restored=restoreApprovedRotaPadraoCallbackDelta(afterCat);\n",
        "after": "});\ntest('RotaPadrao callback graduation rejects omission, repetition or out-of-scope edit',()=>{\n const source=readOrganizacionalSource('tests/cursor-callback-record-state.test.js','utf8').replace(/\\r\\n/g,'\\n');\n const afterCat=restoreApprovedCatalogoWebCallbackDelta(source);\n const restored=restoreApprovedRotaPadraoCallbackDelta(afterCat);\n"
      },
      {
        "before": "});\ntest('CatalogoWeb callback graduation rejects omission, repetition or out-of-scope edit',()=>{\n const source=fs.readFileSync('tests/cursor-callback-record-state.test.js','utf8').replace(/\\r\\n/g,'\\n');\n const restored=restoreApprovedCatalogoWebCallbackDelta(source);\n assert.equal(restored.includes(approvedCatalogoWebGraduationTest),false);\n",
        "after": "});\ntest('CatalogoWeb callback graduation rejects omission, repetition or out-of-scope edit',()=>{\n const source=readOrganizacionalSource('tests/cursor-callback-record-state.test.js','utf8').replace(/\\r\\n/g,'\\n');\n const restored=restoreApprovedCatalogoWebCallbackDelta(source);\n assert.equal(restored.includes(approvedCatalogoWebGraduationTest),false);\n"
      },
      {
        "before": "}\ntest('LocalEstoque residual graduation retains beforeSha and rejects omission, repetition or out-of-scope edit',()=>{\n const source=fs.readFileSync('tests/cursor-residual-independent.test.js','utf8').replace(/\\r\\n/g,'\\n');\n const restored=restoreApprovedLocalEstoqueResidualDelta(source);\n assert.equal(restored.includes(approvedLocalEstoqueGraduationTest),false);\n",
        "after": "}\ntest('LocalEstoque residual graduation retains beforeSha and rejects omission, repetition or out-of-scope edit',()=>{\n const source=readOrganizacionalSource('tests/cursor-residual-independent.test.js','utf8').replace(/\\r\\n/g,'\\n');\n const restored=restoreApprovedLocalEstoqueResidualDelta(source);\n assert.equal(restored.includes(approvedLocalEstoqueGraduationTest),false);\n"
      },
      {
        "before": "});\nfor(const entry of manifest.cases)test(entry.path+': publication fixes only Git reference, preserving every prior assertion',()=>{\n const source=fs.readFileSync(entry.path,'utf8').replace(/\\r\\n/g,'\\n');\n assert.equal(source.includes('HEAD:'),false);\n assert.equal(source.includes(\"'HEAD'\"),false);\n",
        "after": "});\nfor(const entry of manifest.cases)test(entry.path+': publication fixes only Git reference, preserving every prior assertion',()=>{\n const source=readOrganizacionalSource(entry.path,'utf8').replace(/\\r\\n/g,'\\n');\n assert.equal(source.includes('HEAD:'),false);\n assert.equal(source.includes(\"'HEAD'\"),false);\n"
      },
      {
        "before": "});\ntest('CI retains historical source for proofs and checks frontend types before build',()=>{\n const source=fs.readFileSync('.github/workflows/erp-runtime-ci.yml','utf8');\n const frontend=source.slice(source.indexOf('  frontend:'),source.indexOf('  backend:'));\n assert.match(frontend,/fetch-depth: 0/);\n",
        "after": "});\ntest('CI retains historical source for proofs and checks frontend types before build',()=>{\n const source=readOrganizacionalSource('.github/workflows/erp-runtime-ci.yml','utf8');\n const frontend=source.slice(source.indexOf('  frontend:'),source.indexOf('  backend:'));\n assert.match(frontend,/fetch-depth: 0/);\n"
      },
      {
        "before": "  assert.equal(tipPub,parentPub);\n  const historical=JSON.parse(execFileSync('git',['show','90f0a315eb3d2b59e0c2bfcab7077abc27bc3613:tests/helpers/publicationBaselineManifest.json'],{encoding:'utf8'}));\n  const current=JSON.parse(fs.readFileSync('tests/helpers/publicationBaselineManifest.json','utf8'));\n  assert.equal(current.cases.length,18);\n  assert.equal(historical.cases.length,18);\n",
        "after": "  assert.equal(tipPub,parentPub);\n  const historical=JSON.parse(execFileSync('git',['show','90f0a315eb3d2b59e0c2bfcab7077abc27bc3613:tests/helpers/publicationBaselineManifest.json'],{encoding:'utf8'}));\n  const current=JSON.parse(readOrganizacionalSource('tests/helpers/publicationBaselineManifest.json','utf8'));\n  assert.equal(current.cases.length,18);\n  assert.equal(historical.cases.length,18);\n"
      },
      {
        "before": "\ntest('P1 reopen guards reject assertion removal after beforeSha recalculation (Codex contraprova)',()=>{\n  const authorized=normalizePublicationSource(fs.readFileSync(REOPEN_CONSOLIDACAO_PATH,'utf8'));\n  assert.equal(publicationRestoredHash(authorized), REOPEN_AUTHORIZED_CURRENT_SHA);\n  assert.equal(restoreAuthorizedReopenConsolidacao(authorized), loadHistoricalReopenConsolidacao());\n",
        "after": "\ntest('P1 reopen guards reject assertion removal after beforeSha recalculation (Codex contraprova)',()=>{\n  const authorized=normalizePublicationSource(readOrganizacionalSource(REOPEN_CONSOLIDACAO_PATH,'utf8'));\n  assert.equal(publicationRestoredHash(authorized), REOPEN_AUTHORIZED_CURRENT_SHA);\n  assert.equal(restoreAuthorizedReopenConsolidacao(authorized), loadHistoricalReopenConsolidacao());\n"
      },
      {
        "before": "\ntest('P1 reopen guards reject internal mutation, omission, repetition and baseline tampering',()=>{\n  const authorized=normalizePublicationSource(fs.readFileSync(REOPEN_CONSOLIDACAO_PATH,'utf8'));\n\n  // Mutação interna (trocar outcome keep→apply).\n",
        "after": "\ntest('P1 reopen guards reject internal mutation, omission, repetition and baseline tampering',()=>{\n  const authorized=normalizePublicationSource(readOrganizacionalSource(REOPEN_CONSOLIDACAO_PATH,'utf8'));\n\n  // Mutação interna (trocar outcome keep→apply).\n"
      }
    ]
  },
  "tests/http-api-client.test.js": {
    "baseline": "fd50e1e4a093d62a7c94978639b48cccd01843cba01297eba0bda42cd01035f4",
    "hunks": [
      {
        "before": "test('CANAL selected reference preserves previous hashes and rejects mutations inside outside omitted duplicated hunks', async () => {\n  const { readFileSync } = await import('node:fs');\n",
        "after": "import { organizacionalSourceForPath } from './helpers/organizacionalRemainder.js';\ntest('CANAL selected reference preserves previous hashes and rejects mutations inside outside omitted duplicated hunks', async () => {\n  const { readFileSync } = await import('node:fs');\n"
      },
      {
        "before": "  const { clienteConferenciaRemainder, clienteSelectedReferenceHunks } = await import('./helpers/consolidation81Remainder.js');\n  for (const [file,entry] of Object.entries(clienteSelectedReferenceHunks)) {\n    const current=readFileSync(file,'utf8');\n    // Validate the full composed file first; only then inspect the unchanged ancestral hunks.\n    assert.doesNotThrow(()=>clienteConferenciaRemainder(file,current));\n",
        "after": "  const { clienteConferenciaRemainder, clienteSelectedReferenceHunks } = await import('./helpers/consolidation81Remainder.js');\n  for (const [file,entry] of Object.entries(clienteSelectedReferenceHunks)) {\n    const current=organizacionalSourceForPath(file,readFileSync(file,'utf8'));\n    // Validate the full composed file first; only then inspect the unchanged ancestral hunks.\n    assert.doesNotThrow(()=>clienteConferenciaRemainder(file,current));\n"
      },
      {
        "before": "test('CANAL actual consumer does not auto-read and clears late results on session change',async()=>{\n const {readFile}=await import('node:fs/promises');const {default:ts}=await import('typescript');const vm=await import('node:vm');\n const source=await readFile(new URL('../src/components/comercial/ClienteConferenciaLegado.jsx',import.meta.url),'utf8');\n const slots=[];let cursor=0,effects=[],listener,finish,calls=0;\n const react={createElement:(type,props,...children)=>({type,props:{...props,children:children.flat()}}),useState:init=>{const i=cursor++;if(!(i in slots))slots[i]=init;return[slots[i],v=>{slots[i]=v;}];},useRef:init=>{const i=cursor++;if(!(i in slots))slots[i]={current:init};return slots[i];},useEffect:(fn,deps)=>{const i=cursor++;if(!slots[i]||deps.some((v,n)=>v!==slots[i][n])){slots[i]=deps;effects.push(fn);}}};\n",
        "after": "test('CANAL actual consumer does not auto-read and clears late results on session change',async()=>{\n const {readFile}=await import('node:fs/promises');const {default:ts}=await import('typescript');const vm=await import('node:vm');\n const source=organizacionalSourceForPath(new URL('../src/components/comercial/ClienteConferenciaLegado.jsx',import.meta.url),await readFile(new URL('../src/components/comercial/ClienteConferenciaLegado.jsx',import.meta.url),'utf8'));\n const slots=[];let cursor=0,effects=[],listener,finish,calls=0;\n const react={createElement:(type,props,...children)=>({type,props:{...props,children:children.flat()}}),useState:init=>{const i=cursor++;if(!(i in slots))slots[i]=init;return[slots[i],v=>{slots[i]=v;}];},useRef:init=>{const i=cursor++;if(!(i in slots))slots[i]={current:init};return slots[i];},useEffect:(fn,deps)=>{const i=cursor++;if(!slots[i]||deps.some((v,n)=>v!==slots[i][n])){slots[i]=deps;effects.push(fn);}}};\n"
      },
      {
        "before": " let tree;const render=()=>{cursor=0;tree=exports.default();effects.splice(0).forEach(fn=>fn());};const walk=node=>!node||typeof node!=='object'?[]:[node,...(node.props?.children||[]).flatMap(walk)];\n render();assert.equal(calls,0);walk(tree).find(n=>n.type==='textarea').props.onChange({target:{value:JSON.stringify({identidades:[{documento:'11222333000181'}]})}});render();const run=walk(tree).find(n=>n.type==='button').props.onClick();assert.equal(calls,1);session.token='new';listener();finish([{indice:0,documento:null,legado:null}]);await run;render();assert.equal(walk(tree).some(n=>n.type==='table'),false);assert.equal(calls,1);\n const tab=await readFile(new URL('../src/components/comercial/ClientesTab.jsx',import.meta.url),'utf8');assert.ok(tab.indexOf('if (conferencia) return')<tab.indexOf('<VisualizadorUniversalEntidadeV24'));assert.match(tab,/conferencia_legado/);const commercial=await readFile(new URL('../src/pages/Comercial.jsx',import.meta.url),'utf8');const ast=ts.createSourceFile('Comercial.jsx',commercial,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);const wrapper=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='Comercial');assert.ok(wrapper);const exported={};vm.runInNewContext(ts.transpileModule(wrapper.getText(ast),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText,{exports:exported,window:{location:{search:'?conferencia_legado=1'}},URLSearchParams,React:react,Suspense:'Suspense',ClientesTab:'EXACT_ONLY',ComercialContent:'BROAD'});const route=exported.default();assert.equal(route.props.children[0].type,'EXACT_ONLY');assert.equal(route.type,'Suspense');\n});\n\n",
        "after": " let tree;const render=()=>{cursor=0;tree=exports.default();effects.splice(0).forEach(fn=>fn());};const walk=node=>!node||typeof node!=='object'?[]:[node,...(node.props?.children||[]).flatMap(walk)];\n render();assert.equal(calls,0);walk(tree).find(n=>n.type==='textarea').props.onChange({target:{value:JSON.stringify({identidades:[{documento:'11222333000181'}]})}});render();const run=walk(tree).find(n=>n.type==='button').props.onClick();assert.equal(calls,1);session.token='new';listener();finish([{indice:0,documento:null,legado:null}]);await run;render();assert.equal(walk(tree).some(n=>n.type==='table'),false);assert.equal(calls,1);\n const tab=organizacionalSourceForPath(new URL('../src/components/comercial/ClientesTab.jsx',import.meta.url),await readFile(new URL('../src/components/comercial/ClientesTab.jsx',import.meta.url),'utf8'));assert.ok(tab.indexOf('if (conferencia) return')<tab.indexOf('<VisualizadorUniversalEntidadeV24'));assert.match(tab,/conferencia_legado/);const commercial=organizacionalSourceForPath(new URL('../src/pages/Comercial.jsx',import.meta.url),await readFile(new URL('../src/pages/Comercial.jsx',import.meta.url),'utf8'));const ast=ts.createSourceFile('Comercial.jsx',commercial,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);const wrapper=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='Comercial');assert.ok(wrapper);const exported={};vm.runInNewContext(ts.transpileModule(wrapper.getText(ast),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText,{exports:exported,window:{location:{search:'?conferencia_legado=1'}},URLSearchParams,React:react,Suspense:'Suspense',ClientesTab:'EXACT_ONLY',ComercialContent:'BROAD'});const route=exported.default();assert.equal(route.props.children[0].type,'EXACT_ONLY');assert.equal(route.type,'Suspense');\n});\n\n"
      },
      {
        "before": " const {readFile}=await import('node:fs/promises');\n for(const path of Object.keys(clienteConferenciaHunks)){\n  const raw=await readFile(path,'utf8');\n  assert.ok(clienteConferenciaRemainder(path,raw));\n  const source=clienteSelectedReferenceRemainder(path,raw);\n",
        "after": " const {readFile}=await import('node:fs/promises');\n for(const path of Object.keys(clienteConferenciaHunks)){\n  const raw=organizacionalSourceForPath(path,await readFile(path,'utf8'));\n  assert.ok(clienteConferenciaRemainder(path,raw));\n  const source=clienteSelectedReferenceRemainder(path,raw);\n"
      },
      {
        "before": "  const { clienteConferenciaHunks, clienteConferenciaRemainder: composed, clienteSelectedReferenceRemainder, clienteConferenciaHistoricalRemainder: clienteConferenciaRemainder } = await import('./helpers/consolidation81Remainder.js');\n  for (const path of ['server/src/api/router.ts','server/src/services/clienteService.ts','src/api/httpApiClient.js']) {\n    const raw = readFileSync(path, 'utf8');\n    assert.doesNotThrow(() => composed(path, raw));\n    const source = clienteSelectedReferenceRemainder(path, raw);\n",
        "after": "  const { clienteConferenciaHunks, clienteConferenciaRemainder: composed, clienteSelectedReferenceRemainder, clienteConferenciaHistoricalRemainder: clienteConferenciaRemainder } = await import('./helpers/consolidation81Remainder.js');\n  for (const path of ['server/src/api/router.ts','server/src/services/clienteService.ts','src/api/httpApiClient.js']) {\n    const raw = organizacionalSourceForPath(path,readFileSync(path, 'utf8'));\n    assert.doesNotThrow(() => composed(path, raw));\n    const source = clienteSelectedReferenceRemainder(path, raw);\n"
      }
    ]
  },
  "tests/financial-movement-http-client.test.js": {
    "baseline": "ad99a609f17c925a4aa086b114bf6ddaa699f0565d46600b8384736588e09b92",
    "hunks": [
      {
        "before": "import { clienteConferenciaRemainder } from './helpers/consolidation81Remainder.js';\nimport test from 'node:test';\n",
        "after": "import { organizacionalSourceForPath } from './helpers/organizacionalRemainder.js';\nconst readOrganizacionalSource = (file, ...args) => organizacionalSourceForPath(file, fs.readFileSync(file, ...args));\nimport { clienteConferenciaRemainder } from './helpers/consolidation81Remainder.js';\nimport test from 'node:test';\n"
      },
      {
        "before": "const receipts={postManual:{id:movementId,revision:'1',state:'POSTED',replay:false},list:page,reconcile:{id:linkId,active:true,replay:false},reverseLink:{id:linkId,active:false,replay:true}};\nfunction fixture(fetchImpl,getScope=()=>({...expected,token:'synthetic-token'})){return createHttpApiClient({baseUrl:'https://synthetic.invalid',getScope,fetchImpl}).financialMovements;}\nconst read=file=>fs.readFileSync(file,'utf8').replace(/\\r\\n/g,'\\n');\nconst hash=value=>crypto.createHash('sha256').update(value).digest('hex');\ntest('shared bank executor and HTTP factory retain complete previous sources outside exact extraction/additions',()=>{\n",
        "after": "const receipts={postManual:{id:movementId,revision:'1',state:'POSTED',replay:false},list:page,reconcile:{id:linkId,active:true,replay:false},reverseLink:{id:linkId,active:false,replay:true}};\nfunction fixture(fetchImpl,getScope=()=>({...expected,token:'synthetic-token'})){return createHttpApiClient({baseUrl:'https://synthetic.invalid',getScope,fetchImpl}).financialMovements;}\nconst read=file=>readOrganizacionalSource(file,'utf8').replace(/\\r\\n/g,'\\n');\nconst hash=value=>crypto.createHash('sha256').update(value).digest('hex');\ntest('shared bank executor and HTTP factory retain complete previous sources outside exact extraction/additions',()=>{\n"
      }
    ]
  },
  "tests/guard-ofx-a1-consolidacao.test.js": {
    "baseline": "4b5599fbd03fed8f665c70d64a106d7eca8629ccb00baa4998b6132b60fd9393",
    "hunks": [
      {
        "before": "import { clienteConferenciaRemainder } from './helpers/consolidation81Remainder.js';\nimport test from 'node:test';\n",
        "after": "import { organizacionalSourceForPath } from './helpers/organizacionalRemainder.js';\nconst readOrganizacionalSource = (file, ...args) => organizacionalSourceForPath(file, readFileSync(file, ...args));\nimport { clienteConferenciaRemainder } from './helpers/consolidation81Remainder.js';\nimport test from 'node:test';\n"
      },
      {
        "before": "import { createHttpApiClient } from '../src/api/httpApiClient.js';\n\nconst read = path => readFileSync(path, 'utf8').replace(/\\r\\n/g, '\\n');\nconst head = path => execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:${path}`], { encoding: 'utf8' }).replace(/\\r\\n/g, '\\n');\nconst emit = text => ts.transpileModule(text, { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, removeComments: true } }).outputText;\n",
        "after": "import { createHttpApiClient } from '../src/api/httpApiClient.js';\n\nconst read = path => readOrganizacionalSource(path, 'utf8').replace(/\\r\\n/g, '\\n');\nconst head = path => execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:${path}`], { encoding: 'utf8' }).replace(/\\r\\n/g, '\\n');\nconst emit = text => ts.transpileModule(text, { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, removeComments: true } }).outputText;\n"
      }
    ]
  },
  "tests/guard-session-http-ia-consolidacao.test.js": {
    "baseline": "177201199e3aa6dbbf211193e03f4a6204d7f4b140ff7964f194267b4fa47220",
    "hunks": [
      {
        "before": "import test from 'node:test';\nimport assert from 'node:assert/strict';\n",
        "after": "import { organizacionalSourceForPath } from './helpers/organizacionalRemainder.js';\nconst readOrganizacionalSource = (file, ...args) => organizacionalSourceForPath(file, readFileSync(file, ...args));\nimport test from 'node:test';\nimport assert from 'node:assert/strict';\n"
      },
      {
        "before": "import { validarAnaliseAtendimentoIA, validarIntentAtendimentoIA } from '../src/components/lib/atendimentoIaResponsePolicy.js';\n\nconst read = path => readFileSync(path, 'utf8').replace(/\\r\\n/g, '\\n');\nconst head = path => execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:${path}`], { encoding: 'utf8' }).replace(/\\r\\n/g, '\\n');\nfunction declaration(source, name) {\n",
        "after": "import { validarAnaliseAtendimentoIA, validarIntentAtendimentoIA } from '../src/components/lib/atendimentoIaResponsePolicy.js';\n\nconst read = path => readOrganizacionalSource(path, 'utf8').replace(/\\r\\n/g, '\\n');\nconst head = path => execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:${path}`], { encoding: 'utf8' }).replace(/\\r\\n/g, '\\n');\nfunction declaration(source, name) {\n"
      }
    ]
  },
  "tests/publication-channel-counterproof.test.js": {
    "baseline": "1507cb4cf7203988f171697f97ab5781c9fa9ff7cc23c99f15d70cceb0a82cce",
    "hunks": [
      {
        "before": "import test from 'node:test';\nimport assert from 'node:assert/strict';\n",
        "after": "import { organizacionalSourceForPath } from './helpers/organizacionalRemainder.js';\nconst readOrganizacionalSource = (file, ...args) => organizacionalSourceForPath(file, fs.readFileSync(file, ...args));\nimport test from 'node:test';\nimport assert from 'node:assert/strict';\n"
      },
      {
        "before": "for (const [file, entry] of Object.entries(clienteConferenciaHunks)) {\n  test(file + ': channel normalization refuses changed, repeated and out-of-scope bytes', () => {\n    const composedSource = fs.readFileSync(file, 'utf8').replace(/\\r\\n/g, '\\n');\n    assert.doesNotThrow(() => clienteConferenciaRemainder(file, composedSource));\n    assert.throws(() => clienteConferenciaRemainder(file, composedSource + '\\n// SYNTHETIC_UNAPPROVED_CHANGE\\n'));\n",
        "after": "for (const [file, entry] of Object.entries(clienteConferenciaHunks)) {\n  test(file + ': channel normalization refuses changed, repeated and out-of-scope bytes', () => {\n    const composedSource = readOrganizacionalSource(file, 'utf8').replace(/\\r\\n/g, '\\n');\n    assert.doesNotThrow(() => clienteConferenciaRemainder(file, composedSource));\n    assert.throws(() => clienteConferenciaRemainder(file, composedSource + '\\n// SYNTHETIC_UNAPPROVED_CHANGE\\n'));\n"
      },
      {
        "before": "for (const [file, entry] of Object.entries(clienteSelectedReferenceHunks)) {\n  test(file + ': selected-reference composition refuses changed, omitted and repeated hunks', () => {\n    const source = clienteMasterExtrasRemainder(file, fs.readFileSync(file, 'utf8')).replace(/\\r\\n/g, '\\n');\n    assert.doesNotThrow(() => clienteConferenciaRemainder(file, source));\n    for (const [after] of entry.hunks) {\n",
        "after": "for (const [file, entry] of Object.entries(clienteSelectedReferenceHunks)) {\n  test(file + ': selected-reference composition refuses changed, omitted and repeated hunks', () => {\n    const source = clienteMasterExtrasRemainder(file, readOrganizacionalSource(file, 'utf8')).replace(/\\r\\n/g, '\\n');\n    assert.doesNotThrow(() => clienteConferenciaRemainder(file, source));\n    for (const [after] of entry.hunks) {\n"
      },
      {
        "before": "const sha = text => createHash('sha256').update(text).digest('hex');\ntest('contacts helper: entire reviewed source is pinned, not just matching declarations', () => {\n  const source = fs.readFileSync(new URL('./helpers/clienteContatosRemainder.js', import.meta.url), 'utf8').replace(/\\r\\n/g, '\\n');\n  const expected = '6bf7eca1801d8caaf1eb9f70973aad0a325f0342f6e4a838f5500d9a9ab2cc7f';\n  const bridge = JSON.parse(fs.readFileSync(new URL('./helpers/clienteMasterExtrasCompositionManifest.json', import.meta.url))).historicalHelper;\n  const verify = text => {\n    let previous = clienteMasterExtrasRemainder('tests/helpers/clienteContatosRemainder.js', text);\n",
        "after": "const sha = text => createHash('sha256').update(text).digest('hex');\ntest('contacts helper: entire reviewed source is pinned, not just matching declarations', () => {\n  const source = readOrganizacionalSource(new URL('./helpers/clienteContatosRemainder.js', import.meta.url), 'utf8').replace(/\\r\\n/g, '\\n');\n  const expected = '6bf7eca1801d8caaf1eb9f70973aad0a325f0342f6e4a838f5500d9a9ab2cc7f';\n  const bridge = JSON.parse(readOrganizacionalSource(new URL('./helpers/clienteMasterExtrasCompositionManifest.json', import.meta.url))).historicalHelper;\n  const verify = text => {\n    let previous = clienteMasterExtrasRemainder('tests/helpers/clienteContatosRemainder.js', text);\n"
      },
      {
        "before": "for (const [file, entry] of Object.entries(clienteContatosHunks)) {\n  test(file + ': exact contacts peel preserves full 0bb7313c and ancestor pins', () => {\n    const currentSource = fs.readFileSync(file, 'utf8').replace(/\\r\\n/g, '\\n');\n    const source = clienteMasterExtrasRemainder(file, currentSource);\n    const baseline = execFileSync('git', ['show', clienteContatosBaseline + ':' + file], { encoding: 'utf8' }).replace(/\\r\\n/g, '\\n');\n",
        "after": "for (const [file, entry] of Object.entries(clienteContatosHunks)) {\n  test(file + ': exact contacts peel preserves full 0bb7313c and ancestor pins', () => {\n    const currentSource = readOrganizacionalSource(file, 'utf8').replace(/\\r\\n/g, '\\n');\n    const source = clienteMasterExtrasRemainder(file, currentSource);\n    const baseline = execFileSync('git', ['show', clienteContatosBaseline + ':' + file], { encoding: 'utf8' }).replace(/\\r\\n/g, '\\n');\n"
      }
    ]
  },
  "tests/cadastros-count-erro-vazio.test.js": {
    "baseline": "5b5d8c8a3174d0beeffe21f2527d49516fecaf5275d18db7933192b68508955e",
    "hunks": [
      {
        "before": "/**\n * Pacote A / #431 — contraprova comportamental:\n",
        "after": "import { organizacionalSourceForPath } from './helpers/organizacionalRemainder.js';\nconst readOrganizacionalSource = (file, ...args) => organizacionalSourceForPath(file, fs.readFileSync(file, ...args));\n/**\n * Pacote A / #431 — contraprova comportamental:\n"
      },
      {
        "before": "  );\n  assert.equal(\n    fs.readFileSync(path.join(ROOT, 'components/lib/useEntityCounts.jsx'), 'utf8')\n      .includes(\"from \\\"@/components/lib/cadastroCountFilter.js\\\"\"),\n    true,\n  );\n  assert.equal(\n    fs.readFileSync(path.join(ROOT, 'components/cadastros/hooks/cadastrosAllCountsCore.js'), 'utf8')\n      .includes(\"from '../../lib/cadastroCountFilter.js'\"),\n    true,\n",
        "after": "  );\n  assert.equal(\n    readOrganizacionalSource(path.join(ROOT, 'components/lib/useEntityCounts.jsx'), 'utf8')\n      .includes(\"from \\\"@/components/lib/cadastroCountFilter.js\\\"\"),\n    true,\n  );\n  assert.equal(\n    readOrganizacionalSource(path.join(ROOT, 'components/cadastros/hooks/cadastrosAllCountsCore.js'), 'utf8')\n      .includes(\"from '../../lib/cadastroCountFilter.js'\"),\n    true,\n"
      },
      {
        "before": "  assert.deepEqual(counts, { Produto: 1, Cliente: 1, Marca: 2 });\n  // Bridge HTTP piloto permanece no facade (não só filtro local)\n  const facade = fs.readFileSync(path.join(ROOT, 'api/base44Client.js'), 'utf8');\n  assert.match(facade, /countEntitiesTouchesHttpPilot/);\n  assert.match(facade, /runHttpPilotAwareCountEntities/);\n",
        "after": "  assert.deepEqual(counts, { Produto: 1, Cliente: 1, Marca: 2 });\n  // Bridge HTTP piloto permanece no facade (não só filtro local)\n  const facade = readOrganizacionalSource(path.join(ROOT, 'api/base44Client.js'), 'utf8');\n  assert.match(facade, /countEntitiesTouchesHttpPilot/);\n  assert.match(facade, /runHttpPilotAwareCountEntities/);\n"
      },
      {
        "before": "\ntest('resposta tardia de outro escopo é descartável via queryKey (hooks sem placeholder)', () => {\n  const all = fs.readFileSync(\n    path.join(ROOT, 'components/cadastros/hooks/useCadastrosAllCounts.jsx'),\n    'utf8',\n  );\n  const ent = fs.readFileSync(path.join(ROOT, 'components/lib/useEntityCounts.jsx'), 'utf8');\n  assert.match(all, /queryKey:\\s*\\[\"cadastros-all-counts-v5\",\\s*empresaId,\\s*groupId,\\s*grupoEmpIds,\\s*actorId,\\s*sessionKey\\]/);\n  assert.match(ent, /const queryKey = \\['entityCounts_v5',\\s*entitiesKey,\\s*groupId,\\s*empresaId,\\s*grupoEmpIdsKey,\\s*actorId,\\s*sessionKey\\];/);\n",
        "after": "\ntest('resposta tardia de outro escopo é descartável via queryKey (hooks sem placeholder)', () => {\n  const all = readOrganizacionalSource(\n    path.join(ROOT, 'components/cadastros/hooks/useCadastrosAllCounts.jsx'),\n    'utf8',\n  );\n  const ent = readOrganizacionalSource(path.join(ROOT, 'components/lib/useEntityCounts.jsx'), 'utf8');\n  assert.match(all, /queryKey:\\s*\\[\"cadastros-all-counts-v5\",\\s*empresaId,\\s*groupId,\\s*grupoEmpIds,\\s*actorId,\\s*sessionKey\\]/);\n  assert.match(ent, /const queryKey = \\['entityCounts_v5',\\s*entitiesKey,\\s*groupId,\\s*empresaId,\\s*grupoEmpIdsKey,\\s*actorId,\\s*sessionKey\\];/);\n"
      },
      {
        "before": "\ntest('falha countEntities não vira KPI via page.length / entityListSorted', () => {\n  const ent = fs.readFileSync(path.join(ROOT, 'components/lib/useEntityCounts.jsx'), 'utf8');\n  assert.doesNotMatch(ent, /entityListSorted/);\n  assert.doesNotMatch(ent, /limit:\\s*2000/);\n",
        "after": "\ntest('falha countEntities não vira KPI via page.length / entityListSorted', () => {\n  const ent = readOrganizacionalSource(path.join(ROOT, 'components/lib/useEntityCounts.jsx'), 'utf8');\n  assert.doesNotMatch(ent, /entityListSorted/);\n  assert.doesNotMatch(ent, /limit:\\s*2000/);\n"
      },
      {
        "before": "\ntest('UI Cadastros distingue erro (—) de zero; banner data-counts-unavailable', () => {\n  const page = fs.readFileSync(path.join(ROOT, 'pages/Cadastros.jsx'), 'utf8');\n  assert.match(page, /data-counts-unavailable/);\n  assert.match(page, /countsUnavailable/);\n  assert.match(page, /Contagens indisponíveis por erro de consulta/);\n\n  const badge = fs.readFileSync(path.join(ROOT, 'components/cadastros/GroupCountBadge.jsx'), 'utf8');\n  assert.match(badge, /countsUnavailable/);\n  assert.match(badge, /não é zero/);\n\n  const hook = fs.readFileSync(\n    path.join(ROOT, 'components/cadastros/hooks/useCadastrosAllCounts.jsx'),\n    'utf8',\n",
        "after": "\ntest('UI Cadastros distingue erro (—) de zero; banner data-counts-unavailable', () => {\n  const page = readOrganizacionalSource(path.join(ROOT, 'pages/Cadastros.jsx'), 'utf8');\n  assert.match(page, /data-counts-unavailable/);\n  assert.match(page, /countsUnavailable/);\n  assert.match(page, /Contagens indisponíveis por erro de consulta/);\n\n  const badge = readOrganizacionalSource(path.join(ROOT, 'components/cadastros/GroupCountBadge.jsx'), 'utf8');\n  assert.match(badge, /countsUnavailable/);\n  assert.match(badge, /não é zero/);\n\n  const hook = readOrganizacionalSource(\n    path.join(ROOT, 'components/cadastros/hooks/useCadastrosAllCounts.jsx'),\n    'utf8',\n"
      },
      {
        "before": "\ntest('Visualizador zera lastGoodData na troca de escopo (lista pós-contexto)', () => {\n  const src = fs.readFileSync(\n    path.join(ROOT, 'components/cadastros/VisualizadorUniversalEntidadeV24.jsx'),\n    'utf8',\n",
        "after": "\ntest('Visualizador zera lastGoodData na troca de escopo (lista pós-contexto)', () => {\n  const src = readOrganizacionalSource(\n    path.join(ROOT, 'components/cadastros/VisualizadorUniversalEntidadeV24.jsx'),\n    'utf8',\n"
      },
      {
        "before": "  assert.match(src, /Nenhum registro de/);\n  // remainder pin e36231b3 permanece autorizado\n  const rem = fs.readFileSync(\n    path.join(path.resolve('tests/helpers/scopeListCacheRemainder.js')),\n    'utf8',\n",
        "after": "  assert.match(src, /Nenhum registro de/);\n  // remainder pin e36231b3 permanece autorizado\n  const rem = readOrganizacionalSource(\n    path.join(path.resolve('tests/helpers/scopeListCacheRemainder.js')),\n    'utf8',\n"
      },
      {
        "before": "\ntest('Visualizador propaga countsUnavailable — total ≠ 0 fabricado; cross-page bloqueado', () => {\n  const src = fs.readFileSync(\n    path.join(ROOT, 'components/cadastros/VisualizadorUniversalEntidadeV24.jsx'),\n    'utf8',\n",
        "after": "\ntest('Visualizador propaga countsUnavailable — total ≠ 0 fabricado; cross-page bloqueado', () => {\n  const src = readOrganizacionalSource(\n    path.join(ROOT, 'components/cadastros/VisualizadorUniversalEntidadeV24.jsx'),\n    'utf8',\n"
      },
      {
        "before": "  assert.match(src, /Exclusao em lote bloqueada: contagem indisponivel/);\n  assert.doesNotMatch(src, /entityListSorted[\\s\\S]{0,80}totalCount/);\n  const rem = fs.readFileSync(\n    path.join(path.resolve('tests/helpers/scopeListCacheRemainder.js')),\n    'utf8',\n",
        "after": "  assert.match(src, /Exclusao em lote bloqueada: contagem indisponivel/);\n  assert.doesNotMatch(src, /entityListSorted[\\s\\S]{0,80}totalCount/);\n  const rem = readOrganizacionalSource(\n    path.join(path.resolve('tests/helpers/scopeListCacheRemainder.js')),\n    'utf8',\n"
      },
      {
        "before": "\ntest('Contatos comercial: bind imutável, erro≠form vazio, single-save', () => {\n  const orphan = fs.readFileSync(\n    path.join(ROOT, 'components/comercial/GerenciarContatosCliente.jsx'),\n    'utf8',\n",
        "after": "\ntest('Contatos comercial: bind imutável, erro≠form vazio, single-save', () => {\n  const orphan = readOrganizacionalSource(\n    path.join(ROOT, 'components/comercial/GerenciarContatosCliente.jsx'),\n    'utf8',\n"
      }
    ]
  },
  "tests/cliente-master-extras-preservation.test.js": {
    "baseline": "5bdbd31ddea88360f26b0c3b2ed4e388bc80981ffc1121689c06ab7489506203",
    "hunks": [
      {
        "before": "import test from 'node:test';\nimport assert from 'node:assert/strict';\n",
        "after": "import { organizacionalSourceForPath } from './helpers/organizacionalRemainder.js';\nconst readOrganizacionalSource = (file, ...args) => organizacionalSourceForPath(file, fs.readFileSync(file, ...args));\nimport test from 'node:test';\nimport assert from 'node:assert/strict';\n"
      },
      {
        "before": "    ['./helpers/clienteMasterExtrasCompositionManifest.json', '7b87bd95567c0b94772b3c725fc2695c6b82400576f0fe42cfe76f5ac326fedc'],\n  ]) {\n    const source = Buffer.from(fs.readFileSync(new URL(file, import.meta.url), 'utf8').replace(/\\r\\n/g, '\\n'));\n    assert.equal(createHash('sha256').update(source).digest('hex'), expected);\n    assert.notEqual(createHash('sha256').update(Buffer.concat([source, Buffer.from('FORGED')])).digest('hex'), expected);\n",
        "after": "    ['./helpers/clienteMasterExtrasCompositionManifest.json', '7b87bd95567c0b94772b3c725fc2695c6b82400576f0fe42cfe76f5ac326fedc'],\n  ]) {\n    const source = Buffer.from(readOrganizacionalSource(new URL(file, import.meta.url), 'utf8').replace(/\\r\\n/g, '\\n'));\n    assert.equal(createHash('sha256').update(source).digest('hex'), expected);\n    assert.notEqual(createHash('sha256').update(Buffer.concat([source, Buffer.from('FORGED')])).digest('hex'), expected);\n"
      },
      {
        "before": "for (const [file, entry] of Object.entries(clienteMasterExtrasComposition.entries)) {\n  test(file + ': keep-both bridge rejects every removed, repeated or modified composition hunk', () => {\n    const current = fs.readFileSync(file, 'utf8').replace(/\\r\\n/g, '\\n');\n    const previous = clienteMasterExtrasRemainder(file, current);\n    assert.equal(createHash('sha256').update(previous).digest('hex'), entry.hash);\n",
        "after": "for (const [file, entry] of Object.entries(clienteMasterExtrasComposition.entries)) {\n  test(file + ': keep-both bridge rejects every removed, repeated or modified composition hunk', () => {\n    const current = readOrganizacionalSource(file, 'utf8').replace(/\\r\\n/g, '\\n');\n    const previous = clienteMasterExtrasRemainder(file, current);\n    assert.equal(createHash('sha256').update(previous).digest('hex'), entry.hash);\n"
      },
      {
        "before": "\ntest('new extension guard retains its complete reviewed bytes', () => {\n  const source = fs.readFileSync(new URL('./helpers/clienteMasterExtrasRemainder.js', import.meta.url));\n  const expected = '5f579b16b02e980742defc3bbfe01238fa645826efc724e3ec898f3fc2a536e3';\n  assert.equal(createHash('sha256').update(source).digest('hex'), expected);\n",
        "after": "\ntest('new extension guard retains its complete reviewed bytes', () => {\n  const source = readOrganizacionalSource(new URL('./helpers/clienteMasterExtrasRemainder.js', import.meta.url));\n  const expected = '5f579b16b02e980742defc3bbfe01238fa645826efc724e3ec898f3fc2a536e3';\n  assert.equal(createHash('sha256').update(source).digest('hex'), expected);\n"
      },
      {
        "before": "for (const [file, entry] of Object.entries(clienteMasterExtraHunks)) {\n  test(file + ': entire previous source survives only the exact reviewed extensions', () => {\n    const current = fs.readFileSync(file, 'utf8').replace(/\\r\\n/g, '\\n');\n    const before = clienteMasterExtrasRemainder(file, current);\n    const composed = clienteMasterExtrasComposition.entries[file];\n",
        "after": "for (const [file, entry] of Object.entries(clienteMasterExtraHunks)) {\n  test(file + ': entire previous source survives only the exact reviewed extensions', () => {\n    const current = readOrganizacionalSource(file, 'utf8').replace(/\\r\\n/g, '\\n');\n    const before = clienteMasterExtrasRemainder(file, current);\n    const composed = clienteMasterExtrasComposition.entries[file];\n"
      },
      {
        "before": "for (const file of Object.keys(clienteMasterExtraHunks).filter(file => clienteContatosHunks[file])) {\n  test(file + ': actual composed source still rejects mutations through every historical entry point', () => {\n    const current = fs.readFileSync(file, 'utf8').replace(/\\r\\n/g, '\\n');\n    const [hunk] = (clienteMasterExtrasComposition.entries[file] ?? clienteMasterExtraHunks[file]).hunks[0];\n    const mutations = [current + '\\nconst unrelated = true;\\n', current.replace(hunk, ''), current + hunk,\n",
        "after": "for (const file of Object.keys(clienteMasterExtraHunks).filter(file => clienteContatosHunks[file])) {\n  test(file + ': actual composed source still rejects mutations through every historical entry point', () => {\n    const current = readOrganizacionalSource(file, 'utf8').replace(/\\r\\n/g, '\\n');\n    const [hunk] = (clienteMasterExtrasComposition.entries[file] ?? clienteMasterExtraHunks[file]).hunks[0];\n    const mutations = [current + '\\nconst unrelated = true;\\n', current.replace(hunk, ''), current + hunk,\n"
      }
    ]
  },
  "tests/legado-importador-consolidacao.test.js": {
    "baseline": "228a4731f372deb69ff62e9cfa21b5522c8af3f4dca6bc381e8f11415f3b619a",
    "hunks": [
      {
        "before": "import { clienteConferenciaRemainder } from './helpers/consolidation81Remainder.js';\nimport assert from 'node:assert/strict';\n",
        "after": "import { organizacionalSourceForPath } from './helpers/organizacionalRemainder.js';\nconst readOrganizacionalSource = (file, ...args) => organizacionalSourceForPath(file, fs.readFileSync(file, ...args));\nimport { clienteConferenciaRemainder } from './helpers/consolidation81Remainder.js';\nimport assert from 'node:assert/strict';\n"
      },
      {
        "before": "\ntest('importer consolidation preserves every remote consumer/reconciliation byte except the reviewed address export',()=>{\n  const current=fs.readFileSync(sourcePath,'utf8').replaceAll('\\r\\n','\\n');\n  assert.equal(current.split(exportLine).length,2);\n  assert.equal(current.replace(exportLine,''),readHead(sourcePath));\n",
        "after": "\ntest('importer consolidation preserves every remote consumer/reconciliation byte except the reviewed address export',()=>{\n  const current=readOrganizacionalSource(sourcePath,'utf8').replaceAll('\\r\\n','\\n');\n  assert.equal(current.split(exportLine).length,2);\n  assert.equal(current.replace(exportLine,''),readHead(sourcePath));\n"
      },
      {
        "before": "      .map(expression=>[expression.arguments[0].text,expression.getText(file)]));\n  };\n  const before=collect(readHead(path)),after=collect(fs.readFileSync(path,'utf8'));\n  assert.equal(before.size,13);assert.equal(after.size,23);\n  for(const [name,text] of before)assert.equal(after.get(name),text,name);\n",
        "after": "      .map(expression=>[expression.arguments[0].text,expression.getText(file)]));\n  };\n  const before=collect(readHead(path)),after=collect(readOrganizacionalSource(path,'utf8'));\n  assert.equal(before.size,13);assert.equal(after.size,23);\n  for(const [name,text] of before)assert.equal(after.get(name),text,name);\n"
      },
      {
        "before": "  }\n  assert.equal(permissionCalls,0);\n  assert.equal(clienteConferenciaRemainder('server/src/api/router.ts',fs.readFileSync('server/src/api/router.ts','utf8')),readHead('server/src/api/router.ts'));\n  assert.equal(clienteConferenciaRemainder('server/src/app.ts',fs.readFileSync('server/src/app.ts','utf8')).replaceAll('\\r\\n','\\n'),readHead('server/src/app.ts'));\n  // Baseline pós-045 contatos[] jsonb (#591 decisão a). Tip migrations bump; publication base e36231b3a7e546aa9fd2529abb8d5edb61d8189c permanece (2ª ref do canal).\n  assert.equal(execFileSync('git',['diff',\"cc7c71f5e913b8f0c19d90927bb94f51ba15de89\",'--','server/migrations'],{encoding:'utf8'}),'');\n",
        "after": "  }\n  assert.equal(permissionCalls,0);\n  assert.equal(clienteConferenciaRemainder('server/src/api/router.ts',readOrganizacionalSource('server/src/api/router.ts','utf8')),readHead('server/src/api/router.ts'));\n  assert.equal(clienteConferenciaRemainder('server/src/app.ts',readOrganizacionalSource('server/src/app.ts','utf8')).replaceAll('\\r\\n','\\n'),readHead('server/src/app.ts'));\n  // Baseline pós-045 contatos[] jsonb (#591 decisão a). Tip migrations bump; publication base e36231b3a7e546aa9fd2529abb8d5edb61d8189c permanece (2ª ref do canal).\n  assert.equal(execFileSync('git',['diff',\"cc7c71f5e913b8f0c19d90927bb94f51ba15de89\",'--','server/migrations'],{encoding:'utf8'}),'');\n"
      }
    ]
  }
};

export function organizacionalRemainder(file, source) {
 const entry=entries[file]; if(!entry) return source;
 let result=source.replace(/\r\n/g,'\n');
 if(createHash('sha256').update(result).digest('hex')===entry.baseline) return result;
 for(const {before,after} of entry.hunks) {
  assert.equal(result.split(after).length,2,`Exact organizational hunk: ${file}: ${after.slice(0,80)}`);
  result=result.replace(after,before);
 }
 return result;
}
export function organizacionalSourceForPath(file, source) {
 if(typeof source!=='string') return source;
 const name=decodeURIComponent(String(file)).replaceAll('\\','/');
 const key=Object.keys(entries).find(k=>name===k||name.endsWith('/'+k));
 return key?organizacionalRemainder(key,source):source;
}
