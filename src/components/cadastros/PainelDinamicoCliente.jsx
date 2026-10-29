import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  User, 
  MapPin, 
  Phone, 
  Mail,
  DollarSign, 
  FileText, 
  Edit,
  ExternalLink,
  Building2,
  TrendingUp,
  Clock,
  ShoppingBag,
  Package,
  Route,
  MessageCircle,
  Activity
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import TimelineCliente, { ResumoHistorico } from "@/components/cliente/TimelineCliente";
import Top10ProdutosCliente from "@/components/comercial/Top10ProdutosCliente";
import HistoricoOrigemCliente from "@/components/comercial/HistoricoOrigemCliente";
import { Link } from "react-router-dom";
import { useWindow } from "@/components/lib/useWindow";
import CadastroClienteCompleto from "@/components/cadastros/CadastroClienteCompleto";
import HistoricoProdutosCliente from "@/components/comercial/HistoricoProdutosCliente";
import GerenciarContatosClienteForm from "@/components/cadastros/GerenciarContatosClienteForm";
import { toast } from "sonner";

/**
 * Contrato escalar HTTP: contatos[] canônico ausente/vazio e só há
 * contatos_escalares / campos e-mail|telefone|celular. Backends que
 * persistem contatos[] completo NÃO entram neste modo (Codex P2 #4410814424).
 */
function usesContatosScalarHttpContract(cliente) {
  if (Array.isArray(cliente?.contatos) && cliente.contatos.length > 0) return false;
  if (Array.isArray(cliente?.contatos_escalares?.items) && cliente.contatos_escalares.items.length > 0) {
    return true;
  }
  return Boolean(
    (typeof cliente?.email === "string" && cliente.email.trim())
    || (typeof cliente?.telefone === "string" && cliente.telefone.trim())
    || (typeof cliente?.celular === "string" && cliente.celular.trim()),
  );
}

/**
 * Rascunho do Painel: preferir contatos[] canônico; se HTTP só trouxe escalares
 * (contatos_escalares incompleto), semear a UI a partir deles — nunca começar
 * vazio e gravar parcial que nullifica e-mail/telefone/celular existentes.
 * Escalar não carrega preferência `principal`; não inventar (Codex P2 #4405581334).
 */
function seedContatosPainelDraft(cliente) {
  if (Array.isArray(cliente?.contatos) && cliente.contatos.length > 0) {
    return cliente.contatos.map((row) => ({ ...row }));
  }
  const items = cliente?.contatos_escalares?.items;
  if (Array.isArray(items) && items.length > 0) {
    return items.map((item) => ({
      nome: "",
      tipo: item.tipo || item.canal || "Telefone",
      valor: item.valor || "",
      principal: false,
    }));
  }
  // Hidratação inicial a partir de escalares soltos (sem inventar principal).
  const seeded = [];
  const push = (tipo, valor) => {
    if (valor == null || String(valor).trim() === "") return;
    seeded.push({ nome: "", tipo, valor: String(valor).trim(), principal: false });
  };
  push("E-mail", cliente?.email);
  push("Telefone", cliente?.telefone);
  push("WhatsApp", cliente?.celular);
  if (seeded.length > 0) return seeded;
  return Array.isArray(cliente?.contatos) ? cliente.contatos.map((row) => ({ ...row })) : [];
}

function contatoDraftTemCanal(lista, hints) {
  return (Array.isArray(lista) ? lista : []).some((row) => {
    const tipo = String(row?.tipo || row?.canal || "").toLowerCase();
    return hints.some((hint) => tipo.includes(hint));
  });
}

/**
 * Remove preferência principal quando há ≥2 canais com valor — somente no
 * contrato escalar HTTP (fidelidade). Backends com contatos[] completo
 * preservam principal legítimo (Codex P2 #4410814424).
 */
