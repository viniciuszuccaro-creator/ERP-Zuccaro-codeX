import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Globe, Sparkles, Image, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

/**
 * V21.1.2-R2 - Aba de Integrações E-Commerce
 * ✅ Habilitar produto para site/marketplace
 * ✅ Descrição SEO automática via IA
 * ✅ Geração de imagem 3D via IA
 * ✅ Controle de estoque online
 */
export default function AbaEcommerceProduto({ formData, setFormData }) {
  const [gerandoDescricaoSEO, setGerandoDescricaoSEO] = useState(false);
  const [gerandoImagem, setGerandoImagem] = useState(false);

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

  return (
    <div className="space-y-6">
      <Alert className="border-blue-300 bg-blue-50">
        <Globe className="w-5 h-5 text-blue-600" />
        <AlertDescription className="text-sm text-blue-900">
          <p className="font-semibold mb-2">🌐 Canais de Venda Online</p>
          <p>Configure se este produto será vendido no site, marketplace (ML, Shopee) ou ambos.</p>
        </AlertDescription>
      </Alert>

      {/* Habilitação de Canais */}
      <Card className="border-purple-200 bg-purple-50">
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
                onCheckedChange={(v) => setFormData(prev => ({
                  ...prev,
                  exibir_no_site: v,
                  exibir_site: v,
                }))}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-white rounded-lg border">
              <div>
                <Label className="text-base font-semibold">Sincronizar com Marketplace</Label>
                <p className="text-xs text-slate-500">Mercado Livre, Shopee, etc.</p>
              </div>
              <Switch
                checked={formData.exibir_no_marketplace || false}
                onCheckedChange={(v) => setFormData(prev => ({
                  ...prev,
                  exibir_no_marketplace: v,
                  exibir_marketplace: v,
                }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Descrição SEO */}
      {(formData.exibir_no_site || formData.exibir_no_marketplace) && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-green-900">📝 Descrição SEO</h3>
              <Button
                type="button"
                size="sm"
                onClick={gerarDescricaoSEO}
                disabled={gerandoDescricaoSEO}
                className="bg-green-600 hover:bg-green-700"
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
              placeholder="Descrição detalhada para SEO (150-250 palavras)..."
              className="min-h-[150px]"
            />

            <p className="text-xs text-slate-500">
              💡 Descrição otimizada para Google e marketplaces
            </p>
          </CardContent>
        </Card>
      )}

      {/* Geração de Imagem IA */}
      {(formData.exibir_no_site || formData.exibir_no_marketplace) && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-orange-900">🎨 Imagem do Produto</h3>
              <Button
                type="button"
                size="sm"
                onClick={gerarImagemIA}
                disabled={gerandoImagem}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {gerandoImagem ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Image className="w-4 h-4 mr-2" />
                )}
                Gerar Imagem IA
              </Button>
            </div>

            {formData.foto_produto_url && (
              <div className="flex justify-center">
                <img 
                  src={formData.foto_produto_url} 
                  alt="Preview" 
                  className="max-w-xs rounded-lg border-2 shadow-lg"
                />
              </div>
            )}

            <p className="text-xs text-slate-500">
              🤖 A IA gera imagens profissionais automaticamente
            </p>
          </CardContent>
        </Card>
      )}

      {/* Controle de Estoque Online */}
      {(formData.exibir_no_site || formData.exibir_no_marketplace) && (
        <Card className="border-indigo-200 bg-indigo-50">
          <CardContent className="p-6 space-y-4">
            <h3 className="font-bold text-indigo-900">📊 Controle de Estoque Online</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Estoque Mínimo Online</Label>
                <Input
                  type="number"
                  value={formData.estoque_minimo_online || 0}
                  onChange={(e) => setFormData(prev => ({
                    ...prev, 
                    estoque_minimo_online: parseFloat(e.target.value) || 0
                  }))}
                  placeholder="0"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Abaixo disso, produto some do site
                </p>
              </div>

              <div>
                <Label>Estoque Máximo Online</Label>
                <Input
                  type="number"
                  value={formData.estoque_maximo_online || 0}
                  onChange={(e) => setFormData(prev => ({
                    ...prev, 
                    estoque_maximo_online: parseFloat(e.target.value) || 0
                  }))}
                  placeholder="0"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Limite de exibição no site
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* URL Amigável */}
      {formData.exibir_no_site && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div>
              <Label>URL Amigável (Slug)</Label>
              <Input
                value={formData.slug_site || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev, 
                  slug_site: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')
                }))}
                placeholder="vergalhao-8mm-ca50"
              />
              <p className="text-xs text-slate-500 mt-1">
                📍 URL final: seusite.com/produtos/{formData.slug_site || 'produto'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}