import React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useUser } from "@/components/lib/UserContext";
import usePermissions from "@/components/lib/usePermissions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ConfigFinanceiroLogistica from "./ConfigFinanceiroLogistica";

function Section({ title, children, extra }) {
  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        {extra}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function LogisticaFinanceiroPanel({ empresaId }) {
  const { filterInContext, createInContext, updateInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const { user } = useUser();
  const { hasPermission } = usePermissions();

  const effectiveEmpresaId = empresaId || empresaAtual?.id || null;
  const effectiveGroupId = grupoAtual?.id || empresaAtual?.group_id || null;
  const contextoValido = Boolean(effectiveGroupId || effectiveEmpresaId);
  const canView = hasPermission("Expedicao", "Financeiro Logistica", "visualizar") || hasPermission("Financeiro", "Contas", "visualizar");
  const canGenerate = hasPermission("Expedicao", "Financeiro Logistica", "criar") || hasPermission("Financeiro", "Contas", "criar");
  const canConciliate = hasPermission("Expedicao", "Financeiro Logistica", "editar") || hasPermission("Financeiro", "Contas", "editar");

  const auditFinanceiro = async ({ acao, sucesso = true, motivo = null, detalhes = {} }) => {
    try {
      await base44.entities.AuditLog.create({
        acao,
        modulo: "Expedicao",
        entidade: "FinanceiroLogistica",
        tipo_auditoria: sucesso ? "operacional" : "seguranca",
        usuario_id: user?.id || user?.email || null,
        usuario_nome: user?.full_name || user?.email || "Sistema",
        group_id: effectiveGroupId,
        grupo_id: effectiveGroupId,
        empresa_id: effectiveEmpresaId,
        resultado: sucesso ? "sucesso" : "bloqueado",
        motivo,
        detalhes,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn("Falha ao auditar financeiro logistico", error);
    }
  };

  const cfgKey = React.useMemo(() => effectiveEmpresaId ? `log_finance_cfg_${effectiveEmpresaId}` : `log_finance_cfg_${effectiveGroupId || "sem_contexto"}`, [effectiveEmpresaId, effectiveGroupId]);
  const { data: cfg } = useQuery({
    queryKey: ["log-fin-cfg", cfgKey, effectiveGroupId, effectiveEmpresaId],
    queryFn: async () => {
      const rows = await filterInContext("ConfiguracaoSistema", { chave: cfgKey }, undefined, 1);
      return rows?.[0]?.valor_json || {};
    },
    enabled: contextoValido && canView
  });

  const { data: entregas = [] } = useQuery({
    queryKey: ["log-entregas-fin", effectiveGroupId, effectiveEmpresaId],
    queryFn: async () => await filterInContext("Entrega", {}, "-updated_date", 300),
    enabled: contextoValido && canView
  });

  const { data: contasReceber = [] } = useQuery({
    queryKey: ["log-cr", effectiveGroupId, effectiveEmpresaId],
    queryFn: async () => await filterInContext("ContaReceber", {}, "-updated_date", 400),
    enabled: contextoValido && canView
  });
  const { data: contasPagar = [] } = useQuery({
    queryKey: ["log-cp", effectiveGroupId, effectiveEmpresaId],
    queryFn: async () => await filterInContext("ContaPagar", {}, "-updated_date", 400),
    enabled: contextoValido && canView
  });

  const crLog = React.useMemo(() => (contasReceber || []).filter(c => (c.descricao || "").includes("[LOG]")), [contasReceber]);
  const cpLog = React.useMemo(() => (contasPagar || []).filter(c => (c.descricao || "").includes("[LOG]")), [contasPagar]);
  const totalFretePrevisto = React.useMemo(() => (entregas || []).reduce((s, e) => s + Number(e.valor_frete || 0), 0), [entregas]);
  const totalCR = React.useMemo(() => crLog.reduce((s, c) => s + Number(c.valor || 0), 0), [crLog]);
  const totalCP = React.useMemo(() => cpLog.reduce((s, c) => s + Number(c.valor || 0), 0), [cpLog]);

  const ensureCanWrite = async (action) => {
    if (!contextoValido || !canGenerate) {
      await auditFinanceiro({ acao: `${action}.bloqueado`, sucesso: false, motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada" });
      throw new Error("Contexto e permissao sao obrigatorios para gerar titulos logisticos.");
    }
    if (!cfg?.centro_custo_id || !cfg?.plano_contas_id) throw new Error("Configure centro de custo e plano de contas.");
  };

  const gerarCRMutation = useMutation({
    mutationFn: async () => {
      await ensureCanWrite("FinanceiroLogistica.gerarCR");
      const elegiveis = (entregas || []).filter(e => e.status === "Entregue" && Number(e.valor_frete || 0) > 0);
      const confirmado = window.confirm(`Confirma gerar contas a receber para ${elegiveis.length} entrega(s) entregue(s)?`);
      if (!confirmado) {
        await auditFinanceiro({ acao: "FinanceiroLogistica.gerarCR.cancelado", sucesso: false, motivo: "confirmacao_cancelada", detalhes: { quantidade: elegiveis.length } });
        throw new Error("Geracao cancelada pelo usuario.");
      }
      const hoje = new Date();
      const venc = new Date(hoje.getTime() + (cfg?.dias_vencimento || 7) * 86400000).toISOString().slice(0, 10);
      for (const e of elegiveis) {
        await createInContext("ContaReceber", {
          group_id: effectiveGroupId,
          grupo_id: effectiveGroupId,
          empresa_id: e.empresa_id || effectiveEmpresaId,
          descricao: `Serviço de Entrega [LOG] entrega_id:${e.id} pedido:${e.numero_pedido || ""}`,
          cliente: e.cliente_nome || "Cliente",
          cliente_id: e.cliente_id || null,
          valor: e.valor_frete,
          data_emissao: hoje.toISOString().slice(0, 10),
          data_vencimento: venc,
          centro_custo_id: cfg.centro_custo_id,
          plano_contas_id: cfg.plano_contas_id,
          forma_cobranca: cfg.forma_recebimento || "PIX",
          projeto_obra: e.rota_id ? `Rota ${e.rota_id}` : undefined,
          status: "Pendente",
        });
      }
      await auditFinanceiro({ acao: "FinanceiroLogistica.gerarCR", detalhes: { quantidade: elegiveis.length } });
      return elegiveis.length;
    },
    onError: (error) => auditFinanceiro({ acao: "FinanceiroLogistica.gerarCR.erro", sucesso: false, motivo: error?.message || "erro_gerar_cr" })
  });

  const gerarCPCombustivelMutation = useMutation({
    mutationFn: async () => {
      await ensureCanWrite("FinanceiroLogistica.gerarCPCombustivel");
      const custoKm = Number(cfg?.custo_km || 0);
      const elegiveis = (entregas || []).filter(e => Number(e.km_rodado || 0) > 0 && custoKm > 0);
      const confirmado = window.confirm(`Confirma gerar contas a pagar de Combustivel para ${elegiveis.length} entrega(s)?`);
      if (!confirmado) {
        await auditFinanceiro({ acao: "FinanceiroLogistica.gerarCPCombustivel.cancelado", sucesso: false, motivo: "confirmacao_cancelada", detalhes: { quantidade: elegiveis.length } });
        throw new Error("Geracao cancelada pelo usuario.");
      }
      const hoje = new Date();
      const venc = new Date(hoje.getTime() + (cfg?.dias_vencimento || 7) * 86400000).toISOString().slice(0, 10);
      for (const e of elegiveis) {
        const valor = Number(e.km_rodado || 0) * custoKm;
        await createInContext("ContaPagar", {
          group_id: effectiveGroupId,
          grupo_id: effectiveGroupId,
          empresa_id: e.empresa_id || effectiveEmpresaId,
          descricao: `Combustivel [LOG] entrega_id:${e.id} rota:${e.rota_id || ""}`,
          fornecedor: e.motorista || "Motorista",
          valor,
          data_emissao: hoje.toISOString().slice(0, 10),
          data_vencimento: venc,
          centro_custo_id: cfg.centro_custo_id,
          plano_contas_id: cfg.plano_contas_id,
          categoria: "Transporte",
          forma_pagamento: cfg.forma_pagamento || "Cartao",
          status: "Pendente",
        });
      }
      await auditFinanceiro({ acao: "FinanceiroLogistica.gerarCPCombustivel", detalhes: { quantidade: elegiveis.length } });
      return elegiveis.length;
    },
    onError: (error) => auditFinanceiro({ acao: "FinanceiroLogistica.gerarCPCombustivel.erro", sucesso: false, motivo: error?.message || "erro_gerar_cp" })
  });

  const conciliarCR = async (cr) => {
    if (!contextoValido || !canConciliate) {
      await auditFinanceiro({ acao: "FinanceiroLogistica.conciliarCR.bloqueado", sucesso: false, motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada", detalhes: { conta_id: cr?.id } });
      return;
    }
    if (!window.confirm("Confirma conciliar este recebimento logistico?")) {
      await auditFinanceiro({ acao: "FinanceiroLogistica.conciliarCR.cancelado", sucesso: false, motivo: "confirmacao_cancelada", detalhes: { conta_id: cr?.id } });
      return;
    }
    await updateInContext("ContaReceber", cr.id, {
      group_id: cr.group_id || effectiveGroupId,
      grupo_id: cr.grupo_id || cr.group_id || effectiveGroupId,
      empresa_id: cr.empresa_id || effectiveEmpresaId,
      status: "Recebido",
      data_recebimento: new Date().toISOString().slice(0, 10),
      detalhes_pagamento: { ...(cr.detalhes_pagamento || {}), status_compensacao: "Conciliado" }
    });
    await auditFinanceiro({ acao: "FinanceiroLogistica.conciliarCR", detalhes: { conta_id: cr.id } });
  };

  const conciliarCP = async (cp) => {
    if (!contextoValido || !canConciliate) {
      await auditFinanceiro({ acao: "FinanceiroLogistica.conciliarCP.bloqueado", sucesso: false, motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada", detalhes: { conta_id: cp?.id } });
      return;
    }
    if (!window.confirm("Confirma conciliar esta despesa logistica?")) {
      await auditFinanceiro({ acao: "FinanceiroLogistica.conciliarCP.cancelado", sucesso: false, motivo: "confirmacao_cancelada", detalhes: { conta_id: cp?.id } });
      return;
    }
    await updateInContext("ContaPagar", cp.id, {
      group_id: cp.group_id || effectiveGroupId,
      grupo_id: cp.grupo_id || cp.group_id || effectiveGroupId,
      empresa_id: cp.empresa_id || effectiveEmpresaId,
      status: "Pago",
      data_pagamento: new Date().toISOString().slice(0, 10),
      detalhes_pagamento: { ...(cp.detalhes_pagamento || {}), status_compensacao: "Conciliado" }
    });
    await auditFinanceiro({ acao: "FinanceiroLogistica.conciliarCP", detalhes: { conta_id: cp.id } });
  };

  if (!contextoValido || !canView) {
    return (
      <div className="w-full h-full space-y-3" data-permission="Expedicao.FinanceiroLogistica.visualizar" data-context-required="true">
        <Card className="border-yellow-200 bg-yellow-50"><CardContent className="p-4 text-sm text-yellow-800">Selecione contexto grupo/empresa e confirme permissao para visualizar o financeiro logistico.</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="w-full h-full space-y-3" data-permission="Expedicao.FinanceiroLogistica.visualizar" data-context-required="true">
      <div className="grid md:grid-cols-3 gap-3">
        <Card><CardHeader className="pb-1"><CardTitle className="text-sm">Frete Previsto</CardTitle></CardHeader><CardContent><div className="text-xl font-semibold">R$ {totalFretePrevisto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div></CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-sm">CR (Gerado)</CardTitle></CardHeader><CardContent><div className="text-xl font-semibold text-emerald-700">R$ {totalCR.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div></CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-sm">CP (Gerado)</CardTitle></CardHeader><CardContent><div className="text-xl font-semibold text-rose-700">R$ {totalCP.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div></CardContent></Card>
      </div>

      <Section title="Acoes Rapidas" extra={<Badge variant="outline" className="text-xs">Config necessaria para gerar titulos</Badge>}>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => gerarCRMutation.mutate()} disabled={gerarCRMutation.isPending || !canGenerate} data-action="FinanceiroLogistica.gerarCR" data-permission="Expedicao.FinanceiroLogistica.criar" data-context-required="true" data-sensitive="true">Gerar Contas a Receber por Entregas Entregues</Button>
          <Button variant="outline" onClick={() => gerarCPCombustivelMutation.mutate()} disabled={gerarCPCombustivelMutation.isPending || !canGenerate} data-action="FinanceiroLogistica.gerarCPCombustivel" data-permission="Expedicao.FinanceiroLogistica.criar" data-context-required="true" data-sensitive="true">Gerar Contas a Pagar de Combustivel</Button>
        </div>
      </Section>

      <Section title="Conciliacao de Recebimentos">
        <div className="grid gap-2 max-h-[260px] overflow-auto">
          {crLog.length === 0 && <div className="text-sm text-slate-500">Sem titulos gerados [LOG].</div>}
          {crLog.map((c) => (
            <div key={c.id} className="flex items-center justify-between border rounded px-3 py-2 text-sm">
              <div className="min-w-0"><div className="font-medium truncate">{c.descricao}</div><div className="text-slate-600">R$ {Number(c.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} - Venc: {c.data_vencimento}</div></div>
              <div className="flex items-center gap-2"><Badge variant="outline" className="text-xs">{c.status}</Badge>{c.status !== "Recebido" && <Button size="sm" onClick={() => conciliarCR(c)} disabled={!canConciliate} data-action="FinanceiroLogistica.conciliarCR" data-permission="Expedicao.FinanceiroLogistica.editar" data-context-required="true" data-sensitive="true">Conciliar</Button>}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Conciliacao de Despesas">
        <div className="grid gap-2 max-h-[260px] overflow-auto">
          {cpLog.length === 0 && <div className="text-sm text-slate-500">Sem despesas geradas [LOG].</div>}
          {cpLog.map((c) => (
            <div key={c.id} className="flex items-center justify-between border rounded px-3 py-2 text-sm">
              <div className="min-w-0"><div className="font-medium truncate">{c.descricao}</div><div className="text-slate-600">R$ {Number(c.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} - Venc: {c.data_vencimento}</div></div>
              <div className="flex items-center gap-2"><Badge variant="outline" className="text-xs">{c.status}</Badge>{c.status !== "Pago" && <Button size="sm" onClick={() => conciliarCP(c)} disabled={!canConciliate} data-action="FinanceiroLogistica.conciliarCP" data-permission="Expedicao.FinanceiroLogistica.editar" data-context-required="true" data-sensitive="true">Conciliar</Button>}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Configuracao Padrao"><ConfigFinanceiroLogistica empresaId={effectiveEmpresaId} groupId={effectiveGroupId} onAudit={auditFinanceiro} /></Section>
    </div>
  );
}
