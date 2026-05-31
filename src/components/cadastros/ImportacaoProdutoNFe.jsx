import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { toast } from "sonner";

const sanitizeText = (value, max = 240) => String(value ?? '').replace(/[<>]/g, '').slice(0, max).trim();
const toNumber = (value) => {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * V21.1.2-R2 - Importação Automática de Produtos via NF-e
 * ✅ Upload de XML ou PDF
 * ✅ OCR + IA para extrair dados
 * ✅ Detecção de duplicidade
 * ✅ Criação automática de produtos
 */
export default function ImportacaoProdutoNFe({ onProdutosCriados }) {
  const { empresaAtual, grupoAtual, contexto, filterInContext, createInContext } = useContextoVisual();
  const { canCreate } = usePermissions();
  const [arquivo, setArquivo] = useState(null);
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = contexto === 'empresa' ? empresaAtual?.id : null;
  const contextoValido = Boolean(groupId || empresaId);
  const podeCriarProduto = canCreate('Cadastros', 'Produto') || canCreate('Estoque', 'Produto') || canCreate('Cadastros', null);

  const auditImportacaoProdutoNFe = async ({ acao, sucesso = true, motivo = null, dados = {} }) => {
    try {
      await base44.entities.AuditLog.create({
        acao,
        modulo: 'Cadastros',
        entidade: 'Produto',
        registro_id: dados.registro_id || null,
        empresa_id: dados.empresa_id || empresaId || null,
        group_id: dados.group_id || groupId || null,
        grupo_id: dados.group_id || groupId || null,
        tipo_auditoria: sucesso ? 'entidade' : 'seguranca',
        descricao: motivo || 'Auditoria da importa\u00e7\u00e3o autom\u00e1tica de produtos via NF-e.',
        dados_anteriores: dados.dados_anteriores || null,
        dados_novos: { ...dados, contexto, arquivo: arquivo?.name || null },
        sucesso,
        data_hora: new Date().toISOString(),
      });
    } catch (_) {}
  };
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const processarNFe = async () => {
    if (!arquivo) {
      toast.error("Selecione um arquivo XML ou PDF");
      return;
    }

    if (!contextoValido) {
      await auditImportacaoProdutoNFe({ acao: 'Produto.importacao_produto_nfe_bloqueada', sucesso: false, motivo: 'Contexto de grupo ou empresa obrigat\u00f3rio.', dados: { etapa: 'processamento' } });
      toast.error('Selecione um grupo ou empresa antes de processar a NF-e.');
      return;
    }
    if (!podeCriarProduto) {
      await auditImportacaoProdutoNFe({ acao: 'Produto.importacao_produto_nfe_negada', sucesso: false, motivo: 'Permiss\u00e3o negada para criar produtos.', dados: { etapa: 'processamento' } });
      toast.error('Sem permiss\u00e3o para criar produtos.');
      return;
    }

    setProcessando(true);
    setResultado(null);

    try {
      // 1. Upload do arquivo
      const { file_url } = await base44.integrations.Core.UploadFile({ file: arquivo });

      // 2. IA extrai dados da NF-e
      const dadosExtraidos = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um especialista em NF-e brasileiras. Analise este arquivo e extraia TODOS os produtos, incluindo:
        
        Para cada produto:
        - descricao (descrição completa)
        - codigo (código do produto)
        - ncm (código NCM de 8 dígitos)
        - cest (se tiver)
        - unidade_medida (UN, KG, MT, etc)
        - quantidade
        - valor_unitario
        - cfop
        - origem_mercadoria (0 a 8)
        - eh_bitola (true se for vergalhão/bitola de aço)
        - peso_teorico_kg_m (se for bitola)
        - bitola_diametro_mm (se for bitola)
        
        IMPORTANTE: Se detectar bitolas de aço (ex: "VERGALHÃO 8MM", "CA-50 10MM"), preencha:
        - eh_bitola: true
        - peso_teorico_kg_m: peso da tabela oficial ABNT
        - bitola_diametro_mm: diâmetro
        
        Retorne um array de produtos.`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            produtos: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  descricao: { type: "string" },
                  codigo: { type: "string" },
                  ncm: { type: "string" },
                  cest: { type: "string" },
                  unidade_medida: { type: "string" },
                  quantidade: { type: "number" },
                  valor_unitario: { type: "number" },
                  cfop: { type: "string" },
                  origem_mercadoria: { type: "string" },
                  eh_bitola: { type: "boolean" },
                  peso_teorico_kg_m: { type: "number" },
                  bitola_diametro_mm: { type: "number" }
                }
              }
            },
            fornecedor: {
              type: "object",
              properties: {
                razao_social: { type: "string" },
                cnpj: { type: "string" }
              }
            },
            numero_nfe: { type: "string" },
            data_emissao: { type: "string" }
          }
        }
      });

      // 3. Verificar duplicidade
      const produtosExistentes = await filterInContext('Produto', {}, '-updated_date', 9999);
      const produtosComStatus = dadosExtraidos.produtos.map(prod => {
        const duplicado = produtosExistentes.find(p => 
          p.ncm === prod.ncm && 
          p.descricao?.toLowerCase().includes(prod.descricao.toLowerCase().split(' ')[0])
        );
        
        return {
          ...prod,
          duplicado: !!duplicado,
          produto_existente_id: duplicado?.id
        };
      });

      setResultado({
        produtos: produtosComStatus,
        fornecedor: dadosExtraidos.fornecedor,
        numero_nfe: dadosExtraidos.numero_nfe,
        data_emissao: dadosExtraidos.data_emissao,
        arquivo_url: file_url
      });

      toast.success(`${produtosComStatus.length} produto(s) extra\u00eddo(s) da NF-e!`);
    } catch (error) {
      toast.error("Erro ao processar NF-e: " + error.message);
    } finally {
      setProcessando(false);
    }
  };

  const importarProdutos = async () => {
    if (!resultado?.produtos?.length) {
      toast.error("Processe uma NF-e antes de importar produtos.");
      return;
    }
    if (!contextoValido) {
      await auditImportacaoProdutoNFe({ acao: 'Produto.importacao_produto_nfe_bloqueada', sucesso: false, motivo: 'Contexto de grupo ou empresa obrigat\u00f3rio.', dados: { etapa: 'importacao' } });
      toast.error("Selecione/defina grupo ou empresa de destino antes de importar.");
      return;
    }
    if (!podeCriarProduto) {
      await auditImportacaoProdutoNFe({ acao: 'Produto.importacao_produto_nfe_negada', sucesso: false, motivo: 'Permiss\u00e3o negada para criar produtos.', dados: { etapa: 'importacao' } });
      toast.error('Sem permiss\u00e3o para criar produtos.');
      return;
    }
    const produtosNovos = resultado.produtos.filter(p => !p.duplicado);
    
    if (produtosNovos.length === 0) {
      toast.error("Todos os produtos já existem!");
      return;
    }

    const confirmado = window.confirm('Importar ' + produtosNovos.length + ' produto(s) novo(s) da NF-e no contexto selecionado? Esta a\u00e7\u00e3o ser\u00e1 auditada.');
    if (!confirmado) {
      await auditImportacaoProdutoNFe({ acao: 'Produto.importacao_produto_nfe_cancelada', sucesso: false, motivo: 'Confirma\u00e7\u00e3o cancelada pelo usu\u00e1rio.', dados: { total_produtos: produtosNovos.length } });
      return;
    }

    setProcessando(true);

    try {
      const produtosCriados = [];

      for (const prod of produtosNovos) {
        const payloadProduto = {
          empresa_id: empresaId,
          group_id: groupId,
          grupo_id: groupId,
          descricao: sanitizeText(prod.descricao, 240),
          codigo: sanitizeText(prod.codigo, 80),
          ncm: sanitizeText(prod.ncm, 20),
          cest: sanitizeText(prod.cest, 20),
          unidade_medida: sanitizeText(prod.unidade_medida || 'UN', 12).toUpperCase() || 'UN',
          unidade_principal: sanitizeText(prod.unidade_medida, 12).toUpperCase() === 'KG' ? 'KG' : 'UN',
          unidades_secundarias: [sanitizeText(prod.unidade_medida || 'UN', 12).toUpperCase() || 'UN'],
          custo_aquisicao: toNumber(prod.valor_unitario),
          cfop: sanitizeText(prod.cfop, 20),
          origem_mercadoria: sanitizeText(prod.origem_mercadoria, 20),
          eh_bitola: prod.eh_bitola || false,
          peso_teorico_kg_m: toNumber(prod.peso_teorico_kg_m),
          bitola_diametro_mm: toNumber(prod.bitola_diametro_mm),
          status: 'Ativo',
          fornecedor_principal: sanitizeText(resultado.fornecedor?.razao_social, 180),
          observacoes: 'Importado da NF-e ' + sanitizeText(resultado.numero_nfe, 80) + ' em ' + new Date().toLocaleDateString()
        };

        if (!payloadProduto.descricao) continue;
        const novoProduto = await createInContext('Produto', payloadProduto);

        produtosCriados.push(novoProduto);
      }

      await auditImportacaoProdutoNFe({ acao: 'Produto.importacao_produto_nfe_concluida', sucesso: true, dados: { total_produtos: produtosNovos.length, total_criados: produtosCriados.length, numero_nfe: resultado.numero_nfe, codigos: produtosCriados.map((p) => p?.codigo).filter(Boolean).slice(0, 50) } });
      toast.success(`${produtosCriados.length} produto(s) criado(s)!`);
      
      if (onProdutosCriados) {
        onProdutosCriados(produtosCriados);
      }

      setResultado(null);
      setArquivo(null);
    } catch (error) {
      await auditImportacaoProdutoNFe({ acao: 'Produto.importacao_produto_nfe_erro', sucesso: false, motivo: error?.message || 'Erro ao importar produtos.', dados: { total_produtos: produtosNovos.length } });
      toast.error("Erro ao importar: " + error.message);
    } finally {
      setProcessando(false);
    }
  };

  return (
    <Card className="border-2 border-purple-200">
      <CardHeader className="bg-purple-50">
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-600" />
          Importar Produtos da NF-e
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <Alert className="border-blue-200 bg-blue-50">
          <AlertDescription className="text-sm text-blue-900">
            📄 <strong>Como funciona:</strong> Faça upload do XML ou PDF da nota fiscal. 
            A IA extrairá automaticamente todos os produtos com NCM, peso, bitola e tributação.
          </AlertDescription>
        </Alert>

        {(!contextoValido || !podeCriarProduto) && (
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              {'O importador exige contexto de grupo/empresa e permiss\u00e3o para criar produtos.'}
            </AlertDescription>
          </Alert>
        )}

        <div>
          <input
            type="file"
            accept=".xml,.pdf"
            onChange={(e) => setArquivo(e.target.files[0])}
            className="hidden"
            id="nfe-upload"
            disabled={processando || !contextoValido || !podeCriarProduto}
          />
          <label htmlFor="nfe-upload">
            <Button variant="outline" className="w-full" asChild disabled={processando || !contextoValido || !podeCriarProduto}>
              <span>
                <Upload className="w-4 h-4 mr-2" />
                {arquivo ? arquivo.name : 'Selecionar XML ou PDF da NF-e'}
              </span>
            </Button>
          </label>
        </div>

        {arquivo && (
          <Button 
            onClick={processarNFe} 
            disabled={processando || !contextoValido || !podeCriarProduto}
            data-permission="Cadastros.Produto.criar"
            data-action="processar-produtos-nfe"
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {processando ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processando com IA...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                Processar NF-e
              </>
            )}
          </Button>
        )}

        {resultado && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-green-900">NF-e {resultado.numero_nfe}</p>
                  <p className="text-sm text-green-700">{resultado.fornecedor?.razao_social}</p>
                  <p className="text-xs text-green-600">
                    Emitida em {new Date(resultado.data_emissao).toLocaleDateString()}
                  </p>
                </div>
                <Badge className="bg-green-600 text-white">
                  {resultado.produtos.length} produtos
                </Badge>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {resultado.produtos.map((prod, idx) => (
                  <div key={idx} className={`p-3 rounded border ${
                    prod.duplicado ? 'bg-yellow-50 border-yellow-300' : 'bg-white border-slate-200'
                  }`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{prod.descricao}</p>
                        <div className="flex gap-3 text-xs text-slate-600 mt-1">
                          <span>NCM: {prod.ncm}</span>
                          <span>UN: {prod.unidade_medida}</span>
                          {prod.eh_bitola && (
                            <Badge className="bg-blue-600 text-white text-xs">Bitola</Badge>
                          )}
                        </div>
                      </div>
                      {prod.duplicado ? (
                        <Badge className="bg-yellow-600 text-white">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Já existe
                        </Badge>
                      ) : (
                        <Badge className="bg-green-600 text-white">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Novo
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <Button
                onClick={importarProdutos}
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={processando || resultado.produtos.every(p => p.duplicado) || !contextoValido || !podeCriarProduto}
                data-permission="Cadastros.Produto.criar"
                data-action="importar-produtos-nfe-pdf"
                data-sensitive
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Importar {resultado.produtos.filter(p => !p.duplicado).length} Produto(s) Novo(s)
              </Button>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}