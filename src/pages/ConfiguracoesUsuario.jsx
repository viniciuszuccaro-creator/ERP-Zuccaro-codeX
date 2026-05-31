
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Mail, Monitor, Volume2, Clock, Save, CheckCircle, AlertCircle, Settings, User, Lock, Palette } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Funções de notificação push (inline)
const isPushHabilitado = () => {
  if (!("Notification" in window)) return false;
  return Notification.permission === "granted";
};

const solicitarPermissaoPush = async () => {
  if (!("Notification" in window)) {
    alert("Este navegador não suporta notificações push");
    return false;
  }
  if (Notification.permission === "granted") return true;
  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }
  return false;
};

const testarPushNotification = () => {
  if (!isPushHabilitado()) {
    alert("Permissão de notificações não concedida");
    return;
  }
  new Notification("🔔 Teste de Notificação", {
    body: "As notificações push estão funcionando corretamente!",
    icon: "/favicon.ico",
    badge: "/favicon.ico"
  });
};

export default function ConfiguracoesUsuario() {
  const [activeTab, setActiveTab] = useState("notificacoes");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const queryClient = useQueryClient();

  const [pushHabilitado, setPushHabilitado] = React.useState(isPushHabilitado());

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const [preferencesForm, setPreferencesForm] = useState({
    preferencias_notificacoes: {
      notificacoes_ativadas: true,
      canais: {
        sistema: true,
        email: false,
        push: false
      },
      categorias: {
        Sistema: true,
        Comercial: true,
        Financeiro: true,
        Estoque: true,
        RH: true,
        Fiscal: true,
        Geral: true
      },
      prioridades: {
        Urgente: true,
        Alta: true,
        Normal: true,
        Baixa: false
      },
      horario_silencioso: {
        ativo: false,
        inicio: "22:00",
        fim: "08:00"
      },
      resumo_email: {
        ativo: false,
        frequencia: "Diário",
        horario: "09:00"
      },
      som_notificacao: true,
      notificacao_desktop: false
    },
    configuracoes_sistema: {
      tema: "Claro",
      idioma: "pt-BR",
      timezone: "America/Sao_Paulo",
      formato_data: "DD/MM/YYYY",
      formato_moeda: "BRL"
    }
  });

  useEffect(() => {
    if (user?.preferencias_notificacoes) {
      setPreferencesForm(prev => ({
        ...prev,
        preferencias_notificacoes: {
          ...prev.preferencias_notificacoes,
          ...user.preferencias_notificacoes
        }
      }));
    }
    if (user?.configuracoes_sistema) {
      setPreferencesForm(prev => ({
        ...prev,
        configuracoes_sistema: {
          ...prev.configuracoes_sistema,
          ...user.configuracoes_sistema
        }
      }));
    }
  }, [user]);

  const updateUserMutation = useMutation({
    mutationFn: (data) => base44.auth.updateMe(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  const handleSave = () => {
    updateUserMutation.mutate(preferencesForm);
  };

  const updateNotificationPref = (path, value) => {
    const keys = path.split('.');
    setPreferencesForm(prev => {
      const newPreferencesForm = { ...prev };
      let current = newPreferencesForm.preferencias_notificacoes;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return newPreferencesForm;
    });
  };

  const updateSystemPref = (key, value) => {
    setPreferencesForm(prev => ({
      ...prev,
      configuracoes_sistema: {
        ...prev.configuracoes_sistema,
        [key]: value
      }
    }));
  };

  const handleSolicitarPush = async () => {
    const permitido = await solicitarPermissaoPush();
    setPushHabilitado(permitido);
    
    if (permitido) {
      // Testar notificação
      setTimeout(() => {
        testarPushNotification();
      }, 500);
    }
  };

  const categorias = [
    { key: 'Sistema', label: 'Sistema', icon: Settings, color: 'text-slate-600' },
    { key: 'Comercial', label: 'Comercial', icon: User, color: 'text-blue-600' },
    { key: 'Financeiro', label: 'Financeiro', icon: Bell, color: 'text-green-600' },
    { key: 'Estoque', label: 'Estoque', icon: Monitor, color: 'text-purple-600' },
    { key: 'RH', label: 'RH', icon: User, color: 'text-pink-600' },
    { key: 'Fiscal', label: 'Fiscal', icon: Bell, color: 'text-orange-600' },
    { key: 'Geral', label: 'Geral', icon: Bell, color: 'text-slate-600' }
  ];

  const prioridades = [
    { key: 'Urgente', label: 'Urgente', color: 'bg-red-100 text-red-700' },
    { key: 'Alta', label: 'Alta', color: 'bg-orange-100 text-orange-700' },
    { key: 'Normal', label: 'Normal', color: 'bg-blue-100 text-blue-700' },
    { key: 'Baixa', label: 'Baixa', color: 'bg-slate-100 text-slate-700' }
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Configurações do Usuário</h1>
          <p className="text-slate-600">Personalize suas preferências e notificações</p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={updateUserMutation.isPending}
          className={`${saveSuccess ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {saveSuccess ? (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Salvo!
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              {updateUserMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
            </>
          )}
        </Button>
      </div>

      {/* Informações do Usuário */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-2xl">
                {user?.full_name?.[0] || 'U'}
              </span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">{user?.full_name || 'Usuário'}</h3>
              <p className="text-slate-600">{user?.email}</p>
              <Badge className="mt-1">
                {user?.role === 'admin' ? 'Administrador' : 'Usuário'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white border shadow-sm">
          <TabsTrigger value="notificacoes" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Bell className="w-4 h-4 mr-2" />
            Notificações
          </TabsTrigger>
          <TabsTrigger value="aparencia" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Palette className="w-4 h-4 mr-2" />
            Aparência
          </TabsTrigger>
          <TabsTrigger value="seguranca" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Lock className="w-4 h-4 mr-2" />
            Segurança
          </TabsTrigger>
        </TabsList>

        {/* Tab Notificações */}
        <TabsContent value="notificacoes">
          <Card className="border-0 shadow-md">
            <CardHeader className="border-b bg-slate-50">
              <CardTitle>Preferências de Notificações</CardTitle>
              <p className="text-sm text-slate-600 mt-2">
                Configure como e quando você deseja receber notificações do sistema
              </p>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
              {/* Master Switch */}
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div>
                  <p className="font-semibold text-slate-900">Habilitar Notificações</p>
                  <p className="text-sm text-slate-600">Ativar ou desativar todas as notificações do sistema</p>
                </div>
                <Switch
                  checked={preferencesForm.preferencias_notificacoes.notificacoes_ativadas}
                  onCheckedChange={(checked) =>
                    updateNotificationPref('notificacoes_ativadas', checked)
                  }
                />
              </div>

              {!preferencesForm.preferencias_notificacoes.notificacoes_ativadas && (
                <div className="p-4 bg-amber-50 rounded-lg flex gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-amber-900 font-semibold">Atenção</p>
                    <p className="text-sm text-amber-800 mt-1">
                      Você não receberá nenhuma notificação enquanto esta opção estiver desativada.
                    </p>
                  </div>
                </div>
              )}

              {preferencesForm.preferencias_notificacoes.notificacoes_ativadas && (
                <>
                  {/* Canais de Notificação */}
                  <div>
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      <Bell className="w-5 h-5 text-blue-600" />
                      Canais de Notificação
                    </h3>
                    <div className="space-y-3 bg-slate-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-900">Sistema (In-App)</p>
                          <p className="text-sm text-slate-600">Notificações dentro do sistema</p>
                        </div>
                        <Switch
                          checked={preferencesForm.preferencias_notificacoes.canais.sistema}
                          onCheckedChange={(checked) =>
                            updateNotificationPref('canais.sistema', checked)
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-900">E-mail</p>
                          <p className="text-sm text-slate-600">Receber notificações por e-mail</p>
                        </div>
                        <Switch
                          checked={preferencesForm.preferencias_notificacoes.canais.email}
                          onCheckedChange={(checked) =>
                            updateNotificationPref('canais.email', checked)
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">Push Desktop</p>
                          <p className="text-sm text-slate-600">Notificações do navegador no desktop</p>
                          {!pushHabilitado && preferencesForm.preferencias_notificacoes.canais.push && (
                            <p className="text-xs text-orange-600 mt-1">
                              ⚠️ Permissão não concedida pelo navegador
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {!pushHabilitado && preferencesForm.preferencias_notificacoes.canais.push && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleSolicitarPush}
                              className="text-xs"
                              disabled={!preferencesForm.preferencias_notificacoes.notificacoes_ativadas}
                            >
                              Permitir
                            </Button>
                          )}
                          <Switch
                            checked={preferencesForm.preferencias_notificacoes.canais.push}
                            onCheckedChange={(checked) => {
                              if (checked && !pushHabilitado) {
                                handleSolicitarPush();
                              }
                              updateNotificationPref('canais.push', checked);
                            }}
                            disabled={!preferencesForm.preferencias_notificacoes.notificacoes_ativadas}
                          />
                        </div>
                      </div>

                      {pushHabilitado && preferencesForm.preferencias_notificacoes.canais.push && (
                        <div className="pt-2 border-t">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={testarPushNotification}
                            className="w-full"
                          >
                            <Bell className="w-4 h-4 mr-2" />
                            Testar Notificação Push
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Categorias */}
                  <div>
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      <Settings className="w-5 h-5 text-gray-600" />
                      Categorias de Notificações
                    </h3>
                    <div className="space-y-3 bg-slate-50 p-4 rounded-lg">
                      <p className="text-sm text-slate-600 mb-4">Escolha quais tipos de notificações você deseja receber</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {categorias.map(cat => (
                          <div key={cat.key} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-100 transition-colors">
                            <div className="flex items-center gap-2">
                              <cat.icon className={`w-4 h-4 ${cat.color}`} />
                              <span className="font-medium text-slate-900">{cat.label}</span>
                            </div>
                            <Switch
                              checked={preferencesForm.preferencias_notificacoes.categorias[cat.key]}
                              onCheckedChange={(checked) => updateNotificationPref(`categorias.${cat.key}`, checked)}
                              disabled={!preferencesForm.preferencias_notificacoes.notificacoes_ativadas}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Prioridades */}
                  <div>
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      Níveis de Prioridade
                    </h3>
                    <div className="space-y-3 bg-slate-50 p-4 rounded-lg">
                      <p className="text-sm text-slate-600 mb-4">Receber notificações apenas com estas prioridades</p>
                      <div className="space-y-3">
                        {prioridades.map(prio => (
                          <div key={prio.key} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-100 transition-colors">
                            <div className="flex items-center gap-2">
                              <Badge className={prio.color}>{prio.label}</Badge>
                              <span className="text-sm text-slate-600">
                                {prio.key === 'Urgente' && 'Requer ação imediata'}
                                {prio.key === 'Alta' && 'Importante, requer atenção'}
                                {prio.key === 'Normal' && 'Informações relevantes'}
                                {prio.key === 'Baixa' && 'Informações opcionais'}
                              </span>
                            </div>
                            <Switch
                              checked={preferencesForm.preferencias_notificacoes.prioridades[prio.key]}
                              onCheckedChange={(checked) => updateNotificationPref(`prioridades.${prio.key}`, checked)}
                              disabled={!preferencesForm.preferencias_notificacoes.notificacoes_ativadas}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Horário Silencioso */}
                  <div>
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-purple-600" />
                      Horário Silencioso
                    </h3>
                    <div className="space-y-3 bg-slate-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-900">Não Perturbe</p>
                          <p className="text-sm text-slate-600">Pausar notificações em horários específicos</p>
                        </div>
                        <Switch
                          checked={preferencesForm.preferencias_notificacoes.horario_silencioso.ativo}
                          onCheckedChange={(checked) => updateNotificationPref('horario_silencioso.ativo', checked)}
                          disabled={!preferencesForm.preferencias_notificacoes.notificacoes_ativadas}
                        />
                      </div>

                      {preferencesForm.preferencias_notificacoes.horario_silencioso.ativo && (
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t mt-4">
                          <div>
                            <Label htmlFor="horario_inicio">Início</Label>
                            <Input
                              id="horario_inicio"
                              type="time"
                              value={preferencesForm.preferencias_notificacoes.horario_silencioso.inicio}
                              onChange={(e) => updateNotificationPref('horario_silencioso.inicio', e.target.value)}
                            />
                          </div>
                          <div>
                            <Label htmlFor="horario_fim">Fim</Label>
                            <Input
                              id="horario_fim"
                              type="time"
                              value={preferencesForm.preferencias_notificacoes.horario_silencioso.fim}
                              onChange={(e) => updateNotificationPref('horario_silencioso.fim', e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Resumo por E-mail */}
                  <div>
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      <Mail className="w-5 h-5 text-blue-600" />
                      Resumo por E-mail
                    </h3>
                    <div className="space-y-3 bg-slate-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-900">Enviar Resumo Periódico</p>
                          <p className="text-sm text-slate-600">Receba um resumo das notificações por e-mail</p>
                        </div>
                        <Switch
                          checked={preferencesForm.preferencias_notificacoes.resumo_email.ativo}
                          onCheckedChange={(checked) => updateNotificationPref('resumo_email.ativo', checked)}
                          disabled={!preferencesForm.preferencias_notificacoes.notificacoes_ativadas}
                        />
                      </div>

                      {preferencesForm.preferencias_notificacoes.resumo_email.ativo && (
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t mt-4">
                          <div>
                            <Label htmlFor="frequencia">Frequência</Label>
                            <Select
                              value={preferencesForm.preferencias_notificacoes.resumo_email.frequencia}
                              onValueChange={(value) => updateNotificationPref('resumo_email.frequencia', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Diário">Diário</SelectItem>
                                <SelectItem value="Semanal">Semanal (Segunda-feira)</SelectItem>
                                <SelectItem value="Mensal">Mensal (Dia 1)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="horario_resumo">Horário de Envio</Label>
                            <Input
                              id="horario_resumo"
                              type="time"
                              value={preferencesForm.preferencias_notificacoes.resumo_email.horario}
                              onChange={(e) => updateNotificationPref('resumo_email.horario', e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Som de Notificação and Notificação Desktop */}
                  <div>
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      <Volume2 className="w-5 h-5 text-indigo-600" />
                      Opções Adicionais
                    </h3>
                    <div className="space-y-3 bg-slate-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-900">Som de Notificação</p>
                          <p className="text-sm text-slate-600">Reproduzir som ao receber notificação</p>
                        </div>
                        <Switch
                          checked={preferencesForm.preferencias_notificacoes.som_notificacao}
                          onCheckedChange={(checked) =>
                            updateNotificationPref('som_notificacao', checked)
                          }
                          disabled={!preferencesForm.preferencias_notificacoes.notificacoes_ativadas}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-900">Notificação Desktop</p>
                          <p className="text-sm text-slate-600">Mostrar notificações mesmo quando não estiver no sistema</p>
                        </div>
                        <Switch
                          checked={preferencesForm.preferencias_notificacoes.notificacao_desktop}
                          onCheckedChange={(checked) =>
                            updateNotificationPref('notificacao_desktop', checked)
                          }
                          disabled={!preferencesForm.preferencias_notificacoes.notificacoes_ativadas}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Aparência */}
        <TabsContent value="aparencia">
          <div className="space-y-6">
            <Card className="border-0 shadow-md">
              <CardHeader className="border-b bg-slate-50">
                <CardTitle>Preferências de Exibição</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div>
                  <Label htmlFor="tema">Tema do Sistema</Label>
                  <Select
                    value={preferencesForm.configuracoes_sistema.tema}
                    onValueChange={(value) => updateSystemPref('tema', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Claro">☀️ Claro</SelectItem>
                      <SelectItem value="Auto">🔄 Automático (Sistema)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500 mt-1">Em breve disponível</p>
                </div>

                <div>
                  <Label htmlFor="idioma">Idioma</Label>
                  <Select
                    value={preferencesForm.configuracoes_sistema.idioma}
                    onValueChange={(value) => updateSystemPref('idioma', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pt-BR">🇧🇷 Português (Brasil)</SelectItem>
                      <SelectItem value="en-US">🇺🇸 English (US)</SelectItem>
                      <SelectItem value="es-ES">🇪🇸 Español</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="formato_data">Formato de Data</Label>
                  <Select
                    value={preferencesForm.configuracoes_sistema.formato_data}
                    onValueChange={(value) => updateSystemPref('formato_data', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (Brasileiro)</SelectItem>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (Americano)</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (ISO)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="formato_moeda">Formato de Moeda</Label>
                  <Select
                    value={preferencesForm.configuracoes_sistema.formato_moeda}
                    onValueChange={(value) => updateSystemPref('formato_moeda', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BRL">R$ Real Brasileiro (BRL)</SelectItem>
                      <SelectItem value="USD">$ Dólar Americano (USD)</SelectItem>
                      <SelectItem value="EUR">€ Euro (EUR)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="timezone">Fuso Horário</Label>
                  <Select
                    value={preferencesForm.configuracoes_sistema.timezone}
                    onValueChange={(value) => updateSystemPref('timezone', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/Sao_Paulo">🇧🇷 São Paulo (GMT-3)</SelectItem>
                      <SelectItem value="America/New_York">🇺🇸 Nova York (GMT-5)</SelectItem>
                      <SelectItem value="Europe/London">🇬🇧 Londres (GMT+0)</SelectItem>
                      <SelectItem value="Asia/Tokyo">🇯🇵 Tóquio (GMT+9)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab Segurança */}
        <TabsContent value="seguranca">
          <div className="space-y-6">
            <Card className="border-0 shadow-md">
              <CardHeader className="border-b bg-slate-50">
                <CardTitle>Segurança da Conta</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-900 font-semibold mb-2">Informações da Conta</p>
                  <div className="space-y-1 text-sm text-blue-800">
                    <p><strong>E-mail:</strong> {user?.email}</p>
                    <p><strong>Função:</strong> {user?.role === 'admin' ? 'Administrador' : 'Usuário'}</p>
                    <p><strong>Conta criada em:</strong> {user?.created_date ? new Date(user.created_date).toLocaleDateString('pt-BR') : 'N/A'}</p>
                  </div>
                </div>

                <div className="pt-4">
                  <Button variant="outline" className="w-full" disabled>
                    <Lock className="w-4 h-4 mr-2" />
                    Alterar Senha
                  </Button>
                  <p className="text-xs text-slate-500 mt-2 text-center">
                    Entre em contato com o administrador do sistema
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardHeader className="border-b bg-slate-50">
                <CardTitle>Sessões Ativas</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900">Sessão Atual</p>
                      <p className="text-sm text-slate-600">Navegador Web</p>
                    </div>
                    <Badge className="bg-green-100 text-green-700">Ativa</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Botão de Salvar Fixo */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button 
          onClick={handleSave} 
          disabled={updateUserMutation.isPending}
          size="lg"
          className={`shadow-lg ${saveSuccess ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {saveSuccess ? (
            <>
              <CheckCircle className="w-5 h-5 mr-2" />
              Salvo!
            </>
          ) : (
            <>
              <Save className="w-5 h-5 mr-2" />
              {updateUserMutation.isPending ? 'Salvando...' : 'Salvar Configurações'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
