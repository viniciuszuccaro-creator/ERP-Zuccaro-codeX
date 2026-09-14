import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { TabsContent } from '@/components/ui/tabs';
import { Smartphone } from 'lucide-react';

/**
 * @typedef {ReturnType<typeof import('./configuracaoSegurancaPolicy').normalizeSecurityConfig>} SecurityConfig
 * @typedef {{
 *   formData: SecurityConfig,
 *   setFormData: import('react').Dispatch<import('react').SetStateAction<SecurityConfig>>,
 *   controlesDesabilitados: boolean,
 * }} SecurityTabProps
 */

/** @param {SecurityTabProps} props */
export default function MfaSecurityTab({ formData, setFormData, controlesDesabilitados }) {
  return (
  <TabsContent value="mfa" className="space-y-6 mt-6">
  <Card>
  <CardHeader>
  <CardTitle className="text-base flex items-center gap-2">
  <Smartphone className="w-5 h-5 text-green-600" />
  Autenticação de Dois Fatores (MFA)
  </CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
  <div className="flex items-center justify-between">
  <div>
  <Label className="text-base">Exigir MFA</Label>
  <p className="text-sm text-slate-600">Obrigar autenticação de dois fatores</p>
  </div>
  <Switch
  data-action="Seguranca.mfa.exigir"
  checked={formData.exigir_mfa}
  disabled={controlesDesabilitados}
  onCheckedChange={(checked) => setFormData({...formData, exigir_mfa: checked})}
  />
  </div>

  {formData.exigir_mfa && (
  <>
  <div>
  <Label className="mb-2 block">Métodos Disponíveis</Label>
  <div className="space-y-2">
  {['Email', 'WhatsApp', 'SMS', 'Authenticator'].map((metodo) => (
  <div key={metodo} className="flex items-center gap-2">
  <Checkbox
  data-action={`Seguranca.MFA.metodo.${metodo}`}
  checked={(formData.mfa_metodos_disponiveis || []).includes(metodo)}
  disabled={controlesDesabilitados}
  onCheckedChange={(checked) => {
  const metodos = formData.mfa_metodos_disponiveis || [];
  if (checked) {
  setFormData({
  ...formData,
  mfa_metodos_disponiveis: [...metodos, metodo]
  });
  } else {
  setFormData({
  ...formData,
  mfa_metodos_disponiveis: metodos.filter(m => m !== metodo)
  });
  }
  }}
  />
  <Label className="font-normal cursor-pointer">{metodo}</Label>
  </div>
  ))}
  </div>
  </div>

  <div>
  <Label>Validade do Código MFA (min)</Label>
  <Input
  type="number"
  min="1"
  max="30"
  value={formData.mfa_validade_codigo_minutos}
  disabled={controlesDesabilitados}
  onChange={(e) => setFormData({...formData, mfa_validade_codigo_minutos: Number.isNaN(parseInt(e.target.value, 10)) ? 5 : parseInt(e.target.value, 10)})}
  />
  </div>

  <div className="border-t pt-4 space-y-3">
  <p className="text-sm font-semibold text-slate-700">Exigir MFA em:</p>

  <div className="flex items-center justify-between">
  <Label className="font-normal">Novo IP Address</Label>
  <Switch
  data-action="Seguranca.mfa.novoIp"
  checked={formData.mfa_exigir_novo_ip}
  disabled={controlesDesabilitados}
  onCheckedChange={(checked) => setFormData({...formData, mfa_exigir_novo_ip: checked})}
  />
  </div>

  <div className="flex items-center justify-between">
  <Label className="font-normal">Novo Dispositivo</Label>
  <Switch
  data-action="Seguranca.mfa.novoDispositivo"
  checked={formData.mfa_exigir_novo_dispositivo}
  disabled={controlesDesabilitados}
  onCheckedChange={(checked) => setFormData({...formData, mfa_exigir_novo_dispositivo: checked})}
  />
  </div>

  <div className="flex items-center justify-between">
  <Label className="font-normal">Horário Incomum</Label>
  <Switch
  data-action="Seguranca.mfa.horarioIncomum"
  checked={formData.mfa_exigir_horario_incomum}
  disabled={controlesDesabilitados}
  onCheckedChange={(checked) => setFormData({...formData, mfa_exigir_horario_incomum: checked})}
  />
  </div>
  </div>
  </>
  )}
  </CardContent>
  </Card>
  </TabsContent>
  );
}
