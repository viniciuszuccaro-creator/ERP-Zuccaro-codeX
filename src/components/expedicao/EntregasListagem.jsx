import React, { useState } from 'react';
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
import usePermissions from '@/components/lib/usePermissions';
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

  const filteredEntregas = entregas.filter(e => {
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
    'Aguardando Separação': 'bg-yellow-100 text-yellow-700',
    'Em Separação': 'bg-blue-100 text-blue-700',
    'Pronto para Expedir': 'bg-indigo-100 text-indigo-700',
    'Saiu para Entrega': 'bg-orange-100 text-orange-700',
    'Em Trânsito': 'bg-cyan-100 text-cyan-700',
    'Entregue': 'bg-green-100 text-green-700',
    'Entrega Frustrada': 'bg-red-100 text-red-700',
  };

  const obterNomeEmpresa = (empresaId) => {
    const empresa = empresasDoGrupo.find(e => e.id === empresaId);
    return empresa?.nome_fantasia || empresa?.razao_social || '-';
  };

  const content = (
    <div className="space-y-2">
      <Card className="border-0 shadow-sm">
        <CardContent className="p-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Buscar por pedido, cliente, rastreio, motorista, cidade, bairro, região..."
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
                <SelectItem value="Aguardando Separação">Aguardando</SelectItem>
                <SelectItem value="Em Separação">Separando</SelectItem>
                <SelectItem value="Pronto para Expedir">Pronto</SelectItem>
                <SelectItem value="Em Trânsito">Trânsito</SelectItem>
                <SelectItem value="Entregue">Entregue</SelectItem>
              </SelectContent>
            </Select>
            {selectedEntregas.length > 0 && hasPermission('Expedição','Entrega','exportar') && (
              <Button
                variant="outline"
                size="sm"
                data-permission="Expedição.Entrega.exportar"
                data-action="exportar-entregas-csv"
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
              { key: 'transportadora', label: 'Transportadora', render: (e) => e.transportadora ? <IconeAcessoTransportadora transportadora={{ id: e.transportadora_id, nome: e.transportadora, razao_social: e.transportadora }} variant="badge" /> : <span className="text-xs">Própria</span> },
              { key: 'data_previsao', label: 'Previsão', render: (e) => e.data_previsao ? new Date(e.data_previsao).toLocaleDateString('pt-BR') : '-' },
              { key: 'status', label: 'Status', render: (e) => <Badge className={statusColors[e.status]} style={{ fontSize: '10px' }}>{e.status}</Badge> },
              { key: 'actions', label: 'Ações', render: (e) => (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openWindow(DetalhesEntregaView, { entrega: e, estaNoGrupo, obterNomeEmpresa, statusColors, windowMode: true }, { title: `🚚 ${e.numero_pedido}`, width: 1000, height: 700 })}
                    className="h-7 w-7"
                    data-permission="Expedição.Entrega.visualizar"
                    data-action="visualizar-entrega"
                  >
                    <Eye className="w-3 h-3" />
                  </Button>
                  {hasPermission('Expedição','Entrega','editar') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openWindow(FormularioEntrega, { formData: e, windowMode: true, isEditing: true }, { title: `✏️ ${e.numero_pedido}`, width: 1100, height: 650 })}
                      className="h-7 w-7"
                      data-permission="Expedição.Entrega.editar"
                      data-action="editar-entrega"
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
            permission="Expedição.Entrega.visualizar"
            page={page}
            pageSize={pageSize}
            totalItems={filteredEntregas.length}
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
          />
          {false && (<Table>
            <TableHeader className="sticky top-0 bg-slate-50 z-10">
              <TableRow>
                <TableHead className="w-10"><Checkbox /></TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                {estaNoGrupo && <TableHead>Empresa</TableHead>}
                <TableHead>Destino</TableHead>
                <TableHead>Transportadora</TableHead>
                <TableHead>Previsão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
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
                        <span className="text-xs">Própria</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{entrega.data_previsao ? new Date(entrega.data_previsao).toLocaleDateString('pt-BR') : '-'}</TableCell>
                    <TableCell><Badge className={statusColors[entrega.status]} style={{ fontSize: '10px' }}>{entrega.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openWindow(DetalhesEntregaView, { entrega, estaNoGrupo, obterNomeEmpresa, statusColors, windowMode: true }, { title: `🚚 ${entrega.numero_pedido}`, width: 1000, height: 700 })} className="h-7 w-7">
                          <Eye className="w-3 h-3" />
                        </Button>
                        {hasPermission('Expedição','Entrega','editar') && (
                          <Button variant="ghost" size="icon" onClick={() => openWindow(FormularioEntrega, { formData: entrega, windowMode: true, isEditing: true }, { title: `✏️ ${entrega.numero_pedido}`, width: 1100, height: 650 })} className="h-7 w-7">
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
