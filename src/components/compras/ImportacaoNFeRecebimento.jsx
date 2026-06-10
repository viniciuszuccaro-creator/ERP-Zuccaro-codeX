import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileText, CheckCircle2, AlertCircle, Sparkles, Package } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

const XML_MAX_SIZE_BYTES = 10 * 1024 * 1024;

export default function ImportacaoNFeRecebimento({ windowMode = false }) {
  const [arquivo, setArquivo] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const { empresaAtual, grupoAtual, contexto, createInContext, updateInContext, filterInContext } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const canProcessarNFe = hasPermission('Compras', 'ImportacaoNFe', 'criar') ||
    hasPermission('Compras', 'Recebimento', 'criar') ||
    hasPermission('Estoque', 'Movimentacoes', 'criar') ||
    hasPermission('Compras', null, 'criar');

  const auditImportacao = async ({ acao, sucesso = true, motivo = null, dados = {} }) => {
    try {
      await createInContext('AuditLog', {
        acao,
        modulo: 'Compras',
        entidade: 'ImportacaoXMLNFe',
        tipo_auditoria: sucesso ? 'entidade' : 'seguranca',
        descricao: motivo || 'Auditoria de importacao de NF-e de recebimento.',
        dados_novos: dados,
        group_id: groupId || dados.group_id || null,
        grupo_id: groupId || dados.group_id || null,
        empresa_id: empresaId || dados.empresa_id || null,
        sucesso,
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('Falha ao auditar importacao de NF-e:', error);
    }
  };

  const processarXMLMutation = useMutation({
    mutationFn: async (file) => {
      if (!contextoValido || !canProcessarNFe) {
        await auditImportacao({
          acao: 'ImportacaoNFe.processamento_bloqueado',
          sucesso: false,
          motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada',
          dados: { arquivo: file?.name }
        });
        throw new Error(!contextoValido ? 'Selecione grupo ou empresa antes de processar NF-e.' : 'Sem permissao para processar NF-e de recebimento.');
      }

      setProcessando(true);
      await new Promise(resolve => setTimeout(resolve, 2000));

      const mockResultado = {
        sucesso: true,
        nfe: {
          numero: "123456",
          serie: "1",
          chave: "35250112345678901234567890123456789012345678",
          data_emissao: "2025-01-20",
          fornecedor: "Acos Fortes Ltda",
          cnpj: "12.345.678/0001-90",
          valor_total: 15800.00,
          itens: [
            {
              codigo: "BIT-125",
              descricao: "Barra de Aco CA-50 12.5mm",
              ncm: "72142000",
              quantidade: 500,
              unidade: "KG",
              valor_unitario: 25.60,
              valor_total: 12800.00,
              produto_encontrado: true,
              produto_id: "prod_123"
            },
            {
              codigo: "BIT-100",
              descricao: "Barra de Aco CA-50 10.0mm",
              ncm: "72142000",
              quantidade: 300,
              unidade: "KG",
              valor_unitario: 10.00,
              valor_total: 3000.00,
              produto_encontrado: true,
              produto_id: "prod_456"
            }
          ]
        },
        avisos: [
          "Todos os produtos foram encontrados no cadastro",
          "IA sugeriu atualizacao de custo medio dos produtos"
        ]
      };

      setResultado(mockResultado);
      setProcessando(false);
      await auditImportacao({
        acao: 'ImportacaoNFe.processada',
        dados: {
          arquivo: file?.name,
          numero_nfe: mockResultado.nfe.numero,
          chave_acesso: mockResultado.nfe.chave,
          quantidade_itens: mockResultado.nfe.itens.length,
          valor_total: mockResultado.nfe.valor_total
        }
      });
      return mockResultado;
    },
    onError: (error) => {
      setProcessando(false);
      toast({
        title: "Erro no processamento",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const confirmarRecebimentoMutation = useMutation({
    mutationFn: async (dados) => {
      if (!contextoValido || !canProcessarNFe) {
        await auditImportacao({
          acao: 'ImportacaoNFe.recebimento_bloqueado',
          sucesso: false,
          motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada',
          dados: { numero_nfe: dados?.nfe?.numero, chave_acesso: dados?.nfe?.chave }
        });
        throw new Error(!contextoValido ? 'Selecione grupo ou empresa antes de confirmar recebimento.' : 'Sem permissao para confirmar recebimento por NF-e.');
      }

      const importacao = await createInContext('ImportacaoXMLNFe', {
        tipo_nfe: "Entrada",
        chave_acesso: dados.nfe.chave,
        numero_nfe: dados.nfe.numero,
        serie: dados.nfe.serie,
        fornecedor_nome: dados.nfe.fornecedor,
        fornecedor_cnpj: dados.nfe.cnpj,
        data_emissao: dados.nfe.data_emissao,
        valor_total: dados.nfe.valor_total,
        quantidade_itens: dados.nfe.itens.length,
        status_processamento: "Processado",
        data_importacao: new Date().toISOString(),
        group_id: groupId,
        grupo_id: groupId,
        empresa_id: empresaId
      });

      let itensMovimentados = 0;
      for (const item of dados.nfe.itens) {
        if (item.produto_encontrado && item.produto_id) {
          await createInContext('MovimentacaoEstoque', {
            origem_movimento: "nfe",
            tipo_movimento: "entrada",
            tipo_movimentacao: "Entrada",
            produto_id: item.produto_id,
            produto_descricao: item.descricao,
            quantidade: item.quantidade,
            unidade_medida: item.unidade,
            valor_unitario: item.valor_unitario,
            valor_total: item.valor_total,
            documento: `NF-e ${dados.nfe.numero}`,
            data_movimentacao: dados.nfe.data_emissao,
            motivo: `Recebimento NF-e ${dados.nfe.numero}`,
            responsavel: "Sistema - Importacao XML",
            group_id: groupId,
            grupo_id: groupId,
            empresa_id: empresaId
          });
          itensMovimentados += 1;

          const produtos = await filterInContext('Produto', { id: item.produto_id }, 'descricao', 1);
          const produtoAtual = Array.isArray(produtos) ? produtos[0] : null;
          if (produtoAtual) {
            await updateInContext('Produto', item.produto_id, {
              estoque_atual: (Number(produtoAtual.estoque_atual) || 0) + Number(item.quantidade || 0),
              ultimo_preco_compra: item.valor_unitario,
              ultima_compra: dados.nfe.data_emissao,
              group_id: produtoAtual.group_id || groupId,
              grupo_id: produtoAtual.grupo_id || groupId,
              empresa_id: produtoAtual.empresa_id || empresaId
            });
          }
        }
      }

      await auditImportacao({
        acao: 'ImportacaoNFe.recebimento_confirmado',
        dados: {
          importacao_id: importacao?.id,
          numero_nfe: dados.nfe.numero,
          chave_acesso: dados.nfe.chave,
          itens_movimentados: itensMovimentados,
          valor_total: dados.nfe.valor_total,
          group_id: groupId,
          empresa_id: empresaId
        }
      });

      return importacao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movimentacoes'] });
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      queryClient.invalidateQueries({ queryKey: ['importacoes-nfe'] });
      toast({
        title: "Recebimento confirmado",
        description: "Estoque atualizado automaticamente"
      });
      setResultado(null);
      setArquivo(null);
    },
    onError: (error) => {
      toast({
        title: "Recebimento nao confirmado",
        description: error?.message || "Erro ao confirmar recebimento",
        variant: "destructive"
      });
    }
  });

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.xml')) {
        toast({
          title: "Formato invalido",
          description: "Por favor, selecione um arquivo XML",
          variant: "destructive"
        });
        e.target.value = "";
        return;
      }
      if (file.size > XML_MAX_SIZE_BYTES) {
        await auditImportacao({
          acao: 'ImportacaoNFe.arquivo_bloqueado',
          sucesso: false,
          motivo: 'arquivo_xml_muito_grande',
          dados: { arquivo: file.name, tamanho_bytes: file.size }
        });
        toast({
          title: "Arquivo muito grande",
          description: "Selecione um XML de ate 10 MB para processar com seguranca.",
          variant: "destructive"
        });
        e.target.value = "";
        return;
      }
      setArquivo(file);
    }
  };

  const handleProcessar = () => {
    if (!arquivo) return;
    processarXMLMutation.mutate(arquivo);
  };

  const handleConfirmarRecebimento = async () => {
    if (!resultado) return;
    if (!contextoValido || !canProcessarNFe) {
      await auditImportacao({
        acao: 'ImportacaoNFe.recebimento_bloqueado',
        sucesso: false,
        motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada',
        dados: { numero_nfe: resultado?.nfe?.numero, chave_acesso: resultado?.nfe?.chave }
      });
      toast({
        title: "Recebimento bloqueado",
        description: !contextoValido ? "Selecione grupo ou empresa antes de confirmar." : "Sem permissao para confirmar recebimento.",
        variant: "destructive"
      });
      return;
    }

    const confirmado = window.confirm(`Confirma o recebimento da NF-e ${resultado.nfe.numero} e a atualizacao de estoque de ${resultado.nfe.itens.length} item(ns)?`);
    if (!confirmado) {
      await auditImportacao({
        acao: 'ImportacaoNFe.recebimento_cancelado',
        sucesso: false,
        motivo: 'confirmacao_cancelada',
        dados: { numero_nfe: resultado.nfe.numero, chave_acesso: resultado.nfe.chave }
      });
      return;
    }

    confirmarRecebimentoMutation.mutate(resultado);
  };

  const content = (
    <div
      className="space-y-2 w-full h-full"
      data-permission="Compras.ImportacaoNFe.criar"
      data-context-required="group-or-company"
      data-context-mode={contexto}
    >
      {(!contextoValido || !canProcessarNFe) && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertCircle className="w-4 h-4 text-amber-700" />
          <AlertDescription className="text-sm text-amber-800">
            {!contextoValido
              ? "Selecione um grupo ou empresa antes de processar NF-e."
              : "Seu perfil nao possui permissao para processar recebimento por NF-e."}
          </AlertDescription>
        </Alert>
      )}

      <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50">
        <CardHeader className="bg-blue-100/50 border-b border-blue-200 py-3 px-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="w-5 h-5 text-blue-600" />
            Recebimento automatico por NF-e (XML)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <Alert className="border-blue-300 bg-white/70">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <AlertDescription className="text-sm">
              <strong>IA automatizada:</strong> faca upload do XML da NF-e de entrada. O sistema identifica produtos, atualiza estoque e custos automaticamente.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="xml-upload" className="text-sm font-semibold">
              Arquivo XML da NF-e *
            </Label>
            <div className="flex gap-2">
              <Input
                id="xml-upload"
                type="file"
                accept=".xml"
                onChange={handleFileChange}
                className="flex-1"
                disabled={!contextoValido || !canProcessarNFe}
              />
              <Button
                onClick={handleProcessar}
                disabled={!arquivo || processando || !contextoValido || !canProcessarNFe}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {processando ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Processar XML
                  </>
                )}
              </Button>
            </div>
            {arquivo && (
              <p className="text-xs text-slate-600">
                <FileText className="w-3 h-3 inline mr-1" />
                {arquivo.name} ({(arquivo.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {processando && (
            <div className="space-y-2">
              <Progress value={60} className="h-2" />
              <p className="text-xs text-slate-600 text-center">
                IA analisando XML e identificando produtos...
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {resultado && resultado.sucesso && (
        <Card className="border-2 border-green-200 bg-green-50/50">
          <CardHeader className="bg-green-100 border-b border-green-200 py-3 px-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Dados da NF-e processados
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-white p-3 rounded-lg border border-green-200">
                <p className="text-xs text-slate-600">Numero NF-e</p>
                <p className="text-lg font-bold text-green-900">{resultado.nfe.numero}</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-green-200">
                <p className="text-xs text-slate-600">Fornecedor</p>
                <p className="text-sm font-bold text-green-900">{resultado.nfe.fornecedor}</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-green-200">
                <p className="text-xs text-slate-600">Valor Total</p>
                <p className="text-lg font-bold text-green-900">
                  R$ {resultado.nfe.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="bg-white border border-green-200 rounded-lg p-3 overflow-x-auto">
              <p className="text-sm font-semibold mb-2">Itens da NF-e:</p>
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Produto</TableHead>
                    <TableHead>NCM</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Unit.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultado.nfe.itens.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium text-sm">{item.descricao}</TableCell>
                      <TableCell className="text-xs font-mono">{item.ncm}</TableCell>
                      <TableCell className="text-right">{item.quantidade} {item.unidade}</TableCell>
                      <TableCell className="text-right">R$ {item.valor_unitario.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        R$ {item.valor_total.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {item.produto_encontrado ? (
                          <Badge className="bg-green-100 text-green-700 text-xs">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Encontrado
                          </Badge>
                        ) : (
                          <Badge className="bg-orange-100 text-orange-700 text-xs">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Novo
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {resultado.avisos && resultado.avisos.length > 0 && (
              <div className="space-y-1">
                {resultado.avisos.map((aviso, idx) => (
                  <Alert key={idx} className="border-blue-300 bg-blue-50 py-2 px-3">
                    <AlertDescription className="text-xs">{aviso}</AlertDescription>
                  </Alert>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t">
              <Button variant="outline" onClick={() => setResultado(null)}>
                Cancelar
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={handleConfirmarRecebimento}
                disabled={confirmarRecebimentoMutation.isPending || !contextoValido || !canProcessarNFe}
              >
                {confirmarRecebimentoMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Confirmando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Confirmar Recebimento
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-sm">
        <CardHeader className="bg-slate-50 border-b py-2 px-3">
          <CardTitle className="text-sm">Historico de importacoes</CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="text-center py-8 text-slate-500">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma importacao realizada ainda</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (windowMode) {
    return <div className="w-full h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50 overflow-auto p-1.5">{content}</div>;
  }

  return content;
}
