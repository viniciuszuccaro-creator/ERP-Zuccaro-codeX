import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { base44 } from "@/api/base44Client";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import ContextoConfigBanner from "@/components/administracao-sistema/common/ContextoConfigBanner";
import SoDResults from "@/components/administracao-sistema/gestao-acessos/SoDResults";
import { toast } from "sonner";

export default function SoDChecker() {
  const { isAdmin, hasPermission } = usePermissions();
  const { user } = useUser();
  const { empresaAtual, grupoAtual, estaNoGrupo, empresasDoGrupo = [], createInContext, updateInContext } = useContextoVisual();
  const podeExecutar = isAdmin() || hasPermission("Sistema", "Controle de Acesso", "editar");
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = estaNoGrupo ? null : empresaAtual?.id || null;
  const empresasGrupoIds = (empresasDoGrupo.length ? empresasDoGrupo : grupoAtual?.empresas || [])
    .map((empresa) => (typeof empresa === "string" ? empresa : empresa?.empresa_id || empresa?.id))
    .filter(Boolean);
  const hasValidScope = estaNoGrupo ? Boolean(groupId) : Boolean(groupId && empresaId);
  const contextoLabel = estaNoGrupo ? "grupo" : "empresa";
  const mensagemContextoObrigatorio = estaNoGrupo
    ? "Selecione um grupo antes de analisar SoD."
    : "Selecione uma empresa vinculada a um grupo antes de analisar SoD.";

  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState(null);
  const [persistindo, setPersistindo] = useState(false);

  const getDadosContexto = () => ({
    contexto: contextoLabel,
    contexto_valido: hasValidScope,
    group_id: groupId,
    empresa_id: empresaId,
    empresas_grupo_ids: empresasGrupoIds,
    permissao: "Sistema.Controle de Acesso.editar",
    pode_executar: podeExecutar,
  });

  const audit = async ({ acao, entidade, descricao, dadosNovos, sucesso = true, tipo = "seguranca" }) => {
    try {
      await createInContext('AuditLog', {
        usuario: user?.full_name || user?.email || "Usuario",
        usuario_id: user?.id || null,
        empresa_id: empresaId,
        group_id: groupId,
        acao,
        modulo: "Sistema",
        entidade,
        descricao,
        tipo_auditoria: tipo,
        dados_novos: {
          ...getDadosContexto(),
          ...(dadosNovos || {}),
        },
        sucesso,
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.warn("Falha ao registrar auditoria SoD:", error);
    }
  };

  useEffect(() => {
    if (podeExecutar) return;
    void audit({
      acao: "Bloqueio por permissao",
      entidade: "SoD",
      descricao: "Tentativa de visualizar execucao SoD sem permissao de edicao.",
      dadosNovos: { motivo: "permissao_negada" },
      sucesso: false,
    });
  }, [podeExecutar, groupId, empresaId]);

  const executarAnalise = async () => {
    setLoading(true);
    setErro(null);
    try {
      if (!podeExecutar) {
        await audit({
          acao: "Bloqueio por permissao",
          entidade: "SoD",
          descricao: "Tentativa de executar analise SoD sem permissao.",
          dadosNovos: { motivo: "permissao_negada" },
          sucesso: false,
        });
        throw new Error("Sem permissao para executar analise SoD.");
      }

      if (!hasValidScope) {
        await audit({
          acao: "Bloqueio sem contexto",
          entidade: "SoD",
          descricao: "Tentativa de executar analise SoD sem contexto valido.",
          dadosNovos: { motivo: "contexto_obrigatorio" },
          sucesso: false,
        });
        throw new Error(mensagemContextoObrigatorio);
      }

      const { data } = await base44.functions.invoke("sodValidator", {
        scope: contextoLabel,
        group_id: groupId || undefined,
        empresa_id: empresaId || undefined,
        empresas_grupo_ids: estaNoGrupo ? empresasGrupoIds : undefined,
        requested_by: user?.id,
      });

      setResultado(data);
      await audit({
        acao: "Visualizacao",
        entidade: "SoD",
        descricao: `Analise SoD executada (${contextoLabel})`,
        dadosNovos: data || null,
        tipo: "ui",
      });
      toast.success("Analise SoD executada e auditada.");
    } catch (e) {
      const message = e?.message || "Falha ao executar analise";
      setErro(message);
      await audit({
        acao: "Erro Analise SoD",
        entidade: "SoD",
        descricao: message,
        dadosNovos: { erro: message },
        sucesso: false,
      });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const persistirConflitos = async () => {
    if (!resultado) return;
    setPersistindo(true);
    setErro(null);
    try {
      if (!podeExecutar) {
        await audit({
          acao: "Bloqueio por permissao",
          entidade: "PerfilAcesso",
          descricao: "Tentativa de persistir conflitos SoD sem permissao.",
          dadosNovos: { motivo: "permissao_negada" },
          sucesso: false,
        });
        throw new Error("Sem permissao para persistir conflitos SoD.");
      }

      if (!hasValidScope) {
        await audit({
          acao: "Bloqueio sem contexto",
          entidade: "PerfilAcesso",
          descricao: "Tentativa de persistir conflitos SoD sem contexto valido.",
          dadosNovos: { motivo: "contexto_obrigatorio" },
          sucesso: false,
        });
        throw new Error(mensagemContextoObrigatorio.replace("analisar", "persistir"));
      }

      const conflicts = Array.isArray(resultado?.conflicts) ? resultado.conflicts : [];
      const porPerfil = conflicts.reduce((acc, c) => {
        const id = c?.perfil_id;
        if (!id) return acc;
        acc[id] = acc[id] || [];
        acc[id].push({
          tipo_conflito: c?.tipo_conflito,
          descricao: c?.descricao,
          severidade: c?.severidade || "Media",
          data_deteccao: new Date().toISOString(),
          contexto: contextoLabel,
          group_id: groupId,
          empresa_id: empresaId,
          empresas_grupo_ids: estaNoGrupo ? empresasGrupoIds : [],
        });
        return acc;
      }, {});

      const ids = Object.keys(porPerfil);
      for (const perfilId of ids) {
        await updateInContext('PerfilAcesso', perfilId, {
          conflitos_sod_detectados: porPerfil[perfilId],
          ultima_analise_sod_em: new Date().toISOString(),
          ultima_analise_sod_contexto: contextoLabel,
          ...(groupId ? { group_id: groupId } : {}),
          ...(empresaId ? { empresa_id: empresaId } : {}),
          ...(estaNoGrupo ? { empresas_grupo_ids: empresasGrupoIds } : {}),
        });
      }

      await audit({
        acao: "Edicao",
        entidade: "PerfilAcesso",
        descricao: `Conflitos SoD persistidos para ${ids.length} perfis`,
        dadosNovos: {
          perfis_afetados: ids.length,
          conflitos_por_perfil: porPerfil,
          propagacao_grupo_empresas: estaNoGrupo,
        }
      });
      toast.success(`Conflitos SoD persistidos em ${ids.length} perfil(is).`);
    } catch (e) {
      const message = e?.message || "Falha ao persistir conflitos SoD";
      setErro(message);
      await audit({
        acao: "Erro Persistencia SoD",
        entidade: "PerfilAcesso",
        descricao: message,
        dadosNovos: { erro: message },
        sucesso: false,
      });
      toast.error(message);
    } finally {
      setPersistindo(false);
    }
  };

  if (!podeExecutar) {
    return <div className="p-2 text-xs text-slate-500">Sem permissao para analisar SoD.</div>;
  }

  return (
    <div className="w-full h-full flex flex-col gap-3">
      <ContextoConfigBanner />
      <Card className="w-full">
        <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold text-slate-800">Analise de Segregacao de Funcoes (SoD)</h3>
            <p className="text-xs text-slate-500">Verifica conflitos de permissoes nos perfis de acesso.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={executarAnalise} disabled={loading || !hasValidScope || !podeExecutar} data-action="SoD.analisar" data-permission="Sistema.Controle de Acesso.editar" data-context-required="group-or-company" data-sensitive="true">
              {loading ? "Analisando..." : "Executar Analise"}
            </Button>
            {resultado && (
              <Button onClick={persistirConflitos} disabled={persistindo || !hasValidScope || !podeExecutar} variant="outline" data-action="SoD.persistir" data-permission="Sistema.Controle de Acesso.editar" data-context-required="group-or-company" data-sensitive="true">
                {persistindo ? "Salvando..." : "Persistir Conflitos"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {!hasValidScope && (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          {mensagemContextoObrigatorio}
        </div>
      )}

      {erro && (
        <div className="text-sm text-red-600">{erro}</div>
      )}

      {resultado && (
        <SoDResults resultado={resultado} />
      )}
    </div>
  );
}
