import React, { useState, useEffect, Suspense } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, Sparkles, Package, Upload, Calculator, 
  CheckCircle2, AlertTriangle, FileText, Globe, 
  TrendingUp, ArrowRightLeft, ShoppingCart, Image, Warehouse,
  Trash2, Power, PowerOff, Save
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import FormWrapper from "@/components/common/FormWrapper";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useQuery } from "@tanstack/react-query";
import { BotaoBuscaAutomatica } from "@/components/lib/BuscaDadosPublicos";
const HistoricoProduto = React.lazy(() => import("./HistoricoProduto"));
const FiscalContabilSection = React.lazy(() => import("./produto/FiscalContabilSection"));
const EstoqueAvancadoSection = React.lazy(() => import("./produto/EstoqueAvancadoSection"));
const PrecosSection = React.lazy(() => import("./produto/PrecosSection"));
const PesoDimensoesSection = React.lazy(() => import("./produto/PesoDimensoesSection"));

/**
 * V21.4 ETAPA 2/3 COMPLETA - CADASTRO COMPLETO DE PRODUTOS
 * ✅ Aba 1: Dados Gerais + TRIPLA CLASSIFICAÇÃO (Setor + Grupo + Marca)
 * ✅ Aba 2: Conversões (unidades, fatores)
 * ✅ Aba 3: Dimensões & Peso (frete/e-commerce)
 * ✅ Aba 4: E-Commerce & IA
 * ✅ Aba 5: Fiscal e Contábil (NOVO)
 * ✅ Aba 6: Estoque Avançado (NOVO)
 * ✅ Aba 7: Histórico (se edição)
 */
