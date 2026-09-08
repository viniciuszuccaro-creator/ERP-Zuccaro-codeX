import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getUserAndPerfil, backendHasPermission, assertContextPresence, ensureContextFields } from './_lib/guard.js';
import { buildReservaMov, updateProdutoReservado } from './_lib/orderReservationUtils.js';

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
    modo: 'reserva',
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

    const ctxErr = assertContextPresence(pedido || {}, true);
    if (ctxErr) return ctxErr;
    const scopedPedido = await ensureContextFields(base44, pedido, true);
    if (scopedPedido instanceof Response) return scopedPedido;
    Object.assign(pedido, scopedPedido);

    // Reserva exige permissao de aprovar (nao saida via editar)
    const allowed = backendHasPermission(perfil, 'Comercial', 'Pedido', 'aprovar', user.role);
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
          descricao: 'RBAC: tentativa de reserva de estoque sem permissão (Comercial.Pedido.aprovar)',
          ip_address: ip,
          user_agent: userAgent,
          data_hora: new Date().toISOString(),
        });
      } catch (error) {
        console.error('[applyOrderStockMovements] Falha ao auditar bloqueio RBAC', error?.message || error);
      }
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const itens = Array.isArray(pedido.itens_revenda) ? pedido.itens_revenda : [];
    let movimentos = 0;
    const movimentosDetalhes = [];
    const erros = [];

    for (const item of itens) {
      if (!item?.produto_id || !item?.quantidade) continue;
      const qtd = Number(item.quantidade || 0);
      if (qtd <= 0) continue;

      const prods = await base44.entities.Produto.filter({
        id: item.produto_id,
        empresa_id: pedido.empresa_id,
        group_id: pedido.group_id || pedido.grupo_id || undefined,
      });
      const produto = prods?.[0];
      if (!produto) {
        erros.push(`Produto ${item.produto_id} nao encontrado no escopo`);
        continue;
      }

      // Idempotencia: nao duplicar reserva do mesmo pedido+produto
      const existentes = await base44.entities.MovimentacaoEstoque.filter({
        origem_documento_id: pedido.id,
        produto_id: item.produto_id,
        tipo_movimento: 'reserva',
      }, undefined, 5);
      if (Array.isArray(existentes) && existentes.length > 0) {
        movimentosDetalhes.push({
          produto_id: item.produto_id,
          skipped: true,
          motivo: 'reserva_ja_existente',
        });
        continue;
      }

      const estoqueAtual = Number(produto.estoque_atual || 0);
      const reservadoAtual = Number(produto.estoque_reservado || 0);
      const disponivel = estoqueAtual - reservadoAtual;
      if (disponivel < qtd) {
        erros.push(`Estoque insuficiente para ${produto.descricao || item.produto_id}: disponivel ${disponivel}`);
        continue;
      }

      await updateProdutoReservado(base44, produto, qtd);
      const movPayload = {
        ...buildReservaMov(produto, item, pedido, user),
        origem_documento_id: pedido.id || null,
        documento: pedido.numero_pedido || null,
        estoque_anterior: estoqueAtual,
        estoque_atual: estoqueAtual,
        reservado_anterior: reservadoAtual,
        reservado_atual: reservadoAtual + qtd,
      };
      await base44.entities.MovimentacaoEstoque.create(movPayload);

      movimentosDetalhes.push({
        produto_id: item.produto_id,
        codigo_produto: item.codigo_sku || produto.codigo,
        estoque_anterior: estoqueAtual,
        quantidade: qtd,
        reservado_atual: reservadoAtual + qtd,
      });
      movimentos += 1;
    }

    if (erros.length && movimentos === 0) {
      return Response.json({ error: 'Falha ao reservar estoque', detalhes: erros }, { status: 400 });
    }

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
      descricao: `Reserva de estoque por pedido (#movimentos=${movimentos})`,
      dados_novos: { ...buildOrderStockAuditPayload(pedido, movimentosDetalhes), erros },
      ip_address: ip,
      user_agent: userAgent,
      data_hora: new Date().toISOString(),
    });

    return Response.json({ ok: true, movimentos, modo: 'reserva', erros });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});
