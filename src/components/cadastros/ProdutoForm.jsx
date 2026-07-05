import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Package, Upload, Calculator, CheckCircle2, AlertTriangle, FileText, Factory, TrendingUp } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { BotaoBuscaAutomatica } from "@/components/lib/BuscaDadosPublicos";
import ProtectedField from "@/components/security/ProtectedField";
import { z } from "zod";
import FormWrapper from "@/components/common/FormWrapper";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

/**
 * V21.6 - EVOLUÃ‡ÃƒO DO CADASTRO DE PRODUTOS
 * âœ… Toggle "Preencher manualmente" (ignorar IA)
 * âœ… Campos de peso lÃ­quido/bruto + dimensÃµes (frete/e-commerce)
 * âœ… Suporte para cadastro via NF-e e em lote (botÃµes preparados)
 * âœ… NOVO: BotÃ£o "Enviar para ProduÃ§Ã£o" - converte produtos de Revenda para MatÃ©ria-Prima
 * V22.0: REGRA MESTRE DE CONVERSÃƒO DE UNIDADES
 * Este formulÃ¡rio Ã© o HUB central que define como o produto pode ser vendido/comprado
 */
const sanitizeText = (value, max = 500) => String(value ?? "").replace(/[<>]/g, "").slice(0, max).trim();
const sanitizeCode = (value, max = 80) => String(value ?? "").replace(/[^0-9A-Za-z_.\-/\s]/g, "").slice(0, max).trim();
const toNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const sanitizeArray = (values, max = 20) => Array.isArray(values) ? values.map((value) => sanitizeText(value, 40)).filter(Boolean).slice(0, max) : [];

