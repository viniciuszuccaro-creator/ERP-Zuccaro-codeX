import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle, Package, Download } from "lucide-react";
import ProtectedField from "@/components/security/ProtectedField";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import ExportButton from "@/components/ExportButton";
import { base44 } from "@/api/base44Client";

export default function RelatoriosEstoque({ produtos, movimentacoes }) {
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const canViewRelatorios = hasPermission('Estoque', 'Relatorios', 'visualizar') ||
    hasPermission('Estoque', null, 'visualizar');
  const canExportRelatorios = hasPermission('Estoque', 'Relatorios', 'exportar') ||
    hasPermission('Estoque', null, 'exportar');

  const auditRelatorioEstoque = async ({ acao, sucesso = true, motivo = null, detalhes = {} }) => {
    try {
      await base44.entities.AuditLog.create({
        acao,
        modulo: 'Estoque',
        entidade: 'RelatoriosEstoque',
        tipo_auditoria: sucesso ? 'relatorio' : 'seguranca',
        descricao: motivo || 'Auditoria dos relatorios de estoque.',
        dados_novos: detalhes,
        group_id: groupId,
        grupo_id: groupId,
        empresa_id: empresaId,
        sucesso,
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('Falha ao auditar relatorios de estoque:', error);
    }
  };

  const pertenceAoContexto = (item = {}) => {
    if (!contextoValido) return false;
    if (empresaId) {
      return item.empresa_id === empresaId ||
        item.empresa_dona_id === empresaId ||
        item.group_id === groupId ||
        item.grupo_id === groupId ||
        item.compartilhado_grupo === true;
    }
    return item.group_id === groupId ||
      item.grupo_id === groupId ||
      item.compartilhado_grupo === true ||
      item.origem === 'grupo';
  };

  const produtosFiltrados = Array.isArray(produtos) && canViewRelatorios
    ? produtos.filter(pertenceAoContexto)
    : [];
  const movimentacoesFiltradas = Array.isArray(movimentacoes) && canViewRelatorios
    ? movimentacoes.filter(pertenceAoContexto)
    : [];
  const produtosComValor = produtosFiltrados.map(p => {
    const valorEstoque = (p.estoque_atual || 0) * (p.custo_aquisicao || 0);
    const valorMovimentado = movimentacoesFiltradas
      .filter(m => m.produto_id === p.id)
      .reduce((sum, m) => sum + (m.valor_total || 0), 0);
    
    return {
      ...p,
      valor_estoque: valorEstoque,
      valor_movimentado: valorMovimentado
    };
  });

  const ordenadoPorValor = [...produtosComValor].sort((a, b) => b.valor_estoque - a.valor_estoque);
  const valorTotal = ordenadoPorValor.reduce((sum, p) => sum + p.valor_estoque, 0);
  
  let acumulado = 0;
  const classificacaoABC = ordenadoPorValor.map(produto => {
    acumulado += produto.valor_estoque;
    const percentualAcumulado = valorTotal > 0 ? (acumulado / valorTotal) * 100 : 0;
    
    let classe = "C";
    if (percentualAcumulado <= 80) classe = "A";
    else if (percentualAcumulado <= 95) classe = "B";
    
    return {
      ...produto,
      classe_abc: classe,
      percentual_valor: valorTotal > 0 ? ((produto.valor_estoque / valorTotal) * 100).toFixed(2) : 0
    };
  });

  const hoje = new Date();
  const itensParados = produtosFiltrados.filter(p => {
    const ultimaMov = movimentacoesFiltradas
      .filter(m => m.produto_id === p.id)
      .sort((a, b) => new Date(b.data_movimentacao) - new Date(a.data_movimentacao))[0];
    
    if (!ultimaMov) return true;
    
    const diasParado = Math.floor((hoje - new Date(ultimaMov.data_movimentacao)) / (1000 * 60 * 60 * 24));
    return diasParado > 90;
  });

  const produtosComGiro = produtosFiltrados.map(p => {
    const totalSaidas = movimentacoesFiltradas
      .filter(m => m.produto_id === p.id && m.tipo_movimento === "saida")
      .reduce((sum, m) => sum + (m.quantidade || 0), 0);
    
    const estoqueMedio = p.estoque_atual || 1;
    const giro = estoqueMedio > 0 ? totalSaidas / estoqueMedio : 0;
    
    return {
      ...p,
      giro_estoque: giro.toFixed(2),
      total_saidas: totalSaidas
    };
  }).sort((a, b) => parseFloat(b.giro_estoque) - parseFloat(a.giro_estoque));

  const withContext = (row = {}) => ({
    ...row,
    group_id: groupId || '',
    grupo_id: groupId || '',
    empresa_id: empresaId || '',
  });

  const exportABC = classificacaoABC.slice(0, 100).map((produto) => withContext({
    classe: produto.classe_abc,
    produto: produto.descricao,
    estoque_atual: produto.estoque_atual || 0,
    valor_estoque: Number(produto.valor_estoque || 0).toFixed(2),
    percentual_valor: produto.percentual_valor,
  }));

  const exportGiro = produtosComGiro.slice(0, 200).map((produto) => withContext({
    produto: produto.descricao,
    estoque_atual: produto.estoque_atual || 0,
    total_saidas: produto.total_saidas || 0,
    giro_estoque: produto.giro_estoque,
  }));

  const exportParados = itensParados.map((produto) => withContext({
    produto: produto.descricao,
    grupo: produto.grupo || produto.grupo_produto_nome || '',
    estoque_atual: produto.estoque_atual || 0,
    valor_imobilizado: Number((produto.estoque_atual || 0) * (produto.custo_aquisicao || 0)).toFixed(2),
    acao_sugerida: 'Revisar',
  }));

  const beforeExportRelatorio = (tipo, rows) => async (formato) => {
    if (!contextoValido || !canExportRelatorios) {
      await auditRelatorioEstoque({
        acao: 'RelatoriosEstoque.exportar_bloqueado',
        sucesso: false,
        motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada',
        detalhes: { tipo, formato, linhas: rows.length },
      });
      return false;
    }

    const confirmado = window.confirm(`Confirma exportar ${rows.length} linhas do relatorio de estoque (${tipo}) em ${String(formato).toUpperCase()}?`);
    if (!confirmado) {
      await auditRelatorioEstoque({
        acao: 'RelatoriosEstoque.exportar_cancelado',
        sucesso: false,
        motivo: 'confirmacao_cancelada',
        detalhes: { tipo, formato, linhas: rows.length },
      });
      return false;
    }

    await auditRelatorioEstoque({
      acao: 'RelatoriosEstoque.exportar',
      detalhes: { tipo, formato, linhas: rows.length, produtos: produtosFiltrados.length, movimentacoes: movimentacoesFiltradas.length },
    });
    return true;
  };
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b'];

  const countABC = {
    A: classificacaoABC.filter(p => p.classe_abc === "A").length,
    B: classificacaoABC.filter(p => p.classe_abc === "B").length,
    C: classificacaoABC.filter(p => p.classe_abc === "C").length
  };
  const dadosABC = [
    { classe: 'A', quantidade: countABC.A, cor: '#3b82f6' },
    { classe: 'B', quantidade: countABC.B, cor: '#10b981' },
    { classe: 'C', quantidade: countABC.C, cor: '#f59e0b' }
  ];

  return (
    <div
      className="space-y-6 w-full h-full"
      data-permission="Estoque.Relatorios.visualizar"
      data-context-required="group-or-company"
      data-context-mode={contexto}
    >
      {(!contextoValido || !canViewRelatorios) && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-900">
            Selecione grupo ou empresa e confirme permissao para visualizar relatorios de estoque.
          </CardContent>
        </Card>
      )}
      <Tabs defaultValue="abc">
        <TabsList className="bg-white border flex-wrap h-auto">
          <TabsTrigger value="abc">
            <TrendingUp className="w-4 h-4 mr-2" />
            Curva ABC
          </TabsTrigger>
          <TabsTrigger value="giro">
            <TrendingDown className="w-4 h-4 mr-2" />
            Giro de Estoque
          </TabsTrigger>
          <TabsTrigger value="parados">
            <AlertCircle className="w-4 h-4 mr-2" />
            Itens Parados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="abc" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="bg-slate-50 border-b">
                <CardTitle className="text-base">Distribuição ABC</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={dadosABC}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ classe, quantidade }) => `${classe}: ${quantidade}`}
                      outerRadius={90}
                      dataKey="quantidade"
                    >
                      {dadosABC.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.cor} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="bg-slate-50 border-b">
                <CardTitle className="text-base">Regra 80-20 (Pareto)</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
                    <div>
                      <p className="font-semibold text-blue-900">Classe A</p>
                      <p className="text-sm text-blue-700">80% do valor</p>
                    </div>
                    <Badge className="bg-blue-600 text-white text-xl px-4 py-2">
                      {countABC.A}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded">
                    <div>
                      <p className="font-semibold text-green-900">Classe B</p>
                      <p className="text-sm text-green-700">15% do valor</p>
                    </div>
                    <Badge className="bg-green-600 text-white text-xl px-4 py-2">
                      {countABC.B}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-orange-50 rounded">
                    <div>
                      <p className="font-semibold text-orange-900">Classe C</p>
                      <p className="text-sm text-orange-700">5% do valor</p>
                    </div>
                    <Badge className="bg-orange-600 text-white text-xl px-4 py-2">
                      {countABC.C}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="bg-slate-50 border-b">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">Top 20 Produtos (Classe A/B)</CardTitle>
                <ExportButton
                  data={exportABC}
                  filename="estoque-curva-abc"
                  disabled={!contextoValido || !canExportRelatorios}
                  onBeforeExport={beforeExportRelatorio('curva_abc', exportABC)}
                  data-permission="Estoque.Relatorios.exportar"
                  data-action="RelatoriosEstoque.exportar_abc"
                  data-context-required="group-or-company"
                  data-sensitive="true"
                >
                  <Download className="w-4 h-4 mr-2" /> Exportar
                </ExportButton>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Classe</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Estoque</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">% do Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classificacaoABC.slice(0, 20).map((produto, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Badge className={
                          produto.classe_abc === "A" ? "bg-blue-600" :
                          produto.classe_abc === "B" ? "bg-green-600" :
                          "bg-orange-600"
                        }>
                          {produto.classe_abc}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{produto.descricao}</TableCell>
                      <TableCell className="text-right">{produto.estoque_atual}</TableCell>
                      <TableCell className="text-right font-semibold">
                        <ProtectedField module="Estoque" submodule="Relatorios" field="valor_estoque" action="ver" asText>
                          R$ {produto.valor_estoque.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </ProtectedField>
                      </TableCell>
                      <TableCell className="text-right">{produto.percentual_valor}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="giro">
          <Card>
            <CardHeader className="bg-slate-50 border-b">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">Giro de Estoque (Ordenado)</CardTitle>
                <ExportButton
                  data={exportGiro}
                  filename="estoque-giro"
                  disabled={!contextoValido || !canExportRelatorios}
                  onBeforeExport={beforeExportRelatorio('giro_estoque', exportGiro)}
                  data-permission="Estoque.Relatorios.exportar"
                  data-action="RelatoriosEstoque.exportar_giro"
                  data-context-required="group-or-company"
                  data-sensitive="true"
                >
                  <Download className="w-4 h-4 mr-2" /> Exportar
                </ExportButton>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Estoque Atual</TableHead>
                    <TableHead className="text-right">Total Saídas</TableHead>
                    <TableHead className="text-right">Giro (vezes)</TableHead>
                    <TableHead>Performance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {produtosComGiro.slice(0, 30).map((produto, idx) => {
                    const giro = parseFloat(produto.giro_estoque);
                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{produto.descricao}</TableCell>
                        <TableCell className="text-right">{produto.estoque_atual}</TableCell>
                        <TableCell className="text-right">{produto.total_saidas}</TableCell>
                        <TableCell className="text-right font-bold text-blue-600">
                          {produto.giro_estoque}x
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            giro >= 5 ? "bg-green-600" :
                            giro >= 2 ? "bg-blue-600" :
                            giro >= 1 ? "bg-yellow-600" :
                            "bg-red-600"
                          }>
                            {giro >= 5 ? "Excelente" :
                             giro >= 2 ? "Bom" :
                             giro >= 1 ? "Regular" :
                             "Baixo"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parados">
          <Card>
            <CardHeader className="bg-red-50 border-b">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  Itens sem Movimento (+90 dias) - {itensParados.length} produtos
                </CardTitle>
                <ExportButton
                  data={exportParados}
                  filename="estoque-itens-parados"
                  disabled={!contextoValido || !canExportRelatorios}
                  onBeforeExport={beforeExportRelatorio('itens_parados', exportParados)}
                  data-permission="Estoque.Relatorios.exportar"
                  data-action="RelatoriosEstoque.exportar_parados"
                  data-context-required="group-or-company"
                  data-sensitive="true"
                >
                  <Download className="w-4 h-4 mr-2" /> Exportar
                </ExportButton>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Produto</TableHead>
                    <TableHead>Grupo</TableHead>
                    <TableHead className="text-right">Estoque</TableHead>
                    <TableHead className="text-right">Valor Imobilizado</TableHead>
                    <TableHead>Ação Sugerida</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itensParados.map(produto => (
                    <TableRow key={produto.id} className="bg-red-50/30">
                      <TableCell className="font-medium">{produto.descricao}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{produto.grupo}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{produto.estoque_atual}</TableCell>
                      <TableCell className="text-right font-semibold text-red-700">
                        <ProtectedField module="Estoque" submodule="Relatorios" field="valor_imobilizado" action="ver" asText>
                          R$ {((produto.estoque_atual || 0) * (produto.custo_aquisicao || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </ProtectedField>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-orange-600 text-white">Revisar</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {itensParados.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500 opacity-50" />
                  <p className="text-green-700 font-semibold">Nenhum item parado!</p>
                  <p className="text-sm">Todo o estoque está em movimento</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
