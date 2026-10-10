import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Save, Truck, Trash2, Power, PowerOff } from "lucide-react";
import { BotaoBuscaAutomatica } from "@/components/lib/BuscaDadosPublicos";
import { z } from "zod";
import FormWrapper from "@/components/common/FormWrapper";
import { useToast } from "@/components/ui/use-toast";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import CadastroCodigoRegistroField from "@/components/cadastros/CadastroCodigoRegistroField";

/**
 * V21.1.2: Transportadora Form - Adaptado para Window Mode
 */
export default function TransportadoraForm({ transportadora: transportadoraProp, item, data, onSubmit, onSave, onClose, windowMode = false }) {
  const transportadora = transportadoraProp || item || data || null;
  const onCloseNorm = onClose || onSave;
  const { toast } = useToast();
  const { empresaAtual, grupoAtual } = useContextoVisual();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId);
  const podeCriar = canCreate("Cadastros", "Transportadora") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "Transportadora") || canEdit("Cadastros", null);
  const podeExcluir = canDelete("Cadastros", "Transportadora") || canDelete("Cadastros", null);
  
  const [formData, setFormData] = useState(transportadora || {
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    inscricao_estadual: '',
    rntrc: '',
    email: '',
    telefone: '',
    whatsapp: '',
    contato_responsavel: '',
    endereco: '',
    cidade: '',
    estado: '',
    cep: '',
    prazo_entrega_padrao: 0,
    valor_frete_minimo: 0,
    status: 'Ativo',
    observacoes: ''
  });

  const schema = z.object({
    razao_social: z.string().min(1, 'Razão Social é obrigatória'),
    cnpj: z.string().min(11, 'CNPJ é obrigatório')
  });

  useEffect(() => {
    if (transportadora?.id) {
      setFormData({ ...transportadora });
    }
  }, [transportadora?.id]);

  const handleSubmit = async () => {
    if (!contextoValido) {
      toast({ title: "Selecione um grupo ou empresa antes de salvar.", variant: "destructive" });
      return;
    }
    if (transportadora?.id && !podeEditar) {
      toast({ title: "Seu perfil nao permite editar transportadoras.", variant: "destructive" });
      return;
    }
    if (!transportadora?.id && !podeCriar) {
      toast({ title: "Seu perfil nao permite criar transportadoras.", variant: "destructive" });
      return;
    }
    if (onSubmit) {
      await onSubmit({
        ...formData,
        ...(empresaAtual?.id && !formData.empresa_id ? { empresa_id: empresaAtual.id } : {}),
        ...(empresaAtual?.id && !formData.empresa_dona_id ? { empresa_dona_id: formData.empresa_id || empresaAtual.id } : {}),
        ...(groupId && !formData.group_id ? { group_id: groupId } : {})
      });
      return;
    }
    if (onCloseNorm) onCloseNorm();
  };

  const handleExcluir = () => {
    if (!podeExcluir) {
      toast({ title: "Seu perfil nao permite excluir transportadoras.", variant: "destructive" });
      return;
    }
    if (!window.confirm(`Tem certeza que deseja excluir a transportadora "${formData.razao_social}"? Esta ação não pode ser desfeita.`)) {
      return;
    }
    if (onSubmit) {
      onSubmit({ ...formData, _action: 'delete' });
    }
  };

  const handleAlternarStatus = () => {
    const novoStatus = formData.status === 'Ativo' ? 'Inativo' : 'Ativo';
    setFormData({ ...formData, status: novoStatus });
  };

  const handleDadosCNPJ = (dados) => {
    setFormData({
      ...formData,
      razao_social: dados.razao_social || formData.razao_social,
      nome_fantasia: dados.nome_fantasia || formData.nome_fantasia,
      inscricao_estadual: dados.inscricao_estadual || formData.inscricao_estadual,
      cnae_principal: dados.cnae_principal || formData.cnae_principal,
      status_fiscal_receita: dados.situacao_cadastral || "Não Verificado",
      endereco: dados.endereco_completo?.logradouro 
        ? `${dados.endereco_completo.logradouro}, ${dados.endereco_completo.numero || 'S/N'}${dados.endereco_completo.complemento ? ', ' + dados.endereco_completo.complemento : ''}, ${dados.endereco_completo.bairro || ''}`
        : formData.endereco,
      cidade: dados.endereco_completo?.cidade || formData.cidade,
      estado: dados.endereco_completo?.uf || formData.estado,
      cep: dados.endereco_completo?.cep || formData.cep,
      email: dados.email || formData.email,
      telefone: dados.telefone || formData.telefone
    });

    toast({
      title: "✅ Dados REAIS da Receita Federal preenchidos!",
      description: `${dados.razao_social} - ${dados.situacao_cadastral}${dados.inscricao_estadual ? ' - IE: ' + dados.inscricao_estadual : ''}`,
      duration: 5000
    });
  };

  const handleDadosCEP = (dados) => {
    setFormData({
      ...formData,
      endereco: dados.logradouro ? `${dados.logradouro}` : formData.endereco,
      cidade: dados.cidade || formData.cidade,
      estado: dados.uf || formData.estado
    });

    toast({ title: "✅ Endereço preenchido automaticamente!" });
  };

  const handleDadosRNTRC = (dados) => {
    if (dados.valido) {
      toast({
        title: "✅ RNTRC Válido",
        description: `Situação: ${dados.situacao} - ${dados.tipo_registro}`
      });
    } else {
      toast({
        title: "⚠️ RNTRC com restrições",
        description: dados.situacao,
        variant: "destructive"
      });
    }
  };

  const content = (
    <FormWrapper schema={schema} defaultValues={formData} onSubmit={handleSubmit} externalData={formData} className={`space-y-6 ${windowMode ? 'p-6 h-full overflow-auto' : ''}`}>
      <CadastroCodigoRegistroField
        hasId={Boolean(transportadora?.id)}
        entityId={transportadora?.id}
        value={formData.codigo}
        action="codigo-registro-transportadora"
      />
<Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Truck className="w-5 h-5 text-orange-600" />
            Dados da Transportadora
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Razão Social *</Label>
              <Input
                value={formData.razao_social}
                onChange={(e) => setFormData({ ...formData, razao_social: e.target.value })}
                required
              />
            </div>

            <div>
              <Label>Nome Fantasia</Label>
              <Input
                value={formData.nome_fantasia}
                onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })}
              />
            </div>

            <div>
              <Label>CNPJ *</Label>
              <Input
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                required
                placeholder="00.000.000/0000-00"
              />
            </div>

            <div>
              <Label>&nbsp;</Label>
              <BotaoBuscaAutomatica
                tipo="cnpj"
                valor={formData.cnpj}
                onDadosEncontrados={handleDadosCNPJ}
                disabled={!formData.cnpj || formData.cnpj.replace(/\D/g, '').length < 14}
              />
            </div>

            <div>
              <Label>Inscrição Estadual</Label>
              <Input
                value={formData.inscricao_estadual}
                onChange={(e) => setFormData({ ...formData, inscricao_estadual: e.target.value })}
              />
            </div>

            <div>
              <Label>RNTRC (ANTT)</Label>
              <Input
                value={formData.rntrc}
                onChange={(e) => setFormData({ ...formData, rntrc: e.target.value })}
                placeholder="Registro Nacional"
              />
            </div>

            <div>
              <Label>&nbsp;</Label>
              <BotaoBuscaAutomatica
                tipo="rntrc"
                valor={formData.rntrc}
                onDadosEncontrados={handleDadosRNTRC}
                disabled={!formData.rntrc}
              />
            </div>

            <div>
              <Label>CEP</Label>
              <Input
                value={formData.cep}
                onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                placeholder="00000-000"
              />
            </div>

            <div>
              <Label>&nbsp;</Label>
              <BotaoBuscaAutomatica
                tipo="cep"
                valor={formData.cep}
                onDadosEncontrados={handleDadosCEP}
                disabled={!formData.cep || formData.cep.replace(/\D/g, '').length < 8}
              />
            </div>

            <div className="col-span-2">
              <Label>Endereço</Label>
              <Input
                value={formData.endereco}
                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                placeholder="Rua, Número, Bairro"
              />
            </div>

            <div>
              <Label>Cidade</Label>
              <Input
                value={formData.cidade}
                onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
              />
            </div>

            <div>
              <Label>Estado</Label>
              <Input
                value={formData.estado}
                onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                maxLength={2}
                placeholder="SP"
              />
            </div>

            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div>
              <Label>Telefone</Label>
              <Input
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
              />
            </div>

            <div>
              <Label>WhatsApp</Label>
              <Input
                value={formData.whatsapp}
                onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div>
              <Label>Contato Responsável</Label>
              <Input
                value={formData.contato_responsavel}
                onChange={(e) => setFormData({ ...formData, contato_responsavel: e.target.value })}
                placeholder="Nome do responsável"
              />
            </div>

            <div>
              <Label>Prazo Entrega Padrão (dias)</Label>
              <Input
                type="number"
                value={formData.prazo_entrega_padrao}
                onChange={(e) => setFormData({ ...formData, prazo_entrega_padrao: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div>
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[99999]">
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-white">
        {transportadora && (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={handleAlternarStatus}
              disabled={!podeEditar || !contextoValido}
              data-permission="Cadastros.Transportadora.alterarStatus"
              data-sensitive
              className={formData.status === 'Ativo' ? 'border-orange-300 text-orange-700' : 'border-green-300 text-green-700'}
            >
              {formData.status === 'Ativo' ? (
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
              disabled={!podeExcluir || !contextoValido}
              data-permission="Cadastros.Transportadora.excluir"
              data-sensitive
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir
            </Button>
          </>
        )}
        <Button
          type="submit"
          className="bg-orange-600 hover:bg-orange-700"
          disabled={!contextoValido || (transportadora?.id ? !podeEditar : !podeCriar)}
          data-permission="Cadastros.Transportadora.salvar"
          data-sensitive
        >
          <Save className="w-4 h-4 mr-2" />
          {transportadora ? 'Atualizar' : 'Criar'} Transportadora
        </Button>
      </div>
    </FormWrapper>
  );

  if (windowMode) {
    return <div className="w-full h-full bg-white">{content}</div>;
  }

  return content;
}