export default function ProdutoForm({ produto, item, data, initialData, defaultValues, onSubmit, isSubmitting }) {
  const dadosIniciais = item || data || initialData || defaultValues || produto;
  const { canCreate, canEdit } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const podeCriar = canCreate("Cadastros", "Produto") || canCreate("Estoque", "Produto") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "Produto") || canEdit("Estoque", "Produto") || canEdit("Cadastros", null);
  const podeSalvar = dadosIniciais?.id ? podeEditar : podeCriar;
  const [formData, setFormData] = useState(() => {
    if (dadosIniciais) {
      return {
        ...dadosIniciais,
        unidades_secundarias: dadosIniciais.unidades_secundarias || ['KG'],
        fatores_conversao: dadosIniciais.fatores_conversao || {
          kg_por_peca: 0,
          kg_por_metro: 0,
          metros_por_peca: 0,
          peca_por_ton: 0,
          kg_por_ton: 1000
        },
        // V21.1.2: NOVOS CAMPOS
        peso_liquido_kg: dadosIniciais.peso_liquido_kg || 0,
        peso_bruto_kg: dadosIniciais.peso_bruto_kg || 0,
        altura_cm: dadosIniciais.altura_cm || 0,
        largura_cm: dadosIniciais.largura_cm || 0,
        comprimento_cm: dadosIniciais.comprimento_cm || 0
      };
    }

    return {
      descricao: '',
      codigo: '',
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
      estoque_minimo: 0,
      ncm: '',
      cest: '',
      unidade_medida: '',
      status: 'Ativo',
      // V21.1.2: NOVOS CAMPOS
      peso_liquido_kg: 0,
      peso_bruto_kg: 0,
      altura_cm: 0,
      largura_cm: 0,
      comprimento_cm: 0
    };
  });

  const [iaSugestao, setIaSugestao] = useState(null);
  const [processandoIA, setProcessandoIA] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [calculoConversao, setCalculoConversao] = useState(null);
  const [sugestoesIA, setSugestoesIA] = useState({});

  // V21.1.2: NOVO TOGGLE
  const [modoManual, setModoManual] = useState(false);
  const debounceTimeoutRef = useRef(null);

  // V22.0: Recalcular fatores quando mudam campos-chave
  useEffect(() => {
    if (formData.eh_bitola) {
      recalcularFatoresConversao();
    }
  }, [formData.peso_teorico_kg_m, formData.comprimento_barra_padrao_m, formData.eh_bitola]);

  // V21.1.2: Calcular volume automaticamente
  useEffect(() => {
    if (formData.altura_cm > 0 && formData.largura_cm > 0 && formData.comprimento_cm > 0) {
      const volume_m3 = (formData.altura_cm * formData.largura_cm * formData.comprimento_cm) / 1000000;
      setFormData(prev => ({ ...prev, volume_m3 }));
    } else if (formData.volume_m3 !== 0) {
        setFormData(prev => ({ ...prev, volume_m3: 0 }));
    }
  }, [formData.altura_cm, formData.largura_cm, formData.comprimento_cm, formData.volume_m3]);

  // V22.1: Self-Healing automÃ¡tico (debounced)
  useEffect(() => {
    if (modoManual) {
      setIaSugestao(null);
      return;
    }
    if ((formData.descricao || '').length >= 5) {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = setTimeout(() => {
        analisarDescricaoIA(formData.descricao);
      }, 700);
    } else {
      setIaSugestao(null);
    }
    return () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    };
  }, [formData.descricao, modoManual]);

  // V22.0: MOTOR DE CONVERSÃƒO AUTOMÃTICA
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

  // IA de ClassificaÃ§Ã£o Mestra (V18.0 + V22.0 Melhorado)
  const analisarDescricaoIA = async (descricao) => {
    if (!descricao || descricao.length < 5) return;

    setProcessandoIA(true);

    try {
      const resultado = await base44.integrations.Core.InvokeLLM({
        prompt: `Analise esta descriÃ§Ã£o de produto: "${descricao}".

Se for uma bitola de aÃ§o (ex: "Barra 8mm 12m CA-50", "VergalhÃ£o 10mm"), retorne:
- eh_bitola: true
- peso_teorico_kg_m: peso teÃ³rico em kg/m (tabela oficial):
  * 6.3mm = 0.245 kg/m
  * 8mm = 0.395 kg/m
  * 10mm = 0.617 kg/m
  * 12.5mm = 0.963 kg/m
  * 16mm = 1.578 kg/m
  * 20mm = 2.466 kg/m
  * 25mm = 3.853 kg/m
  * 32mm = 6.313 kg/m
- bitola_diametro_mm: diÃ¢metro em mm
- tipo_aco: CA-25, CA-50 ou CA-60
- ncm: "7214.20.00" (vergalhÃµes)
- grupo_produto: "Bitola"
- comprimento_barra_m: 12 (padrÃ£o)
- unidade_principal: "KG"
- unidades_secundarias: ["PÃ‡", "KG", "MT"] (sempre essas 3 para bitolas)

Caso contrÃ¡rio, sugira:
- grupo_produto adequado
- ncm provÃ¡vel
- unidade_principal e unidades_secundarias apropriadas`,
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
            explicacao: { type: "string" }
          }
        }
      });

      setIaSugestao(resultado);
      toast.success('âœ¨ IA analisou o produto!');
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

    toast.success('âœ… SugestÃµes aplicadas!');
    setIaSugestao(null);
  };

  // Upload de Foto do Produto
  const handleUploadFoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingFoto(true);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, foto_produto_url: file_url });
      toast.success('âœ… Foto carregada!');
    } catch (error) {
      toast.error('Erro ao fazer upload');
    } finally {
      setUploadingFoto(false);
    }
  };

  // Toggle de unidades secundÃ¡rias
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

  // NOVO: Handler para busca automÃ¡tica de NCM
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

  // V21.6: NOVO - Enviar para ProduÃ§Ã£o
  const enviarParaProducao = () => {
    setFormData(prev => ({
      ...prev,
      tipo_item: 'MatÃ©ria-Prima ProduÃ§Ã£o',
      setor_atividade_id: 'setor-fabrica-001',
      setor_atividade_nome: 'FÃ¡brica'
    }));
    setModoManual(false);
    toast.success('ðŸ­ Produto movido para ProduÃ§Ã£o!', {
      description: 'Lembre-se de salvar as alteraÃ§Ãµes'
    });
  };

  const produtoSchema = z.object({
    descricao: z.string().min(3, 'DescriÃ§Ã£o Ã© obrigatÃ³ria'),
    unidades_secundarias: z.array(z.string()).min(1, 'Selecione pelo menos 1 unidade'),
    eh_bitola: z.boolean().optional().default(false),
    peso_teorico_kg_m: z.number().optional().transform(v => v ?? 0)
  }).refine((data) => !data.eh_bitola || (data.peso_teorico_kg_m || 0) > 0, {
    message: 'Bitolas precisam ter peso teÃ³rico preenchido'
  });

  const buildPayload = () => ({
    ...formData,
    descricao: sanitizeText(formData.descricao, 240),
    nome: sanitizeText(formData.descricao, 240),
    codigo: sanitizeCode(formData.codigo, 80),
    tipo_item: sanitizeText(formData.tipo_item, 80),
    grupo: sanitizeText(formData.grupo, 120),
    tipo_aco: sanitizeText(formData.tipo_aco, 40),
    unidade_principal: sanitizeText(formData.unidade_principal, 20),
    unidades_secundarias: sanitizeArray(formData.unidades_secundarias),
    fatores_conversao: {
      kg_por_peca: toNumber(formData.fatores_conversao?.kg_por_peca, 0),
      kg_por_metro: toNumber(formData.fatores_conversao?.kg_por_metro, 0),
      metros_por_peca: toNumber(formData.fatores_conversao?.metros_por_peca, 0),
      peca_por_ton: toNumber(formData.fatores_conversao?.peca_por_ton, 0),
      kg_por_ton: toNumber(formData.fatores_conversao?.kg_por_ton, 1000)
    },
    peso_teorico_kg_m: toNumber(formData.peso_teorico_kg_m, 0),
    bitola_diametro_mm: toNumber(formData.bitola_diametro_mm, 0),
    comprimento_barra_padrao_m: toNumber(formData.comprimento_barra_padrao_m, 12),
    custo_aquisicao: toNumber(formData.custo_aquisicao, 0),
    preco_venda: toNumber(formData.preco_venda, 0),
    estoque_minimo: toNumber(formData.estoque_minimo, 0),
    peso_liquido_kg: toNumber(formData.peso_liquido_kg, 0),
    peso_bruto_kg: toNumber(formData.peso_bruto_kg, 0),
    altura_cm: toNumber(formData.altura_cm, 0),
    largura_cm: toNumber(formData.largura_cm, 0),
    comprimento_cm: toNumber(formData.comprimento_cm, 0),
    volume_m3: toNumber(formData.volume_m3, 0),
    ncm: sanitizeCode(formData.ncm, 12),
    cest: sanitizeCode(formData.cest, 14),
    unidade_medida: sanitizeText(formData.unidade_medida, 20),
    foto_produto_url: sanitizeText(formData.foto_produto_url, 500),
    status: sanitizeText(formData.status || "Ativo", 40),
    group_id: groupId || formData.group_id,
    empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id
  });

  const handleSubmit = async (_, __) => {
    if (!podeSalvar) {
      toast.error(dadosIniciais?.id ? "Sem permissao para editar produtos." : "Sem permissao para criar produtos.");
      return;
    }
    if (!contextoValido) {
      toast.error("Selecione um grupo ou empresa antes de salvar o produto.");
      return;
    }

    const payload = buildPayload();
    if (!payload.descricao) {
      toast.error("Descricao do produto e obrigatoria.");
      return;
    }
    onSubmit(payload);
  };

  return (
    <FormWrapper schema={produtoSchema} defaultValues={formData} onSubmit={handleSubmit} externalData={formData} className="space-y-6 w-full h-full" data-permission="Cadastros.Produto.editar" data-sensitive>
      {/* V21.1.2: TOGGLE MODO MANUAL */}
      <Alert className="border-blue-300 bg-blue-50">
        <AlertDescription>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm text-blue-900">ðŸ¤– AssistÃªncia de IA</p>
              <p className="text-xs text-blue-700">A IA pode sugerir NCM, grupo, bitola e unidades automaticamente</p>
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-sm">Preencher manualmente (ignorar IA)</Label>
              <Switch
                checked={modoManual}
                onCheckedChange={setModoManual}
              />
            </div>
          </div>
        </AlertDescription>
      </Alert>

      {/* SEÃ‡ÃƒO 1: IdentificaÃ§Ã£o */}
      <Card className="border-purple-200 bg-purple-50">
        <CardContent className="p-4 space-y-4">
          <h3 className="font-bold flex items-center gap-2 text-purple-900">
            <Package className="w-5 h-5" />
            IdentificaÃ§Ã£o do Produto
          </h3>

          <div>
            <Label>DescriÃ§Ã£o do Produto *</Label>
            <div className="flex gap-2">
              <Input
                value={formData.descricao}
                onChange={(e) => setFormData(prev => ({...prev, descricao: e.target.value}))}
                placeholder="Ex: VergalhÃ£o 8mm 12m CA-50"
                className="flex-1"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => analisarDescricaoIA(formData.descricao)}
                disabled={processandoIA || modoManual}
              >
                {processandoIA ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-slate-500 mt-1">âœ¨ IA preenche automaticamente NCM, peso e unidades</p>
          </div>

          {iaSugestao && !modoManual && (
            <Alert className="border-purple-300 bg-purple-100">
              <AlertDescription>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold text-sm text-purple-900 mb-1">ðŸ¤– IA Classificou:</p>
                    <p className="text-xs text-purple-800">{iaSugestao.explicacao}</p>
                    <div className="text-xs text-purple-700 mt-2 space-y-1">
                      {iaSugestao.eh_bitola && <p>â€¢ <strong>Ã‰ bitola:</strong> Sim</p>}
                      {iaSugestao.peso_teorico_kg_m > 0 && <p>â€¢ <strong>Peso TeÃ³rico (kg/m):</strong> {iaSugestao.peso_teorico_kg_m}</p>}
                      {iaSugestao.bitola_diametro_mm > 0 && <p>â€¢ <strong>DiÃ¢metro (mm):</strong> {iaSugestao.bitola_diametro_mm}</p>}
                      {iaSugestao.tipo_aco && <p>â€¢ <strong>Tipo de AÃ§o:</strong> {iaSugestao.tipo_aco}</p>}
                      {iaSugestao.ncm && <p>â€¢ <strong>NCM:</strong> {iaSugestao.ncm}</p>}
                      {iaSugestao.grupo_produto && <p>â€¢ <strong>Grupo:</strong> {iaSugestao.grupo_produto}</p>}
                      {iaSugestao.unidade_principal && <p>â€¢ <strong>Unidade Principal:</strong> {iaSugestao.unidade_principal}</p>}
                      {iaSugestao.unidades_secundarias && iaSugestao.unidades_secundarias.length > 0 && (
                        <p>â€¢ <strong>Unidades Habilitadas:</strong> {iaSugestao.unidades_secundarias.join(', ')}</p>
                      )}
                    </div>
                  </div>
                  <Button size="sm" onClick={aplicarSugestaoIA} className="bg-purple-600">
                    Aplicar Tudo
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {modoManual && iaSugestao && (
            <Alert className="border-orange-200 bg-orange-50">
              <AlertDescription className="text-sm text-orange-900">
                â„¹ï¸ <strong>Modo Manual Ativo:</strong> IA encontrou sugestÃµes, mas nÃ£o as aplicarÃ¡ automaticamente.
                VocÃª pode revisar: {iaSugestao.explicacao}
              </AlertDescription>
            </Alert>
          )}

          {processandoIA && !modoManual && (formData.descricao || '').length >= 5 && !iaSugestao && (
            <Alert className="border-blue-200 bg-blue-50">
              <AlertDescription className="flex items-center text-sm text-blue-900">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                <span>Analisando descriÃ§Ã£o com IA...</span>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>CÃ³digo/SKU</Label>
              <Input
                value={formData.codigo}
                onChange={(e) => setFormData(prev => ({...prev, codigo: e.target.value}))}
                placeholder="SKU-001"
              />
            </div>

            <div>
              <Label>Tipo de Item</Label>
              <Select value={formData.tipo_item} onValueChange={(v) => {
                setFormData(prev => ({...prev, tipo_item: v}));
                if (v === 'MatÃ©ria-Prima ProduÃ§Ã£o') {
                  setModoManual(false);
                }
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Revenda">Revenda</SelectItem>
                  <SelectItem value="MatÃ©ria-Prima ProduÃ§Ã£o">MatÃ©ria-Prima ProduÃ§Ã£o</SelectItem>
                  <SelectItem value="Produto Acabado">Produto Acabado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* V21.6: NOVO BOTÃƒO - ENVIAR PARA PRODUÃ‡ÃƒO */}
          {formData.tipo_item !== 'MatÃ©ria-Prima ProduÃ§Ã£o' && (
            <Alert className="border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50">
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm text-orange-900 mb-1">ðŸ­ Usar este produto na ProduÃ§Ã£o?</p>
                    <p className="text-xs text-orange-700">
                      Converte para MatÃ©ria-Prima e habilita uso em Ordens de ProduÃ§Ã£o
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="bg-orange-600 text-white hover:bg-orange-700 border-orange-600"
                    onClick={enviarParaProducao}
                  >
                    <Factory className="w-4 h-4 mr-2" />
                    Enviar para ProduÃ§Ã£o
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {formData.tipo_item === 'MatÃ©ria-Prima ProduÃ§Ã£o' && (
            <Alert className="border-green-300 bg-green-50">
              <CheckCircle2 className="w-4 h-4 text-green-700" />
              <AlertDescription className="text-sm text-green-900">
                âœ… <strong>Produto configurado para ProduÃ§Ã£o</strong> - DisponÃ­vel em Ordens de ProduÃ§Ã£o e FÃ¡brica
              </AlertDescription>
            </Alert>
          )}

          {/* UPLOAD DE FOTO - V22.0 */}
          <div>
            <Label>Foto do Produto</Label>
            <div className="flex items-center gap-4">
              {formData.foto_produto_url && (
                <img src={formData.foto_produto_url} alt="Produto" className="w-20 h-20 object-cover rounded border" />
              )}
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUploadFoto}
                  className="hidden"
                  id="foto-upload"
                />
                <label htmlFor="foto-upload">
                  <Button type="button" variant="outline" size="sm" disabled={uploadingFoto} asChild>
                    <span>
                      {uploadingFoto ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                      {formData.foto_produto_url ? 'Alterar Foto' : 'Upload Foto'}
                    </span>
                  </Button>
                </label>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-1">ðŸ“¸ Usada em Pedidos, E-commerce e Portal</p>
          </div>
        </CardContent>
      </Card>

      {/* SEÃ‡ÃƒO 2: Ã‰ BITOLA? */}
      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border-2 border-dashed">
        <div>
          <Label className="text-base font-semibold">Ã‰ uma Bitola de AÃ§o?</Label>
          <p className="text-xs text-slate-500">Habilita campos especÃ­ficos e conversÃ£o PÃ‡ â†” KG â†” MT</p>
        </div>
        <Switch
          checked={formData.eh_bitola}
          onCheckedChange={(v) => {
            setFormData(prev => ({...prev, eh_bitola: v}));
            if (v) {
              setFormData(prev => ({
                ...prev,
                unidade_principal: 'KG',
                unidades_secundarias: ['PÃ‡', 'KG', 'MT'],
                tipo_item: 'MatÃ©ria-Prima ProduÃ§Ã£o'
              }));
            }
          }}
        />
      </div>

      {/* SEÃ‡ÃƒO 3: CAMPOS DE BITOLA */}
      {formData.eh_bitola && (
        <Card className="border-blue-300 bg-blue-50">
          <CardContent className="p-4 space-y-4">
            <h3 className="font-bold text-blue-900">ðŸ“ EspecificaÃ§Ãµes da Bitola</h3>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>DiÃ¢metro (mm) *</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.bitola_diametro_mm}
                  onChange={(e) => setFormData(prev => ({...prev, bitola_diametro_mm: parseFloat(e.target.value) || 0}))}
                  placeholder="8.0"
                />
              </div>

              <div>
                <Label>Peso TeÃ³rico (kg/m) *</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={formData.peso_teorico_kg_m}
                  onChange={(e) => setFormData(prev => ({...prev, peso_teorico_kg_m: parseFloat(e.target.value) || 0}))}
                  placeholder="0.395"
                />
                <p className="text-xs text-slate-500 mt-1">Tabela oficial ABNT</p>
              </div>

              <div>
                <Label>Tipo de AÃ§o</Label>
                <Select value={formData.tipo_aco} onValueChange={(v) => setFormData(prev => ({...prev, tipo_aco: v}))}>
                  <SelectTrigger>
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
                <Label>Comprimento PadrÃ£o da Barra (metros)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.comprimento_barra_padrao_m}
                  onChange={(e) => setFormData(prev => ({...prev, comprimento_barra_padrao_m: parseFloat(e.target.value) || 12}))}
                  placeholder="12"
                />
                <p className="text-xs text-slate-500 mt-1">ðŸ”§ Usado para calcular kg_por_peca automaticamente</p>
              </div>
            </div>

            {/* V22.0: PREVIEW DE CONVERSÃƒO */}
            {calculoConversao && (
              <Alert className="border-green-300 bg-green-50">
                <Calculator className="w-4 h-4 text-green-700" />
                <AlertDescription>
                  <p className="font-semibold text-sm text-green-900 mb-2">âœ… ConversÃµes Calculadas:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-green-800">
                    <p>â€¢ 1 PÃ‡ (barra) = <strong>{calculoConversao.kg_por_peca.toFixed(2)} KG</strong></p>
                    <p>â€¢ 1 MT = <strong>{calculoConversao.kg_por_metro.toFixed(3)} KG</strong></p>
                    <p>â€¢ 1 TON = <strong>{calculoConversao.peca_por_ton.toFixed(1)} PÃ‡</strong></p>
                    <p>â€¢ 1 PÃ‡ = <strong>{calculoConversao.metros_por_peca} MT</strong></p>
                  </div>
                  <p className="text-xs text-green-700 mt-2">
                    ðŸ’¡ Essas conversÃµes serÃ£o usadas em Vendas, Compras e Estoque automaticamente
                  </p>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* SEÃ‡ÃƒO 4: UNIDADES - V22.0 CRÃTICO */}
      <Card className="border-indigo-300 bg-indigo-50">
        <CardContent className="p-4 space-y-4">
          <h3 className="font-bold text-indigo-900 flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            V22.0: Unidades e ConversÃµes
          </h3>

          <Alert className="border-indigo-400 bg-indigo-100">
            <AlertDescription className="text-sm text-indigo-900">
              ðŸŽ¯ <strong>REGRA MESTRE:</strong> As unidades selecionadas aqui estarÃ£o disponÃ­veis em Vendas, Compras e MovimentaÃ§Ãµes
            </AlertDescription>
          </Alert>

          <div>
            <Label>Unidade Principal (RelatÃ³rios e Dashboard)</Label>
            <Select value={formData.unidade_principal} onValueChange={(v) => setFormData(prev => ({...prev, unidade_principal: v}))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UN">Unidade (UN)</SelectItem>
                <SelectItem value="PÃ‡">PeÃ§a (PÃ‡)</SelectItem>
                <SelectItem value="KG">Quilograma (KG)</SelectItem>
                <SelectItem value="MT">Metro (MT)</SelectItem>
                <SelectItem value="TON">Tonelada (TON)</SelectItem>
                <SelectItem value="CX">Caixa (CX)</SelectItem>
                <SelectItem value="LT">Litro (LT)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Unidades Habilitadas (Multi-Select) *</Label>
            <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-white">
              {['UN', 'PÃ‡', 'KG', 'MT', 'TON', 'CX', 'BARRA'].map(unidade => (
                <Badge
                  key={unidade}
                  className={`cursor-pointer transition-all ${
                    (formData.unidades_secundarias || []).includes(unidade)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                  onClick={() => toggleUnidadeSecundaria(unidade)}
                >
                  {(formData.unidades_secundarias || []).includes(unidade) && <CheckCircle2 className="w-3 h-3 mr-1" />}
                  {unidade}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              âœ… Selecionadas: {(formData.unidades_secundarias || []).join(', ')}
            </p>
          </div>

          {/* V22.0: VisualizaÃ§Ã£o de Como SerÃ¡ Usado */}
          {formData.unidades_secundarias && formData.unidades_secundarias.length > 0 && (
            <Alert className="border-blue-200 bg-blue-50">
              <AlertDescription className="text-sm text-blue-900">
                <p className="font-semibold mb-2">ðŸ“¦ Como serÃ¡ usado nos mÃ³dulos:</p>
                <div className="space-y-1 text-xs">
                  <p>â€¢ <strong>Vendas:</strong> Dropdown terÃ¡ opÃ§Ãµes: {formData.unidades_secundarias.join(', ')}</p>
                  <p>â€¢ <strong>Compras:</strong> Dropdown terÃ¡ opÃ§Ãµes: {formData.unidades_secundarias.join(', ')}</p>
                  <p>â€¢ <strong>Estoque:</strong> Saldo sempre em KG (conversÃ£o automÃ¡tica)</p>
                  <p>â€¢ <strong>NF-e:</strong> Unidade do pedido + equivalente KG</p>
                  {formData.tipo_item === 'MatÃ©ria-Prima ProduÃ§Ã£o' && (
                    <p className="text-orange-700 font-semibold">â€¢ <strong>ProduÃ§Ã£o:</strong> âœ… DisponÃ­vel em OPs</p>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* SEÃ‡ÃƒO 5: PrecificaÃ§Ã£o */}
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-4 space-y-4">
          <h3 className="font-bold text-green-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            ðŸ’° PrecificaÃ§Ã£o
          </h3>

          <div className="grid grid-cols-3 gap-4">
            <ProtectedField module="Estoque" submodule="Produto" tab="Precificacao" field="custo_aquisicao" action="visualizar" asText>
              <div>
                <Label>Custo AquisiÃ§Ã£o</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.custo_aquisicao}
                  onChange={(e) => setFormData(prev => ({...prev, custo_aquisicao: parseFloat(e.target.value) || 0}))}
                  placeholder="0.00"
                />
              </div>
            </ProtectedField>

            <div>
              <Label>PreÃ§o Venda</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.preco_venda}
                onChange={(e) => setFormData(prev => ({...prev, preco_venda: parseFloat(e.target.value) || 0}))}
                placeholder="0.00"
              />
            </div>

            <ProtectedField module="Estoque" submodule="Produto" tab="Precificacao" field="margem_percentual" action="visualizar" asText>
              <div>
                <Label>Margem (%)</Label>
                <Input
                  type="number"
                  value={formData.custo_aquisicao > 0 ? (((formData.preco_venda - formData.custo_aquisicao) / formData.custo_aquisicao) * 100).toFixed(2) : 0}
                  disabled
                  className="bg-slate-100"
                />
              </div>
            </ProtectedField>
          </div>
        </CardContent>
      </Card>

      {/* V21.1.2: NOVA SEÃ‡ÃƒO - PESO E DIMENSÃ•ES (FRETE/E-COMMERCE) */}
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="p-4 space-y-4">
          <h3 className="font-bold text-orange-900 flex items-center gap-2">
            <Package className="w-5 h-5" />
            Peso e DimensÃµes (LogÃ­stica & E-commerce)
          </h3>

          <Alert className="border-orange-300 bg-orange-100">
            <AlertDescription className="text-xs text-orange-900">
              ðŸ“¦ <strong>Usado em:</strong> CÃ¡lculo de frete, cubagem de caminhÃ£o, catÃ¡logo de marketplace (ML, Shopee), Portal do Cliente
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Peso LÃ­quido (kg)</Label>
              <Input
                type="number"
                step="0.001"
                value={formData.peso_liquido_kg}
                onChange={(e) => setFormData(prev => ({...prev, peso_liquido_kg: parseFloat(e.target.value) || 0}))}
                placeholder="0.000"
              />
              <p className="text-xs text-slate-500 mt-1">Peso do produto sem embalagem</p>
            </div>

            <div>
              <Label>Peso Bruto (kg)</Label>
              <Input
                type="number"
                step="0.001"
                value={formData.peso_bruto_kg}
                onChange={(e) => setFormData(prev => ({...prev, peso_bruto_kg: parseFloat(e.target.value) || 0}))}
                placeholder="0.000"
              />
              <p className="text-xs text-slate-500 mt-1">Peso com embalagem</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div>
              <Label>Altura (cm)</Label>
              <Input
                type="number"
                step="0.1"
                value={formData.altura_cm}
                onChange={(e) => setFormData(prev => ({...prev, altura_cm: parseFloat(e.target.value) || 0}))}
                placeholder="0.0"
              />
            </div>

            <div>
              <Label>Largura (cm)</Label>
              <Input
                type="number"
                step="0.1"
                value={formData.largura_cm}
                onChange={(e) => setFormData(prev => ({...prev, largura_cm: parseFloat(e.target.value) || 0}))}
                placeholder="0.0"
              />
            </div>

            <div>
              <Label>Comprimento (cm)</Label>
              <Input
                type="number"
                step="0.1"
                value={formData.comprimento_cm}
                onChange={(e) => setFormData(prev => ({...prev, comprimento_cm: parseFloat(e.target.value) || 0}))}
                placeholder="0.0"
              />
            </div>

            <div>
              <Label>Volume (mÂ³)</Label>
              <Input
                type="number"
                value={formData.volume_m3?.toFixed(6) || 0}
                disabled
                className="bg-slate-100"
              />
              <p className="text-xs text-slate-500 mt-1">Calculado automaticamente</p>
            </div>
          </div>

          {formData.volume_m3 > 0 && (
            <Alert className="border-green-300 bg-green-50">
              <AlertDescription className="text-xs text-green-900">
                âœ… <strong>Cubagem:</strong> {formData.volume_m3.toFixed(6)} mÂ³ por unidade
                {formData.peso_bruto_kg > 0 && ` â€¢ Peso taxado: ${Math.max(formData.peso_bruto_kg, formData.volume_m3 * 300).toFixed(2)} kg`}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* SEÃ‡ÃƒO: FISCAL */}
      <Card>
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-600" />
            ConfiguraÃ§Ã£o Fiscal
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4 items-end">
            <div>
              <Label htmlFor="ncm">NCM (CÃ³digo Fiscal)</Label>
              <Input
                id="ncm"
                value={formData.ncm || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, ncm: e.target.value }))}
                placeholder="00000000"
                maxLength={8}
              />
              {sugestoesIA.ncm_info && (
                <p className="text-xs text-blue-600 mt-1">
                  â„¹ï¸ {sugestoesIA.ncm_info}
                </p>
              )}
            </div>

            <div>
              <BotaoBuscaAutomatica
                tipo="ncm"
                valor={formData.ncm}
                onDadosEncontrados={handleDadosNCM}
                disabled={!formData.ncm || formData.ncm.length !== 8}
              >
                Buscar NCM
              </BotaoBuscaAutomatica>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cest">CEST</Label>
              <Input
                id="cest"
                value={formData.cest || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, cest: e.target.value }))}
                placeholder="00.000.00"
                maxLength={10}
              />
            </div>
            <div>
              <Label htmlFor="unidade_medida">Unidade de Medida Fiscal</Label>
              <Input
                id="unidade_medida"
                value={formData.unidade_medida || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, unidade_medida: e.target.value }))}
                placeholder="UN, KG, M"
              />
            </div>
          </div>

          <div>
            <Label>Status do Produto</Label>
            <Select value={formData.status} onValueChange={(v) => setFormData(prev => ({...prev, status: v}))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Ativo">Ativo</SelectItem>
                <SelectItem value="Inativo">Inativo</SelectItem>
                <SelectItem value="Descontinuado">Descontinuado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* SUBMIT */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="submit" disabled={isSubmitting || !podeSalvar || !contextoValido} className="bg-purple-600 hover:bg-purple-700" data-permission="Cadastros.Produto.salvar" data-action="salvar-produto" data-sensitive>
          {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {dadosIniciais ? 'Atualizar Produto' : 'Criar Produto'}
        </Button>
      </div>

      {/* V22.0: RESUMO FINAL */}
      {formData.eh_bitola && calculoConversao && (
        <Alert className="border-purple-300 bg-purple-100">
          <AlertDescription>
            <p className="font-semibold text-sm text-purple-900 mb-2">ðŸŽ¯ Resumo da ConfiguraÃ§Ã£o:</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-purple-800">
              <p>âœ… Produto: <strong>{formData.descricao || 'NÃ£o informado'}</strong></p>
              <p>âœ… Unidade Principal: <strong>{formData.unidade_principal}</strong></p>
              <p>âœ… Venda/Compra em: <strong>{(formData.unidades_secundarias || []).join(', ')}</strong></p>
              <p>âœ… Estoque sempre em: <strong>KG</strong></p>
              <p>âœ… 1 PeÃ§a = <strong>{calculoConversao.kg_por_peca.toFixed(2)} KG</strong></p>
              <p>âœ… 1 Metro = <strong>{calculoConversao.kg_por_metro.toFixed(3)} KG</strong></p>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </FormWrapper>
  );
}