function ProdutoFormV22_Completo({ produto, onSubmit, onSuccess, isSubmitting, windowMode = false, closeSelf }) {
  const [abaAtiva, setAbaAtiva] = useState('dados-gerais');
  const [user, setUser] = useState(null);
  const {
    empresaAtual,
    grupoAtual,
    carimbarContexto,
    filterInContext,
    createInContext,
    updateInContext,
    deleteInContext
  } = useContextoVisual();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const contextKey = empresaAtual?.id || groupId || "sem-contexto";
  const contextoValido = contextKey !== "sem-contexto";
  const podeCriar = canCreate("Cadastros", "Produto") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "Produto") || canEdit("Cadastros", null);
  const podeExcluir = canDelete("Cadastros", "Produto") || canDelete("Cadastros", null);
  
  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Failed to load current user:", error);
      }
    };
    loadUser();
  }, []);

  const [formData, setFormData] = useState(() => {
    if (produto) {
      return {
        ...produto,
        // Garante que a Unidade Principal apareça selecionada no formulário
        unidade_principal: produto.unidade_principal || produto.unidade_medida || (produto.eh_bitola ? 'KG' : 'UN'),
        // Garante que a unidade principal esteja presente nas unidades habilitadas
        unidades_secundarias: (() => {
          const base = produto.unidades_secundarias || ['KG'];
          const up = produto.unidade_principal || produto.unidade_medida || (produto.eh_bitola ? 'KG' : undefined);
          return up && !base.includes(up) ? [...base, up] : base;
        })(),
        fatores_conversao: produto.fatores_conversao || {
          kg_por_peca: 0,
          kg_por_metro: 0,
          metros_por_peca: 0,
          peca_por_ton: 0,
          kg_por_ton: 1000
        },
        peso_liquido_kg: produto.peso_liquido_kg || 0,
        peso_bruto_kg: produto.peso_bruto_kg || 0,
        altura_cm: produto.altura_cm || 0,
        largura_cm: produto.largura_cm || 0,
        comprimento_cm: produto.comprimento_cm || 0,
        tributacao: produto.tributacao || {
          icms_cst: '',
          icms_aliquota: 0,
          pis_cst: '',
          pis_aliquota: 0,
          cofins_cst: '',
          cofins_aliquota: 0,
          ipi_cst: '',
          ipi_aliquota: 0
        },
        origem_mercadoria: produto.origem_mercadoria || '0 - Nacional',
        regime_tributario_produto: produto.regime_tributario_produto || 'Simples Nacional',
        cfop_padrao_compra: produto.cfop_padrao_compra || '',
        cfop_padrao_venda: produto.cfop_padrao_venda || '',
        conta_contabil_id: produto.conta_contabil_id || '',
        controla_lote: produto.controla_lote || false,
        controla_validade: produto.controla_validade || false,
        prazo_validade_dias: produto.prazo_validade_dias || 0,
        localizacao: produto.localizacao || '',
        almoxarifado_id: produto.almoxarifado_id || ''
      };
    }
    
    // V22.0: Auto-incremento de código será definido após carregar produtos
    return {
      descricao: '',
      codigo: '',
      codigo_barras: '',
      tipo_item: 'Revenda',
      grupo: 'Outros',
      eh_bitola: false,
      peso_teorico_kg_m: 0,
      bitola_diametro_mm: 0,
      tipo_aco: 'CA-50',
      comprimento_barra_padrao_m: 12,
      unidade_principal: 'KG',
      unidades_secundarias: ['KG'],
      fatores_conversao: {
        kg_por_peca: 0,
        kg_por_metro: 0,
        metros_por_peca: 0,
        peca_por_ton: 0,
        kg_por_ton: 1000
      },
      foto_produto_url: '',
      custo_aquisicao: 0,
      preco_venda: 0,
      margem_minima_percentual: 10,
      estoque_minimo: 0,
      estoque_maximo: 0,
      ponto_reposicao: 0,
      ncm: '',
      cest: '',
      unidade_medida: '',
      status: 'Ativo',
      peso_liquido_kg: 0,
      peso_bruto_kg: 0,
      altura_cm: 0,
      largura_cm: 0,
      comprimento_cm: 0,
      exibir_no_site: false,
      exibir_no_marketplace: false,
      origem_mercadoria: '0 - Nacional',
      regime_tributario_produto: 'Simples Nacional',
      tributacao: {
        icms_cst: '',
        icms_aliquota: 0,
        pis_cst: '',
        pis_aliquota: 0,
        cofins_cst: '',
        cofins_aliquota: 0,
        ipi_cst: '',
        ipi_aliquota: 0
      },
      cfop_padrao_compra: '',
      cfop_padrao_venda: '',
      conta_contabil_id: '',
      controla_lote: false,
      controla_validade: false,
      prazo_validade_dias: 0,
      localizacao: '',
      almoxarifado_id: ''
    };
  });

  const [iaSugestao, setIaSugestao] = useState(null);
  // Mantém w-full/h-full e responsivo/redimensionável (conteúdo já usa classes).
  const [processandoIA, setProcessandoIA] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [calculoConversao, setCalculoConversao] = useState(null);
  const [sugestoesIA, setSugestoesIA] = useState({});
  const [modoManual, setModoManual] = useState(false);
  const [gerandoDescricaoSEO, setGerandoDescricaoSEO] = useState(false);
  const [gerandoImagem, setGerandoImagem] = useState(false);

  // V22.0: Query de produtos para auto-incremento
  const { data: todosProdutos = [] } = useQuery({
    queryKey: ['produtos-codes-sample', contextKey],
    queryFn: () => filterInContext('Produto', {}, '-created_date', 100),
    staleTime: 300000,
    keepPreviousData: true,
    refetchOnWindowFocus: false,
    enabled: !produto && abaAtiva === 'dados-gerais' && contextoValido,
  });

  useEffect(() => {
    if (!produto && !formData.codigo && Array.isArray(todosProdutos)) {
      const ultimoCodigo = todosProdutos
        .map(p => p.codigo)
        .filter(c => c && /^\d+$/.test(c))
        .map(c => parseInt(c))
        .sort((a, b) => b - a)[0] || 0;
      const proximoCodigo = (ultimoCodigo + 1).toString().padStart(4, '0');
      setFormData(prev => ({ ...prev, codigo: proximoCodigo }));
    }
  }, [todosProdutos, produto, formData.codigo]);

  // V21.2 FASE 2: Queries dos estruturantes
  const { data: setores = [] } = useQuery({
    queryKey: ['setores-atividade', contextKey],
    queryFn: () => filterInContext('SetorAtividade', {}, 'nome', 200),
    staleTime: 300000,
    keepPreviousData: true,
    refetchOnWindowFocus: false,
    enabled: abaAtiva === 'dados-gerais' && contextoValido,
  });

  const { data: grupos = [] } = useQuery({
    queryKey: ['grupos-produto', contextKey],
    queryFn: () => filterInContext('GrupoProduto', {}, 'nome', 200),
    staleTime: 300000,
    keepPreviousData: true,
    refetchOnWindowFocus: false,
    enabled: abaAtiva === 'dados-gerais' && contextoValido,
  });

  const { data: marcas = [] } = useQuery({
    queryKey: ['marcas', contextKey],
    queryFn: () => filterInContext('Marca', {}, 'nome', 200),
    staleTime: 300000,
    keepPreviousData: true,
    refetchOnWindowFocus: false,
    enabled: abaAtiva === 'dados-gerais' && contextoValido,
  });

  const { data: locaisEstoque = [] } = useQuery({
    queryKey: ['locais-estoque', contextKey],
    queryFn: () => filterInContext('LocalEstoque', {}, 'nome', 200),
    staleTime: 300000,
    keepPreviousData: true,
    refetchOnWindowFocus: false,
    enabled: abaAtiva === 'estoque-avancado' && contextoValido,
  });

  const { data: planoContas = [] } = useQuery({
    queryKey: ['plano-contas', contextKey],
    queryFn: () => filterInContext('PlanoDeContas', {}, 'codigo', 500),
    staleTime: 300000,
    keepPreviousData: true,
    refetchOnWindowFocus: false,
    enabled: abaAtiva === 'fiscal-contabil' && contextoValido,
  });

  useEffect(() => {
    if (formData.eh_bitola) {
      recalcularFatoresConversao();
    }
  }, [formData.peso_teorico_kg_m, formData.comprimento_barra_padrao_m, formData.eh_bitola]);

  useEffect(() => {
    if (formData.altura_cm > 0 && formData.largura_cm > 0 && formData.comprimento_cm > 0) {
      const volume_m3 = (formData.altura_cm * formData.largura_cm * formData.comprimento_cm) / 1000000;
      setFormData(prev => ({ ...prev, volume_m3 }));
    }
  }, [formData.altura_cm, formData.largura_cm, formData.comprimento_cm]);

  const recalcularFatoresConversao = () => {
    const pesoKgM = formData.peso_teorico_kg_m || 0;
    const comprimentoM = formData.comprimento_barra_padrao_m || 12;
    
    const kgPorPeca = pesoKgM * comprimentoM;
    const pecaPorTon = kgPorPeca > 0 ? (1000 / kgPorPeca) : 0;
    
    const novosFatores = {
      kg_por_metro: pesoKgM,
      kg_por_peca: kgPorPeca,
      metros_por_peca: comprimentoM,
      peca_por_ton: pecaPorTon,
      kg_por_ton: 1000
    };

    setFormData(prev => ({
      ...prev,
      fatores_conversao: novosFatores
    }));

    setCalculoConversao(novosFatores);
  };

  const analisarDescricaoIA = async (descricao) => {
    if (!descricao || descricao.length < 5) return;
    
    setProcessandoIA(true);
    
    try {
      const resultado = await base44.integrations.Core.InvokeLLM({
        prompt: `Analise esta descrição de produto: "${descricao}".

Se for uma bitola de aço (ex: "Barra 8mm 12m CA-50", "Vergalhão 10mm"), retorne:
- eh_bitola: true
- peso_teorico_kg_m: peso teórico em kg/m (tabela oficial):
  * 6.3mm = 0.245 kg/m
  * 8mm = 0.395 kg/m
  * 10mm = 0.617 kg/m
  * 12.5mm = 0.963 kg/m
  * 16mm = 1.578 kg/m
  * 20mm = 2.466 kg/m
  * 25mm = 3.853 kg/m
  * 32mm = 6.313 kg/m
- bitola_diametro_mm: diâmetro em mm
- tipo_aco: CA-25, CA-50 ou CA-60
- ncm: "7214.20.00" (vergalhões)
- grupo_produto: "Bitola"
- comprimento_barra_m: 12 (padrão)
- unidade_principal: "KG"
- unidades_secundarias: ["PÇ", "KG", "MT"]
- confianca: número de 0-100 indicando confiança

Caso contrário, sugira:
- grupo_produto adequado
- ncm provável
- unidade_principal e unidades_secundarias apropriadas
- confianca: número de 0-100`,
        response_json_schema: {
          type: "object",
          properties: {
            eh_bitola: { type: "boolean" },
            peso_teorico_kg_m: { type: "number" },
            bitola_diametro_mm: { type: "number" },
            tipo_aco: { type: "string" },
            ncm: { type: "string" },
            grupo_produto: { type: "string" },
            comprimento_barra_m: { type: "number" },
            unidade_principal: { type: "string" },
            unidades_secundarias: {
              type: "array",
              items: { type: "string" }
            },
            confianca: { type: "number" },
            explicacao: { type: "string" }
          }
        }
      });

      setIaSugestao(resultado);
      setSugestoesIA(prev => ({
        ...prev,
        classificacao_confianca: resultado.confianca
      }));
      toast.success('✨ IA analisou o produto!');
    } catch (error) {
      toast.error('Erro ao processar IA');
    } finally {
      setProcessandoIA(false);
    }
  };

  const aplicarSugestaoIA = () => {
    if (!iaSugestao || modoManual) return;
    
    setFormData(prev => ({
      ...prev,
      eh_bitola: iaSugestao.eh_bitola || false,
      peso_teorico_kg_m: iaSugestao.peso_teorico_kg_m || 0,
      bitola_diametro_mm: iaSugestao.bitola_diametro_mm || 0,
      tipo_aco: iaSugestao.tipo_aco || 'CA-50',
      ncm: iaSugestao.ncm || '',
      grupo: iaSugestao.grupo_produto || prev.grupo,
      comprimento_barra_padrao_m: iaSugestao.comprimento_barra_m || 12,
      unidade_principal: iaSugestao.unidade_principal || 'KG',
      unidades_secundarias: iaSugestao.unidades_secundarias || ['KG']
    }));
    
    toast.success('✅ Sugestões aplicadas!');
    setIaSugestao(null);
  };

  const handleUploadFoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingFoto(true);
    
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, foto_produto_url: file_url });
      toast.success('✅ Foto carregada!');
    } catch (error) {
      toast.error('Erro ao fazer upload');
    } finally {
      setUploadingFoto(false);
    }
  };

  const toggleUnidadeSecundaria = (unidade) => {
    const unidades = formData.unidades_secundarias || [];
    if (unidades.includes(unidade)) {
      setFormData(prev => ({
        ...prev,
        unidades_secundarias: unidades.filter(u => u !== unidade)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        unidades_secundarias: [...unidades, unidade]
      }));
    }
  };

  const handleDadosNCM = (dados) => {
    setFormData((prev) => ({
      ...prev,
      unidade_medida: dados.unidade || prev.unidade_medida,
      cest: dados.cest || prev.cest
    }));

    setSugestoesIA((prev) => ({
      ...prev,
      ncm_info: `${dados.descricao}${dados.obs ? ' - ' + dados.obs : ''}`,
      aliquotas: dados
    }));

    toast.success("NCM encontrado!", { description: dados.descricao });
  };

  const gerarDescricaoSEO = async () => {
    if (!formData.descricao) {
      toast.error("Preencha a descrição básica primeiro");
      return;
    }

    setGerandoDescricaoSEO(true);

    try {
      const descricaoSEO = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um especialista em SEO para e-commerce. 
        
        Crie uma descrição detalhada e otimizada para SEO para este produto: "${formData.descricao}"
        
        NCM: ${formData.ncm || 'Não informado'}
        Grupo: ${formData.grupo || 'Não informado'}
        É bitola: ${formData.eh_bitola ? 'Sim' : 'Não'}
        
        A descrição deve:
        - Ter 150-250 palavras
        - Incluir palavras-chave relevantes
        - Destacar benefícios e aplicações
        - Ser atrativa para vendas online
        - Incluir especificações técnicas se houver
        
        Retorne apenas o texto da descrição.`
      });

      setFormData(prev => ({
        ...prev,
        descricao_seo: descricaoSEO
      }));

      toast.success("✅ Descrição SEO gerada!");
    } catch (error) {
      toast.error("Erro ao gerar descrição");
    } finally {
      setGerandoDescricaoSEO(false);
    }
  };

  const gerarImagemIA = async () => {
    if (!formData.descricao) {
      toast.error("Preencha a descrição do produto primeiro");
      return;
    }

    setGerandoImagem(true);

    try {
      const { url } = await base44.integrations.Core.GenerateImage({
        prompt: `Product photography of ${formData.descricao}, professional lighting, white background, high quality, detailed, 4k`
      });

      setFormData(prev => ({
        ...prev,
        foto_produto_url: url
      }));

      toast.success("✅ Imagem gerada pela IA!");
    } catch (error) {
      toast.error("Erro ao gerar imagem");
    } finally {
      setGerandoImagem(false);
    }
  };

  const submitProduto = async () => {
    if (!formData.descricao) {
      toast.error('Preencha a descrição do produto');
      return;
    }

    if (!contextoValido) {
      toast.error('Selecione um grupo ou empresa antes de salvar o produto');
      return;
    }
    if (produto?.id ? !podeEditar : !podeCriar) {
      toast.error('Seu perfil nao permite salvar produtos');
      return;
    }

    if (formData.codigo && !produto?.id) {
      try {
        const produtosExistentes = await filterInContext('Produto', { codigo: formData.codigo }, '-created_date', 1);
        if (produtosExistentes.length > 0) {
          toast.error(`❌ Código "${formData.codigo}" já existe em outro produto`);
          setAbaAtiva('dados-gerais');
          return;
        }
      } catch (error) {
        console.error('Erro ao verificar código duplicado:', error);
      }
    }

    if (!formData.setor_atividade_id) {
      toast.error('Selecione o Setor de Atividade');
      setAbaAtiva('dados-gerais');
      return;
    }

    if (!formData.grupo_produto_id) {
      toast.error('Selecione o Grupo de Produto');
      setAbaAtiva('dados-gerais');
      return;
    }

    if (!formData.marca_id) {
      toast.error('Selecione a Marca');
      setAbaAtiva('dados-gerais');
      return;
    }

    if (!formData.unidades_secundarias || formData.unidades_secundarias.length === 0) {
      toast.error('Selecione pelo menos 1 unidade de venda/compra');
      setAbaAtiva('conversoes');
      return;
    }

    if (formData.eh_bitola && formData.peso_teorico_kg_m === 0) {
      toast.error('Bitolas precisam ter peso teórico preenchido');
      setAbaAtiva('dados-gerais');
      return;
    }

    const dadosBase = {
      ...formData,
      unidade_medida: formData.unidade_principal || formData.unidade_medida || 'KG',
      tributacao: {
        icms_cst: formData.tributacao.icms_cst || '',
        icms_aliquota: formData.tributacao.icms_aliquota || 0,
        pis_cst: formData.tributacao.pis_cst || '',
        pis_aliquota: formData.tributacao.pis_aliquota || 0,
        cofins_cst: formData.tributacao.cofins_cst || '',
        cofins_aliquota: formData.tributacao.cofins_aliquota || 0,
        ipi_cst: formData.tributacao.ipi_cst || '',
        ipi_aliquota: formData.tributacao.ipi_aliquota || 0
      }
    };

    const dadosSubmit = carimbarContexto(dadosBase, 'empresa_id');

    try {
      if (produto?.id) {
        await updateInContext('Produto', produto.id, dadosSubmit);
        toast.success('✅ Produto atualizado com sucesso!');
      } else {
        await createInContext('Produto', dadosSubmit);
        toast.success('✅ Produto criado com sucesso!');
      }
      if (onSuccess) onSuccess();
      if (onSubmit) onSubmit(dadosSubmit);
      if (typeof closeSelf === 'function') closeSelf();
    } catch (error) {
      toast.error('❌ Erro ao salvar produto: ' + error.message);
    }
  };

  const unifiedSubmit = submitProduto;

  const handleExcluir = () => {
    if (!window.confirm(`Tem certeza que deseja excluir o produto "${formData.descricao}"? Esta ação não pode ser desfeita.`)) {
      return;
    }
    if (!podeExcluir) {
      toast.error('Seu perfil nao permite excluir produtos');
      return;
    }
    if (produto?.id) {
      deleteInContext('Produto', produto.id)
        .then(() => {
          toast.success('Produto excluido com sucesso!');
          if (onSuccess) onSuccess();
          if (typeof closeSelf === 'function') closeSelf();
        })
        .catch((error) => toast.error('Erro ao excluir produto: ' + error.message));
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

  const totalAbas = 7; // SEMPRE 7 abas - ETAPA 4 COMPLETA

  const content = (
    <FormWrapper onSubmit={unifiedSubmit} externalData={formData} className={`w-full h-full overflow-auto p-6 space-y-6`}>
      {/* TOGGLE MODO MANUAL */}
      <Alert className="border-blue-300 bg-blue-50">
        <AlertDescription>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm text-blue-900">🤖 Assistência de IA</p>
              <p className="text-xs text-blue-700">A IA pode sugerir NCM, grupo, bitola e unidades automaticamente</p>
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-sm">Preencher manualmente</Label>
              <Switch
                checked={modoManual}
                onCheckedChange={setModoManual}
                disabled={!contextoValido || (produto?.id ? !podeEditar : !podeCriar)}
                data-permission="Cadastros.Produto.editar"
                data-action="alternar-modo-manual-produto"
                data-sensitive
              />
            </div>
          </div>
        </AlertDescription>
      </Alert>

      {/* ABAS DO FORMULÁRIO - 7 ABAS ETAPA 4 */}
      <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
        <TabsList className="grid grid-cols-7 w-full bg-slate-100">
          <TabsTrigger value="dados-gerais">
            <Package className="w-4 h-4 mr-1" />
            Dados Gerais
          </TabsTrigger>
          <TabsTrigger value="conversoes">
            <Calculator className="w-4 h-4 mr-1" />
            Conversões
          </TabsTrigger>
          <TabsTrigger value="dimensoes">
            <Package className="w-4 h-4 mr-1" />
            Peso/Dim
          </TabsTrigger>
          <TabsTrigger value="ecommerce">
            <Globe className="w-4 h-4 mr-1" />
            E-Commerce
          </TabsTrigger>
          <TabsTrigger value="fiscal-contabil">
            <FileText className="w-4 h-4 mr-1" />
            Fiscal
          </TabsTrigger>
          <TabsTrigger value="estoque-avancado">
            <Warehouse className="w-4 h-4 mr-1" />
            Estoque
          </TabsTrigger>
          <TabsTrigger value="historico">
            <TrendingUp className="w-4 h-4 mr-1" />
            Histórico
          </TabsTrigger>
        </TabsList>

        {/* ABA 1: DADOS GERAIS */}
        <TabsContent value="dados-gerais" className="space-y-6">
          <Card className="border-purple-200 bg-white/60 backdrop-blur-md shadow-lg">
            <CardContent className="p-4 space-y-4">
              <h3 className="font-bold flex items-center gap-2 text-purple-900">
                <Package className="w-5 h-5" />
                Identificação do Produto
              </h3>

              <div>
                <Label>Descrição do Produto *</Label>
                <div className="flex gap-2">
                  <Input
                    value={formData.descricao}
                    onChange={(e) => setFormData(prev => ({...prev, descricao: e.target.value}))}
                    placeholder="Ex: Vergalhão 8mm 12m CA-50"
                    className="flex-1"
                    data-permission="Cadastros.Produto.editar"
                    data-action="editar-descricao-produto"
                    data-sensitive
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => analisarDescricaoIA(formData.descricao)}
                    disabled={processandoIA || modoManual}
                    data-permission="Cadastros.Produto.ia"
                    data-action="analisar-descricao-produto-ia"
                    data-sensitive
                  >
                    {processandoIA ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-slate-500 mt-1">✨ IA preenche automaticamente NCM, peso e unidades</p>
              </div>

              {iaSugestao && !modoManual && (
                <Alert className="border-purple-300 bg-purple-100">
                  <AlertDescription>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-sm text-purple-900 mb-1">🤖 IA Classificou:</p>
                        <p className="text-xs text-purple-800">{iaSugestao.explicacao}</p>
                        {iaSugestao.confianca && (
                          <Badge className="mt-2 bg-purple-600 text-white">
                            Confiança: {iaSugestao.confianca}%
                          </Badge>
                        )}
                      </div>
                      <Button size="sm" onClick={aplicarSugestaoIA} className="bg-purple-600" data-permission="Cadastros.Produto.ia" data-action="aplicar-sugestao-produto-ia" data-sensitive>
                        Aplicar Tudo
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* V21.2 FASE 2: TRIPLA CLASSIFICAÇÃO OBRIGATÓRIA */}
              <Alert className="border-blue-300 bg-gradient-to-r from-blue-50 to-purple-50">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <AlertDescription className="text-sm">
                  <strong className="text-blue-900">FASE 2:</strong> Classificação tripla obrigatória para rastreabilidade total
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="flex items-center gap-2">
                    <span className="text-indigo-600">🏭</span>
                    Setor de Atividade *
                  </Label>
                  <Select 
                    value={formData.setor_atividade_id} 
                    onValueChange={(v) => {
                      const setor = setores.find(s => s.id === v);
                      setFormData(prev => ({
                        ...prev, 
                        setor_atividade_id: v,
                        setor_atividade_nome: setor?.nome
                      }));
                    }}
                  >
                    <SelectTrigger data-permission="Cadastros.Produto.editar" data-action="selecionar-setor-atividade-produto" data-sensitive>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {setores.filter(s => s.ativo !== false).map(setor => (
                        <SelectItem key={setor.id} value={setor.id}>
                          {setor.icone} {setor.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="flex items-center gap-2">
                    <span className="text-cyan-600">📦</span>
                    Grupo de Produto *
                  </Label>
                  <Select 
                    value={formData.grupo_produto_id} 
                    onValueChange={(v) => {
                      const grupo = grupos.find(g => g.id === v);
                      setFormData(prev => ({
                        ...prev, 
                        grupo_produto_id: v,
                        grupo_produto_nome: grupo?.nome_grupo,
                        ncm: grupo?.ncm_padrao || prev.ncm,
                        margem_minima_percentual: grupo?.margem_sugerida || prev.margem_minima_percentual
                      }));
                      if (grupo?.ncm_padrao) {
                        toast.success(`✅ NCM herdado: ${grupo.ncm_padrao}`);
                      }
                    }}
                  >
                    <SelectTrigger data-permission="Cadastros.Produto.editar" data-action="selecionar-grupo-produto-produto" data-sensitive>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {grupos.filter(g => g.ativo !== false).map(grupo => (
                        <SelectItem key={grupo.id} value={grupo.id}>
                          {grupo.icone} {grupo.nome_grupo} ({grupo.codigo})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="flex items-center gap-2">
                    <span className="text-amber-600">🏆</span>
                    Marca *
                  </Label>
                  <Select 
                    value={formData.marca_id} 
                    onValueChange={(v) => {
                      const marca = marcas.find(m => m.id === v);
                      setFormData(prev => ({
                        ...prev, 
                        marca_id: v,
                        marca_nome: marca?.nome_marca
                      }));
                    }}
                  >
                    <SelectTrigger data-permission="Cadastros.Produto.editar" data-action="selecionar-marca-produto" data-sensitive>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {marcas.filter(m => m.ativo !== false).map(marca => (
                        <SelectItem key={marca.id} value={marca.id}>
                          {marca.pais_origem !== 'Brasil' && '🌍'} {marca.nome_marca}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.setor_atividade_nome && formData.grupo_produto_nome && formData.marca_nome && (
                <Alert className="border-green-300 bg-green-100">
                  <CheckCircle2 className="w-4 h-4 text-green-700" />
                  <AlertDescription className="text-sm text-green-900">
                    <strong>Classificação Completa:</strong> {formData.setor_atividade_nome} → {formData.grupo_produto_nome} → {formData.marca_nome}
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Código/SKU *</Label>
                  <Input
                    value={formData.codigo}
                    onChange={(e) => setFormData(prev => ({...prev, codigo: e.target.value}))}
                    placeholder="0001"
                    required
                    data-permission="Cadastros.Produto.editar"
                    data-action="editar-codigo-produto"
                    data-sensitive
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {produto ? 'Código do produto' : `Próximo: ${formData.codigo}`}
                  </p>
                </div>

                <div>
                  <Label>Código de Barras</Label>
                  <Input
                    value={formData.codigo_barras}
                    onChange={(e) => setFormData(prev => ({...prev, codigo_barras: e.target.value}))}
                    placeholder="7891234567890"
                    data-permission="Cadastros.Produto.editar"
                    data-action="editar-codigo-barras-produto"
                    data-sensitive
                  />
                </div>

                <div>
                  <Label>Tipo de Item</Label>
                  <Select value={formData.tipo_item} onValueChange={(v) => setFormData(prev => ({...prev, tipo_item: v}))}>
                    <SelectTrigger data-permission="Cadastros.Produto.editar" data-action="selecionar-tipo-item-produto" data-sensitive>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Revenda">Revenda</SelectItem>
                      <SelectItem value="Matéria-Prima Produção">Matéria-Prima Produção</SelectItem>
                      <SelectItem value="Produto Acabado">Produto Acabado</SelectItem>
                      <SelectItem value="Consumo Interno">Consumo Interno</SelectItem>
                      <SelectItem value="Serviço">Serviço</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Foto do Produto</Label>
                <div className="flex items-center gap-4">
                  {formData.foto_produto_url && (
                    <img src={formData.foto_produto_url} alt="Produto" className="w-20 h-20 object-cover rounded border" />
                  )}
                  <div className="flex-1 flex gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadFoto}
                      className="hidden"
                      id="foto-upload"
                      data-permission="Cadastros.Produto.editar"
                      data-action="upload-foto-produto"
                      data-sensitive
                    />
                    <label htmlFor="foto-upload" className="flex-1">
                      <Button type="button" variant="outline" size="sm" disabled={uploadingFoto || !contextoValido || (produto?.id ? !podeEditar : !podeCriar)} className="w-full" asChild data-permission="Cadastros.Produto.editar" data-action="abrir-upload-foto-produto" data-sensitive>
                        <span>
                          {uploadingFoto ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                          {formData.foto_produto_url ? 'Alterar' : 'Upload'}
                        </span>
                      </Button>
                    </label>
                    {!modoManual && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={gerarImagemIA}
                        disabled={gerandoImagem || !contextoValido || (produto?.id ? !podeEditar : !podeCriar)}
                        className="bg-purple-600 hover:bg-purple-700"
                        data-permission="Cadastros.Produto.ia"
                        data-action="gerar-imagem-produto-ia"
                        data-sensitive
                      >
                        {gerandoImagem ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* É BITOLA? */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border-2 border-dashed">
            <div>
              <Label className="text-base font-semibold">É uma Bitola de Aço?</Label>
              <p className="text-xs text-slate-500">Habilita campos específicos e conversão PÇ ↔ KG ↔ MT</p>
            </div>
            <Switch
              checked={formData.eh_bitola}
              disabled={!contextoValido || (produto?.id ? !podeEditar : !podeCriar)}
              data-permission="Cadastros.Produto.editar"
              data-action="alternar-bitola-produto"
              data-sensitive
              onCheckedChange={(v) => {
                setFormData(prev => ({...prev, eh_bitola: v}));
                if (v) {
                  setFormData(prev => ({
                    ...prev,
                    unidade_principal: 'KG',
                    unidades_secundarias: ['PÇ', 'KG', 'MT']
                  }));
                }
              }}
            />
          </div>

          {/* CAMPOS DE BITOLA */}
          {formData.eh_bitola && (
            <Card className="border-blue-300 bg-white/60 backdrop-blur-md shadow-lg">
              <CardContent className="p-4 space-y-4">
                <h3 className="font-bold text-blue-900">📏 Especificações da Bitola</h3>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Diâmetro (mm) *</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.bitola_diametro_mm}
                      onChange={(e) => setFormData(prev => ({...prev, bitola_diametro_mm: parseFloat(e.target.value) || 0}))}
                      placeholder="8.0"
                      data-permission="Cadastros.Produto.editar"
                      data-action="editar-diametro-bitola-produto"
                      data-sensitive
                    />
                  </div>

                  <div>
                    <Label>Peso Teórico (kg/m) *</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={formData.peso_teorico_kg_m}
                      onChange={(e) => setFormData(prev => ({...prev, peso_teorico_kg_m: parseFloat(e.target.value) || 0}))}
                      placeholder="0.395"
                      data-permission="Cadastros.Produto.editar"
                      data-action="editar-peso-teorico-produto"
                      data-sensitive
                    />
                  </div>

                  <div>
                    <Label>Tipo de Aço</Label>
                    <Select value={formData.tipo_aco} onValueChange={(v) => setFormData(prev => ({...prev, tipo_aco: v}))}>
                      <SelectTrigger data-permission="Cadastros.Produto.editar" data-action="selecionar-tipo-aco-produto" data-sensitive>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CA-25">CA-25</SelectItem>
                        <SelectItem value="CA-50">CA-50</SelectItem>
                        <SelectItem value="CA-60">CA-60</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-3">
                    <Label>Comprimento Padrão da Barra (metros)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.comprimento_barra_padrao_m}
                      onChange={(e) => setFormData(prev => ({...prev, comprimento_barra_padrao_m: parseFloat(e.target.value) || 12}))}
                      placeholder="12"
                      data-permission="Cadastros.Produto.editar"
                      data-action="editar-comprimento-barra-produto"
                      data-sensitive
                    />
                  </div>
                </div>

                {calculoConversao && (
                  <Alert className="border-green-300 bg-green-50">
                    <Calculator className="w-4 h-4 text-green-700" />
                    <AlertDescription>
                      <p className="font-semibold text-sm text-green-900 mb-2">✅ Conversões Calculadas:</p>
                      <div className="grid grid-cols-2 gap-2 text-xs text-green-800">
                        <p>• 1 PÇ = <strong>{calculoConversao.kg_por_peca.toFixed(2)} KG</strong></p>
                        <p>• 1 MT = <strong>{calculoConversao.kg_por_metro.toFixed(3)} KG</strong></p>
                        <p>• 1 TON = <strong>{calculoConversao.peca_por_ton.toFixed(1)} PÇ</strong></p>
                        <p>• 1 PÇ = <strong>{calculoConversao.metros_por_peca} MT</strong></p>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {/* PRECIFICAÇÃO */}
          <Suspense fallback={<div className="h-24 rounded-xl bg-white/40 backdrop-blur animate-pulse" />}> 
            <PrecosSection formData={formData} setFormData={setFormData} />
          </Suspense>

          {/* STATUS */}
          <Card className="bg-white/60 backdrop-blur-md border-white/40 shadow-lg">
            <CardContent className="p-4">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData(prev => ({...prev, status: v}))}>
                <SelectTrigger data-permission="Cadastros.Produto.alterarStatus" data-action="selecionar-status-produto" data-sensitive>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Inativo">Inativo</SelectItem>
                  <SelectItem value="Descontinuado">Descontinuado</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 2: CONVERSÕES */}
        <TabsContent value="conversoes" className="space-y-6">
          <Card className="border-indigo-300 bg-white/60 backdrop-blur-md shadow-lg">
            <CardContent className="p-4 space-y-4">
              <h3 className="font-bold text-indigo-900">V22.0: Unidades e Conversões</h3>

              <Alert className="border-indigo-400 bg-indigo-100">
                <AlertDescription className="text-sm text-indigo-900">
                  🎯 <strong>REGRA MESTRE:</strong> As unidades selecionadas aqui estarão disponíveis em Vendas, Compras e Movimentações
                </AlertDescription>
              </Alert>

              <div>
                <Label>Unidade Principal (Relatórios) *</Label>
                <Select value={formData.unidade_principal} onValueChange={(v) => setFormData(prev => ({...prev, unidade_principal: v, unidade_medida: v }))}>
                  <SelectTrigger data-permission="Cadastros.Produto.editar" data-action="selecionar-unidade-principal-produto" data-sensitive>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UN">Unidade (UN)</SelectItem>
                    <SelectItem value="PÇ">Peça (PÇ)</SelectItem>
                    <SelectItem value="KG">Quilograma (KG)</SelectItem>
                    <SelectItem value="MT">Metro (MT)</SelectItem>
                    <SelectItem value="TON">Tonelada (TON)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Unidades Habilitadas (Multi-Select) *</Label>
                <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-white">
                  {['UN', 'PÇ', 'KG', 'MT', 'TON', 'CX', 'BARRA'].map(unidade => (
                    <Badge
                      key={unidade}
                      className={`cursor-pointer transition-all ${
                        (formData.unidades_secundarias || []).includes(unidade)
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    onClick={() => toggleUnidadeSecundaria(unidade)}
                    data-permission="Cadastros.Produto.editar"
                    data-action={`alternar-unidade-secundaria-${unidade}`}
                    data-sensitive
                  >
                      {(formData.unidades_secundarias || []).includes(unidade) && <CheckCircle2 className="w-3 h-3 mr-1" />}
                      {unidade}
                    </Badge>
                  ))}
                </div>
              </div>

              {calculoConversao && (
                <Card className="border-green-200 bg-white/60 backdrop-blur-md shadow-lg">
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-sm text-green-900 mb-3">✅ Fatores de Conversão</h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <p>1 PÇ = {calculoConversao.kg_por_peca.toFixed(2)} KG</p>
                      <p>1 MT = {calculoConversao.kg_por_metro.toFixed(3)} KG</p>
                      <p>1 TON = {calculoConversao.peca_por_ton.toFixed(1)} PÇ</p>
                      <p>1 PÇ = {calculoConversao.metros_por_peca} MT</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 3: DIMENSÕES E PESO */}
        <TabsContent value="dimensoes" className="space-y-6">
          <Suspense fallback={<div className="h-24 rounded-xl bg-white/40 backdrop-blur animate-pulse" />}> 
            <PesoDimensoesSection formData={formData} setFormData={setFormData} />
          </Suspense>
        </TabsContent>

        {/* ABA 4: E-COMMERCE */}
        <TabsContent value="ecommerce" className="space-y-6">
          <Card className="border-purple-200 bg-white/60 backdrop-blur-md shadow-lg">
            <CardContent className="p-6 space-y-4">
              <h3 className="font-bold text-purple-900">🛒 Canais de Venda</h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-white rounded-lg border">
                  <div>
                    <Label className="text-base font-semibold">Exibir no Site</Label>
                    <p className="text-xs text-slate-500">Produto aparecerá no catálogo web</p>
                  </div>
                  <Switch
                    checked={formData.exibir_no_site || false}
                    onCheckedChange={(v) => setFormData(prev => ({...prev, exibir_no_site: v}))}
                    disabled={!contextoValido || (produto?.id ? !podeEditar : !podeCriar)}
                    data-permission="Cadastros.Produto.editar"
                    data-action="alternar-exibir-site-produto"
                    data-sensitive
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-white rounded-lg border">
                  <div>
                    <Label className="text-base font-semibold">Sincronizar Marketplace</Label>
                    <p className="text-xs text-slate-500">Mercado Livre, Shopee</p>
                  </div>
                  <Switch
                    checked={formData.exibir_no_marketplace || false}
                    onCheckedChange={(v) => setFormData(prev => ({...prev, exibir_no_marketplace: v}))}
                    disabled={!contextoValido || (produto?.id ? !podeEditar : !podeCriar)}
                    data-permission="Cadastros.Produto.editar"
                    data-action="alternar-exibir-marketplace-produto"
                    data-sensitive
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {(formData.exibir_no_site || formData.exibir_no_marketplace) && (
            <Card className="border-green-200 bg-white/60 backdrop-blur-md shadow-lg">
              <CardContent className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-green-900">📝 Descrição SEO</h3>
                  <Button
                    type="button"
                    size="sm"
                    onClick={gerarDescricaoSEO}
                    disabled={gerandoDescricaoSEO || modoManual}
                    className="bg-green-600 hover:bg-green-700"
                    data-permission="Cadastros.Produto.ia"
                    data-action="gerar-descricao-seo-produto-ia"
                    data-sensitive
                  >
                    {gerandoDescricaoSEO ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    Gerar com IA
                  </Button>
                </div>

                <Textarea
                  value={formData.descricao_seo || ''}
                  onChange={(e) => setFormData(prev => ({...prev, descricao_seo: e.target.value}))}
                  placeholder="Descrição detalhada para SEO..."
                  className="min-h-[100px]"
                  data-permission="Cadastros.Produto.editar"
                  data-action="editar-descricao-seo-produto"
                  data-sensitive
                />

                <div>
                  <Label>URL Amigável (Slug)</Label>
                  <Input
                    value={formData.slug_site || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev, 
                      slug_site: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')
                    }))}
                    placeholder="vergalhao-8mm-ca50"
                    data-permission="Cadastros.Produto.editar"
                    data-action="editar-slug-produto"
                    data-sensitive
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ABA 5: FISCAL E CONTÁBIL */}
        <TabsContent value="fiscal-contabil" className="space-y-6">
          <Suspense fallback={<div className="h-24 rounded-xl bg-white/40 backdrop-blur animate-pulse" />}> 
            <FiscalContabilSection 
              formData={formData}
              setFormData={setFormData}
              sugestoesIA={sugestoesIA}
              handleDadosNCM={handleDadosNCM}
              planoContas={planoContas}
            />
          </Suspense>
        </TabsContent>

        {/* ABA 6: ESTOQUE AVANÇADO */}
        <TabsContent value="estoque-avancado" className="space-y-6">
          <Suspense fallback={<div className="h-24 rounded-xl bg-white/40 backdrop-blur animate-pulse" />}> 
            <EstoqueAvancadoSection 
              formData={formData}
              setFormData={setFormData}
              locaisEstoque={locaisEstoque}
            />
          </Suspense>
        </TabsContent>

        {/* ABA 7: HISTÓRICO */}
        <TabsContent value="historico" className="space-y-6">
          {produto ? (
                        <Suspense fallback={<div className="h-24 rounded-xl bg-white/40 backdrop-blur animate-pulse" />}> 
                          <HistoricoProduto produtoId={produto.id} produto={produto} />
                        </Suspense>
          ) : (
            <Card className="border-blue-200 bg-white/60 backdrop-blur-md shadow-lg">
              <CardContent className="p-12 text-center">
                <TrendingUp className="w-16 h-16 text-blue-400 mx-auto mb-4" />
                <p className="text-slate-600">O histórico estará disponível após criar o produto</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* BOTÕES DE AÇÃO */}
      <div className="flex items-center justify-between pt-4 border-t sticky bottom-0 bg-white">
        <div className="flex gap-2">
          {produto && (
            <>
              <Button
                type="button"
                variant="outline"
                data-permission="Cadastros.Produto.alterarStatus"
                data-action={formData.status === 'Ativo' ? "inativar-produto" : "ativar-produto"}
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
                data-permission="Cadastros.Produto.excluir"
                data-action="excluir-produto"
                data-sensitive
                onClick={handleExcluir}
                disabled={!podeExcluir || !contextoValido}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir
              </Button>
            </>
          )}
        </div>
        <Button type="submit" data-permission="Cadastros.Produto.salvar" data-action="salvar-produto" data-sensitive disabled={isSubmitting || !contextoValido || (produto?.id ? !podeEditar : !podeCriar)} className="bg-purple-600 hover:bg-purple-700 px-8">
          {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {!isSubmitting && <Save className="w-4 h-4 mr-2" />}
          {produto ? 'Atualizar Produto' : 'Criar Produto'}
        </Button>
      </div>
    </FormWrapper>
  );

  if (windowMode) {
    return <div className="w-full h-full bg-white">{content}</div>;
  }

  return content;
}

export default React.memo(ProdutoFormV22_Completo);
