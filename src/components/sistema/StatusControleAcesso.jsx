import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CheckCircle, Shield, Award } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";
import {
  CENARIO_PILOTO_LABELS,
  CENARIOS_PILOTO,
  evaluateHomologacaoPiloto,
  PAPEIS_PILOTO,
  PILOTO_CENARIOS_CHAVE,
} from "@/components/lib/pilotoOperacaoPolicy";

export default function StatusControleAcesso({ usuarios = [] }) {
  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, createInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { user } = useUser();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const canEdit = hasPermission("Sistema", "Configuracoes", "editar")
    || hasPermission("Sistema", "Controle de Acesso", "editar")
    || hasPermission("Seguranca", "Acessos", "editar");

  const { data: cenariosConfig, isLoading } = useQuery({
    queryKey: ["piloto-cenarios", groupId || "sem", empresaId || "sem"],
    enabled: contextoValido,
    queryFn: async () => {
      const filter = empresaId
        ? { chave: PILOTO_CENARIOS_CHAVE, empresa_id: empresaId }
        : { chave: PILOTO_CENARIOS_CHAVE, group_id: groupId };
      const rows = await base44.entities.ConfiguracaoSistema.filter(filter, "-updated_date", 5);
      const scoped = rows.find((row) => (
        (!empresaId || String(row.empresa_id || "") === String(empresaId))
        && (!groupId || String(row.group_id || row.grupo_id || "") === String(groupId))
      )) || rows[0] || null;
      return scoped;
    },
  });

  const cenariosExecutados = Array.isArray(cenariosConfig?.valor_json) ? cenariosConfig.valor_json : [];
  const homologacao = evaluateHomologacaoPiloto({ users: usuarios, cenariosExecutados });
  const completo = homologacao.ok;
  const okMap = new Set(
    cenariosExecutados
      .filter((item) => item && (item.ok === true || item.sucesso === true || item.status === "ok"))
      .map((item) => String(item.id || item.cenario || item.codigo || "").toLowerCase()),
  );

  const salvarCenariosMutation = useMutation({
    mutationFn: async (nextMap) => {
      if (!contextoValido) throw new Error("Selecione grupo ou empresa para homologar cenarios.");
      if (!canEdit) throw new Error("Sem permissao para registrar cenarios piloto.");
      const valor_json = CENARIOS_PILOTO.map((id) => ({
        id,
        ok: Boolean(nextMap[id]),
        sucesso: Boolean(nextMap[id]),
        status: nextMap[id] ? "ok" : "pendente",
        marcado_por: user?.full_name || user?.email || "Usuario",
        marcado_em: nextMap[id] ? new Date().toISOString() : null,
      }));
      const scope = {
        group_id: groupId,
        grupo_id: groupId,
        ...(empresaId ? { empresa_id: empresaId } : {}),
      };
      const result = await base44.functions.invoke("upsertConfig", {
        chave: PILOTO_CENARIOS_CHAVE,
        data: {
          chave: PILOTO_CENARIOS_CHAVE,
          categoria: "Sistema",
          valor_json,
          ativa: true,
        },
        scope,
      });
      try {
        await createInContext("AuditLog", {
          usuario: user?.full_name || user?.email || "Usuario",
          usuario_id: user?.id || null,
          acao: "Piloto.cenarios",
          modulo: "Sistema",
          entidade: "ConfiguracaoSistema",
          registro_id: result?.data?.record?.id || cenariosConfig?.id || null,
          empresa_id: empresaId,
          group_id: groupId,
          descricao: `Homologacao piloto: ${valor_json.filter((item) => item.ok).length}/${CENARIOS_PILOTO.length} cenarios`,
          dados_novos: { valor_json },
          sucesso: true,
          data_hora: new Date().toISOString(),
        });
      } catch (error) {
        console.error("[Auditoria] Falha ao registrar cenarios piloto.", error);
        throw new Error("Auditoria obrigatoria falhou para homologacao piloto.");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["piloto-cenarios"] });
      toast.success("Cenarios piloto atualizados.");
    },
    onError: (error) => {
      toast.error(error?.message || "Falha ao salvar cenarios piloto.");
    },
  });

  const toggleCenario = (cenarioId, checked) => {
    if (!contextoValido || !canEdit || salvarCenariosMutation.isPending) return;
    const nextMap = Object.fromEntries(CENARIOS_PILOTO.map((id) => [id, okMap.has(id)]));
    nextMap[cenarioId] = checked;
    salvarCenariosMutation.mutate(nextMap);
  };

  return (
    <Card className={`w-full border-2 ${completo ? "border-green-300 bg-green-50" : "border-amber-300 bg-amber-50"}`}>
      <CardContent className="p-6">
        <div className="text-center mb-4">
          <Award className={`w-12 h-12 mx-auto mb-3 ${completo ? "text-green-600" : "text-amber-600"}`} />
          <h3 className="text-xl font-bold mb-1">
            Piloto de operacao / homologacao
          </h3>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Badge className={homologacao.papeis.length === PAPEIS_PILOTO.length ? "bg-green-600 text-white" : "bg-amber-600 text-white"}>
              <CheckCircle className="w-4 h-4 mr-2" />
              {homologacao.papeis.length}/{PAPEIS_PILOTO.length} papeis
            </Badge>
            <Badge className={homologacao.cenarios.ok ? "bg-green-600 text-white" : "bg-amber-600 text-white"}>
              <CheckCircle className="w-4 h-4 mr-2" />
              {CENARIOS_PILOTO.length - homologacao.cenarios.faltando.length}/{CENARIOS_PILOTO.length} cenarios
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
          {PAPEIS_PILOTO.map((papel) => (
            <div key={papel} className="flex items-center gap-1 text-xs bg-white/70 p-2 rounded">
              <span>{homologacao.papeis.includes(papel) ? "✅" : "⏳"}</span>
              <span className="text-slate-700">{papel}</span>
            </div>
          ))}
        </div>

        <div className="space-y-2 mb-4">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Cenarios criticos Gate 19</p>
          {!contextoValido && (
            <p className="text-xs text-amber-700 bg-white/70 p-2 rounded" data-context-required="true">
              Selecione grupo ou empresa para registrar homologacao.
            </p>
          )}
          {isLoading ? (
            <p className="text-xs text-slate-500">Carregando cenarios...</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-2">
              {CENARIOS_PILOTO.map((cenario) => {
                const checked = okMap.has(cenario);
                return (
                  <div key={cenario} className="flex items-center justify-between gap-2 text-xs bg-white/80 p-2 rounded border">
                    <span className="text-slate-700">{CENARIO_PILOTO_LABELS[cenario] || cenario}</span>
                    <Switch
                      checked={checked}
                      disabled={!contextoValido || !canEdit || salvarCenariosMutation.isPending}
                      onCheckedChange={(value) => toggleCenario(cenario, value)}
                      aria-label={`Cenario ${cenario}`}
                      data-action={`Piloto.cenario.${cenario}`}
                      data-permission="Sistema.Configuracoes.editar"
                    />
                  </div>
                );
              })}
            </div>
          )}
          {!canEdit && contextoValido && (
            <p className="text-xs text-slate-500">Sem permissao para marcar cenarios (somente leitura).</p>
          )}
        </div>

        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Badge variant="outline" className="border-blue-500 text-blue-700">
            <Shield className="w-3 h-3 mr-1" />
            NF producao so com usuario piloto
          </Badge>
          {completo ? (
            <Badge className="bg-green-700 text-white">Homologacao critica pronta para virada</Badge>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled
              title="Conclua papeis e cenarios"
            >
              Homologacao incompleta
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
