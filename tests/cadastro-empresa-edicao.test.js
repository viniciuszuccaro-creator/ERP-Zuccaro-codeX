import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import {
  buildMultiempresaReadFilter,
  isEditRequestCurrent,
  isTenantMasterEntity,
  loadEmpresaForEdit,
  userTemAcessoEmpresa,
} from '../src/components/lib/contextoMultiempresaPolicy.js';

const complete = Object.freeze({
  id: 'empresa-a', group_id: 'grupo-a', razao_social: 'Empresa Sintetica',
  nome_fantasia: 'Sintetica', cnpj: '00000000000191',
  configuracao_fiscal: { serie_nfe: '9' },
});

test('Editar Empresa rele cadastro completo e preserva identidade e configuracoes', async () => {
  let reads = 0;
  const record = await loadEmpresaForEdit({
    id: 'empresa-a', groupId: 'grupo-a', fetchById: async (id) => {
      reads += 1;
      assert.equal(id, 'empresa-a');
      return complete;
    },
  });
  assert.equal(reads, 1);
  assert.equal(record, complete);
  assert.equal(record.configuracao_fiscal.serie_nfe, '9');
});

test('Editar Empresa bloqueia resposta parcial, ID trocado e Grupo/Empresa estranhos', async () => {
  const attempt = (record, empresaId) => loadEmpresaForEdit({
    id: 'empresa-a', groupId: 'grupo-a', empresaId,
    fetchById: async () => record,
  });
  await assert.rejects(attempt({ id: 'empresa-a', group_id: 'grupo-a', razao_social: 'Parcial' }));
  await assert.rejects(attempt({ ...complete, id: 'empresa-b' }));
  await assert.rejects(attempt({ ...complete, group_id: 'grupo-b' }));
  await assert.rejects(attempt(complete, 'empresa-b'));
  await assert.rejects(loadEmpresaForEdit({ id: 'empresa-a', fetchById: async () => complete }));
});

test('Falha de leitura bloqueia; retentativa relê em vez de usar linha parcial', async () => {
  let reads = 0;
  const fetchById = async () => {
    reads += 1;
    if (reads === 1) throw new Error('falha sintetica');
    return complete;
  };
  const args = { id: 'empresa-a', groupId: 'grupo-a', fetchById };
  await assert.rejects(loadEmpresaForEdit(args), /falha sintetica/);
  assert.equal(await loadEmpresaForEdit(args), complete);
  assert.equal(reads, 2);
});

test('Leitura pendente deixa de ser atual apos Novo ou troca de contexto', () => {
  const pending = { request: 1, current: 1, requestedScope: 'Empresa:grupo-a:', activeScope: 'Empresa:grupo-a:' };
  assert.equal(isEditRequestCurrent(pending), true);
  assert.equal(isEditRequestCurrent({ ...pending, current: 2 }), false);
  assert.equal(isEditRequestCurrent({ ...pending, activeScope: 'Empresa:grupo-b:' }), false);
  assert.equal(isEditRequestCurrent({ ...pending, activeScope: 'Empresa:grupo-a:empresa-b' }), false);
});

test('Empresa e Grupo sao mestres do tenant; vinculo string autoriza so empresa do mesmo Grupo', () => {
  assert.equal(isTenantMasterEntity('Empresa'), true);
  assert.equal(isTenantMasterEntity('GrupoEmpresarial'), true);
  assert.equal(isTenantMasterEntity('Cliente'), false);
  const user = { group_id: 'grupo-a', empresas_vinculadas: ['empresa-a'] };
  assert.equal(userTemAcessoEmpresa(user, { id: 'empresa-a', group_id: 'grupo-a' }), true);
  assert.equal(userTemAcessoEmpresa(user, { id: 'empresa-b', group_id: 'grupo-a' }), false);
  assert.equal(userTemAcessoEmpresa(user, { id: 'empresa-a', group_id: 'grupo-b' }), false);
  assert.equal(userTemAcessoEmpresa({
    group_id: 'grupo-a',
    empresas_vinculadas: [{ empresa_id: 'empresa-a', ativo: false }],
  }, { id: 'empresa-a', group_id: 'grupo-a' }), false);
});

