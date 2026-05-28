import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  FileText,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  FileCheck,
  Building2,
  Calendar,
  DollarSign
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";

/**
 * 🏦 GESTÃO DE REMESSA E RETORNO CNAB V21.8
 * 
 * FUNCIONALIDADES:
 * ✅ Geração de Arquivo Remessa (CNAB 240/400)
 * ✅ Importação e Processamento de Arquivo Retorno
 * ✅ Baixa Automática de Títulos
 * ✅ Histórico de Arquivos
 * ✅ Multi-empresa
 */
export default function GestaoRemessaRetorno({ windowMode = false }) {
  const [abaAtiva, setAbaAtiva] = useState("remessa");
  const [bancoSelecionado, setBancoSelecionado] = useState("");
  const [titulosSelecionados, setTitulosSelecionados] = useState([]);
  const [dialogRemessa, setDialogRemessa] = useState(false);
  const [arquivoRetorno, setArquivoRetorno] = useState(null);
  const [processandoRetorno, setProcessandoRetorno] = useState(false);

  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, filterInContext, createInContext, updateInContext } = useContextoVisual();
  const { canCreate, canEdit, hasPermission } = usePermissions();
  const { user } = useUser();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextKey = empresaAtual?.id || groupId || "sem-contexto";
  const contextoValido = contextKey !== "sem-contexto";
  const podeGerarRemessa = canCreate("Financeiro", "Remessa Retorno") ||
    canCreate("Financeiro", "Remessa") ||
    hasPermission("Financeiro", null, "gerenciar");
  const podeProcessarRetorno = canEdit("Financeiro", "Remessa Retorno") ||
    canEdit("Financeiro", "Contas a Receber") ||
    hasPermission("Financeiro", null, "baixar");

  const auditarCNAB = async ({ acao, entidade = 'ArquivoRemessaRetorno', registroId, descricao, dadosAnteriores, dadosNovos, sucesso = true }) => {
    try {
      await base44.entities.AuditLog.create({
        acao,
        modulo: 'Financeiro',
        entidade,
        registro_id: registroId || null,
        descricao,
        usuario_id: user?.id || null,
        usuario: user?.full_name || user?.email || 'Usuario local',
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId,
        tipo_auditoria: sucesso ? 'operacional' : 'seguranca',
        dados_anteriores: dadosAnteriores,
        dados_novos: dadosNovos,
        sucesso,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Falha ao auditar CNAB:', error);
    }
  };

  // Queries
  const { data: bancos = [] } = useQuery({
    queryKey: ['bancos', contextKey],
    queryFn: () => filterInContext('Banco', {}, 'nome', 100),
    enabled: contextoValido,
  });

  const { data: contasBancarias = [] } = useQuery({
    queryKey: ['contas-bancarias', contextKey],
    queryFn: () => filterInContext('ContaBancariaEmpresa', {}, 'banco', 100),
    enabled: contextoValido,
  });

  const { data: contasReceber = [] } = useQuery({
    queryKey: ['contasReceber', contextKey],
    queryFn: () => filterInContext('ContaReceber', {}, '-data_vencimento', 500),
    enabled: contextoValido,
  });

  const { data: arquivos = [] } = useQuery({
    queryKey: ['arquivos-remessa-retorno', contextKey],
    queryFn: () => filterInContext('ArquivoRemessaRetorno', {}, '-created_date', 200),
    enabled: contextoValido,
  });

  // Filtrar títulos aptos para remessa (pendentes e sem remessa)
  const titulosAptosRemessa = contasReceber.filter(c =>
    (c.status === 'Pendente' || c.status === 'Atrasado') &&
    !c.arquivo_remessa_id &&
    c.forma_cobranca === 'Boleto'
  );

  const titulosSelecionadosData = contasReceber.filter(c =>
    titulosSelecionados.includes(c.id)
  );

  const valorTotalSelecionado = titulosSelecionadosData.reduce((sum, t) =>
    sum + (t.valor || 0), 0
  );

  // Mutation: Gerar Remessa
  const gerarRemessaMutation = useMutation({
    mutationFn: async ({ bancoId, titulosIds }) => {
      if (!contextoValido || !podeGerarRemessa) throw new Error("Sem contexto ou permissÃ£o para gerar remessa.");
      const banco = bancos.find(b => b.id === bancoId);
      const titulos = contasReceber.filter(c => titulosIds.includes(c.id));
      if (!titulos.length) throw new Error("Selecione ao menos um tÃ­tulo.");

      // Gerar conteúdo CNAB simplificado (mock)
      const numeroArquivo = arquivos.filter(a => a.tipo_arquivo === 'Remessa').length + 1;
      const conteudoCNAB = titulos.map((t, idx) => {
        const nossoNumero = String(Date.now() + idx).substring(0, 10);
        return `REG:${nossoNumero}|CLIENTE:${t.cliente}|VALOR:${t.valor}|VENC:${t.data_vencimento}`;
      }).join('\n');

      // Criar arquivo
      const arquivo = await createInContext('ArquivoRemessaRetorno', {
        empresa_id: titulos[0].empresa_id || empresaId,
        group_id: titulos[0].group_id || groupId,
        grupo_id: titulos[0].grupo_id || titulos[0].group_id || groupId,
        banco_id: bancoId,
        banco_codigo: banco.codigo,
        banco_nome: banco.nome,
        tipo_arquivo: 'Remessa',
        numero_arquivo: numeroArquivo,
        data_geracao: new Date().toISOString(),
        layout_cnab: 'CNAB400',
        quantidade_titulos: titulos.length,
        valor_total: titulos.reduce((sum, t) => sum + (t.valor || 0), 0),
        arquivo_nome: `REM${banco.codigo}_${numeroArquivo}.REM`,
        conteudo_arquivo: conteudoCNAB,
        status: 'Gerado',
        criado_por: user?.full_name || user?.email,
        criado_por_id: user?.id,
        titulos_incluidos: titulos.map((t, idx) => ({
          titulo_id: t.id,
          nosso_numero: String(Date.now() + idx).substring(0, 10),
          valor: t.valor,
          vencimento: t.data_vencimento,
          cliente_nome: t.cliente,
          cliente_documento: t.cliente_id
        }))
      });

      // Atualizar títulos
      for (const titulo of titulos) {
        const nossoNumero = String(Date.now()).substring(0, 10);
        await updateInContext('ContaReceber', titulo.id, {
          group_id: titulo.group_id || groupId,
          grupo_id: titulo.grupo_id || titulo.group_id || groupId,
          empresa_id: titulo.empresa_id || empresaId,
          arquivo_remessa_id: arquivo.id,
          nosso_numero: nossoNumero,
          data_registro_banco: new Date().toISOString(),
          status_integracao: 'enviado'
        });
      }

      return arquivo;
    },
    onSuccess: async (arquivo) => {
      await auditarCNAB({
        acao: 'Criacao',
        registroId: arquivo?.id,
        descricao: 'Arquivo de remessa CNAB gerado e titulos vinculados.',
        dadosNovos: { arquivo_nome: arquivo?.arquivo_nome, quantidade_titulos: arquivo?.quantidade_titulos, valor_total: arquivo?.valor_total }
      });
      queryClient.invalidateQueries({ queryKey: ['contasReceber'] });
      queryClient.invalidateQueries({ queryKey: ['arquivos-remessa-retorno'] });
      toast.success(`✅ Remessa gerada! ${arquivo.quantidade_titulos} títulos`);
      setTitulosSelecionados([]);
      setDialogRemessa(false);

      // Download do arquivo
      const blob = new Blob([arquivo.conteudo_arquivo], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = arquivo.arquivo_nome;
      a.click();
    },
    onError: (error) => {
      toast.error("Erro ao gerar remessa: " + error.message);
    }
  });

  // Mutation: Processar Retorno
  const processarRetornoMutation = useMutation({
    mutationFn: async (file) => {
      if (!contextoValido || !podeProcessarRetorno) throw new Error("Sem contexto ou permissÃ£o para processar retorno.");
      if (!file || file.size <= 0 || file.size > 5 * 1024 * 1024) throw new Error("Arquivo de retorno invalido ou acima de 5MB.");
      const conteudo = await file.text();
      if (/<script|javascript:/i.test(conteudo)) throw new Error("Arquivo de retorno contem conteudo bloqueado por seguranca.");
      const linhas = conteudo.split('\n').filter(l => l.trim());

      // Parser simplificado de retorno
      const ocorrencias = linhas.map(linha => {
        const partes = linha.split('|');
        const nossoNumero = partes[0]?.replace('REG:', '');
        const codigoOcorrencia = partes[1]?.replace('OCR:', '') || '06';
        const valorPago = parseFloat(partes[2]?.replace('VALOR:', '') || '0');
        const dataPagamento = partes[3]?.replace('DATA:', '');

        return { nossoNumero, codigoOcorrencia, valorPago, dataPagamento };
      });

      // Criar registro do arquivo
      const arquivo = await createInContext('ArquivoRemessaRetorno', {
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId,
        tipo_arquivo: 'Retorno',
        banco_codigo: '000',
        banco_nome: 'Importado',
        data_geracao: new Date().toISOString(),
        data_processamento: new Date().toISOString(),
        layout_cnab: 'CNAB400',
        quantidade_titulos: ocorrencias.length,
        arquivo_nome: file.name,
        conteudo_arquivo: conteudo,
        status: 'Processado',
        processado_por: user?.full_name || user?.email,
        processado_por_id: user?.id,
        ocorrencias_retorno: ocorrencias.map(o => ({
          nosso_numero: o.nossoNumero,
          codigo_ocorrencia: o.codigoOcorrencia,
          descricao_ocorrencia: o.codigoOcorrencia === '06' ? 'Liquidação' : 'Entrada Confirmada',
          valor_pago: o.valorPago,
          data_pagamento: o.dataPagamento,
          processado: false
        }))
      });

      // Processar ocorrências e baixar títulos
      let titulosBaixados = 0;
      for (const ocorrencia of ocorrencias) {
        const titulo = contasReceber.find(c => c.nosso_numero === ocorrencia.nossoNumero);
        
        if (titulo && ocorrencia.codigoOcorrencia === '06') {
          await updateInContext('ContaReceber', titulo.id, {
            group_id: titulo.group_id || groupId,
            grupo_id: titulo.grupo_id || titulo.group_id || groupId,
            empresa_id: titulo.empresa_id || empresaId,
            status: 'Recebido',
            data_recebimento: ocorrencia.dataPagamento || new Date().toISOString(),
            valor_recebido: ocorrencia.valorPago || titulo.valor,
            arquivo_retorno_id: arquivo.id,
            codigo_ocorrencia_retorno: ocorrencia.codigoOcorrencia,
            data_ocorrencia_retorno: new Date().toISOString()
          });
          titulosBaixados++;
        }
      }

      return { arquivo, titulosBaixados };
    },
    onSuccess: async ({ arquivo, titulosBaixados }) => {
      await auditarCNAB({
        acao: 'Processamento',
        registroId: arquivo?.id,
        descricao: 'Arquivo de retorno CNAB processado com baixa automatica de titulos.',
        dadosNovos: { arquivo_nome: arquivo?.arquivo_nome, quantidade_titulos: arquivo?.quantidade_titulos, titulosBaixados }
      });
      queryClient.invalidateQueries({ queryKey: ['contasReceber'] });
      queryClient.invalidateQueries({ queryKey: ['arquivos-remessa-retorno'] });
      toast.success(`✅ Retorno processado! ${titulosBaixados} título(s) baixado(s)`);
      setArquivoRetorno(null);
      setProcessandoRetorno(false);
    },
    onError: (error) => {
      toast.error("Erro ao processar retorno: " + error.message);
      setProcessandoRetorno(false);
    }
  });

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!window.confirm(`Processar arquivo de retorno ${file.name}? Esta acao pode baixar titulos automaticamente.`)) {
        auditarCNAB({ acao: 'Cancelamento', descricao: 'Usuario cancelou processamento de retorno CNAB.', dadosNovos: { arquivo_nome: file.name }, sucesso: false });
        return;
      }
      setArquivoRetorno(file);
      setProcessandoRetorno(true);
      processarRetornoMutation.mutate(file);
    }
  };

  const containerClass = windowMode 
    ? "w-full h-full flex flex-col overflow-hidden" 
    : "space-y-6";

  const contentClass = windowMode 
    ? "flex-1 overflow-auto p-6" 
    : "";

  return (
    <div className={containerClass}>
      <div className={contentClass}>
        <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="space-y-6">
          <TabsList className="bg-white border shadow-sm">
            <TabsTrigger value="remessa" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Send className="w-4 h-4 mr-2" />
              Gerar Remessa
            </TabsTrigger>
            <TabsTrigger value="retorno" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">
              <Upload className="w-4 h-4 mr-2" />
              Processar Retorno
            </TabsTrigger>
            <TabsTrigger value="historico" className="data-[state=active]:bg-slate-600 data-[state=active]:text-white">
              <FileCheck className="w-4 h-4 mr-2" />
              Histórico ({arquivos.length})
            </TabsTrigger>
          </TabsList>

          {/* ABA: GERAR REMESSA */}
          <TabsContent value="remessa" className="space-y-4">
            {titulosSelecionados.length > 0 && (
              <Alert className="border-blue-300 bg-blue-50">
                <AlertDescription className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-blue-900">
                      {titulosSelecionados.length} título(s) selecionado(s)
                    </p>
                    <p className="text-xs text-blue-700">
                      Total: R$ {valorTotalSelecionado.toFixed(2)}
                    </p>
                  </div>
                  <Button
                    onClick={() => setDialogRemessa(true)}
                    disabled={!contextoValido || !podeGerarRemessa}
                    className="bg-blue-600 hover:bg-blue-700"
                    data-action="GestaoRemessaRetorno.abrir_remessa"
                    data-permission="Financeiro.RemessaRetorno.criar"
                    data-context-required="true"
                    data-sensitive
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Gerar Remessa
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            <Card>
              <CardHeader className="bg-slate-50 border-b">
                <CardTitle>Títulos Aptos para Remessa ({titulosAptosRemessa.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="w-12">
                        <Checkbox
                          checked={titulosSelecionados.length === titulosAptosRemessa.length && titulosAptosRemessa.length > 0}
                          onCheckedChange={(checked) => {
                            setTitulosSelecionados(checked ? titulosAptosRemessa.map(t => t.id) : []);
                          }}
                          disabled={!contextoValido || !podeGerarRemessa}
                        />
                      </TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Canal Origem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {titulosAptosRemessa.map(titulo => (
                      <TableRow key={titulo.id}>
                        <TableCell>
                          <Checkbox
                            checked={titulosSelecionados.includes(titulo.id)}
                            onCheckedChange={() => {
                              setTitulosSelecionados(prev =>
                                prev.includes(titulo.id)
                                  ? prev.filter(id => id !== titulo.id)
                                  : [...prev, titulo.id]
                              );
                            }}
                            disabled={!contextoValido || !podeGerarRemessa}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{titulo.cliente}</TableCell>
                        <TableCell className="max-w-xs truncate">{titulo.descricao}</TableCell>
                        <TableCell>{new Date(titulo.data_vencimento).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell className="font-bold">
                          R$ {(titulo.valor || 0).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {titulo.canal_origem || 'Manual'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {titulosAptosRemessa.length === 0 && (
                  <div className="text-center py-12 text-slate-500">
                    <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p>Nenhum título apto para remessa</p>
                    <p className="text-xs mt-2">Títulos devem ter forma de cobrança "Boleto"</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA: PROCESSAR RETORNO */}
          <TabsContent value="retorno" className="space-y-4">
            <Card>
              <CardHeader className="bg-green-50 border-b">
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-green-600" />
                  Importar Arquivo de Retorno CNAB
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <Alert className="border-blue-300 bg-blue-50">
                    <AlertDescription>
                      <p className="font-semibold text-blue-900 mb-2">ℹ️ Como funciona:</p>
                      <ul className="text-sm text-blue-700 space-y-1 list-disc ml-5">
                        <li>Faça upload do arquivo retorno (.RET) recebido do banco</li>
                        <li>O sistema processará automaticamente as ocorrências</li>
                        <li>Títulos pagos serão baixados automaticamente</li>
                        <li>Confirmações de registro também serão processadas</li>
                      </ul>
                    </AlertDescription>
                  </Alert>

                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-12 text-center hover:border-green-500 transition-colors">
                    <Upload className="w-16 h-16 mx-auto text-slate-400 mb-4" />
                    <p className="text-slate-600 mb-4">
                      Arraste o arquivo de retorno ou clique para selecionar
                    </p>
                    <Input
                      type="file"
                      accept=".ret,.RET,.txt,.TXT"
                      onChange={handleFileUpload}
                      className="max-w-xs mx-auto"
                      disabled={processandoRetorno || !contextoValido || !podeProcessarRetorno}
                      data-action="GestaoRemessaRetorno.processar_retorno"
                      data-permission="Financeiro.RemessaRetorno.editar"
                      data-context-required="true"
                      data-sensitive
                    />
                    {processandoRetorno && (
                      <div className="mt-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                        <p className="text-sm text-slate-600 mt-2">Processando arquivo...</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA: HISTÓRICO */}
          <TabsContent value="historico" className="space-y-4">
            <Card>
              <CardHeader className="bg-slate-50 border-b">
                <CardTitle>Histórico de Arquivos CNAB</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Tipo</TableHead>
                      <TableHead>Banco</TableHead>
                      <TableHead>Nº Arquivo</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Qtd Títulos</TableHead>
                      <TableHead>Valor Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {arquivos.map(arquivo => (
                      <TableRow key={arquivo.id}>
                        <TableCell>
                          <Badge className={arquivo.tipo_arquivo === 'Remessa' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}>
                            {arquivo.tipo_arquivo}
                          </Badge>
                        </TableCell>
                        <TableCell>{arquivo.banco_nome}</TableCell>
                        <TableCell>{arquivo.numero_arquivo}</TableCell>
                        <TableCell className="text-sm">
                          {new Date(arquivo.data_geracao).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell>{arquivo.quantidade_titulos}</TableCell>
                        <TableCell className="font-bold">
                          R$ {(arquivo.valor_total || 0).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{arquivo.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const blob = new Blob([arquivo.conteudo_arquivo], { type: 'text/plain' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = arquivo.arquivo_nome;
                              a.click();
                            }}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Baixar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {arquivos.length === 0 && (
                  <div className="text-center py-12 text-slate-500">
                    <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p>Nenhum arquivo processado ainda</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* DIALOG: GERAR REMESSA */}
        <Dialog open={dialogRemessa} onOpenChange={setDialogRemessa}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Send className="w-5 h-5 text-blue-600" />
                Gerar Arquivo de Remessa
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <Card className="bg-blue-50">
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-slate-600">Títulos Selecionados:</p>
                      <p className="font-bold text-lg">{titulosSelecionados.length}</p>
                    </div>
                    <div>
                      <p className="text-slate-600">Valor Total:</p>
                      <p className="font-bold text-lg text-blue-600">
                        R$ {valorTotalSelecionado.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div>
                <Label>Banco *</Label>
                <Select value={bancoSelecionado} onValueChange={setBancoSelecionado} disabled={!contextoValido || !podeGerarRemessa || gerarRemessaMutation.isPending}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o banco..." />
                  </SelectTrigger>
                  <SelectContent>
                    {bancos.map(banco => (
                      <SelectItem key={banco.id} value={banco.id}>
                        {banco.codigo} - {banco.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setDialogRemessa(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    if (!bancoSelecionado) {
                      toast.error("Selecione um banco");
                      return;
                    }
                    if (!window.confirm(`Gerar remessa com ${titulosSelecionados.length} titulo(s) selecionado(s)?`)) {
                      auditarCNAB({ acao: 'Cancelamento', descricao: 'Usuario cancelou geracao de remessa CNAB.', dadosNovos: { titulosSelecionados, bancoSelecionado }, sucesso: false });
                      return;
                    }
                    gerarRemessaMutation.mutate({
                      bancoId: bancoSelecionado,
                      titulosIds: titulosSelecionados
                    });
                  }}
                  disabled={!contextoValido || !podeGerarRemessa || gerarRemessaMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                  data-action="GestaoRemessaRetorno.gerar_remessa"
                  data-permission="Financeiro.RemessaRetorno.criar"
                  data-context-required="true"
                  data-sensitive
                >
                  <Download className="w-4 h-4 mr-2" />
                  {gerarRemessaMutation.isPending ? 'Gerando...' : 'Gerar e Baixar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
