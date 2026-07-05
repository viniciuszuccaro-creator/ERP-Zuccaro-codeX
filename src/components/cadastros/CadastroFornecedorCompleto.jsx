import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Building2, 
  Phone, 
  Save,
  Star,
  Trash2,
  Power,
  PowerOff
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { BotaoBuscaAutomatica } from "@/components/lib/BuscaDadosPublicos";

const sanitizeText = (value, max = 500) => String(value ?? "").replace(/[<>]/g, "").slice(0, max).trim();
const sanitizeCode = (value, max = 80) => String(value ?? "").replace(/[^0-9A-Za-z_.\-/\s@()+]/g, "").slice(0, max).trim();
const sanitizeEmail = (value) => sanitizeCode(value, 180).toLowerCase();
const toNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const sanitizeAvaliacoes = (values) => Array.isArray(values) ? values.slice(0, 100).map((avaliacao) => ({
  ...avaliacao,
  nota: toNumber(avaliacao?.nota, 0),
  comentario: sanitizeText(avaliacao?.comentario, 1000),
  avaliador: sanitizeText(avaliacao?.avaliador, 180),
  ordem_compra_id: sanitizeCode(avaliacao?.ordem_compra_id, 120)
})) : [];

export default function CadastroFornecedorCompleto({ fornecedor: fornecedorProp, item, data, initialData, defaultValues, isOpen, onClose, onSuccess, windowMode = false, onSubmit, onSave }) {
  const fornecedor = fornecedorProp || item || data || initialData || defaultValues || null;
  const onCloseNorm = onClose || onSave || onSubmit;
  const [activeTab, setActiveTab] = useState("dados-gerais");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    empresaAtual,
    grupoAtual,
    createInContext,
    updateInContext,
    deleteInContext
  } = useContextoVisual();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || fornecedor?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || fornecedor?.empresa_id || fornecedor?.empresa_dona_id || fornecedor?.group_id);
  const podeCriar = canCreate("Cadastros", "Fornecedor") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "Fornecedor") || canEdit("Cadastros", null);
  const podeExcluir = canDelete("Cadastros", "Fornecedor") || canDelete("Cadastros", null);

  const [formData, setFormData] = useState(fornecedor || {
    nome: "",
    razao_social: "",
    nome_fantasia: "",
    cnpj: "",
    inscricao_estadual: "",
    rntrc: "",
    email: "",
    telefone: "",
    whatsapp: "",
    contato_responsavel: "",
    endereco: "",
    cidade: "",
    estado: "",
    cep: "",
    tipo_fornecedor: "Matéria-Prima",
    categoria: "Matéria Prima",
    prazo_entrega_padrao: 0,
    status_fornecedor: "Em Análise",
    status: "Ativo",
    avaliacoes: [],
    nota_media: 0,
    empresa_id: empresaAtual?.id,
    empresa_dona_id: empresaAtual?.id,
    group_id: groupId
  });

  const buildPayload = (data = formData) => ({
    ...data,
    nome: sanitizeText(data.nome, 180),
    razao_social: sanitizeText(data.razao_social, 180),
    nome_fantasia: sanitizeText(data.nome_fantasia, 180),
    cnpj: sanitizeCode(data.cnpj, 24),
    inscricao_estadual: sanitizeCode(data.inscricao_estadual, 40),
    rntrc: sanitizeCode(data.rntrc, 40),
    email: sanitizeEmail(data.email),
    telefone: sanitizeCode(data.telefone, 40),
    whatsapp: sanitizeCode(data.whatsapp, 40),
    contato_responsavel: sanitizeText(data.contato_responsavel, 180),
    endereco: sanitizeText(data.endereco, 300),
    cidade: sanitizeText(data.cidade, 120),
    estado: sanitizeCode(data.estado, 2),
    cep: sanitizeCode(data.cep, 12),
    tipo_fornecedor: sanitizeText(data.tipo_fornecedor, 80),
    categoria: sanitizeText(data.categoria, 80),
    prazo_entrega_padrao: toNumber(data.prazo_entrega_padrao, 0),
    status_fornecedor: sanitizeText(data.status_fornecedor, 80),
    status: sanitizeText(data.status || "Ativo", 40),
    avaliacoes: sanitizeAvaliacoes(data.avaliacoes),
    nota_media: toNumber(data.nota_media, 0),
    empresa_id: data.empresa_id || empresaAtual?.id,
    empresa_dona_id: data.empresa_dona_id || data.empresa_id || empresaAtual?.id,
    group_id: data.group_id || groupId
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (!contextoValido) {
        throw new Error("Selecione um grupo ou empresa antes de salvar o fornecedor.");
      }

      const payload = buildPayload(data);

      if (fornecedor?.id) {
        if (!podeEditar) throw new Error("Seu perfil nao permite editar fornecedores.");
        return updateInContext('Fornecedor', fornecedor.id, payload, 'empresa_dona_id');
      }

      if (!podeCriar) throw new Error("Seu perfil nao permite criar fornecedores.");
      return createInContext('Fornecedor', payload, 'empresa_dona_id');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
      toast({ title: `✅ Fornecedor ${fornecedor?.id ? 'atualizado' : 'criado'} com sucesso!` });
      if (onSuccess) onSuccess();
      if (onSubmit) onSubmit(buildPayload(formData));
      if (onCloseNorm) onCloseNorm();
    },
    onError: (error) => {
      toast({ 
        title: "❌ Erro ao salvar fornecedor", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      if (!podeExcluir) throw new Error("Seu perfil nao permite excluir fornecedores.");
      return deleteInContext('Fornecedor', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
      toast({ title: "✅ Fornecedor excluído com sucesso!" });
      if (onSuccess) onSuccess();
      if (onCloseNorm) onCloseNorm();
    },
    onError: (error) => {
      toast({
        title: "❌ Erro ao excluir fornecedor",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleExcluir = () => {
    if (!window.confirm(`Tem certeza que deseja excluir o fornecedor "${formData.nome}"? Esta ação não pode ser desfeita.`)) {
      return;
    }
    deleteMutation.mutate(fornecedor.id);
  };

  const handleAlternarStatus = () => {
    if (!podeEditar) {
      toast({ title: "Seu perfil nao permite alterar status de fornecedores.", variant: "destructive" });
      return;
    }
    const novoStatus = formData.status === 'Ativo' ? 'Inativo' : 'Ativo';
    setFormData({ ...formData, status: novoStatus });
  };

  const handleSave = () => {
    saveMutation.mutate(buildPayload(formData));
  };

  const handleDadosCNPJ = (dados) => {
    setFormData({
      ...formData,
      nome: dados.razao_social || formData.nome,
      razao_social: dados.razao_social || "",
      nome_fantasia: dados.nome_fantasia || "",
      inscricao_estadual: dados.inscricao_estadual || formData.inscricao_estadual,
      cnae_principal: dados.cnae_principal || formData.cnae_principal,
      ramo_atividade: dados.cnae_principal || formData.ramo_atividade,
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
      description: `${dados.razao_social} - ${dados.situacao_cadastral}${dados.inscricao_estadual ? ' - IE: ' + dados.inscricao_estadual : ''}`
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

  useEffect(() => {
    if (fornecedor) {
      setFormData({
        ...fornecedor,
        avaliacoes: fornecedor.avaliacoes || []
      });
    }
  }, [fornecedor?.id]);

  const content = (
    <>
      <div className="border-b pb-4 px-6 pt-6 flex-shrink-0 bg-white sticky top-0 z-10">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="w-6 h-6 text-cyan-600" />
              {fornecedor?.id ? 'Editar Fornecedor' : 'Novo Fornecedor'}
            </h2>
              {fornecedor?.id && (
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={
                    formData.status === 'Ativo' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-700'
                  }>
                    {formData.status}
                  </Badge>
                  <span className="text-sm text-slate-600">{formData.cnpj}</span>
                </div>
              )}
            </div>
            
          <div className="flex items-center gap-2">
            {fornecedor?.id && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  data-permission="Cadastros.Fornecedor.alterarStatus"
                  data-sensitive
                  onClick={handleAlternarStatus}
                  disabled={!podeEditar || !contextoValido}
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
                  data-permission="Cadastros.Fornecedor.excluir"
                  data-sensitive
                  onClick={handleExcluir}
                  disabled={deleteMutation.isPending || !podeExcluir || !contextoValido}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
                </Button>
              </>
            )}
            <Button 
              onClick={handleSave} 
              data-permission="Cadastros.Fornecedor.salvar"
              data-sensitive
              disabled={saveMutation.isPending || !contextoValido || (fornecedor?.id ? !podeEditar : !podeCriar)}
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              <Save className="w-4 h-4 mr-2" />
              {saveMutation.isPending ? 'Salvando...' : 'Salvar Fornecedor'}
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-3 flex-shrink-0 px-6 bg-slate-50">
            <TabsTrigger value="dados-gerais" className="text-xs">
              <Building2 className="w-3 h-3 mr-1" />
              Dados Gerais
            </TabsTrigger>
            <TabsTrigger value="contato" className="text-xs">
              <Phone className="w-3 h-3 mr-1" />
              Contato e Endereço
            </TabsTrigger>
            <TabsTrigger value="avaliacoes" className="text-xs" disabled={!fornecedor?.id}>
              <Star className="w-3 h-3 mr-1" />
              Avaliações
            </TabsTrigger>
          </TabsList>

        <ScrollArea className="flex-1">
          <div className="px-6 pb-6">
            <TabsContent value="dados-gerais" className="space-y-6 m-0 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="nome">Nome / Razão Social *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="razao_social">Razão Social</Label>
                  <Input
                    id="razao_social"
                    value={formData.razao_social}
                    onChange={(e) => setFormData({ ...formData, razao_social: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
                  <Input
                    id="nome_fantasia"
                    value={formData.nome_fantasia}
                    onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    value={formData.cnpj}
                    onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
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
                  <Label htmlFor="inscricao_estadual">Inscrição Estadual</Label>
                  <Input
                    id="inscricao_estadual"
                    value={formData.inscricao_estadual}
                    onChange={(e) => setFormData({ ...formData, inscricao_estadual: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="categoria">Categoria *</Label>
                  <Select
                    value={formData.categoria}
                    onValueChange={(value) => setFormData({ ...formData, categoria: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[99999]">
                      <SelectItem value="Matéria Prima">Matéria Prima</SelectItem>
                      <SelectItem value="Equipamentos">Equipamentos</SelectItem>
                      <SelectItem value="Serviços">Serviços</SelectItem>
                      <SelectItem value="Transporte">Transporte</SelectItem>
                      <SelectItem value="Tecnologia">Tecnologia</SelectItem>
                      <SelectItem value="Outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.categoria === "Transporte" && (
                  <>
                    <div>
                      <Label htmlFor="rntrc">RNTRC (ANTT)</Label>
                      <Input
                        id="rntrc"
                        value={formData.rntrc}
                        onChange={(e) => setFormData({ ...formData, rntrc: e.target.value })}
                        placeholder="00000000"
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
                  </>
                )}

                <div>
                  <Label htmlFor="prazo_entrega_padrao">Prazo Entrega Padrão (dias)</Label>
                  <Input
                    id="prazo_entrega_padrao"
                    type="number"
                    value={formData.prazo_entrega_padrao}
                    onChange={(e) => setFormData({ ...formData, prazo_entrega_padrao: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div>
                  <Label htmlFor="status_fornecedor">Status do Fornecedor</Label>
                  <Select
                    value={formData.status_fornecedor}
                    onValueChange={(value) => setFormData({ ...formData, status_fornecedor: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[99999]">
                      <SelectItem value="Em Análise">Em Análise</SelectItem>
                      <SelectItem value="Ativo">Ativo</SelectItem>
                      <SelectItem value="Bloqueado">Bloqueado</SelectItem>
                      <SelectItem value="Inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[99999]">
                      <SelectItem value="Ativo">Ativo</SelectItem>
                      <SelectItem value="Inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {fornecedor?.id && (
                  <div className="col-span-2 pt-4 border-t">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-slate-600">Última Compra</p>
                        <p className="font-semibold">
                          {formData.ultima_compra 
                            ? new Date(formData.ultima_compra).toLocaleDateString('pt-BR')
                            : '-'
                          }
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Total de Compras</p>
                        <p className="font-semibold">
                          {formData.quantidade_compras || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Nota Média</p>
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`w-4 h-4 ${
                                  star <= (formData.nota_media || 0)
                                    ? 'fill-yellow-400 text-yellow-400'
                                    : 'text-slate-300'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="font-semibold">{(formData.nota_media || 0).toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="contato" className="space-y-6 m-0 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="contato_responsavel">Contato Responsável</Label>
                  <Input
                    id="contato_responsavel"
                    value={formData.contato_responsavel}
                    onChange={(e) => setFormData({ ...formData, contato_responsavel: e.target.value })}
                    placeholder="Nome do responsável"
                  />
                </div>

                <div>
                  <Label htmlFor="cep">CEP</Label>
                  <Input
                    id="cep"
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
                  <Label htmlFor="endereco">Endereço Completo</Label>
                  <Input
                    id="endereco"
                    value={formData.endereco}
                    onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                    placeholder="Rua, Número, Bairro"
                  />
                </div>

                <div>
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input
                    id="cidade"
                    value={formData.cidade}
                    onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="estado">Estado</Label>
                  <Input
                    id="estado"
                    value={formData.estado}
                    onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                    maxLength={2}
                    placeholder="SP"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="avaliacoes" className="m-0 mt-4">
              {fornecedor?.id ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Histórico de Avaliações</h3>
                    <Badge variant="outline" className="text-lg">
                      <Star className="w-4 h-4 mr-1 fill-yellow-400 text-yellow-400" />
                      {(formData.nota_media || 0).toFixed(1)}
                    </Badge>
                  </div>

                  {formData.avaliacoes && formData.avaliacoes.length > 0 ? (
                    <div className="space-y-3">
                      {formData.avaliacoes.map((avaliacao, idx) => (
                        <Card key={idx} className="border-0 shadow-sm">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    className={`w-4 h-4 ${
                                      star <= avaliacao.nota
                                        ? 'fill-yellow-400 text-yellow-400'
                                        : 'text-slate-300'
                                    }`}
                                  />
                                ))}
                              </div>
                              <span className="text-xs text-slate-600">
                                {new Date(avaliacao.data).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                            
                            {avaliacao.criterios && (
                              <div className="grid grid-cols-2 gap-2 mb-2 text-sm">
                                <div>
                                  <span className="text-slate-600">Qualidade:</span>
                                  <span className="ml-1 font-medium">{avaliacao.criterios.qualidade}/5</span>
                                </div>
                                <div>
                                  <span className="text-slate-600">Prazo:</span>
                                  <span className="ml-1 font-medium">{avaliacao.criterios.prazo}/5</span>
                                </div>
                                <div>
                                  <span className="text-slate-600">Preço:</span>
                                  <span className="ml-1 font-medium">{avaliacao.criterios.preco}/5</span>
                                </div>
                                <div>
                                  <span className="text-slate-600">Atendimento:</span>
                                  <span className="ml-1 font-medium">{avaliacao.criterios.atendimento}/5</span>
                                </div>
                              </div>
                            )}
                            
                            {avaliacao.comentario && (
                              <p className="text-slate-600 text-sm italic border-l-2 border-slate-300 pl-3 mt-2">
                                "{avaliacao.comentario}"
                              </p>
                            )}
                            
                            {avaliacao.avaliador && (
                              <p className="text-slate-500 text-xs mt-2">
                                Avaliado por: {avaliacao.avaliador}
                              </p>
                            )}

                            {avaliacao.ordem_compra_id && (
                              <p className="text-slate-500 text-xs">
                                OC vinculada
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-500">
                      <Star className="w-16 h-16 mx-auto mb-4 opacity-30" />
                      <p>Nenhuma avaliação registrada</p>
                      <p className="text-sm text-slate-400 mt-2">
                        Avaliações são criadas automaticamente ao receber Ordens de Compra
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <Star className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>Salve o fornecedor primeiro para gerenciar avaliações</p>
                </div>
              )}
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </>
  );

  if (windowMode) {
    return <div className="w-full h-full flex flex-col bg-white">{content}</div>;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onCloseNorm}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full overflow-hidden flex flex-col p-0">
        {content}
      </DialogContent>
    </Dialog>
  );
}