test('Formulario usa gate efetivo e update nao reenvia configuracao fiscal oculta', async () => {
  const form = await readFile(new URL('../src/components/cadastros/EmpresaForm.jsx', import.meta.url), 'utf8');
  const viewer = await readFile(new URL('../src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx', import.meta.url), 'utf8');
  const block = await readFile(new URL('../src/components/cadastros/blocks/Bloco5Organizacional.jsx', import.meta.url), 'utf8');
  const policy = await readFile(new URL('../src/components/cadastros/cadastroEditLoadPolicy.js', import.meta.url), 'utf8');
  assert.match(form, /data-permission=\{permissaoFormulario\}/);
  assert.match(form, /hasCadastroEntityPermission\("Empresa", "editar"/);
  assert.match(form, /Cadastros\.Organizacional\.editar/);
  assert.match(viewer, /hasCadastroEntityPermission/);
  assert.match(viewer, /loadEmpresaForEdit\(/);
  assert.match(viewer, /isEditRequestCurrent/);
  assert.match(viewer, /empresaId: tenantMaster \? null : empresaId/);
  assert.match(policy, /!tenantMaster && !clean\.empresa_id && empresaId/);
  assert.match(block, /hasPermission\("Cadastros", "Organizacional", "visualizar"\)/);
  assert.match(block, /k === "Empresa" \|\| k === "GrupoEmpresarial" \? "Organizacional"/);
  assert.match(form, /ID do cadastro \(somente leitura\)/);
  assert.match(form, /<code className="break-all select-text">\{dadosIniciais\.id\}<\/code>/);
  assert.doesNotMatch(form, /Cadastros\.Empresa\.salvar/);
  assert.doesNotMatch(form, /empresa_id: contexto === ["']empresa["']/);
  assert.match(form, /dadosIniciais\?\.group_id \|\| formData\.group_id \|\| groupId/);
  assert.match(form, /dadosIniciais\?\.empresa_id/);
  assert.match(form, /if \(!dadosIniciais\?\.id\) \{\s*payload\.configuracao_fiscal/);
  assert.match(form, /Cadastros\.Empresa\.Certificado\.editar/);
  assert.match(form, /disabled=\{!podeEditarCertificado/);
  assert.doesNotMatch(form, /Cadastros\.Empresa\.certificado"/);
  assert.match(viewer, /classifyCadastroEditLoad\(/);
  assert.match(viewer, /mergeCadastroEditHydration\(/);
  assert.match(viewer, /Falha ao carregar registro completo/);
  assert.match(viewer, /editRequestRef\.current \+= 1;\s*setIsLoadingEdit\(false\)/);
});

test('perfil administrativo explicito salva e reabre Empresa sintética sem perda; perfil restrito e escopo alheio bloqueiam', async () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(String(key)) ?? null,
    setItem: (key, value) => values.set(String(key), String(value)),
    removeItem: (key) => values.delete(String(key)),
  };
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage } });
  const server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)),
    appType: 'custom', logLevel: 'silent', server: { middlewareMode: true },
  });
  const reopen = async (suffix) => (await server.ssrLoadModule(
    `/src/api/localBase44Client.js?empresa-edicao=${suffix}-${Date.now()}`,
  )).localBase44;
  try {
    const client = await reopen('setup');
    client.__local.reset();
    const db = client.__local.export();
    const target = db.Empresa[0];
    const other = db.Empresa[1];
    const otherBefore = structuredClone(other);
    const groupId = target.group_id;
    target.razao_social = 'Empresa Sintetica Original';
    target.nome_fantasia = 'Sintetica Original';
    target.cnpj = '00.000.000/0001-91';
    target.configuracao_fiscal = { serie_nfe: '9', ambiente_nfe: 'Homologacao' };
    db.PerfilAcesso.push({
      id: 'perfil-admin-sintetico', ativo: true, group_id: groupId,
      permissoes: { Cadastros: { Organizacional: ['visualizar', 'editar'] } },
    });
    db.PerfilAcesso.push({
      id: 'perfil-leitura-sintetico', ativo: true, group_id: groupId,
      permissoes: { Cadastros: { Organizacional: ['visualizar'] } },
    });
    db.PerfilAcesso.push({
      id: 'perfil-empresa-sem-organizacional', ativo: true, group_id: groupId,
      permissoes: { Cadastros: { Empresa: ['visualizar', 'editar'] } },
    });
    storage.setItem('erp_integra_local_db_v1', JSON.stringify(db));
    const useProfile = (perfilId) => {
      storage.setItem('erp_integra_local_user_v1', JSON.stringify({
        id: 'usuario-sintetico', role: 'user', mestre_local: false,
        perfil_acesso_id: perfilId, contexto_atual: 'grupo', grupo_atual_id: groupId,
        grupos_vinculados: [{ grupo_id: groupId, ativo: true }],
      }));
      storage.setItem('contexto_atual', 'grupo');
      storage.setItem('group_atual_id', groupId);
      storage.removeItem('empresa_atual_id');
    };

    useProfile('perfil-admin-sintetico');
    const admin = await reopen('admin');
    const loaded = await loadEmpresaForEdit({
      id: target.id, groupId, fetchById: (id) => admin.entities.Empresa.get(id),
    });
    assert.equal(loaded.cnpj, target.cnpj);
    assert.equal(loaded.configuracao_fiscal.serie_nfe, '9');
    await admin.entities.Empresa.update(target.id, {
      id: loaded.id, group_id: groupId, razao_social: 'Empresa Sintetica Editada',
      nome_fantasia: loaded.nome_fantasia, cnpj: loaded.cnpj,
    });

    const reopened = await reopen('reabertura');
    const saved = await loadEmpresaForEdit({
      id: target.id, groupId, fetchById: (id) => reopened.entities.Empresa.get(id),
    });
    assert.equal(saved.id, target.id);
    assert.equal(saved.razao_social, 'Empresa Sintetica Editada');
    assert.equal(saved.cnpj, target.cnpj);
    assert.equal(saved.empresa_id, target.empresa_id);
    assert.deepEqual(saved.configuracao_fiscal, target.configuracao_fiscal);
    const otherAfter = await reopened.entities.Empresa.get(other.id);
    assert.equal(otherAfter.id, otherBefore.id);
    assert.equal(otherAfter.razao_social, otherBefore.razao_social);
    assert.equal(otherAfter.cnpj, otherBefore.cnpj);
    assert.deepEqual(otherAfter.configuracao_fiscal, otherBefore.configuracao_fiscal);
    const updateAudit = reopened.__local.export().AuditLog.find((row) => row.entidade === 'Empresa' && row.registro_id === target.id && row.acao === 'Atualizacao');
    assert.ok(updateAudit);
    assert.equal(updateAudit.group_id, groupId);
    assert.equal(updateAudit.usuario_id, 'usuario-sintetico');
    assert.equal(updateAudit.dados_anteriores.razao_social, 'Empresa Sintetica Original');
    assert.equal(updateAudit.dados_novos.razao_social, 'Empresa Sintetica Editada');
    assert.equal(updateAudit.sucesso, true);

    await assert.rejects(loadEmpresaForEdit({
      id: target.id, groupId, empresaId: other.id,
      fetchById: (id) => reopened.entities.Empresa.get(id),
    }), /fora do contexto/);
    useProfile('perfil-leitura-sintetico');
    const restricted = await reopen('restrito');
    await assert.rejects(restricted.entities.Empresa.update(target.id, {
      group_id: groupId, razao_social: 'Alteracao Negada',
    }), /Permissao negada/);
    assert.equal((await restricted.entities.Empresa.get(target.id)).razao_social, 'Empresa Sintetica Editada');
    // Escopo mestre (#228): lista Empresa por group_id mesmo com empresa_id no contexto da invocacao.
    storage.setItem('contexto_atual', 'empresa');
    storage.setItem('empresa_atual_id', target.id);
    const companyContext = await reopen('lista-mestre');
    const grouped = await companyContext.functions.invoke('entityListSorted', {
      entityName: 'Empresa',
      filter: buildMultiempresaReadFilter({ groupId, empresaId: null }),
      group_id: groupId,
      empresa_id: target.id,
      sortField: 'id',
      sortDirection: 'asc',
      limit: 10,
    });
    assert.deepEqual(new Set(grouped.data.map((row) => row.id)), new Set([target.id, other.id]));
    useProfile('perfil-empresa-sem-organizacional');
    const incompatible = await reopen('empresa-sem-organizacional');
    await assert.rejects(incompatible.entities.Empresa.update(target.id, {
      group_id: groupId, razao_social: 'Alteracao Negada',
    }), /Permissao negada/);
  } finally {
    await server.close();
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete globalThis.window;
  }
});

test("visualizador V24: gate Organizacional no data-permission e GrupoEmpresarial self-id", async () => {
  const viewer = await readFile(new URL("../src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx", import.meta.url), "utf8");
  assert.match(viewer, /permSection = isTenantMasterEntity\(ENTITY\) \? "Organizacional"/);
  assert.match(viewer, /cadastroPerm\("criar"\)/);
  assert.match(viewer, /cadastroPerm\("visualizar"\)/);
  assert.match(viewer, /extraGroupOr: grupoSelfOr/);
  assert.match(viewer, /NÃO cair em codigo\/sigla/);
  assert.doesNotMatch(viewer, /variants = variants\.concat\(\['nome', 'descricao', 'titulo', 'sigla', 'codigo'\]\)/);
});