function stripPrincipalQuandoMultiCanal(lista, { scalarContract = false } = {}) {
  const next = Array.isArray(lista) ? lista.map((row) => ({ ...row })) : [];
  if (!scalarContract) return next;
  const valuedCount = next.filter((row) => String(row?.valor || "").trim() !== "").length;
  if (valuedCount > 1) {
    return next.map((row) => ({ ...row, principal: false }));
  }
  return next;
}

/**
 * Hidratação inicial: preenche canais escalares ausentes no rascunho.
 * NÃO usar no caminho de persistência após exclusão explícita
 * (Codex P2 #4410814417) — exclusão do operador deve prevalecer.
 */
function ensureContatosPreserveEscalars(lista, cliente) {
  const next = Array.isArray(lista) ? [...lista] : [];
  const push = (tipo, valor, hints) => {
    if (valor == null || String(valor).trim() === "") return;
    if (contatoDraftTemCanal(next, hints)) return;
    next.push({
      nome: "",
      tipo,
      valor: String(valor).trim(),
      principal: false,
    });
  };
  push("E-mail", cliente?.email, ["email", "e-mail"]);
  push("Telefone", cliente?.telefone, ["telefone", "fone", "phone"]);
  push("WhatsApp", cliente?.celular, ["celular", "whatsapp", "whats"]);
  return stripPrincipalQuandoMultiCanal(next, {
    scalarContract: usesContatosScalarHttpContract(cliente),
  });
}

/**
 * Serializa gravações de contatos (Codex P2 #4405655243): mutações enfileiram
 * em ordem; A completa antes de B gravar — evita A tardio sobrescrever B.
 */
function createContatosPersistQueue() {
  let chain = Promise.resolve();
  return (persistFn) => {
    const run = chain.then(persistFn, persistFn);
    chain = run.then(() => undefined, () => undefined);
    return run;
  };
}

/**
 * V21.1.2 - WINDOW MODE READY
 */
