import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { TabsContent } from '@/components/ui/tabs';
import { Lock, AlertTriangle, CheckCircle2 } from 'lucide-react';

/**
 * @typedef {ReturnType<typeof import('./configuracaoSegurancaPolicy').normalizeSecurityConfig>} SecurityConfig
 * @typedef {{
 *   formData: SecurityConfig,
 *   setFormData: import('react').Dispatch<import('react').SetStateAction<SecurityConfig>>,
 *   controlesDesabilitados: boolean,
 * }} SecurityTabProps
 */

/** @param {SecurityTabProps} props */
export default function PasswordSecurityTab({ formData, setFormData, controlesDesabilitados }) {
  return (
  <TabsContent value="senhas" className="space-y-6 mt-6">
  <Card>
  <CardHeader>
  <CardTitle className="text-base flex items-center gap-2">
  <Lock className="w-5 h-5 text-orange-600" />
  Política de Senhas
  </CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
  <div className="grid grid-cols-2 gap-4">
  <div>
  <Label>Tamanho Mínimo</Label>
  <Input
  type="number"
  min="4"
  max="32"
  value={formData.politica_senha?.tamanho_minimo || 8}
  disabled={controlesDesabilitados}
  onChange={(e) => setFormData({
  ...formData,
politica_senha: {...formData.politica_senha, tamanho_minimo: Number.isNaN(parseInt(e.target.value, 10)) ? 8 : parseInt(e.target.value, 10)}
  })}
  />
  </div>

  <div>
  <Label>Trocar Senha a Cada (dias)</Label>
  <Input
  type="number"
  min="0"
  max="365"
  value={formData.politica_senha?.trocar_senha_dias || 90}
  disabled={controlesDesabilitados}
  onChange={(e) => setFormData({
  ...formData,
politica_senha: {...formData.politica_senha, trocar_senha_dias: Number.isNaN(parseInt(e.target.value, 10)) ? 90 : parseInt(e.target.value, 10)}
  })}
  />
  <p className="text-xs text-slate-500 mt-1">
  0 = nunca expira
  </p>
  </div>
  </div>

  <div className="border-t pt-4 space-y-3">
  <p className="text-sm font-semibold text-slate-700">Requisitos:</p>

  <div className="flex items-center justify-between">
  <Label className="font-normal">Exigir Maiúsculas</Label>
  <Switch
  data-action="Seguranca.senha.exigirMaiusculas"
  checked={formData.politica_senha?.exigir_maiusculas}
  disabled={controlesDesabilitados}
  onCheckedChange={(checked) => setFormData({
  ...formData,
politica_senha: {...formData.politica_senha, exigir_maiusculas: checked}
  })}
  />
  </div>

  <div className="flex items-center justify-between">
  <Label className="font-normal">Exigir Minúsculas</Label>
  <Switch
  data-action="Seguranca.senha.exigirMinusculas"
  checked={formData.politica_senha?.exigir_minusculas}
  disabled={controlesDesabilitados}
  onCheckedChange={(checked) => setFormData({
  ...formData,
politica_senha: {...formData.politica_senha, exigir_minusculas: checked}
  })}
  />
  </div>

  <div className="flex items-center justify-between">
  <Label className="font-normal">Exigir Números</Label>
  <Switch
  data-action="Seguranca.senha.exigirNumeros"
  checked={formData.politica_senha?.exigir_numeros}
  disabled={controlesDesabilitados}
  onCheckedChange={(checked) => setFormData({
  ...formData,
politica_senha: {...formData.politica_senha, exigir_numeros: checked}
  })}
  />
  </div>

  <div className="flex items-center justify-between">
  <Label className="font-normal">Exigir Caracteres Especiais</Label>
  <Switch
  data-action="Seguranca.senha.exigirEspeciais"
  checked={formData.politica_senha?.exigir_especiais}
  disabled={controlesDesabilitados}
  onCheckedChange={(checked) => setFormData({
  ...formData,
politica_senha: {...formData.politica_senha, exigir_especiais: checked}
  })}
  />
  </div>
  </div>

  <div className="border-t pt-4">
  <Label>Histórico de Senhas</Label>
  <Input
  type="number"
  min="0"
  max="10"
  value={formData.politica_senha?.historico_senhas || 3}
  disabled={controlesDesabilitados}
  onChange={(e) => setFormData({
  ...formData,
politica_senha: {...formData.politica_senha, historico_senhas: Number.isNaN(parseInt(e.target.value, 10)) ? 3 : parseInt(e.target.value, 10)}
  })}
  />
  <p className="text-xs text-slate-500 mt-1">
  Impede reusar as últimas N senhas
  </p>
  </div>
  </CardContent>
  </Card>

  {/* Tentativas de Login */}
  <Card>
  <CardHeader>
  <CardTitle className="text-base flex items-center gap-2">
  <AlertTriangle className="w-5 h-5 text-red-600" />
  Proteção contra Brute Force
  </CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
  <div className="grid grid-cols-2 gap-4">
  <div>
  <Label>Tentativas Máximas</Label>
  <Input
  type="number"
  min="3"
  max="10"
  value={formData.tentativas_login_max}
  disabled={controlesDesabilitados}
  onChange={(e) => setFormData({...formData, tentativas_login_max: Number.isNaN(parseInt(e.target.value, 10)) ? 5 : parseInt(e.target.value, 10)})}
  />
  </div>

  <div>
  <Label>Tempo de Bloqueio (min)</Label>
  <Input
  type="number"
  min="5"
  max="1440"
  value={formData.bloqueio_tempo_minutos}
  disabled={controlesDesabilitados}
  onChange={(e) => setFormData({...formData, bloqueio_tempo_minutos: Number.isNaN(parseInt(e.target.value, 10)) ? 30 : parseInt(e.target.value, 10)})}
  />
  </div>
  </div>

  <div className="flex items-center justify-between">
  <div>
  <Label>Bloquear IPs Suspeitos</Label>
  <p className="text-sm text-slate-600">Bloqueia IPs com muitas tentativas falhas</p>
  </div>
  <Switch
  data-action="Seguranca.bruteforce.bloquearIpSuspeito"
  checked={formData.bloqueio_ip_suspeito}
  disabled={controlesDesabilitados}
  onCheckedChange={(checked) => setFormData({...formData, bloqueio_ip_suspeito: checked})}
  />
  </div>
  </CardContent>
  </Card>

  <Card>
  <CardHeader>
  <CardTitle className="text-base flex items-center gap-2">
  <CheckCircle2 className="w-5 h-5 text-blue-600" />
  Protecao Adaptativa
  </CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
  <div className="flex items-center justify-between">
  <div>
  <Label>IA para Detectar Anomalias</Label>
  <p className="text-sm text-slate-600">Ativa leitura inteligente de comportamento suspeito</p>
  </div>
  <Switch
  data-action="Seguranca.adaptativa.detectarAnomalias"
  checked={formData.detectar_anomalias_ia}
  disabled={controlesDesabilitados}
  onCheckedChange={(checked) => setFormData({...formData, detectar_anomalias_ia: checked})}
  />
  </div>

  <div className="flex items-center justify-between">
  <div>
  <Label>Registrar Dispositivos</Label>
  <p className="text-sm text-slate-600">Mantem historico local dos dispositivos autorizados</p>
  </div>
  <Switch
  data-action="Seguranca.adaptativa.registrarDispositivos"
  checked={formData.registrar_dispositivos}
  disabled={controlesDesabilitados}
  onCheckedChange={(checked) => setFormData({...formData, registrar_dispositivos: checked})}
  />
  </div>

  <div className="flex items-center justify-between">
  <div>
  <Label>Notificar Novo Dispositivo</Label>
  <p className="text-sm text-slate-600">Gera alerta quando houver login em dispositivo novo</p>
  </div>
  <Switch
  data-action="Seguranca.adaptativa.notificarDispositivo"
  checked={formData.notificar_novo_dispositivo}
  disabled={controlesDesabilitados}
  onCheckedChange={(checked) => setFormData({...formData, notificar_novo_dispositivo: checked})}
  />
  </div>

  <div className="flex items-center justify-between">
  <div>
  <Label>Notificar Novo IP</Label>
  <p className="text-sm text-slate-600">Gera alerta quando o acesso vier de IP desconhecido</p>
  </div>
  <Switch
  data-action="Seguranca.adaptativa.notificarIp"
  checked={formData.notificar_novo_ip}
  disabled={controlesDesabilitados}
  onCheckedChange={(checked) => setFormData({...formData, notificar_novo_ip: checked})}
  />
  </div>
  </CardContent>
  </Card>
  </TabsContent>
  );
}
