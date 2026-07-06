import React, { useState, Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Package, Calculator, Globe, TrendingUp
} from "lucide-react";
import ProdutoFormHeader from "./produto/ProdutoFormHeader";
import ProtectedSection from "@/components/security/ProtectedSection"; // mantido para futuras proteÃ§Ãµes de abas

import ProdutoForm from "./ProdutoForm";
const AbaConversoesProduto = React.lazy(() => import("./AbaConversoesProduto"));
const AbaEcommerceProduto = React.lazy(() => import("./AbaEcommerceProduto"));
const HistoricoProduto = React.lazy(() => import("./HistoricoProduto"));
const ImportacaoProdutoNFe = React.lazy(() => import("./ImportacaoProdutoNFe"));
const ImportacaoProdutoLote = React.lazy(() => import("./ImportacaoProdutoLote"));
import { toast } from "sonner";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

const sanitizeText = (value, max = 500) => String(value ?? "").replace(/[<>]/g, "").slice(0, max).trim();
const sanitizeCode = (value, max = 80) => String(value ?? "").replace(/[^0-9A-Za-z_.\-/\s]/g, "").slice(0, max).trim();
const toNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const sanitizeArray = (values, max = 20) => Array.isArray(values) ? values.map((value) => sanitizeText(value, 40)).filter(Boolean).slice(0, max) : [];

/**
 * V21.1.2-R2 - CADASTRO COMPLETO DE PRODUTOS
 * âœ… Abas organizadas (Dados Gerais, ConversÃµes, E-Commerce, HistÃ³rico)
 * âœ… ImportaÃ§Ã£o NF-e e Lote integradas
 * âœ… MantÃ©m 100% do formulÃ¡rio original
 * âœ… Adiciona funcionalidades avanÃ§adas
 */
export default function ProdutoFormCompleto({ produto, item, data, initialData, defaultValues, onSubmit, isSubmitting, onProdutosCriados }) {
  const dadosIniciais = item || data || initialData || defaultValues || produto;
  const { canCreate, canEdit } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const [abaAtiva, setAbaAtiva] = useState('dados-gerais');
  const [modoImportacao, setModoImportacao] = useState(null); // 'nfe' | 'lote' | null
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const podeCriar = canCreate("Cadastros", "Produto") || canCreate("Estoque", "Produto") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "Produto") || canEdit("Estoque", "Produto") || canEdit("Cadastros", null);
  const podeSalvar = dadosIniciais?.id ? podeEditar : podeCriar;

  const buildPayload = (formData = {}) => ({
    ...formData,
    descricao: sanitizeText(formData.descricao || formData.nome, 240),
    nome: sanitizeText(formData.nome || formData.descricao, 240),
    codigo: sanitizeCode(formData.codigo, 80),
    tipo_item: sanitizeText(formData.tipo_item, 80),
    grupo: sanitizeText(formData.grupo, 120),
    tipo_aco: sanitizeText(formData.tipo_aco, 40),
    unidade_principal: sanitizeText(formData.unidade_principal, 20),
    unidades_secundarias: sanitizeArray(formData.unidades_secundarias),
    fatores_conversao: {
      ...(formData.fatores_conversao || {}),
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
    empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id || dadosIniciais?.empresa_id
  });

  const handleSubmit = (formData) => {
    if (!contextoValido) {
      toast.error("Selecione um grupo ou empresa antes de salvar o produto.");
      return;
    }
    if (!podeSalvar) {
      toast.error(dadosIniciais?.id ? "Sem permissao para editar produtos." : "Sem permissao para criar produtos.");
      return;
    }

    const payload = buildPayload(formData);
    if (!payload.descricao) {
      toast.error("Descricao do produto e obrigatoria.");
      return;
    }
    if (onSubmit) onSubmit(payload);
  };

  const handleProdutosCriadosImportacao = (produtos) => {
    if (!contextoValido) {
      toast.error("Selecione um grupo ou empresa antes de importar produtos.");
      return;
    }
    if (!podeCriar) {
      toast.error("Sem permissao para criar produtos por importacao.");
      return;
    }

    const produtosSanitizados = Array.isArray(produtos) ? produtos.map(buildPayload) : [];
    toast.success(`âœ… ${produtosSanitizados.length} produto(s) importado(s)!`);
    if (onProdutosCriados) {
      onProdutosCriados(produtosSanitizados);
    }
    setModoImportacao(null);
  };

  if (modoImportacao === 'nfe') {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">Importar Produtos via NF-e</h2>
          <Button variant="outline" onClick={() => setModoImportacao(null)}>
            Voltar ao Cadastro
          </Button>
        </div>
        <Suspense fallback={<div className="h-24 rounded-md bg-slate-100 animate-pulse" />}>
          <ImportacaoProdutoNFe onProdutosCriados={handleProdutosCriadosImportacao} />
        </Suspense>
      </div>
    );
  }

  if (modoImportacao === 'lote') {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">ImportaÃ§Ã£o em Lote</h2>
          <Button variant="outline" onClick={() => setModoImportacao(null)}>
            Voltar ao Cadastro
          </Button>
        </div>
        <Suspense fallback={<div className="h-24 rounded-md bg-slate-100 animate-pulse" />}>
          <ImportacaoProdutoLote onProdutosCriados={handleProdutosCriadosImportacao} />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full h-full overflow-auto">
      {/* Header com BotÃµes de ImportaÃ§Ã£o */}
      <ProdutoFormHeader
        produto={dadosIniciais}
        onImportarNFe={() => setModoImportacao('nfe')}
        onImportarLote={() => setModoImportacao('lote')}
        disabledImportacoes={!contextoValido || !podeCriar}
      />

      {/* Abas do FormulÃ¡rio */}
      <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="w-full h-full">
        <TabsList className="grid grid-cols-4 w-full bg-slate-100">
          <TabsTrigger value="dados-gerais" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Dados Gerais
          </TabsTrigger>
          <TabsTrigger value="conversoes" className="flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            ConversÃµes
          </TabsTrigger>
          <TabsTrigger value="ecommerce" className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            E-Commerce
          </TabsTrigger>
          {dadosIniciais && (
            <TabsTrigger value="historico" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              HistÃ³rico
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="dados-gerais">
          <ProdutoForm
            produto={dadosIniciais}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
          />
        </TabsContent>

        <TabsContent value="conversoes">
          <Card>
            <div className="p-6">
              <Suspense fallback={<div className="h-24 rounded-md bg-slate-100 animate-pulse" />}>
                <AbaConversoesProduto
                  formData={dadosIniciais || {}}
                  setFormData={() => {}}
                />
              </Suspense>
            </div>
          </Card>
        </TabsContent>


        <TabsContent value="ecommerce">
          <Card>
            <div className="p-6">
              <Suspense fallback={<div className="h-24 rounded-md bg-slate-100 animate-pulse" />}>
                <AbaEcommerceProduto
                  formData={dadosIniciais || {}}
                  setFormData={() => {}}
                />
              </Suspense>
            </div>
          </Card>
        </TabsContent>

        {dadosIniciais && (
          <TabsContent value="historico">
            <Suspense fallback={<div className="h-24 rounded-md bg-slate-100 animate-pulse" />}>
              <HistoricoProduto produtoId={dadosIniciais.id} produto={dadosIniciais} />
            </Suspense>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
