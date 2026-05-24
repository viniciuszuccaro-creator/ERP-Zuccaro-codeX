import React, { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/components/lib/UserContext";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

const TIPOS = ["Atraso", "Avaria", "Extravio", "Devolução Parcial", "Problema Veículo", "Outros"];

const sanitizeText = (value) => String(value || "")
  .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "")
  .replace(/javascript:\s*/gi, "")
  .trim();

export default function OcorrenciasPanel({ entrega, onUpdated }) {
  const { user } = useUser();
  const { updateInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const [tipo, setTipo] = useState("Atraso");
  const [descricao, setDescricao] = useState("");
  const [fotoUrl, setFotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const effectiveEmpresaId = entrega?.empresa_id || empresaAtual?.id || null;
  const effectiveGroupId = entrega?.group_id || entrega?.grupo_id || grupoAtual?.id || empresaAtual?.group_id || null;
  const contextoValido = Boolean(entrega?.id && (effectiveEmpresaId || effectiveGroupId));
  const canCreateOccurrence = hasPermission("Expedicao", "Ocorrencias", "criar")
    || hasPermission("Expedicao", "Painel Logistico", "editar")
    || hasPermission("Expedicao", "Entregas", "editar");

  const auditOcorrencia = async ({ acao, sucesso = true, motivo = null, detalhes = {} }) => {
    try {
      await base44.entities.AuditLog.create({
        acao,
        modulo: "Expedicao",
        entidade: "Entrega",
        registro_id: entrega?.id || null,
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
      console.warn("Falha ao auditar ocorrencia logistica", error);
    }
  };

  const lista = useMemo(() => (
    Array.isArray(entrega?.ocorrencias) ? [...entrega.ocorrencias] : []
  ).sort((a,b)=> new Date(b.data_hora||0)-new Date(a.data_hora||0)), [entrega?.ocorrencias]);

  const uploadFoto = async (file) => {
    if (!contextoValido || !canCreateOccurrence) {
      await auditOcorrencia({ acao: "Entrega.ocorrencia.upload.bloqueado", sucesso: false, motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada" });
      return;
    }
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFotoUrl(file_url);
      await auditOcorrencia({ acao: "Entrega.ocorrencia.upload", detalhes: { nome_arquivo: file?.name, tamanho: file?.size } });
    } catch (error) {
      await auditOcorrencia({ acao: "Entrega.ocorrencia.upload.erro", sucesso: false, motivo: error?.message || "erro_upload" });
    } finally {
      setUploading(false);
    }
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      const texto = sanitizeText(descricao);
      if (!contextoValido || !canCreateOccurrence) {
        await auditOcorrencia({ acao: "Entrega.ocorrencia.criar.bloqueado", sucesso: false, motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada" });
        throw new Error("Contexto e permissao sao obrigatorios para registrar ocorrencia.");
      }
      if (!texto) throw new Error("Descricao obrigatoria.");
      const confirmado = window.confirm("Confirma incluir esta ocorrência na entrega selecionada?");
      if (!confirmado) {
        await auditOcorrencia({ acao: "Entrega.ocorrencia.criar.cancelado", sucesso: false, motivo: "confirmacao_cancelada" });
        throw new Error("Inclusao cancelada pelo usuario.");
      }
      const nova = {
        tipo,
        descricao: texto,
        data_hora: new Date().toISOString(),
        responsavel: user?.full_name || user?.email || entrega?.usuario_responsavel || "Operação",
        foto_url: fotoUrl || undefined,
      };
      const ocorrencias = Array.isArray(entrega?.ocorrencias) ? [...entrega.ocorrencias, nova] : [nova];
      const res = await updateInContext("Entrega", entrega.id, {
        ocorrencias,
        group_id: effectiveGroupId,
        grupo_id: effectiveGroupId,
        empresa_id: effectiveEmpresaId
      });
      await auditOcorrencia({ acao: "Entrega.ocorrencia.criar", detalhes: { tipo, possui_foto: Boolean(fotoUrl) } });
      return res;
    },
    onSuccess: (res) => {
      setDescricao("");
      setFotoUrl("");
      onUpdated?.(res);
    },
    onError: (error) => auditOcorrencia({ acao: "Entrega.ocorrencia.criar.erro", sucesso: false, motivo: error?.message || "erro_criar" })
  });

  return (
    <Card className="h-full flex flex-col" data-permission="Expedicao.Ocorrencias.visualizar" data-context-required="true">
      <CardHeader className="py-2 border-b bg-slate-50">
        <CardTitle className="text-sm">Ocorrências Logísticas</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto p-3 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div>
            <label className="text-xs">Tipo</label>
            <select value={tipo} onChange={(e)=>setTipo(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" disabled={!contextoValido || !canCreateOccurrence}>
              {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs">Descrição</label>
            <Input value={descricao} onChange={(e)=>setDescricao(e.target.value)} placeholder="Detalhe a ocorrência" disabled={!contextoValido || !canCreateOccurrence} />
          </div>
          <div className="md:col-span-3 flex items-center gap-2 text-xs">
            <input type="file" accept="image/*" onChange={(e)=> e.target.files?.[0] && uploadFoto(e.target.files[0])} disabled={!contextoValido || !canCreateOccurrence || uploading} data-permission="Expedicao.Ocorrencias.criar" data-context-required="true" />
            {fotoUrl && <Badge variant="outline">Foto anexada</Badge>}
            {uploading && <span className="text-slate-500">Carregando...</span>}
            <Button onClick={()=>addMutation.mutate()} disabled={!sanitizeText(descricao) || addMutation.isPending || !contextoValido || !canCreateOccurrence} className="ml-auto" data-action="Entrega.ocorrencia.criar" data-permission="Expedicao.Ocorrencias.criar" data-context-required="true" data-sensitive="true">Adicionar</Button>
          </div>
        </div>

        <div className="space-y-2">
          {lista.length === 0 && <div className="text-xs text-slate-500">Sem ocorrências registradas.</div>}
          {lista.map((o, idx) => (
            <div key={idx} className="border rounded p-2">
              <div className="flex items-center justify-between text-sm">
                <div className="font-medium">{o.tipo}</div>
                <div className="text-xs text-slate-500">{new Date(o.data_hora).toLocaleString("pt-BR")}</div>
              </div>
              <div className="text-sm text-slate-700 mt-1">{o.descricao}</div>
              {o.foto_url && (
                <a href={o.foto_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline mt-1 inline-block">Ver evidência</a>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
