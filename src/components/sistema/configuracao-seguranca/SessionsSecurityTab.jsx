import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { TabsContent } from '@/components/ui/tabs';
import { Clock } from 'lucide-react';

/**
 * @typedef {ReturnType<typeof import('./configuracaoSegurancaPolicy').normalizeSecurityConfig>} SecurityConfig
 * @typedef {{
 *   formData: SecurityConfig,
 *   setFormData: import('react').Dispatch<import('react').SetStateAction<SecurityConfig>>,
 *   controlesDesabilitados: boolean,
 * }} SecurityTabProps
 */

/** @param {SecurityTabProps} props */
export default function SessionsSecurityTab({ formData, setFormData, controlesDesabilitados }) {
  return (
  <TabsContent value="sessoes" className="space-y-6 mt-6">
  <Card>
  <CardHeader>
  <CardTitle className="text-base flex items-center gap-2">
  <Clock className="w-5 h-5 text-purple-600" />
  Controle de Sessões
  </CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
  <div className="flex items-center justify-between">
  <div>
  <Label className="text-base">Sessão Única</Label>
  <p className="text-sm text-slate-600">Permite apenas 1 dispositivo conectado</p>
  </div>
  <Switch
  data-action="Seguranca.sessoes.sessaoUnica"
  checked={formData.sessao_unica}
  disabled={controlesDesabilitados}
  onCheckedChange={(checked) => setFormData({...formData, sessao_unica: checked})}
  />
  </div>

  {!formData.sessao_unica && (
  <div>
  <Label>Sessões Simultâneas Máximas</Label>
  <Input
  type="number"
  min="1"
  max="10"
  value={formData.sessoes_simultaneas_max}
  disabled={controlesDesabilitados}
  onChange={(e) => setFormData({...formData, sessoes_simultaneas_max: Number.isNaN(parseInt(e.target.value, 10)) ? 3 : parseInt(e.target.value, 10)})}
  />
  <p className="text-xs text-slate-500 mt-1">
  Quantidade máxima de dispositivos conectados simultaneamente
  </p>
  </div>
  )}

  <div className="grid grid-cols-2 gap-4">
  <div>
  <Label>Timeout Inatividade (min)</Label>
  <Input
  type="number"
  min="5"
  max="480"
  value={formData.timeout_inatividade_minutos}
  disabled={controlesDesabilitados}
  onChange={(e) => setFormData({...formData, timeout_inatividade_minutos: Number.isNaN(parseInt(e.target.value, 10)) ? 60 : parseInt(e.target.value, 10)})}
  />
  <p className="text-xs text-slate-500 mt-1">
  Desconecta após este tempo sem atividade
  </p>
  </div>

  <div>
  <Label>Timeout Absoluto (horas)</Label>
  <Input
  type="number"
  min="1"
  max="168"
  value={formData.timeout_absoluto_horas}
  disabled={controlesDesabilitados}
  onChange={(e) => setFormData({...formData, timeout_absoluto_horas: Number.isNaN(parseInt(e.target.value, 10)) ? 24 : parseInt(e.target.value, 10)})}
  />
  <p className="text-xs text-slate-500 mt-1">
  Tempo máximo de uma sessão
  </p>
  </div>
  </div>

  <div className="flex items-center justify-between">
  <div>
  <Label>Encerrar Sessões Antigas Automaticamente</Label>
  <p className="text-sm text-slate-600">Ao atingir o limite, encerra as mais antigas</p>
  </div>
  <Switch
  data-action="Seguranca.sessoes.encerrarAntigasAuto"
  checked={formData.encerrar_sessoes_antigas_auto}
  disabled={controlesDesabilitados}
  onCheckedChange={(checked) => setFormData({...formData, encerrar_sessoes_antigas_auto: checked})}
  />
  </div>
  </CardContent>
  </Card>
  </TabsContent>
  );
}
