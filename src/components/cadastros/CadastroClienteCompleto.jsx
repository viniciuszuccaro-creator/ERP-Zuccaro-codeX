import React, { useState, useEffect, Suspense } from "react";
import { base44 } from "@/api/base44Client";
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
import { Card, CardContent } from "@/components/ui/card";
import {
  User,
  Building2,
  Phone,
  MapPin,
  DollarSign,
  FileText,
  Clock,
  Paperclip,
  Save,
  AlertCircle,
  ExternalLink,
  Trash2,
  Power,
  PowerOff
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import GerenciarContatosClienteForm from "./GerenciarContatosClienteForm";
import GerenciarEnderecosClienteForm from "./GerenciarEnderecosClienteForm";

import { BotaoBuscaAutomatica } from "@/components/lib/BuscaDadosPublicos";
const HistoricoOrigemCliente = React.lazy(() => import("@/components/comercial/HistoricoOrigemCliente"));

const TimelineCliente = React.lazy(() => import("@/components/cliente/TimelineCliente").then(m => ({ default: m.default || m.TimelineCliente })));
const ResumoHistorico = React.lazy(() => import("@/components/cliente/TimelineCliente").then(m => ({ default: m.ResumoHistorico })));

const sanitizeText = (value, max = 500) => String(value ?? "").replace(/[<>]/g, "").slice(0, max).trim();
const sanitizeCode = (value, max = 80) => String(value ?? "").replace(/[^0-9A-Za-z_.\-/\s@()+]/g, "").slice(0, max).trim();
const sanitizeBoolean = (value) => Boolean(value);
const toNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const sanitizeEndereco = (endereco = {}) => ({
  ...endereco,
  cep: sanitizeCode(endereco.cep, 12),
  logradouro: sanitizeText(endereco.logradouro, 180),
  numero: sanitizeCode(endereco.numero, 30),
  complemento: sanitizeText(endereco.complemento, 120),
  bairro: sanitizeText(endereco.bairro, 120),
  cidade: sanitizeText(endereco.cidade, 120),
  estado: sanitizeCode(endereco.estado, 2),
  latitude: endereco.latitude === null || endereco.latitude === undefined ? null : toNumber(endereco.latitude, null),
  longitude: endereco.longitude === null || endereco.longitude === undefined ? null : toNumber(endereco.longitude, null),
  mapa_url: sanitizeText(endereco.mapa_url, 300)
});
const sanitizeContatos = (contatos) => Array.isArray(contatos) ? contatos.slice(0, 50).map((contato) => ({
  ...contato,
  tipo: sanitizeText(contato?.tipo, 60),
  valor: sanitizeText(contato?.valor, 180),
  principal: sanitizeBoolean(contato?.principal)
})) : [];
const sanitizeDocumentos = (documentos) => Array.isArray(documentos) ? documentos.slice(0, 100).map((doc) => ({
  ...doc,
  nome_arquivo: sanitizeText(doc?.nome_arquivo, 180),
  tipo: sanitizeText(doc?.tipo, 80),
  url_arquivo: sanitizeText(doc?.url_arquivo, 500),
  upload_por: sanitizeText(doc?.upload_por, 180)
})) : [];

export default function CadastroClienteCompleto({ cliente: clienteProp, item, data, initialData, defaultValues, isOpen, onClose, onSuccess, windowMode = false, onSubmit, onSave }) {
  // Normaliza: aceita tanto "cliente" (legado) quanto "item"/"data" (novo Visualizador)
  const cliente = clienteProp || item || data || initialData || defaultValues || null;
  const onCloseNorm = onClose || onSave || onSubmit;
  const [activeTab, setActiveTab] = useState("dados-gerais");
  const [isSaving, setIsSaving] = useState(false);

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
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || cliente?.group_id || null;
  const contextKey = empresaAtual?.id || groupId || "sem-contexto";
  const contextoValido = Boolean(empresaAtual?.id || groupId || cliente?.empresa_id || cliente?.group_id);
  const podeCriar = canCreate("Cadastros", "Cliente") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "Cliente") || canEdit("Cadastros", null);
  const podeExcluir = canDelete("Cadastros", "Cliente") || canDelete("Cadastros", null);

  const [formData, setFormData] = useState(cliente || {
    tipo: "Pessoa Física",
    status: "Prospect",
    nome: "",
    razao_social: "",
    nome_fantasia: "",
    cpf: "",
    cnpj: "",
    rg: "",
    inscricao_estadual: "",
    inscricao_municipal: "",
    regiao_atendimento: "Sudeste",
    endereco_principal: {
      cep: "",
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      estado: "",
      latitude: null,
      longitude: null,
      mapa_url: ""
    },
    contatos: [],
    locais_entrega: [],
    condicao_comercial: {
      tabela_preco_id: "",
      forma_pagamento_padrao_id: "",
      percentual_desconto: 0,
      condicao_pagamento: "À Vista",
      limite_credito: 0,
      limite_credito_utilizado: 0,
      situacao_credito: "OK"
    },
    configuracao_fiscal: {
      regime_tributario: "Simples Nacional",
      cfop_padrao_venda: "5102",
      contribuinte_icms: true,
      tipo_contribuinte: "1 - Contribuinte",
      isento_ipi: false,
      isento_icms: false
    },
    documentos: [],
    vendedor_responsavel: "",
    vendedor_responsavel_id: "",
    observacoes: "",
    empresa_id: empresaAtual?.id,
    group_id: groupId
  });

  const buildPayload = (data = formData) => ({
    ...data,
    tipo: sanitizeText(data.tipo || "Pessoa Fisica", 40),
    status: sanitizeText(data.status || "Prospect", 40),
    nome: sanitizeText(data.nome, 180),
    razao_social: sanitizeText(data.razao_social, 180),
    nome_fantasia: sanitizeText(data.nome_fantasia, 180),
    cpf: sanitizeCode(data.cpf, 18),
    cnpj: sanitizeCode(data.cnpj, 24),
    rg: sanitizeCode(data.rg, 30),
    inscricao_estadual: sanitizeCode(data.inscricao_estadual, 40),
    inscricao_municipal: sanitizeCode(data.inscricao_municipal, 40),
    regiao_atendimento: sanitizeText(data.regiao_atendimento, 120),
    regiao_atendimento_id: sanitizeCode(data.regiao_atendimento_id, 120),
    vendedor_responsavel: sanitizeText(data.vendedor_responsavel, 180),
    vendedor_responsavel_id: sanitizeCode(data.vendedor_responsavel_id, 120),
    indicador_id: sanitizeCode(data.indicador_id, 120),
    motivo_inatividade: sanitizeText(data.motivo_inatividade, 500),
    observacoes: sanitizeText(data.observacoes, 2000),
    endereco_principal: sanitizeEndereco(data.endereco_principal),
    contatos: sanitizeContatos(data.contatos),
    locais_entrega: Array.isArray(data.locais_entrega) ? data.locais_entrega.slice(0, 50).map(sanitizeEndereco) : [],
    condicao_comercial: {
      ...(data.condicao_comercial || {}),
      tabela_preco_id: sanitizeCode(data.condicao_comercial?.tabela_preco_id, 120),
      forma_pagamento_padrao_id: sanitizeCode(data.condicao_comercial?.forma_pagamento_padrao_id, 120),
      percentual_desconto: toNumber(data.condicao_comercial?.percentual_desconto, 0),
      condicao_pagamento: sanitizeText(data.condicao_comercial?.condicao_pagamento || "A Vista", 80),
      limite_credito: toNumber(data.condicao_comercial?.limite_credito, 0),
      limite_credito_utilizado: toNumber(data.condicao_comercial?.limite_credito_utilizado, 0),
      situacao_credito: sanitizeText(data.condicao_comercial?.situacao_credito || calcularSituacaoCredito(), 40)
    },
    configuracao_fiscal: {
      ...(data.configuracao_fiscal || {}),
      regime_tributario: sanitizeText(data.configuracao_fiscal?.regime_tributario || "Simples Nacional", 80),
      cfop_padrao_venda: sanitizeCode(data.configuracao_fiscal?.cfop_padrao_venda || "5102", 12),
      contribuinte_icms: sanitizeBoolean(data.configuracao_fiscal?.contribuinte_icms),
      tipo_contribuinte: sanitizeText(data.configuracao_fiscal?.tipo_contribuinte || "1 - Contribuinte", 80),
      isento_ipi: sanitizeBoolean(data.configuracao_fiscal?.isento_ipi),
      isento_icms: sanitizeBoolean(data.configuracao_fiscal?.isento_icms),
      observacoes_fiscais: sanitizeText(data.configuracao_fiscal?.observacoes_fiscais, 1000)
    },
    documentos: sanitizeDocumentos(data.documentos),
    empresa_id: data.empresa_id || empresaAtual?.id,
    group_id: data.group_id || groupId
  });

  const { data: tabelasPreco = [] } = useQuery({
    queryKey: ['tabelas-preco', contextKey],
    queryFn: () => filterInContext('TabelaPreco', {}, 'nome', 200),
    enabled: contextoValido,
  });

  const { data: formasPagamento = [] } = useQuery({
    queryKey: ['formas-pagamento', contextKey],
    queryFn: () => filterInContext('FormaPagamento', {}, 'nome', 200),
    enabled: contextoValido,
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores', contextKey],
    queryFn: () => filterInContext('Colaborador', { status: 'Ativo' }, 'nome_completo', 200),
    enabled: contextoValido,
  });

  const { data: regioes = [] } = useQuery({
    queryKey: ['regioes', contextKey],
    queryFn: () => filterInContext('RegiaoAtendimento', {}, 'nome', 200),
    enabled: contextoValido,
  });

  const { data: representantes = [] } = useQuery({
    queryKey: ['representantes', contextKey],
    queryFn: () => filterInContext('Representante', { status: 'Ativo' }, 'nome', 200),
    enabled: contextoValido,
  });

  const [usuarioLogado, setUsuarioLogado] = useState(null);

  useEffect(() => {
    const carregarUsuario = async () => {
      try {
        const user = await base44.auth.me();
        setUsuarioLogado(user);
        
        // Se for novo cliente e não tem vendedor definido, preencher automaticamente
        if (!cliente?.id && !formData.vendedor_responsavel_id && user) {
          const colaboradorUsuario = colaboradores.find(c => c.email === user.email);
          if (colaboradorUsuario) {
            setFormData(prev => ({
              ...prev,
              vendedor_responsavel_id: colaboradorUsuario.id,
              vendedor_responsavel: colaboradorUsuario.nome_completo
            }));
          }
        }
      } catch (error) {
        console.log('Usuário não autenticado ou erro:', error);
      }
    };
    
    carregarUsuario();
  }, [colaboradores, cliente?.id]);

  const { data: ultimaNF } = useQuery({
    queryKey: ['ultima-nf-cliente', cliente?.id, contextKey],
    queryFn: () => filterInContext('NotaFiscal', { cliente_fornecedor_id: cliente.id }, '-data_emissao', 1, 'empresa_faturamento_id'),
    enabled: !!cliente?.id && contextoValido,
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (!contextoValido) {
        throw new Error("Selecione um grupo ou empresa antes de salvar o cliente.");
      }

      const payload = buildPayload(data);

      if (cliente?.id) {
        if (!podeEditar) throw new Error("Seu perfil nao permite editar clientes.");
        return updateInContext('Cliente', cliente.id, payload);
      }

      if (!podeCriar) throw new Error("Seu perfil nao permite criar clientes.");
      return createInContext('Cliente', payload);
    },
    onSuccess: (_result, savedPayload) => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      toast({ title: `✅ Cliente ${cliente?.id ? 'atualizado' : 'criado'} com sucesso!` });
      if (onSuccess) onSuccess();
      if (onSubmit) onSubmit(savedPayload || buildPayload(formData));
      if (onCloseNorm) onCloseNorm();
    },
    onError: (error) => {
      toast({
        title: "❌ Erro ao salvar cliente",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      if (!contextoValido) throw new Error("Selecione um grupo ou empresa antes de excluir clientes.");
      if (!podeExcluir) throw new Error("Seu perfil nao permite excluir clientes.");
      return deleteInContext('Cliente', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      toast({ title: "✅ Cliente excluído com sucesso!" });
      if (onSuccess) onSuccess();
      if (onCloseNorm) onCloseNorm();
    },
    onError: (error) => {
      toast({
        title: "❌ Erro ao excluir cliente",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleExcluir = () => {
    if (!window.confirm(`Tem certeza que deseja excluir o cliente "${formData.nome}"? Esta ação não pode ser desfeita.`)) {
      return;
    }
    deleteMutation.mutate(cliente.id);
  };

  const handleAlternarStatus = () => {
    if (!podeEditar) {
      toast({ title: "Seu perfil nao permite alterar status de clientes.", variant: "destructive" });
      return;
    }
    if (!contextoValido) {
      toast({ title: "Selecione grupo ou empresa antes de alterar status.", variant: "destructive" });
      return;
    }
    const novoStatus = formData.status === 'Ativo' ? 'Inativo' : 'Ativo';
    setFormData({ ...formData, status: novoStatus });
  };

  const handleSave = () => {
    setIsSaving(true);
    saveMutation.mutate(buildPayload(formData), {
      onSettled: () => setIsSaving(false)
    });
  };

  const calcularSituacaoCredito = () => {
    const limite = formData.condicao_comercial?.limite_credito || 0;
    const utilizado = formData.condicao_comercial?.limite_credito_utilizado || 0;
    const percentualUtilizado = limite > 0 ? (utilizado / limite) * 100 : 0;

    if (formData.status === 'Bloqueado') return 'Bloqueado';
    if (percentualUtilizado >= 90) return 'Bloqueado';
    if (percentualUtilizado >= 70) return 'Alerta';
    return 'OK';
  };

  const handleDadosCNPJ = (dados) => {
    setFormData(prev => {
      const newFormData = {
        ...prev,
        nome: dados.razao_social || prev.nome,
        razao_social: dados.razao_social || "",
        nome_fantasia: dados.nome_fantasia || "",
        inscricao_estadual: dados.inscricao_estadual || prev.inscricao_estadual,
        inscricao_municipal: dados.inscricao_municipal || prev.inscricao_municipal,
        cnae_principal: dados.cnae_principal || prev.cnae_principal,
        ramo_atividade: dados.cnae_principal || prev.ramo_atividade,
        status_fiscal_receita: dados.situacao_cadastral || "Não Verificado",
        porte_empresa: dados.porte || prev.porte_empresa,
        endereco_principal: {
          ...prev.endereco_principal,
          cep: dados.endereco_completo?.cep || prev.endereco_principal.cep,
          logradouro: dados.endereco_completo?.logradouro || prev.endereco_principal.logradouro,
          numero: dados.endereco_completo?.numero || prev.endereco_principal.numero,
          bairro: dados.endereco_completo?.bairro || prev.endereco_principal.bairro,
          cidade: dados.endereco_completo?.cidade || prev.endereco_principal.cidade,
          estado: dados.endereco_completo?.uf || prev.endereco_principal.estado,
          complemento: dados.endereco_completo?.complemento || prev.endereco_principal.complemento
        },
        configuracao_fiscal: {
          ...prev.configuracao_fiscal,
          regime_tributario: dados.porte === 'MEI' ? 'MEI' :
                            ['ME', 'EPP'].includes(dados.porte) ? 'Simples Nacional' :
                            prev.configuracao_fiscal.regime_tributario
        }
      };

      if (dados.email && !(newFormData.contatos || []).some(c => c.valor === dados.email)) {
        newFormData.contatos = [
          ...(newFormData.contatos || []),
          { tipo: 'E-mail', valor: dados.email, principal: true }
        ];
      }

      if (dados.telefone && !(newFormData.contatos || []).some(c => c.valor === dados.telefone)) {
        newFormData.contatos = [
          ...(newFormData.contatos || []),
          { tipo: 'Telefone', valor: dados.telefone, principal: !dados.email }
        ];
      }
      return newFormData;
    });

    toast({
      title: "✅ Dados REAIS da Receita Federal preenchidos!",
      description: `${dados.razao_social} - ${dados.situacao_cadastral}${dados.inscricao_estadual ? ' - IE: ' + dados.inscricao_estadual : ''}`,
      duration: 5000
    });
  };

  const handleDadosCEP = (dados) => {
    setFormData(prev => ({
      ...prev,
      endereco_principal: {
        ...prev.endereco_principal,
        logradouro: dados.logradouro || "",
        bairro: dados.bairro || "",
        cidade: dados.cidade || "",
        estado: dados.uf || "",
        latitude: dados.latitude || null,
        longitude: dados.longitude || null,
        mapa_url: dados.latitude && dados.longitude
          ? `https://www.google.com/maps?q=${dados.latitude},${dados.longitude}`
          : ""
      }
    }));

    toast({ title: "✅ Endereço preenchido automaticamente!" });
  };

  useEffect(() => {
    if (cliente?.id) {
      setFormData({
        ...cliente,
        contatos: cliente.contatos || [],
        locais_entrega: cliente.locais_entrega || [],
        condicao_comercial: cliente.condicao_comercial || {
          tabela_preco_id: "",
          forma_pagamento_padrao_id: "",
          percentual_desconto: 0,
          condicao_pagamento: "À Vista",
          limite_credito: 0,
          limite_credito_utilizado: 0,
          situacao_credito: "OK"
        },
        configuracao_fiscal: cliente.configuracao_fiscal || {
          regime_tributario: "Simples Nacional",
          cfop_padrao_venda: "5102",
          contribuinte_icms: true,
          tipo_contribuinte: "1 - Contribuinte",
          isento_ipi: false,
          isento_icms: false
        },
        documentos: cliente.documentos || []
      });
    }
  }, [cliente?.id]);

  const gerarMapaUrl = (endereco) => {
    if (endereco.latitude && endereco.longitude) {
      return `https://www.google.com/maps?q=${endereco.latitude},${endereco.longitude}`;
    }
    if (endereco.cep) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${endereco.logradouro}, ${endereco.numero}, ${endereco.bairro}, ${endereco.cidade}, ${endereco.estado}, ${endereco.cep}`
      )}`;
    }
    return "";
  };

  const content = (
    <>
      <div className="border-b pb-4 px-6 pt-6 flex-shrink-0 bg-white sticky top-0 z-10">
        <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <User className="w-6 h-6 text-blue-600" />
                {cliente?.id ? 'Editar Cliente' : 'Novo Cliente'}
              </h2>
              {cliente?.id && (
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={
                    formData.status === 'Ativo' ? 'bg-green-100 text-green-700' :
                    formData.status === 'Prospect' ? 'bg-blue-100 text-blue-700' :
                    formData.status === 'Bloqueado' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }>
                    {formData.status}
                  </Badge>
                  <span className="text-sm text-slate-600">
                    {formData.tipo === 'Pessoa Física' ? formData.cpf : formData.cnpj}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {cliente?.id && (
                <>
                  <Button
                                    type="button"
                                    variant="outline"
                                    data-permission="Cadastros.Cliente.alterarStatus"
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
                                    data-permission="Cadastros.Cliente.excluir"
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
                data-permission="Cadastros.Cliente.salvar"
                data-sensitive
                disabled={isSaving || saveMutation.isPending || !contextoValido || (cliente?.id ? !podeEditar : !podeCriar)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Save className="w-4 h-4 mr-2" />
                {saveMutation.isPending ? 'Salvando..' : 'Salvar Cliente'}
              </Button>
            </div>
          </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-7 flex-shrink-0 px-6 bg-slate-50">
            <TabsTrigger value="dados-gerais" className="text-xs">
              <User className="w-3 h-3 mr-1" />
              Dados Gerais
            </TabsTrigger>
            <TabsTrigger value="contatos" className="text-xs">
              <Phone className="w-3 h-3 mr-1" />
              Contatos
            </TabsTrigger>
            <TabsTrigger value="enderecos" className="text-xs">
              <MapPin className="w-3 h-3 mr-1" />
              Endereços
            </TabsTrigger>
            <TabsTrigger value="financeiro" className="text-xs">
              <DollarSign className="w-3 h-3 mr-1" />
              Financeiro
            </TabsTrigger>
            <TabsTrigger value="fiscal" className="text-xs">
              <FileText className="w-3 h-3 mr-1" />
              Fiscal
            </TabsTrigger>
            <TabsTrigger value="historico" className="text-xs" disabled={!cliente?.id}>
              <Clock className="w-3 h-3 mr-1" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="anexos" className="text-xs">
              <Paperclip className="w-3 h-3 mr-1" />
              Anexos
            </TabsTrigger>
          </TabsList>

        <ScrollArea className="flex-1">
          <div className="px-6 pb-6">
            <TabsContent value="dados-gerais" className="space-y-6 m-0 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tipo">Tipo de Pessoa *</Label>
                  <Select
                    value={formData.tipo || "Pessoa Física"}
                    onValueChange={(value) => setFormData({ ...formData, tipo: value })}
                  >
                    <SelectTrigger id="tipo">
                      <SelectValue placeholder="Selecione o tipo..." />
                    </SelectTrigger>
                    <SelectContent className="z-[99999]">
                      <SelectItem value="Pessoa Física">Pessoa Física</SelectItem>
                      <SelectItem value="Pessoa Jurídica">Pessoa Jurídica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="status">Situação *</Label>
                  <Select
                    value={formData.status || "Prospect"}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Selecione a situação..." />
                    </SelectTrigger>
                    <SelectContent className="z-[99999]">
                      <SelectItem value="Prospect">Prospect</SelectItem>
                      <SelectItem value="Ativo">Ativo</SelectItem>
                      <SelectItem value="Inativo">Inativo</SelectItem>
                      <SelectItem value="Bloqueado">Bloqueado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <Label htmlFor="nome">Nome / Razão Social *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                  />
                </div>

                {formData.tipo === "Pessoa Jurídica" && (
                  <>
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
                      <Label htmlFor="inscricao_municipal">Inscrição Municipal</Label>
                      <Input
                        id="inscricao_municipal"
                        value={formData.inscricao_municipal}
                        onChange={(e) => setFormData({ ...formData, inscricao_municipal: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {formData.tipo === "Pessoa Física" && (
                  <>
                    <div>
                      <Label htmlFor="cpf">CPF</Label>
                      <Input
                        id="cpf"
                        value={formData.cpf}
                        onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                        placeholder="000.000.000-00"
                      />
                    </div>

                    <div>
                      <Label>&nbsp;</Label>
                      <BotaoBuscaAutomatica
                        tipo="cpf"
                        valor={formData.cpf}
                        onDadosEncontrados={(dados) => {
                          if (dados.valido) {
                            setFormData({ ...formData, cpf: dados.formatado });
                            toast({ title: "✅ CPF validado com sucesso!" });
                          }
                        }}
                        disabled={!formData.cpf || formData.cpf.replace(/\D/g, '').length < 11}
                      />
                    </div>

                    <div>
                      <Label htmlFor="rg">RG</Label>
                      <Input
                        id="rg"
                        value={formData.rg}
                        onChange={(e) => setFormData({ ...formData, rg: e.target.value })}
                      />
                    </div>
                  </>
                )}

                <div className="col-span-2 pt-4 border-t">
                  <h3 className="font-semibold mb-3">Endereço Principal</h3>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="cep">CEP</Label>
                      <Input
                        id="cep"
                        value={formData.endereco_principal?.cep || ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          endereco_principal: {
                            ...formData.endereco_principal,
                            cep: e.target.value
                          }
                        })}
                        placeholder="00000-000"
                      />
                    </div>

                    <div>
                      <Label>&nbsp;</Label>
                      <BotaoBuscaAutomatica
                        tipo="cep"
                        valor={formData.endereco_principal?.cep}
                        onDadosEncontrados={handleDadosCEP}
                        disabled={!formData.endereco_principal?.cep || formData.endereco_principal.cep.replace(/\D/g, '').length < 8}
                      />
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="logradouro">Logradouro</Label>
                      <Input
                        id="logradouro"
                        value={formData.endereco_principal?.logradouro || ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          endereco_principal: {
                            ...formData.endereco_principal,
                            logradouro: e.target.value
                          }
                        })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="numero">Número</Label>
                      <Input
                        id="numero"
                        value={formData.endereco_principal?.numero || ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          endereco_principal: {
                            ...formData.endereco_principal,
                            numero: e.target.value
                          }
                        })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="bairro">Bairro</Label>
                      <Input
                        id="bairro"
                        value={formData.endereco_principal?.bairro || ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          endereco_principal: {
                            ...formData.endereco_principal,
                            bairro: e.target.value
                          }
                        })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="cidade">Cidade</Label>
                      <Input
                        id="cidade"
                        value={formData.endereco_principal?.cidade || ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          endereco_principal: {
                            ...formData.endereco_principal,
                            cidade: e.target.value
                          }
                        })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="estado">UF</Label>
                      <Input
                        id="estado"
                        value={formData.endereco_principal?.estado || ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          endereco_principal: {
                            ...formData.endereco_principal,
                            estado: e.target.value
                          }
                        })}
                        maxLength={2}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="regiao_atendimento_id">Região de Atendimento</Label>
                  <Select 
                    value={formData.regiao_atendimento_id || ""} 
                    onValueChange={(value) => {
                      const regiao = regioes.find(r => r.id === value);
                      setFormData({ 
                        ...formData, 
                        regiao_atendimento_id: value,
                        regiao_atendimento_nome: regiao?.nome_regiao || ''
                      });
                    }}
                  >
                    <SelectTrigger id="regiao_atendimento_id">
                      <SelectValue placeholder="Selecione a região" />
                    </SelectTrigger>
                    <SelectContent className="z-[99999]">
                      {regioes.filter(r => r.ativo).map((regiao) => (
                        <SelectItem key={regiao.id} value={regiao.id}>
                          {regiao.nome_regiao} {regiao.tipo_regiao && `(${regiao.tipo_regiao})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="vendedor_responsavel_id">
                    Vendedor Responsável {!cliente?.id && <span className="text-xs text-green-600">(Preenchido Automaticamente)</span>}
                  </Label>
                  <Select
                    value={formData.vendedor_responsavel_id || ""}
                    onValueChange={(value) => {
                      const vendedor = colaboradores.find(c => c.id === value);
                      setFormData({
                        ...formData,
                        vendedor_responsavel_id: value,
                        vendedor_responsavel: vendedor?.nome_completo || ""
                      });
                    }}
                  >
                    <SelectTrigger id="vendedor_responsavel_id" className={!cliente?.id && formData.vendedor_responsavel_id ? 'border-green-300 bg-green-50' : ''}>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="z-[99999]">
                      {colaboradores.filter(c => c.departamento === 'Comercial').map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome_completo} - {c.cargo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="indicador_id">
                    💰 Indicador (Comissão/Cashback)
                    <span className="text-xs text-slate-500 ml-2">Representante • Construtor • Arquiteto • Engenheiro</span>
                  </Label>
                  <Select
                    value={formData.indicador_id || ""}
                    onValueChange={(value) => {
                      const indicador = representantes.find(r => r.id === value);
                      setFormData({
                        ...formData,
                        indicador_id: value,
                        indicador_nome: indicador?.nome || "",
                        tipo_indicador: indicador?.tipo_representante || "",
                        percentual_comissao_indicador: indicador?.percentual_comissao || 0
                      });
                    }}
                  >
                    <SelectTrigger id="indicador_id" className="w-full">
                      <SelectValue placeholder="Quem indicou este cliente?" />
                    </SelectTrigger>
                    <SelectContent className="z-[99999]">
                     <SelectItem value={null}>
                       <span className="text-slate-400">❌ Nenhum indicador</span>
                     </SelectItem>
                     {representantes.map(rep => (
                       <SelectItem key={rep.id} value={rep.id}>
                         <span className="font-medium">{rep.nome}</span>
                         <span className="text-xs text-slate-500 ml-2">
                           ({rep.tipo_representante || 'Representante'})
                         </span>
                         {rep.percentual_comissao > 0 && (
                           <span className="text-xs text-green-600 ml-1">
                             - {rep.percentual_comissao}%
                           </span>
                         )}
                       </SelectItem>
                     ))}
                    </SelectContent>
                    </Select>
                    </div>

                <div className="col-span-2">
                  {formData.indicador_id && representantes.find(r => r.id === formData.indicador_id) && (
                    <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                      <CardContent className="p-3">
                        {(() => {
                          const indicador = representantes.find(r => r.id === formData.indicador_id);
                          return (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                                  <span className="text-white text-lg">💰</span>
                                </div>
                                <div>
                                  <p className="font-semibold text-green-900">{indicador.nome}</p>
                                  <p className="text-xs text-green-700">
                                    {indicador.tipo_representante || 'Representante'} • {indicador.tipo_comissao || 'Percentual'}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                {indicador.percentual_comissao > 0 && (
                                  <p className="text-lg font-bold text-green-600">
                                    {indicador.percentual_comissao}%
                                  </p>
                                )}
                                {indicador.valor_fixo_comissao > 0 && (
                                  <p className="text-sm text-green-700">
                                    + R$ {indicador.valor_fixo_comissao.toLocaleString('pt-BR')} fixo
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  )}
                </div>

                {(formData.status === 'Inativo' || formData.status === 'Bloqueado') && (
                  <div className="col-span-2">
                    <Label htmlFor="motivo_inatividade">Motivo de Inativação/Bloqueio *</Label>
                    <Textarea
                      id="motivo_inatividade"
                      value={formData.motivo_inatividade}
                      onChange={(e) => setFormData({ ...formData, motivo_inatividade: e.target.value })}
                      rows={2}
                      required
                    />
                  </div>
                )}

                <div className="col-span-2">
                  <Label htmlFor="observacoes">Observações Internas</Label>
                  <Textarea
                    id="observacoes"
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="contatos" className="m-0 mt-4">
              <GerenciarContatosClienteForm
                contatos={formData.contatos || []}
                onChange={(novosContatos) => setFormData({ ...formData, contatos: novosContatos })}
              />
            </TabsContent>

            <TabsContent value="enderecos" className="m-0 mt-4">
              <GerenciarEnderecosClienteForm
                enderecos={formData.locais_entrega || []}
                onChange={(novosEnderecos) => setFormData({ ...formData, locais_entrega: novosEnderecos })}
              />
            </TabsContent>

            <TabsContent value="financeiro" className="space-y-6 m-0 mt-4">
              <Card className={`border-2 ${
                calcularSituacaoCredito() === 'OK' ? 'border-green-300 bg-green-50' :
                calcularSituacaoCredito() === 'Alerta' ? 'border-orange-300 bg-orange-50' :
                'border-red-300 bg-red-50'
              }`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className={`w-6 h-6 ${
                      calcularSituacaoCredito() === 'OK' ? 'text-green-600' :
                      calcularSituacaoCredito() === 'Alerta' ? 'text-orange-600' :
                      'text-red-600'
                    }`} />
                    <div>
                      <p className="font-semibold">Situação de Crédito: {calcularSituacaoCredito()}</p>
                      <p className="text-sm text-slate-600">
                        Utilizado: R$ {(formData.condicao_comercial?.limite_credito_utilizado || 0).toLocaleString('pt-BR')}
                        {' '}de R$ {(formData.condicao_comercial?.limite_credito || 0).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="limite_credito">Limite de Crédito (R$)</Label>
                  <Input
                    id="limite_credito"
                    type="number"
                    step="0.01"
                    value={formData.condicao_comercial?.limite_credito || 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      condicao_comercial: {
                        ...formData.condicao_comercial,
                        limite_credito: parseFloat(e.target.value) || 0
                      }
                    })}
                  />
                </div>

                <div>
                  <Label htmlFor="limite_utilizado">Limite Utilizado (R$)</Label>
                  <Input
                    id="limite_utilizado"
                    type="number"
                    step="0.01"
                    value={formData.condicao_comercial?.limite_credito_utilizado || 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      condicao_comercial: {
                        ...formData.condicao_comercial,
                        limite_credito_utilizado: parseFloat(e.target.value) || 0
                      }
                    })}
                    disabled
                  />
                  <p className="text-xs text-slate-500 mt-1">Calculado automaticamente</p>
                </div>

                <div>
                  <Label htmlFor="tabela_preco_id">Tabela de Preço</Label>
                  <Select
                    value={formData.condicao_comercial?.tabela_preco_id || ""}
                    onValueChange={(value) => {
                      const tabela = tabelasPreco.find(t => t.id === value);
                      setFormData({
                        ...formData,
                        condicao_comercial: {
                          ...formData.condicao_comercial,
                          tabela_preco_id: value,
                          tabela_preco_nome: tabela?.nome || ""
                        }
                      });
                    }}
                  >
                    <SelectTrigger id="tabela_preco_id">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="z-[99999]">
                      {tabelasPreco.filter(t => t.ativo).map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.nome} ({t.tipo})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="forma_pagamento_padrao_id">Forma de Pagamento Padrão</Label>
                  <Select
                    value={formData.condicao_comercial?.forma_pagamento_padrao_id || ""}
                    onValueChange={(value) => {
                      const forma = formasPagamento.find(f => f.id === value);
                      setFormData({
                        ...formData,
                        condicao_comercial: {
                          ...formData.condicao_comercial,
                          forma_pagamento_padrao_id: value,
                          forma_pagamento_padrao_nome: forma?.descricao || ""
                        }
                      });
                    }}
                  >
                    <SelectTrigger id="forma_pagamento_padrao_id">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="z-[99999]">
                      {formasPagamento.filter(f => f.ativa).map(f => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.descricao}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="condicao_pagamento">Condição de Pagamento</Label>
                  <Select
                    value={formData.condicao_comercial?.condicao_pagamento || "À Vista"}
                    onValueChange={(value) => setFormData({
                      ...formData,
                      condicao_comercial: {
                        ...formData.condicao_comercial,
                        condicao_pagamento: value
                      }
                    })}
                  >
                    <SelectTrigger id="condicao_pagamento">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[99999]">
                      <SelectItem value="À Vista">À Vista</SelectItem>
                      <SelectItem value="7 dias">7 dias</SelectItem>
                      <SelectItem value="15 dias">15 dias</SelectItem>
                      <SelectItem value="30 dias">30 dias</SelectItem>
                      <SelectItem value="45 dias">45 dias</SelectItem>
                      <SelectItem value="60 dias">60 dias</SelectItem>
                      <SelectItem value="Parcelado">Parcelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="percentual_desconto">Desconto Padrão (%)</Label>
                  <Input
                    id="percentual_desconto"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.condicao_comercial?.percentual_desconto || 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      condicao_comercial: {
                        ...formData.condicao_comercial,
                        percentual_desconto: parseFloat(e.target.value) || 0
                      }
                    })}
                  />
                </div>

                {cliente?.id && (
                  <>
                    <div className="col-span-2 pt-4 border-t">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm text-slate-600">Última Compra</p>
                          <p className="font-semibold">
                            {formData.data_ultima_compra
                              ? new Date(formData.data_ultima_compra).toLocaleDateString('pt-BR')
                              : '-'
                            }
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-600">Score de Pagamento</p>
                          <p className="text-2xl font-bold text-blue-600">
                            {formData.score_pagamento || 100}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-600">Dias Atraso Médio</p>
                          <p className="text-2xl font-bold text-orange-600">
                            {formData.dias_atraso_medio || 0}
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="fiscal" className="space-y-6 m-0 mt-4">
              {ultimaNF && ultimaNF.length > 0 && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-900">Última Nota Fiscal Emitida</p>
                        <p className="text-xs text-blue-700">
                          NF-e {ultimaNF[0].numero}/{ultimaNF[0].serie} - {new Date(ultimaNF[0].data_emissao).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-blue-700">
                        R$ {(ultimaNF[0].valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="regime_tributario">Regime Tributário</Label>
                  <Select
                    value={formData.configuracao_fiscal?.regime_tributario || "Simples Nacional"}
                    onValueChange={(value) => setFormData({
                      ...formData,
                      configuracao_fiscal: {
                        ...formData.configuracao_fiscal,
                        regime_tributario: value
                      }
                    })}
                  >
                    <SelectTrigger id="regime_tributario">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[99999]">
                      <SelectItem value="Simples Nacional">Simples Nacional</SelectItem>
                      <SelectItem value="Lucro Presumido">Lucro Presumido</SelectItem>
                      <SelectItem value="Lucro Real">Lucro Real</SelectItem>
                      <SelectItem value="MEI">MEI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="cfop_padrao_venda">CFOP Padrão Vendas</Label>
                  <Input
                    id="cfop_padrao_venda"
                    value={formData.configuracao_fiscal?.cfop_padrao_venda || "5102"}
                    onChange={(e) => setFormData({
                      ...formData,
                      configuracao_fiscal: {
                        ...formData.configuracao_fiscal,
                        cfop_padrao_venda: e.target.value
                      }
                    })}
                  />
                </div>

                <div>
                  <Label htmlFor="tipo_contribuinte">Tipo de Contribuinte</Label>
                  <Select
                    value={formData.configuracao_fiscal?.tipo_contribuinte || "1 - Contribuinte"}
                    onValueChange={(value) => setFormData({
                      ...formData,
                      configuracao_fiscal: {
                        ...formData.configuracao_fiscal,
                        tipo_contribuinte: value
                      }
                    })}
                  >
                    <SelectTrigger id="tipo_contribuinte">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[99999]">
                      <SelectItem value="1 - Contribuinte">1 - Contribuinte ICMS</SelectItem>
                      <SelectItem value="2 - Isento">2 - Isento</SelectItem>
                      <SelectItem value="9 - Não Contribuinte">9 - Não Contribuinte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-4 pt-6">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isento_icms"
                      checked={formData.configuracao_fiscal?.isento_icms || false}
                      onChange={(e) => setFormData({
                        ...formData,
                        configuracao_fiscal: {
                          ...formData.configuracao_fiscal,
                          isento_icms: e.target.checked
                        }
                      })}
                      className="rounded"
                    />
                    <Label htmlFor="isento_icms" className="font-normal cursor-pointer">
                      Isento ICMS
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isento_ipi"
                      checked={formData.configuracao_fiscal?.isento_ipi || false}
                      onChange={(e) => setFormData({
                        ...formData,
                        configuracao_fiscal: {
                          ...formData.configuracao_fiscal,
                          isento_ipi: e.target.checked
                        }
                      })}
                      className="rounded"
                    />
                    <Label htmlFor="isento_ipi" className="font-normal cursor-pointer">
                      Isento IPI
                    </Label>
                  </div>
                </div>

                <div className="col-span-2">
                  <Label htmlFor="observacoes_fiscais">Observações Fiscais</Label>
                  <Textarea
                    id="observacoes_fiscais"
                    value={formData.configuracao_fiscal?.observacoes_fiscais || ""}
                    onChange={(e) => setFormData({
                      ...formData,
                      configuracao_fiscal: {
                        ...formData.configuracao_fiscal,
                        observacoes_fiscais: e.target.value
                      }
                    })}
                    rows={3}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="historico" className="m-0 mt-4">
              {cliente?.id ? (
                <div className="space-y-6">
                  <Suspense fallback={<div className="h-24 rounded-xl bg-white/40 backdrop-blur animate-pulse" />}>
                    <ResumoHistorico clienteId={cliente.id} />
                  </Suspense>
                  <Suspense fallback={<div className="h-16 animate-pulse bg-slate-100 rounded" />}>
                    <HistoricoOrigemCliente clienteId={cliente.id} compact={false} />
                  </Suspense>
                  <Suspense fallback={<div className="h-24 rounded-xl bg-white/40 backdrop-blur animate-pulse" />}>
                    <TimelineCliente clienteId={cliente.id} showFilters={true} />
                  </Suspense>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <Clock className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>Salve o cliente primeiro para ver o histórico</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="anexos" className="space-y-6 m-0 mt-4">
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                <Paperclip className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                <p className="text-slate-600 mb-2">Upload de Documentos</p>
                <p className="text-sm text-slate-500 mb-4">
                  Arraste arquivos ou clique para fazer upload
                </p>
                <Button variant="outline">
                  Selecionar Arquivos
                </Button>
              </div>

              {formData.documentos && formData.documentos.length > 0 && (
                <div className="space-y-2">
                  {formData.documentos.map((doc, index) => (
                    <Card key={index} className="border-0 shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-blue-600" />
                            <div>
                              <p className="font-medium">{doc.nome_arquivo}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">{doc.tipo}</Badge>
                                {doc.data_upload && (
                                  <span className="text-xs text-slate-500">
                                    {new Date(doc.data_upload).toLocaleDateString('pt-BR')}
                                  </span>
                                )}
                                {doc.upload_por && (
                                  <span className="text-xs text-slate-500">
                                    por {doc.upload_por}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {doc.url_arquivo && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(doc.url_arquivo, '_blank')}
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
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
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full flex flex-col p-0 overflow-hidden">
        {content}
      </DialogContent>
    </Dialog>
  );
}
