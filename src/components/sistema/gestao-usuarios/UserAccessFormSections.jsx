import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { UserPlus, Building2, Shield, Key, CheckCircle, Fingerprint, Settings, Eye } from 'lucide-react';
import { PAPEIS_PILOTO } from '@/components/lib/pilotoOperacaoPolicy';
import { sanitizeCurrencyLimit, sanitizePhone, sanitizeText } from './gestaoUsuarioPolicy';

/**
 * @typedef {ReturnType<typeof import('./gestaoUsuarioPolicy').createInitialUserAccessForm>} UserAccessFormData
 * @typedef {Record<string, unknown> & { id: string, full_name?: string, email?: string, role?: string }} UserRecord
 * @typedef {Record<string, unknown> & { id: string, ativo?: boolean, nome_perfil?: string, nivel_perfil?: string }} ProfileRecord
 * @typedef {Record<string, unknown> & { id: string, nome_fantasia?: string, razao_social?: string, cidade?: string, estado?: string }} CompanyRecord
 * @typedef {{
 *   usuario?: UserRecord | null,
 *   formData: UserAccessFormData,
 *   setFormData: import('react').Dispatch<import('react').SetStateAction<UserAccessFormData>>,
 *   controlesDesabilitados: boolean,
 *   perfis: ProfileRecord[],
 *   empresas: CompanyRecord[],
 *   toggleEmpresa: (empresaId: string) => void,
 *   setRestricaoLista: (campo: 'departamentos_permitidos' | 'centros_custo_permitidos', valor: string) => void,
 *   onClose?: () => void,
 *   isPending: boolean,
 * }} UserAccessFormSectionsProps
 */

