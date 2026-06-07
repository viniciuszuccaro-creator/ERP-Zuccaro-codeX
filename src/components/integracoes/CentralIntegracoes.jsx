import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useUser } from "@/components/lib/UserContext";
import { useToast } from "@/components/ui/use-toast";
import { useWindow } from "@/components/lib/useWindow";
import usePermissions from "@/components/lib/usePermissions";
import ConfiguracaoNFeForm from "@/components/cadastros/ConfiguracaoNFeForm";
import ConfiguracaoBoletosForm from "@/components/cadastros/ConfiguracaoBoletosForm";
import ConfiguracaoWhatsAppForm from "@/components/cadastros/ConfiguracaoWhatsAppForm";
import SincronizacaoMarketplaces from "@/components/integracoes/SincronizacaoMarketplaces";
import BancosOpenBankingWIP from "@/components/integracoes/BancosOpenBankingWIP";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Link2,
  CreditCard,
  FileText,
  MessageCircle,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";

export default function CentralIntegracoes() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { empresaAtual, grupoAtual, filterInContext, createInContext, updateInContext } = useContextoVisual();
  const { user } = useUser();
  const { openWindow } = useWindow();
  const { isAdmin, hasPermission } = usePermissions();
  const [salvandoKey, setSalvandoKey] = React.useState(null);

  const grupoAtivoId = grupoAtual?.id
    || empresaAtual?.group_id
    || empresaAtual?.grupo_id
    || user?.grupo_atual_id
    || user?.grupo_padrao_id
    || (() => {
      try { return localStorage.getItem("group_atual_id"); } catch { return null; }
    })();

  const scopeId = empresaAtual?.id || grupoAtivoId || null;
  const scope = empresaAtual?.id
    ? { empresa_id: empresaAtual.id }
    : grupoAtivoId
      ? { group_id: grupoAtivoId }
      : {};
  const scopeLabel = empresaAtual?.id ? "empresa atual" : grupoAtivoId ? "grupo atual" : "contexto atual";
  const chaveIntegracoes = scopeId ? `integracoes_${scopeId}` : null;
  const contextoValido = Boolean(scopeId);
  const podeVisualizarIntegracoes = isAdmin() || hasPermission("Sistema", "Integrações", "visualizar") || hasPermission("Sistema", "Integracoes", "visualizar");
  const podeEditarIntegracoes = isAdmin() || hasPermission("Sistema", "Integrações", "editar") || hasPermission("Sistema", "Integracoes", "editar");
  const podeCriarIntegracoes = isAdmin() || hasPermission("Sistema", "Integrações", "criar") || hasPermission("Sistema", "Integracoes", "criar");

  const auditarIntegracao = async ({ acao, descricao, integracao, sucesso = true, dadosNovos = null }) => {
    try {
      await createInContext("AuditLog", {
        usuario: user?.full_name || user?.email || "Sistema",
        usuario_id: user?.id || null,
        empresa_id: scope?.empresa_id || null,
        group_id: grupoAtivoId || null,
        acao,
        modulo: "Integracoes",
        entidade: "ConfiguracaoSistema",
        registro_id: chaveIntegracoes || null,
        tipo_auditoria: sucesso ? "acao" : "seguranca",
        descricao,
        dados_novos: { integracao, scope, ...(dadosNovos || {}) },
        sucesso,
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.warn("Falha ao auditar central de integracoes:", error);
    }
  };

  const { data: configs = [] } = useQuery({
    queryKey: ["configuracao-integracao-marketplace", scopeId || "sem-contexto"],
    enabled: !!scopeId,
    queryFn: () => filterInContext("ConfiguracaoIntegracaoMarketplace", {}, undefined, 500),
  });

  const { data: cfgIntegracoes } = useQuery({
    queryKey: ["cfg-integracoes", chaveIntegracoes, scopeId || "sem-contexto"],
    enabled: !!chaveIntegracoes,
    queryFn: async () => {
      const existentes = await filterInContext("ConfiguracaoSistema", { chave: chaveIntegracoes }, undefined, 1);
      return existentes?.[0] || null;
    },
  });

  const setAtivo = async (key, ativo) => {
    if (!chaveIntegracoes) {
      toast({ title: "Selecione um grupo ou empresa", variant: "destructive" });
      await auditarIntegracao({
        acao: "Bloqueio sem contexto",
        descricao: "Tentativa de alternar integracao sem grupo ou empresa.",
        integracao: key,
        sucesso: false,
        dadosNovos: { ativo },
      });
      return;
    }
    if (!podeEditarIntegracoes && !podeCriarIntegracoes) {
      toast({ title: "Acesso negado", description: "Seu perfil nao permite alterar integracoes.", variant: "destructive" });
      await auditarIntegracao({
        acao: "Bloqueio por permissao",
        descricao: "Tentativa de alternar integracao sem permissao.",
        integracao: key,
        sucesso: false,
        dadosNovos: { ativo },
      });
      return;
    }

    setSalvandoKey(key);
    try {
      const existentes = await filterInContext("ConfiguracaoSistema", { chave: chaveIntegracoes }, undefined, 1);
      const payload = {
        chave: chaveIntegracoes,
        categoria: "Integracoes",
        ...scope,
        [key]: { ...(existentes?.[0]?.[key] || {}), ativo },
      };

      if (existentes && existentes.length > 0) {
        await updateInContext("ConfiguracaoSistema", existentes[0].id, { ...existentes[0], ...payload });
      } else {
        await createInContext("ConfiguracaoSistema", payload);
      }

      await auditarIntegracao({
        acao: ativo ? "Ativacao" : "Desativacao",
        descricao: `${ativo ? "Ativacao" : "Desativacao"} de integracao no ${scopeLabel}`,
        integracao: key,
        dadosNovos: { chave: key, ativo, registro_id: existentes?.[0]?.id || null },
      });

      toast({ title: ativo ? `Integracao ativada no ${scopeLabel}` : `Integracao desativada no ${scopeLabel}` });
      await queryClient.invalidateQueries({ queryKey: ["cfg-integracoes", chaveIntegracoes, scopeId || "sem-contexto"] });
      await queryClient.invalidateQueries({ queryKey: ["configuracaoSistema"] });
    } catch (error) {
      toast({ title: "Erro ao salvar integracao", description: String(error?.message || error), variant: "destructive" });
    } finally {
      setSalvandoKey(null);
    }
  };

  const isAtivo = (key) => Boolean(cfgIntegracoes?.[key]?.ativo);

  const abrirConfiguracao = async (integracao) => {
    if (!chaveIntegracoes) {
      toast({ title: "Selecione um grupo ou empresa", variant: "destructive" });
      await auditarIntegracao({
        acao: "Bloqueio sem contexto",
        descricao: "Tentativa de abrir configuracao de integracao sem grupo ou empresa.",
        integracao: integracao.key || integracao.nome,
        sucesso: false,
      });
      return;
    }
    if (!podeVisualizarIntegracoes) {
      toast({ title: "Acesso negado", description: "Seu perfil nao permite visualizar integracoes.", variant: "destructive" });
      await auditarIntegracao({
        acao: "Bloqueio por permissao",
        descricao: "Tentativa de abrir configuracao de integracao sem permissao.",
        integracao: integracao.key || integracao.nome,
        sucesso: false,
      });
      return;
    }
    if (integracao.cmp) {
      await auditarIntegracao({
        acao: "Abrir Configuracao",
        descricao: `Abertura de configuracao de integracao: ${integracao.nome}`,
        integracao: integracao.key || integracao.nome,
      });
      openWindow(
        integracao.cmp,
        {
          windowMode: true,
          empresaId: empresaAtual?.id || null,
          groupId: grupoAtivoId || null,
          scope,
        },
        integracao.win || { title: "Configuracao", width: 1000, height: 700 }
      );
    } else {
      toast({
        title: "Configuracao indisponivel",
        description: "Esta integracao ainda nao possui tela de configuracao.",
      });
    }
  };

  const integracoesDisponiveis = [
    {
      nome: "NF-e / SEFAZ",
      tipo: "Fiscal",
      status: "Configurado",
      icon: FileText,
      cor: "text-blue-600",
      descricao: "Emissao e validacao de NF-e",
      key: "integracao_nfe",
      cmp: ConfiguracaoNFeForm,
      win: { title: "Configuracao NF-e", width: 1100, height: 700 },
    },
    {
      nome: "Boletos & Pagamentos",
      tipo: "Financeiro",
      status: "Configurado",
      icon: CreditCard,
      cor: "text-green-600",
      descricao: "Geracao de boletos e links de pagamento",
      key: "integracao_boletos",
      cmp: ConfiguracaoBoletosForm,
      win: { title: "Configuracao de Boletos", width: 1000, height: 700 },
    },
    {
      nome: "WhatsApp Business",
      tipo: "Comunicacao",
      status: "Ativo",
      icon: MessageCircle,
      cor: "text-green-600",
      descricao: "Chatbot e notificacoes automaticas",
      key: "integracao_whatsapp",
      cmp: ConfiguracaoWhatsAppForm,
      win: { title: "Configuracao WhatsApp Business", width: 900, height: 680 },
    },
    {
      nome: "Marketplaces",
      tipo: "E-commerce",
      status: configs.length > 0 ? "Ativo" : "Inativo",
      icon: ShoppingCart,
      cor: "text-purple-600",
      descricao: "Mercado Livre, Shopee, Amazon",
      key: "integracao_marketplaces",
      cmp: SincronizacaoMarketplaces,
      win: { title: "Sincronizacao de Marketplaces", width: 1200, height: 720 },
    },
    {
      nome: "Bancos (Open Banking)",
      tipo: "Financeiro",
      status: "Em Desenvolvimento",
      icon: TrendingUp,
      cor: "text-indigo-600",
      descricao: "Conciliacao automatica de extratos",
      key: "integracao_bancos",
      cmp: BancosOpenBankingWIP,
      win: { title: "Bancos (Open Banking)", width: 900, height: 600 },
    },
  ];

  const getStatusIcon = (integracao) => {
    const active = integracao.key && isAtivo(integracao.key);
    if (active || integracao.status === "Ativo" || integracao.status === "Configurado") {
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    }
    if (integracao.status === "Inativo") return <XCircle className="w-5 h-5 text-red-600" />;
    return <Loader2 className="w-5 h-5 text-yellow-600 animate-spin" />;
  };

  const getBadgeClass = (integracao) => {
    if ((integracao.key && isAtivo(integracao.key)) || integracao.status === "Ativo" || integracao.status === "Configurado") {
      return "bg-green-100 text-green-800";
    }
    if (integracao.status === "Inativo") return "bg-red-100 text-red-800";
    return "bg-yellow-100 text-yellow-800";
  };

  const getBadgeLabel = (integracao) => {
    if (integracao.key && isAtivo(integracao.key)) return "Ativo";
    return integracao.status;
  };

  return (
    <div className="w-full h-full space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Central de Integracoes</h2>
        <p className="text-sm text-slate-600 mt-1">Gerencie todas as integracoes do sistema no {scopeLabel}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {integracoesDisponiveis.map((integracao) => {
          const Icon = integracao.icon;
          const ativo = integracao.key ? isAtivo(integracao.key) : false;
          const salvando = salvandoKey === integracao.key;

          return (
            <Card key={integracao.key || integracao.nome} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-slate-100 ${integracao.cor}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{integracao.nome}</CardTitle>
                      <p className="text-xs text-slate-500 mt-1">{integracao.tipo}</p>
                    </div>
                  </div>

                  {getStatusIcon(integracao)}
                </div>
              </CardHeader>

              <CardContent>
                <p className="text-sm text-slate-600 mb-3">{integracao.descricao}</p>

                <div className="flex items-center gap-2">
                  <Badge className={getBadgeClass(integracao)}>
                    {getBadgeLabel(integracao)}
                  </Badge>

                  {integracao.key && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAtivo(integracao.key, !ativo)}
                      disabled={!contextoValido || salvando || (!podeEditarIntegracoes && !podeCriarIntegracoes)}
                      data-action={`Integracoes.${integracao.key}.toggle`}
                      data-permission="Sistema.Integracoes.editar"
                      data-context-required="group-or-company"
                      data-sensitive="true"
                    >
                      {salvando ? "Salvando..." : ativo ? "Desativar" : "Ativar"}
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto"
                    disabled={!contextoValido || !podeVisualizarIntegracoes}
                    data-action={`Integracoes.${integracao.key || integracao.nome}.configurar`}
                    data-permission="Sistema.Integracoes.visualizar"
                    data-context-required="group-or-company"
                    data-sensitive="true"
                    onClick={() => abrirConfiguracao(integracao)}
                  >
                    <Link2 className="w-3 h-3 mr-1" />
                    Configurar
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-900">Hub de Integracoes Futuro</p>
              <p className="text-sm text-blue-700 mt-1">
                Em breve: Open Banking, ERPs externos, CRMs, automacoes avancadas e muito mais!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
