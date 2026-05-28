import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Scan,
  CheckCircle,
  Package,
  AlertTriangle,
  MapPin,
  Zap,
  TrendingUp
} from "lucide-react";
import { useUser } from "@/components/lib/UserContext";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

const sanitizeText = (value) => String(value || "").replace(/[<>]/g, "").trim();

/**
 * ETAPA 6: Separacao e Conferencia com IA V21.4.
 * Scanner, validacao por IA, picking inteligente e finalizacao auditada.
 */
export default function SeparacaoConferenciaIA({ pedidoId, onClose, windowMode = false }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const { empresaAtual, grupoAtual, filterInContext, createInContext, updateInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();

  const [codigoBarras, setCodigoBarras] = useState("");
  const [cronometro, setCronometro] = useState({ ativo: true, segundos: 0 });
  const [desempenho, setDesempenho] = useState({ itensPorHora: 0, acuracia: 100 });
  const [separacao, setSeparacao] = useState({
    pedido_id: pedidoId,
    separador_id: user?.id || "",
    separador_nome: user?.full_name || user?.email || "",
    data_inicio: new Date().toISOString(),
    data_conclusao: "",
    tempo_total_minutos: 0,
    itens_separados: [],
    divergencias: [],
    status: "Em Separacao",
    localizacao_atual: "",
    rota_otimizada_ia: [],
    peso_conferido_kg: 0,
    foto_comprovacao_url: "",
    observacoes: ""
  });

  const baseEmpresaId = empresaAtual?.id || null;
  const baseGroupId = grupoAtual?.id || empresaAtual?.group_id || null;
  const contextoBaseValido = Boolean(baseGroupId || baseEmpresaId);
  const canUseSeparacaoIA = hasPermission("Expedicao", "Separacao", "editar") ||
    hasPermission("Expedicao", "Separacao", "criar") ||
    hasPermission("Expedicao", "Entregas", "editar");

  const { data: pedido } = useQuery({
    queryKey: ["pedido-separacao-ia", pedidoId, baseGroupId, baseEmpresaId],
    queryFn: async () => {
      const rows = await filterInContext("Pedido", { id: pedidoId }, undefined, 1);
      return rows[0] || null;
    },
    enabled: Boolean(pedidoId && contextoBaseValido && canUseSeparacaoIA)
  });

  const effectiveEmpresaId = pedido?.empresa_id || baseEmpresaId;
  const effectiveGroupId = pedido?.group_id || pedido?.grupo_id || baseGroupId;
  const contextoValido = Boolean(effectiveGroupId || effectiveEmpresaId);

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-separacao-ia", effectiveGroupId, effectiveEmpresaId],
    queryFn: () => filterInContext("Produto", {}, "descricao", 1000),
    enabled: contextoValido && canUseSeparacaoIA
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ["colaboradores-separacao-ia", effectiveGroupId, effectiveEmpresaId],
    queryFn: () => filterInContext("Colaborador", {}, "nome", 500),
    enabled: contextoValido && canUseSeparacaoIA
  });

  const auditarSeparacaoIA = async ({ acao, descricao, sucesso = true, dadosNovos = {}, dadosAnteriores = null, registroId = null }) => {
    try {
      await base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || "Usuario",
        usuario_id: user?.id,
        acao,
        modulo: "Expedicao",
        tipo_auditoria: sucesso ? "operacional" : "seguranca",
        entidade: "SeparacaoConferencia",
        registro_id: registroId || pedidoId,
        descricao,
        empresa_id: effectiveEmpresaId,
        group_id: effectiveGroupId,
        grupo_id: effectiveGroupId,
        sucesso,
        dados_anteriores: dadosAnteriores,
        dados_novos: dadosNovos,
        data_hora: new Date().toISOString()
      });
    } catch (auditError) {
      console.warn("Falha ao auditar separacao/conferencia IA:", auditError);
    }
  };

  const validarIAMutation = useMutation({
    mutationFn: async (item) => {
      if (!contextoValido || !canUseSeparacaoIA) {
        await auditarSeparacaoIA({
          acao: "SeparacaoConferenciaIA.validacao_bloqueada",
          descricao: "Tentativa de validar item por IA sem contexto ou permissao.",
          sucesso: false,
          dadosNovos: { motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada", item }
        });
        throw new Error("Contexto e permissao sao obrigatorios para validar por IA.");
      }

      return await base44.integrations.Core.InvokeLLM({
        prompt: `Analise a separacao do item de forma objetiva e segura.

Item Pedido: ${sanitizeText(item.descricao)}
Quantidade Pedida: ${Number(item.quantidade_pedida || item.quantidade || 0)}
Quantidade Separada: ${Number(item.quantidade_separada || 0)}
Peso Esperado: ${Number(item.peso_total_kg || 0)} kg
Peso Conferido: ${Number(item.peso_conferido || 0)} kg

Identifique divergencias e sugira acoes operacionais:
1. Ha divergencia de quantidade?
2. Ha divergencia de peso significativa acima de 5%?
3. Existem produtos similares seguros se o item estiver em falta?
4. Classificacao de risco: Baixo, Medio ou Alto.`,
        response_json_schema: {
          type: "object",
          properties: {
            divergencia_quantidade: { type: "boolean" },
            divergencia_peso: { type: "boolean" },
            produtos_similares: { type: "array", items: { type: "string" } },
            risco: { type: "string" },
            acoes_sugeridas: { type: "array", items: { type: "string" } }
          }
        }
      });
    },
    onSuccess: (resultado, item) => auditarSeparacaoIA({
      acao: "SeparacaoConferenciaIA.validar_item",
      descricao: "Item validado pela IA durante separacao/conferencia.",
      dadosNovos: { item, resultado }
    }),
    onError: (error) => auditarSeparacaoIA({
      acao: "SeparacaoConferenciaIA.validacao_erro",
      descricao: "Erro ao validar item por IA.",
      sucesso: false,
      dadosNovos: { erro: error?.message }
    })
  });

  const otimizarRotaMutation = useMutation({
    mutationFn: async (itens) => {
      if (!contextoValido || !canUseSeparacaoIA) {
        await auditarSeparacaoIA({
          acao: "SeparacaoConferenciaIA.rota_bloqueada",
          descricao: "Tentativa de otimizar rota de picking sem contexto ou permissao.",
          sucesso: false,
          dadosNovos: { motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada" }
        });
        throw new Error("Contexto e permissao sao obrigatorios para otimizar rota.");
      }

      return await base44.integrations.Core.InvokeLLM({
        prompt: `Otimize a rota de picking para separacao de ${itens.length} itens.

Itens: ${JSON.stringify(itens.map(i => ({
          produto: sanitizeText(i.produto_descricao || i.descricao),
          localizacao: sanitizeText(i.localizacao || "Nao definida")
        })))}

Gere uma rota otimizada considerando menor distancia, agrupamento por area/corredor, prioridade operacional e ordem logica de coleta.`,
        response_json_schema: {
          type: "object",
          properties: {
            rota_otimizada: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  ordem: { type: "number" },
                  produto: { type: "string" },
                  localizacao: { type: "string" },
                  distancia_estimada_m: { type: "number" }
                }
              }
            },
            distancia_total_m: { type: "number" },
            tempo_estimado_min: { type: "number" }
          }
        }
      });
    },
    onSuccess: (resultado) => auditarSeparacaoIA({
      acao: "SeparacaoConferenciaIA.otimizar_rota",
      descricao: "Rota de picking otimizada por IA.",
      dadosNovos: resultado
    }),
    onError: (error) => auditarSeparacaoIA({
      acao: "SeparacaoConferenciaIA.rota_erro",
      descricao: "Erro ao otimizar rota de picking por IA.",
      sucesso: false,
      dadosNovos: { erro: error?.message }
    })
  });

  const finalizarSeparacaoMutation = useMutation({
    mutationFn: async () => {
      if (!pedido) throw new Error("Pedido nao encontrado para separacao.");
      if (!contextoValido) {
        await auditarSeparacaoIA({
          acao: "SeparacaoConferenciaIA.finalizar_bloqueado",
          descricao: "Tentativa de finalizar separacao IA sem contexto grupo/empresa.",
          sucesso: false,
          dadosNovos: { motivo: "contexto_obrigatorio" }
        });
        throw new Error("Contexto multiempresa obrigatorio para finalizar separacao.");
      }
      if (!canUseSeparacaoIA) {
        await auditarSeparacaoIA({
          acao: "SeparacaoConferenciaIA.finalizar_bloqueado",
          descricao: "Tentativa de finalizar separacao IA sem permissao.",
          sucesso: false,
          dadosNovos: { motivo: "permissao_negada" }
        });
        throw new Error("Sem permissao para finalizar separacao/conferencia.");
      }
      if (!window.confirm("Confirma finalizar a separacao/conferencia IA deste pedido?")) {
        await auditarSeparacaoIA({
          acao: "SeparacaoConferenciaIA.finalizar_cancelado",
          descricao: "Usuario cancelou a finalizacao da separacao IA.",
          sucesso: false,
          dadosNovos: { motivo: "confirmacao_cancelada" }
        });
        throw new Error("Finalizacao cancelada pelo usuario.");
      }

      const tempoTotalMinutos = Math.floor(cronometro.segundos / 60);
      const temDivergencia = separacao.divergencias.length > 0;
      const registro = await createInContext("SeparacaoConferencia", {
        ...separacao,
        group_id: effectiveGroupId,
        grupo_id: effectiveGroupId,
        empresa_id: effectiveEmpresaId,
        numero_separacao: `SEP-IA-${Date.now()}`,
        pedido_id: pedido.id,
        numero_pedido: pedido.numero_pedido,
        cliente_id: pedido.cliente_id,
        cliente_nome: pedido.cliente_nome,
        tipo: "conferencia_ia",
        separador_id: user?.id || separacao.separador_id,
        separador_nome: user?.full_name || user?.email || separacao.separador_nome || "Conferente",
        data_conclusao: new Date().toISOString(),
        tempo_total_minutos: tempoTotalMinutos,
        tempo_separacao_min: tempoTotalMinutos,
        status: temDivergencia ? "com_divergencia" : "concluido",
        tem_divergencia: temDivergencia,
        divergencias_resumo: temDivergencia ? `${separacao.divergencias.length} divergencia(s) detectada(s) pela IA.` : "",
        itens: separacao.itens_separados,
        observacoes: sanitizeText(separacao.observacoes)
      });

      await updateInContext("Pedido", pedido.id, {
        group_id: effectiveGroupId,
        grupo_id: effectiveGroupId,
        empresa_id: effectiveEmpresaId,
        status: temDivergencia ? "Separacao com Divergencia" : "Pronto para Faturar",
        historico_status: [
          ...(pedido.historico_status || []),
          {
            status: temDivergencia ? "Separacao com Divergencia" : "Pronto para Faturar",
            data_hora: new Date().toISOString(),
            usuario: user?.full_name || user?.email || "Sistema",
            usuario_id: user?.id,
            observacao: temDivergencia
              ? "Separacao/conferencia IA concluida com divergencias."
              : "Separacao/conferencia IA concluida sem divergencias."
          }
        ]
      });

      await auditarSeparacaoIA({
        acao: "SeparacaoConferenciaIA.finalizar",
        descricao: "Separacao/conferencia IA finalizada e pedido atualizado.",
        dadosAnteriores: pedido,
        dadosNovos: registro,
        registroId: registro.id
      });

      return registro;
    },
    onSuccess: () => {
      setCronometro(prev => ({ ...prev, ativo: false }));
      queryClient.invalidateQueries({ queryKey: ["pedido-separacao-ia"] });
      queryClient.invalidateQueries({ queryKey: ["pedido"] });
      queryClient.invalidateQueries({ queryKey: ["separacoes"] });
      toast({ title: "Separacao concluida", description: `${separacao.itens_separados.length} itens separados` });
      onClose?.();
    },
    onError: (error) => {
      if (error?.message !== "Finalizacao cancelada pelo usuario.") {
        toast({ title: "Erro ao finalizar separacao", description: error?.message, variant: "destructive" });
      }
    }
  });

  useEffect(() => {
    let interval;
    if (cronometro.ativo) {
      interval = setInterval(() => {
        setCronometro(prev => ({ ...prev, segundos: prev.segundos + 1 }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [cronometro.ativo]);

  useEffect(() => {
    if (separacao.itens_separados.length > 0 && cronometro.segundos > 0) {
      const horas = cronometro.segundos / 3600;
      const itensPorHora = separacao.itens_separados.length / horas;
      const totalItens = pedido?.itens_revenda?.length || 1;
      const itensSeparados = separacao.itens_separados.length;
      const acuracia = Math.min((itensSeparados / totalItens) * 100, 100);
      setDesempenho({ itensPorHora: itensPorHora.toFixed(1), acuracia: acuracia.toFixed(0) });
    }
  }, [separacao.itens_separados, cronometro.segundos, pedido]);

  const handleScanCodigoBarras = async () => {
    const codigo = sanitizeText(codigoBarras);
    if (!codigo) return;

    if (!contextoValido || !canUseSeparacaoIA) {
      await auditarSeparacaoIA({
        acao: "SeparacaoConferenciaIA.scan_bloqueado",
        descricao: "Tentativa de escanear item sem contexto ou permissao.",
        sucesso: false,
        dadosNovos: { codigo, motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada" }
      });
      toast({ title: "Operacao bloqueada", description: "Selecione contexto valido e confirme permissao.", variant: "destructive" });
      return;
    }

    const produto = produtos.find(p => p.codigo_barras === codigo || p.codigo === codigo);

    if (produto) {
      const itemPedido = pedido?.itens_revenda?.find(i => i.produto_id === produto.id || i.codigo === produto.codigo);

      if (itemPedido) {
        const novoItem = {
          produto_id: produto.id,
          descricao: sanitizeText(produto.descricao || itemPedido.produto_descricao),
          quantidade_pedida: Number(itemPedido.quantidade || 0),
          quantidade_separada: 1,
          peso_conferido: Number(produto.peso_liquido_kg || 0),
          localizacao: sanitizeText(produto.localizacao || "N/A"),
          data_hora_separacao: new Date().toISOString()
        };

        setSeparacao(prev => ({
          ...prev,
          itens_separados: [...prev.itens_separados, novoItem]
        }));

        const validacao = await validarIAMutation.mutateAsync(novoItem);

        if (validacao.divergencia_quantidade || validacao.divergencia_peso) {
          setSeparacao(prev => ({
            ...prev,
            divergencias: [...prev.divergencias, { item: novoItem.descricao, validacao }]
          }));
          toast({
            title: "Divergencia detectada",
            description: `Verifique ${novoItem.descricao}`,
            variant: "destructive"
          });
        } else {
          toast({ title: "Item separado", description: novoItem.descricao });
        }
      } else {
        await auditarSeparacaoIA({
          acao: "SeparacaoConferenciaIA.item_fora_pedido",
          descricao: "Codigo escaneado nao pertence ao pedido.",
          sucesso: false,
          dadosNovos: { codigo, produto_id: produto.id }
        });
        toast({
          title: "Item nao esta no pedido",
          description: "Codigo nao encontrado neste pedido",
          variant: "destructive"
        });
      }
    } else {
      await auditarSeparacaoIA({
        acao: "SeparacaoConferenciaIA.codigo_nao_encontrado",
        descricao: "Codigo de barras nao localizado em produtos do contexto.",
        sucesso: false,
        dadosNovos: { codigo }
      });
      toast({ title: "Codigo nao encontrado", description: "Produto nao cadastrado", variant: "destructive" });
    }

    setCodigoBarras("");
  };

  const handleOtimizarRota = async () => {
    if (!pedido?.itens_revenda?.length) return;

    toast({ title: "Otimizando rota", description: "IA processando a sequencia de picking." });
    const resultado = await otimizarRotaMutation.mutateAsync(pedido.itens_revenda);

    setSeparacao(prev => ({
      ...prev,
      rota_otimizada_ia: resultado.rota_otimizada || []
    }));

    toast({
      title: "Rota otimizada",
      description: `${resultado.distancia_total_m || 0}m - ${resultado.tempo_estimado_min || 0} min estimados`
    });
  };

  const formatarTempo = (segundos) => {
    const h = Math.floor(segundos / 3600);
    const m = Math.floor((segundos % 3600) / 60);
    const s = segundos % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const containerClass = windowMode ? "w-full h-full flex flex-col overflow-auto" : "w-full h-full space-y-6";

  if (!contextoValido || !canUseSeparacaoIA) {
    return (
      <div className={containerClass} data-permission="Expedicao.Separacao.editar" data-context-required="true">
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4 text-sm text-yellow-800">
            Selecione um contexto grupo/empresa e confirme permissao para usar separacao e conferencia com IA.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={containerClass} data-permission="Expedicao.Separacao.editar" data-context-required="true">
      <div className={windowMode ? "p-6 space-y-6 flex-1" : "space-y-6"}>
        <Card className="bg-gradient-to-r from-purple-600 to-purple-700 text-white">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-2xl">Separacao e Conferencia IA</CardTitle>
                <CardDescription className="text-purple-100">
                  Pedido: {pedido?.numero_pedido || "-"} - Cliente: {pedido?.cliente_nome || "-"}
                </CardDescription>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold font-mono">{formatarTempo(cronometro.segundos)}</div>
                <Badge variant="secondary" className="mt-2">
                  {separacao.itens_separados.length}/{pedido?.itens_revenda?.length || 0} itens
                </Badge>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Velocidade</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <span className="text-2xl font-bold">{desempenho.itensPorHora}</span>
                <span className="text-sm text-slate-600">itens/h</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Acuracia</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-green-600" />
                <span className="text-2xl font-bold">{desempenho.acuracia}%</span>
                <Badge variant={Number(desempenho.acuracia) === 100 ? "default" : "secondary"}>
                  {Number(desempenho.acuracia) === 100 ? "Perfeito" : "Bom"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Divergencias</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <AlertTriangle className={`w-5 h-5 ${separacao.divergencias.length === 0 ? "text-green-600" : "text-red-600"}`} />
                <span className="text-2xl font-bold">{separacao.divergencias.length}</span>
                <span className="text-sm text-slate-600">detectadas</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scan className="w-5 h-5" />
              Scanner de Codigo de Barras
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 flex-col md:flex-row">
              <Input
                placeholder="Escaneie ou digite o codigo..."
                value={codigoBarras}
                onChange={(e) => setCodigoBarras(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleScanCodigoBarras()}
                className="text-lg"
                autoFocus
              />
              <Button
                onClick={handleScanCodigoBarras}
                className="bg-purple-600 hover:bg-purple-700"
                disabled={!codigoBarras || validarIAMutation.isPending}
                data-action="SeparacaoConferenciaIA.scan"
                data-permission="Expedicao.Separacao.editar"
                data-context-required="true"
                data-sensitive="true"
              >
                <Scan className="w-4 h-4 mr-2" />
                Escanear
              </Button>
              <Button
                onClick={handleOtimizarRota}
                variant="outline"
                disabled={!pedido?.itens_revenda?.length || otimizarRotaMutation.isPending}
                data-action="SeparacaoConferenciaIA.otimizar_rota"
                data-permission="Expedicao.Separacao.editar"
                data-context-required="true"
                data-sensitive="true"
              >
                <MapPin className="w-4 h-4 mr-2" />
                Otimizar Rota IA
              </Button>
            </div>
          </CardContent>
        </Card>

        {separacao.rota_otimizada_ia.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-purple-600" />
                Rota Otimizada por IA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {separacao.rota_otimizada_ia.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded">
                    <Badge>{item.ordem}</Badge>
                    <div className="flex-1">
                      <div className="font-medium">{sanitizeText(item.produto)}</div>
                      <div className="text-sm text-slate-600">{sanitizeText(item.localizacao)}</div>
                    </div>
                    <div className="text-sm text-slate-500">{item.distancia_estimada_m}m</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Itens Separados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {separacao.itens_separados.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                Nenhum item separado ainda. Use o scanner acima.
              </div>
            ) : (
              <div className="space-y-2">
                {separacao.itens_separados.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <div>
                        <div className="font-medium">{item.descricao}</div>
                        <div className="text-sm text-slate-600">
                          Qtd: {item.quantidade_separada}/{item.quantidade_pedida} - Peso: {item.peso_conferido}kg - Local: {item.localizacao}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline">Conferido</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {separacao.divergencias.length > 0 && (
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                Divergencias Detectadas pela IA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {separacao.divergencias.map((div, idx) => (
                  <div key={idx} className="p-3 bg-red-50 border border-red-200 rounded">
                    <div className="font-medium text-red-800">{sanitizeText(div.item)}</div>
                    <div className="text-sm text-red-600 mt-1">
                      Risco: <Badge variant="destructive">{sanitizeText(div.validacao?.risco)}</Badge>
                    </div>
                    {div.validacao?.acoes_sugeridas && (
                      <div className="mt-2 text-sm">
                        <strong>Acoes sugeridas:</strong>
                        <ul className="list-disc ml-5 mt-1">
                          {div.validacao.acoes_sugeridas.map((acao, i) => (
                            <li key={i}>{sanitizeText(acao)}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => finalizarSeparacaoMutation.mutate()}
            disabled={separacao.itens_separados.length === 0 || finalizarSeparacaoMutation.isPending}
            className="bg-green-600 hover:bg-green-700"
            data-action="SeparacaoConferenciaIA.finalizar"
            data-permission="Expedicao.Separacao.editar"
            data-context-required="true"
            data-sensitive="true"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Finalizar Separacao
          </Button>
        </div>
      </div>
    </div>
  );
}