/** @param {UserAccessFormSectionsProps} props */
export default function UserAccessFormSections({ usuario, formData, setFormData, controlesDesabilitados, perfis, empresas, toggleEmpresa, setRestricaoLista, onClose, isPending }) {
  return (
    <>
      {/* Dados do Usuário */}
      <Card>
      <CardHeader className="bg-slate-50 border-b">
      <CardTitle className="text-base flex items-center gap-2">
      <UserPlus className="w-4 h-4 text-blue-600" />
      Informações do Usuário
      </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
      <div>
      <p className="font-semibold text-lg">{usuario?.full_name}</p>
      <p className="text-sm text-slate-500">{usuario?.email}</p>
      <Badge className={usuario?.role === 'admin' ? 'bg-purple-600 mt-2' : 'bg-slate-600 mt-2'}>
      {usuario?.role}
      </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
      <Label>Cargo</Label>
      <Input
      value={formData.cargo}
      disabled={controlesDesabilitados}
      onChange={(e) => setFormData({ ...formData, cargo: sanitizeText(e.target.value, 120) })}
      placeholder="Ex: Vendedor"
      className="mt-1"
      data-permission="Sistema.Controle de Acesso.editar"
      data-action="RBAC.Usuario.cargo"
      />
      </div>
      <div>
      <Label>Departamento</Label>
      <Input
      value={formData.departamento}
      disabled={controlesDesabilitados}
      onChange={(e) => setFormData({ ...formData, departamento: sanitizeText(e.target.value, 120) })}
      placeholder="Ex: Comercial"
      className="mt-1"
      data-permission="Sistema.Controle de Acesso.editar"
      data-action="RBAC.Usuario.departamento"
      />
      </div>
      <div>
      <Label>Telefone</Label>
      <Input
      value={formData.telefone}
      disabled={controlesDesabilitados}
      onChange={(e) => setFormData({ ...formData, telefone: sanitizePhone(e.target.value) })}
      placeholder="(00) 00000-0000"
      className="mt-1"
      data-permission="Sistema.Controle de Acesso.editar"
      data-action="RBAC.Usuario.telefone"
      />
      </div>
      <div className="flex items-center gap-2 mt-6">
      <Switch
      checked={formData.autenticacao_dois_fatores}
      disabled={controlesDesabilitados}
      onCheckedChange={(v) => setFormData({ ...formData, autenticacao_dois_fatores: v })}
      data-permission="Sistema.Controle de Acesso.editar"
      data-action="RBAC.Usuario.2fa"
      data-sensitive="true"
      />
      <Label className="cursor-pointer flex items-center gap-2">
      <Fingerprint className="w-4 h-4 text-green-600" />
      Autenticação 2FA
      </Label>
      </div>
      <div className="flex items-center gap-2 mt-6">
      <Switch
      checked={formData.usuario_piloto === true}
      disabled={controlesDesabilitados}
      onCheckedChange={(v) => setFormData({ ...formData, usuario_piloto: v, papel_piloto: v ? formData.papel_piloto : '' })}
      data-permission="Sistema.Controle de Acesso.editar"
      data-action="RBAC.Usuario.piloto"
      data-sensitive="true"
      />
      <Label className="cursor-pointer">Usuario piloto</Label>
      </div>
      <div>
      <Label>Papel no piloto</Label>
      <Select
      value={formData.papel_piloto || ''}
      disabled={controlesDesabilitados || !formData.usuario_piloto}
      onValueChange={(v) => setFormData({ ...formData, papel_piloto: v })}
      >
      <SelectTrigger className="mt-1" data-action="RBAC.Usuario.papel_piloto">
      <SelectValue placeholder="Selecione o papel" />
      </SelectTrigger>
      <SelectContent>
      {PAPEIS_PILOTO.map((papel) => (
      <SelectItem key={papel} value={papel}>{papel}</SelectItem>
      ))}
      </SelectContent>
      </Select>
      </div>
      </div>
      </CardContent>
      </Card>

      {/* Perfil de Acesso */}
      <Card>
      <CardHeader className="bg-blue-50 border-b">
      <CardTitle className="text-base flex items-center gap-2">
      <Shield className="w-4 h-4 text-blue-600" />
      Perfil de Acesso
      </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
      <Label>Perfil de Acesso *</Label>
      <Select
      value={formData.perfil_acesso_id}
      disabled={controlesDesabilitados}
      onValueChange={(v) => setFormData({ ...formData, perfil_acesso_id: v })}
      >
      <SelectTrigger className="mt-1" data-permission="Sistema.Controle de Acesso.editar" data-action="RBAC.Usuario.perfil" data-sensitive="true">
      <SelectValue placeholder="Selecionar perfil" />
      </SelectTrigger>
      <SelectContent>
      <SelectItem value="sem-perfil">Sem perfil</SelectItem>
      {perfis.filter(p => p.ativo !== false).map(p => (
      <SelectItem key={p.id} value={p.id}>
      <div className="flex items-center gap-2">
      <span>{p.nome_perfil}</span>
      <Badge variant="outline" className="text-xs">
      {p.nivel_perfil}
      </Badge>
      </div>
      </SelectItem>
      ))}
      </SelectContent>
      </Select>
      </CardContent>
      </Card>

      {/* Escopo de Liberacao */}
      <Card>
      <CardHeader className="bg-slate-50 border-b">
      <CardTitle className="text-base flex items-center gap-2">
      <Key className="w-4 h-4 text-slate-600" />
      Escopo de Liberacao
      </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
      <div>
      <Label>Tipo de acesso</Label>
      <Select
      value={formData.nivel_acesso_contexto}
      disabled={controlesDesabilitados}
      onValueChange={(v) => setFormData({ ...formData, nivel_acesso_contexto: v })}
      >
      <SelectTrigger className="mt-1" data-permission="Sistema.Controle de Acesso.editar" data-action="RBAC.Usuario.escopoAcesso" data-context-required="group-or-company" data-sensitive="true">
      <SelectValue />
      </SelectTrigger>
      <SelectContent>
      <SelectItem value="grupo">Somente Grupo</SelectItem>
      <SelectItem value="empresa">Somente Empresas</SelectItem>
      <SelectItem value="grupo_empresa">Grupo e Empresas</SelectItem>
      <SelectItem value="setores">Empresas e Setores</SelectItem>
      </SelectContent>
      </Select>
      </div>
      <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
      Esta liberacao grava o escopo no usuario e limita empresas/setores ao grupo ou empresa atual.
      </div>
      </CardContent>
      </Card>

      {/* Empresas Vinculadas */}
      <Card>
      <CardHeader className="bg-green-50 border-b">
      <CardTitle className="text-base flex items-center gap-2">
      <Building2 className="w-4 h-4 text-green-600" />
      Empresas Vinculadas ({formData.empresas_vinculadas?.length || 0})
      </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {empresas.map(empresa => {
      const vinculado = formData.empresas_vinculadas?.includes(empresa.id);

      return (
      <label
      key={empresa.id}
      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
      vinculado ? 'bg-green-50 border-green-300' : 'bg-white hover:bg-slate-50'
      }`}
      >
      <Checkbox
      checked={vinculado}
      disabled={controlesDesabilitados || formData.nivel_acesso_contexto === "grupo"}
      onCheckedChange={() => toggleEmpresa(empresa.id)}
      data-permission="Sistema.Controle de Acesso.editar"
      data-action={`RBAC.Usuario.empresa.${empresa.id}`}
      data-context-required="group-or-company"
      data-sensitive="true"
      />
      <div className="flex-1">
      <p className="font-medium text-sm">{empresa.nome_fantasia || empresa.razao_social}</p>
      {empresa.cidade && (
      <p className="text-xs text-slate-500">{empresa.cidade}/{empresa.estado}</p>
      )}
      </div>
      {vinculado && <CheckCircle className="w-5 h-5 text-green-600" />}
      </label>
      );
      })}
      </div>
      {formData.nivel_acesso_contexto === "grupo" && (
      <p className="text-xs text-slate-500 mt-3">Acesso definido como somente grupo; vinculos de empresas ficam desativados.</p>
      )}
      </CardContent>
      </Card>

      {/* Restrições Adicionais */}
      <Card>
      <CardHeader className="bg-purple-50 border-b">
      <CardTitle className="text-base flex items-center gap-2">
      <Settings className="w-4 h-4 text-purple-600" />
      Restrições Adicionais
      </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
      <div className="flex items-center justify-between">
      <Label className="flex items-center gap-2">
      <Eye className="w-4 h-4 text-slate-500" />
      Visualizar apenas próprios registros
      </Label>
      <Switch
      checked={formData.restricoes_adicionais?.pode_ver_apenas_proprios_registros}
      disabled={controlesDesabilitados}
      onCheckedChange={(v) => setFormData({
      ...formData,
      restricoes_adicionais: {
      ...formData.restricoes_adicionais,
      pode_ver_apenas_proprios_registros: v
      }
      })}
      data-permission="Sistema.Controle de Acesso.editar"
      data-action="RBAC.Usuario.restricao.proprios"
      data-sensitive="true"
      />
      </div>

      <div>
      <Label>Limite de Aprovação (R$)</Label>
      <Input
      type="number"
      value={formData.restricoes_adicionais?.limite_aprovacao_valor || 0}
      disabled={controlesDesabilitados}
      onChange={(e) => setFormData({
      ...formData,
      restricoes_adicionais: {
      ...formData.restricoes_adicionais,
      limite_aprovacao_valor: sanitizeCurrencyLimit(e.target.value)
      }
      })}
      className="mt-1"
      placeholder="0.00"
      data-permission="Sistema.Controle de Acesso.editar"
      data-action="RBAC.Usuario.limiteAprovacao"
      data-sensitive="true"
      />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
      <Label>Setores permitidos</Label>
      <Input
      value={(formData.restricoes_adicionais?.departamentos_permitidos || []).join(", ")}
      disabled={controlesDesabilitados}
      onChange={(e) => setRestricaoLista("departamentos_permitidos", e.target.value)}
      className="mt-1"
      placeholder="Comercial, Financeiro, Producao"
      data-permission="Sistema.Controle de Acesso.editar"
      data-action="RBAC.Usuario.setoresPermitidos"
      data-context-required="group-or-company"
      data-sensitive="true"
      />
      </div>
      <div>
      <Label>Centros de custo permitidos</Label>
      <Input
      value={(formData.restricoes_adicionais?.centros_custo_permitidos || []).join(", ")}
      disabled={controlesDesabilitados}
      onChange={(e) => setRestricaoLista("centros_custo_permitidos", e.target.value)}
      className="mt-1"
      placeholder="ADM, OBRA-01, COMERCIAL"
      data-permission="Sistema.Controle de Acesso.editar"
      data-action="RBAC.Usuario.centrosCustoPermitidos"
      data-context-required="group-or-company"
      data-sensitive="true"
      />
      </div>
      </div>
      </CardContent>
      </Card>

      {/* Botões */}
      <div className="flex justify-end gap-3 sticky bottom-0 bg-white pt-4 border-t">
      <Button type="button" variant="outline" onClick={onClose} data-action="RBAC.Usuario.cancelar">
      Cancelar
      </Button>
      <Button
      type="submit"
      disabled={isPending || controlesDesabilitados}
      className="bg-blue-600 hover:bg-blue-700"
      data-action="RBAC.Usuario.salvar"
      data-permission="Sistema.Controle de Acesso.editar"
      data-sensitive="true"
      >
      {isPending ? 'Salvando...' : 'Salvar Configurações'}
      </Button>
      </div>
    </>
  );
}
