import useCadastroRecordState from './useCadastroRecordState';
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { z } from "zod";
import FormWrapper from "@/components/common/FormWrapper";
import { Loader2, User, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import CadastroCodigoRegistroField from "@/components/cadastros/CadastroCodigoRegistroField";

const sanitizeText = (value, max = 255) => String(value ?? "").replace(/[<>]/g, "").slice(0, max).trim();
const sanitizeEmail = (value) => sanitizeText(value, 180).toLowerCase();

/**
 * V21.1.2 - WINDOW MODE READY
 */
export default function UsuarioForm({ usuario, item, data, initialData, defaultValues, onSubmit, isSubmitting, windowMode = false }) {
  const dadosIniciais = item || data || initialData || defaultValues || usuario;
  const { canCreate, canEdit } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const podeCriar = canCreate("Cadastros", "Usuario") || canCreate("Sistema", "Usuario") || canCreate("Sistema", "Controle de Acesso") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "Usuario") || canEdit("Sistema", "Usuario") || canEdit("Sistema", "Controle de Acesso") || canEdit("Cadastros", null);
  const podeSalvar = dadosIniciais?.id ? podeEditar : podeCriar;
  const [formData, setFormData] = useCadastroRecordState(dadosIniciais || {
    full_name: '',
    email: '',
    role: 'user',
    perfil_acesso_id: '',
    empresas_vinculadas: [],
    ativo: true
  }, JSON.stringify([dadosIniciais?.id ?? null, dadosIniciais?.updated_at ?? dadosIniciais?.updated_date ?? null, grupoAtual?.id ?? null, empresaAtual?.id ?? null, contexto]));

  const { data: perfis = [] } = useQuery({
    queryKey: ['perfis-acesso', groupId, empresaAtual?.id],
    queryFn: () => base44.entities.PerfilAcesso.list(),
  });

  const schema = z.object({
    full_name: z.string().min(1, 'Nome e obrigatorio'),
    email: z.string().email('E-mail invalido')
  });

  const handleSubmit = async () => {
    if (!podeSalvar) {
      alert(dadosIniciais?.id ? 'Sem permissao para editar usuarios.' : 'Sem permissao para convidar usuarios.');
      return;
    }
    if (!contextoValido) {
      alert('Selecione um grupo ou empresa antes de salvar.');
      return;
    }
    const payload = {
      ...formData,
      full_name: sanitizeText(formData.full_name, 180),
      nome: sanitizeText(formData.full_name, 180),
      email: sanitizeEmail(formData.email),
      role: sanitizeText(formData.role, 40),
      perfil_acesso_id: sanitizeText(formData.perfil_acesso_id, 80),
      group_id: groupId || formData.group_id,
      empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id
    };
    onSubmit(payload);
  };

  const formContent = (
    <FormWrapper schema={schema} defaultValues={formData} onSubmit={handleSubmit} externalData={formData} className="space-y-4">
      <CadastroCodigoRegistroField
        idOnly
        hasId={Boolean(dadosIniciais?.id)}
        entityId={dadosIniciais?.id}
        action="id-tecnico-usuario"
      />
      <div>
        <Label>Nome Completo *</Label>
        <Input
          value={formData.full_name}
          onChange={(e) => setFormData({...formData, full_name: e.target.value})}
          placeholder="Nome do usuario"
          disabled={!podeSalvar}
          data-permission="Sistema.Usuario.editar"
          data-action="editar-nome-usuario"
          data-sensitive
        />
      </div>

      <div>
        <Label>E-mail *</Label>
        <Input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({...formData, email: e.target.value})}
          placeholder="usuario@empresa.com"
          disabled={!podeSalvar}
          data-permission="Sistema.Usuario.editar"
          data-action="editar-email-usuario"
          data-sensitive
        />
      </div>

      <div>
        <Label>Nivel de Acesso</Label>
        <Select value={formData.role} onValueChange={(v) => setFormData({...formData, role: v})} disabled={!podeSalvar}>
          <SelectTrigger data-permission="Sistema.Usuario.editar" data-action="editar-nivel-usuario" data-sensitive>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user">Usuario</SelectItem>
            <SelectItem value="admin">Administrador</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Perfil de Acesso</Label>
        <Select value={formData.perfil_acesso_id} onValueChange={(v) => setFormData({...formData, perfil_acesso_id: v})} disabled={!podeSalvar}>
          <SelectTrigger data-permission="Sistema.Usuario.editar" data-action="editar-perfil-usuario" data-sensitive>
            <SelectValue placeholder="Selecione o perfil" />
          </SelectTrigger>
          <SelectContent>
            {perfis.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between p-3 bg-slate-50 rounded">
        <div>
          <Label>Usuario Ativo</Label>
          <p className="text-xs text-slate-500">Permite login no sistema</p>
        </div>
        <Switch
          checked={formData.ativo}
          onCheckedChange={(v) => setFormData({...formData, ativo: v})}
          disabled={!podeSalvar}
          data-permission="Sistema.Usuario.editar"
          data-action="alternar-usuario-ativo"
          data-sensitive
        />
      </div>

      <Alert className="border-blue-200 bg-blue-50">
        <Shield className="w-4 h-4" />
        <AlertDescription className="text-sm">
          Um e-mail de convite sera enviado automaticamente
        </AlertDescription>
      </Alert>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="submit" disabled={isSubmitting || !contextoValido || !podeSalvar} data-permission="Sistema.Usuario.salvar" data-action="salvar-usuario" data-sensitive>
          {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {dadosIniciais ? 'Atualizar' : 'Convidar Usuario'}
        </Button>
      </div>
    </FormWrapper>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full overflow-auto bg-white p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b bg-gradient-to-r from-sky-50 to-sky-100 -mx-6 px-6 py-4">
          <User className="w-8 h-8 text-sky-600" />
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {dadosIniciais?.id ? 'Editar Usuario' : 'Convidar Usuario'}
            </h2>
            {dadosIniciais?.id ? (
              <p className="text-xs text-slate-500">
                ID técnico: <span className="font-mono">{String(dadosIniciais.id)}</span>
              </p>
            ) : null}
          </div>
        </div>
        {formContent}
      </div>
    );
  }

  return formContent;
}
