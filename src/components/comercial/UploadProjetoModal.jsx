import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Sparkles, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { assertTechnicalUploadAllowed, assertTechnicalAiProcessingAllowed, TECHNICAL_UPLOAD_ACCEPT } from '@/lib/technicalUploadPolicy';

export default function UploadProjetoModal({ isOpen, onClose, onPecasExtraidas }) {
  const [arquivo, setArquivo] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [resultado, setResultado] = useState(null);
  const { toast } = useToast();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validar tipo de arquivo
      const tiposPermitidos = ['application/pdf', 'image/jpeg', 'image/png', 'application/dwg'];
      const extensoesPermitidas = ['.pdf', '.jpg', '.jpeg', '.png', '.dwg'];
      
      const extensao = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
      
      if (!extensoesPermitidas.includes(extensao)) {
        toast({
          title: "❌ Arquivo não suportado",
          description: "Use arquivos PDF, JPG, PNG ou DWG",
          variant: "destructive"
        });
        return;
      }
      
      setArquivo(file);
      setResultado(null);
    }
  };

  const processarComIA = async () => {
    if (!arquivo) {
      toast({
        title: "❌ Nenhum arquivo selecionado",
        description: "Selecione um arquivo de projeto primeiro",
        variant: "destructive"
      });
      return;
    }

    try {
      await assertTechnicalUploadAllowed(arquivo);
      assertTechnicalAiProcessingAllowed();
      setProcessando(true);
      setProgresso(10);

      // 1. Fazer upload do arquivo
      toast({
        title: "📤 Enviando arquivo...",
        description: "Fazendo upload do projeto",
      });

      const formData = new FormData();
      formData.append('file', arquivo);

      setProgresso(30);

      const uploadResponse = await base44.integrations.Core.UploadFile({ file: arquivo });
      const fileUrl = uploadResponse.file_url;

      setProgresso(50);

      // 2. Processar com IA
      toast({
        title: "🤖 Processando com IA...",
        description: "Analisando o projeto e extraindo informações",
      });

      const jsonSchema = {
        type: "object",
        properties: {
          pecas: {
            type: "array",
            items: {
              type: "object",
              properties: {
                identificador: { type: "string", description: "ID único da peça (P1, P2, C1, V1, etc)" },
                tipo_peca: { 
                  type: "string", 
                  enum: ["Coluna", "Viga", "Bloco", "Sapata", "Laje", "Estaca"],
                  description: "Tipo de elemento estrutural" 
                },
                quantidade: { type: "number", description: "Quantidade de peças iguais" },
                comprimento: { type: "number", description: "Comprimento em centímetros" },
                largura: { type: "number", description: "Largura em centímetros" },
                altura: { type: "number", description: "Altura em centímetros" },
                ferro_principal_bitola: { 
                  type: "string",
                  description: "Bitola do ferro principal (ex: 12.5mm, 16.0mm)"
                },
                ferro_principal_quantidade: { 
                  type: "number",
                  description: "Quantidade de barras de ferro principal"
                },
                estribo_bitola: {
                  type: "string",
                  description: "Bitola do estribo (ex: 6.3mm)"
                },
                estribo_distancia: {
                  type: "number",
                  description: "Distância entre estribos em cm"
                },
                observacoes: { type: "string", description: "Observações técnicas da peça" }
              },
              required: ["identificador", "tipo_peca", "quantidade"]
            }
          },
          resumo_projeto: {
            type: "object",
            properties: {
              nome_projeto: { type: "string" },
              total_pecas: { type: "number" },
              tipos_encontrados: { type: "array", items: { type: "string" } },
              observacoes_gerais: { type: "string" }
            }
          }
        }
      };

      setProgresso(70);

      const iaResponse = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um especialista em engenharia civil e análise de projetos estruturais.

Analise o projeto anexado e extraia TODAS as informações de peças estruturais (colunas, vigas, blocos, sapatas, lajes, estacas).

Para cada peça, identifique:
- ID único (P1, P2, C1, V1, etc) conforme nomenclatura do projeto
- Tipo de peça (Coluna, Viga, Bloco, etc)
- Quantidade de peças iguais
- Dimensões: comprimento, largura, altura (em cm)
- Armadura: bitola e quantidade de ferro principal
- Estribos: bitola e espaçamento (distância entre eles em cm)
- Observações técnicas relevantes

IMPORTANTE:
- Se não conseguir identificar alguma dimensão específica, use 0
- Se houver peças repetidas, agrupe pela quantidade
- Mantenha os IDs originais do projeto quando possível
- Para estribos, use bitolas comuns: 4.2mm, 5.0mm, 6.3mm
- Para ferro principal, use: 8.0mm, 10.0mm, 12.5mm, 16.0mm, 20.0mm, 25.0mm

Retorne um JSON estruturado com todas as peças encontradas e um resumo do projeto.`,
        file_urls: [fileUrl],
        response_json_schema: jsonSchema
      });

      setProgresso(90);

      if (!iaResponse?.pecas || iaResponse.pecas.length === 0) {
        throw new Error("Nenhuma peça foi identificada no projeto");
      }

      setResultado(iaResponse);
      setProgresso(100);

      toast({
        title: "✅ Análise Concluída!",
        description: `${iaResponse.pecas.length} peças identificadas no projeto`,
      });

    } catch (error) {
      console.error("Erro ao processar com IA:", error);
      toast({
        title: "❌ Erro no Processamento",
        description: error.message || "Não foi possível processar o projeto",
        variant: "destructive"
      });
      setResultado(null);
    } finally {
      setProcessando(false);
    }
  };

  const confirmarPecas = () => {
    if (resultado?.pecas) {
      onPecasExtraidas(resultado.pecas, resultado.resumo_projeto);
      onClose();
      
      toast({
        title: "✅ Peças Importadas!",
        description: `${resultado.pecas.length} peças adicionadas ao orçamento`,
      });
    }
  };

  const resetar = () => {
    setArquivo(null);
    setResultado(null);
    setProgresso(0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            Upload de Projeto com IA
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Upload do Arquivo */}
          {!resultado && (
            <Card className="border-2 border-dashed border-blue-300 bg-blue-50">
              <CardContent className="p-6">
                <div className="text-center">
                  <Upload className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                  <h3 className="font-semibold mb-2">Selecione o arquivo do projeto</h3>
                  <p className="text-sm text-slate-600 mb-4">
                    Formatos aceitos: PDF, JPG, PNG, DWG
                  </p>
                  
                  <Label htmlFor="file-upload" className="cursor-pointer">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                      <FileText className="w-4 h-4" />
                      {arquivo ? 'Trocar Arquivo' : 'Escolher Arquivo'}
                    </div>
                    <input
                      id="file-upload"
                      type="file"
                  accept={TECHNICAL_UPLOAD_ACCEPT}
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </Label>

                  {arquivo && (
                    <div className="mt-4">
                      <Badge className="bg-green-600 text-white">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        {arquivo.name}
                      </Badge>
                      <p className="text-xs text-slate-500 mt-1">
                        {(arquivo.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Progresso */}
          {processando && (
            <Card className="bg-purple-50 border-purple-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
                  <div className="flex-1">
                    <p className="font-semibold text-purple-900 mb-1">
                      Processando projeto com IA...
                    </p>
                    <div className="w-full bg-purple-200 rounded-full h-2">
                      <div 
                        className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progresso}%` }}
                      />
                    </div>
                    <p className="text-xs text-purple-700 mt-1">{progresso}% concluído</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Resultado da Análise */}
          {resultado && (
            <>
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-green-900 mb-2">
                        Análise Concluída com Sucesso!
                      </h4>
                      {resultado.resumo_projeto && (
                        <div className="text-sm text-green-800 space-y-1">
                          <p><strong>Projeto:</strong> {resultado.resumo_projeto.nome_projeto || 'Sem nome'}</p>
                          <p><strong>Total de peças:</strong> {resultado.resumo_projeto.total_pecas}</p>
                          {resultado.resumo_projeto.tipos_encontrados && (
                            <p><strong>Tipos:</strong> {resultado.resumo_projeto.tipos_encontrados.join(', ')}</p>
                          )}
                          {resultado.resumo_projeto.observacoes_gerais && (
                            <p className="mt-2">{resultado.resumo_projeto.observacoes_gerais}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Listagem de Peças Encontradas */}
              <Card>
                <CardContent className="p-4">
                  <h4 className="font-semibold mb-3">
                    Peças Identificadas ({resultado.pecas.length})
                  </h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {resultado.pecas.map((peca, index) => (
                      <Card key={index} className="bg-slate-50">
                        <CardContent className="p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className="bg-amber-600">{peca.identificador}</Badge>
                                <span className="font-semibold">{peca.tipo_peca}</span>
                                {peca.quantidade > 1 && (
                                  <Badge variant="outline">{peca.quantidade}x</Badge>
                                )}
                              </div>
                              <div className="text-xs text-slate-600 space-y-0.5">
                                {peca.comprimento > 0 && (
                                  <p>Comprimento: {peca.comprimento} cm</p>
                                )}
                                {peca.largura > 0 && (
                                  <p>Largura: {peca.largura} cm</p>
                                )}
                                {peca.altura > 0 && (
                                  <p>Altura: {peca.altura} cm</p>
                                )}
                                {peca.ferro_principal_bitola && (
                                  <p>Ferro: {peca.ferro_principal_quantidade}Ø{peca.ferro_principal_bitola}</p>
                                )}
                                {peca.estribo_bitola && peca.estribo_distancia && (
                                  <p>Estribo: Ø{peca.estribo_bitola} c/{peca.estribo_distancia}cm</p>
                                )}
                                {peca.observacoes && (
                                  <p className="italic text-slate-500">{peca.observacoes}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Alerta de Conferência */}
              <Card className="bg-amber-50 border-amber-200">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800">
                      <p className="font-semibold mb-1">⚠️ Atenção - Conferência Necessária</p>
                      <p>
                        A IA identificou as peças automaticamente, mas é importante que você <strong>revise e confirme</strong> as informações antes de prosseguir. 
                        Após importar, você poderá ajustar qualquer dado diretamente no formulário.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Como Funciona */}
          {!resultado && !processando && (
            <Card>
              <CardContent className="p-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  Como funciona a análise com IA
                </h4>
                <ol className="text-sm text-slate-700 space-y-2 list-decimal list-inside">
                  <li>Selecione o arquivo do projeto (PDF, imagem ou DWG)</li>
                  <li>A IA analisa o documento e identifica as peças estruturais</li>
                  <li>Para cada peça, extrai: ID, tipo, dimensões, armaduras</li>
                  <li>Você revisa e confirma as informações extraídas</li>
                  <li>As peças são importadas automaticamente para o orçamento</li>
                </ol>
                <p className="text-xs text-slate-500 mt-3">
                  💡 Dica: Quanto melhor a qualidade do arquivo, mais precisa será a extração.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Botões de Ação */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          {resultado ? (
            <>
              <Button type="button" variant="outline" onClick={resetar}>
                Analisar Outro Projeto
              </Button>
              <Button 
                type="button" 
                onClick={confirmarPecas}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Confirmar e Importar Peças
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button 
                type="button" 
                onClick={processarComIA}
                disabled={!arquivo || processando}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {processando ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Processar com IA
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
