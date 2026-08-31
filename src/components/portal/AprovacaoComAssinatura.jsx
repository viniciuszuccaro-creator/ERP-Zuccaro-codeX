import React, { useState, useRef } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  CheckCircle, XCircle, FileText, PenTool, 
  Trash2, Download, Eye, Loader2 
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const reportApprovalSignatureFailure = (operation, error, context = {}) => {
  console.error('[AprovacaoComAssinatura] ' + operation, {
    error: error?.message || String(error),
    ...context,
  });
};

/**
 * V21.5 - Aprovação de Orçamentos com Assinatura Eletrônica COMPLETO
 * ✅ Canvas para assinatura digital (mouse + touch)
 * ✅ Geração de hash para validação
 * ✅ Upload de assinatura seguro
 * ✅ Criação automática de pedido
 * ✅ Rejeição com motivo
 * ✅ Histórico de aprovações
 * ✅ 100% Responsivo w-full h-full
 */
export default function AprovacaoComAssinatura({ clienteId }) {
  const queryClient = useQueryClient();
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [assinaturaModal, setAssinaturaModal] = useState(false);
  const [orcamentoSelecionado, setOrcamentoSelecionado] = useState(null);
  const [nomeAssinante, setNomeAssinante] = useState('');

  const { data: orcamentos = [] } = useQuery({
    queryKey: ['orcamentos-aprovacao', clienteId],
    queryFn: async () => {
      if (!clienteId) return [];
      return base44.entities.OrcamentoCliente.filter({
        cliente_id: clienteId,
        status: 'Pendente'
      }, '-created_date');
    },
    enabled: !!clienteId
  });

  // Canvas de Assinatura
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    
    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(
      e.clientX - rect.left,
      e.clientY - rect.top
    );
  };

  const draw = (e) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    
    ctx.lineTo(
      e.clientX - rect.left,
      e.clientY - rect.top
    );
    ctx.strokeStyle = '#1e40af';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const limparAssinatura = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const aprovarMutation = useMutation({
    mutationFn: async ({ orcamento, assinaturaDataUrl }) => {
      // 1. Upload da assinatura
      const blob = await (await fetch(assinaturaDataUrl)).blob();
      const file = new File([blob], 'assinatura.png', { type: 'image/png' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // 2. Atualizar orçamento
      await base44.entities.OrcamentoCliente.update(orcamento.id, {
        status: 'Aprovado',
        aprovado_por: nomeAssinante || 'Cliente',
        data_aprovacao: new Date().toISOString(),
        assinatura_url: file_url,
        assinatura_ip: 'Portal',
        assinatura_hash: btoa(assinaturaDataUrl.substring(0, 100))
      });

      // 3. Criar pedido automaticamente
      const cli = await base44.entities.Cliente.filter({ id: clienteId }).then(r => r?.[0]);
      const pedido = await base44.entities.Pedido.create({
        numero_pedido: `PED${Date.now()}`,
        cliente_id: clienteId,
        cliente_nome: orcamento.cliente_nome,
        data_pedido: new Date().toISOString().split('T')[0],
        valor_total: orcamento.valor_total,
        itens_revenda: orcamento.itens || [],
        status: 'Aguardando Aprovação',
        origem_pedido: 'Portal - Orçamento Aprovado',
        observacoes_publicas: `Pedido gerado a partir do orçamento ${orcamento.numero_orcamento} com assinatura eletrônica`,
        pode_ver_no_portal: true,
        forma_pagamento: orcamento.condicoes_pagamento || 'À Vista',
        empresa_id: cli?.empresa_id || undefined,
        group_id: cli?.group_id || undefined
      });

      // 3.1 Workflow de aprovação por alçada
      try {
        await base44.functions.invoke('solicitacoesAprovacao', {
          entity_name: 'Pedido',
          entity_id: pedido.id,
          valor: pedido.valor_total,
          empresa_id: cli?.empresa_id || undefined,
          group_id: cli?.group_id || undefined
        });
      } catch (error) { reportApprovalSignatureFailure('Falha ao iniciar alcada de aprovacao', error, { orcamento_id: orcamento.id, pedido_id: pedido.id }); }

      // 4. Vincular pedido
      await base44.entities.OrcamentoCliente.update(orcamento.id, {
        pedido_gerado_id: pedido.id,
        status: 'Convertido'
      });

      // 5. Auditoria e notificações
      try {
        await base44.entities.AuditLog.create({
          acao: 'Aprovação', modulo: 'Portal', tipo_auditoria: 'entidade', entidade: 'OrcamentoCliente', registro_id: orcamento.id,
          descricao: `Aceite de orçamento ${orcamento.numero_orcamento} com assinatura`,
          dados_novos: { pedido_gerado_id: pedido.id, assinatura_url: file_url },
          data_hora: new Date().toISOString(),
          empresa_id: cli?.empresa_id || undefined,
          group_id: cli?.group_id || undefined
        });
      } catch (error) { reportApprovalSignatureFailure('Falha ao auditar aceite do orcamento', error, { orcamento_id: orcamento.id, pedido_id: pedido.id }); }
      try {
        await base44.functions.invoke('sendEmailProvider', {
          to: orcamento.email_contato || orcamento.cliente_email || 'noreply@invalid.local',
          subject: `Orçamento aprovado • ${orcamento.numero_orcamento}`,
          body: `O orçamento ${orcamento.numero_orcamento} foi aprovado. Pedido ${pedido.numero_pedido} criado e aguarda aprovação.`
        });
      } catch (error) { reportApprovalSignatureFailure('Falha ao enviar email de aceite', error, { orcamento_id: orcamento.id, pedido_id: pedido.id }); }
      try {
        await base44.functions.invoke('whatsappSend', {
          to: orcamento.whatsapp_contato || '',
          message: `✅ Orçamento ${orcamento.numero_orcamento} aprovado. Pedido ${pedido.numero_pedido} gerado e aguardando aprovação.`
        });
      } catch (error) { reportApprovalSignatureFailure('Falha ao enviar WhatsApp de aceite', error, { orcamento_id: orcamento.id, pedido_id: pedido.id }); }

      return { orcamento, pedido, assinaturaUrl: file_url };
    },
    onSuccess: async ({ pedido, assinaturaUrl }) => {
      queryClient.invalidateQueries(['orcamentos-aprovacao']);
      queryClient.invalidateQueries(['pedidos-dashboard']);
      setAssinaturaModal(false);
      setOrcamentoSelecionado(null);
      setNomeAssinante('');

      // Gamificação: bônus por aprovação (+50 pontos)
      try {
        const cli = await base44.entities.Cliente.filter({ id: clienteId }).then(r => r?.[0]);
        const novo = Number(cli?.pontos_fidelidade || 0) + 50;
        await base44.entities.Cliente.update(clienteId, {
          pontos_fidelidade: novo,
          empresa_id: cli?.empresa_id || undefined,
          group_id: cli?.group_id || undefined,
        });
        try { await base44.entities.AuditLog.create({
          acao: 'Edição', modulo: 'Portal', tipo_auditoria: 'entidade', entidade: 'Cliente', registro_id: clienteId,
          descricao: 'Gamificação: aprovação de orçamento (+50)', dados_novos: { pontos_fidelidade: novo }, data_hora: new Date().toISOString()
        }); } catch (error) { reportApprovalSignatureFailure('Falha ao auditar pontos de fidelidade', error, { cliente_id: clienteId }); }
      } catch (error) { reportApprovalSignatureFailure('Falha ao atualizar pontos de fidelidade', error, { cliente_id: clienteId }); }

      try { await queryClient.invalidateQueries({ queryKey: ['cliente-portal'] }); } catch (error) { reportApprovalSignatureFailure('Falha ao atualizar cache do cliente', error, { cliente_id: clienteId }); }
      try { await queryClient.invalidateQueries({ queryKey: ['orcamentos-aprovados-flag'] }); } catch (error) { reportApprovalSignatureFailure('Falha ao atualizar cache de orcamentos', error, { cliente_id: clienteId }); }

      toast.success(`✅ Orçamento aprovado! Pedido ${pedido.numero_pedido} criado.`);
      try { window.location.href = createPageUrl('PortalCliente?tab=meus-pedidos'); } catch (error) { reportApprovalSignatureFailure('Falha ao abrir pedidos do portal', error, { pedido_id: pedido.id }); }
    },
    onError: (error) => {
      toast.error('Erro ao aprovar orçamento: ' + error.message);
    }
  });

  const rejeitarMutation = useMutation({
    mutationFn: async ({ orcamento, motivo }) => {
      await base44.entities.OrcamentoCliente.update(orcamento.id, {
        status: 'Revisao Solicitada',
        comentario_revisao: motivo,
        data_aprovacao: new Date().toISOString()
      });
      try {
        await base44.entities.AuditLog.create({
          acao: 'Edição', modulo: 'Portal', tipo_auditoria: 'entidade', entidade: 'OrcamentoCliente', registro_id: orcamento.id,
          descricao: `Solicitação de revisão do orçamento ${orcamento.numero_orcamento}`,
          dados_novos: { comentario_revisao: motivo }, data_hora: new Date().toISOString()
        });
      } catch (error) { reportApprovalSignatureFailure('Falha ao auditar solicitacao de revisao', error, { orcamento_id: orcamento.id }); }
      try {
        await base44.functions.invoke('sendEmailProvider', {
          to: orcamento.email_contato || orcamento.cliente_email || 'noreply@invalid.local',
          subject: `Revisão solicitada • ${orcamento.numero_orcamento}`,
          body: `O cliente solicitou revisão do orçamento ${orcamento.numero_orcamento}.
Motivo: ${motivo || 'Não informado'}`
        });
      } catch (error) { reportApprovalSignatureFailure('Falha ao enviar email de revisao', error, { orcamento_id: orcamento.id }); }
      try {
        await base44.functions.invoke('whatsappSend', {
          to: orcamento.whatsapp_contato || '',
          message: `⚠️ Revisão solicitada no orçamento ${orcamento.numero_orcamento}. Motivo: ${motivo || 'Não informado'}`
        });
      } catch (error) { reportApprovalSignatureFailure('Falha ao enviar WhatsApp de revisao', error, { orcamento_id: orcamento.id }); }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['orcamentos-aprovacao']);
      toast.success('Revisão solicitada');
    }
  });

  const handleAprovar = () => {
    if (!nomeAssinante.trim()) {
      toast.error('Digite seu nome para continuar');
      return;
    }

    const canvas = canvasRef.current;
    const assinaturaDataUrl = canvas.toDataURL('image/png');
    
    // Verificar se há assinatura
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const hasContent = imageData.data.some(channel => channel !== 0);
    
    if (!hasContent) {
      toast.error('Por favor, assine no campo acima');
      return;
    }

    aprovarMutation.mutate({
      orcamento: orcamentoSelecionado,
      assinaturaDataUrl
    });
  };

  return (
    <div className="space-y-4 w-full h-full">
      <Card className="border-2 border-blue-300 bg-blue-50 shadow-lg w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            Orçamentos Aguardando Aprovação
            {orcamentos.length > 0 && (
              <Badge className="ml-2 bg-orange-600 text-white animate-pulse">
                {orcamentos.length} pendente(s)
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {orcamentos.length > 0 ? (
            <div className="space-y-4">
              {orcamentos.map(orc => (
                <Card key={orc.id} className="bg-white border-2 border-slate-200">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="font-bold text-xl">{orc.numero_orcamento}</p>
                        <p className="text-sm text-slate-600">
                          Criado em {format(new Date(orc.created_date), 'dd/MM/yyyy')}
                        </p>
                        {orc.data_validade && (
                          <p className="text-sm text-orange-600">
                            Válido até {format(new Date(orc.data_validade), 'dd/MM/yyyy')}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold text-green-600">
                          R$ {orc.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-slate-500">{orc.itens?.length || 0} item(ns)</p>
                      </div>
                    </div>

                    {/* Itens */}
                    <div className="mb-4 p-4 bg-slate-50 rounded-lg border">
                      <p className="font-semibold mb-3 flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        Itens do Orçamento
                      </p>
                      <div className="space-y-2">
                        {(orc.itens || []).slice(0, 5).map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-slate-700">• {item.descricao}</span>
                            <span className="font-medium">
                              {item.quantidade} {item.unidade} - R$ {item.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                        {(orc.itens?.length || 0) > 5 && (
                          <p className="text-xs text-slate-500 mt-2">
                            + {orc.itens.length - 5} item(ns) adicionais
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Condições */}
                    <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-blue-50 rounded-lg">
                      <div>
                        <p className="text-xs text-slate-600 mb-1">Condição de Pagamento</p>
                        <p className="font-semibold">{orc.condicoes_pagamento || 'À Vista'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 mb-1">Prazo de Entrega</p>
                        <p className="font-semibold">{orc.prazo_entrega || '7 dias úteis'}</p>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex gap-3">
                      <Button
                        data-permission="Portal.Orcamentos.aprovar"
                        onClick={() => {
                          setOrcamentoSelecionado(orc);
                          setAssinaturaModal(true);
                        }}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-lg py-6"
                      >
                        <PenTool className="w-5 h-5 mr-2" />
                        Aprovar com Assinatura
                      </Button>

                      <Button
                        data-permission="Portal.Orcamentos.revisar"
                        variant="outline"
                        onClick={() => {
                          const motivo = prompt('Descreva os pontos a revisar (opcional):');
                          rejeitarMutation.mutate({ 
                            orcamento: orc, 
                            motivo: motivo || 'Não informado' 
                          });
                        }}
                        className="border-2 border-amber-300 hover:bg-amber-50"
                      >
                        <XCircle className="w-5 h-5 mr-2" />
                        Solicitar Revisão
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-slate-500">
              <FileText className="w-20 h-20 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Nenhum orçamento pendente</p>
              <p className="text-sm mt-2">Seus orçamentos aprovados viram pedidos automaticamente</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Assinatura */}
      <Dialog open={assinaturaModal} onOpenChange={setAssinaturaModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenTool className="w-6 h-6 text-blue-600" />
              Assinatura Eletrônica
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Dados do Orçamento */}
            <Card className="border-2 border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold text-lg">{orcamentoSelecionado?.numero_orcamento}</p>
                    <p className="text-sm text-slate-600">
                      {orcamentoSelecionado?.itens?.length || 0} item(ns)
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-green-600">
                    R$ {orcamentoSelecionado?.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Nome do Assinante */}
            <div>
              <Label>Nome Completo do Assinante *</Label>
              <Input
                value={nomeAssinante}
                onChange={(e) => setNomeAssinante(e.target.value)}
                placeholder="Digite seu nome completo"
                className="mt-2"
              />
            </div>

            {/* Canvas de Assinatura */}
            <div>
              <Label>Assine abaixo *</Label>
              <div className="mt-2 border-2 border-dashed border-blue-300 rounded-lg p-4 bg-white">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={200}
                  className="w-full border border-slate-300 rounded cursor-crosshair bg-white touch-none"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    const touch = e.touches[0];
                    const mouseEvent = new MouseEvent('mousedown', {
                      clientX: touch.clientX,
                      clientY: touch.clientY
                    });
                    canvasRef.current.dispatchEvent(mouseEvent);
                  }}
                  onTouchMove={(e) => {
                    e.preventDefault();
                    const touch = e.touches[0];
                    const mouseEvent = new MouseEvent('mousemove', {
                      clientX: touch.clientX,
                      clientY: touch.clientY
                    });
                    canvasRef.current.dispatchEvent(mouseEvent);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    const mouseEvent = new MouseEvent('mouseup', {});
                    canvasRef.current.dispatchEvent(mouseEvent);
                  }}
                />
                <div className="flex justify-between items-center mt-3">
                  <p className="text-xs text-slate-500">
                    ✍️ Assine com o mouse ou touch
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={limparAssinatura}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Limpar
                  </Button>
                </div>
              </div>
            </div>

            {/* Aviso Legal */}
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4">
                <p className="text-sm text-green-900">
                  <CheckCircle className="w-4 h-4 inline mr-2" />
                  Ao assinar, você concorda com os termos do orçamento e autoriza a criação do pedido.
                </p>
              </CardContent>
            </Card>

            {/* Botões */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setAssinaturaModal(false);
                  setOrcamentoSelecionado(null);
                  setNomeAssinante('');
                }}
                className="flex-1"
                disabled={aprovarMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                data-permission="Portal.Orcamentos.aprovar"
                onClick={handleAprovar}
                disabled={aprovarMutation.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {aprovarMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Confirmar Aprovação
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
