import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, Upload, Loader2, CheckCircle2, Package, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';

const sanitizeText = (value, max = 240) => String(value ?? '').replace(/[<>]/g, '').slice(0, max).trim();
const toNumber = (value) => {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * V21.1.2 - IMPORTAR PRODUTOS A PARTIR DE NF-e
 * Lê XML de NF-e e cria produtos automaticamente
 */
export default function ImportarProdutosNFe({ onProdutosCriados, onClose }) {
  const [xmlFile, setXmlFile] = useState(null);
  const { empresaAtual, grupoAtual, contexto, filterInContext, createInContext } = useContextoVisual();
  const { canCreate } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = contexto === 'empresa' ? empresaAtual?.id : null;
  const contextoValido = Boolean(groupId || empresaId);
  const podeCriarProduto = canCreate('Cadastros', 'Produto') || canCreate('Estoque', 'Produto') || canCreate('Cadastros', null);

  const auditImportacaoNFe = async ({ acao, sucesso = true, motivo = null, dados = {} }) => {
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
        descricao: motivo || 'Auditoria da importa\u00e7\u00e3o de produtos via NF-e.',
        dados_anteriores: dados.dados_anteriores || null,
        dados_novos: { ...dados, contexto, arquivo: xmlFile?.name || null },
        sucesso,
        data_hora: new Date().toISOString(),
      });
    } catch (_) {}
  };
  const [processando, setProcessando] = useState(false);
  const [itensParsed, setItensParsed] = useState([]);
  const [itensSelecionados, setItensSelecionados] = useState([]);

  const handleUploadXML = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!contextoValido) {
      await auditImportacaoNFe({ acao: 'Produto.importacao_nfe_bloqueada', sucesso: false, motivo: 'Contexto de grupo ou empresa obrigat\u00f3rio.', dados: { etapa: 'upload' } });
      toast.error('Selecione um grupo ou empresa antes de importar produtos da NF-e.');
      return;
    }
    if (!podeCriarProduto) {
      await auditImportacaoNFe({ acao: 'Produto.importacao_nfe_negada', sucesso: false, motivo: 'Permiss\u00e3o negada para criar produtos.', dados: { etapa: 'upload' } });
      toast.error('Sem permiss\u00e3o para criar produtos.');
      return;
    }

    setXmlFile(file);
    setProcessando(true);

    try {
      // Upload do arquivo
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // Parsear XML com IA
      const resultado = await base44.integrations.Core.InvokeLLM({
        prompt: `Analise este XML de NF-e e extraia TODOS os itens/produtos da nota fiscal.

Para cada item, retorne:
- descricao: descrição do produto
- ncm: código NCM (8 dígitos)
- cfop: CFOP da operação
- unidade: unidade de medida (UN, KG, MT, etc)
- quantidade: quantidade
- valor_unitario: valor unitário
- codigo_produto: código do produto (cProd)
- observacoes: qualquer informação adicional relevante

IMPORTANTE: Extraia TODOS os itens, não apenas um exemplo.`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            itens: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  descricao: { type: "string" },
                  ncm: { type: "string" },
                  cfop: { type: "string" },
                  unidade: { type: "string" },
                  quantidade: { type: "number" },
                  valor_unitario: { type: "number" },
                  codigo_produto: { type: "string" },
                  observacoes: { type: "string" }
                }
              }
            },
            fornecedor: { type: "string" },
            numero_nfe: { type: "string" }
          }
        }
      });

      // Verificar quais produtos já existem
      const produtosExistentes = await filterInContext('Produto', {}, '-updated_date', 9999);
      
      const itensComStatus = resultado.itens.map(item => {
        const existe = produtosExistentes.find(p => 
          p.codigo === item.codigo_produto || 
          p.ncm === item.ncm ||
          p.descricao.toLowerCase() === item.descricao.toLowerCase()
        );

        return {
          ...item,
          produto_existente: existe,
          criar_novo: !existe
        };
      });

      setItensParsed(itensComStatus);
      setItensSelecionados(itensComStatus.filter(i => i.criar_novo).map((_, idx) => idx));
      toast.success(`${itensComStatus.length} itens encontrados na NF-e`);
    } catch (error) {
      toast.error('Erro ao processar XML: ' + error.message);
    } finally {
      setProcessando(false);
    }
  };

  const handleCriarProdutos = async () => {
    const itensCriar = itensParsed.filter((_, idx) => itensSelecionados.includes(idx));
    
    if (itensCriar.length === 0) {
      toast.error('Selecione pelo menos um item');
      return;
    }

    if (!contextoValido) {
      await auditImportacaoNFe({ acao: 'Produto.importacao_nfe_bloqueada', sucesso: false, motivo: 'Contexto de grupo ou empresa obrigat\u00f3rio.', dados: { total_itens: itensCriar.length } });
      toast.error('Selecione um grupo ou empresa antes de criar produtos.');
      return;
    }
    if (!podeCriarProduto) {
      await auditImportacaoNFe({ acao: 'Produto.importacao_nfe_negada', sucesso: false, motivo: 'Permiss\u00e3o negada para criar produtos.', dados: { total_itens: itensCriar.length } });
      toast.error('Sem permiss\u00e3o para criar produtos.');
      return;
    }

    const confirmado = window.confirm('Criar ' + itensCriar.length + ' produto(s) a partir da NF-e no contexto selecionado? Esta a\u00e7\u00e3o ser\u00e1 auditada.');
    if (!confirmado) {
      await auditImportacaoNFe({ acao: 'Produto.importacao_nfe_cancelada', sucesso: false, motivo: 'Confirma\u00e7\u00e3o cancelada pelo usu\u00e1rio.', dados: { total_itens: itensCriar.length } });
      return;
    }

    setProcessando(true);

    try {
      const produtosCriados = [];

      for (const item of itensCriar) {
        const novoProduto = {
          descricao: sanitizeText(item.descricao, 240),
          codigo: sanitizeText(item.codigo_produto, 80),
          ncm: sanitizeText(item.ncm, 20),
          unidade_medida: sanitizeText(item.unidade || 'UN', 12).toUpperCase() || 'UN',
          unidade_principal: sanitizeText(item.unidade || 'UN', 12).toUpperCase() || 'UN',
          unidades_secundarias: [sanitizeText(item.unidade || 'UN', 12).toUpperCase() || 'UN'],
          custo_aquisicao: toNumber(item.valor_unitario),
          tipo_item: 'Revenda',
          grupo: 'Outros',
          status: 'Ativo',
          group_id: groupId,
          grupo_id: groupId,
          empresa_id: empresaId
        };

        if (!novoProduto.descricao) continue;
        const produtoCriado = await createInContext('Produto', novoProduto);
        produtosCriados.push(produtoCriado);
      }

      await auditImportacaoNFe({ acao: 'Produto.importacao_nfe_concluida', sucesso: true, dados: { total_itens: itensCriar.length, total_criados: produtosCriados.length, codigos: produtosCriados.map((p) => p?.codigo).filter(Boolean).slice(0, 50) } });
      toast.success(`${produtosCriados.length} produtos criados com sucesso!`);
      onProdutosCriados && onProdutosCriados(produtosCriados);
      onClose && onClose();
    } catch (error) {
      await auditImportacaoNFe({ acao: 'Produto.importacao_nfe_erro', sucesso: false, motivo: error?.message || 'Erro ao criar produtos.', dados: { total_itens: itensCriar.length } });
      toast.error('Erro ao criar produtos: ' + error.message);
    } finally {
      setProcessando(false);
    }
  };

  const toggleItem = (idx) => {
    if (itensSelecionados.includes(idx)) {
      setItensSelecionados(itensSelecionados.filter(i => i !== idx));
    } else {
      setItensSelecionados([...itensSelecionados, idx]);
    }
  };

  return (
    <div className="space-y-4">
      <Alert className="border-blue-200 bg-blue-50">
        <FileText className="w-4 h-4 text-blue-600" />
        <AlertDescription className="text-sm text-blue-900">
          📄 <strong>Importar de NF-e:</strong> Carregue um XML de nota fiscal para criar produtos automaticamente
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

      {/* UPLOAD */}
      {!itensParsed.length && (
        <Card>
          <CardContent className="p-8 text-center">
            <input
              type="file"
              accept=".xml"
              onChange={handleUploadXML}
              className="hidden"
              id="xml-upload"
              disabled={processando || !contextoValido || !podeCriarProduto}
            />
            <label htmlFor="xml-upload">
              <Button variant="outline" size="lg" disabled={processando || !contextoValido || !podeCriarProduto} asChild>
                <span>
                  {processando ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5 mr-2" />
                  )}
                  {processando ? 'Processando XML...' : 'Selecionar XML de NF-e'}
                </span>
              </Button>
            </label>
            <p className="text-xs text-slate-500 mt-3">Formato: arquivo .xml (nota fiscal eletrônica)</p>
          </CardContent>
        </Card>
      )}

      {/* ITENS PARSEADOS */}
      {itensParsed.length > 0 && (
        <>
          <Card>
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Itens encontrados ({itensParsed.length})</span>
                <Badge className="bg-green-600">{itensSelecionados.length} selecionados</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              {itensParsed.map((item, idx) => (
                <div 
                  key={idx}
                  className={`flex items-start gap-3 p-3 border rounded-lg ${
                    item.produto_existente ? 'bg-orange-50 border-orange-300' : 'bg-white'
                  }`}
                >
                  <Checkbox
                    checked={itensSelecionados.includes(idx)}
                    onCheckedChange={() => toggleItem(idx)}
                    disabled={!!item.produto_existente}
                  />

                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-sm">{item.descricao}</p>
                        <div className="flex gap-3 mt-1 text-xs text-slate-600">
                          <span>Código: {item.codigo_produto || '-'}</span>
                          <span>NCM: {item.ncm || '-'}</span>
                          <span>Un: {item.unidade || '-'}</span>
                          <span>R$ {item.valor_unitario?.toFixed(2) || '0.00'}</span>
                        </div>
                      </div>

                      {item.produto_existente ? (
                        <Badge variant="outline" className="bg-orange-100 text-orange-700">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Já cadastrado
                        </Badge>
                      ) : (
                        <Badge className="bg-green-600">
                          <Package className="w-3 h-3 mr-1" />
                          Criar novo
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* AÇÕES */}
          <div className="flex items-center justify-between p-4 bg-slate-50 border rounded-lg">
            <div className="text-sm">
              <p className="font-semibold text-slate-900">
                {itensSelecionados.length} produtos serão criados
              </p>
              <p className="text-xs text-slate-600">
                Produtos já existentes não serão duplicados
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button 
                onClick={handleCriarProdutos}
                disabled={processando || itensSelecionados.length === 0 || !contextoValido || !podeCriarProduto}
                data-permission="Cadastros.Produto.criar"
                data-action="importar-produtos-nfe"
                data-sensitive
                className="bg-green-600 hover:bg-green-700"
              >
                {processando ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Package className="w-4 h-4 mr-2" />
                )}
                Criar {itensSelecionados.length} Produtos
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}