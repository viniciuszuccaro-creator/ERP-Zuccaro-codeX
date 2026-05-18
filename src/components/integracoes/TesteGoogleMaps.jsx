import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MapPin, Navigation, CheckCircle, AlertCircle, Send } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { useUser } from "@/components/lib/UserContext";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

/**
 * Teste de Integração Google Maps API
 * V21.1.2 - WINDOW MODE READY
 */
export default function TesteGoogleMaps({ configuracao, windowMode = false }) {
  const [testando, setTestando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [enderecoTeste, setEnderecoTeste] = useState("Av. Paulista, 1000 - São Paulo, SP");

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
        entidade: "TesteGoogleMaps",
        descricao,
        dados_novos: dadosNovos,
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.warn("Falha ao auditar teste de Google Maps:", error);
    }
  };

  const executarTeste = async () => {
    if (!contextoValido) {
      toast({
        title: "Contexto obrigatorio",
        description: "Selecione grupo ou empresa antes de testar Maps.",
        variant: "destructive"
      });
      await auditarTeste("Bloqueio sem contexto", "Tentativa de testar Google Maps sem grupo ou empresa.", { endereco_teste: enderecoTeste });
      return;
    }
    if (!podeTestar) {
      toast({
        title: "Permissao negada",
        description: "Seu perfil nao permite executar testes de integracoes.",
        variant: "destructive"
      });
      await auditarTeste("Bloqueio por permissao", "Tentativa de testar Google Maps sem permissao.", { endereco_teste: enderecoTeste });
      return;
    }
    if (!enderecoTeste) {
      toast({
        title: "❌ Erro",
        description: "Informe um endereço para testar",
        variant: "destructive"
      });
      return;
    }

    setTestando(true);
    setResultado(null);

    try {
      // Simular geocodificação
      await new Promise(resolve => setTimeout(resolve, 1500));

      const lat = -23.5505 + (Math.random() - 0.5) * 0.1;
      const lng = -46.6333 + (Math.random() - 0.5) * 0.1;

      const geocodingSimulado = {
        status: 'success',
        endereco: enderecoTeste,
        latitude: lat,
        longitude: lng,
        link_maps: `https://www.google.com/maps?q=${lat},${lng}`,
        precisao: 'ROOFTOP',
        componentes: {
          rua: 'Av. Paulista',
          numero: '1000',
          bairro: 'Bela Vista',
          cidade: 'São Paulo',
          estado: 'SP',
          cep: '01310-100'
        }
      };

      // Simular cálculo de rota
      const rotaSimulada = {
        distancia_km: (Math.random() * 50 + 10).toFixed(2),
        tempo_minutos: Math.floor(Math.random() * 60 + 20),
        rota_otimizada: true
      };

      setResultado({
        geocoding: geocodingSimulado,
        rota: rotaSimulada
      });
      await auditarTeste("Teste Google Maps", "Teste simulado de geocodificacao e rota executado.", {
        endereco: enderecoTeste,
        latitude: lat,
        longitude: lng,
        distancia_km: rotaSimulada.distancia_km,
      });

      toast({
        title: "✅ Teste Realizado!",
        description: `Coordenadas encontradas: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
      });
    } catch (error) {
      setResultado({
        status: 'error',
        mensagem: error.message
      });
      await auditarTeste("Erro Teste Google Maps", "Falha no teste simulado de Google Maps.", { erro: error.message, endereco_teste: enderecoTeste });
      
      toast({
        title: "❌ Erro no Teste",
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
            <MapPin className="w-5 h-5" />
            Testar Google Maps API
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-amber-300 bg-amber-50">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <AlertDescription>
              <strong>🧪 Modo de Simulação</strong><br />
              Esta integração está em modo de teste. Para ativar a API real do Google Maps, 
              configure a API Key nas Configurações do Sistema.
            </AlertDescription>
          </Alert>

          <div>
            <Label htmlFor="endereco_teste">Endereço para Teste</Label>
            <Input
              id="endereco_teste"
              value={enderecoTeste}
              onChange={(e) => setEnderecoTeste(e.target.value)}
              placeholder="Digite um endereço completo..."
              disabled={!contextoValido || !podeTestar}
              data-action="Integracoes.TesteGoogleMaps.enderecoTeste"
              data-permission="Sistema.Integracoes.editar"
              data-context-required="group-or-company"
            />
          </div>

          <div className="p-3 bg-blue-50 rounded border border-blue-200">
            <p className="text-sm text-blue-900">
              <strong>API Key:</strong> {configuracao?.integracao_maps?.api_key ? '••••••••••••' : 'Não configurada'}
            </p>
            <p className="text-sm text-blue-900">
              <strong>Status:</strong> {configuracao?.integracao_maps?.ativa ? '✅ Ativa' : '⚠️ Inativa'}
            </p>
          </div>

          <Button
            onClick={executarTeste}
            disabled={testando || !contextoValido || !podeTestar}
            className="w-full bg-red-600 hover:bg-red-700"
            data-action="Integracoes.TesteGoogleMaps.executar"
            data-permission="Sistema.Integracoes.editar"
            data-context-required="group-or-company"
            data-sensitive="true"
          >
            {testando ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Testando conexão...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Testar Geocodificação e Rota
              </>
            )}
          </Button>

          {resultado && resultado.status !== 'error' && (
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-green-900 font-semibold">
                  <CheckCircle className="w-5 h-5" />
                  Teste Realizado com Sucesso!
                </div>

                <div className="space-y-2 text-sm text-green-800">
                  <div className="bg-white p-3 rounded border">
                    <p className="font-semibold mb-1">📍 Geocodificação:</p>
                    <p><strong>Endereço:</strong> {resultado.geocoding.endereco}</p>
                    <p><strong>Coordenadas:</strong> {resultado.geocoding.latitude.toFixed(6)}, {resultado.geocoding.longitude.toFixed(6)}</p>
                    <p><strong>Precisão:</strong> {resultado.geocoding.precisao}</p>
                    <a 
                      href={resultado.geocoding.link_maps} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1 mt-2"
                      data-action="Integracoes.TesteGoogleMaps.abrirMaps"
                      data-permission="Sistema.Integracoes.visualizar"
                      data-context-required="group-or-company"
                      data-sensitive="true"
                    >
                      <MapPin className="w-3 h-3" />
                      Abrir no Google Maps
                    </a>
                  </div>

                  <div className="bg-white p-3 rounded border">
                    <p className="font-semibold mb-1">🚚 Cálculo de Rota:</p>
                    <p><strong>Distância:</strong> {resultado.rota.distancia_km} km</p>
                    <p><strong>Tempo Estimado:</strong> {resultado.rota.tempo_minutos} min</p>
                    <Badge className="bg-green-600 mt-2">Rota Otimizada</Badge>
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
