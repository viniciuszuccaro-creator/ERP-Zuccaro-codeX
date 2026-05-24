import React from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Truck, Building2, Pen } from "lucide-react";
import { toast } from "sonner";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";
import EnvioMensagemAutomatica from "./EnvioMensagemAutomatica";
import AssinaturaDigitalEntrega from "./AssinaturaDigitalEntrega";

/**
 * V21.1.2 - WINDOW MODE READY
 * Visualizacao detalhada de uma entrega com timeline e notificacoes
 */
export default function DetalhesEntregaView({ 
  entrega, 
  estaNoGrupo, 
  obterNomeEmpresa,
  statusColors,
  onStatusChange,
  windowMode = false
}) {
  const containerClass = windowMode ? "w-full h-full flex flex-col overflow-hidden" : "";
  const queryClient = useQueryClient();
  const [showAssinatura, setShowAssinatura] = React.useState(false);
  const { empresaAtual, grupoAtual, updateInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { user } = useUser();
  const groupId = entrega?.group_id || grupoAtual?.id || empresaAtual?.group_id || null;
  const empresaId = entrega?.empresa_id || empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const canUpdateEntrega = hasPermission("Expedicao", "Entrega", "editar") || hasPermission("Expedicao", "Entregas", "editar") || hasPermission("Expedicao", "Painel Logistico", "editar");

  const auditarEntrega = async ({ acao, descricao, sucesso = true, dadosNovos = {}, dadosAnteriores = entrega }) => {
    try {
      await base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || "Usuario",
        usuario_id: user?.id,
        acao,
        modulo: "Expedicao",
        tipo_auditoria: sucesso ? "operacional" : "seguranca",
        entidade: "Entrega",
        registro_id: entrega?.id,
        descricao,
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId,
        sucesso,
        dados_anteriores: dadosAnteriores,
        dados_novos: dadosNovos,
        data_hora: new Date().toISOString(),
      });
    } catch (auditError) {
      console.warn("Falha ao auditar detalhe da entrega:", auditError);
    }
  };

  const handleStatusChangeLocal = async (novoStatus) => {
    if (!contextoValido || !canUpdateEntrega) {
      await auditarEntrega({
        acao: "DetalhesEntrega.status_bloqueado",
        descricao: "Tentativa de alterar status da entrega sem contexto ou permissao.",
        sucesso: false,
        dadosNovos: { status_novo: novoStatus, motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada" },
      });
      toast.error("Selecione contexto valido e confirme permissao para alterar a entrega.");
      return;
    }

    const confirmado = window.confirm("Confirma alterar o status desta entrega para " + novoStatus + "?");
    if (!confirmado) {
      await auditarEntrega({
        acao: "DetalhesEntrega.status_cancelado",
        descricao: "Usuario cancelou a alteracao de status da entrega.",
        sucesso: false,
        dadosNovos: { status_novo: novoStatus, motivo: "confirmacao_cancelada" },
      });
      return;
    }

    if (typeof onStatusChange === "function") {
      await auditarEntrega({
        acao: "DetalhesEntrega.alterar_status.delegado",
        descricao: "Status da entrega delegado ao fluxo externo.",
        dadosNovos: { status_novo: novoStatus },
      });
      onStatusChange(entrega, novoStatus);
      return;
    }

    const payload = {
      status: novoStatus,
      group_id: groupId,
      grupo_id: groupId,
      empresa_id: empresaId,
      historico_status: [
        ...(entrega.historico_status || []),
        {
          status: novoStatus,
          data_hora: new Date().toISOString(),
          usuario: user?.full_name || user?.email || "Sistema",
          usuario_id: user?.id,
          observacao: `Status alterado pela tela de detalhes para ${novoStatus}.`,
        }
      ]
    };

    const atualizada = await updateInContext("Entrega", entrega.id, payload);
    await auditarEntrega({
      acao: "DetalhesEntrega.alterar_status",
      descricao: `Status da entrega alterado para ${novoStatus}.`,
      dadosNovos: atualizada || payload,
    });
    queryClient.invalidateQueries({ queryKey: ["entregas"] });
    toast.success(`Status alterado para ${novoStatus}.`);
  };

  const confirmarEntregaAssinaturaMutation = useMutation({
    mutationFn: async (dadosAssinatura) => {
      if (!contextoValido) {
        throw new Error("Contexto multiempresa obrigatorio para confirmar entrega.");
      }
      if (!canUpdateEntrega) {
        throw new Error("Seu perfil nao pode alterar entregas.");
      }
      const confirmado = window.confirm("Confirma registrar a assinatura digital e marcar esta entrega como entregue?");
      if (!confirmado) {
        await auditarEntrega({
          acao: "DetalhesEntrega.confirmar_entrega.cancelado",
          descricao: "Usuario cancelou a confirmacao de entrega com assinatura digital.",
          sucesso: false,
          dadosNovos: { motivo: "confirmacao_cancelada" },
        });
        throw new Error("Confirmacao cancelada pelo usuario.");
      }
      const nomeRecebedor = String(dadosAssinatura.nome_recebedor || "").replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "").replace(/javascript:\s*/gi, "").trim();
      const documentoRecebedor = String(dadosAssinatura.documento_recebedor || "").replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "").replace(/javascript:\s*/gi, "").trim();
      const atualizada = await updateInContext("Entrega", entrega.id, {
        status: "Entregue",
        data_entrega: new Date().toISOString(),
        group_id: groupId,
        grupo_id: groupId,
        empresa_id: empresaId,
        comprovante_entrega: {
          assinatura_digital: dadosAssinatura.assinatura_base64,
          nome_recebedor: nomeRecebedor,
          documento_recebedor: documentoRecebedor,
          data_hora_recebimento: dadosAssinatura.data_hora_assinatura,
          latitude_entrega: dadosAssinatura.latitude || null,
          longitude_entrega: dadosAssinatura.longitude || null
        },
        historico_status: [
          ...(entrega.historico_status || []),
          {
            status: "Entregue",
            data_hora: new Date().toISOString(),
            usuario: user?.full_name || user?.email || "Sistema",
            usuario_id: user?.id,
            observacao: `Entrega confirmada com assinatura digital. Recebido por: ${nomeRecebedor}`
          }
        ]
      });
      await auditarEntrega({
        acao: "DetalhesEntrega.confirmar_entrega",
        descricao: "Entrega confirmada com assinatura digital.",
        dadosNovos: atualizada,
      });
      return atualizada;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entregas'] });
      setShowAssinatura(false);
      toast.success("Entrega confirmada com assinatura.");
    },
    onError: (error) => {
      if (error?.message !== "Confirmacao cancelada pelo usuario.") toast.error(error.message || "Erro ao confirmar entrega.");
    }
  });

  const content = (
    <div className={`${windowMode ? 'p-6 flex-1 overflow-auto' : 'space-y-4'}`}>
      {(!contextoValido || !canUpdateEntrega) && (
        <Card className="mb-3 bg-red-50 border-red-300">
          <CardContent className="p-3 text-sm text-red-800">
            <p className="font-semibold">Acoes sensiveis bloqueadas</p>
            <p>{!contextoValido ? "Selecione grupo/empresa para alterar esta entrega." : "Seu perfil nao tem permissao para alterar entregas."}</p>
          </CardContent>
        </Card>
      )}
      {!windowMode && (
        <div className="flex items-center gap-2 mb-4">
          <Truck className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-bold">Detalhes da Entrega - {entrega?.numero_pedido || 'Sem Pedido'}</h2>
        </div>
      )}

      <Tabs defaultValue="info" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="info">Informacoes</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="notificacoes">Notificacoes</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-600">Cliente</Label>
              <p className="font-semibold">{entrega.cliente_nome}</p>
            </div>
            <div>
              <Label className="text-slate-600">Status</Label>
              <Badge className={statusColors[entrega.status]}>
                {entrega.status}
              </Badge>
            </div>
          </div>

          {estaNoGrupo && (
            <div>
              <Label className="text-slate-600">Empresa Responsavel</Label>
              <div className="flex items-center gap-2 mt-1">
                <Building2 className="w-5 h-5 text-purple-600" />
                <span className="font-semibold">{obterNomeEmpresa(entrega.empresa_id)}</span>
              </div>
            </div>
          )}

          <div>
            <Label className="text-slate-600">Endereco de Entrega</Label>
            <p className="text-sm">
              {entrega.endereco_entrega_completo?.logradouro}, {entrega.endereco_entrega_completo?.numero}
              {entrega.endereco_entrega_completo?.complemento && ` - ${entrega.endereco_entrega_completo?.complemento}`}
              <br/>
              {entrega.endereco_entrega_completo?.bairro} - {entrega.endereco_entrega_completo?.cidade}/{entrega.endereco_entrega_completo?.estado}
              <br/>
              CEP: {entrega.endereco_entrega_completo?.cep}
            </p>
          </div>

          <div>
            <Label className="text-slate-600">Contato para Entrega</Label>
            <p className="text-sm">
              <strong>{entrega.contato_entrega?.nome || '-'}</strong>
              <br/>
              Telefone: {entrega.contato_entrega?.whatsapp || entrega.contato_entrega?.telefone || '-'}
              {entrega.contato_entrega?.instrucoes_especiais && (
                <>
                  <br/>
                  <span className="italic text-slate-500">
                    Instrucoes: {entrega.contato_entrega.instrucoes_especiais}
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-600">Transportadora</Label>
              <p className="font-medium">{entrega.transportadora || 'Frota Propria'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Motorista</Label>
              <p className="font-medium">{entrega.motorista || '-'}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-slate-600">Volumes</Label>
              <p className="font-medium">{entrega.volumes || 0}</p>
            </div>
            <div>
              <Label className="text-slate-600">Peso</Label>
              <p className="font-medium">{entrega.peso_total_kg || 0} kg</p>
            </div>
            <div>
              <Label className="text-slate-600">Prioridade</Label>
              <Badge variant="outline">{entrega.prioridade || 'Normal'}</Badge>
            </div>
          </div>

          {entrega.observacoes && (
            <div>
              <Label className="text-slate-600">Observacoes</Label>
              <p className="text-sm p-3 bg-slate-50 rounded">{entrega.observacoes}</p>
            </div>
          )}

          {!showAssinatura ? (
            <div className="flex flex-wrap gap-2 pt-4 border-t">
              <Button
                onClick={() => handleStatusChangeLocal("Em Separacao")}
                disabled={!contextoValido || !canUpdateEntrega || entrega.status !== "Aguardando Separacao"}
                size="sm"
                variant="outline"
                data-permission="Expedicao.Entrega.editar" data-context-required="true" data-sensitive
                data-action="iniciar-separacao"
              >
                Iniciar Separacao
              </Button>
              <Button
                onClick={() => handleStatusChangeLocal("Pronto para Expedir")}
                disabled={!contextoValido || !canUpdateEntrega || entrega.status !== "Em Separacao"}
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700"
                data-permission="Expedicao.Entrega.editar" data-context-required="true" data-sensitive
                data-action="pronto-para-expedir"
              >
                Pronto para Expedir
              </Button>
              <Button
                onClick={() => handleStatusChangeLocal("Saiu para Entrega")}
                disabled={!contextoValido || !canUpdateEntrega || entrega.status !== "Pronto para Expedir"}
                size="sm"
                className="bg-orange-600 hover:bg-orange-700"
                data-permission="Expedicao.Entrega.editar" data-context-required="true" data-sensitive
                data-action="sair-para-entrega"
              >
                Saiu para Entrega
              </Button>
              <Button
                onClick={() => setShowAssinatura(true)}
                disabled={!contextoValido || !canUpdateEntrega || !["Saiu para Entrega", "Em Transito"].includes(entrega.status)}
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                data-permission="Expedicao.Entrega.editar" data-context-required="true" data-sensitive
                data-action="confirmar-entrega"
              >
                Confirmar Entrega
              </Button>
              <Button
                onClick={() => handleStatusChangeLocal("Entrega Frustrada")}
                disabled={!contextoValido || !canUpdateEntrega || ["Entregue", "Cancelado", "Aguardando Separacao"].includes(entrega.status)}
                size="sm"
                variant="destructive"
                data-permission="Expedicao.Entrega.editar" data-context-required="true" data-sensitive
                data-action="marcar-entrega-frustrada"
              >
                Marcar como Frustrada
              </Button>
            </div>
          ) : (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Pen className="w-5 h-5 text-green-600" />
                  <h3 className="font-bold text-green-900">Assinatura Digital de Recebimento</h3>
                </div>
                <AssinaturaDigitalEntrega
                  onAssinaturaConcluida={(dados) => confirmarEntregaAssinaturaMutation.mutate(dados)}
                  isLoading={confirmarEntregaAssinaturaMutation.isPending}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAssinatura(false)}
                  className="mt-3"
                >
                  Cancelar Assinatura
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="timeline" className="space-y-3 mt-4">
          {entrega.historico_status?.length > 0 ? (
            <div className="space-y-3">
              {entrega.historico_status
                .sort((a, b) => new Date(b.data_hora) - new Date(a.data_hora))
                .map((h, idx) => (
                <div key={idx} className="flex gap-3 items-start p-3 bg-slate-50 rounded">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <p className="font-semibold text-slate-900">{h.status}</p>
                      <span className="text-xs text-slate-500">
                        {new Date(h.data_hora).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    {h.observacao && <p className="text-sm text-slate-600 mt-1">{h.observacao}</p>}
                    <p className="text-xs text-slate-500 mt-1">Por: {h.usuario}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-slate-500 py-8">Nenhum historico disponivel</p>
          )}
        </TabsContent>

        <TabsContent value="notificacoes" className="space-y-3 mt-4">
          {entrega.notificacoes_enviadas?.length > 0 ? (
            <div className="space-y-3">
              {entrega.notificacoes_enviadas
                .sort((a, b) => new Date(b.data_envio) - new Date(a.data_envio))
                .map((n, idx) => (
                <div key={idx} className="p-3 bg-blue-50 rounded border border-blue-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-blue-900">{n.tipo} via {n.canal}</p>
                      <p className="text-sm text-blue-700 mt-1">{n.mensagem}</p>
                      <p className="text-xs text-blue-600 mt-1">Para: {n.destinatario}</p>
                    </div>
                    <span className="text-xs text-blue-600">
                      {new Date(n.data_envio).toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-slate-500 py-8">Nenhuma notificacao enviada</p>
          )}
        </TabsContent>

        <TabsContent value="whatsapp" className="mt-4">
          <EnvioMensagemAutomatica entrega={entrega} tipo="saida_entrega" />
        </TabsContent>
      </Tabs>
    </div>
  );

  if (windowMode) {
    return <div className={containerClass} data-permission="Expedicao.Entrega.visualizar" data-context-required="true">{content}</div>;
  }

  return content;
}
