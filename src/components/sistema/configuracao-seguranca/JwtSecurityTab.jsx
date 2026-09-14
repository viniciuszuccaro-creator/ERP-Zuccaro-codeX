import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { TabsContent } from '@/components/ui/tabs';
import { Key } from 'lucide-react';

/**
 * @typedef {ReturnType<typeof import('./configuracaoSegurancaPolicy').normalizeSecurityConfig>} SecurityConfig
 * @typedef {{
 *   formData: SecurityConfig,
 *   setFormData: import('react').Dispatch<import('react').SetStateAction<SecurityConfig>>,
 *   controlesDesabilitados: boolean,
 * }} SecurityTabProps
 */

/** @param {SecurityTabProps} props */
export default function JwtSecurityTab({ formData, setFormData, controlesDesabilitados }) {
  return (
  <TabsContent value="jwt" className="space-y-6 mt-6">
  <Card>
  <CardHeader>
  <CardTitle className="text-base flex items-center gap-2">
  <Key className="w-5 h-5 text-blue-600" />
  Configurações JWT
  </CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
  <div className="flex items-center justify-between">
  <div>
  <Label className="text-base">JWT Ativo</Label>
  <p className="text-sm text-slate-600">Usar JWT para autenticação</p>
  </div>
  <Switch
  data-action="Seguranca.jwt.ativo"
  checked={formData.jwt_ativo}
  disabled={controlesDesabilitados}
  onCheckedChange={(checked) => setFormData({...formData, jwt_ativo: checked})}
  />
  </div>

  {formData.jwt_ativo && (
  <>
  <div className="grid grid-cols-2 gap-4">
  <div>
  <Label>Algoritmo</Label>
  <Select
  value={formData.jwt_algoritmo}
  disabled={controlesDesabilitados}
  onValueChange={(value) => setFormData({...formData, jwt_algoritmo: value})}
  >
  <SelectTrigger data-action="Seguranca.jwt.algoritmo">
  <SelectValue />
  </SelectTrigger>
  <SelectContent>
  <SelectItem value="HS256">HS256 (HMAC SHA-256)</SelectItem>
  <SelectItem value="HS384">HS384 (HMAC SHA-384)</SelectItem>
  <SelectItem value="HS512">HS512 (HMAC SHA-512)</SelectItem>
  <SelectItem value="RS256">RS256 (RSA SHA-256)</SelectItem>
  </SelectContent>
  </Select>
  </div>

  <div>
  <Label>Validade Access Token (min)</Label>
  <Input
  type="number"
  min="5"
  max="120"
  value={formData.jwt_validade_access_minutos}
  disabled={controlesDesabilitados}
  onChange={(e) => setFormData({...formData, jwt_validade_access_minutos: Number.isNaN(parseInt(e.target.value, 10)) ? 15 : parseInt(e.target.value, 10)})}
  />
  <p className="text-xs text-slate-500 mt-1">
  Recomendado: 15-30 minutos
  </p>
  </div>

  <div>
  <Label>Validade Refresh Token (dias)</Label>
  <Input
  type="number"
  min="1"
  max="90"
  value={formData.jwt_validade_refresh_dias}
  disabled={controlesDesabilitados}
  onChange={(e) => setFormData({...formData, jwt_validade_refresh_dias: Number.isNaN(parseInt(e.target.value, 10)) ? 30 : parseInt(e.target.value, 10)})}
  />
  <p className="text-xs text-slate-500 mt-1">
  Recomendado: 7-30 dias
  </p>
  </div>
  </div>

  <div className="border-t pt-4 space-y-3">
  <div className="flex items-center justify-between">
  <div>
  <Label>Rotação de Refresh Tokens</Label>
  <p className="text-sm text-slate-600">Gera novo token a cada uso (segurança)</p>
  </div>
  <Switch
  data-action="Seguranca.jwt.rotacaoRefresh"
  checked={formData.jwt_rotacao_refresh}
  disabled={controlesDesabilitados}
  onCheckedChange={(checked) => setFormData({...formData, jwt_rotacao_refresh: checked})}
  />
  </div>

  <div className="flex items-center justify-between">
  <div>
  <Label>Família de Tokens</Label>
  <p className="text-sm text-slate-600">Detecta roubo de tokens</p>
  </div>
  <Switch
  data-action="Seguranca.jwt.familiaTokens"
  checked={formData.jwt_familia_tokens}
  disabled={controlesDesabilitados}
  onCheckedChange={(checked) => setFormData({...formData, jwt_familia_tokens: checked})}
  />
  </div>

  {formData.jwt_familia_tokens && (
  <div className="flex items-center justify-between">
  <div>
  <Label>Revogar Família em Suspeita</Label>
  <p className="text-sm text-slate-600">Revoga todos tokens se detectar uso duplo</p>
  </div>
  <Switch
  data-action="Seguranca.jwt.revogarFamiliaSuspeita"
  checked={formData.jwt_revogar_familia_em_suspeita}
  disabled={controlesDesabilitados}
  onCheckedChange={(checked) => setFormData({...formData, jwt_revogar_familia_em_suspeita: checked})}
  />
  </div>
  )}
  </div>
  </>
  )}
  </CardContent>
  </Card>
  </TabsContent>
  );
}
