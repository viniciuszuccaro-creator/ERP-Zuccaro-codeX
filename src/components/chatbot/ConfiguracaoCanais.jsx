import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import * as TabsUI from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  MessageCircle,
  Instagram,
  Send as Telegram,
  Mail,
  Globe,
  Settings,
  CheckCircle,
  AlertCircle,
  Smartphone,
  Clock,
  Brain,
  Shield,
  Save,
  RefreshCw,
  Phone,
  Workflow
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import RoteamentoInteligente from "./RoteamentoInteligente";
import NotificacoesCanal from "./NotificacoesCanal";
import AutomacaoFluxos from "./AutomacaoFluxos";
import WebhooksTester from "./WebhooksTester";

/**
 * V21.6 - CONFIGURAÇÃO UNIFICADA DE CANAIS OMNICANAL
 * 
 * Interface completa para configurar todos os canais:
 * ✅ Configurações básicas por canal
 * ✅ Configurações avançadas de IA
 * ✅ Horários de atendimento
 * ✅ Regras de SLA
 * ✅ Transbordo e roteamento
 * ✅ Mensagens automáticas
 * ✅ Automações e fluxos
 * ✅ Suporte multi-empresa
 */
export default function ConfiguracaoCanais() {
  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, filterInContext, createInContext, updateInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const [canalSelecionado, setCanalSelecionado] = useState("WhatsApp");
  const [abaAtiva, setAbaAtiva] = useState("basico");
  const empresaId = empresaAtual?.id;
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id;
  const contextKey = empresaId || groupId || "sem-contexto";
  const contextoValido = contextKey !== "sem-contexto";
  const canViewConfig = hasPermission("Sistema", "Integracoes", "visualizar") ||
    hasPermission("CRM", "Atendimento", "visualizar");
  const canEditConfig = hasPermission("Sistema", "Integracoes", "editar") ||
    hasPermission("CRM", "Atendimento", "editar");

  const canais = [
    { nome: "WhatsApp", icon: MessageCircle, cor: "green" },
    { nome: "Instagram", icon: Instagram, cor: "pink" },
    { nome: "Facebook", icon: MessageCircle, cor: "blue" },
    { nome: "Telegram", icon: Telegram, cor: "sky" },
    { nome: "Email", icon: Mail, cor: "slate" },
    { nome: "WebChat", icon: Globe, cor: "purple" },
    { nome: "Portal", icon: Smartphone, cor: "indigo" },
    { nome: "SMS", icon: MessageCircle, cor: "orange" },
    { nome: "VoIP", icon: Phone, cor: "teal" }
  ];

  // Buscar configurações
  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['config-canais', contextKey],
    queryFn: async () => {
      return await filterInContext("ConfiguracaoCanal", {}, "canal", 100);
    },
    enabled: contextoValido && canViewConfig
  });

  const configAtual = configs.find(c => c.canal === canalSelecionado);

  // Salvar configuração
  const salvarConfigMutation = useMutation({
    mutationFn: async (dados) => {
      if (!contextoValido || !canEditConfig) {
        throw new Error("Contexto ou permissao insuficiente para salvar configuracao de canal");
      }

      if (configAtual) {
        return await updateInContext("ConfiguracaoCanal", configAtual.id, dados);
      } else {
        return await createInContext("ConfiguracaoCanal", {
          ...dados,
          canal: canalSelecionado
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-canais'] });
      toast.success("Configuração salva!");
    }
  });

  // Contadores
  const canaisAtivos = configs.filter(c => c.ativo).length;
  const totalConversasAtivas = configs.reduce((acc, c) => acc + (c.conversas_ativas || 0), 0);

  return (
    <div className="w-full h-full overflow-auto p-4 lg:p-6" data-permission="Sistema.Integracoes.editar" data-context-required="group-or-company">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header com Resumo */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Settings className="w-8 h-8 text-blue-600" />
              Configuração de Canais
            </h1>
            <p className="text-slate-600 mt-1">Gerencie todos os canais de atendimento</p>
          </div>
          <div className="flex gap-3">
            <Badge className="bg-green-100 text-green-800 px-3 py-1">
              {canaisAtivos} canais ativos
            </Badge>
            <Badge className="bg-blue-100 text-blue-800 px-3 py-1">
              {totalConversasAtivas} conversas
            </Badge>
          </div>
        </div>

        {(!contextoValido || !canViewConfig) && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertDescription className="text-amber-800">
              Selecione grupo/empresa e confirme permissao para configurar canais de atendimento.
            </AlertDescription>
          </Alert>
        )}

        {/* Cards de Status dos Canais */}
        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3">
          {canais.map((canal) => {
            const config = configs.find(c => c.canal === canal.nome);
            const Icon = canal.icon;
            const isSelected = canalSelecionado === canal.nome;
            
            return (
              <motion.div
                key={canal.nome}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card
                  className={`cursor-pointer transition-all h-full ${
                    isSelected ? 'ring-2 ring-blue-600 bg-blue-50' : 'hover:shadow-md'
                  }`}
                  onClick={() => setCanalSelecionado(canal.nome)}
                >
                  <CardContent className="p-3 text-center">
                    <Icon className={`w-6 h-6 mx-auto mb-1 ${
                      isSelected ? 'text-blue-600' : `text-${canal.cor}-600`
                    }`} />
                    <p className="text-xs font-semibold mb-1 truncate">{canal.nome}</p>
                    {config?.ativo ? (
                      <Badge className="bg-green-600 text-xs px-1">Ativo</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs px-1">Off</Badge>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Abas de Configuração */}
        <TabsUI.Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="w-full">
          <TabsUI.TabsList className="grid grid-cols-5 w-full max-w-2xl">
            <TabsUI.TabsTrigger value="basico" className="text-xs">
              <Settings className="w-3 h-3 mr-1" />
              Básico
            </TabsUI.TabsTrigger>
            <TabsUI.TabsTrigger value="horarios" className="text-xs">
              <Clock className="w-3 h-3 mr-1" />
              Horários
            </TabsUI.TabsTrigger>
            <TabsUI.TabsTrigger value="ia" className="text-xs">
              <Brain className="w-3 h-3 mr-1" />
              IA
            </TabsUI.TabsTrigger>
            <TabsUI.TabsTrigger value="sla" className="text-xs">
              <Shield className="w-3 h-3 mr-1" />
              SLA
            </TabsUI.TabsTrigger>
            <TabsUI.TabsTrigger value="automacao" className="text-xs">
              <Workflow className="w-3 h-3 mr-1" />
              Automação
            </TabsUI.TabsTrigger>
          </TabsUI.TabsList>

          {/* Aba Básico */}
          <TabsUI.TabsContent value="basico">
            <div className="grid lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader className="border-b">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Settings className="w-5 h-5" />
                    Configurar {canalSelecionado}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <ConfiguracaoCanalForm
                    canal={canalSelecionado}
                    config={configAtual}
                    onSave={(dados) => salvarConfigMutation.mutate(dados)}
                    isSaving={salvarConfigMutation.isPending}
                    canEdit={contextoValido && canEditConfig}
                  />
                </CardContent>
              </Card>

              <div className="space-y-4">
                <RoteamentoInteligente canalConfig={configAtual} />
                <NotificacoesCanal canalConfig={configAtual} />
              </div>
            </div>
          </TabsUI.TabsContent>

          {/* Aba Horários */}
          <TabsUI.TabsContent value="horarios">
            <ConfiguracaoHorarios
              config={configAtual}
              onSave={(dados) => salvarConfigMutation.mutate(dados)}
              isSaving={salvarConfigMutation.isPending}
              canEdit={contextoValido && canEditConfig}
            />
          </TabsUI.TabsContent>

          {/* Aba IA */}
          <TabsUI.TabsContent value="ia">
            <ConfiguracaoIA
              config={configAtual}
              onSave={(dados) => salvarConfigMutation.mutate(dados)}
              isSaving={salvarConfigMutation.isPending}
              canEdit={contextoValido && canEditConfig}
            />
          </TabsUI.TabsContent>

          {/* Aba SLA */}
          <TabsUI.TabsContent value="sla">
            <ConfiguracaoSLA
              config={configAtual}
              onSave={(dados) => salvarConfigMutation.mutate(dados)}
              isSaving={salvarConfigMutation.isPending}
              canEdit={contextoValido && canEditConfig}
            />
          </TabsUI.TabsContent>

          {/* Aba Automação */}
          <TabsUI.TabsContent value="automacao">
            <div className="grid md:grid-cols-2 gap-6">
              <AutomacaoFluxos canalConfig={configAtual} />
              <WebhooksTester canalConfig={configAtual} />
            </div>
          </TabsUI.TabsContent>
        </TabsUI.Tabs>
      </div>
    </div>
  );
}

function ConfiguracaoCanalForm({ canal, config, onSave, isSaving, canEdit = true }) {
  const [formData, setFormData] = useState({
    ativo: false,
    modo_atendimento: 'Bot com Transbordo',
    mensagem_boas_vindas: '',
    mensagem_ausencia: '',
    mensagem_fila_espera: '',
    mensagem_transferencia: '',
    mensagem_encerramento: '',
    tempo_timeout_minutos: 30
  });

  useEffect(() => {
    if (config) {
      setFormData({
        ativo: config.ativo || false,
        modo_atendimento: config.modo_atendimento || 'Bot com Transbordo',
        mensagem_boas_vindas: config.mensagem_boas_vindas || '',
        mensagem_ausencia: config.mensagem_ausencia || '',
        mensagem_fila_espera: config.mensagem_fila_espera || '',
        mensagem_transferencia: config.mensagem_transferencia || '',
        mensagem_encerramento: config.mensagem_encerramento || '',
        tempo_timeout_minutos: config.tempo_timeout_minutos || 30
      });
    }
  }, [config]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Ativar/Desativar */}
      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
        <div>
          <Label className="text-base font-semibold">Canal Ativo</Label>
          <p className="text-sm text-slate-600">Habilitar atendimento neste canal</p>
        </div>
        <Switch
          checked={formData.ativo}
          onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
          disabled={!canEdit}
          data-action="ConfiguracaoCanais.toggleCanal"
          data-permission="Sistema.Integracoes.editar"
          data-context-required="group-or-company"
        />
      </div>

      {/* Modo de Atendimento */}
      <div>
        <Label>Modo de Atendimento</Label>
        <select
          value={formData.modo_atendimento}
          onChange={(e) => setFormData({ ...formData, modo_atendimento: e.target.value })}
          className="w-full px-3 py-2 border rounded-md mt-1"
        >
          <option value="Apenas Bot">Apenas Bot</option>
          <option value="Bot com Transbordo">Bot com Transbordo (Recomendado)</option>
          <option value="Apenas Humano">Apenas Humano</option>
          <option value="Híbrido">Híbrido</option>
          <option value="IA Avançada">IA Avançada</option>
        </select>
      </div>

      {/* Mensagens Automáticas */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label>Mensagem de Boas-Vindas</Label>
          <Textarea
            value={formData.mensagem_boas_vindas}
            onChange={(e) => setFormData({ ...formData, mensagem_boas_vindas: e.target.value })}
            placeholder="Olá! 👋 Como posso ajudar?"
            className="mt-1 h-20"
          />
        </div>
        <div>
          <Label>Mensagem Fora de Horário</Label>
          <Textarea
            value={formData.mensagem_ausencia}
            onChange={(e) => setFormData({ ...formData, mensagem_ausencia: e.target.value })}
            placeholder="Estamos fora do horário..."
            className="mt-1 h-20"
          />
        </div>
        <div>
          <Label>Mensagem Fila de Espera</Label>
          <Textarea
            value={formData.mensagem_fila_espera}
            onChange={(e) => setFormData({ ...formData, mensagem_fila_espera: e.target.value })}
            placeholder="Aguarde um momento..."
            className="mt-1 h-20"
          />
        </div>
        <div>
          <Label>Mensagem de Transferência</Label>
          <Textarea
            value={formData.mensagem_transferencia}
            onChange={(e) => setFormData({ ...formData, mensagem_transferencia: e.target.value })}
            placeholder="Transferindo para um atendente..."
            className="mt-1 h-20"
          />
        </div>
      </div>

      <div>
        <Label>Mensagem de Encerramento</Label>
        <Textarea
          value={formData.mensagem_encerramento}
          onChange={(e) => setFormData({ ...formData, mensagem_encerramento: e.target.value })}
          placeholder="Obrigado pelo contato! 😊"
          className="mt-1 h-16"
        />
      </div>

      {/* Timeout */}
      <div>
        <Label>Tempo de Timeout (minutos)</Label>
        <Input
          type="number"
          value={formData.tempo_timeout_minutos}
          onChange={(e) => setFormData({ ...formData, tempo_timeout_minutos: parseInt(e.target.value) || 30 })}
          className="mt-1 w-32"
        />
      </div>

      {/* Credenciais específicas por canal */}
      {canal === 'WhatsApp' && (
        <Alert className="bg-green-50 border-green-200">
          <AlertDescription className="text-sm text-green-800">
            ⚠️ Integração WhatsApp Business API requer <strong>Backend Functions</strong>
          </AlertDescription>
        </Alert>
      )}

      {/* Botão Salvar */}
      <div className="flex justify-end pt-4 border-t">
        <Button type="submit" disabled={isSaving || !canEdit} className="bg-blue-600 hover:bg-blue-700" data-action="ConfiguracaoCanais.salvarBasico" data-permission="Sistema.Integracoes.editar" data-context-required="group-or-company" data-sensitive="true">
          {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar Configuração
        </Button>
      </div>
    </form>
  );
}

// Componente de Configuração de Horários
function ConfiguracaoHorarios({ config, onSave, isSaving, canEdit = true }) {
  const diasSemana = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
  const diasLabels = { segunda: 'Segunda', terca: 'Terça', quarta: 'Quarta', quinta: 'Quinta', sexta: 'Sexta', sabado: 'Sábado', domingo: 'Domingo' };

  const [horarios, setHorarios] = useState({
    segunda: { inicio: '08:00', fim: '18:00', ativo: true },
    terca: { inicio: '08:00', fim: '18:00', ativo: true },
    quarta: { inicio: '08:00', fim: '18:00', ativo: true },
    quinta: { inicio: '08:00', fim: '18:00', ativo: true },
    sexta: { inicio: '08:00', fim: '18:00', ativo: true },
    sabado: { inicio: '08:00', fim: '12:00', ativo: false },
    domingo: { inicio: '', fim: '', ativo: false }
  });

  useEffect(() => {
    if (config?.horario_atendimento) {
      setHorarios(config.horario_atendimento);
    }
  }, [config]);

  const handleSave = () => {
    onSave({ horario_atendimento: horarios });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-green-600" />
          Horários de Atendimento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {diasSemana.map(dia => (
          <div key={dia} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
            <div className="w-20">
              <span className="text-sm font-medium">{diasLabels[dia]}</span>
            </div>
            <Switch
              checked={horarios[dia]?.ativo}
              onCheckedChange={(c) => setHorarios({
                ...horarios,
                [dia]: { ...horarios[dia], ativo: c }
              })}
              disabled={!canEdit}
              data-action="ConfiguracaoCanais.toggleHorario"
              data-permission="Sistema.Integracoes.editar"
              data-context-required="group-or-company"
            />
            <Input
              type="time"
              value={horarios[dia]?.inicio || ''}
              onChange={(e) => setHorarios({
                ...horarios,
                [dia]: { ...horarios[dia], inicio: e.target.value }
              })}
              disabled={!horarios[dia]?.ativo}
              className="w-28"
            />
            <span className="text-sm">até</span>
            <Input
              type="time"
              value={horarios[dia]?.fim || ''}
              onChange={(e) => setHorarios({
                ...horarios,
                [dia]: { ...horarios[dia], fim: e.target.value }
              })}
              disabled={!horarios[dia]?.ativo}
              className="w-28"
            />
          </div>
        ))}
        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={isSaving || !canEdit} className="bg-blue-600" data-action="ConfiguracaoCanais.salvarHorarios" data-permission="Sistema.Integracoes.editar" data-context-required="group-or-company" data-sensitive="true">
            {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar Horários
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Componente de Configuração de IA
function ConfiguracaoIA({ config, onSave, isSaving, canEdit = true }) {
  const [iaConfig, setIaConfig] = useState({
    modelo: 'gpt-4',
    temperatura: 0.7,
    max_tokens: 500,
    contexto_sistema: '',
    usar_historico_cliente: true,
    usar_base_conhecimento: true,
    detectar_idioma: true
  });

  useEffect(() => {
    if (config?.ia_config) {
      setIaConfig(config.ia_config);
    }
  }, [config]);

  const handleSave = () => {
    onSave({ ia_config: iaConfig });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-600" />
          Configuração da IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <Label>Modelo</Label>
            <select
              value={iaConfig.modelo}
              onChange={(e) => setIaConfig({ ...iaConfig, modelo: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-md"
            >
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              <option value="claude-3">Claude 3</option>
            </select>
          </div>
          <div>
            <Label>Temperatura ({iaConfig.temperatura})</Label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={iaConfig.temperatura}
              onChange={(e) => setIaConfig({ ...iaConfig, temperatura: parseFloat(e.target.value) })}
              className="w-full mt-3"
            />
          </div>
          <div>
            <Label>Max Tokens</Label>
            <Input
              type="number"
              value={iaConfig.max_tokens}
              onChange={(e) => setIaConfig({ ...iaConfig, max_tokens: parseInt(e.target.value) })}
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <Label>Contexto do Sistema</Label>
          <Textarea
            value={iaConfig.contexto_sistema}
            onChange={(e) => setIaConfig({ ...iaConfig, contexto_sistema: e.target.value })}
            placeholder="Instruções de comportamento para a IA..."
            className="mt-1 h-24"
          />
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <span className="text-sm">Usar histórico</span>
            <Switch
              checked={iaConfig.usar_historico_cliente}
              onCheckedChange={(c) => setIaConfig({ ...iaConfig, usar_historico_cliente: c })}
              disabled={!canEdit}
              data-action="ConfiguracaoCanais.toggleHistoricoIA"
              data-permission="Sistema.Integracoes.editar"
              data-context-required="group-or-company"
            />
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <span className="text-sm">Base conhecimento</span>
            <Switch
              checked={iaConfig.usar_base_conhecimento}
              onCheckedChange={(c) => setIaConfig({ ...iaConfig, usar_base_conhecimento: c })}
              disabled={!canEdit}
              data-action="ConfiguracaoCanais.toggleBaseConhecimentoIA"
              data-permission="Sistema.Integracoes.editar"
              data-context-required="group-or-company"
            />
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <span className="text-sm">Detectar idioma</span>
            <Switch
              checked={iaConfig.detectar_idioma}
              onCheckedChange={(c) => setIaConfig({ ...iaConfig, detectar_idioma: c })}
              disabled={!canEdit}
              data-action="ConfiguracaoCanais.toggleIdiomaIA"
              data-permission="Sistema.Integracoes.editar"
              data-context-required="group-or-company"
            />
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={isSaving || !canEdit} className="bg-purple-600" data-action="ConfiguracaoCanais.salvarIA" data-permission="Sistema.Integracoes.editar" data-context-required="group-or-company" data-sensitive="true">
            {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar IA
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Componente de Configuração de SLA
function ConfiguracaoSLA({ config, onSave, isSaving, canEdit = true }) {
  const [slaConfig, setSlaConfig] = useState({
    tempo_primeira_resposta_minutos: 5,
    tempo_resolucao_minutos: 60,
    tempo_espera_fila_maximo_minutos: 10,
    alertar_gestores: true,
    escalar_automaticamente: true
  });

  useEffect(() => {
    if (config?.sla_config) {
      setSlaConfig(config.sla_config);
    }
  }, [config]);

  const handleSave = () => {
    onSave({ sla_config: slaConfig });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-red-600" />
          Configuração de SLA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <Label>Primeira Resposta (min)</Label>
            <Input
              type="number"
              value={slaConfig.tempo_primeira_resposta_minutos}
              onChange={(e) => setSlaConfig({ ...slaConfig, tempo_primeira_resposta_minutos: parseInt(e.target.value) })}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Resolução (min)</Label>
            <Input
              type="number"
              value={slaConfig.tempo_resolucao_minutos}
              onChange={(e) => setSlaConfig({ ...slaConfig, tempo_resolucao_minutos: parseInt(e.target.value) })}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Espera Fila (min)</Label>
            <Input
              type="number"
              value={slaConfig.tempo_espera_fila_maximo_minutos}
              onChange={(e) => setSlaConfig({ ...slaConfig, tempo_espera_fila_maximo_minutos: parseInt(e.target.value) })}
              className="mt-1"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <span className="text-sm">Alertar gestores ao exceder SLA</span>
            <Switch
              checked={slaConfig.alertar_gestores}
              onCheckedChange={(c) => setSlaConfig({ ...slaConfig, alertar_gestores: c })}
              disabled={!canEdit}
              data-action="ConfiguracaoCanais.toggleAlertaSLA"
              data-permission="Sistema.Integracoes.editar"
              data-context-required="group-or-company"
            />
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <span className="text-sm">Escalar automaticamente</span>
            <Switch
              checked={slaConfig.escalar_automaticamente}
              onCheckedChange={(c) => setSlaConfig({ ...slaConfig, escalar_automaticamente: c })}
              disabled={!canEdit}
              data-action="ConfiguracaoCanais.toggleEscalaSLA"
              data-permission="Sistema.Integracoes.editar"
              data-context-required="group-or-company"
            />
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={isSaving || !canEdit} className="bg-red-600" data-action="ConfiguracaoCanais.salvarSLA" data-permission="Sistema.Integracoes.editar" data-context-required="group-or-company" data-sensitive="true">
            {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar SLA
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
