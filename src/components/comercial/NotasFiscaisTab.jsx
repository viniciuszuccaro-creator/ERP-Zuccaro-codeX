import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea"; // Added Textarea
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";


import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  Plus,
  Search,
  FileText,
  Download,
  Eye,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  X,
  XCircle,
  Edit,
  Printer
} from "lucide-react";
import GerarNFeModal from "./GerarNFeModal";
import useContextoVisual from "@/components/lib/useContextoVisual";
import { mockCancelarNFe } from "@/components/integracoes/MockIntegracoes";
import usePermissions from "@/components/lib/usePermissions";
import { ProtectedAction } from "@/components/ProtectedAction";
import { ImprimirDANFESimplificado } from "@/components/lib/impressao";
import ERPDataTable from "@/components/ui/erp/DataTable";
import usePersistedSort from "@/components/lib/usePersistedSort";
import useEntityListSorted from "@/components/lib/useEntityListSorted";
import useBackendPagination from "@/components/lib/useBackendPagination";
import { sanitizeOnWrite } from "@/components/lib/sanitizeOnWrite";

export default function NotasFiscaisTab({ notasFiscais, pedidos, clientes, onCreateNFe }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todas");
  const [tipoFilter, setTipoFilter] = useState("todas");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedNF, setSelectedNF] = useState(null);
  const [viewingDetails, setViewingDetails] = useState(null);
  // Seleção em massa + exportação
  const [selectedNotas, setSelectedNotas] = useState([]);
  const toggleNota = (id) => setSelectedNotas(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAllNotas = (checked, lista) => setSelectedNotas(checked ? lista.map(n => n.id) : []);

  // Paginação e ordenação persistente (backend)
  const { page, setPage, pageSize, setPageSize } = useBackendPagination('NotaFiscal', 20);
  const [sortField, setSortField, sortDirection, setSortDirection] = usePersistedSort('NotaFiscal', 'data_emissao', 'desc');
  const { data: notasBackend = [] } = useEntityListSorted('NotaFiscal', {}, { sortField, sortDirection, page, pageSize, limit: pageSize });
  const notasList = Array.isArray(notasFiscais) && notasFiscais.length ? notasFiscais : notasBackend;

  const exportarNotasCSV = (lista) => {
    const headers = ['numero','serie','tipo','cliente_fornecedor','empresa_id','data_emissao','valor_total','status'];
    const csv = [
      headers.join(','),
      ...lista.map(n => headers.map(h => JSON.stringify(n[h] ?? '')).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notas_fiscais_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { empresaAtual, empresasDoGrupo, grupoAtual, createInContext, updateInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const canCreateNota = hasPermission('Fiscal', 'NotaFiscal', 'criar') || hasPermission('Fiscal', 'Notas Fiscais', 'criar') || hasPermission('Fiscal', null, 'criar');
  const canEditNota = hasPermission('Fiscal', 'NotaFiscal', 'editar') || hasPermission('Fiscal', 'Notas Fiscais', 'editar') || hasPermission('Fiscal', null, 'editar');
  const canCancelNota = hasPermission('Fiscal', 'NotaFiscal', 'cancelar') || hasPermission('Fiscal', 'Notas Fiscais', 'cancelar') || hasPermission('Fiscal', null, 'cancelar');
  const sanitizeFiscalText = (value) => String(value || '').replace(/[<>]/g, '').replace(/javascript:/gi, '').trim();
  const withFiscalContext = (payload = {}) => ({
    ...payload,
    ...(empresaId ? { empresa_id: empresaId, empresa_faturamento_id: payload.empresa_faturamento_id || empresaId } : {}),
    ...(groupId ? { group_id: groupId, grupo_id: groupId } : {}),
  });
  const auditFiscalComercial = async (acao, detalhes = {}, sucesso = true) => {
    try {
      const usuario = await base44.auth.me().catch(() => null);
      await base44.entities.AuditLog.create({
        usuario_id: usuario?.id || null,
        usuario: usuario?.full_name || usuario?.email || 'Sistema',
        acao,
        modulo: 'Comercial/Fiscal',
        tipo_auditoria: sucesso ? 'operacional' : 'seguranca',
        entidade: detalhes.entidade || 'NotaFiscal',
        descricao: detalhes.descricao || acao,
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId,
        sucesso,
        detalhes: { origem: 'NotasFiscaisTab', ...detalhes },
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('Falha ao auditar nota fiscal comercial:', error);
    }
  };

  const [formData, setFormData] = useState({
    tipo: "NF-e (Saída)",
    cliente_fornecedor: "",
    numero: "",
    serie: "1",
    data_emissao: new Date().toISOString().split('T')[0],
    valor_produtos: 0,
    valor_total: 0,
    observacoes: ""
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      if (!contextoValido || !canCreateNota || !empresaId) {
        await auditFiscalComercial('nota_fiscal_criar_bloqueada', { motivo: !empresaId ? 'empresa_faturadora_obrigatoria' : 'contexto_ou_permissao' }, false);
        throw new Error('Selecione uma empresa faturadora e confirme permissao para criar NF-e.');
      }
      return createInContext('NotaFiscal', withFiscalContext(data));
    },
    onError: (error) => {
      toast({ title: error.message || 'Falha ao criar Nota Fiscal', variant: 'destructive' });
    },
    onSuccess: async () => {
      await auditFiscalComercial('nota_fiscal_criada', { entidade: 'NotaFiscal' }, true);
      queryClient.invalidateQueries({ queryKey: ['notasfiscais'] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: 'Nota Fiscal criada!' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      if (!contextoValido || !canEditNota) {
        await auditFiscalComercial('nota_fiscal_editar_bloqueada', { motivo: 'contexto_ou_permissao', nota_id: id }, false);
        throw new Error('Sem contexto ou permissao para editar NF-e.');
      }
      return updateInContext('NotaFiscal', id, withFiscalContext(data));
    },
    onError: (error) => {
      toast({ title: error.message || 'Falha ao atualizar Nota Fiscal', variant: 'destructive' });
    },
    onSuccess: async () => {
      await auditFiscalComercial('nota_fiscal_atualizada', { entidade: 'NotaFiscal', nota_id: selectedNF?.id || null }, true);
      queryClient.invalidateQueries({ queryKey: ['notasfiscais'] });
      setIsDialogOpen(false);
      setSelectedNF(null); // Changed from setEditingNota
      resetForm();
      toast({ title: 'Nota Fiscal atualizada!' });
    },
  });

  const cancelarNFeMutation = useMutation({
    mutationFn: async ({ nfe, motivo }) => {
      if (!contextoValido || !canCancelNota) {
        await auditFiscalComercial('nota_fiscal_cancelar_bloqueada', { motivo: 'contexto_ou_permissao', nota_id: nfe?.id }, false);
        throw new Error('Sem contexto ou permissao para cancelar NF-e.');
      }
      const motivoSanitizado = sanitizeFiscalText(motivo);
      // Mock: Cancelamento simulado
      const resultado = await mockCancelarNFe({
        nfe_id: nfe.id,
        chave_acesso: nfe.chave_acesso,
        motivo: motivoSanitizado
      });

      // Atualizar NF-e
      await updateInContext('NotaFiscal', nfe.id, withFiscalContext({
        status: "Cancelada",
        cancelamento: {
          data_cancelamento: resultado.data_cancelamento,
          protocolo_cancelamento: resultado.protocolo_cancelamento,
          motivo: motivoSanitizado,
          justificativa: motivoSanitizado,
          usuario: "Sistema"
        },
        xml_cancelamento: resultado.xml_cancelamento_url,
        historico: [
          ...(nfe.historico || []),
          {
            data_hora: new Date().toISOString(),
            evento: "NF-e Cancelada (Simulação)",
            usuario: "Sistema",
            detalhes: motivoSanitizado
          }
        ]
      }));

      // Log fiscal
      await base44.entities.LogFiscal.create({
        empresa_id: nfe.empresa_id || empresaId,
        group_id: nfe.group_id || groupId,
        grupo_id: nfe.grupo_id || nfe.group_id || groupId,
        nfe_id: nfe.id,
        numero_nfe: nfe.numero,
        chave_acesso: nfe.chave_acesso,
        data_hora: new Date().toISOString(),
        acao: "cancelar",
        provedor: "Mock/Simulação",
        ambiente: nfe.ambiente,
        status: "sucesso",
        mensagem: resultado.mensagem_sefaz,
        retorno_recebido: resultado,
        usuario_nome: "Sistema"
      });

      return resultado;
    },
    onError: (error) => {
      toast({ title: error.message || 'Falha ao cancelar NF-e', variant: 'destructive' });
    },
    onSuccess: async (_, { nfe }) => {
      await auditFiscalComercial('nota_fiscal_cancelada', { entidade: 'NotaFiscal', nota_id: nfe?.id, numero: nfe?.numero }, true);
      queryClient.invalidateQueries({ queryKey: ['notasFiscais'] });
      toast({ title: 'NF-e Cancelada (Simulacao)' });
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const acao = selectedNF ? 'atualizar' : 'criar';
    if (!window.confirm(`Confirmar ${acao} esta Nota Fiscal?`)) {
      await auditFiscalComercial('nota_fiscal_salvar_cancelado', { motivo: 'confirmacao_cancelada', nota_id: selectedNF?.id || null }, false);
      return;
    }
    const payload = withFiscalContext(sanitizeOnWrite({
      ...formData,
      cliente_fornecedor: sanitizeFiscalText(formData.cliente_fornecedor),
      numero: sanitizeFiscalText(formData.numero),
      serie: sanitizeFiscalText(formData.serie),
      observacoes: sanitizeFiscalText(formData.observacoes),
    }));
    if (selectedNF) { // Changed from editingNota
      updateMutation.mutate({ id: selectedNF.id, data: payload }); // Changed from editingNota
    } else {
      createMutation.mutate(payload);
    }
  };
  const handleEdit = (nota) => {
    setSelectedNF(nota); // Changed from setEditingNota
    setFormData(nota);
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      tipo: "NF-e (Saída)",
      cliente_fornecedor: "",
      numero: "",
      serie: "1",
      data_emissao: new Date().toISOString().split('T')[0],
      valor_produtos: 0,
      valor_total: 0,
      observacoes: ""
    });
  };

  const handleCancelarNFe = (nfe) => {
    const motivo = prompt("Digite o motivo do cancelamento:");
    if (!motivo) return;
    if (!window.confirm(`Confirmar cancelamento da NF-e ${nfe.numero || ''}?`)) {
      auditFiscalComercial('nota_fiscal_cancelamento_cancelado', { motivo: 'confirmacao_cancelada', nota_id: nfe.id, numero: nfe.numero }, false);
      return;
    }

    if (motivo.length < 15) {
      toast({
        title: "⚠️ Motivo muito curto",
        description: "O motivo deve ter pelo menos 15 caracteres",
        variant: "destructive"
      });
      return;
    }

    cancelarNFeMutation.mutate({ nfe, motivo });
  };

  const filteredNotas = notasList.filter(n => {
    const searchLower = searchTerm.toLowerCase();
    const matchSearch = n.cliente_fornecedor?.toLowerCase().includes(searchLower) ||
                       n.numero?.toString().includes(searchLower) ||
                       n.serie?.toString().includes(searchLower) ||
                       n.chave_acesso?.includes(searchLower) ||
                       n.protocolo_autorizacao?.includes(searchLower) ||
                       n.tipo?.toLowerCase().includes(searchLower) ||
                       n.status?.toLowerCase().includes(searchLower) ||
                       n.natureza_operacao?.toLowerCase().includes(searchLower) ||
                       n.cfop?.includes(searchLower) ||
                       n.numero_pedido?.includes(searchLower) ||
                       n.cliente_cpf_cnpj?.includes(searchLower) ||
                       n.observacoes?.toLowerCase().includes(searchLower);
    const matchStatus = statusFilter === "todas" || n.status === statusFilter;
    const matchTipo = tipoFilter === "todas" || n.tipo === tipoFilter;
    return matchSearch && matchStatus && matchTipo;
  });

  const totalAutorizada = notasList.filter(n => n.status === "Autorizada").reduce((sum, n) => sum + (n.valor_total || 0), 0);
  const totalCancelada = notasList.filter(n => n.status === "Cancelada").reduce((sum, n) => sum + (n.valor_total || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Emitidas</p>
                <p className="text-2xl font-bold text-slate-900">{notasFiscais.length}</p>
              </div>
              <FileText className="w-8 h-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-green-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700">Autorizadas</p>
                <p className="text-2xl font-bold text-green-900">
                  R$ {totalAutorizada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <FileText className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-700">Canceladas</p>
                <p className="text-2xl font-bold text-red-900">
                  R$ {totalCancelada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <FileText className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-md">
        <CardContent className="p-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <Input
                placeholder="Buscar por cliente, número, série, chave, CPF/CNPJ, tipo, pedido..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}> {/* Changed from selectedStatus */}
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todos os Status</SelectItem>
                <SelectItem value="Autorizada">Autorizada</SelectItem>
                <SelectItem value="Cancelada">Cancelada</SelectItem>
                <SelectItem value="Denegada">Denegada</SelectItem>
                <SelectItem value="Pendente">Pendente</SelectItem>
                <SelectItem value="Erro">Erro</SelectItem>
              </SelectContent>
            </Select>
            <Select value={tipoFilter} onValueChange={setTipoFilter}> {/* Added tipoFilter */}
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todos os Tipos</SelectItem>
                <SelectItem value="NF-e (Saída)">NF-e (Saída)</SelectItem>
                <SelectItem value="NF-e (Entrada)">NF-e (Entrada)</SelectItem>
                <SelectItem value="NFS-e">NFS-e</SelectItem>
                <SelectItem value="CT-e">CT-e</SelectItem>
              </SelectContent>
            </Select>
            {onCreateNFe && canCreateNota && contextoValido && empresaId && (
              <Button 
                className="bg-blue-600 hover:bg-blue-700"
                data-permission="Fiscal.NotaFiscal.criar"
                data-action="Fiscal.NotaFiscal.criar"
                data-context-required="true"
                data-sensitive="true"
                onClick={onCreateNFe}
              >
                <Plus className="w-4 h-4 mr-2" />
                Nova NF-e
              </Button>
            )}
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                setSelectedNF(null);
                resetForm();
              }
            }}>
              <DialogTrigger asChild>
                {!onCreateNFe && canCreateNota && (
                  <Button className="bg-blue-600 hover:bg-blue-700" data-permission="Fiscal.NotaFiscal.criar" data-action="Fiscal.NotaFiscal.criar_rapido" data-context-required="true" data-sensitive="true" disabled={!contextoValido || !empresaId}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nova NF-e (Rápido)
                  </Button>
                )}
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{selectedNF ? 'Editar' : 'Nova'} Nota Fiscal</DialogTitle> {/* Changed from editingNota */}
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label>Tipo *</Label>
                    <Select
                      value={formData.tipo}
                      onValueChange={(value) => setFormData({ ...formData, tipo: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NF-e (Saída)">NF-e (Saída)</SelectItem>
                        <SelectItem value="NF-e (Entrada)">NF-e (Entrada)</SelectItem>
                        <SelectItem value="NFS-e">NFS-e</SelectItem>
                        <SelectItem value="CT-e">CT-e</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Cliente/Fornecedor *</Label>
                    <Input
                      value={formData.cliente_fornecedor}
                      onChange={(e) => setFormData({ ...formData, cliente_fornecedor: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Número *</Label>
                      <Input
                        value={formData.numero}
                        onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label>Série *</Label>
                      <Input
                        value={formData.serie}
                        onChange={(e) => setFormData({ ...formData, serie: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Data de Emissão *</Label>
                      <Input
                        type="date"
                        value={formData.data_emissao}
                        onChange={(e) => setFormData({ ...formData, data_emissao: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label>Valor Produtos *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.valor_produtos}
                        onChange={(e) => setFormData({ ...formData, valor_produtos: parseFloat(e.target.value) })}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Valor Total *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.valor_total}
                      onChange={(e) => setFormData({ ...formData, valor_total: parseFloat(e.target.value) })}
                      required
                    />
                  </div>
                  <div>
                    <Label>Observações</Label>
                    <Textarea
                      value={formData.observacoes}
                      onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending || !contextoValido || !empresaId || (selectedNF ? !canEditNota : !canCreateNota)} data-action={selectedNF ? "Fiscal.NotaFiscal.editar" : "Fiscal.NotaFiscal.criar"} data-permission={selectedNF ? "Fiscal.NotaFiscal.editar" : "Fiscal.NotaFiscal.criar"} data-context-required="true" data-sensitive="true">
                      {selectedNF ? 'Atualizar' : 'Criar'} {/* Changed from editingNota */}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md">
        <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between">
          <CardTitle>Notas Fiscais Emitidas</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedNotas.length > 0 && (
            <Alert className="mb-3 border-blue-300 bg-blue-50">
              <AlertDescription className="flex items-center justify-between">
                <div className="text-blue-900 font-semibold">{selectedNotas.length} NF selecionada(s)</div>
                <div className="flex gap-2">
                  <ProtectedAction module="Fiscal" section="NotaFiscal" action="exportar" mode="disable">
                    <Button variant="outline" data-action="Fiscal.NotaFiscal.exportar" data-permission="Fiscal.NotaFiscal.exportar" data-context-required="true" onClick={() => { if (window.confirm("Confirmar exportacao das NF-e selecionadas?")) exportarNotasCSV(filteredNotas.filter(n => selectedNotas.includes(n.id))); }}>
                      <Download className="w-4 h-4 mr-2" /> Exportar CSV
                    </Button>
                  </ProtectedAction>
                  <Button variant="ghost" onClick={() => setSelectedNotas([])}>Limpar Seleção</Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* DataTable padronizado com backend sort/paginação */}
          <ERPDataTable
            columns={[
              { key: 'numero', label: 'Número', render: (n) => <span className="font-medium">{n.numero}</span> },
              { key: 'serie', label: 'Série' },
              { key: 'tipo', label: 'Tipo' },
              { key: 'cliente_fornecedor', label: 'Cliente/Fornecedor' },
              { key: 'data_emissao', label: 'Data Emissão', render: (n) => new Date(n.data_emissao).toLocaleDateString('pt-BR') },
              { key: 'valor_total', label: 'Valor Total', isNumeric: true, render: (n) => `R$ ${Number(n.valor_total||0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
              { key: 'status', label: 'Status', render: (n) => (
                <Badge className={
                  n.status === 'Autorizada' ? 'bg-green-100 text-green-700' :
                  n.status === 'Cancelada' ? 'bg-red-100 text-red-700' :
                  n.status === 'Denegada' ? 'bg-gray-100 text-gray-700' :
                  n.status === 'Pendente' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-orange-100 text-orange-700'
                }>
                  {n.status}
                </Badge>
              ) },
              { key: 'actions', label: 'Ações', render: (nota) => (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" data-permission="Fiscal.NotaFiscal.visualizar" onClick={() => setViewingDetails(nota)} title="Ver Detalhes" className="h-8 px-2">
                    <Eye className="w-3 h-3 mr-1" /> <span className="text-xs">Ver</span>
                  </Button>
                  <Button variant="ghost" size="sm" data-permission="Fiscal.NotaFiscal.imprimir" onClick={() => { const empresa = empresasDoGrupo?.find(e => e.id === nota.empresa_id); ImprimirDANFESimplificado({ nfe: nota, empresa }); }} title="Imprimir DANFE" className="h-8 px-2 text-slate-600">
                    <Printer className="w-3 h-3 mr-1" /> <span className="text-xs">Imprimir</span>
                  </Button>
                  {nota.danfe_url && (
                    <Button variant="ghost" size="sm" data-permission="Fiscal.NotaFiscal.baixar_pdf" onClick={() => window.open(nota.danfe_url, '_blank')} title="Baixar DANFE" className="h-8 px-2 text-blue-600">
                      <Download className="w-3 h-3 mr-1" /> <span className="text-xs">PDF</span>
                    </Button>
                  )}
                  {nota.status === 'Pendente' && hasPermission('Fiscal','NotaFiscal','enviar') && (
                    <Button variant="ghost" size="sm" title="Enviar NF-e" className="h-8 px-2 text-green-600" data-permission="Fiscal.NotaFiscal.enviar">
                      <Send className="w-3 h-3 mr-1" /> <span className="text-xs">Enviar</span>
                    </Button>
                  )}
                  {nota.status === 'Autorizada' && (
                    <ProtectedAction module="Fiscal" section="NotaFiscal" action="cancelar" mode="disable">
                      <Button variant="ghost" size="sm" onClick={() => handleCancelarNFe(nota)} disabled={!contextoValido || !canCancelNota || cancelarNFeMutation.isPending} className="h-8 px-2 text-red-600" title="Cancelar NF-e" data-action="Fiscal.NotaFiscal.cancelar" data-permission="Fiscal.NotaFiscal.cancelar" data-context-required="true" data-sensitive="true">
                        <XCircle className="w-3 h-3 mr-1" /> <span className="text-xs">Cancelar</span>
                      </Button>
                    </ProtectedAction>
                  )}
                </div>
              ) }
            ]}
            data={filteredNotas}
            entityName="NotaFiscal"
            sortField={sortField}
            sortDirection={sortDirection}
            onSortChange={(sf, sd) => { setSortField(sf); setSortDirection(sd); }}
            selectedIds={selectedNotas}
            allSelected={selectedNotas.length === filteredNotas.length && filteredNotas.length > 0}
            onToggleSelectAll={() => {
              const all = selectedNotas.length === filteredNotas.length && filteredNotas.length > 0;
              setSelectedNotas(all ? [] : filteredNotas.map(n=>n.id));
            }}
            onToggleItem={(id) => toggleNota(id)}
            permission="Fiscal.NotaFiscal.visualizar"
            page={page}
            pageSize={pageSize}
            totalItems={page * pageSize + (notasBackend.length < pageSize ? 0 : 1)}
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
          />

{/* paginação integrada ao ERPDataTable */}

          {filteredNotas.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma nota encontrada</p>
            </div>
          )}
        </CardContent>
      </Card>

      {viewingDetails && (
        <Dialog open={!!viewingDetails} onOpenChange={() => setViewingDetails(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>📄 Detalhes NF-e {viewingDetails.numero}/{viewingDetails.serie}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-600">Cliente/Fornecedor</Label>
                  <p className="font-semibold">{viewingDetails.cliente_fornecedor}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Status</Label>
                  <Badge className={
                    viewingDetails.status === 'Autorizada' ? 'bg-green-600' :
                    viewingDetails.status === 'Cancelada' ? 'bg-red-600' : 'bg-yellow-600'
                  }>
                    {viewingDetails.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Chave de Acesso</Label>
                  <p className="font-mono text-xs">{viewingDetails.chave_acesso || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Protocolo</Label>
                  <p className="font-mono text-xs">{viewingDetails.protocolo_autorizacao || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Valor Produtos</Label>
                  <p className="text-lg font-bold text-green-600">
                    R$ {viewingDetails.valor_produtos?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Valor Total</Label>
                  <p className="text-lg font-bold text-blue-600">
                    R$ {viewingDetails.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              {viewingDetails.observacoes && (
                <div>
                  <Label className="text-xs text-slate-600">Observações</Label>
                  <p className="text-sm p-3 bg-slate-50 rounded">{viewingDetails.observacoes}</p>
                </div>
              )}
              <div className="flex gap-2 pt-4">
                {viewingDetails.danfe_url && (
                  <Button onClick={() => window.open(viewingDetails.danfe_url, '_blank')}>
                    <Download className="w-4 h-4 mr-2" />
                    Baixar DANFE
                  </Button>
                )}
                <Button variant="outline" onClick={() => setViewingDetails(null)}>
                  Fechar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}