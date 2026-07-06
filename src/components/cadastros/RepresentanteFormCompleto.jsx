import React, { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Users, 
  Save, 
  Trash2, 
  Power, 
  PowerOff,
  DollarSign,
  Building2,
  Phone,
  MapPin,
  TrendingUp,
  Award,
  Target
} from "lucide-react";
import FormWrapper from "@/components/common/FormWrapper";
import { useToast } from "@/components/ui/use-toast";
import { BotaoBuscaAutomatica } from "@/components/lib/BuscaDadosPublicos";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

const sanitizeText = (value, max = 500) => String(value ?? "").replace(/[<>]/g, "").slice(0, max).trim();
const sanitizeCode = (value, max = 80) => String(value ?? "").replace(/[^0-9A-Za-z_.\-/\s@()+]/g, "").slice(0, max).trim();
const toNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const sanitizeEndereco = (endereco = {}) => ({
  ...endereco,
  cep: sanitizeCode(endereco.cep, 12),
  logradouro: sanitizeText(endereco.logradouro, 180),
  numero: sanitizeCode(endereco.numero, 30),
  bairro: sanitizeText(endereco.bairro, 120),
  cidade: sanitizeText(endereco.cidade, 120),
  estado: sanitizeCode(endereco.estado, 2)
});
const sanitizeDadosBancarios = (dados = {}) => ({
  ...dados,
  banco: sanitizeText(dados.banco, 120),
  agencia: sanitizeCode(dados.agencia, 30),
  conta: sanitizeCode(dados.conta, 40),
  tipo_conta: sanitizeText(dados.tipo_conta || "Corrente", 40),
  pix_chave: sanitizeText(dados.pix_chave, 180),
  tipo_pix: sanitizeText(dados.tipo_pix || "CPF", 40)
});

