import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Download, Filter, BarChart3, FileText, Table as TableIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const sanitizeText = (value) => String(value ?? "").replace(/[<>]/g, "").replace(/javascript:/gi, "").replace(/\r?\n/g, " ").trim();
const sanitizeCsvCell = (value) => {
  const sanitized = sanitizeText(typeof value === "object" ? JSON.stringify(value) : value);
  return sanitized.includes(",") || sanitized.includes('"') ? `"${sanitized.replace(/"/g, '""')}"` : sanitized;
};

export default function RelatorioPersonalizado() {
  const [config, setConfig] = useState({
    entidade: 'Pedido',
    tipo_visualizacao: 'tabela',
    campos: [],
    filtros: {},
    agrupamento: '',
    data_inicio: '',
    data_fim: '',
    ordenacao: '-created_date'
  });

  const [showConfig, setShowConfig] = useState(true);
  const { filterInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { user } = useUser();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextKey = empresaId || groupId || "sem-contexto";
  const contextoValido = contextKey !== "sem-contexto";
  const canViewRelatorio = hasPermission("Relatorios", "Personalizado", "visualizar") ||
    hasPermission("Relat�rios", "Personalizado", "visualizar") ||
    hasPermission("Relatorios", null, "visualizar");
  const canExportRelatorio = hasPermission("Relatorios", "Personalizado", "exportar") ||
    hasPermission("Relat�rios", "Personalizado", "exportar") ||
    hasPermission("Relatorios", null, "exportar");

  const entidadesDisponiveis = [
    { value: 'Pedido', label: 'Pedidos', campos: ['numero_pedido', 'cliente_nome', 'vendedor', 'valor_total', 'status', 'data_pedido'] },
    { value: 'Cliente', label: 'Clientes', campos: ['nome', 'tipo', 'cidade', 'estado', 'status', 'limite_credito'] },
    { value: 'Produto', label: 'Produtos', campos: ['codigo', 'descricao', 'grupo', 'estoque_atual', 'preco_venda', 'custo_aquisicao'] },
    { value: 'ContaReceber', label: 'Contas a Receber', campos: ['cliente', 'valor', 'data_vencimento', 'status', 'forma_recebimento'] },
    { value: 'ContaPagar', label: 'Contas a Pagar', campos: ['fornecedor', 'valor', 'data_vencimento', 'status', 'categoria'] },
    { value: 'NotaFiscal', label: 'Notas Fiscais', campos: ['numero', 'tipo', 'cliente_fornecedor', 'valor_total', 'status', 'data_emissao'] },
    { value: 'Oportunidade', label: 'Oportunidades CRM', campos: ['titulo', 'cliente_nome', 'etapa', 'valor_estimado', 'probabilidade', 'responsavel'] },
  ];

  const entidadeAtual = entidadesDisponiveis.find(e => e.value === config.entidade);

  const { data: dados = [], isLoading } = useQuery({
    queryKey: ['relatorio', config, contextKey],
    queryFn: async () => {
      let query = {};
      
      // Aplicar filtros de data
      if (config.data_inicio) {
        query.created_date = { $gte: config.data_inicio };
      }
      if (config.data_fim) {
        if (query.created_date) {
          query.created_date.$lte = config.data_fim;
        } else {
          query.created_date = { $lte: config.data_fim };
        }
      }

      // Aplicar outros filtros
      Object.keys(config.filtros).forEach(campo => {
        if (config.filtros[campo]) {
          query[campo] = config.filtros[campo];
        }
      });

      const data = await filterInContext(config.entidade,
        query,
        config.ordenacao,
        1000
      );

      return data;
    },
    enabled: !showConfig && contextoValido && canViewRelatorio,
  });

  const handleToggleCampo = (campo) => {
    setConfig(prev => ({
      ...prev,
      campos: prev.campos.includes(campo)
        ? prev.campos.filter(c => c !== campo)
        : [...prev.campos, campo]
    }));
  };


  const auditarExportacao = async ({ formato, sucesso = true, motivo = null }) => {
    try {
      await base44.entities.AuditLog.create({
        acao: sucesso ? "Exportacao" : "Bloqueio",
        modulo: "Relatorios",
        entidade: "RelatorioPersonalizado",
        descricao: sucesso ? `Exportacao ${formato} do relatorio personalizado` : (motivo || `Bloqueio de exportacao ${formato} do relatorio personalizado`),
        usuario_id: user?.id || null,
        usuario: user?.full_name || user?.email || "Usuario local",
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId,
        tipo_auditoria: sucesso ? "operacional" : "seguranca",
        dados_novos: { entidade: config.entidade, campos: config.campos, filtros: config.filtros, quantidade: dados.length, contextKey },
        sucesso,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn("Falha ao auditar exportacao personalizada:", error);
    }
  };
  const handleExportarCSV = async (formato = "CSV") => {
    if (!contextoValido || !canExportRelatorio) {
      await auditarExportacao({ formato, sucesso: false, motivo: "Tentativa de exportar relatorio personalizado sem contexto grupo/empresa ou permissao RBAC." });
      return false;
    }
    if (!dados.length) {
      await auditarExportacao({ formato, sucesso: false, motivo: "Tentativa de exportar relatorio personalizado sem dados." });
      return false;
    }
    const confirmado = window.confirm(`Exportar ${dados.length} registros do relatorio personalizado para ${formato}?`);
    if (!confirmado) {
      await auditarExportacao({ formato, sucesso: false, motivo: "Exportacao do relatorio personalizado cancelada pelo usuario." });
      return false;
    }

    const camposExport = config.campos.length > 0 ? config.campos : entidadeAtual.campos;
    const csvHeader = [...camposExport, "group_id", "grupo_id", "empresa_id"].join(',');
    const csvRows = dados.map(item =>
      [...camposExport.map(campo => sanitizeCsvCell(item[campo])), groupId || '', groupId || '', empresaId || ''].join(',')
    );

    const csv = [csvHeader, ...csvRows].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio_${sanitizeText(config.entidade)}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    await auditarExportacao({ formato, sucesso: true });
    return true;
  };

  const handleExportarExcel = async () => {
    const exportado = await handleExportarCSV("Excel");
    if (exportado) alert('Para exportar para Excel real, integre com biblioteca xlsx');
  };

  const processarDadosGrafico = () => {
    if (!config.agrupamento || !dados.length) return [];

    const agrupado = {};
    dados.forEach(item => {
      const chave = item[config.agrupamento] || 'Sem Informação';
      if (!agrupado[chave]) {
        agrupado[chave] = { nome: chave, valor: 0, quantidade: 0 };
      }
      agrupado[chave].quantidade++;
      if (item.valor_total) agrupado[chave].valor += item.valor_total;
      if (item.valor) agrupado[chave].valor += item.valor;
    });

    return Object.values(agrupado);
  };

  const dadosGrafico = processarDadosGrafico();

  const renderVisualizacao = () => {
    if (isLoading) {
      return <div className="text-center py-12">Carregando dados...</div>;
    }

    if (!dados.length) {
      return <div className="text-center py-12 text-slate-500">Nenhum dado encontrado</div>;
    }

    const camposExibir = config.campos.length > 0 ? config.campos : entidadeAtual.campos;

    switch (config.tipo_visualizacao) {
      case 'tabela':
        return (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  {camposExibir.map(campo => (
                    <TableHead key={campo} className="capitalize">
                      {campo.replace(/_/g, ' ')}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {dados.map((item, idx) => (
                  <TableRow key={item.id || idx}>
                    {camposExibir.map(campo => (
                      <TableCell key={campo}>
                        {typeof item[campo] === 'number' && campo.includes('valor') 
                          ? `R$ ${item[campo].toFixed(2)}`
                          : item[campo] || '-'
                        }
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );

      case 'grafico_barras':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={dadosGrafico}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="nome" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="quantidade" fill="#3b82f6" name="Quantidade" />
              {dadosGrafico[0]?.valor && <Bar dataKey="valor" fill="#10b981" name="Valor (R$)" />}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'grafico_pizza':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={dadosGrafico}
                dataKey="quantidade"
                nameKey="nome"
                cx="50%"
                cy="50%"
                outerRadius={120}
                label
              >
                {dadosGrafico.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'grafico_linha':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={dadosGrafico}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="nome" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="quantidade" stroke="#3b82f6" name="Quantidade" />
              {dadosGrafico[0]?.valor && <Line type="monotone" dataKey="valor" stroke="#10b981" name="Valor (R$)" />}
            </LineChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 w-full h-full" data-permission="Relatorios.Personalizado.visualizar" data-context-required="group-or-company">
      <Card>
        <CardHeader>
          {(!contextoValido || !canViewRelatorio) && (
            <Alert className="mb-4 border-amber-300 bg-amber-50">
              <AlertDescription>Selecione grupo ou empresa e confirme permissao para visualizar relatorios personalizados.</AlertDescription>
            </Alert>
          )}
          <div className="flex items-center justify-between">
            <CardTitle>Relatório Personalizado</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowConfig(!showConfig)}>
                <Filter className="w-4 h-4 mr-2" />
                {showConfig ? 'Ocultar' : 'Mostrar'} Configurações
              </Button>
              {!showConfig && (
                <>
                  <Button variant="outline" size="sm" onClick={() => handleExportarCSV("CSV")} disabled={!contextoValido || !canExportRelatorio || !dados.length} data-action="RelatorioPersonalizado.exportarCSV" data-permission="Relatorios.Personalizado.exportar" data-context-required="group-or-company" data-sensitive="true">
                    <Download className="w-4 h-4 mr-2" />
                    CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportarExcel} disabled={!contextoValido || !canExportRelatorio || !dados.length} data-action="RelatorioPersonalizado.exportarExcel" data-permission="Relatorios.Personalizado.exportar" data-context-required="group-or-company" data-sensitive="true">
                    <FileText className="w-4 h-4 mr-2" />
                    Excel
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>

        {showConfig && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label>Entidade</Label>
                <Select value={config.entidade} onValueChange={(value) => {
                  setConfig({ ...config, entidade: value, campos: [], filtros: {} });
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {entidadesDisponiveis.map(ent => (
                      <SelectItem key={ent.value} value={ent.value}>
                        {ent.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Tipo de Visualização</Label>
                <Select value={config.tipo_visualizacao} onValueChange={(value) => {
                  setConfig({ ...config, tipo_visualizacao: value });
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tabela">
                      <TableIcon className="w-4 h-4 inline mr-2" />
                      Tabela
                    </SelectItem>
                    <SelectItem value="grafico_barras">
                      <BarChart3 className="w-4 h-4 inline mr-2" />
                      Gráfico de Barras
                    </SelectItem>
                    <SelectItem value="grafico_pizza">
                      <BarChart3 className="w-4 h-4 inline mr-2" />
                      Gráfico de Pizza
                    </SelectItem>
                    <SelectItem value="grafico_linha">
                      <BarChart3 className="w-4 h-4 inline mr-2" />
                      Gráfico de Linha
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {config.tipo_visualizacao !== 'tabela' && (
                <div>
                  <Label>Agrupar por</Label>
                  <Select value={config.agrupamento} onValueChange={(value) => {
                    setConfig({ ...config, agrupamento: value });
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {entidadeAtual?.campos.map(campo => (
                        <SelectItem key={campo} value={campo}>
                          {campo.replace(/_/g, ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={config.data_inicio}
                  onChange={(e) => setConfig({ ...config, data_inicio: e.target.value })}
                />
              </div>

              <div>
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={config.data_fim}
                  onChange={(e) => setConfig({ ...config, data_fim: e.target.value })}
                />
              </div>
            </div>

            {config.tipo_visualizacao === 'tabela' && (
              <div>
                <Label className="mb-3 block">Campos para Exibir</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {entidadeAtual?.campos.map(campo => (
                    <div key={campo} className="flex items-center gap-2">
                      <Checkbox
                        checked={config.campos.includes(campo)}
                        onCheckedChange={() => handleToggleCampo(campo)}
                      />
                      <Label className="capitalize cursor-pointer">
                        {campo.replace(/_/g, ' ')}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4">
              <Button onClick={() => setShowConfig(false)} disabled={!contextoValido || !canViewRelatorio} data-action="RelatorioPersonalizado.gerar" data-permission="Relatorios.Personalizado.visualizar" data-context-required="group-or-company">
                Gerar Relatório
              </Button>
            </div>
          </CardContent>
        )}

        {!showConfig && (
          <CardContent>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <Badge variant="outline" className="mr-2">{entidadeAtual?.label}</Badge>
                <Badge variant="outline">{dados.length} registro(s)</Badge>
              </div>
            </div>
            {renderVisualizacao()}
          </CardContent>
        )}
      </Card>
    </div>
  );
}