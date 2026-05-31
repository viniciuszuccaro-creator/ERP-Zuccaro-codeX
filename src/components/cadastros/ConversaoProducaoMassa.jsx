import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { 
  Factory, CheckCircle2, AlertTriangle, 
  ArrowRight, Sparkles, Loader2, Package 
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { toast } from "sonner";

/**
 * V21.6 - CONVERSÃO EM MASSA PARA PRODUÇÃO
 * Converte múltiplos produtos de Revenda/Acabado para Matéria-Prima Produção
 * ✅ Seleção múltipla com checkboxes
 * ✅ Preview de alterações
 * ✅ IA sugere quais produtos devem ir para produção
 * ✅ Barra de progresso para conversão
 */
export default function ConversaoProducaoMassa({ produtos, onConcluido }) {
  const { empresaAtual, grupoAtual, contexto, updateInContext } = useContextoVisual();
  const { canEdit } = usePermissions();
  const [produtosSelecionados, setProdutosSelecionados] = useState([]);
  const [processando, setProcessando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [analisandoIA, setAnalisandoIA] = useState(false);
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = contexto === 'empresa' ? empresaAtual?.id : null;
  const contextoValido = Boolean(groupId || empresaId);
  const podeEditarProduto = canEdit('Cadastros', 'Produto') || canEdit('Estoque', 'Produto') || canEdit('Producao', 'Produto') || canEdit('Cadastros', null) || canEdit('Estoque', null);

  const auditConversao = async ({ acao, sucesso = true, motivo = null, dados = {} }) => {
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
        descricao: motivo || 'Auditoria da conversao em massa de produtos para producao.',
        dados_anteriores: dados.dados_anteriores || null,
        dados_novos: { ...dados, contexto },
        sucesso,
        data_hora: new Date().toISOString(),
      });
    } catch (_) {}
  };

  // Filtrar apenas produtos que não são de produção
  const produtosConversiveis = produtos.filter(p => 
    p.tipo_item !== 'Matéria-Prima Produção'
  );

  const toggleProduto = (produtoId) => {
    if (!contextoValido || !podeEditarProduto || processando) return;
    setProdutosSelecionados(prev => 
      prev.includes(produtoId) 
        ? prev.filter(id => id !== produtoId)
        : [...prev, produtoId]
    );
  };

  const selecionarTodos = () => {
    if (!contextoValido || !podeEditarProduto || processando) return;
    if (produtosSelecionados.length === produtosConversiveis.length) {
      setProdutosSelecionados([]);
    } else {
      setProdutosSelecionados(produtosConversiveis.map(p => p.id));
    }
  };

  // IA sugere produtos que devem ir para produção
  const analisarComIA = async () => {
    if (!contextoValido) {
      await auditConversao({ acao: 'Produto.conversao_producao_ia_bloqueada', sucesso: false, motivo: 'Contexto de grupo ou empresa obrigatorio.', dados: { etapa: 'ia' } });
      toast.error('Selecione um grupo ou empresa antes de usar a IA.');
      return;
    }
    if (!podeEditarProduto) {
      await auditConversao({ acao: 'Produto.conversao_producao_ia_negada', sucesso: false, motivo: 'Permissao negada para editar produtos.', dados: { etapa: 'ia' } });
      toast.error('Sem permissao para editar produtos.');
      return;
    }
    setAnalisandoIA(true);
    
    try {
      const descricoes = produtosConversiveis
        .slice(0, 20) // Limitar para não sobrecarregar
        .map(p => p.descricao)
        .join('; ');

      const resultado = await base44.integrations.Core.InvokeLLM({
        prompt: `Analise esta lista de produtos e identifique quais devem ser usados na PRODUÇÃO (matéria-prima):

Produtos: ${descricoes}

Produtos que devem ir para PRODUÇÃO geralmente são:
- Matérias-primas (aço, ferro, vergalhões, telas)
- Componentes para manufatura
- Insumos de fabricação
- Bitolas

Produtos que devem permanecer em REVENDA:
- Produtos acabados para venda direta
- Itens de consumo final
- Produtos de terceiros

Retorne apenas os índices (0, 1, 2...) dos produtos que DEVEM ir para produção.`,
        response_json_schema: {
          type: "object",
          properties: {
            indices_producao: {
              type: "array",
              items: { type: "number" }
            },
            justificativa: { type: "string" }
          }
        }
      });

      const indicados = resultado.indices_producao || [];
      const produtosIndicados = produtosConversiveis
        .filter((_, index) => indicados.includes(index))
        .map(p => p.id);

      setProdutosSelecionados(produtosIndicados);
      
      toast.success('✨ IA analisou os produtos!', {
        description: resultado.justificativa
      });
    } catch (error) {
      toast.error('Erro na análise de IA');
    } finally {
      setAnalisandoIA(false);
    }
  };

  // Converter produtos selecionados
  const converterProdutos = async () => {
    if (produtosSelecionados.length === 0) {
      toast.error('Selecione ao menos um produto');
      return;
    }
    if (!contextoValido) {
      await auditConversao({ acao: 'Produto.conversao_producao_bloqueada', sucesso: false, motivo: 'Contexto de grupo ou empresa obrigatorio.', dados: { total_produtos: produtosSelecionados.length } });
      toast.error('Selecione um grupo ou empresa antes de converter produtos.');
      return;
    }
    if (!podeEditarProduto) {
      await auditConversao({ acao: 'Produto.conversao_producao_negada', sucesso: false, motivo: 'Permissao negada para editar produtos.', dados: { total_produtos: produtosSelecionados.length } });
      toast.error('Sem permissao para editar produtos.');
      return;
    }

    const confirmado = window.confirm('Converter ' + produtosSelecionados.length + ' produto(s) para Materia-Prima Producao no contexto selecionado? Esta acao sera auditada.');
    if (!confirmado) {
      await auditConversao({ acao: 'Produto.conversao_producao_cancelada', sucesso: false, motivo: 'Confirmacao cancelada pelo usuario.', dados: { total_produtos: produtosSelecionados.length } });
      return;
    }

    setProcessando(true);
    setProgresso(0);

    try {
      const total = produtosSelecionados.length;
      let concluidos = 0;

      for (const produtoId of produtosSelecionados) {
        const produto = produtos.find(p => p.id === produtoId);
        
        await updateInContext('Produto', produtoId, {
          empresa_id: produto?.empresa_id || empresaId || null,
          group_id: produto?.group_id || groupId || null,
          grupo_id: produto?.grupo_id || produto?.group_id || groupId || null,
          tipo_item: 'Matéria-Prima Produção',
          setor_atividade_id: 'setor-fabrica-001',
          setor_atividade_nome: 'Fábrica'
        });

        concluidos++;
        setProgresso(Math.round((concluidos / total) * 100));
      }

      await auditConversao({ acao: 'Produto.conversao_producao_concluida', sucesso: true, dados: { total_produtos: total, produtos_ids: produtosSelecionados.slice(0, 100) } });
      toast.success(`✅ ${total} produto(s) convertido(s) para Produção!`);
      setProdutosSelecionados([]);
      
      if (onConcluido) {
        onConcluido();
      }
    } catch (error) {
      await auditConversao({ acao: 'Produto.conversao_producao_erro', sucesso: false, motivo: error?.message || 'Erro na conversao em massa.', dados: { total_produtos: produtosSelecionados.length } });
      toast.error('Erro na conversão', {
        description: error.message
      });
    } finally {
      setProcessando(false);
      setProgresso(0);
    }
  };

  return (
    <div className="w-full h-full space-y-6">
      <Alert className="border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50">
        <Factory className="w-5 h-5 text-orange-600" />
        <AlertDescription>
          <p className="font-semibold text-orange-900 mb-1">🏭 Conversão em Massa para Produção</p>
          <p className="text-sm text-orange-700">
            Selecione produtos que serão usados como matéria-prima na fábrica. 
            A IA pode sugerir automaticamente.
          </p>
        </AlertDescription>
      </Alert>

      {(!contextoValido || !podeEditarProduto) && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            Conversão em massa exige contexto de grupo/empresa e permissão para editar produtos.
          </AlertDescription>
        </Alert>
      )}

      {/* Estatisticas */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-blue-200">
          <CardContent className="p-4">
            <p className="text-sm text-slate-600 mb-1">Total de Produtos</p>
            <p className="text-2xl font-bold text-blue-700">{produtosConversiveis.length}</p>
          </CardContent>
        </Card>

        <Card className="border-purple-200">
          <CardContent className="p-4">
            <p className="text-sm text-slate-600 mb-1">Selecionados</p>
            <p className="text-2xl font-bold text-purple-700">{produtosSelecionados.length}</p>
          </CardContent>
        </Card>

        <Card className="border-green-200">
          <CardContent className="p-4">
            <p className="text-sm text-slate-600 mb-1">Já em Produção</p>
            <p className="text-2xl font-bold text-green-700">
              {produtos.filter(p => p.tipo_item === 'Matéria-Prima Produção').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ações */}
      <div className="flex gap-3">
        <Button
          onClick={analisarComIA}
          disabled={analisandoIA || produtosConversiveis.length === 0 || !contextoValido || !podeEditarProduto}
          variant="outline"
          data-permission="Cadastros.Produto.editar"
          data-action="sugerir-conversao-producao-ia"
          className="border-purple-300 text-purple-700 hover:bg-purple-50"
        >
          {analisandoIA ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 mr-2" />
          )}
          IA Sugerir Produtos
        </Button>

        <Button
          onClick={selecionarTodos}
          variant="outline"
          disabled={produtosConversiveis.length === 0 || !contextoValido || !podeEditarProduto || processando}
          data-permission="Cadastros.Produto.editar"
          data-action="selecionar-produtos-conversao-producao"
        >
          {produtosSelecionados.length === produtosConversiveis.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
        </Button>

        <Button
          onClick={converterProdutos}
          disabled={processando || produtosSelecionados.length === 0 || !contextoValido || !podeEditarProduto}
          className="bg-orange-600 hover:bg-orange-700 ml-auto"
          data-permission="Cadastros.Produto.editar"
          data-action="converter-produtos-producao-massa"
          data-sensitive
        >
          {processando ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Factory className="w-4 h-4 mr-2" />
          )}
          Converter {produtosSelecionados.length > 0 && `(${produtosSelecionados.length})`}
        </Button>
      </div>

      {/* Barra de Progresso */}
      {processando && (
        <Card className="border-blue-300 bg-blue-50">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-blue-900">Convertendo produtos...</p>
              <span className="text-sm text-blue-700">{progresso}%</span>
            </div>
            <Progress value={progresso} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Lista de Produtos */}
      <Card className="border-slate-200">
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle className="text-base">
            Produtos Disponíveis para Conversão
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[500px] overflow-y-auto">
            {produtosConversiveis.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="w-16 h-16 text-green-300 mx-auto mb-4" />
                <p className="text-slate-500 font-semibold">Todos os produtos já estão em Produção! ✅</p>
              </div>
            ) : (
              <div className="divide-y">
                {produtosConversiveis.map((produto) => {
                  const selecionado = produtosSelecionados.includes(produto.id);
                  
                  return (
                    <div
                      key={produto.id}
                      className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer ${
                        selecionado ? 'bg-orange-50 border-l-4 border-orange-500' : ''
                      }`}
                      onClick={() => toggleProduto(produto.id)}
                    >
                      <div className="flex items-center gap-4">
                        <Checkbox
                          checked={selecionado}
                          onCheckedChange={() => toggleProduto(produto.id)}
                          disabled={!contextoValido || !podeEditarProduto || processando}
                          data-permission="Cadastros.Produto.editar"
                          data-action="selecionar-produto-conversao-producao"
                        />
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <p className="font-semibold text-slate-900">{produto.descricao}</p>
                            <Badge variant="outline" className="text-xs">
                              {produto.tipo_item || 'Revenda'}
                            </Badge>
                            {produto.eh_bitola && (
                              <Badge className="bg-blue-600 text-white text-xs">
                                Bitola
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-4 text-xs text-slate-600">
                            <span>Código: {produto.codigo}</span>
                            <span>Estoque: {produto.estoque_atual || 0} {produto.unidade_principal}</span>
                            <span>NCM: {produto.ncm || 'N/A'}</span>
                          </div>
                        </div>

                        {selecionado && (
                          <div className="flex items-center gap-2 text-orange-600">
                            <ArrowRight className="w-5 h-5" />
                            <Factory className="w-6 h-6" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview de Alterações */}
      {produtosSelecionados.length > 0 && (
        <Alert className="border-green-300 bg-green-50">
          <CheckCircle2 className="w-5 h-5 text-green-700" />
          <AlertDescription>
            <p className="font-semibold text-green-900 mb-2">
              ✅ Alterações que serão aplicadas em {produtosSelecionados.length} produto(s):
            </p>
            <div className="space-y-1 text-sm text-green-800">
              <p>• <strong>Tipo de Item:</strong> Revenda → Matéria-Prima Produção</p>
              <p>• <strong>Setor:</strong> Fábrica</p>
              <p>• <strong>Disponibilidade:</strong> Ordens de Produção ✅</p>
              <p>• <strong>Status:</strong> Mantido (sem alterações)</p>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}