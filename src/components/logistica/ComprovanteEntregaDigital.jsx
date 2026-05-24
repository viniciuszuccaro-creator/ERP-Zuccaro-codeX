import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Camera, CheckCircle2, AlertCircle, User, FileText, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";

const sanitizeText = (value) => String(value || "")
  .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "")
  .replace(/javascript:\s*/gi, "")
  .trim();

const toNumber = (value) => Number(value || 0);

/**
 * Comprovante digital de entrega.
 * Registra foto, recebedor, GPS, baixa de estoque e auditoria no contexto grupo/empresa.
 */
export default function ComprovanteEntregaDigital({ pedido, entrega, onSuccess, windowMode = false }) {
  const [nomeRecebedor, setNomeRecebedor] = useState("");
  const [documentoRecebedor, setDocumentoRecebedor] = useState("");
  const [cargoRecebedor, setCargoRecebedor] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [fotoComprovante, setFotoComprovante] = useState(null);
  const [uploadando, setUploadando] = useState(false);
  const [geolocalizacao, setGeolocalizacao] = useState(null);

  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, filterInContext, createInContext, updateInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { user } = useUser();

  const effectiveEmpresaId = pedido?.empresa_id || entrega?.empresa_id || empresaAtual?.id || null;
  const effectiveGroupId = pedido?.group_id || pedido?.grupo_id || entrega?.group_id || entrega?.grupo_id || grupoAtual?.id || empresaAtual?.group_id || null;
  const contextoValido = Boolean(pedido?.id && (effectiveEmpresaId || effectiveGroupId));
  const canConfirmDelivery = hasPermission("Expedicao", "Comprovante Digital", "criar")
    || hasPermission("Expedicao", "Entregas", "editar")
    || hasPermission("Expedicao", "Estoque", "baixar")
    || hasPermission("Comercial", "Pedido", "editar");

  const auditComprovante = async ({ acao, sucesso = true, motivo = null, detalhes = {} }) => {
    try {
      await base44.entities.AuditLog.create({
        acao,
        modulo: "Expedicao",
        entidade: "Entrega",
        registro_id: entrega?.id || pedido?.id || null,
        tipo_auditoria: sucesso ? "operacional" : "seguranca",
        usuario_id: user?.id || user?.email || null,
        usuario_nome: user?.full_name || user?.email || "Sistema",
        group_id: effectiveGroupId,
        grupo_id: effectiveGroupId,
        empresa_id: effectiveEmpresaId,
        resultado: sucesso ? "sucesso" : "bloqueado",
        motivo,
        detalhes: {
          pedido_id: pedido?.id || null,
          entrega_id: entrega?.id || null,
          ...detalhes
        },
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn("Falha ao auditar comprovante de entrega", error);
    }
  };

  const capturarGeolocalizacao = () => {
    if (!contextoValido || !canConfirmDelivery) {
      auditComprovante({ acao: "Entrega.comprovante.gps.bloqueado", sucesso: false, motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada" });
      toast.error("Contexto ou permissao obrigatoria para capturar GPS.");
      return;
    }

    if (!navigator.geolocation) {
      toast.error("GPS indisponivel neste dispositivo.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeolocalizacao({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        auditComprovante({ acao: "Entrega.comprovante.gps.capturado", detalhes: { possui_gps: true } });
        toast.success("Localizacao capturada.");
      },
      () => {
        auditComprovante({ acao: "Entrega.comprovante.gps.erro", sucesso: false, motivo: "gps_indisponivel" });
        toast.error("Erro ao capturar localizacao.");
      }
    );
  };

  const handleFotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!contextoValido || !canConfirmDelivery) {
      await auditComprovante({ acao: "Entrega.comprovante.foto.bloqueado", sucesso: false, motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada" });
      toast.error("Contexto ou permissao obrigatoria para enviar foto.");
      return;
    }

    if (!file.type?.startsWith("image/") || file.size > 8 * 1024 * 1024) {
      await auditComprovante({ acao: "Entrega.comprovante.foto.rejeitada", sucesso: false, motivo: "arquivo_invalido", detalhes: { tipo: file.type, tamanho: file.size } });
      toast.error("Envie uma imagem valida com no maximo 8MB.");
      return;
    }

    setUploadando(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFotoComprovante(file_url);
      await auditComprovante({ acao: "Entrega.comprovante.foto.enviada", detalhes: { nome_arquivo: file.name, tamanho: file.size } });
      toast.success("Foto enviada.");
    } catch (error) {
      await auditComprovante({ acao: "Entrega.comprovante.foto.erro", sucesso: false, motivo: error?.message || "erro_upload" });
      toast.error("Erro ao enviar foto: " + (error?.message || "tente novamente"));
    } finally {
      setUploadando(false);
    }
  };

  const baixarEstoqueItens = async () => {
    const itens = pedido?.itens_revenda || [];
    for (const item of itens) {
      if (!item.produto_id) continue;

      const produtos = await filterInContext("Produto", { id: item.produto_id }, undefined, 1);
      const produto = produtos?.[0];
      const quantidade = toNumber(item.quantidade);
      const estoqueAtual = toNumber(produto?.estoque_atual);

      if (!produto) {
        await auditComprovante({ acao: "Entrega.comprovante.estoque.produto_nao_encontrado", sucesso: false, motivo: "produto_nao_encontrado", detalhes: { produto_id: item.produto_id } });
        throw new Error("Produto nao encontrado para baixa: " + (item.descricao || item.produto_descricao || item.produto_id));
      }

      if (estoqueAtual < quantidade) {
        await auditComprovante({ acao: "Entrega.comprovante.estoque.insuficiente", sucesso: false, motivo: "estoque_insuficiente", detalhes: { produto_id: item.produto_id, estoqueAtual, quantidade } });
        throw new Error("Estoque insuficiente para " + (item.descricao || item.produto_descricao || item.produto_id));
      }

      const novoEstoque = estoqueAtual - quantidade;
      await createInContext("MovimentacaoEstoque", {
        group_id: effectiveGroupId,
        grupo_id: effectiveGroupId,
        empresa_id: effectiveEmpresaId,
        tipo_movimento: "saida",
        origem_movimento: "pedido",
        origem_documento_id: pedido.id,
        produto_id: item.produto_id,
        produto_descricao: sanitizeText(item.descricao || item.produto_descricao),
        quantidade,
        unidade_medida: sanitizeText(item.unidade),
        estoque_anterior: estoqueAtual,
        estoque_atual: novoEstoque,
        data_movimentacao: new Date().toISOString(),
        documento: sanitizeText(pedido.numero_pedido),
        motivo: "Entrega confirmada - " + sanitizeText(nomeRecebedor),
        responsavel: sanitizeText(nomeRecebedor),
        aprovado: true
      });

      await updateInContext("Produto", item.produto_id, {
        estoque_atual: novoEstoque,
        group_id: effectiveGroupId,
        grupo_id: effectiveGroupId,
        empresa_id: effectiveEmpresaId
      });
    }
  };

  const confirmarEntregaMutation = useMutation({
    mutationFn: async () => {
      if (!contextoValido || !canConfirmDelivery) {
        await auditComprovante({ acao: "Entrega.comprovante.confirmar.bloqueado", sucesso: false, motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada" });
        throw new Error("Contexto grupo/empresa e permissao sao obrigatorios.");
      }

      const recebedorSanitizado = sanitizeText(nomeRecebedor);
      if (!recebedorSanitizado || !fotoComprovante) {
        throw new Error("Nome do recebedor e foto do comprovante sao obrigatorios.");
      }

      const confirmado = window.confirm("Confirma registrar o comprovante, marcar a entrega como entregue e baixar o estoque deste pedido?");
      if (!confirmado) {
        await auditComprovante({ acao: "Entrega.comprovante.confirmar.cancelado", sucesso: false, motivo: "confirmacao_cancelada" });
        throw new Error("Confirmacao cancelada pelo usuario.");
      }

      await baixarEstoqueItens();

      const agora = new Date().toISOString();
      const comprovanteData = {
        foto_comprovante: fotoComprovante,
        nome_recebedor: recebedorSanitizado,
        documento_recebedor: sanitizeText(documentoRecebedor),
        cargo_recebedor: sanitizeText(cargoRecebedor),
        data_hora_recebimento: agora,
        latitude_entrega: geolocalizacao?.latitude || null,
        longitude_entrega: geolocalizacao?.longitude || null,
        observacoes_recebimento: sanitizeText(observacoes)
      };

      const entregaPayload = {
        group_id: effectiveGroupId,
        grupo_id: effectiveGroupId,
        empresa_id: effectiveEmpresaId,
        status: "Entregue",
        data_entrega: agora,
        comprovante_entrega: comprovanteData,
        historico_status: [
          ...(entrega?.historico_status || []),
          {
            status: "Entregue",
            data_hora: agora,
            usuario: user?.full_name || user?.email || "Sistema",
            observacao: "Entrega confirmada. Recebido por: " + recebedorSanitizado,
            localizacao: geolocalizacao || null
          }
        ]
      };

      if (entrega?.id) {
        await updateInContext("Entrega", entrega.id, entregaPayload);
      } else {
        await createInContext("Entrega", {
          ...entregaPayload,
          pedido_id: pedido.id,
          numero_pedido: sanitizeText(pedido.numero_pedido),
          cliente_id: pedido.cliente_id,
          cliente_nome: sanitizeText(pedido.cliente_nome),
          endereco_entrega_completo: pedido.endereco_entrega_principal || pedido.endereco_entrega_completo || null
        });
      }

      await updateInContext("Pedido", pedido.id, {
        status: "Entregue",
        group_id: effectiveGroupId,
        grupo_id: effectiveGroupId,
        empresa_id: effectiveEmpresaId
      });

      await auditComprovante({ acao: "Entrega.comprovante.confirmar", detalhes: { possui_foto: Boolean(fotoComprovante), possui_gps: Boolean(geolocalizacao), itens_baixados: pedido?.itens_revenda?.length || 0 } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["entregas"] });
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      toast.success("Entrega confirmada e estoque baixado.");
      if (onSuccess) onSuccess();
    },
    onError: (error) => {
      if (error?.message !== "Confirmacao cancelada pelo usuario.") {
        toast.error(error?.message || "Erro ao confirmar entrega.");
      }
    }
  });

  const podeConfirmar = Boolean(sanitizeText(nomeRecebedor) && fotoComprovante && contextoValido && canConfirmDelivery);
  const containerClass = windowMode ? "w-full h-full overflow-auto" : "w-full";

  return (
    <Card className={`border-0 shadow-xl ${containerClass}`} data-permission="Expedicao.ComprovanteDigital.criar" data-context-required="true">
      <CardHeader className="bg-gradient-to-r from-green-500 to-blue-600 text-white">
        <CardTitle className="flex items-center gap-2">
          <Camera className="w-5 h-5" />
          Comprovante Digital de Entrega
        </CardTitle>
        <p className="text-sm opacity-90">Pedido #{pedido?.numero_pedido || "sem numero"}</p>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {(!contextoValido || !canConfirmDelivery) && (
          <Card className="bg-red-50 border-red-300">
            <CardContent className="p-4 text-sm text-red-800">
              <p className="font-semibold">Acao bloqueada</p>
              <p>{!contextoValido ? "Selecione um grupo/empresa valido antes de confirmar a entrega." : "Seu perfil nao tem permissao para confirmar comprovante e baixar estoque."}</p>
            </CardContent>
          </Card>
        )}

        <Card className="bg-blue-50 border-blue-300">
          <CardContent className="p-4">
            <Label className="text-sm font-semibold mb-2 block">Foto do Comprovante *</Label>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => document.getElementById("foto-input")?.click()}
                disabled={uploadando || !contextoValido || !canConfirmDelivery}
                data-action="Entrega.comprovante.foto.enviar"
                data-permission="Expedicao.ComprovanteDigital.criar"
                data-context-required="true"
              >
                <Camera className="w-4 h-4 mr-2" />
                {uploadando ? "Enviando..." : fotoComprovante ? "Foto enviada" : "Tirar/Enviar Foto"}
              </Button>
              {fotoComprovante && (
                <Button type="button" variant="outline" onClick={() => window.open(fotoComprovante, "_blank")}>
                  Ver Foto
                </Button>
              )}
            </div>
            <input id="foto-input" type="file" accept="image/*" capture="environment" onChange={handleFotoUpload} className="hidden" />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="flex items-center gap-2"><User className="w-4 h-4" /> Nome de quem recebeu *</Label>
            <Input value={nomeRecebedor} onChange={(e) => setNomeRecebedor(e.target.value)} placeholder="Nome completo" disabled={!contextoValido || !canConfirmDelivery} />
          </div>
          <div>
            <Label className="flex items-center gap-2"><FileText className="w-4 h-4" /> CPF/RG do recebedor</Label>
            <Input value={documentoRecebedor} onChange={(e) => setDocumentoRecebedor(e.target.value)} placeholder="000.000.000-00" disabled={!contextoValido || !canConfirmDelivery} />
          </div>
        </div>

        <div>
          <Label>Cargo/funcao do recebedor</Label>
          <Input value={cargoRecebedor} onChange={(e) => setCargoRecebedor(e.target.value)} placeholder="Ex: Gerente, Almoxarife, Proprietario..." disabled={!contextoValido || !canConfirmDelivery} />
        </div>

        <div>
          <Label>Observacoes da entrega</Label>
          <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Ex: Entregue em perfeito estado, sem avarias..." rows={3} disabled={!contextoValido || !canConfirmDelivery} />
        </div>

        <Card className={geolocalizacao ? "bg-green-50 border-green-300" : "bg-slate-50"}>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <MapPin className={`w-5 h-5 ${geolocalizacao ? "text-green-600" : "text-slate-400"}`} />
                <div>
                  <p className="text-sm font-semibold">{geolocalizacao ? "Localizacao capturada" : "Capturar localizacao"}</p>
                  {geolocalizacao && <p className="text-xs text-slate-600">Lat: {geolocalizacao.latitude.toFixed(6)}, Lng: {geolocalizacao.longitude.toFixed(6)}</p>}
                </div>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={capturarGeolocalizacao} disabled={!contextoValido || !canConfirmDelivery} className={geolocalizacao ? "border-green-300" : ""} data-action="Entrega.comprovante.gps.capturar" data-context-required="true">
                {geolocalizacao ? "Recapturar" : "Capturar GPS"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {!podeConfirmar && (
          <Card className="bg-orange-50 border-orange-300">
            <CardContent className="p-4">
              <div className="flex items-start gap-2 text-orange-800">
                <AlertCircle className="w-5 h-5 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold">Pendencias para confirmar:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    {!sanitizeText(nomeRecebedor) && <li>Nome do recebedor</li>}
                    {!fotoComprovante && <li>Foto do comprovante</li>}
                    {!contextoValido && <li>Contexto de grupo/empresa</li>}
                    {!canConfirmDelivery && <li>Permissao RBAC</li>}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Button
          type="button"
          onClick={() => confirmarEntregaMutation.mutate()}
          disabled={!podeConfirmar || confirmarEntregaMutation.isPending}
          className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
          size="lg"
          data-action="Entrega.comprovante.confirmar"
          data-permission="Expedicao.ComprovanteDigital.criar"
          data-context-required="true"
          data-sensitive="true"
        >
          <CheckCircle2 className="w-5 h-5 mr-2" />
          {confirmarEntregaMutation.isPending ? "Confirmando..." : "Confirmar Entrega e Baixar Estoque"}
        </Button>

        <p className="text-xs text-center text-slate-500">
          Ao confirmar, o estoque sera baixado automaticamente e a operacao sera auditada.
        </p>
      </CardContent>
    </Card>
  );
}
