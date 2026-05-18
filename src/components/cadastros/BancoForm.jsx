import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Landmark } from "lucide-react";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

/**
 * V21.1.2 - WINDOW MODE READY
 */
export default function BancoForm({ banco, item, data, initialData, defaultValues, onSubmit, onSave, onClose, isSubmitting, windowMode = false }) {
  const dadosIniciais = item || data || initialData || defaultValues || banco;
  const { canCreate, canEdit } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const podeCriar = canCreate("Cadastros", "Banco") || canCreate("Financeiro", "Banco") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "Banco") || canEdit("Financeiro", "Banco") || canEdit("Cadastros", null);
  const podeSalvar = dadosIniciais?.id ? podeEditar : podeCriar;
  const [formData, setFormData] = useState(dadosIniciais || {
    nome_banco: '',
    codigo_banco: '',
    agencia: '',
    agencia_digito: '',
    conta: '',
    conta_digito: '',
    tipo_conta: 'Corrente',
    titular: '',
    cpf_cnpj_titular: '',
    saldo_inicial: 0,
    saldo_atual: 0,
    limite_especial: 0,
    principal: false,
    chave_pix: '',
    tipo_chave_pix: 'CNPJ',
    ativo: true
  });

  const prevIdRef = React.useRef(dadosIniciais?.id);
  useEffect(() => {
    if (dadosIniciais?.id && dadosIniciais.id !== prevIdRef.current) {
      prevIdRef.current = dadosIniciais.id;
      setFormData({ ...dadosIniciais });
    }
  }, [dadosIniciais?.id]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (dadosIniciais?.id && !podeEditar) {
      alert("Sem permissao para editar bancos.");
      return;
    }
    if (!dadosIniciais?.id && !podeCriar) {
      alert("Sem permissao para criar bancos.");
      return;
    }
    if (!formData.nome_banco || !formData.agencia || !formData.conta) {
      alert('Preencha os campos obrigatórios');
      return;
    }
    if (!contextoValido) {
      alert('Selecione um grupo ou empresa antes de salvar.');
      return;
    }
    // Injeta 'nome' para compatibilidade com o Visualizador Universal
    const payload = {
      ...formData,
      group_id: groupId || formData.group_id,
      empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id,
      nome: formData.nome_banco
    };
    if (onSubmit) {
      onSubmit(payload);
    } else {
      if (onSave) onSave();
      if (onClose) onClose();
    }
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Nome do Banco *</Label>
          <Input
            value={formData.nome_banco}
            onChange={(e) => setFormData({...formData, nome_banco: e.target.value})}
            placeholder="Ex: Banco do Brasil"
            disabled={!podeSalvar}
            data-permission="Financeiro.Banco.editar"
            data-action="editar-nome-banco"
            data-sensitive
          />
        </div>

        <div>
          <Label>Código do Banco</Label>
          <Input
            value={formData.codigo_banco}
            onChange={(e) => setFormData({...formData, codigo_banco: e.target.value})}
            placeholder="001, 033, 237"
            maxLength={3}
            disabled={!podeSalvar}
            data-permission="Financeiro.Banco.editar"
            data-action="editar-codigo-banco"
            data-sensitive
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Agência *</Label>
          <Input
            value={formData.agencia}
            onChange={(e) => setFormData({...formData, agencia: e.target.value})}
            placeholder="1234"
            disabled={!podeSalvar}
            data-permission="Financeiro.Banco.editar"
            data-action="editar-agencia-banco"
            data-sensitive
          />
        </div>

        <div>
          <Label>Dígito Agência</Label>
          <Input
            value={formData.agencia_digito}
            onChange={(e) => setFormData({...formData, agencia_digito: e.target.value})}
            placeholder="5"
            maxLength={1}
            disabled={!podeSalvar}
            data-permission="Financeiro.Banco.editar"
            data-action="editar-digito-agencia-banco"
            data-sensitive
          />
        </div>

        <div>
          <Label>Tipo de Conta</Label>
          <Select value={formData.tipo_conta} onValueChange={(v) => setFormData({...formData, tipo_conta: v})}>
            <SelectTrigger disabled={!podeSalvar} data-permission="Financeiro.Banco.editar" data-action="selecionar-tipo-conta-banco" data-sensitive>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Corrente">Corrente</SelectItem>
              <SelectItem value="Poupança">Poupança</SelectItem>
              <SelectItem value="Investimento">Investimento</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Conta *</Label>
          <Input
            value={formData.conta}
            onChange={(e) => setFormData({...formData, conta: e.target.value})}
            placeholder="12345-6"
            disabled={!podeSalvar}
            data-permission="Financeiro.Banco.editar"
            data-action="editar-conta-banco"
            data-sensitive
          />
        </div>

        <div>
          <Label>Dígito Conta</Label>
          <Input
            value={formData.conta_digito}
            onChange={(e) => setFormData({...formData, conta_digito: e.target.value})}
            placeholder="7"
            maxLength={2}
            disabled={!podeSalvar}
            data-permission="Financeiro.Banco.editar"
            data-action="editar-digito-conta-banco"
            data-sensitive
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Chave PIX</Label>
          <Input
            value={formData.chave_pix}
            onChange={(e) => setFormData({...formData, chave_pix: e.target.value})}
            placeholder="00.000.000/0001-00"
            disabled={!podeSalvar}
            data-permission="Financeiro.Banco.editar"
            data-action="editar-chave-pix-banco"
            data-sensitive
          />
        </div>

        <div>
          <Label>Tipo Chave PIX</Label>
          <Select value={formData.tipo_chave_pix} onValueChange={(v) => setFormData({...formData, tipo_chave_pix: v})}>
            <SelectTrigger disabled={!podeSalvar} data-permission="Financeiro.Banco.editar" data-action="selecionar-tipo-chave-pix-banco" data-sensitive>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CPF">CPF</SelectItem>
              <SelectItem value="CNPJ">CNPJ</SelectItem>
              <SelectItem value="Email">Email</SelectItem>
              <SelectItem value="Telefone">Telefone</SelectItem>
              <SelectItem value="Aleatória">Chave Aleatória</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Saldo Inicial</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.saldo_inicial}
            onChange={(e) => setFormData({...formData, saldo_inicial: parseFloat(e.target.value) || 0})}
            placeholder="0.00"
            disabled={!podeSalvar}
            data-permission="Financeiro.Banco.editar"
            data-action="editar-saldo-inicial-banco"
            data-sensitive
          />
        </div>

        <div>
          <Label>Limite Especial</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.limite_especial}
            onChange={(e) => setFormData({...formData, limite_especial: parseFloat(e.target.value) || 0})}
            placeholder="0.00"
            disabled={!podeSalvar}
            data-permission="Financeiro.Banco.editar"
            data-action="editar-limite-especial-banco"
            data-sensitive
          />
        </div>
      </div>

      <div className="flex items-center justify-between p-3 bg-slate-50 rounded">
        <div>
          <Label>Conta Principal</Label>
          <p className="text-xs text-slate-500">Conta padrão para operações</p>
        </div>
        <Switch
          checked={formData.principal}
          onCheckedChange={(v) => setFormData({...formData, principal: v})}
          disabled={!podeSalvar}
          data-permission="Financeiro.Banco.editar"
          data-action="alternar-conta-principal-banco"
          data-sensitive
        />
      </div>

      <div className="flex items-center justify-between p-3 bg-slate-50 rounded">
        <Label>Conta Ativa</Label>
        <Switch
          checked={formData.ativo}
          onCheckedChange={(v) => setFormData({...formData, ativo: v})}
          disabled={!podeSalvar}
          data-permission="Financeiro.Banco.alterarStatus"
          data-action="alternar-status-banco"
          data-sensitive
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          type="submit"
          disabled={isSubmitting || !contextoValido || !podeSalvar}
          data-permission="Cadastros.Banco.salvar"
          data-action="salvar-banco"
          data-sensitive
        >
          {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {dadosIniciais ? 'Atualizar Banco' : 'Criar Banco'}
        </Button>
      </div>
    </form>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full overflow-auto bg-white p-6">
        <div className="mb-4 pb-4 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Landmark className="w-5 h-5 text-blue-600" />
            {dadosIniciais ? 'Editar Banco' : 'Novo Banco'}
          </h2>
        </div>
        {formContent}
      </div>
    );
  }

  return formContent;
}
