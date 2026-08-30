import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ERPDataTable from '@/components/ui/erp/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, Edit, CheckCircle2, AlertCircle, MessageCircle, Camera, Download, Search, Building2, Package } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import IconeAcessoCliente from "@/components/cadastros/IconeAcessoCliente";
import IconeAcessoTransportadora from "@/components/cadastros/IconeAcessoTransportadora";
import { useWindow } from '@/components/lib/useWindow';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import { useUser } from '@/components/lib/UserContext';
import usePermissions from '@/components/lib/usePermissions';

const EXIBIR_TABELA_LEGADA = false;
import { ProtectedAction } from '@/components/ProtectedAction';
import FormularioEntrega from './FormularioEntrega';
import DetalhesEntregaView from './DetalhesEntregaView';

export default function EntregasListagem({ entregas, clientes, pedidos, empresasDoGrupo, estaNoGrupo, windowMode = false }) {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [sortField, setSortField] = React.useState('data_previsao');
  const [sortDirection, setSortDirection] = React.useState('desc');
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("todos");
  const [selectedEntregas, setSelectedEntregas] = useState([]);
  const { openWindow } = useWindow();
  const { hasPermission } = usePermissions();
  const { empresaAtual, grupoAtual } = useContextoVisual();
  const { user } = useUser();
  const effectiveGroupId = grupoAtual?.id || empresaAtual?.group_id || null;
  const effectiveEmpresaId = estaNoGrupo ? null : (empresaAtual?.id || null);
  const contextoValido = Boolean(effectiveGroupId || effectiveEmpresaId);
  const canViewEntrega = hasPermission('Expedicao', 'Entrega', 'visualizar') || hasPermission('Expedicao', 'Entregas', 'visualizar') || hasPermission('Expedicao', 'Entrega', 'ver');
  const canEditEntrega = hasPermission('Expedicao', 'Entrega', 'editar') || hasPermission('Expedicao', 'Entregas', 'editar');
  const canExportEntrega = hasPermission('Expedicao', 'Entrega', 'exportar') || hasPermission('Expedicao', 'Entregas', 'exportar') || hasPermission('Expedicao', 'Relatorios', 'exportar');

  const auditListagem = async ({ acao, sucesso = true, motivo = null, detalhes = {} }) => {
    try {
      await base44.entities.AuditLog.create({
        acao,
        modulo: 'Expedicao',
        entidade: 'Entrega',
        tipo_auditoria: sucesso ? 'operacional' : 'seguranca',
        usuario_id: user?.id || user?.email || null,
        usuario_nome: user?.full_name || user?.email || 'Sistema',
        group_id: effectiveGroupId,
        grupo_id: effectiveGroupId,
        empresa_id: effectiveEmpresaId,
        resultado: sucesso ? 'sucesso' : 'bloqueado',
        motivo,
        detalhes,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Falha ao auditar listagem de entregas', error);
    }
  };

  const entregasContextuais = entregas.filter(e => {
    if (effectiveEmpresaId && e.empresa_id && e.empresa_id !== effectiveEmpresaId && e.empresa_responsavel_id !== effectiveEmpresaId) return false;
    if (effectiveGroupId && e.group_id && e.group_id !== effectiveGroupId) return false;
    return true;
  });

  const filteredEntregas = entregasContextuais.filter(e => {
    const searchLower = searchTerm.toLowerCase();
    const matchSearch = e.numero_pedido?.toLowerCase().includes(searchLower) ||
                       e.cliente_nome?.toLowerCase().includes(searchLower) ||
                       e.codigo_rastreamento?.toLowerCase().includes(searchLower) ||
                       e.qr_code?.toLowerCase().includes(searchLower) ||
                       e.motorista?.toLowerCase().includes(searchLower) ||
                       e.transportadora?.toLowerCase().includes(searchLower) ||
                       e.regiao_entrega_nome?.toLowerCase().includes(searchLower) ||
                       e.status?.toLowerCase().includes(searchLower) ||
                       e.endereco_entrega_completo?.cidade?.toLowerCase().includes(searchLower) ||
                       e.endereco_entrega_completo?.bairro?.toLowerCase().includes(searchLower) ||
                       e.endereco_entrega_completo?.logradouro?.toLowerCase().includes(searchLower) ||
                       e.contato_entrega?.nome?.toLowerCase().includes(searchLower) ||
                       e.contato_entrega?.telefone?.includes(searchLower);
    const matchStatus = selectedStatus === "todos" || e.status === selectedStatus;
    return matchSearch && matchStatus;
  });

  const statusColors = {
    'Aguardando Separacao': 'bg-yellow-100 text-yellow-700',
    'Em Separacao': 'bg-blue-100 text-blue-700',
    'Pronto para Expedir': 'bg-indigo-100 text-indigo-700',
    'Saiu para Entrega': 'bg-orange-100 text-orange-700',
    'Em Transito': 'bg-cyan-100 text-cyan-700',
    'Entregue': 'bg-green-100 text-green-700',
    'Entrega Frustrada': 'bg-red-100 text-red-700',
  };

  const obterNomeEmpresa = (empresaId) => {
    const empresa = empresasDoGrupo.find(e => e.id === empresaId);
    return empresa?.nome_fantasia || empresa?.razao_social || '-';
  };

  const exportarEntregasSelecionadas = async () => {
    if (!contextoValido || !canExportEntrega) {
      await auditListagem({ acao: 'Entrega.exportar_csv.bloqueado', sucesso: false, motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada', detalhes: { selecionadas: selectedEntregas.length } });
      return;
    }

    const selecionadas = filteredEntregas.filter(e => selectedEntregas.includes(e.id));
    const confirmado = window.confirm("Confirma exportar " + selecionadas.length + " entrega(s) selecionada(s) para CSV?");
    if (!confirmado) {
      await auditListagem({ acao: 'Entrega.exportar_csv.cancelado', sucesso: false, motivo: 'confirmacao_cancelada', detalhes: { selecionadas: selecionadas.length } });
      return;
    }
    if (selecionadas.length === 0) {
      await auditListagem({ acao: 'Entrega.exportar_csv.bloqueado', sucesso: false, motivo: 'nenhuma_entrega_selecionada' });
      return;
    }

    const headers = ['pedido', 'cliente', 'empresa', 'status', 'cidade', 'estado', 'transportadora', 'data_previsao', 'data_saida', 'data_entrega'];
    const escapeCsv = (value) => '"' + String(value ?? '').replace(/"/g, '""') + '"';
    const rows = selecionadas.map(e => [
      e.numero_pedido || '',
      e.cliente_nome || '',
      obterNomeEmpresa(e.empresa_id),
      e.status || '',
      e.endereco_entrega_completo?.cidade || '',
      e.endereco_entrega_completo?.estado || '',
      e.transportadora || '',
      e.data_previsao || '',
      e.data_saida || '',
      e.data_entrega || '',
    ]);
    const csv = [headers, ...rows].map(row => row.map(escapeCsv).join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'entregas-expedicao.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    await auditListagem({ acao: 'Entrega.exportar_csv', detalhes: { quantidade: selecionadas.length, filtros: { status: selectedStatus, busca: searchTerm } } });
  };

  const content = (
    <div className="w-full h-full space-y-2" data-permission="Expedicao.Entrega.visualizar" data-context-required="true">
      {(!contextoValido || !canViewEntrega) && (
        <Alert className="border-red-300 bg-red-50 text-red-800">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {!contextoValido ? "Selecione grupo/empresa para visualizar entregas." : "Seu perfil nao tem permissao para visualizar entregas."}
          </AlertDescription>
        </Alert>
      )}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-3">
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_12rem_auto] gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Buscar por pedido, cliente, rastreio, motorista, cidade, bairro, regiao..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8"
              />
            </div>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-48 h-8">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="Aguardando Separacao">Aguardando</SelectItem>
                <SelectItem value="Em Separacao">Separando</SelectItem>
                <SelectItem value="Pronto para Expedir">Pronto</SelectItem>
                <SelectItem value="Em Transito">Transito</SelectItem>
                <SelectItem value="Entregue">Entregue</SelectItem>
              </SelectContent>
            </Select>
            {selectedEntregas.length > 0 && canExportEntrega && (
              <Button
                variant="outline"
                size="sm"
                onClick={exportarEntregasSelecionadas}
                disabled={!contextoValido || !canExportEntrega}
                data-permission="Expedicao.Entrega.exportar"
                data-action="Entrega.exportar_csv"
                data-context-required="true"
                data-sensitive="true"
              >
                <Download className="w-3 h-3 mr-1" /> CSV ({selectedEntregas.length})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md flex-1 overflow-hidden flex flex-col">
        <CardHeader className="bg-slate-50 border-b py-2 px-3">
          <CardTitle className="text-sm">Lista de Entregas</CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-auto">
          <ERPDataTable
            columns={[
              { key: 'numero_pedido', label: 'Pedido', render: (e) => <span className="font-medium text-sm">{e.numero_pedido || '-'}</span> },
              { key: 'cliente_nome', label: 'Cliente', render: (e) => {
                const cliente = clientes.find(c => c.id === e.cliente_id);
                return cliente ? <IconeAcessoCliente cliente={cliente} variant="badge" /> : <span className="text-sm">{e.cliente_nome}</span>;
              } },
              ...(estaNoGrupo ? [{ key: 'empresa', label: 'Empresa', render: (e) => <span className="text-xs">{obterNomeEmpresa(e.empresa_id)}</span> }] : []),
              { key: 'destino', label: 'Destino', render: (e) => <span className="text-xs">{e.endereco_entrega_completo?.cidade || '-'}, {e.endereco_entrega_completo?.estado || '-'}</span> },
              { key: 'transportadora', label: 'Transportadora', render: (e) => e.transportadora ? <IconeAcessoTransportadora transportadora={{ id: e.transportadora_id, nome: e.transportadora, razao_social: e.transportadora }} variant="badge" /> : <span className="text-xs">Propria</span> },
              { key: 'data_previsao', label: 'Previsao', render: (e) => e.data_previsao ? new Date(e.data_previsao).toLocaleDateString('pt-BR') : '-' },
              { key: 'status', label: 'Status', render: (e) => <Badge className={statusColors[e.status]} style={{ fontSize: '10px' }}>{e.status}</Badge> },
              { key: 'actions', label: 'Acoes', render: (e) => (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => { await auditListagem({ acao: 'Entrega.visualizar', detalhes: { entrega_id: e.id, numero_pedido: e.numero_pedido } }); openWindow(DetalhesEntregaView, { entrega: e, estaNoGrupo, obterNomeEmpresa, statusColors, windowMode: true }, { title: `Entrega ${e.numero_pedido}`, width: 1000, height: 700 }); }}
                    className="h-7 w-7"
                    data-permission="Expedicao.Entrega.visualizar" data-context-required="true"
                    data-action="Entrega.visualizar"
                  >
                    <Eye className="w-3 h-3" />
                  </Button>
                  {canEditEntrega && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => { await auditListagem({ acao: 'Entrega.editar.abrir', detalhes: { entrega_id: e.id, numero_pedido: e.numero_pedido } }); openWindow(FormularioEntrega, { formData: e, windowMode: true, isEditing: true }, { title: `Editar ${e.numero_pedido}`, width: 1100, height: 650 }); }}
                      className="h-7 w-7"
                      data-permission="Expedicao.Entrega.editar" data-context-required="true" data-sensitive="true"
                      data-action="Entrega.editar"
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ) }
            ]}
            data={filteredEntregas}
            entityName="Entrega"
            sortField={sortField}
            sortDirection={sortDirection}
            onSortChange={(sf, sd) => { setSortField(sf); setSortDirection(sd); }}
            selectedIds={selectedEntregas}
            allSelected={selectedEntregas.length === filteredEntregas.length && filteredEntregas.length > 0}
            onToggleSelectAll={() => {
              const all = selectedEntregas.length === filteredEntregas.length && filteredEntregas.length > 0;
              setSelectedEntregas(all ? [] : filteredEntregas.map(e=>e.id));
            }}
            onToggleItem={(id) => setSelectedEntregas(prev => prev.includes(id) ? prev.filter(x => x!==id) : [...prev, id])}
            permission="Expedicao.Entrega.visualizar"
            page={page}
            pageSize={pageSize}
            totalItems={filteredEntregas.length}
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
          />
          {EXIBIR_TABELA_LEGADA && (<Table>
            <TableHeader className="sticky top-0 bg-slate-50 z-10">
              <TableRow>
                <TableHead className="w-10"><Checkbox /></TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                {estaNoGrupo && <TableHead>Empresa</TableHead>}
                <TableHead>Destino</TableHead>
                <TableHead>Transportadora</TableHead>
                <TableHead>Previsao</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntregas.map((entrega) => {
                const cliente = clientes.find(c => c.id === entrega.cliente_id);
                const transportadoraObj = entrega.transportadora_id 
                  ? { id: entrega.transportadora_id, nome: entrega.transportadora, razao_social: entrega.transportadora }
                  : null;

                return (
                  <TableRow key={entrega.id}>
                    <TableCell><Checkbox /></TableCell>
                    <TableCell className="font-medium text-sm">{entrega.numero_pedido || '-'}</TableCell>
                    <TableCell>
                      {cliente ? (
                        <IconeAcessoCliente cliente={cliente} variant="badge" />
                      ) : (
                        <span className="text-sm">{entrega.cliente_nome}</span>
                      )}
                    </TableCell>
                    {estaNoGrupo && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          <span className="text-xs">{obterNomeEmpresa(entrega.empresa_id)}</span>
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="text-xs">{entrega.endereco_entrega_completo?.cidade || '-'}, {entrega.endereco_entrega_completo?.estado || '-'}</TableCell>
                    <TableCell>
                      {transportadoraObj ? (
                        <IconeAcessoTransportadora transportadora={transportadoraObj} variant="badge" />
                      ) : (
                        <span className="text-xs">Propria</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{entrega.data_previsao ? new Date(entrega.data_previsao).toLocaleDateString('pt-BR') : '-'}</TableCell>
                    <TableCell><Badge className={statusColors[entrega.status]} style={{ fontSize: '10px' }}>{entrega.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openWindow(DetalhesEntregaView, { entrega, estaNoGrupo, obterNomeEmpresa, statusColors, windowMode: true }, { title: `Entrega ${entrega.numero_pedido}`, width: 1000, height: 700 })} className="h-7 w-7">
                          <Eye className="w-3 h-3" />
                        </Button>
                        {canEditEntrega && (
                          <Button variant="ghost" size="icon" onClick={() => openWindow(FormularioEntrega, { formData: entrega, windowMode: true, isEditing: true }, { title: `Editar ${entrega.numero_pedido}`, width: 1100, height: 650 })} className="h-7 w-7">
                            <Edit className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>)}

          {filteredEntregas.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>Nenhuma entrega encontrada</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  if (windowMode) {
    return <div className="w-full h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50 overflow-auto p-1.5">{content}</div>;
  }

  return content;
}
