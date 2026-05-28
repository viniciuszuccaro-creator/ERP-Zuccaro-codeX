import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";

const money = (value) => Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

export default function RelatorioFinanceiroLogistica() {
  const { empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { user } = useUser();
  const effectiveEmpresaId = empresaAtual?.id || null;
  const effectiveGroupId = grupoAtual?.id || empresaAtual?.group_id || null;
  const contextoValido = Boolean(effectiveEmpresaId || effectiveGroupId);
  const canView = hasPermission("Expedicao", "Financeiro Logistica", "visualizar") || hasPermission("Expedicao", "Relatorios", "visualizar") || hasPermission("Financeiro", "Relatorios", "visualizar");

  const [filtros, setFiltros] = React.useState({ start_date: "", end_date: "", empresa_id: "", group_id: "" });

  React.useEffect(() => {
    setFiltros((f) => ({ ...f, empresa_id: effectiveEmpresaId || "", group_id: effectiveGroupId || "" }));
  }, [effectiveEmpresaId, effectiveGroupId]);

  const auditarRelatorio = async ({ acao, sucesso = true, motivo = null, detalhes = {} }) => {
    try {
      await base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || "Usuario",
        usuario_id: user?.id,
        acao,
        modulo: "Expedicao",
        entidade: "RelatorioFinanceiroLogistica",
        tipo_auditoria: sucesso ? "operacional" : "seguranca",
        empresa_id: effectiveEmpresaId,
        group_id: effectiveGroupId,
        grupo_id: effectiveGroupId,
        sucesso,
        resultado: sucesso ? "sucesso" : "bloqueado",
        motivo,
        detalhes,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn("Falha ao auditar relatorio financeiro logistico", error);
    }
  };

  const { data, refetch, isFetching } = useQuery({
    queryKey: ["log-fin-report", filtros, effectiveGroupId, effectiveEmpresaId],
    queryFn: async () => {
      if (!contextoValido || !canView) {
        await auditarRelatorio({ acao: "RelatorioFinanceiroLogistica.bloqueado", sucesso: false, motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada" });
        return { total: { receita: 0, despesa: 0, margem: 0 }, linhas: [], grupos: [] };
      }
      const payload = { filtros: { ...filtros, empresa_id: effectiveEmpresaId || filtros.empresa_id, group_id: effectiveGroupId || filtros.group_id } };
      const res = await base44.functions.invoke("logisticaFinanceReport", payload);
      await auditarRelatorio({ acao: "RelatorioFinanceiroLogistica.consultar", detalhes: payload.filtros });
      return res?.data || { total: { receita: 0, despesa: 0, margem: 0 }, linhas: [], grupos: [] };
    },
    enabled: contextoValido && canView
  });

  const aplicarFiltros = async () => {
    if (!contextoValido || !canView) {
      await auditarRelatorio({ acao: "RelatorioFinanceiroLogistica.aplicar_bloqueado", sucesso: false, motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada" });
      return;
    }
    refetch();
  };

  if (!contextoValido || !canView) {
    return (
      <div className="w-full h-full space-y-3" data-permission="Expedicao.FinanceiroLogistica.visualizar" data-context-required="true">
        <Card className="border-yellow-200 bg-yellow-50"><CardContent className="p-4 text-sm text-yellow-800">Selecione contexto grupo/empresa e confirme permissao para visualizar o relatorio financeiro logistico.</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="w-full h-full space-y-3" data-permission="Expedicao.FinanceiroLogistica.visualizar" data-context-required="true">
      <Card>
        <CardHeader className="pb-2"><CardTitle>Relatorio Financeiro da Logistica</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-5 gap-2 items-end">
          <div><label className="text-xs">Inicio</label><Input type="date" value={filtros.start_date} onChange={(e) => setFiltros({ ...filtros, start_date: e.target.value })} /></div>
          <div><label className="text-xs">Fim</label><Input type="date" value={filtros.end_date} onChange={(e) => setFiltros({ ...filtros, end_date: e.target.value })} /></div>
          <div className="flex gap-2 md:col-span-2"><Button onClick={aplicarFiltros} disabled={isFetching} data-action="RelatorioFinanceiroLogistica.aplicar" data-permission="Expedicao.FinanceiroLogistica.visualizar" data-context-required="true">Aplicar</Button></div>
          <div className="text-right"><Badge variant="outline" className="text-xs">Empresa: {empresaAtual?.nome_fantasia || empresaAtual?.razao_social || "Grupo"}</Badge></div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-3">
        <Card><CardHeader className="pb-1"><CardTitle className="text-sm">Receita</CardTitle></CardHeader><CardContent><div className="text-xl font-semibold text-emerald-700">R$ {money(data?.total?.receita)}</div></CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-sm">Despesa</CardTitle></CardHeader><CardContent><div className="text-xl font-semibold text-rose-700">R$ {money(data?.total?.despesa)}</div></CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-sm">Margem</CardTitle></CardHeader><CardContent><div className="text-xl font-semibold">R$ {money(data?.total?.margem)}</div></CardContent></Card>
      </div>

      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Por Entrega</CardTitle></CardHeader><CardContent className="max-h-[260px] overflow-auto text-sm">{(data?.linhas || []).length === 0 && <div className="text-slate-500">Sem dados no periodo.</div>}<div className="grid grid-cols-7 gap-2 font-medium text-slate-700 mb-2"><div>Entrega</div><div>Rota</div><div>Motorista</div><div>Data</div><div>KM</div><div>Receita</div><div>Despesa</div></div>{(data?.linhas || []).map((l) => <div key={l.entrega_id} className="grid grid-cols-7 gap-2 py-1 border-b"><div className="truncate">{l.entrega_id}</div><div className="truncate">{l.rota_id || "-"}</div><div className="truncate">{l.motorista || "-"}</div><div>{l.data || "-"}</div><div>{Number(l.km || 0).toLocaleString("pt-BR")}</div><div>R$ {money(l.receita)}</div><div>R$ {money(l.despesa)}</div></div>)}</CardContent></Card>

      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Grupos (Motorista / Rota / Dia)</CardTitle></CardHeader><CardContent className="max-h-[260px] overflow-auto text-sm">{(data?.grupos || []).length === 0 && <div className="text-slate-500">Sem grupos.</div>}<div className="grid grid-cols-4 gap-2 font-medium text-slate-700 mb-2"><div>Chave</div><div>Receita</div><div>Despesa</div><div>Margem</div></div>{(data?.grupos || []).map((g, idx) => <div key={idx} className="grid grid-cols-4 gap-2 py-1 border-b"><div className="truncate">{g.chave}</div><div>R$ {money(g.receita)}</div><div>R$ {money(g.despesa)}</div><div>R$ {money(g.margem)}</div></div>)}</CardContent></Card>
    </div>
  );
}
