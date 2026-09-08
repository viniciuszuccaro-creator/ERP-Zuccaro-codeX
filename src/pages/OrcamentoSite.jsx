import React from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ShoppingCart, Search, Store, ShieldCheck, CreditCard, Truck } from "lucide-react";
import { createPageUrl } from "@/utils";
import ChatbotWidget from "@/components/chatbot/ChatbotWidget";
import OrcamentoAutomaticoIA from "@/components/site/OrcamentoAutomaticoIA";
import {
  assertSiteCheckout,
  buildSiteLeadPayload,
  buildSitePagamentoPlaceholder,
  buildSitePedidoStatusResumo,
  estoqueDisponivelSite,
  filtrarProdutosSite,
  isProdutoDisponivelSite,
  matchClienteSite,
  resolvePrecoSite,
  stampSiteOrigem,
} from "@/components/lib/siteOrigemPolicy";

export default function OrcamentoSite() {
  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, filterInContext, createInContext } = useContextoVisual();

  const [busca, setBusca] = React.useState("");
  const [tabelaId, setTabelaId] = React.useState("auto");
  const [cart, setCart] = React.useState({});
  const [contato, setContato] = React.useState({ nome: "", email: "", telefone: "", documento: "" });
  const [ultimoStatus, setUltimoStatus] = React.useState(null);

  const { data: tabelas = [] } = useQuery({
    queryKey: ["tabelas", empresaAtual?.id],
    queryFn: async () => filterInContext("TabelaPreco", {}, undefined, 50),
    enabled: !!empresaAtual?.id,
    staleTime: 60000,
  });

  const { data: itensTabela = [] } = useQuery({
    queryKey: ["tabela-itens", tabelaId, empresaAtual?.id],
    queryFn: async () => {
      if (!empresaAtual?.id) return [];
      if (!tabelas?.length) return [];
      const tid = tabelaId === "auto" ? tabelas[0]?.id : tabelaId;
      if (!tid) return [];
      return await filterInContext("TabelaPrecoItem", { tabela_preco_id: tid }, undefined, 2000);
    },
    enabled: !!empresaAtual?.id && (tabelaId === "auto" ? tabelas?.length > 0 : !!tabelaId),
    staleTime: 60000,
  });

  const precoMap = React.useMemo(() => {
    const map = new Map();
    (itensTabela || []).forEach((it) => {
      if (it?.produto_id) map.set(it.produto_id, it.valor_unitario || it.preco_unitario || 0);
    });
    return map;
  }, [itensTabela]);

  const { data: catalogPayload = { produtos: [], catalogos: [] }, isLoading } = useQuery({
    queryKey: ["produtos-site", empresaAtual?.id],
    queryFn: async () => {
      const [produtos, catalogos] = await Promise.all([
        filterInContext("Produto", {}, "-updated_date", 400),
        filterInContext("CatalogoWeb", {}, "ordem_exibicao", 200),
      ]);
      return { produtos, catalogos };
    },
    enabled: !!empresaAtual?.id,
    staleTime: 30000,
  });

  const { data: cfgGateway } = useQuery({
    queryKey: ["cfg-gateway", empresaAtual?.id],
    queryFn: async () => {
      const cfgs = await filterInContext("ConfiguracaoGatewayPagamento", { ativo: true }, undefined, 1);
      return cfgs?.[0] || null;
    },
    enabled: !!empresaAtual?.id,
    staleTime: 120000,
  });

  const produtosFiltrados = React.useMemo(() => filtrarProdutosSite(catalogPayload.produtos, {
    busca,
    precoMap,
    catalogos: catalogPayload.catalogos,
  }), [catalogPayload, busca, precoMap]);

  const addToCart = (produto, qty = 1) => {
    const preco = resolvePrecoSite(produto, precoMap) || produto._precoResolvido || 0;
    const enriched = { ...produto, _precoResolvido: preco };
    if (!isProdutoDisponivelSite(enriched, qty)) {
      toast.error("Produto indisponivel no estoque online ou sem preco.");
      return;
    }
    const id = produto.id;
    setCart((prev) => {
      const curr = prev[id]?.qty || 0;
      const nextQty = curr + qty;
      if (!isProdutoDisponivelSite(enriched, nextQty)) {
        toast.error("Quantidade acima do estoque online.");
        return prev;
      }
      return { ...prev, [id]: { produto: enriched, qty: nextQty, precoUnit: preco } };
    });
  };

  const updateQty = (id, qty) => {
    setCart((prev) => {
      const item = prev[id];
      if (!item) return prev;
      const nextQty = Math.max(0, Number(qty) || 0);
      if (nextQty > 0 && !isProdutoDisponivelSite({ ...item.produto, _precoResolvido: item.precoUnit }, nextQty)) {
        toast.error("Quantidade acima do estoque online.");
        return prev;
      }
      return { ...prev, [id]: { ...item, qty: nextQty } };
    });
  };
  const removeItem = (id) => setCart((prev) => { const cp = { ...prev }; delete cp[id]; return cp; });

  const cartItems = Object.values(cart).filter((x) => x.qty > 0);
  const subtotal = cartItems.reduce((s, it) => s + it.qty * (it.precoUnit || 0), 0);

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      assertSiteCheckout({
        empresaId: empresaAtual?.id,
        itens: cartItems,
        contato,
      });

      const clientes = await filterInContext("Cliente", {}, undefined, 500);
      const cliente = matchClienteSite({
        clientes,
        email: contato.email,
        documento: contato.documento,
      });

      const risco = [];
      if (subtotal > 20000) risco.push("valor_alto");
      if (cartItems.length > 25) risco.push("muitos_itens");
      if (cartItems.some((it) => estoqueDisponivelSite(it.produto) <= 0)) risco.push("estoque_baixo");

      const itens_revenda = cartItems.map((it) => ({
        produto_id: it.produto.id,
        produto_descricao: it.produto.descricao,
        descricao: it.produto.descricao,
        quantidade: it.qty,
        unidade: it.produto.unidade_principal || it.produto.unidade_medida || "UN",
        preco_unitario: it.precoUnit,
        valor_unitario: it.precoUnit,
        valor_total: it.precoUnit * it.qty,
      }));

      const groupId = grupoAtual?.id || empresaAtual?.group_id || null;
      const pedido = await createInContext("Pedido", stampSiteOrigem({
        tipo: "Orçamento",
        data_pedido: new Date().toISOString().slice(0, 10),
        cliente_id: cliente?.id,
        cliente_nome: contato.nome || cliente?.nome || cliente?.razao_social,
        cliente_email: contato.email || cliente?.email,
        cliente_telefone: contato.telefone || cliente?.telefone,
        valor_total: subtotal,
        itens_revenda,
        prioridade: "Normal",
        pode_ver_no_portal: true,
        status: "Aberto",
      }));

      await createInContext("Oportunidade", buildSiteLeadPayload({
        nome: contato.nome || cliente?.nome,
        email: contato.email,
        telefone: contato.telefone,
        documento: contato.documento,
        valor: subtotal,
        pedidoId: pedido.id,
        clienteId: cliente?.id,
        empresaId: empresaAtual.id,
        groupId,
      }));

      const pagamentoLink = cfgGateway?.url_checkout || cfgGateway?.link_pagamento || null;
      const conta = await createInContext("ContaReceber", stampSiteOrigem({
        descricao: `Checkout OrcamentoSite #${pedido.numero_pedido || pedido.id}`,
        cliente: contato.nome || cliente?.nome,
        cliente_id: cliente?.id,
        valor: subtotal,
        data_emissao: new Date().toISOString().slice(0, 10),
        data_vencimento: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        forma_cobranca: "Link de Pagamento",
        status: "Pendente",
        status_integracao: pagamentoLink ? "aguardando_gateway" : (cfgGateway ? "aguardando_configuracao_link" : "pendente_configuracao"),
        link_pagamento: pagamentoLink || undefined,
        pedido_id: pedido.id,
      }));

      const pagamento = buildSitePagamentoPlaceholder({
        pedidoId: pedido.id,
        contaId: conta.id,
        valor: subtotal,
        gatewayAtivo: Boolean(cfgGateway),
        pagamentoUrl: pagamentoLink,
        numeroPedido: pedido.numero_pedido,
      });

      try {
        await base44.functions.invoke("paymentStatusManager", {
          action: "checkout_iniciado",
          pedido_id: pedido.id,
          conta_receber_id: conta.id,
          valor: subtotal,
          empresa_id: empresaAtual.id,
          group_id: groupId,
          antifraude_flags: risco,
          pagamento_placeholder: pagamento,
        });
      } catch (error) {
        console.error("Falha ao notificar pagamento do checkout do site", error);
      }

      await createInContext("AuditLog", {
        usuario: (await base44.auth.me())?.full_name || "Usuário",
        acao: "Site.checkout",
        modulo: "Comercial",
        tipo_auditoria: "ui",
        entidade: "Pedido",
        registro_id: pedido.id,
        descricao: `Checkout site – Pedido ${pedido.id}, CR ${conta.id}`,
        empresa_id: empresaAtual.id,
        group_id: groupId,
        dados_novos: {
          subtotal,
          itens: itens_revenda.length,
          tabela_preco_id: tabelaId === "auto" ? (tabelas?.[0]?.id || null) : tabelaId,
          origem: "site",
          pagamento,
        },
        data_hora: new Date().toISOString(),
      });

      const statusResumo = buildSitePedidoStatusResumo({
        pedido,
        conta,
        pagamento,
        portalPath: createPageUrl("PortalCliente"),
      });

      return {
        pedidoId: pedido.id,
        contaId: conta.id,
        semGateway: !cfgGateway,
        aguardandoLink: Boolean(cfgGateway) && !pagamentoLink,
        statusResumo,
      };
    },
    onSuccess: ({ semGateway, aguardandoLink, statusResumo }) => {
      setUltimoStatus(statusResumo);
      toast.success(semGateway
        ? "Orçamento gravado. O pagamento será gerado quando o gateway da filial estiver configurado."
        : aguardandoLink
          ? "Checkout gravado. Gateway ativo, mas o link ainda será gerado pelo financeiro."
          : "Checkout iniciado! Você poderá concluir o pagamento pelo link enviado.");
      setCart({});
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    },
    onError: (e) => {
      toast.error(e?.message || "Falha no checkout");
    }
  });

  return (
    <div className="w-full h-full min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <header className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 flex items-center gap-2"><Store className="w-6 h-6 text-blue-600"/> Catálogo • OrcamentoSite</h1>
            <p className="text-slate-600 text-sm lg:text-base">Multiempresa • Estoque por filial • Tabelas de preço</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produtos..." className="pl-9 w-[260px]" />
            </div>
            <Select value={tabelaId} onValueChange={setTabelaId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Tabela de preço" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Padrão da filial ({tabelas?.[0]?.descricao || "-"})</SelectItem>
                {(tabelas || []).map(tb => (
                  <SelectItem key={tb.id} value={tb.id}>{tb.descricao || tb.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="text-xs">Filial: {empresaAtual?.nome_fantasia || empresaAtual?.razao_social || empresaAtual?.id || "-"}</Badge>
            <Button asChild variant="outline" size="sm">
              <Link to={createPageUrl('PortalCliente')}>Portal do cliente</Link>
            </Button>
          </div>
        </header>

        {ultimoStatus && (
          <Card className="border-emerald-200 bg-emerald-50" data-site-status="checkout">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-emerald-900">Status do pedido no site</CardTitle>
              <CardDescription>{ultimoStatus.mensagem}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p><strong>Pedido:</strong> {ultimoStatus.numero_pedido}</p>
              <p><strong>Status:</strong> {ultimoStatus.status_pedido}</p>
              <p><strong>Pagamento:</strong> {ultimoStatus.pagamento?.mensagem}</p>
              <p><strong>Referência:</strong> {ultimoStatus.pagamento?.referencia}</p>
              <Button asChild size="sm" variant="outline" className="mt-2">
                <Link to={ultimoStatus.portal_url || createPageUrl('PortalCliente')}>Abrir portal</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          <div className="lg:col-span-2 space-y-3">
            {isLoading ? (
              <div className="p-6 text-slate-500">Carregando produtos...</div>
            ) : produtosFiltrados.length === 0 ? (
              <div className="p-6 text-slate-500">Nenhum produto encontrado.</div>
            ) : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 lg:gap-4">
                {produtosFiltrados.map((p) => {
                  const preco = resolvePrecoSite(p, precoMap) || p._precoResolvido || 0;
                  const estoque = estoqueDisponivelSite(p);
                  const disponivel = isProdutoDisponivelSite({ ...p, _precoResolvido: preco }, 1);
                  return (
                    <Card key={p.id} className="flex flex-col">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base line-clamp-2">{p.descricao}</CardTitle>
                        <CardDescription className="text-xs">{p.codigo || p.slug_site || ""}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex-1">
                        <div className="flex items-center justify-between text-sm">
                          <div className="font-semibold text-slate-900">R$ {Number(preco).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                          <Badge variant="outline" className={disponivel ? "text-emerald-700" : "text-rose-700"}>
                            {disponivel ? `Em estoque (${Math.round(estoque)})` : "Indisponivel"}
                          </Badge>
                        </div>
                      </CardContent>
                      <CardFooter className="pt-2">
                        <div className="flex items-center gap-2 w-full">
                          <Input type="number" min={1} defaultValue={1} className="w-20" onChange={(e) => { const v = Math.max(1, Number(e.target.value)||1); e.target.dataset.q = String(v); }} />
                          <Button
                            className="flex-1 bg-blue-600 hover:bg-blue-700"
                            disabled={!disponivel}
                            onClick={(e) => {
                              const qtyInput = e.currentTarget.parentElement?.querySelector("input[type='number']");
                              const qty = Number(qtyInput?.dataset?.q || qtyInput?.value || 1) || 1;
                              addToCart(p, qty);
                              if (isProdutoDisponivelSite({ ...p, _precoResolvido: preco }, qty)) {
                                toast.success("Adicionado ao carrinho");
                              }
                            }}
                          >
                            <ShoppingCart className="w-4 h-4 mr-2"/> Adicionar
                          </Button>
                        </div>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          <div className="lg:col-span-1 space-y-4">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-blue-600"/> Carrinho</CardTitle>
                <CardDescription>Revise os itens antes de finalizar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 max-h-[40vh] overflow-auto">
                {cartItems.length === 0 ? (
                  <div className="text-slate-500 text-sm">Seu carrinho está vazio.</div>
                ) : cartItems.map((it) => (
                  <div key={it.produto.id} className="flex items-start justify-between gap-2 border-b pb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium line-clamp-2">{it.produto.descricao}</p>
                      <div className="text-xs text-slate-600">R$ {it.precoUnit.toLocaleString("pt-BR", {minimumFractionDigits:2})} • {it.produto.unidade_principal || it.produto.unidade_medida || "UN"}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs">Qtd.</span>
                        <Input type="number" min={0} value={it.qty} className="w-20 h-8" onChange={(e) => updateQty(it.produto.id, e.target.value)} />
                        <Button size="sm" variant="ghost" onClick={() => removeItem(it.produto.id)}>Remover</Button>
                      </div>
                    </div>
                    <div className="text-right font-semibold">R$ {(it.qty * it.precoUnit).toLocaleString("pt-BR", {minimumFractionDigits:2})}</div>
                  </div>
                ))}
                <div className="space-y-2 pt-2 border-t">
                  <Input placeholder="Nome" value={contato.nome} onChange={(e) => setContato((c) => ({ ...c, nome: e.target.value }))} />
                  <Input placeholder="E-mail" value={contato.email} onChange={(e) => setContato((c) => ({ ...c, email: e.target.value }))} />
                  <Input placeholder="Telefone" value={contato.telefone} onChange={(e) => setContato((c) => ({ ...c, telefone: e.target.value }))} />
                  <Input placeholder="CPF/CNPJ" value={contato.documento} onChange={(e) => setContato((c) => ({ ...c, documento: e.target.value }))} />
                </div>
              </CardContent>
              <Separator />
              <CardFooter className="flex flex-col gap-2">
                <div className="w-full flex items-center justify-between text-sm">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="font-bold">R$ {subtotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="w-full flex items-center gap-2 text-xs text-slate-600">
                  <ShieldCheck className="w-4 h-4"/> Antifraude básico ativo • <Truck className="w-4 h-4"/> Frete a combinar
                </div>
                <Button disabled={!cartItems.length || checkoutMutation.isPending} onClick={() => checkoutMutation.mutate()} className="w-full bg-emerald-600 hover:bg-emerald-700">
                  <CreditCard className="w-4 h-4 mr-2"/> Finalizar Checkout
                </Button>
                {!cfgGateway && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 w-full">Gateway de pagamento não configurado para esta filial. O link poderá ser gerado posteriormente pelo financeiro.</p>
                )}
              </CardFooter>
            </Card>
          </div>
        </div>

        <OrcamentoAutomaticoIA
          onOrcamentoCriado={(orcamento) => {
            setUltimoStatus(buildSitePedidoStatusResumo({
              pedido: {
                id: orcamento?.id,
                numero_pedido: orcamento?.numero || orcamento?.id,
                tipo: 'Orçamento',
                valor_total: orcamento?.valor_total,
                pode_ver_no_portal: true,
              },
              pagamento: buildSitePagamentoPlaceholder({
                pedidoId: orcamento?.id,
                valor: orcamento?.valor_total,
                gatewayAtivo: false,
              }),
              portalPath: createPageUrl('PortalCliente'),
            }));
          }}
        />
        <ChatbotWidget canal="Site" exibirBotaoFlutuante />
      </div>
    </div>
  );
}
