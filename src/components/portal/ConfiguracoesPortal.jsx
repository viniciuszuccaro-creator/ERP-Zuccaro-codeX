import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Settings, Bell, Mail, MessageCircle, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

/**
 * V21.5 - Configurações do Portal
 * ✅ Preferências de notificação
 * ✅ Canal preferencial
 * ✅ Dados do perfil
 * ✅ LGPD e privacidade
 */
export default function ConfiguracoesPortal() {
  const queryClient = useQueryClient();
  const [salvando, setSalvando] = useState(false);
  const [config, setConfig] = useState({
    notif_pedidos: true,
    notif_entregas: true,
    notif_boletos: true,
    notif_orcamentos: true,
    canal_preferencial: 'E-mail',
    email_marketing: false,
    whatsapp_marketing: false,
  });

  const { data: user, isLoading: loadingUser, isFetched: userFetched } = useQuery({
    queryKey: ['portal-user-config'],
    queryFn: () => base44.auth.me(),
  });

  const { data: cliente, isLoading: loadingCliente, isFetched: clienteFetched } = useQuery({
    queryKey: ['cliente-config', user?.id],
    queryFn: async () => {
      const clientes = await base44.entities.Cliente.filter({ portal_usuario_id: user.id });
      return clientes[0] || null;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!cliente) return;
    const prefs = cliente.portal_preferencias || {};
    const lgpd = cliente.lgpd_autorizacoes || {};
    setConfig({
      notif_pedidos: prefs.notif_pedidos !== false,
      notif_entregas: prefs.notif_entregas !== false,
      notif_boletos: prefs.notif_boletos !== false,
      notif_orcamentos: prefs.notif_orcamentos !== false,
      canal_preferencial: cliente.canal_preferencial || prefs.canal_preferencial || 'E-mail',
      email_marketing: Boolean(lgpd.autoriza_email_marketing),
      whatsapp_marketing: Boolean(lgpd.autoriza_whatsapp_marketing),
    });
  }, [cliente?.id, cliente?.updated_date]);

  const salvarMutation = useMutation({
    mutationFn: async (dados) => {
      if (!cliente?.id) throw new Error('Cliente não encontrado');

      await base44.entities.Cliente.update(cliente.id, {
        canal_preferencial: dados.canal_preferencial,
        portal_preferencias: {
          notif_pedidos: dados.notif_pedidos,
          notif_entregas: dados.notif_entregas,
          notif_boletos: dados.notif_boletos,
          notif_orcamentos: dados.notif_orcamentos,
          canal_preferencial: dados.canal_preferencial,
        },
        lgpd_autorizacoes: {
          ...(cliente.lgpd_autorizacoes || {}),
          autoriza_email_marketing: dados.email_marketing,
          autoriza_whatsapp_marketing: dados.whatsapp_marketing,
        },
      });

      await base44.entities.AuditLog.create({
        acao: 'Portal.configurar',
        modulo: 'Portal',
        entidade: 'Cliente',
        registro_id: cliente.id,
        usuario_id: user?.id || null,
        group_id: cliente.group_id || null,
        empresa_id: cliente.empresa_id || null,
        resultado: 'sucesso',
        detalhes: {
          canal_preferencial: dados.canal_preferencial,
          notif_pedidos: dados.notif_pedidos,
          notif_entregas: dados.notif_entregas,
          notif_boletos: dados.notif_boletos,
          notif_orcamentos: dados.notif_orcamentos,
        },
        data_hora: new Date().toISOString(),
      });

      return dados;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliente-config'] });
      toast.success('✅ Configurações salvas com sucesso!');
      setSalvando(false);
    },
    onError: (error) => {
      toast.error(error?.message || 'Erro ao salvar configurações');
      setSalvando(false);
    },
  });

  const handleSalvar = () => {
    setSalvando(true);
    salvarMutation.mutate(config);
  };

  if (loadingUser || (user?.id && loadingCliente)) {
    return <div className="p-6" data-portal-state="carregando">Carregando configurações...</div>;
  }

  if (userFetched && (!user || (clienteFetched && !cliente))) {
    return (
      <div className="p-6" data-portal-state="sem_vinculo">
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-6 flex items-start gap-3 text-amber-950">
            <AlertCircle className="w-5 h-5 mt-0.5" />
            <div>
              <p className="font-semibold">Sem vínculo</p>
              <p className="text-sm">Seu usuário não está vinculado a um cliente do portal.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full h-full max-w-4xl mx-auto">
      <Card className="shadow-lg w-full">
        <CardHeader className="border-b bg-slate-50">
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            Configurações do Portal
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6 w-full">
          <div>
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5 text-purple-600" />
              Preferências de Notificação
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <Label className="font-medium">Notificações de Pedidos</Label>
                  <p className="text-sm text-slate-600">Receba atualizações sobre seus pedidos</p>
                </div>
                <Switch
                  checked={config.notif_pedidos}
                  onCheckedChange={(checked) => setConfig({ ...config, notif_pedidos: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <Label className="font-medium">Notificações de Entregas</Label>
                  <p className="text-sm text-slate-600">Rastreamento em tempo real</p>
                </div>
                <Switch
                  checked={config.notif_entregas}
                  onCheckedChange={(checked) => setConfig({ ...config, notif_entregas: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <Label className="font-medium">Notificações de Boletos</Label>
                  <p className="text-sm text-slate-600">Avisos de vencimento</p>
                </div>
                <Switch
                  checked={config.notif_boletos}
                  onCheckedChange={(checked) => setConfig({ ...config, notif_boletos: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <Label className="font-medium">Notificações de Orçamentos</Label>
                  <p className="text-sm text-slate-600">Novos orçamentos disponíveis</p>
                </div>
                <Switch
                  checked={config.notif_orcamentos}
                  onCheckedChange={(checked) => setConfig({ ...config, notif_orcamentos: checked })}
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-blue-600" />
              Canal de Comunicação Preferencial
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {['E-mail', 'WhatsApp', 'Portal'].map((canal) => (
                <button
                  key={canal}
                  type="button"
                  onClick={() => setConfig({ ...config, canal_preferencial: canal })}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    config.canal_preferencial === canal
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="text-center">
                    {canal === 'E-mail' && <Mail className="w-6 h-6 mx-auto mb-2 text-blue-600" />}
                    {canal === 'WhatsApp' && <MessageCircle className="w-6 h-6 mx-auto mb-2 text-green-600" />}
                    {canal === 'Portal' && <Bell className="w-6 h-6 mx-auto mb-2 text-purple-600" />}
                    <p className="font-medium text-sm">{canal}</p>
                    {config.canal_preferencial === canal && (
                      <CheckCircle2 className="w-4 h-4 mx-auto mt-2 text-blue-600" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-4">Privacidade e Consentimentos (LGPD)</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                <div>
                  <Label className="font-medium">Receber E-mails Promocionais</Label>
                  <p className="text-sm text-slate-600">Ofertas e novidades por e-mail</p>
                </div>
                <Switch
                  checked={config.email_marketing}
                  onCheckedChange={(checked) => setConfig({ ...config, email_marketing: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                <div>
                  <Label className="font-medium">Receber WhatsApp Marketing</Label>
                  <p className="text-sm text-slate-600">Promoções via WhatsApp</p>
                </div>
                <Switch
                  checked={config.whatsapp_marketing}
                  onCheckedChange={(checked) => setConfig({ ...config, whatsapp_marketing: checked })}
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-4">Meus Dados</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-slate-600">Nome</Label>
                <Input value={user?.full_name || ''} disabled className="bg-slate-50" />
              </div>
              <div>
                <Label className="text-sm text-slate-600">E-mail</Label>
                <Input value={user?.email || ''} disabled className="bg-slate-50" />
              </div>
              <div>
                <Label className="text-sm text-slate-600">Empresa</Label>
                <Input value={cliente?.nome || cliente?.razao_social || ''} disabled className="bg-slate-50" />
              </div>
              <div>
                <Label className="text-sm text-slate-600">CNPJ/CPF</Label>
                <Input value={cliente?.cnpj || cliente?.cpf || ''} disabled className="bg-slate-50" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3">
              Para atualizar seus dados, entre em contato com seu vendedor
            </p>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={handleSalvar}
              disabled={salvando || !cliente?.id}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              {salvando ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Configurações
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
