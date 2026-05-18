import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, CheckCircle, AlertCircle, Send, Eye } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useUser } from "@/components/lib/UserContext";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

/**
 * Teste de Emissão de NF-e
 * V21.1.2 - WINDOW MODE READY
 */
export default function TesteNFe({ configuracao, windowMode = false }) {
  const [testando, setTestando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [pedidoTeste, setPedidoTeste] = useState("");

  const { toast } = useToast();
  const { user } = useUser();
  const { empresaAtual, grupoAtual } = useContextoVisual();
  const { isAdmin, hasPermission } = usePermissions();

  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || user?.grupo_atual_id || user?.grupo_padrao_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const podeTestar = isAdmin() || hasPermission("Sistema", "Integracoes", "editar") || hasPermission("Sistema", "Integrações", "editar");

  const auditarTeste = async (acao, descricao, dadosNovos = null) => {
    try {
      await base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || "Usuario local",
        usuario_id: user?.id || null,
        empresa_id: empresaId,
        group_id: groupId,
        acao,
        modulo: "Integracoes",
        entidade: "TesteNFe",
        descricao,
        dados_novos: dadosNovos,
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.warn("Falha ao auditar teste de NF-e:", error);
    }
  };

  const executarTeste = async () => {
    if (!contextoValido) {
      toast({
        title: "Contexto obrigatorio",
        description: "Selecione grupo ou empresa antes de testar NF-e.",
        variant: "destructive"
      });
      await auditarTeste("Bloqueio sem contexto", "Tentativa de testar NF-e sem grupo ou empresa.", { pedido_teste: pedidoTeste || null });
      return;
    }
    if (!podeTestar) {
      toast({
        title: "Permissao negada",
        description: "Seu perfil nao permite executar testes de integracoes.",
        variant: "destructive"
      });
      await auditarTeste("Bloqueio por permissao", "Tentativa de testar NF-e sem permissao.", { pedido_teste: pedidoTeste || null });
      return;
    }

    setTestando(true);
    setResultado(null);

    try {
      // Simular emissão de NF-e
      await new Promise(resolve => setTimeout(resolve, 2000));

      const nfeSimulada = {
        status: 'success',
        numero: Math.floor(Math.random() * 1000000),
        serie: configuracao?.parametros_fiscais?.serie_nfe || '1',
        chave_acesso: Array(44).fill(0).map(() => Math.floor(Math.random() * 10)).join(''),
        protocolo: `${Date.now()}`,
        data_autorizacao: new Date().toISOString(),
        ambiente: configuracao?.parametros_fiscais?.ambiente_nfe || 'Homologação',
        xml_url: 'https://exemplo.com/nfe.xml',
        pdf_url: 'https://exemplo.com/nfe.pdf',
        mensagem_sefaz: '100 - Autorizado o uso da NF-e',
        codigo_status: '100'
      };

      setResultado(nfeSimulada);
      await auditarTeste("Teste NF-e", "Teste simulado de emissao NF-e executado.", {
        pedido_teste: pedidoTeste || null,
        numero: nfeSimulada.numero,
        serie: nfeSimulada.serie,
        ambiente: nfeSimulada.ambiente,
        codigo_status: nfeSimulada.codigo_status,
      });

      toast({
        title: "✅ NF-e Autorizada!",
        description: `Nota fiscal ${nfeSimulada.numero} emitida com sucesso`
      });
    } catch (error) {
      setResultado({
        status: 'error',
        mensagem: error.message
      });
      await auditarTeste("Erro Teste NF-e", "Falha no teste simulado de NF-e.", { erro: error.message, pedido_teste: pedidoTeste || null });
      
      toast({
        title: "❌ Erro na Emissão",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setTestando(false);
    }
  };

  return (
    <div className={`space-y-4 ${windowMode ? 'w-full h-full overflow-auto p-6 bg-white' : ''}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Testar Emissão de NF-e
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-amber-300 bg-amber-50">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <AlertDescription>
              <strong>🧪 Modo de Simulação</strong><br />
              Esta integração está em modo de teste. A NF-e não será transmitida para a SEFAZ.
              Configure o certificado digital e o provedor (eNotas, NFe.io, etc.) para ativar.
            </AlertDescription>
          </Alert>

          <div>
            <Label htmlFor="pedido_teste">Número do Pedido (opcional)</Label>
            <Input
              id="pedido_teste"
              value={pedidoTeste}
              onChange={(e) => setPedidoTeste(e.target.value)}
              placeholder="PED-2025-001"
              disabled={!contextoValido || !podeTestar}
              data-action="Integracoes.TesteNFe.pedidoTeste"
              data-permission="Sistema.Integracoes.editar"
              data-context-required="group-or-company"
            />
          </div>

          <div className="p-3 bg-blue-50 rounded border border-blue-200">
            <p className="text-sm text-blue-900">
              <strong>Ambiente:</strong> {configuracao?.parametros_fiscais?.ambiente_nfe || 'Homologação'}
            </p>
            <p className="text-sm text-blue-900">
              <strong>Série:</strong> {configuracao?.parametros_fiscais?.serie_nfe || '1'}
            </p>
            <p className="text-sm text-blue-900">
              <strong>Próximo Número:</strong> {configuracao?.parametros_fiscais?.proximo_numero_nfe || 1}
            </p>
          </div>

          <Button
            onClick={executarTeste}
            disabled={testando || !contextoValido || !podeTestar}
            className="w-full bg-blue-600 hover:bg-blue-700"
            data-action="Integracoes.TesteNFe.executar"
            data-permission="Sistema.Integracoes.editar"
            data-context-required="group-or-company"
            data-sensitive="true"
          >
            {testando ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Emitindo NF-e...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Emitir NF-e de Teste
              </>
            )}
          </Button>

          {resultado && resultado.status === 'success' && (
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-green-900 font-semibold mb-3">
                    <CheckCircle className="w-5 h-5" />
                    NF-e Autorizada com Sucesso!
                  </div>
                  <div className="text-sm text-green-800 space-y-1">
                    <p><strong>Número:</strong> {resultado.numero}</p>
                    <p><strong>Série:</strong> {resultado.serie}</p>
                    <p><strong>Chave de Acesso:</strong> {resultado.chave_acesso}</p>
                    <p><strong>Protocolo:</strong> {resultado.protocolo}</p>
                    <p><strong>Ambiente:</strong> {resultado.ambiente}</p>
                    <p><strong>Autorizado em:</strong> {new Date(resultado.data_autorizacao).toLocaleString('pt-BR')}</p>
                    <p className="text-xs text-green-700 mt-2">{resultado.mensagem_sefaz}</p>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" data-action="Integracoes.TesteNFe.verXml" data-permission="Sistema.Integracoes.visualizar" data-context-required="group-or-company" data-sensitive="true">
                      <Eye className="w-4 h-4 mr-1" />
                      Ver XML
                    </Button>
                    <Button size="sm" variant="outline" data-action="Integracoes.TesteNFe.verDanfe" data-permission="Sistema.Integracoes.visualizar" data-context-required="group-or-company" data-sensitive="true">
                      <FileText className="w-4 h-4 mr-1" />
                      Ver DANFE
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {resultado && resultado.status === 'error' && (
            <Card className="bg-red-50 border-red-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-red-900">
                  <AlertCircle className="w-5 h-5" />
                  <p>{resultado.mensagem}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
