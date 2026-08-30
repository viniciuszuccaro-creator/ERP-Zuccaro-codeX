import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ProtectedSection from "@/components/security/ProtectedSection";
import { base44 } from "@/api/base44Client";
import { useUser } from "@/components/lib/UserContext";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { toast } from "sonner";

const ENTITY_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

export default function ConflitosRevisaoPanel() {
  const { user } = useUser();
  const { empresaAtual, grupoAtual, createInContext, updateInContext } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const contextoValido = !!groupId && !!empresaAtual?.id;
  const [entityName, setEntityName] = React.useState("");
  const [registroId, setRegistroId] = React.useState("");
  const [source, setSource] = React.useState("up");
  const [currentJson, setCurrentJson] = React.useState("{\n}\n");
  const [incomingJson, setIncomingJson] = React.useState("{\n}\n");
  const [result, setResult] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  const audit = React.useCallback(async ({ acao, entidade, registro, descricao, dadosNovos }) => {
    try {
      await createInContext("AuditLog", {
        usuario: user?.full_name || user?.email || "Usuario",
        usuario_id: user?.id || null,
        empresa_id: empresaAtual?.id || null,
        group_id: groupId || null,
        acao,
        modulo: "Configuracoes",
        entidade,
        registro_id: registro || null,
        tipo_auditoria: "config",
        descricao,
        dados_novos: dadosNovos || null,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn("Falha ao registrar auditoria de conflitos:", error);
    }
  }, [createInContext, empresaAtual?.id, groupId, user?.email, user?.full_name, user?.id]);

  const getEntityNameSeguro = React.useCallback(() => {
    const nome = String(entityName || "").trim();
    if (!nome || !ENTITY_NAME_PATTERN.test(nome)) {
      throw new Error("Informe uma entidade valida, sem espacos, pontos ou caracteres especiais.");
    }
    return nome;
  }, [entityName]);

  const onPreview = async () => {
    setLoading(true);
    try {
      if (!contextoValido) {
        throw new Error("Selecione um grupo e uma empresa para revisar conflitos.");
      }

      const entidadeSegura = getEntityNameSeguro();
      const current = JSON.parse(currentJson || "{}");
      const incoming = JSON.parse(incomingJson || "{}");
      const payload = {
        entity_name: entidadeSegura,
        group_id: groupId,
        empresa_id: empresaAtual.id,
        source,
        current,
        incoming,
      };
      const { data } = await base44.functions.invoke("conflictPolicy", payload);

      setResult(data);
      await audit({
        acao: "Pre-visualizacao",
        entidade: entidadeSegura,
        registro: registroId || null,
        descricao: `Pre-visualizacao de merge ${source} em ${entidadeSegura}`,
        dadosNovos: { source, policy: data?.policy || null }
      });
      toast.success("Merge pre-visualizado com auditoria.");
    } catch (e) {
      const message = String(e?.message || e);
      setResult({ error: message });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const onApply = async () => {
    if (!entityName || !registroId || !result?.merged) return;
    setLoading(true);
    try {
      if (!contextoValido) {
        throw new Error("Selecione um grupo e uma empresa para aplicar o merge.");
      }

      const entidadeSegura = getEntityNameSeguro();
      const scopedMerged = {
        ...result.merged,
        group_id: groupId,
        empresa_id: empresaAtual.id,
      };

      await updateInContext(entidadeSegura, registroId, scopedMerged);
      await audit({
        acao: "Aplicacao",
        entidade: entidadeSegura,
        registro: registroId,
        descricao: `Merge aplicado ${source} em ${entidadeSegura}`,
        dadosNovos: scopedMerged
      });

      setResult((r) => ({ ...(r || {}), applied: true }));
      toast.success("Merge aplicado e auditado.");
    } catch (e) {
      const message = String(e?.message || e);
      setResult({ ...(result || {}), apply_error: message });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedSection module="Sistema" section={["Configuracoes", "ConflictPolicy"]} action="executar" fallback={<div className="text-sm text-slate-500">Sem permissao para revisar conflitos.</div>}>
      <Card className="w-full">
        <CardContent className="p-4 space-y-3">
          {!contextoValido && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Selecione um Grupo e uma Empresa antes de pre-visualizar ou aplicar merges.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs text-slate-600">Entidade</label>
              <Input placeholder="Ex.: Produto, Cliente, ConfiguracaoSistema" value={entityName} onChange={(e) => setEntityName(e.target.value)} data-action="Conflitos.entidade" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-600">Registro ID (aplicar)</label>
              <Input placeholder="ID do registro" value={registroId} onChange={(e) => setRegistroId(e.target.value)} data-action="Conflitos.registroId" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-600">Direcao</label>
              <select className="w-full border rounded-md h-9 px-2 text-sm" value={source} onChange={(e) => setSource(e.target.value)} data-action="Conflitos.direcao">
                <option value="up">Empresa -&gt; Grupo (up)</option>
                <option value="down">Grupo -&gt; Empresa (down)</option>
              </select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-600">Atual (JSON)</label>
              <Textarea className="min-h-[160px] font-mono text-xs" value={currentJson} onChange={(e) => setCurrentJson(e.target.value)} data-action="Conflitos.jsonAtual" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-600">Entrante (JSON)</label>
              <Textarea className="min-h-[160px] font-mono text-xs" value={incomingJson} onChange={(e) => setIncomingJson(e.target.value)} data-action="Conflitos.jsonEntrante" />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={onPreview} disabled={loading || !entityName || !contextoValido} className="bg-slate-800 hover:bg-slate-700" data-action="Conflitos.previewMerge" data-permission="Sistema.Configuracoes.executar" data-context-required="group-and-company">Pre-visualizar Merge</Button>
            <Button onClick={onApply} disabled={loading || !entityName || !registroId || !result?.merged || !contextoValido} variant="outline" data-action="Conflitos.aplicarMerge" data-permission="Sistema.Configuracoes.editar" data-sensitive="true" data-context-required="group-and-company">Aplicar Merge</Button>
          </div>

          {result && (
            <div className="grid md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-600">Resultado (merged)</label>
                <pre className="bg-slate-50 border rounded p-2 text-xs overflow-auto max-h-64">{JSON.stringify(result?.merged || result, null, 2)}</pre>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-600">Politica</label>
                <pre className="bg-slate-50 border rounded p-2 text-xs overflow-auto max-h-64">{JSON.stringify(result?.policy || {}, null, 2)}</pre>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-600">Status</label>
                <pre className="bg-slate-50 border rounded p-2 text-xs overflow-auto max-h-64">{JSON.stringify({ applied: result?.applied || false, error: result?.error || result?.apply_error || null }, null, 2)}</pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </ProtectedSection>
  );
}
