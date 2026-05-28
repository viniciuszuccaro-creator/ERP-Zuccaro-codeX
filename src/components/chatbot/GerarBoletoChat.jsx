import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  DollarSign,
  Send,
  Copy,
  Check,
  AlertCircle,
  Calendar,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";

const sanitizeText = (value) => String(value || "")
  .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "")
  .replace(/javascript:\s*/gi, "")
  .trim();

const sanitizeLinhaDigitavel = (value) => sanitizeText(value).replace(/[^0-9 .-]/g, "");

const isSafeUrl = (value) => {
  try {
    const url = new URL(String(value || ""));
    return ["https:", "http:"].includes(url.protocol);
  } catch {
    return false;
  }
};

export default function GerarBoletoChat({ conversa, clienteId, onBoletoEnviado }) {
  const [tituloSelecionado, setTituloSelecionado] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useUser();
  const { empresaAtual, grupoAtual, filterInContext, updateInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();

  const groupId = conversa?.group_id || conversa?.grupo_id || grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = conversa?.empresa_id || empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const podeGerarBoleto = hasPermission("Financeiro", "Contas a Receber", "editar")
    || hasPermission("Financeiro", "ContaReceber", "editar")
    || hasPermission("Financeiro", "Boleto", "criar")
    || hasPermission("CRM", "Atendimento", "editar")
    || hasPermission("Financeiro", null, "editar");

  const auditBoletoChat = async (acao, sucesso, detalhes = {}) => {
    try {
      await base44.entities.AuditLog.create({
        group_id: groupId,
        grupo_id: groupId,
        empresa_id: empresaId,
        usuario_id: user?.id || null,
        usuario_nome: user?.full_name || user?.email || "Usuario",
        acao,
        modulo: "Financeiro",
        entidade: "ContaReceber",
        registro_id: detalhes?.titulo_id || tituloSelecionado?.id || null,
        tipo_auditoria: sucesso ? "entidade" : "seguranca",
        descricao: `Boleto no chat: ${acao}`,
        sucesso,
        detalhes,
        data_hora: new Date().toISOString()
      });
    } catch {}
  };

  const withContext = (payload = {}, titulo = null) => ({
    ...payload,
    ...(groupId || titulo?.group_id || titulo?.grupo_id ? { group_id: groupId || titulo?.group_id || titulo?.grupo_id, grupo_id: groupId || titulo?.group_id || titulo?.grupo_id } : {}),
    ...(empresaId || titulo?.empresa_id ? { empresa_id: empresaId || titulo?.empresa_id } : {})
  });

  const { data: titulos = [], isLoading } = useQuery({
    queryKey: ["titulos-cliente", clienteId, groupId, empresaId],
    queryFn: async () => {
      if (!clienteId || !contextoValido || !podeGerarBoleto) return [];
      return await filterInContext("ContaReceber", {
        cliente_id: clienteId,
        status: { $in: ["Pendente", "Atrasado"] }
      }, "data_vencimento", 100);
    },
    enabled: Boolean(clienteId && contextoValido && podeGerarBoleto)
  });

  const enviarBoletoMutation = useMutation({
    mutationFn: async (titulo) => {
      if (!titulo?.id) throw new Error("Selecione um titulo financeiro.");
      if (!contextoValido || !empresaId) {
        await auditBoletoChat("bloqueado_sem_contexto", false, { titulo_id: titulo.id });
        throw new Error("Selecione uma empresa do grupo antes de gerar boleto.");
      }
      if (!podeGerarBoleto) {
        await auditBoletoChat("bloqueado_sem_permissao", false, { titulo_id: titulo.id, permissao: "Financeiro.ContaReceber.editar" });
        throw new Error("Sem permissao para gerar boleto pelo chat.");
      }
      const confirmado = window.confirm("Gerar 2a via de boleto e registrar o envio na conversa? Esta acao sera auditada.");
      if (!confirmado) {
        await auditBoletoChat("cancelado_pelo_usuario", false, { titulo_id: titulo.id, valor: titulo.valor || 0 });
        throw new Error("Geracao cancelada pelo usuario.");
      }

      const linhaDigitavel = sanitizeLinhaDigitavel(titulo.linha_digitavel)
        || `23793.38128 60000.000003 00000.000409 1 ${Math.random().toString().slice(2, 16)}`;
      const urlBoleto = sanitizeText(titulo.url_boleto_pdf || titulo.boleto_url)
        || `https://boleto.exemplo.com/${encodeURIComponent(titulo.id)}`;

      if (!isSafeUrl(urlBoleto)) {
        await auditBoletoChat("bloqueado_url_insegura", false, { titulo_id: titulo.id, url_boleto: urlBoleto });
        throw new Error("URL do boleto invalida ou insegura.");
      }

      const tituloAtualizado = await updateInContext("ContaReceber", titulo.id, withContext({
        linha_digitavel: linhaDigitavel,
        url_boleto_pdf: urlBoleto,
        status_cobranca: "gerada",
        forma_cobranca: "Boleto",
        data_envio_cobranca: new Date().toISOString()
      }, titulo));

      if (conversa?.id) {
        await updateInContext("ConversaOmnicanal", conversa.id, withContext({
          conta_receber_gerada_id: titulo.id,
          acoes_automaticas_executadas: [
            ...(conversa.acoes_automaticas_executadas || []),
            {
              acao: "gerar_boleto",
              data: new Date().toISOString(),
              resultado: `Boleto R$ ${Number(titulo.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} enviado`,
              sucesso: true,
              group_id: groupId,
              empresa_id: empresaId
            }
          ]
        }, titulo));
      }

      await auditBoletoChat("boleto_chat_gerado", true, {
        titulo_id: titulo.id,
        conversa_id: conversa?.id || null,
        valor: Number(titulo.valor || 0)
      });

      return {
        ...titulo,
        ...tituloAtualizado,
        linha_digitavel: linhaDigitavel,
        url_boleto_pdf: urlBoleto
      };
    },
    onSuccess: (data) => {
      toast.success("Boleto gerado com sucesso!");
      setTituloSelecionado(data);
      queryClient.invalidateQueries({ queryKey: ["titulos-cliente"] });
      queryClient.invalidateQueries({ queryKey: ["contasReceber"] });
      onBoletoEnviado?.(data);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao gerar boleto");
    }
  });

  const copiarLinhaDigitavel = async () => {
    const linha = sanitizeLinhaDigitavel(tituloSelecionado?.linha_digitavel);
    if (!linha) return;
    await navigator.clipboard.writeText(linha);
    setCopiado(true);
    toast.success("Linha digitavel copiada!");
    setTimeout(() => setCopiado(false), 2000);
  };

  const formatarData = (data) => {
    if (!data) return "-";
    return new Date(data).toLocaleDateString("pt-BR");
  };

  const diasAtraso = (dataVencimento) => {
    if (!dataVencimento) return 0;
    const hoje = new Date();
    const vencimento = new Date(dataVencimento);
    const diff = Math.floor((hoje - vencimento) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  const valorTotal = titulos.reduce((sum, t) => sum + (Number(t.valor) || 0), 0);
  const bloqueado = !contextoValido || !empresaId || !podeGerarBoleto;

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
            <span className="text-sm text-slate-600">Carregando titulos...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-blue-900">
            <FileText className="w-5 h-5 text-blue-600" />
            Boletos / 2a Via
          </span>
          {titulos.length > 0 && (
            <Badge className={valorTotal > 0 ? "bg-red-600" : "bg-green-600"}>
              {titulos.length} titulo(s)
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {bloqueado && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <span>{!contextoValido || !empresaId ? "Selecione uma empresa do grupo para consultar boletos." : "Seu perfil nao tem permissao para gerar boleto pelo chat."}</span>
          </div>
        )}

        {titulos.length === 0 ? (
          <div className="text-center py-6 text-slate-400">
            <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum titulo em aberto</p>
          </div>
        ) : (
          <>
            <div className="p-3 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center justify-between">
                <span className="text-sm text-red-800">Total em Aberto:</span>
                <span className="text-lg font-bold text-red-600">
                  R$ {valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {titulos.map((titulo) => {
                const atraso = diasAtraso(titulo.data_vencimento);
                const selecionado = tituloSelecionado?.id === titulo.id;
                const descricao = sanitizeText(titulo.descricao || titulo.numero_documento || titulo.id);

                return (
                  <div
                    key={titulo.id}
                    className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
                      selecionado
                        ? "border-blue-500 bg-blue-50"
                        : atraso > 0
                        ? "border-red-200 bg-red-50 hover:border-red-400"
                        : "border-slate-200 bg-white hover:border-blue-300"
                    }`}
                    onClick={() => setTituloSelecionado(titulo)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">{descricao}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            <Calendar className="w-3 h-3 mr-1" />
                            {formatarData(titulo.data_vencimento)}
                          </Badge>
                          {atraso > 0 && <Badge className="bg-red-600 text-xs">{atraso} dias atraso</Badge>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">
                          R$ {(Number(titulo.valor) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {sanitizeText(titulo.numero_documento) || titulo.id?.substring(0, 8)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {tituloSelecionado && (
              <div className="space-y-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm font-semibold text-blue-900">
                  Titulo: {sanitizeText(tituloSelecionado.descricao || tituloSelecionado.numero_documento)}
                </p>

                {tituloSelecionado.linha_digitavel && (
                  <div className="p-2 bg-white rounded border">
                    <p className="text-xs text-slate-500 mb-1">Linha Digitavel:</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs font-mono break-all">
                        {sanitizeLinhaDigitavel(tituloSelecionado.linha_digitavel)}
                      </code>
                      <Button size="sm" variant="outline" onClick={copiarLinhaDigitavel} title="Copiar linha digitavel">
                        {copiado ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => enviarBoletoMutation.mutate(tituloSelecionado)}
                    disabled={enviarBoletoMutation.isPending || bloqueado}
                    className="bg-green-600 hover:bg-green-700"
                    data-action="gerar-boleto-chat"
                    data-permission="Financeiro.ContaReceber.editar"
                    data-context-required="group_id,empresa_id"
                    data-sensitive="true"
                  >
                    {enviarBoletoMutation.isPending ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Gerar 2a Via
                      </>
                    )}
                  </Button>

                  {tituloSelecionado.url_boleto_pdf && isSafeUrl(tituloSelecionado.url_boleto_pdf) && (
                    <Button
                      variant="outline"
                      onClick={() => window.open(tituloSelecionado.url_boleto_pdf, "_blank", "noopener,noreferrer")}
                      data-action="abrir-pdf-boleto-chat"
                      data-sensitive="true"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Ver PDF
                    </Button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}