import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Plus, 
  Search, 
  Users, 
  Eye,
  Filter
} from "lucide-react";
import RepresentanteForm from "./RepresentanteForm";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import useContextoVisual from "@/components/lib/useContextoVisual";
import { useWindow } from "@/components/lib/useWindow";

export default function RepresentantesTab() {
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("Ativo");
  const [selectedRepresentante, setSelectedRepresentante] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, estaNoGrupo, filtrarPorContexto, filterInContext } = useContextoVisual();
  const { openWindow } = useWindow();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const contextKey = empresaAtual?.id || groupId || 'sem-contexto';
  const contextoValido = contextKey !== 'sem-contexto';

  const { data: representantes = [], isLoading } = useQuery({
    queryKey: ['representantes', contextKey, estaNoGrupo],
    queryFn: () => filterInContext('Representante', {}, '-created_date', 500),
    enabled: contextoValido,
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes', contextKey],
    queryFn: () => filterInContext('Cliente', {}, '-created_date', 500),
    enabled: contextoValido,
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos', contextKey],
    queryFn: () => filterInContext('Pedido', {}, '-created_date', 500),
    enabled: contextoValido,
  });

  const representantesFiltrados = filtrarPorContexto(representantes, 'empresa_dona_id').filter(rep => {
    const matchSearch = !search || 
      rep.nome?.toLowerCase().includes(search.toLowerCase()) ||
      rep.email?.toLowerCase().includes(search.toLowerCase()) ||
      rep.cpf?.includes(search) ||
      rep.cnpj?.includes(search);
    
    const matchTipo = filtroTipo === 'todos' || rep.tipo_representante === filtroTipo;
    const matchStatus = filtroStatus === 'todos' || rep.status === filtroStatus;
    
    return matchSearch && matchTipo && matchStatus;
  });

  const handleNovo = () => {
    setSelectedRepresentante(null);
    setIsFormOpen(true);
  };

  const handleEditar = (rep) => {
    setSelectedRepresentante(rep);
    setIsFormOpen(true);
  };

  const handleAbrirJanela = (rep) => {
    if (!rep?.id) return;
    openWindow(
      RepresentanteForm,
      {
        representante: rep,
        item: rep,
        initialData: rep,
        windowMode: true,
      },
      {
        title: `Representante · ${rep.nome || rep.codigo || rep.id}`,
        width: 1200,
        height: 800,
        uniqueKey: `Cadastros.Representante.form-${rep.id}`,
      },
    );
  };

  const calcularMetricas = (rep) => {
    const clientesIndicados = clientes.filter(c => c.indicador_id === rep.id);
    const pedidosIndicados = pedidos.filter(p => p.indicador_id === rep.id);
    const totalVendas = pedidosIndicados.reduce((sum, p) => sum + (p.valor_total || 0), 0);
    const totalComissao = pedidosIndicados.reduce((sum, p) => {
      const valor = p.valor_total || 0;
      const percentual = rep.percentual_comissao || 0;
      const fixo = rep.valor_fixo_comissao || 0;
      return sum + (valor * percentual / 100) + fixo;
    }, 0);

    return {
      clientesIndicados: clientesIndicados.length,
      pedidosIndicados: pedidosIndicados.length,
      totalVendas,
      totalComissao
    };
  };

  const tiposRepresentante = [
    { value: 'todos', label: 'Todos os Tipos' },
    { value: 'Representante Comercial', label: '🤝 Representante Comercial' },
    { value: 'Construtor', label: '🏗️ Construtor' },
    { value: 'Arquiteto', label: '📐 Arquiteto' },
    { value: 'Engenheiro', label: '⚙️ Engenheiro' },
    { value: 'Influenciador', label: '📱 Influenciador' },
    { value: 'Parceiro', label: '🤝 Parceiro' }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar por nome, CPF, CNPJ, e-mail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-64">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[99999]">
              {tiposRepresentante.map(tipo => (
                <SelectItem key={tipo.value} value={tipo.value}>{tipo.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[99999]">
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="Ativo">✅ Ativos</SelectItem>
              <SelectItem value="Inativo">❌ Inativos</SelectItem>
              <SelectItem value="Suspenso">⏸️ Suspensos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleNovo} className="bg-sky-600 hover:bg-sky-700">
          <Plus className="w-4 h-4 mr-2" />
          Novo Representante
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">Carregando...</div>
      ) : representantesFiltrados.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="font-medium">Nenhum representante encontrado</p>
          <p className="text-sm">Clique em "Novo Representante" para começar</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {representantesFiltrados.map(rep => {
            const metricas = calcularMetricas(rep);
            return (
              <Card key={rep.id} className="hover:shadow-lg transition-all cursor-pointer border-l-4 border-l-sky-500">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 bg-gradient-to-br from-sky-500 to-sky-600 rounded-xl flex items-center justify-center">
                          <span className="text-white text-lg">
                            {rep.tipo_representante === 'Arquiteto' ? '📐' :
                             rep.tipo_representante === 'Engenheiro' ? '⚙️' :
                             rep.tipo_representante === 'Construtor' ? '🏗️' :
                             rep.tipo_representante === 'Influenciador' ? '📱' : '🤝'}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">{rep.nome}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">{rep.tipo_representante}</Badge>
                            <Badge className={rep.status === 'Ativo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                              {rep.status}
                            </Badge>
                            {rep.crea_cau && (
                              <Badge variant="outline" className="text-xs">
                                {rep.crea_cau}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-4 mt-3 pt-3 border-t">
                        <div>
                          <p className="text-xs text-slate-500">Comissão</p>
                          <p className="font-bold text-sky-600">
                            {rep.percentual_comissao > 0 && `${rep.percentual_comissao}%`}
                            {rep.valor_fixo_comissao > 0 && ` +R$ ${rep.valor_fixo_comissao}`}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Clientes</p>
                          <p className="font-bold text-blue-600">{metricas.clientesIndicados}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Vendas</p>
                          <p className="font-bold text-green-600">R$ {metricas.totalVendas.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Comissão Gerada</p>
                          <p className="font-bold text-sky-600">R$ {metricas.totalComissao.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-3 text-xs text-slate-600">
                        {rep.email && <span>📧 {rep.email}</span>}
                        {rep.whatsapp && <span>📱 {rep.whatsapp}</span>}
                        {rep.endereco?.cidade && <span>📍 {rep.endereco.cidade}/{rep.endereco.estado}</span>}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEditar(rep)}>
                        <Eye className="w-4 h-4 mr-1" />
                        Editar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleAbrirJanela(rep)}>
                        📊 Dashboard
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {isFormOpen && (
        <RepresentanteForm
          representante={selectedRepresentante}
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setSelectedRepresentante(null);
          }}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['representantes'] })}
        />
      )}
    </div>
  );
}