export default function RepresentanteFormCompleto({ representante: representanteProp, item, data, initialData, defaultValues, isOpen, onClose, onSuccess, windowMode = false, onSave, onSubmit }) {
  const representante = representanteProp || item || data || initialData || defaultValues || null;
  const onCloseNorm = onClose || onSave || onSubmit;
  const [activeTab, setActiveTab] = useState("dados-gerais");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    empresaAtual,
    grupoAtual,
    filterInContext,
    createInContext,
    updateInContext,
    deleteInContext
  } = useContextoVisual();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || representante?.group_id || null;
  const contextKey = empresaAtual?.id || groupId || "sem-contexto";
  const contextoValido = Boolean(empresaAtual?.id || groupId || representante?.empresa_id || representante?.group_id);
  const podeCriar = canCreate("Cadastros", "Representante") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "Representante") || canEdit("Cadastros", null);
  const podeExcluir = canDelete("Cadastros", "Representante") || canDelete("Cadastros", null);

  const [formData, setFormData] = useState(representante || {
    tipo_pessoa: "Pessoa Física",
    tipo_representante: "Representante Comercial",
    nome: "",
    razao_social: "",
    cpf: "",
    cnpj: "",
    crea_cau: "",
    registro_profissional: "",
    email: "",
    telefone: "",
    whatsapp: "",
    endereco: {
      cep: "",
      logradouro: "",
      numero: "",
      bairro: "",
      cidade: "",
      estado: ""
    },
    regioes_atendimento: [],
    tipo_comissao: "Percentual",
    percentual_comissao: 0,
    valor_fixo_comissao: 0,
    percentual_cashback: 0,
    limite_mensal_comissao: 0,
    forma_pagamento_comissao: "PIX",
    dados_bancarios: {
      banco: "",
      agencia: "",
      conta: "",
      tipo_conta: "Corrente",
      pix_chave: "",
      tipo_pix: "CPF"
    },
    data_inicio_contrato: "",
    data_fim_contrato: "",
    status: "Ativo",
    observacoes: "",
    empresa_id: empresaAtual?.id,
    group_id: groupId
  });

  const buildPayload = (data = formData) => ({
    ...data,
    tipo_pessoa: sanitizeText(data.tipo_pessoa || "Pessoa Fisica", 60),
    tipo_representante: sanitizeText(data.tipo_representante || "Representante Comercial", 100),
    nome: sanitizeText(data.nome, 180),
    razao_social: sanitizeText(data.razao_social, 180),
    cpf: sanitizeCode(data.cpf, 18),
    cnpj: sanitizeCode(data.cnpj, 24),
    crea_cau: sanitizeCode(data.crea_cau, 40),
    registro_profissional: sanitizeCode(data.registro_profissional, 80),
    email: sanitizeText(data.email, 180).toLowerCase(),
    telefone: sanitizeCode(data.telefone, 40),
    whatsapp: sanitizeCode(data.whatsapp, 40),
    endereco: sanitizeEndereco(data.endereco),
    regioes_atendimento: Array.isArray(data.regioes_atendimento)
      ? data.regioes_atendimento.slice(0, 100).map((id) => sanitizeCode(id, 120)).filter(Boolean)
      : [],
    tipo_comissao: sanitizeText(data.tipo_comissao || "Percentual", 60),
    percentual_comissao: toNumber(data.percentual_comissao, 0),
    valor_fixo_comissao: toNumber(data.valor_fixo_comissao, 0),
    percentual_cashback: toNumber(data.percentual_cashback, 0),
    limite_mensal_comissao: toNumber(data.limite_mensal_comissao, 0),
    forma_pagamento_comissao: sanitizeText(data.forma_pagamento_comissao || "PIX", 60),
    dados_bancarios: sanitizeDadosBancarios(data.dados_bancarios),
    data_inicio_contrato: sanitizeCode(data.data_inicio_contrato, 20),
    data_fim_contrato: sanitizeCode(data.data_fim_contrato, 20),
    status: sanitizeText(data.status || "Ativo", 40),
    observacoes: sanitizeText(data.observacoes, 2000),
    empresa_id: data.empresa_id || empresaAtual?.id,
    group_id: data.group_id || groupId
  });

  const { data: regioes = [] } = useQuery({
    queryKey: ['regioes', contextKey],
    queryFn: () => filterInContext('RegiaoAtendimento', {}, 'nome', 200),
    enabled: contextoValido,
  });

  const { data: clientesIndicados = [] } = useQuery({
    queryKey: ['clientes-indicados', representante?.id, contextKey],
    queryFn: () => filterInContext('Cliente', { indicador_id: representante.id }, 'nome', 200),
    enabled: !!representante?.id && contextoValido
  });

  const { data: pedidosIndicados = [] } = useQuery({
    queryKey: ['pedidos-indicados', representante?.id, contextKey],
    queryFn: () => filterInContext('Pedido', { indicador_id: representante.id }, '-created_date', 200),
    enabled: !!representante?.id && contextoValido
  });

  useEffect(() => {
    if (representante) {
      setFormData({
        ...representante,
        endereco: representante.endereco || {},
        dados_bancarios: representante.dados_bancarios || {},
        regioes_atendimento: representante.regioes_atendimento || []
      });
    }
  }, [representante?.id]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (!contextoValido) {
        throw new Error("Selecione um grupo ou empresa antes de salvar o representante.");
      }
      const payload = buildPayload(data);

      if (representante?.id) {
        if (!podeEditar) throw new Error("Seu perfil nao permite editar representantes.");
        return updateInContext('Representante', representante.id, payload);
      }
      if (!podeCriar) throw new Error("Seu perfil nao permite criar representantes.");
      return createInContext('Representante', payload);
    },
    onSuccess: (_result, savedPayload) => {
      queryClient.invalidateQueries({ queryKey: ['representantes'] });
      toast({ title: `✅ Representante ${representante?.id ? 'atualizado' : 'criado'} com sucesso!` });
      if (onSuccess) onSuccess();
      if (onSubmit) onSubmit(savedPayload || buildPayload(formData));
      if (onCloseNorm) onCloseNorm();
    },
    onError: (error) => {
      toast({ title: "❌ Erro ao salvar", description: error.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => {
      if (!contextoValido) throw new Error("Selecione um grupo ou empresa antes de excluir representantes.");
      if (!podeExcluir) throw new Error("Seu perfil nao permite excluir representantes.");
      return deleteInContext('Representante', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['representantes'] });
      toast({ title: "✅ Representante excluído!" });
      if (onSuccess) onSuccess();
      if (onCloseNorm) onCloseNorm();
    }
  });

  const handleSave = () => saveMutation.mutate(buildPayload(formData));
  const handleExcluir = () => {
    if (window.confirm(`Excluir "${formData.nome}"?`)) {
      deleteMutation.mutate(representante.id);
    }
  };
  const handleAlternarStatus = () => {
    if (!podeEditar) {
      toast({ title: "Seu perfil nao permite alterar status de representantes.", variant: "destructive" });
      return;
    }
    if (!contextoValido) {
      toast({ title: "Selecione grupo ou empresa antes de alterar status.", variant: "destructive" });
      return;
    }
    setFormData({ ...formData, status: formData.status === 'Ativo' ? 'Inativo' : 'Ativo' });
  };

  const handleDadosCNPJ = (dados) => {
    setFormData(prev => ({
      ...prev,
      nome: dados.razao_social || prev.nome,
      razao_social: dados.razao_social || "",
      endereco: {
        ...prev.endereco,
        cep: dados.endereco_completo?.cep || prev.endereco.cep,
        logradouro: dados.endereco_completo?.logradouro || prev.endereco.logradouro,
        numero: dados.endereco_completo?.numero || prev.endereco.numero,
        bairro: dados.endereco_completo?.bairro || prev.endereco.bairro,
        cidade: dados.endereco_completo?.cidade || prev.endereco.cidade,
        estado: dados.endereco_completo?.uf || prev.endereco.estado
      }
    }));
    toast({ title: "✅ Dados da Receita Federal preenchidos!" });
  };

  const handleDadosCEP = (dados) => {
    setFormData(prev => ({
      ...prev,
      endereco: {
        ...prev.endereco,
        logradouro: dados.logradouro || "",
        bairro: dados.bairro || "",
        cidade: dados.cidade || "",
        estado: dados.uf || ""
      }
    }));
    toast({ title: "✅ Endereço preenchido!" });
  };

  const calcularTotais = () => {
    const totalVendas = pedidosIndicados.reduce((sum, p) => sum + (p.valor_total || 0), 0);
    const totalComissao = pedidosIndicados.reduce((sum, p) => {
      const valor = p.valor_total || 0;
      const percentual = formData.percentual_comissao || 0;
      return sum + (valor * percentual / 100);
    }, 0);
    
    return { totalVendas, totalComissao, quantidadePedidos: pedidosIndicados.length };
  };

  const totais = representante?.id ? calcularTotais() : { totalVendas: 0, totalComissao: 0, quantidadePedidos: 0 };

  const content = (
    <FormWrapper onSubmit={handleSave} externalData={formData}>
      <div className="border-b pb-4 px-6 pt-6 flex-shrink-0 bg-white sticky top-0 z-10">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6 text-purple-600" />
              {representante?.id ? 'Editar Representante' : 'Novo Representante'}
            </h2>
            {representante?.id && (
              <div className="flex items-center gap-2 mt-2">
                <Badge className={formData.status === 'Ativo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                  {formData.status}
                </Badge>
                <Badge variant="outline">{formData.tipo_representante}</Badge>
                {formData.tipo_pessoa === 'Pessoa Física' && formData.cpf && (
                  <span className="text-sm text-slate-600">{formData.cpf}</span>
                )}
                {formData.tipo_pessoa === 'Pessoa Jurídica' && formData.cnpj && (
                  <span className="text-sm text-slate-600">{formData.cnpj}</span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {representante?.id && (
              <>
                <Button
                  variant="outline"
                  onClick={handleAlternarStatus}
                  disabled={!podeEditar || !contextoValido}
                  data-permission="Cadastros.Representante.alterarStatus"
                  data-sensitive
                  className={formData.status === 'Ativo' ? 'border-orange-300' : 'border-green-300'}
                >
                  {formData.status === 'Ativo' ? <><PowerOff className="w-4 h-4 mr-2" />Inativar</> : <><Power className="w-4 h-4 mr-2" />Ativar</>}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleExcluir}
                  disabled={deleteMutation.isPending || !podeExcluir || !contextoValido}
                  data-permission="Cadastros.Representante.excluir"
                  data-sensitive
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
                </Button>
              </>
            )}
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending || !contextoValido || (representante?.id ? !podeEditar : !podeCriar)}
              data-permission="Cadastros.Representante.salvar"
              data-sensitive
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Save className="w-4 h-4 mr-2" />
              {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-5 flex-shrink-0 px-6 bg-slate-50">
          <TabsTrigger value="dados-gerais"><Users className="w-3 h-3 mr-1" />Dados Gerais</TabsTrigger>
          <TabsTrigger value="comissao"><DollarSign className="w-3 h-3 mr-1" />Comissão</TabsTrigger>
          <TabsTrigger value="pagamento"><Building2 className="w-3 h-3 mr-1" />Pagamento</TabsTrigger>
          <TabsTrigger value="performance" disabled={!representante?.id}><TrendingUp className="w-3 h-3 mr-1" />Performance</TabsTrigger>
          <TabsTrigger value="clientes" disabled={!representante?.id}><Target className="w-3 h-3 mr-1" />Clientes</TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          <div className="px-6 pb-6">
            <TabsContent value="dados-gerais" className="space-y-4 m-0 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo de Pessoa *</Label>
                  <Select value={formData.tipo_pessoa} onValueChange={(v) => setFormData({ ...formData, tipo_pessoa: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[99999]">
                      <SelectItem value="Pessoa Física">Pessoa Física</SelectItem>
                      <SelectItem value="Pessoa Jurídica">Pessoa Jurídica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Tipo de Representante *</Label>
                  <Select value={formData.tipo_representante} onValueChange={(v) => setFormData({ ...formData, tipo_representante: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[99999]">
                      <SelectItem value="Representante Comercial">🤝 Representante Comercial</SelectItem>
                      <SelectItem value="Construtor">🏗️ Construtor</SelectItem>
                      <SelectItem value="Arquiteto">📐 Arquiteto</SelectItem>
                      <SelectItem value="Engenheiro">⚙️ Engenheiro</SelectItem>
                      <SelectItem value="Influenciador">📱 Influenciador</SelectItem>
                      <SelectItem value="Parceiro">🤝 Parceiro</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <Label>Nome / Razão Social *</Label>
                  <Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} required />
                </div>

                {formData.tipo_pessoa === "Pessoa Jurídica" && (
                  <>
                    <div>
                      <Label>Razão Social</Label>
                      <Input value={formData.razao_social} onChange={(e) => setFormData({ ...formData, razao_social: e.target.value })} />
                    </div>
                    <div>
                      <Label>CNPJ</Label>
                      <Input value={formData.cnpj} onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
                    </div>
                    <div className="col-span-2">
                      <BotaoBuscaAutomatica tipo="cnpj" valor={formData.cnpj} onDadosEncontrados={handleDadosCNPJ} disabled={!formData.cnpj || formData.cnpj.replace(/\D/g, '').length < 14} />
                    </div>
                  </>
                )}

                {formData.tipo_pessoa === "Pessoa Física" && (
                  <>
                    <div>
                      <Label>CPF</Label>
                      <Input value={formData.cpf} onChange={(e) => setFormData({ ...formData, cpf: e.target.value })} placeholder="000.000.000-00" />
                    </div>
                    <div>
                      <Label>&nbsp;</Label>
                      <BotaoBuscaAutomatica tipo="cpf" valor={formData.cpf} onDadosEncontrados={(dados) => {
                        if (dados.valido) {
                          setFormData({ ...formData, cpf: dados.formatado });
                          toast({ title: "✅ CPF validado!" });
                        }
                      }} disabled={!formData.cpf || formData.cpf.replace(/\D/g, '').length < 11} />
                    </div>
                  </>
                )}

                {(formData.tipo_representante === 'Arquiteto' || formData.tipo_representante === 'Engenheiro') && (
                  <>
                    <div>
                      <Label>CREA / CAU</Label>
                      <Input value={formData.crea_cau} onChange={(e) => setFormData({ ...formData, crea_cau: e.target.value })} placeholder="Número do registro profissional" />
                    </div>
                    <div>
                      <Label>Registro Profissional</Label>
                      <Input value={formData.registro_profissional} onChange={(e) => setFormData({ ...formData, registro_profissional: e.target.value })} />
                    </div>
                  </>
                )}

                <div>
                  <Label>E-mail</Label>
                  <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>

                <div>
                  <Label>Telefone</Label>
                  <Input value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} />
                </div>

                <div className="col-span-2">
                  <Label>WhatsApp</Label>
                  <Input value={formData.whatsapp} onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })} placeholder="(00) 00000-0000" />
                </div>

                <div className="col-span-2 pt-4 border-t">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Endereço
                  </h3>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <Label>CEP</Label>
                      <Input value={formData.endereco?.cep || ""} onChange={(e) => setFormData({ ...formData, endereco: { ...formData.endereco, cep: e.target.value } })} />
                    </div>
                    <div>
                      <Label>&nbsp;</Label>
                      <BotaoBuscaAutomatica tipo="cep" valor={formData.endereco?.cep} onDadosEncontrados={handleDadosCEP} disabled={!formData.endereco?.cep || formData.endereco.cep.replace(/\D/g, '').length < 8} />
                    </div>
                    <div className="col-span-2">
                      <Label>Logradouro</Label>
                      <Input value={formData.endereco?.logradouro || ""} onChange={(e) => setFormData({ ...formData, endereco: { ...formData.endereco, logradouro: e.target.value } })} />
                    </div>
                    <div>
                      <Label>Número</Label>
                      <Input value={formData.endereco?.numero || ""} onChange={(e) => setFormData({ ...formData, endereco: { ...formData.endereco, numero: e.target.value } })} />
                    </div>
                    <div>
                      <Label>Bairro</Label>
                      <Input value={formData.endereco?.bairro || ""} onChange={(e) => setFormData({ ...formData, endereco: { ...formData.endereco, bairro: e.target.value } })} />
                    </div>
                    <div>
                      <Label>Cidade</Label>
                      <Input value={formData.endereco?.cidade || ""} onChange={(e) => setFormData({ ...formData, endereco: { ...formData.endereco, cidade: e.target.value } })} />
                    </div>
                    <div>
                      <Label>UF</Label>
                      <Input value={formData.endereco?.estado || ""} onChange={(e) => setFormData({ ...formData, endereco: { ...formData.endereco, estado: e.target.value } })} maxLength={2} />
                    </div>
                  </div>
                </div>

                <div className="col-span-2">
                  <Label>Regiões de Atendimento</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {regioes.filter(r => r.ativo).map(regiao => {
                      const selecionada = (formData.regioes_atendimento || []).includes(regiao.id);
                      return (
                        <Badge
                          key={regiao.id}
                          variant={selecionada ? "default" : "outline"}
                          className={`cursor-pointer ${selecionada ? 'bg-purple-600' : ''}`}
                          onClick={() => {
                            const atual = formData.regioes_atendimento || [];
                            setFormData({
                              ...formData,
                              regioes_atendimento: selecionada
                                ? atual.filter(id => id !== regiao.id)
                                : [...atual, regiao.id]
                            });
                          }}
                        >
                          {regiao.nome_regiao}
                        </Badge>
                      );
                    })}
                  </div>
                </div>

                <div className="col-span-2">
                  <Label>Observações</Label>
                  <Textarea value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} rows={3} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="comissao" className="space-y-4 m-0 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo de Comissão *</Label>
                  <Select value={formData.tipo_comissao} onValueChange={(v) => setFormData({ ...formData, tipo_comissao: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[99999]">
                      <SelectItem value="Percentual">📊 Percentual sobre venda</SelectItem>
                      <SelectItem value="Valor Fixo por Venda">💵 Valor fixo por venda</SelectItem>
                      <SelectItem value="Cashback Percentual">💰 Cashback % (Construtor/Arquiteto)</SelectItem>
                      <SelectItem value="Cashback Fixo">🎁 Cashback fixo por venda</SelectItem>
                      <SelectItem value="Misto">🔀 Misto (% + fixo)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Status do Contrato</Label>
                  <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[99999]">
                      <SelectItem value="Ativo">✅ Ativo</SelectItem>
                      <SelectItem value="Inativo">❌ Inativo</SelectItem>
                      <SelectItem value="Suspenso">⏸️ Suspenso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(formData.tipo_comissao === 'Percentual' || formData.tipo_comissao === 'Misto' || formData.tipo_comissao === 'Cashback Percentual') && (
                  <div>
                    <Label>Percentual de Comissão (%)</Label>
                    <Input type="number" step="0.01" min="0" max="100" value={formData.percentual_comissao} onChange={(e) => setFormData({ ...formData, percentual_comissao: parseFloat(e.target.value) || 0 })} />
                  </div>
                )}

                {(formData.tipo_comissao === 'Valor Fixo por Venda' || formData.tipo_comissao === 'Misto' || formData.tipo_comissao === 'Cashback Fixo') && (
                  <div>
                    <Label>Valor Fixo por Venda (R$)</Label>
                    <Input type="number" step="0.01" min="0" value={formData.valor_fixo_comissao} onChange={(e) => setFormData({ ...formData, valor_fixo_comissao: parseFloat(e.target.value) || 0 })} />
                  </div>
                )}

                {formData.tipo_comissao.includes('Cashback') && (
                  <div>
                    <Label>Cashback Adicional (%)</Label>
                    <Input type="number" step="0.01" min="0" max="100" value={formData.percentual_cashback} onChange={(e) => setFormData({ ...formData, percentual_cashback: parseFloat(e.target.value) || 0 })} />
                    <p className="text-xs text-slate-500 mt-1">Cashback cumulativo com comissão</p>
                  </div>
                )}

                <div>
                  <Label>Limite Mensal de Comissão (R$)</Label>
                  <Input type="number" step="0.01" min="0" value={formData.limite_mensal_comissao} onChange={(e) => setFormData({ ...formData, limite_mensal_comissao: parseFloat(e.target.value) || 0 })} placeholder="0 = sem limite" />
                  <p className="text-xs text-slate-500 mt-1">0 = sem limite</p>
                </div>

                <div>
                  <Label>Vigência do Contrato - Início</Label>
                  <Input type="date" value={formData.data_inicio_contrato} onChange={(e) => setFormData({ ...formData, data_inicio_contrato: e.target.value })} />
                </div>

                <div>
                  <Label>Vigência do Contrato - Fim</Label>
                  <Input type="date" value={formData.data_fim_contrato} onChange={(e) => setFormData({ ...formData, data_fim_contrato: e.target.value })} />
                </div>

                <div className="col-span-2">
                  <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
                    <CardContent className="p-4">
                      <h4 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                        <Award className="w-4 h-4" />
                        Simulação de Comissão
                      </h4>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-xs text-slate-600">Venda de R$ 10.000</p>
                          <p className="text-lg font-bold text-purple-600">
                            R$ {((10000 * (formData.percentual_comissao || 0) / 100) + (formData.valor_fixo_comissao || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600">Venda de R$ 50.000</p>
                          <p className="text-lg font-bold text-purple-600">
                            R$ {((50000 * (formData.percentual_comissao || 0) / 100) + (formData.valor_fixo_comissao || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600">Venda de R$ 100.000</p>
                          <p className="text-lg font-bold text-purple-600">
                            R$ {((100000 * (formData.percentual_comissao || 0) / 100) + (formData.valor_fixo_comissao || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="pagamento" className="space-y-4 m-0 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Forma de Pagamento Preferencial</Label>
                  <Select value={formData.forma_pagamento_comissao} onValueChange={(v) => setFormData({ ...formData, forma_pagamento_comissao: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[99999]">
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="Transferência">Transferência</SelectItem>
                      <SelectItem value="Boleto">Boleto</SelectItem>
                      <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="Crédito em Conta">Crédito em Conta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Tipo de Chave PIX</Label>
                  <Select value={formData.dados_bancarios?.tipo_pix || "CPF"} onValueChange={(v) => setFormData({ ...formData, dados_bancarios: { ...formData.dados_bancarios, tipo_pix: v } })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[99999]">
                      <SelectItem value="CPF">CPF</SelectItem>
                      <SelectItem value="CNPJ">CNPJ</SelectItem>
                      <SelectItem value="E-mail">E-mail</SelectItem>
                      <SelectItem value="Telefone">Telefone</SelectItem>
                      <SelectItem value="Aleatória">Aleatória</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <Label>Chave PIX</Label>
                  <Input value={formData.dados_bancarios?.pix_chave || ""} onChange={(e) => setFormData({ ...formData, dados_bancarios: { ...formData.dados_bancarios, pix_chave: e.target.value } })} placeholder="Digite a chave PIX" />
                </div>

                <div>
                  <Label>Banco</Label>
                  <Input value={formData.dados_bancarios?.banco || ""} onChange={(e) => setFormData({ ...formData, dados_bancarios: { ...formData.dados_bancarios, banco: e.target.value } })} placeholder="Ex: 001 - Banco do Brasil" />
                </div>

                <div>
                  <Label>Agência</Label>
                  <Input value={formData.dados_bancarios?.agencia || ""} onChange={(e) => setFormData({ ...formData, dados_bancarios: { ...formData.dados_bancarios, agencia: e.target.value } })} />
                </div>

                <div>
                  <Label>Conta</Label>
                  <Input value={formData.dados_bancarios?.conta || ""} onChange={(e) => setFormData({ ...formData, dados_bancarios: { ...formData.dados_bancarios, conta: e.target.value } })} />
                </div>

                <div>
                  <Label>Tipo de Conta</Label>
                  <Select value={formData.dados_bancarios?.tipo_conta || "Corrente"} onValueChange={(v) => setFormData({ ...formData, dados_bancarios: { ...formData.dados_bancarios, tipo_conta: v } })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[99999]">
                      <SelectItem value="Corrente">Corrente</SelectItem>
                      <SelectItem value="Poupança">Poupança</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="performance" className="space-y-4 m-0 mt-4">
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Target className="w-4 h-4 text-blue-600" />
                      Clientes Indicados
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-blue-600">{clientesIndicados.length}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      Total em Vendas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-green-600">
                      R$ {totais.totalVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{totais.quantidadePedidos} pedidos</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-purple-600" />
                      Comissão Gerada
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-purple-600">
                      R$ {totais.totalComissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {representante?.id && (
                <>
                  <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                    <CardHeader>
                      <CardTitle className="text-sm">Performance Detalhada</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-slate-600">Total Vendas Indicadas:</p>
                          <p className="font-bold">R$ {(formData.total_vendas_indicadas || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div>
                          <p className="text-slate-600">Total Comissão Gerada:</p>
                          <p className="font-bold text-purple-600">R$ {(formData.total_comissao_gerada || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div>
                          <p className="text-slate-600">Comissão Paga:</p>
                          <p className="font-bold text-green-600">R$ {(formData.total_comissao_paga || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div>
                          <p className="text-slate-600">Comissão Pendente:</p>
                          <p className="font-bold text-orange-600">R$ {(formData.total_comissao_pendente || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            <TabsContent value="clientes" className="space-y-4 m-0 mt-4">
              {clientesIndicados.length > 0 ? (
                <div className="space-y-2">
                  {clientesIndicados.map(cliente => (
                    <Card key={cliente.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">{cliente.nome}</p>
                            <p className="text-sm text-slate-600">
                              {cliente.tipo === 'Pessoa Física' ? cliente.cpf : cliente.cnpj}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge className={cliente.status === 'Ativo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                              {cliente.status}
                            </Badge>
                            {cliente.data_primeira_compra && (
                              <p className="text-xs text-slate-500 mt-1">
                                Cliente desde {new Date(cliente.data_primeira_compra).toLocaleDateString('pt-BR')}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <Target className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>Nenhum cliente indicado ainda</p>
                </div>
              )}
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </FormWrapper>
  );

  if (windowMode) {
    return <div className="w-full h-full flex flex-col bg-white">{content}</div>;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onCloseNorm}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] flex flex-col p-0 overflow-hidden">
        {content}
      </DialogContent>
    </Dialog>
  );
}
