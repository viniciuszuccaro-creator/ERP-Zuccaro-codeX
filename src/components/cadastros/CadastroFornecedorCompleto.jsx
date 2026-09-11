import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
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
import { normalizeFornecedorCadastro } from "@/api/localCadastroMasterPolicy";
import { FornecedorContatoEnderecoSection, FornecedorDadosGeraisSection, FornecedorFiscalFinanceiroSection } from "@/components/cadastros/fornecedor/FornecedorFormSections";

const sanitizeText = (value, max = 500) => String(value ?? "").replace(/[<>]/g, "").slice(0, max).trim();
const sanitizeCode = (value, max = 80) => String(value ?? "").replace(/[^0-9A-Za-z_.\-/\s@()+]/g, "").slice(0, max).trim();
const sanitizeEmail = (value) => sanitizeCode(value, 180).toLowerCase();
const toNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const sanitizeDadosBancarios = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if ([value.banco, value.agencia, value.conta, value.tipo_conta].some((field) => field != null && !["string", "number"].includes(typeof field))) return null;
  const normalized = {
    banco: sanitizeText(value.banco, 120),
    agencia: sanitizeCode(value.agencia, 30),
    conta: sanitizeCode(value.conta, 40),
    tipo_conta: sanitizeText(value.tipo_conta || "Corrente", 20)
  };
  return [normalized.banco, normalized.agencia, normalized.conta].some(Boolean) ? normalized : null;
};
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
  const { canCreate, canEdit, canDelete, hasFieldPermission, isAdmin } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || fornecedor?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || fornecedor?.empresa_id || fornecedor?.empresa_dona_id || fornecedor?.group_id);
  const podeCriar = canCreate("Cadastros", "Fornecedor") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "Fornecedor") || canEdit("Cadastros", null);
  const podeExcluir = canDelete("Cadastros", "Fornecedor") || canDelete("Cadastros", null);
  const podeEditarDocumento = isAdmin() || hasFieldPermission("Cadastros", "Pessoas", "Fornecedor", "documento", "editar");
  const podeEditarContato = isAdmin() || hasFieldPermission("Cadastros", "Pessoas", "Fornecedor", "contato", "editar");
  const podeEditarEnderecoCobranca = isAdmin() || hasFieldPermission("Cadastros", "Pessoas", "Fornecedor", "endereco_cobranca", "editar");
  const podeEditarRg = isAdmin() || hasFieldPermission("Cadastros", "Pessoas", "Fornecedor", "rg", "editar");
  const podeEditarSimplesNacional = isAdmin() || hasFieldPermission("Cadastros", "Pessoas", "Fornecedor", "simples_nacional", "editar");
  const podeEditarDadosBancarios = isAdmin() || hasFieldPermission("Cadastros", "Pessoas", "Fornecedor", "dados_bancarios", "editar");

  const [formData, setFormData] = useState(fornecedor || {
    nome: "",
    razao_social: "",
    nome_fantasia: "",
    tipo_pessoa: "Pessoa Juridica",
    cpf_cnpj: "",
    cpf: "",
    cnpj: "",
    rg: "",
    inscricao_estadual: "",
    simples_nacional: false,
    rntrc: "",
    email: "",
    telefone: "",
    whatsapp: "",
    contato_responsavel: "",
    endereco: "",
    bairro: "",
    cidade: "",
    estado: "",
    cep: "",
    website: "",
    endereco_cobranca: { endereco: "", bairro: "", cidade: "", estado: "", cep: "" },
    dados_bancarios: { banco: "", agencia: "", conta: "", tipo_conta: "Corrente" },
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

  const buildPayload = (data = formData) => {
    const enderecoCobranca = data.endereco_cobranca || {};
    const dadosBancarios = sanitizeDadosBancarios(data.dados_bancarios);
    const payload = {
    ...data,
    nome: sanitizeText(data.nome, 180),
    razao_social: sanitizeText(data.razao_social, 180),
    nome_fantasia: sanitizeText(data.nome_fantasia, 180),
    tipo_pessoa: sanitizeText(data.tipo_pessoa || "Pessoa Juridica", 30),
    cpf_cnpj: sanitizeCode(data.cpf_cnpj || data.cpf || data.cnpj, 24),
    cpf: sanitizeCode(data.cpf, 18),
    cnpj: sanitizeCode(data.cnpj, 24),
    rg: data.tipo_pessoa === "Pessoa Fisica" ? sanitizeCode(data.rg, 30) : "",
    inscricao_estadual: sanitizeCode(data.inscricao_estadual, 40),
    simples_nacional: Boolean(data.simples_nacional),
    rntrc: sanitizeCode(data.rntrc, 40),
    email: sanitizeEmail(data.email),
    telefone: sanitizeCode(data.telefone, 40),
    whatsapp: sanitizeCode(data.whatsapp, 40),
    contato_responsavel: sanitizeText(data.contato_responsavel, 180),
    endereco: sanitizeText(data.endereco, 300),
    bairro: sanitizeText(data.bairro, 120),
    cidade: sanitizeText(data.cidade, 120),
    estado: sanitizeCode(data.estado, 2),
    cep: sanitizeCode(data.cep, 12),
    website: sanitizeText(data.website, 240),
    endereco_cobranca: {
      endereco: sanitizeText(enderecoCobranca.endereco, 300),
      bairro: sanitizeText(enderecoCobranca.bairro, 120),
      cidade: sanitizeText(enderecoCobranca.cidade, 120),
      estado: sanitizeCode(enderecoCobranca.estado, 2).toUpperCase(),
      cep: sanitizeCode(enderecoCobranca.cep, 12),
    },
    dados_bancarios: dadosBancarios,
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
    };
    if (!podeEditarDocumento) ['tipo_pessoa', 'cpf_cnpj', 'cpf', 'cnpj', 'inscricao_estadual'].forEach((field) => delete payload[field]);
    if (!podeEditarContato) ['bairro', 'website'].forEach((field) => delete payload[field]);
    if (!podeEditarEnderecoCobranca) delete payload.endereco_cobranca;
    if (!podeEditarRg) delete payload.rg;
    if (!podeEditarSimplesNacional) delete payload.simples_nacional;
    if (!podeEditarDadosBancarios || !dadosBancarios) delete payload.dados_bancarios;
    return normalizeFornecedorCadastro(payload);
  };

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
      tipo_pessoa: "Pessoa Juridica",
      cpf_cnpj: dados.cnpj || formData.cpf_cnpj || formData.cnpj,
      cpf: "",
      cnpj: dados.cnpj || formData.cnpj,
      inscricao_estadual: dados.inscricao_estadual || formData.inscricao_estadual,
      cnae_principal: dados.cnae_principal || formData.cnae_principal,
      ramo_atividade: dados.cnae_principal || formData.ramo_atividade,
      status_fiscal_receita: dados.situacao_cadastral || "Não Verificado",
      endereco: dados.endereco_completo?.logradouro 
        ? `${dados.endereco_completo.logradouro}, ${dados.endereco_completo.numero || 'S/N'}${dados.endereco_completo.complemento ? ', ' + dados.endereco_completo.complemento : ''}, ${dados.endereco_completo.bairro || ''}`
        : formData.endereco,
      bairro: dados.endereco_completo?.bairro || formData.bairro,
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
      bairro: dados.bairro || formData.bairro,
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
              <FornecedorDadosGeraisSection
                formData={formData}
                setFormData={setFormData}
                fornecedor={fornecedor}
                handleDadosCNPJ={handleDadosCNPJ}
                handleDadosRNTRC={handleDadosRNTRC}
                canEditDocument={podeEditarDocumento}
              />
              <FornecedorFiscalFinanceiroSection
                formData={formData}
                setFormData={setFormData}
                canEditRg={podeEditarRg}
                canEditSimplesNacional={podeEditarSimplesNacional}
                canEditBankData={podeEditarDadosBancarios}
              />
            </TabsContent>

            <TabsContent value="contato" className="space-y-6 m-0 mt-4">
              <FornecedorContatoEnderecoSection
                formData={formData}
                setFormData={setFormData}
                handleDadosCEP={handleDadosCEP}
                canEditContact={podeEditarContato}
                canEditBilling={podeEditarEnderecoCobranca}
              />
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
