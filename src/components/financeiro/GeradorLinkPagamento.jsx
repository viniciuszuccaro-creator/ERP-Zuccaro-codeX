import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link2, Copy, Check, QrCode, AlertTriangle } from "lucide-react";
import { useUser } from "@/components/lib/UserContext";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { toast } from "sonner";

const sanitizeText = (value) => String(value || "")
  .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "")
  .replace(/javascript:\s*/gi, "")
  .trim();

const isSafeUrl = (value) => {
  try {
    const url = new URL(String(value || ""));
    return ["https:", "http:"].includes(url.protocol);
  } catch {
    return false;
  }
};

const allowedGateways = new Set(["asaas", "mercadopago", "pagseguro"]);

export default function GeradorLinkPagamento({ titulo, pedido, onClose }) {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, createInContext, updateInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const [linkGerado, setLinkGerado] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [config, setConfig] = useState({
    gateway: "asaas",
    validade_dias: 7,
    permitir_parcelas: false,
    max_parcelas: 1
  });

  const origem = titulo || pedido || {};
  const groupId = origem?.group_id || origem?.grupo_id || grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = origem?.empresa_id || empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const podeGerarLink = hasPermission("Financeiro", "Contas a Receber", "editar")
    || hasPermission("Financeiro", "ContaReceber", "editar")
    || hasPermission("Financeiro", "Cobranca", "criar")
    || hasPermission("Financeiro", null, "editar");
  const valor = Number(titulo?.valor_total || titulo?.valor || pedido?.valor_total || pedido?.valor || 0);
  const clienteNome = sanitizeText(titulo?.cliente_nome || titulo?.cliente || pedido?.cliente_nome || pedido?.cliente);
  const bloqueado = !contextoValido || !empresaId || !podeGerarLink;

  const withContext = (payload = {}) => ({
    ...payload,
    ...(groupId ? { group_id: groupId, grupo_id: groupId } : {}),
    ...(empresaId ? { empresa_id: empresaId } : {})
  });

  const auditLink = async (acao, sucesso, detalhes = {}) => {
    try {
      await base44.entities.AuditLog.create(withContext({
        usuario_id: user?.id || null,
        usuario_nome: user?.full_name || user?.email || "Usuario",
        acao,
        modulo: "Financeiro",
        entidade: "PagamentoOmnichannel",
        registro_id: detalhes?.pagamento_id || null,
        tipo_auditoria: sucesso ? "entidade" : "seguranca",
        descricao: `Gerador de link de pagamento: ${acao}`,
        sucesso,
        detalhes,
        data_hora: new Date().toISOString()
      }));
    } catch {}
  };

  const gerarLink = useMutation({
    mutationFn: async () => {
      if (!contextoValido || !empresaId) {
        await auditLink("bloqueado_sem_contexto", false, { titulo_id: titulo?.id, pedido_id: pedido?.id });
        throw new Error("Selecione uma empresa do grupo antes de gerar o link.");
      }
      if (!podeGerarLink) {
        await auditLink("bloqueado_sem_permissao", false, { permissao: "Financeiro.ContaReceber.editar" });
        throw new Error("Sem permissao para gerar link de pagamento.");
      }
      if (!valor || valor <= 0) {
        await auditLink("bloqueado_valor_invalido", false, { valor });
        throw new Error("Informe um titulo ou pedido com valor valido.");
      }
      const gateway = allowedGateways.has(config.gateway) ? config.gateway : "asaas";
      const validadeDias = Math.min(Math.max(Number(config.validade_dias) || 7, 1), 30);
      const confirmado = window.confirm("Gerar link de pagamento e ordem de liquidacao pendente? Esta acao sera auditada.");
      if (!confirmado) {
        await auditLink("cancelado_pelo_usuario", false, { valor, gateway });
        throw new Error("Geracao cancelada pelo usuario.");
      }

      const pagamento = await createInContext("PagamentoOmnichannel", withContext({
        origem_pagamento: "Link Pagamento",
        id_pedido_vinculado: pedido?.id || null,
        id_cliente: titulo?.cliente_id || pedido?.cliente_id || null,
        cliente_nome: clienteNome,
        cliente_cpf_cnpj: sanitizeText(titulo?.cliente_cpf_cnpj || pedido?.cliente_cpf_cnpj),
        valor_bruto: valor,
        valor_liquido: valor,
        forma_pagamento: "Link Pagamento",
        gateway_utilizado: gateway,
        status_transacao: "Pendente",
        status_conferencia: "Pendente",
        link_expiracao: new Date(Date.now() + validadeDias * 24 * 60 * 60 * 1000).toISOString(),
        conta_receber_id: titulo?.id || null
      }));

      const link = `https://pag.erp-integra.com.br/${gateway}/${encodeURIComponent(pagamento.id)}`;
      if (!isSafeUrl(link)) throw new Error("Link de pagamento invalido.");

      await updateInContext("PagamentoOmnichannel", pagamento.id, withContext({ link_pagamento: link }));

      if (titulo?.id) {
        await updateInContext("ContaReceber", titulo.id, withContext({
          link_pagamento_gerado: link,
          url_fatura: link,
          data_link_pagamento: new Date().toISOString(),
          status_cobranca: "gerada_simulada",
          forma_cobranca: "Link Pagamento",
          pagamento_omnichannel_id: pagamento.id
        }));
      }

      await createInContext("CaixaOrdemLiquidacao", withContext({
        tipo_operacao: "Recebimento",
        origem: "Omnichannel",
        titulos_vinculados: titulo ? [{
          titulo_id: titulo.id,
          tipo_titulo: "ContaReceber",
          numero_titulo: sanitizeText(titulo.numero_titulo || titulo.numero_documento),
          valor_titulo: valor,
          cliente_fornecedor_id: titulo.cliente_id || null,
          cliente_fornecedor_nome: clienteNome
        }] : [],
        valor_total: valor,
        forma_pagamento_pretendida: "Link Pagamento",
        status: "Pendente",
        data_ordem: new Date().toISOString(),
        usuario_solicitante_id: user?.id || null,
        pagamento_omnichannel_id: pagamento.id,
        pedido_omnichannel_id: pedido?.id || null
      }));

      await auditLink("link_pagamento_gerado", true, {
        pagamento_id: pagamento.id,
        valor,
        gateway,
        validade_dias: validadeDias,
        titulo_id: titulo?.id || null,
        pedido_id: pedido?.id || null
      });

      return { link, pagamento };
    },
    onSuccess: (data) => {
      setLinkGerado(data.link);
      queryClient.invalidateQueries({ queryKey: ["contas-receber"] });
      queryClient.invalidateQueries({ queryKey: ["contasReceber"] });
      queryClient.invalidateQueries({ queryKey: ["pagamentos-omnichannel"] });
      queryClient.invalidateQueries({ queryKey: ["ordens-liquidacao"] });
      toast.success("Link de pagamento gerado com sucesso!");
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao gerar link de pagamento");
    }
  });

  const copiarLink = () => {
    if (!linkGerado || !isSafeUrl(linkGerado)) return;
    navigator.clipboard.writeText(linkGerado);
    setCopiado(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <Card className="w-full">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50">
        <CardTitle className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-blue-600" />
          Gerar Link de Pagamento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {!linkGerado ? (
          <>
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-slate-600">Cliente:</span>
                <span className="font-medium">{clienteNome || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Valor:</span>
                <span className="text-lg font-bold text-green-600">
                  R$ {valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {bloqueado && (
              <Alert className="border-amber-300 bg-amber-50">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <AlertDescription className="text-amber-900">
                  {!contextoValido || !empresaId
                    ? "Selecione uma empresa do grupo antes de gerar o link."
                    : "Seu perfil nao tem permissao para gerar link de pagamento."}
                </AlertDescription>
              </Alert>
            )}

            <div>
              <Label>Gateway de Pagamento</Label>
              <Select
                value={config.gateway}
                onValueChange={(v) => setConfig({ ...config, gateway: allowedGateways.has(v) ? v : "asaas" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asaas">Asaas</SelectItem>
                  <SelectItem value="mercadopago">Mercado Pago</SelectItem>
                  <SelectItem value="pagseguro">PagSeguro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Validade do Link (dias)</Label>
              <Input
                type="number"
                min="1"
                max="30"
                value={config.validade_dias}
                onChange={(e) => setConfig({ ...config, validade_dias: Math.min(Math.max(parseInt(e.target.value, 10) || 7, 1), 30) })}
              />
            </div>

            <Button
              onClick={() => gerarLink.mutate()}
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={gerarLink.isPending || bloqueado}
              data-action="gerar-link-pagamento-omnichannel"
              data-permission="Financeiro.ContaReceber.editar"
              data-context-required="group_id,empresa_id"
              data-sensitive="true"
            >
              <Link2 className="w-4 h-4 mr-2" />
              {gerarLink.isPending ? "Gerando..." : "Gerar Link"}
            </Button>
          </>
        ) : (
          <>
            <div className="p-4 bg-green-50 border-2 border-green-500 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-green-700 font-medium">
                <Check className="w-5 h-5" />
                Link gerado com sucesso!
              </div>

              <div className="p-3 bg-white rounded border break-all text-sm">{linkGerado}</div>

              <Button onClick={copiarLink} variant="outline" className="w-full" title="Copiar link">
                {copiado ? (
                  <>
                    <Check className="w-4 h-4 mr-2 text-green-600" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar Link
                  </>
                )}
              </Button>
            </div>

            <div className="text-center p-4 bg-slate-50 rounded">
              <QrCode className="w-12 h-12 mx-auto mb-2 text-slate-400" />
              <p className="text-sm text-slate-600">QR Code sera gerado pelo gateway</p>
            </div>

            <div className="space-y-2 text-sm text-slate-600">
              <p>Link expira em {config.validade_dias} dias</p>
              <p>Pagamento sera registrado automaticamente apos confirmacao</p>
              <p>Cliente recebera notificacao por e-mail/WhatsApp</p>
            </div>

            {onClose && (
              <Button onClick={onClose} variant="outline" className="w-full">Fechar</Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
