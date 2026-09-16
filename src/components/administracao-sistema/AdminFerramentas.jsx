import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

const sanitizeFerramentaText = (value, max = 300) => String(value ?? "")
  .replace(/[<>]/g, "")
  .replace(/javascript:/gi, "")
  .trim()
  .slice(0, max);

const sanitizeFerramentaPayload = (value) => {
  if (Array.isArray(value)) return value.map(sanitizeFerramentaPayload);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        sanitizeFerramentaText(key, 80),
        sanitizeFerramentaPayload(item)
      ])
    );
  }
  return typeof value === "string" ? sanitizeFerramentaText(value, 500) : value;
};

export default function AdminFerramentas({ empresaAtual, grupoAtual }) {
  const { user } = useUser();
  const { createInContext } = useContextoVisual();
  const { isAdmin, hasPermission } = usePermissions();
  const [loadingSeed, setLoadingSeed] = useState(false);
  const [loadingBackfillDry, setLoadingBackfillDry] = useState(false);
  const [loadingBackfillApply, setLoadingBackfillApply] = useState(false);
  const [ultimoDryRunContexto, setUltimoDryRunContexto] = useState(null);
  const grupoId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = !!grupoId;
  const contextoKey = grupoId ? grupoId + ":" + (empresaId || "grupo") : null;
  const isAdminUser = typeof isAdmin === "function" ? isAdmin() : false;
  const podeExecutarFerramenta = isAdminUser || hasPermission("Sistema", "Ferramentas", "executar");
  const podeEditarFerramenta = isAdminUser || hasPermission("Sistema", "Ferramentas", "editar");

  const dadosContextoFerramenta = () => ({
    contexto: grupoAtual?.id ? "grupo" : empresaAtual?.id ? "empresa" : "sem-contexto",
    contexto_valido: contextoValido,
    groupId: grupoId,
    empresaId,
    grupo_nome: grupoAtual?.nome || grupoAtual?.nome_grupo || null,
    empresa_nome: empresaAtual?.nome_fantasia || empresaAtual?.razao_social || null,
  });

  const auditFerramenta = async ({ acao, descricao, dadosNovos, sucesso = true, erro = null }) => {
    try {
      await createInContext("AuditLog", {
        usuario: user?.full_name || user?.email || "Usuario local",
        usuario_id: user?.id || null,
        empresa_id: empresaId,
        group_id: grupoId,
        grupo_id: grupoId,
        acao: sanitizeFerramentaText(acao, 120),
        modulo: "Administracao",
        entidade: "FerramentasAdministrativas",
        descricao: sanitizeFerramentaText(descricao, 500),
        tipo_auditoria: sucesso ? "execucao" : "seguranca",
        dados_novos: sanitizeFerramentaPayload({
          ...dadosContextoFerramenta(),
          ...(dadosNovos || {}),
          erro_tipo: erro ? "erro_operacional" : null,
        }),
        sucesso,
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.warn("Falha ao auditar ferramenta administrativa:", error);
    }
  };

  const runSeed = async () => {
    if (!contextoValido) {
      toast.error("Selecione um grupo ou empresa antes de executar seed.");
      await auditFerramenta({
        acao: "Bloqueio sem contexto",
        descricao: "Tentativa de executar seed leve sem grupo ou empresa.",
        dadosNovos: { ferramenta: "seedData" },
        sucesso: false
      });
      return;
    }
    if (!podeEditarFerramenta) {
      toast.error("Seu perfil nao permite executar seed administrativo.");
      await auditFerramenta({
        acao: "Bloqueio por permissao",
        descricao: "Tentativa de executar seed leve sem permissao.",
        dadosNovos: { ferramenta: "seedData", permissao: "Sistema.Ferramentas.editar" },
        sucesso: false
      });
      return;
    }
    setLoadingSeed(true);
    try {
      const payload = {
        counts: { clientes: 5, produtos: 10, colaboradores: 5 },
        group_id: grupoId,
        empresa_id: empresaId,
        multiCompany: !empresaId,
      };
      const res = await base44.functions.invoke('seedData', payload);
      await auditFerramenta({
        acao: "Seed",
        descricao: "Seed leve executado em ferramentas administrativas",
        dadosNovos: {
          ferramenta: "seedData",
          escopo: empresaId ? "empresa" : "grupo",
          empresas_processadas: Array.isArray(res?.data?.results) ? res.data.results.length : 1,
          criados: res?.data?.created || null,
        }
      });
      const empresasProcessadas = Array.isArray(res?.data?.results) ? res.data.results.length : 1;
      toast.success("Seed concluido em " + empresasProcessadas + " empresa(s).");
    } catch (err) {
      await auditFerramenta({
        acao: "Erro no seed",
        descricao: "Seed leve falhou em ferramentas administrativas.",
        dadosNovos: { ferramenta: "seedData" },
        sucesso: false,
        erro: err?.message
      });
      toast.error('Erro no seed: ' + err?.message);
    } finally {
      setLoadingSeed(false);
    }
  };

  const runBackfillDry = async () => {
    if (!contextoValido) {
      toast.error("Selecione um grupo ou empresa antes de executar dry-run.");
      await auditFerramenta({
        acao: "Bloqueio sem contexto",
        descricao: "Tentativa de executar dry-run de backfill sem grupo ou empresa.",
        dadosNovos: { ferramenta: "backfillGroupEmpresa", dryRun: true },
        sucesso: false
      });
      return;
    }
    if (!podeExecutarFerramenta) {
      toast.error("Seu perfil nao permite executar dry-run administrativo.");
      await auditFerramenta({
        acao: "Bloqueio por permissao",
        descricao: "Tentativa de executar dry-run de backfill sem permissao.",
        dadosNovos: { ferramenta: "backfillGroupEmpresa", dryRun: true, permissao: "Sistema.Ferramentas.executar" },
        sucesso: false
      });
      return;
    }
    setLoadingBackfillDry(true);
    try {
      const payload = { dryRun: true, apply: false, limitPerEntity: 1000, group_id: grupoId, empresa_id: empresaId };
      const res = await base44.functions.invoke('backfillGroupEmpresa', payload);
      setUltimoDryRunContexto(contextoKey);
      await auditFerramenta({
        acao: "Backfill Dry-run",
        descricao: "Dry-run de backfill multiempresa executado",
        dadosNovos: {
          ferramenta: "backfillGroupEmpresa", dry_run: true,
          entidades_processadas: Array.isArray(res?.data?.summary) ? res.data.summary.length : 0,
          total_para_atualizar: (res?.data?.summary || []).reduce((total, item) => total + Number(item?.toUpdate || 0), 0),
          total_erros: (res?.data?.summary || []).reduce((total, item) => total + Number(item?.errors || 0), 0),
        }
      });
      const totalPendente = (res?.data?.summary || []).reduce((total, item) => total + Number(item?.toUpdate || 0), 0);
      toast.success("Dry-run concluido: " + totalPendente + " registro(s) para revisar.");
    } catch (err) {
      await auditFerramenta({
        acao: "Erro no backfill dry-run",
        descricao: "Dry-run de backfill multiempresa falhou.",
        dadosNovos: { ferramenta: "backfillGroupEmpresa", dryRun: true },
        sucesso: false,
        erro: err?.message
      });
      toast.error('Erro: ' + err?.message);
    } finally {
      setLoadingBackfillDry(false);
    }
  };

  const runBackfillApply = async () => {
    if (!contextoValido) {
      toast.error("Selecione um grupo ou empresa antes de aplicar backfill.");
      await auditFerramenta({
        acao: "Bloqueio sem contexto",
        descricao: "Tentativa de aplicar backfill multiempresa sem grupo ou empresa.",
        dadosNovos: { ferramenta: "backfillGroupEmpresa", apply: true },
        sucesso: false
      });
      return;
    }
    if (!podeEditarFerramenta) {
      toast.error("Seu perfil nao permite aplicar correcoes administrativas.");
      await auditFerramenta({
        acao: "Bloqueio por permissao",
        descricao: "Tentativa de aplicar backfill multiempresa sem permissao.",
        dadosNovos: { ferramenta: "backfillGroupEmpresa", apply: true, permissao: "Sistema.Ferramentas.editar" },
        sucesso: false
      });
      return;
    }
    if (ultimoDryRunContexto !== contextoKey) {
      toast.error("Execute o dry-run neste mesmo Grupo/Empresa antes de aplicar.");
      await auditFerramenta({
        acao: "Bloqueio sem dry-run",
        descricao: "Tentativa de aplicar backfill sem dry-run valido no contexto atual.",
        dadosNovos: { ferramenta: "backfillGroupEmpresa", apply: true },
        sucesso: false
      });
      return;
    }
    if (!confirm('Aplicar correcoes de multiempresa? Esta acao sera auditada e deve ser usada somente apos dry-run.')) {
      await auditFerramenta({
        acao: "Backfill cancelado",
        descricao: "Usuario cancelou aplicacao de backfill multiempresa.",
        dadosNovos: { ferramenta: "backfillGroupEmpresa", apply: true },
        sucesso: false
      });
      return;
    }
    setLoadingBackfillApply(true);
    try {
      const payload = { dryRun: false, apply: true, limitPerEntity: 1000, group_id: grupoId, empresa_id: empresaId };
      const res = await base44.functions.invoke('backfillGroupEmpresa', payload);
      await auditFerramenta({
        acao: "Backfill Aplicado",
        descricao: "Backfill multiempresa aplicado",
        dadosNovos: {
          ferramenta: "backfillGroupEmpresa", apply: true,
          entidades_processadas: Array.isArray(res?.data?.summary) ? res.data.summary.length : 0,
          total_atualizado: (res?.data?.summary || []).reduce((total, item) => total + Number(item?.updated || 0), 0),
          total_erros: (res?.data?.summary || []).reduce((total, item) => total + Number(item?.errors || 0), 0),
        }
      });
      setUltimoDryRunContexto(null);
      const totalAtualizado = (res?.data?.summary || []).reduce((total, item) => total + Number(item?.updated || 0), 0);
      toast.success("Backfill aplicado: " + totalAtualizado + " registro(s) atualizado(s).");
    } catch (err) {
      await auditFerramenta({
        acao: "Erro no backfill aplicado",
        descricao: "Aplicacao de backfill multiempresa falhou.",
        dadosNovos: { ferramenta: "backfillGroupEmpresa", apply: true },
        sucesso: false,
        erro: err?.message
      });
      toast.error('Erro: ' + err?.message);
    } finally {
      setLoadingBackfillApply(false);
    }
  };

  return (
    <div
      className="w-full h-full space-y-4"
      data-permission="Sistema.Configuracoes.executar"
      data-context-required="group_id|empresa_id"
    >
      <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">
        ⚠️ <strong>Ferramentas administrativas</strong> — Use com cautela. Estas operações afetam dados reais do banco.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold text-slate-900">Seed de Dados (Teste)</h3>
            <p className="text-xs text-slate-500">Cria clientes, produtos e colaboradores de teste com contexto multiempresa atual.</p>
            <Button variant="outline" onClick={runSeed} disabled={loadingSeed || !contextoValido || !podeEditarFerramenta} data-action="AdminFerramentas.seedLeve" data-permission="Sistema.Ferramentas.editar" data-context-required="group-or-company" data-sensitive="true">
              {loadingSeed ? 'Executando…' : 'Executar Seed Leve'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold text-slate-900">Backfill Multiempresa</h3>
            <p className="text-xs text-slate-500">Dry-run valida e lista correções de group_id/empresa_id; Aplicar executa somente casos inequívocos.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={runBackfillDry} disabled={loadingBackfillDry || !contextoValido || !podeExecutarFerramenta} data-action="AdminFerramentas.backfillDryRun" data-permission="Sistema.Ferramentas.executar" data-context-required="group-or-company">
                {loadingBackfillDry ? 'Analisando…' : 'Dry-run (visualizar)'}
              </Button>
              <Button
                className="bg-orange-600 hover:bg-orange-700 text-white"
                onClick={runBackfillApply}
                disabled={loadingBackfillApply || !contextoValido || !podeEditarFerramenta || ultimoDryRunContexto !== contextoKey}
                data-action="AdminFerramentas.backfillAplicar"
                data-permission="Sistema.Ferramentas.editar"
                data-context-required="group-or-company"
                data-sensitive="true"
              >
                {loadingBackfillApply ? 'Aplicando…' : 'Aplicar Correções'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
