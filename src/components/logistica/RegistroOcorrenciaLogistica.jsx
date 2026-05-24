import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Camera, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";

const sanitizeText = (value) => String(value || "").replace(/[<>]/g, "").replace(/javascript:/gi, "").trim();

/**
 * Registro de ocorrencias logisticas: atrasos, avarias, extravios e problemas.
 */
export default function RegistroOcorrenciaLogistica({ pedido, entrega, onClose, windowMode = false }) {
  const [tipoOcorrencia, setTipoOcorrencia] = useState("Atraso");
  const [descricao, setDescricao] = useState("");
  const [resolucao, setResolucao] = useState("");
  const [fotoUrl, setFotoUrl] = useState(null);
  const [uploadando, setUploadando] = useState(false);

  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, updateInContext, createInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { user } = useUser();

  const effectiveEmpresaId = entrega?.empresa_id || pedido?.empresa_id || empresaAtual?.id || null;
  const effectiveGroupId = entrega?.group_id || entrega?.grupo_id || pedido?.group_id || pedido?.grupo_id || grupoAtual?.id || empresaAtual?.group_id || null;
  const contextoValido = Boolean(pedido?.id && (effectiveGroupId || effectiveEmpresaId));
  const canRegister = hasPermission("Expedicao", "Ocorrencias", "criar") || hasPermission("Expedicao", "Entregas", "editar") || hasPermission("Comercial", "Pedido", "editar");

  const auditarOcorrencia = async ({ acao, sucesso = true, motivo = null, detalhes = {}, dadosNovos = null, dadosAnteriores = null }) => {
    try {
      await base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || "Usuario",
        usuario_id: user?.id,
        acao,
        modulo: "Expedicao",
        entidade: "OcorrenciaLogistica",
        registro_id: entrega?.id || pedido?.id,
        tipo_auditoria: sucesso ? "operacional" : "seguranca",
        empresa_id: effectiveEmpresaId,
        group_id: effectiveGroupId,
        grupo_id: effectiveGroupId,
        sucesso,
        resultado: sucesso ? "sucesso" : "bloqueado",
        motivo,
        detalhes,
        dados_anteriores: dadosAnteriores,
        dados_novos: dadosNovos,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn("Falha ao auditar ocorrencia logistica", error);
    }
  };

  const handleFotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadando(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFotoUrl(file_url);
      await auditarOcorrencia({ acao: "OcorrenciaLogistica.upload_foto", detalhes: { pedido_id: pedido?.id, entrega_id: entrega?.id } });
      toast.success("Foto da ocorrencia enviada.");
    } catch (error) {
      await auditarOcorrencia({ acao: "OcorrenciaLogistica.upload_foto_erro", sucesso: false, motivo: "erro_upload", detalhes: { erro: error?.message } });
      toast.error("Erro ao enviar foto: " + error.message);
    } finally {
      setUploadando(false);
    }
  };

  const registrarOcorrenciaMutation = useMutation({
    mutationFn: async () => {
      if (!contextoValido || !canRegister) {
        await auditarOcorrencia({ acao: "OcorrenciaLogistica.registrar_bloqueado", sucesso: false, motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada", detalhes: { tipoOcorrencia } });
        throw new Error("Contexto e permissao sao obrigatorios para registrar ocorrencia.");
      }
      if (!window.confirm("Confirma registrar esta ocorrencia logistica?")) {
        await auditarOcorrencia({ acao: "OcorrenciaLogistica.registrar_cancelado", sucesso: false, motivo: "confirmacao_cancelada", detalhes: { tipoOcorrencia } });
        throw new Error("Registro cancelado pelo usuario.");
      }

      const novaOcorrencia = {
        tipo: sanitizeText(tipoOcorrencia),
        descricao: sanitizeText(descricao),
        data_hora: new Date().toISOString(),
        responsavel: user?.full_name || user?.email || "Sistema",
        responsavel_id: user?.id,
        resolucao: sanitizeText(resolucao) || "Em analise",
        foto_url: fotoUrl
      };

      let entregaAtualizada = null;
      if (entrega?.id) {
        entregaAtualizada = await updateInContext("Entrega", entrega.id, {
          group_id: effectiveGroupId,
          grupo_id: effectiveGroupId,
          empresa_id: effectiveEmpresaId,
          ocorrencias: [...(entrega.ocorrencias || []), novaOcorrencia]
        });
      } else {
        entregaAtualizada = await createInContext("Entrega", {
          group_id: effectiveGroupId,
          grupo_id: effectiveGroupId,
          empresa_id: effectiveEmpresaId,
          pedido_id: pedido.id,
          numero_pedido: pedido.numero_pedido,
          cliente_id: pedido.cliente_id,
          cliente_nome: pedido.cliente_nome,
          endereco_entrega_completo: pedido.endereco_entrega_principal,
          status: "Em Transito",
          ocorrencias: [novaOcorrencia]
        });
      }

      if (tipoOcorrencia === "Entrega Frustrada") {
        await updateInContext("Pedido", pedido.id, {
          group_id: effectiveGroupId,
          grupo_id: effectiveGroupId,
          empresa_id: effectiveEmpresaId,
          status: "Em Transito",
          historico_status: [
            ...(pedido.historico_status || []),
            {
              status: "Em Transito",
              data_hora: new Date().toISOString(),
              usuario: user?.full_name || user?.email || "Sistema",
              usuario_id: user?.id,
              observacao: "Entrega frustrada registrada para nova tentativa."
            }
          ]
        });
      }

      await auditarOcorrencia({ acao: "OcorrenciaLogistica.registrar", detalhes: { tipoOcorrencia, pedido_id: pedido.id, entrega_id: entregaAtualizada?.id }, dadosAnteriores: entrega || null, dadosNovos: novaOcorrencia });
      return entregaAtualizada;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entregas"] });
      queryClient.invalidateQueries({ queryKey: ["entregas-comercial"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-entrega"] });
      toast.success("Ocorrencia registrada.");
      onClose?.();
    },
    onError: (error) => {
      if (error?.message !== "Registro cancelado pelo usuario.") toast.error(error?.message || "Erro ao registrar ocorrencia.");
    }
  });

  const containerClass = windowMode ? "w-full h-full flex flex-col" : "";

  if (!contextoValido || !canRegister) {
    return (
      <Card className={`border-yellow-200 bg-yellow-50 ${containerClass}`} data-permission="Expedicao.Ocorrencias.criar" data-context-required="true">
        <CardContent className="p-4 text-sm text-yellow-800">Selecione contexto grupo/empresa e confirme permissao para registrar ocorrencia.</CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-0 shadow-xl ${containerClass}`} data-permission="Expedicao.Ocorrencias.criar" data-context-required="true">
      <CardHeader className="bg-gradient-to-r from-orange-500 to-red-600 text-white">
        <CardTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5" />Registrar Ocorrencia</CardTitle>
        <p className="text-sm opacity-90">Pedido #{pedido?.numero_pedido}</p>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div>
          <Label>Tipo de Ocorrencia *</Label>
          <Select value={tipoOcorrencia} onValueChange={setTipoOcorrencia}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Atraso">Atraso na Entrega</SelectItem>
              <SelectItem value="Avaria">Avaria/Dano ao Produto</SelectItem>
              <SelectItem value="Extravio">Extravio/Perda</SelectItem>
              <SelectItem value="Devolucao Parcial">Devolucao Parcial</SelectItem>
              <SelectItem value="Problema Veiculo">Problema no Veiculo</SelectItem>
              <SelectItem value="Entrega Frustrada">Entrega Frustrada</SelectItem>
              <SelectItem value="Outros">Outros</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div><Label>Descricao Detalhada *</Label><Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descreva o que aconteceu em detalhes..." rows={4} /></div>
        <div><Label>Acao Tomada / Resolucao</Label><Textarea value={resolucao} onChange={(e) => setResolucao(e.target.value)} placeholder="O que foi feito para resolver? Quando sera reagendado?" rows={3} /></div>

        <Card className="bg-slate-50"><CardContent className="p-4"><Label className="mb-2 block">Foto da Ocorrencia (opcional)</Label><div className="flex gap-3"><Button variant="outline" onClick={() => document.getElementById("foto-ocorrencia-input").click()} disabled={uploadando} className="flex-1"><Camera className="w-4 h-4 mr-2" />{uploadando ? "Enviando..." : fotoUrl ? "Foto enviada" : "Enviar Foto"}</Button>{fotoUrl && <><Button variant="outline" onClick={() => window.open(fotoUrl, "_blank", "noopener,noreferrer")}>Ver</Button><Button variant="outline" onClick={() => setFotoUrl(null)} className="text-red-600"><X className="w-4 h-4" /></Button></>}</div><input id="foto-ocorrencia-input" type="file" accept="image/*" capture="environment" onChange={handleFotoUpload} className="hidden" /></CardContent></Card>

        {tipoOcorrencia === "Avaria" && <Card className="bg-red-50 border-red-300"><CardContent className="p-3 text-sm text-red-800"><p className="font-semibold">Atencao - Avaria:</p><p>Notifique o setor de qualidade e tire fotos detalhadas dos danos.</p></CardContent></Card>}
        {tipoOcorrencia === "Entrega Frustrada" && <Card className="bg-orange-50 border-orange-300"><CardContent className="p-3 text-sm text-orange-800"><p className="font-semibold">Entrega Frustrada:</p><p>Reagende a entrega e confirme novo contato com o cliente.</p></CardContent></Card>}

        <div className="flex gap-3 pt-4 border-t"><Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button><Button onClick={() => registrarOcorrenciaMutation.mutate()} disabled={!descricao.trim() || registrarOcorrenciaMutation.isPending} className="flex-1 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700" data-action="OcorrenciaLogistica.registrar" data-permission="Expedicao.Ocorrencias.criar" data-context-required="true" data-sensitive="true"><CheckCircle2 className="w-4 h-4 mr-2" />{registrarOcorrenciaMutation.isPending ? "Registrando..." : "Registrar Ocorrencia"}</Button></div>
      </CardContent>
    </Card>
  );
}
