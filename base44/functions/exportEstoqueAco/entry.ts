import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@4.0.0';
import { getUserAndPerfil, assertPermission } from './_lib/guard.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // RBAC: requer permissão para exportar no módulo Estoque
    const ctx = await getUserAndPerfil(base44);
    const permErr = await assertPermission(base44, ctx, 'Estoque', 'Produto', 'exportar');
    if (permErr) return permErr;

    let body = {};
    try { body = await req.json(); } catch (error) { body = {}; }

    const filtros = body?.filtros || {};

    // Prefer products flagged as steel rebar/bitola; fallback to group 'Bitola'
    const primaryFilter = { ...filtros, eh_bitola: true };
    let produtos = await base44.entities.Produto.filter(primaryFilter, 'descricao', 1000);

    if (!Array.isArray(produtos) || produtos.length === 0) {
      const fallbackFilter = { ...filtros, grupo: 'Bitola' };
      try {
        produtos = await base44.entities.Produto.filter(fallbackFilter, 'descricao', 1000);
      } catch {
        produtos = [];
      }
    }

    // Generate PDF (landscape to fit columns)
    const doc = new jsPDF({ orientation: 'landscape' });

    // Header
    doc.setFontSize(16);
    doc.text('Relatório de Estoque de Aço (Bitolas)', 14, 14);
    doc.setFontSize(10);
    const now = new Date();
    doc.text(`Gerado por: ${user.full_name || user.email} • ${now.toLocaleString('pt-BR')}`, 14, 20);
    if (filtros?.empresa_id) doc.text(`Empresa: ${String(filtros.empresa_id)}`, 14, 26);
    if (filtros?.group_id) doc.text(`Grupo: ${String(filtros.group_id)}`, 90, 26);

    // Table headers
    doc.setFontSize(11);
    const headers = ['Descrição', 'Diâmetro (mm)', 'Tipo Aço', 'Estoque (kg)', 'Reservado (kg)', 'Disponível (kg)', 'Custo Médio', 'Preço Venda'];
    let y = 36;
    let x = 14;
    const colWidths = [75, 30, 30, 32, 32, 32, 32, 32]; // sum fits A4 landscape width margins

    headers.forEach((h, idx) => {
      doc.text(h, x, y);
      x += colWidths[idx];
    });

    doc.setFontSize(9);
    y += 8;

    const addRow = (vals) => {
      if (y > 190) { // new page if near bottom
        doc.addPage('landscape');
        y = 20;
      }
      let cx = 14;
      vals.forEach((v, idx) => {
        const str = String(v ?? '-');
        doc.text(str, cx, y);
        cx += colWidths[idx];
      });
      y += 7;
    };

    const fmtNum = (n) => {
      const v = Number(n || 0);
      return isFinite(v) ? v.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '-';
    };

    const fmtMoney = (n) => (n == null ? '-' : `R$ ${Number(n).toFixed(2).replace('.', ',')}`);

    (produtos || []).forEach((p) => {
      const estoque = Number(p.estoque_atual) || 0;
      const reservado = Number(p.estoque_reservado) || 0;
      const disponivel = (Number.isFinite(Number(p.estoque_disponivel)) ? Number(p.estoque_disponivel) : (estoque - reservado));

      addRow([
        p.descricao || p.codigo || '-',
        p.bitola_diametro_mm ?? '-',
        p.tipo_aco ?? '-',
        fmtNum(estoque),
        fmtNum(reservado),
        fmtNum(disponivel),
        fmtMoney(p.custo_medio),
        fmtMoney(p.preco_venda),
      ]);
    });

    // Footer summary
    const totalItens = (produtos || []).length;
    const somaEstoque = (produtos || []).reduce((s, p) => s + (Number(p.estoque_atual) || 0), 0);
    y += 6;
    if (y > 190) { doc.addPage('landscape'); y = 20; }
    doc.setFontSize(10);
    doc.text(`Itens: ${totalItens}  •  Estoque total (kg): ${fmtNum(somaEstoque)}`, 14, y);

    const pdfBytes = doc.output('arraybuffer');

    // Audit trail (exportacao sensivel: falha de auditoria nao e silenciosa)
    const groupId = filtros?.group_id || filtros?.grupo_id
      || user?.grupo_atual_id || user?.grupo_padrao_id || user?.group_id || null;
    const empresaId = filtros?.empresa_id || user?.empresa_atual_id || user?.empresa_padrao_id || null;
    try {
      await base44.entities.AuditLog.create({
        usuario: user.full_name || user.email || 'Usuário',
        usuario_id: user.id,
        acao: 'Exportação',
        modulo: 'Estoque',
        tipo_auditoria: 'entidade',
        entidade: 'Produto',
        descricao: `Exportou relatório de aço/bitolas (${totalItens} itens).`,
        dados_novos: { total_itens: totalItens, tem_filtros: !!filtros && Object.keys(filtros).length > 0 },
        empresa_id: empresaId,
        group_id: groupId,
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[exportEstoqueAco] Falha ao registrar auditoria de exportacao', error?.message || error);
      return Response.json({
        error: 'Falha ao registrar auditoria da exportacao sensivel',
        detail: String(error?.message || error),
      }, { status: 500 });
    }

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=estoque_aco.pdf'
      }
    });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});