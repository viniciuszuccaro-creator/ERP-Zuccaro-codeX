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

/**
 * V21.1.2-R2 - CADASTRO COMPLETO DE PRODUTOS
 * âœ… Abas organizadas (Dados Gerais, ConversÃµes, E-Commerce, HistÃ³rico)
 * âœ… ImportaÃ§Ã£o NF-e e Lote integradas
 * âœ… MantÃ©m 100% do formulÃ¡rio original
 * âœ… Adiciona funcionalidades avanÃ§adas
 */
export default function ProdutoFormCompleto({ produto, item, data, initialData, defaultValues, onSubmit, isSubmitting, onProdutosCriados }) {
  const dadosIniciais = item || data || initialData || defaultValues || produto;
  const [abaAtiva, setAbaAtiva] = useState('dados-gerais');
  const [modoImportacao, setModoImportacao] = useState(null); // 'nfe' | 'lote' | null

  const handleSubmit = (formData) => {
    if (onSubmit) onSubmit(formData);
  };

  const handleProdutosCriadosImportacao = (produtos) => {
    toast.success(`âœ… ${produtos.length} produto(s) importado(s)!`);
    if (onProdutosCriados) {
      onProdutosCriados(produtos);
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
              <HistoricoProduto produtoId={produto.id} produto={dadosIniciais} />
            </Suspense>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
