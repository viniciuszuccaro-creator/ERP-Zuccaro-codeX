import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useUser } from "@/components/lib/UserContext";
import usePermissions from "@/components/lib/usePermissions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const sanitizeText = (value) => String(value || "")
  .replace(/[<>]/g, "")
  .replace(/javascript:/gi, "")
  .trim();

export default function ConfigFinanceiroLogistica({ empresaId, groupId: groupIdProp, onAudit }) {
  const queryClient = useQueryClient();
  const { filterInContext, createInContext, updateInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const { user } = useUser();
  const { hasPermission } = usePermissions();

  const effectiveEmpresaId = empresaId || empresaAtual?.id || null;
  const effectiveGroupId = groupIdProp || grupoAtual?.id || empresaAtual?.group_id || null;
  const contextoValido = Boolean(effectiveGroupId || effectiveEmpresaId);
  const canEditConfig = hasPermission("Expedicao", "Financeiro Logistica", "editar") || hasPermission("Financeiro", "Configuracao", "editar");
  const cfgKey = React.useMemo(() => effectiveEmpresaId ? `log_finance_cfg_${effectiveEmpresaId}` : `log_finance_cfg_${effectiveGroupId || "sem_contexto"}`, [effectiveEmpresaId, effectiveGroupId]);

  const auditConfig = async ({ acao, sucesso = true, motivo = null, detalhes = {} }) => {
    try {
      await base44.entities.AuditLog.create({
        acao,
        modulo: "Expedicao",
        entidade: "ConfiguracaoFinanceiroLogistica",
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
      console.warn("Falha ao auditar configuracao financeira logistica", error);
    }
    await onAudit?.({ acao, sucesso, motivo, detalhes });
  };

  const { data: cfg } = useQuery({
    queryKey: ['log-fin-cfg', cfgKey, effectiveGroupId, effectiveEmpresaId],
    queryFn: async () => {
      const rows = await filterInContext('ConfiguracaoSistema', { chave: cfgKey }, undefined, 1);
      return rows?.[0]?.valor_json || {};
    },
    enabled: contextoValido
  });

  const { data: centros = [] } = useQuery({
    queryKey: ['centros-custo', effectiveGroupId, effectiveEmpresaId],
    queryFn: () => filterInContext('CentroCusto', {}, 'descricao', 200),
    staleTime: 120000,
    enabled: contextoValido
  });

  const { data: planos = [] } = useQuery({
    queryKey: ['plano-contas', effectiveGroupId, effectiveEmpresaId],
    queryFn: async () => {
      try { return await filterInContext('PlanoDeContas', {}, 'descricao', 200); } catch { return []; }
    },
    staleTime: 120000,
    enabled: contextoValido
  });

  const [form, setForm] = React.useState({
    centro_custo_id: '',
    plano_contas_id: '',
    forma_recebimento: 'PIX',
    forma_pagamento: 'Cartao',
    custo_km: 2.5,
    dias_vencimento: 7,
  });

  React.useEffect(() => {
    if (cfg) setForm({
      centro_custo_id: cfg.centro_custo_id || '',
      plano_contas_id: cfg.plano_contas_id || '',
      forma_recebimento: sanitizeText(cfg.forma_recebimento || 'PIX'),
      forma_pagamento: sanitizeText(cfg.forma_pagamento || 'Cartao'),
      custo_km: typeof cfg.custo_km === 'number' ? cfg.custo_km : 2.5,
      dias_vencimento: cfg.dias_vencimento || 7,
    });
  }, [cfg]);

  const saveMutation = useMutation({
    mutationFn: async (values) => {
      if (!contextoValido || !canEditConfig) {
        await auditConfig({ acao: "FinanceiroLogistica.config.salvar.bloqueado", sucesso: false, motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada" });
        throw new Error("Contexto e permissao sao obrigatorios para salvar a configuracao logistica.");
      }
      const valuesSanitizados = {
        ...values,
        forma_recebimento: sanitizeText(values.forma_recebimento),
        forma_pagamento: sanitizeText(values.forma_pagamento),
        custo_km: Math.max(0, Number(values.custo_km || 0)),
        dias_vencimento: Math.max(0, Number(values.dias_vencimento || 0))
      };
      const confirmado = window.confirm("Confirma salvar a configuracao financeira logistica para o contexto atual?");
      if (!confirmado) {
        await auditConfig({ acao: "FinanceiroLogistica.config.salvar.cancelado", sucesso: false, motivo: "confirmacao_cancelada" });
        throw new Error("Salvamento cancelado pelo usuario.");
      }
      const rows = await filterInContext('ConfiguracaoSistema', { chave: cfgKey }, undefined, 1);
      const payload = {
        chave: cfgKey,
        valor_json: valuesSanitizados,
        group_id: effectiveGroupId,
        grupo_id: effectiveGroupId,
        empresa_id: effectiveEmpresaId
      };
      if (rows?.length) {
        await updateInContext("ConfiguracaoSistema", rows[0].id, payload);
      } else {
        await createInContext("ConfiguracaoSistema", payload);
      }
      await auditConfig({ acao: "FinanceiroLogistica.config.salvar", detalhes: { chave: cfgKey } });
      return valuesSanitizados;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['log-fin-cfg', cfgKey] }),
    onError: (error) => auditConfig({ acao: "FinanceiroLogistica.config.salvar.erro", sucesso: false, motivo: error?.message || "erro_salvar" })
  });

  return (
    <Card data-permission="Expedicao.FinanceiroLogistica.editar" data-context-required="true">
      <CardHeader><CardTitle>Configuracao Financeira de Logistica</CardTitle></CardHeader>
      <CardContent className="grid gap-3">
        {(!contextoValido || !canEditConfig) && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {!contextoValido ? "Selecione grupo/empresa para configurar financeiro logistico." : "Seu perfil nao tem permissao para alterar esta configuracao."}
          </div>
        )}
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm">Centro de Custo Padrao</label>
            <Select value={form.centro_custo_id} onValueChange={(v) => setForm({ ...form, centro_custo_id: v })} disabled={!contextoValido || !canEditConfig}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {centros.map(c => <SelectItem key={c.id} value={c.id}>{c.codigo ? `${c.codigo} - ` : ''}{c.descricao}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm">Plano de Contas Padrao</label>
            <Select value={form.plano_contas_id} onValueChange={(v) => setForm({ ...form, plano_contas_id: v })} disabled={!contextoValido || !canEditConfig}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {planos.map(p => <SelectItem key={p.id} value={p.id}>{p.descricao || p.codigo || p.id}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm">Forma de Recebimento (CR)</label>
            <Input value={form.forma_recebimento} onChange={(e) => setForm({ ...form, forma_recebimento: sanitizeText(e.target.value) })} disabled={!contextoValido || !canEditConfig} />
          </div>
          <div>
            <label className="text-sm">Forma de Pagamento (CP)</label>
            <Input value={form.forma_pagamento} onChange={(e) => setForm({ ...form, forma_pagamento: sanitizeText(e.target.value) })} disabled={!contextoValido || !canEditConfig} />
          </div>
          <div>
            <label className="text-sm">Custo por KM (R$)</label>
            <Input type="number" value={form.custo_km} onChange={(e) => setForm({ ...form, custo_km: Math.max(0, Number(e.target.value)||0) })} disabled={!contextoValido || !canEditConfig} />
          </div>
          <div>
            <label className="text-sm">Dias para Vencimento</label>
            <Input type="number" value={form.dias_vencimento} onChange={(e) => setForm({ ...form, dias_vencimento: Math.max(0, Number(e.target.value)||0) })} disabled={!contextoValido || !canEditConfig} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending || !contextoValido || !canEditConfig} data-action="FinanceiroLogistica.config.salvar" data-permission="Expedicao.FinanceiroLogistica.editar" data-context-required="true" data-sensitive="true">Salvar Configuracao</Button>
        </div>
      </CardContent>
    </Card>
  );
}
