import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Seed Multiempresa (Grupo atual + empresas do grupo + dados base)
// Quando body.group_id não é informado, tenta detectar o grupo atual pelas empresas existentes.
// NUNCA cria novo grupo/empresas se já houver contexto detectável (Regra-Mãe: melhorar, não recriar).
// Admin-only. Multiempresa absoluta. Auditado.
// Payload opcional:
// { group_id?, counts?:{clientes,produtos,fornecedores}, strategy?:'merge'|'override'|'skip', dryRun?:false }

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
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const dryRun = !!body?.dryRun;
    const minimal = body?.minimal === true;
    const defaults = minimal ? { clientes: 10, produtos: 10, fornecedores: 3 } : { clientes: 100, produtos: 100, fornecedores: 20 };
    const counts = {
      clientes: Math.max(0, Number(body?.counts?.clientes ?? defaults.clientes)),
      produtos: Math.max(0, Number(body?.counts?.produtos ?? defaults.produtos)),
      fornecedores: Math.max(0, Number(body?.counts?.fornecedores ?? defaults.fornecedores)),
    };
    const strategy = (body?.strategy === 'override' || body?.strategy === 'merge') ? body.strategy : 'skip';

    // 0) Descoberta de grupo/empresas existente
    let groupId = body?.group_id || null;
    let empresasDoGrupo = [];
    try {
      if (!groupId) {
        const todas = await base44.asServiceRole.entities.Empresa.filter({}, undefined, 1000);
        const comGrupo = (todas || []).filter(e => !!e.group_id);
        if (comGrupo.length) {
          groupId = comGrupo[0].group_id; // usa o grupo detectado
          empresasDoGrupo = comGrupo.filter(e => e.group_id === groupId);
        }
      } else {
        empresasDoGrupo = await base44.asServiceRole.entities.Empresa.filter({ group_id: groupId }, undefined, 1000);
      }
    } catch (_) {}

    // 1) Fallback: se não houver nenhuma empresa e também não veio group_id, permite criar grupo+empresas (primeira inicialização)
    let criouGrupoAgora = false;
    if (!groupId && empresasDoGrupo.length === 0) {
      if (!dryRun) {
        const grupo = await base44.asServiceRole.entities.GrupoEmpresarial.create({ nome_do_grupo: `Grupo Seed ${todayISODate()}` }).catch(() => null);
        groupId = grupo?.id || null;
        if (!groupId) return Response.json({ error: 'Falha ao criar grupo' }, { status: 500 });
        criouGrupoAgora = true;
        // cria empresas padrão (1 se minimal=true; ou body.empresas; senão 3)
        const companiesToCreate = Math.max(1, Number(body?.empresas ?? (minimal ? 1 : 3)));
        for (let i = 1; i <= companiesToCreate; i++) {
          const emp = await base44.asServiceRole.entities.Empresa.create({
            group_id: groupId,
            razao_social: `Empresa ${i} • ${todayISODate()}`,
            nome_fantasia: `Empresa ${i}`,
            cnpj: randCNPJ(),
            regime_tributario: 'Simples Nacional',
            usa_multiempresa: true,
          }).catch(() => null);
          if (emp?.id) empresasDoGrupo.push(emp);
        }
      } else {
        groupId = 'dry_group_id';
        empresasDoGrupo = [1,2,3].map(i => ({ id: `dry_emp_${i}`, nome_fantasia: `Empresa ${i}` }));
      }
    }

    if (!groupId) return Response.json({ error: 'Contexto inválido: group_id ausente e nenhuma empresa encontrada' }, { status: 400 });

    // 2) Configurações base no nível do GRUPO (PlanoDeContas, CentroCusto)
    const createdGroupConfigs = { PlanoDeContas: 0, CentroCusto: 0 };
    if (!dryRun) {
      try {
        const existsPlano = await base44.asServiceRole.entities.PlanoDeContas.filter({ group_id: groupId }, undefined, 1);
        if (!existsPlano?.length) {
          const plano = await base44.asServiceRole.entities.PlanoDeContas.create({ group_id: groupId, codigo: '1', descricao: 'Plano Padrão Grupo', tipo: 'Misto' }).catch(() => null);
          if (plano?.id) createdGroupConfigs.PlanoDeContas++;
        }
      } catch (_) {}
      try {
        const needed = [
          { codigo: 'ADM', descricao: 'Administrativo', tipo: 'Despesa' },
          { codigo: 'COM', descricao: 'Comercial', tipo: 'Despesa' },
          { codigo: 'OPR', descricao: 'Operacional', tipo: 'Despesa' },
        ];
        for (const c of needed) {
          const ja = await base44.asServiceRole.entities.CentroCusto.filter({ group_id: groupId, codigo: c.codigo }, undefined, 1);
          if (!ja?.length) {
            await base44.asServiceRole.entities.CentroCusto.create({ ...c, group_id: groupId }).catch(() => {});
            createdGroupConfigs.CentroCusto++;
          }
        }
      } catch (_) {}
    }

    // 3) Dados por empresa (Clientes, Produtos, Fornecedores) nas EMPRESAS EXISTENTES do grupo
    const perEmpresa = [];
    if (!dryRun) {
      for (const emp of empresasDoGrupo) {
        const created = { Cliente: 0, Produto: 0, Fornecedor: 0 };
        // Fornecedores
        for (let i = 0; i < counts.fornecedores; i++) {
          await base44.asServiceRole.entities.Fornecedor.create({
            group_id: groupId,
            empresa_dona_id: emp.id,
            nome: `Fornecedor ${i+1} - ${emp.nome_fantasia || emp.razao_social}`,
            categoria: 'Serviços',
            status_fornecedor: 'Ativo'
          }).then(() => { created.Fornecedor++; }).catch(() => {});
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
          }).then(() => { created.Cliente++; }).catch(() => {});
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
          }).then(() => { created.Produto++; }).catch(() => {});
        }
        perEmpresa.push({ empresa_id: emp.id, created });
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
      } catch (_) {
        propagation = { ok: false };
      }
    }

    // Auditoria final
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        usuario: user.full_name || user.email || 'Usuário',
        usuario_id: user.id,
        acao: 'Criação',
        modulo: 'Sistema',
        tipo_auditoria: 'sistema',
        entidade: 'SeedMultiCompany',
        descricao: dryRun ? 'DRY-RUN seed multiempresa (grupo atual)' : 'Seed multiempresa executado (grupo atual)',
        dados_novos: { group_id: groupId, empresas: empresasDoGrupo.map(e => e.id), counts, createdGroupConfigs, perEmpresa, propagation, criouGrupoAgora },
        data_hora: new Date().toISOString(),
      });
    } catch {}

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