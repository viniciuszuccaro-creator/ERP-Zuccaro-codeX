import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Truck, CheckCircle, AlertCircle, Send, Package } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useUser } from "@/components/lib/UserContext";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

/**
 * Teste de Cálculo de Frete com Transportadoras
 * V21.1.2 - WINDOW MODE READY
 */
export default function TesteTransportadoras({ configuracao, windowMode = false }) {
  const [testando, setTestando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [cepOrigem, setCepOrigem] = useState("01310-100");
  const [cepDestino, setCepDestino] = useState("04538-133");
  const [peso, setPeso] = useState("25");

  const { toast } = useToast();
  const { user } = useUser();
  const { empresaAtual, grupoAtual, createInContext } = useContextoVisual();
  const { isAdmin, hasPermission } = usePermissions();

  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || user?.grupo_atual_id || user?.grupo_padrao_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = Boolean(groupId);
  const podeTestar = isAdmin() || hasPermission("Sistema", "Integracoes", "executar") || hasPermission("Sistema", "Integrações", "executar");

  const auditarTeste = async (acao, descricao, dadosNovos = null) => {
    try {
      await createInContext("AuditLog", {
        usuario: user?.full_name || user?.email || "Usuario local",
        usuario_id: user?.id || null,
        empresa_id: empresaId,
        group_id: groupId,
        acao,
        modulo: "Integracoes",
        entidade: "TesteTransportadoras",
        descricao,
        dados_novos: dadosNovos,
        sucesso: !/^(Bloqueio|Erro)/.test(acao),
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.warn("Falha ao auditar teste de transportadoras:", error);
    }
  };

  const executarTeste = async () => {
    if (!contextoValido) {
      toast({
        title: "Contexto obrigatorio",
        description: "Selecione grupo ou empresa antes de testar transportadoras.",
        variant: "destructive"
      });
      await auditarTeste("Bloqueio sem contexto", "Tentativa de testar transportadoras sem grupo ou empresa.", { origem_informada: Boolean(cepOrigem), destino_informado: Boolean(cepDestino), peso_informado: Boolean(peso) });
      return;
    }
    if (!podeTestar) {
      toast({
        title: "Permissao negada",
        description: "Seu perfil nao permite executar testes de integracoes.",
        variant: "destructive"
      });
      await auditarTeste("Bloqueio por permissao", "Tentativa de testar transportadoras sem permissao.", { origem_informada: Boolean(cepOrigem), destino_informado: Boolean(cepDestino), peso_informado: Boolean(peso) });
      return;
    }
    if (!cepOrigem || !cepDestino || !peso) {
      toast({
        title: "❌ Erro",
        description: "Preencha todos os campos",
        variant: "destructive"
      });
      return;
    }

    setTestando(true);
    setResultado(null);

    try {
      // Simular consulta de frete
      await new Promise(resolve => setTimeout(resolve, 2000));

      const fretes = [
        {
          transportadora: 'Correios - PAC',
          prazo_dias: Math.floor(Math.random() * 5 + 3),
          valor: parseFloat((Math.random() * 50 + 30).toFixed(2)),
          tipo: 'PAC'
        },
        {
          transportadora: 'Correios - SEDEX',
          prazo_dias: Math.floor(Math.random() * 3 + 1),
          valor: parseFloat((Math.random() * 80 + 50).toFixed(2)),
          tipo: 'SEDEX'
        },
        {
          transportadora: 'Jadlog',
          prazo_dias: Math.floor(Math.random() * 4 + 2),
          valor: parseFloat((Math.random() * 60 + 40).toFixed(2)),
          tipo: 'Econômico'
        },
        {
          transportadora: 'Total Express',
          prazo_dias: Math.floor(Math.random() * 6 + 4),
          valor: parseFloat((Math.random() * 45 + 25).toFixed(2)),
          tipo: 'Normal'
        }
      ];

      setResultado({
        status: 'success',
        opcoes: fretes.sort((a, b) => a.valor - b.valor),
        cep_origem: cepOrigem,
        cep_destino: cepDestino,
        peso_kg: parseFloat(peso)
      });
      await auditarTeste("Teste Transportadoras", "Teste simulado de cotacao de frete executado.", {
        origem_informada: Boolean(cepOrigem),
        destino_informado: Boolean(cepDestino),
        peso_kg: parseFloat(peso),
        opcoes: fretes.length,
      });

      toast({
        title: "✅ Cotação Realizada!",
        description: `${fretes.length} opções de frete encontradas`
      });
    } catch (error) {
      console.warn("[TesteTransportadoras] Falha na simulacao:", error);
      setResultado({ status: 'error', mensagem: 'Nao foi possivel concluir o teste de frete.' });
      await auditarTeste("Erro Teste Transportadoras", "Falha no teste simulado de transportadoras.", { origem_informada: Boolean(cepOrigem), destino_informado: Boolean(cepDestino), peso_informado: Boolean(peso), tipo_erro: error?.name || 'Error' });
      toast({
        title: "Erro na cotacao de teste",
        description: "Nao foi possivel concluir o teste de frete.",
        variant: "destructive"
      });
    } finally {
      setTestando(false);
    }
  };

  return (
    <div className={`w-full h-full space-y-4 ${windowMode ? 'overflow-auto p-6 bg-white' : ''}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Testar Cálculo de Frete
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-amber-300 bg-amber-50">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <AlertDescription>
              <strong>🧪 Modo de Simulação</strong><br />
              Esta integração está em modo de teste. Para consultar fretes reais, 
              configure a integração com Melhor Envio ou APIs diretas das transportadoras.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="cep_origem">CEP Origem</Label>
              <Input
                id="cep_origem"
                value={cepOrigem}
                onChange={(e) => setCepOrigem(e.target.value)}
                placeholder="00000-000"
                maxLength="9"
                disabled={!contextoValido || !podeTestar}
                data-action="Integracoes.TesteTransportadoras.cepOrigem"
                data-permission="Sistema.Integracoes.executar"
                data-context-required="group-or-company"
              />
            </div>
            <div>
              <Label htmlFor="cep_destino">CEP Destino</Label>
              <Input
                id="cep_destino"
                value={cepDestino}
                onChange={(e) => setCepDestino(e.target.value)}
                placeholder="00000-000"
                maxLength="9"
                disabled={!contextoValido || !podeTestar}
                data-action="Integracoes.TesteTransportadoras.cepDestino"
                data-permission="Sistema.Integracoes.executar"
                data-context-required="group-or-company"
              />
            </div>
            <div>
              <Label htmlFor="peso">Peso (kg)</Label>
              <Input
                id="peso"
                type="number"
                step="0.1"
                value={peso}
                onChange={(e) => setPeso(e.target.value)}
                placeholder="25.0"
                disabled={!contextoValido || !podeTestar}
                data-action="Integracoes.TesteTransportadoras.peso"
                data-permission="Sistema.Integracoes.executar"
                data-context-required="group-or-company"
              />
            </div>
          </div>

          <div className="p-3 bg-blue-50 rounded border border-blue-200">
            <p className="text-sm text-blue-900">
              <strong>Provedor:</strong> {configuracao?.integracao_transportadoras?.provedor || 'Não configurado'}
            </p>
            <p className="text-sm text-blue-900">
              <strong>Status:</strong> {configuracao?.integracao_transportadoras?.ativa ? '✅ Ativa' : '⚠️ Inativa'}
            </p>
          </div>

          <Button
            onClick={executarTeste}
            disabled={testando || !contextoValido || !podeTestar}
            className="w-full bg-orange-600 hover:bg-orange-700"
            data-action="Integracoes.TesteTransportadoras.executar"
            data-permission="Sistema.Integracoes.executar"
            data-context-required="group-or-company"
            data-sensitive="true"
          >
            {testando ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Calculando Frete...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Calcular Frete
              </>
            )}
          </Button>

          {resultado && resultado.status === 'success' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-green-900 font-semibold mb-2">
                <CheckCircle className="w-5 h-5" />
                Opções de Frete Disponíveis
              </div>

              {resultado.opcoes.map((opcao, idx) => (
                <Card key={idx} className="bg-white border">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{opcao.transportadora}</p>
                        <p className="text-xs text-slate-600">{opcao.tipo}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600">
                          R$ {opcao.valor.toFixed(2)}
                        </p>
                        <p className="text-xs text-slate-600">
                          {opcao.prazo_dias} dia{opcao.prazo_dias > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <div className="p-3 bg-blue-50 rounded border border-blue-200 mt-3">
                <p className="text-xs text-blue-700">
                  <Package className="w-3 h-3 inline mr-1" />
                  Peso: {resultado.peso_kg} kg • 
                  Origem: {resultado.cep_origem} • 
                  Destino: {resultado.cep_destino}
                </p>
              </div>
            </div>
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
