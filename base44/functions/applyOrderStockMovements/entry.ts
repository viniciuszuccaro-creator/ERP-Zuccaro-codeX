import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getUserAndPerfil, backendHasPermission, assertContextPresence, ensureContextFields } from './_lib/guard.js';

function buildOrderStockAuditPayload(pedido = {}, movimentos = []) {
  const list = Array.isArray(movimentos) ? movimentos : [];
  return {
    pedido_id: pedido?.id || null,
    numero_pedido: pedido?.numero_pedido || null,
    empresa_id: pedido?.empresa_id || null,
    group_id: pedido?.group_id || pedido?.grupo_id || null,
    itens_processados: list.length,
    produtos_ids: list.map((item) => item.produto_id).filter(Boolean).slice(0, 50),
    quantidade_total: list.reduce((total, item) => total + Number(item.quantidade || 0), 0),
  };
}
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { user, perfil } = await getUserAndPerfil(base44);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userAgent = req.headers.get('user-agent') || '';
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || '';

    const body = await req.json().catch(() => ({}));
    const pedido = body?.pedido;
    if (!pedido?.empresa_id) {
      return Response.json({ error: 'empresa_id obrigatório no pedido' }, { status: 400 });
    }

    // Multiempresa e RBAC
    const ctxErr = assertContextPresence(pedido || {}, true);
    if (ctxErr) return ctxErr;
    const scopedPedido = await ensureContextFields(base44, pedido, true);
    if (scopedPedido instanceof Response) return scopedPedido;
    Object.assign(pedido, scopedPedido);

    const allowed = backendHasPermission(perfil, 'Comercial', 'Pedido', 'editar', user.role);
    if (!allowed) {
      try {
        await base44.entities.AuditLog.create({
          usuario: user.full_name || user.email || 'Usuário',
          usuario_id: user.id,
          empresa_id: pedido.empresa_id || null,
          group_id: pedido.group_id || pedido.grupo_id || null,
          acao: 'Bloqueio',
          modulo: 'Comercial',
          tipo_auditoria: 'seguranca',
          entidade: 'Pedido',
          registro_id: pedido.id || null,
          descricao: 'RBAC: tentativa de baixa de estoque sem permissão (Comercial.Pedido.editar)',
          ip_address: ip,
          user_agent: userAgent,
          data_hora: new Date().toISOString(),
        });
      } catch (_) {}
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const itens = Array.isArray(pedido.itens_revenda) ? pedido.itens_revenda : [];
    let movimentos = 0;
    const movimentosDetalhes = [];

    for (const item of itens) {
      if (!item?.produto_id || !item?.quantidade) continue;

      const prods = await base44.entities.Produto.filter({ id: item.produto_id, empresa_id: pedido.empresa_id });
      const produto = prods?.[0];
      if (!produto) continue;

      const estoqueAtual = Number(produto.estoque_atual || 0);
      const qtd = Number(item.quantidade || 0);
      if (qtd <= 0) continue;

      const novoEstoque = Math.max(0, estoqueAtual - qtd);

      await base44.entities.MovimentacaoEstoque.create({
        empresa_id: pedido.empresa_id,
        group_id: pedido.group_id || pedido.grupo_id || null,
        tipo_movimento: 'saida',
        origem_movimento: 'pedido',
        origem_documento_id: pedido.id || `temp_${Date.now()}`,
        produto_id: item.produto_id,
        produto_descricao: item.descricao || item.produto_descricao || produto.descricao,
        codigo_produto: item.codigo_sku || produto.codigo,
        quantidade: qtd,
        unidade_medida: item.unidade || produto.unidade_medida || 'UN',
        estoque_anterior: estoqueAtual,
        estoque_atual: novoEstoque,
        data_movimentacao: new Date().toISOString(),
        documento: pedido.numero_pedido,
        motivo: `Baixa automática - Pedido ${pedido.id ? 'atualizado' : 'criado'} aprovado`,
        responsavel: user.full_name || user.email || 'Usuário',
        aprovado: true,
      });

      await base44.entities.Produto.update(item.produto_id, { estoque_atual: novoEstoque });

      movimentosDetalhes.push({
        produto_id: item.produto_id,
        codigo_produto: item.codigo_sku || produto.codigo,
        estoque_anterior: estoqueAtual,
        quantidade: qtd,
        estoque_atual: novoEstoque
      });

      movimentos += 1;
    }

    // Auditoria
    await base44.entities.AuditLog.create({
      usuario: user.full_name || user.email || 'Usuário',
      usuario_id: user.id,
      empresa_id: pedido.empresa_id,
      group_id: pedido.group_id || pedido.grupo_id || null,
      acao: 'Edicao',
      modulo: 'Estoque',
      tipo_auditoria: 'entidade',
      entidade: 'MovimentacaoEstoque',
      registro_id: pedido.id || null,
      descricao: `Baixa de estoque por aprovação de pedido (#movimentos=${movimentos})`,
      dados_novos: buildOrderStockAuditPayload(pedido, movimentosDetalhes),
      ip_address: ip,
      user_agent: userAgent,
      data_hora: new Date().toISOString(),
    });

    return Response.json({ ok: true, movimentos });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});