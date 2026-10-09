import React, { useState, useEffect, Suspense, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  User, CreditCard, MapPin, FileText, Paperclip, History,
  Plus, Trash2, AlertTriangle, CheckCircle, Upload, Download,
  MapPinned, Clock, Phone, Mail, ShieldAlert, Calendar
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent } from "@/components/ui/card";
const PrincipalTab = React.lazy(() => import("@/components/comercial/cliente/PrincipalTab"));
const ComercialTab = React.lazy(() => import("@/components/comercial/cliente/ComercialTab"));
const EntregaTab = React.lazy(() => import("@/components/comercial/cliente/EntregaTab"));
const FiscalTab = React.lazy(() => import("@/components/comercial/cliente/FiscalTab"));
const DocumentosTab = React.lazy(() => import("@/components/comercial/cliente/DocumentosTab"));
const HistoricoTab = React.lazy(() => import("@/components/comercial/cliente/HistoricoTab"));
import FormWrapper from "@/components/common/FormWrapper";
import { clienteCompletoSchema } from './cliente/clienteCompletoSchema';
import { useContextoVisual } from '@/components/lib/useContextoVisual';

const defaultFormData = {
  tipo: "Pessoa Jurídica",
  status: "Prospect",
  motivo_inatividade: "",
  nome: "",
  razao_social: "",
  nome_fantasia: "",
  cpf: "",
  cnpj: "",
  rg: "",
  inscricao_estadual: "",
  inscricao_municipal: "",
  endereco_principal: {
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    pais: "Brasil"
  },
  contatos: [{
    tipo: "Telefone",
    valor: "",
    principal: true,
    observacao: ""
  }],
  condicao_comercial: {
    tabela_preco_id: "",
    tabela_preco_nome: "",
    percentual_desconto: 0,
    condicao_pagamento: "À Vista",
    prazo_pagamento_dias: 0,
    limite_credito: 0,
    limite_aprovado_por: "",
    limite_aprovado_em: "",
    vigencia_desconto_ate: "",
    dia_vencimento_preferencial: 10
  },
  locais_entrega: [],
  configuracao_fiscal: {
    regime_tributario: "Simples Nacional",
    isento_ipi: false,
    isento_icms: false,
    contribuinte_icms: true,
    substituicao_tributaria_especial: false,
    utilizar_nfe_interna: false,
    nfe_interna_aprovado_por: "",
    nfe_interna_aprovado_em: "",
    observacoes_fiscais: ""
  },
  documentos: [],
  vendedor_responsavel: "",
  vendedor_responsavel_id: "",
  classificacao_abc: "Novo",
  valor_compras_12meses: 0,
  proxima_acao: {
    data: "",
    descricao: "",
    responsavel: ""
  },
  observacoes: ""
};



