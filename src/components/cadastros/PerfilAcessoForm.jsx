import React, { useRef } from "react";
import useCadastroRecordState from './useCadastroRecordState';
import useCadastroFormScopeGuard from './hooks/useCadastroFormScopeGuard';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import { assertCadastroRecordInTenant, getCadastroEntityPermissionKey } from './cadastroEditLoadPolicy';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Shield, AlertTriangle, XCircle, Trash2, Power, PowerOff } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import usePermissions from "@/components/lib/usePermissions";

/**
 * V21.1.2 - WINDOW MODE READY
 */
export default function PerfilAcessoForm({ perfil, onSubmit, isSubmitting, windowMode = false }) {
  const { canCreate, canEdit, canDelete, isLoading } = usePermissions();
  const { grupoAtual, empresaAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const scope = useCadastroFormScopeGuard(groupId, empresaAtual?.id || null);
  const identity = JSON.stringify([perfil?.id ?? null, perfil?.updated_at ?? perfil?.updated_date ?? null, groupId, empresaAtual?.id ?? null, contexto]);
  const current = useRef(null);
  const podeCriar = !isLoading && canCreate("Sistema", "Controle de Acesso");
  const podeEditar = !isLoading && canEdit("Sistema", "Controle de Acesso");
  const podeExcluir = !isLoading && canDelete("Sistema", "Controle de Acesso");
  current.current = { identity, podeCriar, podeEditar, podeExcluir };
  const [formData, setFormData] = useCadastroRecordState(perfil || {
    nome: '',
    descricao: '',
    nivel_acesso: 'Básico',
    permissoes: {
      cadastros: { criar_fornecedor: false, criar_cliente: false },
      financeiro: { aprovar_pagamentos: false, gerar_cobranca: false },
      comercial: { criar_pedido: false, aprovar_desconto_acima_10: false }
    },
    ativo: true
  }, identity);

  const [conflitosIA, setConflitosIA] = useCadastroRecordState([], identity);
  const [bloqueioSoD, setBloqueioSoD] = useCadastroRecordState(false, identity);

  // IA de Compliance (SoD) V18.0 - BLOQUEIA salvamento
  const validarSegregacaoFuncao = async () => {
    const conflitos = [];
    
    // Regra 1: Criar Fornecedor + Aprovar Pagamentos
    if (formData.permissoes?.cadastros?.criar_fornecedor &&
        formData.permissoes?.financeiro?.aprovar_pagamentos) {
      conflitos.push({
        tipo: 'CRÍTICO',
        regra: 'SoD-001',
        mensagem: '🚨 Conflito: Não pode criar fornecedor E aprovar pagamentos (risco de fraude)',
        campos: ['cadastros.criar_fornecedor', 'financeiro.aprovar_pagamentos']
      });
    }

    // Regra 2: Criar Cliente + Aprovar Desconto Alto
    if (formData.permissoes?.cadastros?.criar_cliente &&
        formData.permissoes?.comercial?.aprovar_desconto_acima_10) {
      conflitos.push({
        tipo: 'AVISO',
        regra: 'SoD-002',
        mensagem: '⚠️ Aviso: Criar cliente e aprovar descontos pode gerar risco',
        campos: ['cadastros.criar_cliente', 'comercial.aprovar_desconto_acima_10']
      });
    }

    setConflitosIA(conflitos);
    
    // BLOQUEIA se houver conflito CRÍTICO
    const temCritico = conflitos.some(c => c.tipo === 'CRÍTICO');
    setBloqueioSoD(temCritico);
    
    return temCritico;
  };

  const handlePermissaoChange = (modulo, permissao, valor) => {
    const novasPermissoes = {
      ...formData.permissoes,
      [modulo]: {
        ...formData.permissoes[modulo],
        [permissao]: valor
      }
    };
    
    setFormData({ ...formData, permissoes: novasPermissoes });
    
    // Validar após mudança
    setTimeout(() => validarSegregacaoFuncao(), 100);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!scope.isCurrent() || current.current.identity !== identity) {
      toast.error('Contexto alterado. Reabra o perfil antes de salvar.');
      return;
    }
    try {
      assertCadastroRecordInTenant('PerfilAcesso', perfil, { groupId, empresaId: empresaAtual?.id || null, scopeType: empresaAtual?.id ? 'empresa' : 'grupo' });
    } catch {
      toast.error('Perfil fora do contexto ativo.');
      return;
    }
    if (perfil && !podeEditar) {
      toast.error('Seu perfil nao permite editar perfis de acesso.');
      return;
    }
    if (!perfil && !podeCriar) {
      toast.error('Seu perfil nao permite criar perfis de acesso.');
      return;
    }
    
    if (!formData.nome) {
      alert('Preencha o nome do perfil');
      return;
    }

    // IA de Compliance - BLOQUEIA se conflito crítico
    const temConflitoCritico = await validarSegregacaoFuncao();
    if (!scope.isCurrent() || current.current.identity !== identity
      || !(perfil ? current.current.podeEditar : current.current.podeCriar)) {
      toast.error('Contexto ou permissao alterados. Reabra o perfil antes de salvar.');
      return;
    }
    
    if (temConflitoCritico) {
      toast.error('❌ Salvamento BLOQUEADO! Remova as permissões conflitantes.');
      return;
    }
    
    // Injeta nome_perfil para compatibilidade com o schema da entidade PerfilAcesso
    onSubmit({ ...formData, nome_perfil: formData.nome_perfil || formData.nome || '' });
  };

  const handleExcluir = () => {
    if (!scope.isCurrent() || current.current.identity !== identity || !current.current.podeExcluir) {
      toast.error('Seu perfil nao permite excluir perfis de acesso.');
      return;
    }
    try {
      assertCadastroRecordInTenant('PerfilAcesso', perfil, { groupId, empresaId: empresaAtual?.id || null, scopeType: empresaAtual?.id ? 'empresa' : 'grupo' });
    } catch {
      toast.error('Perfil fora do contexto ativo.');
      return;
    }
    if (!window.confirm(`Tem certeza que deseja excluir o perfil "${formData.nome}"? Esta ação não pode ser desfeita.`)) {
      return;
    }
    if (!scope.isCurrent() || current.current.identity !== identity || !current.current.podeExcluir) return;
    if (onSubmit) {
      onSubmit({ ...formData, _action: 'delete' });
    }
  };

  const handleAlternarStatus = () => {
    const novoStatus = !formData.ativo;
    setFormData({ ...formData, ativo: novoStatus });
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Nome do Perfil *</Label>
        <Input
          value={formData.nome}
          onChange={(e) => setFormData({...formData, nome: e.target.value})}
          placeholder="Ex: Vendedor, Gerente Financeiro"
        />
      </div>

      <div>
        <Label>Descrição</Label>
        <Textarea
          value={formData.descricao}
          onChange={(e) => setFormData({...formData, descricao: e.target.value})}
          rows={2}
        />
      </div>

      {/* IA de Compliance - Alertas de Conflito */}
      {conflitosIA.length > 0 && (
        <div className="space-y-2">
          {conflitosIA.map((conflito, idx) => (
            <Alert key={idx} className={conflito.tipo === 'CRÍTICO' ? 'border-red-200 bg-red-50' : 'border-orange-200 bg-orange-50'}>
              {conflito.tipo === 'CRÍTICO' ? <XCircle className="w-4 h-4 text-red-600" /> : <AlertTriangle className="w-4 h-4 text-orange-600" />}
              <AlertDescription className="text-sm">
                <strong>[{conflito.regra}]</strong> {conflito.mensagem}
                <p className="text-xs mt-1">Campos: {conflito.campos.join(' + ')}</p>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Permissões por Módulo */}
      <Card className="border">
        <CardContent className="p-4 space-y-4">
          <h4 className="font-semibold">📋 Cadastros</h4>
          
          <div className="flex items-center justify-between">
            <Label>Criar Fornecedor</Label>
            <Switch
              checked={formData.permissoes.cadastros?.criar_fornecedor}
              onCheckedChange={(v) => handlePermissaoChange('cadastros', 'criar_fornecedor', v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Criar Cliente</Label>
            <Switch
              checked={formData.permissoes.cadastros?.criar_cliente}
              onCheckedChange={(v) => handlePermissaoChange('cadastros', 'criar_cliente', v)}
            />
          </div>

          <h4 className="font-semibold pt-4">💰 Financeiro</h4>
          
          <div className="flex items-center justify-between">
            <Label>Aprovar Pagamentos</Label>
            <Switch
              checked={formData.permissoes.financeiro?.aprovar_pagamentos}
              onCheckedChange={(v) => handlePermissaoChange('financeiro', 'aprovar_pagamentos', v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Gerar Cobrança</Label>
            <Switch
              checked={formData.permissoes.financeiro?.gerar_cobranca}
              onCheckedChange={(v) => handlePermissaoChange('financeiro', 'gerar_cobranca', v)}
            />
          </div>

          <h4 className="font-semibold pt-4">🛒 Comercial</h4>
          
          <div className="flex items-center justify-between">
            <Label>Criar Pedido</Label>
            <Switch
              checked={formData.permissoes.comercial?.criar_pedido}
              onCheckedChange={(v) => handlePermissaoChange('comercial', 'criar_pedido', v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Aprovar Desconto Acima de 10%</Label>
            <Switch
              checked={formData.permissoes.comercial?.aprovar_desconto_acima_10}
              onCheckedChange={(v) => handlePermissaoChange('comercial', 'aprovar_desconto_acima_10', v)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 pt-4 border-t">
        {perfil && (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={handleAlternarStatus}
              disabled={!podeEditar}
              data-permission={getCadastroEntityPermissionKey('PerfilAcesso', 'editar')}
              data-sensitive
              className={formData.ativo ? 'border-orange-300 text-orange-700' : 'border-green-300 text-green-700'}
            >
              {formData.ativo ? (
                <>
                  <PowerOff className="w-4 h-4 mr-2" />
                  Inativar
                </>
              ) : (
                <>
                  <Power className="w-4 h-4 mr-2" />
                  Ativar
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleExcluir}
              disabled={!podeExcluir}
              data-permission={getCadastroEntityPermissionKey('PerfilAcesso', 'excluir')}
              data-sensitive
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir
            </Button>
          </>
        )}
        <Button
          type="submit"
          disabled={isSubmitting || bloqueioSoD || (perfil ? !podeEditar : !podeCriar)}
          data-permission={getCadastroEntityPermissionKey('PerfilAcesso', perfil ? 'editar' : 'criar')}
          data-sensitive
        >
          {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {bloqueioSoD && <XCircle className="w-4 h-4 mr-2 text-red-600" />}
          {bloqueioSoD ? 'BLOQUEADO (Conflito SoD)' : perfil ? 'Atualizar' : 'Criar Perfil'}
        </Button>
      </div>
    </form>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full overflow-auto bg-white p-6">
        <div className="mb-4 pb-4 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            {perfil ? 'Editar Perfil de Acesso' : 'Novo Perfil de Acesso'}
          </h2>
        </div>
        {formContent}
      </div>
    );
  }

  return formContent;
}
