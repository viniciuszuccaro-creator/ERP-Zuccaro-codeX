import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWindow } from "@/components/lib/useWindow";
import ParametroOrigemPedidoForm from "./ParametroOrigemPedidoForm";
import DashboardCanaisOrigem from "./DashboardCanaisOrigem";
import GerenciadorCanaisOrigem from "./GerenciadorCanaisOrigem";
import StatusOrigemPedido100 from "@/components/sistema/StatusOrigemPedido100";
import { 
  Plus, 
  Search, 
  Settings, 
  CheckCircle, 
  XCircle, 
  Edit,
  Zap,
  User,
  BarChart3,
  List
} from "lucide-react";

/**
 * V21.6 - Tab COMPLETA para gerenciar origens de pedidos
 * Lista canais + Dashboard de performance
 */
export default function ParametrosOrigemPedidoTab() {
  const { openWindow } = useWindow();
  const [busca, setBusca] = useState('');
  const [abaAtiva, setAbaAtiva] = useState('canais');

  const { data: parametros, isLoading } = useQuery({
    queryKey: ['parametros-origem-pedido'],
    queryFn: () => base44.entities.ParametroOrigemPedido.list(),
    initialData: [],
  });

  const parametrosFiltrados = parametros.filter(p => 
    p.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    p.canal?.toLowerCase().includes(busca.toLowerCase())
  );

  const handleNovo = () => {
    openWindow({
      title: 'Novo Parâmetro de Origem',
      component: ParametroOrigemPedidoForm,
      props: {},
      size: 'large'
    });
  };

  const handleEditar = (parametro) => {
    openWindow({
      title: `Editar: ${parametro.nome}`,
      component: ParametroOrigemPedidoForm,
      props: { parametro },
      size: 'large'
    });
  };

  const iconesTipo = {
    'Manual': User,
    'Automático': Zap,
    'Misto': Settings
  };

  const canaisAtivos = parametros.filter(p => p.ativo).length;
  const canaisInativos = parametros.filter(p => !p.ativo).length;

  return (
    <div className="space-y-4">
      
      {/* Estatísticas Rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-slate-600">Total Canais</p>
            <p className="text-2xl font-bold text-blue-600">{parametros.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-slate-600">Ativos</p>
            <p className="text-2xl font-bold text-green-600">{canaisAtivos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-slate-600">Inativos</p>
            <p className="text-2xl font-bold text-orange-600">{canaisInativos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-slate-600">Automáticos</p>
            <p className="text-2xl font-bold text-sky-600">
              {parametros.filter(p => p.tipo_criacao === 'Automático' || p.tipo_criacao === 'Misto').length}
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Tabs: Canais vs Dashboard */}
      <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
        <div className="flex gap-3 items-center mb-4">
          <TabsList className="bg-slate-100">
            <TabsTrigger value="canais">
              <List className="w-4 h-4 mr-2" />
              Canais Configurados
            </TabsTrigger>
            <TabsTrigger value="gerenciador">
              <Settings className="w-4 h-4 mr-2" />
              Gerenciador Rápido
            </TabsTrigger>
            <TabsTrigger value="dashboard">
              <BarChart3 className="w-4 h-4 mr-2" />
              Dashboard & Performance
            </TabsTrigger>
            <TabsTrigger value="status">
              <CheckCircle className="w-4 h-4 mr-2" />
              ✅ Status 100%
            </TabsTrigger>
          </TabsList>

          {abaAtiva === 'canais' && (
            <>
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Buscar por nome ou canal..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleNovo}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Canal
              </Button>
            </>
          )}
        </div>

        {/* ABA: CANAIS */}
        <TabsContent value="canais" className="mt-0">

          {/* Lista de parâmetros */}
        {isLoading ? (
          <div className="text-center py-12 text-slate-500">
            Carregando parâmetros...
          </div>
        ) : parametrosFiltrados.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Settings className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-600 font-medium">
              Nenhum parâmetro configurado
            </p>
            <p className="text-sm text-slate-500 mt-1">
              Crie seu primeiro canal de origem de pedidos
            </p>
            <Button onClick={handleNovo} className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Criar Primeiro Canal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {parametrosFiltrados.map((param) => {
            const IconeTipo = iconesTipo[param.tipo_criacao] || Settings;
            
            return (
              <Card 
                key={param.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleEditar(param)}
              >
                <CardContent className="p-4">
                  
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg bg-${param.cor_badge}-100`}>
                        <IconeTipo className={`w-5 h-5 text-${param.cor_badge}-600`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">
                          {param.nome}
                        </h3>
                        <p className="text-xs text-slate-500">
                          Canal: {param.canal}
                        </p>
                      </div>
                    </div>
                    
                    {param.ativo ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className={`bg-${param.cor_badge}-100 text-${param.cor_badge}-800 border-${param.cor_badge}-300`}>
                        {param.tipo_criacao}
                      </Badge>
                      {param.bloquear_edicao_automatico && param.tipo_criacao !== 'Manual' && (
                        <Badge variant="outline" className="text-xs">
                          🔒 Bloqueado
                        </Badge>
                      )}
                    </div>

                    {param.tipo_criacao !== 'Automático' && (
                      <div className="text-xs text-slate-600">
                        <span className="font-medium">Manual:</span> {param.origem_pedido_manual}
                      </div>
                    )}

                    {param.tipo_criacao !== 'Manual' && (
                      <div className="text-xs text-slate-600">
                        <span className="font-medium">Automático:</span> {param.origem_pedido_automatico}
                      </div>
                    )}

                    {param.descricao && (
                      <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                        {param.descricao}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end mt-3 pt-3 border-t">
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditar(param);
                      }}
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      Editar
                    </Button>
                  </div>

                </CardContent>
              </Card>
            );
          })}
          </div>
        )}
        </TabsContent>

        {/* ABA: GERENCIADOR RÁPIDO */}
        <TabsContent value="gerenciador" className="mt-0">
          <GerenciadorCanaisOrigem />
        </TabsContent>

        {/* ABA: GERENCIADOR RÁPIDO */}
        <TabsContent value="gerenciador" className="mt-0">
          <GerenciadorCanaisOrigem />
        </TabsContent>

        {/* ABA: DASHBOARD */}
        <TabsContent value="dashboard" className="mt-0">
          <DashboardCanaisOrigem />
        </TabsContent>

        {/* ABA: STATUS 100% */}
        <TabsContent value="status" className="mt-0">
          <div className="space-y-4">
            <StatusOrigemPedido100 />
          </div>
        </TabsContent>
      </Tabs>

    </div>
  );
}