function ClienteFormCompleto({ cliente, onSubmit, isSubmitting, onCancel }) {
  const { carimbarContexto } = useContextoVisual();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("principal");
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const lastCnpjRef = useRef('');
  const lastCepRef = useRef('');
  const cnpjTimerRef = useRef(null);
  const cepTimerRef = useRef(null);

  // Função auxiliar para fazer merge seguro
  const safeMerge = (defaultObj, sourceObj) => {
    if (!sourceObj || typeof sourceObj !== 'object') return defaultObj;
    return { ...defaultObj, ...sourceObj };
  };

  // Merge dos dados do cliente com os valores padrão
  const [formData, setFormData] = useState(() => {
    if (!cliente) return { ...defaultFormData };
    
    return {
      tipo: cliente.tipo || defaultFormData.tipo,
      status: cliente.status || defaultFormData.status,
      motivo_inatividade: cliente.motivo_inatividade || "",
      nome: cliente.nome || "",
      razao_social: cliente.razao_social || "",
      nome_fantasia: cliente.nome_fantasia || "",
      cpf: cliente.cpf || "",
      cnpj: cliente.cnpj || "",
      rg: cliente.rg || "",
      inscricao_estadual: cliente.inscricao_estadual || "",
      inscricao_municipal: cliente.inscricao_municipal || "",
      endereco_principal: safeMerge(defaultFormData.endereco_principal, cliente.endereco_principal),
      contatos: Array.isArray(cliente.contatos) && cliente.contatos.length > 0 
        ? cliente.contatos 
        : [...defaultFormData.contatos],
      condicao_comercial: safeMerge(defaultFormData.condicao_comercial, cliente.condicao_comercial),
      locais_entrega: Array.isArray(cliente.locais_entrega) ? cliente.locais_entrega : [],
      configuracao_fiscal: safeMerge(defaultFormData.configuracao_fiscal, cliente.configuracao_fiscal),
      documentos: Array.isArray(cliente.documentos) ? cliente.documentos : [],
      vendedor_responsavel: cliente.vendedor_responsavel || "",
      vendedor_responsavel_id: cliente.vendedor_responsavel_id || "",
      classificacao_abc: cliente.classificacao_abc || "Novo",
      valor_compras_12meses: cliente.valor_compras_12meses || 0,
      proxima_acao: safeMerge(defaultFormData.proxima_acao, cliente.proxima_acao),
      observacoes: cliente.observacoes || ""
    };
  });

  // Buscar CEP
  const buscarCep = async (cep) => {
    if (!cep || cep.length < 8) return;

    setBuscandoCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();

      if (data.erro) {
        toast({
          title: "CEP não encontrado",
          variant: "destructive"
        });
        return;
      }

      setFormData(prev => ({
        ...prev,
        endereco_principal: {
          ...prev.endereco_principal,
          cep,
          logradouro: data.logradouro,
          bairro: data.bairro,
          cidade: data.localidade,
          estado: data.uf
        }
      }));

      toast({
        title: "✅ CEP encontrado!",
        description: `${data.logradouro}, ${data.bairro}`
      });
    } catch (error) {
      toast({
        title: "Erro ao buscar CEP",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setBuscandoCep(false);
    }
  };

  // Buscar CNPJ (usa função backend ConsultarCNPJ com configurações centralizadas)
  const buscarCnpj = async (cnpj) => {
    const limpo = (cnpj || '').replace(/\D/g, '');
    if (!limpo || limpo.length < 14) return;

    setBuscandoCnpj(true);
    try {
      const { data } = await base44.functions.invoke('ConsultarCNPJ', { cnpj: limpo });
      if (data?.sucesso && data?.dados) {
        const d = data.dados;
        setFormData(prev => ({
          ...prev,
          cnpj: limpo,
          nome: d.razao_social || prev.nome,
          razao_social: d.razao_social || prev.razao_social,
          nome_fantasia: d.nome_fantasia || prev.nome_fantasia,
          cnae_principal: d.cnae_principal || d.cnae_codigo || prev.cnae_principal,
          endereco_principal: {
            ...(prev.endereco_principal || {}),
            logradouro: d.endereco_completo?.logradouro || prev.endereco_principal?.logradouro || '',
            numero: d.endereco_completo?.numero || prev.endereco_principal?.numero || '',
            complemento: d.endereco_completo?.complemento || prev.endereco_principal?.complemento || '',
            bairro: d.endereco_completo?.bairro || prev.endereco_principal?.bairro || '',
            cidade: d.endereco_completo?.cidade || prev.endereco_principal?.cidade || '',
            estado: d.endereco_completo?.uf || prev.endereco_principal?.estado || '',
            cep: d.endereco_completo?.cep || prev.endereco_principal?.cep || '',
            pais: 'Brasil'
          },
          contatos: (() => {
            const contatos = Array.isArray(prev.contatos) ? [...prev.contatos] : [];
            if (d.telefone) {
              const tel = (d.telefone || '').replace(/\D/g, '');
              if (!contatos.some(c => c.tipo === 'Telefone' && c.valor === tel)) {
                contatos.push({ tipo: 'Telefone', valor: tel, principal: contatos.length === 0 });
              }
            }
            if (d.email) {
              if (!contatos.some(c => c.tipo === 'E-mail' && c.valor === d.email)) {
                contatos.push({ tipo: 'E-mail', valor: d.email, principal: contatos.length === 0 });
              }
            }
            return contatos;
          })()
        }));
        toast({ title: '✅ CNPJ encontrado', description: d.razao_social || limpo });
      } else {
        toast({ title: 'CNPJ não encontrado', description: data?.erro || 'Verifique o número informado', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Erro ao buscar CNPJ', description: error?.message || String(error), variant: 'destructive' });
    } finally {
      setBuscandoCnpj(false);
    }
  };

  // Adicionar contato
  const adicionarContato = () => {
    setFormData(prev => ({
      ...prev,
      contatos: [...(prev.contatos || []), {
        tipo: "Telefone",
        valor: "",
        principal: false,
        observacao: ""
      }]
    }));
  };

  // Remover contato
  const removerContato = (index) => {
    setFormData(prev => ({
      ...prev,
      contatos: (prev.contatos || []).filter((_, i) => i !== index)
    }));
  };

  // Adicionar local de entrega
  const adicionarLocalEntrega = () => {
    setFormData(prev => ({
      ...prev,
      locais_entrega: [...(prev.locais_entrega || []), {
        apelido: "",
        cep: "",
        logradouro: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        estado: "",
        latitude: null,
        longitude: null,
        horario_inicio: "08:00",
        horario_fim: "18:00",
        contato_nome: "",
        contato_telefone: "",
        observacoes: "",
        principal: false
      }]
    }));
  };

  // Remover local de entrega
  const removerLocalEntrega = (index) => {
    setFormData(prev => ({
      ...prev,
      locais_entrega: (prev.locais_entrega || []).filter((_, i) => i !== index)
    }));
  };

  // Geocodificar endereço
  const geocodificarEndereco = (index) => {
    toast({
      title: "🗺️ Geocodificação",
      description: "Em produção, usaria Google Maps API"
    });

    setFormData(prev => {
      const novosLocais = [...(prev.locais_entrega || [])];
      novosLocais[index] = {
        ...novosLocais[index],
        latitude: -23.5505 + (Math.random() - 0.5) * 0.1,
        longitude: -46.6333 + (Math.random() - 0.5) * 0.1
      };
      return { ...prev, locais_entrega: novosLocais };
    });
  };

  // Upload de documento
  const handleUploadDocumento = (tipo) => {
    toast({
      title: "📎 Upload",
      description: "Em produção, integraria com armazenamento"
    });

    const novoDoc = {
      tipo,
      nome_arquivo: `documento_${Date.now()}.pdf`,
      url_arquivo: `https://example.com/docs/${Date.now()}.pdf`,
      data_upload: new Date().toISOString().split('T')[0],
      data_validade: "",
      observacao: ""
    };

    setFormData(prev => ({
      ...prev,
      documentos: [...(prev.documentos || []), novoDoc]
    }));
  };

  // Remover documento
  const removerDocumento = (index) => {
    setFormData(prev => ({
      ...prev,
      documentos: (prev.documentos || []).filter((_, i) => i !== index)
    }));
  };

  // Validar e submeter
  const handleSubmit = async () => {


    if ((formData.status === 'Inativo' || formData.status === 'Bloqueado') && !formData.motivo_inatividade) {
      toast({
        title: "⚠️ Campo Obrigatório",
        description: "Informe o motivo da inativação/bloqueio",
        variant: "destructive"
      });
      setActiveTab("principal");
      return;
    }

    const dataToSubmit = {
      ...formData,
      condicao_comercial: {
        ...formData.condicao_comercial,
        limite_credito: formData.condicao_comercial?.condicao_pagamento === 'À Vista' 
          ? 0 
          : formData.condicao_comercial?.limite_credito || 0
      }
    };

    onSubmit(carimbarContexto(dataToSubmit, 'empresa_id'));
  };

  // Atualizar limite de crédito quando condição mudar
  useEffect(() => {
    if (formData?.condicao_comercial?.condicao_pagamento === 'À Vista') {
      setFormData(prev => ({
        ...prev,
        condicao_comercial: {
          ...(prev.condicao_comercial || {}),
          limite_credito: 0
        }
      }));
    }
  }, [formData?.condicao_comercial?.condicao_pagamento]);

  // Debounce CNPJ auto-busca
  useEffect(() => {
    const limpo = (formData?.cnpj || '').replace(/\D/g, '');
    if (formData?.tipo === 'Pessoa Jurídica' && limpo.length === 14 && limpo !== lastCnpjRef.current) {
      if (cnpjTimerRef.current) clearTimeout(cnpjTimerRef.current);
      cnpjTimerRef.current = setTimeout(() => {
        lastCnpjRef.current = limpo;
        buscarCnpj(limpo);
      }, 600);
    }
    return () => { if (cnpjTimerRef.current) clearTimeout(cnpjTimerRef.current); };
  }, [formData?.cnpj, formData?.tipo]);

  // Debounce CEP auto-busca
  useEffect(() => {
    const limpoCep = (formData?.endereco_principal?.cep || '').replace(/\D/g, '');
    if (limpoCep.length >= 8 && limpoCep !== lastCepRef.current) {
      if (cepTimerRef.current) clearTimeout(cepTimerRef.current);
      cepTimerRef.current = setTimeout(() => {
        lastCepRef.current = limpoCep;
        buscarCep(limpoCep);
      }, 600);
    }
    return () => { if (cepTimerRef.current) clearTimeout(cepTimerRef.current); };
  }, [formData?.endereco_principal?.cep]);

   if (!formData) return null;

  return (
    <FormWrapper schema={clienteCompletoSchema} onSubmit={handleSubmit} externalData={formData} className="space-y-4 w-full h-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full">
        <TabsList className="grid w-full grid-cols-6 mb-6">
          <TabsTrigger value="principal">
            <User className="w-4 h-4 mr-2" />
            Principal
          </TabsTrigger>
          <TabsTrigger value="comercial">
            <CreditCard className="w-4 h-4 mr-2" />
            Comercial
          </TabsTrigger>
          <TabsTrigger value="entrega">
            <MapPin className="w-4 h-4 mr-2" />
            Entrega
          </TabsTrigger>
          <TabsTrigger value="fiscal">
            <FileText className="w-4 h-4 mr-2" />
            Fiscal
          </TabsTrigger>
          <TabsTrigger value="documentos">
            <Paperclip className="w-4 h-4 mr-2" />
            Documentos
          </TabsTrigger>
          <TabsTrigger value="historico">
            <History className="w-4 h-4 mr-2" />
            Histórico
          </TabsTrigger>
        </TabsList>

        {/* ABA 1: PRINCIPAL */}
        <TabsContent value="principal" className="space-y-4">
          <Suspense fallback={<div className="h-24 rounded-md bg-slate-100 animate-pulse" />}>
            <PrincipalTab
              formData={formData}
              setFormData={setFormData}
              buscarCep={buscarCep}
              buscandoCep={buscandoCep}
              buscarCnpj={buscarCnpj}
              buscandoCnpj={buscandoCnpj}
              adicionarContato={adicionarContato}
              removerContato={removerContato}
            />
          </Suspense>
        </TabsContent>

        {/* ABA 2: COMERCIAL */}
        <TabsContent value="comercial" className="space-y-4">
          <Suspense fallback={<div className="h-24 rounded-md bg-slate-100 animate-pulse" />}>
            <ComercialTab formData={formData} setFormData={setFormData} />
          </Suspense>
        </TabsContent>

        {/* ABA 3: ENTREGA */}
        <TabsContent value="entrega" className="space-y-4">
          <Suspense fallback={<div className="h-24 rounded-md bg-slate-100 animate-pulse" />}>
            <EntregaTab
              locaisEntrega={formData.locais_entrega || []}
              onAddLocal={adicionarLocalEntrega}
              onRemoveLocal={removerLocalEntrega}
              onGeocode={geocodificarEndereco}
              formData={formData}
              setFormData={setFormData}
            />
          </Suspense>
        </TabsContent>

        {/* ABA 4: FISCAL */}
        <TabsContent value="fiscal" className="space-y-4">
          <Suspense fallback={<div className="h-24 rounded-md bg-slate-100 animate-pulse" />}>
            <FiscalTab formData={formData} setFormData={setFormData} />
          </Suspense>
        </TabsContent>

        {/* ABA 5: DOCUMENTOS */}
        <TabsContent value="documentos" className="space-y-4">
          <Suspense fallback={<div className="h-24 rounded-md bg-slate-100 animate-pulse" />}>
            <DocumentosTab
              formData={formData}
              setFormData={setFormData}
              handleUploadDocumento={handleUploadDocumento}
              removerDocumento={removerDocumento}
            />
          </Suspense>
        </TabsContent>

        {/* ABA 6: HISTÓRICO */}
        <TabsContent value="historico" className="space-y-4">
          <Suspense fallback={<div className="h-24 rounded-md bg-slate-100 animate-pulse" />}>
            <HistoricoTab cliente={cliente} formData={formData} />
          </Suspense>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-white/80 backdrop-blur z-10">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="submit"
          data-permission={cliente ? "Cadastros.Cliente.editar" : "Cadastros.Cliente.criar"}
          data-action="Cadastros.Cliente.salvar"
          data-sensitive
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Salvando...' : cliente ? 'Atualizar Cliente' : 'Cadastrar Cliente'}
        </Button>
      </div>
    </FormWrapper>
  );
}

export default React.memo(ClienteFormCompleto);