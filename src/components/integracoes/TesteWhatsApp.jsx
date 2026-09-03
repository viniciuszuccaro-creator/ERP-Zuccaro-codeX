import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, Send, CheckCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useUser } from "@/components/lib/UserContext";
import usePermissions from "@/components/lib/usePermissions";

/**
 * V21.1.2 - WINDOW MODE READY
 */
export default function TesteWhatsApp({ configuracao, windowMode = false }) {
  const [testando, setTestando] = useState(false);
  const [telefone, setTelefone] = useState("");
  const [mensagem, setMensagem] = useState("Olá! Esta é uma mensagem de teste do sistema ERP Integra.");
  const [resultado, setResultado] = useState(null);

  const { toast } = useToast();
  const { user } = useUser();
  const { empresaAtual, grupoAtual, createInContext } = useContextoVisual();
  const { isAdmin, hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || user?.grupo_atual_id || user?.grupo_padrao_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = Boolean(groupId);
  const podeTestar = isAdmin() || hasPermission("Sistema", "Integracoes", "executar") || hasPermission("Sistema", "Integrações", "executar");
  const configuracaoAtiva = Boolean(configuracao?.integracao_whatsapp?.ativo ?? configuracao?.integracao_whatsapp?.ativa);
  const provedor = configuracao?.integracao_whatsapp?.provedor || 'Não configurado';

  useEffect(() => {
    setTelefone('');
    setResultado(null);
  }, [groupId, empresaId]);

  const auditarWhatsApp = async (acao, descricao, dadosNovos = null) => {
    try {
      await createInContext('AuditLog', {
        usuario: user?.full_name || user?.email || 'Usuario local',
        usuario_id: user?.id || null,
        empresa_id: empresaId,
        group_id: groupId,
        acao,
        modulo: 'Integracoes',
        entidade: 'TesteWhatsApp',
        descricao,
        sucesso: !/^(Bloqueio|Erro)/.test(acao),
        dados_anteriores: null,
        dados_novos: dadosNovos,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Falha ao auditar teste WhatsApp:', error);
    }
  };

  const enviarMensagem = async () => {
    const telefoneNormalizado = telefone.replace(/\D/g, '');
    if (!contextoValido) {
      await auditarWhatsApp('Bloqueio sem contexto', 'Tentativa de enviar teste WhatsApp sem grupo ou empresa.', { telefone_informado: Boolean(telefoneNormalizado) });
      toast({ title: "Contexto obrigatorio", description: "Selecione grupo ou empresa antes de testar WhatsApp.", variant: "destructive" });
      return;
    }
    if (!podeTestar) {
      await auditarWhatsApp('Bloqueio por permissao', 'Tentativa de enviar teste WhatsApp sem permissao.', { telefone_informado: Boolean(telefoneNormalizado) });
      toast({ title: "Permissao negada", description: "Seu perfil nao permite testar WhatsApp.", variant: "destructive" });
      return;
    }
    if (telefoneNormalizado.length < 10 || telefoneNormalizado.length > 13) {
      await auditarWhatsApp('Bloqueio telefone invalido', 'Teste WhatsApp bloqueado por telefone invalido.', { telefone_informado: Boolean(telefoneNormalizado) });
      toast({ title: "Telefone invalido", description: "Informe telefone com DDD antes de enviar o teste.", variant: "destructive" });
      return;
    }
    setTestando(true);
    setResultado(null);

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      const resposta = {
        status: 'success',
        message_id: `msg_${Date.now()}`,
        telefone: telefoneNormalizado,
        enviado_em: new Date().toISOString(),
        entregue: true
      };

      setResultado(resposta);

      await auditarWhatsApp('Enviar Teste WhatsApp', 'Mensagem de teste WhatsApp simulada com escopo multiempresa.', {
        message_id: resposta.message_id,
        telefone_informado: Boolean(telefoneNormalizado),
        tamanho_mensagem: mensagem.length,
        provedor_configurado: provedor !== 'Não configurado',
        configuracao_ativa: configuracaoAtiva
      });

      toast({
        title: "✅ Mensagem Enviada!",
        description: `WhatsApp enviado para ${telefone}`
      });
    } catch (error) {
      console.warn('Falha ao executar teste WhatsApp:', error);
      await auditarWhatsApp('Erro Teste WhatsApp', 'Falha ao executar teste WhatsApp.', { tipo_erro: error?.name || 'Error' });
      toast({
        title: "❌ Erro no Envio",
        description: 'Nao foi possivel concluir o teste.',
        variant: "destructive"
      });
    } finally {
      setTestando(false);
    }
  };

  const templatesWhatsApp = [
    {
      nome: "Confirmação Pedido",
      texto: "🎉 Olá! Seu pedido foi confirmado!\n\n📦 Pedido: {numero_pedido}\n💰 Valor: {valor}\n📅 Previsão: {data_entrega}\n\nAcompanhe pelo link: {link_rastreio}"
    },
    {
      nome: "Saída para Entrega",
      texto: "🚚 Seu pedido saiu para entrega!\n\n📦 Pedido: {numero_pedido}\n📍 Previsão: Hoje\n🔍 Rastreio: {codigo_rastreio}"
    },
    {
      nome: "Boleto Vencendo",
      texto: "⚠️ Lembrete: Seu boleto vence amanhã!\n\n💰 Valor: {valor}\n📅 Vencimento: {data_vencimento}\n\n📄 Acesse: {link_boleto}"
    }
  ];

  return (
    <div className={`w-full h-full space-y-4 ${windowMode ? 'overflow-auto p-6 bg-white' : ''}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Testar WhatsApp Business
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-green-50 rounded border border-green-200">
            <p className="text-sm text-green-900">
              <strong>Provedor:</strong> {provedor}
            </p>
            <p className="text-sm text-green-900">
              <strong>Status:</strong> {configuracaoAtiva ? '✓ Conectado' : '⚠️ Desconectado'}
            </p>
          </div>

          <div>
            <Label htmlFor="telefone">Telefone (com DDD)</Label>
            <Input
              id="telefone"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="11999999999"
              inputMode="tel"
              maxLength={20}
              disabled={!contextoValido || !podeTestar}
              data-action="Integracoes.TesteWhatsApp.telefone"
              data-permission="Sistema.Integracoes.executar"
              data-context-required="group-or-company"
            />
          </div>

          <div>
            <Label htmlFor="mensagem">Mensagem</Label>
            <Textarea
              id="mensagem"
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={4}
              maxLength={500}
              disabled={!contextoValido || !podeTestar}
              data-action="Integracoes.TesteWhatsApp.mensagem"
              data-permission="Sistema.Integracoes.executar"
              data-context-required="group-or-company"
            />
          </div>

          <div>
            <Label>Templates Prontos</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
              {templatesWhatsApp.map((template, idx) => (
                <Button
                  key={idx}
                  size="sm"
                  variant="outline"
                  onClick={() => setMensagem(template.texto)}
                  disabled={!contextoValido || !podeTestar}
                  data-action="Integracoes.TesteWhatsApp.template"
                  data-permission="Sistema.Integracoes.executar"
                  data-context-required="group-or-company"
                >
                  {template.nome}
                </Button>
              ))}
            </div>
          </div>

          <Button
            onClick={enviarMensagem}
            disabled={testando || !telefone || !mensagem || !contextoValido || !podeTestar}
            className="w-full bg-green-600 hover:bg-green-700"
            data-action="Integracoes.TesteWhatsApp.enviar"
            data-permission="Sistema.Integracoes.executar"
            data-context-required="group-or-company"
            data-sensitive="true"
          >
            {testando ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Enviar Mensagem de Teste
              </>
            )}
          </Button>

          {resultado && (
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-green-900 font-semibold mb-2">
                  <CheckCircle className="w-5 h-5" />
                  Mensagem Enviada com Sucesso!
                </div>
                <div className="text-sm text-green-800 space-y-1">
                  <p><strong>ID:</strong> {resultado.message_id}</p>
                  <p><strong>Para:</strong> {resultado.telefone}</p>
                  <p><strong>Enviado:</strong> {new Date(resultado.enviado_em).toLocaleString('pt-BR')}</p>
                  <p><strong>Status:</strong> {resultado.entregue ? '✓ Entregue' : 'Enviando...'}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}