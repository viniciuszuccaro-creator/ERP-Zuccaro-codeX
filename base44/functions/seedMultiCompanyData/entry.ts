import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { requireEntityGuard } from './_lib/security/guardCallPolicy.js';

// Seed Multiempresa (Grupo atual + empresas do grupo + dados base)
// Exige group_id explicito; a inicializacao sem grupo requer ambiente vazio, flag e token interno.
// NUNCA escolhe automaticamente um grupo entre contextos existentes.
// Admin-only. Multiempresa absoluta. Auditado.
// Payload opcional:
// { group_id?, empresa_id?, empresas_ids?, initialize_if_empty?, counts?, strategy?, dryRun? }

const reportSeedFailure = (operation, error, context = {}) => {
  console.error('[seedMultiCompanyData] ' + operation, {
    error: error?.message || String(error),
    ...context,
  });
};

function normalizeCount(value, fallback, max = 500) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(0, Math.floor(parsed))) : fallback;
}

function randCNPJ() {
  const base = String(Math.floor(1_000_000_0000000 + Math.random() * 8_999_999_999999));
  return base.slice(0, 14);
}
function todayISODate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    let user = null;
    try {
      user = await base44.auth.me();
    } catch (error) {
      reportSeedFailure('autenticacao', error);
    }
    const internalToken = body?.internal_token || req.headers.get('x-internal-token') || null;
    const expectedToken = Deno.env.get('DEPLOY_AUDIT_TOKEN') || null;
    const trustedInternal = Boolean(internalToken && expectedToken && internalToken === expectedToken);
    if (!user && !trustedInternal) {
      return Response.json({ error: 'Forbidden: internal automation token required' }, { status: 403 });
    }
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const dryRun = !!body?.dryRun;
    const minimal = body?.minimal === true;
    const defaults = minimal ? { clientes: 10, produtos: 10, fornecedores: 3 } : { clientes: 100, produtos: 100, fornecedores: 20 };
    const counts = {
      clientes: normalizeCount(body?.counts?.clientes, defaults.clientes),
      produtos: normalizeCount(body?.counts?.produtos, defaults.produtos),
      fornecedores: normalizeCount(body?.counts?.fornecedores, defaults.fornecedores),
    };
    const strategy = (body?.strategy === 'override' || body?.strategy === 'merge') ? body.strategy : 'skip';

    // 0) Resolve somente o grupo informado. Inicializacao sem grupo e explicita e restrita.
    let groupId = body?.group_id || body?.grupo_id || null;
    let empresasDoGrupo = [];
    let criouGrupoAgora = false;
    const initializeIfEmpty = body?.initialize_if_empty === true;

    if (!groupId) {
      if (!initializeIfEmpty) {
        return Response.json({ error: 'group_id obrigatorio para seed multiempresa' }, { status: 400 });
      }
      if (!trustedInternal) {
        return Response.json({ error: 'Inicializacao exige token interno' }, { status: 403 });
      }
      const existingCompanies = await base44.asServiceRole.entities.Empresa.filter({}, undefined, 1);
      if (existingCompanies?.length) {
        return Response.json({ error: 'Inicializacao bloqueada: informe o group_id existente' }, { status: 409 });
      }

      const companiesToCreate = normalizeCount(body?.empresas, minimal ? 1 : 3, 20) || 1;
      if (dryRun) {
        groupId = 'dry_group_id';
        empresasDoGrupo = Array.from({ length: companiesToCreate }, (_, index) => ({
          id: `dry_emp_${index + 1}`,
          nome_fantasia: `Empresa ${index + 1}`,
          group_id: groupId,
        }));
      } else {
        const grupo = await base44.asServiceRole.entities.GrupoEmpresarial.create({
          nome_do_grupo: `Grupo Seed ${todayISODate()}`,
        });
        groupId = grupo?.id || null;
        if (!groupId) return Response.json({ error: 'Falha ao criar grupo' }, { status: 500 });
        criouGrupoAgora = true;

        for (let i = 1; i <= companiesToCreate; i++) {
          try {
            const empresa = await base44.asServiceRole.entities.Empresa.create({
              group_id: groupId,
              razao_social: `Empresa ${i} - ${todayISODate()}`,
              nome_fantasia: `Empresa ${i}`,
              cnpj: randCNPJ(),
              regime_tributario: 'Simples Nacional',
              usa_multiempresa: true,
            });
            if (empresa?.id) empresasDoGrupo.push(empresa);
          } catch (error) {
            reportSeedFailure('criar-empresa-inicial', error, { group_id: groupId, indice: i });
          }
        }
        if (!empresasDoGrupo.length) {
          return Response.json({ error: 'Nenhuma empresa foi criada para o grupo' }, { status: 500 });
        }
      }
    } else {
      const empresas = await base44.asServiceRole.entities.Empresa.filter({ group_id: groupId }, undefined, 500);
      const empresasById = new Map((empresas || []).map((empresa) => [empresa.id, empresa]));
      const requestedEmpresaIds = Array.isArray(body?.empresas_ids) && body.empresas_ids.length
        ? [...new Set(body.empresas_ids)]
        : (body?.empresa_id ? [body.empresa_id] : []);
      const idsForaDoGrupo = requestedEmpresaIds.filter((id) => !empresasById.has(id));
      if (idsForaDoGrupo.length) {
        return Response.json({ error: 'Empresa fora do grupo informado', empresas_ids: idsForaDoGrupo }, { status: 403 });
      }
      empresasDoGrupo = requestedEmpresaIds.length
        ? requestedEmpresaIds.map((id) => empresasById.get(id))
        : [...empresasById.values()];
      if (!empresasDoGrupo.length) {
        return Response.json({ error: 'Nenhuma empresa encontrada no grupo informado' }, { status: 400 });
      }

      if (user) {
        const guardFailure = await requireEntityGuard(base44, {
          module: 'Sistema',
          section: 'Ferramentas',
          action: dryRun ? 'executar' : 'editar',
          group_id: groupId,
          empresa_id: body?.empresa_id || null,
        });
        if (guardFailure) return guardFailure;
      }
    }

    // 2) Configurações base no nível do GRUPO (PlanoDeContas, CentroCusto)
    const createdGroupConfigs = { PlanoDeContas: 0, CentroCusto: 0 };
    if (!dryRun) {
      try {
        const existsPlano = await base44.asServiceRole.entities.PlanoDeContas.filter({ group_id: groupId }, undefined, 1);
        if (!existsPlano?.length) {
          const plano = await base44.asServiceRole.entities.PlanoDeContas.create({ group_id: groupId, codigo: '1', descricao: 'Plano Padrão Grupo', tipo: 'Misto' });
          if (plano?.id) createdGroupConfigs.PlanoDeContas++;
        }
      } catch (error) {
        reportSeedFailure('configurar-plano-contas', error, { group_id: groupId });
      }
      try {
        const needed = [
          { codigo: 'ADM', descricao: 'Administrativo', tipo: 'Despesa' },
          { codigo: 'COM', descricao: 'Comercial', tipo: 'Despesa' },
          { codigo: 'OPR', descricao: 'Operacional', tipo: 'Despesa' },
        ];
        for (const c of needed) {
          const ja = await base44.asServiceRole.entities.CentroCusto.filter({ group_id: groupId, codigo: c.codigo }, undefined, 1);
          if (!ja?.length) {
            await base44.asServiceRole.entities.CentroCusto.create({ ...c, group_id: groupId });
            createdGroupConfigs.CentroCusto++;
          }
        }
      } catch (error) {
        reportSeedFailure('configurar-centros-custo', error, { group_id: groupId });
      }
    }

    // 3) Dados por empresa (Clientes, Produtos, Fornecedores) nas EMPRESAS EXISTENTES do grupo
    const perEmpresa = [];
    if (!dryRun) {
      for (const emp of empresasDoGrupo) {
        const created = { Cliente: 0, Produto: 0, Fornecedor: 0 };
        const failed = { Cliente: 0, Produto: 0, Fornecedor: 0 };
        // Fornecedores
        for (let i = 0; i < counts.fornecedores; i++) {
          await base44.asServiceRole.entities.Fornecedor.create({
            group_id: groupId,
            empresa_dona_id: emp.id,
            nome: `Fornecedor ${i+1} - ${emp.nome_fantasia || emp.razao_social}`,
            categoria: 'Serviços',
            status_fornecedor: 'Ativo'
          }).then(() => { created.Fornecedor++; }).catch((error) => {
            failed.Fornecedor++;
            reportSeedFailure('criar-fornecedor', error, { group_id: groupId, empresa_id: emp.id });
          });
        }
        // Clientes
        for (let i = 0; i < counts.clientes; i++) {
          await base44.asServiceRole.entities.Cliente.create({
            group_id: groupId,
            empresa_id: emp.id,
            tipo: i % 2 === 0 ? 'Pessoa Jurídica' : 'Pessoa Física',
            nome: `Cliente ${i+1} - ${emp.nome_fantasia || emp.razao_social}`,
            contatos: [{ nome: 'Contato', tipo: 'WhatsApp', valor: `55119${String(10000000+i)}` }],
            origem_cadastro: 'ERP',
          }).then(() => { created.Cliente++; }).catch((error) => {
            failed.Cliente++;
            reportSeedFailure('criar-cliente', error, { group_id: groupId, empresa_id: emp.id });
          });
        }
        // Produtos
        const bitolas = [6.3,8.0,10.0,12.5,16.0,20.0,25.0,32.0];
        for (let i = 0; i < counts.produtos; i++) {
          const eh_bitola = i % 2 === 0;
          const diam = bitolas[i % bitolas.length];
          await base44.asServiceRole.entities.Produto.create({
            group_id: groupId,
            empresa_id: emp.id,
            descricao: eh_bitola ? `Aço CA-50 Ø ${diam}mm` : `Produto ${i+1}`,
            unidade_medida: eh_bitola ? 'KG' : 'UN',
            unidade_estoque: 'KG',
            eh_bitola,
            tipo_item: eh_bitola ? 'Matéria-Prima Produção' : 'Revenda',
            bitola_diametro_mm: eh_bitola ? diam : undefined,
            peso_teorico_kg_m: eh_bitola ? 0.5 : undefined,
            estoque_atual: eh_bitola ? 1200 : 100,
            estoque_disponivel: eh_bitola ? 1200 : 100,
            preco_venda: eh_bitola ? 5.5 : 100,
            custo_medio: eh_bitola ? 4.8 : 80,
          }).then(() => { created.Produto++; }).catch((error) => {
            failed.Produto++;
            reportSeedFailure('criar-produto', error, { group_id: groupId, empresa_id: emp.id });
          });
        }
        perEmpresa.push({ empresa_id: emp.id, created, failed });
      }
    }

    // 4) Propagar configurações do GRUPO para as EMPRESAS do grupo atual
    let propagation = null;
    if (!dryRun) {
      try {
        const res = await base44.asServiceRole.functions.invoke('propagateGroupConfigs', {
          group_id: groupId,
          direction: 'grupo_to_empresas',
          entidades: ['PlanoDeContas','CentroCusto'],
          strategy,
          internal_token: Deno.env.get('DEPLOY_AUDIT_TOKEN') || undefined,
        });
        propagation = res?.data || { ok: true };
      } catch (error) {
        reportSeedFailure('propagar-configuracoes', error, { group_id: groupId });
        propagation = { ok: false, failed: true };
      }
    }

    // Auditoria final
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        usuario: user ? (user.full_name || user.email || 'Usuario') : 'Sistema Agendado',
        usuario_id: user?.id || null,
        acao: 'Criação',
        modulo: 'Sistema',
        tipo_auditoria: 'sistema',
        entidade: 'SeedMultiCompany',
        descricao: dryRun ? 'DRY-RUN seed multiempresa (grupo atual)' : 'Seed multiempresa executado (grupo atual)',
        dados_novos: { group_id: groupId, empresas: empresasDoGrupo.map(e => e.id), counts, createdGroupConfigs, perEmpresa, propagation, criouGrupoAgora },
        group_id: groupId,
        empresa_id: body?.empresa_id || null,
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      reportSeedFailure('auditoria', error, { group_id: groupId, empresa_id: body?.empresa_id || null });
    }

    return Response.json({
      ok: true,
      dryRun,
      group_id: groupId,
      empresas: empresasDoGrupo.map(e => ({ id: e.id, nome: e.nome_fantasia || e.razao_social })),
      createdGroupConfigs,
      perEmpresa,
      propagation,
      created_new_group: criouGrupoAgora,
    });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});