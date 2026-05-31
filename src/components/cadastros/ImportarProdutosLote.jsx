import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Loader2, FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';

const sanitizeText = (value, max = 240) => String(value ?? '').replace(/[<>]/g, '').slice(0, max).trim();
const toNumber = (value) => {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * V21.1.2 - IMPORTAR PRODUTOS EM LOTE (CSV/XLSX)
 * Com mapeamento de colunas e preview antes de salvar
 */
export default function ImportarProdutosLote({ onProdutosCriados, onClose }) {
  const [arquivo, setArquivo] = useState(null);
  const { empresaAtual, grupoAtual, contexto, createInContext } = useContextoVisual();
  const { canCreate } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = contexto === 'empresa' ? empresaAtual?.id : null;
  const contextoValido = Boolean(groupId || empresaId);
  const podeCriarProduto = canCreate('Cadastros', 'Produto') || canCreate('Estoque', 'Produto') || canCreate('Cadastros', null);

  const auditImportacaoProdutos = async ({ acao, sucesso = true, motivo = null, dados = {} }) => {
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
        descricao: motivo || 'Auditoria da importa\u00e7\u00e3o de produtos em lote.',
        dados_anteriores: dados.dados_anteriores || null,
        dados_novos: { ...dados, contexto, arquivo: arquivo?.name || null },
        sucesso,
        data_hora: new Date().toISOString(),
      });
    } catch (_) {}
  };
  const [processando, setProcessando] = useState(false);
  const [dadosParsed, setDadosParsed] = useState(null);
  const [mapeamento, setMapeamento] = useState({
    descricao: '',
    codigo: '',
    ncm: '',
    unidade_medida: '',
    custo_aquisicao: '',
    preco_venda: '',
    peso_teorico_kg_m: '',
    grupo: ''
  });

  const handleUploadArquivo = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setArquivo(file);
    setProcessando(true);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // Extrair dados com IA
      const resultado = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: {
            colunas: {
              type: "array",
              items: { type: "string" }
            },
            linhas: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: true
              }
            }
          }
        }
      });

      if (resultado.status === 'success') {
        setDadosParsed(resultado.output);
        
        // Tentar mapear automaticamente
        const colunasAuto = {};
        resultado.output.colunas.forEach(col => {
          const colLower = col.toLowerCase();
          if (colLower.includes('descri') || colLower.includes('nome')) colunasAuto.descricao = col;
          if (colLower.includes('codigo') || colLower.includes('sku')) colunasAuto.codigo = col;
          if (colLower.includes('ncm')) colunasAuto.ncm = col;
          if (colLower.includes('unidade') || colLower.includes('un')) colunasAuto.unidade_medida = col;
          if (colLower.includes('custo')) colunasAuto.custo_aquisicao = col;
          if (colLower.includes('preco') || colLower.includes('venda')) colunasAuto.preco_venda = col;
          if (colLower.includes('peso')) colunasAuto.peso_teorico_kg_m = col;
          if (colLower.includes('grupo') || colLower.includes('categoria')) colunasAuto.grupo = col;
        });
        setMapeamento(colunasAuto);
        
        toast.success(`${resultado.output.linhas.length} linhas encontradas`);
      } else {
        toast.error('Erro ao processar arquivo: ' + resultado.details);
      }
    } catch (error) {
      toast.error('Erro: ' + error.message);
    } finally {
      setProcessando(false);
    }
  };

  const handleCriarProdutos = async () => {
    if (!dadosParsed || !mapeamento.descricao) {
      toast.error('Configure o mapeamento de colunas');
      return;
    }

    if (!contextoValido) {
      await auditImportacaoProdutos({ acao: 'Produto.importacao_lote_bloqueada', sucesso: false, motivo: 'Contexto de grupo ou empresa obrigat\u00f3rio.', dados: { total_linhas: dadosParsed?.linhas?.length || 0 } });
      toast.error('Selecione um grupo ou empresa antes de importar produtos.');
      return;
    }
    if (!podeCriarProduto) {
      await auditImportacaoProdutos({ acao: 'Produto.importacao_lote_negada', sucesso: false, motivo: 'Permiss\u00e3o negada para criar produtos.', dados: { total_linhas: dadosParsed?.linhas?.length || 0 } });
      toast.error('Sem permiss\u00e3o para criar produtos.');
      return;
    }

    const confirmado = window.confirm('Criar ' + dadosParsed.linhas.length + ' produto(s) no contexto selecionado? Esta a\u00e7\u00e3o ser\u00e1 auditada.');
    if (!confirmado) {
      await auditImportacaoProdutos({ acao: 'Produto.importacao_lote_cancelada', sucesso: false, motivo: 'Confirma\u00e7\u00e3o cancelada pelo usu\u00e1rio.', dados: { total_linhas: dadosParsed.linhas.length } });
      return;
    }

    setProcessando(true);

    try {
      const produtosCriados = [];

      for (const linha of dadosParsed.linhas) {
        const novoProduto = {
          descricao: sanitizeText(linha[mapeamento.descricao], 240),
          codigo: mapeamento.codigo ? sanitizeText(linha[mapeamento.codigo], 80) : '',
          ncm: mapeamento.ncm ? sanitizeText(linha[mapeamento.ncm], 20) : '',
          unidade_medida: mapeamento.unidade_medida ? sanitizeText(linha[mapeamento.unidade_medida], 12).toUpperCase() : 'UN',
          unidade_principal: mapeamento.unidade_medida ? sanitizeText(linha[mapeamento.unidade_medida], 12).toUpperCase() : 'UN',
          unidades_secundarias: mapeamento.unidade_medida ? [sanitizeText(linha[mapeamento.unidade_medida], 12).toUpperCase()] : ['UN'],
          custo_aquisicao: mapeamento.custo_aquisicao ? toNumber(linha[mapeamento.custo_aquisicao]) : 0,
          preco_venda: mapeamento.preco_venda ? toNumber(linha[mapeamento.preco_venda]) : 0,
          peso_teorico_kg_m: mapeamento.peso_teorico_kg_m ? toNumber(linha[mapeamento.peso_teorico_kg_m]) : 0,
          grupo: mapeamento.grupo ? sanitizeText(linha[mapeamento.grupo], 120) : 'Outros',
          tipo_item: 'Revenda',
          status: 'Ativo',
          group_id: groupId,
          grupo_id: groupId,
          empresa_id: empresaId
        };

        // IA pode sugerir eh_bitola se tiver peso_teorico
        if (novoProduto.peso_teorico_kg_m > 0 && novoProduto.descricao.toLowerCase().includes('barra')) {
          novoProduto.eh_bitola = true;
        }

        if (!novoProduto.descricao) continue;
        const produtoCriado = await createInContext('Produto', novoProduto);
        produtosCriados.push(produtoCriado);
      }

      await auditImportacaoProdutos({ acao: 'Produto.importacao_lote_concluida', sucesso: true, dados: { total_linhas: dadosParsed.linhas.length, total_criados: produtosCriados.length, codigos: produtosCriados.map((p) => p?.codigo).filter(Boolean).slice(0, 50) } });
      toast.success(`${produtosCriados.length} produtos criados!`);
      onProdutosCriados && onProdutosCriados(produtosCriados);
      onClose && onClose();
    } catch (error) {
      await auditImportacaoProdutos({ acao: 'Produto.importacao_lote_erro', sucesso: false, motivo: error?.message || 'Erro ao criar produtos.', dados: { total_linhas: dadosParsed?.linhas?.length || 0 } });
      toast.error('Erro ao criar produtos: ' + error.message);
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="space-y-4">
      <Alert className="border-purple-200 bg-purple-50">
        <FileSpreadsheet className="w-4 h-4 text-purple-600" />
        <AlertDescription className="text-sm text-purple-900">
          <strong>{'Importa\u00e7\u00e3o em Lote:'}</strong> Envie CSV ou XLSX com seus produtos
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
      {!dadosParsed && (
        <Card>
          <CardContent className="p-8 text-center">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleUploadArquivo}
              className="hidden"
              id="lote-upload"
              disabled={processando || !contextoValido || !podeCriarProduto}
            />
            <label htmlFor="lote-upload">
              <Button variant="outline" size="lg" disabled={processando || !contextoValido || !podeCriarProduto} asChild>
                <span>
                  {processando ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5 mr-2" />
                  )}
                  {processando ? 'Processando...' : 'Selecionar Arquivo'}
                </span>
              </Button>
            </label>
            <p className="text-xs text-slate-500 mt-3">Formatos: .csv, .xlsx, .xls</p>
          </CardContent>
        </Card>
      )}

      {/* MAPEAMENTO */}
      {dadosParsed && (
        <>
          <Card>
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-base">Mapeamento de Colunas</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold">Descrição do Produto *</label>
                  <Select value={mapeamento.descricao} onValueChange={(v) => setMapeamento({...mapeamento, descricao: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione coluna" />
                    </SelectTrigger>
                    <SelectContent>
                      {dadosParsed.colunas.map(col => (
                        <SelectItem key={col} value={col}>{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-semibold">Código/SKU</label>
                  <Select value={mapeamento.codigo} onValueChange={(v) => setMapeamento({...mapeamento, codigo: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="(Opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>Nenhuma</SelectItem>
                      {dadosParsed.colunas.map(col => (
                        <SelectItem key={col} value={col}>{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-semibold">NCM</label>
                  <Select value={mapeamento.ncm} onValueChange={(v) => setMapeamento({...mapeamento, ncm: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="(Opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>Nenhuma</SelectItem>
                      {dadosParsed.colunas.map(col => (
                        <SelectItem key={col} value={col}>{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-semibold">Unidade</label>
                  <Select value={mapeamento.unidade_medida} onValueChange={(v) => setMapeamento({...mapeamento, unidade_medida: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="(Opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>Nenhuma</SelectItem>
                      {dadosParsed.colunas.map(col => (
                        <SelectItem key={col} value={col}>{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-semibold">Custo</label>
                  <Select value={mapeamento.custo_aquisicao} onValueChange={(v) => setMapeamento({...mapeamento, custo_aquisicao: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="(Opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>Nenhuma</SelectItem>
                      {dadosParsed.colunas.map(col => (
                        <SelectItem key={col} value={col}>{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-semibold">Preço Venda</label>
                  <Select value={mapeamento.preco_venda} onValueChange={(v) => setMapeamento({...mapeamento, preco_venda: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="(Opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>Nenhuma</SelectItem>
                      {dadosParsed.colunas.map(col => (
                        <SelectItem key={col} value={col}>{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* PREVIEW */}
          <Card>
            <CardHeader className="bg-green-50 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                Preview ({dadosParsed.linhas.length} produtos)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {dadosParsed.linhas.slice(0, 10).map((linha, idx) => (
                  <div key={idx} className="p-2 bg-slate-50 rounded text-sm border">
                    <p className="font-semibold">
                      {mapeamento.descricao ? linha[mapeamento.descricao] : '(Sem descrição)'}
                    </p>
                    <p className="text-xs text-slate-600">
                      {mapeamento.codigo && `Código: ${linha[mapeamento.codigo]} • `}
                      {mapeamento.ncm && `NCM: ${linha[mapeamento.ncm]} • `}
                      {mapeamento.unidade_medida && `Un: ${linha[mapeamento.unidade_medida]}`}
                    </p>
                  </div>
                ))}
              </div>
              {dadosParsed.linhas.length > 10 && (
                <p className="text-xs text-slate-500 mt-2 text-center">
                  ... e mais {dadosParsed.linhas.length - 10} linhas
                </p>
              )}
            </CardContent>
          </Card>

          {/* AÇÕES */}
          <div className="flex items-center justify-between p-4 bg-slate-50 border rounded-lg">
            <div className="text-sm">
              <p className="font-semibold text-slate-900">{dadosParsed.linhas.length} produtos serão criados</p>
              <p className="text-xs text-slate-600">IA pode sugerir melhorias durante a criação</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button 
                onClick={handleCriarProdutos}
                disabled={processando || !mapeamento.descricao || !contextoValido || !podeCriarProduto}
                data-permission="Cadastros.Produto.criar"
                data-action="importar-produtos-lote"
                data-sensitive
                className="bg-purple-600 hover:bg-purple-700"
              >
                {processando ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                Criar Todos
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}