export default function PainelDinamicoCliente({ cliente: clienteProp, isOpen, onClose, windowMode = false }) {
  const [activeTab, setActiveTab] = useState("enderecos");
  /** Snapshot vivo: prop pode ser stale ao reabrir de janela pai (Codex P2 #4410939762). */
  const [clienteLive, setClienteLive] = useState(clienteProp);
  const [contatosDraft, setContatosDraft] = useState(() => seedContatosPainelDraft(clienteProp));
  const [contatosSaving, setContatosSaving] = useState(false);
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const { openWindow } = useWindow();
  const { updateInContext, empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = contexto === "empresa" ? empresaAtual?.id : null;
  const painelScopeKey = JSON.stringify([groupId, empresaId, contexto, clienteProp?.id ?? null]);
  const contatosPersistQueueRef = useRef(null);
  if (!contatosPersistQueueRef.current) {
    contatosPersistQueueRef.current = createContatosPersistQueue();
  }

  useEffect(() => {
    setClienteLive(clienteProp);
    setContatosDraft(seedContatosPainelDraft(clienteProp));
  }, [clienteProp?.id, clienteProp?.contatos, clienteProp?.contatos_escalares, clienteProp?.email, clienteProp?.telefone, clienteProp?.celular, painelScopeKey]);

  // Reabertura: recarregar registro persistido (não reutilizar só o snapshot do pai).
  useEffect(() => {
    if (!isOpen || !clienteProp?.id) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const fresh = await base44.entities.Cliente.get(clienteProp.id);
        if (cancelled || !fresh) return;
        setClienteLive(fresh);
        setContatosDraft(seedContatosPainelDraft(fresh));
      } catch {
        // Mantém snapshot atual; não inventar contatos.
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, clienteProp?.id, painelScopeKey]);

  const persistContatosPainel = (next) => {
    const incoming = Array.isArray(next) ? next.map((row) => ({ ...row })) : [];
    // Persistência: lista do operador vence — não re-hidratar escalares apagados
    // (Codex P2 #4410814417). Strip principal só no contrato escalar.
    const lista = stripPrincipalQuandoMultiCanal(incoming, {
      scalarContract: usesContatosScalarHttpContract(clienteLive || clienteProp),
    });
    const previousDraft = contatosDraft;
    return contatosPersistQueueRef.current(async () => {
      const live = clienteLive || clienteProp;
      if (!live?.id) return { skipped: true, lista };
      if (!groupId && !empresaId) {
        toast.error("Selecione grupo ou empresa antes de salvar contatos.");
        return { skipped: true, lista };
      }
      const hasScalars = Boolean(
        (typeof live?.email === "string" && live.email.trim())
        || (typeof live?.telefone === "string" && live.telefone.trim())
        || (typeof live?.celular === "string" && live.celular.trim())
        || (Array.isArray(live?.contatos_escalares?.items) && live.contatos_escalares.items.length > 0),
      );
      // Wipe total sem lista: ainda exige cadastro completo (proteção parcial HTTP).
      if (hasScalars && lista.length === 0 && usesContatosScalarHttpContract(live)) {
        toast.error("Contatos incompletos neste painel. Abra o cadastro completo antes de limpar canais.");
        return { skipped: true, lista };
      }
      setContatosSaving(true);
      try {
        // P1 #4410761980: não carimbar empresa_id no mestre — só group_id de escopo.
        const updated = await updateInContext("Cliente", live.id, { contatos: lista }, "group_id");
        const nextDraft = Array.isArray(updated?.contatos) && updated.contatos.length > 0
          ? updated.contatos.map((row) => ({ ...row }))
          : lista;
        setContatosDraft(nextDraft);
        if (updated && typeof updated === "object") {
          setClienteLive((prev) => ({ ...(prev || live), ...updated, contatos: nextDraft }));
        }
        toast.success("Contatos atualizados.");
        return { skipped: false, lista: nextDraft };
      } catch (error) {
        // P2 #4410875120: reverter rascunho / manter base confirmada.
        setContatosDraft(previousDraft);
        toast.error(error?.message || "Falha ao salvar contatos.");
        throw error;
      } finally {
        setContatosSaving(false);
      }
    });
  };

  const cliente = clienteLive || clienteProp;

  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos-cliente', clienteProp?.id],
    queryFn: () => base44.entities.Pedido.filter({ cliente_id: clienteProp.id }, '-data_pedido', 10),
    enabled: !!clienteProp?.id && isOpen,
  });

  const { data: entregas = [] } = useQuery({
    queryKey: ['entregas-cliente', clienteProp?.id],
    queryFn: () => base44.entities.Entrega.filter({ cliente_id: clienteProp.id }, '-created_date', 5),
    enabled: !!clienteProp?.id && isOpen,
  });

  const { data: contasReceber = [] } = useQuery({
    queryKey: ['contas-receber-cliente', clienteProp?.id],
    queryFn: () => base44.entities.ContaReceber.filter({ cliente_id: clienteProp.id }, '-data_vencimento', 5),
    enabled: !!clienteProp?.id && isOpen,
  });

  if (!cliente) return null;

  const handleEditarCadastro = () => {
    openWindow(
      CadastroClienteCompleto,
      { cliente, windowMode: true },
      {
        title: `Editar Cliente: ${cliente.nome || cliente.razao_social}`,
        width: 1100,
        height: 650,
      }
    );
    if (onClose) onClose();
  };

  const totalEmAberto = contasReceber
    .filter(c => c.status === 'Pendente' || c.status === 'Atrasado')
    .reduce((sum, c) => sum + (c.valor || 0), 0);

  const totalVendas = pedidos
    .filter(p => p.status !== 'Cancelado')
    .reduce((sum, p) => sum + (p.valor_total || 0), 0);

  const content = (
    <>
      <div className={`border-b pb-4 px-6 pt-6 flex-shrink-0 ${windowMode ? '' : 'bg-gradient-to-r from-blue-50 to-slate-50'}`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <User className="w-6 h-6 text-blue-600" />
              {cliente.nome || cliente.razao_social}
            </h2>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge className={
                cliente.status === 'Ativo' ? 'bg-green-100 text-green-700' :
                cliente.status === 'Prospect' ? 'bg-blue-100 text-blue-700' :
                cliente.status === 'Bloqueado' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-gray-700'
              }>
                {cliente.status}
              </Badge>
              {cliente.tipo && (
                <Badge variant="outline">{cliente.tipo}</Badge>
              )}
              {cliente.cpf && <span className="text-sm text-slate-600">CPF: {cliente.cpf}</span>}
              {cliente.cnpj && <span className="text-sm text-slate-600">CNPJ: {cliente.cnpj}</span>}
            </div>
          </div>
          
          <Button 
            onClick={handleEditarCadastro}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Edit className="w-4 h-4 mr-2" />
            Editar no Cadastro Geral
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-3 gap-6 p-6">
            {/* COLUNA 1: Informações Principais */}
            <div className="space-y-4">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-700">Informações Gerais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {cliente.vendedor_responsavel && (
                    <div>
                      <p className="text-xs text-slate-500">Vendedor Responsável</p>
                      <p className="font-medium text-sm">{cliente.vendedor_responsavel}</p>
                    </div>
                  )}

                  {cliente.regiao_atendimento && (
                    <div>
                      <p className="text-xs text-slate-500">Região</p>
                      <Badge variant="outline" className="text-xs">{cliente.regiao_atendimento}</Badge>
                    </div>
                  )}

                  {cliente.endereco_principal?.cidade && (
                    <div>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        Endereço Principal
                      </p>
                      <p className="text-sm font-medium">
                        {cliente.endereco_principal.cidade}, {cliente.endereco_principal.estado}
                      </p>
                      <p className="text-xs text-slate-600">
                        {cliente.endereco_principal.logradouro}, {cliente.endereco_principal.numero}
                      </p>
                    </div>
                  )}

                  {cliente.contatos && cliente.contatos.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mb-2">
                        <Phone className="w-3 h-3" />
                        Contatos
                      </p>
                      <div className="space-y-1">
                        {cliente.contatos.slice(0, 3).map((contato, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            {contato.tipo === 'WhatsApp' && <MessageCircle className="w-3 h-3 text-green-600" />}
                            {contato.tipo === 'E-mail' && <Mail className="w-3 h-3 text-blue-600" />}
                            {contato.tipo === 'Telefone' && <Phone className="w-3 h-3 text-slate-600" />}
                            <p className="text-xs">{contato.valor}</p>
                            {contato.principal && <Badge className="bg-green-600 text-xs py-0">Principal</Badge>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    Financeiro
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs text-slate-500">Limite de Crédito</p>
                    <p className="text-xl font-bold text-green-600">
                      R$ {(cliente.condicao_comercial?.limite_credito || 0).toLocaleString('pt-BR')}
                    </p>
                    {cliente.condicao_comercial?.limite_credito_utilizado > 0 && (
                      <p className="text-xs text-slate-600">
                        Utilizado: R$ {cliente.condicao_comercial.limite_credito_utilizado.toLocaleString('pt-BR')}
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">Em Aberto</p>
                    <p className={`text-lg font-semibold ${totalEmAberto > 0 ? 'text-orange-600' : 'text-slate-600'}`}>
                      R$ {totalEmAberto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  {cliente.condicao_comercial?.tabela_preco_nome && (
                    <div>
                      <p className="text-xs text-slate-500">Tabela de Preço</p>
                      <Badge variant="outline" className="text-xs">
                        {cliente.condicao_comercial.tabela_preco_nome}
                      </Badge>
                    </div>
                  )}

                  {cliente.condicao_comercial?.condicao_pagamento && (
                    <div>
                      <p className="text-xs text-slate-500">Condição de Pagamento</p>
                      <p className="text-sm font-medium">{cliente.condicao_comercial.condicao_pagamento}</p>
                    </div>
                  )}

                  {cliente.score_pagamento && (
                    <div>
                      <p className="text-xs text-slate-500">Score de Pagamento</p>
                      <p className="text-2xl font-bold text-blue-600">{cliente.score_pagamento}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-sky-600" />
                    Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs text-slate-500">Total em Vendas (12 meses)</p>
                    <p className="text-xl font-bold text-sky-600">
                      R$ {(cliente.valor_compras_12meses || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-slate-500">Pedidos</p>
                      <p className="text-lg font-semibold">{cliente.quantidade_pedidos || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Ticket Médio</p>
                      <p className="text-lg font-semibold">
                        R$ {(cliente.ticket_medio || 0).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>

                  {cliente.classificacao_abc && (
                    <div>
                      <p className="text-xs text-slate-500">Classificação</p>
                      <Badge className={
                        cliente.classificacao_abc === 'A' ? 'bg-green-600' :
                        cliente.classificacao_abc === 'B' ? 'bg-blue-600' :
                        'bg-slate-600'
                      }>
                        Classe {cliente.classificacao_abc}
                      </Badge>
                    </div>
                  )}

                  {cliente.data_ultima_compra && (
                    <div>
                      <p className="text-xs text-slate-500">Última Compra</p>
                      <p className="text-sm font-medium">
                        {new Date(cliente.data_ultima_compra).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* COLUNA 2: Histórico de Atividades */}
            <div className="space-y-4">
              <Card className="border-0 shadow-sm h-full">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600" />
                    Histórico de Atividades
                  </CardTitle>
                </CardHeader>
                <CardContent className="overflow-y-auto max-h-[480px]">
                  <ResumoHistorico clienteId={cliente.id} />
                  <div className="mt-4">
                    <TimelineCliente clienteId={cliente.id} showFilters={false} />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* COLUNA 3: Endereços e Top Produtos */}
            <div className="space-y-4">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 h-auto gap-1">
                  <TabsTrigger value="enderecos" className="text-xs">
                    <MapPin className="w-3 h-3 mr-1" />
                    Endereços
                  </TabsTrigger>
                  <TabsTrigger value="contatos" className="text-xs" data-action="painel-cliente-tab-contatos">
                    <Phone className="w-3 h-3 mr-1" />
                    Contatos
                  </TabsTrigger>
                  <TabsTrigger value="produtos" className="text-xs">
                    <Package className="w-3 h-3 mr-1" />
                    Produtos
                  </TabsTrigger>
                  <TabsTrigger value="canais" className="text-xs">
                    <Activity className="w-3 h-3 mr-1" />
                    Canais
                  </TabsTrigger>
                  <TabsTrigger value="historico_produtos" className="text-xs">
                    <Package className="w-3 h-3 mr-1" />
                    Histórico Produtos
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="enderecos" className="mt-4 space-y-2">
                  {cliente.locais_entrega && cliente.locais_entrega.length > 0 ? (
                    cliente.locais_entrega.map((endereco, idx) => (
                      <Card key={idx} className="border-0 shadow-sm">
                        <CardContent className="p-3">
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-blue-600 mt-1" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-semibold text-sm">{endereco.apelido || `Local ${idx + 1}`}</p>
                                {endereco.principal && (
                                  <Badge className="bg-green-600 text-xs py-0">Principal</Badge>
                                )}
                                {endereco.tipo_endereco && (
                                  <Badge variant="outline" className="text-xs">{endereco.tipo_endereco}</Badge>
                                )}
                              </div>
                              <p className="text-xs text-slate-600">
                                {endereco.logradouro}, {endereco.numero}
                                {endereco.complemento && ` - ${endereco.complemento}`}
                              </p>
                              <p className="text-xs text-slate-500">
                                {endereco.bairro} - {endereco.cidade}/{endereco.estado}
                              </p>
                              {endereco.contato_nome && (
                                <p className="text-xs text-slate-500 mt-1">
                                  Contato: {endereco.contato_nome}
                                  {endereco.contato_telefone && ` - ${endereco.contato_telefone}`}
                                </p>
                              )}
                              <div className="flex gap-2 mt-2">
                                {endereco.mapa_url && (
                                  <a 
                                    href={endereco.mapa_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    Google Maps
                                  </a>
                                )}
                                {endereco.latitude && endereco.longitude && (
                                  <Link
                                    to={createPageUrl('Expedicao') + '?tab=rotas'}
                                    className="text-xs text-green-600 hover:underline flex items-center gap-1"
                                  >
                                    <Route className="w-3 h-3" />
                                    Roteirizar
                                  </Link>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <MapPin className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Nenhum endereço cadastrado</p>
                    </div>
                  )}

                  {cliente.endereco_principal?.cidade && !cliente.locais_entrega?.length && (
                    <Card className="border-0 shadow-sm">
                      <CardContent className="p-3">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-blue-600 mt-1" />
                          <div>
                            <p className="font-semibold text-sm">Endereço Principal</p>
                            <p className="text-xs text-slate-600">
                              {cliente.endereco_principal.logradouro}, {cliente.endereco_principal.numero}
                            </p>
                            <p className="text-xs text-slate-500">
                              {cliente.endereco_principal.cidade}/{cliente.endereco_principal.estado}
                              {cliente.endereco_principal.cep && ` - ${cliente.endereco_principal.cep}`}
                            </p>
                            {cliente.endereco_principal.mapa_url && (
                              <a 
                                href={cliente.endereco_principal.mapa_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Google Maps
                              </a>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="contatos" className="mt-4" data-action="painel-cliente-contatos">
                  {/* Capacidade recuperada: GerenciarContatosClienteForm já existia no cadastro completo;
                      aba do Painel estava ausente — fluxo diário Cliente→contatos sem abrir form inteiro. */}
                  <GerenciarContatosClienteForm
                    contatos={contatosDraft}
                    onChange={persistContatosPainel}
                    persistBusy={contatosSaving}
                    assertScopeCurrent={() => {
                      const live = JSON.stringify([
                        grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null,
                        contexto === "empresa" ? empresaAtual?.id : null,
                        contexto,
                        cliente?.id ?? null,
                      ]);
                      if (live !== painelScopeKey) {
                        throw new Error("Contexto alterado. Reabra o painel do cliente.");
                      }
                    }}
                  />
                </TabsContent>

                <TabsContent value="produtos" className="mt-4">
                  <Top10ProdutosCliente clienteId={cliente.id} />
                </TabsContent>

                <TabsContent value="canais" className="mt-4">
                  <HistoricoOrigemCliente clienteId={cliente.id} compact={false} />
                </TabsContent>

                <TabsContent value="historico_produtos" className="mt-4">
                  <HistoricoProdutosCliente clienteId={cliente.id} />
                </TabsContent>

              </Tabs>

              {/* Últimos Pedidos */}
              <Card className="border-0 shadow-sm mt-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-sky-600" />
                    Últimos Pedidos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pedidos.length > 0 ? (
                    <div className="space-y-2">
                      {pedidos.slice(0, 5).map((pedido) => (
                        <div key={pedido.id} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                          <div>
                            <p className="text-xs font-medium">{pedido.numero_pedido}</p>
                            <p className="text-xs text-slate-500">
                              {new Date(pedido.data_pedido).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge className={`text-xs ${
                              pedido.status === 'Entregue' ? 'bg-green-100 text-green-700' :
                              pedido.status === 'Cancelado' ? 'bg-red-100 text-red-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {pedido.status}
                            </Badge>
                            <p className="text-xs font-semibold mt-1">
                              R$ {(pedido.valor_total || 0).toLocaleString('pt-BR')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 text-center py-4">Nenhum pedido</p>
                  )}
                </CardContent>
            </Card>
          </div>
        </div>

      </div>
    </>
  );

  if (windowMode) {
    return <div className="w-full h-full bg-white overflow-auto">{content}</div>;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[1180px] h-[620px] p-0 overflow-hidden flex flex-col">
        {content}
      </DialogContent>
    </Dialog>
  );
}
