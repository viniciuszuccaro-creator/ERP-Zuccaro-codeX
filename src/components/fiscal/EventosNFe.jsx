import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { 
  XCircle, 
  FileEdit, 
  Ban, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Download
} from "lucide-react";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";
import { cancelarNFe } from "@/components/lib/integracaoNFe";

/**
 * Componente para Gerenciar Eventos de NF-e
 * Cancelamento, Carta de Correção, Inutilização
 */
export default function EventosNFe({ nfe }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { updateInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { user } = useUser();
  
  const [dialogCancelamento, setDialogCancelamento] = useState(false);
  const [dialogCartaCorrecao, setDialogCartaCorrecao] = useState(false);
  const [motivoCancelamento, setMotivoCancelamento] = useState("");
  const [textoCorrecao, setTextoCorrecao] = useState("");

  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || nfe?.group_id || null;
  const empresaId = nfe?.empresa_faturamento_id || nfe?.empresa_id || empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const podeCancelar = hasPermission('Fiscal', 'NotaFiscal', 'cancelar')
    || hasPermission('Fiscal', 'Notas Fiscais', 'cancelar')
    || hasPermission('Fiscal', 'NF-e', 'cancelar');

  const podeSerCancelada = nfe.status === "Autorizada" && !nfe.cancelamento;
  const diasDesdeEmissao = nfe.data_autorizacao 
    ? Math.floor((new Date() - new Date(nfe.data_autorizacao)) / (1000 * 60 * 60 * 24))
    : 0;
  const dentroDoPrazo = diasDesdeEmissao <= 1; // 24 horas

  const cancelarMutation = useMutation({
    mutationFn: async (motivo) => {
      if (!contextoValido || !empresaId) {
        throw new Error('Selecione a empresa emitente antes de cancelar NF-e.');
      }
      if (!podeCancelar) {
        throw new Error('Sem permissao para cancelar NF-e.');
      }
      if (!podeSerCancelada) {
        throw new Error('Somente NF-e autorizada pode ser cancelada.');
      }

      const resultado = await cancelarNFe(nfe.id, empresaId, motivo);
      if (resultado?.sucesso === false) {
        throw new Error(resultado?.error || 'Falha ao cancelar NF-e.');
      }

      return await updateInContext('NotaFiscal', nfe.id, {
        status: "Cancelada",
        data_cancelamento: new Date().toISOString(),
        cancelamento: {
          data_cancelamento: new Date().toISOString(),
          protocolo_cancelamento: resultado?.protocolo || `CANC-${Date.now()}`,
          motivo: "Cancelamento solicitado",
          justificativa: motivo,
          usuario: user?.full_name || user?.email || "Sistema"
        },
        historico: [
          ...(nfe.historico || []),
          {
            data_hora: new Date().toISOString(),
            evento: "Cancelamento",
            usuario: user?.full_name || user?.email || "Sistema",
            detalhes: motivo
          }
        ]
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notasFiscais'] });
      setDialogCancelamento(false);
      setMotivoCancelamento("");
      toast({ title: "✅ NF-e cancelada!" });
    },
    onError: (error) => {
      toast({ title: error?.message || 'Falha ao cancelar NF-e', variant: 'destructive' });
    },
  });

  const cartaCorrecaoMutation = useMutation({
    mutationFn: async (correcao) => {
      const sequencia = (nfe.carta_correcao?.length || 0) + 1;

      if (sequencia > 20) {
        throw new Error("Limite de 20 cartas de correção excedido");
      }

      // Log
      await base44.entities.LogFiscal.create({
        group_id: nfe.group_id,
        empresa_id: nfe.empresa_faturamento_id,
        nfe_id: nfe.id,
        numero_nfe: nfe.numero,
        chave_acesso: nfe.chave_acesso,
        data_hora: new Date().toISOString(),
        acao: "carta_correcao",
        provedor: "Mock",
        ambiente: nfe.ambiente,
        payload_enviado: { chave_acesso: nfe.chave_acesso, correcao, sequencia },
        retorno_recebido: {
          mock: true,
          protocolo: `CCE-${Date.now()}`
        },
        status: "sucesso",
        codigo_status: "135",
        mensagem: "Carta de correção registrada",
        tempo_resposta_ms: 650,
        usuario_nome: "Sistema"
      });

      // Atualizar NF-e
      const novaCarta = {
        sequencia,
        data: new Date().toISOString(),
        correcao,
        protocolo: `CCE-${Date.now()}`,
        usuario: "Sistema"
      };

      return await base44.entities.NotaFiscal.update(nfe.id, {
        carta_correcao: [...(nfe.carta_correcao || []), novaCarta],
        historico: [
          ...(nfe.historico || []),
          {
            data_hora: new Date().toISOString(),
            evento: `Carta de Correção #${sequencia}`,
            usuario: "Sistema",
            detalhes: correcao
          }
        ]
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notasFiscais'] });
      setDialogCartaCorrecao(false);
      setTextoCorrecao("");
      toast({ title: "✅ Carta de correção emitida!" });
    },
  });

  return (
    <div className="space-y-4">
      {/* Cancelamento */}
      {podeSerCancelada && (
        <Dialog open={dialogCancelamento} onOpenChange={setDialogCancelamento}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              className="w-full border-red-300 text-red-700 hover:bg-red-50"
              disabled={!dentroDoPrazo || !podeCancelar || !contextoValido || !empresaId}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Cancelar NF-e
              {!dentroDoPrazo && " (Fora do prazo)"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-red-900">Cancelar NF-e {nfe.numero}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {!dentroDoPrazo && (
                <Alert variant="destructive">
                  <Clock className="h-5 w-5" />
                  <AlertDescription>
                    Atenção: Esta nota foi emitida há {diasDesdeEmissao} dias. 
                    O prazo para cancelamento (24h) pode ter expirado.
                  </AlertDescription>
                </Alert>
              )}

              <div>
                <Label>Motivo do Cancelamento *</Label>
                <Textarea
                  value={motivoCancelamento}
                  onChange={(e) => setMotivoCancelamento(e.target.value)}
                  rows={4}
                  placeholder="Mínimo 15 caracteres"
                  className="mt-2"
                />
                <p className="text-xs text-slate-500 mt-1">
                  {motivoCancelamento.length} / 15 mínimos
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogCancelamento(false)}
                  className="flex-1"
                >
                  Voltar
                </Button>
                <Button
                  onClick={() => cancelarMutation.mutate(motivoCancelamento)}
                  disabled={motivoCancelamento.length < 15 || cancelarMutation.isPending || !podeCancelar || !contextoValido}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  {cancelarMutation.isPending ? 'Cancelando...' : 'Confirmar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Carta de Correção */}
      {nfe.status === "Autorizada" && (
        <Dialog open={dialogCartaCorrecao} onOpenChange={setDialogCartaCorrecao}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full border-blue-300 text-blue-700 hover:bg-blue-50">
              <FileEdit className="w-4 h-4 mr-2" />
              Carta de Correção
              {nfe.carta_correcao?.length > 0 && ` (${nfe.carta_correcao.length}/20)`}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Emitir Carta de Correção</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-5 w-5" />
                <AlertDescription>
                  A carta de correção NÃO pode corrigir valores ou impostos.
                  Use apenas para erros de dados cadastrais.
                </AlertDescription>
              </Alert>

              <div>
                <Label>Texto da Correção *</Label>
                <Textarea
                  value={textoCorrecao}
                  onChange={(e) => setTextoCorrecao(e.target.value)}
                  rows={5}
                  placeholder="Descreva a correção necessária..."
                  className="mt-2"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogCartaCorrecao(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => cartaCorrecaoMutation.mutate(textoCorrecao)}
                  disabled={textoCorrecao.length < 15 || cartaCorrecaoMutation.isPending}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {cartaCorrecaoMutation.isPending ? 'Emitindo...' : 'Emitir CC-e'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Downloads */}
      {nfe.xml_nfe && (
        <Button variant="outline" className="w-full">
          <Download className="w-4 h-4 mr-2" />
          Download XML
        </Button>
      )}
      {nfe.pdf_danfe && (
        <Button variant="outline" className="w-full">
          <Download className="w-4 h-4 mr-2" />
          Download DANFE
        </Button>
      )}

      {/* Histórico de Eventos */}
      {(nfe.carta_correcao?.length > 0 || nfe.cancelamento) && (
        <Card className="mt-6">
          <CardHeader className="bg-slate-50 border-b">
            <CardTitle className="text-sm">Histórico de Eventos</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {nfe.carta_correcao?.map((cc, idx) => (
              <div key={idx} className="p-3 bg-blue-50 border border-blue-200 rounded">
                <div className="flex justify-between items-start mb-2">
                  <Badge className="bg-blue-600">CC-e #{cc.sequencia}</Badge>
                  <span className="text-xs text-blue-700">
                    {new Date(cc.data).toLocaleString('pt-BR')}
                  </span>
                </div>
                <p className="text-sm text-blue-900">{cc.correcao}</p>
                {cc.protocolo && (
                  <code className="text-xs bg-white px-2 py-1 rounded block mt-2">
                    Protocolo: {cc.protocolo}
                  </code>
                )}
              </div>
            ))}

            {nfe.cancelamento && (
              <div className="p-3 bg-red-50 border border-red-200 rounded">
                <div className="flex justify-between items-start mb-2">
                  <Badge className="bg-red-600">Cancelamento</Badge>
                  <span className="text-xs text-red-700">
                    {new Date(nfe.cancelamento.data_cancelamento).toLocaleString('pt-BR')}
                  </span>
                </div>
                <p className="text-sm text-red-900">{nfe.cancelamento.justificativa}</p>
                <code className="text-xs bg-white px-2 py-1 rounded block mt-2">
                  Protocolo: {nfe.cancelamento.protocolo_cancelamento}
                </code>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}